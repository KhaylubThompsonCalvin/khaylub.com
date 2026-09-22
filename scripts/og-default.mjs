// Draws public/og-default.png, the site's fallback social card (the Home page, the index pages, a
// withdrawn piece), from the profile's name and role line in the light palette of
// src/styles/tokens.css. Run once when the palette or the profile changes: node scripts/og-default.mjs
// The faces are the machine's Georgia and Segoe UI (the card is a picture, drawn locally, committed).
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import { load } from 'js-yaml';

const id = load(readFileSync('content/profile/identity.yaml', 'utf8'));
const tokens = readFileSync('src/styles/tokens.css', 'utf8');
const token = (name) => tokens.match(new RegExp(`${name}: (#[0-9a-f]{6});`))[1];
const BG = token('--bg'), INK = token('--ink'), MUTED = token('--muted'), ACCENT = token('--accent');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const [first, ...rest] = id.name.split(' ');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${BG}"/>
  <text x="80" y="193" font-family="Segoe UI, Arial, sans-serif" font-size="26" letter-spacing="3" fill="${MUTED}">${esc(id.site_name.toUpperCase())}</text>
  <text x="80" y="296" font-family="Georgia, 'Times New Roman', serif" font-size="84" font-weight="700" fill="${INK}">${esc(first)}</text>
  <text x="80" y="384" font-family="Georgia, 'Times New Roman', serif" font-size="84" font-weight="700" fill="${INK}">${esc(rest.join(' '))}</text>
  <text x="80" y="456" font-family="Segoe UI, Arial, sans-serif" font-size="30" fill="${MUTED}">${esc(id.role_line)}</text>
  <rect x="80" y="556" width="160" height="6" fill="${ACCENT}"/>
</svg>`;
const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
writeFileSync('public/og-default.png', png);
console.log(`public/og-default.png ${png.length} bytes in ${BG} / ${INK} / ${MUTED} / ${ACCENT}`);
