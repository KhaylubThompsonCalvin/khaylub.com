#!/usr/bin/env node
// SEO and metadata checks over dist/ (vault document 14, T13; requirements SEO-1 to SEO-8): every
// built page carries a unique title, a description, a canonical on the production domain, Open
// Graph and Twitter tags with an image of 1200 by 630 that exists in the build, the feed links, and
// JSON-LD whose records parse and carry the properties their type needs; the sitemap lists every
// built route and nothing else; robots names the sitemap. Called from validate.mjs on the built
// output; run alone it prints the validation report and writes seo-report.json.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const SITE = 'https://khaylub.com';
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const OG_MAX_BYTES = 300 * 1024;
const TITLE_MAX = 60;

// Properties a record must carry, by type. This is the site's own rule and it is stricter than
// Google's required sets (Dataset: name, description; VideoObject: name, thumbnailUrl, uploadDate;
// Article: none required, headline and dates recommended): every work names, describes, dates,
// and attributes itself, and an article carries its headline.
const REQUIRED = {
  Person: ['name', 'url'],
  WebSite: ['name', 'url'],
  WebPage: ['name', 'url'],
  BreadcrumbList: ['itemListElement'],
  SoftwareSourceCode: ['name', 'description', 'url', 'datePublished', 'author'],
  Dataset: ['name', 'description', 'url', 'datePublished'],
  Article: ['name', 'headline', 'description', 'url', 'datePublished', 'author'],
  BlogPosting: ['name', 'headline', 'description', 'url', 'datePublished', 'author'],
  MusicRecording: ['name', 'url', 'datePublished'],
  VideoObject: ['name', 'description', 'url', 'thumbnailUrl', 'uploadDate'],
  ImageObject: ['name', 'url', 'contentUrl'],
  CreativeWork: ['name', 'description', 'url', 'datePublished', 'author'],
};

function pages(root) {
  const out = [];
  const walk = (dir, prefix) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        if (name === '_astro' || name === 'chunks' || name === 'pages' || name === 'pagefind') continue;
        walk(p, `${prefix}${name}/`);
      } else if (name === 'index.html') out.push({ route: prefix || '/', file: p });
      else if (name === '404.html' && prefix === '/') out.push({ route: '/404.html', file: p, notFound: true });
    }
  };
  walk(root, '/');
  return out.sort((a, b) => a.route.localeCompare(b.route));
}

const meta = (html, attr, key) => html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`))?.[1];
const pngSize = (buf) => (buf.length > 24 && buf.toString('ascii', 1, 4) === 'PNG' ? { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) } : undefined);

export function checkDist(root = 'dist') {
  const errors = [];
  const warnings = [];
  const report = [];
  if (!existsSync(root)) return { errors: [`${root}/ is missing; run the build first`], warnings, pages: [] };
  const titles = new Map();
  const list = pages(root);
  for (const { route, file, notFound } of list) {
    const html = readFileSync(file, 'utf8');
    const row = { route, jsonLd: [] };
    const err = (m) => errors.push(`${route}: ${m}`);
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
    if (!title) err('no title');
    if (title.length > TITLE_MAX) warnings.push(`${route}: title is ${title.length} characters (${TITLE_MAX} where possible)`);
    if (titles.has(title)) err(`title duplicates ${titles.get(title)}`);
    titles.set(title, route);
    row.title = title;
    const description = meta(html, 'name', 'description') ?? '';
    if (description.length < 20) err('description missing or under 20 characters');
    row.description = description.length;
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    const expectedCanonical = notFound ? undefined : `${SITE}${route}`;
    if (!notFound && canonical !== expectedCanonical) err(`canonical is ${canonical ?? 'missing'}, expected ${expectedCanonical}`);
    row.canonical = canonical;
    for (const key of ['og:type', 'og:site_name', 'og:url', 'og:title', 'og:description', 'og:image', 'og:image:width', 'og:image:height', 'og:image:alt']) {
      if (meta(html, 'property', key) === undefined) err(`${key} missing`);
    }
    for (const key of ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image', 'twitter:image:alt']) {
      if (meta(html, 'name', key) === undefined) err(`${key} missing`);
    }
    if (!notFound && meta(html, 'property', 'og:url') !== expectedCanonical) err('og:url differs from the canonical');
    const image = meta(html, 'property', 'og:image') ?? '';
    row.ogImage = image;
    row.ogType = meta(html, 'property', 'og:type');
    if (image.startsWith(`${SITE}/`)) {
      const local = join(root, decodeURIComponent(image.slice(SITE.length)));
      if (!existsSync(local)) err(`og:image ${image} is not in the build`);
      else {
        const buf = readFileSync(local);
        const size = pngSize(buf);
        if (!size) err(`og:image ${image} is not a PNG`);
        else if (size.width !== OG_WIDTH || size.height !== OG_HEIGHT) err(`og:image ${image} is ${size.width} by ${size.height}, expected ${OG_WIDTH} by ${OG_HEIGHT}`);
        if (buf.length > OG_MAX_BYTES) err(`og:image ${image} is ${buf.length} bytes, over ${OG_MAX_BYTES}`);
        if (meta(html, 'property', 'og:image:width') !== String(OG_WIDTH) || meta(html, 'property', 'og:image:height') !== String(OG_HEIGHT)) err('og:image:width or og:image:height differ from the image');
        row.ogImageBytes = buf.length;
      }
    } else err(`og:image ${image || '(none)'} is not on the production domain`);
    if (!/<link rel="alternate" type="application\/rss\+xml"/.test(html)) err('RSS feed link missing');
    if (!/<link rel="alternate" type="application\/feed\+json"/.test(html)) err('JSON feed link missing');
    if (!/<link rel="sitemap" href="\/sitemap-index\.xml"/.test(html)) err('sitemap link missing');
    if (!/<a [^>]*rel="[^"]*\bme\b[^"]*"[^>]*href="https:\/\/github\.com\//.test(html) && !/<a [^>]*href="https:\/\/github\.com\/[^"]*"[^>]*rel="[^"]*\bme\b/.test(html)) err('rel="me" GitHub link missing');
    if (!/<a [^>]*rel="[^"]*\bme\b[^"]*"[^>]*href="https:\/\/www\.linkedin\.com\//.test(html) && !/<a [^>]*href="https:\/\/www\.linkedin\.com\/[^"]*"[^>]*rel="[^"]*\bme\b/.test(html)) err('rel="me" LinkedIn link missing');
    // JSON-LD: every block parses; every record has a type and its required properties.
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      let parsed;
      try {
        parsed = JSON.parse(m[1]);
      } catch (e) {
        err(`JSON-LD does not parse: ${e.message}`);
        continue;
      }
      for (const record of Array.isArray(parsed) ? parsed : [parsed]) {
        const type = record['@type'];
        row.jsonLd.push(type);
        if (!type) {
          err('JSON-LD record without @type');
          continue;
        }
        if (record['@context'] !== 'https://schema.org') err(`${type}: @context is not https://schema.org`);
        for (const prop of REQUIRED[type] ?? ['name']) {
          const v = record[prop];
          if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) err(`${type}: ${prop} missing`);
        }
        if (type === 'BreadcrumbList') {
          const items = record.itemListElement ?? [];
          items.forEach((it, i) => {
            if (it['@type'] !== 'ListItem' || it.position !== i + 1 || !it.name || !it.item) err(`BreadcrumbList item ${i + 1} malformed`);
          });
        }
        for (const d of ['datePublished', 'dateModified', 'uploadDate']) if (record[d] && !/^\d{4}-\d{2}-\d{2}$/.test(String(record[d]))) err(`${type}: ${d} is not an ISO date`);
      }
    }
    if (row.jsonLd.length === 0) err('no JSON-LD');
    const preview = /<meta name="robots" content="noindex, nofollow"/.test(html);
    row.noindex = preview;
    report.push(row);
  }
  // Sitemap and robots.
  const sitemapFile = join(root, 'sitemap-0.xml');
  const robots = existsSync(join(root, 'robots.txt')) ? readFileSync(join(root, 'robots.txt'), 'utf8') : '';
  const previewBuild = list.some((p) => p.route === '/' && /<meta name="robots" content="noindex, nofollow"/.test(readFileSync(p.file, 'utf8')));
  if (previewBuild) {
    if (!/Disallow: \//.test(robots)) errors.push('preview build: robots.txt does not disallow');
    if (existsSync(sitemapFile)) errors.push('preview build: a sitemap was emitted');
    for (const r of report) if (!r.noindex && r.route !== '/404.html') errors.push(`${r.route}: preview build without noindex`);
  } else {
    if (!existsSync(sitemapFile)) errors.push('sitemap-0.xml missing');
    else {
      const locs = [...readFileSync(sitemapFile, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname).sort();
      const routes = list.filter((p) => !p.notFound).map((p) => p.route).sort();
      const missing = routes.filter((r) => !locs.includes(r));
      const extra = locs.filter((l) => !routes.includes(l));
      if (missing.length) errors.push(`sitemap misses ${missing.length} route(s): ${missing.slice(0, 5).join(', ')}`);
      if (extra.length) errors.push(`sitemap lists ${extra.length} route(s) not built: ${extra.slice(0, 5).join(', ')}`);
      for (const l of locs) if (!readFileSync(sitemapFile, 'utf8').includes(`<loc>${SITE}${l}</loc>`)) errors.push(`sitemap entry ${l} is not on the production domain`);
    }
    if (!/Allow: \//.test(robots) || !robots.includes(`Sitemap: ${SITE}/sitemap-index.xml`)) errors.push('robots.txt does not allow crawling and name the sitemap');
    for (const r of report) if (r.noindex) errors.push(`${r.route}: noindex on a production page`);
  }
  for (const f of ['feed.xml', 'feed.json']) if (!existsSync(join(root, f))) errors.push(`${f} missing`);
  return { errors, warnings, pages: report, previewBuild };
}

function main() {
  const result = checkDist('dist');
  const types = {};
  for (const p of result.pages) for (const t of p.jsonLd) types[t] = (types[t] ?? 0) + 1;
  const artifacts = result.pages.filter((p) => p.ogType === 'article');
  const own = artifacts.filter((p) => p.ogImage && !p.ogImage.endsWith('/og-default.png'));
  console.log(`seo-check: ${result.pages.length} pages${result.previewBuild ? ' (preview build)' : ''}`);
  console.log(`  titles unique: ${new Set(result.pages.map((p) => p.title)).size === result.pages.length ? 'yes' : 'no'}; longest ${Math.max(...result.pages.map((p) => p.title.length))} characters`);
  console.log(`  artifact pages (og:type article): ${artifacts.length}; with their own Open Graph image: ${own.length}; largest image ${Math.max(0, ...result.pages.map((p) => p.ogImageBytes ?? 0))} bytes`);
  console.log(`  JSON-LD records by type: ${Object.entries(types).map(([t, n]) => `${t} ${n}`).join(', ')}`);
  console.log(`  errors: ${result.errors.length}; warnings: ${result.warnings.length}`);
  for (const w of result.warnings) console.log(`  warning: ${w}`);
  for (const e of result.errors) console.log(`  error: ${e}`);
  writeFileSync('seo-report.json', JSON.stringify({ generated: new Date().toISOString(), summary: { pages: result.pages.length, artifacts: artifacts.length, ownImages: own.length, types, errors: result.errors.length, warnings: result.warnings.length }, errors: result.errors, warnings: result.warnings, pages: result.pages }, null, 2));
  console.log('  written: seo-report.json');
  return result.errors.length ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) process.exit(main());
