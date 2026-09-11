import { test, expect } from '@playwright/test';
import { builtRoutes } from './helpers';

const AVAILABILITY = 'Available now for IT support roles, with cybersecurity as the long-term goal.';

test.describe('content rules', () => {
  test('one availability statement on Home, Work, Résumé, Contact', async ({ page }) => {
    for (const path of ['/', '/work/', '/resume/', '/contact/']) {
      await page.goto(path);
      const text = await page.locator('main').innerText();
      const count = text.split(AVAILABILITY).length - 1;
      expect(count, path).toBe(1);
      expect(text).not.toMatch(/internship/i);
    }
  });

  test('exactly the approved three featured projects on Work, in order', async ({ page }) => {
    await page.goto('/work/');
    const titles = await page.locator('#featured-heading + ul h3 a').allInnerTexts();
    expect(titles).toEqual(['Khaylub.com V1, the climb', 'Fuel Economy Regression Case Study', 'SQL to Python Analytics Pipeline']);
  });

  test('Manors.ai is Private beta and not featured; the draft note is not built', async ({ page, request }) => {
    await page.goto('/projects/manors-ai/');
    await expect(page.locator('.badge').first()).toHaveText('Private beta');
    await page.goto('/work/');
    expect(await page.locator('#featured-heading + ul').innerText()).not.toMatch(/Manors/);
    expect((await request.get('/notes/wanderer-pipeline/')).status()).toBe(404);
  });

  test('no em dashes and no banned private terms in any rendered page', async ({ request }) => {
    const banned = /Summit 40|Project Summit|SNAP|Learning_Tracker|Financial_Dashboard|OS State Ledger|ALEKS|MTH ?65|Knowledge Base|OneDrive/i;
    for (const route of builtRoutes()) {
      const html = await (await request.get(route)).text();
      expect(html.includes('—'), `em dash on ${route}`).toBe(false);
      expect(banned.test(html), `banned term on ${route}`).toBe(false);
    }
  });

  test('skills on Work never include AI', async ({ page }) => {
    await page.goto('/work/');
    const labels = await page.locator('[data-evidence="skills"] .term-label').allInnerTexts();
    expect(labels.length).toBeGreaterThan(3);
    expect(labels.some((l) => /\bAI\b|artificial intelligence|prompt/i.test(l))).toBe(false);
  });
});
