---
slug: p27-drill-refused
title: Phase 27 failing-document drill
type: field-note
status: publish
date: 2026-09-18
summary: A deliberately invalid note (status is not a permitted value) pushed on a Studio branch to prove the checks go red, nothing merges, and production is unchanged.
tags: [github]
employer_visible: false
source: the Phase 27 failing-document drill
---

This note must never reach main. Its status value is not in the schema, so the check and the build refuse it.
