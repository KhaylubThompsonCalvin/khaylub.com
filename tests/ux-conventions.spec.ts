import { test, expect, type Page } from '@playwright/test';

// The Jakob's Law pass: the site follows the conventions visitors bring from other sites. A link
// that leaves the site is marked, list and chip links are real 44 px targets, an entry says it
// opens, a concept reads as unbuilt, and the header returns on any scroll up.

const afterContent = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((e) => getComputedStyle(e, '::after').content);

test.describe('marked external links', () => {
  test('an external link carries the arrow; internal and mailto links do not', async ({ page }) => {
    await page.goto('/contact/');
    expect(await afterContent(page, 'main a[href^="https://github.com"]')).toContain('↗');
    expect(await afterContent(page, 'main a[href^="mailto:"]')).toBe('none');
    expect(await afterContent(page, 'main a[href="/resume/"]')).toBe('none');
    // The arrow has empty alt text: the accessible name stays the link's words.
    await expect(page.getByRole('main').getByRole('link', { name: 'GitHub', exact: true })).toHaveCount(1);
  });
});

test.describe('44 px targets', () => {
  const height = async (page: Page, selector: string) =>
    page.locator(selector).evaluateAll((els) => els.filter((e) => e.getClientRects().length).map((e) => ({ t: e.textContent?.trim().slice(0, 30), h: e.getBoundingClientRect().height })));

  for (const [path, selector] of [
    ['/', '.brand'],
    ['/work/', '.proof-links a'],
    ['/work/', '.counts a'],
    ['/projects/khaylub-com-v1/', '.breadcrumb a'],
    ['/notes/sort/title/', '.sort-links a'],
    ['/contact/', 'main li > a'],
    ['/about/', 'main li > a'],
    ['/library/', '.shelf li > a, .shelf p a'],
    ['/search/', '.tag-links a'],
  ] as const) {
    test(`${selector} on ${path} is at least 44 px tall`, async ({ page }) => {
      await page.goto(path);
      const boxes = await height(page, selector);
      expect(boxes.length, `${selector} exists on ${path}`).toBeGreaterThan(0);
      for (const b of boxes) expect(b.h, b.t).toBeGreaterThanOrEqual(44);
    });
  }

  test('the header keeps its 56 px height with the 44 px brand link', async ({ page }) => {
    await page.goto('/');
    const h = await page.locator('header.site-header .navbar').evaluate((e) => e.getBoundingClientRect().height);
    expect(h).toBe(56);
  });

  test('the brand link is the current page on Home only', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.brand')).toHaveAttribute('aria-current', 'page');
    await page.goto('/work/');
    await expect(page.locator('.brand')).not.toHaveAttribute('aria-current', /.*/);
  });
});

test.describe('entry cues', () => {
  test('a card title carries the arrow cue; a tile title too', async ({ page }) => {
    await page.goto('/work/');
    expect(await afterContent(page, '.card h3')).toContain('→');
    await page.goto('/');
    expect(await afterContent(page, '.tile h3')).toContain('→');
  });

  test('a project card carries its status and a concept card draws a dashed rule', async ({ page }) => {
    await page.goto('/projects/');
    await expect(page.locator('.card[data-status="live"]').first()).toBeVisible();
    const live = await page.locator('.card[data-status="live"]').first().evaluate((e) => getComputedStyle(e).borderTopStyle);
    expect(live).toBe('solid');
    // No published project is a concept today; the rule is proven on a card set to one.
    const concept = await page.locator('.card').first().evaluate((e) => {
      e.setAttribute('data-status', 'concept');
      return getComputedStyle(e).borderTopStyle;
    });
    expect(concept).toBe('dashed');
  });
});

test.describe('the returning header', () => {
  const hidden = (page: Page) => page.locator('header.site-header').evaluate((e) => e.hasAttribute('data-hidden'));
  const scrollTo = async (page: Page, y: number) => {
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await page.waitForTimeout(100);
  };

  test('hides reading down past one viewport and returns on any scroll up', async ({ page }) => {
    await page.goto('/work/');
    const vh = await page.evaluate(() => window.innerHeight);
    await scrollTo(page, vh / 2);
    expect(await hidden(page), 'still shown within the first viewport').toBe(false);
    await scrollTo(page, vh * 1.5);
    await scrollTo(page, vh * 1.5 + 200);
    expect(await hidden(page), 'hidden reading down').toBe(true);
    await scrollTo(page, vh * 1.5 + 150);
    expect(await hidden(page), 'back on a scroll up').toBe(false);
  });

  test('stays while anything in the header has focus', async ({ page }) => {
    await page.goto('/work/');
    const vh = await page.evaluate(() => window.innerHeight);
    await page.locator('.brand').focus();
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), vh * 2);
    await page.waitForTimeout(100);
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), vh * 2 + 200);
    await page.waitForTimeout(100);
    expect(await hidden(page)).toBe(false);
  });

  test('stays a plain sticky header under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/work/');
    const vh = await page.evaluate(() => window.innerHeight);
    await scrollTo(page, vh * 1.5);
    await scrollTo(page, vh * 1.5 + 200);
    expect(await hidden(page)).toBe(false);
    const box = await page.locator('header.site-header').evaluate((e) => [getComputedStyle(e).position, getComputedStyle(e).transform]);
    expect(box).toEqual(['sticky', 'none']);
  });
});
