import { defineConfig, devices } from '@playwright/test';

// The Studio harness (Phase 28): tests/studio/ against a local Studio in local storage mode that
// scripts/studio-harness.mjs starts, pointed at a throwaway checkout. Run through
// `npm run test:studio`; STUDIO_BASE and STUDIO_ROOT come from the harness. No sign-in exists in
// local mode, so no credential is involved. Serial: the round trips share one Studio and one checkout.
const base = process.env.STUDIO_BASE ?? 'http://127.0.0.1:4331';

export default defineConfig({
  testDir: './tests/studio',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: base,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
