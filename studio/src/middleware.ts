// Every Studio response is private by declaration: never indexed, never framed, no content sniffing,
// no referrer leakage, HTTPS pinned. The Content Security Policy here carries only the directives
// that cannot break Keystatic's admin (a React application with inline styles whose network needs
// in cloud mode are observed on the deployed Studio first): no framing, no base override, forms to
// this origin only, no plugins. The source directives (script, style, connect, img) are added after
// the deployed Studio's console shows what Keystatic Cloud loads, the same Report-Only-first path
// the public site took: CANDIDATE_POLICY below is served as Content-Security-Policy-Report-Only
// (Phase 27), its violations on the anonymous shell collected by studio/scripts/csp-report.mjs and
// on the signed-in app by the owner's browser console; it moves to the enforced header only after
// a clean log of the full app (the Phase 28 harness exercises it locally). The Studio is reachable
// only to a signed-in owner and is not linked from the public site.
import { defineMiddleware } from 'astro:middleware';
import { createHash } from 'node:crypto';

// The candidate: the app's own bundles plus the hash of each inline script Astro puts in the shell
// (its island runtime; hashed per response, so an Astro upgrade never needs a new policy and
// 'unsafe-inline' is never used for scripts); Keystatic's inline styles (Keystar UI writes them); images
// from this origin, data and blob URLs (previews of an upload), and GitHub avatars; connections to
// this origin, Keystatic Cloud's API, and GitHub's API (the cloud mode's content reads and writes);
// the Inter font files Keystar UI fetches from Google Fonts;
// no frames, no plugins, no base override, forms to this origin. Report-Only: nothing is blocked.
const CANDIDATE_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://avatars.githubusercontent.com https://*.githubusercontent.com https://*.keystatic.cloud",
  "connect-src 'self' https://api.keystatic.cloud https://*.keystatic.cloud https://api.github.com",
  // Keystar UI loads Inter from Google Fonts (eight woff2 files on the login shell, csp-report 2026-09-18).
  "font-src 'self' data: https://fonts.gstatic.com",
  "media-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "object-src 'none'",
];
export const CANDIDATE_POLICY = CANDIDATE_DIRECTIVES.join('; ');

const INLINE_SCRIPT = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g;
const hashOf = (code: string) => `'sha256-${createHash('sha256').update(code).digest('base64')}'`;
/** The candidate with the hash of every inline script in this HTML added to script-src. */
export function candidatePolicyFor(html: string): string {
  const hashes = [...html.matchAll(INLINE_SCRIPT)].map((m) => hashOf(m[1]));
  if (hashes.length === 0) return CANDIDATE_POLICY;
  return CANDIDATE_DIRECTIVES.map((d) => (d === "script-src 'self'" ? `script-src 'self' ${hashes.join(' ')}` : d)).join('; ');
}

export const onRequest = defineMiddleware(async (_context, next) => {
  let response = await next();
  let policy = CANDIDATE_POLICY;
  if ((response.headers.get('content-type') ?? '').startsWith('text/html')) {
    const html = await response.text();
    policy = candidatePolicyFor(html);
    response = new Response(html, { status: response.status, statusText: response.statusText, headers: response.headers });
  }
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Content-Security-Policy', "frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'");
  response.headers.set('Content-Security-Policy-Report-Only', policy);
  // One year; ignored over plain HTTP in development, honoured on the HTTPS service.
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // no-store on everything, the admin's own bundles included: a private tool reloaded a few times a
  // day, where a stale bundle after a deploy would cost more than the caching saves. Do not loosen
  // this for the API routes, which carry repository content.
  response.headers.set('Cache-Control', 'no-store');
  return response;
});
