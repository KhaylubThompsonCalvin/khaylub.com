// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { satteri } from '@astrojs/markdown-satteri';
import { wikilinksPlugin, scanTargets } from './src/lib/wikilinks.mjs';

const isPreview = process.env.PUBLIC_SITE_ENV === 'preview';
// The routes of withdrawn pieces (status withdrawn), read from content/ the way the wikilink
// resolver reads it, so the sitemap never lists a withdrawal notice.
const withdrawnRoutes = [...scanTargets().values()].filter((t) => t.status === 'withdrawn').map((t) => t.route);

export default defineConfig({
  site: 'https://khaylub.com',
  trailingSlash: 'always',
  build: {
    format: 'directory',
    // Never inline stylesheets: one external CSS file keeps the Content Security Policy strict.
    inlineStylesheets: 'never',
  },
  markdown: {
    // No inline style attributes anywhere (CSP style-src 'self'; html-validate no-inline-style):
    // code blocks render as plain <pre><code class="language-x"> and take their look from base.css.
    syntaxHighlight: false,
    // [[slug]] and [[slug|text]] resolve to site links; unresolved links fail production builds
    // and render flagged in preview (ADR-006). Sätteri is Astro 7's default processor; the plugin
    // works on its mdast tree.
    processor: satteri({ mdastPlugins: [wikilinksPlugin] }),
  },
  integrations: [
    // React is used for islands only (the climb, and later the optional graph map and orbit view).
    react(),
    sitemap({
      // Preview builds never emit a sitemap that could be indexed by mistake; a withdrawal notice
      // (Phase 27) is never listed.
      filter: (page) => !isPreview && !page.includes('/404') && !withdrawnRoutes.some((r) => page.endsWith(r)),
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
