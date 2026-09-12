# Git gates

Commands are Git Bash. Ports: 4173 is the test and guard server; 4174 is the manual evidence server. Both must be free before the guard runs.

## Startup gate (before opening a phase or resuming onto a new branch)

```
git fetch --prune
git checkout main
git pull --ff-only origin main
git status --porcelain            # must be empty (untracked scratch files are the only tolerated noise; none inside src/, content/, public/, tests/)
git rev-parse HEAD origin/main    # must be equal; this is the current accepted main, record it in the plan
git merge-base --is-ancestor <prior phase merge commit> HEAD && echo contained
git branch -a                     # stale feat/ or fix/ branches: list them in the report; delete only local branches already merged (git branch -d)
netstat -ano | grep -E ':417[34] '   # stale header servers: taskkill //PID <pid> //F
ls tests/fixtures                 # fixtures present and unchanged (git status clean covers this)
npm run check
npm run validate
```

Run the full list (`node .claude/hooks/verify-guard.mjs full`) at startup when the previous phase's closeout did not already record a green run on this exact `main` SHA, or when `main` moved since. Otherwise check and validate are enough to prove a clean starting point; say which you did.

Then, and only then: `git checkout -b feat/phase-<n>-<slug> main`. Naming follows CLAUDE.md: `feat/phase-<n>-<slug>` for phases, `fix/<slug>` for corrections, `chore/<slug>` for docs and configuration.

Never write the previous day's `main` SHA into a plan or a branch instruction; read it from `git rev-parse origin/main` every time.

## Commits and pushes on the phase branch

- Conventional subjects; the verify-guard hook scans every commit (em dashes, credential patterns, machine paths, secret files) and runs check plus validate when build inputs are staged.
- Commit when a task is green, not before. Push the branch (`git push -u origin <branch>`) at milestones; never force-push, never push to `main`.
- Screenshots from the Playwright MCP land in the repository root or `.playwright-mcp/`; both are ignored. Move them to the vault evidence folder before committing so they are never swept into a commit.

## Pull request

```
node .claude/hooks/verify-guard.mjs full        # writes .claude/verify-stamp.json for HEAD on a clean tree
git push -u origin <branch>
gh pr create --title "<type>(phase-<n>): <subject>" --body-file <prepared body>
```

The hook blocks `gh pr create` and the GitHub MCP `create_pull_request` unless the stamp matches HEAD on a clean tree. If the call is refused by the token (403 "Resource not accessible by personal access token" has been the case for every pull request so far): do not change the token or its permissions; save the title and body as `pull-request-body.md` in the evidence folder; report the compare URL `https://github.com/KhaylubThompsonCalvin/khaylub.com/compare/main...<branch>`; continue with every remaining non-owner task.

Confirm CI on the pushed branch: `gh run list --branch <branch> --limit 3 --json headSha,conclusion,name,status`.

## Close gate (`/phase close`)

```
gh pr view <n> --json number,state,mergedAt,mergeCommit,headRefOid,additions,deletions,changedFiles
git fetch --prune
git checkout main && git pull --ff-only origin main
git rev-parse HEAD origin/main                         # equal, and equal to the merge commit or later
git diff <branch tip> main --stat                      # empty when nothing else merged: tree parity with the accepted branch
node .claude/hooks/verify-guard.mjs full               # post-merge verification on main
gh run list --branch main --limit 3 --json headSha,conclusion,name,status
git branch -d feat/phase-<n>-<slug>                    # -d only: refuses if not fully merged; never -D
git remote prune origin
```

Then the documentation steps in SKILL.md section 3 and the CLAUDE.md pointer on `chore/phase-<n>-closeout-pointer` (docs-only commit, push, pull request or compare URL). Report the next phase as NOT OPENED.
