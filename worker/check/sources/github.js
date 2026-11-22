import { CheckError } from '../errors.js'

const API = 'https://api.github.com'
const RAW = 'https://raw.githubusercontent.com'
const DAY_MS = 86_400_000

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
    async readText(path) {
      const response = await fetch(`${RAW}/${owner}/${repo}/${sha}/${path.split('/').map(encodeURIComponent).join('/')}`)
      if (!response.ok) {
        return null
      }
      return response.text()
    },
  }
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
  return response.json()
}
