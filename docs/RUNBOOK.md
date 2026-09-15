# Khaylub.com V2 runbook: staging, the V1 exhibit, the rehearsal, cutover, rollback

This runbook is executed by the owner. Every step marked **Owner** touches an account, a host, a
DNS record, or the V1 repository, none of which this repository can reach. Every value to record
has an empty cell in a table; fill it during the run. A step that needed an action not written here
is a runbook defect: fix the runbook before calling the run accepted (Phase 19's acceptance
criterion is "runbook executed once end to end without improvisation").

Sources: the deployment strategy (vault document 15), ADR-005 (hosting), ADR-009 (the V1 exhibit),
the security requirements (document 23, P2-SEC-01 to P2-SEC-04), the V1 audit (document 02).

## 0. What this runbook is and is not

- Phase 19 (this phase): staging for V2 on a non-production hostname, the V1 exhibit on its own
  subdomain, security headers verified on both, the rollback rehearsed and timed, the uptime check.
  Sections 1 to 5, 7, and 9.
- Phase 21 (later): the production move of `khaylub.com` from V1 to V2. Section 6 carries those
  steps so they are rehearsed here; **they are not executed in Phase 19.** Integration is not
  cutover. Nothing in Phase 19 changes the apex or `www` records, the live V1 service, or the V1
  repository's `main`.
- The V1 repository (`khaylub-portfolio`, tag `v1.0.0-3d-experiment`, locked branch
  `legacy/v1-3d-experiment`) stays frozen; the exhibit is built from the tag.
- The Content Security Policy stays Report-Only until cutover; section 8 is the switch, executed
  only after a clean staging log and the owner's go, by pull request.

## 1. Staging on Render (Owner)

Facts the repository already fixes (`render.yaml`, the Blueprint): service `khaylub-com-v2`, static
site, build `npm ci && npm run build`, publish `dist`, Node `22.14.0`, pull-request previews
enabled, four redirects, the security headers, the CSP Report-Only policy with the climb and search
exceptions, the cache tiers. Render keeps dashboard rules not listed in the Blueprint (document 15
section 3, from Render's Blueprint documentation as read on 2026-09-07); do not add any so the
repository stays the only source of truth.

1. **Owner:** in the Render dashboard, New, Blueprint, connect the `khaylub.com` repository
   (GitHub), branch `main`. Render reads `render.yaml` and proposes the service; confirm the fields
   above match. Approve the creation. (CLAUDE.md: creating a Render service is the owner's action.)
2. **Owner:** wait for the first deploy; open the default URL Render assigns
   (`<service>.onrender.com`). HTTPS is automatic. This URL is the staging host per ADR-005 and
   decision D-14. A branded `v2.khaylub.com` is optional: the free workspace includes two custom
   domains, reserved for `khaylub.com` and `www` at Phase 21, and each further domain is $0.25 per
   month (document 15 section 3, from Render's static-sites pricing page as read on 2026-09-07;
   re-check the page before choosing). If chosen, add it under Custom Domains and create the
   CNAME at Namecheap as Render instructs; record it below.
3. **Owner:** open a throwaway pull request (any docs-only change) and record the preview URL
   Render creates and its pattern; close the pull request and confirm Render deletes the preview.
4. **Owner:** read the workspace billing page (bandwidth and pipeline minutes) and record the
   allowances; document 15 marks them UNVERIFIED.

| Record | Value |
|---|---|
| Service name | |
| Staging URL (default `onrender.com`) | |
| Branded staging hostname (optional) | |
| First deploy id and date | |
| Preview URL pattern (from step 3) | |
| Preview deleted on close (yes/no) | |
| Preview response carries `X-Robots-Tag` (document 15 section 4 expects noindex on preview hosts; unverified until read here) | |
| Billing allowances read (bandwidth, pipeline minutes) | |
| Dashboard rules present beyond the Blueprint (must be none) | |

Staging indexing: the default `onrender.com` staging serves the production build (`robots.txt`
allows). Search engines can find it. Two options, record the choice: (a) accept it until cutover
(the canonical tags point at `https://khaylub.com`, so duplicates resolve to production), or (b)
set `PUBLIC_SITE_ENV=preview` on the service so staging serves the preview build (`Disallow: /`,
`noindex`, no sitemap) and switch it off at Phase 21. Know what a preview build also does: it
renders draft artifacts and tolerates unresolved wikilinks (flagged in place) where the production
build refuses them, so staging under option (b) is not byte-for-byte the production build; section
6 step 3 switches it off and rescans before cutover. Option (b) is the safer default for indexing.

| Staging indexing choice | |
|---|---|

## 2. Verify staging (Owner runs; the tools are in this repository)

1. Header scan, from a clone of this repository at the deployed commit:

   ```
   npm ci
   npm run headers:scan -- https://<staging-url> --samples 5
   ```

   Expected: `scanned 13 paths x 5 samples, 0 mismatches, 0 errors, 0 inconsistent`, with or
   without option (b): the headers come from `render.yaml` and do not vary by build. (The scan's
   `--preview` flag expects the `X-Robots-Tag` header that only the local header server adds; do
   not use it against a host.) With option (b), also confirm `https://<staging-url>/robots.txt`
   reads `Disallow: /` and the home page's source carries
   `<meta name="robots" content="noindex, nofollow">`.

   How to read a failure:
   - `MISMATCH` on every sample of a path: Render applied a rule differently from the local
     header server. Record the line and fix `render.yaml` by pull request, never in the dashboard.
     Render's documented matching is in `scripts/render-paths.mjs`: a single `*` never crosses a
     slash, `**` does, a trailing `/*` covers a subtree, and an exact rule for a non-root directory
     path (`/climb/`) never matched on staging, so section paths are subtree rules.
   - `INCONSISTENT`, or a `MISMATCH` that no rule in `render.yaml` can produce: the host is not
     serving the committed rule set, which is not a rule defect. Observed on 2026-09-14: on the
     first deploy every path-specific rule applied on about half of the requests and the `/*`
     rules on all; after the next deploy, responses still carried a header pair that only the
     previous deploy's rules could produce, and the set of rules being applied changed over an
     hour with no repository change (same result from Node, curl, and a browser over HTTP/2).
     Do, in order:
     1. **Owner:** open the service's **Headers** tab and compare it with `render.yaml`, rule by
        rule (path, name, value, count). Render documents that a Blueprint sync "preserves any
        existing header rules that are not included in the Blueprint file" (Blueprint
        specification, read 2026-09-14), so every rule that a pull request removed or renamed
        (for example `/climb/*` for Cache-Control, or `/climb/` and `/search/` for the policy)
        is still there next to its replacement. Record the leftovers in the table below.
     2. **Owner:** delete each leftover in the Headers tab (this is the one dashboard edit the
        runbook allows: it restores the repository as the only source of truth; add or change
        nothing). Redeploy once ("Manual Deploy", latest commit) and scan again with samples.
     3. If the tab already matched the file, or the scan is still inconsistent after step 2,
        open a Render support ticket with the scan output and the service name, and record the
        ticket. The gate stays blocked until the scan is consistent: the cache and policy
        requirements (documents 23, P2-SEC-01 to P2-SEC-04) hold only if every response carries
        them, and Phase 21 must not move the domain onto a host that serves them intermittently.

     Rule for every later change to `headers` or `routes` in `render.yaml`: after the merge,
     the owner deletes the removed or renamed rules in the dashboard and scans again; Render does
     not delete them for you.

   | Headers-tab audit (date; rules listed; leftovers found; deleted; ticket) | |
   |---|---|
   - `Strict-Transport-Security` never mismatches on Render's own domain: Render serves its
     stronger value (`max-age=315360000; includeSubdomains; preload`; `onrender.com` is on the
     HSTS preload list) and the scan accepts any value at least as strong as the declared floor.
2. Report-Only log: in a browser with the console open, visit Home, press "Enter the climb",
   visit `/climb/` and `/search/` and run a search. Expected: no `Content-Security-Policy-Report-Only`
   violation in the console. Any violation is a defect in the policy or the page; record it.
3. `https://securityheaders.com/?q=<staging-url>` (document 23 names it for Phase 19). This sends
   the staging URL to a third-party scanner; the site itself still makes zero third-party
   requests. Record the grade and any header it flags.
4. Lighthouse on the public URL (the throttled reports are archived from Phase 15; this is the
   public-URL run) and WebPageTest (the Phase 15 archive item deferred to this phase): record the
   result URLs.
5. Social-card debuggers on five pages (the Phase 17 item deferred to this phase): Home, Work, the
   V1 case study, the Fuel Economy data page, the Climb recording. Record the render result of
   each.
6. Rich Results Test on the public URL for the same five pages (the Phase 17 run used the built
   HTML; this is the URL run). Record the result.

| Record | Value |
|---|---|
| Scan output (paste the summary line; must read 0 mismatches, 0 errors, 0 inconsistent) | |
| Report-Only console: violations (must be none) | |
| securityheaders.com grade | |
| Lighthouse public-URL report | |
| WebPageTest result | |
| Card debugger results (five pages) | |
| Rich Results (five pages) | |

## 3. The V1 exhibit at v1.khaylub.com (Owner, in the V1 repository)

Per ADR-005 and ADR-009: GitHub Pages, built by an Actions workflow in `khaylub-portfolio` from the
tag `v1.0.0-3d-experiment`, `noindex` with a canonical link to the V2 case study (decision D-09).
Every step here is a change to the V1 repository or its settings and is the owner's (D-04 rules:
a branch, a pull request, a `v1.0.x` tag).

1. **Owner:** in the V1 repository, on a branch from the tag, add `.github/workflows/pages.yml`:

   ```yaml
   name: Exhibit (GitHub Pages)
   on:
     push:
       tags: ['v1.*']
     workflow_dispatch:
   permissions:
     contents: read
     pages: write
     id-token: write
   jobs:
     build:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with: { node-version: 22 }
         - run: npm ci
         - run: npm run build
         - uses: actions/upload-pages-artifact@v3
           with: { path: dist }
     deploy:
       needs: build
       runs-on: ubuntu-latest
       environment: github-pages
       steps:
         - id: deploy
           uses: actions/deploy-pages@v4
   ```

   Pin the action versions the V1 repository's Dependabot proposes at the time; do not copy
   versions from here blindly.
2. **Owner:** the D-09 `noindex`: add `<meta name="robots" content="noindex, nofollow">` and
   `<link rel="canonical" href="https://khaylub.com/projects/khaylub-com-v1/">` to the V1
   `index.html` head on the same branch (GitHub Pages cannot set response headers). This is a V1
   change; merge it by pull request and tag it `v1.0.1`, which triggers the workflow. Record the
   tag.
3. **Owner:** repository Settings, Pages: source "GitHub Actions"; custom domain `v1.khaylub.com`;
   enforce HTTPS after the certificate is issued.
4. **Owner:** at Namecheap, add `v1` CNAME to `<github-username>.github.io` (the value GitHub
   shows on the Pages page). TTL 300 for the rehearsal period.
5. **Owner:** verify the served build is the tagged one: the live `assets/index-*.js` filename and
   size match the build from the tag (the audit recorded `index-fyrvR9f9.js`, 1,101,249 bytes, for
   the frozen commit; a `v1.0.1` tag with the meta change rebuilds the same bundle unless the
   toolchain changed, so record the new name and size too), and `docs/V1_PRESERVATION.md` in the V1
   repository is updated with them.
6. Header scan against the exhibit: `npm run headers:scan -- https://v1.khaylub.com` **will report
   mismatches by design** (GitHub Pages sets no custom headers); run it to record what the exhibit
   serves, and note in the record that the exhibit's headers are a known, accepted gap (document 15
   section 3, H3).

| Record | Value |
|---|---|
| V1 tag that built the exhibit | |
| Workflow run URL | |
| `v1.khaylub.com` live (date, HTTPS enforced) | |
| Bundle name and size served | |
| `noindex` and canonical present (view source) | |
| Scan output against the exhibit (mismatches expected) | |

## 4. The rollback rehearsal, timed (Owner)

Purpose: prove the two rollback routes of section 7 and capture Render's exact behaviour when a
domain moves between services (document 15 marks it UNVERIFIED). Use a throwaway subdomain, never
the apex or `www`.

1. **Owner:** at Namecheap, create `rehearsal` CNAME to the V1 service (`khaylub-portfolio.onrender.com`),
   TTL 300. Wait for resolution (`nslookup rehearsal.khaylub.com`).
2. **Owner:** in the V1 Render service, add custom domain `rehearsal.khaylub.com`; wait for the
   certificate; open it and confirm the V1 site. Start the clock here.
3. **Owner:** in the V2 service, add the same domain. Record exactly what Render says (whether it
   requires removing it from the V1 service first, and the wording). Do what it says, then switch
   the CNAME to the V2 service's `onrender.com` host. Confirm the V2 site serves on the domain
   (`curl -I` shows the V2 headers). Stop the clock: this is "point staging at V2".
4. **Owner:** reverse it: remove the domain from V2 (if Render required exclusivity), re-add it to
   V1, switch the CNAME back. Confirm the V1 site. Stop the clock: this is the rollback.
5. **Owner:** delete the `rehearsal` record and remove the domain from both services.

| Step | Started (UTC) | Finished (UTC) | Minutes | Notes (exact Render prompt in step 3) |
|---|---|---|---|---|
| 2. Domain on V1, certificate issued | | | | |
| 3. Move to V2 (forward) | | | | |
| 4. Move back to V1 (rollback) | | | | |
| Total forward plus rollback | | | | target under 15 minutes for the rollback leg |

Improvisation log (any action not written above; each is a runbook defect to fix):

| Step | What was needed | Runbook fix made (commit) |
|---|---|---|
| | | |

## 5. The uptime check (Owner)

Per document 15 section 7: email alerts on production and the V1 subdomain. Any free monitor with
HTTP checks and email alerts is acceptable; it must not be embedded in the site (zero third-party
requests). Configure two checks now (staging until Phase 21, then production) and one for
`v1.khaylub.com`; interval 5 minutes; alert on two consecutive failures.

| Record | Value |
|---|---|
| Monitor service | |
| Check 1 URL (staging now; `https://khaylub.com` after Phase 21) | |
| Check 2 URL (`https://v1.khaylub.com`) | |
| Alert email confirmed (test alert received, date) | |

## 6. Cutover (Phase 21; carried here, not executed in Phase 19)

Rollback state to record before any of this: apex A `216.24.57.1`; `www` CNAME
`khaylub-portfolio.onrender.com` (document 15 section 6; re-read the live records at T-2 and
record them again, they are the truth).

1. T-7 days: Phase 20 acceptance signed. Verify domain ownership in Google Search Console for
   `khaylub.com` and the V1 subdomain.
2. T-2 days: lower DNS TTL on the apex and `www` records at Namecheap to 300 seconds. Record the
   current records (the rollback state).
3. T-1 day: confirm `v1.khaylub.com` serves the tagged V1 build; confirm the V2 service's
   `onrender.com` URL serves the release candidate; run the header scan (section 2 step 1) and
   Lighthouse on both. If staging ran the preview build (section 1, option b), switch
   `PUBLIC_SITE_ENV` off and redeploy; scan again.
4. T-0: in the V2 Render service add `khaylub.com` and `www.khaylub.com`; Render reports the
   required records. Remove the domains from the V1 service first if the rehearsal (section 4 step
   3) showed Render requires it. Update DNS.
5. T+15 min: `curl -I https://khaylub.com` shows the V2 build and headers (run the scan against
   `https://khaylub.com`); browse Home, Work, one case study, one media page on a phone over
   cellular; confirm the uptime check is green.
6. T+1 hour: submit the V2 sitemap in Search Console; confirm the V1 subdomain still resolves.
7. T+24 hours: review uptime and Render logs; restore TTL; record the cutover log in the vault.

## 7. Rollback (any step of section 6; rehearsed in section 4)

Route A (host side): re-add `khaylub.com` and `www` to the V1 Render service (remove them from V2
first if Render requires exclusivity, as captured in section 4). Route B (DNS side): revert the
apex and `www` records to the recorded rollback state. Target: under 15 minutes from the decision
to V1 serving again. Both routes leave V2 staging and the V1 exhibit untouched.

| Rollback executed (date, route, minutes) | |
|---|---|

## 8. The CSP switch (after a clean staging log; by pull request; owner's go)

Requirement P2-SEC-01: the Report-Only policy ships enforced before cutover. Preconditions: section
2 step 2 shows no violation on staging across Home, the climb, Search, a case study, a data page,
a video page, and the graph; decision D-21 stands (no reporting endpoint; Playwright collects
violations in CI); the owner says go.

1. In `render.yaml`, rename every `Content-Security-Policy-Report-Only` rule to
   `Content-Security-Policy` and append `; upgrade-insecure-requests` to each value (browsers ignore
   that directive in a report-only policy, which is why it is added only now).
2. Update `tests/headers.spec.ts` and `tests/security.spec.ts` to assert the enforced header name
   (the Playwright violation listener keeps working: an enforced policy raises the same event).
3. Pull request; CI green; the owner merges; Render redeploys staging; repeat section 2 steps 1
   to 3. The switch is complete when the scan passes and the console shows no blocked request.

Not done in Phase 19 unless the owner says go after the staging log is clean.

## 9. Record of executions

| Date | Who | Sections executed | Result | Improvisations (must be none for acceptance) |
|---|---|---|---|---|
| | | | | |
