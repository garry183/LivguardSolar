# CONCERNS.md — Technical Debt, Issues & Fragile Areas
_Last updated: 2026-04-20_

## CRITICAL

### Exposed Credentials in .env
- `.env` file appears in git working tree with:
  ```
  BITBUCKET_USERNAME=garryLTD
  BITBUCKET_APP_PASSWORD=ATBBKw5jEPHGuZbXjmTy2d3KkpP589598979
  ```
- `.gitignore` declares `.env` as ignored but file is present
- **Action**: Rotate credentials immediately. Verify `.env` is not in git history.

---

## HIGH

### HAR Coverage Gap
- Only `rooftop-solar-noida` uses HAR replay in CI
- All other 5 test specs (`homepage`, `solar-for-home`, `solar-for-commercial`, `rooftop-solar`, `rooftop-solar-jaipur`) make live network requests to `stage.livguardsolar.com`
- Staging availability = CI reliability. Any staging downtime or flakiness causes false failures.
- **Action**: Record HAR for all page types; extend HAR replay to all fixtures.

### Hardcoded Staging URLs in Page Objects
- `SolarForHomePage.ts`, `SolarForCommercialPage.ts`, `RooftopSolarPage.ts`, `RooftopSolarJaipurPage.ts`, `RooftopSolarNoidaPage.ts` all hardcode `https://stage.livguardsolar.com/...`
- Only `HomePage.ts` correctly uses relative path with `baseURL`
- Cannot run these tests against production or any other environment without code changes
- **Action**: Replace hardcoded URLs with `baseURL`-relative paths and environment-driven config.

### CI Workers Configuration Mismatch
- `playwright.config.ts` line 12: `workers: process.env.CI ? 4 : 10`
- `bitbucket-pipelines.yml`: `--workers=100%` passed on command line (overrides config)
- 4-vCPU box with 100% workers = unpredictable worker count, potential OOM or thrashing
- **Action**: Remove `--workers=100%` override from pipeline; let config drive worker count.

### Massive Test Timeouts
- Section snapshot describe blocks set `test.setTimeout(300_000)` to `400_000` (5–6.7 minutes)
- Root cause: API-driven page sections, IntersectionObserver lazy loading, Firefox analytics connections
- Individual tests regularly take 40–90 seconds
- Full CI run can exceed 30 minutes
- **Action**: HAR replay for all pages would eliminate network latency; mock or stub API-driven sections.

---

## MEDIUM

### Text-Based Selectors Fragile to Rebrand
- ~23 locators use `getByText()` or `.filter({ hasText: /.../ })` with exact UI copy
- Comments note "update if site is rebranded" — this is a manual maintenance burden
- Examples in `HomePage.ts`: `/reliable solar/i`, `/nationwide reach/i`
- **Action**: Add `data-testid` attributes to the application; migrate locators to `getByTestId`.

### Self-Healing Pattern Not Applied Consistently
- `RooftopSolarPage.ts` uses `.or()` fallback for all locators (good)
- `HomePage.ts`, `SolarForHomePage.ts` lack this resilience
- **Action**: Apply `.or()` fallback pattern across all page objects.

### Snapshot Tolerance Values Undocumented
- `maxDiffPixelRatio` varies: 0.02 (default), 0.05, 0.08, 0.10, 0.12, 0.15 across tests
- No documented rationale for which section gets which tolerance
- High tolerances (0.15) could mask real visual regressions in those sections
- **Action**: Document rationale per section in a tolerance registry.

### Page Object Code Duplication
- 6 page objects with near-identical `goto()`, `prepareForSnapshot()`, `scrollToSection()` implementations
- `RooftopSolarPage` serves as informal base but others don't extend it
- **Action**: Extract shared logic into a `BasePage` class.

### Allure Report Not Generated in CI
- `global-teardown.ts` skips Allure generation in CI (no Java in Docker image)
- Raw `allure-results/` archived but no HTML report accessible from pipeline
- **Action**: Add Java to Docker image, or switch to `allure-playwright` cloud, or use Allure TestOps.

### Timer Clearing Anti-Pattern
```typescript
const maxId = window.setTimeout(() => {}, 0) as unknown as number;
for (let id = 1; id <= maxId; id++) { window.clearInterval(id); window.clearTimeout(id); }
```
- Assumes sequential browser timer IDs (non-standard implementation detail)
- May not clear all timers if IDs are non-sequential or gap-based
- **Action**: Replace with explicit tracking of started timers or use CSS-only freeze.

### Brain History Too Thin
- Only ~1 run in `run-history.ndjson` as of 2026-04-10
- Flakiness scores computed from minimal data (scores of 0 or 1, not meaningful yet)
- Health status classifications not yet reliable
- **Action**: Run tests regularly to build up historical baseline.

---

## LOW

### No Firefox Testing
- Only 3 browser projects: chromium-desktop, mobile-chrome, mobile-safari
- Firefox excluded despite being ~25% desktop browser market share
- `VIEWPORTS.tablet` defined but no tablet project configured or used

### Full-Page Snapshots All Skipped
- 4+ spec files have full-page snapshot tests that always skip
- These are dead test code consuming file space and reader confusion
- **Action**: Either implement deterministic full-page snapshots (with proper masking) or delete the tests.

### global-teardown Spawns Browser Window
- `spawn('npx', ['allure', 'open', ...], { detached: true })` opens browser after local test run
- `shell: true` with dynamic paths is a minor security concern
- Can interrupt CI if run in an environment where Allure generation isn't skipped

### No Interaction or Functional Tests
- Framework only covers visual snapshots and element visibility
- No form submissions, CTA clicks, navigation flows, or API response validation

### No Accessibility Testing
- ARIA roles used in locators but no `@axe-core/playwright` or similar a11y audit

### HAR Asset Maintenance
- `tests/fixtures/har/` contains hash-named extracted assets (`*.svg`, `*.css`, `*.dat`)
- These are Playwright HAR internals — binary/generated files, difficult to diff or review in git
- HAR can become stale silently if staging API changes without triggering test failures (if responses have same structure but different content)
