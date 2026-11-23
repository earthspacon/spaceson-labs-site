import { describe, expect, it } from 'vitest'
import {
  ForbiddenRequestError,
  SubrequestBudgetError,
  createCountedFetch,
  createGuardedFetch,
  createRedirectFollowingFetch,
  readCapped,
} from '../guarded-fetch.js'
import { fakeFetch } from './helpers.js'

function redirectTo(location, status = 302) {
  return () => new Response(null, { status, headers: { location } })
}

function chain(fetch) {
  return createRedirectFollowingFetch({ fetch: createGuardedFetch({ fetch }) })
}

describe('guarded fetch limits', () => {
  it('always asks for manual redirects', async () => {
    const fetch = fakeFetch()
    const guarded = createGuardedFetch({ fetch })

    await guarded('https://example.com/', { redirect: 'follow' })

    expect(fetch.calls[0].init.redirect).toBe('manual')
  })

  it('allows a POST to the GitHub GraphQL address only', async () => {
    const fetch = fakeFetch()
    const guarded = createGuardedFetch({ fetch })

    await guarded('https://api.github.com/graphql', { method: 'POST', body: '{}' })
    await expect(guarded('https://api.github.com/repos/a/b/issues', { method: 'POST' })).rejects.toBeInstanceOf(
      ForbiddenRequestError,
    )
    expect(fetch.calls.map((call) => call.url)).toEqual(['https://api.github.com/graphql'])
  })
})

describe('redirect following', () => {
  it('stops before a forbidden path on the same site', async () => {
    const fetch = fakeFetch({ routes: { 'https://a.com/x.js': redirectTo('/rest/v1/x') } })

    await expect(chain(fetch)('https://a.com/x.js')).rejects.toBeInstanceOf(ForbiddenRequestError)
    expect(fetch.calls.map((call) => call.url)).toEqual(['https://a.com/x.js'])
  })

  it('returns the redirect unfollowed when it leaves the site', async () => {
    const fetch = fakeFetch({ routes: { 'https://a.com/x.js': redirectTo('https://other.host/') } })

    const response = await chain(fetch)('https://a.com/x.js')

    expect(response.ok).toBe(false)
    expect(fetch.calls.map((call) => call.url)).toEqual(['https://a.com/x.js'])
  })

  it('follows at most three hops', async () => {
    const routes = Object.fromEntries(
      Array.from({ length: 6 }, (_, index) => [`https://a.com/${index}`, redirectTo(`/${index + 1}`)]),
    )
    const fetch = fakeFetch({ routes })

    const response = await chain(fetch)('https://a.com/0')

    expect(response.ok).toBe(false)
    expect(fetch.calls).toHaveLength(4)
  })

  it('hands back the raw redirect when the caller asks for manual', async () => {
    const fetch = fakeFetch({ routes: { 'https://a.com/': redirectTo('/b') } })

    const response = await chain(fetch)('https://a.com/', { redirect: 'manual' })

    expect(response.status).toBe(302)
    expect(fetch.calls).toHaveLength(1)
  })
})

describe('counted fetch', () => {
  it('refuses requests past the budget', async () => {
    const fetch = fakeFetch()
    const counted = createCountedFetch({ fetch, max: 2 })

    await counted('https://a.com/1')
    await counted('https://a.com/2')

    await expect(counted('https://a.com/3')).rejects.toBeInstanceOf(SubrequestBudgetError)
    expect(fetch.calls).toHaveLength(2)
    expect(counted.used()).toBe(2)
  })
})

describe('readCapped', () => {
  it('reads a small body whole', async () => {
    const body = await readCapped({ response: new Response('hello'), maxBytes: 10 })

    expect(body).toEqual({ text: 'hello', isComplete: true })
  })

  it('stops an endless stream at the cap', async () => {
    const stream = new ReadableStream({
      pull(controller) {
        controller.enqueue(new TextEncoder().encode('a'.repeat(1024)))
      },
    })

    const body = await readCapped({ response: new Response(stream), maxBytes: 4096 })

    expect(body.isComplete).toBe(false)
    expect(body.text.length).toBeLessThanOrEqual(4096)
  })
})
