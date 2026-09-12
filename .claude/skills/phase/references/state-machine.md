# Phase state machine

Classify from evidence, never from one note. Read every source, then pick the state whose conditions all hold. When sources disagree, Git and GitHub win on code and pull-request facts; the MOC gate log wins on owner acceptance (only the owner records PASS); the newest checkpoint wins on what was last verified.

## Sources

| Source | Where | Tells you |
|---|---|---|
| MOC state block | `DOCS/Khaylub.com V2 - Planning MOC.md`, `## State block`: rows "Current phase", "Phases accepted", "Last accepted gate", "Exact next action", "Last verified" | what the owner last recorded |
| MOC gate log | same note, `## Gate log`, newest rows at the bottom | the chronology of opens, builds, PASS marks, merges |
| Roadmap | `DOCS/16 - Gated Phase Roadmap.md`, `## Phase N` | the boundaries; the header lists completed phases (may lag the MOC; the MOC is newer) |
| Plan | `DOCS/<NN> - Phase N Implementation Plan.md` | tasks with checkboxes; classification |
| Checkpoint | `AIDOCS/<date> - V2 Checkpoint - Phase N <name>.md` | verified facts, ledger, owner items, "Resume here", closeout sections appended later |
| Evidence folder | `AIDOCS/<date> - V2 Phase N evidence/` | screenshots, `pull-request-body.md`, review notes |
| Git | `git fetch --prune; git status --porcelain; git rev-parse HEAD origin/main; git branch -a --merged origin/main; git log --oneline origin/main -5` | current `main`, branches, containment |
| GitHub | `gh pr list --state all --limit 15 --json number,title,state,headRefName,mergedAt,mergeCommit`; `gh run list --branch <b> --limit 3 --json headSha,conclusion,name` | pull-request state, merge commit, CI |
| Verify stamp | `.claude/verify-stamp.json` (`head`, `finished`, `steps`) | which commit last passed the full list |
| CLAUDE.md pointer | `## Current phase pointer` | what the repository believes is next (updated by pull request at each closeout) |

## States

| State | All of these hold |
|---|---|
| `NOT OPENED` | no gate-log row opens phase N; no `feat/phase-<n>-*` branch local or remote; no plan document for N; the MOC "Exact next action" does not say N is in progress |
| `OPEN / PLANNING` | a gate-log row or checkpoint says the owner opened N; the plan document is missing or has no completed task; the branch may or may not exist |
| `IMPLEMENTING` | branch `feat/phase-<n>-*` exists with commits beyond `main`; plan tasks partly checked; no full-verification stamp on the branch tip, or the checkpoint says work remains |
| `BUILT / EXIT GATE` | verify stamp `head` equals the branch tip, tree clean, checkpoint sections through verification and browser acceptance written, no pull request yet (or the body prepared in the evidence folder) |
| `PR OPEN` | `gh pr list` shows an OPEN pull request from the phase branch; CI conclusion known |
| `PR MERGED / CLOSEOUT PENDING` | the pull request is MERGED (`mergedAt`, `mergeCommit` set) but any of: local `main` behind `origin/main`, no post-merge guard run on the merge commit, no closeout section in the checkpoint, MOC still says PENDING, CLAUDE.md pointer still names N as current, phase branch still present |
| `ACCEPTED / CLOSED` | MOC gate log has the owner's PASS row for N's exit gate; closeout section exists; post-merge guard green on `main` at or after the merge commit; branch deleted; CLAUDE.md pointer names N+1 as next and NOT OPENED |

A phase can be `PR MERGED` and still not accepted: a merge is the owner accepting the code into `main`, PASS is the owner closing the gate. Phase 12 on 2026-09-12 is the example: PR #17 merged, corrections on a `fix/` branch, acceptance still pending a human Journey 3 reader. Report both facts; never infer PASS from a merge.

Split verdicts are normal. Phase 11 closed its software scope while its content deliverable stayed open on the owner's side. Record the split in the checkpoint and MOC exactly as the owner stated it; an open owner item that the owner marked non-blocking does not stop the next phase from opening.

## Reconciliation

1. Build the chronology from Git and GitHub (commit dates, `mergedAt`, CI run times).
2. Compare with the gate log and the newest checkpoint. Note each statement that is now stale (for example "pull request not yet opened" after a merge).
3. Fix documentation only for proven facts: append a dated update row or section, keep the original sentence and mark it superseded where the context needs it, never delete history.
4. If a fact cannot be proven (an owner acceptance that is implied but not written), leave the state at the lower level and put the question in the report.
5. Never move the MOC to PASS, COMPLETE, or CLOSED without the owner's recorded words or a merge the owner made plus their explicit acceptance instruction.
