import { test, expect } from '@playwright/test';
import { builtRoutes } from './helpers';

test.describe('SEO and metadata', () => {
  for (const path of ['/', '/work/', '/projects/khaylub-com-v1/', '/data/fuel-economy-regression/', '/notes/the-16-mb-front-door/']) {
    test(`metadata and JSON-LD on ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://khaylub.com${path}`);
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /^https:\/\/khaylub\.com\/.+\.png$/);
      await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
      const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
      expect(blocks.length).toBeGreaterThan(0);
      for (const b of blocks) {
        const parsed = JSON.parse(b);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of list) expect(item['@type']).toBeTruthy();
      }
    });
  }

  test('the sitemap lists every built route and nothing else', async ({ request }) => {
    const xml = await (await request.get('/sitemap-0.xml')).text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname).sort();
    expect(locs).toEqual(builtRoutes());
  });

  test('robots.txt allows crawling and names the sitemap', async ({ request }) => {
    const txt = await (await request.get('/robots.txt')).text();
    expect(txt).toMatch(/Allow: \//);
    expect(txt).toMatch(/Sitemap: https:\/\/khaylub\.com\/sitemap-index\.xml/);
  });
});
