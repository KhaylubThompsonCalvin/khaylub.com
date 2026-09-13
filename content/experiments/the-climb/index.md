---
title: The climb, as an exhibit
slug: the-climb
type: exhibit
status: published
date: 2026-09-12
summary: The first version of this site, a scroll-driven 3D climb, ported into this site as an opt-in island. Two models, four short video plates, six beats, and a little over 7 MB that load only when you ask.
tags: [three-js, react, blender, performance, portfolio]
skills: [web-development, 3d-pipeline, performance-analysis]
technologies: [three-js, react-three-fiber, react, astro, blender]
employer_visible: true
ai_assisted: true
source: this repository (src/islands/climb and public/climb/provenance.yaml) and khaylub-portfolio at tag v1.0.0-3d-experiment; the payload was measured on 2026-09-12 with Playwright against the built site
cover: poster.webp
cover_alt: The Spark Wakes beat of the climb, with the Wanderer facing the viewer under a warm sunrise sky while a small orange phoenix ignites in the upper right.
poster: poster.webp
entry_url: /climb/
payload_mb: 7.4
related: [khaylub-com-v1, the-16-mb-front-door, preserving-v1, the-climb-recording, the-climb-beat-by-beat]
provenance:
  source: The author's own screenshot of the ported climb on this site (the Spark Wakes beat at 1440 by 900), taken with Playwright on 2026-09-12. The scene contains the Wanderer and the Phoenix (Tripo base meshes finished in Blender by the author) and a Higgsfield atmosphere plate, each recorded in public/climb/provenance.yaml.
  license: All rights reserved; the author's own screenshot of the author's own site
  generator: Tripo and Higgsfield for the assets in frame, as recorded; the screenshot itself is a plain capture
  date: 2026-09-12
---

## What it is

The scene that launched as khaylub.com on 2026-06-24 and still serves the public domain (this
site takes over only at a later phase), kept as it shipped at tag `v1.0.0-3d-experiment` and
ported into this site as an island: the Wanderer walking from
night into day, the Phoenix igniting at the midpoint and filling the sky at the summit, the same
models and camera choreography, the same six beats, the words as shipped (except the availability
line, which is this site's), and the atmosphere plates re-encoded. What the port leaves out is
listed under "What changed in the port". It opens from "Enter the climb" on
the home page or from "Tap to explore" on [its own page](/climb/), and nothing from it downloads
before that press.

## What loads, and when

Before the press: nothing from the climb, on any page (a test asserts zero such requests on the
home page and the climb page). After the press, measured on 2026-09-12 with Playwright over one
full scroll (`scripts/capture-climb.mjs`): 7.36 MB in total (7,355,051 bytes, served uncompressed
by the local test server), made of the island's code (1.02 MB), its React runtime (0.19 MB), its
stylesheet (9 KB), the two models (the Wanderer 1.82 MB and the Phoenix 0.92 MB), and the four
atmosphere plates (fog 1.32 MB, dawn grass 0.69 MB, embers 0.76 MB, summit clouds 0.62 MB). The
two plates that belong to later beats are fetched only as you approach them. For comparison,
the first version requested 14.5 MB across thirteen files before its gate could be tapped
([The 16 MB front door](/notes/the-16-mb-front-door/)).

## What changed in the port

- The scene, models, plates, camera, beats, and copy are the first version's. The plates were
  re-encoded to this site's video rules (H.264 CRF 23, capped at 5 Mbps, no audio track), which
  took the four from 19.06 MB to 3.39 MB (file sizes on disk) without changing their length or
  resolution.
- Scrolling is the browser's own; the first version's smooth-scroll library is not included, so
  the page around the climb behaves like every other page here.
- The five concept-film cards of the Camps beat are not included: the films and their posters
  have no recorded generator or terms yet, and this site publishes no media without a record.
  Their cards remain as narrative; two link to project pages, three say plainly that they are
  concepts.
- The far mountain vista of the summit is not included for the same reason; the distant ridges
  you see are drawn procedurally.
- The first version's own header, entry gate, and case-study dialogs are replaced by this site's
  header, door, and project pages; the availability line is this site's one statement.

## How to use it

Scroll to walk. Near the summit the cursor steers the Phoenix and fans its fire. "Skip the climb"
stays visible at the top of the island and returns you to the door; the Tab key reaches it and
every link in the climb. With reduced motion set in your system, the plates stay paused and
hidden, the copy is solid instead of revealing, and the models still load because you asked for
them.

## Where the assets come from

The Wanderer and the Phoenix began as Tripo generations and were finished in Blender by the
author; the four plates were generated with Higgsfield from the author's prompts. Each file under
`public/climb/` has an entry in `public/climb/provenance.yaml`, and the build fails if one is
missing.
