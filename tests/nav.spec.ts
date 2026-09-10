import { test, expect } from '@playwright/test';

const LABELS = ['Work', 'Projects', 'Data', 'Field Notes', 'Library', 'About', 'Contact', 'Résumé', 'Search'];

test.describe('navigation', () => {
  test('nine links, inline on desktop, behind a disclosure below 1024 px', async ({ page }, info) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Primary' });
    const button = nav.getByRole('button', { name: 'Menu' });
    const links = nav.getByRole('link');
    if (info.project.name === 'desktop') {
      await expect(button).toBeHidden();
      await expect(links).toHaveCount(9);
      await expect(links).toHaveText(LABELS);
    } else {
      await expect(button).toBeVisible();
      await expect(button).toHaveAttribute('aria-expanded', 'false');
      await expect(links.first()).toBeHidden();
      await button.focus();
      await page.keyboard.press('Enter');
      await expect(button).toHaveAttribute('aria-expanded', 'true');
      await expect(links.first()).toBeVisible();
      await expect(links).toHaveCount(9);
      await page.keyboard.press('Escape');
      await expect(button).toHaveAttribute('aria-expanded', 'false');
      await expect(button).toBeFocused();
      await expect(links.first()).toBeHidden();
    }
  });

  test('every nav and footer link resolves with 200', async ({ page, request }) => {
    await page.goto('/');
    const hrefs = await page.locator('nav a, footer a').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href') ?? ''));
    for (const href of hrefs) {
      if (!href.startsWith('/')) continue;
      const res = await request.get(href);
      expect(res.status(), href).toBe(200);
    }
  });

  test('Work, Résumé, and Contact are one activation from Home; redirects work', async ({ request }) => {
    for (const path of ['/work', '/contact']) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(301);
      expect(res.headers()['location']).toBe(`${path}/`);
    }
    const pdf = await request.get('/resume.pdf', { maxRedirects: 0 });
    expect(pdf.status()).toBe(301);
  });

  test('aria-current marks the active section', async ({ page }) => {
    await page.goto('/work/');
    const link = page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Work', includeHidden: true });
    await expect(link).toHaveAttribute('aria-current', 'page');
  });
});
