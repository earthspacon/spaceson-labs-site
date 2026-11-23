import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// GitHub Pages project sites live under /<repo>/, so the base comes from the environment.
export default defineConfig({
  site: process.env.SITE_URL,
  base: process.env.SITE_BASE ?? '/',
  security: {
    csp: true,
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
