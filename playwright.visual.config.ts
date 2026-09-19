import { defineConfig, devices } from '@playwright/test';

// The visual harness (Phase 28): screenshots of the important routes at the three viewports into
// EVIDENCE_DIR (default test-results/visual/; the owner points it at the vault's evidence folder,
// a path never written into this repository) plus the overflow assertion, against dist/ served
// with the render.yaml headers, like the main suite. No pixel comparison until the owner agrees a
// baseline (vault document 50). Run through `npm run test:visual`.
const port = 4176;

export default defineConfig({
  testDir: './tests/visual',
  timeout: 60_000,
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `node scripts/serve-with-headers.mjs ${port}`,
    url: `http://localhost:${port}/`,
    reuseExistingServer: true,
    timeout: 30_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'tablet', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } } },
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
