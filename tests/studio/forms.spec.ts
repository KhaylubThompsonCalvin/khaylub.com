// The owner Studio's forms, driven in a real browser against the local Studio the harness starts
// (scripts/studio-harness.mjs; no sign-in exists in local mode). Everything asserted here is
// derived from the field tables in studio/src/fields.ts, which tests/studio-config.spec.ts holds
// equal to the site's schema: the sidebar names every editable collection; each form shows every
// field's label and help text and no deferred field; the status picker offers withdrawn; a Create
// with empty required fields is refused; the Body editor is visible; on a phone viewport no
// required control is hidden and the page never scrolls sideways; and one entry per collection is
// created through the form and lands in the throwaway checkout (validated by the harness after the
// run). Decision D-28: these are the checks the owner used to click through by hand.
import { test, expect, type Page, type Locator } from '@playwright/test';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { collections, GIT_ONLY_COLLECTIONS, BODY_KEY, DURATION_PATTERN, STATUS, type FieldSpec } from '../../studio/src/fields';

const root = process.env.STUDIO_ROOT ?? '';
const label = (key: string) => key.replace(/_/g, ' ');
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const byLabel = (page: Page | Locator, key: string) => page.getByLabel(new RegExp(`^${escapeRe(label(key))}\\*?$`));
// A checkbox's accessible name is its label followed by its help text, so it is found by role.
const control = (page: Page | Locator, key: string, spec: FieldSpec) =>
  spec.kind === 'checkbox' ? page.getByRole('checkbox', { name: new RegExp(`^${escapeRe(label(key))}\\b`) }) : byLabel(page, key);
const editable = Object.entries(collections);

// A 1600 by 1000 PNG for the image fields, made once per run.
let image = '';
test.beforeAll(async () => {
  // Inside the throwaway checkout when the harness runs, so it vanishes with it.
  const dir = root || mkdtempSync(join(tmpdir(), 'khaylub-studio-image-'));
  image = join(dir, 'harness-still.png');
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="1600" height="1000" fill="#1d3557"/><circle cx="1100" cy="380" r="220" fill="#f1faee"/></svg>';
  await sharp(Buffer.from(svg)).png({ palette: true }).toFile(image);
});

// The fields a form renders inline, in order: top-level fields, with an object group's members
// expanded in place (Keystatic renders a group inline under its label). Array-object items live in a
// dialog and are handled separately.
type Flat = { key: string; spec: FieldSpec; nested: boolean };
function flatten(fields: Record<string, FieldSpec>): Flat[] {
  const out: Flat[] = [];
  for (const [key, spec] of Object.entries(fields)) {
    if (spec.kind === 'object') for (const [k, s] of Object.entries(spec.fields)) out.push({ key: k, spec: s, nested: true });
    else out.push({ key, spec, nested: false });
  }
  return out;
}

const sample = (min = 0, max = 240) => {
  const base = 'A sentence written by the Studio harness to exercise this field through the form.';
  let s = base;
  while (s.length < Math.max(min, 1)) s += ' ' + base;
  return s.slice(0, Math.min(max, Math.max(s.length, min)));
};

test.describe('the sidebar', () => {
  test('names every editable collection and none of the Git-only ones', async ({ page }) => {
    await page.goto('/keystatic');
    for (const [, spec] of editable) await expect(page.getByRole('link', { name: spec.label, exact: true }).first()).toBeVisible();
    for (const name of GIT_ONLY_COLLECTIONS) await expect(page.getByRole('link', { name: new RegExp(`^${name}$`, 'i') })).toHaveCount(0);
  });
});

for (const [name, spec] of editable) {
  test.describe(`the ${spec.label} form`, () => {
    test(`shows every field with its help text, no deferred field, and the withdrawn status`, async ({ page }, info) => {
      test.skip(info.project.name === 'mobile', 'the desktop pass covers the text; the mobile pass covers the controls');
      await page.goto(`/keystatic/collection/${name}/create`);
      await expect(page.getByRole('button', { name: 'Create', exact: true })).toBeVisible();
      const text = await page.locator('main, form, body').first().innerText();
      for (const f of flatten(spec.fields)) {
        if (f.spec.kind === 'body') continue;
        if (f.spec.kind !== 'array-object') await expect(control(page, f.key, f.spec).first(), `${name}.${f.key} has a control`).toBeAttached();
        if ('description' in f.spec && f.spec.description) expect(text, `${name}.${f.key} help text`).toContain(f.spec.description);
      }
      for (const [key, f] of Object.entries(spec.fields)) if (f.kind === 'object' && f.description) expect(text, `${name}.${key} group help text`).toContain(f.description);
      for (const key of spec.deferred) await expect(byLabel(page, key), `${name}.${key} is deferred`).toHaveCount(0);
      // The status picker offers every status the schema knows, withdrawn included (Phase 27).
      const status = spec.fields.status as Extract<FieldSpec, { kind: 'select' }>;
      await page.getByRole('button', { name: `${status.defaultValue} status` }).click();
      for (const option of STATUS) await expect(page.getByRole('option', { name: option, exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
      // The Body editor is on the page.
      await expect(page.locator('[contenteditable="true"]').first()).toBeVisible();
    });

    test('refuses a Create with the required fields empty', async ({ page }, info) => {
      test.skip(info.project.name === 'mobile', 'one pass is enough for the refusal');
      await page.goto(`/keystatic/collection/${name}/create`);
      await page.getByRole('button', { name: 'Create', exact: true }).click();
      await page.waitForTimeout(800);
      expect(page.url(), 'still on the create form').toMatch(new RegExp(`/collection/${name}/create$`));
      await expect(page.getByText(/required/i).first()).toBeVisible();
    });

    test('on a phone viewport hides no required control and never scrolls sideways', async ({ page }, info) => {
      test.skip(info.project.name !== 'mobile', 'the phone pass');
      await page.goto(`/keystatic/collection/${name}/create`);
      for (const f of flatten(spec.fields)) {
        if (f.spec.kind === 'body' || !('required' in f.spec) || !f.spec.required) continue;
        if (f.spec.kind === 'array-object') {
          // A required list's control is its Add button (the last Add on the form).
          const adds = page.getByRole('button', { name: 'Add', exact: true });
          const add = adds.nth((await adds.count()) - 1);
          await add.scrollIntoViewIfNeeded();
          await expect(add, `${name}.${f.key} list's Add visible on a phone`).toBeVisible();
          continue;
        }
        if (f.spec.kind === 'image') continue; // the file button is asserted below
        const c = control(page, f.key, f.spec).first();
        await c.scrollIntoViewIfNeeded();
        await expect(c, `${name}.${f.key} visible on a phone`).toBeVisible();
      }
      const chooser = page.getByRole('button', { name: 'Choose file' });
      if ((await chooser.count()) > 0) {
        await chooser.first().scrollIntoViewIfNeeded();
        await expect(chooser.first()).toBeVisible();
      }
      const create = page.getByRole('button', { name: 'Create', exact: true });
      await create.scrollIntoViewIfNeeded();
      await expect(create).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, 'no horizontal overflow').toBeLessThanOrEqual(1);
    });

    test('creates one entry through the form that lands in the throwaway checkout', async ({ page }, info) => {
      test.skip(info.project.name === 'mobile', 'the round trip runs once');
      test.skip(!root, 'STUDIO_ROOT is set by the harness');
      const slug = `harness-${name}`;
      await page.goto(`/keystatic/collection/${name}/create`);
      let imageIndex = 0;
      const seen = new Map<string, number>();
      const nth = (key: string) => {
        const n = seen.get(key) ?? 0;
        seen.set(key, n + 1);
        return n;
      };
      for (const f of flatten(spec.fields)) {
        const s = f.spec;
        const required = 'required' in s && s.required;
        if (s.kind === 'slug') {
          await byLabel(page, 'slug').first().fill(slug);
          continue;
        }
        if (f.key === 'title') {
          await byLabel(page, 'title').first().fill(`Harness ${spec.label}`);
          continue;
        }
        if (s.kind === 'body') {
          const body = page.locator('[contenteditable="true"]').first();
          await body.click();
          await body.type(`Written through the ${spec.label} form by the Studio harness. It links to [[preserving-v1]].`);
          continue;
        }
        if (s.kind === 'array-object') {
          if (!required) continue;
          // The list's own Add opens a dialog with the item's fields.
          const adds = page.getByRole('button', { name: 'Add', exact: true });
          await adds.nth((await adds.count()) - 1).click();
          const dialog = page.getByRole('dialog').first();
          for (const [k, sub] of Object.entries(s.fields)) {
            if (sub.kind === 'image') {
              const [chooser] = await Promise.all([page.waitForEvent('filechooser'), dialog.getByRole('button', { name: 'Choose file' }).first().click()]);
              await chooser.setFiles(image);
            } else if (sub.kind === 'text' && 'required' in sub && sub.required) await dialog.getByRole('textbox', { name: new RegExp(`^${escapeRe(label(k))}\\*?$`) }).fill(sample(sub.min, sub.max));
          }
          await dialog.getByRole('button', { name: 'Add', exact: true }).click();
          await expect(dialog).toBeHidden();
          continue;
        }
        const i = nth(f.key);
        const isTopLevelImage = s.kind === 'image' && !f.nested;
        if (s.kind === 'image') {
          // A media entry needs its poster; an optional cover is left empty (validate would then ask
          // for the alt text and the credits, which the required provenance group supplies anyway).
          if (isTopLevelImage) {
            if (required) {
              const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Choose file' }).nth(imageIndex).click()]);
              await chooser.setFiles(image);
            }
            imageIndex += 1;
          }
          continue;
        }
        if (!required && !(name === 'music' && f.key === 'external_url') && !(name === 'video' && f.key === 'external_url')) continue;
        const field = byLabel(page, f.key).nth(i);
        if (s.kind === 'text') await field.fill(s.pattern === DURATION_PATTERN ? '3:42' : sample(s.min, s.max));
        else if (s.kind === 'url') await field.fill('https://example.com/the-piece');
        else if (s.kind === 'date') await field.fill('2026-09-18');
        else if (s.kind === 'integer') await field.fill(String(s.min ?? 1));
        else if (s.kind === 'multiselect') await page.getByRole('group', { name: f.key }).getByRole('checkbox').first().check();
        else if (s.kind === 'checkbox') {
          /* the default stands */
        } else if (s.kind === 'select') {
          /* the default stands */
        } else if (s.kind === 'array-text') {
          /* optional lists stay empty */
        }
      }
      await page.getByRole('button', { name: 'Create', exact: true }).click();
      await page.waitForURL(new RegExp(`/collection/${name}/item/${slug}$`), { timeout: 60_000 });
      const file = spec.layout === 'folder' ? join(root, 'content', name, slug, 'index.md') : join(root, 'content', name, `${slug}.md`);
      expect(existsSync(file), `${file.replace(root, '<checkout>')} written`).toBe(true);
    });
  });
}

test.describe('the Video form', () => {
  test('says plainly that the image it asks for is the poster, not the video', async ({ page }, info) => {
    test.skip(info.project.name === 'mobile');
    await page.goto('/keystatic/collection/video/create');
    const poster = collections.video.fields.poster as Extract<FieldSpec, { kind: 'image' }>;
    await expect(page.getByText(poster.description!, { exact: true })).toBeVisible();
    expect(collections.video.description).toContain('poster');
  });
});
