// Serves the static site and the free check, sends http to https and the www hosts to their bare domains.
import { createRateLimiter, handleCheck, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } from "./api-check.js";

const BARE_HOSTS = {
  "www.spacesonlabs.com": "spacesonlabs.com",
  "www.inboxsieve.com": "inboxsieve.com",
};

// Hosts routed to this Worker. A Worker cannot fetch its own domain (Cloudflare answers 522),
// so a check of this site is served straight from the Worker instead.
const OWN_HOSTS = new Set(["spacesonlabs.com", ...Object.keys(BARE_HOSTS)]);

const HSTS = "max-age=31536000";

const checkLimiter = createRateLimiter({
  max: RATE_LIMIT_MAX,
  windowMs: RATE_LIMIT_WINDOW_MS,
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
  return withHsts(await env.ASSETS.fetch(request));
}

function checkFetch(request, env) {
  if (OWN_HOSTS.has(new URL(request.url).hostname)) {
    return serveSite(request, env);
  }
  return fetch(request);
}

function withHsts(response) {
  const headers = new Headers(response.headers);
  headers.set("strict-transport-security", HSTS);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
