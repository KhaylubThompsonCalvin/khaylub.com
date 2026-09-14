import { test, expect } from '@playwright/test';
import { builtRoutes, TEMPLATES } from './helpers';

test.describe('structure', () => {
  for (const path of TEMPLATES) {
    test(`one h1, ordered headings, landmarks, lang on ${path}`, async ({ page }) => {
      await page.goto(path);
      expect(await page.locator('h1').count()).toBe(1);
      const levels = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll((els) => els.map((e) => Number(e.tagName[1])));
      for (let i = 1; i < levels.length; i++) expect(levels[i]).toBeLessThanOrEqual(levels[i - 1] + 1);
      for (const sel of ['header', 'nav', 'main', 'footer']) expect(await page.locator(sel).count()).toBeGreaterThan(0);
      expect(await page.locator('html').getAttribute('lang')).toBe('en');
    });
  }

  test('skip link is the first Tab stop and lands on main', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const active = page.locator(':focus');
    await expect(active).toHaveText('Skip to main content');
    await expect(active).toBeVisible();
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => location.hash)).toBe('#main');
  });

  test('the colophon carries the accessibility statement: target, checks, limitations, feedback, review date', async ({ page }) => {
    await page.goto('/colophon/');
    const section = page.locator('#accessibility');
    await expect(section).toHaveText('Accessibility statement');
    const article = page.locator('article');
    await expect(article).toContainText('WCAG 2.2 level AA');
    for (const h of ['How it is checked', 'Known limitations', 'Feedback']) await expect(article.getByRole('heading', { name: h })).toHaveCount(1);
    await expect(article.locator('a[href="/contact/"]')).toHaveCount(1);
    expect(await article.locator('time[datetime]').getAttribute('datetime')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // The footer names the statement on every page.
    await expect(page.locator('footer a[href="/colophon/"]')).toHaveText(/accessibility/i);
  });

  test('every built route has a unique title and a description', async ({ request }) => {
    const titles = new Map<string, string>();
    for (const route of builtRoutes()) {
      const html = await (await request.get(route)).text();
      const title = html.match(/<title>([^<]+)<\/title>/)?.[1] ?? '';
      expect(title, route).not.toBe('');
      expect(titles.has(title), `duplicate title "${title}" on ${route} and ${titles.get(title)}`).toBe(false);
      titles.set(title, route);
      expect(html, route).toMatch(/<meta name="description" content="[^"]{20,}"/);
    }
  });
});
