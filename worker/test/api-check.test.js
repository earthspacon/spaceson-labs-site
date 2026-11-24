import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHECK_TIMEOUT_MS, createRateLimiter, handleCheck, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS, toLimitKey } from "../api-check.js";
import worker from "../index.js";
import { CLEAN_LATEST, CLEAN_REPO, fakeFetch, registryRoutes } from "../check/test/helpers.js";

const SITE = "https://spacesonlabs.com";
const API = "https://api.github.com/repos/acme/app";
const RAW = "https://raw.githubusercontent.com/acme/app/1234567890abcdef";
const LIVE_ORIGIN = "https://shop.example.com";
const TOKEN = "test-token-not-real";

describe("GET /api/check", () => {
  let consoleSpies;

  beforeEach(() => {
    consoleSpies = ["log", "info", "warn", "error", "debug"].map((method) => {
      return vi.spyOn(console, method).mockImplementation(() => {});
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns the repo result as JSON and caches it for 10 minutes", async () => {
    const { response, body, cache, fetch } = await check({ target: "https://github.com/acme/app.git" });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=600");
    expect(body).toMatchObject({
      target: "github.com/acme/app",
      mode: "repo",
      commit: "1234567",
      total: 13,
    });
    expect(cache.keys()).toEqual([`${SITE}/api/check?target=github.com%2Facme%2Fapp`]);
    expect(fetch.calls.some((call) => call.url.startsWith(API))).toBe(true);
  });

  it("returns the live result as JSON", async () => {
    const { response, body } = await check({ target: `${LIVE_ORIGIN}/pricing`, routes: liveRoutes() });

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      target: LIVE_ORIGIN,
      mode: "live",
      total: 5,
    });
  });

  it("answers a repeat check from the cache without calling out", async () => {
    const cache = fakeCache();
    const limiter = createRateLimiter({
      max: RATE_LIMIT_MAX,
      windowMs: RATE_LIMIT_WINDOW_MS,
    });
    const first = await check({ target: "github.com/acme/app", cache, limiter });
    const second = await check({ target: "https://github.com/acme/app", cache, limiter });

    expect(second.response.status).toBe(200);
    expect(second.fetch.calls).toHaveLength(0);
    expect(second.body).toEqual(first.body);
  });

  it.each([
    ["bad_target", 400, { target: "not a target" }],
    ["bad_target", 400, { target: null }],
    ["not_found", 404, { routes: {} }],
    ["private_repo", 403, { routes: githubRoutes({ meta: { private: true } }) }],
    [
      "rate_limited",
      429,
      {
        routes: {
          [API]: {
            status: 403,
            headers: { "x-ratelimit-remaining": "0" },
            body: { message: "API rate limit exceeded" },
          },
        },
      },
    ],
    ["upstream", 502, { routes: { [API]: { status: 502, body: "bad gateway" } } }],
  ])("returns %s with status %i and no-store", async (code, status, options) => {
    const { response, body, cache } = await check(options);

    expect(response.status).toBe(status);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toEqual({
      error: code,
      message: expect.any(String),
    });
    expect(cache.keys()).toEqual([]);
  });

  it("returns timeout with status 504 after 25 s", async () => {
    vi.useFakeTimers();
    const pending = check({ fetchImpl: () => new Promise(() => {}) });
    await vi.advanceTimersByTimeAsync(CHECK_TIMEOUT_MS);
    const { response, body } = await pending;

    expect(response.status).toBe(504);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body.error).toBe("timeout");
  });

  it("allows 10 checks per IP in 10 minutes, then returns rate_limited", async () => {
    let now = 0;
    const limiter = createRateLimiter({
      max: RATE_LIMIT_MAX,
      windowMs: RATE_LIMIT_WINDOW_MS,
      now: () => now,
    });
    const statuses = [];
    for (let index = 0; index < 11; index += 1) {
      const { response } = await check({ target: `github.com/acme/app${index}`, limiter, routes: {} });
      statuses.push(response.status);
    }
    const otherIp = await check({ target: "github.com/acme/other", limiter, routes: {}, ip: "198.51.100.9" });
    now = RATE_LIMIT_WINDOW_MS;
    const afterWindow = await check({ target: "github.com/acme/later", limiter, routes: {} });

    expect(statuses.slice(0, 10)).toEqual(Array(10).fill(404));
    expect(statuses[10]).toBe(429);
    expect(otherIp.response.status).toBe(404);
    expect(afterWindow.response.status).toBe(404);
  });

  it("counts every address in one IPv6 /64 against the same limit", async () => {
    const limiter = createRateLimiter({
      max: RATE_LIMIT_MAX,
      windowMs: RATE_LIMIT_WINDOW_MS,
    });
    const statuses = [];
    for (let index = 0; index < 11; index += 1) {
      const { response } = await check({ target: `github.com/acme/v6-${index}`, limiter, routes: {}, ip: `2001:db8:a:b::${index + 1}` });
      statuses.push(response.status);
    }
    const otherNetwork = await check({ target: "github.com/acme/v6-other", limiter, routes: {}, ip: "2001:db8:a:c::1" });

    expect(statuses[10]).toBe(429);
    expect(otherNetwork.response.status).toBe(404);
  });

  it("stops a burst spread over isolates with the shared Cloudflare limit", async () => {
    const keys = [];
    const shared = { limit: vi.fn(async ({ key }) => (keys.push(key), { success: false })) };
    const { response, body, fetch } = await check({
      env: { GITHUB_TOKEN: TOKEN, CHECK_RATE_LIMIT: shared },
      ip: "2001:db8:a:b::9",
    });

    expect(response.status).toBe(429);
    expect(body.error).toBe("rate_limited");
    expect(keys).toEqual(["2001:db8:a:b::/64"]);
    expect(fetch.calls).toEqual([]);
  });

  it("runs the check when the shared limit allows it", async () => {
    const shared = { limit: vi.fn(async () => ({ success: true })) };
    const { response } = await check({ env: { GITHUB_TOKEN: TOKEN, CHECK_RATE_LIMIT: shared } });

    expect(response.status).toBe(200);
    expect(shared.limit).toHaveBeenCalledTimes(1);
  });

  it("answers from the cache without spending the shared limit", async () => {
    const shared = { limit: vi.fn(async () => ({ success: true })) };
    const cache = fakeCache();
    const env = { GITHUB_TOKEN: TOKEN, CHECK_RATE_LIMIT: shared };
    await check({ env, cache });
    await check({ env, cache });

    expect(shared.limit).toHaveBeenCalledTimes(1);
  });

  it("binds the shared limit in the Worker config", () => {
    const config = JSON.parse(readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8"));

    expect(config.ratelimits).toEqual([
      { name: "CHECK_RATE_LIMIT", namespace_id: "1010", simple: { limit: 5, period: 60 } },
    ]);
  });

  it.each([
    ["2001:db8:a:b::1", "2001:db8:a:b::/64"],
    ["2001:0db8:000a:000b:1:2:3:4", "2001:db8:a:b::/64"],
    ["2001:DB8::1", "2001:db8:0:0::/64"],
    ["::1", "0:0:0:0::/64"],
    ["203.0.113.7", "203.0.113.7"],
  ])("keys %s on %s", (ip, key) => {
    expect(toLimitKey(ip)).toBe(key);
  });

  it("caches a repo under its lowercase name", async () => {
    const { cache } = await check({ target: "github.com/Acme/App" });

    expect(cache.keys()).toEqual([`${SITE}/api/check?target=github.com%2Facme%2Fapp`]);
  });

  it.each(["POST", "PUT", "DELETE", "HEAD"])("returns 405 for %s", async (method) => {
    const { response, fetch } = await check({ method });

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET");
    expect(fetch.calls).toHaveLength(0);
  });

  it("sends the token to GitHub only and never into the response or a log", async () => {
    const { response, text, fetch } = await check({});
    const tokenCalls = fetch.calls.filter((call) => JSON.stringify(call.init.headers ?? {}).includes(TOKEN));

    expect(response.status).toBe(200);
    expect(text).not.toContain(TOKEN);
    expect(tokenCalls.length).toBeGreaterThan(0);
    expect(tokenCalls.every((call) => call.url.startsWith("https://api.github.com/"))).toBe(true);
    expect(consoleSpies.every((spy) => spy.mock.calls.length === 0)).toBe(true);
  });

  it("works without GITHUB_TOKEN", async () => {
    const { response, fetch } = await check({ env: {} });
    const authCalls = fetch.calls.filter((call) => JSON.stringify(call.init.headers ?? {}).toLowerCase().includes("authorization"));

    expect(response.status).toBe(200);
    expect(authCalls).toEqual([]);
  });

  it("is wired into the Worker on /api/check only", async () => {
    vi.stubGlobal("caches", { default: fakeCache() });
    const assets = vi.fn(() => new Response("page"));
    const env = { ASSETS: { fetch: assets } };
    const ctx = { waitUntil: () => {} };

    const api = await worker.fetch(new Request(`${SITE}/api/check?target=github.com/acme/app`, { method: "POST" }), env, ctx);
    const page = await worker.fetch(new Request(`${SITE}/check/?t=github.com/acme/app`), env, ctx);

    expect(api.status).toBe(405);
    expect(await page.text()).toBe("page");
    expect(assets).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it("checks this site from its own pages, since a Worker cannot fetch its own domain", async () => {
    const network = vi.fn(() => new Response("", { status: 522 }));
    vi.stubGlobal("caches", { default: fakeCache() });
    vi.stubGlobal("fetch", network);
    const assets = vi.fn((request) => {
      const { pathname } = new URL(request.url);
      if (pathname === "/") {
        return new Response("<html><head><title>Labs</title></head><body>hi</body></html>", { headers: { "content-type": "text/html" } });
      }
      return new Response("not found", { status: 404 });
    });
    const env = { ASSETS: { fetch: assets } };

    const response = await worker.fetch(new Request(`${SITE}/api/check?target=spacesonlabs.com`), env, { waitUntil: () => {} });
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.mode).toBe("live");
    expect(network.mock.calls.map(([input]) => String(input?.url ?? input)).filter((url) => url.includes("spacesonlabs.com"))).toEqual([]);
    vi.unstubAllGlobals();
  });
});

describe("site traffic", () => {
  it("sends http visitors to https with the same path", async () => {
    const assets = vi.fn(() => new Response("page"));

    const response = await worker.fetch(new Request("http://spacesonlabs.com/check/?t=a.com"), { ASSETS: { fetch: assets } }, {});

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://spacesonlabs.com/check/?t=a.com");
    expect(assets).not.toHaveBeenCalled();
  });

  it("tells browsers to use https only", async () => {
    const assets = vi.fn(() => new Response("page"));

    const response = await worker.fetch(new Request(`${SITE}/`), { ASSETS: { fetch: assets } }, {});

    expect(await response.text()).toBe("page");
    expect(response.headers.get("strict-transport-security")).toBe("max-age=31536000");
  });

  it("stops type sniffing and trims the referrer on pages", async () => {
    const assets = vi.fn(() => new Response("page"));

    const response = await worker.fetch(new Request(`${SITE}/`), { ASSETS: { fetch: assets } }, {});

    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
  });
});

async function check({
  target = "github.com/acme/app",
  method = "GET",
  routes = githubRoutes(),
  env = { GITHUB_TOKEN: TOKEN },
  ip = "203.0.113.7",
  cache = fakeCache(),
  limiter = createRateLimiter({
    max: RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
  }),
  fetchImpl,
}) {
  const fetch = fetchImpl ? withCalls(fetchImpl) : fakeFetch({ routes });
  const query = target === null ? "" : `?target=${encodeURIComponent(target)}`;
  const request = new Request(`${SITE}/api/check${query}`, {
    method,
    headers: { "CF-Connecting-IP": ip },
  });
  const pending = [];
  const response = await handleCheck({
    request,
    env,
    ctx: { waitUntil: (promise) => pending.push(promise) },
    cache,
    fetch,
    limiter,
  });
  await Promise.all(pending);
  const text = response.status === 405 ? "" : await response.text();
  return {
    response,
    text,
    body: text ? JSON.parse(text) : null,
    cache,
    fetch,
  };
}

function withCalls(impl) {
  const calls = [];
  async function fetch(url, init = {}) {
    calls.push({
      url: String(url),
      init,
    });
    return impl(url, init);
  }
  fetch.calls = calls;
  return fetch;
}

function fakeCache() {
  const store = new Map();
  return {
    async match(request) {
      return store.get(request.url)?.clone();
    },
    async put(request, response) {
      store.set(request.url, response);
    },
    keys() {
      return [...store.keys()];
    },
  };
}

function githubRoutes({ meta = {} } = {}) {
  return {
    [API]: { body: { private: false, default_branch: "main", ...meta } },
    [`${API}/commits?sha=main&per_page=100`]: {
      body: [{ sha: "1234567890abcdef", author: { login: "ana" }, commit: { committer: { date: "2026-11-10T00:00:00Z" } } }],
    },
    [`${API}/git/trees/main?recursive=1`]: {
      body: {
        sha: "tree",
        tree: Object.entries(CLEAN_REPO).map(([path, text]) => {
          return {
            path,
            type: "blob",
            size: text.length,
          };
        }),
      },
    },
    ...Object.fromEntries(
      Object.entries(CLEAN_REPO).map(([path, text]) => {
        return [`${RAW}/${path.split("/").map(encodeURIComponent).join("/")}`, { body: text }];
      }),
    ),
    ...registryRoutes({ latest: CLEAN_LATEST }),
  };
}

function liveRoutes() {
  return {
    [`${LIVE_ORIGIN}/pricing`]: {
      body: '<html><head><script type="module" src="/assets/index-abc.js"></script></head><body></body></html>',
      headers: {
        "content-type": "text/html",
        "strict-transport-security": "max-age=63072000",
        "content-security-policy": "default-src 'self'",
      },
    },
    [`${LIVE_ORIGIN}/`]: {
      body: '<html><head><script type="module" src="/assets/index-abc.js"></script></head><body></body></html>',
      headers: {
        "content-type": "text/html",
        "strict-transport-security": "max-age=63072000",
        "content-security-policy": "default-src 'self'",
      },
    },
    [`${LIVE_ORIGIN}/assets/index-abc.js`]: {
      body: "console.log(1)",
      headers: { "content-type": "application/javascript" },
    },
  };
}
