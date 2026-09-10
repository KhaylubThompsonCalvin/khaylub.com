// Proves the roadmap's Phase 9 rule: an artifact with a deliberately invalid field fails the
// build with a readable message. Copies the fixture into content/, runs `astro sync` (which
// loads and validates every collection), expects a non-zero exit, and always cleans up.
import { cpSync, existsSync, rmSync } from 'node:fs';
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
