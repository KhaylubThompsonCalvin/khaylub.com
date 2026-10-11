#!/usr/bin/env node
// Runs one shard of the Lighthouse CI sweep: the same lighthouserc.json, every numbered URL of
// the list (round robin), so CI can measure all templates in parallel jobs without a second
// configuration to keep in step. Usage: node scripts/lhci-shard.mjs <index> <total>
// After the default (Lean) sweep, each shard also runs its share of the weight-tier runs (D-37):
// Home, About and Work with a stored audience (`tech` is Standard, `exploring` is Full), under the
// same assertions except the stylesheet line, which allows one skin file more.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

/** The URLs shard `index` of `total` covers: positions index, index + total, ... of the list. */
export function shardUrls(urls, index, total) {
  return urls.filter((_, i) => i % total === index);
}

/** One representative audience per heavier weight tier (D-37); the default run is the Lean tier. */
export const TIER_AUDIENCES = { standard: 'tech', full: 'exploring' };
/** The skin each tier audience loads (the map of content/profile/audiences.yaml). */
export const TIER_SKINS = { tech: 'desert-night', exploring: 'golden-hour' };
export const TIER_PATHS = ['/', '/about/', '/work/'];
/** One skin file (6 KiB) on top of the stylesheet line, for the Standard and Full runs only. */
export const SKIN_ALLOWANCE = 6144;

/** Every (audience, path) tier run in a fixed order, so the shards split them like the URL list. */
export function tierRuns() {
  return Object.values(TIER_AUDIENCES).flatMap((audience) => TIER_PATHS.map((path) => ({ audience, path })));
}

/** The Chrome the puppeteer launcher uses (it has no bundled browser here): CHROME_PATH, else a usual install. */
export function chromePath(env = process.env) {
  const usual = ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
  return [env.CHROME_PATH, ...usual].find((p) => p && existsSync(p));
}

/** The config for one audience's runs: the same file, the audience stored first, the stylesheet line plus one skin. */
export function tierConfig(base, audience, paths, index, total) {
  const config = JSON.parse(JSON.stringify(base));
  const origin = new URL(base.ci.collect.url[0]).origin;
  config.ci.collect.url = paths.map((p) => origin + p);
  config.ci.collect.puppeteerScript = 'scripts/lhci-audience.cjs';
  config.ci.collect.chromePath = chromePath();
  config.ci.collect.puppeteerLaunchOptions = { args: ['--no-sandbox'] };
  config.ci.upload.outputDir = `.lighthouseci/tier-${audience}-${index}-of-${total}`;
  for (const block of config.ci.assert.assertMatrix) {
    const line = block.assertions['resource-summary:stylesheet:size'];
    if (line) line[1].maxNumericValue += SKIN_ALLOWANCE;
  }
  return config;
}

/** Lighthouse 0.15.1's resource-summary assertions take only a maximum, so a tier run proves its skin by its
    own reports: every report in the folder must have requested /skins/<skin>.css (with its ?v= token). Returns the problems (none is a pass). */
export function skinProblems(dir, skin, expected) {
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.report.json')) : [];
  const problems = [];
  if (files.length !== expected) problems.push(`${dir}: expected ${expected} reports, found ${files.length}`);
  for (const f of files) {
    const lhr = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
    const urls = (lhr.audits['network-requests']?.details?.items ?? []).map((i) => i.url);
    if (!urls.some((u) => new URL(u).pathname.endsWith(`/skins/${skin}.css`))) problems.push(`${lhr.finalUrl}: /skins/${skin}.css was not requested, so this run measured the Lean page`);
  }
  return problems;
}

function lhci(file, env = {}) {
  const run = spawnSync('npx', ['--yes', '@lhci/cli@0.15.1', 'autorun', `--config=${file}`], { stdio: 'inherit', shell: true, env: { ...process.env, ...env } });
  if (run.error) console.error(`lhci shard: could not start npx: ${run.error.message}`);
  return run.status ?? 1;
}

function main(argv) {
  const index = Number(argv[0]);
  const total = Number(argv[1]);
  if (!Number.isInteger(index) || !Number.isInteger(total) || total < 1 || index < 0 || index >= total) {
    console.error('usage: node scripts/lhci-shard.mjs <index> <total> (0 <= index < total)');
    return 2;
  }
  const base = JSON.parse(readFileSync('lighthouserc.json', 'utf8'));
  const config = JSON.parse(JSON.stringify(base));
  const urls = shardUrls(config.ci.collect.url, index, total);
  config.ci.collect.url = urls;
  mkdirSync('.lighthouseci', { recursive: true });
  const file = `.lighthouseci/shard-${index}-of-${total}.json`;
  writeFileSync(file, JSON.stringify(config, null, 2));
  console.log(`lhci shard ${index + 1} of ${total}: ${urls.length} URLs\n${urls.join('\n')}`);
  let status = lhci(file);
  const mine = shardUrls(tierRuns(), index, total);
  for (const audience of [...new Set(mine.map((r) => r.audience))]) {
    const paths = mine.filter((r) => r.audience === audience).map((r) => r.path);
    const tierFile = `.lighthouseci/tier-${audience}-${index}-of-${total}.json`;
    writeFileSync(tierFile, JSON.stringify(tierConfig(base, audience, paths, index, total), null, 2));
    rmSync(`.lighthouseci/tier-${audience}-${index}-of-${total}`, { recursive: true, force: true });
    console.log(`lhci tier run: audience ${audience}: ${paths.join(' ')}`);
    status = lhci(tierFile, { LHCI_AUDIENCE: audience }) || status;
    const problems = skinProblems(`.lighthouseci/tier-${audience}-${index}-of-${total}`, TIER_SKINS[audience], paths.length * base.ci.collect.numberOfRuns);
    for (const p of problems) console.error(`lhci tier run: ${p}`);
    if (problems.length) status = 1;
  }
  return status;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) process.exit(main(process.argv.slice(2)));
