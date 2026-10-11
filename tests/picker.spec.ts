import { test, expect } from '@playwright/test';

const row = (p: import('@playwright/test').Page) => p.locator('[data-picker]');
const theme = (p: import('@playwright/test').Page) => p.getByRole('group', { name: 'Theme' });

test('Home shows the picker with six answers as 44 px buttons; other pages do not', async ({ page }) => {
  await page.goto('/');
  await expect(row(page)).toBeVisible();
  await expect(row(page).getByRole('button')).toHaveText(['Hiring', 'Tech and security', 'Creative and 3D', 'Just exploring', 'Here from YouTube', 'Nostalgia', 'Not now']);
  for (const b of await row(page).getByRole('button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.goto('/work/');
  await expect(page.locator('[data-picker]')).toHaveCount(0);
});

test('choosing applies the skin at once, without a reload, and is remembered on every page', async ({ page }) => {
  await page.goto('/');
  await row(page).getByRole('button', { name: 'Tech and security' }).click();
  // The skin attribute changes when the new skin file has loaded (no flash of the old one), so wait for it.
  await expect.poll(() => page.evaluate(() => [document.documentElement.dataset.audience, document.documentElement.dataset.skin])).toEqual(['tech', 'desert-night']);
  await expect(page.locator('link#skin-css')).toHaveAttribute('href', /^\/skins\/desert-night\.css\?v=[0-9a-f]{10}$/);
  await expect(row(page)).toBeHidden();
  await page.goto('/resume/');
  expect(await page.evaluate(() => document.documentElement.dataset.skin)).toBe('desert-night');
});

test('changing the answer mid-visit swaps the skin link (never two) and the Top 8', async ({ page }) => {
  await page.goto('/');
  await row(page).getByRole('button', { name: 'Creative and 3D' }).click();
  await theme(page).locator('[data-audience-choice="youtube"]').click();
  await expect(page.locator('link#skin-css')).toHaveCount(1);
  await expect(page.locator('link#skin-css')).toHaveAttribute('href', /^\/skins\/above-the-clouds\.css\?v=[0-9a-f]{10}$/);
  await expect(page.locator('ol.top8[data-for="youtube"]')).toBeVisible();
});

test('Hiring removes any skin link (Lean); Reset returns to Paper and clears storage', async ({ page }) => {
  await page.goto('/');
  await row(page).getByRole('button', { name: 'Nostalgia' }).click();
  await theme(page).locator('[data-audience-choice="hiring"]').click();
  await expect(page.locator('link#skin-css')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.dataset.tier)).toBe('lean');
  await theme(page).locator('[data-audience-choice="reset"]').click();
  expect(await page.evaluate(() => [document.documentElement.dataset.audience ?? null, localStorage.getItem('khaylub-audience')])).toEqual([null, null]);
});

test('the footer Theme row is a labelled group of 44 px buttons on every page; the stored choice is pressed', async ({ page }) => {
  for (const path of ['/', '/work/', '/resume/']) {
    await page.goto(path);
    const g = theme(page);
    await expect(g).toBeVisible();
    await expect(g.getByRole('button')).toHaveText(['Hiring', 'Tech and security', 'Creative and 3D', 'Just exploring', 'Here from YouTube', 'Nostalgia', 'Reset to Paper']);
    for (const b of await g.getByRole('button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await page.goto('/work/');
  await theme(page).locator('[data-audience-choice="tech"]').click();
  await expect(theme(page).locator('[data-audience-choice="tech"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(theme(page).locator('[data-audience-choice="hiring"]')).toHaveAttribute('aria-pressed', 'false');
  await page.goto('/about/');
  await expect(theme(page).locator('[data-audience-choice="tech"]')).toHaveAttribute('aria-pressed', 'true');
  await theme(page).locator('[data-audience-choice="reset"]').click();
  await expect(theme(page).locator('[data-audience-choice="tech"]')).toHaveAttribute('aria-pressed', 'false');
});

test('with JavaScript off neither the picker nor the Theme row is shown', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.locator('[data-picker]')).toBeHidden();
  await expect(page.locator('[data-theme-row]')).toBeHidden();
  await ctx.close();
});

test('a fixed-scheme skin says so beside Appearance and marks its buttons aria-disabled; Paper clears it', async ({ page }) => {
  const appearance = page.getByRole('group', { name: 'Appearance' });
  const note = appearance.locator('[data-appearance-note]');
  await page.goto('/work/');
  await expect(note).toHaveCount(0);
  await theme(page).locator('[data-audience-choice="tech"]').click();
  await expect(note).toHaveText('This theme sets its own colors.');
  await expect(appearance).toHaveAttribute('aria-describedby', 'appearance-note');
  for (const b of await appearance.locator('[data-theme-choice]').all()) await expect(b).toHaveAttribute('aria-disabled', 'true');
  // Still focusable, and a press changes nothing.
  await appearance.locator('[data-theme-choice="dark"]').focus();
  await expect(appearance.locator('[data-theme-choice="dark"]')).toBeFocused();
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => [document.documentElement.getAttribute('data-theme'), localStorage.getItem('khaylub-theme')])).toEqual([null, null]);
  // A stored skin shows the note on the next page from the start.
  await page.goto('/resume/');
  await expect(note).toHaveCount(1);
  await theme(page).locator('[data-audience-choice="hiring"]').click();
  await expect(note).toHaveCount(0);
  await expect(appearance.locator('[data-theme-choice][aria-disabled]')).toHaveCount(0);
  await theme(page).locator('[data-audience-choice="nostalgia"]').click();
  await expect(note).toHaveCount(1);
  await theme(page).locator('[data-audience-choice="reset"]').click();
  await expect(note).toHaveCount(0);
});

test('keyboard: choosing from the picker moves focus to the cover heading and announces the theme; Not now too', async ({ page }) => {
  await page.goto('/');
  const status = page.locator('[data-picker-status][role="status"]');
  await expect(status).toHaveText('');
  await row(page).getByRole('button', { name: 'Tech and security' }).focus();
  await page.keyboard.press('Enter');
  await expect(row(page)).toBeHidden();
  await expect(page.locator('#site-name')).toBeFocused();
  await expect(status).toHaveText('Theme set to Desert Night. Change it any time in the footer.');
  // Tab moves on from the heading, never from the top of the page.
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);

  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
  await row(page).getByRole('button', { name: 'Not now' }).focus();
  await page.keyboard.press('Space');
  await expect(row(page)).toBeHidden();
  await expect(page.locator('#site-name')).toBeFocused();
  await expect(page.locator('[data-picker-status]')).toHaveText('No theme chosen. You can pick one in the footer.');
});

test('another tab that changes the answer is followed here (storage event), and a page restored from the back/forward cache re-reads it', async ({ page, context }) => {
  await page.goto('/');
  await expect(row(page)).toBeVisible();
  const other = await context.newPage();
  await other.goto('/work/');
  await theme(other).locator('[data-audience-choice="tech"]').click();
  await expect.poll(() => page.evaluate(() => [document.documentElement.dataset.audience, document.documentElement.dataset.skin])).toEqual(['tech', 'desert-night']);
  await expect(row(page)).toBeHidden();
  await expect(theme(page).locator('[data-audience-choice="tech"]')).toHaveAttribute('aria-pressed', 'true');
  await other.close();
  // A bfcache restore: storage changed while the page was away (no storage event reaches it), then pageshow with persisted.
  await page.evaluate(() => {
    localStorage.setItem('khaylub-audience', 'hiring');
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await expect.poll(() => page.evaluate(() => [document.documentElement.dataset.audience, document.documentElement.dataset.tier])).toEqual(['hiring', 'lean']);
  await expect(page.locator('link#skin-css')).toHaveCount(0);
  await page.evaluate(() => {
    localStorage.clear();
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.audience ?? null)).toBe(null);
  await expect(row(page)).toBeVisible();
});

test('one setup that throws does not stop the others (site.ts), and audience.ts avoids Object.hasOwn', async ({ page }) => {
  const { readFileSync } = await import('node:fs');
  expect(readFileSync('src/scripts/audience.ts', 'utf8')).not.toContain('Object.hasOwn(');
  // setupCopy reads navigator.clipboard; make that throw, and the setups after it must still run.
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'clipboard', { get() { throw new Error('no clipboard here'); } }));
  await page.goto('/');
  await expect(theme(page)).toBeVisible();
  await expect(row(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Yes' })).toBeVisible();
});
