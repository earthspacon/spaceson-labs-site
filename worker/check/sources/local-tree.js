import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join, relative, sep } from 'node:path'

const SKIPPED_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.next', 'coverage'])
const DAY_MS = 86_400_000

export function localTree({ dir, name }) {
  return {
    async open({ now }) {
      const files = walk({ root: dir, current: dir })
      return {
        name: name ?? basename(dir),
        commit: readGit({ dir, args: ['rev-parse', '--short=7', 'HEAD'] }),
        info: readInfo({ dir, now }),
        files,
        async readText(path) {
          try {
            return readFileSync(join(dir, path), 'utf8')
          } catch {
            return null
          }
        },
      }
    },
  }
}

function walk({ root, current }) {
  return readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
    const full = join(current, entry.name)
    if (entry.isDirectory()) {
      return SKIPPED_DIRS.has(entry.name) ? [] : walk({ root, current: full })
    }
    if (!entry.isFile()) {
      return []
    }
    return [
      {
        path: relative(root, full).split(sep).join('/'),
        size: statSync(full).size,
      },
    ]
  })
}

function readInfo({ dir, now }) {
  const log = readGit({ dir, args: ['log', '-n', '100', '--format=%ae %ct'] })
  if (!log) {
    return null
  }
  const lines = log.split('\n').filter(Boolean)
  const authors = new Set(
    lines.map((line) => {
      return line.split(' ')[0]
    }),
  )
  const lastSeconds = Number(lines[0].split(' ')[1])
  return {
    authors: authors.size,
    lastCommitDays: Math.max(0, Math.floor((now() - lastSeconds * 1000) / DAY_MS)),
  }
}

function readGit({ dir, args }) {
  // Without its own .git, git would answer for a parent repo.
  if (!existsSync(join(dir, '.git'))) {
    return null
  }
  try {
    return execFileSync('git', ['-C', dir, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
}
