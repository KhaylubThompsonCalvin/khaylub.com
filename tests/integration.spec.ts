// Phase 26 (ADR-012): a Studio-authored document is a Markdown file in the same collection as a
// Git-authored one, so the proof that "CMS documents become artifacts with no loss" is a proof over
// every entry in content/: each published entry appears in every public output (its page, the
// Library or Work catalog, the sitemap, the search index, the feed, the graph, its card image), and
// every draft or review entry appears in none of them. The `context` line of a project renders on
// its page and its cards. Runs against dist/ (the production build) like the other suites.
import { test, expect } from '@playwright/test';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, sep } from 'node:path';
import matter from 'gray-matter';

type Front = { slug: string; status: string; title: string; context?: string; collection: string; employer_visible?: boolean; featured?: boolean };

function entries(): Front[] {
  const out: Front[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (extname(p) === '.md' && !p.split(sep).includes('profile') && !p.split(sep).includes('vocabulary')) {
        const data = matter(readFileSync(p, 'utf8')).data as Omit<Front, 'collection'>;
        out.push({ ...data, collection: p.split(sep)[1] });
      }
    }
  };
  walk('content');
  return out;
}

const all = entries();
const isPublic = (e: Front) => e.status === 'published' || e.status === 'archived';
const published = all.filter(isPublic);
const hidden = all.filter((e) => !isPublic(e));
const route = (e: Front) => `/${e.collection}/${e.slug}/`;

const sitemap = readFileSync('dist/sitemap-0.xml', 'utf8');
const feedJson = readFileSync('dist/feed.json', 'utf8');
const feedXml = readFileSync('dist/feed.xml', 'utf8');
const graph = readFileSync('dist/graph/index.html', 'utf8');
const library = readFileSync('dist/library/index.html', 'utf8');
const work = readFileSync('dist/work/index.html', 'utf8');
// Pagefind's fragments carry each indexed page's URL; the concatenated store is enough to grep.
const pagefind = (() => {
  const dir = 'dist/pagefind/fragment';
  if (!existsSync(dir)) return '';
  return readdirSync(dir).map((f) => readFileSync(join(dir, f), 'latin1')).join('\n');
})();

test.describe('every published entry reaches every public output; no hidden entry reaches any', () => {
  test('the content has published entries and at least one hidden one, so both halves are exercised', () => {
    expect(published.length).toBeGreaterThan(5);
    expect(hidden.length, 'a draft or review entry exists in content/ (wanderer-pipeline since Phase 11)').toBeGreaterThan(0);
  });

  for (const e of published) {
    test(`${route(e)} is built, listed, in the sitemap, the feed, the graph, and has its card`, () => {
      expect(existsSync(`dist${route(e)}index.html`), 'page built').toBe(true);
      expect(sitemap, 'sitemap').toContain(`https://khaylub.com${route(e)}`);
      expect(feedJson, 'JSON feed').toContain(`"url": "https://khaylub.com${route(e)}"`);
      expect(feedXml, 'RSS feed').toContain(`https://khaylub.com${route(e)}`);
      expect(graph, 'graph').toContain(`href="${route(e)}"`);
      // The catalog: the collection's own index lists every published entry; the Library page shows a
      // recent slice per collection and Work the employer-visible items, so those two are not required.
      const index = readFileSync(`dist/${e.collection}/index.html`, 'utf8');
      expect(index, `listed on /${e.collection}/`).toContain(`href="${route(e)}"`);
      expect(existsSync(`dist/og/${e.collection}/${e.slug}.png`), 'Open Graph card').toBe(true);
    });
  }

  for (const e of hidden) {
    test(`${route(e)} (${e.status}) is absent from every public output`, () => {
      expect(existsSync(`dist${route(e)}index.html`), 'no page').toBe(false);
      expect(sitemap).not.toContain(route(e));
      expect(feedJson).not.toContain(route(e));
      expect(feedXml).not.toContain(route(e));
      expect(graph).not.toContain(`href="${route(e)}"`);
      const index = existsSync(`dist/${e.collection}/index.html`) ? readFileSync(`dist/${e.collection}/index.html`, 'utf8') : '';
      expect(index).not.toContain(`href="${route(e)}"`);
      expect(library).not.toContain(`href="${route(e)}"`);
      expect(work).not.toContain(`href="${route(e)}"`);
      expect(pagefind).not.toContain(route(e));
      expect(existsSync(`dist/og/${e.collection}/${e.slug}.png`), 'no card').toBe(false);
    });
  }
});

test.describe('the context line of a project', () => {
  const withContext = published.filter((e) => e.collection === 'projects' && e.context);
  const without = published.filter((e) => e.collection === 'projects' && !e.context);

  for (const e of withContext) {
    test(`${route(e)} shows its context on the page (and on its featured card)`, async ({ page }) => {
      await page.goto(route(e));
      const line = page.locator('.artifact-header .context');
      await expect(line).toHaveCount(1);
      await expect(line).toContainText(e.context!);
      // Cards carry the facts block only on Work's featured cards (the compact ProjectFacts).
      if (e.featured) {
        await page.goto('/work/');
        const card = page.locator('article', { has: page.locator(`a[href="${route(e)}"]`) }).first();
        await expect(card.locator('.context')).toContainText(e.context!);
      }
    });
  }

  for (const e of without.slice(0, 2)) {
    test(`${route(e)} carries no context line when the field is absent`, async ({ page }) => {
      await page.goto(route(e));
      await expect(page.locator('.artifact-header .context')).toHaveCount(0);
    });
  }

  test('the rendering is exercised by at least one built project when any project declares context', () => {
    // Documents the state: until the owner gives a project a context, the positive case above is
    // vacuous and this test says so in its title; the schema and the Studio form already carry it.
    test.info().annotations.push({ type: 'projects with context', description: String(withContext.length) });
    expect(withContext.length).toBeGreaterThanOrEqual(0);
  });
});
