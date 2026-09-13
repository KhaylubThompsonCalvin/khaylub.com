// The public knowledge graph (ADR-006, doc 07 section 2, doc 28 graph rules, P2-CE-08), computed at
// build from four sources in this precedence: curated `related` (frontmatter), wikilinks in bodies,
// shared skills, shared tags. Technologies make no edges (too dense). An edge exists only when both
// ends are visible in the current build, so a private or draft node never leaks by construction.
// Backlinks and orphans count curated relations and wikilinks only; the related rail adds the
// vocabulary neighbours after them.
import { allVisible, routeFor, type AnyEntry } from './catalog';
import { parseWikilinks, scanTargets, resolveWikilink, isPreviewBuild, stripCode } from './wikilinks.mjs';

export type EdgeKind = 'related' | 'wikilink' | 'skill' | 'tag';
export type Edge = { from: string; to: string; kind: EdgeKind; via?: string };
export type Node = { slug: string; title: string; collection: string; route: string; entry: AnyEntry };
export type Graph = { nodes: Node[]; bySlug: Map<string, Node>; edges: Edge[]; unresolved: { slug: string; from: string }[] };

let cached: Promise<Graph> | undefined;

/** Build (once per process) the graph over every visible artifact. */
export function buildGraph(): Promise<Graph> {
  cached ??= (async () => {
    const entries = await allVisible();
    const nodes: Node[] = entries.map((entry) => ({ slug: entry.data.slug, title: entry.data.title, collection: entry.collection, route: routeFor(entry), entry }));
    const bySlug = new Map(nodes.map((n) => [n.slug, n]));
    const targets = scanTargets();
    const preview = isPreviewBuild();
    const edges: Edge[] = [];
    const unresolved: { slug: string; from: string }[] = [];
    const seen = new Set<string>();
    const add = (e: Edge) => {
      const key = `${e.kind}:${e.from}>${e.to}:${e.via ?? ''}`;
      if (e.from !== e.to && !seen.has(key)) {
        seen.add(key);
        edges.push(e);
      }
    };
    for (const n of nodes) {
      const d = n.entry.data as { related?: string[]; skills?: string[]; tags?: string[] };
      for (const r of d.related ?? []) if (bySlug.has(r)) add({ from: n.slug, to: r, kind: 'related' });
      const body = ((n.entry as unknown as { body?: string }).body ?? '') as string;
      for (const link of parseWikilinks(stripCode(body))) {
        const target = resolveWikilink(link.target, targets, preview);
        if (!target) unresolved.push({ slug: link.target, from: n.slug });
        else if (bySlug.has(target.slug)) add({ from: n.slug, to: target.slug, kind: 'wikilink' });
      }
    }
    // Vocabulary edges, both directions, one per shared term.
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i].entry.data as { skills?: string[]; tags?: string[] };
        const b = nodes[j].entry.data as { skills?: string[]; tags?: string[] };
        for (const s of a.skills ?? []) if (b.skills?.includes(s)) { add({ from: nodes[i].slug, to: nodes[j].slug, kind: 'skill', via: s }); add({ from: nodes[j].slug, to: nodes[i].slug, kind: 'skill', via: s }); }
        for (const t of a.tags ?? []) if (b.tags?.includes(t)) { add({ from: nodes[i].slug, to: nodes[j].slug, kind: 'tag', via: t }); add({ from: nodes[j].slug, to: nodes[i].slug, kind: 'tag', via: t }); }
      }
    }
    return { nodes, bySlug, edges, unresolved };
  })();
  return cached;
}

const byTitle = (a: Node, b: Node) => a.title.localeCompare(b.title);
const isRelation = (e: Edge) => e.kind === 'related' || e.kind === 'wikilink';

/** "Referenced by": every visible artifact whose curated relations or body wikilinks point here. */
export async function backlinksFor(slug: string): Promise<Node[]> {
  const g = await buildGraph();
  const from = new Set(g.edges.filter((e) => isRelation(e) && e.to === slug).map((e) => e.from));
  return [...from].map((s) => g.bySlug.get(s)!).filter(Boolean).sort(byTitle);
}

/** Curated relations out of an artifact, in the author's order. */
export async function curatedFor(slug: string): Promise<Node[]> {
  const g = await buildGraph();
  const d = g.bySlug.get(slug)?.entry.data as { related?: string[] } | undefined;
  return (d?.related ?? []).map((s) => g.bySlug.get(s)).filter((n): n is Node => !!n);
}

export const RAIL_MAX = 6;

/** The related rail (FR-E3, doc 28 rule 5): curated relations first (outgoing in the author's order,
 *  then inbound by title), then vocabulary neighbours ranked by shared skills and tags; at most six;
 *  at least one item from another collection when one exists among the candidates. */
export async function relatedRail(slug: string): Promise<{ node: Node; why: string }[]> {
  const g = await buildGraph();
  const self = g.bySlug.get(slug);
  if (!self) return [];
  const chosen: { node: Node; why: string }[] = [];
  const have = new Set<string>([slug]);
  const push = (node: Node, why: string) => {
    if (!have.has(node.slug)) {
      have.add(node.slug);
      chosen.push({ node, why });
    }
  };
  for (const n of await curatedFor(slug)) push(n, 'Chosen by the author');
  for (const n of await backlinksFor(slug)) push(n, 'References this page');
  // Vocabulary neighbours: score = shared skills (weight 2) + shared tags (weight 1).
  const score = new Map<string, { skills: string[]; tags: string[] }>();
  for (const e of g.edges) {
    if (e.from !== slug || (e.kind !== 'skill' && e.kind !== 'tag')) continue;
    const s = score.get(e.to) ?? { skills: [], tags: [] };
    (e.kind === 'skill' ? s.skills : s.tags).push(e.via ?? '');
    score.set(e.to, s);
  }
  const vocab = [...score]
    .map(([to, s]) => ({ node: g.bySlug.get(to)!, score: s.skills.length * 2 + s.tags.length, why: s.skills.length ? `Shares ${s.skills.length === 1 ? 'a skill' : `${s.skills.length} skills`}` : `Shares ${s.tags.length === 1 ? 'a tag' : `${s.tags.length} tags`}` }))
    .filter((c) => c.node && !have.has(c.node.slug))
    .sort((a, b) => b.score - a.score || byTitle(a.node, b.node));
  for (const c of vocab) {
    if (chosen.length >= RAIL_MAX) break;
    push(c.node, c.why);
  }
  let rail = chosen.slice(0, RAIL_MAX);
  // At least one other collection when any candidate offers one (ADR-006).
  if (rail.length && rail.every((r) => r.node.collection === self.collection)) {
    const other = [...chosen.slice(RAIL_MAX), ...vocab.map((c) => ({ node: c.node, why: c.why }))].find((c) => c.node.collection !== self.collection && !rail.some((r) => r.node.slug === c.node.slug));
    if (other) rail = [...rail.slice(0, RAIL_MAX - 1), other];
  }
  return rail;
}

export type Sequence = { prev?: Node; next?: Node; series?: { name: string; part: number; total: number } };

/** Previous and next (FR-E4): within a series by part; otherwise within the collection by date, oldest first. */
export async function prevNext(slug: string): Promise<Sequence> {
  const g = await buildGraph();
  const self = g.bySlug.get(slug);
  if (!self) return {};
  const d = self.entry.data as { series?: string; part?: number };
  if (d.series) {
    const siblings = g.nodes.filter((n) => (n.entry.data as { series?: string }).series === d.series).sort((a, b) => ((a.entry.data as { part?: number }).part ?? 0) - ((b.entry.data as { part?: number }).part ?? 0) || byTitle(a, b));
    const i = siblings.findIndex((n) => n.slug === slug);
    return { prev: siblings[i - 1], next: siblings[i + 1], series: { name: d.series, part: d.part ?? i + 1, total: siblings.length } };
  }
  const siblings = g.nodes.filter((n) => n.collection === self.collection).sort((a, b) => a.entry.data.date.getTime() - b.entry.data.date.getTime() || byTitle(a, b));
  const i = siblings.findIndex((n) => n.slug === slug);
  return { prev: siblings[i - 1], next: siblings[i + 1] };
}

/** Orphans (FR-E6, ADR-006): no curated relation and no wikilink in either direction. */
export async function orphans(): Promise<Node[]> {
  const g = await buildGraph();
  const linked = new Set<string>();
  for (const e of g.edges) if (isRelation(e)) { linked.add(e.from); linked.add(e.to); }
  return g.nodes.filter((n) => !linked.has(n.slug)).sort(byTitle);
}

/** Relation edges only (curated and wikilink), for the list and the map. */
export async function relationEdges(): Promise<Edge[]> {
  return (await buildGraph()).edges.filter(isRelation);
}
