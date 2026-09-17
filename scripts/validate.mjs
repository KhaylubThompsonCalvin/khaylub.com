// Build-time validation beyond the schemas. Runs before and after `astro build` in CI:
//   banned private terms, em dashes, internal machine paths, credential patterns, media provenance
//   and size (including the climb island's assets), built-HTML media rules,
//   the featured set, redirects in sync with render.yaml, security.txt expiry, heading structure,
//   and the résumé HTML against the PDF text. Exit code 1 on any failure, with the file named.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { load } from 'js-yaml';
import matter from 'gray-matter';
import { unresolvedWikilinks } from '../src/lib/wikilinks.mjs';
import { checkDist } from './seo-check.mjs';

const failures = [];
const warnings = [];
const fail = (msg) => failures.push(msg);
const hasDist = existsSync('dist');

function walk(dir, exts) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (name === 'node_modules' || name === '.git' || name === 'dist' || name === '.astro') continue;
      out.push(...walk(p, exts));
    } else if (!exts || exts.includes(extname(p).toLowerCase())) out.push(p);
  }
  return out;
}

const textExts = ['.md', '.mdx', '.yaml', '.yml', '.astro', '.ts', '.tsx', '.mjs', '.js', '.css', '.html', '.json', '.txt', '.xml'];
// The owner Studio (studio/, ADR-012) is a separate app; its sources obey the same banned-term,
// em-dash, path, and credential rules as the site's.
const sources = [...walk('content', textExts), ...walk('src', textExts), ...walk('public', ['.txt', '.html', '.svg', '.json']), ...(existsSync('docs') ? walk('docs', ['.md']) : []), ...walk('studio', textExts)];
const built = hasDist ? walk('dist', ['.html', '.txt', '.xml', '.json']) : [];
const everything = [...sources, ...built];

// 1. Banned private terms (case-insensitive), with per-file allow comments.
const banned = readFileSync('scripts/banned-terms.txt', 'utf8')
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'));
for (const file of everything) {
  const text = readFileSync(file, 'utf8');
  const allowed = [...text.matchAll(/allow-term:\s*([^>\n]+)/g)].map((m) => m[1].trim().toLowerCase());
  for (const term of banned) {
    const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    if (re.test(text) && !allowed.includes(term.toLowerCase())) {
      // The banned list itself and this script legitimately contain the terms.
      if (file.endsWith('banned-terms.txt') || file.endsWith('validate.mjs')) continue;
      fail(`banned term "${term}" in ${file}`);
    }
  }
}

// 2. Em dashes (U+2014) anywhere in content, source, or output.
for (const file of everything) {
  const text = readFileSync(file, 'utf8');
  if (text.includes('\u2014')) fail(`em dash (U+2014) in ${file}`);
}

// 3. Internal machine paths and credential patterns.
const pathPatterns = [/C:\\Users/i, /\/Users\/[A-Za-z]/, /OneDrive/i, /Desktop\\Projects/i, /Knowledge Base/i];
const secretPatterns = [/ghp_[A-Za-z0-9]{20,}/, /github_pat_[A-Za-z0-9_]{20,}/, /sk-[A-Za-z0-9]{20,}/, /AKIA[0-9A-Z]{16}/, /BEGIN (RSA |EC )?PRIVATE KEY/];
for (const file of everything) {
  if (file.endsWith('validate.mjs')) continue;
  const text = readFileSync(file, 'utf8');
  for (const re of pathPatterns) if (re.test(text)) fail(`internal path pattern ${re} in ${file}`);
  for (const re of secretPatterns) if (re.test(text)) fail(`credential pattern ${re} in ${file}`);
}

// 4. Media provenance: every image, video, or audio file referenced by an artifact needs a record.
const mediaExts = ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.mp4', '.webm', '.mp3', '.ogg', '.glb'];
for (const file of walk('content', ['.md'])) {
  const { data, content } = matter(readFileSync(file, 'utf8'));
  const refs = new Set();
  if (data.cover) refs.add(data.cover);
  if (data.poster) refs.add(data.poster);
  for (const f of data.files ?? []) refs.add(f);
  for (const img of data.images ?? []) refs.add(img.src);
  for (const m of content.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) refs.add(m[1]);
  // Raw HTML figures in Markdown bodies (the case-study convention) count as media references too.
  for (const m of content.matchAll(/<img[^>]+src="([^"]+)"/gi)) refs.add(m[1]);
  const local = [...refs].filter((r) => !/^https?:/.test(r) && mediaExts.includes(extname(r).toLowerCase()));
  if (local.length > 0 && !data.provenance) fail(`media without a provenance record in ${file}: ${local.join(', ')}`);
}

// 4b. Media size (P2-CE-17): 5 MB per file anywhere; 25 MB in total outside public/climb/, whose
//     assets count against the opt-in climb budget only. Both are failures, not warnings.
const MAX_MEDIA_FILE = 5 * 1024 * 1024;
const MAX_MEDIA_TOTAL = 25 * 1024 * 1024;
let mediaTotal = 0;
for (const file of [...walk('content', mediaExts), ...walk('public', mediaExts)]) {
  const size = statSync(file).size;
  if (size > MAX_MEDIA_FILE) fail(`media file over 5 MB: ${file} (${size} bytes)`);
  if (!file.split(/[\\/]/).includes('climb')) mediaTotal += size;
}
if (mediaTotal > MAX_MEDIA_TOTAL) fail(`media in the repository outside public/climb/ totals ${mediaTotal} bytes (limit 25 MB)`);

// 4c. The climb island's assets (P2-SEC-16): every file under public/climb/ has an entry in
//     public/climb/provenance.yaml with source, license, and date, and every entry names a file.
const climbDir = 'public/climb';
if (existsSync(climbDir)) {
  const recordPath = join(climbDir, 'provenance.yaml');
  if (!existsSync(recordPath)) fail(`${recordPath} is missing`);
  else {
    const entries = load(readFileSync(recordPath, 'utf8'))?.files ?? {};
    for (const file of walk(climbDir, mediaExts)) {
      const name = relative(climbDir, file).replace(/\\/g, '/');
      const entry = entries[name];
      if (!entry) fail(`climb asset without a provenance entry: ${file}`);
      else for (const key of ['source', 'license', 'date']) if (!entry[key]) fail(`climb asset ${name}: provenance entry lacks ${key}`);
    }
    for (const name of Object.keys(entries)) if (!existsSync(join(climbDir, name))) fail(`provenance entry names a missing climb asset: ${name}`);
  }
}

// 5. Featured set: exactly the approved three (decision D-10), in any order.
const approved = ['khaylub-com-v1', 'fuel-economy-regression', 'sql-python-analytics-pipeline'];
const featured = [];
for (const file of walk('content', ['.md'])) {
  const { data } = matter(readFileSync(file, 'utf8'));
  if (data.featured === true) featured.push(data.slug);
}
for (const s of featured) if (!approved.includes(s)) fail(`featured slug not in the approved set: ${s}`);
for (const s of approved) if (!featured.includes(s)) fail(`approved featured slug is not marked featured: ${s}`);

// 6. Redirects in sync with render.yaml.
const redirects = load(readFileSync('content/redirects.yaml', 'utf8')).redirects;
const render = load(readFileSync('render.yaml', 'utf8'));
// Every static site in the Blueprint (production and staging) carries the same redirects and headers;
// the first service is production. Any other runtime (the owner Studio, a Node web service) carries no
// public header or route rule, no pull-request previews, and no secret value: secrets are set in the
// dashboard (sync: false), never written here.
const staticSites = render.services.filter((svc) => svc.runtime === 'static');
if (render.services[0]?.runtime !== 'static') fail('render.yaml: the first service must be the production static site');
for (const svc of staticSites.slice(1)) {
  if (JSON.stringify(svc.routes ?? []) !== JSON.stringify(render.services[0].routes ?? [])) fail(`render.yaml: service ${svc.name} routes differ from ${render.services[0].name}`);
  if (JSON.stringify(svc.headers ?? []) !== JSON.stringify(render.services[0].headers ?? [])) fail(`render.yaml: service ${svc.name} headers differ from ${render.services[0].name}`);
}
for (const svc of render.services.filter((svc) => svc.runtime !== 'static')) {
  if (svc.headers || svc.routes) fail(`render.yaml: service ${svc.name} is not a static site and must declare no headers or routes`);
  if (svc.pullRequestPreviewsEnabled !== false) fail(`render.yaml: service ${svc.name} must set pullRequestPreviewsEnabled: false`);
  for (const v of svc.envVars ?? []) {
    if (/SECRET|TOKEN|PASSWORD|PRIVATE/i.test(v.key) && v.value !== undefined) fail(`render.yaml: service ${svc.name} writes a value for ${v.key}; secrets are dashboard-only (sync: false)`);
  }
}
const routes = (render.services[0].routes ?? []).filter((r) => r.type === 'redirect');
for (const r of redirects) {
  if (!routes.some((x) => x.source === r.from && x.destination === r.to)) fail(`redirect ${r.from} -> ${r.to} missing from render.yaml`);
}
for (const x of routes) {
  if (!redirects.some((r) => r.from === x.source && r.to === x.destination)) fail(`render.yaml redirect ${x.source} -> ${x.destination} missing from content/redirects.yaml`);
}

// 7. security.txt expiry (built file) must be more than 30 days away.
if (hasDist) {
  const sec = 'dist/.well-known/security.txt';
  if (!existsSync(sec)) fail('dist/.well-known/security.txt is missing');
  else {
    const m = readFileSync(sec, 'utf8').match(/^Expires:\s*(\S+)/m);
    if (!m) fail('security.txt has no Expires line');
    else {
      const days = (new Date(m[1]).getTime() - Date.now()) / 86400000;
      if (!(days > 30)) fail(`security.txt expires in ${Math.round(days)} days (must be more than 30)`);
    }
  }
}

// 8. Heading structure in every built page: exactly one h1, h2 before h3, main/header/nav/footer present.
if (hasDist) {
  for (const file of walk('dist', ['.html'])) {
    const html = readFileSync(file, 'utf8');
    const h1 = (html.match(/<h1[\s>]/g) ?? []).length;
    if (h1 !== 1) fail(`${h1} h1 elements in ${file} (expected 1)`);
    const levels = [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
    for (let i = 1; i < levels.length; i++) {
      if (levels[i] > levels[i - 1] + 1) fail(`heading level skipped (h${levels[i - 1]} to h${levels[i]}) in ${file}`);
    }
    for (const tag of ['<main', '<header', '<nav', '<footer']) if (!html.includes(tag)) fail(`${tag} missing in ${file}`);
    if (!/<a[^>]+class="skip-link"[^>]+href="#main"/.test(html)) fail(`skip link missing in ${file}`);
    if (/<script(?![^>]*type="application\/ld\+json")(?![^>]*\ssrc=)[^>]*>/.test(html)) fail(`inline script (not JSON-LD) in ${file}`);
    if (/<style[\s>]/.test(html)) fail(`inline style element in ${file}`);
    // CSP style-src is 'self': no component, highlighter, or Markdown HTML may emit a style attribute.
    if (/<[a-z][^>]*\sstyle="/i.test(html)) fail(`inline style attribute in ${file}`);
    if (/\son[a-z]+="/i.test(html)) fail(`inline event handler attribute in ${file}`);
    for (const m of html.matchAll(/<a\s[^>]*target="_blank"[^>]*>/g)) {
      if (!/rel="[^"]*noopener/.test(m[0])) fail(`target=_blank without rel=noopener in ${file}`);
    }
    // Media rules (ADR-007, P2-FE-23, budget lines 19 and 20): every video has a poster, native
    // controls, preload="none", and never autoplays; every audio has controls and preload="none".
    for (const m of html.matchAll(/<video\b[^>]*>/gi)) {
      const tag = m[0];
      if (!/\sposter="[^"]+"/.test(tag)) fail(`video without a poster in ${file}`);
      if (!/\spreload="none"/.test(tag)) fail(`video without preload="none" in ${file}`);
      if (!/\scontrols\b/.test(tag)) fail(`video without native controls in ${file}`);
      if (/\sautoplay\b/.test(tag)) fail(`video with autoplay in ${file}`);
    }
    for (const m of html.matchAll(/<audio\b[^>]*>/gi)) {
      const tag = m[0];
      if (!/\spreload="none"/.test(tag)) fail(`audio without preload="none" in ${file}`);
      if (!/\scontrols\b/.test(tag)) fail(`audio without native controls in ${file}`);
      if (/\sautoplay\b/.test(tag)) fail(`audio with autoplay in ${file}`);
    }
  }
}

// 9. Résumé HTML text versus PDF text (the phone number is deliberately absent from the HTML).
if (hasDist && existsSync('dist/resume/index.html')) {
  try {
    const { default: pdfParse } = await import('pdf-parse');
    const pdf = await pdfParse(readFileSync('public/resume/Khaylub-Thompson-Calvin-Resume.pdf'));
    const norm = (s) => s.replace(/\s+/g, ' ').replace(/[\u2013\u2014]/g, '-').toLowerCase();
    const html = norm(readFileSync('dist/resume/index.html', 'utf8').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&'));
    const pdfText = norm(pdf.text);
    // Sentences that must appear in both: summary opening, each project title, education line.
    const probes = [
      'computer information systems student at portland community college with 7+ years',
      'fuel economy regression case study',
      'sql to python analytics pipeline',
      'production specialist, planar systems',
      'esd and calibration certified',
      'planned: comptia a+ and comptia security+',
    ];
    for (const p of probes) {
      if (!pdfText.includes(p)) warnings.push(`résumé probe not found in the PDF text: "${p}"`);
      if (!html.includes(p)) fail(`résumé probe not found in the HTML résumé: "${p}"`);
    }
  } catch (e) {
    warnings.push(`résumé PDF comparison skipped: ${e.message}`);
  }
}

// 10. Cross-artifact integrity: every `related` slug names an artifact file; Top 8 slugs should too
//     (an unpublished or missing Top 8 slot is skipped at build, so that is a warning, not a failure).
const artifactSlugs = new Set();
const relatedRefs = [];
for (const file of walk('content', ['.md'])) {
  if (file.split(/[\\/]/).includes('profile')) continue;
  const { data } = matter(readFileSync(file, 'utf8'));
  if (data.slug && artifactSlugs.has(data.slug)) fail(`duplicate slug "${data.slug}" in ${file}: slugs are unique across collections (wikilink targets)`);
  if (data.slug) artifactSlugs.add(data.slug);
  for (const r of data.related ?? []) relatedRefs.push({ file, slug: r });
}
for (const { file, slug } of relatedRefs) {
  if (!artifactSlugs.has(slug)) fail(`related slug "${slug}" in ${file} names no artifact`);
}
// 10a. SEO and metadata over the built output (T13, SEO-1 to SEO-8): scripts/seo-check.mjs.
if (hasDist) {
  const seo = checkDist('dist');
  for (const e of seo.errors) fail(`seo: ${e}`);
  for (const w of seo.warnings) warnings.push(`seo: ${w}`);
}

// 10b. Wikilinks in bodies (ADR-006, FR-E1): every [[slug]] names a visible artifact or page.
//      Production ignores drafts as targets and as sources; a preview build (PUBLIC_SITE_ENV=preview)
//      renders drafts and may link to them.
for (const { file, slug } of unresolvedWikilinks()) fail(`unresolved wikilink [[${slug}]] in ${file}`);
for (const file of walk('content/profile/top8', ['.yaml'])) {
  for (const item of load(readFileSync(file, 'utf8')).items ?? []) {
    if (!artifactSlugs.has(item.slug)) warnings.push(`Top 8 slug "${item.slug}" in ${file} has no artifact yet (the slot is skipped at build)`);
  }
}

if (warnings.length) console.log('warnings:\n' + warnings.map((w) => '  ' + w).join('\n'));
if (failures.length) {
  console.error('validate: FAIL\n' + failures.map((f) => '  ' + f).join('\n'));
  process.exit(1);
}
console.log(`validate: PASS (${sources.length} source files${hasDist ? `, ${built.length} built files` : ''} checked)`);
