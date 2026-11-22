export const LOCKFILES = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock']

export function readLockfilePackages({ path, text }) {
  const packages = parseLockfile({ path, text })
  const unique = new Map(
    packages.map((pkg) => {
      return [`${pkg.name}@${pkg.version}`, pkg]
    }),
  )
  return [...unique.values()].filter((pkg) => {
    return /^\d+\.\d+\.\d+/.test(pkg.version)
  })
}

function parseLockfile({ path, text }) {
  if (path.endsWith('package-lock.json')) {
    return parsePackageLock(text)
  }
  if (path.endsWith('pnpm-lock.yaml')) {
    return parsePnpmLock(text)
  }
  if (path.endsWith('yarn.lock')) {
    return parseYarnLock(text)
  }
  if (path.endsWith('bun.lock')) {
    return parseBunLock(text)
  }
  return []
}

function parsePackageLock(text) {
  const lock = JSON.parse(text)
  if (lock.packages) {
    return Object.entries(lock.packages)
      .filter(([key]) => key.includes('node_modules/'))
      .map(([key, value]) => {
        return {
          name: value.name ?? key.slice(key.lastIndexOf('node_modules/') + 'node_modules/'.length),
          version: value.version ?? '',
        }
      })
  }
  return Object.entries(lock.dependencies ?? {}).map(([name, value]) => {
    return {
      name,
      version: value.version ?? '',
    }
  })
}

// Keys look like `/name@1.2.3`, `name@1.2.3(peer@x)` or `/@scope/name/1.2.3` (old format).
function parsePnpmLock(text) {
  const section = text.split(/^packages:\s*$/m)[1]?.split(/^\S/m)[0] ?? ''
  const keys = [...section.matchAll(/^ {2}['"]?\/?(@?[^\s'"():]+)(?:\([^\s]*\))*['"]?:\s*$/gm)].map((match) => match[1])
  return keys.flatMap((key) => {
    const clean = key.replace(/\(.*$/, '')
    const at = clean.lastIndexOf('@')
    if (at > 0) {
      return [
        {
          name: clean.slice(0, at),
          version: clean.slice(at + 1),
        },
      ]
    }
    const slash = clean.lastIndexOf('/')
    return slash > 0 ? [{ name: clean.slice(0, slash), version: clean.slice(slash + 1) }] : []
  })
}

function parseYarnLock(text) {
  return text.split(/\n(?=\S)/).flatMap((block) => {
    const header = block.split('\n')[0].replace(/^"|"?:$/g, '')
    const version = block.match(/^\s+version:?\s+"?([^"\s]+)"?/m)?.[1]
    const first = header.split(',')[0].trim().replace(/^"/, '')
    const at = first.lastIndexOf('@')
    if (!version || at <= 0) {
      return []
    }
    return [
      {
        name: first.slice(0, at).replace(/@npm:.*$/, ''),
        version,
      },
    ]
  })
}

function parseBunLock(text) {
  const matches = text.matchAll(/^\s+"[^"]+":\s*\["(@?[^"@]+)@([^"]+)"/gm)
  return [...matches].map((match) => {
    return {
      name: match[1],
      version: match[2],
    }
  })
}
