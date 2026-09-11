// Build report (P2-CE-21). Reads content/ and dist/ after a build and writes build-report.json
// (ignored by git) plus a short console summary: pages per collection, artifacts per collection and
// status, evidence counts per skill and technology, unresolved related slugs, covers without alt,
// oversize media, orphans (published artifacts with no curated relation in or out), and the size of
// the search index. It reports; it never fails the build (validate.mjs owns the failures).
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { join, extname, sep } from 'node:path';
import matter from 'gray-matter';
import { load } from 'js-yaml';

const MEDIA = ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.mp4', '.webm', '.mp3', '.ogg', '.glb'];
const OVERSIZE_BYTES = 5 * 1024 * 1024;

function walk(dir, keep = () => true) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, keep));
    else if (keep(p)) out.push(p);
  }
  return out;
}

const artifacts = walk('content', (p) => extname(p) === '.md' && !p.split(sep).includes('profile')).map((file) => ({
  file,
  collection: file.split(sep)[1],
  ...matter(readFileSync(file, 'utf8')).data,
}));
const published = artifacts.filter((a) => a.status === 'published');
const evidencePool = published.filter((a) => a.employer_visible);
const vocab = (kind) => load(readFileSync(`content/vocabulary/${kind}.yaml`, 'utf8')).terms;

const byCollection = {};
for (const a of artifacts) {
  byCollection[a.collection] ??= { total: 0, byStatus: {} };
  byCollection[a.collection].total++;
  byCollection[a.collection].byStatus[a.status] = (byCollection[a.collection].byStatus[a.status] ?? 0) + 1;
}

const evidence = (kind) =>
  Object.fromEntries(
    vocab(kind)
      .map((t) => [t.slug, evidencePool.filter((a) => (a[kind] ?? []).includes(t.slug)).length])
      .filter(([, n]) => n > 0)
  );

const slugs = new Set(artifacts.map((a) => a.slug));
const unresolvedRelated = artifacts.flatMap((a) => (a.related ?? []).filter((r) => !slugs.has(r)).map((r) => ({ file: a.file, slug: r })));
const referenced = new Set(artifacts.flatMap((a) => a.related ?? []));
const orphans = published.filter((a) => !(a.related ?? []).length && !referenced.has(a.slug)).map((a) => `${a.collection}/${a.slug}`);
const coversWithoutAlt = artifacts.filter((a) => a.cover && !a.cover_alt).map((a) => a.file);
const oversizeMedia = [...walk('content', (p) => MEDIA.includes(extname(p).toLowerCase())), ...walk('public', (p) => MEDIA.includes(extname(p).toLowerCase()))]
  .filter((p) => statSync(p).size > OVERSIZE_BYTES)
  .map((p) => ({ file: p, bytes: statSync(p).size }));

const builtPages = walk('dist', (p) => p.endsWith('index.html')).map((p) => '/' + p.split(sep).slice(1, -1).join('/') + (p.split(sep).length > 2 ? '/' : ''));
const pagesByCollection = {};
for (const route of builtPages) {
  const top = route.split('/')[1] || '(root)';
  pagesByCollection[top] = (pagesByCollection[top] ?? 0) + 1;
}
const indexBytes = walk('dist/pagefind').reduce((n, p) => n + statSync(p).size, 0);

const report = {
  generated: new Date().toISOString(),
  artifacts: { total: artifacts.length, published: published.length, byCollection },
  pages: { total: builtPages.length, byTopLevel: pagesByCollection },
  evidence: { skills: evidence('skills'), technologies: evidence('technologies') },
  unresolvedRelated,
  orphans,
  coversWithoutAlt,
  oversizeMedia,
  searchIndexBytes: indexBytes,
};

writeFileSync('build-report.json', JSON.stringify(report, null, 2) + '\n');
console.log(
  `build report: ${report.pages.total} pages, ${report.artifacts.published} published of ${report.artifacts.total} artifacts, ` +
    `${Object.keys(report.evidence.skills).length} skills and ${Object.keys(report.evidence.technologies).length} technologies with evidence, ` +
    `${unresolvedRelated.length} unresolved related, ${orphans.length} orphans, ${coversWithoutAlt.length} covers without alt, ` +
    `${oversizeMedia.length} oversize media, search index ${Math.round(indexBytes / 1024)} KB (written to build-report.json)`
);
