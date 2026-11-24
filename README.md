# Spaceson Labs site

The site of Spaceson Labs, a small product studio, live at [spacesonlabs.com](https://spacesonlabs.com). Astro + Tailwind pages with almost no client-side JavaScript, served by a Cloudflare Worker that also runs the free app check: paste a GitHub repo or a live URL and it reports tables without row rules, secret keys in browser code, exposed settings files, missing safety headers and similar problems a user could hit.

| Desktop | Mobile |
|---|---|
| ![Desktop](docs/screenshot-desktop.png) | ![Mobile](docs/screenshot-mobile.png) |

## Layout

| Path | What |
|---|---|
| `src/` | Astro pages and components. All copy (services, prices, FAQ, product cards) lives in `src/config.ts` |
| `worker/index.js` | The Worker: static assets, https and www redirects, security headers, `/api/check` and the browser error endpoint |
| `worker/check/` | The free check: repo checks (secrets, SQL row rules, packages, settings) and live checks, with an outbound fetch guard and a subrequest budget |

## Run

```bash
pnpm install
pnpm dev       # http://localhost:4321
pnpm build     # static site in dist/
pnpm test      # vitest: the worker, the check and the share card
```

`SITE_URL` sets the origin used for the canonical and OG image URLs, `SITE_BASE` the path the site lives under (default `/`).

## Deploy

`SITE_URL=https://spacesonlabs.com pnpm build && npx wrangler deploy`. The routes and the rate limit binding are in `wrangler.jsonc`.

## License

MIT, see [LICENSE](LICENSE).
