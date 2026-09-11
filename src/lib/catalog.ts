// The catalog: every artifact the site knows about, with the public/private filter applied.
// Production renders only published and archived items; preview builds also render drafts and
// items under review (each with a banner). Nothing else exists to the build.
import { getCollection, type CollectionEntry } from 'astro:content';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { isPreview, currentTop8 } from './profile';
import { vocabulary, contentPath } from '../content/schemas';

export type ArtifactCollection =
  | 'projects'
  | 'data'
  | 'notes'
  | 'writing'
  | 'journal'
  | 'music'
  | 'video'
  | 'gallery'
  | 'experiments';

export const COLLECTIONS: { name: ArtifactCollection; label: string; route: string; description: string }[] = [
  { name: 'projects', label: 'Projects', route: '/projects/', description: 'Software and systems work with a case study and an honest status.' },
  { name: 'data', label: 'Data', route: '/data/', description: 'Analyses with the question, the data, the method, and the result.' },
  { name: 'notes', label: 'Field Notes', route: '/notes/', description: 'Technical write-ups: architecture, preservation, performance, lessons.' },
  { name: 'writing', label: 'Writing', route: '/writing/', description: 'Essays and poems.' },
  { name: 'journal', label: 'Journal', route: '/journal/', description: 'Dated entries.' },
  { name: 'music', label: 'Music', route: '/music/', description: 'Tracks, with lyrics or a description.' },
  { name: 'video', label: 'Video', route: '/video/', description: 'Films and recordings behind posters.' },
  { name: 'gallery', label: 'Gallery', route: '/gallery/', description: 'Stills and renders.' },
  { name: 'experiments', label: 'Experiments', route: '/experiments/', description: 'Prototypes and exhibits, including the climb.' },
];

export type AnyEntry = CollectionEntry<ArtifactCollection>;

export function isVisible(status: string): boolean {
  if (status === 'published' || status === 'archived') return true;
  return isPreview() && (status === 'draft' || status === 'review');
}

export async function published(name: ArtifactCollection): Promise<AnyEntry[]> {
  const entries = (await getCollection(name as any)) as AnyEntry[];
  return entries
    .filter((e) => isVisible(e.data.status))
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export async function allVisible(): Promise<AnyEntry[]> {
  const lists = await Promise.all(COLLECTIONS.map((c) => published(c.name)));
  return lists.flat();
}

export function routeFor(entry: AnyEntry): string {
  return `/${entry.collection}/${entry.data.slug}/`;
}

export function collectionLabel(name: string): string {
  return COLLECTIONS.find((c) => c.name === name)?.label ?? name;
}

/** Badge text for an entry: project status for projects, otherwise collection or lifecycle. */
export function badgeFor(entry: AnyEntry): { text: string; tone: 'live' | 'default' } {
  if (entry.collection === 'projects') {
    const s = (entry.data as CollectionEntry<'projects'>['data']).project_status;
    const text: Record<string, string> = {
      live: 'Live',
      prototype: 'Prototype',
      'private-beta': 'Private beta',
      concept: 'Concept',
      archived: 'Archived',
    };
    return { text: text[s] ?? s, tone: s === 'live' ? 'live' : 'default' };
  }
  if (entry.data.status === 'archived') return { text: 'Archived', tone: 'default' };
  if (entry.data.status !== 'published') return { text: `Draft (${entry.data.status})`, tone: 'default' };
  if (entry.collection === 'data') return { text: 'Published', tone: 'default' };
  return { text: collectionLabel(entry.collection), tone: 'default' };
}

/** The featured launch set in the approved D-10 order. Exactly three. */
export const FEATURED_ORDER = ['khaylub-com-v1', 'fuel-economy-regression', 'sql-python-analytics-pipeline'];

export async function featured(): Promise<AnyEntry[]> {
  const all = await allVisible();
  const flagged = all.filter((e) => e.data.featured && e.data.employer_visible);
  const bySlug = new Map(flagged.map((e) => [e.data.slug, e]));
  return FEATURED_ORDER.map((s) => bySlug.get(s)).filter((e): e is AnyEntry => !!e);
}

export type VocabKind = 'tags' | 'skills' | 'technologies';
export type Term = { slug: string; label: string; description?: string; area?: string };

/** Vocabulary terms with labels. schemas.ts validates the same files; this re-reads them for display
 *  on every call so `astro dev` picks up a label edit without a restart. */
export function vocabularyTerms(kind: VocabKind): Term[] {
  vocabulary(kind);
  return (load(readFileSync(contentPath('vocabulary', `${kind}.yaml`), 'utf8')) as { terms: Term[] }).terms;
}

export function labelFor(kind: VocabKind, slug: string): string {
  return vocabularyTerms(kind).find((t) => t.slug === slug)?.label ?? slug;
}

export function termLabels(kind: VocabKind, slugs: string[] | undefined): string[] {
  return (slugs ?? []).map((s) => labelFor(kind, s));
}

export type Evidence = Term & { count: number; items: AnyEntry[] };

/** An artifact counts as evidence when it is published and employer-visible. */
async function evidencePool(): Promise<AnyEntry[]> {
  return (await allVisible()).filter((e) => e.data.employer_visible && e.data.status === 'published');
}

/** Terms with the public artifacts that prove them. Terms with no evidence are omitted; nothing is rated. */
export async function evidenceFor(kind: 'skills' | 'technologies'): Promise<Evidence[]> {
  const pool = await evidencePool();
  return vocabularyTerms(kind)
    .map((t) => {
      const items = pool.filter((e) => ((e.data as Record<string, unknown>)[kind] as string[] | undefined)?.includes(t.slug));
      return { ...t, count: items.length, items };
    })
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Skills with evidence grouped by the area named in skills.yaml, in the file's order; terms without an area last. */
export async function skillGroups(): Promise<{ area: string; skills: Evidence[] }[]> {
  const named = [...new Set(vocabularyTerms('skills').map((t) => t.area).filter((a): a is string => !!a))];
  const order = [...named, 'Other'];
  const skills = await evidenceFor('skills');
  return order
    .map((area) => ({ area, skills: skills.filter((s) => (s.area ?? 'Other') === area) }))
    .filter((g) => g.skills.length > 0);
}

/** Current Top 8 resolved to visible entries. Unpublished slots are skipped and later items move up. */
export async function top8Entries(): Promise<{ asOf: string; entries: { entry: AnyEntry; reason: string }[] }> {
  const rev = currentTop8();
  const all = await allVisible();
  const bySlug = new Map(all.filter((e) => e.data.status === 'published').map((e) => [e.data.slug, e]));
  const entries = rev.items
    .map((i) => ({ entry: bySlug.get(i.slug), reason: i.reason }))
    .filter((x): x is { entry: AnyEntry; reason: string } => !!x.entry)
    .slice(0, 8);
  return { asOf: rev.as_of, entries };
}

/* ---------- Collection browsing (Phase 11): sorts and filters as pre-rendered pages ---------- */

export type SortOrder = 'newest' | 'oldest' | 'title';
export const SORT_ORDERS: { order: SortOrder; label: string }[] = [
  { order: 'newest', label: 'Newest' },
  { order: 'oldest', label: 'Oldest' },
  { order: 'title', label: 'Title' },
];

export function sortEntries(entries: AnyEntry[], order: SortOrder): AnyEntry[] {
  const copy = [...entries];
  if (order === 'oldest') return copy.sort((a, b) => a.data.date.getTime() - b.data.date.getTime());
  if (order === 'title') return copy.sort((a, b) => a.data.title.localeCompare(b.data.title));
  return copy.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

const TYPE_LABELS: Record<string, string> = {
  'case-study': 'Case study', concept: 'Concept', exhibit: 'Exhibit',
  analysis: 'Analysis', notebook: 'Notebook', dataset: 'Dataset', story: 'Story',
  'field-note': 'Field note', retrospective: 'Retrospective', 'how-to': 'How-to',
  essay: 'Essay', poem: 'Poem', fiction: 'Fiction', 'book-note': 'Book note', entry: 'Entry',
  track: 'Track', film: 'Film', recording: 'Recording', 'concept-film': 'Concept film',
  still: 'Still', set: 'Set', render: 'Render', prototype: 'Prototype',
  live: 'Live', 'private-beta': 'Private beta', archived: 'Archived',
};

/** The filterable "type" of an entry: project status for projects, the schema `type` elsewhere. */
export function typeOf(entry: AnyEntry): string {
  const d = entry.data as Record<string, any>;
  return entry.collection === 'projects' ? d.project_status : d.type;
}
export const typeLabel = (slug: string) => TYPE_LABELS[slug] ?? slug;

export type FilterOption = { slug: string; label: string; count: number; href: string };
export type FilterOptions = { types: FilterOption[]; tags: FilterOption[]; series: FilterOption[] };

/** Filter links for a collection index, counted from its visible entries. Only values that occur become links. */
export function filterOptions(name: ArtifactCollection, entries: AnyEntry[]): FilterOptions {
  const count = (values: (string | undefined)[]) => {
    const m = new Map<string, number>();
    for (const v of values) if (v) m.set(v, (m.get(v) ?? 0) + 1);
    return m;
  };
  const types = [...count(entries.map(typeOf))].map(([slug, n]) => ({ slug, label: typeLabel(slug), count: n, href: `/${name}/type/${slug}/` }));
  const tags = [...count(entries.flatMap((e) => e.data.tags))].map(([slug, n]) => ({ slug, label: labelFor('tags', slug), count: n, href: `/${name}/tag/${slug}/` }));
  const series = [...count(entries.map((e) => (e.data as Record<string, any>).series))].map(([slug, n]) => ({ slug, label: slug.replace(/-/g, ' '), count: n, href: `/${name}/series/${slug}/` }));
  const byCount = (a: FilterOption, b: FilterOption) => b.count - a.count || a.label.localeCompare(b.label);
  return { types: types.sort(byCount), tags: tags.sort(byCount), series: series.sort(byCount) };
}

export async function collectionCounts(): Promise<{ name: ArtifactCollection; label: string; route: string; description: string; count: number }[]> {
  return Promise.all(
    COLLECTIONS.map(async (c) => ({ ...c, count: (await published(c.name)).length }))
  );
}
