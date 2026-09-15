// Compares the headers a live site serves with the rules declared in render.yaml. Phase 19's
// verification clause ("headers scan on staging") runs this against the staging URL and the V1
// subdomain; tests/headers-scan.spec.ts proves it against the local header server, which serves the
// same rules. Only the headers render.yaml declares are compared; extra headers a host adds are
// ignored. Redirects are never followed, so a run never leaves the origin it was given.
// Usage: node scripts/headers-scan.mjs <base-url> [--preview] [--samples N]
//   --samples N fetches every path N times (cache-busted after the first) and reports a path whose
//   samples disagree as INCONSISTENT: a host applying its rules on some requests only is a host
//   defect, not a rule defect, and a single fetch would report it as a random mismatch.
//   --preview also expects X-Robots-Tag: noindex, nofollow. That header is what the local header
//   server adds in preview mode; render.yaml declares no such rule (a host cannot vary headers by
//   build), so against a host the flag is not used: a preview build proves itself by its robots.txt
//   (Disallow: /) and its meta noindex, which the build-preview CI job checks.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { load } from 'js-yaml';
import { matches } from './render-paths.mjs';

// The paths cover every rule class in render.yaml: HTML (root, a section index, a page under a
// collection), the climb and search policies, a hashed asset (discovered from the home page), the
// resume PDF, media, a climb asset, and the discovery files.
const PATHS = ['/', '/work/', '/about/', '/projects/khaylub-com-v1/', '/climb/', '/search/', '/resume/Khaylub-Thompson-Calvin-Resume.pdf', '/og-default.png', '/climb/wanderer-web.glb', '/robots.txt', '/sitemap-index.xml', '/.well-known/security.txt'];

/** The headers render.yaml declares for one path (later, more specific rules win), names lowercased. */
export function expectedFor(path, rules, preview = false) {
  const out = {};
  for (const rule of rules) if (matches(rule.path, path)) out[rule.name.toLowerCase()] = String(rule.value);
  if (preview) out['x-robots-tag'] = 'noindex, nofollow';
  return out;
}

/** Parses a Strict-Transport-Security value into its max-age and directive flags (case-insensitive). */
export function parseHsts(value) {
  const parts = String(value ?? '').split(';').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const maxAge = parts.map((p) => /^max-age=(\d+)$/.exec(p)).find(Boolean);
  return { maxAge: maxAge ? Number(maxAge[1]) : -1, includeSubDomains: parts.includes('includesubdomains'), preload: parts.includes('preload') };
}

/**
 * True when the served Strict-Transport-Security is at least as strong as the declared one: a max-age
 * no shorter, includeSubDomains kept when declared, preload allowed either way. Hosts manage this
 * header themselves (Render serves its own value on onrender.com, which is on the HSTS preload
 * list), so the declared rule is a floor, not an exact string.
 */
export function hstsAtLeast(declared, served) {
  const d = parseHsts(declared);
  const s = parseHsts(served);
  return s.maxAge >= d.maxAge && (!d.includeSubDomains || s.includeSubDomains);
}

/** Every expected header that is missing or differs in the actual headers (names compared case-insensitively). */
export function compare(expected, actual) {
  const got = {};
  for (const [name, value] of Object.entries(actual)) got[name.toLowerCase()] = value;
  const out = [];
  for (const [name, value] of Object.entries(expected)) {
    if (name === 'strict-transport-security' && got[name] !== undefined && hstsAtLeast(value, got[name])) continue;
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

/**
 * @param {string} base the origin to scan
 * @param {{ preview?: boolean, rules?: { path: string, name: string, value: string }[], samples?: number }} [options]
 *   rules defaults to render.yaml's; samples above 1 detects a host that answers inconsistently
 */
export async function scan(base, { preview = false, rules, samples = 1 } = {}) {
  const origin = new URL(base);
  const services = load(readFileSync('render.yaml', 'utf8')).services;
  const headerRules = rules ?? (services.find((s) => s.name === 'khaylub-com') ?? services[0]).headers;
  const paths = [...PATHS];
  const home = await fetch(new URL('/', origin), { redirect: 'manual', signal: AbortSignal.timeout(15_000) }).then((r) => r.text()).catch(() => '');
  const css = home.match(/href="(\/_astro\/[^"]+\.css)"/);
  if (css) paths.splice(1, 0, css[1]);
  const lines = [];
  let mismatches = 0;
  let errors = 0;
  let inconsistent = 0;
  for (const path of paths) {
    const expected = expectedFor(path, headerRules, preview);
    const seen = new Map(); // one entry per distinct set of compared headers, with its sample count
    let failed = false;
    for (let i = 0; i < samples; i++) {
      const url = new URL(path, origin);
      if (i > 0) url.searchParams.set('scan', `${Date.now()}${i}`); // past any shared cache
      let res;
      try {
        res = await fetchHeaders(url);
      } catch (e) {
        errors++;
        failed = true;
        lines.push(`ERROR    ${path}  ${e.message}`);
        break;
      }
      if (res.status !== 200) {
        errors++;
        failed = true;
        lines.push(`ERROR    ${path}  status ${res.status}`);
        break;
      }
      const key = JSON.stringify(Object.keys(expected).sort().map((name) => [name, res.headers[name]]));
      const entry = seen.get(key) ?? { headers: res.headers, count: 0 };
      entry.count++;
      seen.set(key, entry);
    }
    if (failed) continue;
    const variants = [...seen.values()];
    if (variants.length > 1) {
      inconsistent++;
      lines.push(`INCONSISTENT ${path}  ${samples} samples answered ${variants.length} ways:`);
    }
    for (const v of variants) {
      const diff = compare(expected, v.headers);
      const tag = variants.length > 1 ? `  [${v.count} of ${samples}]` : '';
      if (diff.length === 0) lines.push(`ok       ${path}${tag}`);
      for (const d of diff) {
        mismatches++;
        lines.push(`MISMATCH ${path}${tag}  ${d.name}: expected "${d.expected}" got ${d.actual === undefined ? 'nothing' : `"${d.actual}"`}`);
      }
    }
  }
  const sampled = samples > 1 ? ` x ${samples} samples` : '';
  const unstable = samples > 1 ? `, ${inconsistent} inconsistent` : '';
  lines.push(`scanned ${paths.length} paths${sampled}, ${mismatches} mismatches, ${errors} errors${unstable} (${preview ? 'preview' : 'production'} expectations, ${origin.origin})`);
  return { ok: mismatches === 0 && errors === 0 && inconsistent === 0, lines, inconsistent };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const base = process.argv.find((a, i) => i >= 2 && !a.startsWith('--'));
  if (!base) {
    console.error('usage: node scripts/headers-scan.mjs <base-url> [--preview] [--samples N]');
    process.exit(2);
  }
  const preview = process.argv.includes('--preview');
  const at = process.argv.indexOf('--samples');
  const samples = at > 0 ? Math.max(1, Number(process.argv[at + 1]) || 1) : 1;
  const result = await scan(base, { preview, samples });
  console.log(result.lines.join('\n'));
  process.exit(result.ok ? 0 : 1);
}
