import { CheckError, toErrorResult } from "./check/errors.js";
import { ERROR_STATUS, parseTarget, runCheck } from "./check/index.js";

export const CHECK_TIMEOUT_MS = 25000;
export const CACHE_SECONDS = 600;
export const RATE_LIMIT_MAX = 10;
export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

const RATE_LIMIT_SWEEP_SIZE = 5000;

// GET /api/check?target=… → the engine result, or the contract error with its status.
export async function handleCheck({ request, env, ctx, cache, fetch, limiter }) {
  if (request.method !== "GET") {
    return new Response(null, {
      status: 405,
      headers: {
        Allow: "GET",
        "Cache-Control": "no-store",
      },
    });
  }
  const url = new URL(request.url);
  const parsed = parseTarget(url.searchParams.get("target"));
  if (!parsed) {
    return errorResponse(toErrorResult(new CheckError("bad_target")));
  }
  const cacheKey = new Request(`${url.origin}/api/check?target=${encodeURIComponent(parsed.target)}`);
  const cached = await cache.match(cacheKey);
  if (cached) {
    return cached;
  }
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  if (!limiter.allow(toLimitKey(ip))) {
    return errorResponse(toErrorResult(new CheckError("rate_limited")));
  }
  const result = await runCheck(parsed.target, {
    fetch,
    githubToken: env.GITHUB_TOKEN || undefined,
    timeoutMs: CHECK_TIMEOUT_MS,
  });
  if (result.error) {
    return errorResponse(result);
  }
  const response = Response.json(result, {
    headers: {
      "Cache-Control": `public, max-age=${CACHE_SECONDS}`,
    },
  });
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

// One IPv6 user usually holds a whole /64, so the limit counts the network, not the address.
export function toLimitKey(ip) {
  if (!ip.includes(":")) {
    return ip;
  }
  const [head, tail = ""] = ip.toLowerCase().split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = ip.includes("::") && tail ? tail.split(":") : [];
  const missing = Math.max(0, 8 - headParts.length - tailParts.length);
  const parts = [...headParts, ...Array(missing).fill("0"), ...tailParts];
  return `${parts
    .slice(0, 4)
    .map((part) => part.replace(/^0+(?=.)/, ""))
    .join(":")}::/64`;
}

// Lives in one isolate only: each Cloudflare isolate keeps its own counts.
export function createRateLimiter({ max, windowMs, now = Date.now }) {
  const hits = new Map();
  return {
    allow(key) {
      const at = now();
      if (hits.size > RATE_LIMIT_SWEEP_SIZE) {
        dropExpired({ hits, at, windowMs });
      }
      const recent = (hits.get(key) ?? []).filter((time) => at - time < windowMs);
      if (recent.length >= max) {
        hits.set(key, recent);
        return false;
      }
      recent.push(at);
      hits.set(key, recent);
      return true;
    },
  };
}

function errorResponse(result) {
  return Response.json(result, {
    status: ERROR_STATUS[result.error],
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function dropExpired({ hits, at, windowMs }) {
  for (const [key, times] of hits) {
    if (times.every((time) => at - time >= windowMs)) {
      hits.delete(key);
    }
  }
}
