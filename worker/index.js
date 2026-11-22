// Serves the static site and the free check, and sends the www hosts to their bare domains.
import { createRateLimiter, handleCheck, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } from "./api-check.js";

const BARE_HOSTS = {
  "www.spacesonlabs.com": "spacesonlabs.com",
  "www.inboxsieve.com": "inboxsieve.com",
};

const checkLimiter = createRateLimiter({
  max: RATE_LIMIT_MAX,
  windowMs: RATE_LIMIT_WINDOW_MS,
});

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const bareHost = BARE_HOSTS[url.hostname];
    if (bareHost) {
      url.hostname = bareHost;
      return Response.redirect(url.toString(), 301);
    }
    if (url.pathname === "/api/check") {
      return handleCheck({
        request,
        env,
        ctx,
        cache: caches.default,
        fetch: (input, init) => fetch(input, init),
        limiter: checkLimiter,
      });
    }
    return env.ASSETS.fetch(request);
  },
};
