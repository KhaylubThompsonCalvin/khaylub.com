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

test('every scene skin has its four cover widths in AVIF and WebP, each under its weight', async () => {
  const { statSync } = await import('node:fs');
  const max: Record<number, number> = { 640: 45_000, 1024: 90_000, 1440: 150_000, 2880: 250_000 };
  for (const s of ['paper', 'desert-night', 'arizona-made', 'golden-hour', 'above-the-clouds'])
    for (const w of [640, 1024, 1440, 2880])
      for (const f of ['avif', 'webp']) {
        const size = statSync(`public/skins/${s}/cover-${w}.${f}`).size;
        expect(size, `${s} ${w} ${f}`).toBeLessThanOrEqual(max[w]);
      }
});

test('every non-Paper skin file exists, is at most 6 KB, and holds no url() outside /skins/', async () => {
  const { readFileSync, statSync } = await import('node:fs');
  for (const s of ['desert-night', 'arizona-made', 'golden-hour', 'above-the-clouds', 'profile-2006']) {
    const p = `public/skins/${s}.css`;
    expect(statSync(p).size, s).toBeLessThanOrEqual(6144);
    for (const m of readFileSync(p, 'utf8').matchAll(/url\(([^)]+)\)/g)) expect(m[1], s).toMatch(/^["']?\/skins\//);
  }
});

test('reduced motion stops every skin animation', async ({ browser }) => {
  for (const id of ['tech', 'creative', 'exploring', 'youtube', 'nostalgia']) {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.addInitScript((v) => localStorage.setItem('khaylub-audience', v), id);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length);
    expect(running, id).toBe(0);
    await ctx.close();
  }
});

test('the skin motion layer is in the markup, hidden from assistive technology', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body > .skin-motion[aria-hidden="true"]')).toHaveCount(1);
});

test('a skin changes the page colours (the palette tokens follow the semantic ones)', async ({ page }) => {
  await page.addInitScript((v) => localStorage.setItem('khaylub-audience', v), 'tech');
  await page.goto('/work/');
  await page.waitForFunction(() => !document.documentElement.classList.contains('skin-wait'));
  const [bg, ink] = await page.evaluate(() => [getComputedStyle(document.documentElement).backgroundColor, getComputedStyle(document.querySelector('h1')!).color]);
  expect(bg).toBe('rgb(13, 17, 36)');
  expect(ink).toBe('rgb(236, 233, 255)');
});
