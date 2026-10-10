import { test, expect } from '@playwright/test';

test.describe('home', () => {
  // The first-screen rule (FR-A1 as amended by the owner on 2026-09-20; P2-FE-04): 390x844 is the
  // mobile first-screen acceptance viewport, with 768x1024 and 1440x900 alongside. 375x667 no longer
  // carries a fold requirement (the portrait sits between the availability line and the links on a
  // phone); it is the short-phone usability test below. 320 px is the reflow viewport (tests/visual).
  for (const [w, h] of [[390, 844], [768, 1024], [1440, 900]] as const) {
    test(`doors and availability are above the fold at ${w}x${h}; the climb band follows the hero`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto('/');
      for (const name of ['VIEW MY WORK', 'ENTER THE LIBRARY']) {
        const box = await page.getByRole('link', { name }).boundingBox();
        expect(box, name).not.toBeNull();
        expect(box!.y + box!.height, `${name} bottom`).toBeLessThanOrEqual(h);
      }
      // The climb's entrance (the visual redesign, document 65) is the poster band right under the
      // hero: its link is on the first screen at 1440 and begins within the first screen on a phone.
      const band = await page.locator('.climb-band').boundingBox();
      expect(band, 'the climb band').not.toBeNull();
      expect(band!.y, 'the band begins within the first screen').toBeLessThanOrEqual(h);
      if (w >= 1440) {
        const climb = await page.getByRole('link', { name: 'Enter the climb' }).boundingBox();
        expect(climb!.y + climb!.height, 'the climb link above the fold').toBeLessThanOrEqual(h);
      }
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
    expect(order.slice(0, 4)).toEqual(['Khaylub Thompson-Calvin', 'The climb', 'Now', 'Looking for']);
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
    // textContent, not innerText: a block's label is set in capitals by CSS, the words are not.
    const names = (await page.locator('main h2').allTextContents()).map((h) => h.split(' as of')[0].trim());
    // Journal and On repeat render only when their content files have entries; the profile modules
    // (F5, document 65) are present: Details carries the filled interests groups as rows.
    expect(names).not.toContain('Latest from the journal');
    expect(names).not.toContain('On repeat');
    for (const module of ['Details', 'Contact', 'Writing', 'Library']) expect(names).toContain(module);
    await expect(page.locator('.details dt', { hasText: 'Building' })).toBeVisible();
    expect(await page.locator('main').innerText()).not.toMatch(/No entries yet/);
  });

  test('Top 8 is an ordered list of linked, ranked, captioned tiles', async ({ page }) => {
    await page.goto('/');
    const items = page.locator('ol.top8 > li');
    const n = await items.count();
    expect(n).toBeGreaterThanOrEqual(5);
    expect(n).toBeLessThanOrEqual(8);
    for (let i = 0; i < n; i++) {
      const href = await items.nth(i).getByRole('link').first().getAttribute('href');
      expect(href).toMatch(/^\/[a-z]+\/[a-z0-9-]+\/$/);
      // The rank is in the accessible name (the visually hidden prefix) and shown as a numeral.
      await expect(items.nth(i).getByRole('heading', { level: 3 })).toContainText(`Rank ${i + 1}.`);
      await expect(items.nth(i).locator('.tile-rank')).toHaveText(String(i + 1).padStart(2, '0'));
      await expect(items.nth(i).locator('.tile-cap')).not.toBeEmpty();
    }
  });

  test('the blocks follow the phone order in the DOM and form the grid at 1440: identity full width, the climb beside Now and Looking for, the Top 8 full width', async ({ page }) => {
    await page.goto('/');
    const names = (await page.locator('main h2').allTextContents()).map((h) => h.split(/\s+as of/)[0].trim());
    expect(names.slice(0, 8)).toEqual(['The climb', 'Now', 'Looking for', "Khaylub's Top 8", 'Writing', 'Library', 'Details', 'Contact']);
    await page.setViewportSize({ width: 1440, height: 900 });
    const box = (s: string) => page.locator(s).first().boundingBox();
    const [hero, band, now, looking, top8, grid] = await Promise.all(['.bento > .hero', '.bento > .climb-band', '.bento > [aria-labelledby="now-heading"]', '.bento > [aria-labelledby="looking-heading"]', '.bento > [aria-labelledby="top8-heading"]', '.bento'].map(box));
    expect(Math.abs(hero!.width - grid!.width), 'the identity block runs the full width').toBeLessThan(2);
    expect(band!.y, 'the climb under the identity block').toBeGreaterThan(hero!.y + hero!.height - 1);
    for (const b of [now!, looking!]) {
      expect(Math.abs(b.y - band!.y), 'Now and Looking for on the climb row').toBeLessThan(2);
      expect(Math.abs(b.height - band!.height), 'equal heights on the row, no hole').toBeLessThan(2);
    }
    expect(now!.x, 'Now to the right of the climb').toBeGreaterThan(band!.x + band!.width - 1);
    // The portrait is large on a laptop (about the live site's size) and never upscaled.
    const photo = await page.locator('.hero .id-photo img').boundingBox();
    expect(photo!.width, 'a large portrait at 1440').toBeGreaterThanOrEqual(260);
    expect(Math.abs(top8!.width - grid!.width), 'the Top 8 runs the full width').toBeLessThan(2);
  });

  test('the portrait opens the identity block above the name at 390 wide, large and sharp, and the doors are above the fold', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const hero = page.locator('.bento > .hero');
    const img = hero.locator('.id-photo img');
    await expect(img).toHaveCount(1);
    const [name, photo, heroBox] = await Promise.all([hero.locator('h1').boundingBox(), img.boundingBox(), hero.boundingBox()]);
    expect(photo!.width, 'a large portrait on a phone').toBeGreaterThanOrEqual(160);
    expect(photo!.y + photo!.height, 'the portrait above the name, never between the statement and the doors').toBeLessThanOrEqual(name!.y);
    expect(photo!.y, 'inside the block').toBeGreaterThanOrEqual(heroBox!.y);
    for (const n of ['VIEW MY WORK', 'ENTER THE LIBRARY']) {
      const door = await page.getByRole('link', { name: n }).boundingBox();
      expect(door!.y + door!.height, n + ' above the fold').toBeLessThanOrEqual(844);
      expect(door!.y, n + ' after the portrait').toBeGreaterThan(photo!.y + photo!.height);
    }
    // Never upscaled: the chosen file is at least the rendered width times the device pixel ratio.
    await img.evaluate((e: HTMLImageElement) => (e.complete ? null : new Promise((r) => (e.onload = r))));
    const fit = await img.evaluate((e: HTMLImageElement) => ({ natural: e.naturalWidth, need: e.getBoundingClientRect().width * devicePixelRatio }));
    expect(fit.natural, 'the file covers the rendered pixels').toBeGreaterThanOrEqual(Math.floor(fit.need));
  });

  test('the climb band leads to the remastered climb; every Top 8 tile shows a picture or a typographic tile; Search has its magnifier', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const band = page.locator('.climb-band');
    await expect(band.getByRole('img')).toHaveAttribute('alt', /golden wheat/);
    await expect(band.getByRole('link', { name: 'Enter the climb' })).toHaveAttribute('href', 'https://v1.khaylub.com/');
    await expect(band.getByRole('link', { name: 'The original June 2026 version' })).toHaveAttribute('href', '/climb/');
    // Visitors expect a picture on a card: a tile has its picture, or it is a typographic tile on the tint, never an empty frame.
    for (const tile of await page.locator('.top8 .tile').all()) {
      const pictured = (await tile.locator('img').count()) === 1;
      const typographic = (await tile.getAttribute('class'))!.includes('type-tile');
      expect(pictured || typographic, 'a tile with a picture or a typographic tile').toBe(true);
    }
    await expect(page.locator('.top8 .tile').first().locator('img')).toHaveAttribute('src', /wheat-lane/);
    const search = page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Search' });
    await expect(search).toHaveAccessibleName('Search');
    await expect(search.locator('svg[aria-hidden="true"]')).toHaveCount(1);
    expect((await search.boundingBox())!.height, 'Search is a 44 px target').toBeGreaterThanOrEqual(44);
  });
});
