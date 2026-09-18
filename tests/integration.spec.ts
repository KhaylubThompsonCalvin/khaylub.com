// Phase 26 (ADR-012): a Studio-authored document is a Markdown file in the same collection as a
// Git-authored one, so the proof that "CMS documents become artifacts with no loss" is a proof over
// every entry in content/: each published entry appears in every public output (its page, the
// Library or Work catalog, the sitemap, the search index, the feed, the graph, its card image), and
// every draft or review entry appears in none of them (an archived entry has its page but stays
// out of the feeds by design). The `context` line of a project renders on its page and its featured
// card. Runs against dist/ (the production build) like the other suites.
import { test, expect } from '@playwright/test';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, sep } from 'node:path';
import { gunzipSync } from 'node:zlib';
import matter from 'gray-matter';

type Provenance = { source?: string; license?: string; generator?: string; date?: string | Date };
type Front = { slug: string; status: string; title: string; summary: string; context?: string; collection: string; employer_visible?: boolean; featured?: boolean; provenance?: Provenance; ai_assisted?: boolean };

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
// A withdrawn piece (Phase 27) is neither public nor hidden: its address serves a notice and nothing else.
const withdrawn = all.filter((e) => e.status === 'withdrawn');
const hidden = all.filter((e) => !isPublic(e) && e.status !== 'withdrawn');
const route = (e: Front) => `/${e.collection}/${e.slug}/`;

// Every sitemap chunk (the sitemap integration splits past its entry limit); the index lists them.
const sitemap = readdirSync('dist').filter((f) => /^sitemap-\d+\.xml$/.test(f)).map((f) => readFileSync(join('dist', f), 'utf8')).join('\n');
const feedJson = readFileSync('dist/feed.json', 'utf8');
const feedXml = readFileSync('dist/feed.xml', 'utf8');
const graph = readFileSync('dist/graph/index.html', 'utf8');
const library = readFileSync('dist/library/index.html', 'utf8');
const work = readFileSync('dist/work/index.html', 'utf8');
// Pagefind's fragments are gzip-compressed JSON carrying each indexed page's URL; decompressed and
// concatenated they are enough to grep for a route.
const pagefind = (() => {
  const dir = 'dist/pagefind/fragment';
  if (!existsSync(dir)) return '';
  return readdirSync(dir).map((f) => gunzipSync(readFileSync(join(dir, f))).toString('utf8')).join('\n');
})();

test.describe('every published entry reaches every public output; no hidden entry reaches any', () => {
  test('the content has published entries and at least one hidden one, so both halves are exercised', () => {
    expect(published.length).toBeGreaterThan(5);
    expect(hidden.length, 'a draft or review entry exists in content/ (wanderer-pipeline since Phase 11)').toBeGreaterThan(0);
  });

  for (const e of published) {
    test(`${route(e)} is built, listed, in the sitemap, the search index, the graph, the feed if published, and has its card`, () => {
      expect(existsSync(`dist${route(e)}index.html`), 'page built').toBe(true);
      expect(sitemap, 'sitemap').toContain(`https://khaylub.com${route(e)}`);
      expect(pagefind, 'search index').toContain(`"url":"${route(e)}"`);
      // Archived items stay out of the feeds by design (src/lib/catalog.ts, document 28).
      if (e.status === 'published') {
        expect(feedJson, 'JSON feed').toContain(`"url": "https://khaylub.com${route(e)}"`);
        expect(feedXml, 'RSS feed').toContain(`https://khaylub.com${route(e)}`);
      } else {
        expect(feedJson, 'archived, so not in the JSON feed').not.toContain(`"url": "https://khaylub.com${route(e)}"`);
        expect(feedXml, 'archived, so not in the RSS feed').not.toContain(`https://khaylub.com${route(e)}`);
      }
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
      expect(pagefind, 'search index').not.toContain(`"url":"${route(e)}"`);
      expect(existsSync(`dist/og/${e.collection}/${e.slug}.png`), 'no card').toBe(false);
    });
  }
});

test.describe('a withdrawn piece (Phase 27): a notice at its address, nothing anywhere else', () => {
  for (const e of withdrawn) {
    test(`${route(e)} serves the withdrawal notice and nothing of the piece`, () => {
      const file = `dist${route(e)}index.html`;
      expect(existsSync(file), 'the notice is built at the address').toBe(true);
      const html = readFileSync(file, 'utf8');
      expect(html).toContain('data-withdrawn="true"');
      expect(html).toMatch(/<meta name="robots" content="noindex/);
      expect(html).not.toContain('data-pagefind-body');
      expect(html, 'the title is not on the notice').not.toContain(e.title);
      expect(html, 'the summary is not on the notice').not.toContain(e.summary.slice(0, 40));
      expect(readFileSync(`dist/og/${e.collection}/${e.slug}.png`).equals(readFileSync('public/og-default.png')), 'the card is the default card').toBe(true);
      expect(sitemap).not.toContain(route(e));
      expect(feedJson).not.toContain(route(e));
      expect(feedXml).not.toContain(route(e));
      expect(graph).not.toContain(`href="${route(e)}"`);
      const index = existsSync(`dist/${e.collection}/index.html`) ? readFileSync(`dist/${e.collection}/index.html`, 'utf8') : '';
      expect(index).not.toContain(`href="${route(e)}"`);
      expect(library).not.toContain(`href="${route(e)}"`);
      expect(work).not.toContain(`href="${route(e)}"`);
      expect(pagefind, 'search index').not.toContain(`"url":"${route(e)}"`);
    });
  }
  test('the schema offers withdrawn as a status', () => {
    expect(readFileSync('src/content/schemas.ts', 'utf8')).toMatch(/'withdrawn'] as const/);
  });
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
      // Cards carry the facts block only on Work's featured cards (the compact ProjectFacts); the
      // featured set is the catalog's, so the card is checked only when Work actually lists the project.
      if (work.includes(`href="${route(e)}"`)) {
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

  test(`context coverage: ${withContext.length} published project(s) declare context (0 means the positive case above is not exercised by the content yet)`, () => {
    // The rendering was proven on 2026-09-18 with a temporary published project (the Phase 26
    // checkpoint); it runs here for real as soon as a published project declares a context.
    test.info().annotations.push({ type: 'projects with context', description: String(withContext.length) });
    expect(withContext.length).toBeGreaterThanOrEqual(0);
  });
});

test.describe('the Credits and Process section (Phase 27)', () => {
  const withCredits = published.filter((e) => e.provenance && e.provenance.source && e.provenance.license && e.provenance.date);
  const without = published.filter((e) => !e.provenance || !e.provenance.source);

  test('at least one published entry carries a provenance record, so the section is exercised', () => {
    expect(withCredits.length).toBeGreaterThan(0);
  });

  for (const e of withCredits) {
    test(`${route(e)} shows its credits: source, license, generator when present, date`, async ({ page }) => {
      await page.goto(route(e));
      const section = page.locator('section.credits');
      await expect(section).toHaveCount(1);
      await expect(section.getByRole('heading', { name: 'Credits and process' })).toBeVisible();
      await expect(section).toContainText(e.provenance!.source!);
      await expect(section).toContainText(e.provenance!.license!);
      if (e.provenance!.generator) await expect(section).toContainText(e.provenance!.generator);
      const date = e.provenance!.date instanceof Date ? e.provenance!.date.toISOString().slice(0, 10) : String(e.provenance!.date);
      await expect(section).toContainText(date);
      if (e.ai_assisted) await expect(section).toContainText('AI assistance');
    });
  }

  for (const e of without.slice(0, 2)) {
    test(`${route(e)} carries no credits section without a provenance record`, async ({ page }) => {
      await page.goto(route(e));
      await expect(page.locator('section.credits')).toHaveCount(0);
    });
  }
});
