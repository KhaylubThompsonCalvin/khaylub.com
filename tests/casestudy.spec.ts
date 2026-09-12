import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import matter from 'gray-matter';

const STANDARD = ['Problem', 'Why it mattered', 'Requirements', 'Design', 'Technology choices', 'Why these choices', 'What I built', 'What went wrong', 'Verification', 'What I would change', 'What I learned', 'Code', 'Result'];
const DATA_TEMPLATE = ['Question', 'Data', 'SQL and schema', 'Method', 'Result', 'Notebook', 'Repository'];
const FEATURED = ['/projects/khaylub-com-v1/', '/data/fuel-economy-regression/', '/data/sql-python-analytics-pipeline/'];

const front = (file: string) => matter(readFileSync(file, 'utf8')).data as { problem?: string; role?: string };

test.describe('case studies (Phase 12)', () => {
  test('the featured project carries the thirteen standard headings in order, listed in the contents nav', async ({ page }) => {
    await page.goto('/projects/khaylub-com-v1/');
    expect(await page.locator('.body h2').allInnerTexts()).toEqual(STANDARD);
    expect(await page.getByRole('navigation', { name: 'Contents' }).locator('a').allInnerTexts()).toEqual(STANDARD);
  });

  for (const path of ['/data/fuel-economy-regression/', '/data/sql-python-analytics-pipeline/', '/data/tableau-salary-story/']) {
    test(`${path} follows the data template headings in order`, async ({ page }) => {
      await page.goto(path);
      expect((await page.locator('.body h2').allInnerTexts()).slice(0, DATA_TEMPLATE.length)).toEqual(DATA_TEMPLATE);
    });
  }

  test('the SQL page shows its SQL as text, not an image', async ({ page }) => {
    await page.goto('/data/sql-python-analytics-pipeline/');
    await expect(page.locator('.body pre code').filter({ hasText: /SELECT/ })).toHaveCount(1);
  });

  test('the summary card renders problem and role from frontmatter on every featured page, and only when present', async ({ page }) => {
    const files: Record<string, string> = { '/projects/khaylub-com-v1/': 'content/projects/khaylub-com-v1/index.md', '/data/fuel-economy-regression/': 'content/data/fuel-economy-regression/index.md', '/data/sql-python-analytics-pipeline/': 'content/data/sql-python-analytics-pipeline/index.md' };
    for (const [path, file] of Object.entries(files)) {
      const fm = front(file);
      expect(fm.problem && fm.role, `${path} declares problem and role`).toBeTruthy();
      await page.goto(path);
      await expect(page.locator('.artifact-header .problem')).toContainText(fm.problem!);
      await expect(page.locator('.artifact-header .role')).toContainText(fm.role!);
    }
    const note = front('content/notes/preserving-v1.md');
    expect(note.problem).toBeUndefined();
    await page.goto('/notes/preserving-v1/');
    await expect(page.locator('.artifact-header .problem')).toHaveCount(0);
  });

  for (const path of FEATURED) {
    test(`${path} carries a real proof figure with alt text, a caption, and a source line`, async ({ page, request }) => {
      await page.goto(path);
      const fig = page.locator('.body figure').first();
      await expect(fig).toHaveCount(1);
      const img = fig.locator('img');
      expect((await img.getAttribute('alt'))?.trim().length ?? 0).toBeGreaterThan(20);
      expect(await img.getAttribute('width')).toMatch(/^\d+$/);
      expect(await img.getAttribute('height')).toMatch(/^\d+$/);
      expect(await img.getAttribute('loading')).toBe('lazy');
      await expect(fig.locator('figcaption')).toContainText('Source:');
      const src = (await img.getAttribute('src'))!;
      const res = await request.get(src);
      expect(res.status(), src).toBe(200);
      expect((await res.body()).length, `${src} under 160 KB`).toBeLessThan(160 * 1024);
    });
  }

  test('every number-bearing section of the data pages names its source, and no rating language appears', async ({ request }) => {
    for (const path of FEATURED) {
      const html = await (await request.get(path)).text();
      expect(html).not.toMatch(/\d+\s?%\s*proficien|★|\bexpert level\b/i);
      expect(html, `${path} cites the README or notebook`).toMatch(/README|notebook|audit|measured/i);
    }
  });
});
