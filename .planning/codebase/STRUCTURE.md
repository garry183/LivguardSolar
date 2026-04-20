# STRUCTURE.md — Directory Layout & Organization
_Last updated: 2026-04-20_

## Root Layout

```
livguardsolar360/
├── playwright.config.ts              # Playwright config (projects, reporters, timeouts, snapshot paths)
├── global-teardown.ts                # Post-run hook (Allure generation + brain analysis)
├── tsconfig.json                     # TypeScript config
├── package.json                      # Dependencies + npm scripts
├── package-lock.json
├── bitbucket-pipelines.yml           # Primary CI pipeline
├── .env                              # Bitbucket credentials (should be git-ignored)
├── .gitignore
├── README.md
├── BRAIN.md                          # Brain layer documentation
│
├── tests/                            # All test code
│   ├── pages/                        # Page Object Models
│   ├── fixtures/                     # Playwright test fixtures
│   ├── utils/                        # Shared test utilities
│   └── visual/                       # Visual regression test specs + snapshots
│
├── brain/                            # Post-run intelligence & health tracking
├── scripts/                          # Utility scripts (HAR recording, artifact fetch)
├── reports/                          # Test output (partially committed to git)
├── allure-results/                   # Raw Allure data (git-ignored)
├── allure-report/                    # Generated Allure HTML (git-ignored)
└── ci-artifacts/                     # Downloaded CI artifacts (git-ignored)
```

## tests/pages/ — Page Object Models

| File | Page | Notes |
|------|------|-------|
| `HomePage.ts` | Production homepage `/` | Uses `baseURL` from config |
| `SolarForHomePage.ts` | `/solar-for-home` | Hardcoded staging URL |
| `SolarForCommercialPage.ts` | `/solar-for-commercial` | Hardcoded staging URL |
| `RooftopSolarPage.ts` | `/rooftop-solar` (base) | Hardcoded staging URL; base class for city pages |
| `RooftopSolarJaipurPage.ts` | `/rooftop-solar-jaipur` | Extends RooftopSolarPage |
| `RooftopSolarNoidaPage.ts` | `/rooftop-solar-noida` | HAR replay/record logic + diagnostics |

## tests/fixtures/ — Test Fixtures

| File | Fixture name | Page class |
|------|-------------|-----------|
| `base.ts` | `homePage` | `HomePage` |
| `solarForHome.fixture.ts` | `solarForHomePage` | `SolarForHomePage` |
| `solarForCommercial.fixture.ts` | `solarForCommercialPage` | `SolarForCommercialPage` |
| `rooftopSolar.fixture.ts` | `rooftopPage` | `RooftopSolarPage` |
| `rooftopSolarJaipur.fixture.ts` | `jaipurPage` | `RooftopSolarJaipurPage` |
| `rooftopSolarNoida.fixture.ts` | `noidaPage` | `RooftopSolarNoidaPage` |
| `har/` | — | HAR files for CI replay |

## tests/utils/

| File | Exports |
|------|---------|
| `visualHelpers.ts` | `freezeAnimations`, `triggerLazyLoad`, `waitForAllImages`, `VIEWPORTS` |

## tests/visual/ — Test Specs

| File | Page tested | Sections covered |
|------|-------------|-----------------|
| `homepage.visual.spec.ts` | Homepage | navbar, hero, why-livguard, solar-diaries, nationwide-reach, footer |
| `solar-for-home.visual.spec.ts` | Solar for Home | navbar, hero, calculator, steps, benefits, footer |
| `solar-for-commercial.visual.spec.ts` | Solar for Commercial | navbar, hero, solutions, benefits, footer |
| `rooftop-solar.visual.spec.ts` | Rooftop Solar (generic) | navbar, hero, features, portfolio, faq, footer |
| `rooftop-solar-jaipur.visual.spec.ts` | Rooftop Solar Jaipur | same + city-specific sections |
| `rooftop-solar-noida.visual.spec.ts` | Rooftop Solar Noida | same + HAR replay |

### Snapshot storage
```
tests/visual/__snapshots__/visual/
├── homepage.visual.spec.ts/
│   ├── navbar-chromium-desktop.png
│   ├── navbar-mobile-chrome.png
│   ├── navbar-mobile-safari.png
│   ├── hero-chromium-desktop.png
│   └── ... (section × project combinations)
├── solar-for-home.visual.spec.ts/
├── solar-for-commercial.visual.spec.ts/
├── rooftop-solar.visual.spec.ts/
├── rooftop-solar-jaipur.visual.spec.ts/
└── rooftop-solar-noida.visual.spec.ts/
```
~251 PNG files committed to git.

## brain/ — Intelligence Layer

| File | Responsibility |
|------|---------------|
| `analyze.ts` | Main entry point; orchestrates all brain steps |
| `rules.ts` | 5 failure classification rules + `classifyFailure()` |
| `health.ts` | Flakiness scoring, `deriveStatus()`, `computeHealth()`, `writeHealth()` |
| `history.ts` | `readHistory()` (parse NDJSON), `appendHistory()` (append records) |
| `types.ts` | TypeScript interfaces: `PlaywrightReport`, `NormalizedTestEntry`, `HistoryRecord`, `TestHealthEntry`, `FailureCategory` |

## scripts/

| File | Purpose |
|------|---------|
| `record-har.ts` | Record fresh HAR (run with `RECORD_HAR=1`) |
| `fetch-pipeline-artifacts.ts` | Download latest CI run artifacts from Bitbucket Pipelines API |

## reports/ (partially committed)

| File/Dir | Git status | Purpose |
|----------|-----------|---------|
| `playwright-report.json` | git-ignored | Playwright JSON reporter output |
| `run-history.ndjson` | committed | Append-only test history |
| `test-health.json` | committed | Current test health snapshot |
| `html/` | git-ignored | Playwright HTML report |
| `junit/results.xml` | git-ignored | JUnit XML for CI integration |
| `test-results/` | git-ignored | Screenshots, videos, traces on failure |

## Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Test spec | `{page}.visual.spec.ts` | `homepage.visual.spec.ts` |
| Page object | `{PageName}Page.ts` | `RooftopSolarNoidaPage.ts` |
| Fixture | `{pageName}.fixture.ts` | `solarForHome.fixture.ts` |
| Snapshot | `{section}-{project}.png` | `navbar-chromium-desktop.png` |
| HAR file | `{page-name}.har` | `rooftop-solar-noida.har` |
| Health key | `{test-name}-{project}` (lowercase, hyphenated) | `rooftop-solar-section-snapshots-section-portfolio-mobile-safari` |
