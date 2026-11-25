import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import redirect from "../../www-redirect/index.js";

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));

describe("static pages skip the Worker", () => {
  it("runs the Worker only for /api, so page views don't spend the daily request quota", () => {
    const config = readJson("../../wrangler.jsonc");

    expect(config.assets.run_worker_first).toEqual(["/api/*"]);
    expect(config.routes.map((route) => route.pattern)).toEqual(["spacesonlabs.com"]);
  });

  it("sends the security headers with every static file", () => {
    const headers = readFileSync(new URL("../../public/_headers", import.meta.url), "utf8");

    expect(headers).toBe(
      [
        "/*",
        "  Strict-Transport-Security: max-age=31536000",
        "  X-Content-Type-Options: nosniff",
        "  Referrer-Policy: strict-origin-when-cross-origin",
        "  Content-Security-Policy: frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
        "",
      ].join("\n"),
    );
  });
});

describe("www hosts", () => {
  it.each([
    ["https://www.spacesonlabs.com/check/?t=a.com", "https://spacesonlabs.com/check/?t=a.com"],
    ["http://www.spacesonlabs.com/", "https://spacesonlabs.com/"],
    ["https://www.inboxsieve.com/pricing", "https://inboxsieve.com/pricing"],
  ])("sends %s to %s", async (from, to) => {
    const response = await redirect.fetch(new Request(from));

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(to);
  });

  it("is served by its own Worker", () => {
    const config = readJson("../../www-redirect/wrangler.jsonc");

    expect(config.routes.map((route) => route.pattern)).toEqual(["www.spacesonlabs.com", "www.inboxsieve.com"]);
    expect(config.assets).toBeUndefined();
  });
});
