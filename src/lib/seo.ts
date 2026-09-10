// JSON-LD builders. Generated from profile data and frontmatter, never hand-written per page.
import { identity } from './profile';
import type { AnyEntry } from './catalog';

const site = 'https://khaylub.com';

export function personAndWebsite() {
  const id = identity();
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: id.name,
      url: `${site}/`,
      jobTitle: id.role_line,
      email: `mailto:${id.email}`,
      sameAs: [id.github, id.linkedin],
      address: { '@type': 'PostalAddress', addressLocality: id.location.split(',')[0]?.trim(), addressRegion: 'OR' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: id.site_name,
      url: `${site}/`,
      author: { '@type': 'Person', name: id.name },
    },
  ];
}

const typeFor: Record<string, string> = {
  projects: 'SoftwareSourceCode',
  data: 'Dataset',
  notes: 'Article',
  writing: 'Article',
  journal: 'BlogPosting',
  music: 'MusicRecording',
  video: 'VideoObject',
  gallery: 'ImageObject',
  experiments: 'CreativeWork',
};

export function creativeWork(entry: AnyEntry, path: string) {
  const id = identity();
  const data = entry.data as any;
  const record: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': typeFor[entry.collection] ?? 'CreativeWork',
    name: data.title,
    description: data.summary,
    url: `${site}${path}`,
    datePublished: data.date.toISOString().slice(0, 10),
    author: { '@type': 'Person', name: id.name },
    keywords: (data.tags ?? []).join(', '),
  };
  if (data.updated) record.dateModified = data.updated.toISOString().slice(0, 10);
  if (entry.collection === 'projects' && data.links?.code) record.codeRepository = data.links.code;
  if (entry.collection === 'data' && data.repository) record.isBasedOn = data.repository;
  return record;
}

export function breadcrumbs(trail: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: `${site}${t.path}`,
    })),
  };
}
