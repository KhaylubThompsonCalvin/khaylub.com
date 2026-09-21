// The metric-matched fallbacks for the self-hosted faces (vault document 63 section 8). Reads the
// shipped WOFF2 files and, when a local fallback font file is given, computes the @font-face
// overrides that make the fallback occupy the same space as the web face while it loads, with the
// Capsize formulas (the ones Astro's own fallback optimiser uses); Astro's table of common system
// faces covers the fallbacks a file is not given for. No dependency beyond @capsizecss/unpack, which
// Astro already installs.
//
// Usage: node scripts/font-metrics.mjs [--georgia <path to georgia.ttf>] [--segoe <path to segoeui.ttf>]
import { readFileSync } from 'node:fs';
import { fromBuffer } from '@capsizecss/unpack';

const args = process.argv.slice(2);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);

// Astro's table (dist/assets/fonts/infra/system-fallbacks-provider.js) for the faces without a file.
const SYSTEM = {
  'Times New Roman': { ascent: 1825, descent: -443, lineGap: 87, unitsPerEm: 2048, xWidthAvg: 886 },
  Arial: { ascent: 1854, descent: -434, lineGap: 67, unitsPerEm: 2048, xWidthAvg: 913 },
  'Segoe UI': { ascent: 2210, descent: -514, lineGap: 0, unitsPerEm: 2048, xWidthAvg: 908 },
  Roboto: { ascent: 1900, descent: -500, lineGap: 0, unitsPerEm: 2048, xWidthAvg: 911 },
  'Helvetica Neue': { ascent: 952, descent: -213, lineGap: 28, unitsPerEm: 1000, xWidthAvg: 450 },
};

const pct = (v) => `${Math.round(v * 10000) / 100}%`;
const metrics = async (file) => {
  const m = await fromBuffer(readFileSync(file));
  return { familyName: m.familyName, unitsPerEm: m.unitsPerEm, ascent: m.ascent, descent: m.descent, lineGap: m.lineGap, capHeight: m.capHeight, xHeight: m.xHeight, xWidthAvg: m.xWidthAvg };
};

/** Capsize: size-adjust from the average widths; the vertical overrides against the adjusted em square. */
function overrides(web, fallback) {
  const sizeAdjust = web.xWidthAvg / web.unitsPerEm / (fallback.xWidthAvg / fallback.unitsPerEm);
  const em = web.unitsPerEm * sizeAdjust;
  return { sizeAdjust: pct(sizeAdjust), ascent: pct(web.ascent / em), descent: pct(Math.abs(web.descent) / em), lineGap: pct(web.lineGap / em) };
}

const faces = [
  { file: 'src/assets/fonts/fraunces-latin.woff2', fallbacks: ['Georgia', 'Times New Roman'] },
  { file: 'src/assets/fonts/kt-sans-latin.woff2', fallbacks: ['Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial'] },
];
const local = { Georgia: option('--georgia'), 'Segoe UI': option('--segoe') };

for (const face of faces) {
  const web = await metrics(face.file);
  console.log(`${web.familyName} (${face.file}): upm ${web.unitsPerEm}, ascent ${web.ascent}, descent ${web.descent}, lineGap ${web.lineGap}, capHeight ${web.capHeight}, xHeight ${web.xHeight}, xWidthAvg ${web.xWidthAvg}`);
  for (const name of face.fallbacks) {
    const fb = local[name] ? await metrics(local[name]) : SYSTEM[name];
    if (!fb) { console.log(`  ${name}: no metrics (pass the file)`); continue; }
    const o = overrides(web, fb);
    console.log(`  fallback ${name}${local[name] ? ' (from file)' : ' (Astro table)'}: size-adjust ${o.sizeAdjust}; ascent-override ${o.ascent}; descent-override ${o.descent}; line-gap-override ${o.lineGap}`);
  }
}
