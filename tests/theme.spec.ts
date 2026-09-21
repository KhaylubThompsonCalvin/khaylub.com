import { test, expect, type Page } from '@playwright/test';

// The Appearance control (F4, vault document 64; D-32): Light, Dark, or System in the footer on
// every width, labelled in words, 44 px targets, aria-pressed, keyboard operable; the choice
// remembered on the device and applied before first paint by the early head script; System
// removes the override and returns control to the device; the theme-color metas follow.
const KEY = 'khaylub-theme';
const DARK_BG = 'rgb(21, 18, 13)';
const LIGHT_BG = 'rgb(236, 228, 216)';

const pageBg = (page: Page) => page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
const attr = (page: Page) => page.evaluate(() => document.documentElement.getAttribute('data-theme'));
const pressed = (page: Page) => page.locator('[data-theme-choice][aria-pressed="true"]').getAttribute('data-theme-choice');

test.describe('the Appearance control', () => {
  for (const path of ['/', '/writing/letter-to-time/']) {
    test(`on ${path}: a labelled group of three 44 px buttons in the footer, System pressed by default`, async ({ page }) => {
      await page.goto(path);
      const group = page.getByRole('group', { name: 'Appearance' });
      await expect(group).toBeVisible();
      expect(await group.evaluate((el) => el.closest('footer') !== null), 'inside the footer').toBe(true);
      const buttons = group.getByRole('button');
      await expect(buttons).toHaveText(['Light', 'Dark', 'System']);
      for (const b of await buttons.all()) {
        const box = await b.boundingBox();
        expect(box!.height, 'target height').toBeGreaterThanOrEqual(44);
        expect(box!.width, 'target width').toBeGreaterThanOrEqual(44);
      }
      expect(await pressed(page)).toBe('system');
      expect(await attr(page)).toBeNull();
    });
  }

  test('Dark pins the dark palette, is remembered across a reload, and is applied before first paint', async ({ page }) => {
    await page.goto('/');
    expect(await pageBg(page)).toBe(LIGHT_BG);
    await page.getByRole('button', { name: 'Dark' }).click();
    expect(await attr(page)).toBe('dark');
    expect(await pageBg(page)).toBe(DARK_BG);
    expect(await pressed(page)).toBe('dark');
    expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe('dark');
    for (const m of await page.locator('meta[name="theme-color"]').all()) expect(await m.getAttribute('content')).toBe('#15120d');
    // Before first paint: the attribute is already on the root when the document has parsed.
    await page.goto('/work/', { waitUntil: 'domcontentloaded' });
    expect(await attr(page), 'the early script applied the stored choice').toBe('dark');
    expect(await pageBg(page)).toBe(DARK_BG);
    expect(await pressed(page)).toBe('dark');
  });

  test('Light pins the light palette even when the device prefers dark; System returns control to the device', async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: 'dark' });
    const page = await ctx.newPage();
    await page.goto('/');
    expect(await pageBg(page), 'the device preference').toBe(DARK_BG);
    await page.getByRole('button', { name: 'Light' }).click();
    expect(await pageBg(page)).toBe(LIGHT_BG);
    for (const m of await page.locator('meta[name="theme-color"]').all()) expect(await m.getAttribute('content')).toBe('#ece4d8');
    await page.reload();
    expect(await pageBg(page), 'remembered').toBe(LIGHT_BG);
    await page.getByRole('button', { name: 'System' }).click();
    expect(await attr(page)).toBeNull();
    expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBeNull();
    expect(await pageBg(page), 'the device decides again').toBe(DARK_BG);
    const metas = await page.locator('meta[name="theme-color"]').evaluateAll((els) => els.map((e) => `${e.getAttribute('media')} ${e.getAttribute('content')}`));
    expect(metas).toEqual(['(prefers-color-scheme: light) #ece4d8', '(prefers-color-scheme: dark) #15120d']);
    await ctx.close();
  });

  test('keyboard: the buttons are reachable in order and toggle with Enter and Space', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Light' }).focus();
    await page.keyboard.press('Enter');
    expect(await pressed(page)).toBe('light');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Dark' })).toBeFocused();
    await page.keyboard.press('Space');
    expect(await pressed(page)).toBe('dark');
    const ring = await page.getByRole('button', { name: 'Dark' }).evaluate((el) => getComputedStyle(el).outlineStyle + ' ' + getComputedStyle(el).outlineWidth);
    expect(ring, 'the focus ring is visible').toMatch(/solid 3px/);
    await page.getByRole('button', { name: 'System' }).click();
  });

  test('no inline script carries the theme logic; both scripts are same-origin files', async ({ page }) => {
    await page.goto('/');
    const scripts = await page.locator('script').evaluateAll((els) => els.map((e) => ({ src: e.getAttribute('src'), type: e.getAttribute('type'), inline: !e.getAttribute('src') && e.textContent!.trim().length > 0 })));
    const inline = scripts.filter((s) => s.inline && s.type !== 'application/ld+json');
    expect(inline, 'inline scripts other than JSON-LD').toEqual([]);
    const early = scripts.find((s) => s.src?.includes('theme-early'));
    expect(early, 'the early script').toBeTruthy();
    expect(early!.type, 'a classic script, before paint').toBeNull();
    expect(early!.src).toMatch(/^\/_astro\/theme-early\.[\w-]+\.js$/);
  });
});
