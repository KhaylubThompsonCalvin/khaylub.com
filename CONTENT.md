# Content guide

Everything public on khaylub.com is a file under `content/`. Adding a project, a data project, or a
Field Note means adding one folder or one file; no template changes are needed. The build validates
every file against a strict schema and fails on anything it does not recognize.

## Folder map

```
content/
  projects/<slug>/index.md        software and systems work (plus cover and figures beside it)
  data/<slug>/index.md            data projects (plus notebook, sql/, figures/)
  notes/<slug>.md                 Field Notes
  writing/<slug>.md               essays and poems
  journal/<yyyy-mm-dd>-<slug>.md  dated entries
  music/<slug>/index.md           tracks
  video/<slug>/index.md           films and recordings
  gallery/<slug>/index.md         stills and renders
  experiments/<slug>/index.md     prototypes and exhibits
  timeline/events.yaml            authored dated events
  profile/                        identity, availability, now, interests, on-repeat, blogroll,
                                  education, certifications, resume.md, top8/<yyyy-mm>.yaml
  vocabulary/                     tags.yaml, skills.yaml, technologies.yaml
  redirects.yaml                  permanent redirects, mirrored in render.yaml
```

## Frontmatter, every artifact

| Field | Required | Rule |
|---|---|---|
| `title` | yes | 3 to 90 characters |
| `slug` | yes | lowercase letters, digits, single hyphens; permanent; unique |
| `type` | yes | per collection (below) |
| `status` | yes | `idea`, `draft`, `review`, `published`, `archived`; only `published` and `archived` reach production |
| `date` | yes | ISO date |
| `updated` | no | on or after `date` |
| `summary` | yes | 40 to 240 characters; used on cards, search, and feeds |
| `tags` | yes | one or more slugs from `vocabulary/tags.yaml` |
| `skills` | no | slugs from `vocabulary/skills.yaml`; never AI |
| `technologies` | no | slugs from `vocabulary/technologies.yaml` |
| `employer_visible` | yes | `false` hides the item from the Work page only |
| `featured` | no | only the three approved launch projects may be `true`; the build fails otherwise |
| `source` | yes | where the claims come from (a URL or a short statement) |
| `cover`, `cover_alt` | no | a cover requires alt text and a provenance record |
| `related` | no | slugs that must exist |
| `series`, `part` | no | for multi-part notes |
| `ai_assisted` | no | rendered as a sentence when `true` |
| `license` | no | SPDX id or "All rights reserved" |
| `provenance` | when media is referenced | `source`, `license`, `generator` (if AI-made), `date` |

Any other key fails the build. That is how private fields stay impossible.

## Per collection

- **projects**: `type` (`case-study`, `concept`, `exhibit`), `project_status` (`live`, `prototype`, `private-beta`, `concept`, `archived`), `links` (`code`, `live`, `result`), `stack`, optional `outcome`. A featured project needs at least one proof link.
- **data**: `type` (`analysis`, `notebook`, `dataset`, `story`), `question`, `dataset` (`name`, `source`, `license`), `result`, optional `repository`, `story_url`, `sql`, `notebook`, `links`.
- **notes**: `type` (`field-note`, `retrospective`, `how-to`).
- **writing**: `type` (`essay`, `poem`, `fiction`, `book-note`). **journal**: `type: entry`.
- **music**: `type: track`, `duration` (`m:ss`), `provenance`, `files` or `external_url`.
- **video**: `type` (`film`, `recording`, `concept-film`), `poster`, `provenance`, `files` or `external_url`, `captions` when there is speech.
- **gallery**: `type` (`still`, `set`, `render`), `images[]` with `src` and `alt`, `provenance`.
- **experiments**: `type` (`prototype`, `exhibit`), `poster`, `entry_url`, optional `payload_mb`.

## Profile data

Small YAML files feed the identity card, availability line, Now block, interests, footer, education,
certifications, Top 8, and security.txt. Each has a fixed set of keys (see `src/lib/profile.ts`).
The availability statement lives in one place, `profile/availability.yaml`, and renders everywhere.

## Media rules

Images beside the artifact; every image has alt text; the LCP image is never lazy. Video has a
poster and `preload="none"` and never autoplays with sound. Audio uses native controls. Files over
5 MB (or 25 MB total) live outside the repository. Every media file has a provenance record.

## Public and private boundary

The following never enter `content/`: private dashboards, finances, benefits, school records or
grades, health, family, client or customer data, credentials, internal paths, and internal notes
quoted verbatim. `scripts/banned-terms.txt` lists the words the build refuses; a deliberate public
mention needs an `<!-- allow-term: TERM -->` comment in the file and a reviewer's eyes.

## Writing rules

No em dashes. No "AI" as a skill, tool badge, or competency; AI-assisted work says so in a sentence.
Every number carries a source. Concept work is labeled Concept. Nothing is presented as more than it is.

## Checks

`npm run check` (types and schemas), `npm run validate` (boundary, em dashes, paths, provenance,
featured set, redirects, security.txt, headings, résumé), `npm run build`, `npm test` (Playwright
against `dist/` served with the `render.yaml` headers), `npm run lhci` (Lighthouse budgets).
