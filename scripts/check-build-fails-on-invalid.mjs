// Proves the roadmap's Phase 9 rule: an artifact with a deliberately invalid field fails the
// build with a readable message. Copies the fixture into content/, runs `astro sync` (which
// loads and validates every collection), expects a non-zero exit, and always cleans up.
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkDist } from './seo-check.mjs';
import { spawnSync } from 'node:child_process';

const target = 'content/projects/zz-invalid-fixture';
const fixture = 'tests/fixtures/invalid-project';

if (existsSync(target)) rmSync(target, { recursive: true, force: true });
cpSync(fixture, target, { recursive: true });

let result;
try {
  result = spawnSync('npx', ['astro', 'sync'], { encoding: 'utf8', shell: true });
} finally {
  rmSync(target, { recursive: true, force: true });
}

const output = `${result.stdout}\n${result.stderr}`;
const mentionsFixture = /invalid-fixture|zz-invalid-fixture/.test(output);
const mentionsPrivateKey = /gpa|Unrecognized key/i.test(output);

if (result.status === 0) {
  console.error('FAIL: astro sync succeeded with an invalid artifact present.');
  process.exit(1);
}
if (!mentionsFixture) {
  console.error('FAIL: the build failed but did not name the invalid file.\n' + output.slice(-1500));
  process.exit(1);
}
console.log(
  `PASS: build fails on the invalid fixture (exit ${result.status}); message names the file` +
    (mentionsPrivateKey ? ' and rejects the private key "gpa".' : '.')
);

// Second proof: a `related` slug that no artifact carries fails `npm run validate` (section 10).
const noteTarget = 'content/notes/zz-dangling-related.md';
cpSync('tests/fixtures/dangling-related/dangling.md', noteTarget);
let validate;
try {
  validate = spawnSync('node', ['scripts/validate.mjs'], { encoding: 'utf8', shell: true });
} finally {
  rmSync(noteTarget, { force: true });
}
const validateOutput = `${validate.stdout}\n${validate.stderr}`;
if (validate.status === 0 || !/related slug "no-such-artifact"/.test(validateOutput)) {
  console.error('FAIL: validate did not reject the dangling related slug.\n' + validateOutput.slice(-1500));
  process.exit(1);
}
console.log('PASS: validate rejects a related slug that no artifact carries.');

// Third proof: an unresolved [[wikilink]] in a published body fails `npm run validate` (section 10b).
// The build throws on the same condition through the Sätteri plugin; tests/wikilinks.spec.ts proves
// that path on the resolver directly, so no second full build runs here.
const wikiTarget = 'content/notes/zz-unresolved-wikilink.md';
cpSync('tests/fixtures/unresolved-wikilink/unresolved.md', wikiTarget);
let wiki;
try {
  wiki = spawnSync('node', ['scripts/validate.mjs'], { encoding: 'utf8', shell: true });
} finally {
  rmSync(wikiTarget, { force: true });
}
const wikiOutput = `${wiki.stdout}\n${wiki.stderr}`;
if (wiki.status === 0 || !/unresolved wikilink \[\[no-such-artifact-anywhere\]\]/.test(wikiOutput)) {
  console.error('FAIL: validate did not reject the unresolved wikilink.\n' + wikiOutput.slice(-1500));
  process.exit(1);
}
console.log('PASS: validate rejects an unresolved wikilink in a body.');

// Fourth proof: an em dash (U+2014) in a published body fails `npm run validate` (section 2). The
// character is written here as an escape so this file never carries one.
const dashTarget = 'content/notes/zz-em-dash.md';
writeFileSync(dashTarget, ['---', 'title: Em dash proof', 'slug: zz-em-dash', 'type: field-note', 'status: published', 'date: 2026-09-14', 'summary: A body with the one character the site refuses, for the proof script.', 'tags: [portfolio]', 'employer_visible: false', 'source: proof', '---', '', 'This sentence carries an em dash \u2014 and must fail.', ''].join('\n'));
let dash;
try {
  dash = spawnSync('node', ['scripts/validate.mjs'], { encoding: 'utf8', shell: true });
} finally {
  rmSync(dashTarget, { force: true });
}
const dashOutput = `${dash.stdout}\n${dash.stderr}`;
if (dash.status === 0 || !/em dash/i.test(dashOutput)) {
  console.error('FAIL: validate did not reject the em dash.\n' + dashOutput.slice(-1500));
  process.exit(1);
}
console.log('PASS: validate rejects an em dash in a body.');

// Fifth proof: a built page missing og:image:alt fails the SEO check (Phase 17, section 10a of
// validate). Runs on a copy of dist/ so the real output is untouched; skipped when dist/ is absent.
if (existsSync('dist/index.html')) {
  const copy = mkdtempSync(join(tmpdir(), 'khaylub-seo-proof-'));
  try {
    cpSync('dist', copy, { recursive: true });
    const home = join(copy, 'index.html');
    writeFileSync(home, readFileSync(home, 'utf8').replace(/<meta property="og:image:alt" content="[^"]*"\s*\/?>/, ''));
    const seo = checkDist(copy);
    if (!seo.errors.some((e) => /og:image:alt missing/.test(e))) {
      console.error('FAIL: the SEO check did not reject a page without og:image:alt.\n' + seo.errors.slice(0, 5).join('\n'));
      process.exit(1);
    }
    console.log('PASS: the SEO check rejects a page without og:image:alt.');
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
} else {
  console.log('SKIP: dist/ absent, the SEO proof runs after the build.');
}

