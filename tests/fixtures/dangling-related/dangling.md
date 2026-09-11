---
title: Dangling related fixture
slug: dangling-related-fixture
type: field-note
status: published
date: 2026-09-11
summary: This fixture must fail validation because its related list names a slug that no artifact carries.
tags: [portfolio]
employer_visible: false
source: fixture
related: [no-such-artifact]
---

Copied into content/notes/ by scripts/check-build-fails-on-invalid.mjs to prove that a related slug with no artifact stops validation. It is never part of the site.
