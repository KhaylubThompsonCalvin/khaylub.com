import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';

const KEY = 'khaylub-audience';
const cfg = (load(readFileSync('content/profile/audiences.yaml', 'utf8')) as { audiences: { id: string; skin: string; tier: string }[] }).audiences;
const attrs = (page: import('@playwright/test').Page) =>
  page.evaluate(() => ['data-audience', 'data-skin', 'data-tier'].map((a) => document.documentElement.getAttribute(a)));

test('a first visit is Paper and Lean: no attributes, no skin stylesheet requested', async ({ page }) => {
  const asked: string[] = [];
  page.on('request', (r) => asked.push(r.url()));
  await page.goto('/');
  expect(await attrs(page)).toEqual([null, null, null]);
  expect(asked.filter((u) => u.includes('/skins/'))).toEqual([]);
});

for (const a of cfg.filter((x) => x.skin !== 'paper')) {
  test(`${a.id}: applied before first paint, ${a.skin} stylesheet linked, tier ${a.tier}`, async ({ page }) => {
    await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [KEY, a.id]);
    await page.goto('/work/', { waitUntil: 'domcontentloaded' });
    expect(await attrs(page)).toEqual([a.id, a.skin, a.tier]);
    await expect(page.locator('link#skin-css')).toHaveAttribute('href', `/skins/${a.skin}.css`);
  });
}

test('hiring stores the answer but links no skin file (Lean)', async ({ page }) => {
  await page.addInitScript((k) => localStorage.setItem(k, 'hiring'), KEY);
  await page.goto('/');
  expect(await attrs(page)).toEqual(['hiring', 'paper', 'lean']);
  await expect(page.locator('link#skin-css')).toHaveCount(0);
});

test('an unknown stored value is ignored: Paper, no error', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((k) => localStorage.setItem(k, 'myspace-1999'), KEY);
  await page.goto('/');
  expect(await attrs(page)).toEqual([null, null, null]);
  expect(errors).toEqual([]);
});

test('a skin file that fails to load never leaves the page hidden (1.5 s guard)', async ({ page }) => {
  await page.route('**/skins/**', (r) => r.abort());
  await page.addInitScript((k) => localStorage.setItem(k, 'tech'), KEY);
  await page.goto('/');
  await page.waitForTimeout(1600);
  expect(await page.evaluate(() => document.documentElement.classList.contains('skin-wait'))).toBe(false);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('the early script and the audience file agree on every mapping', () => {
  const js = readFileSync('src/scripts/theme-early.js', 'utf8');
  for (const a of cfg) expect(js, a.id).toContain(`${a.id}:['${a.skin}','${a.tier}']`);
});
