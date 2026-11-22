import { describe, expect, it } from 'vitest'
import { runCheck } from '../index.js'
import { fakeFetch, makeJwt } from './helpers.js'

const ORIGIN = 'https://shop.example.com'
const SAFE_HEADERS = {
  'content-type': 'text/html',
  'strict-transport-security': 'max-age=63072000',
  'content-security-policy': "default-src 'self'",
}
const JS = { 'content-type': 'application/javascript' }

function siteRoutes({ html, entry = 'console.log(1)', headers = SAFE_HEADERS, extra = {} }) {
  return {
    [`${ORIGIN}/`]: {
      body: html ?? '<html><head><script type="module" src="/assets/index-abc.js"></script></head><body><div id="root"></div></body></html>',
      headers,
    },
    [`${ORIGIN}/assets/index-abc.js`]: {
      body: entry,
      headers: JS,
    },
    ...extra,
  }
}

async function checkSite(routes) {
  const fetch = fakeFetch({ routes })
  const result = await runCheck(`${ORIGIN}/`, { fetch })
  return {
    result,
    row: (id) => result.checks.find((check) => check.id === id),
    fetch,
  }
}

const SENTRY = 'window.__SENTRY__={};fetch("https://o1.ingest.sentry.io/api/1/envelope/")'

describe('live mode on a clean site', () => {
  it('passes all five rows and returns the contract with no commit or info', async () => {
    const { result } = await checkSite(siteRoutes({ entry: SENTRY }))

    expect(result).toMatchObject({
      target: ORIGIN,
      mode: 'live',
      name: 'shop.example.com',
      commit: null,
      info: null,
      failed: 0,
      total: 5,
    })
    expect(result.checks.map((check) => check.id).sort()).toEqual(['U1', 'U2', 'U3', 'U4', 'U5'])
  })

  it('sends only GET and HEAD requests, all to the site origin', async () => {
    const { fetch } = await checkSite(siteRoutes({ entry: SENTRY }))

    expect(fetch.calls.every((call) => ['GET', 'HEAD'].includes(call.method))).toBe(true)
    expect(fetch.calls.every((call) => call.url.startsWith(ORIGIN))).toBe(true)
  })
})

describe('U1 secret key in browser code', () => {
  it('fails on a service key in a lazy chunk and never returns the key', async () => {
    const key = makeJwt({ role: 'service_role' })
    const { result, row } = await checkSite(
      siteRoutes({
        entry: `${SENTRY};import("./Admin-x1.js")`,
        extra: {
          [`${ORIGIN}/assets/Admin-x1.js`]: {
            body: `const k="${key}"`,
            headers: JS,
          },
        },
      }),
    )

    expect(row('U1')).toMatchObject({
      status: 'fail',
      where: 'assets/Admin-x1.js (service_role)',
    })
    expect(JSON.stringify(result)).not.toContain(key)
  })

  it('passes on the public database key alone', async () => {
    const { row } = await checkSite(siteRoutes({ entry: `${SENTRY};const k="${makeJwt({ role: 'anon' })}"` }))

    expect(row('U1').status).toBe('pass')
    expect(row('U1').why).toContain('public database key')
  })
})

describe('U2 crash reporting', () => {
  it('warns when no error tracker is loaded', async () => {
    const { row } = await checkSite(siteRoutes({}))

    expect(row('U2')).toMatchObject({
      status: 'warn',
      title: 'Crashes go unseen',
    })
  })

  it('passes when an error tracker is loaded', async () => {
    const { row } = await checkSite(siteRoutes({ entry: SENTRY }))

    expect(row('U2').status).toBe('pass')
  })
})

describe('U3 source maps', () => {
  it('warns when the source map is downloadable', async () => {
    const { row } = await checkSite(
      siteRoutes({
        entry: SENTRY,
        extra: {
          [`HEAD ${ORIGIN}/assets/index-abc.js.map`]: {
            headers: { 'content-type': 'application/json' },
          },
        },
      }),
    )

    expect(row('U3')).toMatchObject({
      status: 'warn',
      where: 'assets/index-abc.js.map',
    })
  })

  it('passes when the map path only returns the app page', async () => {
    const { row } = await checkSite(
      siteRoutes({
        entry: SENTRY,
        extra: {
          [`HEAD ${ORIGIN}/assets/index-abc.js.map`]: {
            headers: { 'content-type': 'text/html' },
          },
        },
      }),
    )

    expect(row('U3').status).toBe('pass')
  })
})

describe('U4 exposed files', () => {
  it('fails when the settings file is downloadable and keeps its content out', async () => {
    const { result, row } = await checkSite(
      siteRoutes({
        entry: SENTRY,
        extra: {
          [`${ORIGIN}/.env`]: {
            body: 'STRIPE_SECRET_KEY=not-a-real-value-123\n',
            headers: { 'content-type': 'text/plain' },
          },
        },
      }),
    )

    expect(row('U4')).toMatchObject({
      status: 'fail',
      title: 'Your settings file is public',
      where: '/.env',
    })
    expect(JSON.stringify(result)).not.toContain('not-a-real-value-123')
  })

  it('fails when the code history is downloadable', async () => {
    const { row } = await checkSite(
      siteRoutes({
        entry: SENTRY,
        extra: {
          [`${ORIGIN}/.git/HEAD`]: {
            body: 'ref: refs/heads/main\n',
            headers: { 'content-type': 'application/octet-stream' },
          },
        },
      }),
    )

    expect(row('U4').title).toBe('Your code history is public')
  })

  it('passes when a single-page app answers every path with its page', async () => {
    const fallback = {
      body: '<!doctype html><html><body><div id="root"></div></body></html>',
      headers: { 'content-type': 'text/html' },
    }
    const { row } = await checkSite(
      siteRoutes({
        entry: SENTRY,
        extra: {
          [`${ORIGIN}/.env`]: fallback,
          [`${ORIGIN}/.git/HEAD`]: fallback,
        },
      }),
    )

    expect(row('U4').status).toBe('pass')
  })

  it('passes when the fallback page is served without an html content type', async () => {
    const { row } = await checkSite(
      siteRoutes({
        entry: SENTRY,
        extra: {
          [`${ORIGIN}/.env`]: {
            body: '<!doctype html><html><body>A=1</body></html>',
            headers: { 'content-type': 'text/plain' },
          },
        },
      }),
    )

    expect(row('U4').status).toBe('pass')
  })
})

describe('U5 connection and headers', () => {
  it('warns with the missing headers listed', async () => {
    const { row } = await checkSite(siteRoutes({ entry: SENTRY, headers: { 'content-type': 'text/html' } }))

    expect(row('U5')).toMatchObject({
      status: 'warn',
      title: 'Some safety headers missing (low risk)',
      where: 'missing: HSTS, CSP',
    })
  })

  it('passes over https with both headers', async () => {
    const { row } = await checkSite(siteRoutes({ entry: SENTRY }))

    expect(row('U5').status).toBe('pass')
  })
})

describe('U6 and U7 labels', () => {
  it('labels a Lovable app that takes payments', async () => {
    const { result } = await checkSite(
      siteRoutes({
        html: '<html><head><meta name="author" content="Lovable"><script src="https://cdn.gpteng.co/gptengineer.js"></script><script type="module" src="/assets/index-abc.js"></script></head></html>',
        entry: `${SENTRY};loadScript("https://js.stripe.com/v3")`,
      }),
    )

    expect(result.labels).toEqual(['Made in Lovable', 'Takes payments'])
  })

  it('adds no labels to a plain site', async () => {
    const { result } = await checkSite(siteRoutes({ entry: SENTRY }))

    expect(result.labels).toEqual([])
  })
})

describe('live mode errors and limits', () => {
  it('returns not_found for a missing site', async () => {
    const result = await runCheck(`${ORIGIN}/`, { fetch: fakeFetch() })

    expect(result.error).toBe('not_found')
  })

  it('refuses to follow a redirect to another site', async () => {
    const fetch = fakeFetch({
      routes: {
        [`${ORIGIN}/`]: {
          status: 301,
          headers: { location: 'https://elsewhere.example.org/' },
        },
      },
    })

    const result = await runCheck(`${ORIGIN}/`, { fetch })

    expect(result.error).toBe('upstream')
    expect(fetch.calls.some((call) => call.url.includes('elsewhere'))).toBe(false)
  })

  it('does not load scripts from other origins', async () => {
    const { fetch } = await checkSite(
      siteRoutes({
        html: '<script src="https://cdn.other.com/lib.js"></script><script type="module" src="/assets/index-abc.js"></script>',
        entry: SENTRY,
      }),
    )

    expect(fetch.calls.some((call) => call.url.includes('cdn.other.com'))).toBe(false)
  })

  it('times out with a timeout error and aborts the requests', async () => {
    let aborted = false
    function hangingFetch(url, init) {
      return new Promise((resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          aborted = true
          reject(new DOMException('aborted', 'AbortError'))
        })
      })
    }

    const result = await runCheck(`${ORIGIN}/`, { fetch: hangingFetch, timeoutMs: 50 })

    expect(result.error).toBe('timeout')
    expect(aborted).toBe(true)
  })

  it('reports the time taken from the injected clock', async () => {
    let tick = 1000
    const { result } = await (async () => {
      const fetch = fakeFetch({ routes: siteRoutes({ entry: SENTRY }) })
      const run = await runCheck(`${ORIGIN}/`, {
        fetch,
        now: () => {
          tick += 100
          return tick
        },
      })
      return { result: run }
    })()

    expect(result.ms).toBe(100)
  })
})
