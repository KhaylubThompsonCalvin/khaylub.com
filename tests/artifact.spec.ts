import { test, expect } from '@playwright/test';

test.describe('artifact pages', () => {
  test('technology, skill, and tag labels come from the vocabulary and link to evidence', async ({ page }) => {
    await page.goto('/projects/khaylub-com-v1/');
    const text = await page.locator('main').innerText();
    expect(text).toContain('React Three Fiber');
    expect(text).not.toContain('react-three-fiber');
    await expect(page.locator('.skills-shown').getByRole('link', { name: 'Web development' })).toHaveAttribute('href', '/skills/web-development/');
    await expect(page.locator('.tags').getByRole('link', { name: 'three.js' })).toHaveAttribute('href', '/tags/three-js/');
    expect(text).not.toMatch(/Tags: three-js/);
  });

  test('a data page names its question, dataset, result, and repository', async ({ page }) => {
    await page.goto('/data/fuel-economy-regression/');
    const text = await page.locator('main').innerText();
    for (const probe of ['Question', 'Auto MPG', 'Result', '79 percent']) expect(text).toContain(probe);
    await expect(page.getByRole('link', { name: 'Repository' })).toHaveAttribute('href', /fuel-economy-analysis$/);
    // The facts list carries the result on its own page; the header must not repeat it as an outcome line.
    await expect(page.locator('.artifact-header .outcome')).toHaveCount(0);
    await expect(page.locator('.artifact-header .facts dd').filter({ hasText: '79 percent' })).toHaveCount(1);
  });
});
