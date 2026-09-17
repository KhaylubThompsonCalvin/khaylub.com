// The owner Studio's field table (studio/src/notes-fields.ts, from which studio/keystatic.config.ts
// builds its form) must equal the site's Zod schema for `notes` (src/content/schemas.ts): every key
// both ways, the required flags, the enum option lists, and the vocabulary pickers. A key the Studio
// does not offer yet must be optional in the schema and listed as deferred with its owning phase.
// The generated vocabulary JSON the Studio bundles must equal the YAML the schema reads.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'astro/zod';
import { schemas, vocabulary, STATUS as SCHEMA_STATUS } from '../src/content/schemas';
import {
  notesFields,
  DEFERRED_KEYS,
  BODY_KEY,
  NOTE_TYPES,
  STATUS,
  VOCABULARIES,
  SLUG_PATTERN,
} from '../studio/src/notes-fields';

const shape = (schemas.notes as unknown as { shape: Record<string, z.ZodTypeAny> }).shape;
const unwrap = (s: z.ZodTypeAny): z.ZodTypeAny => {
  let cur: any = s;
  while (cur && typeof cur.unwrap === 'function' && (cur instanceof z.ZodOptional || cur instanceof z.ZodDefault || cur instanceof z.ZodNullable)) {
    cur = cur.unwrap();
  }
  return cur;
};
const isOptional = (s: z.ZodTypeAny) => s.safeParse(undefined).success;
const enumOptions = (s: z.ZodTypeAny): string[] => (unwrap(s) as z.ZodEnum<any>).options as string[];

test.describe('Studio field table against the notes schema', () => {
  test('every frontmatter key is either offered by the Studio or deferred, and nothing extra is offered', () => {
    const schemaKeys = Object.keys(shape).sort();
    const offered = Object.keys(notesFields).filter((k) => k !== BODY_KEY);
    const deferred = [...DEFERRED_KEYS];
    expect([...offered, ...deferred].sort()).toEqual(schemaKeys);
    for (const k of offered) expect(schemaKeys, `Studio field "${k}" exists in the schema`).toContain(k);
    expect(notesFields[BODY_KEY]?.kind, 'the body is the Markdown content, not a frontmatter key').toBe('body');
    expect(schemaKeys, 'the schema has no "body" key; the body is the file content').not.toContain(BODY_KEY);
  });

  test('every deferred key is optional in the schema, so a Studio-written note is valid without it', () => {
    for (const k of DEFERRED_KEYS) {
      expect(shape[k], `deferred key "${k}" exists in the schema`).toBeDefined();
      expect(isOptional(shape[k]), `deferred key "${k}" is optional`).toBe(true);
    }
  });

  test('required flags match the schema', () => {
    for (const [k, spec] of Object.entries(notesFields)) {
      if (spec.kind === 'body') continue;
      const required = !isOptional(shape[k]);
      expect(spec.required, `"${k}" required flag`).toBe(required);
    }
  });

  test('enum option lists equal the schema enums and the shared constants', () => {
    expect([...NOTE_TYPES]).toEqual(enumOptions(shape.type));
    expect([...STATUS]).toEqual(enumOptions(shape.status));
    expect([...STATUS]).toEqual([...SCHEMA_STATUS]);
    const typeSpec = notesFields.type;
    const statusSpec = notesFields.status;
    expect(typeSpec.kind === 'select' && [...typeSpec.options]).toEqual([...NOTE_TYPES]);
    expect(statusSpec.kind === 'select' && [...statusSpec.options]).toEqual([...STATUS]);
    expect(statusSpec.kind === 'select' && statusSpec.defaultValue, 'a new note starts as a draft').toBe('draft');
  });

  test('vocabulary pickers name the vocabularies the schema reads, and the generated JSON is current', () => {
    const generated = JSON.parse(readFileSync(resolve('studio/src/vocabulary.generated.json'), 'utf8')) as Record<string, { label: string; value: string }[]>;
    for (const name of VOCABULARIES) {
      const spec = notesFields[name];
      expect(spec?.kind, `"${name}" is a multiselect`).toBe('multiselect');
      expect(spec.kind === 'multiselect' && spec.vocabulary).toBe(name);
      // The schema's array element is the enum of the vocabulary's slugs.
      const element = (unwrap(shape[name]) as z.ZodArray<any>).element as z.ZodTypeAny;
      expect(enumOptions(element)).toEqual(vocabulary(name));
      expect(generated[name].map((o) => o.value), `generated ${name} options`).toEqual(vocabulary(name));
      for (const o of generated[name]) expect(o.label.length, `${name} option "${o.value}" has a label`).toBeGreaterThan(0);
    }
    expect(Object.keys(generated).sort()).toEqual([...VOCABULARIES].sort());
  });

  test('the slug rule matches the schema rule', () => {
    const re = new RegExp(SLUG_PATTERN);
    for (const ok of ['a', 'preserving-v1', 'the-16-mb-front-door']) {
      expect(re.test(ok)).toBe(true);
      expect(shape.slug.safeParse(ok).success).toBe(true);
    }
    for (const bad of ['Studio', 'a--b', '-a', 'a-', 'a b', '']) {
      expect(re.test(bad), `"${bad}" rejected by the Studio rule`).toBe(false);
      expect(shape.slug.safeParse(bad).success, `"${bad}" rejected by the schema`).toBe(false);
    }
  });

  test('a note in the exact shape the Studio writes passes the schema', () => {
    // Recorded from the Phase 24 smoke test (2026-09-17): empty optional text is omitted, empty lists
    // are written as [], booleans as false, the date as YYYY-MM-DD.
    const written = {
      slug: 'studio-smoke-test',
      title: 'Studio smoke test',
      type: 'field-note',
      status: 'draft',
      date: '2026-09-17',
      summary: 'A throwaway note written in the owner Studio to prove the file shape the site expects.',
      tags: ['github'],
      skills: [],
      technologies: [],
      employer_visible: false,
      source: 'https://github.com/KhaylubThompsonCalvin/khaylub.com',
      related: [],
      ai_assisted: false,
    };
    const result = schemas.notes.safeParse(written);
    expect(result.success, JSON.stringify(result.success ? null : result.error.issues)).toBe(true);
  });
});
