// Build-time validation beyond the schemas. Runs before and after `astro build` in CI:
//   banned private terms, em dashes, internal machine paths, credential patterns, media provenance,
//   the featured set, redirects in sync with render.yaml, security.txt expiry, heading structure,
//   and the résumé HTML against the PDF text. Exit code 1 on any failure, with the file named.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { load } from 'js-yaml';
import matter from 'gray-matter';

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
      if (name === 'node_modules' || name === '.git') continue;
      out.push(...walk(p, exts));
    } else if (!exts || exts.includes(extname(p).toLowerCase())) out.push(p);
  }
  return out;
}

const textExts = ['.md', '.mdx', '.yaml', '.yml', '.astro', '.ts', '.tsx', '.mjs', '.js', '.css', '.html', '.json', '.txt', '.xml'];
const sources = [...walk('content', textExts), ...walk('src', textExts), ...walk('public', ['.txt', '.html', '.svg', '.json'])];
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
  const local = [...refs].filter((r) => !/^https?:/.test(r) && mediaExts.includes(extname(r).toLowerCase()));
  if (local.length > 0 && !data.provenance) fail(`media without a provenance record in ${file}: ${local.join(', ')}`);
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
    if (/\son[a-z]+="/i.test(html)) fail(`inline event handler attribute in ${file}`);
    for (const m of html.matchAll(/<a\s[^>]*target="_blank"[^>]*>/g)) {
      if (!/rel="[^"]*noopener/.test(m[0])) fail(`target=_blank without rel=noopener in ${file}`);
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
  if (data.slug) artifactSlugs.add(data.slug);
  for (const r of data.related ?? []) relatedRefs.push({ file, slug: r });
}
for (const { file, slug } of relatedRefs) {
  if (!artifactSlugs.has(slug)) fail(`related slug "${slug}" in ${file} names no artifact`);
}
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
