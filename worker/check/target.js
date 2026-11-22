const GITHUB_HOSTS = new Set(['github.com', 'www.github.com'])
const NAME_PATTERN = /^[A-Za-z0-9_.-]+$/

export function parseTarget(input) {
  if (typeof input !== 'string') {
    return null
  }
  const trimmed = input.trim()
  if (!trimmed || /\s/.test(trimmed)) {
    return null
  }
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
  if (hasScheme && !/^https?:\/\//i.test(trimmed)) {
    return null
  }
  let url
  try {
    url = new URL(hasScheme ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }
  const host = url.hostname.toLowerCase()
  if (!host.includes('.') && host !== 'localhost') {
    return null
  }
  if (GITHUB_HOSTS.has(host)) {
    return parseGithubPath(url.pathname)
  }
  return {
    mode: 'live',
    url: url.origin + url.pathname,
    origin: url.origin,
    host: url.host,
    target: url.origin,
    name: url.host,
  }
}

function parseGithubPath(pathname) {
  const [owner, rawRepo] = pathname.split('/').filter(Boolean)
  const repo = rawRepo?.replace(/\.git$/, '')
  if (!owner || !repo || !NAME_PATTERN.test(owner) || !NAME_PATTERN.test(repo)) {
    return null
  }
  return {
    mode: 'repo',
    owner,
    repo,
    target: `github.com/${owner}/${repo}`,
    name: repo,
  }
}
