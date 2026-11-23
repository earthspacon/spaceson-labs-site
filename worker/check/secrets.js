const JWT = /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g
const KEY_PATTERNS = [
  {
    kind: 'Stripe live secret key',
    pattern: /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}/g,
  },
  {
    kind: 'OpenAI key',
    pattern: /(?<![\w-])sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}/g,
  },
  {
    kind: 'Resend key',
    pattern: /\bre_[A-Za-z0-9]{8}_[A-Za-z0-9]{16,}/g,
  },
  {
    kind: 'AWS access key',
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
  },
]

// Returns kinds and line numbers only; a key value never leaves this function.
export function findSecretKeys(text) {
  const found = []
  const lineAt = createLineFinder(text)
  for (const match of text.matchAll(JWT)) {
    const role = readJwtRole(match[0])
    if (role === 'service_role') {
      found.push({
        kind: 'service_role',
        line: lineAt(match.index),
      })
    }
  }
  for (const { kind, pattern } of KEY_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      found.push({
        kind,
        line: lineAt(match.index),
      })
    }
  }
  return found
}

export function hasPublicSupabaseKey(text) {
  const jwts = [...text.matchAll(JWT)].map((match) => readJwtRole(match[0]))
  return jwts.includes('anon') || /\bsb_publishable_[A-Za-z0-9_-]{10,}/.test(text)
}

function readJwtRole(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')))
    return typeof payload.role === 'string' ? payload.role : null
  } catch {
    return null
  }
}

// Line starts are found once per text, then each match is a binary search.
function createLineFinder(text) {
  let starts = null
  return function lineAt(index) {
    starts ??= findLineStarts(text)
    let low = 0
    let high = starts.length - 1
    while (low < high) {
      const middle = Math.ceil((low + high) / 2)
      if (starts[middle] <= index) {
        low = middle
      } else {
        high = middle - 1
      }
    }
    return low + 1
  }
}

function findLineStarts(text) {
  const starts = [0]
  for (let index = text.indexOf('\n'); index !== -1; index = text.indexOf('\n', index + 1)) {
    starts.push(index + 1)
  }
  return starts
}
