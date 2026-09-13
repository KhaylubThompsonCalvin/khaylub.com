---
title: The Wanderer, rendered in Blender
slug: wanderer-hero
type: render
status: published
date: 2026-06-18
summary: A Blender render of the Wanderer, the climb's hero character, walking a curved trail between rocks and bare trees. The hero image of the first version's no-WebGL fallback page.
tags: [blender, three-js, portfolio]
skills: [3d-pipeline]
technologies: [blender]
employer_visible: true
source: khaylub-portfolio at tag v1.0.0-3d-experiment, website/assets/wanderer-hero.png (1920 by 1080); the V1 case study on this site
cover: wanderer-hero.webp
cover_alt: The Wanderer, a small figure with a green backpack, walks away along a sand-coloured trail that curves between rocks and bare trees.
images:
  - src: wanderer-hero.webp
    alt: The Wanderer, a small figure in a dark jacket with a green backpack, walks away along a wide sand-coloured trail that curves uphill between boulders, fallen logs, and bare tree trunks.
    caption: The Wanderer on the trail, rendered in Blender, June 2026.
related: [khaylub-com-v1, wanderer-pipeline]
provenance:
  source: Blender render by the author of the Wanderer character, whose base mesh and auto-rig were generated in Tripo from the author's reference image and then cleaned, re-rigged where needed, and finished in Blender by the author. Taken from the V1 repository (website/assets/wanderer-hero.png, 1920 by 1080) and resized to 1600 px.
  license: All rights reserved
  generator: Tripo (base mesh and auto-rig); Blender render by the author
  date: 2026-06-18
---

## What this is

One frame of the Wanderer rendered in Blender: the character walks away along a trail that
curves between boulders, logs, and bare trees, with everything beyond the trail left soft. It is
the hero image of the first version's no-WebGL fallback page, the static site kept in the
`website/` folder of the V1 repository (its README names it so), and it shows the character the
[V1 case study](/projects/khaylub-com-v1/) describes finishing.

## How it was made

The character's base mesh and auto-rig came out of Tripo from my own reference image; I cleaned
the mesh, re-rigged the parts the generation got wrong (the glasses had fused to the head), and
finished the materials and the pose in Blender before exporting the web version with meshopt
compression (source: the V1 case study, "Technology choices" and "What I built"). The rocks,
logs, and trees in the frame are Blender scene dressing; the render is my own. The date on this
entry is the Wanderer pipeline session record of 2026-06-18; the render's own date is not
recorded separately.

## Where it lives now

The same character walks through [the climb](/climb/), where the scene loads only on request. The
web model is 1.8 MB (`public/climb/wanderer-web.glb`, recorded in `public/climb/provenance.yaml`).
