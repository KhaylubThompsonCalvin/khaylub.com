import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { skinVersion } from '../scripts/skin-version.mjs';

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
    await expect(page.locator('link#skin-css')).toHaveAttribute('href', `/skins/${a.skin}.css?v=${skinVersion()}`);
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
  for (const f of ['src/scripts/theme-early.js', 'src/scripts/audience.ts']) {
    const js = readFileSync(f, 'utf8');
    for (const a of cfg) expect(js, `${f} ${a.id}`).toContain(`${a.id}:['${a.skin}','${a.tier}']`);
  }
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

test('skin URLs carry the version token (a content hash), and render.yaml caches /skins/* for a year', async ({ request }) => {
  const v = skinVersion();
  expect(v).toMatch(/^[0-9a-f]{10}$/);
  // The early script and audience.ts link /skins/<skin>.css?v=<token>; build-skins.mjs writes the token into both.
  for (const f of ['src/scripts/theme-early.js', 'src/scripts/audience.ts']) expect(readFileSync(f, 'utf8'), f).toMatch(new RegExp(`SKIN_V\\s*=\\s*'${v}'`));
  // Every cover a skin file asks for carries the same token, so a changed cover is a new URL too.
  for (const s of ['desert-night', 'arizona-made', 'golden-hour', 'above-the-clouds']) {
    const urls = [...readFileSync(`public/skins/${s}.css`, 'utf8').matchAll(/url\(([^)]+)\)/g)].map((m) => m[1]);
    expect(urls.length, s).toBeGreaterThan(0);
    for (const u of urls) expect(u, s).toMatch(new RegExp(`\\?v=${v}$`));
  }
  for (const svc of (load(readFileSync('render.yaml', 'utf8')) as { services: { name: string; headers?: { path: string; name: string; value: string }[] }[] }).services.filter((x) => x.headers))
    expect(svc.headers!.find((h) => h.path === '/skins/*' && h.name === 'Cache-Control')?.value, svc.name).toBe('public, max-age=31536000, immutable');
  expect((await request.get(`/skins/desert-night.css?v=${v}`)).headers()['cache-control']).toBe('public, max-age=31536000, immutable');
  expect((await request.get(`/skins/desert-night/cover-640.avif?v=${v}`)).headers()['cache-control']).toBe('public, max-age=31536000, immutable');
});

test('print: a dark skin prints as Paper (dark text on white), without the picker, the ending band or the motion layer', async ({ page }) => {
  await page.addInitScript((v) => localStorage.setItem('khaylub-audience', v), 'tech');
  await page.goto('/resume/');
  await page.waitForFunction(() => !document.documentElement.classList.contains('skin-wait'));
  await page.emulateMedia({ media: 'print', colorScheme: 'light' });
  const lum = (rgb: string) => {
    const [r, g, b] = rgb.match(/\d+/g)!.slice(0, 3).map((n) => { const c = Number(n) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  for (const sel of ['h1', 'main p']) {
    const color = await page.locator(sel).first().evaluate((e) => getComputedStyle(e).color);
    expect((1.05) / (lum(color) + 0.05), `${sel} ${color} on white`).toBeGreaterThanOrEqual(7);
  }
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.skin-motion')!).display)).toBe('none');
  await page.goto('/');
  await expect(page.locator('.ending')).toBeHidden();
  await expect(page.locator('[data-picker]')).toBeHidden();
});

test('a skin file that fails to load drops the tier: Paper, Appearance live, and the ending warms no clip', async ({ page }) => {
  const clips: string[] = [];
  page.on('request', (r) => { if (/\/media\/ending\//.test(r.url())) clips.push(r.url()); });
  await page.route('**/skins/**', (r) => r.abort());
  await page.addInitScript((k) => localStorage.setItem(k, 'exploring'), KEY);
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute('data-tier'))).toBe(null);
  await expect(page.getByRole('group', { name: 'Appearance' }).locator('[data-appearance-note]')).toHaveCount(0);
  await page.locator('section.ending').scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  expect(clips).toEqual([]);
  // The same from the picker mid-visit (audience.ts): the failed file leaves no tier.
  await page.getByRole('group', { name: 'Theme' }).locator('[data-audience-choice="tech"]').click();
  await expect.poll(() => page.evaluate(() => [document.documentElement.dataset.skin, document.documentElement.getAttribute('data-tier')])).toEqual(['desert-night', null]);
});
