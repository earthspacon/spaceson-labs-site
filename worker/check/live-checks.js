import { CheckError } from './errors.js'
import { findSecretKeys, hasPublicSupabaseKey } from './secrets.js'

export const MAX_BUNDLE_BYTES = 8 * 1024 * 1024
const MAX_REDIRECTS = 4
const MAX_MAP_PROBES = 3
const ERROR_TRACKER_MARKERS = /ingest\.(?:[a-z]{2}\.)?sentry\.io|sentry\.javascript|__SENTRY__|bugsnag|logrocket|posthog|highlight\.run|datadoghq-browser|rollbar/i
const BUILDER_LABELS = [
  {
    label: 'Made in Lovable',
    marker: /lovable-tagger|lovable\.dev|lovable\.app|gptengineer/i,
  },
  {
    label: 'Made in Bolt',
    marker: /bolt\.new|\.bolt\.host/i,
  },
  {
    label: 'Made in Replit',
    marker: /\.replit\.app|replit\.com\/@/i,
  },
]
const PAYMENT_MARKERS = /js\.stripe\.com|checkout\.stripe\.com|buy\.stripe\.com|cdn\.paddle\.com|lemonsqueezy\.com|assets\.lemonsqueezy/i

export async function runLiveChecks({ target, fetch }) {
  const page = await loadPage({ url: target.url, fetch })
  const scripts = await loadScripts({ page, fetch })
  const texts = [
    {
      path: '/',
      text: page.html,
    },
    ...scripts,
  ]
  const [sourceMaps, exposedFiles] = await Promise.all([
    findSourceMaps({ scripts: scripts.filter((script) => script.isEntry), fetch }),
    findExposedFiles({ origin: page.origin, fetch }),
  ])
  const allText = texts.map((item) => item.text).join('\n')
  const labels = BUILDER_LABELS.filter(({ marker }) => marker.test(allText) || marker.test(page.host)).map(({ label }) => label)
  if (PAYMENT_MARKERS.test(allText)) {
    labels.push('Takes payments')
  }
  return {
    name: page.host,
    labels,
    checks: [
      checkSecretKeys({ texts }),
      checkExposedFiles({ exposedFiles }),
      checkErrorTracking({ allText }),
      checkSourceMaps({ sourceMaps }),
      checkHeaders({ page }),
    ],
  }
}

// #region loading
async function loadPage({ url, fetch }) {
  const startHost = stripWww(new URL(url).hostname)
  let current = url
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(current, { redirect: 'manual' })
    const location = response.headers.get('location')
    if (response.status >= 300 && response.status < 400 && location) {
      const next = new URL(location, current)
      if (stripWww(next.hostname) !== startHost) {
        throw new CheckError('upstream', `This address sends visitors to another site (${next.hostname}). Paste that address instead.`)
      }
      current = next.href
      continue
    }
    if (response.status === 404 || response.status === 410) {
      throw new CheckError('not_found')
    }
    if (!response.ok) {
      throw new CheckError('upstream', `The site answered with an error (${response.status}).`)
    }
    const finalUrl = new URL(current)
    return {
      url: finalUrl.href,
      origin: finalUrl.origin,
      host: finalUrl.host,
      isHttps: finalUrl.protocol === 'https:',
      headers: response.headers,
      html: await response.text(),
    }
  }
  throw new CheckError('upstream', 'The site redirects too many times.')
}

async function loadScripts({ page, fetch }) {
  const entries = findEntryScripts({ html: page.html, base: page.url, origin: page.origin })
  const loaded = []
  const seen = new Set(entries)
  let budget = MAX_BUNDLE_BYTES
  async function load({ urls, isEntry }) {
    const results = await Promise.all(
      urls.map(async (url) => {
        try {
          const response = await fetch(url)
          if (!response.ok || isHtml(response)) {
            return null
          }
          const declared = Number(response.headers.get('content-length') ?? 0)
          if (declared > budget) {
            return null
          }
          const text = await response.text()
          budget -= text.length
          return budget < 0 ? null : { path: new URL(url).pathname.slice(1), url, text, isEntry }
        } catch (error) {
          if (error?.name === 'AbortError') {
            throw error
          }
          return null
        }
      }),
    )
    const ok = results.filter(Boolean)
    loaded.push(...ok)
    return ok
  }
  const entryScripts = await load({ urls: entries, isEntry: true })
  const lazy = entryScripts
    .flatMap((script) => findLazyChunks({ script, origin: page.origin }))
    .filter((url) => {
      if (seen.has(url)) {
        return false
      }
      seen.add(url)
      return true
    })
  await load({ urls: lazy, isEntry: false })
  return loaded
}

function findEntryScripts({ html, base, origin }) {
  const tags = [...html.matchAll(/<(?:script|link)\b[^>]*>/gi)].map((match) => match[0])
  const urls = tags.flatMap((tag) => {
    const isScript = /^<script/i.test(tag)
    const isPreload = /rel=["']?modulepreload/i.test(tag)
    const src = tag.match(isScript ? /\bsrc=["']?([^"'\s>]+)/i : /\bhref=["']?([^"'\s>]+)/i)?.[1]
    if (!src || (!isScript && !isPreload)) {
      return []
    }
    const url = new URL(src, base)
    return url.origin === origin ? [url.href] : []
  })
  return [...new Set(urls)]
}

function findLazyChunks({ script, origin }) {
  const matches = script.text.matchAll(/["'`]((?:\.\/|\/)?(?:assets\/)?[\w.-]+\.js)["'`]/g)
  return [...matches].flatMap((match) => {
    const ref = match[1]
    if (!ref.startsWith('./') && !ref.includes('assets/')) {
      return []
    }
    const url = new URL(ref, ref.startsWith('./') ? script.url : `${origin}/`)
    return url.origin === origin ? [url.href] : []
  })
}

async function findSourceMaps({ scripts, fetch }) {
  const probes = scripts.slice(0, MAX_MAP_PROBES).map(async (script) => {
    const mapUrl = `${script.url}.map`
    try {
      let response = await fetch(mapUrl, { method: 'HEAD' })
      if (response.status === 405 || response.status === 501) {
        response = await fetch(mapUrl)
        return response.ok && !isHtml(response) && (await response.text()).trimStart().startsWith('{') ? `${script.path}.map` : null
      }
      return response.ok && !isHtml(response) ? `${script.path}.map` : null
    } catch {
      return null
    }
  })
  return (await Promise.all(probes)).filter(Boolean)
}

// A single-page app answers every path with its HTML; only real file content counts.
async function findExposedFiles({ origin, fetch }) {
  const probes = [
    {
      path: '.env',
      looksReal: (text) => /^\s*(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=/m.test(text),
    },
    {
      path: '.git/HEAD',
      looksReal: (text) => /^(?:ref: refs\/|[0-9a-f]{40}\s*$)/.test(text.trim()),
    },
  ]
  const results = await Promise.all(
    probes.map(async ({ path, looksReal }) => {
      try {
        const response = await fetch(`${origin}/${path}`, { redirect: 'manual' })
        if (!response.ok || isHtml(response)) {
          return null
        }
        const text = await response.text()
        return !text.trimStart().startsWith('<') && looksReal(text) ? path : null
      } catch {
        return null
      }
    }),
  )
  return results.filter(Boolean)
}
// #endregion

// #region checks
function checkSecretKeys({ texts }) {
  const hit = texts
    .map((item) => {
      return {
        path: item.path,
        found: findSecretKeys(item.text)[0],
      }
    })
    .find((item) => item.found)
  if (hit) {
    return {
      id: 'U1',
      status: 'fail',
      title: 'Secret key in browser code',
      where: `${hit.path} (${hit.found.kind})`,
      fix: '2 h',
      why: 'A key that skips every database rule ships to every visitor. Anyone can open the browser tools and use it.',
      tag: 'week',
    }
  }
  const hasPublicKey = texts.some((item) => hasPublicSupabaseKey(item.text))
  return {
    id: 'U1',
    status: 'pass',
    title: 'No secret keys in browser code',
    where: null,
    fix: null,
    why: hasPublicKey ? 'Only the public database key, which is meant to be public.' : null,
    tag: null,
  }
}

function checkExposedFiles({ exposedFiles }) {
  if (exposedFiles.length > 0) {
    return {
      id: 'U4',
      status: 'fail',
      title: exposedFiles[0] === '.env' ? 'Your settings file is public' : 'Your code history is public',
      where: `/${exposedFiles.join(', /')}`,
      fix: '1 h',
      why: 'Anyone can download this file from your site. Settings files often hold private keys.',
      tag: 'week',
    }
  }
  return {
    id: 'U4',
    status: 'pass',
    title: 'No settings or code history exposed',
    where: null,
    fix: null,
    why: null,
    tag: null,
  }
}

function checkErrorTracking({ allText }) {
  if (ERROR_TRACKER_MARKERS.test(allText)) {
    return {
      id: 'U2',
      status: 'pass',
      title: 'Crashes get reported',
      where: null,
      fix: null,
      why: null,
      tag: null,
    }
  }
  return {
    id: 'U2',
    status: 'warn',
    title: 'Crashes go unseen',
    where: null,
    fix: '1 h',
    why: 'When a user hits a bug, nobody hears about it.',
    tag: 'week',
  }
}

function checkSourceMaps({ sourceMaps }) {
  if (sourceMaps.length > 0) {
    return {
      id: 'U3',
      status: 'warn',
      title: 'Source code public',
      where: sourceMaps[0],
      fix: '1 h',
      why: 'Anyone can download your full source code, comments included, and read how every part works.',
      tag: 'week',
    }
  }
  return {
    id: 'U3',
    status: 'pass',
    title: 'Source code not published',
    where: null,
    fix: null,
    why: null,
    tag: null,
  }
}

function checkHeaders({ page }) {
  const missing = [
    ...(page.isHttps ? [] : ['HTTPS']),
    ...(page.headers.get('strict-transport-security') ? [] : ['HSTS']),
    ...(page.headers.get('content-security-policy') ? [] : ['CSP']),
  ]
  if (missing.length === 0) {
    return {
      id: 'U5',
      status: 'pass',
      title: 'Secure connection and safety headers',
      where: null,
      fix: null,
      why: null,
      tag: null,
    }
  }
  return {
    id: 'U5',
    status: 'warn',
    title: page.isHttps ? 'Some safety headers missing (low risk)' : 'No secure connection',
    where: `missing: ${missing.join(', ')}`,
    fix: '1 h',
    why: page.isHttps ? 'Browsers get fewer instructions to block injected scripts. Low risk on its own.' : 'Traffic between your users and the app can be read or changed on the way.',
    tag: 'week',
  }
}
// #endregion

function isHtml(response) {
  return /text\/html/i.test(response.headers.get('content-type') ?? '')
}

function stripWww(host) {
  return host.replace(/^www\./, '')
}
