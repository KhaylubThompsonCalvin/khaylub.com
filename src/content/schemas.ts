// One schema family for every artifact. Used by src/content.config.ts at build time and by
// scripts/check-fixture.mjs, so the same rules run in both places.
// Rule: unknown keys fail (.strict()), which makes private fields impossible by construction.
import { z } from 'astro/zod';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { load } from 'js-yaml';

type Vocab = { terms: { slug: string; label: string; description?: string; area?: string }[] };

// Content paths resolve from the project root, not from the compiled chunk's location, so the
// same code works in dev, in `astro sync`, and inside the prerender bundle.
export const contentPath = (...parts: string[]) => resolve(process.cwd(), 'content', ...parts);

export function vocabulary(name: 'tags' | 'skills' | 'technologies'): string[] {
  const file = readFileSync(contentPath('vocabulary', `${name}.yaml`), 'utf8');
  const parsed = load(file) as Vocab;
  const slugs = parsed.terms.map((t) => t.slug);
  // Guard: "AI" is never a skill, tool badge, or competency on this site.
  const banned = ['ai', 'artificial-intelligence', 'prompting', 'prompt-engineering', 'genai'];
  for (const s of slugs) {
    if (banned.includes(s)) throw new Error(`vocabulary ${name}: "${s}" is not allowed as a term`);
  }
  return slugs;
}

const TAGS = vocabulary('tags');
const SKILLS = vocabulary('skills');
const TECH = vocabulary('technologies');

const term = (list: string[]) => z.enum(list as [string, ...string[]]);

export const STATUS = ['idea', 'draft', 'review', 'published', 'archived'] as const;

export const provenance = z
  .object({
    source: z.string().min(3),
    license: z.string().min(2),
    generator: z.string().optional(),
    date: z.coerce.date(),
  })
  .strict();

export const links = z
  .object({
    code: z.string().url().optional(),
    live: z.string().min(1).optional(),
    result: z.string().min(1).optional(),
  })
  .strict();

const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be lowercase letters, digits, and single hyphens');

export const base = z
  .object({
    title: z.string().min(3).max(90),
    slug,
    status: z.enum(STATUS),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    summary: z.string().min(40).max(240),
    // The case-study summary card (content model section 5): the problem in one or two sentences
    // and the author's role, stated plainly. Optional so notes and short entries stay light.
    problem: z.string().min(20).max(240).optional(),
    role: z.string().min(3).max(240).optional(),
    tags: z.array(term(TAGS)).min(1),
    skills: z.array(term(SKILLS)).optional(),
    technologies: z.array(term(TECH)).optional(),
    employer_visible: z.boolean(),
    featured: z.boolean().optional(),
    source: z.string().min(1),
    cover: z.string().optional(),
    cover_alt: z.string().min(5).optional(),
    related: z.array(slug).optional(),
    series: slug.optional(),
    part: z.number().int().positive().optional(),
    ai_assisted: z.boolean().optional(),
    license: z.string().optional(),
    provenance: provenance.optional(),
  })
  .strict();

const rules = <T extends z.ZodTypeAny>(schema: T) =>
  schema
    .refine((d: any) => !d.updated || d.updated >= d.date, {
      message: 'updated must be on or after date',
      path: ['updated'],
    })
    .refine((d: any) => !d.cover || !!d.cover_alt, {
      message: 'cover requires cover_alt',
      path: ['cover_alt'],
    })
    .refine((d: any) => !d.cover || !!d.provenance, {
      message: 'a cover image requires a provenance record',
      path: ['provenance'],
    })
    // Content model section 5: every featured case study opens with its summary card.
    .refine((d: any) => !d.featured || (!!d.problem && !!d.role), {
      message: 'a featured case study needs problem and role for its summary card',
      path: ['problem'],
    });

export const PROJECT_STATUS = ['live', 'prototype', 'private-beta', 'concept', 'archived'] as const;

export const project = rules(
  base
    .extend({
      type: z.enum(['case-study', 'concept', 'exhibit']),
      project_status: z.enum(PROJECT_STATUS),
      links: links.default({}),
      // The stack is the `technologies` list from the base schema; a project must name at least one.
      technologies: z.array(term(TECH)).min(1),
      outcome: z.string().max(200).optional(),
    })
    .strict()
    .refine((d) => !d.featured || !!(d.links.code || d.links.live || d.links.result), {
      message: 'a featured project needs at least one proof link',
      path: ['links'],
    })
);

export const data = rules(
  base
    .extend({
      type: z.enum(['analysis', 'notebook', 'dataset', 'story']),
      question: z.string().min(10).max(240),
      dataset: z.object({ name: z.string(), source: z.string(), license: z.string() }).strict(),
      repository: z.string().url().optional(),
      story_url: z.string().url().optional(),
      result: z.string().min(10).max(240),
      sql: z.array(z.string()).optional(),
      notebook: z.string().optional(),
      links: links.default({}),
    })
    .strict()
);

export const note = rules(
  base.extend({ type: z.enum(['field-note', 'retrospective', 'how-to']) }).strict()
);

export const writing = rules(
  base.extend({ type: z.enum(['essay', 'poem', 'fiction', 'book-note']) }).strict()
);

export const journal = rules(base.extend({ type: z.literal('entry') }).strict());

export const music = rules(
  base
    .extend({
      type: z.literal('track'),
      files: z.array(z.string()).optional(),
      external_url: z.string().url().optional(),
      duration: z.string().regex(/^\d+:\d{2}$/),
      provenance,
    })
    .strict()
);

export const video = rules(
  base
    .extend({
      type: z.enum(['film', 'recording', 'concept-film']),
      poster: z.string(),
      files: z.array(z.string()).optional(),
      external_url: z.string().url().optional(),
      captions: z.string().optional(),
      // Declared when the recording contains speech; the captions track is then required (FR-F2).
      speech: z.boolean().optional(),
      provenance,
    })
    .strict()
    .refine((d) => !d.speech || !!d.captions, {
      message: 'a video with speech needs a captions track',
      path: ['captions'],
    })
);

export const gallery = rules(
  base
    .extend({
      type: z.enum(['still', 'set', 'render']),
      // alt describes the image for those who cannot see it; caption is the short visible line.
      images: z.array(z.object({ src: z.string(), alt: z.string().min(5).max(200), caption: z.string().max(120).optional() }).strict()).min(1),
      provenance,
    })
    .strict()
);

export const experiment = rules(
  base
    .extend({
      type: z.enum(['prototype', 'exhibit']),
      poster: z.string(),
      entry_url: z.string(),
      payload_mb: z.number().nonnegative().optional(),
    })
    .strict()
);

export const schemas = {
  projects: project,
  data,
  notes: note,
  writing,
  journal,
  music,
  video,
  gallery,
  experiments: experiment,
} as const;

export type CollectionName = keyof typeof schemas;
