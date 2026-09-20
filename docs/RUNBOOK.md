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

## 10. The owner Studio (Phases 24 to 26; ADR-012)

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
| notes, writing, journal | `content/<collection>/<slug>.md` | the body first; the shared fields; `series` and `part`; since Phase 27 the optional `cover`, `cover_alt`, and `provenance` group (an untouched group is written empty and read as absent) | `featured` (Git-only, owner-approved); `problem`, `role` (projects only) |
| projects | `content/projects/<slug>/index.md` | the fields first; `project_status`, `context` (course, term, institution; ADR-012), `problem`, `role`, `links`, `outcome`; the optional cover and provenance group (Phase 27); the body description lists the thirteen case-study headings in order | `featured` (as above) |
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
   `https://github.com/KhaylubThompsonCalvin/khaylub.com/compare/main...studio/phase-25-types`) and
   mark it a draft ("Create draft pull request"), so it cannot be merged by habit. CI runs validate on
   the seven documents and the preview build renders them; the pull request page shows the checks.
   Do not merge unless the entries are meant to be real.
4. Report which forms felt right on the phone and which did not; close the pull request and delete
   the branch if the entries were throwaway, or ask for the merge if they are real.

### 10.7 The publish path (Phase 26; AUTOMATED after the owner's Studio save)

1. In the Studio, work on one branch per piece, named `studio/<slug>` (the branch selector; never
   main). Every save is a commit on that branch.
2. `.github/workflows/studio-pr.yml` opens the pull request to `main` for the branch on its first
   push (or finds the open one) and turns on auto-merge with a merge commit. CI runs on the push
   (`ci.yml` watches `studio/**`), so the six required checks of the `main` protection rule attach
   to the commit. Render builds the pull-request preview on the staging service and comments the
   URL on the pull request: the preview build, drafts visible, noindex, the banner.
3. Green checks: the pull request merges by itself, GitHub deletes the branch, Render deploys
   `main` to production. A `draft` stays invisible on production after the merge; a `published`
   piece goes live. Red checks: nothing merges; GitHub emails the failure; fix it in the Studio (a
   new save on the same branch re-runs everything) or close the pull request.
4. Take back a piece the public has seen: set `status` to `withdrawn` in the Studio on a new
   branch and save (the same path); its address then serves a short notice and it leaves every
   listing (10.9 item 5). A draft that was never published stays a draft. Never delete a published
   piece and never set it back to draft: the host would keep serving its old page. Undo a merge:
   revert the merge commit by pull request (the repository's rollback rule; GitHub's Revert button
   on the merged pull request does it); a revert of a publication needs the withdrawal as well. Hold a piece back: close its pull request
   without merging; the workflow then leaves that branch alone on later saves until the owner
   reopens the pull request on GitHub.
5. A failed build never reaches production: an invalid file cannot merge (the protection rule), and
   if a production build ever failed on Render the previous deploy would stay live (Render keeps
   the last successful build). Three facts from the first live runs (2026-09-18): an automatic
   merge is a workflow-token push and raises no CI run on `main` (the branch commit carried the
   six checks; the rule is not strict, so two Studio branches merged in sequence were each tested
   against the `main` they branched from); GitHub's "Automatically delete head branches" does not
   act on those merges, so the owner deletes Studio branches on GitHub or in the Studio's branch
   menu now and then; no Render pull-request preview comment appeared on the automatic pull
   requests, and the staging service (the preview build of `main`, drafts visible, noindex) is the
   preview surface: a merged draft shows there and nowhere public.
6. Needs, once: "Allow auto-merge" and the `main` protection rule (both on, verified 2026-09-18 UTC) and the
   Actions setting "Allow GitHub Actions to create and approve pull requests" (Settings, Actions,
   General, Workflow permissions), without which the workflow cannot open pull requests.

### 10.8 Automation-first acceptance (the owner's rule from Phase 27 onward; decision D-28)

Every owner or manual verification step of a phase is classified before the work starts:
**AUTOMATABLE** when Playwright, an existing deterministic test, a script, or a GitHub API read can
prove it reliably (Claude runs it, records the output, fixes deterministic failures, and never asks
the owner to click through it), or **OWNER JUDGMENT REQUIRED** when a human opinion is the point:
whether a design looks good, typography feels right, a form or mobile editing feels intuitive,
wording makes sense to the owner, media placement is appropriate, a real artifact is approved for
publication, and final visual acceptance. The owner is presented with the automated evidence first
and one clear question at a time.

The harness, reusable rather than one-off, follows this file's script conventions:

| Command | Proves | Phase |
|---|---|---|
| `npm test` and CI (existing) | routes load; every published entry on its collection page, in the sitemap, the search index, the feeds when appropriate, the graph, with its card; every draft in none; the context line; links; images; noindex; axe; keyboard; targets; budgets; Lighthouse | in place |
| `node studio/scripts/anonymous-check.mjs` (existing) | the Studio loads and its anonymous surface is closed, locally and live | in place |
| `npm run test:publishing` | for a Studio branch or slug: the branch exists, the workflow opened the pull request, the six checks attached, auto-merge is on, the merge came after green, `main` holds the content, staging serves it, production serves it only when published; each step timed. GitHub state is read through the API, never through a browser | Phase 27 |
| `npm run test:studio` | the local Studio in local storage mode inside a throwaway checkout (no sign-in exists there, so no credential is involved): the sidebar, every collection's form, labels and help text, required-field refusal, the Body editor visible, poster and thumbnail wording present, the mobile viewport hiding no control, a create-and-validate round trip per collection | Phase 28 |
| `npm run test:visual` | screenshots of the important routes at the three viewports into the evidence folder, and no horizontal overflow; pixel comparison only after the owner agrees a baseline | Phase 28 |
| `npm run acceptance` | runs the above for a named slug and writes one report: every PASS line and the owner-judgment questions that remain | Phase 28 |

Rules: no GitHub credential, Keystatic credential, secret, or personal token in any Playwright or
script source; the deployed Studio is tested on its anonymous surface only; authenticated flows run
against the local Studio in a throwaway checkout; the existing Lighthouse, accessibility, header,
and CI checks are kept, never weakened. The full record: vault document 52.

### 10.9 Media, provenance, preview, and the publishing harness (Phase 27)

1. **Media through the Studio.** Images (a cover, gallery images, a video poster, an album cover)
   go in through the Studio's image fields and are written beside the entry; the 5 MB rule and the
   image rules of CONTENT.md apply at `validate`. Audio and video never go through the Studio: a
   short clip within the size rules goes under `public/media/<slug>/` by pull request; anything
   larger or longer is hosted outside the repository (a Cloudflare R2 bucket if the owner creates
   one, any host otherwise) and named in `external_url`. Creating the bucket is an owner decision;
   nothing in the repository depends on it.
2. **Provenance and credits.** Every entry with media carries a complete provenance record (source,
   license, date; `generator` when part of the media was generated); `validate` fails a cover
   without one. The Studio offers the record as an optional group on every collection; a group the
   owner never opened is written as empty and the site treats it as absent. The artifact page renders
   the record as "Credits and process" (`src/components/Credits.astro`) with the AI-assistance
   sentence when `ai_assisted` is set; an entry without a record shows no section.
   `tests/integration.spec.ts` asserts the section on every entry with a record and its absence
   otherwise.
3. **The preview.** Every Studio collection carries a preview link to the staging service
   (`https://khaylub-com-v2.onrender.com/<collection>/<slug>/`), the preview build of `main` (drafts
   visible, noindex). The link answers once the piece's pull request has merged and staging has
   redeployed (section 10.7); before that, the pull request's checks are the preview of validity.
4. **The harness: `npm run test:publishing <studio-branch>`** (`scripts/publishing-verify.mjs`). Reads,
   through the GitHub API with the session's own `gh` login and no secret: the branch, the pull
   request the workflow opened, the six required checks of the `main` protection rule on the head
   commit, the auto-merge flag, the merge time against the last check's completion, and the file on
   `main`; then polls staging and production until their build stamp (`/build.json`, the commit
   Render built) carries the merge commit and checks the entry's URL: staging serves drafts and
   published pieces, production serves only what is published. Options: `--expect published|draft|removed|refused|held`
   (read from the merged file when omitted), `--timeout 25m`, `--out report.json`, `--no-wait` (read
   the state as it is instead of waiting for the pull request to settle and the origins to catch up).
   Every step prints PASS, FAIL, or SKIP with its numbers; exit 1 on any FAIL. Start it right after
   a save to time the whole path.
5. **The drills (recorded 2026-09-18 in the vault evidence folder; rerun any time on a throwaway
   `studio/` branch):**
   - *A failing document* (`studio/p27-drill-refused`, a note with an invalid status value, PR #63):
     the pull request opened 29 s after the save; five of six required checks red; auto-merge
     enabled and waiting; nothing merged; `main` unchanged; staging and production 404 for the
     piece. Closing the pull request by deleting the branch holds the piece back; 9 pass, 0 fail.
   - *A draft* (`studio/p27-drill-draft`, PR #62): opened 14 s after the save; the six checks green at
     11m16s; merged by github-actions at 11m21s (5 s after the last check); `main` holds the file with
     `status: draft`; staging served the page 12m17s after the save; production answered 404
     throughout. 9 pass, 0 fail (`drill-draft.txt`).
   - *A revert* (`studio/p27-drill-revert-b`, `git revert -m 1` of the draft drill's merge, PR #65):
     opened 20 s after the save; the six checks green at 13m55s; merged by github-actions at
     13m58s; the file absent from `main`; the collection index, the graph, and production 404 as
     expected; **staging kept serving the removed page** (`/notes/p27-drill-draft/`, the file from the
     18:37 deploy, 45 minutes after the save and 31 after the merge): 8 pass, 1 fail
     (`drill-revert.txt`). A first push under the name `studio/p27-drill-revert` carried a mistaken
     commit and was deleted within a minute; its pull request #64 closed unmerged, and the
     workflow's held-back rule then applied to that name, which is why the drill ran as `-b`.
   - *Unpublish:* set `status` to `draft` in the Studio and save on a new branch; the same path
     merges it and the piece leaves every listing, the sitemap, the search index, the feeds, the
     graph, and its card on the next deploy (`test:publishing --expect draft`). Not run on a
     throwaway piece in Phase 27 because it needs a published piece; it runs the first time a real
     piece is withdrawn, or on the owner's word against the Phase 26 test project. Read the
     retention fact below first.
   - **Retention fact (2026-09-18, found by the revert drill).** A Render static site keeps serving
     a page that a later deploy no longer contains: on staging, `/notes/p26-smoke/` (removed from
     `main` at 16:16 UTC), `/notes/p25-note/` and `/projects/p25-project/` (reverted at 02:29 UTC),
     and `/notes/p27-drill-draft/` all still answered 200 at 19:25 UTC with their original
     `last-modified`, on a cache miss, while the site's other pages carried the 18:53 deploy and the
     indexes, graph, and search no longer named them. Production answered 404 for all of them
     because they were drafts and were never built there. **Proven on production the same
     evening:** the test still `/gallery/p27-test-still/` was published by #67 (live at 20:32 UTC)
     and set back to draft by #68 (merged 20:43 UTC; production's stamp on that deploy at 20:58
     UTC); at 21:00 UTC production still answered 200 for the page and its card with the 20:32
     `last-modified` on a cache miss, while the gallery index, the sitemap, both feeds, the graph,
     and search no longer named it. Consequences: a withdrawn piece stays reachable at its exact
     URL, unlisted, until Render removes it; a piece that must disappear gets a redirect in
     `render.yaml` (its path to its collection index) by pull request, and a Render support case
     asks whether removed files are purged on deploy. The harness reports this as a FAIL on the
     production step of `--expect draft` and on the staging step of `--expect removed`, on purpose.
   - **The withdrawal (the owner's decision of 2026-09-18, the smallest mechanism):** the status
     `withdrawn`. The piece's files stay in Git as the record; the build writes a notice at its
     address (`src/components/Withdrawn.astro`: "This piece has been withdrawn", `noindex`, nothing
     from the piece, a link to the collection) and the site's default card at its card address, so
     the next deploy overwrites what the host kept; it is in no listing, feed, sitemap, graph, or
     search index (`tests/integration.spec.ts`, `scripts/seo-check.mjs`); a wikilink to it is
     unresolved, like a link to a draft. Not preventable: the piece's processed images stay at their
     hashed `/_astro/` addresses, unlinked and unguessable, until the host purges them. The Studio's
     status picker offers `withdrawn`; `npm run test:publishing <branch> --expect withdrawn` proves
     the notice on both origins, the derived places clear, and the default card. A Render support
     case on the retention behaviour is prepared in the vault evidence folder (not a gate).
   - *The withdrawal proven on production (2026-09-18):* `p27-test-still` set to withdrawn in the
     Studio's edit form on a phone viewport, pushed as `studio/p27-test-piece-withdraw` (#71: opened
     11 s after the save, six checks green at 13m52s, merged by github-actions at 13m57s as
     `ea4a3cd`, staging at 15m25s, production on the merge at the first probe); the former URL
     answers 200 with the notice and nothing of the piece (no title, summary, image, Credits, or
     article; `noindex`; `last-modified` the new deploy's); the card is the default card; the
     collection index, the sitemap, both feeds, the graph, the Library, Work, and a live search
     name it nowhere. `test:publishing --expect withdrawn`: 13 pass, 0 fail (`piece-withdrawn.txt`).
     The piece's files stay in Git with `status: withdrawn` as the record, by design.
   - *The owner's test piece through the harness (2026-09-18):* a gallery still with a cover, one
     image, and a complete provenance record, created in the local Studio by the Playwright driver
     (the form filled, the files chosen, Create pressed; the entry written beside the file), pushed
     as `studio/p27-test-piece` (#67: opened 17 s after the save, six checks green at 9m48s, merged
     at 9m51s, staging at 11m05s, production already on the merge at the first probe; 12 pass,
     0 fail); on production the gallery index, the sitemap, both feeds, the graph, the card, the
     image, search, and the Credits and process section all proven live; then set to draft in the
     Studio's edit form on a phone viewport and pushed as `studio/p27-test-piece-unpublish` (#68:
     merged at 10m25s; staging still serves it; 11 pass, 1 fail, the retention fact above).
6. **Branch cleanup.** `.github/workflows/studio-cleanup.yml` runs daily (06:17 UTC) and on demand
   from the Actions tab: it deletes a `studio/*` branch only when a merged pull request's head is the
   branch's current commit and no pull request is open on it; a branch with a closed-unmerged pull
   request (a piece held back) or with saves after the merge is kept.
7. **Accepted risk: no CI run on `main` for automatic merges.** An automatic merge is a workflow-token
   push and raises no CI run on `main`; the protection rule is not strict, so a Studio branch is
   tested against the `main` it branched from. Mitigation: the branch commit carried the six checks;
   two Studio branches touching different entries cannot conflict in content; Render keeps the last
   successful build if a `main` build ever failed; the weekly CI job and every later pull request run
   the suite on the current `main`. Recorded as accepted at Phase 27; revisit if a merge ever breaks
   `main` (the fix would be the rule set to strict, which makes every Studio branch require an update
   before merging).
8. **The Studio's Content Security Policy.** The middleware serves a candidate policy as
   `Content-Security-Policy-Report-Only` (the app's bundles with the hash of each inline script
   computed per response, inline styles for Keystar UI, the Google Fonts hosts it loads Inter from,
   images from this origin, data and blob URLs and GitHub avatars, connections to this origin,
   Keystatic Cloud, and GitHub's API; no frames, plugins, or base override). The enforced header
   stays the Phase 24 set. `node studio/scripts/csp-report.mjs` (from the repository root, after a
   Studio build; `STUDIO_CHECK_BASE=<url>` for the deployed service) opens the anonymous shell in
   Chromium and fails on any violation; the signed-in app is observed in the owner's browser console
   (any line naming Content-Security-Policy is a candidate adjustment) and by the Phase 28 local
   harness before the candidate is ever enforced.

### 10.10 The owner acceptance harness and the recovery record (Phase 28)

1. **`npm run test:studio`** (`scripts/studio-harness.mjs`, `playwright.studio.config.ts`, `tests/studio/`):
   the owner Studio's forms in a real browser against a local Studio in local storage mode, where no
   sign-in exists, so no credential is involved. The harness makes a throwaway Git worktree of `HEAD`
   in the system temp directory, starts the Studio from this repository's `studio/` with its local
   root pointed at the worktree (`STUDIO_LOCAL_ROOT`, read only by a development server), runs the
   Playwright project (desktop 1440 by 900 and phone 390 by 844), runs `validate` inside the worktree
   over what the forms wrote, then stops the server (Astro's development daemon, by `astro dev stop`)
   and removes the worktree. Everything asserted is derived from the field tables in
   `studio/src/fields.ts`: the sidebar names every editable collection and no Git-only one; each form
   shows every field's label and help text and no deferred field; the status picker offers
   `withdrawn`; a Create with the required fields empty is refused; the Body editor is visible; the
   Video form says its image is the poster; on the phone viewport no required control is hidden and
   the page never scrolls sideways; one entry per collection is created through the form (the file
   lands in the worktree and passes `validate`). `--keep` leaves the worktree for inspection.
2. **`npm run test:visual`** (`playwright.visual.config.ts`, `tests/visual/`): every template route of
   `tests/helpers.ts` captured into `EVIDENCE_DIR` (default `test-results/visual/`; point it at the
   vault's evidence folder; that path is never written here) and asserted never to scroll sideways.
   Since the design initiative's package F1 (2026-09-19) the environment is deterministic: six
   projects (desktop 1440 by 900, tablet 768 by 1024, phone 390 by 844, reflow 320 by 568, and
   desktop-dark and phone-dark under the dark scheme), device scale factor 1, reduced motion,
   animations disabled and the caret hidden at capture, a fixed locale and time zone, Playwright's
   pinned Chromium; the file name is `<route-name>--<project>.png` (`home` for the front page,
   otherwise the path with its slashes turned into `--`); `baseline-record.json` beside the
   captures records the browser and version, the OS, the build's commit, the date, the projects,
   the determinism settings, and every capture with its overflow. No pixel comparison until the
   owner agrees a golden set: a golden update is an owner-approved visual change (vault document
   57 section 4).
3. **`npm run acceptance [<studio-branch>]`** (`scripts/acceptance.mjs`): the site's suite against
   `dist/`, the publishing harness for the branch when one is named, the Studio harness, and the
   visual harness, then one report `acceptance-report.md` in `EVIDENCE_DIR`: every step's PASS or
   FAIL with its seconds, and the owner-judgment questions with the pictures to look at. Exit 1 on
   any automated failure. "Owner Publishing Studio accepted" and "Phase 28 PASS" are the owner's
   words, never the harness's.
4. **Recovery, documented (document 41):**
   - *A failed build:* an invalid save cannot merge (the six checks; the protection rule); production
     keeps serving what it served. Fix the entry in the Studio and save again, or close the pull
     request to hold the piece.
   - *Rollback:* GitHub's Revert button on the merged pull request opens the undo, which merges like
     any other pull request (a revert on a `studio/` branch merges by itself). A reverted publication
     still needs the withdrawal below, because the host keeps the old page.
   - *An accidental publication:* set the status to `withdrawn` and save; after the merge and the
     deploy the address serves the notice and the piece is in no listing (10.9). Unlinked processed
     images stay at their hashed addresses until the host purges them.
   - *Replacing an asset:* upload the new file in the entry's image field and save; the pipeline
     rebuilds the derived images and the card at the next deploy; the old hashed files linger unlinked.
   - *Delete versus unpublish versus withdraw:* a draft never published may be deleted or left as a
     draft; anything the public has seen is withdrawn, never deleted and never re-drafted (10.9).
   - *Backup and export:* the repository is the content; every save is a commit; nothing lives only
     in the Studio or on Render. A clone of the repository is the export.
   - *Lost access:* Keystatic Cloud signs the owner in with GitHub; if the Studio is unreachable, the
     files can be edited on GitHub directly and merge by the same pull-request path (the checks run
     on any branch's pull request; only `studio/` branches merge by themselves).
   - *The Studio domain:* `khaylub-studio.onrender.com` is a Render web service from `render.yaml`
     (10.2); recreating it from the Blueprint restores it; nothing on it is unique.
5. **The recovery test, rerun at Phase 28 (2026-09-18 and 2026-09-19 UTC, evidence in the vault):**
   - *The failing document* (`studio/p28-drill-refused`, a note with an invalid status value, #74):
     the pull request opened 10 s after the save; five of six required checks red; auto-merge
     waiting; nothing merged; `main` unchanged; both origins 404; the derived places clear:
     12 pass, 0 fail. Held back by deleting the branch (#74 closed unmerged).
   - *The draft and its revert* (`studio/p28-drill-draft`, #75: opened 11 s after the save, six
     checks green at 13m53s, merged by github-actions at 15m11s; staging served it, production
     404: 12 pass, 0 fail; then `studio/p28-drill-revert`, `git revert -m 1` of that merge, #76:
     merged at 9m59s, the file absent from `main`, production 404 and its derived places clear:
     11 pass, 1 fail, the fail being staging's retained copy of the removed draft, the known fact
     of 10.9 item 5). The withdrawn piece is proven at 10.9 (Phase 27, `p27-test-still`), not
     repeated with a second public throwaway.
6. **The owner's acceptance:** the owner authors the real piece in the Studio following vault document
   56 ("How I Publish to Khaylub.com"), reports any improvisation, and the session runs
   `npm run acceptance <branch>`; the report's owner-judgment questions are the only questions asked.

### 10.11 School work to the portfolio (Phase 28; reusable after it)

The path from a finished term to a published Project entry, with the owner's approval between the
recommendation and the authoring, and again before publication. Nothing here publishes by itself,
touches a graded file, submits anything to a school, or holds a credential.

1. **The auditor: `npm run portfolio:audit`** (`scripts/portfolio-audit.mjs`). Read-only over two roots
   named by the environment, never by the repository: `PORTFOLIO_SCHOOL_ROOT` (the folder holding one
   subfolder per course) and `KHAYLUB_VAULT` (the vault; only `01 Projects/<course>` for the courses
   found and `01 Projects/Khaylub.com/docs/V2` are read). It groups files into assignment units (a
   folder named lab, project, assignment, final, capstone, midterm, homework, exercise, or portfolio;
   practice, reading, lecture, quiz, and template folders are noise), reads notebooks (cells,
   executed cells, errors, chart outputs, headings, libraries, a school-database connection),
   Tableau workbooks (worksheets, dashboards, stories, actions, a recorded local path), reports
   (word counts), datasets (columns, a public-source hint), images, code, and the owner's vault notes
   about each unit (portfolio notes, statuses, public links), and it knows what `content/` already
   publishes. Every unit is scored 0 to 3 on completeness, technical evidence, employer value,
   visual quality, story, source evidence, publishing readiness, privacy, and provenance readiness,
   with the reason on every line; nothing is ranked by size or count; an earlier unit whose notebook
   headings reappear in a later cumulative notebook is marked contained; a unit the owner's own
   portfolio map or dedicated notes mark as published is set aside (`--include-published` lists
   it). It flags, never prints, credentials, connection strings, private school URLs, possible
   student identifiers, grades, emails, instructor quotations, classmate mentions, machine paths,
   and text that reads like course material. Output in `PORTFOLIO_OUT` (default `.portfolio/`,
   git-ignored): `report.md` (BEST, RUNNER-UP 1, RUNNER-UP 2, every unit ranked, the flags),
   `candidates.json`, and `manifests/<candidate-id>.json` (course, term, institution, source paths,
   vault references, technologies against the site vocabulary, skills, tags, evidence, exclusions,
   the proposed Project structure, and the fields still needing the owner's words). `--course
   <code>` limits the run to one course. Nothing is copied from a school file beyond names, counts,
   and headings.
2. **The approval gate.** The owner reads the report and names one candidate (or names a piece
   that never went through the auditor, such as an essay). Then the approved package
   `PORTFOLIO_OUT/approved/<id>.json` is written from the owner's words:
   `{ "collection", "slug", "fields": { <the collection's field keys> }, "body": "<Markdown>",
   "omitted": ["what was left out and why"], "approvedForPublication": false }`. Field values follow
   the field tables (`studio/src/fields.ts`): text, url, date, and integer fields as strings or
   numbers, a select as one of its options, a checkbox as true or false, a multiselect as vocabulary
   slugs, an image as `{ "file": "<a derived copy placed outside any graded original>" }`, a group as
   an object, a list as an array. No Studio branch exists before this file does.
3. **The commands** (`scripts/studio-author.mjs`; `tests/studio/author.spec.ts` is the browser driver):
   - `npm run studio:review -- <id>`: the content review, nothing created: title, summary, collection,
     type, date, context, technologies, tags, skills, source, links, the Work-page and AI-assistance
     flags, media, provenance, what was omitted, the public URL that will result, the body; it ends
     with the one question, "Approve publication?".
   - `npm run studio:prepare -- <id>`: checks the package against the schema's rules (the slug,
     lengths, the enum values, at least one tag, the thirteen case-study headings for a case study,
     a cover's alt text and credits, no em dash, no image from a school folder) and refuses an
     incomplete one; makes a worktree on `studio/<slug>` from `origin/main`; starts the local Studio
     pointed at it (10.10); the driver opens the collection's form, fills only what the package
     holds (every control found through the field tables; the Studio's own validation messages are
     reported if it refuses), uploads the media, types the first paragraph in the editor, presses
     Create, captures the form and the entry at desktop and phone widths (`EVIDENCE_DIR/studio`) with
     no sideways scroll; the approved Markdown body is written under the frontmatter Keystatic
     wrote; `validate` runs in the worktree; the entry is committed as a draft. Add `--push` to push
     the branch: the workflow opens the pull request, the checks run, the merged draft shows on
     staging, and `test:publishing --expect draft --live-page` watches it.
   - `npm run studio:publish -- <id>`: needs `"approvedForPublication": true`; sets the status to
     published through the Studio's edit form, commits, pushes; then
     `test:publishing --expect published --live-page` (the branch, the pull request, the six checks,
     auto-merge, the merge, main, both origins by their build stamp, the entry, the collection index,
     the sitemap, both feeds, the graph, the card, and the live page in a browser at two widths: no
     console error, no sideways scroll, zero axe violations, every image loaded with alt text, the
     Credits section) and `npm run acceptance studio/<slug>` (10.10).
   - The deployed Studio is never automated and no sign-in state is kept anywhere: the local Studio
     in local storage mode writes the same files the deployed one would, and the branch, pull
     request, checks, merge, and deploy are the same path. A stored Keystatic Cloud session would
     work technically but is not used, by decision D-28 (runbook 10.8).
4. **The owner's review (before `studio:publish`).** `studio:review` is the review. The owner
   answers one question: does it represent the work accurately, and is it approved for publication.
5. **Future terms.** Finish the term; run the auditor; read the top three; approve one; write the
   package from the owner's words; `studio:prepare -- <id> --push` for the staging draft;
   `studio:review`; `studio:publish` after the owner's word. The auditor is generic over course
   folders; the driver fills any collection the Studio edits from its field table. What stays in the
   owner's own hands at Phase 28: the one real publication, made in the live Studio by the owner
   following vault document 56, because the gate asks for the guide followed once without
   improvisation and document 41 for a publication without Claude; the automation watches and
   verifies every deterministic step after each save.
6. **Security and privacy rules.** The school folders are read-only inputs and are never written;
   nothing from them enters this repository except the derived copy the owner places under
   `PORTFOLIO_OUT` and then chooses as the cover; `PORTFOLIO_OUT` is git-ignored; no credential,
   token, or session state is stored anywhere; the deployed Studio is never automated; grades appear
   only with the owner's explicit word; course material that is not the owner's work is flagged
   and never republished.

## 9. Record of executions

| Date | Who | Sections executed | Result | Improvisations (must be none for acceptance) |
|---|---|---|---|---|
| 2026-09-19 | the session (the harnesses) | 10.10 the Studio harness (31 tests, seven entries created and validated in a throwaway checkout), the visual harness (78 captures), the recovery test rerun (#74 refused, #75 draft, #76 revert) | PASS: every automated step green; the retention fact on staging seen again and kept as the known FAIL | none |
| 2026-09-18 | the session (Playwright and the harness) | 10.9 the withdrawal proof: `p27-test-still` withdrawn from the Studio (#71, 13m57s to the merge); the former production URL serves the notice, the derived places clear, the default card; the merged Studio branch deleted | PASS: 13 of 13 through the harness; the retention fact mitigated | none |
| 2026-09-18 | the session (Playwright and the harness), the owner (judgment) | 10.9 the owner's test piece: created in the local Studio by the driver, published (#67, 9m51s to the merge, every derived place on production), unpublished from the Studio's edit form (#68, 10m25s); the retention fact proven on production; the merged Studio branches deleted | PASS for the path; the retention FAIL kept on purpose; the owner's verdict on the placement and wording in the Phase 27 gate note | none |
| 2026-09-18 | the session (the harness) | 10.9 the drills under `npm run test:publishing`: the failing document (#63: five checks red, no merge, held back by deleting the branch), the draft (#62: merged by itself at 11m21s, staging at 12m17s, production 404), the revert (#65: merged at 13m58s, `main` clean, production 404, staging still serving the removed page); the Studio candidate policy collected on the anonymous shell (`csp-report.mjs`: fonts and the two inline scripts found, the candidate adjusted, the rerun clean) | PASS for the path (every step automatic, every check read through the API); one FAIL kept on purpose: the retention fact in 10.9 item 5 | one: the first revert push carried a mistaken commit and was deleted within a minute (pull request #64 closed unmerged), so the drill ran under a second branch name |
| 2026-09-18 | the session (a draft) and the owner (a published project) | 10.7 the publish path: `studio/phase-26-smoke` (a draft note; pull request #57 opened by the workflow, merged by itself in 14 minutes; on staging with noindex; production 404; removed by #58), then the owner's `studio/p26-test` (a published project with a context line; #59 merged by itself; on staging and production; its context corrected by #60) | PASS: every step automatic after the save; the owner verified the project page, the Projects listing, Search, the Graph, the feed, and the card on staging | none in the path; the context field first held its own instruction sentence, corrected through the same path |
| 2026-09-18 | owner (steps) and the session (verification) | 10.6 the authoring test of each type on a phone on `studio/phase-25-types` (seven commits, one per collection; the pull request #52 for CI: every job green) | PASS: every entry in the site's shape; check, validate, and the preview build green on the seven files locally and in CI; the owner's verdict recorded in the Phase 25 gate note; the Video help text clarified (PR #54) | one: the test pull request was merged by habit and reverted the same hour (PR #53), `main` unchanged in effect; step 3 now says to mark the pull request a draft |
| 2026-09-17 | owner (steps) and the session (verification) | 10.2 deploy (Keystatic Cloud project `khaylub/khaylub-com`; `khaylub-studio` created by the Blueprint sync; the first build failed on the root tsconfig, fixed by PR #49; the redeploy succeeded); 10.3 checklist (the automated check PASS against https://khaylub-studio.onrender.com at 21:58 UTC; manual items answered in the Phase 24 gate note); 10.4 smoke test on `studio/phase-24-smoke` | PASS: commits `be5dfd0` draft, `023945c` published with the body and its wikilink, `e49c240` draft, `1475cbb` deleted; the branch's tree identical to `main`; the branch deleted; `main` at `8ea4e3d` throughout; khaylub.com unchanged | one: the owner's first body sentence landed in the `problem` field on a phone and was moved to the body at the publish step (a Phase 25 editor item) |
