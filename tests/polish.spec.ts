import { test, expect } from '@playwright/test';

// The site-wide polish of 2026-10-10 (Jakob's Law across every page): the conventions visitors bring
// from other sites, held by tests so they stay.

test.describe('navigation conventions', () => {
  for (const [path, label] of [
    ['/work/', 'Work'],
    ['/notes/', 'Field Notes'],
    ['/contact/', 'Contact'],
  ] as const) {
    test(`${path}: the header marks ${label} as the current page, visibly`, async ({ page }) => {
      await page.goto(path);
      const current = page.getByRole('navigation', { name: 'Primary' }).locator('a[aria-current="page"]');
      await expect(current).toHaveCount(1);
      await expect(current).toHaveText(label);
      const style = await current.evaluate((e) => ({ weight: getComputedStyle(e).fontWeight, rule: getComputedStyle(e).borderBottomStyle }));
      expect(Number(style.weight), 'the current page is weighted').toBeGreaterThanOrEqual(600);
    });
  }

  test('the phone menu has its icon and word, holds the page still, closes on Escape, and returns focus', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/work/');
    const button = page.getByRole('button', { name: 'Menu' });
    await expect(button.locator('svg[aria-hidden="true"]')).toHaveCount(1);
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow), 'scroll locked while open').toBe('hidden');
    await page.keyboard.press('Escape');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(button).toBeFocused();
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow), 'scroll released').not.toBe('hidden');
  });

  test('the footer groups its links under named heads', async ({ page }) => {
    await page.goto('/');
    const footer = page.getByRole('navigation', { name: 'Footer' });
    await expect(footer.getByRole('heading', { level: 2 })).toHaveText(['Contact', 'Explore', 'This site']);
  });
});

test.describe('entries and indexes', () => {
  test('an entry ends with a way back to its collection and offers previous or next', async ({ page }) => {
    await page.goto('/notes/preserving-v1/');
    const back = page.locator('.back-link a');
    await expect(back).toHaveText('Back to Field Notes');
    await expect(back).toHaveAttribute('href', '/notes/');
    expect((await back.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(page.getByRole('navigation', { name: 'Previous and next' }).getByRole('link')).not.toHaveCount(0);
  });

  test('filters are chips and the sort order a segmented control, each a 44 px target', async ({ page }) => {
    await page.goto('/notes/');
    for (const sel of ['.filter-bar a.chip', '.sort-links .seg a']) {
      const heights = await page.locator(sel).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
      expect(heights.length, sel).toBeGreaterThan(0);
      for (const h of heights) expect(h, sel).toBeGreaterThanOrEqual(44);
    }
    await expect(page.locator('.sort-links .seg a[aria-current="page"]')).toHaveText('Newest');
  });

  for (const kind of ['tags', 'skills', 'technologies']) {
    test(`/${kind}/ lists every term with its count and a link`, async ({ page }) => {
      const response = await page.goto(`/${kind}/`);
      expect(response!.status()).toBe(200);
      await expect(page.locator('h1')).toHaveCount(1);
      const links = page.locator('main .row-list li > a');
      expect(await links.count()).toBeGreaterThan(0);
      const href = await links.first().getAttribute('href');
      expect(href).toMatch(new RegExp(`^/${kind}/[a-z0-9-]+/$`));
    });
  }
});

test.describe('search and the page not found', () => {
  for (const path of ['/search/', '/no-such-page/']) {
    test(`${path} carries the search field with its magnifier and a Search button`, async ({ page }) => {
      await page.goto(path);
      const form = page.getByRole('search');
      await expect(form).toHaveAttribute('action', '/search/');
      await expect(form.locator('input[type="search"][name="q"]')).toHaveCount(1);
      await expect(form.locator('.search-field svg[aria-hidden="true"]')).toHaveCount(1);
      await expect(form.getByRole('button', { name: 'Search' })).toBeVisible();
    });
  }

  test('the 404 search leads to the search page with the query', async ({ page }) => {
    await page.goto('/no-such-page/');
    await page.getByRole('searchbox').fill('regression');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page).toHaveURL(/\/search\/\?q=regression$/);
  });
});

test.describe('primary actions and motion', () => {
  test('Contact leads with Email me and Résumé with Download the PDF, both filled buttons', async ({ page }) => {
    await page.goto('/contact/');
    await expect(page.locator('main .btn-primary').first()).toHaveText('Email me');
    await expect(page.locator('main .contact li svg[aria-hidden="true"]')).toHaveCount(5);
    await page.goto('/resume/');
    await expect(page.locator('main .btn-primary').first()).toHaveText('Download the PDF');
  });

  test('the page change takes the motion token, 0 s under reduced motion', async ({ browser }) => {
    for (const [reducedMotion, zero] of [['reduce', true], ['no-preference', false]] as const) {
      const ctx = await browser.newContext({ reducedMotion });
      const page = await ctx.newPage();
      await page.goto('/work/');
      const d = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--motion-page').trim());
      if (zero) expect(d, 'no motion under reduced motion').toBe('0s');
      else expect(d, 'a short cross-fade otherwise').not.toMatch(/^0s/);
      await ctx.close();
    }
  });
});
