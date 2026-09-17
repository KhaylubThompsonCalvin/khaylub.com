// The Studio's description of the `notes` collection: one entry per frontmatter key the site's Zod
// schema (src/content/schemas.ts, `note` = `base` plus `type`, strict) accepts, plus the body.
// keystatic.config.ts builds Keystatic fields from this table; tests/studio-config.spec.ts in the
// public site's suite proves the table equals the Zod schema (keys both ways, required flags, the
// enum and vocabulary option lists), so the two cannot drift silently. No imports: this file is read
// by the Studio's browser bundle and by the site's test runner alike.

export const NOTE_TYPES = ['field-note', 'retrospective', 'how-to'] as const;
export const STATUS = ['idea', 'draft', 'review', 'published', 'archived'] as const;
export const VOCABULARIES = ['tags', 'skills', 'technologies'] as const;
export type Vocabulary = (typeof VOCABULARIES)[number];

// Matches the site's slug rule: lowercase letters, digits, single hyphens.
export const SLUG_PATTERN = '^[a-z0-9]+(?:-[a-z0-9]+)*$';
// The same rule for an optional text field: Keystatic validates a pattern against the empty value
// too, so an optional slug-shaped field must accept empty (Keystatic then omits the key on save).
export const SLUG_OR_EMPTY_PATTERN = '^(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$';

export type FieldSpec =
  // The entry name: stored under this key in the frontmatter and used as the file name.
  | { kind: 'slug'; required: true; description: string }
  | { kind: 'text'; required: boolean; multiline?: boolean; min?: number; max?: number; pattern?: string; description?: string }
  | { kind: 'select'; required: true; options: readonly string[]; defaultValue: string; description?: string }
  // Keystatic's multiselect has no minimum; "at least one tag" is the schema's rule, enforced at validate.
  | { kind: 'multiselect'; required: boolean; vocabulary: Vocabulary; description?: string }
  | { kind: 'date'; required: boolean; description?: string }
  | { kind: 'checkbox'; required: boolean; defaultValue: boolean; description?: string }
  | { kind: 'integer'; required: boolean; description?: string }
  | { kind: 'array-text'; required: boolean; pattern?: string; description?: string }
  | { kind: 'object'; required: boolean; fields: Record<string, FieldSpec>; description?: string }
  // The Markdown body (the file's content below the frontmatter), not a frontmatter key.
  | { kind: 'body' };

export const BODY_KEY = 'body';

// Schema keys the Phase 24 form does not offer. Each is optional in the Zod schema, so a note saved
// without it is valid; each is owned by a later phase: `cover`, `cover_alt`, and `provenance` by the
// media and provenance phase (27), where an optional group with a cover upload replaces free text
// (Keystatic writes an object field on every save, so an optional object cannot be expressed as one);
// `featured` stays Git-only because the featured set is owner-approved and checked by validate.
export const DEFERRED_KEYS = ['cover', 'cover_alt', 'provenance', 'featured'] as const;

// Literal keys (satisfies, not a Record annotation) so keystatic.config.ts can name the slug field
// by type; the test treats it as a plain table.
export const notesFields = {
  slug: { kind: 'slug', required: true, description: 'Lowercase letters, digits, and single hyphens; unique across every collection; also the file name.' },
  title: { kind: 'text', required: true, min: 3, max: 90 },
  type: { kind: 'select', required: true, options: NOTE_TYPES, defaultValue: 'field-note' },
  status: { kind: 'select', required: true, options: STATUS, defaultValue: 'draft', description: 'Only published entries appear on the public site.' },
  date: { kind: 'date', required: true },
  updated: { kind: 'date', required: false, description: 'On or after the date, if set.' },
  summary: { kind: 'text', required: true, multiline: true, min: 40, max: 240, description: 'One or two sentences, 40 to 240 characters; shown on cards and in search.' },
  // Optional text carries no minimum here: Keystatic treats a minimum as "required", while the site's
  // schema applies its minimum only when the key is present. The site's validate step is the judge.
  problem: { kind: 'text', required: false, multiline: true, max: 240, description: 'Only for a featured case study; 20 to 240 characters when set.' },
  role: { kind: 'text', required: false, max: 240, description: 'Only for a featured case study; 3 to 240 characters when set.' },
  tags: { kind: 'multiselect', required: true, vocabulary: 'tags', description: 'At least one; the site refuses a note without a tag.' },
  skills: { kind: 'multiselect', required: false, vocabulary: 'skills' },
  technologies: { kind: 'multiselect', required: false, vocabulary: 'technologies' },
  employer_visible: { kind: 'checkbox', required: true, defaultValue: false, description: 'Show this note on the employer lane.' },
  source: { kind: 'text', required: true, min: 1, description: 'Where the note comes from: a repository, a release, a page.' },
  related: { kind: 'array-text', required: false, pattern: SLUG_PATTERN, description: 'Slugs of other artifacts; each must exist.' },
  series: { kind: 'text', required: false, pattern: SLUG_OR_EMPTY_PATTERN, description: 'A series slug (lowercase letters, digits, single hyphens) when the note belongs to one.' },
  part: { kind: 'integer', required: false },
  ai_assisted: { kind: 'checkbox', required: false, defaultValue: false, description: 'Renders the one-sentence disclosure.' },
  license: { kind: 'text', required: false },
  body: { kind: 'body' },
} satisfies Record<string, FieldSpec>;
