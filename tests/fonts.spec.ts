import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// The self-hosted faces (the design initiative's F3, vault document 63; decisions D-31): both files load
// from this origin and nowhere else, stay inside the font budget, swap in with the metric-matched
// fallbacks, are preloaded, and ship with their licences and provenance.
const FONT_DIR = 'src/assets/fonts';
const FILES = ['fraunces-latin.woff2', 'kt-sans-latin.woff2'];
const BUDGET_KB = (JSON.parse(readFileSync('budget.json', 'utf8'))[0].resourceSizes as { resourceType: string; budget: number }[]).find((r) => r.resourceType === 'font')!.budget;

test.describe('the web fonts', () => {
  test('the shipped files stay inside the font budget and carry licences and provenance', () => {
    const sizes = FILES.map((f) => statSync(join(FONT_DIR, f)).size);
    const total = sizes.reduce((a, b) => a + b, 0);
    expect(total, 'both files together in bytes').toBeLessThan(BUDGET_KB * 1024);
    for (const [i, f] of FILES.entries()) expect(sizes[i], f).toBeLessThan(60 * 1024);
    const names = readdirSync(FONT_DIR);
    expect(names).toEqual(expect.arrayContaining(['OFL-Fraunces.txt', 'OFL-IBM-Plex.txt', 'PROVENANCE.txt']));
    const provenance = readFileSync(join(FONT_DIR, 'PROVENANCE.txt'), 'utf8');
    for (const f of FILES) expect(provenance, `${f} in the provenance record`).toContain(f);
    expect(provenance).toMatch(/fontTools \d+\.\d+\.\d+/);
    expect(readFileSync(join(FONT_DIR, 'OFL-Fraunces.txt'), 'utf8')).toContain('SIL Open Font License, Version 1.1');
    expect(readFileSync(join(FONT_DIR, 'OFL-IBM-Plex.txt'), 'utf8')).toContain('SIL Open Font License, Version 1.1');
  });

  test('the stylesheet declares the faces with swap and the metric-matched fallbacks', () => {
    const css = readFileSync('src/styles/fonts.css', 'utf8');
    for (const family of ['Fraunces', 'KT Sans', 'Fraunces Fallback', 'KT Sans Fallback']) expect(css).toContain(`font-family: '${family}'`);
    expect((css.match(/font-display: swap/g) ?? []).length, 'swap on both web faces').toBe(2);
    expect((css.match(/size-adjust: [\d.]+%/g) ?? []).length, 'size-adjust on both fallbacks').toBe(2);
    expect(css).not.toMatch(/https?:\/\//);
  });

  for (const path of ['/', '/writing/letter-to-time/']) {
    test(`on ${path} both faces load from this origin only, preloaded, and nothing is fetched from a third party`, async ({ page }) => {
      const requests: string[] = [];
      page.on('request', (r) => requests.push(r.url()));
      await page.goto(path, { waitUntil: 'networkidle' });
      const fontRequests = requests.filter((u) => /\.woff2?(\?|$)/.test(u));
      expect(fontRequests.length, 'exactly the two files').toBe(2);
      for (const u of fontRequests) expect(new URL(u).origin, u).toBe(new URL(page.url()).origin);
      expect(requests.filter((u) => !u.startsWith(new URL(page.url()).origin)), 'third-party requests').toEqual([]);
      const preloads = await page.locator('link[rel="preload"][as="font"]').evaluateAll((els) => els.map((e) => `${e.getAttribute('href')} ${e.getAttribute('crossorigin') !== null}`));
      expect(preloads.length, 'both fonts preloaded').toBe(2);
      for (const p of preloads) expect(p).toMatch(/\/_astro\/.+\.woff2 true$/);
      const loaded = await page.evaluate(async () => {
        await document.fonts.ready;
        return { fraunces: document.fonts.check('700 1rem "Fraunces"'), ktSans: document.fonts.check('400 1rem "KT Sans"'), h1: getComputedStyle(document.querySelector('h1')!).fontFamily, body: getComputedStyle(document.body).fontFamily };
      });
      expect(loaded.fraunces, 'Fraunces available').toBe(true);
      expect(loaded.ktSans, 'KT Sans available').toBe(true);
      expect(loaded.h1).toMatch(/^"?Fraunces"?,/);
      expect(loaded.body).toMatch(/^"?KT Sans"?,/);
    });
  }

  test('the long-form reading treatment applies to artifact prose and to nothing on the interface', async ({ page }) => {
    await page.goto('/writing/letter-to-time/');
    const prose = await page.locator('.body p').first().evaluate((e) => ({ size: getComputedStyle(e).fontSize, lh: getComputedStyle(e).lineHeight, measure: getComputedStyle(e.closest('.body')!).maxWidth }));
    expect(prose.size).toBe('17px');
    expect(prose.lh).toBe('27.2px');
    expect(prose.measure, '62ch of KT Sans at 17 px, in rem').toBe('632.4px');
    const meta = await page.locator('.meta').first().evaluate((e) => getComputedStyle(e).fontSize);
    expect(meta, 'the metadata keeps the interface size').toBe('16px');
    await page.goto('/');
    const home = await page.locator('.hero .role').evaluate((e) => ({ size: getComputedStyle(e).fontSize, lh: getComputedStyle(e).lineHeight }));
    expect(home).toEqual({ size: '16px', lh: '24px' });
    const h2 = await page.locator('main h2').first().evaluate((e) => getComputedStyle(e).fontSize);
    expect(h2, 'the section heading at 1.75rem').toBe('28px');
  });
});
