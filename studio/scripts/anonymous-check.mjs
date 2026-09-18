// The anonymous surface of the built Studio, asserted (runbook section 10.3): starts the standalone
// server from dist/ on a local port with no session, then proves that a visitor who has not signed
// in can neither read nor write repository content and that every response carries the private-by-
// default headers. Exit 1 on any mismatch. Run after `npm run build` (cloud or github mode); CI runs
// it on every change to studio/. With STUDIO_CHECK_BASE set (for example the deployed service's
// https URL) no server is started and that origin is probed instead.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const remote = process.env.STUDIO_CHECK_BASE?.replace(/\/+$/, '');
if (!remote && !existsSync('dist/server/entry.mjs')) {
  console.error('anonymous-check: build the Studio first (dist/server/entry.mjs missing)');
  process.exit(1);
}

const port = Number(process.env.STUDIO_CHECK_PORT ?? 4327);
const base = remote ?? `http://127.0.0.1:${port}`;
const server = remote
  ? null
  : spawn(process.execPath, ['dist/server/entry.mjs'], {
      env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
let serverLog = '';
server?.stdout.on('data', (d) => (serverLog += d));
server?.stderr.on('data', (d) => (serverLog += d));

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

async function ready() {
  for (let i = 0; i < 50; i += 1) {
    try {
      const res = await fetch(`${base}/robots.txt`);
      if (res.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

const expectedHeaders = {
  'x-robots-tag': 'noindex, nofollow, noarchive',
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'cache-control': 'no-store',
  'content-security-policy': "frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'",
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
};
// The candidate policy (Phase 27) is served Report-Only; its exact text lives in the middleware and
// only its presence and its no-frame, no-plugin lines are asserted here.
const REPORT_ONLY = /default-src 'self'.*frame-ancestors 'none'.*object-src 'none'/;

try {
  check(await ready(), `the server did not answer on ${base} within 10 s\n${serverLog}`);
  if (failures.length === 0) {
    const get = (path, init) => fetch(`${base}${path}`, { redirect: 'manual', ...init });

    const root = await get('/');
    check(root.status === 302 && new URL(root.headers.get('location') ?? '', base).pathname === '/keystatic', `/ should redirect to /keystatic, got ${root.status}`);

    const admin = await get('/keystatic');
    check(admin.status === 200, `/keystatic should answer 200 (the login shell), got ${admin.status}`);
    const html = await admin.text();
    check(!/preserving-v1|studio-smoke-test|content\/notes/.test(html), '/keystatic HTML must not embed repository content');
    for (const [name, value] of Object.entries(expectedHeaders)) {
      check(admin.headers.get(name) === value, `/keystatic header ${name}: expected "${value}", got "${admin.headers.get(name)}"`);
    }
    check(REPORT_ONLY.test(admin.headers.get('content-security-policy-report-only') ?? ''), `/keystatic must carry the candidate policy as Content-Security-Policy-Report-Only, got "${admin.headers.get('content-security-policy-report-only')}"`);

    const robots = await get('/robots.txt');
    check(robots.status === 200 && /Disallow: \/\s*$/m.test(await robots.text()), '/robots.txt must disallow everything');

    // Keystatic's API: the tree and blob readers answer only in local mode (never deployed); in
    // cloud mode the handler answers 404 for everything, and an unauthenticated write is refused.
    const tree = await get('/api/keystatic/tree', { headers: { 'no-cors': '1' } });
    check(tree.status === 404, `GET /api/keystatic/tree should be 404 without local mode, got ${tree.status}`);
    const blob = await get('/api/keystatic/blob/content/notes/preserving-v1.md', { headers: { 'no-cors': '1' } });
    check(blob.status === 404, `GET /api/keystatic/blob/... should be 404, got ${blob.status}`);
    const update = await get('/api/keystatic/update', { method: 'POST', headers: { 'no-cors': '1', 'content-type': 'application/json' }, body: '{}' });
    check(update.status === 403 || update.status === 404, `POST /api/keystatic/update should be refused, got ${update.status}`);

    for (const path of ['/content/notes/preserving-v1.md', '/keystatic.config.ts', '/package.json', '/.env']) {
      const res = await get(path);
      check(res.status === 404, `${path} should be 404, got ${res.status}`);
    }
  }
} finally {
  server?.kill();
}

if (failures.length) {
  console.error('anonymous-check: FAIL');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`anonymous-check: PASS on ${base} (redirect, login shell only, private headers, the Report-Only candidate policy, robots, API reads 404, write refused, files 404)`);
