// @ts-check
// The owner's publishing Studio: a separate Astro app whose only routes are Keystatic's admin
// (/keystatic) and its API (/api/keystatic), written as project routes in src/pages so the local
// storage mode can point at the repository root (see src/pages/api/keystatic). It runs on a Node
// service (ADR-012 clarification 4) and is never part of the public site's build, headers, or
// budgets. Keystatic needs server-side Node APIs, so the output is a server build with the
// standalone Node adapter.
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],
  // Keystatic's admin binds to 127.0.0.1; the public site's dev server uses 4321, the Studio 4322.
  server: { host: '127.0.0.1', port: 4322 },
  vite: {
    optimizeDeps: { entries: ['keystatic.config.ts', 'src/keystatic-page.ts'] },
  },
});
