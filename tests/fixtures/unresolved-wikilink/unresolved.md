---
title: Fixture note with an unresolved wikilink
slug: zz-unresolved-wikilink
type: field-note
status: published
date: 2026-09-13
summary: A fixture that must fail validation and the production build because its body links to a slug no artifact carries.
tags: [portfolio]
employer_visible: false
source: tests/fixtures/unresolved-wikilink
---

This body links to [[no-such-artifact-anywhere]] and must never reach a production build.
