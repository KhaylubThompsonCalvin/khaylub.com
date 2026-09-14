import { test, expect } from '@playwright/test';
import { TEMPLATES } from './helpers';

// The manual accessibility checklist's objective half (vault document 05 section 25), run on every
// template on every commit: the keyboard walk (2.1.1, 2.4.1, 2.4.3), a visible focus indicator that
// the sticky header never covers (2.4.7, 2.4.11), consistent navigation and help (3.2.3, 3.2.4,
// 3.2.6), no motion under reduced motion (2.3.3, 2.2.2), text spacing without clipping (1.4.12),
// and the token contrast in both schemes (1.4.3, 1.4.11). The subjective half (reading sense,
// the screen-reader pass) is the manual checklist in the phase checkpoint.

const NAV = ['Work', 'Projects', 'Data', 'Field Notes', 'Library', 'About', 'Contact', 'Résumé', 'Search'];
const FOCUSABLE = 'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';
// WCAG 1.4.12 text spacing, as the common bookmarklet applies it.
const SPACING = 'body, body * { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }';

test.describe('keyboard and focus', () => {
  for (const path of TEMPLATES) {
    test(`${path}: skip link first, every focusable element shows focus and is never under the header`, async ({ page }) => {
      await page.goto(path);
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toHaveText('Skip to main content');
      // A real Tab walk through the whole page: every stop shows an indicator and is not covered by
      // the sticky header; the walk ends when focus leaves the document (no trap) or the budget of
      // presses is spent (a trap would spin on the same few elements).
      const budget = (await page.locator(FOCUSABLE).count()) + 10;
      const stops: { text: string; noRing: boolean; covered: boolean }[] = [];
      const seen = new Set<string>();
      for (let i = 0; i < budget; i++) {
        const stop = await page.evaluate((i) => {
          const e = document.activeElement as HTMLElement | null;
          if (!e || e === document.body) return null;
          const cs = getComputedStyle(e);
          const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none';
          const headerEl = document.querySelector('header.site-header') as HTMLElement;
          const header = headerEl.getBoundingClientRect();
          const r = e.getBoundingClientRect();
          const stuck = getComputedStyle(headerEl).position === 'sticky';
          // Overlays (the skip link is fixed above the header when focused) are not under it.
          const overlay = cs.position === 'fixed' || cs.position === 'absolute';
          const underHeader = stuck && !overlay && !headerEl.contains(e) && r.top < header.bottom && r.bottom > header.top && r.top >= 0;
          const key = `${e.tagName}:${(e as HTMLAnchorElement).href ?? ''}:${e.textContent?.trim().slice(0, 30)}:${i}`;
          return { key, text: (e.textContent ?? e.getAttribute('aria-label') ?? e.tagName).trim().slice(0, 40), noRing: !ring, covered: underHeader };
        }, i);
        if (!stop) break;
        stops.push(stop);
        seen.add(stop.key.replace(/:\d+$/, ''));
        await page.keyboard.press('Tab');
      }
      expect(seen.size, 'the walk reaches more than the skip link and the nav').toBeGreaterThan(5);
      expect(stops.filter((s) => s.noRing).map((s) => s.text), 'focus indicator on every stop').toEqual([]);
      expect(stops.filter((s) => s.covered).map((s) => s.text), 'no focused element under the sticky header').toEqual([]);
    });
  }
});

test.describe('consistent navigation and help', () => {
  for (const path of TEMPLATES) {
    test(`${path}: the primary nav reads the same and the footer offers Contact`, async ({ page }) => {
      await page.goto(path);
      const labels = await page.locator('nav[aria-label="Primary"] a').evaluateAll((as) => as.map((a) => a.textContent?.trim()));
      expect(labels).toEqual(NAV);
      await expect(page.locator('footer a[href="mailto:khaylubthompsoncalvin@gmail.com"], footer a[href="/contact/"]').first()).toHaveCount(1);
      await expect(page.locator('a.skip-link[href="#main"]')).toHaveCount(1);
    });
  }
});

test.describe('reduced motion and text spacing', () => {
  test('under reduced motion nothing animates and nothing autoplays, on every template', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    for (const path of TEMPLATES) {
      await page.goto(path);
      await page.waitForTimeout(150);
      expect(await page.evaluate(() => document.getAnimations().length), `${path}: running animations`).toBe(0);
      expect(await page.locator('video[autoplay], audio[autoplay]').count(), `${path}: autoplay`).toBe(0);
    }
    await ctx.close();
  });

  for (const path of TEMPLATES) {
    test(`${path}: WCAG text spacing clips nothing and adds no horizontal scroll`, async ({ page }) => {
      await page.goto(path);
      await page.addStyleTag({ content: SPACING });
      await page.waitForTimeout(100);
      const [scrollWidth, inner] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
      expect(scrollWidth, 'no horizontal scroll with spacing applied').toBeLessThanOrEqual(inner);
      // Text clipped by a box that hides overflow (fixed-height labels, badges, buttons).
      const clipped = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('main *, header *, footer *')]
          .filter((e) => e.children.length === 0 && (e.textContent ?? '').trim().length > 0)
          // Screen-reader-only text lives in a 1 px clipped box by design; it is not visual text.
          .filter((e) => !e.closest('.visually-hidden'))
          .filter((e) => {
            let n: HTMLElement | null = e;
            while (n && n !== document.body) {
              const cs = getComputedStyle(n);
              if ((cs.overflow === 'hidden' || cs.overflowY === 'hidden' || cs.overflowX === 'hidden') && (n.scrollHeight > n.clientHeight + 1 || n.scrollWidth > n.clientWidth + 1)) return true;
              n = n.parentElement;
            }
            return false;
          })
          .map((e) => (e.textContent ?? '').trim().slice(0, 40))
      );
      expect(clipped, 'no text clipped with WCAG spacing').toEqual([]);
    });
  }
});

test.describe('token contrast in both schemes', () => {
  // Ratios computed from the tokens the built page actually resolves (light, then dark): text at
  // least 4.5:1 on its surfaces, the focus ring and the search field boundary at least 3:1.
  const lum = (rgb: string) => {
    const m = rgb.match(/\d+(\.\d+)?/g)!.slice(0, 3).map(Number);
    const [r, g, b] = m.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a: string, b: string) => {
    const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };
  for (const scheme of ['light', 'dark'] as const) {
    test(`${scheme}: ink and muted on bg and card at 4.5:1; focus ring and search boundary at 3:1`, async ({ browser }) => {
      const ctx = await browser.newContext({ colorScheme: scheme, viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      await page.goto('/search/');
      const c = await page.evaluate(() => {
        const probe = (v: string) => {
          const el = document.createElement('div');
          el.style.color = `var(${v})`;
          document.body.appendChild(el);
          const out = getComputedStyle(el).color;
          el.remove();
          return out;
        };
        const input = document.querySelector('input[type="search"]')!;
        return { bg: probe('--bg'), ink: probe('--ink'), muted: probe('--muted'), card: probe('--card'), focus: probe('--focus'), inputBorder: getComputedStyle(input).borderTopColor, inputBg: getComputedStyle(input).backgroundColor };
      });
      expect(ratio(c.ink, c.bg)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(c.muted, c.bg)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(c.ink, c.card)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(c.muted, c.card)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(c.focus, c.bg)).toBeGreaterThanOrEqual(3);
      expect(ratio(c.focus, c.card)).toBeGreaterThanOrEqual(3);
      expect(ratio(c.inputBorder, c.inputBg), 'the search field boundary (1.4.11)').toBeGreaterThanOrEqual(3);
      await ctx.close();
    });
  }
});
