import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';

// The deployed-origin verification (scripts/staging-verify.mjs) is proven here against the local
// header server, which serves the production build: every template route, the search interaction,
// the climb door, and the indexing state must pass, and the summary must name them. Against a host
// the same command runs with --preview when the host serves the preview build.
test.describe('the deployed-origin verification', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'the script launches its own Chromium');

  test('passes against the local production build and reports every check', async ({ baseURL }, testInfo) => {
    test.setTimeout(240_000);
    if (testInfo.project.name !== 'desktop') test.skip(); // one run is the proof; the script picks its own viewport
    const out = testInfo.outputPath('staging-verify.json');
    const run = spawnSync('node', ['scripts/staging-verify.mjs', baseURL!, '--out', out], { encoding: 'utf8', timeout: 230_000 });
    expect(run.status, run.stdout + run.stderr).toBe(0);
    expect(run.stdout).toMatch(/^ok {3}\/$/m);
    expect(run.stdout).toMatch(/^ok {3}\/graph\/$/m);
    expect(run.stdout).toMatch(/ok {3}search "climb": [1-9]\d* result\(s\)/);
    expect(run.stdout).toMatch(/ok {3}climb: 0 scene request\(s\) before the press; first model after it: \/climb\/[^ ]+\.glb/);
    expect(run.stdout).toMatch(/ok {3}indexing \(production expected\): Disallow all false, noindex meta false, banner false, sitemap 200/);
    expect(run.stdout).toMatch(/ok {3}card \/: 1200x630 PNG, \d+ bytes, alt "[^"]+"/);
    expect(run.stdout).toMatch(/ok {3}card \/video\/the-climb-recording\/: 1200x630 PNG/);
    expect(run.stdout).toMatch(/verified 26 routes, search, the climb, indexing, 5 cards on http:\/\/localhost:4173 \(desktop\): 0 failure\(s\)/);
  });

  test('the preview expectation fails against the production build, naming the reason', async ({ baseURL }, testInfo) => {
    test.setTimeout(240_000);
    if (testInfo.project.name !== 'desktop') test.skip();
    const run = spawnSync('node', ['scripts/staging-verify.mjs', baseURL!, '--preview'], { encoding: 'utf8', timeout: 230_000 });
    expect(run.status).toBe(1);
    expect(run.stdout).toMatch(/FAIL indexing \(preview expected\).*expected the preview build/);
  });
});
