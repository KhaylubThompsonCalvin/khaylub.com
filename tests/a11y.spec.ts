import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { TEMPLATES } from './helpers';

// Every violation at every impact fails (CLAUDE.md: "axe reports zero violations"); the dark palette
// is checked too, once per page, in the desktop project.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
const describe = (violations: { id: string; impact?: string | null; nodes: { target: unknown[] }[] }[]) => JSON.stringify(violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target) })), null, 2);

for (const path of [...TEMPLATES, '/404-does-not-exist/']) {
  test(`axe: zero violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    expect(results.violations, describe(results.violations)).toEqual([]);
  });

  test(`axe: zero violations on ${path} in the dark palette`, async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the palette does not depend on the viewport; run once');
    const ctx = await browser.newContext({ colorScheme: 'dark', viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    expect(results.violations, describe(results.violations)).toEqual([]);
    await ctx.close();
  });
}
