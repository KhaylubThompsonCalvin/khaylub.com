// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

const isPreview = process.env.PUBLIC_SITE_ENV === 'preview';

export default defineConfig({
  site: 'https://khaylub.com',
  trailingSlash: 'always',
  build: {
    format: 'directory',
    // Never inline stylesheets: one external CSS file keeps the Content Security Policy strict.
    inlineStylesheets: 'never',
  },
  integrations: [
    // React is used for islands only (the climb, and later the optional graph map and orbit view).
    react(),
    sitemap({
      // Preview builds never emit a sitemap that could be indexed by mistake.
      filter: (page) => !isPreview && !page.includes('/404'),
    }),
  ],
  vite: {
    build: {
      // One CSS file and no inlined scripts, however small, so the Content Security Policy can
      // stay strict (no 'unsafe-inline').
      cssCodeSplit: false,
      assetsInlineLimit: 0,
    },
  },
});
