// The profile skins (Profile Themes, 2026-10-10): one small stylesheet per non-Paper skin, written to
// public/skins/<skin>.css from scripts/skins/skins.json. Tokens only, the cover as a background from
// the sized files (scripts/skin-covers.mjs), and one CSS motion layer that stops under reduced motion.
import { readFileSync, writeFileSync } from 'node:fs';
import { skinVersion } from './skin-version.mjs';
const table = JSON.parse(readFileSync('scripts/skins/skins.json', 'utf8'));
// A skin whose subject sits low in its frame names its own cover_position (the Summit's signpost and
// the Wanderer by the fire); the others keep the bundle's 50% 35%.
// The components read the palette tokens (--bg, --ink, --muted, --accent, --card) as well as the
// semantic roles, so each skin points the palette at its roles, and sets the scheme's own focus ring,
// notice, shade and scrim (the values of tokens.css for that scheme), so a device in dark mode cannot
// leak the Paper dark palette into a light skin.
const PALETTE = '--bg:var(--surface);--card:var(--surface-raised);--ink:var(--text);--muted:var(--text-secondary);--accent:var(--link-content)';
const SCHEME = {
  light: '--focus:#1d4ed8;--notice:#7a5b15;--scrim:rgba(34,26,17,.85);--shade:#221a11;--status:#2e7d32',
  dark: '--focus:#8ab6e2;--notice:#d9b060;--scrim:rgba(21,18,13,.85);--shade:#000;--status:#6cc070',
};
// Every skin URL carries the version token (scripts/skin-version.mjs), so render.yaml caches /skins/* for a year.
const V = skinVersion();
const img = (s, w) => `image-set(url(/skins/${s}/cover-${w}.avif?v=${V}) type("image/avif"),url(/skins/${s}/cover-${w}.webp?v=${V}) type("image/webp"))`;
const cover = (s, pos) => `html[data-tier] .profile-cover .cover-art{background-image:${img(s, 1024)}${pos ? `;background-position:${pos}` : ''}}@media (min-width:1025px){html[data-tier] .profile-cover .cover-art{background-image:${img(s, 1440)}}}@media (min-width:1025px) and (min-resolution:1.5dppx){html[data-tier] .profile-cover .cover-art{background-image:${img(s, 2880)}}}@media (max-width:640px){html[data-tier] .profile-cover .cover-art{background-image:${img(s, 640)}}}html[data-tier] .profile-cover .cover-art picture{display:none}`;
// Profile 2006 has no scene: the cover is the blue bar on a tiled stripe, and the name, the status
// and the buttons sit on the white profile box (never on the striped page, about 2.7:1 for the name).
const PROFILE_2006_COVER = 'html[data-tier] .profile-cover{background:#fff}html[data-tier] .profile-cover .cover-art{height:120px;background:#039 repeating-linear-gradient(45deg,#0a3fa8 0 10px,#039 10px 20px)}html[data-tier] .profile-cover .cover-art picture{display:none}';
const layer = 'position:fixed;inset:0;pointer-events:none;z-index:-1';
const MOTION = {
  twinkle: `.skin-motion{${layer};background-image:radial-gradient(1.5px 1.5px at 12% 18%,#fff,transparent),radial-gradient(1px 1px at 38% 9%,#fff,transparent),radial-gradient(1.5px 1.5px at 66% 22%,#fff,transparent),radial-gradient(1px 1px at 84% 12%,#fff,transparent),radial-gradient(1px 1px at 92% 34%,#fff,transparent);animation:sk-tw 4s ease-in-out infinite alternate}@keyframes sk-tw{from{opacity:.25}to{opacity:.8}}`,
  embers: `.skin-motion{${layer};overflow:hidden}.skin-motion::before,.skin-motion::after{content:"";position:absolute;bottom:-10px;width:3px;height:3px;border-radius:50%;background:#ffcf7a;box-shadow:0 0 6px 2px rgba(255,120,40,.8),30vw -20vh 0 0 #ffcf7a,62vw -45vh 0 0 #ffcf7a,85vw -10vh 0 0 #ffcf7a;animation:sk-em 11s linear infinite}.skin-motion::after{left:18vw;animation-delay:5s;animation-duration:13s}@keyframes sk-em{from{transform:translateY(0);opacity:0}10%{opacity:.9}to{transform:translateY(-110vh);opacity:0}}`,
  glow: `.profile-cover .cover-art::after{content:"";position:absolute;right:22%;top:18%;width:22vw;height:22vw;border-radius:50%;background:radial-gradient(rgba(255,246,200,.55),transparent 70%);animation:sk-gl 6s ease-in-out infinite;pointer-events:none}@keyframes sk-gl{50%{transform:scale(1.18);opacity:.7}}`,
  clouds: `.profile-cover .cover-art::after{content:"";position:absolute;inset:auto 0 0 0;height:40%;background:linear-gradient(transparent,rgba(255,255,255,.35));animation:sk-cl 18s ease-in-out infinite alternate;pointer-events:none}@keyframes sk-cl{to{transform:translateX(-3%)}}`,
  // The name is gradient text. Where background-clip:text is unsupported it stays a solid colour that
  // passes contrast; tests/contrast.spec.ts holds the gradient stops to the 3:1 large-text floor.
  shimmer: `html[data-tier] .profile-cover .cover-name{color:#784ba0}@supports (background-clip:text){html[data-tier] .profile-cover .cover-name{background:linear-gradient(90deg,#ff3cac,#784ba0,#2b86c5,#ff3cac);background-size:300% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:sk-sh 4s linear infinite}}@keyframes sk-sh{to{background-position:300% 0}}html[data-tier] body{background:#7fa7d9 repeating-linear-gradient(45deg,#8fb6e6 0 10px,#7fa7d9 10px 20px)}html[data-tier] .site-header{background:#039;--bg:#039;--card:#039;--surface:#039;--ink:#fff;--text:#fff;--interactive:#fff;--muted:#fff;--text-secondary:#fff;--line:#fff;--border:#fff;--signal:#fc0;--focus:#fc0}`,
};
for (const [skin, def] of Object.entries(table)) {
  const vars = Object.entries(def.tokens).map(([k, v]) => `${k}:${v}`).join(';');
  // [data-tier] raises the specificity above the palette's dark blocks (:root:not([data-theme]) and
  // :root[data-theme=dark]), which would otherwise win in a dark device or a pinned dark scheme.
  const css = `/* ${skin}: generated by scripts/build-skins.mjs from scripts/skins/skins.json; do not edit by hand. */\n` +
    // Screen only: on paper every skin prints as Paper (dark skins would print light text on white).
    '@media screen{' +
    `html[data-skin="${skin}"][data-tier]{color-scheme:${def.scheme};${vars};${PALETTE};${SCHEME[def.scheme]}}` +
    (skin === 'profile-2006' ? PROFILE_2006_COVER : cover(skin, def.cover_position)) + MOTION[def.motion] +
    // A wider display face or wider capitals (Courier, Georgia, Arial) would break a word inside a two-up tile on a phone.
    `@media (max-width:640px){html[data-tier] .tile :is(h2,h3){font-size:1.05rem}html[data-tier] .tile-kind{font-size:.7rem;letter-spacing:.02em}}` +
    `@media (prefers-reduced-motion:reduce){.skin-motion,.profile-cover .cover-art::after,.profile-cover .cover-name,.skin-motion::before,.skin-motion::after{animation:none!important}}` + '}';
  writeFileSync(`public/skins/${skin}.css`, css);
}
// The two scripts that link a skin file ask for /skins/<skin>.css?v=<token>; the token is written in place.
for (const f of ['src/scripts/theme-early.js', 'src/scripts/audience.ts']) {
  const src = readFileSync(f, 'utf8');
  const next = src.replace(/(SKIN_V\s*=\s*')[0-9a-f]*(')/, (_, a, b) => `${a}${V}${b}`);
  if (next === src && !src.includes(`'${V}'`)) throw new Error(`${f}: no SKIN_V token to write`);
  if (next !== src) writeFileSync(f, next);
}
console.log(`skins written (version ${V})`);
