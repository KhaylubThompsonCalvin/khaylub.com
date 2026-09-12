import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, sep } from 'node:path';
import matter from 'gray-matter';

type Front = { title: string; slug: string; status: string; date: Date; summary: string };
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
/** Feed items: published only (archived stays out, doc 28), newest first, at most 20. */
const expected = (collection?: string) =>
  artifacts()
    .filter((a) => a.status === 'published' && (!collection || a.collection === collection))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || a.title.localeCompare(b.title))
    .slice(0, 20);

test.describe('feeds', () => {
  test('feed.xml is valid RSS listing the newest published artifacts with summaries and clean links', async ({ page, request }) => {
    const res = await request.get('/feed.xml');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/xml/);
    const xml = await res.text();
    await page.goto('/');
    const parsed = await page.evaluate((src) => {
      const doc = new DOMParser().parseFromString(src, 'application/xml');
      if (doc.querySelector('parsererror')) return { error: doc.querySelector('parsererror')!.textContent };
      return {
        title: doc.querySelector('channel > title')?.textContent,
        items: [...doc.querySelectorAll('item')].map((i) => ({ title: i.querySelector('title')?.textContent, link: i.querySelector('link')?.textContent, description: i.querySelector('description')?.textContent })),
      };
    }, xml);
    expect('error' in parsed, String((parsed as { error?: string }).error)).toBe(false);
    const p = parsed as { title: string; items: { title: string; link: string; description: string }[] };
    expect(p.title).toContain('Khaylub.com');
    const want = expected();
    expect(p.items.map((i) => i.title)).toEqual(want.map((a) => a.title));
    for (const [i, a] of want.entries()) {
      expect(p.items[i].link).toBe(`https://khaylub.com/${a.collection}/${a.slug}/`);
      expect(p.items[i].description).toBe(a.summary);
    }
    expect(xml).not.toMatch(/utm_|\?ref=/);
  });

  test('feed.json follows JSON Feed 1.1 with the same items', async ({ request }) => {
    const res = await request.get('/feed.json');
    expect(res.status()).toBe(200);
    const json = (await res.json()) as { version: string; title: string; items: { url: string; title: string; summary: string; date_published: string }[] };
    expect(json.version).toBe('https://jsonfeed.org/version/1.1');
    const want = expected();
    expect(json.items.map((i) => i.title)).toEqual(want.map((a) => a.title));
    for (const [i, a] of want.entries()) {
      expect(json.items[i].url).toBe(`https://khaylub.com/${a.collection}/${a.slug}/`);
      expect(json.items[i].summary).toBe(a.summary);
      expect(json.items[i].date_published.slice(0, 10)).toBe(new Date(a.date).toISOString().slice(0, 10));
    }
  });

  test('per-collection feeds list only that collection; drafts and archived items never appear', async ({ request }) => {
    for (const c of ['projects', 'data', 'notes']) {
      const xml = await (await request.get(`/${c}/feed.xml`)).text();
      const titles = [...xml.matchAll(/<item>[\s\S]*?<title>(?:<!\[CDATA\[)?([^<\]]+)/g)].map((m) => m[1]);
      expect(titles, c).toEqual(expected(c).map((a) => a.title));
    }
    const site = await (await request.get('/feed.xml')).text();
    for (const a of artifacts().filter((x) => x.status !== 'published')) expect(site).not.toContain(a.title);
  });

  test('pages advertise the feeds with link rel=alternate', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('link[rel="alternate"][type="application/rss+xml"][href="/feed.xml"]')).toHaveCount(1);
    await expect(page.locator('link[rel="alternate"][type="application/feed+json"][href="/feed.json"]')).toHaveCount(1);
    await page.goto('/data/');
    await expect(page.locator('link[rel="alternate"][href="/data/feed.xml"]')).toHaveCount(1);
    await expect(page.locator('main a[href="/data/feed.xml"]')).toBeVisible();
  });
});
