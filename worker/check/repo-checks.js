import { LOCKFILES, readLockfilePackages } from './lockfile.js'
import { findSecretKeys } from './secrets.js'
import { readMigrations } from './sql.js'

export const MAX_MIGRATIONS = 50
export const MAX_FETCH_BYTES = 8 * 1024 * 1024
const MAX_FILE_BYTES = 1024 * 1024
const REGISTRY_CONCURRENCY = 10
export const MAX_DEPENDENCIES = 20
const MAX_VULN_DETAILS = 5
const BIG_FILE_WARN_LINES = 600
const BIG_FILE_FAIL_LINES = 1000

const CODE_FILE = /\.(?:[cm]?[jt]sx?|vue|svelte)$/
const TEST_FILE = /(?:\.(?:test|spec)\.[^/]+$|(?:^|\/)__tests__\/|(?:^|\/)tests?\/|(?:^|\/)e2e\/)/
const MIGRATION_FILE = /^supabase\/migrations\/[^/]+\.sql$/
const WORKFLOW_FILE = /^\.github\/workflows\/[^/]+\.ya?ml$/
const ENV_FILE = /(?:^|\/)\.env(?:\.(?!example$|sample$|template$|dist$)[\w-]+)?$/
const ROOT_TSCONFIG = /^tsconfig(?:\.[\w-]+)?\.json$/
const GENERATED_FILE = /(?:^|\/)(?:components\/ui\/|integrations\/supabase\/types\.ts$)|\.d\.ts$/
const PAYMENT_PATH = /(?:checkout|payment|webhook|stripe|paddle|lemon|billing)/i
const SERVER_DIR = /^(?:supabase\/functions|api|server|functions|netlify\/functions)\//
const PAYMENT_CALL = /\b(?:stripe\.(?:checkout|webhooks|paymentIntents|subscriptions)|new\s+Stripe\s*\(|lemonsqueezy|paddle\.)/i
const ERROR_TRACKERS = /^(?:@sentry\/.+|posthog-js|posthog-node|logrocket|@bugsnag\/.+|@highlight-run\/.+|highlight\.run|@datadog\/browser-rum|rollbar)$/
const TEST_STEP = /\b(?:test|vitest|jest|playwright|cypress|mocha)\b/i
const PLACEHOLDER_ASSERT = /expect\(\s*true\s*\)\.toBe\(\s*true\s*\)/g
const ANY_ASSERT = /\bexpect\s*\(|\bassert[.(]/g
const PUBLIC_ENV_NAME = /^(?:VITE_|NEXT_PUBLIC_|EXPO_PUBLIC_|PUBLIC_|REACT_APP_)?SUPABASE_(?:URL|ANON_KEY|PUBLISHABLE_KEY|PUBLISHABLE_DEFAULT_KEY|PROJECT_ID)$/
const BROWSER_ENV_PREFIX = /^(?:VITE_|NEXT_PUBLIC_|EXPO_PUBLIC_|PUBLIC_|REACT_APP_)/
const UNREAD_WHY = 'We could not read every file this check needs within the limits of the free check. Run it again in a minute.'

// When a file a check needs was not read, these results could be wrong, so the row says "could not check".
const NEEDS_FILES = {
  G4: {
    title: 'Could not check table row rules',
    needs: (path) => MIGRATION_FILE.test(path),
    statuses: ['pass', 'warn', 'fail'],
  },
  G5: {
    title: 'Could not check open write rules',
    needs: (path) => MIGRATION_FILE.test(path),
    statuses: ['pass', 'warn', 'fail'],
  },
  G6: {
    title: 'Could not check browser code for secret keys',
    needs: (path) => isBrowserCode(path),
    statuses: ['pass'],
  },
  G7: {
    title: 'Could not check committed settings',
    needs: (path) => ENV_FILE.test(path),
    statuses: ['pass'],
  },
  G8: {
    title: 'Could not check payment tests',
    needs: (path) => CODE_FILE.test(path),
    statuses: ['pass', 'fail'],
  },
  G10: {
    title: 'Could not check packages for known bugs',
    needs: (path) => LOCKFILES.includes(path),
    statuses: ['pass', 'warn', 'fail'],
  },
  G3: {
    title: 'Could not check crash reporting',
    needs: (path) => path === 'package.json',
    statuses: ['pass', 'fail'],
  },
  G11: {
    title: 'Could not check package versions',
    needs: (path) => path === 'package.json',
    statuses: ['pass', 'warn'],
  },
  G2: {
    title: 'Could not check what runs before deploy',
    needs: (path) => WORKFLOW_FILE.test(path),
    statuses: ['warn', 'fail'],
  },
  G12: {
    title: 'Could not check file sizes',
    needs: (path) => isBrowserCode(path) && !GENERATED_FILE.test(path),
    statuses: ['pass'],
  },
  G13: {
    title: 'Could not check type settings',
    needs: (path) => ROOT_TSCONFIG.test(path),
    statuses: ['pass', 'warn'],
  },
}

export async function runRepoChecks({ source, fetch }) {
  const { files, unread } = await readRelevantFiles({ source })
  const pkg = parseJson(files.get('package.json'))
  const [vulnerable, outdated] = await Promise.all([
    checkVulnerablePackages({ files, fetch }),
    checkOutdatedMajors({ pkg, fetch }),
  ])
  const checks = [
    checkTables({ files }),
    checkSecretKeys({ files }),
    checkOpenPolicies({ files }),
    checkEnvFiles({ files }),
    checkPaymentTests({ files, tree: source.files }),
    vulnerable,
    checkTests({ files, tree: source.files, pkg }),
    checkErrorTracking({ pkg }),
    checkWorkflows({ files }),
    checkBigFiles({ files }),
    checkTypeChecks({ files, tree: source.files }),
    outdated,
    checkSchemaInRepo({ tree: source.files }),
  ]
  return checks.map((check) => markUnread({ check, unread }))
}

function markUnread({ check, unread }) {
  const rule = NEEDS_FILES[check.id]
  if (!rule || !rule.statuses.includes(check.status) || !unread.some((path) => rule.needs(path))) {
    return check
  }
  return warn({
    id: check.id,
    title: rule.title,
    why: UNREAD_WHY,
  })
}

// #region reading
async function readRelevantFiles({ source }) {
  const { picked, capped } = pickPaths(source.files)
  let budget = MAX_FETCH_BYTES
  const queue = picked.filter((file) => {
    if (file.size > MAX_FILE_BYTES || file.size > budget) {
      return false
    }
    budget -= file.size
    return true
  })
  const read = await source.readFiles({ paths: queue })
  const files = new Map([...read.entries()].sort(([a], [b]) => a.localeCompare(b)))
  const unread = [...picked.filter((file) => !files.has(file.path)), ...capped].map((file) => file.path)
  return {
    files,
    unread,
  }
}

function pickPaths(tree) {
  const lockfile = LOCKFILES.map((name) => tree.find((file) => file.path === name)).find(Boolean)
  const migrations = tree.filter((file) => MIGRATION_FILE.test(file.path)).sort((a, b) => a.path.localeCompare(b.path))
  const config = tree.filter((file) => {
    return file.path === 'package.json' || ROOT_TSCONFIG.test(file.path) || WORKFLOW_FILE.test(file.path) || ENV_FILE.test(file.path)
  })
  const code = tree
    .filter((file) => CODE_FILE.test(file.path) && !file.path.includes('node_modules/'))
    .sort((a, b) => Number(TEST_FILE.test(b.path)) - Number(TEST_FILE.test(a.path)))
  return {
    picked: [...config, ...(lockfile ? [lockfile] : []), ...migrations.slice(0, MAX_MIGRATIONS), ...code],
    capped: migrations.slice(MAX_MIGRATIONS),
  }
}
// #endregion

// #region checks
function checkTables({ files }) {
  const { tablesWithoutRls } = readMigrations(migrationsOf(files))
  if (tablesWithoutRls.length === 0) {
    return pass({ id: 'G4', title: 'Every table has row rules' })
  }
  const names = tablesWithoutRls.map((item) => item.table)
  return fail({
    id: 'G4',
    title: names.length === 1 ? `Anyone can read table ${names[0]}` : `Anyone can read ${names.length} tables: ${names.slice(0, 3).join(', ')}`,
    where: tablesWithoutRls[0].where,
    fix: '1 h',
    tag: 'week',
    why: 'The table has no row-level security. Anyone with the public key, which every visitor\'s browser has, can read every row with one request.',
  })
}

function checkSecretKeys({ files }) {
  const hits = [...files.entries()]
    .filter(([path]) => isBrowserCode(path))
    .flatMap(([path, text]) => {
      return findSecretKeys(text).map((hit) => {
        return {
          ...hit,
          path,
        }
      })
    })
  if (hits.length === 0) {
    return pass({ id: 'G6', title: 'No secret keys in browser code' })
  }
  return fail({
    id: 'G6',
    title: 'Secret key in browser code',
    where: `${hits[0].path}:${hits[0].line}`,
    fix: '2 h',
    tag: 'week',
    why: `A ${hits[0].kind} key ships to every visitor. It skips every database rule, so anyone can read or change all data.`,
  })
}

function checkOpenPolicies({ files }) {
  const { openPolicies } = readMigrations(migrationsOf(files))
  const writes = openPolicies.filter((policy) => policy.write)
  if (writes.length > 0) {
    return fail({
      id: 'G5',
      title: `Any visitor can change rows in ${writes[0].table}`,
      where: writes[0].where,
      fix: '1 h',
      tag: 'week',
      why: 'A rule lets anyone add, change or delete rows in this table, signed in or not.',
    })
  }
  if (openPolicies.length > 0) {
    return warn({
      id: 'G5',
      title: `Any visitor can read all of ${openPolicies[0].table}`,
      where: openPolicies[0].where,
      fix: '1 h',
      tag: 'week',
      why: 'A read rule is open to everyone. Fine for a public price list, a leak for anything private.',
    })
  }
  return pass({ id: 'G5', title: 'No open write rules' })
}

function checkEnvFiles({ files }) {
  const names = [...files.entries()]
    .filter(([path]) => ENV_FILE.test(path))
    .flatMap(([path, text]) => {
      return readEnvNames(text).map((name) => {
        return {
          name,
          path,
        }
      })
    })
  const secret = names.filter((item) => !PUBLIC_ENV_NAME.test(item.name) && !BROWSER_ENV_PREFIX.test(item.name))
  if (secret.length > 0) {
    return fail({
      id: 'G7',
      title: `${secret[0].name} is in your repo`,
      where: secret[0].path,
      fix: '1 h',
      tag: 'week',
      why: 'A committed settings file holds a private key. Anyone who can see the repo, or its history, can use it. Rotate it and move it to server settings.',
    })
  }
  const browserNames = names.filter((item) => !PUBLIC_ENV_NAME.test(item.name))
  if (browserNames.length > 0) {
    return warn({
      id: 'G7',
      title: `${browserNames[0].name} is in your repo`,
      where: browserNames[0].path,
      fix: '1 h',
      tag: 'week',
      why: 'This setting ships to the browser anyway, so it must not be a private key. Worth a look.',
    })
  }
  return pass({
    id: 'G7',
    title: 'No secrets in committed settings',
    why: names.length > 0 ? 'Only the public database address and key, which are meant to be public.' : undefined,
  })
}

function checkPaymentTests({ files, tree }) {
  const paymentUnits = findPaymentUnits({ files, tree })
  if (paymentUnits.length === 0) {
    return pass({ id: 'G8', title: 'No payment code to test' })
  }
  const testTexts = [...files.entries()].filter(([path]) => TEST_FILE.test(path)).map(([, text]) => text)
  const untested = paymentUnits.filter((unit) => {
    return !testTexts.some((text) => text.includes(unit.name))
  })
  if (untested.length === 0) {
    return pass({ id: 'G8', title: 'Payment code has tests' })
  }
  return fail({
    id: 'G8',
    title: 'Payment code has no test',
    where: untested[0].where,
    fix: '3 h',
    tag: 'week',
    why: 'Nothing checks the code that takes money. A small change can charge people twice or unlock paid features for free.',
  })
}

async function checkVulnerablePackages({ files, fetch }) {
  const lockPath = LOCKFILES.find((name) => files.has(name))
  if (!lockPath) {
    return warn({
      id: 'G10',
      title: 'Package versions are not pinned',
      fix: '1 h',
      tag: 'week',
      why: 'There is no lockfile, so each install can pull different code, and we cannot check it for known security bugs.',
    })
  }
  const packages = readLockfilePackages({ path: lockPath, text: files.get(lockPath) })
  let vulnerable
  try {
    vulnerable = await queryOsv({ packages, fetch })
  } catch {
    return warn({
      id: 'G10',
      title: 'Could not check packages for known bugs',
      why: 'The public security database did not answer. Run the check again in a minute.',
    })
  }
  if (vulnerable.length === 0) {
    return pass({ id: 'G10', title: 'No known-vulnerable packages', why: `${packages.length} packages checked.` })
  }
  const severities = await readSeverities({ ids: vulnerable.flatMap((item) => item.ids).slice(0, MAX_VULN_DETAILS), fetch })
  const serious = severities.filter((severity) => severity === 'HIGH' || severity === 'CRITICAL').length
  const build = serious > 0 ? fail : warn
  return build({
    id: 'G10',
    title: `${vulnerable.length} ${plural({ count: vulnerable.length, one: 'package', many: 'packages' })} with known security bugs${serious > 0 ? `, ${serious} serious` : ''}`,
    where: `${lockPath}: ${vulnerable.slice(0, 3).map((item) => item.name).join(', ')}`,
    fix: '1 h',
    tag: 'week',
    why: `${packages.length} packages checked against a public database of known security bugs.`,
  })
}

function checkTests({ files, tree, pkg }) {
  const testFiles = tree.filter((file) => CODE_FILE.test(file.path) && TEST_FILE.test(file.path))
  const hasTestScript = Boolean(pkg?.scripts?.test) && !/no test specified/.test(pkg.scripts.test)
  if (testFiles.length === 0) {
    return fail({
      id: 'G1',
      title: 'No tests',
      where: hasTestScript ? null : '0 test files, no test script',
      fix: 'days',
      tag: 'full',
      why: 'A change can break sign-up or payments and nobody notices until a user does.',
    })
  }
  const onlyPlaceholders = testFiles.every((file) => {
    const text = files.get(file.path) ?? ''
    const all = text.match(ANY_ASSERT)?.length ?? 0
    const placeholders = text.match(PLACEHOLDER_ASSERT)?.length ?? 0
    return files.has(file.path) && all === placeholders
  })
  if (onlyPlaceholders) {
    return fail({
      id: 'G1',
      title: 'Tests check nothing',
      where: testFiles[0].path,
      fix: 'days',
      tag: 'full',
      why: 'The test files only assert that true is true, so they pass whatever the app does.',
    })
  }
  return pass({ id: 'G1', title: 'Has tests', why: `${testFiles.length} test ${plural({ count: testFiles.length, one: 'file', many: 'files' })}.` })
}

function checkErrorTracking({ pkg }) {
  const deps = Object.keys({ ...pkg?.dependencies, ...pkg?.devDependencies })
  const tracker = deps.find((name) => ERROR_TRACKERS.test(name))
  if (tracker) {
    return pass({ id: 'G3', title: 'Crashes get reported' })
  }
  return fail({
    id: 'G3',
    title: 'Crashes go unseen',
    where: 'no error tracking',
    fix: '1 h',
    tag: 'week',
    why: 'If the app crashes for a user, you won\'t hear about it.',
  })
}

function checkWorkflows({ files }) {
  const workflows = [...files.entries()].filter(([path]) => WORKFLOW_FILE.test(path))
  if (workflows.length === 0) {
    return fail({
      id: 'G2',
      title: 'Nothing runs before deploy',
      where: 'no .github/workflows',
      fix: '1 h',
      tag: 'week',
      why: 'Nothing checks a change before it goes live.',
    })
  }
  if (!workflows.some(([, text]) => TEST_STEP.test(text))) {
    return warn({
      id: 'G2',
      title: 'Automation runs, but no tests in it',
      where: workflows[0][0],
      fix: '1 h',
      tag: 'week',
      why: 'The repo has automation, but none of it runs tests, so a broken change still goes live.',
    })
  }
  return pass({ id: 'G2', title: 'Tests run on every change' })
}

function checkBigFiles({ files }) {
  const big = [...files.entries()]
    .filter(([path]) => isBrowserCode(path) && !GENERATED_FILE.test(path))
    .map(([path, text]) => {
      return {
        path,
        lines: text.split('\n').length,
      }
    })
    .filter((file) => file.lines > BIG_FILE_WARN_LINES)
    .sort((a, b) => b.lines - a.lines)
  if (big.length === 0) {
    return pass({ id: 'G12', title: 'Files are a safe size' })
  }
  const build = big[0].lines > BIG_FILE_FAIL_LINES ? fail : warn
  const fileName = big[0].path.split('/').pop()
  return build({
    id: 'G12',
    title: big.length === 1 ? 'File too big to change safely' : `${big.length} files too big to change safely`,
    where: big[0].path,
    fix: 'days',
    tag: 'full',
    why: `${fileName} is ${big[0].lines.toLocaleString('en-US')} lines; every edit there can break something unrelated.`,
  })
}

function checkTypeChecks({ files, tree }) {
  const configs = [...files.entries()].filter(([path]) => ROOT_TSCONFIG.test(path) && !/node/.test(path))
  if (configs.length === 0) {
    const hasTypedCode = tree.some((file) => /\.tsx?$/.test(file.path))
    if (hasTypedCode) {
      return pass({ id: 'G13', title: 'Type checks on' })
    }
    return warn({
      id: 'G13',
      title: 'No type checks',
      fix: 'days',
      tag: 'full',
      why: 'Nothing catches a missing value before it crashes for a user.',
    })
  }
  const off = configs
    .map(([path, text]) => {
      return {
        path,
        line: findOffLine(text),
      }
    })
    .find((item) => item.line !== null)
  if (!off) {
    return pass({ id: 'G13', title: 'Type checks on' })
  }
  return fail({
    id: 'G13',
    title: 'Type checks off',
    where: `${off.path}:${off.line}`,
    fix: 'days',
    tag: 'full',
    why: 'The compiler lets whole classes of crashes through, like using a value that may be missing.',
  })
}

async function checkOutdatedMajors({ pkg, fetch }) {
  const declared = [...Object.entries(pkg?.dependencies ?? {}), ...Object.entries(pkg?.devDependencies ?? {})]
    .map(([name, range]) => {
      return {
        name,
        major: readMajor(range),
      }
    })
    .filter((dep) => dep.major !== null)
  const checked = declared.slice(0, MAX_DEPENDENCIES)
  let latest
  try {
    latest = await mapLimit({
      items: checked,
      limit: REGISTRY_CONCURRENCY,
      run: (dep) => readLatestMajor({ name: dep.name, fetch }),
    })
  } catch {
    return warn({
      id: 'G11',
      title: 'Could not check package versions',
      why: 'The package registry did not answer. Run the check again in a minute.',
    })
  }
  const behind = checked
    .map((dep, index) => {
      return {
        ...dep,
        behind: latest[index] === null ? 0 : latest[index] - dep.major,
      }
    })
    .filter((dep) => dep.behind >= 2)
    .sort((a, b) => b.behind - a.behind)
  if (behind.length === 0 && checked.length < declared.length) {
    return warn({
      id: 'G11',
      title: 'Could not check all package versions',
      why: `${checked.length} of ${declared.length} packages checked, none is 2+ major versions behind. The free check looks up at most ${MAX_DEPENDENCIES}.`,
    })
  }
  if (behind.length === 0) {
    return pass({ id: 'G11', title: 'Dependencies within 1 major' })
  }
  return warn({
    id: 'G11',
    title: `${behind.length} ${plural({ count: behind.length, one: 'package is', many: 'packages are' })} 2+ major versions behind`,
    where: `package.json: ${behind.slice(0, 3).map((dep) => dep.name).join(', ')}`,
    fix: 'days',
    tag: 'full',
    why: `The worst is ${behind[0].behind} major versions behind. Old majors stop getting security fixes, and the jump gets bigger every month.`,
  })
}

function checkSchemaInRepo({ tree }) {
  const migrations = tree.filter((file) => MIGRATION_FILE.test(file.path)).length
  const hasFunctions = tree.some((file) => file.path.startsWith('supabase/functions/'))
  if (migrations > 0) {
    return pass({ id: 'G9', title: 'Schema in the repo', why: `${migrations} ${plural({ count: migrations, one: 'migration', many: 'migrations' })}.` })
  }
  if (hasFunctions) {
    return fail({
      id: 'G9',
      title: 'Database can\'t be rebuilt from the repo',
      where: 'supabase/functions/ without supabase/migrations/',
      fix: 'days',
      tag: 'full',
      why: 'Your schema lives only in the dashboard. If the project is lost or you move, the database can\'t be rebuilt.',
    })
  }
  return pass({ id: 'G9', title: 'No database schema to rebuild' })
}
// #endregion

// #region helpers
function isBrowserCode(path) {
  return path.startsWith('src/') && CODE_FILE.test(path) && !TEST_FILE.test(path)
}

function findPaymentUnits({ files, tree }) {
  const units = new Map()
  for (const file of tree) {
    if (!CODE_FILE.test(file.path) || TEST_FILE.test(file.path)) {
      continue
    }
    const fn = file.path.match(/^supabase\/functions\/([^/]+)\//)?.[1]
    const isPaymentPath = PAYMENT_PATH.test(file.path) && SERVER_DIR.test(file.path)
    const callsPaymentApi = PAYMENT_CALL.test(files.get(file.path) ?? '')
    if (!isPaymentPath && !callsPaymentApi) {
      continue
    }
    const name = fn ?? file.path.split('/').pop().replace(/\.[^.]+$/, '')
    const where = fn ? `supabase/functions/${fn}/` : file.path
    units.set(where, {
      name,
      where,
    })
  }
  return [...units.values()]
}

function readEnvNames(text) {
  return [...text.matchAll(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)].map((match) => match[1])
}

function findOffLine(text) {
  const lines = text.split('\n')
  if (/"strictNullChecks"\s*:\s*true/.test(text)) {
    return null
  }
  const nullChecksOff = lines.findIndex((line) => /"strictNullChecks"\s*:\s*false/.test(line))
  const strictOff = lines.findIndex((line) => /"strict"\s*:\s*false/.test(line))
  const explicit = nullChecksOff >= 0 ? nullChecksOff : strictOff
  if (explicit >= 0) {
    return explicit + 1
  }
  const isOn = /"strict"\s*:\s*true/.test(text)
  const hasCompilerOptions = /"compilerOptions"/.test(text)
  if (isOn || !hasCompilerOptions) {
    return null
  }
  return lines.findIndex((line) => /"compilerOptions"/.test(line)) + 1
}

function migrationsOf(files) {
  return [...files.entries()]
    .filter(([path]) => MIGRATION_FILE.test(path))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, text]) => {
      return {
        path,
        text,
      }
    })
}

async function queryOsv({ packages, fetch }) {
  const vulnerable = []
  for (let start = 0; start < packages.length; start += 1000) {
    const chunk = packages.slice(start, start + 1000)
    const response = await fetch('https://api.osv.dev/v1/querybatch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        queries: chunk.map((pkg) => {
          return {
            package: {
              name: pkg.name,
              ecosystem: 'npm',
            },
            version: pkg.version,
          }
        }),
      }),
    })
    if (!response.ok) {
      throw new Error(`osv ${response.status}`)
    }
    const { results } = await response.json()
    results.forEach((result, index) => {
      if (result.vulns?.length) {
        vulnerable.push({
          name: chunk[index].name,
          ids: result.vulns.map((vuln) => vuln.id),
        })
      }
    })
  }
  return vulnerable
}

async function readSeverities({ ids, fetch }) {
  const details = await Promise.all(
    ids.map(async (id) => {
      try {
        const response = await fetch(`https://api.osv.dev/v1/vulns/${encodeURIComponent(id)}`)
        return response.ok ? await response.json() : null
      } catch {
        return null
      }
    }),
  )
  return details.map((detail) => String(detail?.database_specific?.severity ?? '').toUpperCase())
}

async function readLatestMajor({ name, fetch }) {
  const response = await fetch(`https://registry.npmjs.org/${name.replace('/', '%2f')}/latest`)
  if (response.status === 404) {
    return null
  }
  if (!response.ok) {
    throw new Error(`npm ${response.status}`)
  }
  const { version } = await response.json()
  return readMajor(version)
}

function readMajor(range) {
  if (typeof range !== 'string' || /^(?:workspace|file|link|git|github|http|npm):/.test(range)) {
    return null
  }
  const match = range.match(/(\d+)\.(?:\d+|x|\*)/) ?? range.match(/^[\^~>=\s]*(\d+)$/)
  return match ? Number(match[1]) : null
}

async function mapLimit({ items, limit, run }) {
  const results = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const index = next++
      results[index] = await run(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

function parseJson(text) {
  if (!text) {
    return null
  }
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function plural({ count, one, many }) {
  return count === 1 ? one : many
}

function fail({ id, title, where = null, fix = null, tag = null, why }) {
  return {
    id,
    status: 'fail',
    title,
    where,
    fix,
    why,
    tag,
  }
}

function warn({ id, title, where = null, fix = null, tag = null, why }) {
  return {
    id,
    status: 'warn',
    title,
    where,
    fix,
    why,
    tag,
  }
}

function pass({ id, title, why = null }) {
  return {
    id,
    status: 'pass',
    title,
    where: null,
    fix: null,
    why,
    tag: null,
  }
}
// #endregion
