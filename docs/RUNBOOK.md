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
- Automation first (owner decision, 2026-09-15): every check that a script can reproduce is run by
  the script named in the step, from a clone at the deployed commit, and its output is the record.
  The owner's own actions are only account authorisation, DNS and domain changes, provider
  decisions, acceptance, and visual judgement where no script can establish the requirement. Each
  step below is marked AUTOMATED, OWNER, or EXTERNAL (a third-party service with no key-free API).

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
   Capture the URL before merging: a merged pull request loses its preview at once (PR #38 proved
   the automatic creation and the destruction on merge on 2026-09-15; the URL and its
   `X-Robots-Tag` are captured from the next docs-only pull request, before it is merged).
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
2. AUTOMATED. The browser walk in a real Chromium against the deployed origin:

   ```
   npm run staging:verify -- https://<staging-url> --preview --out staging-verify-desktop.json
   npm run staging:verify -- https://<staging-url> --preview --mobile --out staging-verify-mobile.json
   ```

   (drop `--preview` when the host serves the production build). It loads every template route
   and fails on a non-200 or a console error; collects every Content-Security-Policy report-only
   violation per page (the `securitypolicyviolation` event and the console) and fails on any,
   quoting the policy the page was served under; types "climb" into search and requires results
   (Pagefind's WebAssembly under the `/search/*` policy); presses "Enter the climb" and requires
   zero scene bytes before the press and a model request after it; checks the indexing state
   (`Disallow: /`, the noindex meta, the banner, and no sitemap for the preview build) and labels
   a sitemap the build does not produce but the host still serves as a stale file from a previous
   deploy; and checks the five Open Graph cards of step 5 (tags present, the image a 1200 by 630
   PNG). Expected: `... 0 failure(s)`. Any `FAIL` line is the record; a policy violation that
   quotes the generic policy on `/`, `/climb/`, or `/search/` is the host serving the page without
   its path rule (the provider defect of the header scan above), not a policy error.
3. EXTERNAL, owner. `https://securityheaders.com/?q=<staging-url>` (document 23 names it for
   Phase 19; no key-free API). This sends the staging URL to a third-party scanner; the site itself
   still makes zero third-party requests. Record the grade and any header it flags. An enforced
   `Content-Security-Policy` shows as missing until section 8 runs; that is by design.
4. AUTOMATED (Lighthouse) and EXTERNAL (WebPageTest). Lighthouse on the public URL with exactly the
   Phase 15 profile and assertions of `lighthouserc.json` (mobile, five runs, the median, every
   budget line), the raw reports into the evidence folder:

   ```
   npm run lhci:staging -- https://<staging-url> <evidence-folder>/lighthouse-staging
   ```

   On the preview build, `categories.seo` and `is-crawlable` fail by design (the page is blocked
   from indexing); every other assertion must pass. Record the four scores per page and every
   failing audit by name. WebPageTest (the Phase 15 archive item deferred to this phase) runs
   non-interactively only with an API key: a keyless request to its API answers "missing API key.
   If you do not have an API key you can purchase one here: https://product.webpagetest.org/api"
   (read 2026-09-15). **Owner:** either provide a key as the environment variable `WPT_API_KEY`
   (never committed; `npx webpagetest test <url> -k $WPT_API_KEY --location <mobile location>`,
   then record the result URL and the first-view LCP, CLS, TBT, and total bytes), or run the test in
   the WebPageTest web form and record the same; or decide the Lighthouse public-URL run stands in
   for it and record that decision.
5. AUTOMATED (the cards) and EXTERNAL, owner (the debuggers). The five cards of the Phase 17 item
   (Home, Work, the V1 case study, the Fuel Economy data page, the Climb recording) are checked by
   step 2's script: tags present and the image served as a 1200 by 630 PNG. The third-party
   debuggers (the Facebook Sharing Debugger, the LinkedIn Post Inspector) need a signed-in
   account and show the rendered card; **Owner:** run them if the visual rendering is wanted as
   evidence, or record that the automated tag and image check stands in for them.
6. EXTERNAL, owner. Rich Results Test on the public URL for the same five pages (the Phase 17 run
   used the built HTML; this is the URL run; Google offers no key-free API). Record the result.
   The preview build's noindex does not stop the tool from testing the page.

| Record | Value |
|---|---|
| Scan output (paste the summary line; must read 0 mismatches, 0 errors, 0 inconsistent) | |
| `staging:verify` summary lines, desktop and mobile (must read 0 failure(s); a stale-file line is recorded, not accepted) | |
| securityheaders.com grade | |
| Lighthouse public-URL scores per page and failing audits (`lhci:staging`) | |
| WebPageTest result URL and first-view LCP, CLS, TBT, bytes (or the owner's stand-in decision) | |
| Card debugger results (five pages), or the stand-in decision | |
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
5. AUTOMATED. Verify the served build is the tagged one:

   ```
   npm run staging:verify -- https://v1.khaylub.com --exhibit
   ```

   prints the status, the title, the served `assets/index-*.js` bundle name and byte size, whether
   the noindex meta and the canonical link are present, and the HSTS header. The audit recorded
   `index-fyrvR9f9.js`, 1,101,249 bytes, for the frozen commit (the live V1 site served exactly
   that on 2026-09-15); a `v1.0.1` tag with the meta change rebuilds the same bundle unless the
   toolchain changed, so record the name and size the exhibit serves. **Owner:** update
   `docs/V1_PRESERVATION.md` in the V1 repository with them.
6. AUTOMATED. Header scan against the exhibit: `npm run headers:scan -- https://v1.khaylub.com`
   **will report mismatches by design** (GitHub Pages sets no custom headers); run it to record what
   the exhibit serves, and note in the record that the exhibit's headers are a known, accepted gap
   (document 15 section 3, H3).

| Record | Value |
|---|---|
| V1 tag that built the exhibit | |
| Workflow run URL | |
| `v1.khaylub.com` live (date, HTTPS enforced) | |
| `staging:verify --exhibit` line (bundle name and size, noindex, canonical) | |
| Scan output against the exhibit (mismatches expected) | |

## 4. The rollback rehearsal, timed (Owner)

Purpose: prove the two rollback routes of section 7 and capture Render's exact behaviour when a
domain moves between services (document 15 marks it UNVERIFIED). Use a throwaway subdomain, never
the apex or `www`. The DNS and Render domain actions are the owner's; the timing is AUTOMATED:
before step 1, start the watcher in a terminal and leave it running through step 5:

```
node scripts/rehearsal-watch.mjs rehearsal.khaylub.com --minutes 60
```

It polls the hostname every five seconds and prints a timestamped line at every change of the
answering site (V1, V2 by the headers `render.yaml` declares, a status, or unreachable) with the
seconds since the previous state; paste its output into the table and the record. Keep your own
note of the moment each dashboard or DNS action was made, so the table shows action time and
observed time.

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

| Step | Action made (UTC, owner) | Observed by the watcher (UTC) | Minutes | Notes (exact Render prompt in step 3) |
|---|---|---|---|---|
| 2. Domain on V1, certificate issued | | | | |
| 3. Move to V2 (forward) | | | | |
| 4. Move back to V1 (rollback) | | | | |
| Total forward plus rollback | | | | target under 15 minutes for the rollback leg |

Improvisation log (any action not written above; each is a runbook defect to fix):

| Step | What was needed | Runbook fix made (commit) |
|---|---|---|
| | | |

## 5. The uptime check (AUTOMATED, in this repository)

Per document 15 section 7: alerts on production and the V1 subdomain, from nothing embedded in the
site (zero third-party requests). `.github/workflows/uptime.yml` fetches each listed site every
thirty minutes and fails the run if any answer is not 200; a failed run notifies the repository
owner by email through GitHub's default workflow notifications. It lists staging now; the
production URL is added at the Phase 21 cutover and `v1.khaylub.com` when the exhibit is live
(each a docs-and-config pull request). **Owner:** after the workflow merges, run it once from the
Actions tab ("Run workflow") and record the run; confirm the GitHub notification setting that
emails failed workflow runs is on for this repository.

| Record | Value |
|---|---|
| First manual run (URL, result) | |
| Failure email setting confirmed (date) | |
| URLs listed (staging; production after Phase 21; the exhibit when live) | |

## 6. Cutover (Phase 21; carried here, not executed in Phase 19)

Rollback state to record before any of this: apex A `216.24.57.1`; `www` CNAME
`khaylub-portfolio.onrender.com` (document 15 section 6; re-read the live records at T-2 and
record them again, they are the truth).

Pre-cutover (Phase 21, before any date is set):

- P1. AUTOMATED by the Blueprint sync, confirmed by the **Owner**: the production service
  `khaylub-com` is declared in `render.yaml` next to the staging service; merging that declaration
  makes Render's Blueprint sync create it (production build: `PUBLIC_SITE_ENV=production`,
  pull-request previews off). Never convert or reuse `khaylub-com-v2`: it has served the preview
  build, and Render keeps files a new build no longer contains, so a draft page served once there
  would stay served. **Owner:** in the Render dashboard, approve the Blueprint sync if Render asks,
  confirm the new service exists with the Blueprint's fields, and record its `onrender.com` URL.
  Add nothing by hand. Before merging, confirm in the staging service's Environment tab that
  `PUBLIC_SITE_ENV` reads exactly `preview`: the Blueprint now declares that value for `khaylub-com-v2`
  and the sync takes ownership of it; a different dashboard value would be overwritten and redeployed.
- P2. AUTOMATED. Production readiness on the new service's `onrender.com` URL:

  ```
  npm run staging:verify -- https://<production-onrender-url> --out production-verify.json
  npm run staging:verify -- https://<production-onrender-url> --mobile --out production-verify-mobile.json
  npm run headers:scan -- https://<production-onrender-url> --samples 5
  npm run lhci:staging -- https://<production-onrender-url> <evidence-folder>/lighthouse-production
  ```

  Expected: the production indexing state (no Disallow, no noindex, no banner, a sitemap); every
  route, search, the climb, and the five cards ok; the SEO category and `is-crawlable` now pass;
  the header scan consistent, with the accepted Cache-Control exception recorded as is. Also
  confirm every draft path returns 404 (the build refuses drafts; today: `/notes/wanderer-pipeline/`).
- P3. **Owner:** merge the V1 repository's `docs/v1-preservation` branch so the V1 service's
  dashboard settings are on record; confirm the tag `v1.0.0-3d-experiment`, the locked branch, and
  the release still exist (read-only). The V1 Render service is never deleted or modified.
- P4. **Owner** with one AUTOMATED check: `v1.khaylub.com` per section 3 (the fastest route: attach
  `v1.khaylub.com` as a custom domain on the V1 Render service and add the CNAME at Namecheap; the
  frozen deployment keeps serving), then `npm run staging:verify -- https://v1.khaylub.com --exhibit`.

1. T-7 days (or as soon as the pre-cutover items are done): verify domain ownership in Google
   Search Console for `khaylub.com` and the V1 subdomain (optional before launch; SEO-10 follows).
2. T-2 days: **Owner:** at Namecheap, record the current apex and `www` records exactly as shown
   (the rollback state; an `nslookup` on 2026-09-15, recorded in the Phase 21 checkpoint section 5, resolved the apex to A `216.24.57.1` and `www` to CNAME
   `khaylub-portfolio.onrender.com`), then lower their TTL to 300 seconds.
3. T-1 day: the rehearsal (section 4, timed by the watcher); confirm `v1.khaylub.com` serves the
   tagged build (P4); rerun P2 on the production service.
4. T-0, only on the **Owner's** explicit, recorded go: in the production Render service
   `khaylub-com` (never `khaylub-com-v2`) add `khaylub.com` and `www.khaylub.com`; Render reports
   the required records. Remove the domains from the V1 service first if the rehearsal (section 4
   step 3) showed Render requires it. Update the two DNS records at Namecheap to the values Render
   shows.
5. T+15 min: `curl -I https://khaylub.com` shows the V2 build and headers (run the scan against
   `https://khaylub.com`); browse Home, Work, one case study, one media page on a phone over
   cellular; confirm the uptime check is green.
6. T+1 hour: submit the V2 sitemap in Search Console; confirm the V1 subdomain still resolves.
7. T+24 hours: review uptime and Render logs; restore TTL; record the cutover log in the vault.

Facts from the rehearsal and the cutover of 2026-09-15 to 16 (owner clock, Pacific): Render requires a
custom domain to be deleted from one service before another can add it ("This domain is already in use
on khaylub-portfolio. Please delete it from that service and try again."), so the order is release from
V1, add to V2, then DNS; the apex A record value Render asks for was unchanged (216.24.57.1) and only the
www CNAME changed (to khaylub-com.onrender.com); www.khaylub.com now answers 301 to https://khaylub.com/
(Render's redirect); the degraded window from release to the first V2 answer was about 7 minutes; the
rollback leg in the rehearsal about 4 minutes. The session machine's DNS resolver lagged for the rehearsal
hostname, so timing and confirmation came from the owner's clock and a phone over cellular; run the
watcher and the checks from a machine whose resolver follows public DNS, or confirm on a phone.

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

## 10. The owner Studio (Phases 24 and 25; ADR-012)

The Studio is the app under `studio/`: Keystatic's admin and API on an Astro server build with the
Node adapter, declared in `render.yaml` as the web service `khaylub-studio` (root directory
`studio`, free plan, pull-request previews off, redeployed only when `studio/` or the Blueprint
changes). It edits the repository's Markdown through forms and commits to `studio/*` branches; the
public site never reads it, and its build, headers, budgets, and tests are unchanged by it
(`tests/studio-config.spec.ts` holds the Studio's field table equal to the Zod schema;
`scripts/validate.mjs` scans the Studio's sources like the site's).

### 10.1 Storage modes (no secret in the repository, ever)

| Mode | `PUBLIC_KEYSTATIC_STORAGE` | Also needed | Where the owner signs in | Use |
|---|---|---|---|---|
| `local` | unset | nothing | nobody: the dev server writes to the checkout | development only; a production build refuses it (`studio/scripts/check-storage.mjs`) |
| `cloud` (recommended) | `cloud` | `PUBLIC_KEYSTATIC_CLOUD_PROJECT` = `team/project` from Keystatic Cloud | GitHub, through Keystatic Cloud (free up to three users) | the deployed Studio |
| `github` (fallback) | `github` | `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG`; the secrets `KEYSTATIC_GITHUB_CLIENT_ID`, `KEYSTATIC_GITHUB_CLIENT_SECRET`, `KEYSTATIC_SECRET` set in the Render dashboard, never in this file | GitHub, through the owner's own GitHub App | if Cloud fails any item of ADR-012 clarification 5 |

### 10.2 Deploy (Owner; the Blueprint sync creates the service)

1. Keystatic Cloud: sign in with GitHub at keystatic.cloud, create a team and a project, connect
   `KhaylubThompsonCalvin/khaylub.com`; note the project name as `team/project`.
2. Merge the pull request that declares `khaylub-studio`; in the Render Blueprint sync, enter the
   project name when prompted for `PUBLIC_KEYSTATIC_CLOUD_PROJECT`. Confirm the service builds
   (`studio build: cloud storage` in the build log) and answers at its `onrender.com` URL.
3. Optional hostname: `studio.khaylub.com` as a custom domain on the service plus a Namecheap CNAME
   to the service's `onrender.com` name (Render's free workspace includes two custom domains;
   further ones are billed).

### 10.3 Security checklist (AUTOMATED where marked; recorded per deploy in section 9)

- AUTOMATED (`studio/scripts/anonymous-check.mjs`, run by the CI job `studio` on every change under
  `studio/`; by hand against a deploy: `STUDIO_CHECK_BASE=https://<service>.onrender.com node
  studio/scripts/anonymous-check.mjs`; without that variable it starts the built server locally): an anonymous visit to `/keystatic` shows only the login shell and embeds no repository
  content; `/api/keystatic/tree` and `/api/keystatic/blob/...` answer 404 in cloud mode and
  `POST /api/keystatic/update` is refused; repository files are never served (`/content/notes/<slug>.md`,
  `/keystatic.config.ts`, `/package.json`, `/.env` all 404).
- AUTOMATED (same script): every response carries `X-Robots-Tag: noindex, nofollow, noarchive`,
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `Cache-Control: no-store`,
  `Content-Security-Policy: frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'`,
  `Strict-Transport-Security: max-age=31536000; includeSubDomains`; `/robots.txt` disallows everything.
  The source directives of the policy (script, style, connect, img) are added after the deployed
  Studio's console shows what Keystatic Cloud loads (Phase 25).
- No public sign-up: Keystatic Cloud membership is the owner's team (three seats, all the owner's);
  in GitHub mode, only collaborators with write access to the repository can publish.
- The public site is unchanged: the full guard on the merged tree; `npm run headers:scan` against
  khaylub.com unchanged; the Studio is not linked from the public site.
- No secret in the repository: gitleaks in CI; `validate` fails on credential patterns and on a
  Blueprint secret value.

### 10.4 The smoke test (Owner, on the deployed Studio; the local run is recorded in the vault)

1. Sign in on a phone. Field notes, Add: slug `studio-smoke-test`, title, date, a summary of 40 to
   240 characters, one tag, a source; body text with a wikilink such as `[[preserving-v1]]`.
   Create. Keystatic commits the file `content/notes/studio-smoke-test.md` on a new branch under
   `studio/` (choose "create a new branch" when asked; never commit to `main`).
2. Publish: set status to `published`, Save. Unpublish: set status back to `draft`, Save.
3. Delete the entry (Delete entry, Yes, delete). Delete the branch on GitHub.
4. Record in section 9: the branch name, the three commits, and that `main` and the public site
   did not change.

### 10.5 The collections and the editor rules (Phase 25)

| Collection | Entry written | Form | Not in the form (and why) |
|---|---|---|---|
| notes, writing, journal | `content/<collection>/<slug>.md` | the body first; the shared fields; `series` and `part` | `cover`, `cover_alt`, `provenance` (Phase 27: Keystatic writes a group on every save, so an optional provenance group cannot be expressed); `featured` (Git-only, owner-approved); `problem`, `role` (projects only) |
| projects | `content/projects/<slug>/index.md` | the fields first; `project_status`, `context` (course, term, institution; ADR-012), `problem`, `role`, `links`, `outcome`; the body description lists the thirteen case-study headings in order | `cover`, `cover_alt`, `provenance`, `featured` (as above) |
| music, video, gallery | `content/<collection>/<slug>/index.md` with the images beside | the fields first; `provenance` as a required group; images by upload (`poster`, `cover`, gallery `images[].src`); audio and video files by name under `public/media/<slug>/` or an `external_url` (uploads of large media are Phase 27) | `featured`, `problem`, `role`, `series`, `part` |

Rules the editor enforces before a save: required fields, maximum lengths and the minimums of
required fields, the slug shape, the duration shape (`m:ss`), media file names, URL fields, the
enum options, the vocabulary pickers (generated from `content/vocabulary/` at build), and no em
dash in any free-text field. Rules that stay with `validate` and CI on the pull request, named in
the field descriptions: the minimum length of an optional text field (`context`, `problem`, `role`,
`cover_alt`; Keystatic treats a minimum as "required"), at least one tag, alt text with a cover,
provenance with media, `updated` on or after `date`, a featured project's proof link, captions with
speech, `related` slugs that exist, and the private-term and em-dash rules on the body (the body editor has no pattern hook; the private-term list is deliberately not shipped in
the Studio's bundle, because `validate` forbids those terms anywhere else in the repository).

Two facts to know when editing an existing entry: Keystatic rewrites the frontmatter in its own
YAML style (folded long strings, one list item per line) with the same keys and values; and it
moves the entry's image files to its own layout in the same commit (`cover.webp`,
`images/0/src.webp` beside `index.md`) and updates the references, which the site reads
unchanged (proven on `wanderer-hero` on 2026-09-17: validate PASS, the built page identical in
output format).

### 10.6 The owner's authoring test of each type (Phase 25; Owner, on a phone)

1. In the Studio, switch to a new branch named `studio/phase-25-types` (never main).
2. Create one entry of each type with real or throwaway content, each saved as a draft: Writing,
   Field notes, Journal, Projects (a school project: fill `context`, pick at least one technology,
   add one proof link), Gallery (upload one image, write its alt text), Video (upload a poster; an
   `external_url` is enough for the file), Audio-visual stories (a duration such as `3:42`, an
   `external_url`, the provenance group). Every save is a commit on the branch.
3. Open a pull request from that branch on GitHub (the compare URL is
   `https://github.com/KhaylubThompsonCalvin/khaylub.com/compare/main...studio/phase-25-types`). CI runs
   validate on the seven documents and the preview build renders them; the pull request page shows
   the checks. Do not merge unless the entries are meant to be real.
4. Report which forms felt right on the phone and which did not; close the pull request and delete
   the branch if the entries were throwaway, or ask for the merge if they are real.

## 9. Record of executions

| Date | Who | Sections executed | Result | Improvisations (must be none for acceptance) |
|---|---|---|---|---|
| 2026-09-17 | owner (steps) and the session (verification) | 10.2 deploy (Keystatic Cloud project `khaylub/khaylub-com`; `khaylub-studio` created by the Blueprint sync; the first build failed on the root tsconfig, fixed by PR #49; the redeploy succeeded); 10.3 checklist (the automated check PASS against https://khaylub-studio.onrender.com at 21:58 UTC; manual items answered in the Phase 24 gate note); 10.4 smoke test on `studio/phase-24-smoke` | PASS: commits `be5dfd0` draft, `023945c` published with the body and its wikilink, `e49c240` draft, `1475cbb` deleted; the branch's tree identical to `main`; the branch deleted; `main` at `8ea4e3d` throughout; khaylub.com unchanged | one: the owner's first body sentence landed in the `problem` field on a phone and was moved to the body at the publish step (a Phase 25 editor item) |
