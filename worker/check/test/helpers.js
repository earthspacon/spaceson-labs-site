export function makeJwt({ role }) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const header = encode({ alg: 'HS256', typ: 'JWT' })
  const payload = encode({ iss: 'supabase', ref: 'sample000000000000000', role, iat: 1700000000, exp: 2000000000 })
  return `${header}.${payload}.c2lnbmF0dXJlLW5vdC1yZWFsLWZvci10ZXN0cy1vbmx5`
}

export function memoryTree({ files, name = 'fixture', commit = 'abc1234' }) {
  return {
    async open() {
      return {
        name,
        commit,
        info: {
          authors: 1,
          lastCommitDays: 2,
        },
        files: Object.entries(files).map(([path, text]) => {
          return {
            path,
            size: text.length,
          }
        }),
        async readFiles({ paths }) {
          return new Map(
            paths.flatMap(({ path }) => {
              return path in files ? [[path, files[path]]] : []
            }),
          )
        },
      }
    },
  }
}

export function respond({ status = 200, body = '', headers = {} }) {
  return new Response(status === 204 || status === 304 ? null : typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers,
  })
}

// Routes: { 'METHOD url' | 'url': response spec | (init) => spec }; anything else is a 404.
export function fakeFetch({ routes = {}, onRequest } = {}) {
  const calls = []
  async function fetch(url, init = {}) {
    const method = (init.method ?? 'GET').toUpperCase()
    calls.push({
      url: String(url),
      method,
      init,
    })
    onRequest?.({ url: String(url), method, init })
    const route = routes[`${method} ${url}`] ?? routes[String(url)]
    if (!route) {
      return respond({ status: 404, body: 'not found' })
    }
    const spec = typeof route === 'function' ? await route(init) : route
    return spec instanceof Response ? spec : respond(spec)
  }
  fetch.calls = calls
  return fetch
}

export function registryRoutes({ osvResults = null, latest = {}, vulns = {} } = {}) {
  return {
    'POST https://api.osv.dev/v1/querybatch': (init) => {
      const { queries } = JSON.parse(init.body)
      return {
        body: {
          results: queries.map((query) => osvResults?.[query.package.name] ?? {}),
        },
      }
    },
    ...Object.fromEntries(
      Object.entries(vulns).map(([id, severity]) => {
        return [`https://api.osv.dev/v1/vulns/${id}`, { body: { id, database_specific: { severity } } }]
      }),
    ),
    ...Object.fromEntries(
      Object.entries(latest).map(([name, version]) => {
        return [`https://registry.npmjs.org/${name.replace('/', '%2f')}/latest`, { body: { version } }]
      }),
    ),
  }
}

export const CLEAN_REPO = {
  'package.json': JSON.stringify(
    {
      name: 'clean',
      scripts: {
        test: 'vitest run',
      },
      dependencies: {
        '@sentry/react': '^9.1.0',
        react: '^19.0.0',
      },
      devDependencies: {
        vitest: '^5.0.0',
      },
    },
    null,
    2,
  ),
  'package-lock.json': JSON.stringify({
    lockfileVersion: 3,
    packages: {
      '': { name: 'clean' },
      'node_modules/react': { version: '19.0.0' },
      'node_modules/@sentry/react': { version: '9.1.0' },
    },
  }),
  'tsconfig.json': '{\n  "compilerOptions": {\n    "strict": true\n  }\n}\n',
  '.github/workflows/ci.yml': 'on: push\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n',
  '.env': `VITE_SUPABASE_URL=https://example.supabase.co\nVITE_SUPABASE_ANON_KEY=${makeJwt({ role: 'anon' })}\n`,
  'supabase/migrations/001_init.sql': [
    'create table notes (',
    '  id uuid primary key,',
    '  owner uuid not null',
    ');',
    'alter table notes enable row level security;',
    'create policy "own notes" on notes for all to authenticated using (owner = auth.uid());',
  ].join('\n'),
  'src/App.tsx': 'export function App() {\n  return null\n}\n',
  'src/lib/sum.ts': 'export function sum(a: number, b: number) {\n  return a + b\n}\n',
  'src/lib/sum.test.ts': "import { sum } from './sum'\nit('adds', () => {\n  expect(sum(1, 2)).toBe(3)\n})\n",
}

export const CLEAN_LATEST = {
  '@sentry/react': '9.4.0',
  react: '19.2.0',
  vitest: '5.1.1',
}

export function cleanRepoWith(changes) {
  const files = { ...CLEAN_REPO }
  for (const [path, text] of Object.entries(changes)) {
    if (text === null) {
      delete files[path]
    } else {
      files[path] = text
    }
  }
  return files
}
