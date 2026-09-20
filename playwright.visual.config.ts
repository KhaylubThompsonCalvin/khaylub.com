import { defineConfig, devices } from '@playwright/test';

// The visual harness (Phase 28; the design initiative's package F1 made it deterministic): every
// template route captured into EVIDENCE_DIR (default test-results/visual/; the owner points it at the
// vault's evidence folder, a path never written into this repository), plus the overflow assertion,
// against dist/ served with the render.yaml headers. Determinism: one browser (Playwright's pinned
// Chromium, the version written into the run's record), device scale factor 1, the light scheme
// unless a project says dark, reduced motion so transitions and animations never land mid-frame,
// a fixed locale and time zone, a hidden caret, and animations disabled at capture. No pixel
// comparison: a golden set is an owner-approved visual change (vault document 57 section 4).
// Projects: desktop 1440 by 900, tablet 768 by 1024, phone 390 by 844, reflow 320 by 568 (the WCAG
// reflow width), and desktop-dark and phone-dark under prefers-color-scheme: dark.
const port = 4176;
const chrome = devices['Desktop Chrome'];
const common = { ...chrome, deviceScaleFactor: 1, colorScheme: 'light' as const, reducedMotion: 'reduce' as const, locale: 'en-US', timezoneId: 'America/Los_Angeles' };

export default defineConfig({
  testDir: './tests/visual',
  testMatch: /routes.spec.ts$/,
  globalSetup: './tests/visual/record.setup.ts',
  globalTeardown: './tests/visual/record.teardown.ts',
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
    { name: 'desktop', use: { ...common, viewport: { width: 1440, height: 900 } } },
    { name: 'tablet', use: { ...common, viewport: { width: 768, height: 1024 } } },
    { name: 'phone', use: { ...common, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'reflow', use: { ...common, viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true } },
    { name: 'desktop-dark', use: { ...common, colorScheme: 'dark', viewport: { width: 1440, height: 900 } } },
    { name: 'phone-dark', use: { ...common, colorScheme: 'dark', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
