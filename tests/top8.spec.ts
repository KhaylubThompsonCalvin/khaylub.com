import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { load } from 'js-yaml';

const revisions = readdirSync('content/profile/top8')
  .filter((f) => f.endsWith('.yaml'))
  .map((f) => load(readFileSync(`content/profile/top8/${f}`, 'utf8')) as { as_of: string; items: { slug: string }[] })
  .sort((a, b) => b.as_of.localeCompare(a.as_of));

test.describe('top 8 archives', () => {
  test('the current page links to every revision page and each renders that revision', async ({ page, request }) => {
    await page.goto('/top8/');
    for (const r of revisions) {
      const href = `/top8/${r.as_of}/`;
      await expect(page.locator(`main a[href="${href}"]`).first()).toBeVisible();
      expect((await request.get(href)).status(), href).toBe(200);
    }
  });

  test('an archive page resolves the same items as the current set when it is the newest revision', async ({ page }) => {
    const newest = revisions[0];
    await page.goto('/');
    const home = await page.locator('ol.top8 h3 a').allInnerTexts();
    await page.goto(`/top8/${newest.as_of}/`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(newest.as_of.slice(0, 4));
    expect(await page.locator('ol.top8 h3 a').allInnerTexts()).toEqual(home);
    const skipped = newest.items.length - home.length;
    if (skipped > 0) await expect(page.locator('main')).toContainText(`${skipped} ${skipped === 1 ? 'slot is' : 'slots are'} not published yet`);
  });
});
