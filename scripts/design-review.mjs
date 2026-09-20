// OWNER DESIGN MODE (vault document 57 section 3.1): a headed browser the owner can see, opened at
// the page under discussion and kept open until the owner ends the review. Nothing is changed and
// nothing is captured unless asked; the DOM and the accessibility tree are read on demand through a
// small control file, so the session can resize, navigate, highlight, and snapshot while the owner
// watches. The guards and regression tests stay headless (npm test, test:visual, the harnesses).
//
// Usage: node scripts/design-review.mjs <url> [--width 1440 --height 900] [--control <file>]
// The control file (JSON, rewritten by the session, consumed and deleted by this script) carries one
// command at a time: { "goto": "<url>" } | { "viewport": [w, h] } | { "highlight": "<css selector>" }
// | { "clear": true } | { "aria": "<css selector>" , "out": "<file>" } | { "capture": "<file>" } | { "close": true }
// | { "script": "<js>", "file": "<path read into the variable data as a data: URL>" } (a preview injected
//   into the page in memory only; the site is never changed; a reload discards it).
import { chromium } from 'playwright';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--')) ?? 'https://khaylub.com/';
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const width = Number(opt('width', 1440));
const height = Number(opt('height', 900));
const control = opt('control', '.design-review-command.json');
const status = opt('status', '.design-review-status.json');

const browser = await chromium.launch({ headless: false, args: [`--window-size=${width + 16},${height + 88}`] });
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
const page = await context.newPage();
await page.goto(url, { waitUntil: 'networkidle' });
const report = (extra = {}) => writeFileSync(status, JSON.stringify({ url: page.url(), viewport: page.viewportSize(), at: new Date().toISOString(), ...extra }, null, 2));
report({ state: 'open' });
console.log(`design-review: open at ${url} (${width}x${height}); write ${control} to drive it`);

const outline = async (selector) => page.evaluate((sel) => {
  for (const e of document.querySelectorAll('[data-design-review]')) { e.style.outline = ''; e.style.outlineOffset = ''; e.removeAttribute('data-design-review'); }
  if (!sel) return 0;
  const els = document.querySelectorAll(sel);
  for (const e of els) { e.setAttribute('data-design-review', '1'); e.style.outline = '3px dashed #1d4ed8'; e.style.outlineOffset = '2px'; }
  const first = els[0]; if (first) first.scrollIntoView({ block: 'center' });
  return els.length;
}, selector);

let open = true;
while (open) {
  await new Promise((r) => setTimeout(r, 500));
  if (!existsSync(control)) continue;
  let cmd;
  try { cmd = JSON.parse(readFileSync(control, 'utf8')); } catch { continue; }
  rmSync(control, { force: true });
  try {
    if (cmd.goto) await page.goto(cmd.goto, { waitUntil: 'networkidle' });
    if (cmd.viewport) await page.setViewportSize({ width: cmd.viewport[0], height: cmd.viewport[1] });
    if (cmd.highlight) { const n = await outline(cmd.highlight); report({ state: 'open', highlighted: cmd.highlight, matches: n }); continue; }
    if (cmd.clear) await outline(null);
    if (cmd.script) {
      const data = cmd.file ? `data:image/${cmd.file.split('.').pop()};base64,${readFileSync(cmd.file).toString('base64')}` : null;
      const result = await page.evaluate(new Function('data', cmd.script), data);
      report({ state: 'open', script: 'ran', result: result ?? null });
      continue;
    }
    if (cmd.aria) { const snap = await page.locator(cmd.aria).first().ariaSnapshot(); if (cmd.out) writeFileSync(cmd.out, snap); report({ state: 'open', aria: cmd.out ?? snap.slice(0, 2000) }); continue; }
    if (cmd.capture) { await page.screenshot({ path: cmd.capture, fullPage: !!cmd.fullPage }); report({ state: 'open', captured: cmd.capture }); continue; }
    if (cmd.close) open = false;
    report({ state: open ? 'open' : 'closed' });
  } catch (e) {
    report({ state: 'open', error: e.message });
  }
}
await browser.close();
console.log('design-review: closed');
