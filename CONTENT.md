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
| `problem` | no (featured case studies: yes) | 20 to 240 characters; the summary card's one-line problem statement |
| `role` | no (featured case studies: yes) | 3 to 240 characters; the author's role, stated plainly, separating authored work from generated source assets |
| `tags` | yes | one or more slugs from `vocabulary/tags.yaml` |
| `skills` | no | slugs from `vocabulary/skills.yaml`; never AI. Each term there carries an `area` that groups the Work page |
| `technologies` | no (yes for projects) | slugs from `vocabulary/technologies.yaml`; the Work page counts the published items that name each one |
| `employer_visible` | yes | `false` hides the item from the Work page only |
| `featured` | no | only the three approved launch projects may be `true`; the build fails otherwise |
| `source` | yes | where the claims come from (a URL or a short statement) |
| `cover`, `cover_alt` | no | a cover requires alt text and a provenance record |
| `related` | no | slugs of existing artifacts; `npm run validate` fails on a slug no artifact carries |
| `series`, `part` | no | for multi-part notes |
| `ai_assisted` | no | rendered as a sentence when `true` |
| `license` | no | SPDX id or "All rights reserved" |
| `provenance` | when media is referenced | `source`, `license`, `generator` (if AI-made), `date` |

Any other key fails the build. That is how private fields stay impossible.

## Per collection

- **projects**: `type` (`case-study`, `concept`, `exhibit`), `project_status` (`live`, `prototype`, `private-beta`, `concept`, `archived`), `links` (`code`, `live`, `result`), `technologies` (required here: the stack, at least one term), optional `outcome`. A featured project needs at least one proof link.
- **data**: `type` (`analysis`, `notebook`, `dataset`, `story`), `question`, `dataset` (`name`, `source`, `license`), `result`, optional `repository`, `story_url`, `sql`, `notebook`, `links`.
- **notes**: `type` (`field-note`, `retrospective`, `how-to`).
- **writing**: `type` (`essay`, `poem`, `fiction`, `book-note`). **journal**: `type: entry`.
- **music**: `type: track`, `duration` (`m:ss`), `provenance`, `files` or `external_url`.
- **video**: `type` (`film`, `recording`, `concept-film`), `poster`, `provenance`, `files` or `external_url`, `speech: true` when the recording has speech, and then `captions` (a WebVTT file) is required.
- **gallery**: `type` (`still`, `set`, `render`), `images[]` with `src`, `alt` (up to 200 characters, the image for those who cannot see it), and an optional short `caption` (the visible line), `provenance`.
- **experiments**: `type` (`prototype`, `exhibit`), `poster`, `entry_url`, optional `payload_mb`.

## Profile data

Small YAML files feed the identity card, availability line, Now block, interests, footer, education,
certifications, Top 8, and security.txt. Each has a fixed set of keys (see `src/lib/profile.ts`).
The availability statement lives in one place, `profile/availability.yaml`, and renders everywhere.

## Media rules (ADR-007; enforced by `npm run validate` and the media tests)

- **Where files live.** Rasters (covers, posters, gallery images) sit beside the artifact in its
  folder and go through the image pipeline at build (AVIF and WebP, `srcset`, width and height);
  source them at 1600 px wide as PNG or high-quality WebP. Video and audio files live under
  `public/media/<slug>/` and are named in frontmatter by file name (`files: [clip.mp4]`); a path
  that starts with `/` is served as it is and skips the pipeline.
- **Sizes.** 5 MB per file anywhere in the repository; 25 MB in total outside `public/climb/`
  (the climb island's models and plates count against the opt-in climb only). Larger or long-form
  media is hosted outside the repository (decision D-07) and referenced with `external_url`.
- **Images.** Every image has alt text (`cover_alt`, `images[].alt`); the first image on a page is
  the LCP candidate (eager, `fetchpriority="high"`, 150 KB or less at its largest candidate) and
  every other image is lazy; card thumbnails are 400 px WebP at 30 KB or less; galleries open an
  image at full size on its own URL, not in a lightbox.
- **Video.** `poster` required; the player is native with `controls`, `preload="none"`,
  `playsinline`, in a 16:9 frame; nothing autoplays. Short clips (under 60 s) may be self-hosted at
  1080p H.264 CRF 23 capped at 5 Mbps (audio AAC 128 kbps, or none). Set `speech: true` when the
  recording has speech; `captions` (WebVTT, beside the media file) is then required. External video
  renders as the poster plus a link that names the host; no iframe is ever created.
- **Audio.** MP3 at 160 to 192 kbps (Opus optional), native `<audio controls preload="none">`,
  `duration` as `m:ss`, and the lyrics or a description in the artifact body. No autoplay, ever.
- **3D and the climb.** Nothing 3D loads before an explicit click. The climb's assets live under
  `public/climb/` with one entry per file in `public/climb/provenance.yaml`; the exhibit entry in
  `content/experiments/` links to `/climb/` and states the payload (`payload_mb`).
- **Provenance.** Every media file referenced by an artifact needs the artifact's `provenance`
  record (`source`, `license`, `generator` when AI-made, `date`); every file under
  `public/climb/` needs its entry in the sidecar; the build fails without them. AI-generated media
  is labeled on the page.
- **Reduced motion.** V2 pages never autoplay or animate media; inside the opted-in climb, V1's
  own rules apply (plates paused and hidden, reveals solid, models still load).

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
