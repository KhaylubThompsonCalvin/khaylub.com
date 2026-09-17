// Every Studio response is private by declaration: never indexed, never framed, no content sniffing,
// no referrer leakage, HTTPS pinned. The Content Security Policy here carries only the directives
// that cannot break Keystatic's admin (a React application with inline styles whose network needs
// in cloud mode are observed on the deployed Studio first): no framing, no base override, forms to
// this origin only, no plugins. The source directives (script, style, connect, img) are added after
// the deployed Studio's console shows what Keystatic Cloud loads (a Phase 25 hardening item), the
// same Report-Only-first path the public site took. The Studio is reachable only to a signed-in
// owner and is not linked from the public site.
import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Content-Security-Policy', "frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'");
  // One year; ignored over plain HTTP in development, honoured on the HTTPS service.
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // no-store on everything, the admin's own bundles included: a private tool reloaded a few times a
  // day, where a stale bundle after a deploy would cost more than the caching saves. Do not loosen
  // this for the API routes, which carry repository content.
  response.headers.set('Cache-Control', 'no-store');
  return response;
});
