// The visual harness (Phase 28, decision D-28; the design initiative's F1): every template route in
// tests/helpers.ts is captured at the project's viewport and scheme into EVIDENCE_DIR and asserted
// never to scroll sideways. The captures are the before and after evidence of a design package (the
// owner looks at the pictures) and, since F2, the input of scripts/visual-diff.mjs, which compares
// two capture sets pixel by pixel with a threshold of zero (vault document 62). Runs against dist/
// through playwright.visual.config.ts.
//
// Naming: <route-name>--<project>.png where the route name is "home" for "/" and the path with its
// slashes turned into "--" otherwise (for example projects--khaylub-com-v1--phone-dark.png). The
// run's record, baseline-record.json, is written beside the captures by tests/visual/record.ts: the
// browser and its version, the OS, the commit of the build (dist/build.json), the date, the projects,
// the determinism settings, and every capture with its overflow.
import { test, expect } from '@playwright/test';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { TEMPLATES } from '../helpers';

const dir = process.env.EVIDENCE_DIR ?? join('test-results', 'visual');
const fileName = (route: string) => (route === '/' ? 'home' : route.replace(/^\/|\/$/g, '').replace(/\//g, '--'));

test.beforeAll(() => mkdirSync(dir, { recursive: true }));

for (const route of TEMPLATES) {
  test(`${route} is captured and never scrolls sideways`, async ({ page, browser }, info) => {
    const res = await page.goto(route, { waitUntil: 'networkidle' });
    expect(res?.status(), 'the route answers 200').toBe(200);
    const file = `${fileName(route)}--${info.project.name}.png`;
    // Determinism for a pixel comparison (F2): every lazy image is loaded and decoded before the
    // capture (a full-page screenshot does not wait for images below the fold), and native <video>
    // controls, whose rendering varies run to run, are masked out; the mask colour is constant.
    await page.evaluate(async () => {
      for (const img of document.images) if (img.loading === 'lazy') img.loading = 'eager';
      window.scrollTo(0, document.documentElement.scrollHeight);
      const settled = (img: HTMLImageElement) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.addEventListener('load', () => resolve(), { once: true });
              img.addEventListener('error', () => resolve(), { once: true });
            });
      await Promise.all([...document.images].map(settled));
      await Promise.all([...document.images].map((img) => img.decode().catch(() => undefined)));
      window.scrollTo(0, 0);
    });
    await page.screenshot({ path: join(dir, file), fullPage: true, animations: 'disabled', caret: 'hide', mask: [page.locator('video')], maskColor: '#808080' });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${route} at ${info.project.name}: no horizontal overflow`).toBeLessThanOrEqual(1);
    appendFileSync(join(dir, 'captures.ndjson'), JSON.stringify({ route, project: info.project.name, file, overflow, browser: `${browser.browserType().name()} ${browser.version()} (Playwright)` }) + String.fromCharCode(10));
  });
}
