import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, sep } from 'node:path';
import matter from 'gray-matter';
import { load } from 'js-yaml';

type Front = { title: string; status: string; date: Date };
const events = (load(readFileSync('content/timeline/events.yaml', 'utf8')) as { events: { title: string; kind: string; date: Date }[] }).events;

function publishedArtifacts(): Front[] {
  const out: Front[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (extname(p) === '.md' && !p.split(sep).includes('profile')) out.push(matter(readFileSync(p, 'utf8')).data as Front);
    }
  };
  walk('content');
  return out.filter((a) => a.status === 'published');
}

test.describe('timeline', () => {
  test('lists every published artifact and every authored event with a machine-readable date', async ({ page }) => {
    await page.goto('/timeline/');
    const text = await page.locator('main').innerText();
    for (const a of publishedArtifacts()) expect(text, a.title).toContain(a.title);
    for (const e of events) expect(text, e.title).toContain(e.title);
    const rows = page.locator('main section ul.events > li');
    expect(await rows.count()).toBeGreaterThanOrEqual(publishedArtifacts().length + events.length);
    for (const dt of await rows.locator('time').evaluateAll((ts) => ts.map((t) => t.getAttribute('datetime')))) expect(dt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('every group filter resolves and narrows the rows; the rule is CSS only', async ({ page, request }) => {
    await page.goto('/timeline/');
    const links = await page.locator('.filter-bar a').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''));
    expect(links).toContain('/timeline/');
    const groups = links.filter((l) => l !== '/timeline/');
    expect(groups.length).toBeGreaterThanOrEqual(3);
    const allRows = await page.locator('ul.events > li').count();
    let sum = 0;
    for (const href of groups) {
      expect((await request.get(href)).status(), href).toBe(200);
      await page.goto(href);
      const n = await page.locator('ul.events > li').count();
      expect(n, href).toBeGreaterThan(0);
      sum += n;
      await expect(page.locator('.filter-bar a[aria-current="page"]')).toHaveAttribute('href', href);
      expect(await page.locator('ul.events hr, ul.events > li > div:empty').count()).toBe(0);
    }
    expect(sum, 'every row belongs to exactly one group').toBe(allRows);
  });

  test('the education group holds the course-completed event and the data group holds the data artifacts', async ({ page }) => {
    await page.goto('/timeline/education/');
    await expect(page.locator('main')).toContainText('Data Analytics (CIS277A) completed');
    await page.goto('/timeline/data/');
    const text = await page.locator('main').innerText();
    expect(text).toContain('Fuel Economy Regression Case Study');
    expect(text).not.toContain('Khaylub.com V1, the climb (Projects)');
  });
});
