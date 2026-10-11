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
  expect(await page.evaluate(() => [document.documentElement.dataset.audience, document.documentElement.dataset.skin])).toEqual(['tech', 'desert-night']);
  await expect(page.locator('link#skin-css')).toHaveAttribute('href', '/skins/desert-night.css');
  await expect(row(page)).toBeHidden();
  await page.goto('/resume/');
  expect(await page.evaluate(() => document.documentElement.dataset.skin)).toBe('desert-night');
});

test('changing the answer mid-visit swaps the skin link (never two) and the Top 8', async ({ page }) => {
  await page.goto('/');
  await row(page).getByRole('button', { name: 'Creative and 3D' }).click();
  await theme(page).locator('[data-audience-choice="youtube"]').click();
  await expect(page.locator('link#skin-css')).toHaveCount(1);
  await expect(page.locator('link#skin-css')).toHaveAttribute('href', '/skins/above-the-clouds.css');
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
