# Reports

Every value is a verified fact from this session with its evidence (command output, run id, SHA, file). No "should". Owner acceptance is never asserted by the report.

## Exit-gate report (`/phase <number>` and `/phase resume`)

1. Phase: number and roadmap title
2. Recovered official objective (roadmap wording)
3. Branch and starting `main` SHA
4. Final commit SHA; commits on the branch
5. Pull request: number and URL, or compare URL with the body's location; CI conclusion on the tip
6. Software verdict: BUILT and verified, or what remains; never PASS
7. Content or owner verdict when separate (counts against the deliverable, owner blockers)
8. Major deliverables, mapped to the roadmap's deliverables list
9. Tests: suites added or changed, totals, skips by design
10. Browser acceptance: journey, viewports, findings, screenshot names
11. Accessibility: axe result, keyboard, targets, reduced motion
12. Security and audit: review result, `npm audit` result, CSP unchanged
13. Verification guard: `node .claude/hooks/verify-guard.mjs full` steps and timings on the final SHA
14. Vault documentation: plan, checkpoint, evidence folder, MOC rows, vault commit SHA
15. Blockers: each with its class (owner decision, credentials, tooling, roadmap)
16. Exact owner action: the shortest list that reaches the exit gate (open or merge the pull request, decide X, record "Phase N PASS")
17. Exact next gate: "Phase N+1, <title>: NOT OPENED; opens only by `/phase <N+1>`"
18. Confirmations: not merged by Claude; production, DNS, Render, V1 untouched; no later-phase work in the diff

## Close report (`/phase close`)

1. Pull request number, merge commit, `mergedAt`, who merged
2. `main` SHA local and remote; tree parity with the accepted branch tip
3. Post-merge guard result on `main` (steps, timings, test totals)
4. CI on the merge commit
5. Branches deleted and pruned; branches deliberately kept and why
6. Checkpoint closeout section; MOC state block and gate log rows; daily note entry; vault commit SHA
7. CLAUDE.md pointer branch, commit, pull request or compare URL
8. Owner or content items that stay open, verbatim from the checkpoint
9. Next phase: number and title, NOT OPENED, opens only by `/phase <number>`

## Blocker report (prior gate not closed, or `/phase resume` with nothing open)

1. Requested form and argument
2. State of the phase the request depends on, with the evidence per source
3. What is missing to close it (owner PASS, merge, closeout, pointer)
4. What was done anyway (recovery, prepared closeout, documentation fixes)
5. The exact owner action, and the command to run afterwards
