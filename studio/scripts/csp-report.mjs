// The candidate Content Security Policy's violations on the Studio's anonymous shell (Phase 27,
// runbook 10.9): opens the built Studio's login shell in a real browser with no session and
// collects every securitypolicyviolation event and every policy line in the console under the
// Report-Only header the middleware serves. Prints the list (directive, blocked URI, disposition)
// and exits 1 when any violation is reported, so the candidate is adjusted before it is ever
// enforced. Run from the repository root after the Studio is built (`npm run build` in studio/);
// Playwright resolves from the root install. With STUDIO_CHECK_BASE set, that origin is probed and
// no server is started. The signed-in app is not exercised here: the owner's browser console (or
// the Phase 28 local harness) covers it.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

const remote = process.env.STUDIO_CHECK_BASE?.replace(/\/+$/, '');
if (!remote && !existsSync('studio/dist/server/entry.mjs')) {
  console.error('csp-report: build the Studio first (studio/dist/server/entry.mjs missing)');
  process.exit(1);
}
const port = Number(process.env.STUDIO_CHECK_PORT ?? 4328);
const base = remote ?? `http://127.0.0.1:${port}`;
const server = remote
  ? null
  : spawn(process.execPath, ['dist/server/entry.mjs'], { cwd: 'studio', env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) }, stdio: 'ignore' });

async function ready() {
  for (let i = 0; i < 50; i += 1) {
    try {
      if ((await fetch(`${base}/robots.txt`)).ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

const browser = await chromium.launch();
try {
  if (!(await ready())) throw new Error(`the Studio did not answer on ${base}`);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__csp.push({ directive: e.violatedDirective, blocked: e.blockedURI, disposition: e.disposition, source: e.sourceFile ? `${e.sourceFile}:${e.lineNumber}` : '' });
    });
  });
  const page = await context.newPage();
  const consoleLines = [];
  page.on('console', (m) => { if (/Content.Security.Policy/i.test(m.text())) consoleLines.push(m.text()); });
  const res = await page.goto(`${base}/keystatic`, { waitUntil: 'networkidle', timeout: 60_000 });
  const header = res?.headers()['content-security-policy-report-only'] ?? '';
  await page.waitForTimeout(1500);
  const events = await page.evaluate(() => window.__csp);
  const shell = await page.locator('body').innerText();
  console.log(`csp-report: ${base}/keystatic answered ${res?.status()}; Report-Only header ${header ? 'present' : 'ABSENT'}; shell text: ${shell.replace(/\s+/g, ' ').slice(0, 80)}`);
  if (!header) {
    console.error('csp-report: FAIL, no Content-Security-Policy-Report-Only header on /keystatic');
    process.exit(1);
  }
  if (events.length === 0 && consoleLines.length === 0) {
    console.log('csp-report: PASS, no violation on the anonymous shell under the candidate policy');
  } else {
    console.error(`csp-report: FAIL, ${events.length} violation event(s), ${consoleLines.length} console line(s)`);
    for (const e of events) console.error(`  - ${e.directive}: ${e.blocked} (${e.disposition}) ${e.source}`);
    for (const l of consoleLines) console.error(`  - ${l}`);
    process.exit(1);
  }
} finally {
  await browser.close();
  server?.kill();
}
