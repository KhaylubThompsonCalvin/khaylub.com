# Owner gate: evidence, statuses, and the canonical note

The exit gate of a phase is closed by evidence, never by a sentence about evidence. This file defines how `/phase gate`, `/phase close`, and `/phase resume` decide, and the one note that holds the decision.

## The rule

A required evidence field is SATISFIED only when its own content is the evidence. Placeholder, template, example, and instructional text is MISSING regardless of who supplied it or what they said about it. An owner sentence such as "these are the reviewer's actual words" is recorded as a claim; it never upgrades the content. Content and claim must agree, and when they disagree the content wins and the disagreement is written into the record.

`scripts/evidence.mjs` is the executable form of this rule (`classifyEvidence`, `evaluateGate`, `decideClose`, `resumeState`, `parseGateNote`); `scripts/gate.mjs <note>` validates a canonical note and prints the record; `tests/phase-gate.spec.ts` proves both. Read the reasons it prints; do not argue with them in prose.

## What MISSING looks like

Reject a value as MISSING when any of these hold (the script implements them; apply the same judgment to anything it cannot see):

- empty, whitespace, or a bare token: `TODO`, `TBD`, `TK`, `N/A`, `none`, `pending`, `missing`, `not yet supplied`, `replace me`, `fill in`, `lorem ipsum`, `...`
- the whole value sits in `[...]`, `<...>`, or `{...}` and is short or names a kind of thing: `[question]`, `<question>`, `[ACTUAL question from the reviewer]`, `[name]`
- an instruction to a future author: starts with describe, insert, paste, enter, provide, write, add, fill, replace, record, state, give, list, supply, specify
- example wording: "for example: ...", "e.g. ...", "such as ...", "sample ..."
- slot language: "goes here", "their response", "the reviewer's question", "brief description of", "ACTUAL"
- an unfilled slot embedded in otherwise real text: `Reviewed by [name] on 2026-09-12`
- too short to carry meaning (fewer than four words for a free-text field)

What SATISFIED looks like: a specific sentence a person wrote. A reviewer description names who they are in relation to the material ("PCC classmate who has taken the SQL course"); an interview question is a question someone could be asked; an understanding statement explains the project in the reviewer's words.

Brackets are one signal, not the test. Judge whether the text is the thing or a description of the thing.

## Statuses

| Status | Meaning |
|---|---|
| `SATISFIED` | the field's own content meets the criterion (verified, not asserted) |
| `OWNER APPROVAL REQUIRED` | waiting on the owner's acceptance of a deliverable |
| `OWNER DECISION REQUIRED` | waiting on an owner choice (provenance, copy, scope) |
| `HUMAN EVIDENCE REQUIRED` | waiting on a third party's words or actions |
| `MISSING` | required content absent or placeholder; the row also names who supplies it |
| `BLOCKED` | cannot be satisfied now for a stated external reason (tooling, access) |
| `NOT REQUIRED` | explicitly outside this gate (recorded so nobody adds it later as a blocker) |
| `NOT OPENED` | the next phase; always present at the bottom of the note |

The gate verdict: `SATISFIED` when every required item is SATISFIED; otherwise `BLOCKED`, and PASS is not recorded.

## Canonical note: `AIDOCS/Phase <N> - Owner Gate.md`

One note per active phase, created when the phase reaches its exit gate (or by the first `/phase gate` run) and edited in place with targeted edits. It uses explicit status fields, never blank slots that could be mistaken for data.

```
---
type: project
status: active
project: "[[Khaylub.com]]"
tags: [khaylub-com, phase-<n>, owner-gate]
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
# Phase <N> - Owner Gate

> Criteria recovered from [[16 - Gated Phase Roadmap#Phase <N> - <title>]] (acceptance criteria and verification procedure) on <date>. Statuses per the /phase skill's owner-gate rule; validated with scripts/gate.mjs.

## Criteria

- <Criterion label> status: SATISFIED | MISSING | ...
- <Criterion label>: <the evidence itself, or "MISSING" when absent>
- <Criterion label> source: <where the evidence is recorded>

(repeat per criterion; human-evidence criteria carry one line per field the reviewer must supply)

## Owner clarifications

(decisions about the gate's scope, dated, quoted)

## Verdict

- Gate status: BLOCKED | SATISFIED
- PASS recorded: NO | YES (<date>, owner's words)
- Next phase status: NOT OPENED
- Next phase: Phase <N+1>, <title>; opens only by /phase <N+1>
```

Rules for the note:
- `status:` lines carry the status; the bare `Field:` line carries the content. When content is absent write `MISSING` on the content line, never a bracket or an example.
- A field may be set to SATISFIED only after `scripts/gate.mjs` accepts its content; the script downgrades a SATISFIED declaration with placeholder content to MISSING, and the note must then be corrected.
- Every dated owner statement about the gate goes under "Owner clarifications" verbatim, including a statement that evidence exists when the content shows it does not.
- The note is linked from the MOC state block ("Owner gate:" line) so a reader can open it in one click.

## Recovering criteria

For phase N read the roadmap's `Acceptance criteria` and `Verification procedure` lines and the documents they name (for a journey, the story map's exit condition). Each clause becomes a criterion with a kind: owner-approval (the owner signs or accepts), human-evidence (a named third party produces something), owner-decision, verification (a command or CI result), or not-required (things a reader might assume belong to the gate but the owner has ruled out, recorded with the owner's words). Do not carry criteria from one phase to the next; recover them fresh each time. Nothing in the skill names a specific journey or reviewer.

## How the three forms use it

- `/phase gate`: recover the criteria, read or create the note, run `node .claude/skills/phase/scripts/gate.mjs "<note>"`, print the table of every criterion with its status, then the unresolved list (required items not SATISFIED, each with who supplies it), then the verdict. Update the note's `updated:` date and any status the script corrected. Change nothing else.
- `/phase close`: runs `/phase gate` first. Completes every closeout action that does not depend on PASS (merge verification, `main` guard, CI, branch cleanup, checkpoint closeout section, MOC facts, daily note). Records PASS in the MOC, roadmap, and checkpoint only when the verdict is SATISFIED and the owner has recorded acceptance; otherwise writes "PASS not recorded: <unresolved list>" and stops with the exact fields still required. Never converts placeholder text into evidence, and never records PASS on an owner statement that a requirement is complete while the fields are visibly absent.
- `/phase resume`: if the pull request is merged, `main` verified, and no plan task is open, the state is `OWNER GATE`; report it, point to `/phase gate`, and do not rerun implementation.
