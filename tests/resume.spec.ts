import { test, expect } from '@playwright/test';

test.describe('résumé', () => {
  test('the PDF is served at the unchanged path', async ({ request }) => {
    const res = await request.get('/resume/Khaylub-Thompson-Calvin-Resume.pdf');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toBe('application/pdf');
    expect((await res.body()).length).toBe(70765);
  });

  test('the HTML résumé carries the same sections and links to the PDF', async ({ page }) => {
    await page.goto('/resume/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Résumé');
    const text = await page.locator('main').innerText();
    for (const probe of ['Summary', 'Core strengths', 'Technical skills', 'Experience', 'Projects', 'Education', 'Certifications and training', 'Planar Systems', 'Fuel Economy Regression Case Study']) {
      expect(text, probe).toContain(probe);
    }
    await expect(page.getByRole('link', { name: 'Download the PDF' })).toHaveAttribute('href', '/resume/Khaylub-Thompson-Calvin-Resume.pdf');
    expect(text).not.toMatch(/\(\d{3}\) \d{3}-\d{4}/);
  });
});
