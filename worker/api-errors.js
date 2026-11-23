// POST /api/errors: crash reports from our own pages, written to the Worker log.
import { toLimitKey } from "./api-check.js";

export const REPORT_MAX_BYTES = 8 * 1024;
export const REPORT_LIMIT_MAX = 20;
export const REPORT_LIMIT_WINDOW_MS = 10 * 60 * 1000;

const TEXT_FIELDS = ["message", "source", "stack", "page"];
const NUMBER_FIELDS = ["line", "column"];
const TEXT_MAX = 2000;

export async function handleErrorReport({ request, limiter }) {
  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: { Allow: "POST" } });
  }
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return new Response(null, { status: 403 });
  }
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  if (!limiter.allow(toLimitKey(ip))) {
    return new Response(null, { status: 429 });
  }
  const text = await request.text();
  if (text.length > REPORT_MAX_BYTES) {
    return new Response(null, { status: 413 });
  }
  const report = parseReport(text);
  if (!report) {
    return new Response(null, { status: 400 });
  }
  console.error("client-error", JSON.stringify(report));
  return new Response(null, { status: 204 });
}

function parseReport(text) {
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return null;
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }
  const report = {};
  for (const field of TEXT_FIELDS) {
    if (typeof body[field] === "string") {
      report[field] = body[field].slice(0, TEXT_MAX);
    }
  }
  for (const field of NUMBER_FIELDS) {
    if (Number.isFinite(body[field])) {
      report[field] = body[field];
    }
  }
  return report;
}
