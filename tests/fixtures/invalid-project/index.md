---
title: Invalid fixture
slug: invalid-fixture
type: case-study
project_status: live
status: published
date: 2026-09-09
summary: This fixture must fail the build. It is missing required fields and carries a private key.
tags: [portfolio]
employer_visible: true
source: fixture
technologies: [astro]
gpa: 3.9
---

This file is copied into content/ by scripts/check-build-fails-on-invalid.mjs to prove that a private field and a schema violation stop the build. It is never part of the site.
