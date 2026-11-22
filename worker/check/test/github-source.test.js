import { describe, expect, it } from 'vitest'
import { runCheck } from '../index.js'
import { CLEAN_LATEST, CLEAN_REPO, fakeFetch, registryRoutes } from './helpers.js'

const API = 'https://api.github.com/repos/acme/app'
const RAW = 'https://raw.githubusercontent.com/acme/app/1234567890abcdef'
const NOW = Date.parse('2026-11-20T00:00:00Z')

function githubRoutes({ files, meta = {} }) {
  return {
    [API]: { body: { private: false, default_branch: 'main', ...meta } },
    [`${API}/commits?sha=main&per_page=100`]: {
      body: [
        { sha: '1234567890abcdef', author: { login: 'ana' }, commit: { committer: { date: '2026-11-10T00:00:00Z' } } },
        { sha: 'fedcba', author: null, commit: { author: { email: 'bo@example.com', date: '2026-11-01T00:00:00Z' } } },
        { sha: 'aaaaaa', author: { login: 'ana' }, commit: { committer: { date: '2026-10-01T00:00:00Z' } } },
      ],
    },
    [`${API}/git/trees/main?recursive=1`]: {
      body: {
        sha: 'tree',
        tree: Object.entries(files).map(([path, text]) => {
          return {
            path,
            type: 'blob',
            size: text.length,
          }
        }),
      },
    },
    ...Object.fromEntries(
      Object.entries(files).map(([path, text]) => {
        return [`${RAW}/${path.split('/').map(encodeURIComponent).join('/')}`, { body: text }]
      }),
    ),
    ...registryRoutes({ latest: CLEAN_LATEST }),
  }
}

function run({ routes, githubToken }) {
  const fetch = fakeFetch({ routes })
  return runCheck('https://github.com/acme/app', {
    fetch,
    githubToken,
    now: () => NOW,
  }).then((result) => {
    return {
      result,
      fetch,
    }
  })
}

describe('repo mode over GitHub', () => {
  it('reads the tree and files and fills commit and team info', async () => {
    const { result } = await run({ routes: githubRoutes({ files: CLEAN_REPO }), githubToken: 'test-token' })

    expect(result).toMatchObject({
      name: 'app',
      commit: '1234567',
      failed: 0,
      total: 13,
      info: {
        authors: 2,
        lastCommitDays: 10,
      },
    })
  })

  it('sends the token only to the GitHub API and never into the result', async () => {
    const { result, fetch } = await run({ routes: githubRoutes({ files: CLEAN_REPO }), githubToken: 'test-token-xyz' })
    const withToken = fetch.calls.filter((call) => JSON.stringify(call.init.headers ?? {}).includes('test-token-xyz'))

    expect(withToken.length).toBeGreaterThan(0)
    expect(withToken.every((call) => call.url.startsWith('https://api.github.com/'))).toBe(true)
    expect(JSON.stringify(result)).not.toContain('test-token-xyz')
  })

  it('reads at most 50 migrations', async () => {
    const files = { ...CLEAN_REPO }
    for (let index = 0; index < 60; index++) {
      files[`supabase/migrations/${String(index + 100)}_t.sql`] = `create table t${index} (id int);\nalter table t${index} enable row level security;\n`
    }

    const { fetch } = await run({ routes: githubRoutes({ files }) })
    const migrationReads = fetch.calls.filter((call) => call.url.startsWith(RAW) && call.url.includes('migrations'))

    expect(migrationReads).toHaveLength(50)
  })

  it('returns private_repo for a private repo', async () => {
    const { result } = await run({ routes: githubRoutes({ files: CLEAN_REPO, meta: { private: true } }) })

    expect(result.error).toBe('private_repo')
  })

  it('returns not_found for a missing repo', async () => {
    const { result } = await run({ routes: {} })

    expect(result.error).toBe('not_found')
  })

  it('returns rate_limited when GitHub runs out of requests', async () => {
    const { result } = await run({
      routes: {
        [API]: {
          status: 403,
          headers: { 'x-ratelimit-remaining': '0' },
          body: { message: 'API rate limit exceeded' },
        },
      },
    })

    expect(result).toMatchObject({
      error: 'rate_limited',
      message: expect.any(String),
    })
  })

  it('returns upstream when GitHub fails', async () => {
    const { result } = await run({ routes: { [API]: { status: 502, body: 'bad gateway' } } })

    expect(result.error).toBe('upstream')
  })
})
