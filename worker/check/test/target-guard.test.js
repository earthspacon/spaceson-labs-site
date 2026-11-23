import { describe, expect, it } from 'vitest'
import { ERROR_STATUS, FORBIDDEN_PATHS, ForbiddenRequestError, createGuardedFetch, parseTarget, runCheck } from '../index.js'
import { fakeFetch } from './helpers.js'

describe('parseTarget', () => {
  it('reads a GitHub address as a repo', () => {
    expect(parseTarget('https://github.com/Acme/my-app.git')).toMatchObject({
      mode: 'repo',
      owner: 'acme',
      repo: 'my-app',
      target: 'github.com/acme/my-app',
    })
  })

  it('reads a GitHub address without a scheme and with extra path', () => {
    expect(parseTarget('github.com/acme/app/tree/main/src')).toMatchObject({
      mode: 'repo',
      owner: 'acme',
      repo: 'app',
    })
  })

  it('reads any other address as a live site and adds https', () => {
    expect(parseTarget('my-app.lovable.app/pricing?x=1')).toMatchObject({
      mode: 'live',
      url: 'https://my-app.lovable.app/pricing',
      origin: 'https://my-app.lovable.app',
      name: 'my-app.lovable.app',
    })
  })

  it.each([['not a url'], ['ftp://example.com'], ['https://localhostx'], [''], [42], ['github.com/acme']])('rejects %s', (input) => {
    expect(parseTarget(input)).toBeNull()
  })

  it.each([
    ['127.0.0.1'],
    ['http://127.0.0.1/'],
    ['0x7f000001'],
    ['http://0x7f000001/'],
    ['[::1]'],
    ['http://[::1]:8080/'],
    ['localhost'],
    ['localhost:3000'],
    ['app.localhost'],
    ['10.0.0.1'],
    ['a.com:8080'],
    ['https://a.com:8443/x'],
    [`a.com/${'x'.repeat(2043)}`],
  ])('rejects the private or unusual address %s', (input) => {
    expect(parseTarget(input)).toBeNull()
  })

  it('accepts the default port and an address of exactly 2048 characters', () => {
    expect(parseTarget('https://a.com:443/')).toMatchObject({ origin: 'https://a.com' })
    expect(parseTarget(`a.com/${'x'.repeat(2042)}`)).toMatchObject({ mode: 'live' })
  })

  it('lowercases the owner and repo', () => {
    expect(parseTarget('github.com/Owner/Repo')).toMatchObject({
      owner: 'owner',
      repo: 'repo',
      target: 'github.com/owner/repo',
      name: 'repo',
    })
  })

  it('turns a bad target into a 400 error result', async () => {
    const result = await runCheck('nope', { fetch: fakeFetch() })

    expect(result.error).toBe('bad_target')
    expect(ERROR_STATUS[result.error]).toBe(400)
  })
})

describe('guarded fetch', () => {
  it.each(FORBIDDEN_PATHS)('throws before any request to %s', async (path) => {
    const fetch = fakeFetch()
    const guarded = createGuardedFetch({ fetch })

    await expect(guarded(`https://abc.supabase.co${path}clients?select=*`)).rejects.toBeInstanceOf(ForbiddenRequestError)
    expect(fetch.calls).toHaveLength(0)
  })

  it('throws on a forbidden path without the trailing slash, on any host', async () => {
    const guarded = createGuardedFetch({ fetch: fakeFetch() })

    await expect(guarded('https://example.com/rest/v1')).rejects.toBeInstanceOf(ForbiddenRequestError)
    await expect(guarded('https://example.com/graphql/v1')).rejects.toBeInstanceOf(ForbiddenRequestError)
  })

  it('blocks writes except the security database lookup', async () => {
    const fetch = fakeFetch()
    const guarded = createGuardedFetch({ fetch })

    await expect(guarded('https://example.com/form', { method: 'POST' })).rejects.toBeInstanceOf(ForbiddenRequestError)
    await expect(guarded('https://example.com/x', { method: 'DELETE' })).rejects.toBeInstanceOf(ForbiddenRequestError)
    await guarded('https://api.osv.dev/v1/querybatch', { method: 'POST', body: '{}' })
    expect(fetch.calls.map((call) => call.method)).toEqual(['POST'])
  })

  it('sends our user agent', async () => {
    const fetch = fakeFetch()
    const guarded = createGuardedFetch({ fetch })

    await guarded('https://example.com/')

    expect(new Headers(fetch.calls[0].init.headers).get('user-agent')).toBe('SpacesonLabsCheck/1.0')
  })

  it('stops a live check whose page links to the database address', async () => {
    const fetch = fakeFetch({
      routes: {
        'https://app.example.com/': {
          status: 302,
          headers: { location: 'https://app.example.com/rest/v1/clients' },
        },
      },
    })

    const result = await runCheck('https://app.example.com/', { fetch })

    expect(result.error).toBe('upstream')
    expect(fetch.calls.some((call) => call.url.includes('/rest/v1/'))).toBe(false)
  })
})
