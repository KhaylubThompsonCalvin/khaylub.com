import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, sep } from 'node:path';
import matter from 'gray-matter';
import { load } from 'js-yaml';

type Front = { slug: string; status: string; employer_visible: boolean; skills?: string[]; technologies?: string[]; title: string };

/** Every artifact frontmatter under content/ (the same files the build reads; profile/ is not an artifact folder). */
function artifacts(): Front[] {
  const out: Front[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (extname(p) === '.md' && !p.split(sep).includes('profile')) out.push(matter(readFileSync(p, 'utf8')).data as Front);
    }
  };
  walk('content');
  return out;
}

/** Expected evidence counts by label, computed independently of the site code. */
function expectedCounts(kind: 'skills' | 'technologies'): Map<string, number> {
  const vocab = (load(readFileSync(`content/vocabulary/${kind}.yaml`, 'utf8')) as { terms: { slug: string; label: string }[] }).terms;
  const labels = new Map(vocab.map((t) => [t.slug, t.label]));
  const counts = new Map<string, number>();
  for (const a of artifacts()) {
    if (a.status !== 'published' || !a.employer_visible) continue;
    for (const s of a[kind] ?? []) {
      const label = labels.get(s) ?? s;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  return counts;
}

test.describe('work', () => {
  for (const kind of ['skills', 'technologies'] as const) {
    test(`${kind} evidence counts equal the catalog and every supporting item is linked`, async ({ page }) => {
      await page.goto('/work/');
      const rows = page.locator(`[data-evidence="${kind}"] li[data-term]`);
      const rendered = new Map<string, number>();
      for (const row of await rows.all()) {
        const label = (await row.locator('.term-label').innerText()).trim();
        const count = Number(await row.getAttribute('data-count'));
        const links = await row.locator('.term-items a').count();
        expect(links, `${label} lists every supporting artifact`).toBe(count);
        rendered.set(label, count);
      }
      const expected = expectedCounts(kind);
      expect([...rendered.entries()].sort()).toEqual([...expected.entries()].sort());
      for (const [, n] of rendered) expect(n).toBeGreaterThan(0);
    });
  }

  test('skills are grouped by area with anchored rows and a correctly labelled section', async ({ page }) => {
    await page.goto('/work/');
    const groups = page.locator('#skills h3');
    expect(await groups.count()).toBeGreaterThanOrEqual(2);
    for (const name of await groups.allInnerTexts()) expect(['Data', 'Web', 'Practice', 'Hardware', 'Other']).toContain(name.trim());
    await expect(page.locator('#skill-data-analysis .term-label')).toHaveText('Data analysis');
    await expect(page.locator('section#skills')).toHaveAttribute('aria-labelledby', 'skills-heading');
  });

  test('featured cards carry outcome, technologies, and proof links from frontmatter', async ({ page }) => {
    await page.goto('/work/');
    const cards = page.locator('#featured-heading + ul > li');
    await expect(cards).toHaveCount(3);
    const first = cards.first();
    await expect(first.locator('.outcome')).toContainText('Launched 2026-06-24');
    await expect(first.locator('.tech')).toContainText('React Three Fiber');
    await expect(first.getByRole('link', { name: 'Code' })).toHaveAttribute('href', 'https://github.com/KhaylubThompsonCalvin/khaylub-portfolio');
    await expect(first.getByRole('link', { name: 'Live' })).toHaveAttribute('href', '/climb/');
    const second = cards.nth(1);
    await expect(second.locator('.outcome')).toContainText('79 percent');
    await expect(second.getByRole('link', { name: 'Repository' })).toHaveAttribute('href', /fuel-economy-analysis$/);
  });

  test('education and the PDF link come from profile data', async ({ page }) => {
    await page.goto('/work/');
    await expect(page.locator('#education-heading + dl dt').first()).toHaveText('Computer Information Systems, Portland Community College');
    await expect(page.locator('#education-heading + dl dd').first()).toContainText('December 2023 to present');
    await expect(page.getByRole('link', { name: 'Download the PDF' })).toHaveAttribute('href', '/resume/Khaylub-Thompson-Calvin-Resume.pdf');
  });
});
