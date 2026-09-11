// Disposable synthetic artifacts for the build-time and search-size baseline (doc 13 line 26,
// doc 14 fixtures). Every file is a clearly named `status: draft` Field Note, so a production build
// validates it but never renders it; a preview build renders and indexes it. Never commit the output.
//   node scripts/synthetic-artifacts.mjs create 500
//   node scripts/synthetic-artifacts.mjs remove
import { mkdirSync, writeFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'content/notes';
const prefix = 'zz-synthetic-';
const [mode, countArg] = process.argv.slice(2);

const words = 'measure payload budget header token schema route index catalog evidence timeline archive'.split(' ');
const para = (seed) => Array.from({ length: 120 }, (_, i) => words[(seed * 7 + i * 3) % words.length]).join(' ') + '.';

if (mode === 'create') {
  const count = Number(countArg ?? 500);
  mkdirSync(dir, { recursive: true });
  for (let i = 1; i <= count; i++) {
    const n = String(i).padStart(3, '0');
    const day = String((i % 28) + 1).padStart(2, '0');
    const month = String(((i % 12) + 1)).padStart(2, '0');
    const body = [
      '---',
      `title: Synthetic note ${n} for the build baseline`,
      `slug: ${prefix}${n}`,
      'type: field-note',
      'status: draft',
      `date: 2025-${month}-${day}`,
      `summary: Synthetic draft number ${n}, generated only to measure build time and search index size; it is never published.`,
      'tags: [portfolio]',
      'skills: [documentation]',
      'employer_visible: false',
      'source: scripts/synthetic-artifacts.mjs',
      '---',
      '',
      `## Section one`,
      '',
      para(i),
      '',
      `## Section two`,
      '',
      para(i + 1),
      '',
    ].join('\n');
    writeFileSync(join(dir, `${prefix}${n}.md`), body);
  }
  console.log(`created ${count} synthetic drafts under ${dir}`);
} else if (mode === 'remove') {
  let removed = 0;
  if (existsSync(dir)) for (const f of readdirSync(dir)) if (f.startsWith(prefix)) { rmSync(join(dir, f)); removed++; }
  console.log(`removed ${removed} synthetic drafts`);
} else {
  console.error('usage: node scripts/synthetic-artifacts.mjs create [count] | remove');
  process.exit(1);
}
