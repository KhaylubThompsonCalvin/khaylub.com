// The publishing harness (Phase 27, decision D-28): proves one Studio save's whole path with reads,
// not clicks. Given a studio/* branch it reads GitHub (the branch, the pull request the workflow
// opened, the six required checks on the head commit, the auto-merge flag, the merge after green,
// the file on main), then polls the staging and production origins until their build stamp
// (/build.json) carries the merge commit and checks the entry's URL: staging serves drafts and
// published pieces alike, production serves only what is published. Every step prints PASS or FAIL
// with its numbers (times from the save, run conclusions, statuses); the exit code is 1 on any FAIL.
// No secret: gh uses the session's own login (in CI, the workflow token).
//
// Usage: node scripts/publishing-verify.mjs <branch> [--expect published|draft|withdrawn|removed|refused|held]
//        [--timeout 25m] [--staging <url>] [--production <url>] [--out report.json] [--no-wait]
//
//   published  the default when the merged file says so: merged, live on both origins
//   draft      merged; staging serves it; production answers 404
//   withdrawn  merged; both origins serve the withdrawal notice at the address, not the piece;
//              the derived places on production no longer name it (runbook 10.9)
//   removed    merged (a revert or a delete); both origins answer 404
//   refused    a failing document: checks red, no merge, main and production unchanged
//   held       the pull request was closed without merging; nothing reaches main
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const STAGING = 'https://khaylub-com-v2.onrender.com';
const PRODUCTION = 'https://khaylub.com';
// The main protection rule at Phase 26 (runbook 10.7); read from the API when the login may, else this.
const REQUIRED_FALLBACK = ['build-and-check', 'lighthouse (0)', 'lighthouse (1)', 'lighthouse (2)', 'build-preview', 'studio'];
const HIDDEN = new Set(['draft', 'review']);

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const VALUE_OPTIONS = new Set(['--expect', '--timeout', '--staging', '--production', '--out']);
let branch = null;
for (let i = 0; i < args.length; i++) {
  if (VALUE_OPTIONS.has(args[i])) i++;
  else if (!args[i].startsWith('--')) { branch = args[i]; break; }
}
if (!branch) {
  console.error('usage: node scripts/publishing-verify.mjs <branch> [--expect ...] [--timeout 25m]');
  process.exit(2);
}
let expect = opt('expect', null);
if (expect && !['published', 'draft', 'withdrawn', 'removed', 'refused', 'held'].includes(expect)) {
  console.error(`--expect must be one of published, draft, withdrawn, removed, refused, held (got "${expect}")`);
  process.exit(2);
}
const timeoutMs = parseDuration(opt('timeout', '25m'));
const staging = opt('staging', STAGING).replace(/\/$/, '');
const production = opt('production', PRODUCTION).replace(/\/$/, '');
const out = opt('out', null);
const wait = !args.includes('--no-wait');

const steps = [];
const report = { branch, expect: null, at: new Date().toISOString(), staging, production, steps, ok: true };
const step = (name, ok, detail, extra = {}) => {
  steps.push({ name, result: ok === null ? 'SKIP' : ok ? 'PASS' : 'FAIL', detail, ...extra });
  if (ok === false) report.ok = false;
  console.log(`${(ok === null ? 'SKIP' : ok ? 'PASS' : 'FAIL').padEnd(5)} ${name}: ${detail}`);
};

function parseDuration(s) {
  const m = /^(\d+)(m|s)?$/.exec(String(s));
  if (!m) throw new Error(`bad duration ${s}`);
  return Number(m[1]) * (m[2] === 's' ? 1000 : 60_000);
}
function gh(...a) {
  return execFileSync('gh', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
function ghJson(...a) {
  return JSON.parse(gh(...a));
}
function api(path, ok404 = false) {
  try {
    return ghJson('api', path);
  } catch (e) {
    if (ok404 && /HTTP 404/.test(String(e.stderr ?? e.message))) return null;
    throw e;
  }
}
const secs = (a, b) => (a && b ? Math.round((new Date(b) - new Date(a)) / 1000) : null);
const mmss = (s) => (s === null ? 'n/a' : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const repo = ghJson('repo', 'view', '--json', 'nameWithOwner').nameWithOwner;
console.log(`publishing-verify: ${repo} ${branch} (staging ${staging}, production ${production})`);

// 1. The branch on the remote (deleted after a merge by the cleanup workflow or the owner is fine).
const ref = api(`repos/${repo}/git/ref/heads/${branch}`, true);

// 2. The pull request the workflow opened for it. Unless --no-wait, the read repeats until the
// pull request is settled (merged, closed, or a required check failed with none still running),
// so the harness can be started right after the save and time the whole path.
const PR_FIELDS = 'number,state,createdAt,mergedAt,closedAt,mergeCommit,headRefOid,baseRefOid,autoMergeRequest,mergedBy,files,url';
const startedPoll = Date.now();
let required = REQUIRED_FALLBACK;
let requiredSource = 'the recorded rule';
try {
  required = ghJson('api', `repos/${repo}/branches/main/protection/required_status_checks`).contexts;
  requiredSource = 'the protection rule';
} catch {
  /* the login may not read the protection rule; the recorded list stands */
}
const readPr = () => ghJson('pr', 'list', '--repo', repo, '--head', branch, '--base', 'main', '--state', 'all', '--limit', '5', '--json', PR_FIELDS).sort((a, b) => b.number - a.number)[0];
const readRuns = (sha) => api(`repos/${repo}/commits/${sha}/check-runs?per_page=100`).check_runs;
let pr = readPr();
let runs = pr ? readRuns(pr.headRefOid) : [];
const settled = () => {
  if (!pr) return false;
  if (pr.mergedAt || pr.state === 'CLOSED') return true;
  const named = required.map((n) => runs.find((r) => r.name === n));
  return named.every((r) => r && r.status === 'completed') && named.some((r) => r.conclusion !== 'success');
};
let waitedForPr = false;
while (wait && !settled() && Date.now() < startedPoll + timeoutMs) {
  if (!waitedForPr) console.log(`waiting for the pull request to settle (up to ${mmss(timeoutMs / 1000)})...`);
  waitedForPr = true;
  await sleep(30_000);
  pr = readPr();
  runs = pr ? readRuns(pr.headRefOid) : [];
}
if (!pr) {
  step('branch', !!ref, ref ? `heads/${branch} at ${ref.object.sha.slice(0, 7)}` : 'not on the remote');
  step('pull request', false, `none for ${branch} (the Studio workflow opens one on the push; a closed-unmerged one holds the branch back)`);
  finish();
}
step('branch', ref ? true : pr.mergedAt ? true : false, ref ? `heads/${branch} at ${ref.object.sha.slice(0, 7)}` : pr.mergedAt ? 'deleted after the merge' : 'not on the remote and not merged');
const head = pr.headRefOid;
const saveAt = api(`repos/${repo}/commits/${head}`).commit.committer.date;
step('pull request', true, `#${pr.number} ${pr.state}, opened ${mmss(secs(saveAt, pr.createdAt))} after the save ${head.slice(0, 7)} (${pr.url})`, { number: pr.number, head, saveAt, createdAt: pr.createdAt });

// The entries the save touched (content/<collection>/<slug>.md or content/<collection>/<slug>/index.md).
const entries = [];
for (const f of pr.files ?? []) {
  const m = /^content\/([a-z]+)\/([a-z0-9-]+)(?:\/index)?\.md$/.exec(f.path);
  if (m && !entries.some((e) => e.path === f.path)) entries.push({ collection: m[1], slug: m[2], path: f.path, url: `/${m[1]}/${m[2]}/` });
}
step('entries', entries.length > 0, entries.length ? entries.map((e) => e.url).join(', ') : 'no content entry in the pull request');

// 3. The required checks on the head commit.
const byName = new Map(runs.map((r) => [r.name, r]));
const missing = required.filter((n) => !byName.has(n));
const red = required.filter((n) => byName.get(n) && byName.get(n).conclusion !== 'success');
const pending = required.filter((n) => byName.get(n) && byName.get(n).status !== 'completed');
const checksDone = required.map((n) => byName.get(n)?.completed_at).filter(Boolean).sort().at(-1) ?? null;
const conclusions = required.map((n) => `${n}=${byName.get(n)?.conclusion ?? byName.get(n)?.status ?? 'absent'}`).join(' ');

// The expectation: given, or read from the merged file (published unless hidden).
const mainFile = entries[0] ? api(`repos/${repo}/contents/${entries[0].path}?ref=main`, true) : null;
const mainStatus = mainFile ? statusOf(Buffer.from(mainFile.content, 'base64').toString('utf8')) : null;
if (!expect) {
  if (pr.state === 'CLOSED' && !pr.mergedAt) expect = 'held';
  else if (!pr.mergedAt && red.length) expect = 'refused';
  else if (pr.mergedAt && !mainFile) expect = 'removed';
  else if (mainStatus === 'withdrawn') expect = 'withdrawn';
  else expect = mainStatus && HIDDEN.has(mainStatus) ? 'draft' : 'published';
}
report.expect = expect;
console.log(`expectation: ${expect}`);

if (expect === 'refused') {
  step('checks', red.length > 0 && pending.length === 0, `${red.length} required check(s) red of ${required.length} (${requiredSource}): ${conclusions}`);
  step('auto-merge', pr.state === 'OPEN' ? !!pr.autoMergeRequest : null, pr.state === 'OPEN' ? (pr.autoMergeRequest ? 'enabled, waiting on green' : 'not enabled') : `pull request ${pr.state}`);
  step('merge', !pr.mergedAt, pr.mergedAt ? `MERGED at ${pr.mergedAt} despite red checks` : 'not merged');
} else if (expect === 'held') {
  step('checks', null, conclusions);
  step('auto-merge', null, 'closed without merging');
  step('merge', !pr.mergedAt && pr.state === 'CLOSED', pr.mergedAt ? 'merged' : `closed ${pr.closedAt} without merging`);
} else {
  step('checks', missing.length === 0 && red.length === 0 && pending.length === 0, `${required.length} required (${requiredSource}) all success, last completed ${mmss(secs(saveAt, checksDone))} after the save: ${conclusions}`);
  const auto = pr.mergedAt ? /github-actions|app\/github-actions/.test(pr.mergedBy?.login ?? '') || !!pr.autoMergeRequest : !!pr.autoMergeRequest;
  step('auto-merge', auto, pr.mergedAt ? `merged by ${pr.mergedBy?.login ?? 'unknown'}` : pr.autoMergeRequest ? 'enabled' : 'not enabled');
  const afterGreen = pr.mergedAt && checksDone && new Date(pr.mergedAt) >= new Date(checksDone);
  step('merge', !!pr.mergedAt && !!afterGreen, pr.mergedAt ? `${pr.mergeCommit?.oid?.slice(0, 7)} at ${pr.mergedAt}, ${mmss(secs(checksDone, pr.mergedAt))} after the last check, ${mmss(secs(saveAt, pr.mergedAt))} after the save` : `not merged (${pr.state}, auto-merge ${pr.autoMergeRequest ? 'enabled' : 'off'})`);
}

// 4. main's content.
for (const e of entries) {
  const file = e === entries[0] ? mainFile : api(`repos/${repo}/contents/${e.path}?ref=main`, true);
  const status = file ? statusOf(Buffer.from(file.content, 'base64').toString('utf8')) : null;
  e.mainStatus = status;
  e.title = file ? (/^title:\s*['"]?(.+?)['"]?\s*$/m.exec(Buffer.from(file.content, 'base64').toString('utf8').split(/^---\s*$/m)[1] ?? '')?.[1] ?? null) : null;
  if (expect === 'removed') step(`main ${e.path}`, !file, file ? `still on main (status ${status})` : 'absent from main');
  else if (expect === 'refused' || expect === 'held') {
    const base = api(`repos/${repo}/contents/${e.path}?ref=${pr.baseRefOid}`, true);
    const same = (base?.sha ?? null) === (file?.sha ?? null);
    step(`main ${e.path}`, same, same ? `unchanged from the pull request's base (${file ? 'status ' + status : 'absent'})` : 'differs from the base: something reached main');
  } else if (expect === 'draft') step(`main ${e.path}`, !!file && HIDDEN.has(status), file ? `status ${status}` : 'absent from main');
  else if (expect === 'withdrawn') step(`main ${e.path}`, !!file && status === 'withdrawn', file ? `status ${status}` : 'absent from main');
  else step(`main ${e.path}`, !!file && status === 'published', file ? `status ${status}` : 'absent from main');
}

// 5. The origins: the build stamp reaches the merge commit (or a later main), then the entry's status.
const target = pr.mergedAt ? pr.mergeCommit?.oid : api(`repos/${repo}/git/ref/heads/main`).object.sha;
for (const [label, origin] of [['staging', staging], ['production', production]]) {
  const live = await waitForBuild(origin, target, label);
  const buildAt = new Date().toISOString();
  if (live.ok === false) {
    step(`${label} build`, false, live.detail);
    continue;
  }
  // A build without the stamp (before Phase 27's endpoint is deployed there) is probed by content:
  // the entry's URL is polled until it answers as expected, so a new piece still yields a time.
  if (live.ok === null) step(`${label} build`, null, live.detail);
  else step(`${label} build`, true, `${live.detail}${live.waited ? `, seen ${mmss(secs(saveAt, buildAt))} after the save` : ' (already live at the first probe)'}`, { commit: live.commit, seenAt: buildAt });
  for (const e of entries) {
    const want = wantStatus(label, e);
    let res = await fetch(origin + e.url, { redirect: 'manual' });
    let waited = false;
    while (live.ok === null && wait && res.status !== want && Date.now() < startedPoll + timeoutMs) {
      waited = true;
      await sleep(20_000);
      res = await fetch(origin + e.url, { redirect: 'manual' });
    }
    const html = res.status === 200 ? await res.text() : '';
    let ok = want === 200 ? res.status === 200 && html.includes('</main>') : res.status === want;
    let note = want === 200 && html ? ', page body served' : '';
    if (expect === 'withdrawn') {
      const notice = html.includes('data-withdrawn="true"') && /<meta name="robots" content="noindex/.test(html);
      const clean = !html.includes('</article') && !(e.title && html.includes(e.title));
      ok = res.status === 200 && notice && clean;
      note = notice ? (clean ? ', the withdrawal notice, nothing of the piece' : ', the notice but the piece still shows') : ', NOT the withdrawal notice (the old page)';
    }
    step(`${label} ${e.url}`, ok, `${res.status} (expected ${want}${note})${waited ? `, seen ${mmss(secs(saveAt, new Date().toISOString()))} after the save by content` : ''}`);
    if (res.status === 200 && label === 'production' && expect === 'published') {
      const noindex = /<meta[^>]+name="robots"[^>]+noindex/i.test(html);
      step(`production ${e.url} indexable`, !noindex, noindex ? 'noindex on production' : 'no noindex meta');
    }
    // The derived places on production: the collection index, the sitemap, both feeds, the graph,
    // and the card. A published piece is in all of them; anything else is in none (the card of a
    // withdrawn piece is the site's default card).
    if (label === 'production' && live.ok !== false) {
      // A refused or held save leaves main as it was: the piece is present exactly when main's file is published.
      const present = expect === 'published' || ((expect === 'refused' || expect === 'held') && e.mainStatus === 'published');
      const places = [[`/${e.collection}/`, 'collection index'], ['/sitemap-0.xml', 'sitemap'], ['/feed.json', 'JSON feed'], ['/feed.xml', 'RSS feed'], ['/graph/', 'graph']];
      const found = [];
      for (const [path, name] of places) {
        const text = await (await fetch(origin + path, { cache: 'no-store' })).text();
        if (text.includes(e.url)) found.push(name);
      }
      const okPlaces = present ? found.length === places.length : found.length === 0;
      step(`production derived places ${e.url}`, okPlaces, present ? `named in ${found.length} of ${places.length}: ${found.join(', ') || 'none'}` : found.length ? `still named in: ${found.join(', ')}` : 'named in none of the collection index, sitemap, feeds, graph');
      const card = await fetch(`${origin}/og/${e.collection}/${e.slug}.png`, { cache: 'no-store' });
      if (expect === 'withdrawn') {
        const bytes = card.status === 200 ? Buffer.from(await card.arrayBuffer()) : Buffer.alloc(0);
        const def = Buffer.from(await (await fetch(`${origin}/og-default.png`, { cache: 'no-store' })).arrayBuffer());
        step(`production card ${e.url}`, card.status === 200 && bytes.equals(def), card.status === 200 ? (bytes.equals(def) ? 'the default card' : 'still the old card') : `HTTP ${card.status}`);
      } else if (present) step(`production card ${e.url}`, card.status === 200, `HTTP ${card.status}`);
    }
  }
}
finish();

function wantStatus(label, e) {
  if (expect === 'withdrawn') return 200;
  if (expect === 'removed') return 404;
  if (expect === 'refused' || expect === 'held') return e.mainStatus ? (label === 'staging' || e.mainStatus === 'published' ? 200 : 404) : 404;
  if (expect === 'draft') return label === 'staging' ? 200 : 404;
  return 200;
}

function statusOf(text) {
  const m = /^status:\s*['"]?([a-z]+)['"]?\s*$/m.exec(text.split(/^---\s*$/m)[1] ?? '');
  return m ? m[1] : null;
}

async function waitForBuild(origin, targetSha, label) {
  const deadline = startedPoll + timeoutMs;
  let waited = false;
  let last = null;
  for (;;) {
    try {
      const res = await fetch(`${origin}/build.json`, { cache: 'no-store' });
      if (res.status === 200) {
        const stamp = await res.json();
        last = stamp.commit;
        if (stamp.commit === targetSha) return { ok: true, waited, commit: stamp.commit, detail: `serves ${stamp.commit.slice(0, 7)} (${stamp.env})` };
        if (stamp.commit) {
          const cmp = api(`repos/${repo}/compare/${targetSha}...${stamp.commit}`, true);
          if (cmp && (cmp.status === 'ahead' || cmp.status === 'identical')) return { ok: true, waited, commit: stamp.commit, detail: `serves ${stamp.commit.slice(0, 7)} (${stamp.env}), ${cmp.ahead_by} commit(s) past ${targetSha.slice(0, 7)}` };
        }
      } else if (res.status === 404) return { ok: null, detail: `no build stamp on ${label} yet (a build from before the /build.json endpoint); the entry is probed by content` };
      else last = `HTTP ${res.status} for /build.json`;
    } catch (e) {
      last = e.message;
    }
    if (!wait || Date.now() > deadline) return { ok: false, detail: `${label} still serves ${String(last).slice(0, 12)} after ${mmss(Math.round((Date.now() - startedPoll) / 1000))}; wanted ${targetSha.slice(0, 7)}` };
    waited = true;
    await sleep(20_000);
  }
}

function finish() {
  report.elapsedSeconds = Math.round((Date.now() - new Date(report.at)) / 1000);
  if (out) writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  console.log(`${report.ok ? 'PASS' : 'FAIL'}: ${steps.filter((s) => s.result === 'PASS').length} pass, ${steps.filter((s) => s.result === 'FAIL').length} fail, ${steps.filter((s) => s.result === 'SKIP').length} skipped (${report.expect ?? expect ?? 'no expectation'})`);
  process.exit(report.ok ? 0 : 1);
}
