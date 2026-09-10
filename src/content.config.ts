// Typed content collections. Every collection is a folder under content/ read by the glob loader.
// Adding an artifact means adding a folder or file; no template changes are needed.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { schemas } from './content/schemas';
import { z } from 'astro/zod';

const folder = (name: string, pattern = '**/*.md') =>
  glob({ pattern, base: `./content/${name}` });

export const collections = {
  // The résumé text: one Markdown file rendered at /resume/ and diffed against the PDF in CI.
  resume: defineCollection({
    loader: glob({ pattern: 'resume.md', base: './content/profile' }),
    schema: z.object({ revision: z.string(), as_of: z.coerce.date(), pdf: z.string() }).strict(),
  }),
  projects: defineCollection({ loader: folder('projects', '**/index.md'), schema: schemas.projects }),
  data: defineCollection({ loader: folder('data', '**/index.md'), schema: schemas.data }),
  notes: defineCollection({ loader: folder('notes'), schema: schemas.notes }),
  writing: defineCollection({ loader: folder('writing'), schema: schemas.writing }),
  journal: defineCollection({ loader: folder('journal'), schema: schemas.journal }),
  music: defineCollection({ loader: folder('music', '**/index.md'), schema: schemas.music }),
  video: defineCollection({ loader: folder('video', '**/index.md'), schema: schemas.video }),
  gallery: defineCollection({ loader: folder('gallery', '**/index.md'), schema: schemas.gallery }),
  experiments: defineCollection({
    loader: folder('experiments', '**/index.md'),
    schema: schemas.experiments,
  }),
};
