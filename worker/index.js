// Serves the static site and the free check, sends http to https and the www hosts to their bare domains.
import { createRateLimiter, handleCheck, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } from "./api-check.js";
import { handleErrorReport, REPORT_LIMIT_MAX, REPORT_LIMIT_WINDOW_MS } from "./api-errors.js";

const BARE_HOSTS = {
  "www.spacesonlabs.com": "spacesonlabs.com",
  "www.inboxsieve.com": "inboxsieve.com",
};

// Hosts routed to this Worker. A Worker cannot fetch its own domain (Cloudflare answers 522),
// so a check of this site is served straight from the Worker instead.
const OWN_HOSTS = new Set(["spacesonlabs.com", ...Object.keys(BARE_HOSTS)]);

const HSTS = "max-age=31536000";
const REFERRER_POLICY = "strict-origin-when-cross-origin";

// Script and style hashes come from Astro in a meta tag; the header adds what a meta tag can't carry.
const CSP = "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'";

const checkLimiter = createRateLimiter({
  max: RATE_LIMIT_MAX,
  windowMs: RATE_LIMIT_WINDOW_MS,
});

const errorLimiter = createRateLimiter({
  max: REPORT_LIMIT_MAX,
  windowMs: REPORT_LIMIT_WINDOW_MS,
});

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/check" && url.protocol === "https:" && !BARE_HOSTS[url.hostname]) {
      return withHsts(
        await handleCheck({
          request,
          env,
          ctx,
          cache: caches.default,
          fetch: (input, init) => checkFetch(new Request(input, init), env),
          limiter: checkLimiter,
        }),
      );
    }
    if (url.pathname === "/api/errors" && url.protocol === "https:" && !BARE_HOSTS[url.hostname]) {
      return withHsts(await handleErrorReport({ request, limiter: errorLimiter }));
    }
    return serveSite(request, env);
  },
};

async function serveSite(request, env) {
  const url = new URL(request.url);
  const bareHost = BARE_HOSTS[url.hostname];
  if (url.protocol === "http:" || bareHost) {
    url.protocol = "https:";
    url.hostname = bareHost ?? url.hostname;
    return Response.redirect(url.toString(), 301);
  }
  return withHsts(await env.ASSETS.fetch(request), { csp: CSP });
}

function checkFetch(request, env) {
  if (OWN_HOSTS.has(new URL(request.url).hostname)) {
    return serveSite(request, env);
  }
  return fetch(request);
}

function withHsts(response, { csp } = {}) {
  const headers = new Headers(response.headers);
  headers.set("strict-transport-security", HSTS);
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", REFERRER_POLICY);
  if (csp) {
    headers.set("content-security-policy", csp);
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
