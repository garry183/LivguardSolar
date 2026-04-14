# LivguardSolar Visual Regression Framework

Playwright-based visual regression test suite for [livguardsolar.com](https://www.livguardsolar.com), with Allure reporting, multi-browser/multi-viewport coverage, and a built-in brain layer that classifies failures and tracks test health over time.

---

## What's covered

| Page | Spec file |
|---|---|
| Homepage (`/`) | `tests/visual/homepage.visual.spec.ts` |
| Solar for Home | `tests/visual/solar-for-home.visual.spec.ts` |
| Solar for Commercial | `tests/visual/solar-for-commercial.visual.spec.ts` |
| Rooftop Solar | `tests/visual/rooftop-solar.visual.spec.ts` |

Each spec has three test groups:

- **Element visibility** — asserts key UI elements (navbar, logo, hero, footer, CTAs) are visible.
- **Section snapshots** — pixel-level screenshot comparison of individual page sections (navbar, hero, stats, portfolio, FAQ, footer, etc.).
- **Mobile responsive snapshots** — same sections captured at mobile viewport (`390×844`).

Full-page snapshots are intentionally skipped because API-driven sections introduce non-deterministic page heights between runs; section-level tests provide equivalent stable coverage.

---

## Project structure

```
tests/
  pages/              # Page Object Models
    HomePage.ts
    SolarForHomePage.ts
    SolarForCommercialPage.ts
    RooftopSolarPage.ts
  fixtures/           # Playwright fixture wrappers (auto-navigate on setup)
    base.ts
    solarForHome.fixture.ts
    solarForCommercial.fixture.ts
    rooftopSolar.fixture.ts
  utils/
    visualHelpers.ts  # freezeAnimations, triggerLazyLoad, waitForAllImages, VIEWPORTS
  visual/             # Test specs
    homepage.visual.spec.ts
    solar-for-home.visual.spec.ts
    solar-for-commercial.visual.spec.ts
    rooftop-solar.visual.spec.ts
    __snapshots__/    # Baseline PNG snapshots (committed to git)

brain/                # Post-run intelligence layer (see BRAIN.md)
  types.ts            # Shared TypeScript interfaces
  rules.ts            # 5 classification rules
  history.ts          # Append-only run history (NDJSON)
  health.ts           # Flakiness scoring and health computation
  analyze.ts          # Orchestrator — entry point

reports/              # Generated after every run (partially committed to git)
  run-history.ndjson  # Append-only log of every test result (committed)
  test-health.json    # Current health snapshot of every test (committed)

playwright.config.ts
global-teardown.ts    # Auto-generates Allure report + runs brain analysis
```

---

## Browsers & viewports

Three Playwright projects run on every test:

| Project | Device |
|---|---|
| `chromium-desktop` | Desktop Chrome at 1440×900 |
| `mobile-chrome` | Pixel 5 |
| `mobile-safari` | iPhone 13 |

---

## Visual comparison settings

- `maxDiffPixelRatio`: `0.02` (global) — individual tests relax this for animated/carousel sections.
- `threshold`: `0.2` — per-pixel colour tolerance.
- `animations`: disabled — all CSS animations/transitions are killed before every snapshot via `freezeAnimations()`.
- Scrollbars hidden globally to prevent width-shift artefacts on Windows Chromium.

---

## Setup

```bash
npm install
npm run install:browsers   # installs Chromium, Pixel 5 + iPhone 13 browser binaries
```

---

## Running tests

```bash
# Run all visual specs (all browsers)
npm run test:visual

# Desktop only
npm run test:desktop

# Mobile Chrome only
npm run test:mobile

# Headed (watch mode)
npm run test:headed

# Debug mode (Playwright Inspector)
npm run test:debug
```

### Update baselines

Run this after intentional UI changes to regenerate all baseline PNGs:

```bash
npm run test:update-snapshots
```

---

## Reports

After every run, `global-teardown.ts` automatically generates and opens the Allure report.

| Command | Description |
|---|---|
| `npm run test:report` | Open the last Playwright HTML report |
| `npm run allure:generate` | Re-generate Allure report from raw results |
| `npm run allure:serve` | Serve Allure results live |
| `npm run allure:open` | Open the pre-generated Allure HTML report |

Reports are written to:
- `reports/html/` — Playwright HTML report
- `reports/junit/results.xml` — JUnit XML (for CI integration)
- `allure-results/` — raw Allure data
- `allure-report/` — generated Allure HTML report
- `reports/test-results/` — failure screenshots, videos, and traces

---

## Key utilities (`tests/utils/visualHelpers.ts`)

| Utility | Purpose |
|---|---|
| `freezeAnimations(page)` | Injects CSS to zero-out all animation/transition durations; pauses videos; clears all JS timers (carousels, counters) |
| `triggerLazyLoad(page)` | Scrolls the full page incrementally to trigger `IntersectionObserver`-based lazy sections, then dwells 2 s for async API data |
| `waitForAllImages(page)` | Waits for every `<img>` to finish loading (8 s fallback per image) |
| `snapshotName(...parts)` | Builds a filename-safe snapshot name string |
| `VIEWPORTS` | `desktop` (1440×900), `tablet` (768×1024), `mobile` (390×844) |

---

## Environment

Override the target URL via `BASE_URL`:

```bash
BASE_URL=https://staging.livguardsolar.com npm run test:visual
```

Default: `https://www.livguardsolar.com`

---

---

## Brain layer

After every run (local or CI), the brain layer automatically:

1. Reads `reports/playwright-report.json`
2. Classifies each failure into one of 5 categories: `FLAKY`, `INFRA`, `REAL_REGRESSION`, `SELECTOR_BROKEN`, `THRESHOLD_DRIFT`
3. Appends results to `reports/run-history.ndjson`
4. Rewrites `reports/test-health.json` with updated flakiness scores
5. Prints a structured summary to the console

**The brain runs automatically** — you do not need to do anything extra after running tests.

### Brain commands

```bash
# Re-run analysis on the last test report without re-running tests
npm run brain:analyze

# Clear all local history and health data (start fresh)
npm run brain:reset
```

### Local vs CI

| | Local | CI (GitHub Actions) |
|---|---|---|
| Brain runs automatically | Yes — via `global-teardown.ts` | Yes — via workflow step |
| History accumulates | Yes — in `reports/` | Yes — committed back to `main` after each run |
| Health file updated | Yes | Yes — auto-committed with `[skip ci]` |
| Manual standalone run | `npm run brain:analyze` | `npx ts-node brain/analyze.ts` |
| Reset history | `npm run brain:reset` | Delete and commit the two files |

**Locally**, the two health files (`run-history.ndjson`, `test-health.json`) accumulate on your machine with each run. You can commit them when you want to share your local run history, or reset them with `npm run brain:reset` to start clean.

> Full explanation of how the brain works, the 5 rules, health scoring, and design decisions: see **[BRAIN.md](./BRAIN.md)**

---

## CI notes

- `forbidOnly` is enforced in CI (`process.env.CI`).
- Retries: 1 in CI, 0 locally.
- Workers: 10 parallel workers.
- Navigation timeout: 45 s; action timeout: 15 s; per-test timeout: 60 s (extended per-describe where needed up to 400 s for slow API-driven sections).
- Screenshots, videos, and traces are retained only on failure.
- The CI workflow (`.github/workflows/visual-tests.yml`) runs on push to `main`, on PRs targeting `main`, and on a daily schedule at 06:00 UTC.
