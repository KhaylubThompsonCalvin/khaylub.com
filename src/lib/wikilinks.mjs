// Wikilinks (ADR-006, FR-E1, doc 07 section 2): `[[slug]]` and `[[slug|display text]]` in artifact
// bodies resolve at build to site links; unresolved links fail production builds and render as
// flagged text in preview. Plain JavaScript so the same resolver serves Astro's Markdown pipeline
// (a Sätteri mdast plugin in astro.config.mjs; mdast is the tree remark uses), the validator
// (scripts/validate.mjs), the build report, and lib/graph.ts. No package beyond Astro's own
// processor: this is the "small build-time pass" the ADR describes.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

/** @typedef {{ slug: string, route: string, title: string, status: string, collection?: string, file?: string }} Target */

/** The cross-cutting pages a wikilink may name besides artifact slugs (ADR-006: "and page slugs"). */
export const PAGE_TARGETS = /** @type {Target[]} */ ([
  { slug: 'home', route: '/', title: 'Home', status: 'published' },
  { slug: 'work', route: '/work/', title: 'Work', status: 'published' },
  { slug: 'about', route: '/about/', title: 'About', status: 'published' },
  { slug: 'now', route: '/now/', title: 'Now', status: 'published' },
  { slug: 'resume', route: '/resume/', title: 'Résumé', status: 'published' },
  { slug: 'contact', route: '/contact/', title: 'Contact', status: 'published' },
  { slug: 'library', route: '/library/', title: 'Library', status: 'published' },
  { slug: 'timeline', route: '/timeline/', title: 'Timeline', status: 'published' },
  { slug: 'search', route: '/search/', title: 'Search', status: 'published' },
  { slug: 'climb', route: '/climb/', title: 'The climb', status: 'published' },
  { slug: 'graph', route: '/graph/', title: 'Graph', status: 'published' },
  { slug: 'top8', route: '/top8/', title: "Khaylub's Top 8", status: 'published' },
  { slug: 'colophon', route: '/colophon/', title: 'Colophon', status: 'published' },
  { slug: 'projects', route: '/projects/', title: 'Projects', status: 'published' },
  { slug: 'data', route: '/data/', title: 'Data', status: 'published' },
  { slug: 'notes', route: '/notes/', title: 'Field Notes', status: 'published' },
  { slug: 'writing', route: '/writing/', title: 'Writing', status: 'published' },
  { slug: 'journal', route: '/journal/', title: 'Journal', status: 'published' },
  { slug: 'music', route: '/music/', title: 'Music', status: 'published' },
  { slug: 'video', route: '/video/', title: 'Video', status: 'published' },
  { slug: 'gallery', route: '/gallery/', title: 'Gallery', status: 'published' },
  { slug: 'experiments', route: '/experiments/', title: 'Experiments', status: 'published' },
]);

const ARTIFACT_COLLECTIONS = ['projects', 'data', 'notes', 'writing', 'journal', 'music', 'video', 'gallery', 'experiments'];

/** Every `[[...]]` in a text: target and optional display text. */
export const WIKILINK = /\[\[([^\[\]|]+?)(?:\|([^\[\]]+?))?\]\]/g;

/** @param {string} text @returns {{ target: string, text?: string, raw: string }[]} */
export function parseWikilinks(text) {
  return [...String(text ?? '').matchAll(WIKILINK)].map((m) => ({ target: m[1].trim(), text: m[2]?.trim(), raw: m[0] }));
}

/** Artifact slugs from content/ (the same files the collections load), plus the page targets. */
export function scanTargets(root = process.cwd()) {
  /** @type {Map<string, Target>} */
  const map = new Map();
  for (const t of PAGE_TARGETS) map.set(t.slug, t);
  for (const collection of ARTIFACT_COLLECTIONS) {
    const dir = join(root, 'content', collection);
    if (!existsSync(dir)) continue;
    const walk = (d) => {
      for (const name of readdirSync(d)) {
        const p = join(d, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (extname(p) === '.md') {
          const { data } = matter(readFileSync(p, 'utf8'));
          if (!data.slug) continue;
          map.set(data.slug, { slug: data.slug, route: `/${collection}/${data.slug}/`, title: data.title ?? data.slug, status: data.status ?? 'draft', collection, file: relative(root, p).replace(/\\/g, '/') });
        }
      }
    };
    walk(dir);
  }
  return map;
}

export const isPreviewBuild = () => process.env.PUBLIC_SITE_ENV === 'preview';

/** A target is visible in production when published or archived; preview builds also render drafts. */
export function isVisibleTarget(target, preview = isPreviewBuild()) {
  if (!target) return false;
  if (target.status === 'published' || target.status === 'archived') return true;
  return preview && (target.status === 'draft' || target.status === 'review');
}

/** @returns {Target | undefined} the visible target, or undefined when the link is unresolved */
export function resolveWikilink(slug, targets, preview = isPreviewBuild()) {
  const t = targets.get(slug);
  return isVisibleTarget(t, preview) ? t : undefined;
}

let cache = { at: 0, targets: /** @type {Map<string, Target> | null} */ (null) };
function targetsCached() {
  const now = Date.now();
  if (!cache.targets || now - cache.at > 2000) cache = { at: now, targets: scanTargets() };
  return cache.targets;
}

/** Split one mdast text node into text, link, and html nodes. Exported for the tests. */
export function splitTextNode(value, targets, preview, file) {
  const out = [];
  let last = 0;
  for (const m of value.matchAll(WIKILINK)) {
    const index = m.index ?? 0;
    if (index > last) out.push({ type: 'text', value: value.slice(last, index) });
    const slug = m[1].trim();
    const label = m[2]?.trim();
    const target = resolveWikilink(slug, targets, preview);
    if (target) {
      out.push({ type: 'link', url: target.route, title: null, children: [{ type: 'text', value: label ?? target.title }] });
    } else if (preview) {
      // Flagged, visible, and never a dead anchor: the preview reader sees exactly what is broken.
      out.push({ type: 'html', value: `<span class="unresolved-link" title="unresolved wikilink">[[${slug}]]</span>` });
    } else {
      throw new Error(`unresolved wikilink [[${slug}]] in ${file ?? 'a Markdown body'}: no published artifact or page has that slug`);
    }
    last = index + m[0].length;
  }
  if (last < value.length) out.push({ type: 'text', value: value.slice(last) });
  return out;
}

/** The Sätteri mdast plugin (Astro 7's Markdown processor): every text node outside code is split
 *  around its wikilinks; code and inline code are their own node types and are never visited. */
export const wikilinksPlugin = {
  name: 'wikilinks',
  text(node, ctx) {
    WIKILINK.lastIndex = 0;
    if (!WIKILINK.test(node.value)) return;
    WIKILINK.lastIndex = 0;
    const path = ctx.fileURL ? relative(process.cwd(), fileURLToPath(ctx.fileURL)).replace(/\\/g, '/') : undefined;
    ctx.replaceNode(node, splitTextNode(node.value, targetsCached(), isPreviewBuild(), path));
  },
};

/** Unresolved wikilinks across content/ for the validator and the report: [{ file, slug }]. */
export function unresolvedWikilinks(root = process.cwd(), preview = isPreviewBuild()) {
  const targets = scanTargets(root);
  const out = [];
  for (const t of targets.values()) {
    if (!t.file) continue;
    const { content } = matter(readFileSync(resolve(root, t.file), 'utf8'));
    for (const link of parseWikilinks(stripCode(content))) {
      if (!resolveWikilink(link.target, targets, preview)) out.push({ file: t.file, slug: link.target });
    }
  }
  return out;
}

/** Fenced and inline code never carry wikilinks. */
export function stripCode(markdown) {
  return String(markdown ?? '').replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
}
