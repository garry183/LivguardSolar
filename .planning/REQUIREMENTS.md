# Requirements: Livguard Solar 360 — Visual Regression Suite

**Defined:** 2026-04-22
**Core Value:** Catch visual regressions and content errors automatically after every staging deployment, before they reach production.

## v1 Requirements

### Baselines

- [ ] **BASE-01**: solar-for-commercial `--update-snapshots` removed from pipeline after CI runs clean with all 3 browsers passing without retries

### City Pages

- [ ] **CITY-01**: Parameterised spec covers all ~17 city pages in a single test file
- [ ] **CITY-02**: Each city page is verified that the city name displayed in the page body matches the city slug in the URL
- [ ] **CITY-03**: Each city page footer link for that city, when clicked from another page, navigates to the correct city URL
- [ ] **CITY-04**: City page spec runs in CI on chromium-desktop only (pipeline minutes constraint)

### Lead / Form Pages

- [ ] **FORM-01**: HAR recorded for lead/form pages using full-page scroll test
- [ ] **FORM-02**: Visual regression spec created for lead/form pages with section-level snapshots
- [ ] **FORM-03**: Lead/form spec runs on all 3 browsers in CI (chromium-desktop, mobile-chrome, mobile-safari)
- [ ] **FORM-04**: Baselines generated and locked in CI (no `--update-snapshots` after initial run)

### Homepage

- [ ] **HOME-01**: Root cause of React hydration failure identified and fixed
- [ ] **HOME-02**: HAR re-recorded for homepage using full-page scroll test
- [ ] **HOME-03**: Homepage visual regression spec unparked and passing on all 3 browsers in CI
- [ ] **HOME-04**: Homepage baselines locked (no `--update-snapshots`)

### Jenkins Integration

- [ ] **JENK-01**: Bitbucket webhook configured to fire on every successful staging deploy
- [ ] **JENK-02**: Jenkins job receives webhook and triggers Bitbucket pipeline (or runs framework directly)
- [ ] **JENK-03**: Pipeline result (pass/fail) reported back — visible in Jenkins or Bitbucket
- [ ] **JENK-04**: Webhook documented in project README / runbook

### Linear Design Validation

- [ ] **LIN-01**: Script file lives at `tests/linear/design-to-code-validation.spec.ts` and is never picked up by `npx playwright test tests/visual/` (isolated from regression suite)
- [ ] **LIN-02**: Script parses Linear ticket ID matching `[A-Z]+-\d+` from `$BITBUCKET_BRANCH`; exits 0 with skip message if no ID found
- [ ] **LIN-03**: Script fetches image attachment URL from Linear ticket via raw `fetch` POST to Linear GraphQL API (`Authorization: Bearer $LINEAR_API_KEY`) — no SDK; fails with message if no image found on ticket
- [ ] **LIN-04**: Script screenshots the staging page using `chromium.launch()` directly, reusing `tests/utils/visualHelpers.ts` helpers (`freezeAnimations`, `triggerLazyLoad`, `waitForAllImages`) and 1440×900 viewport
- [ ] **LIN-05**: Script calls Anthropic messages API via raw `fetch` with both images base64-encoded; response parsed into structured result: `isUpdated` (boolean), `confidence` (high/medium/low), `summary` (string), `differences[]`, `matchingElements[]`
- [ ] **LIN-06**: `bitbucket-pipelines.yml` has a new post-deploy step that runs the script; step exits 0 (pass) or 1 (fail); skipped when branch contains no Linear ticket ID; env vars `LINEAR_API_KEY`, `ANTHROPIC_API_KEY`, `STAGING_URL`, `VERIFY_PATH` documented

## v2 Requirements

### Percy

- **PERCY-01**: Percy project created and linked to Livguard Solar repo
- **PERCY-02**: Playwright Percy SDK integrated into visual spec files
- **PERCY-03**: Percy runs on every PR/merge with branch comparison and human approval workflow
- **PERCY-04**: Baseline approval workflow documented for team

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full visual regression for all 17 city pages | Pipeline minutes constraint — functional checks sufficient |
| Product detail page visual tests | Not in current scope |
| Mobile app testing | Web only |
| Percy (v1) | Deferred until full site coverage + Jenkins integration complete |
| Bitbucket API token migration | Operational task, not part of this framework build |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BASE-01 | Phase 1 | Pending |
| CITY-01 | Phase 2 | Pending |
| CITY-02 | Phase 2 | Pending |
| CITY-03 | Phase 2 | Pending |
| CITY-04 | Phase 2 | Pending |
| FORM-01 | Phase 3 | Pending |
| FORM-02 | Phase 3 | Pending |
| FORM-03 | Phase 3 | Pending |
| FORM-04 | Phase 3 | Pending |
| HOME-01 | Phase 4 | Pending |
| HOME-02 | Phase 4 | Pending |
| HOME-03 | Phase 4 | Pending |
| HOME-04 | Phase 4 | Pending |
| JENK-01 | Phase 5 | Pending |
| JENK-02 | Phase 5 | Pending |
| JENK-03 | Phase 5 | Pending |
| JENK-04 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-22*
*Last updated: 2026-04-22 after initial definition*
