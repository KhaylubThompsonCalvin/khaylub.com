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
  for (const path of ['/', '/work/', '/projects/khaylub-com-v1/', '/notes/preserving-v1/', '/climb/']) {
    test(`security headers on ${path}`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status()).toBe(200);
      const h = res.headers();
      for (const [name, re] of Object.entries(REQUIRED)) expect(h[name], name).toMatch(re);
      expect(h['content-security-policy-report-only']).not.toMatch(/unsafe-inline|(?<!wasm-)unsafe-eval/);
      if (path === '/' || path === '/climb/') expect(h['content-security-policy-report-only']).toMatch(/blob:.*wasm-unsafe-eval|wasm-unsafe-eval.*blob:/s);
      else expect(h['content-security-policy-report-only']).not.toMatch(/blob:|wasm-unsafe-eval/);
    });
  }

  test('cache tiers by path class', async ({ page, request }) => {
    await page.goto('/');
    const css = await page.locator('link[rel="stylesheet"]').first().getAttribute('href');
    expect((await request.get(css!)).headers()['cache-control']).toMatch(/max-age=31536000, immutable/);
    expect((await request.get('/')).headers()['cache-control']).toBe('no-cache');
    expect((await request.get('/work/')).headers()['cache-control']).toBe('no-cache');
    expect((await request.get('/resume/Khaylub-Thompson-Calvin-Resume.pdf')).headers()['cache-control']).toMatch(/max-age=86400/);
    expect((await request.get('/robots.txt')).headers()['cache-control']).toMatch(/max-age=3600/);
    expect((await request.get('/og-default.png')).headers()['cache-control']).toMatch(/max-age=604800/);
  });
});
