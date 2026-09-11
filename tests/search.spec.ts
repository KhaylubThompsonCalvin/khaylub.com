import { test, expect } from '@playwright/test';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, sep } from 'node:path';
import matter from 'gray-matter';

type Front = { title: string; slug: string; status: string };
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
const published = () => artifacts().filter((a) => a.status === 'published');

async function search(page: import('@playwright/test').Page, q: string) {
  const input = page.getByRole('searchbox', { name: 'Search the library' });
  await input.fill('');
  await input.fill(q);
  await expect(page.locator('#search-status')).toContainText(`for ${q}`, { timeout: 10_000 });
  return page.locator('#search-results li');
}

test.describe('search', () => {
  test('the Pagefind index is built into dist', () => {
    expect(existsSync('dist/pagefind/pagefind-entry.json')).toBe(true);
  });

  test('every published artifact title is found and links to its page', async ({ page }) => {
    await page.goto('/search/');
    for (const a of published()) {
      const results = await search(page, a.title);
      const hrefs = await results.locator('a').evaluateAll((as) => as.map((x) => x.getAttribute('href')));
      expect(hrefs, a.title).toContain(`/${a.collection}/${a.slug}/`);
    }
  });

  test('drafts and non-artifact pages are not in the index', async ({ page }) => {
    await page.goto('/search/');
    const draft = await search(page, 'Wanderer pipeline');
    const hrefs = await draft.locator('a').evaluateAll((as) => as.map((x) => x.getAttribute('href')));
    expect(hrefs, 'the draft note is excluded').not.toContain('/notes/wanderer-pipeline/');
    const nothing = await search(page, 'zzqx');
    expect(await nothing.count()).toBe(0);
    await expect(page.locator('#search-status')).toContainText('0 results');
  });

  test('the index holds exactly the published artifact pages', () => {
    const entry = JSON.parse(readFileSync('dist/pagefind/pagefind-entry.json', 'utf8')) as { languages: Record<string, { page_count: number }> };
    const pages = Object.values(entry.languages).reduce((n, l) => n + l.page_count, 0);
    expect(pages).toBe(published().length);
  });

  test('the search code loads only after input, stays same-origin, and announces the count', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (r) => requests.push(r.url()));
    await page.goto('/search/');
    await page.waitForLoadState('networkidle');
    expect(requests.filter((u) => /pagefind/.test(u)), 'no index bytes before input').toEqual([]);
    const status = page.locator('#search-status');
    await expect(status).toHaveAttribute('aria-live', 'polite');
    await search(page, 'regression');
    expect(requests.some((u) => /\/pagefind\/pagefind\.js/.test(u))).toBe(true);
    expect(requests.filter((u) => !u.startsWith('http://localhost:'))).toEqual([]);
    await expect(status).toContainText(/\d+ results? for regression/);
    const first = page.locator('#search-results li').first();
    await expect(first.locator('.badge')).toHaveText(/^(Projects|Data|Field Notes)$/);
    await expect(first.locator('.result-head .small')).toHaveText(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('a shared /search/?q= link runs the query on load', async ({ page }) => {
    await page.goto('/search/?q=regression');
    await expect(page.getByRole('searchbox', { name: 'Search the library' })).toHaveValue('regression');
    await expect(page.locator('#search-status')).toContainText(/\d+ results? for regression/, { timeout: 10_000 });
    expect(await page.locator('#search-results li').count()).toBeGreaterThan(0);
  });

  test('the fallback links remain and the 404 page points to search', async ({ page, request }) => {
    await page.goto('/search/');
    for (const href of ['/projects/', '/tags/python/', '/timeline/']) await expect(page.locator(`main a[href="${href}"]`).first()).toBeVisible();
    const res = await request.get('/404-does-not-exist/');
    expect(res.status()).toBe(404);
    expect(await res.text()).toMatch(/href="\/search\/"/);
  });
});
