import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { compare } from '../scripts/headers-scan.mjs';

// The header scan (scripts/headers-scan.mjs) compares the headers a live URL serves with the rules
// declared in render.yaml. Phase 19's verification clause runs it against the staging URL and the V1
// subdomain; here it is proven against the local header server, which serves the same rules.
test.describe('the header scan', () => {
  test('compare() reports every missing or differing header and nothing else', () => {
    const expected = { 'cache-control': 'no-cache', 'x-frame-options': 'DENY' };
    expect(compare(expected, { 'Cache-Control': 'no-cache', 'X-Frame-Options': 'DENY', 'x-extra': '1' })).toEqual([]);
    expect(compare(expected, { 'cache-control': 'public, max-age=60' })).toEqual([
      { name: 'cache-control', expected: 'no-cache', actual: 'public, max-age=60' },
      { name: 'x-frame-options', expected: 'DENY', actual: undefined },
    ]);
  });

  test('the scan passes against the local header server in production mode', async ({ baseURL }) => {
    const run = spawnSync('node', ['scripts/headers-scan.mjs', baseURL!], { encoding: 'utf8' });
    expect(run.status, run.stdout + run.stderr).toBe(0);
    expect(run.stdout).not.toMatch(/MISMATCH|ERROR/);
    expect(run.stdout).toMatch(/^ok +\/$/m);
    expect(run.stdout).toMatch(/ok +\/climb\/wanderer-web\.glb/);
    expect(run.stdout).toMatch(/ok +\/_astro\/[^ ]+\.css/);
    expect(run.stdout).toMatch(/scanned \d+ paths, 0 mismatches/);
  });

  test('the scan fails when a required header is absent (preview expectation against production mode)', async ({ baseURL }) => {
    const run = spawnSync('node', ['scripts/headers-scan.mjs', baseURL!, '--preview'], { encoding: 'utf8' });
    expect(run.status).toBe(1);
    expect(run.stdout).toMatch(/MISMATCH +\/ +x-robots-tag/);
  });
});
