import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// The design tokens (vault document 62, F2): every custom property a stylesheet or a component style
// block references must be defined somewhere in src/, because an undefined `var()` makes its
// declaration invalid at computed-value time and the property silently falls back to its initial or
// inherited value; and the values F2 named must not creep back as literals outside tokens.css.

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.(astro|css|tsx?)$/.test(name) ? [path] : [];
  });

/** Every CSS text in src/: whole stylesheets, and the <style> blocks of components and pages. */
function cssTexts(): { file: string; css: string }[] {
  const out: { file: string; css: string }[] = [];
  for (const file of walk('src')) {
    const source = readFileSync(file, 'utf8');
    const rel = file.split('\\').join('/');
    if (file.endsWith('.css')) out.push({ file: rel, css: source });
    for (const m of source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) out.push({ file: rel, css: m[1] });
    // Inline `style={{ '--name': value }}` objects and template literals set custom properties too.
    for (const m of source.matchAll(/(--[a-z][\w-]*)['"]?\s*:/g)) if (!file.endsWith('.css')) out.push({ file: rel, css: `${m[1]}: x;` });
  }
  return out;
}

const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

test.describe('design tokens', () => {
  test('every custom property referenced in src/ is defined in src/', () => {
    const defined = new Set<string>();
    const referenced = new Map<string, Set<string>>();
    for (const { file, css } of cssTexts()) {
      const text = strip(css);
      for (const m of text.matchAll(/(^|[\s{;])(--[a-z][\w-]*)\s*:/gm)) defined.add(m[2]);
      for (const m of text.matchAll(/var\(\s*(--[a-z][\w-]*)/g)) {
        const files = referenced.get(m[1]) ?? new Set<string>();
        files.add(file);
        referenced.set(m[1], files);
      }
    }
    expect(defined.size, 'tokens are defined somewhere').toBeGreaterThan(20);
    const undefinedRefs = [...referenced.entries()].filter(([name]) => !defined.has(name)).map(([name, files]) => `${name} in ${[...files].join(', ')}`);
    expect(undefinedRefs, 'custom properties referenced but never defined').toEqual([]);
  });

  test('the F2 and F3 tokens exist in tokens.css with the decided values', () => {
    const tokens = strip(readFileSync('src/styles/tokens.css', 'utf8'));
    const expected: Record<string, string> = {
      '--space-half': '0.25rem',
      '--space-quarter': '0.125rem',
      '--space-1-5': '0.75rem',
      '--target': '44px',
      '--target-min': '24px',
      '--width-sidebar': '16rem',
      '--width-card-min': '16rem',
      '--width-tile': '12rem',
      '--radius-btn': '8px',
      '--radius-pill': '999px',
      '--radius-photo': '12px',
      '--size-brand': '1.125rem',
      '--size-card': '0.95rem',
      '--size-code': '0.9rem',
      '--tracking-eyebrow': '0.08em',
      '--tracking-button': '0.04em',
      '--tracking-display': '-0.01em',
      '--leading-heading': '1.15',
      '--leading-body': '1.5',
      '--tint-hover': '8%',
      '--tint-active': '16%',
      // F3 (document 63): the faces and the long-form reading treatment.
      '--size-h2': '1.75rem',
      '--size-reading': '1.0625rem',
      '--leading-reading': '1.6',
      '--measure-longform': '39.525rem',
      '--font-display': "'Fraunces', 'Fraunces Fallback', Georgia, 'Times New Roman', serif",
      '--font-body': "'KT Sans', 'KT Sans Fallback', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    };
    for (const [name, value] of Object.entries(expected)) {
      const m = tokens.match(new RegExp(`${name}:\\s*([^;]+);`));
      expect(m?.[1].trim(), name).toBe(value);
    }
  });

  test('the interaction tints and shadows resolve to the literal mixes they replaced', async ({ page }) => {
    await page.goto('/');
    const door = page.getByRole('link', { name: 'ENTER THE LIBRARY' });
    await door.hover();
    // The hover background transitions over --ease (150 ms); read it once the transition has ended.
    await page.waitForTimeout(400);
    const hovered = await door.evaluate((el) => getComputedStyle(el).backgroundColor);
    const expected = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.background = 'color-mix(in srgb, var(--ink) 8%, transparent)';
      document.body.append(probe);
      const value = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return value;
    });
    expect(hovered, 'the hover tint equals the literal 8% mix').toBe(expected);
    const card = page.locator('.card').first();
    await card.hover();
    await page.waitForTimeout(400);
    const shadow = await card.evaluate((el) => getComputedStyle(el).boxShadow);
    const expectedShadow = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.boxShadow = '0 2px 8px color-mix(in srgb, var(--ink) 10%, transparent)';
      document.body.append(probe);
      const value = getComputedStyle(probe).boxShadow;
      probe.remove();
      return value;
    });
    expect(shadow, 'the hovered card shadow equals the literal declaration').toBe(expectedShadow);
  });

  test('the values F2 tokenised do not reappear as literals outside tokens.css', () => {
    // Each entry: the literal as it would appear in a declaration, and the token that owns it now.
    // 16rem is not listed: the search input's and the climb door's flex bases keep it as a literal
    // by the owner's decision (a token owns a meaning, not a number).
    const owned: [RegExp, string][] = [
      [/(?<![\w.-])44px(?![\w-])/, '--target'],
      [/(?<![\w.-])24px(?![\w-])/, '--target-min'],
      [/(?<![\w.-])999px(?![\w-])/, '--radius-pill'],
      [/(?<![\w.-])0\.75rem(?![\w-])/, '--space-1-5'],
      [/(?<![\w.-])0\.25rem(?![\w-])/, '--space-half'],
      [/(?<![\w.-])0\.125rem(?![\w-])/, '--space-quarter'],
      [/(?<![\w.-])0\.5rem(?![\w-])/, '--space-1'],
      [/(?<![\w.-])12rem(?![\w-])/, '--width-tile'],
      [/(?<![\w.-])0\.08em(?![\w-])/, '--tracking-eyebrow'],
    ];
    const offenders: string[] = [];
    for (const { file, css } of cssTexts()) {
      if (file.endsWith('tokens.css') || file.includes('/islands/')) continue;
      const text = strip(css);
      for (const [literal, token] of owned) {
        const m = text.match(literal);
        if (m) offenders.push(`${file}: ${m[0]} (use ${token})`);
      }
    }
    expect(offenders, 'literals that have a token').toEqual([]);
  });
});
