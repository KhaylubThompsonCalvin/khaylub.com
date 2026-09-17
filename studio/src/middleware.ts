// Every Studio response is private by declaration: never indexed, never framed, no content sniffing,
// no referrer leakage. The public site's Content Security Policy does not apply here (Keystatic's
// admin is a React application with its own inline styles); the Studio is reachable only to a
// signed-in owner and is not linked from the public site.
import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Cache-Control', 'no-store');
  return response;
});
