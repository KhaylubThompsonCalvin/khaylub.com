import { test, expect } from '@playwright/test';

// Layout B, the cover profile (Profile Themes spec, 2026-10-10, section 3.3): a wide scene, the
// round photo over its lower edge, the name and status as the caption, the contact buttons and the
// doors, the Start-here row, and a Top 8 per audience.
//
// FACE: the head in src/assets/profile/headshot.png (972 by 1296), measured on a 5 % grid on
// 2026-10-10, as fractions of the source: the top of the hair at 3.5 % of the height (45 px), the
// foot of the beard at 70 % (907 px), the ears at 21 % and 72 % of the width (the hair 15 % to 75 %).
// The eyes sit at 31 % (402 px).
const FACE = { x0: 0.21, x1: 0.72, y0: 0.035, y1: 0.7 };

for (const width of [360, 390, 768, 1024, 1440, 1920]) {
  test(`at ${width}: the round photo shows the whole face, sharp, never stretched`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const img = page.locator('.profile-cover .cover-photo img');
    await expect(img).toBeVisible();
    await img.evaluate((e: HTMLImageElement) =>
      e.complete ? null : new Promise((r) => (e.onload = r))
    );
    const m = await img.evaluate((el: HTMLImageElement) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        w: r.width,
        h: r.height,
        nw: el.naturalWidth,
        nh: el.naturalHeight,
        pos: cs.objectPosition,
        fit: cs.objectFit,
        radius: cs.borderRadius,
        src: el.currentSrc,
      };
    });
    expect(m.fit).toBe('cover');
    expect(Math.abs(m.w - m.h), 'square frame').toBeLessThanOrEqual(1);
    expect(m.radius).toMatch(/50%|9999px|999px/);
    expect(m.nw, 'served at least 2x the shown size').toBeGreaterThanOrEqual(
      Math.min(972, m.w * 2)
    );
    expect(Math.abs(m.nw / m.nh - 972 / 1296), 'the source keeps its 3:4 shape').toBeLessThan(0.01);
    // Map the face box into the frame: the width fills, the offset is object-position Y.
    const scale = m.w / m.nw;
    const shownH = m.nh * scale;
    const py = parseFloat(m.pos.split(' ')[1]) / 100;
    const offY = (shownH - m.h) * py;
    const top = FACE.y0 * shownH - offY;
    const bottom = FACE.y1 * shownH - offY;
    expect(top, 'top of the head inside').toBeGreaterThanOrEqual(0);
    expect(bottom, 'chin inside').toBeLessThanOrEqual(m.h);
    // The eyes at about 40 % of the frame (35 % to 45 %).
    const eyes = (0.31 * shownH - offY) / m.h;
    expect(eyes, 'the eyes at about 40 % of the frame').toBeGreaterThan(0.35);
    expect(eyes, 'the eyes at about 40 % of the frame').toBeLessThan(0.45);
  });
}

test('the cover holds the scene, the photo, the name as the h1, the status, the buttons, the doors and Start here', async ({
  page,
}) => {
  await page.goto('/');
  const cover = page.locator('section.profile-cover');
  await expect(cover).toHaveCount(1);
  await expect(cover.locator('.cover-art picture img')).toHaveCount(1);
  await expect(cover.locator('h1.cover-name')).toHaveText('Khaylub Thompson-Calvin');
  await expect(cover.locator('.cover-status')).toContainText('Available now for IT support roles');
  await expect(
    cover.getByRole('navigation', { name: 'Quick links' }).getByRole('link')
  ).toHaveCount(4);
  await expect(cover.getByRole('link', { name: 'VIEW MY WORK' })).toBeVisible();
  await expect(cover.locator('nav.start-here ul[data-for="default"] a')).toHaveText([
    'Work',
    'Library',
    'About',
  ]);
  await page.goto('/about/');
  await expect(page.locator('section.profile-cover h2.cover-name')).toHaveText(
    'Khaylub Thompson-Calvin'
  );
  await expect(page.locator('h1')).toHaveCount(1);
});

test('About me drops down in place with a native details element and works with JS off', async ({
  browser,
}) => {
  // isMobile off: on an emulated phone with JavaScript off the header's noscript nav is wider than
  // the screen (a separate, earlier issue), so the page zooms out; this test is about the details element.
  const ctx = await browser.newContext({
    javaScriptEnabled: false,
    isMobile: false,
    viewport: { width: 390, height: 844 },
  });
  const page = await ctx.newPage();
  await page.goto('/about/');
  const d = page.locator('details.about-drop');
  await expect(d).toHaveCount(1);
  await expect(d.locator('summary')).toHaveText(/Read more/);
  await d.locator('summary').click();
  await expect(d).toHaveAttribute('open', '');
  await expect(d.locator('summary')).toHaveText(/Show less/);
  expect(page.url()).toContain('/about/');
  await ctx.close();
});

test('the skills drop down from a "+N more" chip; every skill is reachable', async ({ page }) => {
  await page.goto('/');
  const d = page.locator('details.skills-drop');
  await expect(d).toHaveCount(1);
  const s = d.locator('summary');
  await expect(s).toHaveText(/^\+\d+ more$/);
  const n = Number((await s.textContent())!.match(/\d+/)![0]);
  await s.click();
  await expect(d.locator('a.chip')).toHaveCount(n);
  await expect(d.locator('a.chip').first()).toBeVisible();
});

test('the Top 8 and Start here follow the stored audience; the default shows otherwise', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('ol.top8[data-for="default"]')).toBeVisible();
  await expect(page.locator('ol.top8[data-for="tech"]')).toBeHidden();
  await page.addInitScript(() => localStorage.setItem('khaylub-audience', 'tech'));
  await page.goto('/');
  await expect(page.locator('ol.top8[data-for="tech"]')).toBeVisible();
  await expect(page.locator('ol.top8[data-for="default"]')).toBeHidden();
  await expect(page.locator('nav.start-here ul[data-for="tech"] a').first()).toHaveText('Projects');
  await expect(page.locator('nav.start-here ul[data-for="default"]')).toBeHidden();
});

test('an external Start-here link carries the external mark', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('khaylub-audience', 'youtube'));
  await page.goto('/');
  const a = page.locator('nav.start-here ul[data-for="youtube"] a').first();
  await expect(a).toBeVisible();
  expect(await a.evaluate((e) => getComputedStyle(e, '::after').content)).toContain('↗');
});

test('an empty greeting renders nothing', async ({ page }) => {
  await page.goto('/');
  for (const p of await page.locator('.cover-greeting p').all())
    expect((await p.textContent())!.trim().length).toBeGreaterThan(0);
});
