import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

import { Resvg } from '@resvg/resvg-js';
import type { APIRoute } from 'astro';
import satori from 'satori';

import { buildOgCardTree, OG_SIZE } from '../lib/og-card';

const require = createRequire(import.meta.url);

export const GET: APIRoute = async () => {
  const svg = await satori(buildOgCardTree() as never, {
    ...OG_SIZE,
    fonts: await loadFonts(),
  });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: OG_SIZE.width } }).render().asPng();

  return new Response(new Uint8Array(png), {
    headers: { 'content-type': 'image/png' },
  });
};

async function loadFonts() {
  const fonts = [
    { name: 'Inter', file: '@fontsource/inter/files/inter-latin-400-normal.woff', weight: 400 },
    { name: 'Inter', file: '@fontsource/inter/files/inter-latin-600-normal.woff', weight: 600 },
    {
      name: 'Bricolage Grotesque',
      file: '@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-700-normal.woff',
      weight: 700,
    },
  ] as const;

  return Promise.all(
    fonts.map(async ({ name, file, weight }) => {
      return {
        name,
        weight,
        style: 'normal' as const,
        data: await readFile(require.resolve(file)),
      };
    }),
  );
}
