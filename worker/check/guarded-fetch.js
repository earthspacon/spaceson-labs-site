// The free check never touches a database or auth API, on any host.
export const FORBIDDEN_PATHS = ['/rest/v1/', '/auth/v1/', '/storage/v1/', '/graphql/v1']
const READ_METHODS = new Set(['GET', 'HEAD'])
const POST_ALLOWED_HOSTS = new Set(['api.osv.dev'])
export const USER_AGENT = 'SpacesonLabsCheck/1.0'

export class ForbiddenRequestError extends Error {}

export function createGuardedFetch({ fetch, signal }) {
  return async function guardedFetch(input, init = {}) {
    const url = new URL(String(input))
    const paths = [url.pathname, safeDecode(url.pathname)].map((path) => `${path.toLowerCase()}/`)
    const hit = FORBIDDEN_PATHS.find((forbidden) => {
      return paths.some((path) => path.includes(forbidden))
    })
    if (hit) {
      throw new ForbiddenRequestError(`Blocked request to a database path (${hit})`)
    }
    const method = (init.method ?? 'GET').toUpperCase()
    if (!READ_METHODS.has(method) && !(method === 'POST' && POST_ALLOWED_HOSTS.has(url.hostname))) {
      throw new ForbiddenRequestError(`Blocked ${method} request`)
    }
    return fetch(url.href, {
      ...init,
      method,
      signal,
      headers: {
        'user-agent': USER_AGENT,
        ...init.headers,
      },
    })
  }
}

function safeDecode(path) {
  try {
    return decodeURIComponent(path)
  } catch {
    return path
  }
}
