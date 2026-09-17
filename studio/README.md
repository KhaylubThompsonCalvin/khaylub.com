# Khaylub.com Studio

The owner's private publishing Studio (ADR-012): Keystatic on a small Astro app with the Node
adapter, separate from the public site. It edits the repository's Markdown through forms and
publishes only through the existing branch, pull request, checks, and merge path.

- `keystatic.config.ts`: the collections; in Phase 24 only `notes`, built from `src/notes-fields.ts`.
- `src/notes-fields.ts`: the field table the public site's `tests/studio-config.spec.ts` holds equal
  to `src/content/schemas.ts`.
- `scripts/vocabulary.mjs`: regenerates `src/vocabulary.generated.json` from `content/vocabulary/`.
- Local mode: `npm run dev` here starts the admin at `http://127.0.0.1:4322/keystatic` with the
  repository root as the working directory, so entries land in `content/notes/`.
- Cloud or GitHub mode and the Render service: `render.yaml` at the repository root and the runbook.

No secret lives in this folder. The public site's build, headers, budgets, and tests never read it.
