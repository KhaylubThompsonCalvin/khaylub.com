// Writes studio/src/vocabulary.generated.json from the site's controlled vocabularies
// (content/vocabulary/{tags,skills,technologies}.yaml) so the Studio's pickers offer exactly the
// terms the Zod schema accepts. The Keystatic config runs in the browser and cannot read YAML, so
// the terms are generated here; `npm run dev` and `npm run build` in studio/ run this first, and the
// site's tests/studio-config.spec.ts fails when the committed JSON is out of date.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const names = ['tags', 'skills', 'technologies'];

export function vocabularyOptions(root = repoRoot) {
  const out = {};
  for (const name of names) {
    const file = readFileSync(resolve(root, 'content', 'vocabulary', `${name}.yaml`), 'utf8');
    const parsed = load(file);
    out[name] = parsed.terms.map((t) => ({ label: t.label, value: t.slug }));
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = resolve(here, '..', 'src', 'vocabulary.generated.json');
  writeFileSync(target, JSON.stringify(vocabularyOptions(), null, 2) + '\n');
  console.log(`vocabulary: ${names.join(', ')} written to src/vocabulary.generated.json`);
}
