// The catalog: every artifact the site knows about, with the public/private filter applied.
// Production renders only published and archived items; preview builds also render drafts and
// items under review (each with a banner). Nothing else exists to the build.
import { getCollection, type CollectionEntry } from 'astro:content';
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

export type SkillEvidence = { slug: string; label: string; description?: string; count: number; items: AnyEntry[] };

/** Skills with evidence counts from published, employer-visible artifacts. Zero-evidence skills are omitted. */
export async function skillsWithEvidence(): Promise<SkillEvidence[]> {
  const all = (await allVisible()).filter((e) => e.data.employer_visible && e.data.status === 'published');
  const terms = vocabularyTerms('skills');
  return terms
    .map((t) => {
      const items = all.filter((e) => (e.data.skills ?? []).includes(t.slug));
      return { ...t, count: items.length, items: items.slice(0, 3) };
    })
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';

export function vocabularyTerms(name: 'tags' | 'skills' | 'technologies'): { slug: string; label: string; description?: string }[] {
  // Re-read for labels; schemas.ts validates the same files.
  vocabulary(name);
  const file = readFileSync(contentPath('vocabulary', `${name}.yaml`), 'utf8');
  return (load(file) as { terms: { slug: string; label: string; description?: string }[] }).terms;
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

export async function collectionCounts(): Promise<{ name: ArtifactCollection; label: string; route: string; description: string; count: number }[]> {
  return Promise.all(
    COLLECTIONS.map(async (c) => ({ ...c, count: (await published(c.name)).length }))
  );
}
