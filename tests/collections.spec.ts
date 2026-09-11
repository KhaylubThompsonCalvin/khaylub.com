import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, sep } from 'node:path';
import matter from 'gray-matter';

type Front = { title: string; slug: string; status: string; date: Date; tags: string[]; series?: string; project_status?: string; type: string };

/** Published frontmatter for one collection folder, read the same way the build reads it. */
function published(collection: string): Front[] {
  const out: Front[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (extname(p) === '.md') out.push(matter(readFileSync(p, 'utf8')).data as Front);
    }
  };
  walk(join('content', collection));
  return out.filter((a) => a.status === 'published' || a.status === 'archived');
}

const titlesOn = async (page: import('@playwright/test').Page) => page.locator('main .card-grid h3 a').allInnerTexts();

test.describe('collection listing engine', () => {
  test('a collection index lists exactly its published artifacts, newest first', async ({ page }) => {
    const expected = published('projects').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((a) => a.title);
    await page.goto('/projects/');
    expect(await titlesOn(page)).toEqual(expected);
    await expect(page.locator('main')).toContainText(`${expected.length} item`);
  });

  test('sort variants reorder the same set: oldest and title', async ({ page }) => {
    const notes = published('notes');
    await page.goto('/notes/sort/oldest/');
    expect(await titlesOn(page)).toEqual(notes.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((a) => a.title));
    await page.goto('/notes/sort/title/');
    expect(await titlesOn(page)).toEqual(notes.map((a) => a.title).sort((a, b) => a.localeCompare(b)));
    await expect(page.locator('.sort-links a[aria-current="page"]')).toHaveText('Title');
  });

  test('every filter link on the notes index resolves and narrows to artifacts carrying that value', async ({ page, request }) => {
    await page.goto('/notes/');
    const links = await page.locator('.filter-bar a').evaluateAll((as) => as.map((a) => ({ href: a.getAttribute('href') ?? '', text: a.textContent?.trim() ?? '' })));
    expect(links.length).toBeGreaterThan(1);
    const notes = published('notes');
    for (const l of links) {
      expect((await request.get(l.href)).status(), l.href).toBe(200);
      const m = l.href.match(/^\/notes\/(tag|series|type)\/([^/]+)\/$/);
      if (!m) continue;
      await page.goto(l.href);
      const shown = await titlesOn(page);
      const expected = notes.filter((n) => (m[1] === 'tag' ? n.tags.includes(m[2]) : m[1] === 'series' ? n.series === m[2] : n.type === m[2])).map((n) => n.title);
      expect(shown.sort(), l.href).toEqual(expected.sort());
      await expect(page.locator('.filter-bar a[aria-current="page"]')).toHaveCount(1);
    }
  });

  test('a project status filter lists only that status', async ({ page }) => {
    await page.goto('/projects/type/private-beta/');
    expect(await titlesOn(page)).toEqual(['Manors.ai / BuilderSim']);
  });

  test('browsing needs no JavaScript: the index carries only the nav script and JSON-LD', async ({ request }) => {
    const html = await (await request.get('/data/')).text();
    const scripts = [...html.matchAll(/<script[^>]*>/g)].map((m) => m[0]).filter((s) => !/application\/ld\+json/.test(s));
    expect(scripts.length, scripts.join('\n')).toBe(1);
    expect(scripts[0]).toMatch(/PrimaryNav/);
  });
});
