import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRateLimiter } from "../api-check.js";
import { handleErrorReport, REPORT_MAX_BYTES } from "../api-errors.js";
import worker from "../index.js";

const SITE = "https://spacesonlabs.com";
const CRASH = {
  message: "TypeError: x is undefined",
  source: `${SITE}/_astro/check.js`,
  line: 12,
  column: 4,
  stack: "TypeError: x is undefined\n    at run (check.js:12:4)",
  page: "/check/",
};

describe("POST /api/errors", () => {
  let errorLog;

  beforeEach(() => {
    errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs a crash report from our own pages", async () => {
    const response = await report({ body: CRASH });

    expect(response.status).toBe(204);
    expect(errorLog).toHaveBeenCalledTimes(1);
    const [label, line] = errorLog.mock.calls[0];
    expect(label).toBe("client-error");
    expect(JSON.parse(line)).toEqual(CRASH);
  });

  it("keeps only the known fields and cuts long text", async () => {
    await report({ body: { ...CRASH, stack: "a".repeat(5000), cookie: "secret" } });

    const logged = JSON.parse(errorLog.mock.calls[0][1]);
    expect(logged.cookie).toBeUndefined();
    expect(logged.stack).toHaveLength(2000);
  });

  it("refuses reports from other sites", async () => {
    const response = await report({ body: CRASH, origin: "https://evil.example" });

    expect(response.status).toBe(403);
    expect(errorLog).not.toHaveBeenCalled();
  });

  it("accepts only POST", async () => {
    const response = await handleErrorReport({ request: new Request(`${SITE}/api/errors`), limiter: openLimiter() });

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });

  it("refuses reports over the size limit", async () => {
    const response = await report({ body: { ...CRASH, stack: "a".repeat(REPORT_MAX_BYTES) } });

    expect(response.status).toBe(413);
    expect(errorLog).not.toHaveBeenCalled();
  });

  it("refuses a body that is not JSON", async () => {
    const response = await report({ body: "not json" });

    expect(response.status).toBe(400);
  });

  it("stops logging after 20 reports from one address in 10 minutes", async () => {
    const limiter = createRateLimiter({ max: 20, windowMs: 10 * 60 * 1000 });
    const statuses = [];
    for (let index = 0; index < 21; index += 1) {
      statuses.push((await report({ body: CRASH, limiter })).status);
    }

    expect(statuses.slice(0, 20).every((status) => status === 204)).toBe(true);
    expect(statuses[20]).toBe(429);
    expect(errorLog).toHaveBeenCalledTimes(20);
  });

  it("is wired into the Worker", async () => {
    const assets = vi.fn(() => new Response("page"));

    const response = await worker.fetch(reportRequest({ body: CRASH }), { ASSETS: { fetch: assets } }, {});

    expect(response.status).toBe(204);
    expect(assets).not.toHaveBeenCalled();
  });
});

describe("page safety headers", () => {
  it("sends a content security policy with every page", async () => {
    const assets = vi.fn(() => new Response("page", { headers: { "content-type": "text/html" } }));

    const response = await worker.fetch(new Request(`${SITE}/`), { ASSETS: { fetch: assets } }, {});
    const policy = response.headers.get("content-security-policy");

    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'self'");
    expect(policy).not.toContain("script-src");
  });
});

function report({ body, origin = SITE, limiter = openLimiter() }) {
  return handleErrorReport({ request: reportRequest({ body, origin }), limiter });
}

function reportRequest({ body, origin = SITE }) {
  return new Request(`${SITE}/api/errors`, {
    method: "POST",
    headers: { origin, "content-type": "text/plain", "CF-Connecting-IP": "203.0.113.7" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function openLimiter() {
  return { allow: () => true };
}
