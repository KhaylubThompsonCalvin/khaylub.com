// The Studio's field tables: one per collection the Studio edits, each key a frontmatter key the
// site's Zod schema (src/content/schemas.ts) accepts, plus the body. keystatic.config.ts builds the
// forms from these tables; tests/studio-config.spec.ts in the public site's suite proves every table
// equals its Zod schema (keys both ways with the deferred set, required flags, enum and vocabulary
// options, nested keys), so the two cannot drift silently. No imports: this file is read by the
// Studio's browser bundle and by the site's test runner alike.

export const STATUS = ['idea', 'draft', 'review', 'published', 'archived'] as const;
export const VOCABULARIES = ['tags', 'skills', 'technologies'] as const;
export type Vocabulary = (typeof VOCABULARIES)[number];

export const NOTE_TYPES = ['field-note', 'retrospective', 'how-to'] as const;
export const WRITING_TYPES = ['essay', 'poem', 'fiction', 'book-note'] as const;
export const JOURNAL_TYPES = ['entry'] as const;
export const PROJECT_TYPES = ['case-study', 'concept', 'exhibit'] as const;
export const PROJECT_STATUS = ['live', 'prototype', 'private-beta', 'concept', 'archived'] as const;
export const MUSIC_TYPES = ['track'] as const;
export const VIDEO_TYPES = ['film', 'recording', 'concept-film'] as const;
export const GALLERY_TYPES = ['still', 'set', 'render'] as const;

// Matches the site's slug rule: lowercase letters, digits, single hyphens.
export const SLUG_PATTERN = '^[a-z0-9]+(?:-[a-z0-9]+)*$';
// The same rule for an optional text field: Keystatic validates a pattern against the empty value
// too, so an optional slug-shaped field must accept empty (Keystatic then omits the key on save).
export const SLUG_OR_EMPTY_PATTERN = '^(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$';
// A music duration, minutes and two-digit seconds.
export const DURATION_PATTERN = '^\\d+:\\d{2}$';
// A file name the site serves from public/media/<slug>/ (audio, video, captions), or empty (for the
// single optional `captions` field; list items are always required, so the empty case never applies
// to `files`).
export const MEDIA_FILE_PATTERN = '^(?:[A-Za-z0-9._-]+\\.(?:mp4|webm|mp3|ogg|vtt))?$';

// The thirteen headings a case study carries in order (tests/casestudy.spec.ts); offered as the
// body template for projects.
export const CASE_STUDY_HEADINGS = [
  'Problem', 'Why it mattered', 'Requirements', 'Design', 'Technology choices', 'Why these choices',
  'What I built', 'What went wrong', 'Verification', 'What I would change', 'What I learned', 'Code', 'Result',
] as const;

export type FieldSpec =
  // The entry name: stored under this key in the frontmatter and used as the file or folder name.
  | { kind: 'slug'; required: true; description: string }
  // `min` only on a required field: Keystatic treats a minimum length as "required" (the empty value
  // fails it), while the site's schema applies its minimum only when the key is present. An optional
  // text field therefore carries its maximum here and states its minimum in the description; the
  // minimum is enforced at validate and CI (context, problem, role, cover_alt).
  | { kind: 'text'; required: boolean; multiline?: boolean; min?: number; max?: number; pattern?: string; description?: string }
  | { kind: 'url'; required: boolean; description?: string }
  | { kind: 'select'; required: true; options: readonly string[]; defaultValue: string; description?: string }
  // Keystatic's multiselect has no minimum; "at least one" is the schema's rule, enforced at validate.
  | { kind: 'multiselect'; required: boolean; vocabulary: Vocabulary; description?: string }
  | { kind: 'date'; required: boolean; description?: string }
  | { kind: 'checkbox'; required: boolean; defaultValue: boolean; description?: string }
  | { kind: 'integer'; required: boolean; min?: number; max?: number; description?: string }
  | { kind: 'array-text'; required: boolean; pattern?: string; description?: string }
  // An image file stored beside the entry; the frontmatter carries its file name.
  | { kind: 'image'; required: boolean; description?: string }
  // A group written as a nested object on every save, so only for keys the schema requires.
  | { kind: 'object'; required: boolean; fields: Record<string, FieldSpec>; description?: string }
  // A list of groups; each item written as a nested object. A required list needs at least one item
  // (the config derives that minimum from `required` when `min` is unset).
  | { kind: 'array-object'; required: boolean; min?: number; fields: Record<string, FieldSpec>; description?: string }
  // The Markdown body (the file's content below the frontmatter), not a frontmatter key.
  | { kind: 'body'; description?: string };

export const BODY_KEY = 'body';

export type CollectionSpec = {
  label: string;
  // The navigation group in the Studio's sidebar; the config builds the navigation from these.
  group: 'Writing' | 'Work' | 'Media';
  // The site's loader: single files (content/<name>/<slug>.md) or folders (content/<name>/<slug>/index.md).
  layout: 'file' | 'folder';
  // Keystatic's entry layout: the body first ('content') or the fields first ('form').
  editor: 'content' | 'form';
  description: string;
  // Schema keys this form does not offer, each optional in the schema, with the owning phase.
  deferred: readonly string[];
  fields: Record<string, FieldSpec>;
};

const PROVENANCE_FIELDS: Record<string, FieldSpec> = {
  source: { kind: 'text', required: true, multiline: true, min: 3, description: 'Where the media comes from and who made it; name the tools if any were generated.' },
  license: { kind: 'text', required: true, min: 2, description: 'An SPDX id or "All rights reserved".' },
  generator: { kind: 'text', required: false, description: 'The AI tool or service, when part of the media was generated.' },
  date: { kind: 'date', required: true },
};

// The keys every collection shares, in the order the form shows them. `type` is inserted per
// collection after `title`; `problem` and `role` belong to projects only.
const common = (type: FieldSpec): Record<string, FieldSpec> => ({
  slug: { kind: 'slug', required: true, description: 'Lowercase letters, digits, and single hyphens; permanent; unique across every collection; also the file name.' },
  title: { kind: 'text', required: true, min: 3, max: 90 },
  type,
  status: { kind: 'select', required: true, options: STATUS, defaultValue: 'draft', description: 'Only published entries appear on the public site.' },
  date: { kind: 'date', required: true },
  updated: { kind: 'date', required: false, description: 'On or after the date, if set (checked at validate).' },
  summary: { kind: 'text', required: true, multiline: true, min: 40, max: 240, description: 'One or two sentences, 40 to 240 characters; shown on cards, in search, and in feeds.' },
  tags: { kind: 'multiselect', required: true, vocabulary: 'tags', description: 'At least one; the site refuses an entry without a tag.' },
  skills: { kind: 'multiselect', required: false, vocabulary: 'skills' },
  technologies: { kind: 'multiselect', required: false, vocabulary: 'technologies' },
  employer_visible: { kind: 'checkbox', required: true, defaultValue: false, description: 'Show this entry on the Work page (the employer lane).' },
  source: { kind: 'text', required: true, min: 1, multiline: true, description: 'Where the claims come from: a URL or a short statement.' },
  related: { kind: 'array-text', required: false, pattern: SLUG_PATTERN, description: 'Slugs of other artifacts; each must exist (checked at validate).' },
  ai_assisted: { kind: 'checkbox', required: false, defaultValue: false, description: 'Renders the one-sentence disclosure.' },
  license: { kind: 'text', required: false, description: 'An SPDX id or "All rights reserved".' },
});

const SERIES: Record<string, FieldSpec> = {
  series: { kind: 'text', required: false, pattern: SLUG_OR_EMPTY_PATTERN, description: 'A series slug (lowercase letters, digits, single hyphens) when the entry belongs to one.' },
  part: { kind: 'integer', required: false, min: 1, description: 'The position in the series, from 1.' },
};

// Since Phase 27 every collection offers the optional cover, its alt text, and the provenance group:
// Keystatic writes an untouched optional group as `provenance: {}`, which the site's schema now reads
// as absent, and validate demands a real record wherever media is referenced. `featured` stays
// Git-only because the featured set is owner-approved and checked by validate. `problem` and `role`
// are the case-study card (CONTENT.md) and are offered on projects only, a Phase 25 decision: the
// Phase 24 notes form offered them, and nothing on the site reads them for a note.
const PROSE_DEFERRED = ['featured', 'problem', 'role'] as const;
// Projects offer the case-study card fields (problem, role); the media collections offer neither
// them nor the series fields, which belong to prose.
const PROJECT_DEFERRED = ['featured'] as const;
const MEDIA_DEFERRED = ['featured', 'problem', 'role', 'series', 'part'] as const;

const bodyProse: FieldSpec = { kind: 'body', description: 'Markdown. Link other artifacts with [[slug]] or [[slug|the words]].' };

// The optional cover with its alt text and the provenance group (the credits). A cover needs both:
// the site refuses a cover without alt text or without a real provenance record, at validate.
const OPTIONAL_COVER: Record<string, FieldSpec> = {
  cover: { kind: 'image', required: false, description: 'Optional cover image, 1600 px wide; it needs the alt text and the credits below (checked at validate).' },
  cover_alt: { kind: 'text', required: false, description: 'The cover for those who cannot see it; at least 5 characters when a cover is set.' },
  provenance: {
    kind: 'object',
    required: false,
    description: 'Credits: fill all of source, license, and date when the entry carries a cover or other media; leave the whole group empty otherwise.',
    fields: {
      source: { kind: 'text', required: false, multiline: true, description: 'Where the media comes from and who made it; name the tools if any were generated (3 or more characters).' },
      license: { kind: 'text', required: false, description: 'An SPDX id or "All rights reserved".' },
      generator: { kind: 'text', required: false, description: 'The AI tool or service, when part of the media was generated.' },
      date: { kind: 'date', required: false },
    },
  },
};

export const collections: Record<string, CollectionSpec> = {
  notes: {
    label: 'Field notes',
    group: 'Writing',
    layout: 'file',
    editor: 'content',
    description: 'Short working notes: field notes, retrospectives, how-tos.',
    deferred: PROSE_DEFERRED,
    fields: {
      ...common({ kind: 'select', required: true, options: NOTE_TYPES, defaultValue: 'field-note' }),
      ...SERIES,
      ...OPTIONAL_COVER,
      [BODY_KEY]: bodyProse,
    },
  },
  writing: {
    label: 'Writing',
    group: 'Writing',
    layout: 'file',
    editor: 'content',
    description: 'Essays, poems, fiction, book notes.',
    deferred: PROSE_DEFERRED,
    fields: {
      ...common({ kind: 'select', required: true, options: WRITING_TYPES, defaultValue: 'essay' }),
      ...SERIES,
      ...OPTIONAL_COVER,
      [BODY_KEY]: bodyProse,
    },
  },
  journal: {
    label: 'Journal',
    group: 'Writing',
    layout: 'file',
    editor: 'content',
    description: 'Dated short entries shown on the profile and the timeline.',
    deferred: PROSE_DEFERRED,
    fields: {
      ...common({ kind: 'select', required: true, options: JOURNAL_TYPES, defaultValue: 'entry' }),
      ...SERIES,
      ...OPTIONAL_COVER,
      [BODY_KEY]: bodyProse,
    },
  },
  projects: {
    label: 'Projects',
    group: 'Work',
    layout: 'folder',
    editor: 'form',
    description: 'School, academic, and technical projects and case studies. The featured set, covers, and figures stay in Git.',
    deferred: PROJECT_DEFERRED,
    fields: {
      ...common({ kind: 'select', required: true, options: PROJECT_TYPES, defaultValue: 'case-study', description: 'A case study carries the thirteen standard headings in the body.' }),
      project_status: { kind: 'select', required: true, options: PROJECT_STATUS, defaultValue: 'concept' },
      // The stack: a project must name at least one technology (the schema's rule).
      technologies: { kind: 'multiselect', required: true, vocabulary: 'technologies', description: 'The stack; at least one (the site refuses a project without one).' },
      context: { kind: 'text', required: false, max: 120, description: 'The course, term, or institution line of a school or academic project, for example "CIS277A, Fall 2026"; 3 to 120 characters when set.' },
      problem: { kind: 'text', required: false, multiline: true, max: 240, description: 'The case-study card: the problem in one or two sentences; 20 to 240 characters when set; required for a featured case study.' },
      role: { kind: 'text', required: false, max: 240, description: 'The case-study card: the author\'s role, stated plainly; 3 to 240 characters when set.' },
      // Written on every save as an object; the schema fills a missing one with {}, so it is optional there.
      links: {
        kind: 'object',
        required: false,
        description: 'Proof links. A featured project needs at least one (checked at validate).',
        fields: {
          code: { kind: 'url', required: false, description: 'The repository.' },
          live: { kind: 'text', required: false, description: 'The live URL or path.' },
          result: { kind: 'text', required: false, description: 'The result: a report, a dashboard, a page.' },
        },
      },
      outcome: { kind: 'text', required: false, max: 200, description: 'One line on the outcome, up to 200 characters.' },
      ...SERIES,
      ...OPTIONAL_COVER,
      [BODY_KEY]: { kind: 'body', description: `Markdown. A case study uses these headings in order: ${CASE_STUDY_HEADINGS.join('; ')}. Link other artifacts with [[slug]].` },
    },
  },
  music: {
    label: 'Audio-visual stories',
    group: 'Media',
    layout: 'folder',
    editor: 'form',
    description: 'A track or spoken piece with its writing in the body; the audio file lives under public/media/<slug>/ or at an external URL.',
    deferred: MEDIA_DEFERRED,
    fields: {
      ...common({ kind: 'select', required: true, options: MUSIC_TYPES, defaultValue: 'track' }),
      duration: { kind: 'text', required: true, pattern: DURATION_PATTERN, description: 'Minutes and seconds, for example 3:42.' },
      files: { kind: 'array-text', required: false, pattern: MEDIA_FILE_PATTERN, description: 'The audio file names under public/media/<slug>/ (mp3, ogg), added by pull request until the media phase. Leave empty when the piece is linked below.' },
      external_url: { kind: 'url', required: false, description: 'The piece itself, when it is hosted elsewhere: the page shows the cover and a link to this address (decision D-07). Fill this or the files list.' },
      cover: { kind: 'image', required: false, description: 'Optional cover art (an image, not the audio), 1600 px wide; needs the alt text below.' },
      cover_alt: { kind: 'text', required: false, description: 'The cover for those who cannot see it; at least 5 characters when a cover is set.' },
      provenance: { kind: 'object', required: true, description: 'Credits: who made the media and under what terms.', fields: PROVENANCE_FIELDS },
      [BODY_KEY]: { kind: 'body', description: 'The writing, lyrics, or transcript. Link other artifacts with [[slug]].' },
    },
  },
  video: {
    label: 'Video',
    group: 'Media',
    layout: 'folder',
    editor: 'form',
    description: 'Films, recordings, concept films. The video itself is not uploaded here: it is either a file under public/media/<slug>/ named in "files", or a link in "external url". The image asked for is the poster, the still frame shown before the video plays and on cards.',
    deferred: MEDIA_DEFERRED,
    fields: {
      ...common({ kind: 'select', required: true, options: VIDEO_TYPES, defaultValue: 'recording' }),
      poster: { kind: 'image', required: true, description: 'Poster (thumbnail) image: the still frame shown before the video plays and on cards. This is an image, not the video. The video itself is the file named below or the external url.' },
      files: { kind: 'array-text', required: false, pattern: MEDIA_FILE_PATTERN, description: 'The video file names under public/media/<slug>/ (mp4, webm), added by pull request until the media phase. Leave empty when the video is linked below.' },
      external_url: { kind: 'url', required: false, description: 'The video itself, when it is hosted elsewhere (YouTube, Vimeo, a drive): the page shows the poster and a link to this address (decision D-07). Fill this or the files list.' },
      speech: { kind: 'checkbox', required: false, defaultValue: false, description: 'The recording contains speech; a captions track is then required (checked at validate).' },
      captions: { kind: 'text', required: false, pattern: MEDIA_FILE_PATTERN, description: 'The WebVTT file name beside the video file.' },
      cover: { kind: 'image', required: false, description: 'Optional: a different card image than the poster; needs the alt text below.' },
      cover_alt: { kind: 'text', required: false, description: 'The cover for those who cannot see it; at least 5 characters when a cover is set.' },
      provenance: { kind: 'object', required: true, description: 'Credits: who made the recording and the poster, and what is in frame.', fields: PROVENANCE_FIELDS },
      [BODY_KEY]: { kind: 'body', description: 'What the video shows. Link other artifacts with [[slug]].' },
    },
  },
  gallery: {
    label: 'Gallery',
    group: 'Media',
    layout: 'folder',
    editor: 'form',
    description: 'Stills, sets, and renders; the images live beside the entry.',
    deferred: MEDIA_DEFERRED,
    fields: {
      ...common({ kind: 'select', required: true, options: GALLERY_TYPES, defaultValue: 'still' }),
      images: {
        kind: 'array-object',
        required: true,
        min: 1,
        description: 'At least one image; each with the alt text for those who cannot see it and an optional visible caption.',
        fields: {
          src: { kind: 'image', required: true, description: '1600 px wide, PNG or WebP.' },
          alt: { kind: 'text', required: true, multiline: true, min: 5, max: 200, description: 'What the image shows, 5 to 200 characters.' },
          caption: { kind: 'text', required: false, max: 120, description: 'The short visible line, up to 120 characters.' },
        },
      },
      cover: { kind: 'image', required: false, description: 'The card image; needs the alt text below.' },
      cover_alt: { kind: 'text', required: false, description: 'The cover for those who cannot see it; at least 5 characters when a cover is set.' },
      provenance: { kind: 'object', required: true, description: 'Credits: who made the images and under what terms.', fields: PROVENANCE_FIELDS },
      [BODY_KEY]: { kind: 'body', description: 'What this is and how it was made. Link other artifacts with [[slug]].' },
    },
  },
};

// Collections the Studio does not edit, by ADR-012's content boundary (Git by default).
export const GIT_ONLY_COLLECTIONS = ['data', 'experiments'] as const;
