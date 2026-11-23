import { createHash } from 'node:crypto';

import { HERO, SITE_URL, STUDIO_NAME } from '../config';

export const OG_SIZE = { width: 1200, height: 630 };

// The share card reads the hero copy, so a new headline can't leave an old image behind.
export const OG_CARD = {
  brand: STUDIO_NAME,
  title: HERO.title,
  line: `${HERO.anchor.text} ${HERO.anchor.price} · ${HERO.secondary}`,
  host: new URL(SITE_URL).host,
};

// Bump when the card layout changes; the copy is already in the hash.
const OG_LAYOUT = 1;

// Link previews cache the image by its URL, so the URL changes with the card.
export const OG_VERSION = createHash('sha256')
  .update(JSON.stringify({ ...OG_CARD, layout: OG_LAYOUT }))
  .digest('hex')
  .slice(0, 10);

const COLORS = {
  paper: '#10131a',
  ink: '#e9ecf2',
  muted: '#9aa3b5',
  accent: '#93a8ff',
  line: '#272d3a',
};

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="${COLORS.ink}"/><path d="M21.5 11.2c-1-1.7-3-2.7-5.4-2.7-3.2 0-5.4 1.7-5.4 4.1 0 5.4 10.9 3.1 10.9 7.6 0 1.9-2 3.3-5.1 3.3-2.6 0-4.6-1.1-5.6-3" fill="none" stroke="${COLORS.paper}" stroke-width="2.8" stroke-linecap="round"/></svg>`;

type Node = { type: string; props: Record<string, unknown> };

export function buildOgCardTree(): Node {
  return el('div', {
    style: {
      width: OG_SIZE.width,
      height: OG_SIZE.height,
      display: 'flex',
      backgroundColor: COLORS.paper,
      backgroundImage: 'radial-gradient(900px 480px at 90% -20%, rgba(147, 168, 255, 0.22), transparent 70%)',
      color: COLORS.ink,
      fontFamily: 'Inter',
    },
    children: el('div', {
      // satori puts root padding outside the box, so an inset frame holds the margins.
      style: {
        position: 'absolute',
        top: 64,
        right: 80,
        bottom: 64,
        left: 80,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      },
      children: [
        el('div', {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            fontSize: 36,
            fontWeight: 600,
          },
          children: [
            el('img', {
              src: `data:image/svg+xml,${encodeURIComponent(LOGO_SVG)}`,
              width: 56,
              height: 56,
            }),
            OG_CARD.brand,
          ],
        }),
        el('div', {
          style: {
            display: 'flex',
            fontFamily: 'Bricolage Grotesque',
            fontSize: 80,
            fontWeight: 700,
            lineHeight: 1.04,
            letterSpacing: -2,
            maxWidth: 1040,
            textWrap: 'balance',
          },
          children: OG_CARD.title,
        }),
        el('div', {
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: `2px solid ${COLORS.line}`,
            paddingTop: 28,
            fontSize: 32,
          },
          children: [
            el('div', {
              style: { display: 'flex', color: COLORS.muted },
              children: OG_CARD.line,
            }),
            el('div', {
              style: { display: 'flex', color: COLORS.accent, fontWeight: 600 },
              children: OG_CARD.host,
            }),
          ],
        }),
      ],
    }),
  });
}

function el(type: string, props: Record<string, unknown>): Node {
  return { type, props };
}
