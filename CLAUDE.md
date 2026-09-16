# CLAUDE.md - Khaylub.com V2

Read this first in any session launched from this repository. It is the operating contract for
Claude Code here. The planning record lives in the owner's Obsidian vault (see "Phases and the
vault"); when a session is launched from the vault, the vault's own CLAUDE.md applies as well.

## What this is

Khaylub.com V2 is the second version of the owner's public site: a one-scroll profile (identity
card, recruiter row, two doors, Now, Top 8, interests) in front of a public library of software,
data, writing, media, and notes, with a plain employer lane (Home, Work, About, Now, Resume,
Contact). The employer lane is the fast path: a hiring manager must understand who the owner is
and see proof within two minutes on a phone.

V1 (the 3D climb) lives in the separate repository `khaylub-portfolio`, frozen at tag
`v1.0.0-3d-experiment`. It is read-only from here and returns only as the opt-in island (`/climb/`).

## Architecture

- Astro 7, static output, TypeScript strict, React only for islands.
- Content is files under `content/`, validated by strict Zod schemas (`src/content/schemas.ts`);
  unknown keys fail the build. Authoring rules: `CONTENT.md`.
- No runtime backend. No third-party requests (`budget.json` allows zero). No inline scripts or
  styles; `astro.config.mjs` keeps CSS external so the Content Security Policy stays strict.
- Production target is a Render static site described by `render.yaml` (headers, cache tiers,
  redirects). Two Render static sites are declared there and created by the Blueprint sync: `khaylub-com`
  (production, created at Phase 21, never deployed with the preview build) and `khaylub-com-v2` (staging,
  the preview build, never production). `khaylub.com` and `www.khaylub.com` are attached to `khaylub-com`
  since the Phase 21 cutover of 2026-09-16; `v1.khaylub.com` is the preserved V1 exhibit on its own service.
  Production DNS, domains, and Render settings change only at an owner-gated step of an opened phase.
  `scripts/serve-with-headers.mjs` applies the same headers locally so tests can assert them.
  This project is not on Vercel; Vercel skills and agents do not apply.

## Where things are

| Path | What it holds |
|---|---|
| `content/` | all public content (Markdown and YAML); profile data in `content/profile/` |
| `src/layouts/BaseLayout.astro` | skip link, header, nav, `main`, footer, SEO head |
| `src/components/` | IdentityCard, RecruiterRow, Doors, ClimbDoor, NowLine, Top8, cards, nav, footer |
| `src/lib/` | catalog (public/private filter, featured set, evidence), profile, seo |
| `src/styles/tokens.css`, `base.css` | the design tokens: the only source of color, type, space, motion |
| `src/islands/` | React islands (the climb), loaded only after the door is pressed |
| `src/pages/` | routes; `[collection]/` handles indexes and artifact pages |
| `public/resume/` | the resume PDF, supplied by the owner and never edited by Claude |
| `scripts/` | `validate.mjs`, `banned-terms.txt`, the header server, the invalid-fixture check |
| `tests/` | Playwright suites: a11y, headers, security, seo, js-off, nav, home, resume, targets, content |
| `.claude/` | project settings and the verification guard hook |
| `docs/` | `RUNBOOK.md`: staging, the V1 exhibit, the timed rehearsal, cutover (Phase 21), rollback; owner-executed |

## Design authority

The Phase 6 visual system and the Phase 8 design system (vault documents 29 and 31) are the
authority; `src/styles/tokens.css` implements them (light and dark palettes, focus ring,
reduced-motion block). Use the tokens. Do not add colors, fonts, or motion outside them, and do not
redesign: Phase 10 composes the existing components against the Phase 6 wireframes (W1 Home,
W2 Work, W16 mobile navigation). A design skill may guide composition; it never overrides the
tokens or the wireframes.

## Writing rules (public copy, code comments, docs, commit messages)

- No em dashes (U+2014) anywhere. `npm run validate` and the commit guard both fail on one.
- Never present "AI" as a skill, tool badge, or competency. AI-assisted work says so in one
  sentence (`ai_assisted: true` renders it).
- Every number carries a source. Concept work is labeled Concept. Nothing is presented as more
  than it is.
- Private systems stay private. `scripts/banned-terms.txt` and the path and credential patterns in
  `scripts/validate.mjs` are the boundary. Never write machine paths (drive letters, user folders,
  sync folders) or credentials into this repository.

## Quality bars (enforced by tests and CI; never lower a threshold to pass)

- Accessibility: axe reports zero violations (`tests/a11y.spec.ts`); one `h1`, no skipped heading
  levels, skip link and landmarks on every page (`scripts/validate.mjs`); keyboard reachable with a
  visible focus ring; 44 px targets (`tests/targets.spec.ts`); reduced motion respected.
- Responsive: Playwright runs desktop 1440x900, tablet 768x1024, and mobile 390x844. Name, role
  line, availability, and both doors sit above the fold at 390x844 and 1440x900 (P2-FE-04).
- Performance: `lighthouserc.json` requires performance 0.90 or better, accessibility 1.0,
  best practices 0.95 or better, SEO 1.0; LCP 2000 ms or less, CLS 0.05 or less, TBT 150 ms or
  less. `budget.json`: 900 KB total, 60 KB script, 30 KB CSS, 100 KB fonts, 300 KB images,
  40 requests, zero third-party.
- SEO and content: every page's primary text is in the initial HTML and readable with JavaScript
  off (`tests/js-off.spec.ts`); title, description, canonical, sitemap, robots, and structured
  data per `tests/seo.spec.ts`; JSON-LD is the only inline script allowed.
- Security: the `render.yaml` headers are asserted by `tests/headers.spec.ts` and
  `tests/security.spec.ts`; CSP stays Report-Only until cutover; no `unsafe-inline`, ever.

## Verification commands (these and no others)

```
npm ci
npm run check                  # astro check: types and content schemas
npm run validate               # banned terms, em dashes, paths, provenance, featured set, redirects, headings, resume
npm run build                  # static build into dist/; CI runs validate again afterwards
npm test                       # Playwright against dist/ served with the render.yaml headers
npm run lhci                   # Lighthouse CI budgets
npm audit --audit-level=high
```

Run the full list, in this order, before a pull request and before any completion claim.
`node .claude/hooks/verify-guard.mjs full` runs exactly that list and records the result.

## Verification guard (`.claude/hooks/verify-guard.mjs`, wired in `.claude/settings.json`)

- Every `git commit` Claude runs: staged files are scanned for em dashes, credential patterns,
  machine paths, and secret files. If the commit touches build inputs (`src/`, `content/`,
  `public/`, `scripts/`, `tests/`, or a config file), `npm run check` and `npm run validate` must
  pass first. Documentation-only commits get the scan only, so they stay fast.
- `gh pr create` and the GitHub MCP `create_pull_request`: a full-verification stamp
  (`.claude/verify-stamp.json`, written by the `full` mode above) must match `HEAD` on a clean
  tree. Otherwise the call is blocked with instructions.
- Verification before completion: never say a phase, page, or fix is done without the command
  output in the conversation. "Should pass" is not evidence; CI green on the branch is.

## Git, branches, pull requests

- Branch from `main` per phase: `feat/phase-<n>-<slug>`; fixes `fix/<slug>`; docs and config
  `chore/<slug>`. Conventional subjects (`feat(home): ...`, `chore(ci): ...`).
- Commit only when asked. Every change reaches `main` by pull request with CI green.
- Claude never merges. The owner merges. Never force-push, never rewrite `main`, never merge or
  approve Dependabot pull requests; they are reviewed at a dependency pass.
- Rollback is `git revert`.

## Owner approval required (stop and ask)

Deploying anywhere. Creating or changing a Render service, DNS, Namecheap, or Cloudflare setting.
Touching production khaylub.com or the V1 repository beyond reading. Merging. Changing copy the
owner wrote (bio, Now lines, availability statement, resume content). Adding a dependency or a
technology not named in an ADR. Opening a phase other than the one the owner opened. Installing
plugins or skills. Merging Dependabot pull requests.

## Phases and the vault

Work proceeds by gated phases (vault document 16, the Gated Phase Roadmap). One phase per
session: the owner opens it and records PASS. The planning package (documents 00 to 32 and the
ADRs), the Planning MOC with its state block, and the dated checkpoint notes live in the owner's
vault under `01 Projects/Khaylub.com/docs/V2/` and `01 Projects/Khaylub.com/ai-docs/`. Every
phase ends with a checkpoint note there, including the skill and capability ledger (what was
available, selected, invoked, for which task, with what evidence), and a state-block update.

## Phase runner (`/phase`)

`.claude/skills/phase/SKILL.md` is the procedure for running one roadmap phase: `/phase <number>`
opens exactly that phase (explicit owner authorization; refused if the prior gate is not closed),
`/phase resume` continues the open phase from the vault checkpoint, Git, and GitHub, `/phase gate`
prints the current phase's owner-gate record (each acceptance criterion with its status, validated by
`.claude/skills/phase/scripts/gate.mjs`; placeholder or template text never counts as evidence), and
`/phase close` runs the post-merge closeout after the owner merges and accepts, recording PASS only
when the gate is SATISFIED. The skill reads the phase definition from the vault roadmap at run time,
never from itself, and stops at every owner gate. It is manual-only: Claude never triggers a phase
transition on its own.

## Current phase pointer

Phase 11 (Collection and library engine) software scope was accepted and merged on 2026-09-11 (PR #15);
its content deliverable (20 real artifacts across 4 collections; 11 across 6 today) and the ADR-002
Quarto proof stay open on the owner's side. Phase 12 (Project case studies) is ACCEPTED and CLOSED
(owner "Phase 12 PASS", 2026-09-12, under decision D-25; PR #17, PR #19). Phase 13 (Creative media)
is ACCEPTED and CLOSED: the owner recorded "Phase 13 PASS" on 2026-09-13 after reviewing and merging
PR #23. The real V1 climb now runs inside V2 as the opt-in island (`src/islands/climb/`,
`public/climb/`; nothing loads before the door; V1 untouched; integration is not cutover), and the
video, gallery, and experiments collections carry their first artifacts with the media components
and lints on `main`. Open on the owner's side and not gate items: the music collection (no track
with a provenance record yet), the concept films and posters and the vista still (provenance to
record), the Phoenix inventory row, the `v1.khaylub.com` links, Lenis, and three concept project
pages. Phase 14 (Wiki relationships) is ACCEPTED and CLOSED: the owner recorded "Phase 14 PASS" on
2026-09-13 after reviewing and merging PR #25. Wikilinks resolve at build (an unresolved link fails
`validate`, CI, and the production build; a preview build flags it in place), every artifact page
carries the related rail, backlinks, previous and next, and the series line, and `/graph/` lists the
relationships first with the map behind a disclosure (`src/lib/wikilinks.mjs`, `src/lib/graph.ts`,
`src/components/relations/`). Open on the owner's side and not gate items: series display names and
two non-featured artifacts with no relation yet. Phase 15 (Performance) is ACCEPTED and CLOSED: the
owner recorded "Phase 15 PASS" on 2026-09-13 after reviewing and merging PR #27. Lighthouse CI runs the
documented mobile profile (five runs, the median) over every template in `tests/helpers.ts`, every budget
line is an assertion in `lighthouserc.json` pinned to `budget.json` by `tests/budget.spec.ts`, and CI runs
Lighthouse in a three-shard job (`scripts/lhci-shard.mjs`); every template scores 100 with every line
green. Two facts to keep in mind: the full local guard now carries about 24 minutes of Lighthouse (26
templates, five runs, sequential), and the WebPageTest public-URL archive is deferred to Phase 19 by the
owner's decision because V2 has no public URL yet. Phase 16 (Accessibility) is ACCEPTED and CLOSED: the
owner recorded "Phase 16 PASS" on 2026-09-14 after reviewing and merging PR #29, completing the seven NVDA
journeys, and deciding that the remaining template rows are accepted on their automated and manual
browser-walk evidence. The WCAG 2.2 AA checklist runs as tests on every template (`tests/keyboard.spec.ts`,
`tests/a11y.spec.ts` at every impact in both palettes, `tests/targets.spec.ts`), the accessibility statement
is on `/colophon/`, and the primary nav has a `noscript` list. Non-blocking notes for the owner: the
contents nav sits on the left (W5), the climb's contact-link hover colour is about 4.4:1, and vault
document 29 states `--line` at 3.1:1 where it measures 1.40:1. Phase 17 (SEO and metadata) is ACCEPTED
and CLOSED: the owner recorded "Phase 17 PASS" on 2026-09-14 after reviewing and merging PR #31 and running
Google's Rich Results Test on five pages (no errors; two non-critical observations, on the Dataset and the
Video items, kept as follow-ups). Every artifact page carries a generated 1200 by 630 Open Graph card
(`src/pages/og/[collection]/[slug].png.ts`, built with `sharp`, declared at the version Astro installs),
every page declares its image dimensions and alt, the footer carries `rel="me"`, and
`scripts/seo-check.mjs` validates the metadata of every built page inside `npm run validate`. Deferred by
the owner's decision: the public social-card debugger runs (Phase 19, when a public URL exists); the V1
exhibit's `noindex` (D-09) and Search Console (SEO-10) follow at Phases 19 to 21. Phase 18 (Automated
testing) is ACCEPTED and CLOSED: the owner recorded "Phase 18 PASS" on 2026-09-14 after reviewing and
merging PR #33 and accepting the CI demonstration record. The weekly CI job repeats `npm audit`,
`scripts/check-build-fails-on-invalid.mjs` proves five refusals in CI after every build (invalid
frontmatter, a dangling `related` slug, an unresolved wikilink, an em dash, a missing `og:image:alt`), and
the thirteen deliberate-failure demonstrations (three refused by the commit guard, ten failing CI at the
targeted step, every demonstration branch deleted, nothing merged) are preserved as verification evidence
in the vault checkpoint of 2026-09-14. Not applicable yet: the notebook job (no notebook exists) and the
catalog check (ADR-003 deferred). Phase 19 (Deployment and staging) is ACCEPTED and CLOSED with
documented exceptions: the owner recorded "PHASE 19 PASS" on 2026-09-15 after merging PRs #35 to #40.
Staging runs at the Render service `khaylub-com-v2` (the preview build, `PUBLIC_SITE_ENV=preview`, never
to become the production service); `docs/RUNBOOK.md` is automation first (the header scan, the
deployed-origin verification `npm run staging:verify`, the public-URL Lighthouse runner, the rehearsal
watcher, the uptime workflow). Owner decisions to keep in mind: Render applies path-specific header
rules intermittently (three Cache-Control tiers and the `/search/` policy on staging), accepted as an
unresolved provider risk for Phase 19 only with a support case open; CSP stays Report-Only; the
`v1.khaylub.com` exhibit and the timed rollback rehearsal are carried to Phase 21 as required before
cutover, not waived; production must be a fresh Render service from the Blueprint, verified to expose
no draft content, with the live DNS recorded first and the owner's explicit go.
Phase 20 (Acceptance testing) is ACCEPTED and CLOSED with documented exceptions: the owner recorded
"PHASE 20 PASS" on 2026-09-15 over the acceptance report assembled from the existing evidence (67 Must
requirements: 62 proven; P2-FE-12, P2-FE-14, P2-CE-04, and P2-SEC-07 accepted as post-launch follow-up,
not completed and not passed; CSP enforcement deferred; the three-outsider review waived; Journeys 1 and 2
accepted on the existing automated, accessibility, staging, and owner evidence; nothing fabricated; no
repository change). Phase 21 (Production cutover) is ACCEPTED and CLOSED: the owner recorded "PHASE 21 PASS"
on 2026-09-16 after the cutover of the same day (V2 answering on khaylub.com at 00:48 UTC from the fresh
Blueprint service, no rollback needed; PR #43 declared the production service, PR #44 the post-cutover uptime
check and the runbook facts), four green scheduled uptime runs with a continuous local watcher (the 24-hour
window accepted by the owner on that evidence at about fifteen hours; the remainder recorded in the vault),
and the sitemap submitted and acknowledged in Search Console (its processing status read "Couldn't fetch"
at first and is rechecked later). The launch date is 2026-09-16. Open on the owner's side and not gate
items: the TTL restore at Namecheap after the window, the D-09 `noindex` meta on the V1 exhibit (a `v1.0.1`
tag), CSP enforcement (runbook section 8, held), the Render support case on path-specific headers, the
Phase 20 post-launch backlog (P2-FE-12, P2-FE-14, P2-CE-04, P2-SEC-07), and branch protection on `main`.
Phase 22 (V1 archival case study) is DEFERRED by decision D-26 and is not the next phase. Phase 23
(Publishing architecture and ADR) is the next gated phase and is NOT opened; it opens only on the owner's
instruction through `/phase 23`. Its architecture document (vault document 46), ADR-012 (ACCEPTED by the
owner on 2026-09-16, decision D-27, nine clarifications), the Phase 24 plan (document 47), and its gate
note are prepared in the vault: the owner publishing system is Keystatic, Git-backed, on a separate Node
service, never the production static site.
