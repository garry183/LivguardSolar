# LivguardSolar Visual Regression Framework

Playwright-based visual regression test suite for [livguardsolar.com](https://www.livguardsolar.com), with Allure reporting and multi-browser/multi-viewport coverage.

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

playwright.config.ts
global-teardown.ts    # Auto-generates and opens Allure report after every run
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

## CI notes

- `forbidOnly` is enforced in CI (`process.env.CI`).
- Retries: 1 in CI, 0 locally.
- Workers: 10 parallel workers.
- Navigation timeout: 45 s; action timeout: 15 s; per-test timeout: 60 s (extended per-describe where needed up to 400 s for slow API-driven sections).
- Screenshots, videos, and traces are retained only on failure.
