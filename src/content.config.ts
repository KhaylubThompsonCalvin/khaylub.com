// Typed content collections. Every collection is a folder under content/ read by the glob loader.
// Adding an artifact means adding a folder or file; no template changes are needed.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { schemas } from './content/schemas';

const folder = (name: string, pattern = '**/*.md') =>
  glob({ pattern, base: `./content/${name}` });

export const collections = {
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
