// The Studio authoring driver (Phase 28, decision D-28): fills one collection's form in the local
// Studio from an approved package and nothing else, or sets an existing entry's status. Run by
// scripts/studio-author.mjs (which owns the worktree, the server, the commit, and the push), never
// by the main suite. Every control is found through the field tables in studio/src/fields.ts, so a
// package key the table does not know is refused, a required field the package leaves empty is
// reported as the Studio's own validation error, and nothing is invented. It also proves what the
// owner would look at: the filled form and the created entry captured at desktop and phone widths,
// the Body editor visible, no sideways scroll.
//   STUDIO_PACKAGE   the approved package (JSON): { collection, slug, mode?, fields, body, screenshots? }
//   STUDIO_BASE      the local Studio (no sign-in exists in local mode)
//   STUDIO_ROOT      the worktree the Studio writes into
import { test, expect, type Page, type Locator } from '@playwright/test';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'js-yaml';
import { collections, DURATION_PATTERN, type FieldSpec } from '../../studio/src/fields';

const pkgFile = process.env.STUDIO_PACKAGE ?? '';
const root = process.env.STUDIO_ROOT ?? '';
const pkg = pkgFile ? JSON.parse(readFileSync(pkgFile, 'utf8')) : null;
const shots = pkg?.screenshots ? String(pkg.screenshots) : '';
const label = (key: string) => key.replace(/_/g, ' ');
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const byLabel = (page: Page | Locator, key: string) => page.getByLabel(new RegExp(`^${escapeRe(label(key))}\\*?$`));
const vocabLabel = (group: string, slug: string): string => {
  const file = join('content', 'vocabulary', `${group}.yaml`);
  const terms = (existsSync(file) ? ((load(readFileSync(file, 'utf8')) as { terms?: { slug: string; label: string }[] }).terms ?? []) : []) as { slug: string; label: string }[];
  const t = terms.find((x) => x.slug === slug);
  if (!t) throw new Error(`${group}: "${slug}" is not in the vocabulary`);
  return t.label;
};

test.describe('the Studio authoring driver', () => {
  test.skip(!pkg || !root, 'STUDIO_PACKAGE and STUDIO_ROOT come from scripts/studio-author.mjs');

  test('fills the form from the approved package and creates the entry, or sets its status', async ({ page }) => {
    const spec = collections[pkg.collection];
    expect(spec, `the collection ${pkg.collection} is one the Studio edits`).toBeTruthy();
    if (shots) mkdirSync(shots, { recursive: true });
    const shot = async (name: string) => {
      if (!shots) return;
      await page.screenshot({ path: join(shots, `${pkg.slug}-${name}-desktop.png`), fullPage: true });
      const vp = page.viewportSize()!;
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(300);
      await page.screenshot({ path: join(shots, `${pkg.slug}-${name}-mobile.png`), fullPage: true });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${name}: no horizontal overflow on a phone`).toBeLessThanOrEqual(1);
      await page.setViewportSize(vp);
    };

    if (pkg.mode === 'publish') {
      await page.goto(`/keystatic/collection/${pkg.collection}/item/${pkg.slug}`, { waitUntil: 'networkidle', timeout: 120_000 });
      const current = (await page.getByRole('button', { name: /status$/ }).first().textContent())?.trim() ?? 'draft';
      await page.getByRole('button', { name: `${current} status` }).click();
      await page.getByRole('option', { name: 'published', exact: true }).click();
      await shot('publish');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await page.waitForTimeout(2000);
      const file = spec.layout === 'folder' ? join(root, 'content', pkg.collection, pkg.slug, 'index.md') : join(root, 'content', pkg.collection, `${pkg.slug}.md`);
      expect(readFileSync(file, 'utf8'), 'the Studio wrote status: published').toMatch(/^status:\s*published\s*$/m);
      return;
    }

    await page.goto(`/keystatic/collection/${pkg.collection}/create`, { waitUntil: 'networkidle', timeout: 120_000 });
    await expect(page.locator('[contenteditable="true"]').first(), 'the Body editor is visible').toBeVisible();
    const fields = pkg.fields ?? {};
    for (const key of Object.keys(fields)) expect(spec.fields[key], `${pkg.collection} has a field named ${key}`).toBeTruthy();
    let imageIndex = 0;
    const seen = new Map<string, number>();
    const nth = (key: string) => {
      const n = seen.get(key) ?? 0;
      seen.set(key, n + 1);
      return n;
    };
    const listKeys = Object.entries(spec.fields).filter(([, f]) => f.kind === 'array-text' || f.kind === 'array-object').map(([k]) => k);
    const addIndex = (key: string) => listKeys.indexOf(key);
    const fillOne = async (scope: Page | Locator, key: string, s: FieldSpec, value: unknown, nested: boolean) => {
      // Labels repeat between a top-level field and a group member (source, license, date), so the
      // n-th control is counted whether or not this one is filled.
      const i = nth(key);
      void nested;
      if (value === undefined || value === null || value === '') return;
      if (s.kind === 'text' || s.kind === 'url' || s.kind === 'integer') {
        if (s.kind === 'text' && s.pattern === DURATION_PATTERN) expect(String(value)).toMatch(/^\d+:\d{2}$/);
        await byLabel(scope, key).nth(i).fill(String(value));
      } else if (s.kind === 'date') await byLabel(scope, key).nth(i).fill(String(value));
      else if (s.kind === 'select') {
        expect(s.options, `${key}: "${value}" is an option`).toContain(value);
        await page.getByRole('button', { name: `${s.defaultValue} ${label(key)}` }).click();
        await page.getByRole('option', { name: String(value), exact: true }).click();
      } else if (s.kind === 'checkbox') {
        const box = page.getByRole('checkbox', { name: new RegExp(`^${escapeRe(label(key))}\\b`) });
        if (value) await box.check();
        else await box.uncheck();
      } else if (s.kind === 'multiselect') {
        const g = page.getByRole('group', { name: key });
        for (const slug of value as string[]) await g.getByRole('checkbox', { name: new RegExp(`^${escapeRe(vocabLabel(s.vocabulary, slug))}$`) }).check();
      } else if (s.kind === 'array-text') {
        for (const item of value as string[]) {
          // The Add buttons follow the lists' order on the form: this list's is the n-th, n being the
          // number of lists the table declares before it.
          await page.getByRole('button', { name: 'Add', exact: true }).nth(addIndex(key)).click();
          const dialog = page.getByRole('dialog').first();
          await dialog.getByRole('textbox').first().fill(item);
          await dialog.getByRole('button', { name: 'Add', exact: true }).click();
          await expect(dialog).toBeHidden();
        }
      }
    };
    for (const [key, s] of Object.entries(spec.fields)) {
      const value = fields[key];
      if (s.kind === 'slug') {
        await byLabel(page, 'slug').first().fill(pkg.slug);
        continue;
      }
      if (s.kind === 'body') continue;
      if (s.kind === 'image') {
        if (value && typeof value === 'object' && (value as { file?: string }).file) {
          const file = (value as { file: string }).file;
          expect(existsSync(file), `${key}: the image file exists`).toBe(true);
          const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Choose file' }).nth(imageIndex).click()]);
          await chooser.setFiles(file);
        }
        imageIndex += 1;
        continue;
      }
      if (s.kind === 'object') {
        const group = (value ?? {}) as Record<string, unknown>;
        for (const [k, sub] of Object.entries(s.fields)) await fillOne(page, k, sub, group[k], true);
        continue;
      }
      if (s.kind === 'array-object') {
        for (const item of ((value ?? []) as Record<string, unknown>[])) {
          await page.getByRole('button', { name: 'Add', exact: true }).nth(addIndex(key)).click();
          const dialog = page.getByRole('dialog').first();
          for (const [k, sub] of Object.entries(s.fields)) {
            const v = item[k];
            if (v === undefined || v === null || v === '') continue;
            if (sub.kind === 'image') {
              const [chooser] = await Promise.all([page.waitForEvent('filechooser'), dialog.getByRole('button', { name: 'Choose file' }).first().click()]);
              await chooser.setFiles(String(v));
            } else await dialog.getByRole('textbox', { name: new RegExp(`^${escapeRe(label(k))}\\*?$`) }).fill(String(v));
          }
          await dialog.getByRole('button', { name: 'Add', exact: true }).click();
          await expect(dialog).toBeHidden();
        }
        continue;
      }
      await fillOne(page, key, s, value, false);
    }
    // The first paragraph goes through the editor (the whole approved body is written by the script).
    const firstParagraph = String(pkg.body ?? '').trim().split(/\n\s*\n/).find((p: string) => !p.startsWith('#')) ?? '';
    if (firstParagraph) {
      const body = page.locator('[contenteditable="true"]').first();
      await body.click();
      await body.type(firstParagraph.slice(0, 400));
    }
    await shot('form');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    // Created, or refused with the Studio's own validation messages.
    const created = await page.waitForURL(new RegExp(`/collection/${pkg.collection}/item/${pkg.slug}$`), { timeout: 30_000 }).then(() => true).catch(() => false);
    if (!created) {
      const messages = await page.getByText(/required|invalid|must|at least|too long|too short/i).allTextContents();
      throw new Error(`the Studio refused the entry: ${[...new Set(messages)].join(' | ') || 'no message shown'}`);
    }
    await page.waitForTimeout(1000);
    await shot('entry');
    const file = spec.layout === 'folder' ? join(root, 'content', pkg.collection, pkg.slug, 'index.md') : join(root, 'content', pkg.collection, `${pkg.slug}.md`);
    expect(existsSync(file), 'the entry was written into the worktree').toBe(true);
  });
});
