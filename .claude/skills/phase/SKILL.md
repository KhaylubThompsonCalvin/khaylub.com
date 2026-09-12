---
name: phase
description: Use when the owner types /phase <number>, /phase resume, /phase gate, or /phase close for Khaylub.com V2. Runs one roadmap phase end to end from the vault's Gated Phase Roadmap and Planning MOC: recover the true current state from the vault, Git, and GitHub, plan, implement, verify, document, and stop at the owner's gate. Never auto-triggers; opening or closing a roadmap gate is always the owner's explicit call.
argument-hint: <number> | resume | gate | close
disable-model-invocation: true
---

# /phase: roadmap-driven phase runner for Khaylub.com V2

`$ARGUMENTS` is one of: a phase number (`/phase 13`), `resume`, `gate`, or `close`. Anything else: explain the four forms and stop.

The phase definition is never in this skill. It lives in the vault: `16 - Gated Phase Roadmap.md` (the boundaries), the documents and ADRs each phase names (the detail), `Khaylub.com V2 - Planning MOC.md` (where the project stands), and the dated checkpoints (history). CLAUDE.md holds the permanent repository rules and applies in full; this skill only adds the procedure. Git and GitHub are the truth for what code and pull requests exist; never trust a SHA written in a note when `git` and `gh` can tell you the current one.

Announce at start: "Using /phase (<form>) to <purpose>."

## 0. Locate the record

1. Read `CLAUDE.md` in full.
2. Locate the vault. Its path is deliberately not written in this repository (machine paths are banned by the guard). Use, in order: the `KHAYLUB_VAULT` environment variable; a directory under the user's home whose path ends in `01 Projects/Khaylub.com` and contains `docs/V2/16 - Gated Phase Roadmap.md`; otherwise stop and ask for the path (this is the one question the skill may ask before doing anything).
3. Set `DOCS` = `<vault>/01 Projects/Khaylub.com/docs/V2` and `AIDOCS` = `<vault>/01 Projects/Khaylub.com/ai-docs`. Read the MOC state block (`## State block`) and gate log (`## Gate log`) from `DOCS/Khaylub.com V2 - Planning MOC.md`, and the roadmap header, `## Khaylub.com V1 → V2 reminder`, and the target phase's `## Phase N` section from `DOCS/16 - Gated Phase Roadmap.md`.
4. Establish Git and GitHub facts: `git fetch --prune`, `git status --porcelain`, `git rev-parse HEAD origin/main`, `git branch -a`, `gh pr list --state all --limit 15 --json number,title,state,headRefName,mergedAt,mergeCommit`, and the latest CI conclusion on `main` and on any open phase branch (`gh run list --branch <b> --limit 3`).
5. Classify the phase state with [references/state-machine.md](references/state-machine.md). Write one line: "Phase N is <STATE> because <evidence>." If the sources disagree, reconcile the chronology from Git and GitHub first, then fix only the documentation that is proven wrong (append, never rewrite history).

Report the recovery result as the first progress update.

## 1. Form: `/phase <number>`

This is explicit authorization to OPEN exactly phase N. Never open a different phase, and never open N when the gate before it is not closed.

1. **Prior gate check.** Phase N-1 (and any dependency the roadmap names) must be `ACCEPTED / CLOSED`: the MOC gate log records the owner's PASS, its pull requests are merged, its closeout section exists, and the CLAUDE.md pointer names N as next. Owner content items recorded as open but explicitly non-blocking (as Phase 11's content count was for Phase 12) do not block. If the prior gate is not closed: do every useful recovery step (state report, what exactly is missing, prepared closeout if the merge happened), record it, and stop with the blocker. Do not open N.
2. **Recover the definition.** Copy the phase's objective, inputs, tasks, deliverables, verification procedure, acceptance criteria, dependencies, risks, out of scope, and exit gate from the roadmap verbatim into your working notes, then read every document it names (requirements documents, ADRs, wireframes, story-map journeys, inventories). Phase 13 and Phase 21 also require the reminder section; see section 7.
3. **Startup gate.** Follow [references/startup-gate.md](references/startup-gate.md). Create `feat/phase-<n>-<slug>` from the verified current `main` only after it passes.
4. **Plan.** Next document number = highest `NN - ` prefix in `DOCS` plus one (do not hard-code it). Write `DOCS/<NN> - Phase <N> Implementation Plan.md` following [references/vault-records.md](references/vault-records.md): recovered scope verbatim, requirement classification (`ALREADY SATISFIED`, `EXTEND`, `BUILD`, `OWNER CONTENT BLOCKED`, `DEFERRED BY ROADMAP`, `NOT SPECIFIED`), and for each `BUILD` or `EXTEND` item the source requirement, current implementation, gap, likely files, verification, and acceptance evidence. Use `superpowers:writing-plans` when it is installed (check the skill list; do not assume). Open the checkpoint note at the same time with the gate state and the "Resume here" block, so a compaction during planning loses nothing.
5. **Execute** per section 4, then **verify and stop** per section 5.

## 2. Form: `/phase resume`

1. Identify the OPEN phase: the MOC state block, the newest `feat/phase-*` or `fix/*` branch, open pull requests, and the newest checkpoint's "Resume here" block. If GitHub shows the phase's pull request merged since the checkpoint was written, the phase is `PR MERGED / CLOSEOUT PENDING`: say so, update the checkpoint, and offer `/phase close` as the next owner step while finishing any non-owner work the checkpoint still lists.
2. If the pull request is merged, `main` is verified, and no plan task is open, the state is **`OWNER GATE`**: report it in one line, run the `/phase gate` form (section 2a), and stop with the unresolved list. Do not rerun implementation, reviews, or browser acceptance.
3. Otherwise determine where execution stopped from the plan's checkboxes, the branch log, the verify stamp (`.claude/verify-stamp.json`, `head` versus `HEAD`), and the checkpoint. Do not redo completed tasks; re-verify them only as the guard requires. Continue through section 4 and section 5 to the exit gate.

## 2a. Form: `/phase gate`

Read-only except for the canonical gate note. Follow [references/owner-gate.md](references/owner-gate.md): recover the current phase's acceptance criteria and verification procedure from the roadmap and the documents they name (fresh each run; nothing is hard-coded), read or create `AIDOCS/Phase <N> - Owner Gate.md`, run `node .claude/skills/phase/scripts/gate.mjs "<note>"`, and print: every criterion with its status; the unresolved list (required items not SATISFIED, each with who must supply it); the verdict (`SATISFIED` or `BLOCKED`); the next phase as NOT OPENED. Placeholder, template, example, or instructional text in a required field is MISSING even if a message calls it real evidence; record the message under "Owner clarifications" and keep the field MISSING.

## 3. Form: `/phase close`

Only after the owner has merged or accepted. Run the `/phase gate` form first. Then follow the close procedure in [references/startup-gate.md](references/startup-gate.md): confirm the merge on GitHub, fast-forward `main`, prove tree parity with the accepted branch tip, run `node .claude/hooks/verify-guard.mjs full` on merged `main`, confirm CI on the merge commit, delete only fully merged local branches and prune, append the closeout section to the checkpoint, update the MOC facts, preserve every separately open owner or content item. **Record PASS (MOC gate log and state block, roadmap status, checkpoint, CLAUDE.md pointer on `chore/phase-<n>-closeout-pointer` by pull request) only when the gate verdict is SATISFIED and the owner has recorded acceptance.** If any required item is MISSING or BLOCKED: complete every independent closeout action anyway, write "PASS not recorded" with the exact fields still required, leave the state at `OWNER GATE / ACCEPTANCE PENDING`, and stop. An owner statement that a requirement is complete never substitutes for the evidence fields when they are visibly absent. Report the next phase as NOT OPENED. Do not open it.

## 4. Execution contract

The owner may be away. Behave accordingly:

- The authorized roadmap phase is the whole scope: recover it, do not narrow it, do not widen it. Later-phase work waits; discovered bugs and improvements outside the phase go into the checkpoint's follow-up list, not into the diff. Accepted earlier phases are foundations; never rebuild what the roadmap lists only as history.
- For reversible actions the phase already implies (branch, edits, tests, commits on the phase branch, vault notes, pushing the phase branch, opening its pull request), proceed. Do not stop to announce a next step you are authorized to take. Before finishing, reread your last paragraph: if it describes work still to do, do it.
- Stop only for: a destructive or irreversible action not authorized; credentials or access only the owner holds; an owner factual, provenance, or copy decision; a roadmap scope change; the owner's acceptance gate; a production or deployment action gated to a later phase; anything the roadmap reserves for the owner. When one item is owner-blocked, finish every independent item first, then stop with the exact question.
- Conflicts between documents: name the conflict, apply the roadmap boundary and the accepted architecture (ADRs, CLAUDE.md), record the reconciliation in the plan, never choose silently. Missing information: follow the referenced documents, the accepted code, and prior checkpoints; if still absent, classify `NOT SPECIFIED` or `OWNER BLOCKED`. Never invent a requirement.
- Capabilities: at the start of the phase list the skills, plugins, MCP servers, and agent types actually available (the session's skill list and settings). Select only those that materially help: planning, TDD, systematic debugging, code review, security review, Playwright acceptance, branch finishing, simplification review. Do not invoke a skill to raise a count. Record every decision in the checkpoint's skill and capability ledger (available, selected, invoked, task, evidence, skipped reason).
- Subagents: use independent agents for code review, security review, factual or content review, accessibility review, broad search, and independent acceptance reading. Launch independent work in parallel and keep working while it runs; never parallelize dependent steps; verify every agent report against the diff before relying on it.
- Editing: prefer targeted edits over whole-file rewrites, especially in the MOC, the roadmap, checkpoints, and configuration. Append update and closeout sections to old checkpoints; never rewrite a historical statement because a later fact exists.
- Tests: follow neighbouring suites; TDD where behaviour changes; committed tests proportionate to the behaviour; systematic debugging for real failures; never weaken a test, guard, CSP, accessibility rule, threshold, or security assertion to pass.
- Progress updates at milestones only: recovery result, plan written, each major implementation section, an important defect, verification and review status, exit-gate status.
- Compaction resilience: whenever a milestone lands, and before any long run, write the checkpoint's "Resume here" block with the scope, owner decisions, rejected alternatives, branch and SHAs, completed tasks, failed attempts and fixes, blockers, exact next step, phase boundaries, and hard-to-reconstruct links and numbers. The vault checkpoint, not the conversation, is the recovery record.

## 5. Exit gate

Before declaring the software exit gate reached:

1. Reviews appropriate to the phase (full diff, code, security, accessibility, factual or content, dependency, scope leak). Fix what they find, re-verify.
2. Browser acceptance with the Playwright capability when user-facing behaviour changed: the roadmap's named journey, desktop 1440 by 900 and phone 390 by 844, keyboard, overflow, console, failed requests, relevant accessibility. Serve `dist/` with the header server on a port other than 4173 and stop it afterwards; move screenshots to the evidence folder. Unit tests never substitute for a required browser gate.
3. `node .claude/hooks/verify-guard.mjs full` on the final commit with a clean tree (or its canonical replacement if CLAUDE.md changes it). Kill stale servers on 4173 and 4174 first.
4. Commit coherent verified changes, push the branch, attempt the pull request through the existing workflow (`gh pr create` or the GitHub MCP; the hook enforces the stamp). If the token refuses, do not touch credentials: write the title and body to the evidence folder as `pull-request-body.md`, give the compare URL, and continue with every remaining non-owner task. Never merge.
5. Vault: checkpoint complete (sections per [references/vault-records.md](references/vault-records.md)), evidence folder populated, MOC state block and gate log updated with facts that occurred (built, verified, PR state, acceptance PENDING), prior-phase open items and the V1 → V2 reminder preserved, wiki-links resolving, no em dashes. Commit the vault with `docs(khaylub): <phase> <what>` excluding `.obsidian/`, `.playwright-mcp/`, `Untitled*` canvas and base files, and other projects.
6. Report with the template in [references/exit-report.md](references/exit-report.md) and stop. The next phase opens only by `/phase <number>` from the owner.

## 6. Verification before any claim

No "done", "passes", or "PASS" without the command output in the conversation. CI green on the pushed branch is evidence; "should pass" is not. Owner acceptance is recorded by the owner, never by this skill, and only over evidence that `scripts/gate.mjs` accepts: content that is the evidence, not a placeholder, a template, an example, an instruction, or a claim about evidence ([references/owner-gate.md](references/owner-gate.md)).

## 7. Production boundary

Whatever the phase, never alter DNS, Namecheap, Cloudflare, Render production, the public V1 site, the `khaylub-portfolio` repository, production secrets, or public domain routing unless the authorized phase explicitly owns that action and the owner has passed its deployment gate. Phase 13 integrates the real V1 climb into V2 as an opt-in island and leaves V1 untouched; Phase 21 is the production cutover of `khaylub.com`. Integration is not cutover. Reread the roadmap's reminder section before opening either.
