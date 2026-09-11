import { test, expect } from '@playwright/test';
import { TEMPLATES } from './helpers';

test.describe('targets and overflow', () => {
  for (const w of [320, 390, 768, 1440]) {
    test(`no horizontal scroll at ${w} px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 800 });
      for (const path of TEMPLATES) {
        await page.goto(path);
        const [scrollWidth, inner] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
        expect(scrollWidth, `${path} at ${w}`).toBeLessThanOrEqual(inner);
      }
    });
  }

  test('primary actions are at least 44 px; every control at least 24 px', async ({ page }) => {
    await page.goto('/');
    const primary = page.locator('nav a:visible, nav button:visible, .btn:visible, .recruiter-row a');
    for (const box of await primary.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()))) {
      expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
    }
    // Inline links inside sentences are exempt from the 24 px floor (WCAG 2.5.8 inline exception).
    const all = page.locator('a:visible:not(p a):not(dd a):not(li p a), button:visible');
    for (const box of await all.evaluateAll((els) => els.map((e) => ({ w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height, t: e.textContent })))) {
      expect(box.h, box.t ?? '').toBeGreaterThanOrEqual(24);
    }
  });

  test('list links on the new library templates meet the 24 px floor at 390 px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ['/projects/', '/skills/data-analysis/', '/timeline/data/', '/projects/khaylub-com-v1/']) {
      await page.goto(path);
      const short = await page.locator('.breadcrumb a, .filter-bar a, .sort-links a, .related-tags a, .toc a').evaluateAll((els) => els.filter((e) => e.getClientRects().length && e.getBoundingClientRect().height < 24).map((e) => e.textContent?.trim()));
      expect(short, path).toEqual([]);
    }
  });

  test('body text is at least 16 px', async ({ page }) => {
    await page.goto('/');
    const size = await page.locator('main p:not(.eyebrow):not(.small)').first().evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    expect(size).toBeGreaterThanOrEqual(16);
  });
});
