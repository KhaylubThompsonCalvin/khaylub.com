// The owner Studio's field tables (studio/src/fields.ts, from which studio/keystatic.config.ts builds
// its forms) must equal the site's Zod schemas (src/content/schemas.ts): for every collection the
// Studio edits, every key both ways, the required flags, the enum option lists, the vocabulary
// pickers, and the nested groups (provenance, links, gallery images). A key a form does not offer
// must be optional in the schema and listed as deferred with its owning phase. The collections the
// Studio does not edit are named as Git-only by design. The generated vocabulary JSON the Studio
// bundles must equal the files the site reads; the editor text rule refuses an em dash.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'astro/zod';
import { schemas, vocabulary, STATUS as SCHEMA_STATUS } from '../src/content/schemas';
import {
  collections,
  GIT_ONLY_COLLECTIONS,
  BODY_KEY,
  STATUS,
  VOCABULARIES,
  SLUG_PATTERN,
  SLUG_OR_EMPTY_PATTERN,
  DURATION_PATTERN,
  MEDIA_FILE_PATTERN,
  CASE_STUDY_HEADINGS,
  type FieldSpec,
} from '../studio/src/fields';
import { textRule, EM_DASH } from '../studio/src/rules';

type Shape = Record<string, z.ZodTypeAny>;
const shapeOf = (s: unknown): Shape => (s as { shape: Shape }).shape;
const unwrap = (s: z.ZodTypeAny): z.ZodTypeAny => {
  let cur: any = s;
  while (cur && typeof cur.unwrap === 'function' && (cur instanceof z.ZodOptional || cur instanceof z.ZodDefault || cur instanceof z.ZodNullable)) cur = cur.unwrap();
  return cur;
};
const isOptional = (s: z.ZodTypeAny) => s.safeParse(undefined).success;
const enumOptions = (s: z.ZodTypeAny): string[] => {
  const inner: any = unwrap(s);
  if (inner instanceof z.ZodLiteral) return [String(inner.value)];
  return (inner as z.ZodEnum<any>).options as string[];
};

const studioNames = Object.keys(collections);

// The Studio field kinds a Zod type may be mapped to, so a wrong `kind` (a text box where the schema
// has a boolean, a list, or a date) fails even when the required flag happens to match.
const kindsFor = (s: z.ZodTypeAny): string[] => {
  const inner: any = unwrap(s);
  if (inner instanceof z.ZodBoolean) return ['checkbox'];
  if (inner instanceof z.ZodDate) return ['date'];
  if (inner instanceof z.ZodNumber) return ['integer'];
  if (inner instanceof z.ZodEnum || inner instanceof z.ZodLiteral) return ['select'];
  if (inner instanceof z.ZodObject) return ['object'];
  if (inner instanceof z.ZodArray) {
    const el: any = unwrap(inner.element as z.ZodTypeAny);
    if (el instanceof z.ZodEnum) return ['multiselect'];
    if (el instanceof z.ZodObject) return ['array-object'];
    return ['array-text'];
  }
  if (inner instanceof z.ZodString) return ['text', 'url', 'image', 'slug'];
  return [];
};

test.describe('Studio field tables against the site schemas', () => {
  test('the Studio edits every collection except the Git-only ones, and each Git-only one is a real collection', () => {
    const all = Object.keys(schemas).sort();
    expect([...studioNames, ...GIT_ONLY_COLLECTIONS].sort()).toEqual(all);
    for (const name of GIT_ONLY_COLLECTIONS) expect(studioNames, `${name} is Git-only by ADR-012`).not.toContain(name);
  });

  for (const name of studioNames) {
    const spec = collections[name];
    const shape = shapeOf((schemas as Record<string, unknown>)[name]);

    test(`${name}: every schema key is offered or deferred, nothing extra is offered, the body is the content`, () => {
      const offered = Object.keys(spec.fields).filter((k) => k !== BODY_KEY);
      expect([...offered, ...spec.deferred].sort()).toEqual(Object.keys(shape).sort());
      expect(spec.fields[BODY_KEY]?.kind).toBe('body');
      expect(Object.keys(shape)).not.toContain(BODY_KEY);
      for (const k of spec.deferred) expect(isOptional(shape[k]), `${name}.${k} deferred, so optional`).toBe(true);
    });

    test(`${name}: required flags, enum options, vocabularies, and nested groups match the schema`, () => {
      for (const [k, f] of Object.entries(spec.fields)) {
        if (f.kind === 'body') continue;
        expect(f.required, `${name}.${k} required`).toBe(!isOptional(shape[k]));
        expect(kindsFor(shape[k]), `${name}.${k} kind ${f.kind} fits the schema type`).toContain(f.kind);
        if (f.kind === 'select') expect([...f.options], `${name}.${k} options`).toEqual(enumOptions(shape[k]));
        if (f.kind === 'multiselect') {
          const element = (unwrap(shape[k]) as z.ZodArray<any>).element as z.ZodTypeAny;
          expect(enumOptions(element), `${name}.${k} vocabulary`).toEqual(vocabulary(f.vocabulary));
        }
        if (f.kind === 'object') {
          const inner = shapeOf(unwrap(shape[k]));
          expect(Object.keys(f.fields).sort(), `${name}.${k} keys`).toEqual(Object.keys(inner).sort());
          for (const [ik, is] of Object.entries(f.fields)) {
            if (is.kind === 'body') continue;
            expect(is.required, `${name}.${k}.${ik} required`).toBe(!isOptional(inner[ik]));
            expect(kindsFor(inner[ik]), `${name}.${k}.${ik} kind`).toContain(is.kind);
          }
        }
        if (f.kind === 'array-object') {
          const element = (unwrap(shape[k]) as z.ZodArray<any>).element as z.ZodTypeAny;
          const inner = shapeOf(element);
          expect(Object.keys(f.fields).sort(), `${name}.${k}[] keys`).toEqual(Object.keys(inner).sort());
          for (const [ik, is] of Object.entries(f.fields)) {
            if (is.kind === 'body') continue;
            expect(is.required, `${name}.${k}[].${ik} required`).toBe(!isOptional(inner[ik]));
            expect(kindsFor(inner[ik]), `${name}.${k}[].${ik} kind`).toContain(is.kind);
          }
          if (f.required) expect(f.min ?? 1, `${name}.${k} requires at least one item`).toBeGreaterThanOrEqual(1);
        }
      }
      const status = spec.fields.status as Extract<FieldSpec, { kind: 'select' }>;
      expect(status.defaultValue, `${name} starts as a draft`).toBe('draft');
      expect([...status.options]).toEqual([...SCHEMA_STATUS]);
    });
  }

  test('the shared constants equal the schema constants', () => {
    expect([...STATUS]).toEqual([...SCHEMA_STATUS]);
    const re = new RegExp(SLUG_PATTERN);
    const slug = shapeOf(schemas.notes).slug;
    for (const ok of ['a', 'preserving-v1', 'the-16-mb-front-door']) {
      expect(re.test(ok)).toBe(true);
      expect(slug.safeParse(ok).success).toBe(true);
    }
    for (const bad of ['Studio', 'a--b', '-a', 'a-', 'a b', '']) {
      expect(re.test(bad), `"${bad}" rejected by the Studio rule`).toBe(false);
      expect(slug.safeParse(bad).success, `"${bad}" rejected by the schema`).toBe(false);
    }
    const optional = new RegExp(SLUG_OR_EMPTY_PATTERN);
    expect(optional.test('')).toBe(true);
    expect(optional.test('a-series')).toBe(true);
    expect(optional.test('A Series')).toBe(false);
    const duration = new RegExp(DURATION_PATTERN);
    const schemaDuration = shapeOf(schemas.music).duration;
    for (const ok of ['3:42', '12:05']) {
      expect(duration.test(ok)).toBe(true);
      expect(schemaDuration.safeParse(ok).success).toBe(true);
    }
    for (const bad of ['3:4', '3-42', '']) {
      expect(duration.test(bad)).toBe(false);
      expect(schemaDuration.safeParse(bad).success).toBe(false);
    }
  });

  test('every collection sits in a sidebar group', () => {
    for (const [name, spec] of Object.entries(collections)) expect(['Writing', 'Work', 'Media'], `${name} group`).toContain(spec.group);
  });

  test('the media file name rule accepts the file kinds the content guide serves and nothing else', () => {
    const re = new RegExp(MEDIA_FILE_PATTERN);
    for (const ok of ['clip.mp4', 'the-climb-recording.mp4', 'track.mp3', 'captions.vtt', '']) expect(re.test(ok), `"${ok}" accepted`).toBe(true);
    for (const bad of ['../secret.mp4', 'sub/clip.mp4', 'clip.exe', 'clip', 'poster.webp']) expect(re.test(bad), `"${bad}" rejected`).toBe(false);
  });

  test('the case-study headings offered as the body template are the thirteen the site tests', () => {
    const spec = readFileSync(resolve('tests/casestudy.spec.ts'), 'utf8');
    for (const h of CASE_STUDY_HEADINGS) expect(spec).toContain(`'${h}'`);
    expect(CASE_STUDY_HEADINGS.length).toBe(13);
  });

  test('the generated vocabulary JSON is current', () => {
    const generated = JSON.parse(readFileSync(resolve('studio/src/vocabulary.generated.json'), 'utf8')) as Record<string, { label: string; value: string }[]>;
    for (const name of VOCABULARIES) {
      expect(generated[name].map((o) => o.value), `generated ${name} options`).toEqual(vocabulary(name));
      for (const o of generated[name]) expect(o.label.length).toBeGreaterThan(0);
    }
    expect(Object.keys(generated).sort()).toEqual([...VOCABULARIES].sort());
  });

  test('the editor text rule refuses an em dash and nothing else the site allows', () => {
    const rule = textRule();
    expect(rule.test('A plain sentence, with a comma; and a colon: fine.')).toBe(true);
    expect(rule.test('two lines\nof text')).toBe(true);
    expect(rule.test('an em dash ' + EM_DASH + ' here')).toBe(false);
  });

  test('a note in the exact shape the Studio writes passes the schema', () => {
    // The frontmatter Keystatic wrote in the Phase 24 smoke tests (2026-09-17 UTC, recorded in the
    // vault): empty optional text omitted, empty lists as [], booleans as false, the date as YYYY-MM-DD.
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
