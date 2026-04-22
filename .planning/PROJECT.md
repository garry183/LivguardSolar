# Livguard Solar 360 — Visual Regression Suite

## What This Is

Playwright-based visual regression and functional testing framework for the Livguard Solar website (stage.livguardsolar.com), running in Bitbucket CI/CD pipelines triggered by staging deployments managed through Jenkins on AWS. Tests use HAR-based network isolation for deterministic, hermetically-sealed runs without relying on live network calls.

## Core Value

Catch visual regressions and content errors automatically after every staging deployment, before they reach production.

## Requirements

### Validated

- ✓ rooftop-solar visual regression — all 3 browsers (chromium-desktop, mobile-chrome, mobile-safari)
- ✓ rooftop-solar-noida visual regression — all 3 browsers
- ✓ rooftop-solar-jaipur visual regression — all 3 browsers
- ✓ solar-for-home visual regression — all 3 browsers
- ✓ solar-for-commercial visual regression — all 3 browsers
- ✓ HAR-based network isolation — `notFound: 'abort'` mode, all pages
- ✓ Bitbucket Pipelines CI/CD — Docker image `mcr.microsoft.com/playwright:v1.50.0-jammy`

### Active

- [ ] Lock solar-for-commercial baselines — remove `--update-snapshots` after CI runs clean
- [ ] City pages functional checks — verify city name in page matches URL slug, verify footer city links navigate to correct city (not full visual regression — ~17 pages, pipeline minutes constraint)
- [ ] Lead/form pages — full visual regression with HAR isolation (all 3 browsers)
- [ ] Homepage — fix React hydration issue and unpark visual tests (all 3 browsers)
- [ ] Jenkins webhook integration — Bitbucket webhook triggers visual framework on every staging deploy to AWS

### Out of Scope

- Full visual regression for all 17 city pages — too many pipeline minutes; content + navigation checks are sufficient
- Percy integration — deferred to v2, after all v1 requirements are complete
- Product detail pages — not in current scope
- Mobile app testing — web only

## Context

- **CI environment**: Bitbucket Cloud runners, Docker `mcr.microsoft.com/playwright:v1.50.0-jammy` (Ubuntu 22.04 — jammy chosen for font stability vs noble)
- **Network isolation**: HAR files stored in `tests/fixtures/har/` with sidecar files; `notFound: 'abort'` surfaces misses loudly
- **Snapshot strategy**: Baselines generated on CI Linux (not Windows), committed to git. `--update-snapshots` ON during baseline generation, removed once locked
- **Chromium-only flags**: `--font-render-hinting=none` etc. scoped to per-project `launchOptions`, NOT global `use` block (WebKit crashes on unknown options)
- **Homepage status**: Parked — all tests fail in CI due to React hydration issue (likely third-party script blocking or SSR mismatch)
- **Artifacts**: Bitbucket artifact download API returns empty — CI logs available via `npm run ci:artifacts`
- **Deployment**: Jenkins manages build/deploy to AWS staging; Bitbucket webhook will trigger visual tests post-deploy

## Constraints

- **Pipeline minutes**: Bitbucket Cloud — minimize per-step runtime; city pages use lightweight functional checks instead of full visual regression
- **Browsers**: Chromium flags crash WebKit — must scope per-project
- **Baselines**: Must be generated inside CI Docker container (Linux), never on Windows — font rendering differs
- **App passwords**: Bitbucket app passwords expire June 9, 2026 — must migrate to API tokens before then
- **Tech stack**: Playwright v1.50.0, TypeScript, ts-node, Next.js site (stage.livguardsolar.com)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| HAR isolation over live network | Bitbucket runners WAF-blocked by Indian staging server | ✓ Good |
| `notFound: 'abort'` over `'fallback'` | Fallback silently hits real network; abort surfaces misses loudly | ✓ Good |
| jammy over noble Docker image | Noble has FreeType rendering diffs vs jammy | ✓ Good |
| Chromium flags per-project, not global | Global flags crash WebKit with "Unknown option" | ✓ Good |
| City pages: functional only, not visual | 17 pages × 3 browsers = too many pipeline minutes | — Pending |
| Percy deferred to v2 | Complete site coverage + Jenkins integration first | — Pending |

---
*Last updated: 2026-04-22 — initial project initialization*
