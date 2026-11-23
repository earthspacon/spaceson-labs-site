const GITHUB_HOSTS = new Set(['github.com', 'www.github.com'])
const NAME_PATTERN = /^[A-Za-z0-9_.-]+$/
const MAX_TARGET_LENGTH = 2048
const IPV4_PATTERN = /^\d+\.\d+\.\d+\.\d+$/

export function parseTarget(input) {
  if (typeof input !== 'string') {
    return null
  }
  const trimmed = input.trim()
  if (!trimmed || trimmed.length > MAX_TARGET_LENGTH || /\s/.test(trimmed)) {
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
  if (!host.includes('.') || isPrivateHost(host) || url.port) {
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

// The URL parser has already turned forms like 0x7f000001 into 127.0.0.1.
function isPrivateHost(host) {
  return host === 'localhost' || host.endsWith('.localhost') || host.startsWith('[') || IPV4_PATTERN.test(host)
}

function parseGithubPath(pathname) {
  const [rawOwner, rawRepo] = pathname.split('/').filter(Boolean)
  const owner = rawOwner?.toLowerCase()
  const repo = rawRepo?.replace(/\.git$/, '').toLowerCase()
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
