# Vault records

The vault is the canonical planning and decision record. Write to it with targeted edits, keep history, resolve every wiki-link, use no em dashes (U+2014) anywhere under `01 Projects/Khaylub.com/`, and follow the frontmatter the existing notes use.

## Frontmatter

```
---
type: plan | project
status: active
project: "[[Khaylub.com]]"
tags: [khaylub-com, phase-<n>]        # checkpoints add `checkpoint`
created: YYYY-MM-DD
updated: YYYY-MM-DD                   # bump on every edit
---
```

## Plan: `DOCS/<NN> - Phase <N> Implementation Plan.md`

`NN` = highest existing `NN - ` prefix in `DOCS` plus one. Follow documents 33 to 35 as the shape:

1. Header: goal, architecture (no new system unless an ADR names it), tech stack, spec (the roadmap section and every document it names, as wiki-links), global constraints (branch from `main` at the SHA read this session, CLAUDE.md rules, budgets, owner copy rules).
2. `## Recovered Phase <N> scope (document 16, authoritative)`: the roadmap entry copied verbatim.
3. `## Requirement classification`: a table with `Requirement | Classification | Source | Note`, using `ALREADY SATISFIED`, `EXTEND`, `BUILD`, `OWNER CONTENT BLOCKED`, `DEFERRED BY ROADMAP`, `NOT SPECIFIED`. For `BUILD` and `EXTEND`: source requirement, current implementation (file and line), gap, likely files, verification (test name or command), acceptance evidence (what the checkpoint will show).
4. `## Conflicts and reconciliation`: each conflict, the rule applied, the result.
5. `## Tasks`: bite-sized tasks with checkboxes, tests first where behaviour changes, a commit step per task, review and browser-acceptance task last.
6. `## Self-review`: spec coverage, placeholders, name consistency.

## Checkpoint: `AIDOCS/YYYY-MM-DD - V2 Checkpoint - Phase <N> <Name>.md`

Create it when the phase opens and grow it as milestones land. Sections that the last three phases converged on:

1. Gate state (phase, opened by and when, starting `main`, branch, verdict rows for software and content, not-touched list)
2. Recovered scope and classification (as executed, with what changed from the plan)
3. What was built, per requirement, with files
4. Reviews (code, security, factual, accessibility, scope) with findings and fixes
5. Verification evidence (every command, its result, counts; the guard steps and timings)
6. Browser acceptance (journey, viewports, what was checked, screenshot names)
7. Git and pull request (commits, push, CI runs, pull-request state, compare URL if the token refused)
8. Owner items (what only the owner can decide, each with the exact question)
9. Follow-ups outside the phase (bugs and improvements found and deliberately not done)
10. Skill and capability ledger: `Skill or capability | Available? | Selected? | Invoked? | Task | Evidence | Skipped reason`
11. Later: `## Post-merge closeout, <date>` appended by `/phase close`; `## Owner decisions applied` when corrections land
12. `## Resume here` as a callout, rewritten at every milestone: state, branch and SHAs, what is done, what is next, what is blocked, boundaries
13. `## Related` with wiki-links to the plan, the MOC, the roadmap, the previous checkpoint, and the daily note

Evidence folder: `AIDOCS/YYYY-MM-DD - V2 Phase <N> evidence/` for screenshots (`p<N>-<seq>-<what>-<viewport>.png`), `pull-request-body.md`, review outputs.

## Owner gate note: `AIDOCS/Phase <N> - Owner Gate.md`

One per active phase, format and rules in owner-gate.md. Explicit `status:` lines; content lines hold the evidence or the word `MISSING`, never a bracket or an example. Linked from the MOC state block. Edited only by targeted edits; validated by `node .claude/skills/phase/scripts/gate.mjs`.

## Planning MOC: `DOCS/Khaylub.com V2 - Planning MOC.md`

Edit only these places, only with facts that happened, only by targeted edits:

- State block row **Current phase**: opened by whom and when, branch and tip SHA, built and verified summary, acceptance PENDING or the owner's PASS, next phase NOT opened.
- State block rows **Phases accepted**, **Last accepted gate**: only at an owner PASS that the Owner Gate note shows SATISFIED.
- State block line **Owner gate**: a wiki-link to the active phase's Owner Gate note.
- State block row **Exact next action**: the owner's exact next step.
- State block row **Last verified**: date, SHA, what ran.
- **Gate log**: append a row per event (opened, built, pull request, exit gate, closeout, pointer); keep the "Phase N+1 gate | not opened" row last and current.
- Never touch the **V1 → V2 reminder** row except to keep it true; never remove prior-phase open items.

## Roadmap: `DOCS/16 - Gated Phase Roadmap.md`

Read-only during a phase. Its header status line and a phase's status callout may be updated only at an owner PASS, by appending the completion sentence; phase boundaries change only on the owner's explicit scope decision, recorded in the gate log.

## CLAUDE.md pointer

`## Current phase pointer` in the repository is updated by a docs-only commit on a `chore/` branch (during a phase: on the phase branch's final commit) and reaches `main` by pull request. It states: last accepted phase and its pull request, the current phase and its state, the next phase and "opens only on the owner's instruction".

## Daily note

At a shutdown or a gate, add a short dated entry to the vault daily note `YYYY-MM-DD.md` (state, record link, the owner's next steps). Do not edit dashboards; those wait for the weekly review.

## Vault commit

`git add` only the Khaylub.com files touched (plan, checkpoint, evidence folder, MOC, daily note). Exclude `.obsidian/`, `.playwright-mcp/`, `Untitled*.canvas`, `Untitled*.base`, and other projects. Message: `docs(khaylub): <what>` (examples: `record Phase 12 build at owner exit gate`, `checkpoint Phase 12 owner review gate`, `close Phase 11`). Before committing, grep the touched files for U+2014 and check every `[[link]]` resolves to a file.
