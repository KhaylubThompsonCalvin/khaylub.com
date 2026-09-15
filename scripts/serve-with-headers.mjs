// Serves dist/ with the headers and redirects declared in render.yaml so the header, security,
// and cache-tier assertions can run before any hosting service exists. Local and CI only.
// Usage: node scripts/serve-with-headers.mjs [port] [--preview]
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { load } from 'js-yaml';
import { headersFor as declaredHeaders } from './render-paths.mjs';

const port = Number(process.argv[2] || process.env.PORT || 4173);
const preview = process.argv.includes('--preview') || process.env.PUBLIC_SITE_ENV === 'preview';
const root = 'dist';

const blueprint = load(readFileSync('render.yaml', 'utf8'));
// The production service (khaylub-com) is the policy the tests assert; the staging service carries the same rules.
const service = blueprint.services.find((s) => s.name === 'khaylub-com') ?? blueprint.services[0];
const headerRules = service.headers ?? [];
const redirects = (service.routes ?? []).filter((r) => r.type === 'redirect');

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.glb': 'model/gltf-binary',
  '.wasm': 'application/wasm',
  '.map': 'application/json',
};

// Path matching as Render documents it (scripts/render-paths.mjs): a single "*" never crosses a
// slash, "**" does, a trailing "/*" covers the subtree. Later rules win when two name one header.
function headersFor(path) {
  const out = declaredHeaders(headerRules, path);
  if (preview) out['X-Robots-Tag'] = 'noindex, nofollow';
  return out;
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);
  let path = decodeURIComponent(url.pathname);

  const redirect = redirects.find((r) => r.source === path);
  if (redirect) {
    res.writeHead(301, { Location: redirect.destination, ...headersFor(path) });
    return res.end();
  }

  // Directory URLs: add the slash (Render does this for directories) and serve index.html.
  let file = normalize(join(root, path));
  if (!file.startsWith(normalize(root))) {
    res.writeHead(403);
    return res.end();
  }
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!path.endsWith('/')) {
      res.writeHead(301, { Location: path + '/' });
      return res.end();
    }
    file = join(file, 'index.html');
  }
  if (!existsSync(file)) {
    const notFound = join(root, '404.html');
    res.writeHead(404, { 'Content-Type': types['.html'], ...headersFor('/404.html') });
    return res.end(existsSync(notFound) ? readFileSync(notFound) : 'Not found');
  }
  const ext = extname(file).toLowerCase();
  res.writeHead(200, { 'Content-Type': types[ext] ?? 'application/octet-stream', ...headersFor(path) });
  res.end(readFileSync(file));
});

server.listen(port, () => {
  console.log(`serving ${root} with render.yaml headers on http://localhost:${port} (${preview ? 'preview' : 'production'} mode)`);
});
