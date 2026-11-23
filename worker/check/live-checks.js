import { CheckError } from './errors.js'
import { readCapped } from './guarded-fetch.js'
import { findSecretKeys, hasPublicSupabaseKey } from './secrets.js'

export const MAX_BUNDLE_BYTES = 8 * 1024 * 1024
export const MAX_SCRIPTS = 15
const MAX_PAGE_BYTES = 2 * 1024 * 1024
const MAX_SCRIPT_BYTES = 4 * 1024 * 1024
const MAX_PROBE_BYTES = 64 * 1024
const MAX_MAP_SNIFF_BYTES = 1024
const SCRIPT_CONCURRENCY = 2
const MAX_REDIRECTS = 4
const MAX_MAP_PROBES = 10
const UNCHECKED_WHY = 'Part of the site did not answer or was too big to read within the limits of the free check. Run it again in a minute.'
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
    ...scripts.loaded,
  ]
  const [sourceMaps, exposedFiles] = await Promise.all([
    findSourceMaps({ scripts: scripts.loaded.filter((script) => script.isEntry), fetch }),
    findExposedFiles({ origin: page.origin, fetch }),
  ])
  const allText = texts.map((item) => item.text).join('\n')
  const hasAllText = page.isComplete && scripts.isComplete
  const labels = BUILDER_LABELS.filter(({ marker }) => marker.test(allText) || marker.test(page.host)).map(({ label }) => label)
  if (PAYMENT_MARKERS.test(allText)) {
    labels.push('Takes payments')
  }
  return {
    name: page.host,
    labels,
    checks: [
      checkSecretKeys({ texts, hasAllText }),
      checkExposedFiles({ exposedFiles }),
      checkErrorTracking({ allText, hasAllText }),
      checkSourceMaps({ sourceMaps, hasAllEntries: page.isComplete && scripts.hasAllEntries }),
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
    const body = await readCapped({ response, maxBytes: MAX_PAGE_BYTES })
    return {
      url: finalUrl.href,
      origin: finalUrl.origin,
      host: finalUrl.host,
      isHttps: finalUrl.protocol === 'https:',
      headers: response.headers,
      html: body.text,
      isComplete: body.isComplete,
    }
  }
  throw new CheckError('upstream', 'The site redirects too many times.')
}

// A script that could not be read, or one past the caps, leaves the result incomplete.
async function loadScripts({ page, fetch }) {
  const entries = findEntryScripts({ html: page.html, base: page.url, origin: page.origin })
  const loaded = []
  let bytesLeft = MAX_BUNDLE_BYTES
  let isComplete = entries.length <= MAX_SCRIPTS
  async function loadOne({ url, isEntry }) {
    const reserved = Math.min(bytesLeft, MAX_SCRIPT_BYTES)
    if (reserved <= 0) {
      isComplete = false
      return
    }
    bytesLeft -= reserved
    let kept = 0
    try {
      const response = await fetch(url)
      if (response.status === 404 || response.status === 410 || isHtml(response)) {
        await response.body?.cancel()
        return
      }
      if (!response.ok) {
        await response.body?.cancel()
        isComplete = false
        return
      }
      const body = await readCapped({ response, maxBytes: reserved })
      if (!body.isComplete) {
        isComplete = false
        return
      }
      kept = body.text.length
      loaded.push({ path: new URL(url).pathname.slice(1), url, text: body.text, isEntry })
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw error
      }
      isComplete = false
    } finally {
      bytesLeft += reserved - kept
    }
  }
  const entryUrls = entries.slice(0, MAX_SCRIPTS)
  await forEachLimit({ items: entryUrls, limit: SCRIPT_CONCURRENCY, run: (url) => loadOne({ url, isEntry: true }) })
  const hasAllEntries = isComplete
  const seen = new Set(entries)
  const lazy = loaded
    .flatMap((script) => findLazyChunks({ script, origin: page.origin }))
    .filter((url) => {
      if (seen.has(url)) {
        return false
      }
      seen.add(url)
      return true
    })
  const room = MAX_SCRIPTS - entryUrls.length
  if (lazy.length > room) {
    isComplete = false
  }
  await forEachLimit({ items: lazy.slice(0, room), limit: SCRIPT_CONCURRENCY, run: (url) => loadOne({ url, isEntry: false }) })
  return {
    loaded,
    isComplete,
    hasAllEntries,
  }
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

// Exposure is decided by the HEAD answer; a server without HEAD gets a GET read up to 1 KB.
async function findSourceMaps({ scripts, fetch }) {
  const probes = scripts.slice(0, MAX_MAP_PROBES).map(async (script) => {
    const mapUrl = `${script.url}.map`
    try {
      const head = await fetch(mapUrl, { method: 'HEAD' })
      if (head.status !== 405 && head.status !== 501) {
        return {
          path: head.ok && !isHtml(head) ? `${script.path}.map` : null,
          isAnswered: true,
        }
      }
      const response = await fetch(mapUrl)
      if (!response.ok || isHtml(response)) {
        await response.body?.cancel()
        return {
          path: null,
          isAnswered: true,
        }
      }
      const { text } = await readCapped({ response, maxBytes: MAX_MAP_SNIFF_BYTES })
      return {
        path: text.trimStart().startsWith('{') ? `${script.path}.map` : null,
        isAnswered: true,
      }
    } catch {
      return {
        path: null,
        isAnswered: false,
      }
    }
  })
  const results = await Promise.all(probes)
  return {
    found: results.map((result) => result.path).filter(Boolean),
    isComplete: scripts.length <= MAX_MAP_PROBES && results.every((result) => result.isAnswered),
  }
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
          await response.body?.cancel()
          return {
            path: null,
            isAnswered: true,
          }
        }
        const { text } = await readCapped({ response, maxBytes: MAX_PROBE_BYTES })
        return {
          path: !text.trimStart().startsWith('<') && looksReal(text) ? path : null,
          isAnswered: true,
        }
      } catch {
        return {
          path: null,
          isAnswered: false,
        }
      }
    }),
  )
  return {
    found: results.map((result) => result.path).filter(Boolean),
    isComplete: results.every((result) => result.isAnswered),
  }
}
// #endregion

// #region checks
function checkSecretKeys({ texts, hasAllText }) {
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
  if (!hasAllText) {
    return unchecked({ id: 'U1', title: 'Could not check browser code for secret keys' })
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
  const { found } = exposedFiles
  if (found.length > 0) {
    return {
      id: 'U4',
      status: 'fail',
      title: found[0] === '.env' ? 'Your settings file is public' : 'Your code history is public',
      where: `/${found.join(', /')}`,
      fix: '1 h',
      why: 'Anyone can download this file from your site. Settings files often hold private keys.',
      tag: 'week',
    }
  }
  if (!exposedFiles.isComplete) {
    return unchecked({ id: 'U4', title: 'Could not check for public settings files' })
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

function checkErrorTracking({ allText, hasAllText }) {
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
  if (!hasAllText) {
    return unchecked({ id: 'U2', title: 'Could not check crash reporting' })
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

function checkSourceMaps({ sourceMaps, hasAllEntries }) {
  if (sourceMaps.found.length > 0) {
    return {
      id: 'U3',
      status: 'warn',
      title: 'Source code public',
      where: sourceMaps.found[0],
      fix: '1 h',
      why: 'Anyone can download your full source code, comments included, and read how every part works.',
      tag: 'week',
    }
  }
  if (!hasAllEntries || !sourceMaps.isComplete) {
    return unchecked({ id: 'U3', title: 'Could not check for public source code' })
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

function unchecked({ id, title }) {
  return {
    id,
    status: 'warn',
    title,
    where: null,
    fix: null,
    why: UNCHECKED_WHY,
    tag: null,
  }
}

async function forEachLimit({ items, limit, run }) {
  let next = 0
  async function worker() {
    while (next < items.length) {
      await run(items[next++])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

function isHtml(response) {
  return /text\/html/i.test(response.headers.get('content-type') ?? '')
}

function stripWww(host) {
  return host.replace(/^www\./, '')
}
