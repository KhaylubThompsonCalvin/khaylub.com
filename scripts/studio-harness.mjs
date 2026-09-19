// The Studio harness (Phase 28, decision D-28): proves the owner Studio's forms with Playwright
// against a local Studio in local storage mode, where no sign-in exists, so no credential is ever
// involved. The Studio runs from this repository's studio/ package (its dependencies are already
// installed) with its local root pointed at a throwaway Git worktree of HEAD in the system temp
// directory (STUDIO_LOCAL_ROOT, read only by a development server), so every entry the tests
// create lands in the throwaway checkout and never in this one. After the Playwright project
// (playwright.studio.config.ts, tests/studio/) the harness runs validate inside the worktree over
// what the forms wrote, then stops the server and removes the worktree. Exit 1 on any failure.
// Usage: node scripts/studio-harness.mjs [--keep] [--port 4331] [-- <playwright args>]
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const keep = args.includes('--keep');
const portIndex = args.indexOf('--port');
const port = portIndex >= 0 ? Number(args[portIndex + 1]) : 4331;
const extra = args.includes('--') ? args.slice(args.indexOf('--') + 1) : [];
const repo = resolve('.');
const base = `http://127.0.0.1:${port}`;
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const shell = process.platform === 'win32';

const log = (m) => console.log(`studio-harness: ${m}`);
const run = (cmd, a, opts = {}) => execFileSync(cmd, a, { stdio: 'inherit', shell, ...opts });

// 1. The throwaway checkout: a worktree of HEAD, detached, in the temp directory.
const root = mkdtempSync(join(tmpdir(), 'khaylub-studio-'));
run('git', ['worktree', 'add', '--detach', '--quiet', root, 'HEAD']);
log(`throwaway checkout at a temp directory (${root.length} characters long)`);

// 2. The local Studio from this repository's studio/, writing into the worktree. Astro 7 runs the
// development server as a daemon that outlives the npm process, so it is stopped by its own
// command (astro dev stop), before starting in case one is left over, and after the run.
const stopDaemon = () => {
  try {
    execFileSync(npx, ['astro', 'dev', 'stop'], { cwd: join(repo, 'studio'), stdio: 'ignore', shell });
  } catch {}
};
stopDaemon();
const server = spawn(npm, ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port)], {
  cwd: join(repo, 'studio'),
  env: { ...process.env, STUDIO_LOCAL_ROOT: root, PUBLIC_KEYSTATIC_STORAGE: 'local' },
  stdio: ['ignore', 'pipe', 'pipe'],
  shell,
});
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));

async function ready() {
  for (let i = 0; i < 240; i += 1) {
    try {
      const res = await fetch(`${base}/robots.txt`);
      if (res.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

let code = 1;
try {
  if (!(await ready())) throw new Error(`the Studio did not answer on ${base} within 120 s\n${serverLog.slice(-2000)}`);
  log(`Studio answering on ${base} in local mode`);

  // 3. The Playwright project against it.
  let tests = 0;
  try {
    run(npx, ['playwright', 'test', '--config', 'playwright.studio.config.ts', ...extra], { env: { ...process.env, STUDIO_BASE: base, STUDIO_ROOT: root } });
  } catch (e) {
    tests = e.status ?? 1;
  }
  log(`Playwright ${tests === 0 ? 'PASS' : `FAIL (exit ${tests})`}`);

  // 4. validate over what the forms wrote (the repository's script, the worktree's content).
  let validated = 0;
  try {
    run(process.execPath, [join(repo, 'scripts', 'validate.mjs')], { cwd: root, shell: false });
  } catch (e) {
    validated = e.status ?? 1;
  }
  log(`validate in the throwaway checkout ${validated === 0 ? 'PASS' : `FAIL (exit ${validated})`}`);
  code = tests === 0 && validated === 0 ? 0 : 1;
} catch (e) {
  console.error(`studio-harness: ${e.message}`);
} finally {
  // 5. Stop the daemon and the npm process, and drop the worktree.
  stopDaemon();
  if (process.platform === 'win32') {
    try {
      execFileSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
    } catch {}
  } else server.kill('SIGTERM');
  if (keep) log(`worktree kept for inspection: ${root}`);
  else {
    try {
      run('git', ['worktree', 'remove', '--force', root], { stdio: 'ignore' });
    } catch {}
    if (existsSync(root)) rmSync(root, { recursive: true, force: true });
    try {
      run('git', ['worktree', 'prune'], { stdio: 'ignore' });
    } catch {}
    log('worktree removed');
  }
}
console.log(`studio-harness: ${code === 0 ? 'PASS' : 'FAIL'}`);
process.exit(code);
