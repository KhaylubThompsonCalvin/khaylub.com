// Verifies a deployed origin in a real browser the way the runbook's section 2 asks (Phase 19):
// every template route loads (status 200, no console error), every Content-Security-Policy
// report-only violation is collected per page (the securitypolicyviolation event and the console),
// search works (typing a query yields results from the Pagefind index), the climb door loads the
// scene (a model request after the press), and the build's indexing state matches what was asked
// for (--preview: Disallow, the noindex meta, the banner, no sitemap; default: the production
// build). Writes a JSON report and prints a summary. Exit 1 on any failure or any policy
// violation, so a host that drops a path rule (Phase 19, sections 6h to 6l) is visible.
// Usage: node scripts/staging-verify.mjs <base-url> [--preview] [--out report.json] [--mobile]
import { chromium, devices } from 'playwright';
import { writeFileSync } from 'node:fs';

const TEMPLATES = ['/', '/work/', '/projects/khaylub-com-v1/', '/data/fuel-economy-regression/', '/notes/preserving-v1/', '/library/', '/climb/', '/search/', '/about/', '/contact/', '/resume/', '/timeline/', '/notes/sort/title/', '/projects/type/live/', '/skills/data-analysis/', '/technologies/python/', '/tags/python/', '/timeline/data/', '/top8/2026-09/', '/data/tableau-salary-story/', '/gallery/', '/gallery/the-climb-beat-by-beat/', '/gallery/wanderer-hero/', '/video/the-climb-recording/', '/experiments/the-climb/', '/graph/'];
const CSP_LINE = /Content Security Policy|Content-Security-Policy/i;
// Console noise that is not a defect of the site under test: a third-party library's deprecation notice.
const KNOWN_WARNINGS = [/THREE\.Clock: This module has been deprecated/];

export async function verify(base, { preview = false, mobile = false } = {}) {
  const origin = new URL(base).origin;
  const browser = await chromium.launch();
  const context = await browser.newContext(mobile ? { ...devices['Pixel 5'] } : { viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__csp.push({ directive: e.violatedDirective, blocked: e.blockedURI, disposition: e.disposition, policy: e.originalPolicy });
    });
  });
  const report = { origin, preview, mobile, at: new Date().toISOString(), routes: [], search: null, climb: null, indexing: null, ok: true };
  const fail = (msg) => { report.ok = false; return msg; };

  const visit = async (path, after) => {
    const page = await context.newPage();
    const console_ = [];
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) console_.push({ type: m.type(), text: m.text() }); });
    const entry = { path, status: null, cspEvents: [], cspConsole: [], errors: [], warnings: [] };
    try {
      const res = await page.goto(origin + path, { waitUntil: 'load', timeout: 45_000 });
      entry.status = res?.status() ?? null;
      if (after) await after(page, entry);
      await page.waitForTimeout(500);
      entry.cspEvents = await page.evaluate(() => window.__csp);
      entry.cspConsole = console_.filter((m) => CSP_LINE.test(m.text)).map((m) => m.text);
      entry.errors = console_.filter((m) => m.type === 'error' && !CSP_LINE.test(m.text)).map((m) => m.text);
      entry.warnings = console_.filter((m) => m.type === 'warning' && !CSP_LINE.test(m.text) && !KNOWN_WARNINGS.some((k) => k.test(m.text))).map((m) => m.text);
      if (entry.status !== 200) entry.failure = fail(`status ${entry.status}`);
      else if (entry.cspEvents.length || entry.cspConsole.length) entry.failure = fail(`${entry.cspEvents.length} policy violation event(s): the page was served under "${entry.cspEvents[0]?.policy?.match(/script-src[^;]*/)?.[0] ?? 'see cspConsole'}"`);
      else if (entry.errors.length) entry.failure = fail(`${entry.errors.length} console error(s)`);
    } catch (e) {
      entry.failure = fail(e.message.split('\n')[0]);
    } finally {
      await page.close();
    }
    return entry;
  };

  for (const path of TEMPLATES) report.routes.push(await visit(path));

  // Search: the Pagefind index answers a query (its WebAssembly runs under the /search/* policy).
  report.search = await visit('/search/', async (page, entry) => {
    await page.fill('#search-input', 'climb');
    await page.waitForFunction(() => document.querySelectorAll('#search-results li').length > 0, null, { timeout: 20_000 });
    entry.results = await page.locator('#search-results li').count();
  });
  if (report.search.status === 200 && !(report.search.results > 0)) report.search.failure = fail('no search results for "climb"');

  // The climb: nothing from the scene before the press; a model request after it.
  report.climb = await visit('/', async (page, entry) => {
    const before = [];
    page.on('request', (r) => { if (/\/climb\/.*\.(glb|mp4)$/.test(r.url())) before.push(r.url()); });
    entry.sceneRequestsBeforePress = before.length;
    const model = page.waitForRequest((r) => /\/climb\/.*\.glb$/.test(r.url()), { timeout: 45_000 });
    await page.click('[data-climb-enter]');
    entry.firstModelRequest = (await model).url().replace(origin, '');
    await page.waitForTimeout(3000); // let the scene's own requests and any policy report land
  });
  if (report.climb.sceneRequestsBeforePress > 0) report.climb.failure = fail('scene bytes requested before the door was pressed');

  // Indexing state of the build being served.
  const robots = await (await fetch(origin + '/robots.txt')).text();
  const homeRes = await fetch(origin + '/');
  const home = await homeRes.text();
  const sitemapRes = await fetch(origin + '/sitemap-index.xml');
  await sitemapRes.arrayBuffer();
  report.indexing = { robotsDisallowAll: /^Disallow: \/$/m.test(robots), noindexMeta: /<meta name="robots" content="noindex, nofollow">/.test(home), banner: /Preview build\. Not the live site; drafts may be visible here\./.test(home), sitemapStatus: sitemapRes.status, sitemapLastModified: sitemapRes.headers.get('last-modified'), homeLastModified: homeRes.headers.get('last-modified') };
  const i = report.indexing;
  // A file the current build does not produce but the host still serves: its Last-Modified predates
  // the current pages'. Observed on Render on 2026-09-15 (the production build's sitemap after the
  // preview build deployed). Reported as its own failure so it is not mistaken for a build defect.
  i.sitemapStale = i.sitemapStatus === 200 && i.sitemapLastModified && i.homeLastModified && new Date(i.sitemapLastModified) < new Date(i.homeLastModified);
  if (preview && !(i.robotsDisallowAll && i.noindexMeta && i.banner)) i.failure = fail('expected the preview build (Disallow: /, the noindex meta, the banner)');
  else if (preview && i.sitemapStatus !== 404) i.failure = fail(i.sitemapStale ? `a sitemap the preview build does not produce is still served from a previous deploy (Last-Modified ${i.sitemapLastModified}, pages ${i.homeLastModified}): the host keeps files a new build no longer contains` : 'expected no sitemap on the preview build');
  if (!preview && (i.robotsDisallowAll || i.noindexMeta || i.banner || i.sitemapStatus !== 200)) i.failure = fail('expected the production build (no Disallow, no noindex, no banner, a sitemap)');

  // Open Graph cards on the five pages the runbook names: the tags present and the image served as a
  // 1200 by 630 PNG (the third-party debuggers then only confirm rendering).
  report.cards = [];
  for (const path of ['/', '/work/', '/projects/khaylub-com-v1/', '/data/fuel-economy-regression/', '/video/the-climb-recording/']) {
    const card = { path };
    try {
      const html = await (await fetch(origin + path)).text();
      const tag = (name) => html.match(new RegExp(`<meta (?:property|name)="${name}" content="([^"]*)"`))?.[1];
      card.title = tag('og:title'); card.image = tag('og:image'); card.alt = tag('og:image:alt'); card.width = tag('og:image:width'); card.height = tag('og:image:height');
      if (!card.title || !card.image || !card.alt) throw new Error('og:title, og:image, or og:image:alt missing');
      const res = await fetch(new URL(card.image).pathname ? origin + new URL(card.image).pathname : card.image);
      const bytes = new Uint8Array(await res.arrayBuffer());
      card.imageStatus = res.status; card.imageType = res.headers.get('content-type'); card.imageBytes = bytes.length;
      const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
      const dv = new DataView(bytes.buffer);
      card.imageSize = png ? `${dv.getUint32(16)}x${dv.getUint32(20)}` : 'not a PNG';
      if (res.status !== 200 || !png || card.imageSize !== '1200x630') throw new Error(`image ${res.status}, ${card.imageSize}`);
    } catch (e) {
      card.failure = fail(e.message);
    }
    report.cards.push(card);
  }

  await browser.close();
  return report;
}

/** The V1 exhibit (runbook section 3): the served bundle, its size, and the D-09 noindex and canonical. */
export async function exhibit(base) {
  const origin = new URL(base).origin;
  const res = await fetch(origin + '/', { redirect: 'manual' });
  const html = await res.text();
  const out = { origin, status: res.status, title: html.match(/<title>([^<]*)<\/title>/)?.[1] ?? null, bundle: html.match(/assets\/index-[^"']+\.js/)?.[0] ?? null, noindex: /<meta name="robots" content="noindex[^"]*">/.test(html), canonical: html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? null, hsts: res.headers.get('strict-transport-security') };
  if (out.bundle) {
    const b = await fetch(`${origin}/${out.bundle}`);
    out.bundleStatus = b.status;
    out.bundleBytes = (await b.arrayBuffer()).byteLength;
  }
  return out;
}

export function summarize(r) {
  const lines = [];
  for (const e of r.routes) lines.push(`${e.failure ? 'FAIL' : 'ok  '} ${e.path}${e.failure ? '  ' + e.failure : ''}${e.warnings.length ? `  (${e.warnings.length} warning(s))` : ''}`);
  lines.push(`${r.search.failure ? 'FAIL' : 'ok  '} search "climb": ${r.search.results ?? 0} result(s)${r.search.failure ? '  ' + r.search.failure : ''}`);
  lines.push(`${r.climb.failure ? 'FAIL' : 'ok  '} climb: ${r.climb.sceneRequestsBeforePress ?? '?'} scene request(s) before the press; first model after it: ${r.climb.firstModelRequest ?? 'none'}${r.climb.failure ? '  ' + r.climb.failure : ''}`);
  const i = r.indexing;
  lines.push(`${i.failure ? 'FAIL' : 'ok  '} indexing (${r.preview ? 'preview' : 'production'} expected): Disallow all ${i.robotsDisallowAll}, noindex meta ${i.noindexMeta}, banner ${i.banner}, sitemap ${i.sitemapStatus}${i.failure ? '  ' + i.failure : ''}`);
  for (const c of r.cards) lines.push(`${c.failure ? 'FAIL' : 'ok  '} card ${c.path}: ${c.failure ?? `${c.imageSize} PNG, ${c.imageBytes} bytes, alt "${c.alt}"`}`);
  const failures = [...r.routes, r.search, r.climb, i, ...r.cards].filter((x) => x.failure).length;
  lines.push(`verified ${r.routes.length} routes, search, the climb, indexing, ${r.cards.length} cards on ${r.origin} (${r.mobile ? 'mobile' : 'desktop'}): ${failures} failure(s)`);
  return lines;
}

if (process.argv[1] && import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1]).href) {
  const base = process.argv.find((a, i) => i >= 2 && !a.startsWith('--') && process.argv[i - 1] !== '--out');
  if (!base) { console.error('usage: node scripts/staging-verify.mjs <base-url> [--preview] [--mobile] [--out report.json] | --exhibit <v1-url>'); process.exit(2); }
  if (process.argv.includes('--exhibit')) {
    const e = await exhibit(base);
    console.log(`${e.origin}: status ${e.status}; title "${e.title}"; bundle ${e.bundle ?? 'none found'}${e.bundle ? ` (${e.bundleStatus}, ${e.bundleBytes} bytes)` : ''}; noindex meta ${e.noindex}; canonical ${e.canonical ?? 'none'}; HSTS ${e.hsts ?? 'none'}`);
    process.exit(e.status === 200 && e.bundle ? 0 : 1);
  }
  const at = process.argv.indexOf('--out');
  const report = await verify(base, { preview: process.argv.includes('--preview'), mobile: process.argv.includes('--mobile') });
  if (at > 0 && process.argv[at + 1]) writeFileSync(process.argv[at + 1], JSON.stringify(report, null, 2));
  console.log(summarize(report).join('\n'));
  process.exit(report.ok ? 0 : 1);
}
