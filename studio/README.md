# Khaylub.com Studio

The owner's private publishing Studio (ADR-012): Keystatic on a small Astro app with the Node
adapter, separate from the public site. It edits the repository's Markdown through forms and
publishes only through the existing branch, pull request, checks, and merge path.

- `keystatic.config.ts`: every collection, built from the field tables in `src/fields.ts`.
- `src/fields.ts`: one field table per collection the Studio edits (notes, writing, journal,
  projects, music, video, gallery), each held equal to `src/content/schemas.ts` by the public site's
  `tests/studio-config.spec.ts`; `data` and `experiments` stay Git-only (ADR-012).
- `src/rules.ts`: the editor's text rule (no em dash) on every free-text field.
- `scripts/vocabulary.mjs`: regenerates `src/vocabulary.generated.json` from `content/vocabulary/`.
- Local mode: `npm run dev` here starts the admin at `http://127.0.0.1:4322/keystatic` against the
  repository root, so entries land under `content/<collection>/` in the checkout.
- Cloud or GitHub mode and the Render service: `render.yaml` at the repository root and the runbook.

No secret lives in this folder. The public site's build, headers, budgets, and tests never read it.
