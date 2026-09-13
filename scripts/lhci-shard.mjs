#!/usr/bin/env node
// Runs one shard of the Lighthouse CI sweep: the same lighthouserc.json, every numbered URL of
// the list (round robin), so CI can measure all templates in parallel jobs without a second
// configuration to keep in step. Usage: node scripts/lhci-shard.mjs <index> <total>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

/** The URLs shard `index` of `total` covers: positions index, index + total, ... of the list. */
export function shardUrls(urls, index, total) {
  return urls.filter((_, i) => i % total === index);
}

function main(argv) {
  const index = Number(argv[0]);
  const total = Number(argv[1]);
  if (!Number.isInteger(index) || !Number.isInteger(total) || total < 1 || index < 0 || index >= total) {
    console.error('usage: node scripts/lhci-shard.mjs <index> <total> (0 <= index < total)');
    return 2;
  }
  const config = JSON.parse(readFileSync('lighthouserc.json', 'utf8'));
  const urls = shardUrls(config.ci.collect.url, index, total);
  config.ci.collect.url = urls;
  mkdirSync('.lighthouseci', { recursive: true });
  const file = `.lighthouseci/shard-${index}-of-${total}.json`;
  writeFileSync(file, JSON.stringify(config, null, 2));
  console.log(`lhci shard ${index + 1} of ${total}: ${urls.length} URLs\n${urls.join('\n')}`);
  const run = spawnSync('npx', ['--yes', '@lhci/cli@0.15.1', 'autorun', `--config=${file}`], { stdio: 'inherit', shell: true });
  if (run.error) console.error(`lhci shard: could not start npx: ${run.error.message}`);
  return run.status ?? 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) process.exit(main(process.argv.slice(2)));
