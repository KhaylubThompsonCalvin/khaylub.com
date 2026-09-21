import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, sep } from 'node:path';
import matter from 'gray-matter';
import AxeBuilder from '@axe-core/playwright';
import { parseWikilinks, scanTargets, resolveWikilink, stripCode } from '../src/lib/wikilinks.mjs';

// Wiki relationships (Phase 14; ADR-006, FR-E1 to FR-E6, P2-CE-08, P2-FE-13, W15): backlinks match
// a grep of content/ on the sampled artifacts, the related rail follows its rules, previous and next
// follow the series or the collection, the graph page lists first and maps behind a disclosure.

type Art = { file: string; collection: string; slug: string; title: string; status: string; date: string; tags: string[]; skills?: string[]; related?: string[]; series?: string; part?: number; body: string };

function artifacts(): Art[] {
  const out: Art[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (extname(p) === '.md' && !p.split(sep).includes('profile')) {
        const { data, content } = matter(readFileSync(p, 'utf8'));
        out.push({ file: p, collection: p.split(sep)[1], body: content, ...(data as Omit<Art, 'file' | 'collection' | 'body'>) });
      }
    }
  };
  walk('content');
  return out;
}
const ALL = artifacts();
const PUBLISHED = ALL.filter((a) => a.status === 'published' || a.status === 'archived');
const route = (a: Art) => `/${a.collection}/${a.slug}/`;
const targets = scanTargets();

/** The grep: every published artifact whose frontmatter `related` or body wikilinks name this slug. */
function expectedBacklinks(slug: string): string[] {
  return PUBLISHED.filter((a) => a.slug !== slug && ((a.related ?? []).includes(slug) || parseWikilinks(stripCode(a.body)).some((l) => resolveWikilink(l.target, targets, false)?.slug === slug)))
    .map(route)
    .sort();
}

// Ten sampled artifacts: the newest ten published (the roadmap asks for ten; fewer exist today).
const SAMPLE = [...PUBLISHED].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);

test.describe('wiki relationships', () => {
  test('wikilinks in bodies render as links to the target with the given words', async ({ page }) => {
    const withLinks = PUBLISHED.filter((a) => parseWikilinks(stripCode(a.body)).length > 0);
    expect(withLinks.length, 'at least one published artifact uses wikilinks').toBeGreaterThan(0);
    for (const a of withLinks.slice(0, 3)) {
      await page.goto(route(a));
      for (const l of parseWikilinks(stripCode(a.body))) {
        const t = resolveWikilink(l.target, targets, false)!;
        expect(t, `${a.slug} links to ${l.target}`).toBeTruthy();
        const link = page.locator(`.body a[href="${t.route}"]`).filter({ hasText: l.text ?? t.title }).first();
        await expect(link, `${a.slug}: [[${l.target}]]`).toHaveCount(1);
      }
      expect(await page.locator('main').innerText()).not.toMatch(/\[\[/);
    }
  });

  for (const a of SAMPLE) {
    test(`backlinks on ${a.collection}/${a.slug} match a grep of content/`, async ({ page }) => {
      await page.goto(route(a));
      const shown = (await page.locator('.backlinks a').evaluateAll((as) => as.map((x) => x.getAttribute('href') ?? ''))).sort();
      expect(shown).toEqual(expectedBacklinks(a.slug));
    });
  }

  test('the related rail: curated first in the author order, at most six, another collection when one is available, labeled Related work', async ({ page }) => {
    for (const a of SAMPLE) {
      await page.goto(route(a));
      const rail = page.locator('.related-rail');
      const cards = rail.locator('.card h3 a');
      const hrefs = await cards.evaluateAll((as) => as.map((x) => x.getAttribute('href') ?? ''));
      expect(hrefs.length, a.slug).toBeLessThanOrEqual(6);
      const curated = (a.related ?? []).filter((r) => PUBLISHED.some((p) => p.slug === r)).map((r) => route(PUBLISHED.find((p) => p.slug === r)!));
      expect(hrefs.slice(0, curated.length), `${a.slug}: curated relations lead the rail`).toEqual(curated);
      if (hrefs.length > 0) {
        await expect(rail.getByRole('heading', { level: 2 })).toHaveText('Related work');
        expect(await page.locator('main').innerText()).not.toMatch(/might also like/i);
        // Another collection is available when any published artifact elsewhere shares a tag or skill or a relation.
        const others = PUBLISHED.filter((p) => p.slug !== a.slug && p.collection !== a.collection && ((a.related ?? []).includes(p.slug) || (p.related ?? []).includes(a.slug) || p.tags.some((t) => a.tags.includes(t)) || (p.skills ?? []).some((s) => (a.skills ?? []).includes(s))));
        if (others.length > 0) expect(hrefs.some((h) => !h.startsWith(`/${a.collection}/`)), `${a.slug}: at least one other collection`).toBe(true);
      }
    }
  });

  test('previous and next follow the series by part, and the collection by date elsewhere', async ({ page }) => {
    await page.goto('/notes/preserving-v1/');
    await expect(page.locator('.series-line')).toContainText('Part 1 of 2 in the series Rebuilding khaylub com');
    await expect(page.locator('.prev-next a[rel="next"]')).toHaveAttribute('href', '/notes/the-16-mb-front-door/');
    await expect(page.locator('.prev-next a[rel="prev"]')).toHaveCount(0);
    await page.goto('/notes/the-16-mb-front-door/');
    await expect(page.locator('.prev-next a[rel="prev"]')).toHaveAttribute('href', '/notes/preserving-v1/');
    // Gallery items carry no series: date order within the collection.
    const gallery = PUBLISHED.filter((p) => p.collection === 'gallery').sort((x, y) => new Date(x.date).getTime() - new Date(y.date).getTime() || x.title.localeCompare(y.title));
    await page.goto(route(gallery[0]));
    await expect(page.locator('.prev-next a[rel="prev"]')).toHaveCount(0);
    await expect(page.locator('.prev-next a[rel="next"]')).toHaveAttribute('href', route(gallery[1]));
    await expect(page.locator('.prev-next a[rel="next"] .title')).toHaveText(gallery[1].title);
  });

  test('/graph/ lists every published artifact with its relations first, and draws the map only behind a disclosure', async ({ page, request }) => {
    await page.goto('/graph/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Graph');
    const listed = await page.locator('.graph-list > section > ul > li > a:first-child').evaluateAll((as) => as.map((x) => x.getAttribute('href') ?? ''));
    expect(listed.sort()).toEqual(PUBLISHED.map(route).sort());
    const details = page.locator('details.graph-details');
    expect(await details.getAttribute('open')).toBeNull();
    await expect(details.locator('summary')).toHaveText('Map (optional)');
    // Chromium keeps layout boxes inside a closed details (content-visibility: hidden); checkVisibility sees through that.
    expect(await page.evaluate(() => document.querySelector('details.graph-details svg')!.checkVisibility())).toBe(false);
    await details.locator('summary').click();
    expect(await page.evaluate(() => document.querySelector('details.graph-details svg')!.checkVisibility())).toBe(true);
    const nodes = details.locator('svg a');
    expect(await nodes.count()).toBe(PUBLISHED.length);
    for (const href of await nodes.evaluateAll((as) => as.map((x) => x.getAttribute('href') ?? ''))) expect(PUBLISHED.map(route)).toContain(href);
    expect(await nodes.first().locator('title').count()).toBe(1);
    // Every node link meets the 44 px target bar (the invisible hit rect), and axe sees the open map.
    for (const box of await nodes.evaluateAll((as) => as.map((a) => a.getBoundingClientRect()).map((b) => [b.width, b.height]))) {
      expect(box[0]).toBeGreaterThanOrEqual(44);
      expect(box[1]).toBeGreaterThanOrEqual(44);
    }
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await nodes.first().focus();
    expect(await page.evaluate(() => document.activeElement?.tagName.toLowerCase())).toBe('a');
    // Only the nav disclosure and the Appearance control's scripts (F4) travel with the page.
    expect(await page.locator('script:not([type="application/ld+json"])').evaluateAll((ss) => ss.filter((s) => !/PrimaryNav|SiteFooter|theme-early/.test(s.getAttribute('src') ?? '')).length)).toBe(0);
    // The map view named in the story map redirects here.
    const res = await request.get('/library/map', { maxRedirects: 0 });
    expect(res.status()).toBe(301);
    expect(res.headers()['location']).toBe('/graph/');
  });
});
