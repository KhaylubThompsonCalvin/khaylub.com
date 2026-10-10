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

test.describe('pictures, About, and the search shortcut (round two)', () => {
  test('every card on every index leads with a picture or a calling card, never an empty frame', async ({ page }) => {
    for (const path of ['/projects/', '/data/', '/notes/', '/writing/', '/video/', '/gallery/', '/experiments/', '/work/', '/tags/python/', '/notes/preserving-v1/']) {
      await page.goto(path);
      const cards = page.locator('main .card');
      const n = await cards.count();
      expect(n, `${path} has cards`).toBeGreaterThan(0);
      for (let i = 0; i < n; i++) {
        const pictured = await cards.nth(i).locator('.thumb img, .thumb.call').count();
        expect(pictured, `${path} card ${i + 1}`).toBe(1);
      }
    }
  });

  test('an entry opens with its picture, or a calling card when it has none', async ({ page }) => {
    for (const path of ['/projects/khaylub-com-v1/', '/data/fuel-economy-regression/', '/notes/preserving-v1/']) {
      await page.goto(path);
      await expect(page.locator('main .entry-hero'), path).toHaveCount(1);
    }
  });

  test('About is the block language: the identity block, the words, and the blocks after it', async ({ page }) => {
    await page.goto('/about/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('About');
    await expect(page.locator('.about > .hero .id-photo img')).toHaveCount(1);
    const labels = (await page.locator('.about .module-heading').allTextContents()).map((t) => t.split(/\s+as of/)[0].trim());
    for (const l of ['In my words', 'How I work', 'Now', 'Education', 'Certified and planned', 'Skills and technologies', 'Contact']) expect(labels).toContain(l);
    expect(await page.locator('.about a.chip').count()).toBeGreaterThan(5);
    await expect(page.locator('.about .contact li svg')).toHaveCount(5);
  });

  test('"/" and Ctrl+K open the search with the field focused', async ({ page, isMobile }) => {
    test.skip(!!isMobile, 'a keyboard shortcut');
    await page.goto('/work/');
    await page.keyboard.press('/');
    await expect(page).toHaveURL(/\/search\/#search$/);
    await expect(page.locator('#search-input')).toBeFocused();
    await page.locator('#search-input').blur();
    await page.keyboard.press('Control+k');
    await expect(page.locator('#search-input')).toBeFocused();
  });
});
