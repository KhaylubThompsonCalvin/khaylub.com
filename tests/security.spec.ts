import { test, expect } from '@playwright/test';

test.describe('security regression', () => {
  test('zero cross-origin requests on the entry pages', async ({ page }) => {
    for (const path of ['/', '/work/', '/about/', '/resume/', '/contact/']) {
      const foreign: string[] = [];
      const handler = (r: { url: () => string }) => {
        if (!r.url().startsWith('http://localhost:')) foreign.push(r.url());
      };
      page.on('request', handler);
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      page.off('request', handler);
      expect(foreign, path).toEqual([]);
    }
  });

  test('no CSP violations reported under Report-Only', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__csp = [];
      document.addEventListener('securitypolicyviolation', (e: any) => (window as any).__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
    });
    for (const path of ['/', '/work/', '/climb/', '/projects/khaylub-com-v1/']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      if (path === '/') {
        await page.getByRole('button', { name: 'Enter the climb' }).click();
        await page.getByRole('button', { name: 'Skip the climb' }).waitFor();
        // The ported scene: models, meshopt WebAssembly, webp textures through blob: URLs.
        await page.locator('.climb canvas').waitFor({ timeout: 60_000 });
        await page.locator('.climb-status').filter({ hasText: /^$/ }).waitFor({ state: 'attached', timeout: 60_000 });
        await page.waitForTimeout(1000);
      }
      expect(await page.evaluate(() => (window as any).__csp), path).toEqual([]);
    }
  });

  test('sensitive paths return 404', async ({ request }) => {
    for (const path of ['/.git/HEAD', '/.env', '/package.json', '/astro.config.mjs', '/_astro/missing.js.map', '/content/profile/identity.yaml']) {
      expect((await request.get(path)).status(), path).toBe(404);
    }
  });

  test('discovery files exist and no iframes are used', async ({ request, page }) => {
    for (const path of ['/robots.txt', '/sitemap-index.xml', '/.well-known/security.txt']) {
      expect((await request.get(path)).status(), path).toBe(200);
    }
    const sec = await (await request.get('/.well-known/security.txt')).text();
    expect(sec).toMatch(/^Contact: mailto:/m);
    const expires = sec.match(/^Expires: (\S+)/m)![1];
    expect(new Date(expires).getTime() - Date.now()).toBeGreaterThan(30 * 86400000);
    for (const path of ['/', '/climb/', '/work/']) {
      await page.goto(path);
      expect(await page.locator('iframe').count(), path).toBe(0);
      expect(await page.locator('[onclick], [onload], [onerror]').count(), path).toBe(0);
    }
  });

  test('external links open safely', async ({ page }) => {
    await page.goto('/');
    const bad = await page.locator('a[href^="http"]').evaluateAll((as) => as.filter((a) => !/noopener/.test(a.getAttribute('rel') ?? '')).map((a) => (a as HTMLAnchorElement).href));
    expect(bad).toEqual([]);
  });
});
