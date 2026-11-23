import { CheckError } from '../errors.js'
import { readCapped } from '../guarded-fetch.js'

const API = 'https://api.github.com'
const RAW = 'https://raw.githubusercontent.com'
const DAY_MS = 86_400_000
const API_RESPONSE_MAX_BYTES = 8 * 1024 * 1024
// One GraphQL request reads a batch of files, so a whole repo fits the subrequest budget.
const BATCH_MAX_FILES = 100
const BATCH_MAX_BYTES = 2 * 1024 * 1024
const BATCH_RESPONSE_MAX_BYTES = 6 * 1024 * 1024
// Without a token GraphQL is closed, so only the first files (settings, lockfile, migrations) are read.
export const MAX_RAW_READS = 15
const RAW_FILE_MAX_BYTES = 1024 * 1024
const RAW_CONCURRENCY = 4

export async function openGithubRepo({ owner, repo, fetch, token, now }) {
  const headers = {
    accept: 'application/vnd.github+json',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  }
  const meta = await getJson({
    fetch,
    url: `${API}/repos/${owner}/${repo}`,
    headers,
  })
  if (meta.private) {
    throw new CheckError('private_repo')
  }
  const branch = meta.default_branch
  const [commits, tree] = await Promise.all([
    getJson({
      fetch,
      url: `${API}/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(branch)}&per_page=100`,
      headers,
    }),
    getJson({
      fetch,
      url: `${API}/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      headers,
    }),
  ])
  const sha = commits[0]?.sha ?? tree.sha
  const files = tree.tree
    .filter((entry) => entry.type === 'blob')
    .map((entry) => {
      return {
        path: entry.path,
        size: entry.size ?? 0,
      }
    })
  return {
    name: repo,
    commit: sha ? sha.slice(0, 7) : null,
    info: buildInfo({ commits, now }),
    files,
    async readFiles({ paths }) {
      if (!token || !sha) {
        return readRawFiles({ fetch, owner, repo, sha: sha ?? branch, paths: paths.slice(0, MAX_RAW_READS) })
      }
      const files = new Map()
      for (const batch of splitBatches(paths)) {
        const texts = await readBatch({ fetch, headers, owner, repo, sha, paths: batch })
        texts.forEach((text, path) => {
          files.set(path, text)
        })
      }
      return files
    },
  }
}

// A batch that fails leaves its files unread; the checks that need them report "could not check".
async function readBatch({ fetch, headers, owner, repo, sha, paths }) {
  const variables = {
    owner,
    name: repo,
  }
  paths.forEach((path, index) => {
    variables[`e${index}`] = `${sha}:${path}`
  })
  const params = paths.map((_, index) => `$e${index}: String!`).join(', ')
  const fields = paths.map((_, index) => `f${index}: object(expression: $e${index}) { ... on Blob { text isBinary isTruncated } }`).join(' ')
  try {
    const response = await fetch(`${API}/graphql`, {
      method: 'POST',
      headers: {
        ...headers,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        query: `query($owner: String!, $name: String!, ${params}) { repository(owner: $owner, name: $name) { ${fields} } }`,
        variables,
      }),
    })
    if (!response.ok) {
      await response.body?.cancel()
      return new Map()
    }
    const body = await readCapped({ response, maxBytes: BATCH_RESPONSE_MAX_BYTES })
    if (!body.isComplete) {
      return new Map()
    }
    const repository = JSON.parse(body.text).data?.repository ?? {}
    return new Map(
      paths.flatMap((path, index) => {
        const blob = repository[`f${index}`]
        const isReadable = typeof blob?.text === 'string' && !blob.isBinary && !blob.isTruncated
        return isReadable ? [[path, blob.text]] : []
      }),
    )
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw error
    }
    return new Map()
  }
}

function splitBatches(paths) {
  const batches = []
  let current = []
  let bytes = 0
  for (const file of paths) {
    if (current.length > 0 && (current.length >= BATCH_MAX_FILES || bytes + file.size > BATCH_MAX_BYTES)) {
      batches.push(current)
      current = []
      bytes = 0
    }
    current.push(file.path)
    bytes += file.size
  }
  if (current.length > 0) {
    batches.push(current)
  }
  return batches
}

async function readRawFiles({ fetch, owner, repo, sha, paths }) {
  const files = new Map()
  let next = 0
  async function worker() {
    while (next < paths.length) {
      const { path } = paths[next++]
      try {
        const response = await fetch(`${RAW}/${owner}/${repo}/${sha}/${path.split('/').map(encodeURIComponent).join('/')}`)
        if (!response.ok) {
          await response.body?.cancel()
          continue
        }
        const body = await readCapped({ response, maxBytes: RAW_FILE_MAX_BYTES })
        if (body.isComplete) {
          files.set(path, body.text)
        }
      } catch (error) {
        if (error?.name === 'AbortError') {
          throw error
        }
      }
    }
  }
  await Promise.all(Array.from({ length: RAW_CONCURRENCY }, worker))
  return files
}

function buildInfo({ commits, now }) {
  if (!Array.isArray(commits) || commits.length === 0) {
    return null
  }
  const authors = new Set(
    commits.map((commit) => {
      return commit.author?.login ?? commit.commit?.author?.email ?? 'unknown'
    }),
  )
  const lastDate = Date.parse(commits[0].commit?.committer?.date ?? commits[0].commit?.author?.date)
  return {
    authors: authors.size,
    lastCommitDays: Number.isNaN(lastDate) ? null : Math.max(0, Math.floor((now() - lastDate) / DAY_MS)),
  }
}

async function getJson({ fetch, url, headers }) {
  const response = await fetch(url, { headers })
  if (response.status === 404) {
    throw new CheckError('not_found')
  }
  if (response.status === 429 || (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0')) {
    throw new CheckError('rate_limited')
  }
  if (response.status === 409) {
    throw new CheckError('not_found', 'This repo is empty, so there is nothing to check yet.')
  }
  if (!response.ok) {
    throw new CheckError('upstream')
  }
  const body = await readCapped({ response, maxBytes: API_RESPONSE_MAX_BYTES })
  if (!body.isComplete) {
    throw new CheckError('upstream', 'This repo is too big for the free check.')
  }
  return JSON.parse(body.text)
}
