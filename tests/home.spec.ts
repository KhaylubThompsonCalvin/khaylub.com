import { test, expect } from '@playwright/test';

test.describe('home', () => {
  for (const [w, h] of [[375, 667], [390, 844], [768, 1024], [1440, 900]] as const) {
    test(`doors, availability, and the climb line are above the fold at ${w}x${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto('/');
      for (const name of ['VIEW MY WORK', 'ENTER THE LIBRARY']) {
        const box = await page.getByRole('link', { name }).boundingBox();
        expect(box, name).not.toBeNull();
        expect(box!.y + box!.height, `${name} bottom`).toBeLessThanOrEqual(h);
      }
      const climb = await page.getByRole('link', { name: 'enter the climb' }).boundingBox();
      expect(climb!.y + climb!.height).toBeLessThanOrEqual(h);
      await expect(page.getByText('Available now for IT support roles')).toBeInViewport();
    });
  }

  test('blocks appear in the required DOM order', async ({ page }) => {
    await page.goto('/');
    const order = await page.locator('main h1, main h2').evaluateAll((els) => els.map((e) => e.textContent?.trim().split(' as of')[0] ?? ''));
    expect(order.slice(0, 3)).toEqual(['Khaylub Thompson-Calvin', 'Now', "Khaylub's Top 8"]);
    const recruiter = page.getByRole('navigation', { name: 'Quick links' }).getByRole('link');
    await expect(recruiter).toHaveText(['About', 'GitHub', 'Résumé', 'Contact']);
  });

  test('nothing plays or animates on its own; reduced motion removes transitions', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto('/');
    expect(await page.locator('video, audio').count()).toBe(0);
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    const duration = await page.getByRole('link', { name: 'VIEW MY WORK' }).evaluate((e) => getComputedStyle(e).transitionDuration);
    expect(duration.split(',').every((d) => d.trim() === '0s')).toBe(true);
    await ctx.close();
  });

  test('empty optional blocks are not rendered; present blocks are', async ({ page }) => {
    await page.goto('/');
    const names = (await page.locator('main h2').allInnerTexts()).map((h) => h.split(' as of')[0].trim());
    // Journal, On repeat, and Interests render only when their content files have entries.
    expect(names).not.toContain('Latest from the journal');
    expect(names).not.toContain('On repeat');
    expect(names).toContain('Interests');
    expect(await page.locator('main').innerText()).not.toMatch(/No entries yet/);
  });

  test('Top 8 is an ordered list of linked cards', async ({ page }) => {
    await page.goto('/');
    const items = page.locator('ol.top8 > li');
    const n = await items.count();
    expect(n).toBeGreaterThanOrEqual(5);
    expect(n).toBeLessThanOrEqual(8);
    for (let i = 0; i < n; i++) {
      const href = await items.nth(i).getByRole('link').first().getAttribute('href');
      expect(href).toMatch(/^\/[a-z]+\/[a-z0-9-]+\/$/);
    }
  });
});
