---
title: The 16 MB front door
slug: the-16-mb-front-door
type: field-note
status: published
date: 2026-09-09
summary: What the first version of this site requested before showing a single word, measured in the browser, and what the second version changes.
tags: [performance, accessibility, portfolio]
skills: [performance-analysis, web-development]
employer_visible: true
source: Measured on khaylub.com on 2026-09-09 with Playwright and Lighthouse 12.8
series: rebuilding-khaylub-com
part: 2
related: [khaylub-com-v1, preserving-v1]
---

## The measurement

On 2026-09-09 I loaded the first version of this site in a fresh browser at a 1440 by 900 desktop size and counted what arrived before the "Tap to explore" prompt: thirteen files and 14.5 MB, most of it two video plates (7.2 MB and 4.5 MB) and two 3D models (1.8 MB and 0.9 MB). Lighthouse scored performance 69 on mobile and 79 on desktop. On a simulated slow 4G connection the prompt did not appear within ninety seconds.

## What was fine

Accessibility, best practices, and SEO all scored 100. Reduced motion was honored. The project dialog was built correctly. There were no console errors.

## What was structural

Every visitor paid the full cost before reading anything, projects had no addresses of their own, and there was no skip link or section heading structure. Those are architecture limits, not bugs.

## What the second version changes

The home page is plain HTML that loads in under a megabyte. The 3D climb is still here, one click away, and nothing from it downloads until that click. Every project, data project, and note has its own page. The measurements above are the baseline the new site is tested against on every change.
