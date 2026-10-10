// Sized cover files for the profile skins (Profile Themes, 2026-10-10): one 2880 x 1620 source per
// scene skin in assets-src/skins/, written to public/skins/<skin>/cover-<width>.<avif|webp>.
// Run after a source changes: node scripts/skin-covers.mjs
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
const SKINS = ['paper', 'desert-night', 'arizona-made', 'golden-hour', 'above-the-clouds'];
const WIDTHS = [640, 1024, 1440, 2880];
for (const s of SKINS) {
  mkdirSync(`public/skins/${s}`, { recursive: true });
  for (const w of WIDTHS) {
    const img = sharp(`assets-src/skins/${s}.jpg`).resize({ width: w });
    await img.clone().avif({ quality: w >= 2880 ? 42 : 50, effort: 6 }).toFile(`public/skins/${s}/cover-${w}.avif`);
    await img.clone().webp({ quality: w >= 2880 ? 57 : 70 }).toFile(`public/skins/${s}/cover-${w}.webp`);
  }
}
console.log('skin covers written');
