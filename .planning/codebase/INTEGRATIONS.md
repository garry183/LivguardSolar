# INTEGRATIONS.md — External Services & APIs
_Last updated: 2026-04-20_

## Target Application
- **Production**: `https://www.livguardsolar.com` (via `BASE_URL` / `baseURL` in config)
- **Staging**: `https://stage.livguardsolar.com` (hardcoded in most page objects)
- **CDN (staging)**: `https://cdndev.livguardsolar.com` (JS/CSS bundles)

## HAR Replay (Hermetic CI)
- **Purpose**: Capture staging API responses locally, replay hermetically in CI to eliminate network flakiness
- **File**: `tests/fixtures/har/rooftop-solar-noida.har` (5.8 MB)
- **Domains captured**: `/(stage|cdndev)\.livguardsolar\.com/`
- **CI mode**: `routeFromHAR(..., { notFound: 'abort' })` — surfaces misses as `net::ERR_FAILED`
- **Recording mode**: `routeFromHAR(..., { update: true })` via `RECORD_HAR=1`
- **Coverage**: Only `RooftopSolarNoidaPage` uses HAR; all other pages hit live staging

## Blocked Third-Party Scripts
These are aborted via `route.abort()` on page load to reduce noise and improve determinism:
- `google-analytics.com`
- `googletagmanager.com`
- `fonts.googleapis.com`, `fonts.gstatic.com`
- `connect.facebook.net`
- `hotjar.com`
- `clarity.ms`
- `doubleclick.net`

## Allure Reporting
- **Reporter**: `allure-playwright` (writes to `allure-results/`)
- **Report generation**: `allure-commandline` (requires Java; skipped in CI)
- **Local**: `global-teardown.ts` spawns `npx allure open` as detached process after run
- **CI limitation**: Java not available in Playwright Docker image → raw results archived only

## Bitbucket Pipelines API
- **Purpose**: Download CI artifacts (snapshots, reports, health files) to local machine
- **Script**: `scripts/fetch-pipeline-artifacts.ts`
- **API base**: `https://api.bitbucket.org/2.0/repositories/lipl-dev/livguardsolar360`
- **Auth**: Basic auth (`BITBUCKET_USERNAME:BITBUCKET_APP_PASSWORD`)
- **Artifacts fetched**: `reports/`, `allure-results/`, `tests/visual/__snapshots__/`, step logs
- **Local output**: `ci-artifacts/{timestamp}/`
- **Brain reports copied**: `ci-test-health.json`, `ci-playwright-report.json`, `ci-run-history.ndjson`

## Diagnostic Services (CI only)
- `https://api.ipify.org` — public IP probe (connectivity check at pipeline start)
- `https://stage.livguardsolar.com` — reachability curl before tests

## Brain Analytics (Internal)
- No external API — reads `reports/playwright-report.json`, writes to `reports/run-history.ndjson` and `reports/test-health.json`
- Runs via `global-teardown.ts` after every test execution
- GitHub Actions commits health files back to repo after each run
