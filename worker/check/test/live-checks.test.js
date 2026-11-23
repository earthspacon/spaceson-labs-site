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

  it('passes when the page sends its own crash reports', async () => {
    const html = '<html><head><script>addEventListener("unhandledrejection",e=>navigator.sendBeacon("/api/errors",e))</script><script type="module" src="/assets/index-abc.js"></script></head></html>'
    const { row } = await checkSite(siteRoutes({ html }))

    expect(row('U2').status).toBe('pass')
  })

  it('still warns when a page only beacons analytics', async () => {
    const { row } = await checkSite(siteRoutes({ entry: 'navigator.sendBeacon("/stats","view")' }))

    expect(row('U2').status).toBe('warn')
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

function endlessStream({ chunk = 'a'.repeat(64 * 1024), limitBytes = Infinity } = {}) {
  let sent = 0
  return new ReadableStream({
    pull(controller) {
      if (sent >= limitBytes) {
        controller.close()
        return
      }
      sent += chunk.length
      controller.enqueue(new TextEncoder().encode(chunk))
    },
  })
}

describe('live mode redirects on sub-requests', () => {
  const targets = ['/rest/v1/x', 'https://other.host/']

  for (const location of targets) {
    it(`never follows a script or map redirect to ${location}`, async () => {
      const { fetch, row } = await checkSite(
        siteRoutes({
          entry: `${SENTRY};import("./Lazy-a1.js")`,
          extra: {
            [`${ORIGIN}/assets/Lazy-a1.js`]: () => respondRedirect(location),
            [`HEAD ${ORIGIN}/assets/index-abc.js.map`]: () => respondRedirect(location),
            [`${ORIGIN}/.env`]: () => respondRedirect(location),
          },
        }),
      )

      expect(fetch.calls.some((call) => call.url.includes('/rest/v1') || call.url.includes('other.host'))).toBe(false)
      expect(fetch.calls.every((call) => call.init.redirect === 'manual')).toBe(true)
      expect(row('U1').title).toMatch(/^Could not check/)
      expect(row('U3').status).not.toBe('fail')
      expect(row('U4').status).not.toBe('fail')
    })
  }

  it('follows a same-origin script redirect', async () => {
    const { row } = await checkSite(
      siteRoutes({
        entry: `${SENTRY};import("./Lazy-a1.js")`,
        extra: {
          [`${ORIGIN}/assets/Lazy-a1.js`]: () => respondRedirect('/assets/Lazy-b2.js'),
          [`${ORIGIN}/assets/Lazy-b2.js`]: {
            body: `const k="${makeJwt({ role: 'service_role' })}"`,
            headers: JS,
          },
        },
      }),
    )

    expect(row('U1').status).toBe('fail')
  })
})

function respondRedirect(location) {
  return new Response(null, {
    status: 302,
    headers: { location },
  })
}

describe('live mode body and script caps', () => {
  it('finishes on an endless page with no length', async () => {
    const fetch = fakeFetch({
      routes: {
        [`${ORIGIN}/`]: () => new Response(endlessStream(), { headers: SAFE_HEADERS }),
      },
    })

    const result = await runCheck(`${ORIGIN}/`, { fetch, timeoutMs: 5000 })

    expect(result.error ?? null).toBe(null)
    expect(result.checks.find((check) => check.id === 'U1').title).toMatch(/^Could not check/)
  })

  it('finishes on a 50 MB script with no length and fetches at most 15 scripts', async () => {
    const lazy = Array.from({ length: 40 }, (_, index) => `import("./Chunk-${index}.js")`).join(';')
    const extra = Object.fromEntries(
      Array.from({ length: 40 }, (_, index) => {
        return [
          `${ORIGIN}/assets/Chunk-${index}.js`,
          () => new Response(endlessStream({ limitBytes: 50 * 1024 * 1024 }), { headers: JS }),
        ]
      }),
    )
    const fetch = fakeFetch({ routes: siteRoutes({ entry: `${SENTRY};${lazy}`, extra }) })

    const result = await runCheck(`${ORIGIN}/`, { fetch, timeoutMs: 5000 })
    const scripts = fetch.calls.filter((call) => call.method === 'GET' && call.url.endsWith('.js'))

    expect(scripts.length).toBeLessThanOrEqual(15)
    expect(result.checks.find((check) => check.id === 'U1').title).toMatch(/^Could not check/)
    expect(result.checks.find((check) => check.id === 'U1').status).not.toBe('pass')
  })

  it('reads could not check for settings files when a probe throws', async () => {
    const { row } = await checkSite(
      siteRoutes({
        entry: SENTRY,
        extra: {
          [`${ORIGIN}/.env`]: () => {
            throw new TypeError('network down')
          },
        },
      }),
    )

    expect(row('U4')).toMatchObject({
      status: 'warn',
      title: 'Could not check for public settings files',
    })
  })

  it('stays within the request budget on a site with many chunks', async () => {
    const lazy = Array.from({ length: 60 }, (_, index) => `import("./C-${index}.js")`).join(';')
    const extra = Object.fromEntries(
      Array.from({ length: 60 }, (_, index) => [`${ORIGIN}/assets/C-${index}.js`, { body: 'x', headers: JS }]),
    )
    const { fetch } = await checkSite(siteRoutes({ entry: `${SENTRY};${lazy}`, extra }))

    expect(fetch.calls.length).toBeLessThanOrEqual(45)
  })
})
