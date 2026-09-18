import { test, expect } from '@playwright/test';

const REQUIRED: Record<string, RegExp> = {
  'strict-transport-security': /max-age=31536000; includesubdomains/i,
  'x-content-type-options': /nosniff/i,
  'referrer-policy': /strict-origin-when-cross-origin/i,
  'permissions-policy': /camera=\(\).*microphone=\(\).*geolocation=\(\)/i,
  'x-frame-options': /deny/i,
  'cross-origin-opener-policy': /same-origin/i,
  'content-security-policy-report-only': /default-src 'self'.*frame-ancestors 'none'/i,
};

test.describe('headers from render.yaml', () => {
  for (const path of ['/', '/work/', '/projects/khaylub-com-v1/', '/notes/preserving-v1/', '/climb/', '/search/']) {
    test(`security headers on ${path}`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status()).toBe(200);
      const h = res.headers();
      for (const [name, re] of Object.entries(REQUIRED)) expect(h[name], name).toMatch(re);
      expect(h['content-security-policy-report-only']).not.toMatch(/unsafe-inline|(?<!wasm-)unsafe-eval/);
      if (path === '/' || path === '/climb/') expect(h['content-security-policy-report-only']).toMatch(/blob:.*wasm-unsafe-eval|wasm-unsafe-eval.*blob:/s);
      else if (path === '/search/') {
        // Pagefind decodes its index with WebAssembly; no blob: URLs are needed here.
        expect(h['content-security-policy-report-only']).toMatch(/wasm-unsafe-eval/);
        expect(h['content-security-policy-report-only']).not.toMatch(/blob:/);
      } else expect(h['content-security-policy-report-only']).not.toMatch(/blob:|wasm-unsafe-eval/);
    });
  }

  test('cache tiers by path class', async ({ page, request }) => {
    await page.goto('/');
    const css = await page.locator('link[rel="stylesheet"]').first().getAttribute('href');
    expect((await request.get(css!)).headers()['cache-control']).toMatch(/max-age=31536000, immutable/);
    expect((await request.get('/')).headers()['cache-control']).toBe('no-cache');
    expect((await request.get('/work/')).headers()['cache-control']).toBe('no-cache');
    expect((await request.get('/notes/preserving-v1/')).headers()['cache-control']).toBe('no-cache');
    // Self-hosted media under /media/: one week (budget line 22), the tier Lighthouse's cache audit sees.
    expect((await request.get('/media/fuel-economy-regression/residuals.webp')).headers()['cache-control']).toMatch(/max-age=604800/);
    expect((await request.get('/resume/Khaylub-Thompson-Calvin-Resume.pdf')).headers()['cache-control']).toMatch(/max-age=86400/);
    expect((await request.get('/robots.txt')).headers()['cache-control']).toMatch(/max-age=3600/);
    expect((await request.get('/og-default.png')).headers()['cache-control']).toMatch(/max-age=604800/);
    // The climb's models and plates are media: one week, like every other media file.
    expect((await request.get('/climb/wanderer-web.glb')).headers()['cache-control']).toMatch(/max-age=604800/);
    expect((await request.get('/climb/dawn-grass.mp4')).headers()['cache-control']).toMatch(/max-age=604800/);
    // The climb page itself is HTML, not media.
    expect((await request.get('/climb/')).headers()['cache-control']).toBe('no-cache');
    // The generated Open Graph cards live three levels deep, where a top-level /*.png rule never reaches.
    expect((await request.get('/og/projects/khaylub-com-v1.png')).headers()['cache-control']).toMatch(/max-age=604800/);
    expect((await request.get('/sitemap-index.xml')).headers()['cache-control']).toMatch(/max-age=3600/);
    expect((await request.get('/.well-known/security.txt')).headers()['cache-control']).toMatch(/max-age=3600/);
    // The build stamp is polled by the publishing harness until it shows the new commit: never cached.
    expect((await request.get('/build.json')).headers()['cache-control']).toBe('no-cache');
  });
});
