// The skin version token (Profile Themes final review): a short content hash over everything a skin
// file and its covers are made of. scripts/build-skins.mjs writes it into the skin CSS (each cover URL)
// and into the two scripts that link a skin (theme-early.js and audience.ts), so a changed skin or cover
// is a new URL and render.yaml can cache /skins/* for a year. Text inputs are hashed with LF line endings
// so a Windows checkout and the Linux build agree.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';

export function skinVersion() {
  const h = createHash('sha256');
  for (const f of ['scripts/skins/skins.json', 'scripts/build-skins.mjs']) h.update(f).update(readFileSync(f, 'utf8').replace(/\r\n/g, '\n'));
  for (const dir of readdirSync('public/skins').sort()) {
    const p = `public/skins/${dir}`;
    if (!statSync(p).isDirectory()) continue;
    for (const f of readdirSync(p).sort()) h.update(`${p}/${f}`).update(readFileSync(`${p}/${f}`));
  }
  return h.digest('hex').slice(0, 10);
}
