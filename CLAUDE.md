# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Playwright visual regression + performance test suite for `livguardsolar.com`. It runs against `https://stage.livguardsolar.com` and produces section-level screenshot baselines, Lighthouse scores, and a "brain" health tracker. CI runs on Bitbucket Pipelines.

## Commands

```bash
# Run all visual tests (all projects) + brain analysis
npm run test:visual

# Run a single project
npm run test:desktop        # chromium-desktop only
npm run test:mobile         # mobile-chrome only

# Run a single spec file
npx playwright test tests/visual/homepage.visual.spec.ts

# Run a single test by name
npx playwright test tests/visual/homepage.visual.spec.ts -g "section – hero"

# Update snapshot baselines
npm run test:update-snapshots

# Update baselines for one spec + one project
npx playwright test tests/visual/homepage.visual.spec.ts --project=chromium-desktop --update-snapshots

# Simulate CI locally (enables parallel workers, retries)
CI=1 BASE_URL=https://stage.livguardsolar.com npx playwright test

# Re-record a HAR file (run locally when site content changes)
npm run test:record-har:homepage
npm run test:record-har:rooftop-solar
npm run test:record-har:solar-for-home
npm run test:record-har:solar-for-commercial

# Lighthouse performance audit (needs STAGING_URL set)
STAGING_URL=https://stage.livguardsolar.com npm run perf:lighthouse

# Brain: re-analyse last test run without re-running tests
npm run brain:analyze

# Open HTML report
npm run test:report
```

## Architecture

### Page Object Model

`tests/pages/*.ts` — one class per page. Each class owns:
- All `Locator` properties (declared in the constructor, never in tests)
- `goto()` — handles navigation; optionally re-records HAR when `RECORD_HAR=1`
- `prepareForSnapshot()` — triggers lazy-load, waits for images, freezes animations
- `scrollToSection(locator)` — robust scroll that handles IO-unmounted sections

Tests never query the DOM directly; they use page object locators.

### Visual specs (`tests/visual/*.visual.spec.ts`)

Tests are **section-level screenshots**, not full-page. Full-page is permanently skipped on homepage because API-driven sections (portfolio, FAQ, nationwide reach) have non-deterministic content and heights under parallel execution. Section snapshots cover the same surface area reliably.

Snapshot path: `tests/visual/__snapshots__/{testFilePath}/{arg}-{projectName}.png`

### Fixtures (`tests/fixtures/`)

`base.ts` extends Playwright's `test` with typed page-object fixtures (e.g. `homePage`).  
`har/` contains pre-recorded `.har` files, one per page. These are **committed to the repo** and used for local re-recording via `RECORD_HAR=1`. CI now hits the live staging CDN directly (cdndev.livguardsolar.com is whitelisted for Bitbucket runner IPs).

### HAR pattern

`cdndev.livguardsolar.com` (JS/CSS bundles) is now whitelisted for Bitbucket runner IPs — CI hits the live CDN directly and React hydrates normally. HAR files are kept in the repo for local re-recording only.

- In CI: no HAR replay — tests navigate to live staging URLs.
- Locally with `RECORD_HAR=1`: re-records the HAR from live responses when site content changes.

After re-recording a HAR locally, update snapshots in the same commit (they are one atomic unit).

### Animation stabilisation (`tests/utils/visualHelpers.ts`)

`freezeAnimations(page)` — injects CSS to zero all animation durations, pauses videos, and clears all `setInterval`/`setTimeout`/`requestAnimationFrame` IDs.

For sections with `IntersectionObserver`-triggered animations (carousels, counters), **call `freezeAnimations` three times with 2 s dwells between calls**. A single freeze is insufficient because IO callbacks fire asynchronously after the first freeze and restart timers.

`triggerLazyLoad(page)` — scrolls the full page in 400 px steps, waiting for `scrollHeight` to stabilise for 4 consecutive ticks (2 s each) before returning.

### Playwright projects

| Project | Device | Viewport |
|---|---|---|
| `chromium-desktop` | Desktop Chrome | 1440×900 |
| `mobile-chrome` | Pixel 5 | 393×851 |
| `mobile-safari` | iPhone 13 | 390×844 |

Font rendering flags (`--font-render-hinting=none`, `--disable-lcd-text`, etc.) are applied to Chromium projects to get cross-OS deterministic baselines.

### Brain (`brain/`)

Post-run analysis layer. After each test run, `brain/analyze.ts` reads `reports/playwright-report.json`, classifies failures by category (`rules.ts`), appends to `reports/run-history.ndjson`, and updates `reports/test-health.json`. `npm run test:visual` runs this automatically.

### Lighthouse CI (`lighthouserc.js`)

Audits 4 URLs × 5 runs. Needs `STAGING_URL` env var. Assertions are all `warn` (non-blocking). In CI, uses **Google Chrome Stable** (installed via apt in the pipeline) — Playwright's bundled Chromium has a different TLS fingerprint that Cloudflare Bot Fight Mode blocks.

### CI pipeline (`bitbucket-pipelines.yml`)

**Default pipeline** — Lighthouse CI only (runs on every push).  
**`master-update` (custom)** — Re-records HAR + updates snapshots for a chosen page, then commits back to master.  
**`load-test` (custom)** — k6 load test, manual trigger only.

## Key environment variables

| Var | Used by | Notes |
|---|---|---|
| `BASE_URL` | Playwright tests | Default: `https://www.livguardsolar.com` |
| `STAGING_URL` | Lighthouse CI | Required; no trailing slash |
| `CI` | Playwright + teardown | Enables parallel workers, skips Allure generation |
| `RECORD_HAR` | Page `goto()` | Set to `1` to re-record HAR from live responses |

## Non-obvious constraints

- **Never add a second `forcePageVisible()` call** — it reveals hidden responsive forms that inflate snapshot dimensions and cascade failures across multiple tests.
- **HAR re-record + snapshot update must be one atomic commit** — stale HAR with fresh snapshots (or vice versa) causes dimension mismatches in CI.
- **Full-page mobile snapshots are skipped in CI** — resizing viewport at desktop size triggers the error boundary. Controlled by `process.env.CI` guards in the spec.
- **Linux WebKit caps `scrollBy` lazy-load at ~5701 px** — `triggerLazyLoad` uses a stable-height strategy to work around this.
- **Allure report generation requires Java** — skipped automatically in CI via `global-teardown.ts`.
