import { SITE_URL } from '../config';

export function GET() {
  const text = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    '',
    `Sitemap: ${new URL('/sitemap.xml', SITE_URL).href}`,
    '',
  ].join('\n');

  return new Response(text, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
