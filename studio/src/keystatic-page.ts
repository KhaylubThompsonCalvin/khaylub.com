// The admin page component, bound to the Studio's config. Kept out of the page file so the
// browser bundle imports the config once.
import { makePage } from '@keystatic/astro/ui';
import config from '../keystatic.config';

export const Keystatic = makePage(config);
