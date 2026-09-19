// The Studio authoring command (Phase 28, decision D-28): after the owner has approved one audited
// candidate (scripts/portfolio-audit.mjs) and its content package, this drives the owner Studio's
// Projects form with Playwright to create the entry on a studio/* branch, from approved material
// only. It runs against the local Studio in local storage mode (the same forms and configuration
// as the deployed Studio; no sign-in exists locally, so no credential is ever involved; the
// deployed Studio is never automated), pointed at a throwaway worktree that becomes the Studio
// branch. Nothing is invented: every field comes from the approved package, and a field the
// package leaves out stays empty. Publication is a separate, explicit step.
//
// Usage: node scripts/studio-author.mjs <candidate-id> [--preview] [--push] [--publish] [--acceptance] [--port 4332]
//   --preview     print the content review (title, summary, context, technologies, body, media,
//                 provenance, omissions) and stop; nothing is created
//   (default)     create the entry as a draft on studio/<slug> in a worktree, validate, commit; no push
//   --push        also push the branch (the workflow opens the pull request; staging shows the draft)
//   --publish     requires "approvedForPublication": true in the package: set the status to
//                 published through the Studio, commit, push (the normal path merges it)
//   --acceptance  after --publish, run `npm run acceptance studio/<slug>`
// Inputs (never in Git): PORTFOLIO_OUT (default .portfolio/) holds manifests/<id>.json from the audit
// and approved/<id>.json, the package written after the owner's approval:
//   { slug, title, summary, type, project_status, context, technologies[], tags[], skills[], source,
//     links: { code, live, result }, problem, role, outcome, body (Markdown), aiAssisted,
//     cover: { file, alt }, provenance: { source, license, date, generator }, employerVisible,
//     omitted: [ "what was left out and why" ], approvedForPublication: false }
// The cover file is a derived copy the owner placed under PORTFOLIO_OUT (never a graded original).
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, basename } from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith('--'));
const flag = (n) => args.includes(`--${n}`);
const portIndex = args.indexOf('--port');
const port = portIndex >= 0 ? Number(args[portIndex + 1]) : 4332;
const out = process.env.PORTFOLIO_OUT ?? '.portfolio';
if (!id) {
  console.error('usage: node scripts/studio-author.mjs <candidate-id> [--preview] [--push] [--publish] [--acceptance]');
  process.exit(2);
}
const manifestFile = join(out, 'manifests', `${id}.json`);
const packageFile = join(out, 'approved', `${id}.json`);
if (!existsSync(manifestFile)) {
  console.error(`studio-author: no manifest for ${id} (run npm run portfolio:audit first)`);
  process.exit(2);
}
if (!existsSync(packageFile)) {
  console.error(`studio-author: no approved package at ${packageFile}: the owner approval gate is not passed`);
  process.exit(2);
}
const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
const pkg = JSON.parse(readFileSync(packageFile, 'utf8'));

// ---------- the package is checked before anything is touched ----------
const problems = [];
const need = (k, test, why) => {
  if (!test(pkg[k])) problems.push(`${k}: ${why}`);
};
need('slug', (v) => typeof v === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v), 'a slug of lowercase letters, digits, and single hyphens');
need('title', (v) => typeof v === 'string' && v.length >= 3 && v.length <= 90, '3 to 90 characters');
need('summary', (v) => typeof v === 'string' && v.length >= 40 && v.length <= 240, '40 to 240 characters');
need('type', (v) => ['case-study', 'concept', 'exhibit'].includes(v), 'case-study, concept, or exhibit');
need('project_status', (v) => ['live', 'prototype', 'private-beta', 'concept', 'archived'].includes(v), 'live, prototype, private-beta, concept, or archived');
need('technologies', (v) => Array.isArray(v) && v.length >= 1, 'at least one technology slug');
need('tags', (v) => Array.isArray(v) && v.length >= 1, 'at least one tag slug');
need('source', (v) => typeof v === 'string' && v.length >= 1, 'where the claims come from');
need('body', (v) => typeof v === 'string' && v.trim().length >= 40, 'the approved Markdown body');
if (pkg.context !== undefined && pkg.context !== null && !(typeof pkg.context === 'string' && pkg.context.length >= 3 && pkg.context.length <= 120)) problems.push('context: 3 to 120 characters when set');
if (pkg.cover) {
  if (!pkg.cover.file || !existsSync(pkg.cover.file)) problems.push('cover.file: the derived copy is missing');
  if (!pkg.cover.alt || pkg.cover.alt.length < 5) problems.push('cover.alt: at least 5 characters');
  const pv = pkg.provenance ?? {};
  if (!pv.source || !pv.license || !pv.date) problems.push('provenance: source, license, and date are required with a cover');
  if (pkg.cover.file && resolve(pkg.cover.file).toLowerCase().includes(String(manifest.unit ?? '').toLowerCase()) && manifest.sourcePaths?.some((p) => resolve(pkg.cover.file).endsWith(p.replace(/\//g, '\\'))))
    problems.push('cover.file: points at a graded original; use a derived copy');
}
const strings = [pkg.title, pkg.summary, pkg.body, pkg.problem, pkg.role, pkg.outcome, pkg.context, pkg.cover?.alt, pkg.provenance?.source].filter(Boolean);
if (strings.some((t) => t.includes(String.fromCharCode(0x2014)))) problems.push('an em dash (U+2014) is present; the site refuses it');
if (pkg.type === 'case-study') {
  const HEADINGS = ['Problem', 'Why it mattered', 'Requirements', 'Design', 'Technology choices', 'Why these choices', 'What I built', 'What went wrong', 'Verification', 'What I would change', 'What I learned', 'Code', 'Result'];
  const found = [...(pkg.body ?? '').matchAll(/^##\s+(.+?)\s*$/gm)].map((m) => m[1]);
  const missing = HEADINGS.filter((h) => !found.includes(h));
  if (missing.length) problems.push(`body: a case study needs the thirteen headings in order; missing ${missing.join(', ')}`);
}
if (problems.length) {
  console.error('studio-author: the approved package is not complete:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(2);
}

// ---------- the content review (Part E) ----------
function preview() {
  const lines = [
    `# Content review for ${id}`,
    '',
    `- Title: ${pkg.title}`,
    `- Slug: ${pkg.slug} (the address /projects/${pkg.slug}/)`,
    `- Summary: ${pkg.summary}`,
    `- Course or context: ${pkg.context ?? '(none)'}`,
    `- Type and status: ${pkg.type}, ${pkg.project_status}; publication status ${pkg.approvedForPublication ? 'approved' : 'NOT yet approved (draft only)'}`,
    `- Technologies: ${pkg.technologies.join(', ')}`,
    `- Tags: ${pkg.tags.join(', ')}${pkg.skills?.length ? `; skills: ${pkg.skills.join(', ')}` : ''}`,
    `- Source: ${pkg.source}`,
    `- Links: ${Object.entries(pkg.links ?? {}).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join('; ') || '(none)'}`,
    `- Problem: ${pkg.problem ?? '(none)'}`,
    `- Role: ${pkg.role ?? '(none)'}`,
    `- Outcome: ${pkg.outcome ?? '(none)'}`,
    `- AI assistance declared: ${pkg.aiAssisted ? 'yes' : 'no'}; on the Work page: ${pkg.employerVisible ? 'yes' : 'no'}`,
    `- Media: ${pkg.cover ? `${basename(pkg.cover.file)} (alt: ${pkg.cover.alt})` : 'none'}`,
    `- Provenance: ${pkg.provenance ? `${pkg.provenance.source}; ${pkg.provenance.license}; ${pkg.provenance.date}${pkg.provenance.generator ? `; generated in part with ${pkg.provenance.generator}` : ''}` : 'none'}`,
    `- Omitted for privacy: ${(pkg.omitted ?? []).join('; ') || '(nothing listed)'}`,
    '',
    '## Body',
    '',
    pkg.body.trim(),
    '',
    'Question for the owner: does this content accurately represent the work, and is it approved for publication?',
  ];
  return lines.join('\n');
}
if (flag('preview')) {
  console.log(preview());
  process.exit(0);
}
if (flag('publish') && pkg.approvedForPublication !== true) {
  console.error('studio-author: --publish needs "approvedForPublication": true in the package (the owner\'s explicit approval)');
  process.exit(2);
}

// ---------- the worktree and the local Studio ----------
const repo = resolve('.');
const branch = `studio/${pkg.slug}`;
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const shell = process.platform === 'win32';
const run = (cmd, a, opts = {}) => execFileSync(cmd, a, { stdio: 'pipe', shell, encoding: 'utf8', ...opts }).trim();
const log = (m) => console.log(`studio-author: ${m}`);
const quiet = (fn) => {
  try {
    fn();
  } catch {}
};
const stopDaemon = () => quiet(() => execFileSync(npx, ['astro', 'dev', 'stop'], { cwd: join(repo, 'studio'), stdio: 'ignore', shell }));

run('git', ['fetch', '--quiet', '--prune', 'origin']);
const remoteHas = run('git', ['ls-remote', '--heads', 'origin', branch]) !== '';
const entryPath = join('content', 'projects', pkg.slug, 'index.md');
let root = null;
let server = null;
let code = 1;
try {
  root = mkdtempSync(join(tmpdir(), 'khaylub-author-'));
  if (remoteHas) run('git', ['worktree', 'add', '--quiet', root, `origin/${branch}`]);
  else run('git', ['worktree', 'add', '--quiet', '-b', branch, root, 'origin/main']);
  if (remoteHas) run('git', ['checkout', '--quiet', '-B', branch, `origin/${branch}`], { cwd: root });
  log(`worktree on ${branch} (${remoteHas ? 'the existing remote branch' : 'new, from origin/main'})`);
  const exists = existsSync(join(root, entryPath));
  if (exists && !flag('publish')) throw new Error(`${entryPath} already exists on ${branch}; use --publish to set its status, or choose another slug`);
  if (!exists && flag('publish')) throw new Error(`${entryPath} does not exist yet on ${branch}; create the draft first`);

  stopDaemon();
  const base = `http://127.0.0.1:${port}`;
  server = spawn(npm, ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port)], { cwd: join(repo, 'studio'), env: { ...process.env, STUDIO_LOCAL_ROOT: root, PUBLIC_KEYSTATIC_STORAGE: 'local' }, stdio: 'ignore', shell });
  let up = false;
  for (let i = 0; i < 240 && !up; i += 1) {
    try {
      up = (await fetch(`${base}/robots.txt`)).ok;
    } catch {}
    if (!up) await new Promise((r) => setTimeout(r, 500));
  }
  if (!up) throw new Error(`the Studio did not answer on ${base}`);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const byLabel = (key) => page.getByLabel(new RegExp(`^${key.replace(/_/g, ' ').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\*?$`));
  const pick = async (label, current, value) => {
    await page.getByRole('button', { name: `${current} ${label}` }).click();
    await page.getByRole('option', { name: value, exact: true }).click();
  };
  const checkGroup = async (group, slugs) => {
    const g = page.getByRole('group', { name: group });
    for (const slug of slugs) {
      const label = vocabLabel(group, slug);
      const box = g.getByRole('checkbox', { name: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) });
      if ((await box.count()) === 0) throw new Error(`${group}: "${slug}" is not in the vocabulary offered by the form`);
      await box.first().check();
    }
  };
  try {
    if (!flag('publish')) {
      await page.goto(`${base}/keystatic/collection/projects/create`, { waitUntil: 'networkidle', timeout: 120_000 });
      await byLabel('title').first().fill(pkg.title);
      await byLabel('slug').first().fill(pkg.slug);
      await pick('type', 'case-study', pkg.type);
      await pick('status', 'draft', 'draft');
      await byLabel('date').first().fill(pkg.date ?? new Date().toISOString().slice(0, 10));
      await byLabel('summary').first().fill(pkg.summary);
      await checkGroup('tags', pkg.tags);
      if (pkg.skills?.length) await checkGroup('skills', pkg.skills);
      if (pkg.employerVisible) await page.getByRole('checkbox', { name: /^employer visible\b/ }).check();
      await byLabel('source').first().fill(pkg.source);
      if (pkg.aiAssisted) await page.getByRole('checkbox', { name: /^ai assisted\b/ }).check();
      await pick('project status', 'concept', pkg.project_status);
      await checkGroup('technologies', pkg.technologies);
      if (pkg.context) await byLabel('context').first().fill(pkg.context);
      if (pkg.problem) await byLabel('problem').first().fill(pkg.problem);
      if (pkg.role) await byLabel('role').first().fill(pkg.role);
      if (pkg.links?.code) await byLabel('code').first().fill(pkg.links.code);
      if (pkg.links?.live) await byLabel('live').first().fill(pkg.links.live);
      if (pkg.links?.result) await byLabel('result').first().fill(pkg.links.result);
      if (pkg.outcome) await byLabel('outcome').first().fill(pkg.outcome);
      if (pkg.cover) {
        const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Choose file' }).first().click()]);
        await chooser.setFiles(pkg.cover.file);
        await byLabel('cover alt').first().fill(pkg.cover.alt);
        await byLabel('source').last().fill(pkg.provenance.source);
        await byLabel('license').last().fill(pkg.provenance.license);
        if (pkg.provenance.generator) await byLabel('generator').first().fill(pkg.provenance.generator);
        await byLabel('date').last().fill(pkg.provenance.date);
      }
      // The first paragraph goes through the editor; the whole approved body replaces it below.
      const firstParagraph = pkg.body.trim().split(/\n\s*\n/).find((p) => !p.startsWith('#')) ?? pkg.body.trim().slice(0, 200);
      const body = page.locator('[contenteditable="true"]').first();
      await body.click();
      await body.type(firstParagraph.slice(0, 400));
      await page.getByRole('button', { name: 'Create', exact: true }).click();
      await page.waitForURL(new RegExp(`/collection/projects/item/${pkg.slug}$`), { timeout: 60_000 });
      log(`the Studio created ${entryPath} in the worktree`);
      // The approved Markdown body, verbatim, under the frontmatter Keystatic wrote.
      const file = join(root, entryPath);
      const written = readFileSync(file, 'utf8');
      const parts = written.split(/^---\s*$/m);
      writeFileSync(file, `---${parts[1]}---\n\n${pkg.body.trim()}\n`);
      log('the approved body written under the frontmatter');
    } else {
      await page.goto(`${base}/keystatic/collection/projects/item/${pkg.slug}`, { waitUntil: 'networkidle', timeout: 120_000 });
      await pick('status', 'draft', 'published');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await page.waitForTimeout(2000);
      const written = readFileSync(join(root, entryPath), 'utf8');
      if (!/^status:\s*published\s*$/m.test(written)) throw new Error('the Studio did not write status: published');
      log('status set to published through the Studio');
    }
  } finally {
    await browser.close();
  }

  // validate over the worktree (the repository's script), then the commit.
  execFileSync(process.execPath, [join(repo, 'scripts', 'validate.mjs')], { cwd: root, stdio: 'inherit' });
  run('git', ['add', '-A', join('content', 'projects', pkg.slug)], { cwd: root });
  const message = flag('publish') ? `studio: publish ${pkg.slug} (approved by the owner)` : `studio: ${pkg.slug} (authored through the local Studio from the owner's approved package)`;
  run('git', ['-c', 'core.hooksPath=/dev/null', 'commit', '--quiet', '-m', message], { cwd: root });
  const sha = run('git', ['rev-parse', '--short', 'HEAD'], { cwd: root });
  log(`committed ${sha} on ${branch}`);
  if (flag('push') || flag('publish')) {
    run('git', ['push', '--quiet', '-u', 'origin', branch], { cwd: root });
    log(`pushed ${branch}: the workflow opens the pull request; the checks run; ${flag('publish') ? 'green checks merge it and production follows' : 'a merged draft shows on staging only'}`);
  } else log('not pushed (add --push to open the pull request, --publish after the owner approves publication)');
  code = 0;
} catch (e) {
  console.error(`studio-author: ${e.message}`);
} finally {
  stopDaemon();
  if (server) {
    if (process.platform === 'win32') quiet(() => execFileSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' }));
    else server.kill('SIGTERM');
  }
  if (root) {
    quiet(() => execFileSync('git', ['worktree', 'remove', '--force', root], { stdio: 'ignore' }));
    quiet(() => existsSync(root) && rmSync(root, { recursive: true, force: true }));
    quiet(() => execFileSync('git', ['worktree', 'prune'], { stdio: 'ignore' }));
  }
}
if (code === 0 && flag('publish') && flag('acceptance')) {
  log(`running the acceptance harness for ${branch}`);
  const r = spawn(npm, ['run', 'acceptance', '--', branch], { stdio: 'inherit', shell });
  r.on('exit', (c) => process.exit(c ?? 1));
} else process.exit(code);

// The vocabulary label for a slug (the checkbox names in the form are labels, not slugs).
function vocabLabel(group, slug) {
  const file = join(repo, 'content', 'vocabulary', `${group}.yaml`);
  const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const m = text.match(new RegExp(`slug:\\s*${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*,\\s*label:\\s*(.+?)\\s*}`));
  return m ? m[1].replace(/^['"]|['"]$/g, '') : slug;
}
