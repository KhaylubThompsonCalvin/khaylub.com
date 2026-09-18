// The owner's publishing Studio (ADR-012, Phases 24 and 25). Every collection is built from the
// field tables in src/fields.ts, which the public site's tests hold equal to the Zod schemas. Paths
// are relative to the repository root: in local mode the API route sets that base directory
// (development only), and in cloud or GitHub mode Keystatic addresses the repository itself. Prose
// entries are written as content/<collection>/<slug>.md, media and project entries as
// content/<collection>/<slug>/index.md with their images beside, the shapes the site's glob loaders
// and schemas expect: YAML frontmatter and a Markdown body.
import { config, fields, collection, type ComponentSchema } from '@keystatic/core';
import { collections, BODY_KEY, SLUG_PATTERN, type FieldSpec, type CollectionSpec } from './src/fields';
import { textRule, TEXT_RULE_MESSAGE } from './src/rules';
import vocabulary from './src/vocabulary.generated.json';

const label = (key: string) => key.replace(/_/g, ' ');
const rule = textRule();

function field(key: string, spec: FieldSpec): ComponentSchema {
  switch (spec.kind) {
    case 'slug':
      return fields.slug({
        name: {
          label: label(key),
          description: spec.description,
          validation: { pattern: { regex: new RegExp(SLUG_PATTERN), message: 'lowercase letters, digits, and single hyphens' } },
        },
        slug: { label: 'file name', description: 'Derived from the slug; keep them equal.' },
      });
    case 'text':
      return fields.text({
        label: label(key),
        description: spec.description,
        multiline: spec.multiline,
        validation: {
          isRequired: spec.required,
          length: { min: spec.min, max: spec.max },
          // A field with its own shape rule (a slug, a duration, a file name) cannot hold an em dash
          // or a private term anyway; every other text field gets the site's text rule.
          pattern: spec.pattern
            ? { regex: new RegExp(spec.pattern), message: 'the expected shape (see the description)' }
            : { regex: rule, message: TEXT_RULE_MESSAGE },
        },
      });
    case 'url':
      return fields.url({ label: label(key), description: spec.description, validation: { isRequired: spec.required } });
    case 'select':
      return fields.select({
        label: label(key),
        description: spec.description,
        options: spec.options.map((value) => ({ label: value, value })),
        defaultValue: spec.defaultValue,
      });
    case 'multiselect':
      return fields.multiselect({ label: label(key), description: spec.description, options: vocabulary[spec.vocabulary] });
    case 'date':
      return fields.date({ label: label(key), description: spec.description, validation: { isRequired: spec.required } });
    case 'checkbox':
      return fields.checkbox({ label: label(key), description: spec.description, defaultValue: spec.defaultValue });
    case 'integer':
      return fields.integer({ label: label(key), description: spec.description, validation: { isRequired: spec.required, min: spec.min, max: spec.max } });
    case 'array-text':
      return fields.array(
        fields.text({
          label: 'item',
          validation: {
            isRequired: true,
            pattern: spec.pattern ? { regex: new RegExp(spec.pattern), message: 'the expected shape (see the description)' } : { regex: rule, message: TEXT_RULE_MESSAGE },
          },
        }),
        { label: label(key), description: spec.description, itemLabel: (props) => props.value || 'item' }
      );
    case 'image':
      // Stored beside the entry (the entry's folder); the frontmatter carries the file name.
      return fields.image({ label: label(key), description: spec.description, validation: { isRequired: spec.required } });
    case 'object':
      return fields.object(
        Object.fromEntries(Object.entries(spec.fields).map(([k, s]) => [k, field(k, s)])),
        { label: label(key), description: spec.description }
      );
    case 'array-object':
      return fields.array(
        fields.object(Object.fromEntries(Object.entries(spec.fields).map(([k, s]) => [k, field(k, s)]))),
        {
          label: label(key),
          description: spec.description,
          validation: { length: { min: spec.min ?? (spec.required ? 1 : undefined) } },
          itemLabel: (props) => {
            const alt = (props.fields as Record<string, { value?: unknown }>).alt?.value;
            return typeof alt === 'string' && alt ? alt.slice(0, 60) : 'image';
          },
        }
      );
    case 'body':
      // Markdoc syntax is Markdown for prose, lists, links, and code; the `.md` extension keeps the
      // file in the shape the site reads. Wikilinks ([[slug]]) pass through as plain text (proven in
      // the Phase 24 smoke tests). The body editor has no pattern hook: the em-dash and private-term
      // rules on the body stay with the site's validate step and CI.
      return fields.markdoc({ label: 'Body', description: spec.description, extension: 'md' });
  }
}

function build(name: string, spec: CollectionSpec) {
  // Typed by its two fixed keys only (the slug for Keystatic's `slugField`, the body for the content
  // field); the other keys are dynamic and checked at runtime by the site's drift test.
  const schema = Object.fromEntries(Object.entries(spec.fields).map(([k, s]) => [k, field(k, s)])) as unknown as {
    slug: ReturnType<typeof fields.slug>;
    body: ReturnType<typeof fields.markdoc>;
  };
  return collection({
    label: spec.label,
    slugField: 'slug',
    // A trailing slash makes a folder entry (content/<name>/<slug>/index.md), the site's layout for
    // projects and media; without it, one file per entry (content/<name>/<slug>.md).
    path: spec.layout === 'folder' ? (`content/${name}/*/` as const) : (`content/${name}/*` as const),
    entryLayout: spec.editor,
    format: { contentField: BODY_KEY },
    schema,
  });
}

// Storage mode by environment (PUBLIC_ variables are inlined at build time, so the browser bundle and
// the server agree). Local mode is for development only: it writes to the working tree of the
// checkout that runs the dev server. Cloud mode (recommended, ADR-012 clarification 5) signs the
// owner in through Keystatic Cloud and commits to the repository; GitHub mode uses the owner's own
// GitHub App with its secrets in the Render dashboard. A production build in local mode is refused
// (studio/scripts/check-storage.mjs, and again here at first use).
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
    // Built from the tables' groups, so every collection has a place in the sidebar.
    navigation: Object.fromEntries(
      (['Writing', 'Work', 'Media'] as const).map((group) => [group, Object.entries(collections).filter(([, c]) => c.group === group).map(([name]) => name)])
    ),
  },
  collections: Object.fromEntries(Object.entries(collections).map(([name, spec]) => [name, build(name, spec)])),
});
