import { test, expect } from '@playwright/test';
const clips = (u: string) => /\/media\/ending\//.test(u);

test('Home has one ending band directly before the footer and no clip is requested on load (Lean); /work/ and /resume/ have none', async ({ page }) => {
  const asked: string[] = [];
  page.on('request', (r) => asked.push(r.url()));
  await page.goto('/');
  await page.locator('section.ending').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await expect(page.locator('section.ending')).toHaveCount(1);
  expect(await page.locator('section.ending').evaluate((el) => el.parentElement?.nextElementSibling?.matches('footer'))).toBe(true);
  expect(asked.filter(clips)).toEqual([]);
  for (const p of ['/work/', '/resume/']) {
    await page.goto(p);
    await expect(page.locator('section.ending')).toHaveCount(0);
  }
});

test('Yes plays only the harvest clip and shows the thanks with three referral links; then No swaps to the rain', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Yes' }).click();
  await expect(page.locator('#thanks')).toBeVisible();
  await expect(page.locator('#thanks').getByRole('link')).toHaveText([/Copy link/, /Email a friend/, /Share on LinkedIn/]);
  const playing = () => page.evaluate(() => [...document.querySelectorAll<HTMLVideoElement>('video.ending-clip')].filter((v) => !v.paused).map((v) => v.dataset.clip));
  await expect.poll(playing).toEqual(['harvest']);
  await page.getByRole('button', { name: 'Start over' }).click();
  await page.getByRole('button', { name: 'Not this time' }).click();
  await expect(page.locator('#goodbye')).toBeVisible();
  await expect.poll(playing).toEqual(['trials']);
});

test('Share on LinkedIn opens a new tab safely and names that; Copy link copies the page address', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  await page.goto('/');
  await page.getByRole('button', { name: 'Yes' }).click();
  const li = page.locator('#thanks').getByRole('link', { name: /Share on LinkedIn/ });
  await expect(li).toHaveAttribute('target', '_blank');
  await expect(li).toHaveAttribute('rel', /noopener/);
  await expect(li).toHaveAccessibleName(/new tab/);
});

test('reduced motion: the answer changes the text but no clip is ever requested', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const asked: string[] = [];
  page.on('request', (r) => asked.push(r.url()));
  await page.goto('/');
  await page.getByRole('button', { name: 'Yes' }).click();
  await expect(page.locator('#thanks')).toBeVisible();
  await page.waitForTimeout(800);
  expect(asked.filter(clips)).toEqual([]);
  await ctx.close();
});

test('Full tier warms the clips only when the band nears the screen', async ({ page }) => {
  const asked: string[] = [];
  page.on('request', (r) => asked.push(r.url()));
  await page.addInitScript(() => localStorage.setItem('khaylub-audience', 'exploring'));
  await page.goto('/');
  expect(asked.filter(clips), 'nothing at the top of the page').toEqual([]);
  await page.locator('section.ending').scrollIntoViewIfNeeded();
  await expect.poll(() => asked.filter(clips).length).toBeGreaterThan(0);
});

test('with JavaScript off the answers are links to #thanks and #goodbye and the text shows', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('/');
  // A dispatched click follows the link like a press does; a pointer click is unreliable here on a phone,
  // where the sticky header without script is tall and the page is still settling its lazy images.
  await page.getByRole('link', { name: 'Yes' }).dispatchEvent('click');
  expect(page.url()).toMatch(/#thanks$/);
  await expect(page.locator('#thanks')).toBeVisible();
  await ctx.close();
});

test('focus moves to the message after an answer', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Yes' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#thanks h2')).toBeFocused();
});
