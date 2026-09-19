// Keystatic's API route. In local mode (development only) the base directory is the repository
// root, one level above studio/, so collection paths such as content/notes/* address the same
// files in every storage mode; Keystatic rejects paths containing "..", so the base directory is
// set here instead of in the collection path. In cloud or GitHub mode this route serves the
// authentication flow and the file system is never touched. The Phase 28 harness (test:studio)
// points a development server at a throwaway checkout instead, through STUDIO_LOCAL_ROOT, read only
// in development; a production build ignores it.
import { makeHandler } from '@keystatic/astro/api';
import { fileURLToPath } from 'node:url';
import config from '../../../../keystatic.config';

export const prerender = false;

const repositoryRoot = import.meta.env.DEV
  ? (process.env.STUDIO_LOCAL_ROOT || fileURLToPath(new URL('../../../../../', import.meta.url)))
  : undefined;

export const ALL = makeHandler({ config, localBaseDirectory: repositoryRoot });
