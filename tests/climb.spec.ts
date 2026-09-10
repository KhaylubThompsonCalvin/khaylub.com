import { test, expect } from '@playwright/test';

const CLIMB_ASSETS = /climb-mount|react|\.glb|\.mp4|\.wasm/i;

test.describe('the climb is opt-in', () => {
  for (const path of ['/', '/climb/']) {
    test(`zero climb bytes before the click on ${path}, island after, skip returns focus`, async ({ page }) => {
      const requests: string[] = [];
      const warnings: string[] = [];
      page.on('request', (r) => requests.push(r.url()));
      page.on('console', (m) => {
        if (m.type() === 'warning' || m.type() === 'error') warnings.push(m.text());
      });
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const before = requests.filter((u) => CLIMB_ASSETS.test(u));
      expect(before, 'climb assets requested before the click').toEqual([]);

      const door = page.getByRole('button', { name: path === '/' ? 'Enter the climb' : 'Tap to explore' });
      await door.click();
      await expect(page.getByRole('heading', { name: /The climb \(island placeholder\)/ })).toBeVisible();
      const after = requests.filter((u) => /climb-mount/.test(u));
      expect(after.length, 'the island chunk loads after the click').toBeGreaterThan(0);

      await page.getByRole('button', { name: 'Skip the climb' }).click();
      await expect(page.getByRole('heading', { name: /island placeholder/ })).toHaveCount(0);
      await expect(door).toBeFocused();
      expect(warnings.filter((w) => /aria-hidden/.test(w))).toEqual([]);
    });
  }

  test('/climb/ ends with the Work and Library doors and a link to the frozen original', async ({ page }) => {
    await page.goto('/climb/');
    await expect(page.getByRole('link', { name: 'VIEW MY WORK' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'ENTER THE LIBRARY' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'v1.khaylub.com' })).toHaveAttribute('rel', /noopener/);
  });
});
