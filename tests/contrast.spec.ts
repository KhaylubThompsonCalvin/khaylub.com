import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';

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

// The skins (Profile Themes): the same floors in every skin, from the token table and from the
// rendered page. Text at 4.5:1, the border as a boundary at 3:1, on the surface and the raised surface.
const skinTable = JSON.parse(readFileSync('scripts/skins/skins.json', 'utf8')) as Record<string, { tokens: Record<string, string> }>;
const rgba = (v: string): [number, number, number, number] => {
  if (v.startsWith('#')) return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16), 1];
  const m = v.match(/rgba?\(([^)]+)\)/)!;
  const p = m[1].split(',').map(Number);
  return [p[0], p[1], p[2], p[3] ?? 1];
};
const over = (fg: string, bg: string) => {
  const [r, g, b, a] = rgba(fg);
  const B = rgba(bg);
  return '#' + [r, g, b].map((c, i) => Math.round(c * a + B[i] * (1 - a)).toString(16).padStart(2, '0')).join('');
};
const AUDIENCE_SKIN: Record<string, string> = { tech: 'desert-night', creative: 'arizona-made', exploring: 'golden-hour', youtube: 'above-the-clouds', nostalgia: 'profile-2006' };

test.describe('colour contrast in every skin', () => {
  for (const [audience, skin] of Object.entries(AUDIENCE_SKIN)) {
    test(`${skin}: the token floors hold`, () => {
      const t = skinTable[skin].tokens;
      for (const ground of ['--surface', '--surface-raised']) {
        const g = over(t[ground], t['--surface']);
        for (const fg of ['--text', '--text-secondary', '--link-content', '--signal', '--interactive']) expect(ratio(t[fg], g), `${fg} on ${ground}`).toBeGreaterThanOrEqual(4.5);
        expect(ratio(t['--border'], g), `--border on ${ground}`).toBeGreaterThanOrEqual(3);
        expect(ratio(t['--line'], g), `--line on ${ground}`).toBeGreaterThanOrEqual(3);
      }
    });

    test(`${skin}: the rendered page has no contrast violation`, async ({ page }) => {
      await page.addInitScript((v) => localStorage.setItem('khaylub-audience', v), audience);
      for (const path of ['/', '/work/', '/about/']) {
        await page.goto(path);
        await page.waitForFunction(() => !document.documentElement.classList.contains('skin-wait'));
        expect(await page.locator('link#skin-css').count(), skin).toBe(1);
        const results = await new AxeBuilder({ page }).withRules(['color-contrast']).exclude('.cover-name').analyze();
        expect(JSON.stringify(results.violations.map((v) => v.nodes.map((n) => n.target))), `${skin} ${path}`).toBe('[]');
      }
    });
  }

  test('profile-2006: the header links read on the header colour (rendered), on desktop and phone', async ({ browser }) => {
    for (const width of [1440, 390]) {
      const ctx = await browser.newContext({ viewport: { width, height: 844 } });
      const page = await ctx.newPage();
      await page.addInitScript((v) => localStorage.setItem('khaylub-audience', v), 'nostalgia');
      await page.goto('/work/');
      await page.waitForFunction(() => !document.documentElement.classList.contains('skin-wait'));
      const [fg, bg] = await page.evaluate(() => {
        const hex = (c: string) => '#' + (c.match(/\d+/g) ?? []).slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('');
        return [hex(getComputedStyle(document.querySelector('.site-header .brand')!).color), hex(getComputedStyle(document.querySelector('.site-header')!).backgroundColor)];
      });
      expect(ratio(fg, bg), `brand on header at ${width}`).toBeGreaterThanOrEqual(4.5);
      if (width === 390) {
        await page.locator('.menu-btn').click();
        const [lf, lb] = await page.evaluate(() => {
          const hex = (c: string) => '#' + (c.match(/\d+/g) ?? []).slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('');
          const a = document.querySelector('.site-header nav a:not(.brand)') as HTMLElement;
          let e: HTMLElement | null = a;
          while (e && /rgba\(.*, 0\)|transparent/.test(getComputedStyle(e).backgroundColor)) e = e.parentElement;
          return [hex(getComputedStyle(a).color), hex(getComputedStyle(e!).backgroundColor)];
        });
        expect(ratio(lf, lb), 'a menu link on the open panel').toBeGreaterThanOrEqual(4.5);
      }
      await ctx.close();
    }
  });

  // The shimmer name is gradient text over transparent colour, which no computed-colour check can read.
  // So it is excluded from the rendered floor above and held here instead: the stylesheet clips the
  // gradient to the text, the fallback colour is solid and passes where clipping is unsupported, and
  // every gradient stop reaches the 3:1 large-text floor on the white surface.
  test('profile-2006: the shimmer name is clipped gradient text with a solid fallback and 3:1 stops', () => {
    const css = readFileSync('public/skins/profile-2006.css', 'utf8');
    expect(css).toMatch(/@supports \(background-clip:text\)\{[^}]*\.cover-name\{[^}]*background-clip:text/);
    expect(css).toMatch(/\.cover-name\{color:#[0-9a-f]{6}\}/);
    const stops = css.match(/linear-gradient\(90deg,([^)]+)\)/)![1].split(',');
    for (const stop of stops) expect(ratio(stop, '#ffffff'), stop).toBeGreaterThanOrEqual(3);
  });
});
