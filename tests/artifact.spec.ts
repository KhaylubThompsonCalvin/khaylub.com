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

  test('a long artifact carries a contents nav that mirrors its body headings; a short one does not', async ({ page }) => {
    await page.goto('/projects/khaylub-com-v1/');
    const toc = page.getByRole('navigation', { name: 'Contents' });
    await expect(toc).toBeVisible();
    const tocText = await toc.locator('a').allInnerTexts();
    const bodyH2 = await page.locator('.body h2').allInnerTexts();
    expect(tocText).toEqual(bodyH2);
    for (const href of await toc.locator('a').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''))) {
      expect(href).toMatch(/^#/);
      await expect(page.locator(`[id="${href.slice(1)}"]`)).toHaveCount(1);
    }
    await page.goto('/notes/the-16-mb-front-door/');
    await expect(page.getByRole('navigation', { name: 'Contents' })).toHaveCount(0);
  });

  test('a data page names its question, dataset, result, and repository', async ({ page }) => {
    await page.goto('/data/fuel-economy-regression/');
    const text = await page.locator('main').innerText();
    for (const probe of ['Question', 'Auto MPG', 'Result', '79 percent']) expect(text).toContain(probe);
    await expect(page.locator('.proof').getByRole('link', { name: 'Repository' })).toHaveAttribute('href', /fuel-economy-analysis$/);
    // The facts list carries the result on its own page; the header must not repeat it as an outcome line.
    await expect(page.locator('.artifact-header .outcome')).toHaveCount(0);
    await expect(page.locator('.artifact-header .facts dd').filter({ hasText: '79 percent' })).toHaveCount(1);
  });
});
