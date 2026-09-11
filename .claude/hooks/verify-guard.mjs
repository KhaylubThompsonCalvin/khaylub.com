#!/usr/bin/env node
// Verification guard for Claude Code sessions in this repository.
// Wired as a PreToolUse hook in .claude/settings.json. It never invents checks: every command it
// runs is one of the repository's own scripts (package.json) or `npm audit`, in the order CI uses.
//
// Modes
//   hook   (stdin: the tool call as JSON)
//          - `git commit`: scan the files about to be committed for em dashes, credential
//            patterns, machine paths, and secret files. If the commit touches build inputs, also
//            require `npm run check` and `npm run validate` to pass. Docs-only commits get the
//            scan only.
//          - `gh pr create` or the GitHub MCP create_pull_request: require a full-verification
//            stamp (.claude/verify-stamp.json) that matches HEAD on a clean tree.
//          - anything else: exit 0 immediately.
//   full   run the whole verification list (check, validate, build, validate, test, lhci, audit)
//          and write the stamp on success.
//
// Exit codes: 0 allow; 2 block (the message on stderr goes back to Claude); 1 internal failure.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
process.chdir(root);
const stampPath = join(root, '.claude', 'verify-stamp.json');

const BUILD_INPUT_PREFIXES = ['src/', 'content/', 'public/', 'scripts/', 'tests/'];
const BUILD_INPUT_FILES = [
  'render.yaml', 'astro.config.mjs', 'package.json', 'package-lock.json', 'tsconfig.json',
  'playwright.config.ts', 'lighthouserc.json', 'budget.json', '.htmlvalidate.json', '.nvmrc',
];
const BINARY_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.ico', '.pdf', '.mp4', '.webm', '.mp3', '.ogg', '.glb', '.woff', '.woff2', '.ttf', '.otf', '.zip'];
// Same patterns as scripts/validate.mjs section 3, applied here to every staged file (validate.mjs
// only walks content/, src/, public/, and dist/).
const PATH_PATTERNS = [/C:\\Users/i, /\/Users\/[A-Za-z]/, /OneDrive/i, /Desktop\\Projects/i, /Knowledge Base/i];
const SECRET_PATTERNS = [/ghp_[A-Za-z0-9]{20,}/, /github_pat_[A-Za-z0-9_]{20,}/, /sk-[A-Za-z0-9]{20,}/, /AKIA[0-9A-Z]{16}/, /BEGIN (RSA |EC )?PRIVATE KEY/];
const SECRET_FILES = /(^|\/)(\.env(\..*)?|.*\.pem|.*\.key)$/;

const FULL_STEPS = [
  { label: 'npm run check', cmd: 'npm', args: ['run', 'check'] },
  { label: 'npm run validate', cmd: 'npm', args: ['run', 'validate'] },
  { label: 'npm run build', cmd: 'npm', args: ['run', 'build'] },
  { label: 'npm run validate (built output)', cmd: 'npm', args: ['run', 'validate'] },
  { label: 'npm test', cmd: 'npm', args: ['test'] },
  { label: 'npm run lhci', cmd: 'npm', args: ['run', 'lhci'] },
  { label: 'npm audit --audit-level=high', cmd: 'npm', args: ['audit', '--audit-level=high'] },
];
const FAST_STEPS = FULL_STEPS.slice(0, 2);

function git(args) {
  const r = spawnSync('git', args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout;
}

function run(step, inherit) {
  const started = Date.now();
  const r = spawnSync(step.cmd, step.args, {
    encoding: 'utf8',
    shell: true,
    stdio: inherit ? 'inherit' : 'pipe',
    env: { ...process.env, CI: process.env.CI ?? '' },
  });
  return { ok: r.status === 0, seconds: Math.round((Date.now() - started) / 100) / 10, output: inherit ? '' : `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

function block(message) {
  process.stderr.write(`verify-guard: BLOCKED\n${message}\n`);
  process.exit(2);
}

function readStdinJson() {
  try {
    const raw = readFileSync(0, 'utf8');
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function stagedFiles(command) {
  const all = command.includes(' -a') || command.includes('--all');
  const out = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']).split('\0').filter(Boolean);
  if (all) {
    for (const f of git(['diff', '--name-only', '--diff-filter=ACMR', '-z']).split('\0').filter(Boolean)) {
      if (!out.includes(f)) out.push(f);
    }
  }
  return out;
}

function stagedContent(file, fromWorktree) {
  if (fromWorktree) return existsSync(file) ? readFileSync(file, 'utf8') : '';
  const r = spawnSync('git', ['show', `:${file}`], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout : '';
}

function scanFiles(files, command) {
  const problems = [];
  const fromWorktree = command.includes(' -a') || command.includes('--all');
  for (const file of files) {
    if (SECRET_FILES.test(file)) problems.push(`secret file staged: ${file}`);
    if (BINARY_EXTS.some((e) => file.toLowerCase().endsWith(e))) continue;
    const text = stagedContent(file, fromWorktree);
    if (text.includes('\u2014')) problems.push(`em dash (U+2014) in ${file}`);
    if (!file.endsWith('verify-guard.mjs') && !file.endsWith('validate.mjs')) {
      for (const re of PATH_PATTERNS) if (re.test(text)) problems.push(`machine path pattern ${re} in ${file}`);
      for (const re of SECRET_PATTERNS) if (re.test(text)) problems.push(`credential pattern ${re} in ${file}`);
    }
  }
  return problems;
}

function touchesBuildInputs(files) {
  return files.some((f) => BUILD_INPUT_PREFIXES.some((p) => f.startsWith(p)) || BUILD_INPUT_FILES.includes(f));
}

function head() {
  return git(['rev-parse', 'HEAD']).trim();
}

function trackedChanges() {
  return git(['status', '--porcelain', '--untracked-files=no']).trim();
}

function guardCommit(command) {
  const files = stagedFiles(command);
  if (files.length === 0) return;
  const problems = scanFiles(files, command);
  if (problems.length) block(problems.map((p) => `  ${p}`).join('\n') + '\nFix the files (or unstage them) and commit again.');
  if (!touchesBuildInputs(files)) {
    process.stdout.write(`verify-guard: docs-only commit (${files.length} file(s)); scan clean, fast checks skipped.\n`);
    return;
  }
  for (const step of FAST_STEPS) {
    const r = run(step, false);
    if (!r.ok) {
      const tail = r.output.split(/\r?\n/).filter(Boolean).slice(-25).join('\n');
      block(`\`${step.label}\` failed (${r.seconds}s). Last lines:\n${tail}\nFix it, then commit again.`);
    }
  }
  process.stdout.write(`verify-guard: build inputs staged; ${FAST_STEPS.map((s) => s.label).join(' and ')} passed.\n`);
}

function guardPullRequest() {
  if (!existsSync(stampPath)) {
    block('No full-verification stamp. Run `node .claude/hooks/verify-guard.mjs full` (check, validate, build, validate, test, lhci, audit) and open the pull request only when it passes.');
  }
  const stamp = JSON.parse(readFileSync(stampPath, 'utf8'));
  const current = head();
  if (stamp.head !== current) {
    block(`The full-verification stamp is for ${stamp.head.slice(0, 7)} but HEAD is ${current.slice(0, 7)}. Run \`node .claude/hooks/verify-guard.mjs full\` on the current commit first.`);
  }
  const dirty = trackedChanges();
  if (dirty) block(`Tracked files have uncommitted changes:\n${dirty}\nCommit or discard them, re-run the full verification, then open the pull request.`);
  process.stdout.write(`verify-guard: full verification stamp matches HEAD ${current.slice(0, 7)} (${stamp.finished}).\n`);
}

function hookMode() {
  const input = readStdinJson();
  const tool = input.tool_name ?? '';
  const command = String(input.tool_input?.command ?? '');
  if (tool.endsWith('create_pull_request')) return guardPullRequest();
  if (/\bgh\s+pr\s+create\b/.test(command)) return guardPullRequest();
  if (/\bgit\b[^|;&\n]*\bcommit\b/.test(command)) return guardCommit(command);
}

// Playwright reuses a server already on 4173 and Lighthouse cannot start its own there, so a
// stale scripts/serve-with-headers.mjs from an earlier session makes the run fail late and
// cryptically (EADDRINUSE). Refuse to start while the port is taken.
async function portInUse(port) {
  const { createConnection } = await import('node:net');
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: '127.0.0.1' });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
    socket.setTimeout(1000, () => { socket.destroy(); resolve(false); });
  });
}

async function fullMode() {
  if (await portInUse(4173)) {
    process.stderr.write('verify-guard: port 4173 is already in use (a stale scripts/serve-with-headers.mjs from an earlier session?). Stop that process, then run again.\n');
    process.exit(1);
  }
  const results = [];
  for (const step of FULL_STEPS) {
    process.stdout.write(`\n=== ${step.label} ===\n`);
    const r = run(step, true);
    results.push({ step: step.label, ok: r.ok, seconds: r.seconds });
    if (!r.ok) {
      process.stderr.write(`\nverify-guard: FAILED at \`${step.label}\` after ${r.seconds}s. No stamp written.\n`);
      process.exit(1);
    }
  }
  const stamp = { head: head(), finished: new Date().toISOString(), dirtyAtRun: trackedChanges() !== '', steps: results };
  writeFileSync(stampPath, JSON.stringify(stamp, null, 2) + '\n');
  process.stdout.write(`\nverify-guard: PASS. All ${results.length} steps green for ${stamp.head.slice(0, 7)}; stamp written to .claude/verify-stamp.json\n`);
  if (stamp.dirtyAtRun) process.stdout.write('note: the tree had uncommitted tracked changes; commit them and re-run before opening a pull request.\n');
}

const mode = process.argv[2] ?? 'hook';
try {
  if (mode === 'full') await fullMode();
  else if (mode === 'hook') hookMode();
  else {
    process.stderr.write('usage: node .claude/hooks/verify-guard.mjs [hook|full]\n');
    process.exit(1);
  }
} catch (e) {
  process.stderr.write(`verify-guard: internal error: ${e.message}\n`);
  process.exit(1);
}
