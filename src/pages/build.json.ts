import type { APIRoute } from 'astro';
import { isPreview } from '@lib/profile';
import { execSync } from 'node:child_process';

// The build stamp (Phase 27): which commit a deployed origin is serving, so the publishing harness
// (scripts/publishing-verify.mjs) can tell "the merge is live on staging" from "an older build is
// still up" without guessing from content. Render sets RENDER_GIT_COMMIT at build time; a local
// build reads the checked-out HEAD when Git answers, else null. No secret, no path, no owner data.
const commit = process.env.RENDER_GIT_COMMIT ?? localHead();

function localHead(): string | null {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
  } catch {
    return null;
  }
}

export const GET: APIRoute = () =>
  new Response(JSON.stringify({ commit, env: isPreview() ? 'preview' : 'production', built: new Date().toISOString() }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
