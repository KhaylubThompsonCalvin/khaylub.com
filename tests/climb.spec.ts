import { test, expect, type Page } from '@playwright/test';

// The ported V1 climb (Phase 13): zero climb bytes before the door is pressed (P2-FE-06), the real
// scene after it (P2-FE-07), an always-visible exit that returns focus (P2-FE-05, P2-FE-08), the
// Camps as links to V2 pages (P2-FE-09), the one availability statement inside the contact beat
// (P2-FE-13), and V1's reduced-motion rules (doc 29 section 10).
const CLIMB_ASSETS = /climb-mount|climb\.[A-Za-z0-9_-]+\.css|\/client\.|three|fiber|react|\.glb|\.mp4|\.wasm/i;
const AVAILABILITY = 'Available now for IT support roles, with cybersecurity as the long-term goal.';
const NAME = 'Khaylub Thompson-Calvin';

// Serial within a project: several software-rendered WebGL scenes at once starve each other of CPU.
test.describe.configure({ mode: 'serial', timeout: 150_000 });

function watch(page: Page) {
  const requests: string[] = [];
  const bytes = new Map<string, number>();
  const errors: string[] = [];
  const warnings: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  page.on('response', async (r) => {
    if (!CLIMB_ASSETS.test(r.url())) return;
    try {
      bytes.set(r.url(), (await r.body()).length);
    } catch {
      /* the body of a redirected or aborted response is not readable; the size is then unknown */
    }
  });
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
    if (m.type() === 'warning') warnings.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return { requests, bytes, errors, warnings };
}

async function enter(page: Page, door: ReturnType<Page['getByRole']>) {
  await door.click();
  await expect(page.getByRole('status')).toContainText('Loading the climb');
  await expect(page.locator('.climb canvas')).toHaveCount(1, { timeout: 60_000 });
  // Once the models are in, the status line empties (and, being empty, leaves the accessibility tree).
  await expect(page.locator('.climb-status')).toHaveText('', { timeout: 60_000 });
}

test.describe('the climb is opt-in', () => {
  // Home carries no climb code at all: a plain link under the doors goes to /climb/, where the door lives
  // (the owner's hero decision of 2026-09-20).
  test('Home requests no climb bytes and links to /climb/ under the doors', async ({ page }) => {
    const w = watch(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(w.requests.filter((u) => CLIMB_ASSETS.test(u)), 'climb assets requested on Home').toEqual([]);
    expect(await page.locator('[data-climb-door], [data-climb-mount]').count(), 'no climb door or mount on Home').toBe(0);
    const line = page.locator('.hero .climb-line');
    await expect(line).toHaveText('Or enter the climb, the original 3D experience.');
    await expect(line.getByRole('link', { name: 'enter the climb' })).toHaveAttribute('href', '/climb/');
    expect(w.errors, 'console errors').toEqual([]);
  });

  for (const path of ['/climb/']) {
    test(`zero climb bytes before the click on ${path}; the ported scene after; skip returns focus`, async ({ page, request }) => {
      const w = watch(page);
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      expect(w.requests.filter((u) => CLIMB_ASSETS.test(u)), 'climb assets requested before the click').toEqual([]);

      const door = page.getByRole('button', { name: 'Tap to explore' });
      await enter(page, door);

      // The real scene: both models, the island chunk, and the hero beat with the name as an h2.
      const after = w.requests.filter((u) => CLIMB_ASSETS.test(u));
      expect(after.some((u) => /climb-mount/.test(u)), 'the island chunk loads after the click').toBe(true);
      expect(after.filter((u) => /\.glb$/.test(u)).sort()).toEqual(expect.arrayContaining([expect.stringMatching(/wanderer-web\.glb$/), expect.stringMatching(/phoenix-flap\.glb$/)]));
      await expect(page.getByRole('heading', { level: 2, name: NAME })).toBeVisible();
      await expect(page.getByRole('heading', { level: 2, name: NAME })).toBeFocused();
      expect(await page.locator('.climb h1').count(), 'the island adds no second h1').toBe(0);

      // The camps: two links to V2 project pages, three honest concept cards, no dialog.
      const links = page.locator('.climb .camp--link');
      await expect(links).toHaveCount(2);
      for (const href of await links.evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''))) {
        expect(href).toMatch(/^\/projects\/[a-z0-9-]+\/$/);
        expect((await request.get(href)).status(), href).toBe(200);
      }
      await expect(page.locator('.climb .camp--concept')).toHaveCount(3);
      expect(await page.locator('.climb [role="dialog"], .climb video[src*="concept"]').count()).toBe(0);

      // The summit: the one availability statement and the four contact links.
      await page.locator('.climb [data-beat="contact"]').evaluate((el) => el.scrollIntoView({ block: 'end' }));
      await page.waitForTimeout(800);
      await expect(page.locator('.climb [data-beat="contact"] .availability')).toHaveText(AVAILABILITY);
      const contact = page.locator('.climb .contact-links a');
      await expect(contact).toHaveCount(4);
      for (const a of await contact.all()) {
        const href = (await a.getAttribute('href')) ?? '';
        if (href.startsWith('http')) expect(await a.getAttribute('rel')).toMatch(/noopener/);
      }

      // The whole opt-in payload (chunks, models, all four plates) stays near the door's estimate.
      const total = [...w.bytes.values()].reduce((n, b) => n + b, 0);
      expect(total, 'opt-in payload in bytes').toBeGreaterThan(3_000_000);
      expect(total, 'opt-in payload in bytes').toBeLessThan(8_000_000);

      // The exit: visible at the summit as at the trailhead, unmounts the island, returns focus to the door.
      const skip = page.getByRole('button', { name: 'Skip the climb' });
      await expect(skip).toBeInViewport();
      await skip.click();
      await expect(page.locator('.climb')).toHaveCount(0);
      await expect(door).toBeFocused();

      expect(w.errors, 'console errors').toEqual([]);
      expect(w.warnings.filter((m) => /aria-hidden/.test(m))).toEqual([]);
    });
  }

  test('under reduced motion the plates stay paused and hidden, the copy is solid, the models still load', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const w = watch(page);
    await page.goto('/climb/');
    await enter(page, page.getByRole('button', { name: 'Tap to explore' }));
    expect(w.requests.filter((u) => /\.glb$/.test(u)).length, 'the visitor asked for the climb, so the models load').toBe(2);
    const plates = page.locator('.climb video');
    for (const v of await plates.all()) {
      expect(await v.evaluate((el) => (el as HTMLVideoElement).paused)).toBe(true);
      expect(await v.evaluate((el) => getComputedStyle(el).display)).toBe('none');
    }
    for (const inner of await page.locator('.climb .inner').all()) {
      expect(await inner.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
    }
    expect(w.errors).toEqual([]);
    await ctx.close();
  });

  test('/climb/ ends with the Work and Library doors and a link to the frozen original', async ({ page }) => {
    await page.goto('/climb/');
    await expect(page.getByRole('link', { name: 'VIEW MY WORK' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'ENTER THE LIBRARY' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'v1.khaylub.com' })).toHaveAttribute('rel', /noopener/);
  });
});
