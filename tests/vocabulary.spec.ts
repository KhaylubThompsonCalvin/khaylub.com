import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, sep } from 'node:path';
import matter from 'gray-matter';
import { load } from 'js-yaml';

type Front = { title: string; slug: string; status: string; employer_visible: boolean; date: Date; tags: string[]; skills?: string[]; technologies?: string[] };
type Kind = 'tags' | 'skills' | 'technologies';

function artifacts(): (Front & { collection: string })[] {
  const out: (Front & { collection: string })[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (extname(p) === '.md' && !p.split(sep).includes('profile')) out.push({ ...(matter(readFileSync(p, 'utf8')).data as Front), collection: p.split(sep)[1] });
    }
  };
  walk('content');
  return out;
}
const terms = (kind: Kind) => (load(readFileSync(`content/vocabulary/${kind}.yaml`, 'utf8')) as { terms: { slug: string; label: string }[] }).terms;
const route = (kind: Kind, slug: string) => `/${kind}/${slug}/`;

/** Items a term page must list: tags count any visible artifact; skills and technologies count only employer-visible published evidence. */
function itemsFor(kind: Kind, slug: string) {
  return artifacts().filter((a) => {
    const visible = a.status === 'published' || a.status === 'archived';
    if (kind === 'tags') return visible && a.tags.includes(slug);
    return a.status === 'published' && a.employer_visible && (a[kind] ?? []).includes(slug);
  });
}

test.describe('vocabulary pages', () => {
  for (const kind of ['tags', 'skills', 'technologies'] as const) {
    test(`${kind}: a page exists for every used term and none for unused terms`, async ({ request }) => {
      for (const t of terms(kind)) {
        const used = itemsFor(kind, t.slug).length > 0;
        const status = (await request.get(route(kind, t.slug))).status();
        expect(status, `${route(kind, t.slug)} used=${used}`).toBe(used ? 200 : 404);
      }
    });
  }

  test('a skill page lists its evidence grouped by collection with first and latest dates', async ({ page }) => {
    const items = itemsFor('skills', 'data-analysis');
    await page.goto('/skills/data-analysis/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Data analysis');
    const titles = await page.locator('main .card-grid h3 a').allInnerTexts();
    expect(titles.sort()).toEqual(items.map((i) => i.title).sort());
    await expect(page.locator('main')).toContainText(`${items.length} ${items.length === 1 ? 'piece' : 'pieces'} of evidence`);
    const dates = items.map((i) => new Date(i.date).getTime());
    const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
    await expect(page.locator('.term-dates')).toContainText(iso(Math.min(...dates)));
    await expect(page.locator('.term-dates')).toContainText(iso(Math.max(...dates)));
    const groups = await page.locator('main h2.group-heading').allInnerTexts();
    expect(groups.length).toBeGreaterThan(0);
    for (const g of groups) expect(g).toMatch(/\(\d+\)$/);
  });

  test('a technology page lists every public item that uses it', async ({ page }) => {
    const items = itemsFor('technologies', 'python');
    await page.goto('/technologies/python/');
    const titles = await page.locator('main .card-grid h3 a').allInnerTexts();
    expect(titles.sort()).toEqual(items.map((i) => i.title).sort());
  });

  test('a tag page shows related tags that co-occur on its items and nothing else', async ({ page }) => {
    const items = itemsFor('tags', 'python');
    const expected = new Set(items.flatMap((i) => i.tags).filter((t) => t !== 'python'));
    await page.goto('/tags/python/');
    const related = await page.locator('.related-tags a').evaluateAll((as) => as.map((a) => (a.getAttribute('href') ?? '').split('/')[2]));
    expect(new Set(related)).toEqual(expected);
  });

  test('no vocabulary page rates anything', async ({ request }) => {
    for (const path of ['/skills/data-analysis/', '/technologies/python/', '/tags/python/']) {
      const html = await (await request.get(path)).text();
      expect(html).not.toMatch(/\d+\s?%|proficien|★|stars?\b/i);
    }
  });

  test('Work evidence rows and artifact pages link to the term pages', async ({ page }) => {
    await page.goto('/work/');
    await expect(page.locator('#skill-data-analysis .term-label a')).toHaveAttribute('href', '/skills/data-analysis/');
    await expect(page.locator('#technology-python .term-label a')).toHaveAttribute('href', '/technologies/python/');
    await page.goto('/projects/khaylub-com-v1/');
    await expect(page.locator('.skills-shown').getByRole('link', { name: 'Web development' })).toHaveAttribute('href', '/skills/web-development/');
    await expect(page.locator('.tech').getByRole('link', { name: 'Blender' })).toHaveAttribute('href', '/technologies/blender/');
  });
});
