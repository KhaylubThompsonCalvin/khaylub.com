import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { builtRoutes, TEMPLATES } from './helpers';

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

  // SEO-3: image dimensions and alt on every template; a generated 1200 by 630 card per artifact.
  for (const path of TEMPLATES) {
    test(`Open Graph image with dimensions and alt, rel="me" identity links on ${path}`, async ({ page, request }) => {
      await page.goto(path);
      await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1200');
      await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute('content', '630');
      expect((await page.locator('meta[property="og:image:alt"]').getAttribute('content')) ?? '').not.toBe('');
      const image = (await page.locator('meta[property="og:image"]').getAttribute('content')) ?? '';
      const res = await request.get(image.replace('https://khaylub.com', ''));
      expect(res.status(), image).toBe(200);
      const body = await res.body();
      expect(body.toString('ascii', 1, 4)).toBe('PNG');
      expect([body.readUInt32BE(16), body.readUInt32BE(20)]).toEqual([1200, 630]);
      expect(body.length).toBeLessThan(300 * 1024);
      // rel="me" to GitHub and LinkedIn (SEO-6) in the footer of every page.
      await expect(page.locator('footer a[rel~="me"][href^="https://github.com/"]')).toHaveCount(1);
      await expect(page.locator('footer a[rel~="me"][href^="https://www.linkedin.com/"]')).toHaveCount(1);
    });
  }

  test('every artifact page carries its own Open Graph card and og:type article', async ({ request }) => {
    let artifacts = 0;
    for (const route of builtRoutes()) {
      const html = await (await request.get(route)).text();
      const isArtifact = /"@type":"BreadcrumbList"/.test(html) && /<article class="artifact(?: [^"]*)?"/.test(html);
      if (!isArtifact) continue;
      const image = html.match(/property="og:image" content="([^"]+)"/)?.[1] ?? '';
      expect(image, route).toMatch(/^https:\/\/khaylub\.com\/og\/[a-z]+\/[a-z0-9-]+\.png$/);
      expect(html, route).toMatch(/property="og:type" content="article"/);
      artifacts++;
    }
    expect(artifacts, 'artifact pages found').toBeGreaterThan(5);
  });

  test('the validation script over dist reports zero errors', ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'run once, in the desktop project');
    const out = execSync('node scripts/seo-check.mjs', { encoding: 'utf8' });
    expect(out).toMatch(/errors: 0;/);
    const report = JSON.parse(readFileSync('seo-report.json', 'utf8'));
    expect(report.summary.errors).toBe(0);
    expect(report.summary.pages).toBeGreaterThan(100);
    expect(report.summary.ownImages).toBe(report.summary.artifacts);
  });

  test('the Person record is built from profile data', async ({ page }) => {
    await page.goto('/');
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const person = blocks
      .flatMap((b) => {
        const p = JSON.parse(b);
        return Array.isArray(p) ? p : [p];
      })
      .find((x) => x['@type'] === 'Person');
    expect(person).toBeTruthy();
    expect(person.address.addressRegion).toBe('OR');
    expect(person.alumniOf.map((a: { name: string }) => a.name)).toContain('Portland Community College');
    expect(person.knowsAbout).toContain('Data analysis');
    expect(person.knowsAbout.join(' ')).not.toMatch(/\bAI\b/);
  });

  test('the sitemap lists every indexable built route and nothing else', async ({ request }) => {
    const xml = await (await request.get('/sitemap-0.xml')).text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname).sort();
    // A withdrawal notice (Phase 27) is built at its address but never listed.
    const indexable = builtRoutes().filter((r) => !/data-withdrawn="true"/.test(readFileSync(`dist${r}index.html`, 'utf8')));
    expect(locs).toEqual(indexable);
  });

  test('robots.txt allows crawling and names the sitemap', async ({ request }) => {
    const txt = await (await request.get('/robots.txt')).text();
    expect(txt).toMatch(/Allow: \//);
    expect(txt).toMatch(/Sitemap: https:\/\/khaylub\.com\/sitemap-index\.xml/);
  });
});
