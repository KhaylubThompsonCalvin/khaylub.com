// Runs Lighthouse CI against a deployed origin with exactly the profile and assertions of
// lighthouserc.json (the Phase 15 mobile profile, five runs, the median, every budget line), so
// the public-URL run of the runbook (section 2 step 4) is reproducible and never drifts from the
// local gate. The staging build is the preview build by the owner's choice, so `is-crawlable` and
// the SEO category fail there by design; every other assertion must pass.
// Usage: node scripts/lhci-staging.mjs <base-url> <output-dir> [path ...]   (default paths: / and /work/)
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const [base, outDir, ...paths] = process.argv.slice(2);
if (!base || !outDir) {
  console.error('usage: node scripts/lhci-staging.mjs <base-url> <output-dir> [path ...]');
  process.exit(2);
}
const origin = new URL(base).origin;
const local = JSON.parse(readFileSync('lighthouserc.json', 'utf8'));
const config = {
  ci: {
    collect: { url: (paths.length ? paths : ['/', '/work/']).map((p) => origin + p), numberOfRuns: local.ci.collect.numberOfRuns, settings: local.ci.collect.settings },
    assert: local.ci.assert,
    upload: { target: 'filesystem', outputDir: outDir, reportFilenamePattern: '%%HOSTNAME%%-%%PATHNAME%%-%%DATETIME%%.%%EXTENSION%%' },
  },
};
mkdirSync(outDir, { recursive: true });
const configPath = join(mkdtempSync(join(tmpdir(), 'khaylub-lhci-')), 'lighthouserc.json');
writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log(`Lighthouse CI on ${config.ci.collect.url.join(', ')}: ${config.ci.collect.numberOfRuns} runs each, the assertions of lighthouserc.json, reports to ${outDir}`);
const run = spawnSync('npx', ['--yes', '@lhci/cli@0.15.1', 'autorun', `--config=${configPath}`], { stdio: 'inherit', shell: true });
process.exit(run.status ?? 1);
