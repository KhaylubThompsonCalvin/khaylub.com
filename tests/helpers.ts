import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Every built route (directory index pages) plus the root. */
export function builtRoutes(): string[] {
  const out: string[] = [];
  const walk = (dir: string, prefix: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        if (name === '_astro' || name === 'chunks' || name === 'pages') continue;
        walk(p, `${prefix}${name}/`);
      } else if (name === 'index.html') out.push(prefix || '/');
    }
  };
  walk('dist', '/');
  return out.sort();
}

export const TEMPLATES = ['/', '/work/', '/projects/khaylub-com-v1/', '/data/fuel-economy-regression/', '/notes/preserving-v1/', '/library/', '/climb/', '/search/', '/about/', '/contact/', '/resume/', '/timeline/'];
