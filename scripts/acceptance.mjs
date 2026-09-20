// The owner acceptance run (Phase 28, decision D-28): one command that runs every automated proof
// the publishing system has and writes one report, so the owner is asked only the questions a
// person must answer. Steps: the site's own suite against dist/ (npm test), the publishing harness
// for a Studio branch when one is named (the branch, the pull request, the six checks, auto-merge,
// the merge, main, staging, production, the derived places), the Studio harness (the forms in a
// real browser against a local Studio in a throwaway checkout), and the visual harness (the
// screenshots at three viewports, no sideways scroll). The report lands in EVIDENCE_DIR (default
// test-results/); every step's PASS or FAIL line, then the owner-judgment questions with the
// pictures to look at. Exit 1 when any automated step fails. No secret anywhere.
// Usage: node scripts/acceptance.mjs [<studio-branch>] [--skip-site] [--skip-studio] [--skip-visual]
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const branch = args.find((a) => !a.startsWith('--')) ?? null;
const skip = (name) => args.includes(`--skip-${name}`);
const dir = process.env.EVIDENCE_DIR ?? 'test-results';
mkdirSync(dir, { recursive: true });
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const shell = process.platform === 'win32';
const startedAt = new Date();

const steps = [];
function step(name, command, commandArgs, env = {}) {
  const t0 = Date.now();
  console.log(`\nacceptance: ${name}`);
  const r = spawnSync(command, commandArgs, { stdio: 'inherit', shell: command !== process.execPath && shell, env: { ...process.env, ...env } });
  const seconds = Math.round((Date.now() - t0) / 1000);
  const ok = r.status === 0;
  steps.push({ name, ok, seconds, command: [command, ...commandArgs].join(' ') });
  console.log(`acceptance: ${ok ? 'PASS' : 'FAIL'} ${name} (${seconds}s)`);
}

if (!skip('site')) {
  if (!existsSync('dist/index.html')) step('build', npm, ['run', 'build']);
  step('the site suite (npm test)', npm, ['test']);
}
if (branch) step(`the publishing harness for ${branch}`, process.execPath, ['scripts/publishing-verify.mjs', branch, '--live-page', '--out', join(dir, 'publishing-verify.json')]);
if (!skip('studio')) step('the Studio harness (test:studio)', process.execPath, ['scripts/studio-harness.mjs']);
if (!skip('visual')) step('the visual harness (test:visual)', npm, ['run', 'test:visual'], { EVIDENCE_DIR: join(dir, 'visual') });

const ok = steps.every((s) => s.ok);
const lines = [
  `# Acceptance report, ${startedAt.toISOString()}`,
  '',
  `Result: **${ok ? 'PASS' : 'FAIL'}** (${steps.filter((s) => s.ok).length} of ${steps.length} automated steps green${branch ? `; Studio branch ${branch}` : ''}).`,
  '',
  '## Automated evidence',
  '',
  '| Step | Result | Seconds |',
  '|---|---|---|',
  ...steps.map((s) => `| ${s.name} | ${s.ok ? 'PASS' : 'FAIL'} | ${s.seconds} |`),
  '',
  'What each step proves: the site suite is the accessibility, keyboard, target, header, security, SEO, feed, sitemap, search, graph, media, budget, integration, and Studio drift suites against the built site; the publishing harness reads the Studio branch, the pull request, the six required checks, auto-merge, the merge after green, main, and both origins (staging serves drafts; production serves only what is published; a withdrawn piece serves its notice) and the derived places on production; the Studio harness drives every collection form in a real browser (labels, help text, required-field refusal, the Body editor, the phone viewport, one entry created per collection and validated); the visual harness captures every template route at three viewports and asserts no sideways scroll.',
  '',
  '## Owner judgment (the questions only a person answers)',
  '',
  `1. Do the pages look right? The screenshots are in \`${join(dir, 'visual')}\` (one file per route and viewport).`,
  '2. Does the typography feel right, and is the wording yours?',
  '3. Does the Studio form feel intuitive on a phone and on a desktop (the Studio harness proves every control is reachable; whether it feels comfortable is yours)?',
  '4. Is the media placed where you want it on the piece you published?',
  branch ? `5. Is the piece on \`${branch}\` approved as published, with its provenance terms as you intend?` : '5. Is the real piece approved for publication, with its provenance terms as you intend?',
  '6. Final visual acceptance: is the site as you want it?',
  '',
  'Record the answers in the phase gate note; "Owner Publishing Studio accepted" and "Phase 28 PASS" are the owner\'s words, never the harness\'s.',
  '',
];
const report = join(dir, 'acceptance-report.md');
writeFileSync(report, lines.join('\n'));
console.log(`\nacceptance: ${ok ? 'PASS' : 'FAIL'}; report written to ${report}`);
process.exit(ok ? 0 : 1);
