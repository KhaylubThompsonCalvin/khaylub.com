# Khaylub.com V2

The second version of khaylub.com: a static profile and public library built with Astro, with the
original 3D climb kept as an opt-in cinematic island.

This repository holds V2 only. Version 1 lives in `khaylub-portfolio`, frozen at tag
`v1.0.0-3d-experiment`, and is never modified from here.

## Rules that hold in every branch

- Production khaylub.com is not touched until the rehearsed cutover phase.
- No Render service, DNS, or hosting setting is created or changed from this repository before the
  owner approves it. `render.yaml` is committed as configuration only.
- No credentials are read, stored, or committed. `.env*` files are ignored and scanned for.
- Public content only. Private systems, finances, school records, health, family, and client
  internals never enter `content/`. See `CONTENT.md`.
- No em dashes in public copy. AI is never listed as a skill.

## Run

```
npm ci
npm run check           # TypeScript and content schemas
npm run validate        # boundary, em dashes, paths, provenance, featured set, redirects
npm run build           # static site into dist/
npm run serve:headers   # dist/ with the render.yaml headers on http://localhost:4173
npm test                # Playwright suites against that server (starts it if needed)
npm run lhci            # Lighthouse budgets
```

`npm run build:preview` builds with drafts visible, a preview banner, `noindex`, and a robots file
that disallows crawling.

## Layout

```
content/     Markdown and YAML: the only place public content lives
src/
  content.config.ts   typed collections
  content/schemas.ts  strict Zod schemas shared with the validation scripts
  lib/                catalog (public/private filter, featured, evidence), profile, seo
  layouts/            BaseLayout: skip link, header, nav, main, footer
  components/         header, nav, footer, identity card, doors, climb door, cards, badges
  islands/            the climb (React, loaded only after the door is pressed)
  pages/              routes, including robots.txt and .well-known/security.txt
scripts/     validation, the invalid-fixture build check, the header server
tests/       Playwright specs (desktop, tablet, mobile projects)
render.yaml  headers, cache tiers, redirects (file only until the owner approves a service)
```

## Where the plan lives

The planning package (documents 00 to 32) lives in the owner's knowledge base. This code follows
document 32, the Phase 9 implementation plan, commit by commit.

## License

Code: MIT (see `LICENSE`). Content under `content/` and media under `public/`: all rights reserved
unless a file's provenance record says otherwise.
