import { test, expect } from '@playwright/test';

test.describe('home', () => {
  // The first-screen rule (FR-A1 as amended by the owner on 2026-09-20; P2-FE-04): 390x844 is the
  // mobile first-screen acceptance viewport, with 768x1024 and 1440x900 alongside. 375x667 no longer
  // carries a fold requirement (the portrait sits between the availability line and the links on a
  // phone); it is the short-phone usability test below. 320 px is the reflow viewport (tests/visual).
  for (const [w, h] of [[390, 844], [768, 1024], [1440, 900]] as const) {
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

  test('a short phone (375x667) scrolls, clips nothing, and keeps every hero control usable', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    const doc = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, scrollable: document.documentElement.scrollHeight > window.innerHeight }));
    expect(doc.overflow, 'horizontal overflow').toBe(0);
    expect(doc.scrollable, 'the page scrolls vertically').toBe(true);
    // Nothing in the hero is clipped or pushed sideways: every piece lies inside the viewport's width.
    for (const el of await page.locator('.hero > *, .hero a, .hero img').all()) {
      const box = await el.boundingBox();
      expect(box, 'a hero element has a box').not.toBeNull();
      expect(box!.x, 'left edge').toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, 'right edge').toBeLessThanOrEqual(375);
    }
    await expect(page.getByRole('heading', { level: 1, name: 'Khaylub Thompson-Calvin' })).toBeInViewport();
    await expect(page.getByText('Available now for IT support roles')).toBeInViewport();
    // The controls are reachable and work: the primary doors, the quick links, the mobile menu.
    for (const name of ['VIEW MY WORK', 'ENTER THE LIBRARY']) {
      const door = page.getByRole('link', { name });
      await door.scrollIntoViewIfNeeded();
      await expect(door).toBeInViewport();
      const box = await door.boundingBox();
      expect(box!.height, `${name} target height`).toBeGreaterThanOrEqual(44);
    }
    await expect(page.getByRole('navigation', { name: 'Quick links' }).getByRole('link')).toHaveCount(4);
    await page.getByRole('link', { name: 'VIEW MY WORK' }).click();
    await expect(page).toHaveURL(/\/work\/$/);
    await page.goBack();
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Work' })).toBeVisible();
  });

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
