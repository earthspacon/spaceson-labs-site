import { describe, expect, it } from 'vitest'
import { runCheck } from '../index.js'
import { CLEAN_LATEST, CLEAN_REPO, cleanRepoWith, fakeFetch, makeJwt, memoryTree, registryRoutes } from './helpers.js'

const TARGET = 'https://github.com/acme/app'

async function checkRepo({ files, latest = CLEAN_LATEST, osvResults, vulns, routes = {} }) {
  const fetch = fakeFetch({
    routes: {
      ...registryRoutes({ osvResults, latest, vulns }),
      ...routes,
    },
  })
  const result = await runCheck(TARGET, {
    fetch,
    tree: memoryTree({ files }),
  })
  return {
    result,
    row: (id) => result.checks.find((check) => check.id === id),
    fetch,
  }
}

const REPO_IDS = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12', 'G13']

describe('repo mode on a clean repo', () => {
  it('returns all 13 rows, none failing, in the result contract', async () => {
    const { result } = await checkRepo({ files: CLEAN_REPO })

    expect(Object.keys(result)).toEqual(['target', 'mode', 'name', 'ms', 'commit', 'failed', 'total', 'labels', 'info', 'checks'])
    expect(result).toMatchObject({
      target: 'github.com/acme/app',
      mode: 'repo',
      failed: 0,
      total: 13,
      labels: [],
      info: {
        authors: 1,
        lastCommitDays: 2,
      },
    })
    expect(result.checks.map((check) => check.id).sort()).toEqual([...REPO_IDS].sort())
  })

  it.each(REPO_IDS)('%s passes with no location, fix or tag', async (id) => {
    const { row } = await checkRepo({ files: CLEAN_REPO })

    expect(row(id)).toMatchObject({
      status: 'pass',
      where: null,
      fix: null,
      tag: null,
    })
  })
})

describe('repo mode failures', () => {
  it('G4 fails on a table without row rules and points at its line', async () => {
    const files = cleanRepoWith({
      'supabase/migrations/002_clients.sql': '-- clients\n\ncreate table public.clients (\n  id uuid primary key\n);\n',
    })

    const { row } = await checkRepo({ files })

    expect(row('G4')).toMatchObject({
      status: 'fail',
      title: 'Anyone can read table clients',
      where: 'supabase/migrations/002_clients.sql:3',
      tag: 'week',
    })
  })

  it('G4 passes when a later migration turns row rules on', async () => {
    const files = cleanRepoWith({
      'supabase/migrations/002_clients.sql': 'create table clients (id uuid primary key);\n',
      'supabase/migrations/003_lock.sql': 'alter table public.clients enable row level security;\n',
    })

    const { row } = await checkRepo({ files })

    expect(row('G4').status).toBe('pass')
  })

  it('G6 fails on a service key in browser code and never returns the key', async () => {
    const key = makeJwt({ role: 'service_role' })
    const files = cleanRepoWith({ 'src/lib/admin.ts': `import x from 'y'\n\nconst KEY = "${key}"\n` })

    const { result, row } = await checkRepo({ files })

    expect(row('G6')).toMatchObject({
      status: 'fail',
      where: 'src/lib/admin.ts:3',
    })
    expect(JSON.stringify(result)).not.toContain(key)
  })

  it('G6 ignores the public key and keys inside test files', async () => {
    const files = cleanRepoWith({
      'src/lib/client.ts': `const KEY = "${makeJwt({ role: 'anon' })}"\n`,
      'src/lib/admin.test.ts': `const KEY = "${makeJwt({ role: 'service_role' })}"\nexpect(KEY).toBeTruthy()\n`,
    })

    const { row } = await checkRepo({ files })

    expect(row('G6').status).toBe('pass')
  })

  it('G5 fails when a rule lets anyone write', async () => {
    const files = cleanRepoWith({
      'supabase/migrations/002_open.sql':
        'create table posts (id uuid primary key);\nalter table posts enable row level security;\ncreate policy "anyone" on posts for insert with check (true);\n',
    })

    const { row } = await checkRepo({ files })

    expect(row('G5')).toMatchObject({
      status: 'fail',
      title: 'Any visitor can change rows in posts',
      where: 'supabase/migrations/002_open.sql:3',
    })
  })

  it('G5 warns when a read rule is open to everyone', async () => {
    const files = cleanRepoWith({
      'supabase/migrations/002_prices.sql':
        'create table prices (id uuid primary key);\nalter table prices enable row level security;\ncreate policy "read" on prices for select using (true);\n',
    })

    const { row } = await checkRepo({ files })

    expect(row('G5')).toMatchObject({
      status: 'warn',
      title: 'Any visitor can read all of prices',
    })
  })

  it('G7 fails on a private key name in a committed settings file and keeps the value out', async () => {
    const value = 'sk-proj-abcdefghijklmnopqrstuvwxyz0123456789'
    const files = cleanRepoWith({ '.env.local': `OPENAI_API_KEY=${value}\n` })

    const { result, row } = await checkRepo({ files })

    expect(row('G7')).toMatchObject({
      status: 'fail',
      title: 'OPENAI_API_KEY is in your repo',
      where: '.env.local',
    })
    expect(JSON.stringify(result)).not.toContain(value)
  })

  it('G7 warns on a browser setting that is not the database address or key', async () => {
    const files = cleanRepoWith({ '.env': 'VITE_SUPABASE_URL=https://x.supabase.co\nVITE_MAPS_TOKEN=abc\n' })

    const { row } = await checkRepo({ files })

    expect(row('G7')).toMatchObject({
      status: 'warn',
      title: 'VITE_MAPS_TOKEN is in your repo',
    })
  })

  it('G7 skips example settings files', async () => {
    const files = cleanRepoWith({ '.env.example': 'STRIPE_SECRET_KEY=\n' })

    const { row } = await checkRepo({ files })

    expect(row('G7').status).toBe('pass')
  })

  it('G8 fails when a payment function has no test', async () => {
    const files = cleanRepoWith({
      'supabase/functions/stripe-webhook/index.ts': 'const event = stripe.webhooks.constructEvent(body, sig, secret)\n',
    })

    const { row } = await checkRepo({ files })

    expect(row('G8')).toMatchObject({
      status: 'fail',
      title: 'Payment code has no test',
      where: 'supabase/functions/stripe-webhook/',
      fix: '3 h',
    })
  })

  it('G8 passes when a test names the payment function', async () => {
    const files = cleanRepoWith({
      'supabase/functions/stripe-webhook/index.ts': 'const event = stripe.webhooks.constructEvent(body, sig, secret)\n',
      'supabase/functions/tests/stripe-webhook.test.ts': "import '../stripe-webhook/index.ts'\nexpect(1).toBe(1)\n",
    })

    const { row } = await checkRepo({ files })

    expect(row('G8').title).toBe('Payment code has tests')
  })

  it('G10 fails on a package with a serious known bug', async () => {
    const { row } = await checkRepo({
      files: CLEAN_REPO,
      osvResults: { react: { vulns: [{ id: 'GHSA-test-0001' }] } },
      vulns: { 'GHSA-test-0001': 'HIGH' },
    })

    expect(row('G10')).toMatchObject({
      status: 'fail',
      title: '1 package with known security bugs, 1 serious',
      where: 'package-lock.json: react',
    })
  })

  it('G10 warns when there is no lockfile', async () => {
    const { row } = await checkRepo({ files: cleanRepoWith({ 'package-lock.json': null }) })

    expect(row('G10')).toMatchObject({
      status: 'warn',
      title: 'Package versions are not pinned',
    })
  })

  it('G10 reads a pnpm lockfile with peer suffixes', async () => {
    const lock = "lockfileVersion: '9.0'\n\npackages:\n\n  react-dom@19.0.0(react@19.0.0):\n    resolution: {}\n\n  react@19.0.0:\n    resolution: {}\n"
    const { fetch, row } = await checkRepo({
      files: cleanRepoWith({ 'package-lock.json': null, 'pnpm-lock.yaml': lock }),
    })
    const batch = fetch.calls.find((call) => call.url.endsWith('/querybatch'))

    expect(row('G10').status).toBe('pass')
    expect(JSON.parse(batch.init.body).queries.map((query) => query.package.name).sort()).toEqual(['react', 'react-dom'])
  })

  it('G1 fails with no test files and no test script', async () => {
    const pkg = JSON.parse(CLEAN_REPO['package.json'])
    delete pkg.scripts
    const files = cleanRepoWith({ 'src/lib/sum.test.ts': null, 'package.json': JSON.stringify(pkg) })

    const { row } = await checkRepo({ files })

    expect(row('G1')).toMatchObject({
      status: 'fail',
      title: 'No tests',
      where: '0 test files, no test script',
      tag: 'full',
    })
  })

  it('G1 fails when tests only assert true is true', async () => {
    const files = cleanRepoWith({ 'src/lib/sum.test.ts': "it('works', () => {\n  expect(true).toBe(true)\n})\n" })

    const { row } = await checkRepo({ files })

    expect(row('G1').title).toBe('Tests check nothing')
  })

  it('G3 fails with no error tracker in the dependencies', async () => {
    const pkg = JSON.parse(CLEAN_REPO['package.json'])
    delete pkg.dependencies['@sentry/react']

    const { row } = await checkRepo({ files: cleanRepoWith({ 'package.json': JSON.stringify(pkg) }) })

    expect(row('G3')).toMatchObject({
      status: 'fail',
      title: 'Crashes go unseen',
    })
  })

  it('G2 fails with no workflows', async () => {
    const { row } = await checkRepo({ files: cleanRepoWith({ '.github/workflows/ci.yml': null }) })

    expect(row('G2')).toMatchObject({
      status: 'fail',
      where: 'no .github/workflows',
    })
  })

  it('G2 warns when workflows only deploy', async () => {
    const files = cleanRepoWith({ '.github/workflows/ci.yml': 'on: push\njobs:\n  deploy:\n    steps:\n      - run: npm run build\n' })

    const { row } = await checkRepo({ files })

    expect(row('G2').status).toBe('warn')
  })

  it('G12 fails on a code file over 1,000 lines', async () => {
    const files = cleanRepoWith({ 'src/pages/Dashboard.tsx': 'const a = 1\n'.repeat(1200) })

    const { row } = await checkRepo({ files })

    expect(row('G12')).toMatchObject({
      status: 'fail',
      where: 'src/pages/Dashboard.tsx',
    })
    expect(row('G12').why).toContain('1,201 lines')
  })

  it('G12 warns between 600 and 1,000 lines and skips generated UI kit files', async () => {
    const files = cleanRepoWith({
      'src/pages/Settings.tsx': 'const a = 1\n'.repeat(700),
      'src/components/ui/sidebar.tsx': 'const a = 1\n'.repeat(2000),
    })

    const { row } = await checkRepo({ files })

    expect(row('G12')).toMatchObject({
      status: 'warn',
      where: 'src/pages/Settings.tsx',
    })
  })

  it('G13 fails on strictNullChecks off and points at that line', async () => {
    const files = cleanRepoWith({
      'tsconfig.app.json': '{\n  "compilerOptions": {\n    "strict": true,\n    "strictNullChecks": false\n  }\n}\n',
    })

    const { row } = await checkRepo({ files })

    expect(row('G13')).toMatchObject({
      status: 'fail',
      title: 'Type checks off',
      where: 'tsconfig.app.json:4',
    })
  })

  it('G13 ignores the build-tool config', async () => {
    const files = cleanRepoWith({ 'tsconfig.node.json': '{\n  "compilerOptions": {\n    "strict": false\n  }\n}\n' })

    const { row } = await checkRepo({ files })

    expect(row('G13').status).toBe('pass')
  })

  it('G11 warns on a dependency two majors behind', async () => {
    const { row } = await checkRepo({
      files: CLEAN_REPO,
      latest: {
        ...CLEAN_LATEST,
        react: '21.0.0',
      },
    })

    expect(row('G11')).toMatchObject({
      status: 'warn',
      where: 'package.json: react',
    })
  })

  it('G9 fails when server functions exist but the schema is not in the repo', async () => {
    const files = cleanRepoWith({
      'supabase/migrations/001_init.sql': null,
      'supabase/functions/send-email/index.ts': 'export default 1\n',
    })

    const { row } = await checkRepo({ files })

    expect(row('G9')).toMatchObject({
      status: 'fail',
      title: "Database can't be rebuilt from the repo",
    })
  })
})

describe('repo mode result', () => {
  it('orders rows worst first and counts every non-pass row as failed', async () => {
    const files = cleanRepoWith({
      '.github/workflows/ci.yml': null,
      'src/pages/Settings.tsx': 'const a = 1\n'.repeat(700),
    })

    const { result } = await checkRepo({ files })
    const statuses = result.checks.map((check) => check.status)

    expect(statuses.slice(0, 2)).toEqual(['fail', 'warn'])
    expect(statuses.slice(2).every((status) => status === 'pass')).toBe(true)
    expect(result.failed).toBe(2)
  })

  it('uses no stack words in any title', async () => {
    const files = cleanRepoWith({
      'tsconfig.app.json': '{\n  "compilerOptions": {\n    "strictNullChecks": false\n  }\n}\n',
      '.github/workflows/ci.yml': null,
    })

    const { result } = await checkRepo({ files })

    for (const check of result.checks) {
      expect(check.title).not.toMatch(/react|typescript|vite|postgres|supabase|built with|lovable/i)
    }
  })
})
