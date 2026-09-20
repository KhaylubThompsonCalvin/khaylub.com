// The golden comparison for the design initiative (vault document 62, F2; runbook 10.10): every
// capture in BEFORE against the same name in AFTER, pixel by pixel, with a threshold of zero.
// Both folders come from `npm run test:visual` (the deterministic environment of F1), so a single
// differing pixel is a real change. Nothing here needs a dependency beyond sharp, which the build
// already uses.
//
// Usage: node scripts/visual-diff.mjs <before-dir> <after-dir> [--report <file>] [--diff-dir <dir>]
// Exit 0 when every pair is identical, 1 when any differs or a capture is missing on either side.
import { readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import sharp from 'sharp';

const args = process.argv.slice(2);
const dirs = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
if (dirs.length !== 2) {
  console.error('Usage: node scripts/visual-diff.mjs <before-dir> <after-dir> [--report <file>] [--diff-dir <dir>]');
  process.exit(2);
}
const [before, after] = dirs;
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const reportPath = option('--report');
const diffDir = option('--diff-dir');
if (diffDir) mkdirSync(diffDir, { recursive: true });

const pngs = (dir) => readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
const names = new Set([...pngs(before), ...pngs(after)]);
const rows = [];
let failures = 0;

for (const name of names) {
  const a = join(before, name);
  const b = join(after, name);
  if (!existsSync(a) || !existsSync(b)) {
    rows.push({ name, status: 'missing', side: existsSync(a) ? 'after' : 'before' });
    failures++;
    continue;
  }
  const [ia, ib] = await Promise.all([sharp(a).ensureAlpha().raw().toBuffer({ resolveWithObject: true }), sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true })]);
  if (ia.info.width !== ib.info.width || ia.info.height !== ib.info.height) {
    rows.push({ name, status: 'size', before: `${ia.info.width}x${ia.info.height}`, after: `${ib.info.width}x${ib.info.height}` });
    failures++;
    continue;
  }
  const { width, height, channels } = ia.info;
  let differing = 0;
  const mask = diffDir ? Buffer.alloc(width * height * 4) : null;
  for (let i = 0; i < width * height; i++) {
    const o = i * channels;
    const same = ia.data[o] === ib.data[o] && ia.data[o + 1] === ib.data[o + 1] && ia.data[o + 2] === ib.data[o + 2] && ia.data[o + 3] === ib.data[o + 3];
    if (!same) {
      differing++;
      if (mask) {
        mask[i * 4] = 255;
        mask[i * 4 + 3] = 255;
      }
    }
  }
  rows.push({ name, status: differing === 0 ? 'identical' : 'differs', differing, pixels: width * height });
  if (differing > 0) {
    failures++;
    if (mask) await sharp(mask, { raw: { width, height, channels: 4 } }).png().toFile(join(diffDir, basename(name, '.png') + '--diff.png'));
  }
}

const identical = rows.filter((r) => r.status === 'identical').length;
const lines = [
  `visual-diff: ${identical} of ${rows.length} captures identical; ${failures} differing, missing, or resized`,
  ...rows.filter((r) => r.status !== 'identical').map((r) => (r.status === 'differs' ? `  DIFFERS ${r.name}: ${r.differing} of ${r.pixels} pixels` : r.status === 'size' ? `  SIZE ${r.name}: ${r.before} before, ${r.after} after` : `  MISSING ${r.name} on the ${r.side} side`)),
];
console.log(lines.join('\n'));
if (reportPath) {
  const md = [
    `# Visual diff`,
    ``,
    `Before: \`${basename(before)}\` · After: \`${basename(after)}\` · ${new Date().toISOString()}`,
    ``,
    `Result: **${failures === 0 ? 'IDENTICAL' : 'DIFFERENT'}** (${identical} of ${rows.length} captures identical; threshold zero pixels)`,
    ``,
    `| Capture | Result | Differing pixels |`,
    `|---|---|---|`,
    ...rows.map((r) => `| ${r.name} | ${r.status} | ${r.status === 'identical' || r.status === 'differs' ? `${r.differing} of ${r.pixels}` : r.status === 'size' ? `${r.before} before, ${r.after} after` : `missing on the ${r.side} side`} |`),
  ];
  writeFileSync(reportPath, md.join('\n') + '\n');
}
process.exit(failures === 0 ? 0 : 1);
