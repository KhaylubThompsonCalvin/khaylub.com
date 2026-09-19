// The visual harness (Phase 28, decision D-28): every template route in tests/helpers.ts is
// screenshotted at the project's viewport into EVIDENCE_DIR (the owner looks at the pictures; the
// owner-judgment questions of the acceptance report point at them), and asserted never to scroll
// sideways. No pixel comparison: a baseline is the post-Phase-28 visual sprint's decision (vault
// document 50). Runs against dist/ through playwright.visual.config.ts (npm run test:visual).
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { TEMPLATES } from '../helpers';

const dir = process.env.EVIDENCE_DIR ?? join('test-results', 'visual');
const fileName = (route: string) => (route === '/' ? 'home' : route.replace(/^\/|\/$/g, '').replace(/\//g, '--'));

test.beforeAll(() => mkdirSync(dir, { recursive: true }));

for (const route of TEMPLATES) {
  test(`${route} is captured and never scrolls sideways`, async ({ page }, info) => {
    const res = await page.goto(route, { waitUntil: 'networkidle' });
    expect(res?.status(), 'the route answers 200').toBe(200);
    await page.screenshot({ path: join(dir, `${fileName(route)}--${info.project.name}.png`), fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${route} at ${info.project.name}: no horizontal overflow`).toBeLessThanOrEqual(1);
  });
}
