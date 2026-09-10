---
title: Preserving V1
slug: preserving-v1
type: field-note
status: published
date: 2026-09-07
updated: 2026-09-09
summary: How the first version of this site was frozen with a tag, a locked branch, a release, and a ruleset before the rebuild began.
tags: [preservation, git, github, portfolio]
skills: [version-control, documentation]
employer_visible: true
source: https://github.com/KhaylubThompsonCalvin/khaylub-portfolio/releases
series: rebuilding-khaylub-com
part: 1
related: [khaylub-com-v1, the-16-mb-front-door]
---

## Why freeze anything

The first version of this site is a 3D experience I still want people to be able to see exactly as it shipped. Before starting a rebuild, I made it recoverable.

## What was done

- An annotated tag, `v1.0.0-3d-experiment`, on the deployed commit.
- A branch, `legacy/v1-3d-experiment`, from the same commit, locked so it cannot move.
- A GitHub release from the tag with a screenshot and a short description.
- A repository ruleset that protects every tag beginning with `v1.`.
- A preservation document in the repository recording the build command, output folder, and hosting settings.

## Why it matters for the rebuild

With the tag in place, the new site can carry the old experience as an opt-in page without ever editing the original code. If anything in the rebuild goes wrong, the tag rebuilds the first version from a clean clone.

## What is next in this series

Part 2 is about what the first version cost to load and what the rebuild changes: [The 16 MB front door](/notes/the-16-mb-front-door/).
