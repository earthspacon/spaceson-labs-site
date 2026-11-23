import { SITE_URL } from '../config';

// /check is noindex, so it stays out.
export const INDEXED_PATHS = ['/', '/for-ai-assistants/'];

export function GET() {
  const urls = INDEXED_PATHS.map((path) => {
    return `  <url><loc>${new URL(path, SITE_URL).href}</loc></url>`;
  });
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');

  return new Response(xml, {
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  });
}
