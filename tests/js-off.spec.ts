import { test, expect } from '@playwright/test';

test.use({ javaScriptEnabled: false });

for (const [path, heading] of [
  ['/', 'Khaylub Thompson-Calvin'],
  ['/work/', 'Work'],
  ['/about/', 'About'],
  ['/now/', 'Now'],
  ['/resume/', 'Résumé'],
  ['/contact/', 'Contact'],
  ['/projects/', 'Projects'],
  ['/data/', 'Data'],
  ['/notes/', 'Field Notes'],
  ['/library/', 'Library'],
  ['/search/', 'Search'],
  ['/graph/', 'Graph'],
] as const) {
  test(`${path} is readable with JavaScript disabled`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(heading);
    expect(await page.locator('main').innerText()).not.toBe('');
    expect(await page.getByRole('navigation', { name: 'Primary' }).locator('a:visible').count()).toBe(9);
    // Below 1024 px the disclosure needs the script; without it a noscript list of the same nine
    // links is the visible navigation (the hidden disclosure list does not count).
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.getByRole('navigation', { name: 'Primary' }).locator('a:visible').count()).toBe(9);
    await expect(page.getByRole('navigation', { name: 'Primary' }).locator('.nav-list-static a').first()).toBeVisible();
  });
}
