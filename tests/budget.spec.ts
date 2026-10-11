import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { TEMPLATES } from './helpers';
import { shardUrls, tierRuns, tierConfig, TIER_AUDIENCES, SKIN_ALLOWANCE, skinProblems, TIER_SKINS } from '../scripts/lhci-shard.mjs';

// The performance budget (vault document 13) as the repository asserts it. Lighthouse 12 removed the
// performance-budget audit, so budget.json is enforced only through Lighthouse CI's own assertions;
// this suite pins lighthouserc.json to budget.json, to the template list, and to the documented
// measurement profile (mobile emulation, five runs, the median), so none of them can drift.
type Assertion = [string, Record<string, number>] | string;
type Block = { matchingUrlPattern: string; aggregationMethod?: string; assertions: Record<string, Assertion> };
type Lhci = { ci: { collect: { url: string[]; numberOfRuns: number; settings?: Record<string, unknown> }; assert: { assertMatrix: Block[] } } };
type Budget = { path: string; resourceSizes: { resourceType: string; budget: number }[]; resourceCounts: { resourceType: string; budget: number }[] }[];

const lhci = JSON.parse(readFileSync('lighthouserc.json', 'utf8')) as Lhci;
const budget = JSON.parse(readFileSync('budget.json', 'utf8')) as Budget;
const ORIGIN = 'http://localhost:4173';
const level = (a: Assertion | undefined) => (a === undefined ? undefined : typeof a === 'string' ? a : a[0]);
const value = (a: Assertion | undefined, key: string) => (a === undefined || typeof a === 'string' ? undefined : a[1][key]);
/** The shard count the CI matrix runs, read from the workflow so the test and CI cannot drift. */
const SHARDS = (() => {
  const m = readFileSync('.github/workflows/ci.yml', 'utf8').match(/shard: \[([\d, ]+)\]/);
  return m ? m[1].split(',').length : 0;
})();

test.describe('the performance budget as asserted', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'configuration files: run once, in the desktop project');
  });

  test('every template is measured, on the mobile profile, five runs, the median', () => {
    expect(lhci.ci.collect.url.map((u) => u.replace(ORIGIN, '')).sort()).toEqual([...TEMPLATES].sort());
    expect(lhci.ci.collect.numberOfRuns).toBe(5);
    // No settings at all: Lighthouse's defaults are the mobile emulation and the throttling doc 13
    // names; a preset, form factor, or throttling override here would change the profile, and
    // budget.json is asserted through assertMatrix, not the removed audit.
    expect(lhci.ci.collect.settings ?? {}).toEqual({});
    expect(lhci.ci.assert.assertMatrix.length, 'one block for every page, one for content pages').toBe(2);
    for (const block of lhci.ci.assert.assertMatrix) expect(block.aggregationMethod, block.matchingUrlPattern).toBe('median');
  });

  test('the every-page block carries budget.json byte for byte and the category and metric lines', () => {
    const every = lhci.ci.assert.assertMatrix.find((b) => b.matchingUrlPattern === '.*');
    expect(every, 'a block for every page').toBeTruthy();
    const a = every!.assertions;
    const lines = budget.find((b) => b.path === '/*');
    expect(lines).toBeTruthy();
    for (const { resourceType, budget: kb } of lines!.resourceSizes) {
      const key = `resource-summary:${resourceType}:size`;
      expect(a[key], key).toBeDefined();
      expect(level(a[key]), key).toBe('error');
      expect(value(a[key], 'maxNumericValue'), key).toBe(kb * 1024);
    }
    for (const { resourceType, budget: n } of lines!.resourceCounts) {
      const key = `resource-summary:${resourceType}:count`;
      expect(a[key], key).toBeDefined();
      expect(level(a[key]), key).toBe('error');
      expect(value(a[key], 'maxNumericValue'), key).toBe(n);
    }
    // The stylesheet line: 30 KB from Phase 15 until the owner raised it to 36 KiB on 2026-09-22 (the
    // F5 visual completion: 31,486 bytes raw, about 6.8 KB compressed, 5,378 bytes of headroom). It
    // stays a real ceiling: a later package that approaches it investigates the cause first, and no
    // edit raises it again without an owner decision recorded in the vault.
    const css = lines!.resourceSizes.find((l) => l.resourceType === 'stylesheet');
    expect(css?.budget, 'the stylesheet line is the 38 KiB ceiling (owner decision D-38, 2026-10-10)').toBe(38);
    // Thresholds from CLAUDE.md and doc 13; a later edit may tighten them, never loosen them.
    const atLeast: [string, string, string, number][] = [
      ['categories:performance', 'error', 'minScore', 0.9],
      ['categories:accessibility', 'error', 'minScore', 1],
      ['categories:best-practices', 'error', 'minScore', 0.95],
      ['categories:seo', 'error', 'minScore', 1],
      ['is-crawlable', 'error', 'minScore', 1],
    ];
    for (const [key, lvl, k, v] of atLeast) {
      expect(a[key], key).toBeDefined();
      expect(level(a[key]), key).toBe(lvl);
      expect(value(a[key], k), key).toBeGreaterThanOrEqual(v);
    }
    const atMost: [string, string, number][] = [
      ['largest-contentful-paint', 'error', 2000],
      ['cumulative-layout-shift', 'error', 0.05],
      ['total-blocking-time', 'error', 150],
      ['first-contentful-paint', 'warn', 1500],
      ['speed-index', 'warn', 3000],
      ['dom-size', 'warn', 800],
      ['bootup-time', 'warn', 1000],
    ];
    for (const [key, lvl, v] of atMost) {
      expect(a[key], key).toBeDefined();
      expect(level(a[key]), key).toBe(lvl);
      expect(value(a[key], 'maxNumericValue'), key).toBeLessThanOrEqual(v);
    }
    // Line 22: the header suites are the error gate (media is 7 days by policy); Lighthouse's heuristic warns.
    expect(level(a['uses-long-cache-ttl'])).toBe('warn');
  });

  test('content pages carry the 500 KB line; Home and Work keep 900 KB', () => {
    const content = lhci.ci.assert.assertMatrix.find((b) => b.matchingUrlPattern !== '.*');
    expect(content, 'a content-page block').toBeTruthy();
    const re = new RegExp(content!.matchingUrlPattern);
    expect(re.test(`${ORIGIN}/notes/preserving-v1/`)).toBe(true);
    expect(re.test(`${ORIGIN}/gallery/the-climb-beat-by-beat/`)).toBe(true);
    expect(re.test(`${ORIGIN}/`)).toBe(false);
    expect(re.test(`${ORIGIN}/work/`)).toBe(false);
    const total = content!.assertions['resource-summary:total:size'];
    expect(level(total)).toBe('error');
    expect(value(total, 'maxNumericValue')).toBe(500 * 1024);
  });

  test('the CI shards cover every template exactly once', () => {
    expect(SHARDS, 'ci.yml declares a shard matrix').toBeGreaterThan(1);
    const urls = lhci.ci.collect.url;
    const shards = [...Array(SHARDS).keys()];
    const all = shards.flatMap((i) => shardUrls(urls, i, SHARDS));
    expect([...all].sort()).toEqual([...urls].sort());
    const sizes = shards.map((i) => shardUrls(urls, i, SHARDS).length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  });
});

test.describe('the weight-tier Lighthouse runs (D-37)', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'configuration files: run once, in the desktop project');
  });

  test('Standard (tech) and Full (exploring) measure Home, About and Work, split across the CI shards exactly once', () => {
    expect(TIER_AUDIENCES).toEqual({ standard: 'tech', full: 'exploring' });
    const runs = tierRuns();
    expect(runs.map((r) => `${r.audience}${r.path}`).sort()).toEqual(
      ['exploring/', 'exploring/about/', 'exploring/work/', 'tech/', 'tech/about/', 'tech/work/'],
    );
    const all = [...Array(SHARDS).keys()].flatMap((i) => shardUrls(runs, i, SHARDS));
    expect(all.length).toBe(runs.length);
    expect(new Set(all.map((r) => `${r.audience}${r.path}`)).size).toBe(runs.length);
  });

  test('a tier run proves its skin was requested, and a run without the stored answer fails', async () => {
    const { mkdtempSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const report = (d: string, n: number, urls: string[]) => writeFileSync(`${d}/r${n}.report.json`, JSON.stringify({ finalUrl: `${ORIGIN}/`, audits: { 'network-requests': { details: { items: urls.map((url) => ({ url })) } } } }));
    const lean = mkdtempSync(`${tmpdir()}/tier-lean-`);
    report(lean, 1, [`${ORIGIN}/`, `${ORIGIN}/_astro/style.css`]);
    expect(skinProblems(lean, TIER_SKINS.tech, 1).join(' ')).toMatch(/desert-night.css was not requested/);
    const skinned = mkdtempSync(`${tmpdir()}/tier-skin-`);
    report(skinned, 1, [`${ORIGIN}/`, `${ORIGIN}/skins/desert-night.css`]);
    expect(skinProblems(skinned, TIER_SKINS.tech, 1)).toEqual([]);
    expect(skinProblems(skinned, TIER_SKINS.tech, 5).join(' ')).toMatch(/expected 5 reports/);
  });

  test('the tier config differs from the Lean sweep only in the stylesheet line (one skin more) and the stored answer', () => {
    const cfg = tierConfig(lhci, 'tech', ['/', '/about/'], 0, 3) as unknown as Lhci & { ci: { collect: { puppeteerScript: string } } };
    expect(cfg.ci.collect.puppeteerScript).toBe('scripts/lhci-audience.cjs');
    expect(cfg.ci.collect.url).toEqual([`${ORIGIN}/`, `${ORIGIN}/about/`]);
    const every = cfg.ci.assert.assertMatrix.find((b) => b.matchingUrlPattern === '.*')!;
    expect(value(every.assertions['resource-summary:stylesheet:size'], 'maxNumericValue')).toBe(38912 + SKIN_ALLOWANCE);
    expect(SKIN_ALLOWANCE).toBe(6 * 1024);
    // Every other line is the Lean sweep's line, and the Lean sweep itself still holds 38 KiB.
    const lean = lhci.ci.assert.assertMatrix.find((b) => b.matchingUrlPattern === '.*')!;
    expect(value(lean.assertions['resource-summary:stylesheet:size'], 'maxNumericValue')).toBe(38912);
    for (const key of Object.keys(lean.assertions).filter((k) => k !== 'resource-summary:stylesheet:size')) {
      expect(every.assertions[key], key).toEqual(lean.assertions[key]);
    }
  });
});

test('the bundled stylesheet leaves room under the 38 KiB line (headers counted as 810 bytes)', async () => {
  const { readFileSync, statSync } = await import('node:fs');
  // The island's own climb.*.css is not the bundle; the bundle is the one the pages link.
  const href = /<link rel="stylesheet" href="(\/_astro\/[^"]+\.css)"/.exec(readFileSync('dist/about/index.html', 'utf8'))?.[1];
  expect(href, 'a bundled stylesheet link').toBeTruthy();
  const bytes = statSync(`dist${href}`).size;
  expect(bytes + 810, 'bundle plus headers').toBeLessThanOrEqual(38912);
});
