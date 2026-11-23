import { describe, expect, it } from 'vitest';

import { HERO } from '../config';
import { GET as getOgImage } from '../pages/og.png';
import { GET as getRobots } from '../pages/robots.txt';
import { GET as getSitemap } from '../pages/sitemap.xml';
import { OG_CARD, OG_VERSION } from './og-card';

describe('share card', () => {
  it('shows the current hero headline', () => {
    expect(OG_CARD.title).toBe(HERO.title);
    expect(OG_CARD.line).toContain(HERO.anchor.price);
  });

  it('has a short version for the image URL', () => {
    expect(OG_VERSION).toMatch(/^[0-9a-f]{10}$/);
  });

  it('renders a 1200x630 png', async () => {
    const response = await getOgImage({} as never);
    const png = Buffer.from(await response.arrayBuffer());

    expect(response.headers.get('content-type')).toBe('image/png');
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });
});

describe('crawler files', () => {
  it('lists indexed pages in the sitemap and leaves /check out', async () => {
    const xml = await getSitemap().text();

    expect(xml).toContain('<loc>https://spacesonlabs.com/</loc>');
    expect(xml).toContain('<loc>https://spacesonlabs.com/for-ai-assistants/</loc>');
    expect(xml).not.toContain('/check');
  });

  it('points robots.txt at the sitemap', async () => {
    const text = await getRobots().text();

    expect(text).toContain('Sitemap: https://spacesonlabs.com/sitemap.xml');
  });
});
