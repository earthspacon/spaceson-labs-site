// The free check never touches a database or auth API, on any host.
export const FORBIDDEN_PATHS = ['/rest/v1/', '/auth/v1/', '/storage/v1/', '/graphql/v1']
export const MAX_SUBREQUESTS = 45
export const USER_AGENT = 'SpacesonLabsCheck/1.0'
const MAX_REDIRECT_HOPS = 3
const READ_METHODS = new Set(['GET', 'HEAD'])
const POST_ALLOWED_URLS = new Set(['https://api.osv.dev/v1/querybatch', 'https://api.github.com/graphql'])
const METHOD_KEEPING_STATUSES = new Set([307, 308])

export class ForbiddenRequestError extends Error {}
export class SubrequestBudgetError extends Error {}

// Workers Free allows 50 subrequests per request; one check stays under MAX_SUBREQUESTS.
export function createCountedFetch({ fetch, max = MAX_SUBREQUESTS }) {
  let used = 0
  function countedFetch(input, init) {
    if (used >= max) {
      return Promise.reject(new SubrequestBudgetError(`Over the budget of ${max} requests`))
    }
    used++
    return fetch(input, init)
  }
  countedFetch.used = () => used
  return countedFetch
}

// Every request goes out with redirect: 'manual'; only followRedirects() takes a next hop.
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
    if (!READ_METHODS.has(method) && !(method === 'POST' && POST_ALLOWED_URLS.has(url.origin + url.pathname))) {
      throw new ForbiddenRequestError(`Blocked ${method} request`)
    }
    return fetch(url.href, {
      ...init,
      method,
      signal,
      redirect: 'manual',
      headers: {
        'user-agent': USER_AGENT,
        ...init.headers,
      },
    })
  }
}

// Follows up to MAX_REDIRECT_HOPS same-origin hops through the guard; any other 3xx comes back as is (not ok).
// `redirect: 'manual'` in init returns the first answer untouched.
export function createRedirectFollowingFetch({ fetch }) {
  return async function followingFetch(input, init = {}) {
    if (init.redirect === 'manual') {
      return fetch(input, init)
    }
    const origin = new URL(String(input)).origin
    let url = String(input)
    let hopInit = init
    for (let hop = 0; ; hop++) {
      const response = await fetch(url, hopInit)
      const location = response.headers.get('location')
      if (!isRedirect(response) || !location) {
        return response
      }
      const next = new URL(location, url)
      if (hop >= MAX_REDIRECT_HOPS || next.origin !== origin) {
        await response.body?.cancel()
        return response
      }
      await response.body?.cancel()
      url = next.href
      hopInit = METHOD_KEEPING_STATUSES.has(response.status) ? hopInit : withoutBody(hopInit)
    }
  }
}

// Reads at most maxBytes of the body as text and cancels the rest.
export async function readCapped({ response, maxBytes }) {
  if (!response.body) {
    return {
      text: '',
      isComplete: true,
    }
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  let bytes = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      return {
        text: text + decoder.decode(),
        isComplete: true,
      }
    }
    const room = maxBytes - bytes
    if (value.byteLength > room) {
      text += decoder.decode(value.subarray(0, room))
      await reader.cancel()
      return {
        text,
        isComplete: false,
      }
    }
    bytes += value.byteLength
    text += decoder.decode(value, { stream: true })
  }
}

function isRedirect(response) {
  return response.status >= 300 && response.status < 400
}

function withoutBody(init) {
  const { body, ...rest } = init
  return {
    ...rest,
    method: (rest.method ?? 'GET').toUpperCase() === 'HEAD' ? 'HEAD' : 'GET',
  }
}

function safeDecode(path) {
  try {
    return decodeURIComponent(path)
  } catch {
    return path
  }
}
