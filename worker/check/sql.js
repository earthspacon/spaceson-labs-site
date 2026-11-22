const IDENT = String.raw`(?:"[^"]+"|[A-Za-z_][\w$]*)`
const QUALIFIED = String.raw`(${IDENT}(?:\s*\.\s*${IDENT})?)`
const CREATE_TABLE = new RegExp(String.raw`create\s+(?:unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?${QUALIFIED}`, 'gi')
const ENABLE_RLS = new RegExp(String.raw`alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?${QUALIFIED}\s+enable\s+row\s+level\s+security`, 'gi')
const CREATE_POLICY = new RegExp(String.raw`create\s+policy\s+${IDENT}\s+on\s+${QUALIFIED}([\s\S]*?)(?:;|$)`, 'gi')
const GRANT_TO_ANON = new RegExp(String.raw`grant\s+([\w\s,]+?)\s+on\s+(?:table\s+)?${QUALIFIED}\s+to\s+[\w\s,]*\banon\b`, 'gi')
const WRITE_PRIVILEGE = /\b(insert|update|delete|all)\b/i

export function readMigrations(migrations) {
  const tables = new Map()
  const rlsEnabled = new Set()
  const openPolicies = []
  for (const { path, text } of migrations) {
    const sql = stripComments(text)
    for (const match of sql.matchAll(CREATE_TABLE)) {
      const table = normalizeName(match[1])
      if (table && !tables.has(table)) {
        tables.set(table, `${path}:${lineAt({ text: sql, index: match.index })}`)
      }
    }
    for (const match of sql.matchAll(ENABLE_RLS)) {
      rlsEnabled.add(normalizeName(match[1]))
    }
    for (const match of sql.matchAll(CREATE_POLICY)) {
      const policy = readPolicy({ table: normalizeName(match[1]), body: match[2] })
      if (policy) {
        openPolicies.push({
          ...policy,
          where: `${path}:${lineAt({ text: sql, index: match.index })}`,
        })
      }
    }
    for (const match of sql.matchAll(GRANT_TO_ANON)) {
      if (WRITE_PRIVILEGE.test(match[1])) {
        openPolicies.push({
          table: normalizeName(match[2]),
          write: true,
          where: `${path}:${lineAt({ text: sql, index: match.index })}`,
        })
      }
    }
  }
  const tablesWithoutRls = [...tables.entries()]
    .filter(([table]) => table && !rlsEnabled.has(table))
    .map(([table, where]) => {
      return {
        table,
        where,
      }
    })
  return {
    tableCount: tables.size,
    tablesWithoutRls,
    openPolicies,
  }
}

function readPolicy({ table, body }) {
  const command = body.match(/\bfor\s+(select|insert|update|delete|all)\b/i)?.[1].toLowerCase() ?? 'all'
  const roles = body.match(/\bto\s+([\w\s,]+?)(?=\s+using\b|\s+with\s+check\b|$)/i)?.[1].toLowerCase() ?? 'public'
  const isOpen = /\b(using|with\s+check)\s*\(\s*true\s*\)/i.test(body)
  if (!table || !isOpen) {
    return null
  }
  if (command === 'select') {
    const onlySignedIn = roles.split(',').every((role) => role.trim() === 'authenticated')
    return onlySignedIn ? null : { table, write: false }
  }
  return {
    table,
    write: true,
  }
}

// Only the public schema is reachable with the browser key.
function normalizeName(raw) {
  const parts = raw.split('.').map((part) => part.trim().replace(/"/g, '').toLowerCase())
  if (parts.length === 2 && parts[0] !== 'public') {
    return null
  }
  return parts[parts.length - 1]
}

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' ')).replace(/--[^\n]*/g, '')
}

function lineAt({ text, index }) {
  return text.slice(0, index).split('\n').length
}
