import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';

const now = load(readFileSync('content/profile/now.yaml', 'utf8')) as { lines: string[] };
const identity = load(readFileSync('content/profile/identity.yaml', 'utf8')) as { email: string; github: string; linkedin: string; response_time: string };
const education = load(readFileSync('content/profile/education.yaml', 'utf8')) as { entries: { institution: string; program: string }[] };
const certs = load(readFileSync('content/profile/certifications.yaml', 'utf8')) as { items: { name: string }[] };

test.describe('profile pages', () => {
  test('About renders education and certifications from profile data', async ({ page }) => {
    await page.goto('/about/');
    const text = await page.locator('main').innerText();
    for (const e of education.entries) expect(text).toContain(`${e.program}, ${e.institution}`);
    for (const c of certs.items) expect(text).toContain(c.name);
    expect(text).not.toMatch(/GPA|grade/i);
  });

  test('Now and About render the same dated lines from now.yaml', async ({ page }) => {
    for (const path of ['/now/', '/about/']) {
      await page.goto(path);
      const lines = await page.locator('ul.now-lines li').allInnerTexts();
      expect(lines.map((l) => l.trim()), path).toEqual(now.lines);
      await expect(page.locator('.as-of').first()).toContainText('as of');
    }
  });

  test('Contact shows email as text, GitHub, LinkedIn, and the response time', async ({ page }) => {
    await page.goto('/contact/');
    await expect(page.getByRole('link', { name: identity.email })).toHaveAttribute('href', `mailto:${identity.email}`);
    await expect(page.getByRole('main').getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', identity.github);
    await expect(page.getByRole('main').getByRole('link', { name: 'LinkedIn' })).toHaveAttribute('href', identity.linkedin);
    expect(identity.response_time.length, 'response_time is set in identity.yaml').toBeGreaterThan(0);
    await expect(page.locator('main')).toContainText(identity.response_time);
  });
});
