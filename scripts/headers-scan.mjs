// Compares the headers a live site serves with the rules declared in render.yaml. Phase 19's
// verification clause ("headers scan on staging") runs this against the staging URL and the V1
// subdomain; tests/headers-scan.spec.ts proves it against the local header server, which serves the
// same rules. Only the headers render.yaml declares are compared; extra headers a host adds are
// ignored. Redirects are never followed, so a run never leaves the origin it was given.
// Usage: node scripts/headers-scan.mjs <base-url> [--preview]
//   --preview also expects X-Robots-Tag: noindex, nofollow. That header is what the local header
//   server adds in preview mode; render.yaml declares no such rule (a host cannot vary headers by
//   build), so against a host the flag is not used: a preview build proves itself by its robots.txt
//   (Disallow: /) and its meta noindex, which the build-preview CI job checks.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { load } from 'js-yaml';

// The paths cover every rule class in render.yaml: HTML (root, a section index, a page under a
// collection), the climb and search policies, a hashed asset (discovered from the home page), the
// resume PDF, media, a climb asset, and the discovery files.
const PATHS = ['/', '/work/', '/about/', '/projects/khaylub-com-v1/', '/climb/', '/search/', '/resume/Khaylub-Thompson-Calvin-Resume.pdf', '/og-default.png', '/climb/wanderer-web.glb', '/robots.txt', '/sitemap-index.xml', '/.well-known/security.txt'];

function matches(pattern, path) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  return new RegExp('^' + escaped.replace(/\*/g, '.*') + '$').test(path);
}

/** The headers render.yaml declares for one path (later, more specific rules win), names lowercased. */
export function expectedFor(path, rules, preview = false) {
  const out = {};
  for (const rule of rules) if (matches(rule.path, path)) out[rule.name.toLowerCase()] = String(rule.value);
  if (preview) out['x-robots-tag'] = 'noindex, nofollow';
  return out;
}

/** Every expected header that is missing or differs in the actual headers (names compared case-insensitively). */
export function compare(expected, actual) {
  const got = {};
  for (const [name, value] of Object.entries(actual)) got[name.toLowerCase()] = value;
  const out = [];
  for (const [name, value] of Object.entries(expected)) {
    if (got[name] !== value) out.push({ name, expected: value, actual: got[name] });
  }
  return out;
}

async function fetchHeaders(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, { redirect: 'manual', signal: controller.signal });
    await res.arrayBuffer(); // drain, then discard
    return { status: res.status, headers: Object.fromEntries(res.headers.entries()) };
  } finally {
    clearTimeout(timer);
  }
}

export async function scan(base, { preview = false, rules } = {}) {
  const origin = new URL(base);
  const headerRules = rules ?? load(readFileSync('render.yaml', 'utf8')).services[0].headers;
  const paths = [...PATHS];
  const home = await fetch(new URL('/', origin), { redirect: 'manual', signal: AbortSignal.timeout(15_000) }).then((r) => r.text()).catch(() => '');
  const css = home.match(/href="(\/_astro\/[^"]+\.css)"/);
  if (css) paths.splice(1, 0, css[1]);
  const lines = [];
  let mismatches = 0;
  let errors = 0;
  for (const path of paths) {
    let res;
    try {
      res = await fetchHeaders(new URL(path, origin));
    } catch (e) {
      errors++;
      lines.push(`ERROR    ${path}  ${e.message}`);
      continue;
    }
    if (res.status !== 200) {
      errors++;
      lines.push(`ERROR    ${path}  status ${res.status}`);
      continue;
    }
    const diff = compare(expectedFor(path, headerRules, preview), res.headers);
    if (diff.length === 0) lines.push(`ok       ${path}`);
    for (const d of diff) {
      mismatches++;
      lines.push(`MISMATCH ${path}  ${d.name}: expected "${d.expected}" got ${d.actual === undefined ? 'nothing' : `"${d.actual}"`}`);
    }
  }
  lines.push(`scanned ${paths.length} paths, ${mismatches} mismatches, ${errors} errors (${preview ? 'preview' : 'production'} expectations, ${origin.origin})`);
  return { ok: mismatches === 0 && errors === 0, lines };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const base = process.argv.find((a, i) => i >= 2 && !a.startsWith('--'));
  if (!base) {
    console.error('usage: node scripts/headers-scan.mjs <base-url> [--preview]');
    process.exit(2);
  }
  const preview = process.argv.includes('--preview');
  const result = await scan(base, { preview });
  console.log(result.lines.join('\n'));
  process.exit(result.ok ? 0 : 1);
}
