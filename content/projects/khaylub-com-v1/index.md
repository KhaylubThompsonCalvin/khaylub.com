---
title: Khaylub.com V1, the climb
slug: khaylub-com-v1
type: case-study
project_status: live
status: published
date: 2026-06-24
updated: 2026-09-11
summary: A scroll-driven 3D portfolio built with React Three Fiber and Blender, launched in June 2026 and kept as the opt-in front door of this site.
problem: A first portfolio that showed who I am and what I can build, on a shipping deadline, before I had a body of public work to point at.
role: "Sole author: concept, Blender assets, scene, copy, deployment, preservation; AI-assisted code."
tags: [three-js, react, blender, performance, portfolio]
skills: [web-development, 3d-pipeline, performance-analysis]
technologies: [react-three-fiber, three-js, vite, blender, lenis, zustand]
employer_visible: true
featured: true
ai_assisted: true
source: https://github.com/KhaylubThompsonCalvin/khaylub-portfolio
links:
  code: https://github.com/KhaylubThompsonCalvin/khaylub-portfolio
  live: /climb/
  result: /notes/the-16-mb-front-door/
outcome: Launched 2026-06-24, three months ahead of its target date; preserved at tag v1.0.0-3d-experiment.
related: [preserving-v1, the-16-mb-front-door]
provenance:
  source: Screenshot published by the author on the GitHub Release v1.0.0-3d-experiment of khaylub-portfolio (khaylub-v1-2026-09-07.png), resized to 1200 px
  license: All rights reserved; the author's own screenshot of the author's own site
  date: 2026-09-07
---

## Problem

I needed a portfolio that a hiring manager could open and understand, and I needed it live before I
had many finished public projects to show. The first version had to carry the story on its own:
who I am, what I am learning, and that I can take a piece of software from idea to a deployed
address. The project plan set a target of the end of September 2026; the site went live on
2026-06-24 (repository history and the GitHub Release).

## Why it mattered

Without a site there was nothing to put on a résumé or an application beyond a GitHub profile. A
plain page would have shipped faster, but I also wanted proof that I could learn three things at
once, Blender, three.js through React Three Fiber, and a real build and deploy pipeline, and hold
them together in one shipped product. Whether that bet was the right one is answered honestly in
"What went wrong".

## Requirements

Given (from the project charter in my planning vault, June 2026):

- one continuous scrolling experience with a single hero character, the Wanderer
- recruiter clarity first: name, role, availability, projects, and contact reachable
- a live, reliable deployment

Self-imposed:

- the character and the Phoenix finished and rigged by me in Blender from AI-generated base meshes, not bought as finished assets
- a cinematic read: night into day, six story beats, generated video atmosphere plates
- reduced motion honored, keyboard reachable, no console errors at launch

## Design

One page, one timeline. A Lenis smooth-scroll loop writes a single `scrollProgress` value into a
Zustand store; everything else reads it. The three.js scene (the Wanderer walk cycle, a camera rig,
the atmosphere) and the HTML overlay (six beats: The Trailhead, The First Ember, Footholds, The
Spark Wakes, The Camps, The Summit) both follow that one number, so the picture and the words stay
in step. Project cards open an accessible dialog; a load gate holds the scene until the visitor taps.
Source layout and the beat names are in the repository README and `src/`.

## Technology choices

React 18 with Vite for the shell and build; React Three Fiber and drei on three.js for the scene;
Blender for both GLB models, compressed with meshopt; Lenis for the scroll spine; Zustand for state;
Render for hosting. The list matches `package.json` at the preserved tag.

## Why these choices

React Three Fiber let me describe the scene declaratively and keep it inside one React tree with the
overlay, which mattered more than raw three.js control for a first 3D project. Vite gave a fast
local loop with no configuration to learn. Lenis plus a single store was the simplest way to make
scroll the only clock. Blender was the one 3D tool I was already learning, so modeling the assets
myself was a learning goal, not a cost saving. I rejected a static site with a decorative canvas
because it would not have taught me the pipeline I wanted to learn.

## What I built

The concept, the scene composition, the six-beat copy and its per-word reveal, the project dialog,
the scroll and state wiring, the Render deployment, and later the preservation (tag, locked branch,
release). The assets, stated plainly: the Wanderer's base mesh and auto-rig were generated in Tripo
from a reference image, then cleaned, re-rigged where the generation failed (the glasses had fused
into the head mesh and were rebuilt as a separate object), and finished by me in Blender; the
Phoenix followed the same path, retopologized and rigged with Rigify, and its origin record is
still marked for confirmation in my media inventory; the four atmosphere video plates were
generated with Higgsfield from my prompts (session records of 2026-06-18 and 2026-06-21). The code
was written with AI assistance in Claude Code, working from my own specifications, checkpoints, and
review; the repository's `CLAUDE.md` and the dated checkpoint notes in my vault record that
working method. The design decisions, the direction of every asset, and the testing are mine.
119 commits by a single author between 2026-06-20 and 2026-07-05 as counted in the V1 audit
(section 1), with the final merge (PR #30) landing on 2026-07-06.

## What went wrong

Two things, one small and one structural.

The small one: on 2026-06-27 a walkthrough against the real narrative found that the readability
scrim behind the copy had faded to transparent, dropping day-darkened text onto the bright
dawn-grass plate below WCAG AA contrast, and that the per-word reveal finished only after the block
had begun to fade, so the last words dissolved mid-sentence. Both were fixed the same day, verified
live (vault checkpoint of 2026-06-27).

The structural one: the site asked every visitor to pay for the whole experience before reading a
word. Measured on 2026-09-09 with Playwright and Lighthouse 12.8 at a 1440 by 900 desktop size, the
cold load requested thirteen files and 14.5 MB before the "Tap to explore" prompt, most of it two
video plates, and Lighthouse scored performance 69 on mobile (total blocking time 1,265 ms) and 79
on desktop (the measurement is written up in [The 16 MB front door](/notes/the-16-mb-front-door/);
Lighthouse figures from the V1 audit section 15). Projects lived inside dialogs with no addresses of their own, so
nothing was linkable and crawlability was never verified, and there was no skip link and almost no heading structure.
None of that was a bug. It was the architecture I chose.

## Verification

Through the build: the dated checkpoints record zero console errors and a passing build, each change
checked live in the browser (for example the 2026-06-27 checkpoint). At the V2 planning gate on 2026-09-09: axe reported zero violations at desktop and mobile;
Lighthouse gave accessibility, best practices, and SEO 100 on both; reduced motion paused all ten
videos and rendered the reveals solid; no request failed. The same run produced the payload and
performance numbers above (V1 audit section 15; [The 16 MB front door](/notes/the-16-mb-front-door/)).

<figure>
  <img src="/media/khaylub-com-v1/release-2026-09-07.webp" alt="The V1 home page at the load gate: the Wanderer standing in a night scene under the site name, with the Tap to explore prompt centered below" width="1200" height="750" loading="lazy" decoding="async">
  <figcaption>The preserved build at its release, 2026-09-07. Source: the author's screenshot attached to the GitHub Release v1.0.0-3d-experiment.</figcaption>
</figure>

## What I would change

Serve readable HTML first and make the 3D an opt-in: name, role, availability, projects, and
contact in the initial response, with the scene loading only when asked. Give every project its own
URL. Add a skip link and real headings. Ship without video plates until each one is measured
against a budget. That list is the design of the second version of this site, and this page is
served by it.

## What I learned

Web development: a build pipeline, deployment, and the cost of assets are part of the product, not
a detail after it. 3D pipeline: modeling, rigging, meshopt export, and browser delivery end to end,
including the size discipline that GLBs demand. Performance analysis: measuring a page in the
browser and reading the numbers honestly, which is where the second version began.

## Code

[github.com/KhaylubThompsonCalvin/khaylub-portfolio](https://github.com/KhaylubThompsonCalvin/khaylub-portfolio),
frozen at tag `v1.0.0-3d-experiment` (commit `67edcc7`, merged 2026-07-06) with a locked branch, a
protected tag pattern, and a GitHub Release. Since the freeze the live branch has taken two
owner-approved content merges (the résumé PDF and an em dash sweep; V1 audit section 15); the tagged
commit itself is unchanged. How and why it was frozen:
[Preserving V1](/notes/preserving-v1/).

## Result

Live. The full experience runs at its own address, and this site offers it as
[the climb](/climb/), one click away; the second version's plan integrates the real scene as that
opt-in island at a later phase (Phase 13 of the build) and moves the public domain only at the
final cutover. Until then, the launch is the shipped product: a first portfolio, delivered early,
that taught me exactly what the next one had to fix.
