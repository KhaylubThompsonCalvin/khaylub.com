import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { compare, hstsAtLeast } from '../scripts/headers-scan.mjs';
import { matches } from '../scripts/render-paths.mjs';

// The header scan (scripts/headers-scan.mjs) compares the headers a live URL serves with the rules
// declared in render.yaml. Phase 19's verification clause runs it against the staging URL and the V1
// subdomain; here it is proven against the local header server, which serves the same rules.
test.describe('the header scan', () => {
  test('path rules match as Render documents them: * stays inside a segment, ** crosses, a trailing /* covers the subtree', () => {
    // The examples on Render's static-site headers page, read 2026-09-14.
    expect(matches('/*', '/')).toBe(true);
    expect(matches('/*', '/climb/wanderer-web.glb')).toBe(true);
    expect(matches('/blog/*', '/blog/')).toBe(true);
    expect(matches('/blog/*', '/blog/latest-post/')).toBe(true);
    expect(matches('/*.css', '/tokens.css')).toBe(true);
    expect(matches('/*.css', '/assets/theme.css')).toBe(false);
    expect(matches('/**/*.css', '/assets/theme.css')).toBe(true);
    expect(matches('/**/*.css', '/tokens.css')).toBe(false);
    // The rules render.yaml relies on.
    expect(matches('/**/', '/notes/preserving-v1/')).toBe(true);
    expect(matches('/**/', '/climb/wanderer-web.glb')).toBe(false);
    expect(matches('/climb/*.glb', '/climb/wanderer-web.glb')).toBe(true);
    expect(matches('/climb/*.glb', '/climb/')).toBe(false);
    expect(matches('/og/*', '/og/projects/khaylub-com-v1.png')).toBe(true);
    expect(matches('/*.png', '/og/projects/khaylub-com-v1.png')).toBe(false);
    expect(matches('/', '/work/')).toBe(false);
  });

  test('no path matches two Cache-Control rules in render.yaml', async () => {
    const { load } = await import('js-yaml');
    const { readFileSync, readdirSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const rules = (load(readFileSync('render.yaml', 'utf8')) as { services: { headers: { path: string; name: string }[] }[] }).services[0].headers.filter((r) => r.name.toLowerCase() === 'cache-control');
    const paths: string[] = [];
    const walk = (dir: string, prefix: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p, `${prefix}${name}/`);
        else paths.push(name === 'index.html' ? prefix || '/' : `${prefix}${name}`);
      }
    };
    walk('dist', '/');
    const doubled = paths.filter((p) => rules.filter((r) => matches(r.path, p)).length > 1);
    expect(doubled, 'paths with more than one Cache-Control rule').toEqual([]);
  });

  test('compare() reports every missing or differing header and nothing else', () => {
    const expected = { 'cache-control': 'no-cache', 'x-frame-options': 'DENY' };
    expect(compare(expected, { 'Cache-Control': 'no-cache', 'X-Frame-Options': 'DENY', 'x-extra': '1' })).toEqual([]);
    expect(compare(expected, { 'cache-control': 'public, max-age=60' })).toEqual([
      { name: 'cache-control', expected: 'no-cache', actual: 'public, max-age=60' },
      { name: 'x-frame-options', expected: 'DENY', actual: undefined },
    ]);
  });

  test('Strict-Transport-Security is a floor: a stronger provider value passes, a weaker one fails', () => {
    const declared = 'max-age=31536000; includeSubDomains';
    expect(hstsAtLeast(declared, 'max-age=315360000; includeSubdomains; preload')).toBe(true);
    expect(hstsAtLeast(declared, 'max-age=31536000; includeSubDomains')).toBe(true);
    expect(hstsAtLeast(declared, 'max-age=31536000')).toBe(false);
    expect(hstsAtLeast(declared, 'max-age=300; includeSubDomains; preload')).toBe(false);
    expect(hstsAtLeast(declared, '')).toBe(false);
    expect(compare({ 'strict-transport-security': declared }, { 'Strict-Transport-Security': 'max-age=315360000; includeSubdomains; preload' })).toEqual([]);
    expect(compare({ 'strict-transport-security': declared }, { 'Strict-Transport-Security': 'max-age=300' })).toHaveLength(1);
    expect(compare({ 'strict-transport-security': declared }, {})).toHaveLength(1);
  });

  test('the scan passes against the local header server in production mode', async ({ baseURL }) => {
    const run = spawnSync('node', ['scripts/headers-scan.mjs', baseURL!], { encoding: 'utf8' });
    expect(run.status, run.stdout + run.stderr).toBe(0);
    expect(run.stdout).not.toMatch(/MISMATCH|ERROR/);
    expect(run.stdout).toMatch(/^ok +\/$/m);
    expect(run.stdout).toMatch(/ok +\/climb\/wanderer-web\.glb/);
    expect(run.stdout).toMatch(/ok +\/_astro\/[^ ]+\.css/);
    expect(run.stdout).toMatch(/scanned \d+ paths, 0 mismatches/);
  });

  test('the scan with samples passes against the consistent local server', async ({ baseURL }) => {
    const run = spawnSync('node', ['scripts/headers-scan.mjs', baseURL!, '--samples', '2'], { encoding: 'utf8' });
    expect(run.status, run.stdout + run.stderr).toBe(0);
    expect(run.stdout).not.toMatch(/INCONSISTENT|MISMATCH|ERROR/);
    expect(run.stdout).toMatch(/scanned \d+ paths x 2 samples, 0 mismatches, 0 errors, 0 inconsistent/);
  });

  test('a host that applies a rule on some requests only is reported INCONSISTENT, not as a random verdict', async () => {
    // A server that alternates the cache header on every request, the way staging answered on 2026-09-14.
    const { createServer } = await import('node:http');
    let n = 0;
    const server = createServer((req, res) => {
      n++;
      res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': n % 2 ? 'public, max-age=3600' : 'no-cache' });
      res.end('x');
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const port = (server.address() as { port: number }).port;
    try {
      const { scan } = await import('../scripts/headers-scan.mjs');
      const rules = [{ path: '/robots.txt', name: 'Cache-Control', value: 'public, max-age=3600' }];
      const result = await scan(`http://127.0.0.1:${port}`, { rules, samples: 4 });
      expect(result.ok).toBe(false);
      expect(result.inconsistent).toBe(1);
      const text = result.lines.join('\n');
      expect(text).toMatch(/INCONSISTENT \/robots\.txt  4 samples answered 2 ways/);
      expect(text).toMatch(/MISMATCH \/robots\.txt  \[2 of 4\]  cache-control: expected "public, max-age=3600" got "no-cache"/);
      expect(text).toMatch(/1 inconsistent/);
      const steady = await scan(`http://127.0.0.1:${port}`, { rules, samples: 1 });
      expect(steady.inconsistent).toBe(0); // one sample cannot see it: that is why the runbook asks for several
    } finally {
      server.close();
    }
  });

  test('the scan fails when a required header is absent (preview expectation against production mode)', async ({ baseURL }) => {
    const run = spawnSync('node', ['scripts/headers-scan.mjs', baseURL!, '--preview'], { encoding: 'utf8' });
    expect(run.status).toBe(1);
    expect(run.stdout).toMatch(/MISMATCH +\/ +x-robots-tag/);
  });
});
