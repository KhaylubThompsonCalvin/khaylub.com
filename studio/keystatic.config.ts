// The owner's publishing Studio (ADR-012, Phase 24). One collection in this phase, `notes`, whose
// fields are built from src/notes-fields.ts, the table the public site's tests hold equal to the
// Zod schema. Paths are relative to the repository root: in local mode the dev server runs with the
// repository root as its working directory (see package.json), and in cloud or GitHub mode
// Keystatic addresses the repository itself. Entries are written as content/notes/<slug>.md with
// YAML frontmatter and a Markdown body, the shape the site's glob loader and schema expect.
import { config, fields, collection, type ComponentSchema } from '@keystatic/core';
import { notesFields, BODY_KEY, SLUG_PATTERN, type FieldSpec } from './src/notes-fields';
import vocabulary from './src/vocabulary.generated.json';

const slugRegex = new RegExp(SLUG_PATTERN);

function field(key: string, spec: FieldSpec): ComponentSchema {
  const label = key.replace(/_/g, ' ');
  switch (spec.kind) {
    case 'slug':
      return fields.slug({
        name: {
          label,
          description: spec.description,
          validation: { pattern: { regex: slugRegex, message: 'lowercase letters, digits, and single hyphens' } },
        },
        slug: { label: 'file name', description: 'Derived from the slug; keep them equal.' },
      });
    case 'text':
      return fields.text({
        label,
        description: spec.description,
        multiline: spec.multiline,
        validation: {
          isRequired: spec.required,
          length: { min: spec.min, max: spec.max },
          ...(spec.pattern ? { pattern: { regex: new RegExp(spec.pattern), message: 'lowercase letters, digits, and single hyphens' } } : {}),
        },
      });
    case 'select':
      return fields.select({
        label,
        description: spec.description,
        options: spec.options.map((value) => ({ label: value, value })),
        defaultValue: spec.defaultValue,
      });
    case 'multiselect':
      return fields.multiselect({
        label,
        description: spec.description,
        options: vocabulary[spec.vocabulary],
      });
    case 'date':
      return fields.date({ label, description: spec.description, validation: { isRequired: spec.required } });
    case 'checkbox':
      return fields.checkbox({ label, description: spec.description, defaultValue: spec.defaultValue });
    case 'integer':
      return fields.integer({ label, description: spec.description, validation: { isRequired: spec.required, min: 1 } });
    case 'array-text':
      return fields.array(
        fields.text({
          label: 'slug',
          validation: spec.pattern ? { pattern: { regex: new RegExp(spec.pattern), message: 'a slug' } } : undefined,
        }),
        { label, description: spec.description, itemLabel: (props) => props.value || 'slug' }
      );
    case 'object':
      return fields.object(
        Object.fromEntries(Object.entries(spec.fields).map(([k, s]) => [k, field(k, s)])),
        { label, description: spec.description }
      );
    case 'body':
      // Markdoc syntax is Markdown for prose, lists, links, and code; the `.md` extension keeps the
      // file in the shape the site reads. Wikilinks ([[slug]]) are plain text to this editor; the
      // Phase 24 smoke test proves they survive a save (plan 47 section 3a).
      return fields.markdoc({ label: 'Body', extension: 'md' });
  }
}

// The slug key is named for Keystatic's type of `slugField`; every other field is a generic schema entry.
const schema = Object.fromEntries(Object.entries(notesFields).map(([k, s]) => [k, field(k, s)])) as { [K in keyof typeof notesFields]: ComponentSchema } & { slug: ReturnType<typeof fields.slug> };

// Storage mode by environment (PUBLIC_ variables are inlined at build time, so the browser bundle and
// the server agree). Local mode is for development only: it writes to the working tree of the
// checkout that runs the dev server. Cloud mode (recommended, ADR-012 clarification 5) signs the
// owner in through Keystatic Cloud and commits to the repository; GitHub mode uses the owner's own
// GitHub App with its secrets in the Render dashboard. A production build in local mode is refused:
// the Studio must never write anywhere but the repository through its branches.
const mode = import.meta.env.PUBLIC_KEYSTATIC_STORAGE ?? 'local';
const repo = { owner: 'KhaylubThompsonCalvin', name: 'khaylub.com' };
// Every Studio branch is scoped under studio/ so the pull-request path (Phase 26) can recognise it.
const branchPrefix = 'studio/';
const storage =
  mode === 'cloud'
    ? ({ kind: 'cloud', branchPrefix } as const)
    : mode === 'github'
      ? ({ kind: 'github', repo, branchPrefix } as const)
      : ({ kind: 'local' } as const);
if (import.meta.env.PROD && storage.kind === 'local') {
  throw new Error('The Studio cannot be built in local storage mode: set PUBLIC_KEYSTATIC_STORAGE to cloud or github.');
}
const cloudProject = import.meta.env.PUBLIC_KEYSTATIC_CLOUD_PROJECT as string | undefined;
if (storage.kind === 'cloud' && !cloudProject) {
  throw new Error('Cloud storage needs PUBLIC_KEYSTATIC_CLOUD_PROJECT (team/project from Keystatic Cloud).');
}

export default config({
  storage,
  ...(storage.kind === 'cloud' ? { cloud: { project: cloudProject as string } } : {}),
  ui: {
    brand: { name: 'Khaylub.com Studio' },
  },
  collections: {
    notes: collection({
      label: 'Field notes',
      slugField: 'slug',
      path: 'content/notes/*',
      entryLayout: 'content',
      format: { contentField: BODY_KEY },
      schema,
    }),
  },
});
