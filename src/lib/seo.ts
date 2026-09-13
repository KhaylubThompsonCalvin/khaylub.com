// JSON-LD builders. Generated from profile data, the vocabularies, and frontmatter; never hand-written per page.
import { identity, education, regionOf } from './profile';
import { evidenceFor, termLabels, type AnyEntry } from './catalog';

const site = 'https://khaylub.com';

export async function personAndWebsite() {
  const id = identity();
  const skills = await evidenceFor('skills');
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: id.name,
      url: `${site}/`,
      jobTitle: id.role_line,
      email: `mailto:${id.email}`,
      sameAs: [id.github, id.linkedin],
      address: { '@type': 'PostalAddress', addressLocality: id.location.split(',')[0]?.trim(), addressRegion: regionOf(id.location) },
      alumniOf: education().entries.map((e) => ({ '@type': 'EducationalOrganization', name: e.institution })),
      // Only skills with published, employer-visible evidence on this site; never a self-rating.
      knowsAbout: skills.map((s) => s.label),
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

export type MediaFacts = { thumbnailUrl?: string; contentUrl?: string };

export function creativeWork(entry: AnyEntry, path: string, media: MediaFacts = {}) {
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
    keywords: [
      ...termLabels('tags', data.tags),
      ...termLabels('skills', data.skills),
      ...termLabels('technologies', data.technologies),
    ].join(', '),
  };
  if (data.updated) record.dateModified = data.updated.toISOString().slice(0, 10);
  if (entry.collection === 'projects' && data.links?.code) record.codeRepository = data.links.code;
  if (entry.collection === 'data' && data.repository) record.isBasedOn = data.repository;
  // Media records (schema.org): a VideoObject needs thumbnailUrl and uploadDate; a MusicRecording
  // carries its duration; an ImageObject its content URL. All from frontmatter and the pipeline.
  if (media.thumbnailUrl) record.thumbnailUrl = media.thumbnailUrl;
  if (media.contentUrl) record.contentUrl = media.contentUrl;
  if (entry.collection === 'video' || entry.collection === 'experiments') record.uploadDate = record.datePublished;
  if (entry.collection === 'music' && data.duration) {
    const [m, s] = String(data.duration).split(':').map(Number);
    record.duration = `PT${m}M${s}S`;
  }
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
