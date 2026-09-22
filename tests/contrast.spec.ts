import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// The colour floors of the design initiative (F3 decision 6, F4 document 64; D-31, D-32), asserted
// from the tokens themselves in both palettes: text at 4.5:1 or better, the focus ring and the
// accent as a boundary at 3:1 or better, and the colours outside CSS (the theme-color metas and
// the Open Graph constants) equal to the tokens. WCAG 2.2 relative luminance.

const tokens = readFileSync('src/styles/tokens.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const block = (start: string) => {
  const i = tokens.indexOf(start);
  expect(i, `${start} present`).toBeGreaterThan(-1);
  return tokens.slice(i, tokens.indexOf('}', i));
};
const read = (css: string, name: string) => {
  const m = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6});`));
  expect(m, `${name} in the block`).not.toBeNull();
  return m![1].toLowerCase();
};
const light = block(':root {');
const dark = block(":root[data-theme='dark']");
const darkMedia = block(":root:not([data-theme='light'])");
const names = ['bg', 'card', 'ink', 'muted', 'accent', 'focus', 'notice'] as const;
const palette = (css: string) => Object.fromEntries(names.map((n) => [n, read(css, `--${n}`)])) as Record<(typeof names)[number], string>;
const L = palette(light);
const D = palette(dark);

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

test.describe('colour contrast (the F3 and F4 floors)', () => {
  for (const [scheme, P] of [['light', L], ['dark', D]] as const) {
    test(`${scheme}: text at 4.5:1, the focus ring and the accent boundary at 3:1`, () => {
      for (const ground of ['bg', 'card'] as const) {
        expect(ratio(P.ink, P[ground]), `ink on ${ground}`).toBeGreaterThanOrEqual(4.5);
        expect(ratio(P.muted, P[ground]), `muted on ${ground}`).toBeGreaterThanOrEqual(4.5);
        expect(ratio(P.accent, P[ground]), `the accent as text on ${ground}`).toBeGreaterThanOrEqual(4.5);
        expect(ratio(P.notice, P[ground]), `the notice as text on ${ground}`).toBeGreaterThanOrEqual(4.5);
        expect(ratio(P.focus, P[ground]), `the focus ring on ${ground}`).toBeGreaterThanOrEqual(3);
      }
      // The primary door: the page colour as a label on the ink.
      expect(ratio(P.bg, P.ink), 'the primary door label').toBeGreaterThanOrEqual(4.5);
      // The focus ring stays a different hue from the accent (the roles are separate).
      expect(P.focus).not.toBe(P.accent);
    });
  }

  test('the two dark blocks carry the same values', () => {
    for (const n of names) expect(read(darkMedia, `--${n}`), `--${n}`).toBe(D[n]);
  });

  test('the theme-color metas and the Open Graph constants equal the tokens', () => {
    const layout = readFileSync('src/layouts/BaseLayout.astro', 'utf8');
    expect(layout).toMatch(new RegExp(`media="\\(prefers-color-scheme: light\\)" content="${L.bg}"`));
    expect(layout).toMatch(new RegExp(`media="\\(prefers-color-scheme: dark\\)" content="${D.bg}"`));
    const theme = readFileSync('src/scripts/theme.ts', 'utf8');
    expect(theme).toContain(`'${L.bg}'`);
    expect(theme).toContain(`'${D.bg}'`);
    const og = readFileSync('src/lib/og.ts', 'utf8');
    expect(og).toContain(`BG = '${L.bg}'`);
    expect(og).toContain(`INK = '${L.ink}'`);
    expect(og).toContain(`MUTED = '${L.muted}'`);
    expect(og).toContain(`ACCENT = '${L.accent}'`);
  });

  test('the semantic roles keep their boundaries', () => {
    for (const [alias, target] of [['--interactive', 'var(--ink)'], ['--link-content', 'var(--accent)'], ['--signal', 'var(--accent)'], ['--surface', 'var(--card)'], ['--text', 'var(--ink)'], ['--text-secondary', 'var(--muted)'], ['--border', 'var(--line)']]) {
      const m = light.match(new RegExp(`${alias}:\\s*([^;]+);`));
      expect(m?.[1].trim(), alias).toBe(target);
    }
  });
});
