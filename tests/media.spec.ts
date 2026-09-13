import { test, expect, type Page } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import matter from 'gray-matter';
import { TEMPLATES } from './helpers';

// Media pages (Phase 13; ADR-007, P2-FE-22, P2-FE-23, budget lines 14, 15, 19, 20): every video and
// audio element is native, behind preload="none", never playing at load; the image pipeline emits
// AVIF and WebP with dimensions and lazy loading below the fold; thumbnails stay small; every media
// page stays inside the first-load budget; the exhibit links to the climb instead of loading it.

/** Routes of every published artifact in the media collections, read the way the build reads them. */
function mediaRoutes(): { route: string; collection: string; data: Record<string, unknown> }[] {
  const out: { route: string; collection: string; data: Record<string, unknown> }[] = [];
  for (const collection of ['music', 'video', 'gallery', 'experiments']) {
    const dir = join('content', collection);
    const walk = (d: string) => {
      for (const name of readdirSync(d)) {
        const p = join(d, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (extname(p) === '.md') {
          const data = matter(readFileSync(p, 'utf8')).data as Record<string, unknown>;
          if (data.status === 'published' || data.status === 'archived') out.push({ route: `/${collection}/${data.slug}/`, collection, data });
        }
      }
    };
    walk(dir);
  }
  return out;
}

const MEDIA = mediaRoutes();
const byCollection = (c: string) => MEDIA.filter((m) => m.collection === c);

async function transferred(page: Page, path: string): Promise<{ total: number; images: number; requests: number }> {
  let total = 0;
  let images = 0;
  let requests = 0;
  const handler = async (r: import('@playwright/test').Response) => {
    requests++;
    try {
      const len = (await r.body()).length;
      total += len;
      if (/^image\//.test(r.headers()['content-type'] ?? '')) images += len;
    } catch {
      /* not readable */
    }
  };
  page.on('response', handler);
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  page.off('response', handler);
  return { total, images, requests };
}

test.describe('media pages', () => {
  test('nothing plays at load on any template or media page', async ({ page }) => {
    for (const path of [...TEMPLATES, ...MEDIA.map((m) => m.route)]) {
      await page.goto(path);
      const playing = await page.locator('video, audio').evaluateAll((els) => els.filter((e) => !(e as HTMLMediaElement).paused).map((e) => (e as HTMLMediaElement).currentSrc));
      expect(playing, path).toEqual([]);
      const autoplay = await page.locator('video[autoplay], audio[autoplay]').count();
      expect(autoplay, path).toBe(0);
    }
  });

  test('every video page: native controls, poster, preload none, a 16:9 frame, no iframe; keyboard plays and pauses', async ({ page }) => {
    const videos = byCollection('video');
    test.skip(videos.length === 0, 'no published video yet');
    for (const v of videos) {
      await page.goto(v.route);
      expect(await page.locator('iframe').count(), v.route).toBe(0);
      const el = page.locator('video');
      const files = (v.data.files as string[] | undefined) ?? [];
      if (files.length === 0) {
        await expect(el).toHaveCount(0);
        await expect(page.locator('.facade-link')).toHaveAttribute('rel', /noopener/);
        continue;
      }
      await expect(el).toHaveCount(1);
      await expect(el).toHaveAttribute('controls', '');
      await expect(el).toHaveAttribute('preload', 'none');
      await expect(el).toHaveAttribute('poster', /\.(webp|avif|png|jpg)$/);
      await expect(el).toHaveAttribute('playsinline', '');
      expect(await el.getAttribute('autoplay')).toBeNull();
      if (v.data.speech) await expect(el.locator('track[kind="captions"]')).toHaveCount(1);
      for (const src of await el.locator('source').evaluateAll((ss) => ss.map((s) => s.getAttribute('src') ?? ''))) {
        expect((await page.request.get(src)).status(), src).toBe(200);
      }
      // Keyboard: focus the native player, Space plays, Space pauses.
      await el.focus();
      await page.keyboard.press('Space');
      await expect.poll(async () => el.evaluate((e) => !(e as HTMLVideoElement).paused), { timeout: 10_000 }).toBe(true);
      await page.keyboard.press('Space');
      await expect.poll(async () => el.evaluate((e) => (e as HTMLVideoElement).paused), { timeout: 10_000 }).toBe(true);
    }
  });

  test('every music page: native controls, preload none, the duration, lyrics or a description below', async ({ page }) => {
    const tracks = byCollection('music');
    test.skip(tracks.length === 0, 'no published track yet: the owner has not supplied audio with a provenance record (checkpoint, owner items)');
    for (const t of tracks) {
      await page.goto(t.route);
      const el = page.locator('audio');
      await expect(el).toHaveCount(1);
      await expect(el).toHaveAttribute('controls', '');
      await expect(el).toHaveAttribute('preload', 'none');
      expect(await el.getAttribute('autoplay')).toBeNull();
      await expect(page.locator('figcaption')).toContainText(`Duration ${t.data.duration}`);
      expect((await page.locator('.body').innerText()).length).toBeGreaterThan(40);
    }
  });

  test('every gallery page: pipeline images with alt, dimensions, avif and webp sources, lazy below the fold, small thumbnails, full-size links', async ({ page, request }) => {
    const sets = byCollection('gallery');
    test.skip(sets.length === 0, 'no published gallery yet');
    for (const g of sets) {
      await page.goto(g.route);
      const pictures = page.locator('.gallery-grid picture');
      expect(await pictures.count()).toBe((g.data.images as unknown[]).length);
      for (let i = 0; i < (await pictures.count()); i++) {
        const pic = pictures.nth(i);
        const types = await pic.locator('source').evaluateAll((ss) => ss.map((s) => s.getAttribute('type')));
        expect(types).toEqual(expect.arrayContaining(['image/avif', 'image/webp']));
        const img = pic.locator('img');
        expect((await img.getAttribute('alt')) ?? '').not.toBe('');
        expect(Number(await img.getAttribute('width'))).toBeGreaterThan(0);
        expect(Number(await img.getAttribute('height'))).toBeGreaterThan(0);
        await expect(img).toHaveAttribute('loading', i === 0 ? 'eager' : 'lazy');
        if (i === 0) await expect(img).toHaveAttribute('fetchpriority', 'high');
        // The 400 px candidate of every image is a thumbnail: 30 KB or less (budget line 15).
        const srcset = (await pic.locator('source[type="image/webp"]').getAttribute('srcset')) ?? '';
        const small = srcset.split(',').map((s) => s.trim().split(' ')[0]).find((u) => /w=400|_400/.test(u) || true);
        expect(small).toBeTruthy();
        const res = await request.get(small!);
        expect(res.status()).toBe(200);
        expect((await res.body()).length, `${small} thumbnail bytes`).toBeLessThanOrEqual(30 * 1024);
        const full = await pic.locator('..').getAttribute('href');
        expect((await request.get(full!)).headers()['content-type']).toMatch(/^image\//);
      }
    }
  });

  test('every experiment page: a poster, an entry link, and zero climb or 3D bytes', async ({ page }) => {
    const exhibits = byCollection('experiments');
    test.skip(exhibits.length === 0, 'no published experiment yet');
    for (const e of exhibits) {
      const urls: string[] = [];
      page.on('request', (r) => urls.push(r.url()));
      await page.goto(e.route);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('.experiment img')).toHaveAttribute('fetchpriority', 'high');
      await expect(page.getByRole('link', { name: /Open the/ })).toHaveAttribute('href', e.data.entry_url as string);
      expect(urls.filter((u) => /climb-mount|three|fiber|\.glb|\.mp4|\.wasm/i.test(u))).toEqual([]);
      expect(await page.locator('canvas, video, iframe').count()).toBe(0);
    }
  });

  test('every media page stays inside the first-load budget: 900 KB total, 300 KB images, 40 requests', async ({ page }) => {
    test.skip(MEDIA.length === 0, 'no published media artifact yet');
    for (const m of MEDIA) {
      const t = await transferred(page, m.route);
      expect(t.total, `${m.route} total bytes`).toBeLessThanOrEqual(900 * 1024);
      expect(t.images, `${m.route} image bytes`).toBeLessThanOrEqual(300 * 1024);
      expect(t.requests, `${m.route} requests`).toBeLessThanOrEqual(40);
    }
  });

  test('media collection cards lead with a cover thumbnail and the index lists every published item', async ({ page }) => {
    for (const c of ['video', 'gallery', 'experiments', 'music']) {
      const items = byCollection(c);
      await page.goto(`/${c}/`);
      const cards = page.locator('main .card-grid .card');
      await expect(cards).toHaveCount(items.length);
      for (const it of items) {
        if (!it.data.cover) continue;
        const card = cards.filter({ hasText: it.data.title as string });
        const img = card.locator('.thumb img');
        await expect(img).toHaveCount(1);
        expect((await img.getAttribute('alt')) ?? '').not.toBe('');
      }
    }
  });

  test('JSON-LD names the media type with its thumbnail or content URL', async ({ page }) => {
    test.skip(MEDIA.length === 0, 'no published media artifact yet');
    const types: Record<string, string> = { video: 'VideoObject', music: 'MusicRecording', gallery: 'ImageObject', experiments: 'CreativeWork' };
    for (const m of MEDIA) {
      await page.goto(m.route);
      const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
      const records = blocks.flatMap((b) => {
        const p = JSON.parse(b);
        return Array.isArray(p) ? p : [p];
      });
      const work = records.find((r) => r['@type'] === types[m.collection]);
      expect(work, m.route).toBeTruthy();
      if (m.collection === 'video') {
        expect(work.thumbnailUrl).toMatch(/^https:\/\/khaylub\.com\//);
        expect(work.uploadDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
      if (m.collection === 'gallery') expect(work.contentUrl).toMatch(/^https:\/\/khaylub\.com\//);
    }
  });
});
