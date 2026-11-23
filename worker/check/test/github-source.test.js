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
    'POST https://api.github.com/graphql': (init) => {
      return { body: { data: { repository: readBlobs({ files, variables: JSON.parse(init.body).variables }) } } }
    },
    ...registryRoutes({ latest: CLEAN_LATEST }),
  }
}

function readBlobs({ files, variables }) {
  return Object.fromEntries(
    Object.entries(variables)
      .filter(([name]) => /^e\d+$/.test(name))
      .map(([name, expression]) => {
        const path = expression.slice(expression.indexOf(':') + 1)
        return [`f${name.slice(1)}`, path in files ? { text: files[path], isBinary: false, isTruncated: false } : null]
      }),
  )
}

function readGraphqlPaths(fetch) {
  return fetch.calls
    .filter((call) => call.url === 'https://api.github.com/graphql')
    .flatMap((call) => {
      return Object.entries(JSON.parse(call.init.body).variables)
        .filter(([name]) => /^e\d+$/.test(name))
        .map(([, expression]) => expression.slice(expression.indexOf(':') + 1))
    })
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

    const { fetch } = await run({ routes: githubRoutes({ files }), githubToken: 'test-token' })
    const migrationReads = readGraphqlPaths(fetch).filter((path) => path.includes('migrations'))

    expect(migrationReads).toHaveLength(50)
  })

  it('says it could not check row rules when migrations past the cap stay unread', async () => {
    const files = { ...CLEAN_REPO }
    for (let index = 0; index < 60; index++) {
      files[`supabase/migrations/${String(index + 100)}_t.sql`] = `create table t${index} (id int);\nalter table t${index} enable row level security;\n`
    }

    const { result } = await run({ routes: githubRoutes({ files }), githubToken: 'test-token' })

    expect(result.checks.find((check) => check.id === 'G4')).toMatchObject({
      status: 'warn',
      title: 'Could not check table row rules',
    })
  })

  it('reads a whole repo in a few GraphQL requests, not one request per file', async () => {
    const files = { ...CLEAN_REPO }
    for (let index = 0; index < 250; index++) {
      files[`src/components/Part${index}.tsx`] = `export const Part${index} = () => null\n`
    }

    const { result, fetch } = await run({ routes: githubRoutes({ files }), githubToken: 'test-token' })

    expect(fetch.calls.filter((call) => call.url.startsWith(RAW))).toHaveLength(0)
    expect(fetch.calls.filter((call) => call.url === 'https://api.github.com/graphql')).toHaveLength(3)
    expect(result.failed).toBe(0)
  })

  it('without a token reads only the first files and says which rows it could not check', async () => {
    const files = { ...CLEAN_REPO }
    for (let index = 0; index < 30; index++) {
      files[`src/components/Part${index}.tsx`] = `export const Part${index} = () => null\n`
    }

    const { result, fetch } = await run({ routes: githubRoutes({ files }) })
    const titles = result.checks.filter((check) => check.title.startsWith('Could not check')).map((check) => check.id)

    expect(fetch.calls.filter((call) => call.url.startsWith(RAW))).toHaveLength(15)
    expect(fetch.calls.some((call) => call.url === 'https://api.github.com/graphql')).toBe(false)
    expect(titles).toEqual(expect.arrayContaining(['G6', 'G12']))
    expect(result.checks.find((check) => check.id === 'G6').status).not.toBe('pass')
  })

  it('stays within 45 requests on a big repo and says which rows it could not check', async () => {
    const names = Array.from({ length: 80 }, (_, index) => `pkg-${index}`)
    const files = {
      'package.json': JSON.stringify({
        name: 'big',
        scripts: { test: 'vitest run' },
        dependencies: Object.fromEntries(names.map((name) => [name, '^1.0.0'])),
      }),
      'package-lock.json': JSON.stringify({
        lockfileVersion: 3,
        packages: Object.fromEntries(names.map((name) => [`node_modules/${name}`, { version: '1.0.0' }])),
      }),
      ...Object.fromEntries(Array.from({ length: 320 }, (_, index) => [`src/pages/Page${index}.tsx`, 'export const a = 1'])),
    }
    const osvResults = Object.fromEntries(names.slice(0, 20).map((name) => [name, { vulns: [{ id: `GHSA-${name}` }] }]))
    const routes = {
      ...githubRoutes({ files }),
      ...registryRoutes({
        osvResults,
        latest: Object.fromEntries(names.map((name) => [name, '1.0.0'])),
        vulns: Object.fromEntries(names.map((name) => [`GHSA-${name}`, 'HIGH'])),
      }),
    }

    for (const githubToken of ['test-token', undefined]) {
      const { result, fetch } = await run({ routes, githubToken })
      const row = (id) => result.checks.find((check) => check.id === id)

      expect(result.error ?? null).toBe(null)
      expect(fetch.calls.length).toBeLessThanOrEqual(45)
      expect(fetch.calls.filter((call) => call.url.startsWith('https://registry.npmjs.org/')).length).toBeLessThanOrEqual(20)
      expect(fetch.calls.filter((call) => call.url.startsWith('https://api.osv.dev/v1/vulns/')).length).toBeLessThanOrEqual(5)
      expect(row('G11').title).toBe('Could not check all package versions')
      expect(row('G11').status).not.toBe('pass')
    }
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
