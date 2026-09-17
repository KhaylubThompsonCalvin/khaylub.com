// Keystatic's API route. In local mode (development only) the base directory is the repository
// root, one level above studio/, so collection paths such as content/notes/* address the same
// files in every storage mode; Keystatic rejects paths containing "..", so the base directory is
// set here instead of in the collection path. In cloud or GitHub mode this route serves the
// authentication flow and the file system is never touched.
import { makeHandler } from '@keystatic/astro/api';
import { fileURLToPath } from 'node:url';
import config from '../../../../keystatic.config';

export const prerender = false;

const repositoryRoot = import.meta.env.DEV
  ? fileURLToPath(new URL('../../../../../', import.meta.url))
  : undefined;

export const ALL = makeHandler({ config, localBaseDirectory: repositoryRoot });
