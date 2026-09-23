---
name: khaylub-visual-director
description: Use before any visual, layout, CSS, or component-presentation change to Khaylub.com V2 (Home, Work, Library, Writing, the artifact pages, the climb's entrance, the footer, the tokens). Encodes the site's enduring visual rules (the Visual North Star, vault document 65) so a session designs as the site's own art director, not as a template. Read it first, then design against it.
---

# Khaylub.com visual director

The authority is the vault's Visual North Star (document 65) and the operating plan (document 57). This skill is the short form for a session that will touch the presentation layer. It never overrides CLAUDE.md, the tokens, or the protected systems.

## The idea in one line

Khaylub.com is a professional profile, a personal library, and a creative internet home: one person's own place on the web. MySpace 2005 to 2008 is the inspiration (ownership, named modules, labelled fact rows, the ranked and dated Top 8, density, an identity column beside a wide module column), never a literal clone. Modern editorial design is the setting (two faces at work, a type scale, reading comfort, rules instead of boxes, restraint, a composition designed at every width).

## The rooms

One visual language, a different atmosphere per room, the same header and footer everywhere:

- Home: the front porch. The approved hero (D-30, the first-screen rule FR-A1 at 390 by 844 and 1440 by 900), then the climb band, then the profile: Now, Details, Contact in light plates in the identity column; the Top 8 as ranked tiles, Writing, and the Library shelf in the wide column.
- Work: the workshop and evidence room. A plate with a thick ink rule and the availability, a counts row, rule-topped entries with outcome, stack, and proof links as plain links, evidence rows.
- Library: the archive. A plate with a shelf edge, the collections as a shelf (a sentence and the newest item under each), the Top 8.
- Writing: the reading room. The index plate's sentence in the display face; an essay opens with a large initial; the long-form measure of F3.
- Data and case studies: the evidence space. Facts as labelled tables with rules.
- The climb: cinematic and optional. A poster band on Home (a cropped still with a provenance record, words on the scrim, one link); the door on its own page; nothing of the scene loads before the press. The climb is never a gate.

## The rules

1. Use the tokens (`src/styles/tokens.css`): palette C and the semantic colour roles (F4), Fraunces and KT Sans (F3), the numeric scale and the semantic spacing roles (F2, F5). Add no colour, font, or motion outside them.
2. Use real content. The owner's headshot, role line, availability, projects, writing, library counts, Now lines, and the climb's real facts. No placeholder text, ever.
3. Entries are rule-topped columns of text with the title in the display face. Boxes have one job: the identity column's plates and the Top 8 tiles. Status words are plain small text; a live thing is set in the signal colour and weight. No pills, badges, or icons.
4. One memorable element per page; everything else quiet. Spend boldness once.
5. Numbers only where content is ranked (the Top 8) or counted (the counts rows). No numbered markers as decoration.
6. Mobile is designed, not stacked: the hero's first screen, the climb band as a poster over a dark panel, two-across tiles with captions (rows under 360 px), module heads on rules. Overflow 0 at 320.
7. Accessibility is the floor: axe 0 at every impact in both palettes, the keyboard walk with the blue ring, 44 px controls and 24 px text links, reduced motion respected, colour never the only cue.
8. Performance is the floor: the Lighthouse gates (LCP 2,000 ms, CLS 0.05) and the budgets; the one stylesheet inside the 36 KiB line (a change that approaches it investigates the cause first; the line is never raised without an owner decision).
9. Anti-slop: no identical rounded cards, no every-section-in-a-box, no SaaS or bento grids, no gradient blobs (the scrim under words on a still is the only gradient), no glassmorphism, no viewport-tall hero, no pill badges, no meaningless icons, no startup copy, no motion for its own sake, no tracked-out all-caps eyebrows, no purple or blue palette, no fake statistics or testimonials, no dashboard.
10. Preserve the architecture: Astro, the content schemas, Keystatic and the Studio, the publishing workflows, Render, search, the feeds, the sitemap, provenance, the climb's Three.js island. Presentation freedom is not an infrastructure rewrite.

## The process

1. Read document 65 and the latest design checkpoint in the vault before designing.
2. Load `frontend-design` for art direction. Prototype with the real content when a decision is open; three directions when the brief is wide.
3. Build on a `feat/design-*` branch. Screenshot before acceptance: every changed route at 1440 (light and dark), 390, and 320 (`test:visual` and `scripts/visual-diff.mjs` against the last accepted set). Use owner design mode (`npm run design:review`) for a live review.
4. Critique the captures (the tells in rule 9), revise, then run the site suite, the visual harness, and the full guard. Fix until green; never lower a threshold.
5. Record the decisions, the pulled-forward work, and the evidence in the vault checkpoint; update document 60 and the MOC; commit the vault. Never merge; the owner merges.
