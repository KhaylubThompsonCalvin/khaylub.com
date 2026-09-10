// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

const isPreview = process.env.PUBLIC_SITE_ENV === 'preview';

export default defineConfig({
  site: 'https://khaylub.com',
  trailingSlash: 'always',
  build: { format: 'directory' },
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
      // One CSS file, no inline styles beyond Astro's scoped output, so the CSP can stay strict.
      cssCodeSplit: false,
    },
  },
});
