---
title: Khaylub.com V1, the climb
slug: khaylub-com-v1
type: case-study
project_status: live
status: published
date: 2026-06-24
updated: 2026-09-09
summary: A scroll-driven 3D portfolio built with React Three Fiber and Blender, launched in June 2026 and kept as the opt-in front door of this site.
tags: [three-js, react, blender, performance, portfolio]
skills: [web-development, 3d-pipeline, performance-analysis]
technologies: [react-three-fiber, three-js, vite, blender, lenis, zustand]
employer_visible: true
featured: true
source: https://github.com/KhaylubThompsonCalvin/khaylub-portfolio
links:
  code: https://github.com/KhaylubThompsonCalvin/khaylub-portfolio
  live: /climb/
  result: /notes/the-16-mb-front-door/
outcome: Launched 2026-06-24, three months ahead of its target date; preserved at tag v1.0.0-3d-experiment.
related: [preserving-v1, the-16-mb-front-door]
---

## Overview

The first version of khaylub.com is a single scrolling scene. A rigged traveler, the Wanderer, walks from a night sky into daylight while the site's text reveals itself beat by beat, and a Phoenix appears near the end. It shipped on 2026-06-24 and still runs, unchanged, as the climb on this site and at its own address.

## Status

Live. The repository is frozen at tag `v1.0.0-3d-experiment` with a locked branch and a GitHub release, so the experience can always be rebuilt exactly as it launched. See [Preserving V1](/notes/preserving-v1/).

## What it is built with

React Three Fiber on three.js, Vite, two meshopt-compressed GLB models made in Blender, Lenis for the scroll spine, and Zustand for state.

## What it cost, measured

On 2026-09-09 a cold desktop load requested 14.5 MB before the first word appeared, and Lighthouse scored performance 69 on mobile and 79 on desktop. The numbers and what they changed are in [The 16 MB front door](/notes/the-16-mb-front-door/).

## Full case study

The thirteen-section case study for this project is written at Phase 12 of the V2 build. Until then this page carries the verified facts above and the proof links at the top.
