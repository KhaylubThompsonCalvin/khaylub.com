---
slug: p28-drill-refused
title: Phase 28 recovery test, the failing document
type: field-note
status: publish
date: 2026-09-18
summary: A deliberately invalid note (status is not a permitted value) pushed on a Studio branch for the Phase 28 recovery test: the checks go red, nothing merges, production is unchanged.
tags: [github]
employer_visible: false
source: the Phase 28 recovery test
---

This note must never reach main. Its status value is not in the schema, so the check and the build refuse it.
