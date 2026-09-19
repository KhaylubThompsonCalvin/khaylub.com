// The Studio authoring command (Phase 28, decision D-28): from an approved package, creates one
// Studio entry in any editable collection on a studio/<slug> branch, reviews it, and, only after the
// owner's explicit approval, publishes it through the normal path and runs the acceptance harness.
// The browser work runs against the local Studio in local storage mode (the same forms and
// configuration as the deployed Studio; no sign-in exists locally, so no credential, token, cookie,
// or storage state is ever involved; the deployed Studio is never automated), pointed at a
// throwaway worktree that is the Studio branch. Nothing is invented: every field comes from the
// package; a field the package leaves out stays empty; the Studio's own validation is the judge.
//
// Usage: node scripts/studio-author.mjs <id> [--review] [--push] [--publish] [--acceptance] [--port 4332]
//   npm run studio:prepare -- <id>   create the entry as a draft on studio/<slug> in a worktree,
//                                    capture the form and the entry at desktop and phone widths,
//                                    validate, commit; add --push to open the pull request (staging
//                                    shows the merged draft)
//   npm run studio:review  -- <id>   print the content review: title, summary, collection, context,
//                                    technologies and tags, the body, media, provenance, what was
//                                    omitted, the public URL that will result; then "Approve publication?"
//   npm run studio:publish -- <id>   needs "approvedForPublication": true in the package: sets the
//                                    status to published through the Studio's edit form, commits,
//                                    pushes (the path merges it), then runs the acceptance harness
// The package, never in Git: PORTFOLIO_OUT/approved/<id>.json (default .portfolio/approved/):
//   { "collection": "writing", "slug": "...", "fields": { <the collection's field keys> },
//     "body": "<Markdown>", "omitted": ["..."], "approvedForPublication": false }
// Field values follow the field tables (studio/src/fields.ts): text, url, date, integer as strings
// or numbers; select as an option; checkbox as true or false; multiselect as vocabulary slugs; an
// image as { "file": "<derived copy>" }; a group as an object; a list as an array. An image file is a
// derived copy the owner placed outside any graded original. Screenshots go to EVIDENCE_DIR/studio.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, basename } from 'node:path';

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith('--') && !/^\d+$/.test(a));
const flag = (n) => args.includes(`--${n}`);
const portIndex = args.indexOf('--port');
const port = portIndex >= 0 ? Number(args[portIndex + 1]) : 4332;
const out = process.env.PORTFOLIO_OUT ?? '.portfolio';
const evidence = process.env.EVIDENCE_DIR ?? join('test-results', 'studio');
if (!id) {
  console.error('usage: node scripts/studio-author.mjs <id> [--review] [--push] [--publish] [--acceptance]');
  process.exit(2);
}
const packageFile = join(out, 'approved', `${id}.json`);
if (!existsSync(packageFile)) {
  console.error(`studio-author: no approved package at ${packageFile}: the owner approval gate is not passed`);
  process.exit(2);
}
const pkg = JSON.parse(readFileSync(packageFile, 'utf8'));
const fields = pkg.fields ?? {};
const collection = pkg.collection ?? 'projects';
const FOLDER = new Set(['projects', 'music', 'video', 'gallery']);
const entryPath = FOLDER.has(collection) ? join('content', collection, pkg.slug, 'index.md') : join('content', collection, `${pkg.slug}.md`);
const EM_DASH = String.fromCharCode(0x2014);

// ---------- the package is checked before anything is touched ----------
const problems = [];
if (!['notes', 'writing', 'journal', 'projects', 'music', 'video', 'gallery'].includes(collection)) problems.push(`collection: ${collection} is not one the Studio edits`);
if (!(typeof pkg.slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pkg.slug))) problems.push('slug: lowercase letters, digits, and single hyphens');
if (!(typeof fields.title === 'string' && fields.title.length >= 3 && fields.title.length <= 90)) problems.push('fields.title: 3 to 90 characters');
if (!(typeof fields.summary === 'string' && fields.summary.length >= 40 && fields.summary.length <= 240)) problems.push('fields.summary: 40 to 240 characters');
if (!(Array.isArray(fields.tags) && fields.tags.length >= 1)) problems.push('fields.tags: at least one vocabulary slug');
if (!(typeof fields.source === 'string' && fields.source.length >= 1)) problems.push('fields.source: where the claims come from');
if (!(typeof fields.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fields.date))) problems.push('fields.date: YYYY-MM-DD');
if (!(typeof pkg.body === 'string' && pkg.body.trim().length >= 40)) problems.push('body: the approved Markdown');
if (fields.status && fields.status !== 'draft') problems.push('fields.status: an entry is created as a draft; --publish sets published after the approval');
if (collection === 'projects' && !(Array.isArray(fields.technologies) && fields.technologies.length)) problems.push('fields.technologies: a project needs at least one');
if (collection === 'projects' && fields.type === 'case-study') {
  const HEADINGS = ['Problem', 'Why it mattered', 'Requirements', 'Design', 'Technology choices', 'Why these choices', 'What I built', 'What went wrong', 'Verification', 'What I would change', 'What I learned', 'Code', 'Result'];
  const found = [...(pkg.body ?? '').matchAll(/^##\s+(.+?)\s*$/gm)].map((m) => m[1]);
  const missing = HEADINGS.filter((h) => !found.includes(h));
  if (missing.length) problems.push(`body: a case study needs the thirteen headings; missing ${missing.join(', ')}`);
}
const images = Object.entries(fields).filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v) && v.file);
for (const [k, v] of images) {
  if (!existsSync(v.file)) problems.push(`fields.${k}.file: the derived copy is missing`);
  if (/\b(Weekly Lessons|Final_Submission|04_Final)\b/i.test(v.file)) problems.push(`fields.${k}.file: points into a school folder; use a derived copy placed elsewhere`);
}
if (images.length || (Array.isArray(fields.images) && fields.images.length)) {
  const pv = fields.provenance ?? {};
  if (!pv.source || !pv.license || !pv.date) problems.push('fields.provenance: source, license, and date are required with media');
  if (fields.cover && !fields.cover_alt) problems.push('fields.cover_alt: required with a cover');
}
const allStrings = JSON.stringify(pkg);
if (allStrings.includes(EM_DASH)) problems.push('an em dash (U+2014) is present; the site refuses it');
if (problems.length) {
  console.error('studio-author: the approved package is not complete:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(2);
}

// ---------- the content review ----------
function review() {
  const media = [...images.map(([k, v]) => `${k}: ${basename(v.file)}${fields[`${k}_alt`] ? ` (alt: ${fields[`${k}_alt`]})` : ''}`), ...((fields.images ?? []).map((i, n) => `images[${n}]: ${basename(String(i.src))} (alt: ${i.alt ?? 'none'})`))];
  const pv = fields.provenance;
  return [
    `# Content review: ${fields.title}`,
    '',
    `- Collection: ${collection}; type: ${fields.type ?? '(default)'}`,
    `- Public URL that will result: https://khaylub.com/${collection}/${pkg.slug}/ (staging preview first: https://khaylub-com-v2.onrender.com/${collection}/${pkg.slug}/)`,
    `- Title: ${fields.title}`,
    `- Date: ${fields.date}${fields.updated ? `, updated ${fields.updated}` : ''}`,
    `- Summary: ${fields.summary}`,
    `- Context: ${fields.context ?? '(none)'}`,
    `- Technologies: ${(fields.technologies ?? []).join(', ') || '(none)'}; tags: ${fields.tags.join(', ')}; skills: ${(fields.skills ?? []).join(', ') || '(none)'}`,
    `- Source: ${fields.source}`,
    `- Links: ${Object.entries(fields.links ?? {}).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join('; ') || '(none)'}`,
    `- On the Work page: ${fields.employer_visible ? 'yes' : 'no'}; AI assistance declared: ${fields.ai_assisted ? 'yes' : 'no'}; license: ${fields.license ?? '(none)'}`,
    `- Media: ${media.join('; ') || 'none'}`,
    `- Provenance: ${pv && (pv.source || pv.license || pv.date) ? `${pv.source ?? ''}; ${pv.license ?? ''}; ${pv.date ?? ''}${pv.generator ? `; generated in part with ${pv.generator}` : ''}` : 'none'}`,
    `- Omitted for privacy: ${(pkg.omitted ?? []).join('; ') || '(nothing listed)'}`,
    `- Publication: ${pkg.approvedForPublication ? 'APPROVED by the owner' : 'not yet approved (draft only)'}`,
    '',
    '## Body',
    '',
    pkg.body.trim(),
    '',
    'Approve publication?',
  ].join('\n');
}
if (flag('review')) {
  console.log(review());
  process.exit(0);
}
if (flag('publish') && pkg.approvedForPublication !== true) {
  console.error('studio-author: --publish needs "approvedForPublication": true in the package (the owner\'s explicit approval)');
  process.exit(2);
}

// ---------- the worktree, the local Studio, the driver ----------
const repo = resolve('.');
const branch = `studio/${pkg.slug}`;
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const shell = process.platform === 'win32';
const run = (cmd, a, opts = {}) => execFileSync(cmd, a, { stdio: 'pipe', shell: cmd !== 'git' && shell, encoding: 'utf8', ...opts }).trim();
const log = (m) => console.log(`studio-author: ${m}`);
const quiet = (fn) => {
  try {
    fn();
  } catch {}
};
const stopDaemon = () => quiet(() => execFileSync(npx, ['astro', 'dev', 'stop'], { cwd: join(repo, 'studio'), stdio: 'ignore', shell }));

run('git', ['fetch', '--quiet', '--prune', 'origin']);
const remoteHas = run('git', ['ls-remote', '--heads', 'origin', branch]) !== '';
let root = null;
let server = null;
let code = 1;
try {
  root = mkdtempSync(join(tmpdir(), 'khaylub-author-'));
  if (remoteHas) {
    run('git', ['worktree', 'add', '--quiet', '--detach', root, `origin/${branch}`]);
    run('git', ['checkout', '--quiet', '-B', branch, `origin/${branch}`], { cwd: root });
  } else run('git', ['worktree', 'add', '--quiet', '-b', branch, root, 'origin/main']);
  log(`worktree on ${branch} (${remoteHas ? 'the existing remote branch' : 'new, from origin/main'})`);
  const exists = existsSync(join(root, entryPath));
  if (exists && !flag('publish')) throw new Error(`${entryPath} already exists on ${branch}; --publish sets its status, or choose another slug`);
  if (!exists && flag('publish')) throw new Error(`${entryPath} does not exist yet on ${branch}; prepare the draft first`);

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

  // The driver gets the package with the mode and the screenshot folder; images resolve to absolute paths.
  const driverPkg = { ...pkg, collection, mode: flag('publish') ? 'publish' : 'create', screenshots: resolve(evidence) };
  for (const [k, v] of images) driverPkg.fields[k] = { file: resolve(v.file) };
  const driverFile = join(root, '.studio-author-package.json');
  writeFileSync(driverFile, JSON.stringify(driverPkg));
  execFileSync(npx, ['playwright', 'test', '--config', 'playwright.studio.config.ts', 'tests/studio/author.spec.ts', '--project=desktop'], { stdio: 'inherit', shell, env: { ...process.env, STUDIO_BASE: base, STUDIO_ROOT: root, STUDIO_PACKAGE: driverFile } });
  rmSync(driverFile, { force: true });
  if (!flag('publish')) {
    // The approved Markdown body, verbatim, under the frontmatter Keystatic wrote.
    const file = join(root, entryPath);
    const written = readFileSync(file, 'utf8');
    const parts = written.split(/^---\s*$/m);
    writeFileSync(file, `---${parts[1]}---\n\n${pkg.body.trim()}\n`);
    log(`the Studio created ${entryPath}; the approved body written under its frontmatter`);
  } else log('status set to published through the Studio');

  execFileSync(process.execPath, [join(repo, 'scripts', 'validate.mjs')], { cwd: root, stdio: 'inherit' });
  run('git', ['add', '-A', join('content', collection)], { cwd: root });
  const message = flag('publish') ? `studio: publish ${pkg.slug} (approved by the owner)` : `studio: ${pkg.slug} (created through the local Studio from the owner's approved package)`;
  run('git', ['-c', 'core.hooksPath=/dev/null', 'commit', '--quiet', '-m', message], { cwd: root });
  log(`committed ${run('git', ['rev-parse', '--short', 'HEAD'], { cwd: root })} on ${branch}`);
  if (flag('push') || flag('publish')) {
    run('git', ['push', '--quiet', '-u', 'origin', branch], { cwd: root });
    log(`pushed ${branch}: the workflow opens the pull request and the six checks run; ${flag('publish') ? 'green checks merge it and production follows' : 'a merged draft shows on staging only'}`);
  } else log('not pushed (add --push to open the pull request; studio:publish after the owner approves publication)');
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
if (code === 0 && (flag('push') || flag('publish'))) {
  // The publishing harness watches the path; after a publication the acceptance run follows.
  const expect = flag('publish') ? 'published' : 'draft';
  const watch = spawn(process.execPath, ['scripts/publishing-verify.mjs', branch, '--expect', expect, '--live-page'], { stdio: 'inherit' });
  watch.on('exit', (c) => {
    if (c !== 0) process.exit(c ?? 1);
    if (flag('publish') && flag('acceptance')) {
      log(`running the acceptance harness for ${branch}`);
      const r = spawn(npm, ['run', 'acceptance', '--', branch], { stdio: 'inherit', shell });
      r.on('exit', (cc) => process.exit(cc ?? 1));
    } else process.exit(0);
  });
} else process.exit(code);
