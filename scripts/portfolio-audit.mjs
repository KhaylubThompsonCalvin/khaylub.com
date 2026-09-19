// The school portfolio auditor (Phase 28, decision D-28): reads completed coursework and the owner's
// Obsidian notes about it, read-only, and recommends the pieces that would make the strongest
// Khaylub.com Project entries. It never publishes, never writes into the school folders, never
// copies school files into this repository, and never prints a secret it finds: it only flags where
// one is. Nothing is ranked by size or count; every score line names its reason.
//
// Roots come from the environment, never from this file (machine paths are banned in the repository):
//   PORTFOLIO_SCHOOL_ROOT   the folder that holds one subfolder per course (read-only input)
//   KHAYLUB_VAULT           the Obsidian vault root (read-only input); "01 Projects/<course>" and
//                           "01 Projects/Khaylub.com/docs/V2" are the only vault folders read
//   PORTFOLIO_OUT           where the report and the manifests go (default .portfolio/, git-ignored)
// Usage: node scripts/portfolio-audit.mjs [--include-published] [--course <code>] [--out <dir>]
// Output: <out>/report.md, <out>/candidates.json, <out>/manifests/<candidate-id>.json
import { readFileSync, readdirSync, statSync, existsSync, mkdirSync, writeFileSync, openSync, readSync, closeSync } from 'node:fs';
import { join, basename, extname, relative, sep } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { load } from 'js-yaml';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const includePublished = args.includes('--include-published');
const onlyCourse = opt('course', null);
const schoolRoot = process.env.PORTFOLIO_SCHOOL_ROOT;
const vaultRoot = process.env.KHAYLUB_VAULT;
const out = opt('out', process.env.PORTFOLIO_OUT ?? '.portfolio');
if (!schoolRoot || !existsSync(schoolRoot)) {
  console.error('portfolio-audit: set PORTFOLIO_SCHOOL_ROOT to the folder that holds one subfolder per course');
  process.exit(2);
}
if (!vaultRoot || !existsSync(vaultRoot)) {
  console.error('portfolio-audit: set KHAYLUB_VAULT to the Obsidian vault root');
  process.exit(2);
}

// ---------- what is never read, and what is never written ----------
const SKIP_DIRS = new Set(['.ipynb_checkpoints', '.virtual_documents', 'anaconda_projects', 'node_modules', '.git', '.claude', '.obsidian', '__pycache__', '.venv', 'venv']);
const SKIP_FILE = /(_BACKUP|BACKUP_|-checkpoint|PRE_[A-Z_]+_|SHUTDOWN_BACKUP|BEFORE_RESTORE|pre-rebuild|pre-rename|pre-runbook|OVERSTAGED)|^~\$|^~/i;
const MAX_READ = 40 * 1024 * 1024; // never read a file larger than this
const TEXT_EXT = new Set(['.md', '.txt', '.py', '.sql', '.csv', '.json', '.html', '.svg', '.yaml', '.yml', '.r', '.js', '.ts']);
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const UNIT_DIR = /\b(lab|labs|project|projects|assignment|assignments|final|capstone|midterm|homework|exercise|portfolio)\b/i;
const NOISE_DIR = /\b(practice|reading|lecture|quiz|quizzes|template|_week template|tools and software)\b/i;

// Sensitive patterns: what is flagged, never echoed. Each is a class of thing, not a value.
const SENSITIVE = [
  { id: 'credential', re: /\b(PWD|PASSWORD|PASSWD|TOKEN|SECRET|API[_-]?KEY|UID)\s*[=:]\s*['"]?[^\s'";]{2,}/i, note: 'a credential or account name in code or text' },
  { id: 'connection-string', re: /\b(SERVER|DATA SOURCE|DATABASE)\s*=\s*[^;'"\s]{3,}/i, note: 'a database connection string' },
  { id: 'private-url', re: /https?:\/\/[^\s)]*(d2l|brightspace|\.pcc\.edu|myportal|learn\.)[^\s)]*/i, note: 'a private school URL' },
  { id: 'student-id', re: /\b(student\s*(id|number)|G\d{8}|\b\d{7,9}\b(?=[^\d\-.]))/i, note: 'a possible student identifier' },
  { id: 'grade', re: /\b(grade[d]?\s*[:=]|score[d]?\s*[:=]|\b\d{1,3}\s*\/\s*\d{1,3}\s*(points|pts)|full credit|\b\d{1,3}(\.\d+)?\s*%\s*(grade|score))/i, note: 'a grade or score (publish only with the owner\'s say-so)' },
  { id: 'email', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, note: 'an email address' },
  { id: 'instructor-message', re: /\b(instructor|professor|prof\.)\b[^.\n]{0,80}\b(said|wrote|feedback|comment|replied|message)/i, note: 'text that may quote an instructor' },
  { id: 'classmate', re: /\b(classmate|discussion post|peer review|group member)/i, note: 'text that may name classmates' },
  { id: 'machine-path', re: /[A-Za-z]:\\Users\\[^\\\s"']+/, note: 'a local machine path' },
];
const COURSE_MATERIAL = /(syllabus|assignment instructions|rubric|lecture slides|course materials|textbook|copyright|all rights reserved by|instructor[- ]provided|provided by the instructor)/i;
const AI_HANDOFF = /(chatgpt|claude|copilot|handoff|ai disclosure)/i;

// ---------- helpers ----------
const rel = (p) => relative(schoolRoot, p).split(sep).join('/');
const lower = (s) => String(s).toLowerCase();
function walk(dir, acc = []) {
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(join(dir, e.name), acc);
    } else if (e.isFile()) {
      if (SKIP_FILE.test(e.name)) continue;
      acc.push(join(dir, e.name));
    }
  }
  return acc;
}
function readText(file, limit = MAX_READ) {
  try {
    const size = statSync(file).size;
    if (size > limit) return null;
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}
// A minimal zip reader (central directory, deflate or stored) for .twbx, .docx, .xlsx, .zip. Names only
// unless an entry is asked for, so a large archive costs nothing to list.
function zipEntries(file) {
  const size = statSync(file).size;
  if (size > MAX_READ) return null;
  const buf = readFileSync(file);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = [];
  for (let n = 0; n < count && p + 46 <= buf.length; n += 1) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const usize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const offset = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    entries.push({ name, method, csize, usize, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  const read = (entry) => {
    const lp = entry.offset;
    if (buf.readUInt32LE(lp) !== 0x04034b50) return null;
    const nameLen = buf.readUInt16LE(lp + 26);
    const extraLen = buf.readUInt16LE(lp + 28);
    const start = lp + 30 + nameLen + extraLen;
    const data = buf.subarray(start, start + entry.csize);
    if (entry.method === 0) return data;
    if (entry.method === 8) return inflateRawSync(data);
    return null;
  };
  return { entries, read };
}
const xmlText = (xml) => xml.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

function scanSensitive(text, file, flags) {
  if (!text) return;
  for (const s of SENSITIVE) {
    if (s.re.test(text)) flags.push({ kind: s.id, note: s.note, file: rel(file) });
  }
  if (COURSE_MATERIAL.test(text)) flags.push({ kind: 'course-material', note: 'text that reads like course material rather than the owner\'s own work', file: rel(file) });
}

// ---------- evidence per file ----------
function inspectNotebook(file) {
  const text = readText(file);
  if (!text) return null;
  let nb;
  try {
    nb = JSON.parse(text);
  } catch {
    return null;
  }
  const cells = nb.cells ?? [];
  let code = 0;
  let executed = 0;
  let errors = 0;
  let images = 0;
  const headings = [];
  const libs = new Set();
  let db = false;
  for (const c of cells) {
    const src = (Array.isArray(c.source) ? c.source : [c.source ?? '']).join('');
    if (c.cell_type === 'code') {
      code += 1;
      if (c.execution_count) executed += 1;
      for (const o of c.outputs ?? []) {
        if (o.output_type === 'error') errors += 1;
        if (o.data && (o.data['image/png'] || o.data['image/svg+xml'])) images += 1;
      }
      for (const m of src.matchAll(/^\s*(?:import|from)\s+([A-Za-z_][\w.]*)/gm)) libs.add(m[1].split('.')[0]);
      if (/pyodbc|read_sql|sqlalchemy|SERVER=|DRIVER=/i.test(src)) db = true;
    } else {
      for (const l of src.split('\n')) if (/^#{1,3}\s+\S/.test(l)) headings.push(l.replace(/^#+\s+/, '').trim().slice(0, 80));
    }
  }
  return { kind: 'notebook', cells: cells.length, code, executed, errors, images, headings: headings.slice(0, 40), libs: [...libs], db, text };
}
function inspectTableau(file) {
  const zip = zipEntries(file);
  if (!zip) return { kind: 'tableau', worksheets: 0, dashboards: 0, stories: 0, actions: 0, datasources: [], pathLeak: false };
  const twb = zip.entries.find((e) => e.name.toLowerCase().endsWith('.twb'));
  const xml = twb ? zip.read(twb)?.toString('utf8') ?? '' : '';
  const count = (re) => (xml.match(re) ?? []).length;
  const datasources = [...xml.matchAll(/<datasource\b[^>]*\bcaption='([^']*)'/g)].map((m) => m[1]).filter(Boolean);
  const files = [...xml.matchAll(/\b(?:filename|directory)='([^']*)'/g)].map((m) => m[1]);
  return {
    kind: 'tableau',
    worksheets: count(/<worksheet\b/g),
    dashboards: count(/<dashboard\b/g),
    stories: count(/<story\b/g),
    storyPoints: count(/<story-point\b/g),
    actions: count(/<action\b/g),
    filterActions: count(/<action\b[^>]*\bcaption='[^']*'[^>]*>\s*<activation[^>]*\/>\s*<source[^>]*\/>\s*<command command='tsc:filter'/g) || count(/tsc:filter/g),
    urlActions: count(/tsc:url/g),
    datasources: [...new Set(datasources)],
    pathLeak: files.some((f) => /[A-Za-z]:[\\/]|\/Users\//.test(f)),
    text: xmlText(xml).slice(0, 20000),
  };
}
function inspectDocx(file) {
  const zip = zipEntries(file);
  const doc = zip?.entries.find((e) => e.name === 'word/document.xml');
  const xml = doc ? zip.read(doc)?.toString('utf8') ?? '' : '';
  const text = xmlText(xml);
  return { kind: 'report', words: text ? text.split(/\s+/).length : 0, text };
}
function inspectCsv(file) {
  const size = statSync(file).size;
  const fd = openSync(file, 'r');
  const head = Buffer.alloc(Math.min(size, 65536));
  readSync(fd, head, 0, head.length, 0);
  closeSync(fd);
  const lines = head.toString('utf8').split(/\r?\n/).filter(Boolean);
  const header = (lines[0] ?? '').split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  return { kind: 'dataset', columns: header.length, columnNames: header.slice(0, 20), bytes: size, publicHint: /kaggle|uci|statlib|census|ssa|open data|public/i.test(basename(file)) };
}

// ---------- the walk: units per course ----------
const courseDirs = readdirSync(schoolRoot, { withFileTypes: true }).filter((e) => e.isDirectory() && !SKIP_DIRS.has(e.name)).map((e) => e.name);
const units = [];
for (const courseDir of courseDirs) {
  const code = (courseDir.match(/\b([A-Z]{2,4}\s?-?\s?\d{2,3}[A-Z]?)\b/) ?? [null, courseDir])[1].replace(/\s|-/g, '');
  if (onlyCourse && lower(code) !== lower(onlyCourse.replace(/\s|-/g, ''))) continue;
  const courseRoot = join(schoolRoot, courseDir);
  const files = walk(courseRoot);
  // The course's term and institution, from its own information files (never guessed).
  const info = files.filter((f) => /course (information|overview|calendar|dashboard)|syllabus/i.test(rel(f)) && TEXT_EXT.has(extname(f).toLowerCase())).map((f) => readText(f) ?? '').join('\n');
  const term = (info.match(/\b(Spring|Summer|Fall|Winter)\s+20\d{2}\b/) ?? [null])[0];
  const institution = (info.match(/\b(Portland Community College|PCC)\b/) ?? [null])[0];
  const groups = new Map();
  for (const f of files) {
    const r = rel(f).slice(courseDir.length + 1);
    const parts = r.split('/');
    // The unit is the nearest folder whose name says lab, project, assignment, final; files that sit
    // outside any such folder are practice, reading, or course information and carry no unit.
    let unit = null;
    for (let i = parts.length - 2; i >= 0; i -= 1) {
      if (UNIT_DIR.test(parts[i]) && !NOISE_DIR.test(parts[i])) {
        unit = parts.slice(0, i + 1).join('/');
        break;
      }
    }
    if (!unit) continue;
    if (!groups.has(unit)) groups.set(unit, []);
    groups.get(unit).push(f);
  }
  for (const [unit, list] of groups) {
    const u = { id: `${lower(code)}-${lower(basename(unit)).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`, course: courseDir, code, term, institution, unit, path: join(courseRoot, unit), files: [], notebooks: [], tableau: [], reports: [], datasets: [], images: [], scripts: [], docs: [], archives: [], flags: [], aiProcessDocs: [] };
    for (const f of list) {
      const ext = extname(f).toLowerCase();
      const name = basename(f);
      const entry = { path: rel(f), bytes: statSync(f).size };
      u.files.push(entry);
      if (ext === '.ipynb') {
        const nb = inspectNotebook(f);
        if (nb) {
          scanSensitive(nb.text, f, u.flags);
          delete nb.text;
          u.notebooks.push({ ...entry, ...nb });
        }
      } else if (ext === '.twbx' || ext === '.twb') {
        const t = inspectTableau(f);
        scanSensitive(t.text, f, u.flags);
        if (t.pathLeak) u.flags.push({ kind: 'machine-path', note: 'the workbook records a local data path (visible to anyone who downloads it)', file: rel(f) });
        delete t.text;
        u.tableau.push({ ...entry, ...t });
      } else if (ext === '.docx') {
        const d = inspectDocx(f);
        scanSensitive(d.text, f, u.flags);
        const words = d.words;
        u.reports.push({ ...entry, words, title: d.text.slice(0, 120) });
      } else if (ext === '.csv') {
        u.datasets.push({ ...entry, ...inspectCsv(f) });
      } else if (IMAGE_EXT.has(ext) || ext === '.svg') {
        u.images.push(entry);
        if (ext === '.svg') scanSensitive(readText(f, 2_000_000), f, u.flags);
      } else if (ext === '.py' || ext === '.sql' || ext === '.r') {
        const t = readText(f, 2_000_000);
        scanSensitive(t, f, u.flags);
        u.scripts.push({ ...entry, lines: t ? t.split('\n').length : 0 });
      } else if (ext === '.md' || ext === '.txt') {
        const t = readText(f, 2_000_000);
        scanSensitive(t, f, u.flags);
        if (AI_HANDOFF.test(name)) u.aiProcessDocs.push(entry);
        else u.docs.push({ ...entry, words: t ? t.split(/\s+/).length : 0 });
      } else if (ext === '.zip') {
        u.archives.push(entry);
      } else if (ext === '.xlsx') {
        u.scripts.push({ ...entry, lines: 0, workbook: true });
      }
    }
    units.push(u);
  }
}

// ---------- the vault: what the owner already wrote about each unit ----------
const vaultNotes = [];
function walkVault(dir, acc) {
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walkVault(join(dir, e.name), acc);
    } else if (e.isFile() && extname(e.name).toLowerCase() === '.md') acc.push(join(dir, e.name));
  }
  return acc;
}
const projectsDir = join(vaultRoot, '01 Projects');
const courseCodes = [...new Set(units.map((u) => u.code))];
const vaultCourseDirs = existsSync(projectsDir) ? readdirSync(projectsDir, { withFileTypes: true }).filter((e) => e.isDirectory() && courseCodes.some((c) => lower(e.name).replace(/\s|-/g, '').includes(lower(c)))).map((e) => join(projectsDir, e.name)) : [];
const siteDocs = join(projectsDir, 'Khaylub.com', 'docs', 'V2');
for (const dir of [...vaultCourseDirs, ...(existsSync(siteDocs) ? [siteDocs] : [])]) {
  for (const f of walkVault(dir, [])) {
    const text = readText(f, 4_000_000);
    if (!text) continue;
    vaultNotes.push({ file: relative(vaultRoot, f).split(sep).join('/'), name: basename(f, '.md'), text });
  }
}
const publicLinks = (text) => [...new Set([...text.matchAll(/https?:\/\/(?:github\.com|public\.tableau\.com|[a-z0-9.-]*khaylub\.com)[^\s)>\]"']*/g)].map((m) => m[0].replace(/[.,;:]+$/, '')))];
for (const u of units) {
  const labNumber = (basename(u.unit).match(/\d+/) ?? [null])[0];
  const needles = [lower(basename(u.unit))];
  if (labNumber) needles.push(`lab ${labNumber}`, `lab${labNumber}`, `lab 0${labNumber}`, `week ${labNumber}`, `week 0${labNumber}`);
  u.vault = [];
  for (const n of vaultNotes) {
    const t = lower(n.text);
    const hits = needles.filter((x) => t.includes(x));
    if (hits.length === 0) continue;
    const portfolio = /portfolio evidence|portfolio map|portfolio-worthy|flagship|strongest candidate|public-safe candidate|candidate/i.test(n.text) && /portfolio/i.test(n.file);
    const status = (n.text.match(/(published|PUBLISHED|not published|conversion in progress|strongest candidate|public-safe candidate|absorbed into|not worth publishing)[^\n|]{0,60}/) ?? [null])[0];
    u.vault.push({ file: n.file, portfolioNote: portfolio, status, links: publicLinks(n.text).slice(0, 6) });
  }
  u.vault.sort((a, b) => Number(b.portfolioNote) - Number(a.portfolioNote));
}

// ---------- what Khaylub.com already publishes (this repository's content/) ----------
const published = [];
if (existsSync('content')) {
  const walkContent = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walkContent(p);
      else if (e.name.endsWith('.md') && !p.includes(`${sep}profile${sep}`) && !p.includes(`${sep}vocabulary${sep}`)) {
        const t = readFileSync(p, 'utf8');
        const fm = t.split(/^---\s*$/m)[1] ?? '';
        const get = (k) => (fm.match(new RegExp(`^${k}:\\s*(.+)$`, 'm')) ?? [null, ''])[1].trim().replace(/^['"]|['"]$/g, '');
        published.push({ file: p.split(sep).join('/'), slug: get('slug'), title: get('title'), status: get('status'), source: get('source'), links: publicLinks(t) });
      }
    }
  };
  walkContent('content');
}
const vocab = (name) => {
  try {
    return (load(readFileSync(join('content', 'vocabulary', `${name}.yaml`), 'utf8')).terms ?? []).map((t) => t.slug);
  } catch {
    return [];
  }
};
const TECH = vocab('technologies');
const TAGS = vocab('tags');
const LIB_TECH = { pandas: 'pandas', numpy: 'python', matplotlib: 'matplotlib', seaborn: 'seaborn', sklearn: 'scikit-learn', pyodbc: 'sql-server', sqlalchemy: 'sql-server', statsmodels: 'python', scipy: 'python' };

// ---------- scoring: every line carries its reason ----------
function score(u) {
  const s = {};
  const reasons = [];
  const hasFinal = u.files.some((f) => /final|submission/i.test(f.path)) || u.archives.length > 0;
  const nbOk = u.notebooks.filter((n) => n.executed > 0 && n.errors === 0);
  const nbBad = u.notebooks.filter((n) => n.errors > 0);
  s.completeness = (hasFinal ? 1 : 0) + (u.reports.length ? 1 : 0) + (u.notebooks.length === 0 || (nbOk.length > 0 && nbBad.length === 0) ? 1 : 0);
  reasons.push(`completeness ${s.completeness}/3: ${hasFinal ? 'a final submission' : 'no final submission folder'}; ${u.reports.length ? `${u.reports.length} report(s)` : 'no report'}; ${u.notebooks.length ? `${nbOk.length} of ${u.notebooks.length} notebook(s) executed without errors` : 'no notebook'}`);
  const tech = new Set();
  for (const n of u.notebooks) {
    tech.add('python');
    tech.add('jupyterlab');
    for (const l of n.libs) if (LIB_TECH[l]) tech.add(LIB_TECH[l]);
  }
  if (u.tableau.length) tech.add('tableau');
  if (u.scripts.some((c) => c.workbook)) tech.add('excel');
  if (u.scripts.some((c) => c.path.endsWith('.sql'))) tech.add('sql-server');
  u.technologies = [...tech].filter((t) => TECH.includes(t));
  u.technologiesUnknown = [...tech].filter((t) => !TECH.includes(t));
  const depth = u.notebooks.reduce((m, n) => Math.max(m, n.code), 0);
  s.technical = Math.min(3, (u.technologies.length >= 3 ? 2 : u.technologies.length >= 1 ? 1 : 0) + (depth >= 40 || u.tableau.some((t) => t.dashboards + t.stories > 0) ? 1 : 0));
  reasons.push(`technical evidence ${s.technical}/3: ${u.technologies.join(', ') || 'no recognised technology'}${depth ? `; the largest notebook has ${depth} code cells` : ''}${u.tableau.length ? `; Tableau: ${u.tableau.map((t) => `${t.worksheets} worksheets, ${t.dashboards} dashboards, ${t.stories} stories, ${t.actions} actions`).join(' / ')}` : ''}`);
  const modelling = u.notebooks.some((n) => n.libs.includes('sklearn') || n.libs.includes('statsmodels'));
  const interactive = u.tableau.some((t) => t.dashboards > 0 || t.stories > 0);
  const pipeline = u.notebooks.some((n) => n.db) || u.scripts.some((c) => c.path.endsWith('.sql'));
  s.employer = Math.min(3, (modelling ? 1 : 0) + (interactive ? 1 : 0) + (pipeline ? 1 : 0) + (u.notebooks.some((n) => n.code >= 40) ? 1 : 0));
  reasons.push(`employer value ${s.employer}/3: ${[modelling && 'modelling', interactive && 'an interactive dashboard or story', pipeline && 'a SQL pipeline', u.notebooks.some((n) => n.code >= 40) && 'a substantial notebook'].filter(Boolean).join(', ') || 'exercises only'}`);
  const charts = u.notebooks.reduce((a, n) => a + n.images, 0) + u.images.length;
  s.visual = interactive ? 3 : charts >= 4 ? 3 : charts >= 1 ? 2 : 0;
  reasons.push(`visual quality ${s.visual}/3: ${charts} chart image(s) on disk or in outputs${interactive ? '; an interactive Tableau piece' : ''}`);
  const words = u.reports.reduce((a, r) => a + r.words, 0) + u.docs.reduce((a, d) => a + d.words, 0);
  const headings = u.notebooks.reduce((a, n) => a + n.headings.length, 0);
  s.story = (words >= 300 ? 1 : 0) + (headings >= 8 ? 1 : 0) + (u.vault.length ? 1 : 0);
  reasons.push(`story ${s.story}/3: ${words} words of report and notes; ${headings} notebook headings; ${u.vault.length} vault note(s) mention it`);
  s.source = Math.min(3, (u.files.length ? 1 : 0) + (u.vault.some((v) => v.portfolioNote) ? 1 : 0) + (u.vault.some((v) => v.links.length) ? 1 : 0));
  reasons.push(`source evidence ${s.source}/3: ${u.files.length} file(s); ${u.vault.filter((v) => v.portfolioNote).length} portfolio note(s); ${u.vault.some((v) => v.links.length) ? 'public links recorded' : 'no public link recorded'}`);
  const publicData = u.datasets.some((d) => d.publicHint) || u.vault.some((v) => /kaggle|uci|public dataset|public-safe/i.test(readText(join(vaultRoot, v.file), 4_000_000) ?? ''));
  const schoolDb = u.notebooks.some((n) => n.db);
  s.readiness = Math.min(3, (publicData ? 1 : 0) + (charts > 0 || interactive ? 1 : 0) + (u.vault.some((v) => v.links.length) ? 1 : 0)) - (schoolDb ? 1 : 0);
  s.readiness = Math.max(0, s.readiness);
  reasons.push(`publishing readiness ${s.readiness}/3: ${publicData ? 'a public dataset' : 'no public dataset detected'}${schoolDb ? '; the notebook opens the school database (that half cannot be published)' : ''}; ${charts > 0 || interactive ? 'media exists' : 'no media yet'}`);
  const kinds = [...new Set(u.flags.map((f) => f.kind))];
  const severe = kinds.filter((k) => ['credential', 'connection-string', 'student-id'].includes(k));
  s.privacy = severe.length ? 0 : kinds.length >= 3 ? 1 : kinds.length ? 2 : 3;
  reasons.push(`privacy ${s.privacy}/3: ${kinds.length ? `flags: ${kinds.join(', ')}` : 'no flag'}`);
  const ownCharts = u.notebooks.some((n) => n.images > 0) || u.tableau.length > 0 || u.images.length > 0;
  s.provenance = (publicData ? 1 : 0) + (ownCharts ? 1 : 0) + (u.vault.some((v) => /provenance|license|dataset/i.test(readText(join(vaultRoot, v.file), 4_000_000) ?? '')) ? 1 : 0);
  reasons.push(`provenance readiness ${s.provenance}/3: ${publicData ? 'dataset source known' : 'dataset source to establish'}; ${ownCharts ? 'the owner\'s own charts or workbook' : 'no owner-made media'}; ${s.provenance === 3 ? 'terms recorded in the vault' : 'terms to record'}`);
  u.scores = s;
  u.reasons = reasons;
  u.total = Object.values(s).reduce((a, b) => a + b, 0);
  u.skills = [...new Set([modelling && 'regression-modeling', (u.notebooks.length || u.tableau.length) && 'data-analysis', u.notebooks.some((n) => n.headings.some((h) => /clean|missing|duplicate/i.test(h))) && 'data-cleaning', (charts > 0 || interactive) && 'visualization', u.reports.length && 'documentation'].filter(Boolean))];
  // Already on Khaylub.com? Only when a vault note dedicated to one artifact (not the course map,
  // index, tracker, or dashboard) names one of this unit's own files and records a public link that
  // a published site entry carries too: the owner's own record that the artifact derives from it.
  // (u.vault already holds only the notes that name this unit by its folder name or "lab N" / "week N".)
  const dedicated = u.vault.filter((v) => v.portfolioNote && !/map|index|tracker|dashboard|overview|checklist|template/i.test(basename(v.file)));
  const links = dedicated.flatMap((v) => v.links);
  u.dedicatedLinks = [...new Set(links)];
  u.alreadyPublished = published.filter((p) => p.status === 'published' && links.some((l) => p.source === l || p.links.includes(l))).map((p) => `${p.file} (${p.title}; named with this unit in the owner's note)`);
  // The owner's own course portfolio map, when one exists: a table row for this unit's number whose
  // status cell says Published (and not "not published") is the owner's word that it is out already.
  const number = (basename(u.unit).match(/\d+/) ?? [null])[0];
  if (number) {
    for (const n of vaultNotes.filter((v) => /portfolio map/i.test(v.name))) {
      for (const line of n.text.split(/\r?\n/)) {
        if (!new RegExp('^\\|\\s*' + number + '\\s*\\|').test(line)) continue;
        if (/\bpublished\b/i.test(line) && !/not (worth )?publish/i.test(line)) u.alreadyPublished.push(`${n.file} (the owner's portfolio map marks week or lab ${number} as published)`);
      }
    }
  }
}
for (const u of units) score(u);
const ranked = units.filter((u) => u.files.length > 0).sort((a, b) => b.total - a.total || b.scores.employer - a.scores.employer);
// Cumulative notebooks: when one unit's notebook headings all reappear in a later unit's notebook,
// the earlier unit is contained in the later one and is not a separate candidate.
for (const a of ranked) {
  const ah = a.notebooks.flatMap((n) => n.headings);
  if (ah.length < 8) continue;
  for (const b of ranked) {
    if (a === b || a.code !== b.code) continue;
    const bh = new Set(b.notebooks.flatMap((n) => n.headings));
    const shared = ah.filter((h) => bh.has(h)).length;
    const aCode = a.notebooks.reduce((m, n) => Math.max(m, n.code), 0);
    const bCode = b.notebooks.reduce((m, n) => Math.max(m, n.code), 0);
    if (bCode > aCode && shared / ah.length >= 0.8) a.supersededBy = b.unit;
  }
}
const eligible = ranked.filter((u) => (includePublished || u.alreadyPublished.length === 0) && !u.supersededBy);
const top = eligible.slice(0, 3);

// ---------- output ----------
mkdirSync(join(out, 'manifests'), { recursive: true });
const proposal = (u) => ({
  collection: 'projects',
  type: 'case-study',
  title: null,
  context: u.term ? `${u.code.replace(/^([A-Z]+)(\d)/, '$1 $2')}, ${u.term}` : null,
  project_status: null,
  technologies: u.technologies,
  tags: TAGS.filter((t) => u.technologies.includes(t) || (t === 'data-storytelling' && u.tableau.length) || (t === 'regression' && u.skills.includes('regression-modeling'))),
  // Links only from the owner's notes dedicated to this artifact; a course-wide note's links are not this piece's.
  source: null,
  links: { code: (u.dedicatedLinks ?? []).find((l) => l.includes('github.com')) ?? null, live: (u.dedicatedLinks ?? []).find((l) => l.includes('public.tableau.com')) ?? null, result: null },
  cover: u.images[0]?.path ?? null,
  bodyHeadings: ['Problem', 'Why it mattered', 'Requirements', 'Design', 'Technology choices', 'Why these choices', 'What I built', 'What went wrong', 'Verification', 'What I would change', 'What I learned', 'Code', 'Result'],
});
const ownerInput = (u) => [
  'title (the piece\'s public name)',
  'summary (40 to 240 characters, in the owner\'s words)',
  'problem and role (the case-study card)',
  'the body under the thirteen case-study headings (what was asked, what was done, what was learned, the result), in the owner\'s words',
  'project_status (live, prototype, private-beta, concept, archived)',
  'which chart or screenshot is the cover, and its alt text',
  'the provenance record for every image (source, license, date; the generator if any)',
  'whether any grade or credit may be mentioned',
  ...(u.technologiesUnknown.length ? [`vocabulary terms to add for: ${u.technologiesUnknown.join(', ')}`] : []),
  ...(u.notebooks.some((n) => n.db) ? ['a derived, public-safe copy of the notebook without the school database half (never the graded original)'] : []),
  ...(u.tableau.length && !u.vault.some((v) => v.links.some((l) => l.includes('public.tableau.com'))) ? ['a Tableau Public link, or screenshots exported by the owner as the media'] : []),
];
const manifest = (u) => ({
  candidateId: u.id,
  course: u.course,
  courseCode: u.code,
  term: u.term,
  institution: u.institution,
  unit: u.unit,
  sourcePaths: u.files.map((f) => f.path),
  vaultReferences: u.vault.map((v) => ({ note: v.file, portfolioNote: v.portfolioNote, status: v.status })),
  publicLinks: u.dedicatedLinks ?? [],
  technologies: u.technologies,
  technologiesUnknown: u.technologiesUnknown,
  skills: u.skills,
  tags: proposal(u).tags,
  evidence: { notebooks: u.notebooks.map(({ path, cells, code, executed, errors, images, headings, libs, db }) => ({ path, cells, code, executed, errors, images, headings, libs, schoolDatabase: db })), tableau: u.tableau, reports: u.reports.map(({ path, words }) => ({ path, words })), datasets: u.datasets.map(({ path, columns, columnNames, publicHint }) => ({ path, columns, columnNames, publicHint })), images: u.images.map((i) => i.path), code: u.scripts.map((c) => c.path), docs: u.docs.map((d) => d.path), archives: u.archives.map((a) => a.path), aiProcessDocs: u.aiProcessDocs.map((a) => a.path) },
  privacyExclusions: u.flags,
  alreadyOnKhaylub: u.alreadyPublished,
  scores: u.scores,
  reasons: u.reasons,
  proposedProject: proposal(u),
  ownerInputNeeded: ownerInput(u),
  generatedAt: new Date().toISOString(),
  note: 'An intermediate working artifact, never public content. Every path is under the read-only school root. Nothing here was copied from a school file beyond names, counts, and headings.',
});
const section = (label, u) => {
  if (!u) return `## ${label}\n\nnone\n`;
  const p = proposal(u);
  return [
    `## ${label}: ${basename(u.unit)} (${u.course})`,
    '',
    `- **Course:** ${u.course}${u.term ? `, ${u.term}` : ''}${u.institution ? `, ${u.institution}` : ''}`,
    `- **Assignment:** ${u.unit}`,
    `- **Source path (under the school root):** ${rel(u.path)}`,
    `- **Files:** ${u.files.length} (${u.notebooks.length} notebook, ${u.tableau.length} Tableau, ${u.reports.length} report, ${u.datasets.length} dataset, ${u.images.length} image, ${u.scripts.length} code or workbook, ${u.archives.length} archive)`,
    `- **Vault references:** ${u.vault.length ? u.vault.map((v) => `${v.file}${v.portfolioNote ? ' (portfolio note)' : ''}${v.status ? `: ${v.status.trim()}` : ''}`).join('; ') : 'none'}`,
    `- **Skills demonstrated by the files:** ${u.skills.join(', ') || 'none recognised'}; technologies: ${u.technologies.join(', ') || 'none in the site vocabulary'}${u.technologiesUnknown.length ? ` (not in the vocabulary: ${u.technologiesUnknown.join(', ')})` : ''}`,
    `- **Media and evidence available:** ${[u.notebooks.map((n) => `${basename(n.path)} (${n.cells} cells, ${n.executed} executed, ${n.errors} errors, ${n.images} chart outputs)`).join('; '), u.tableau.map((t) => `${basename(t.path)} (${t.worksheets} worksheets, ${t.dashboards} dashboards, ${t.stories} stories, ${t.actions} actions)`).join('; '), u.images.length ? `${u.images.length} image file(s)` : '', u.reports.map((r) => `${basename(r.path)} (${r.words} words)`).join('; ')].filter(Boolean).join('; ') || 'none'}`,
    `- **Privacy cleanup needed:** ${u.flags.length ? [...new Map(u.flags.map((f) => [`${f.kind}:${f.file}`, f])).values()].map((f) => `${f.note} in ${f.file}`).join('; ') : 'no flag raised'}${u.aiProcessDocs.length ? `; AI process notes are not publishable material: ${u.aiProcessDocs.map((a) => basename(a.path)).join(', ')}` : ''}`,
    `- **Already on Khaylub.com:** ${u.alreadyPublished.length ? u.alreadyPublished.join('; ') : 'no'}${u.supersededBy ? `; contained in the later cumulative notebook of ${u.supersededBy}` : ''}`,
    `- **Privacy verdict:** ${u.scores.privacy === 0 ? 'a credential, connection string, or identifier is present: publication only from a derived public-safe copy, never the graded file' : u.scores.privacy < 3 ? 'flags to review before publication (listed above)' : 'no flag'}`,
    `- **Proposed Khaylub.com Project:** collection projects, type ${p.type}; context "${p.context ?? 'to confirm'}"; technologies ${p.technologies.join(', ') || 'to confirm'}; tags ${p.tags.join(', ') || 'to choose'}; source ${p.source ?? 'to supply'}; links ${Object.entries(p.links).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(', ') || 'to supply'}; cover ${p.cover ?? 'to choose'}; the body under the thirteen case-study headings`,
    `- **Owner input still needed:** ${ownerInput(u).join('; ')}`,
    `- **Scores:** ${Object.entries(u.scores).map(([k, v]) => `${k} ${v}`).join(', ')} (total ${u.total} of 27)`,
    ...u.reasons.map((r) => `  - ${r}`),
    `- **Confidence:** ${u.total >= 20 && u.scores.privacy >= 2 ? 'High' : u.total >= 14 ? 'Medium' : 'Low'} (${u.total} of 27; privacy ${u.scores.privacy} of 3; ${u.vault.some((v) => v.portfolioNote) ? 'backed by the owner\'s own portfolio notes' : 'no portfolio note backs it'})`,
    '',
  ].join('\n');
};
const report = [
  `# School portfolio audit, ${new Date().toISOString()}`,
  '',
  `Read-only over the school root (${courseDirs.length} course folder(s): ${courseDirs.join(', ')}) and the vault folders for those courses plus the Khaylub.com planning documents. ${units.length} assignment unit(s) found; ${ranked.length} scored; ${eligible.length} not yet on Khaylub.com${includePublished ? ' (published ones included by request)' : ''}. Nothing was written under either root. Scores are 0 to 3 per dimension with the reason on each line; nothing is ranked by size or count.`,
  '',
  section('BEST CANDIDATE', top[0]),
  section('RUNNER-UP 1', top[1]),
  section('RUNNER-UP 2', top[2]),
  '## Every unit, ranked',
  '',
  '| Rank | Unit | Course | Total | Completeness | Technical | Employer | Visual | Story | Source | Readiness | Privacy | Provenance | On Khaylub.com |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ...ranked.map((u, i) => `| ${i + 1} | ${u.unit}${u.supersededBy ? ' (contained in a later notebook)' : ''} | ${u.code} | ${u.total} | ${u.scores.completeness} | ${u.scores.technical} | ${u.scores.employer} | ${u.scores.visual} | ${u.scores.story} | ${u.scores.source} | ${u.scores.readiness} | ${u.scores.privacy} | ${u.scores.provenance} | ${u.alreadyPublished.length ? 'yes' : 'no'} |`),
  '',
  '## Privacy flags (what to exclude or redact; values are never printed)',
  '',
  ...ranked.flatMap((u) => [...new Map(u.flags.map((f) => [`${f.kind}:${f.file}`, f])).values()].map((f) => `- ${u.unit}: ${f.note} (${f.kind}) in ${f.file}`)),
  '',
  'Original graded files are read-only inputs. A portfolio version is always a derived copy or a new entry written from the evidence, never a modification of the submitted work. Grades appear only with the owner\'s explicit word.',
  '',
].join('\n');
writeFileSync(join(out, 'report.md'), report);
writeFileSync(join(out, 'candidates.json'), JSON.stringify(ranked.map((u) => ({ id: u.id, unit: u.unit, course: u.course, total: u.total, scores: u.scores, alreadyOnKhaylub: u.alreadyPublished })), null, 2) + '\n');
for (const u of top) writeFileSync(join(out, 'manifests', `${u.id}.json`), JSON.stringify(manifest(u), null, 2) + '\n');
console.log(`portfolio-audit: ${units.length} unit(s) in ${courseDirs.length} course folder(s); report at ${join(out, 'report.md')}; manifests for ${top.map((u) => u.id).join(', ') || 'none'}`);
for (const [i, u] of top.entries()) console.log(`  ${i === 0 ? 'BEST' : `RUNNER-UP ${i}`}: ${u.unit} (${u.code}) total ${u.total} of 27, privacy ${u.scores.privacy} of 3`);
