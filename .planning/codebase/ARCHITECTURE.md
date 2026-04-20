# ARCHITECTURE.md — System Design & Patterns
_Last updated: 2026-04-20_

## Pattern
**Playwright Visual Regression Testing Framework** with a post-run intelligence layer.

Type: Test automation framework (not a product codebase)
Target: LivguardSolar.com website (Next.js, API-driven, multi-page)

## Layers

```
playwright.config.ts          ← Config layer: projects, reporters, timeouts, snapshot paths
        │
        ▼
tests/fixtures/*.fixture.ts   ← Fixture layer: auto-navigate, inject page objects into tests
        │
        ▼
tests/pages/*.ts              ← Page Object layer: semantic locators, navigation, snapshot prep
        │
        ▼
tests/utils/visualHelpers.ts  ← Utility layer: animation freeze, lazy load, image wait
        │
        ▼
tests/visual/*.visual.spec.ts ← Test layer: visibility assertions + section snapshots
        │
        ▼
global-teardown.ts            ← Teardown: Allure generation + triggers brain analysis
        │
        ▼
brain/analyze.ts              ← Intelligence layer: classify failures, score health, update history
        │
        ├── reports/run-history.ndjson   (append-only audit trail)
        └── reports/test-health.json     (current health snapshot)
```

## Data Flow

```
Playwright runs tests
        │
        ▼
reports/playwright-report.json         ← JSON reporter output
        │
        ▼
brain/analyze.ts
   ├── flattenSuites() → NormalizedTestEntry[]
   ├── readHistory() → existing HistoryRecord[]
   ├── classifyFailure() → FLAKY|INFRA|REAL_REGRESSION|SELECTOR_BROKEN|THRESHOLD_DRIFT|UNKNOWN
   ├── appendHistory() → appends to run-history.ndjson
   ├── computeHealth() → TestHealthEntry per test
   ├── writeHealth() → overwrites test-health.json
   └── printSummary() → console (blocking vs quarantined)
```

## Page Object Model (POM)

All page classes follow a consistent structure:

```typescript
export class PageName {
  readonly page: Page;

  // Locators declared as readonly properties
  readonly heroSection: Locator;
  readonly navbar: Locator;

  constructor(page: Page) {
    this.page = page;
    // Locators initialized here — semantic (role-based) with structural fallback
    this.heroSection = page.getByRole('heading', { name: /save big/i })
      .or(page.locator('main > div').first());
  }

  async goto(): Promise<void> { /* navigate + hydration wait + animation freeze */ }
  async prepareForSnapshot(): Promise<void> { /* triggerLazyLoad + waitForAllImages + freezeAnimations */ }
  async scrollToSection(locator: Locator): Promise<void> { /* re-trigger lazy, scroll, settle */ }
}
```

## Self-Healing Locators
Primary selector (semantic/ARIA) chained with `.or()` fallback (structural/text):
```typescript
this.whyLivguardSection = page
  .locator('main > div')
  .filter({ has: page.getByRole('heading', { name: /why choose livguard/i }) })
  .first()
  .or(sections.filter({ hasText: /why choose.*livguard|why livguard/i }).first());
```

## Fixture Layer
Each page has a corresponding fixture that auto-navigates before each test:
```typescript
export const test = base.extend<{ homePage: HomePage }>({
  homePage: async ({ page }, use) => {
    const homePage = new HomePage(page);
    await homePage.goto();   // Navigate before test
    await use(homePage);     // Inject into test
  },
});
```

## Brain Intelligence Layer

### 5 Classification Rules (evaluated in order, first match wins)
1. **FLAKY** — test failed first attempt but passed on retry
2. **INFRA** — 3+ tests timed out in same run (network/infra issue)
3. **REAL_REGRESSION** — failed on all 3 projects, not flaky, low historical flakiness score (<0.3)
4. **SELECTOR_BROKEN** — error contains `locator.waitFor`, `0 elements`, `strict mode violation`, `Target closed`
5. **THRESHOLD_DRIFT** — error mentions `toHaveScreenshot` / `Screenshot comparison failed`, not flaky, score <0.3
6. **UNKNOWN** — none of the above (extension point for AI analysis)

### Health Scoring
```
flakiness_score = failed_runs / total_runs_recorded
```

| Status | Condition |
|--------|-----------|
| `healthy` | score < 0.2 OR last 5+ runs all passed |
| `watch` | score 0.2–0.49 |
| `quarantined` | score ≥ 0.5 AND consecutive_passes < 5 |

Quarantined tests do not block CI. They self-heal after 5 consecutive passes.

## Key Abstractions
- `freezeAnimations(page)` — CSS injection + JS timer clearing for deterministic snapshots
- `triggerLazyLoad(page)` — 400px incremental scroll to mount IntersectionObserver sections
- `waitForAllImages(page)` — Promise.all on all img elements with 8s timeout fallback
- `scrollToSection(locator)` — Re-triggers lazy load if section unmounted, scrolls via `evaluate()`

## Entry Points
- `npx playwright test` — runs all tests
- `npx ts-node brain/analyze.ts` — standalone brain re-analysis
- `npx ts-node scripts/record-har.ts` — HAR recording
- `npx ts-node scripts/fetch-pipeline-artifacts.ts` — download CI artifacts
