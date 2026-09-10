// Production allows crawling and names the sitemap. Preview builds disallow everything and the
// host also sends X-Robots-Tag: noindex on preview URLs.
import type { APIRoute } from 'astro';

export const GET: APIRoute = () => {
  const preview = import.meta.env.PUBLIC_SITE_ENV === 'preview';
  const body = preview
    ? 'User-agent: *\nDisallow: /\n'
    : 'User-agent: *\nAllow: /\n\nSitemap: https://khaylub.com/sitemap-index.xml\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
