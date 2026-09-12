// Own captures of the ported climb: the exhibit poster, the summit still, a scroll recording, and
// the measured opt-in payload. Serves dist/ on 4174 for the duration (build first). Outputs land
// in --out (default captures/, ignored by git); the recording is a WebM that ffmpeg encodes to
// the site's video rules afterwards, for example:
//   ffmpeg -i captures/the-climb-recording.webm -an -c:v libx264 -preset slow -crf 23 -maxrate 5M \
//     -bufsize 10M -pix_fmt yuv420p -movflags +faststart public/media/<slug>/<slug>.mp4
// Usage: node scripts/capture-climb.mjs [--out captures]
import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, renameSync, statSync } from 'node:fs';
import { chromium } from '@playwright/test';

const out = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'captures';
mkdirSync(out, { recursive: true });
const ASSET = /climb-mount|climb\.[A-Za-z0-9_-]+\.css|\/client\.|three|fiber|react|\.glb|\.mp4|\.wasm/i;
const base = 'http://localhost:4174';

const server = spawn('node', ['scripts/serve-with-headers.mjs', '4174'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));

async function openClimb(page) {
  await page.goto(`${base}/climb/`);
  await page.getByRole('button', { name: 'Tap to explore' }).click();
  await page.locator('.climb canvas').waitFor({ timeout: 60000 });
  await page.locator('.climb-status').filter({ hasText: /^$/ }).waitFor({ state: 'attached', timeout: 60000 });
  await page.waitForTimeout(1500);
}

/** Scroll the island's track to story progress p (0..1) and settle. */
async function seek(page, p, settle = 900) {
  await page.evaluate((p) => {
    const track = document.querySelector('.climb-track');
    const top = track.getBoundingClientRect().top + window.scrollY;
    const span = track.offsetHeight - window.innerHeight;
    window.scrollTo(0, top + span * 0.86 * p);
  }, p);
  await page.waitForTimeout(settle);
}

try {
  const browser = await chromium.launch();

  // 1. Stills and the payload at 1440 by 900.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const bytes = new Map();
  page.on('response', async (r) => {
    if (!ASSET.test(r.url())) return;
    try {
      bytes.set(r.url(), (await r.body()).length);
    } catch {
      /* not readable */
    }
  });
  await openClimb(page);
  await seek(page, 0.53, 1500);
  await page.screenshot({ path: `${out}/exhibit-poster.png` });
  await seek(page, 1.0, 2500);
  await page.screenshot({ path: `${out}/summit.png` });
  await page.locator('.climb [data-beat="contact"]').evaluate((el) => el.scrollIntoView({ block: 'end' }));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/contact.png` });
  const total = [...bytes.values()].reduce((n, b) => n + b, 0);
  console.log(`opt-in payload after one full scroll: ${total} bytes (${(total / 1e6).toFixed(2)} MB)`);
  for (const [u, b] of bytes) console.log(`${String(b).padStart(9)}  ${u.replace(base, '')}`);
  await ctx.close();

  // 2. The recording: a 24 s eased scroll with a 2 s hold at each end (the file also carries the
  //    seconds the models take to load after the door is pressed).
  const rec = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: `${out}/video`, size: { width: 1440, height: 900 } } });
  const rp = await rec.newPage();
  await openClimb(rp);
  await rp.evaluate(() => {
    const track = document.querySelector('.climb-track');
    window.scrollTo(0, track.getBoundingClientRect().top + window.scrollY);
  });
  await rp.waitForTimeout(2000);
  await rp.evaluate(async (ms) => {
    const track = document.querySelector('.climb-track');
    const top = track.getBoundingClientRect().top + window.scrollY;
    const end = top + track.offsetHeight - window.innerHeight;
    const t0 = performance.now();
    await new Promise((res) => {
      const step = (t) => {
        const k = Math.min(1, (t - t0) / ms);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        window.scrollTo(0, top + (end - top) * e);
        if (k < 1) requestAnimationFrame(step);
        else res();
      };
      requestAnimationFrame(step);
    });
  }, 24000);
  await rp.waitForTimeout(2500);
  await rec.close();
  const webm = readdirSync(`${out}/video`).find((f) => f.endsWith('.webm'));
  renameSync(`${out}/video/${webm}`, `${out}/the-climb-recording.webm`);
  console.log(`recording: ${out}/the-climb-recording.webm (${statSync(`${out}/the-climb-recording.webm`).size} bytes)`);
  await browser.close();
} finally {
  server.kill();
}
