# TESTING.md — Test Structure & Practices
_Last updated: 2026-04-20_

## Framework
- **Playwright Test** 1.50.0
- **Type**: Visual regression (screenshot comparison) + element visibility
- **Browsers**: chromium-desktop (1440×900), mobile-chrome (Pixel 5), mobile-safari (iPhone 13)

## Test Configuration
```typescript
// playwright.config.ts key settings
fullyParallel: !!process.env.CI,     // parallel in CI, sequential locally
retries: process.env.CI ? 1 : 0,
workers: process.env.CI ? 4 : 10,
timeout: process.env.CI ? 120_000 : 60_000,
navigationTimeout: process.env.CI ? 90_000 : 45_000,
actionTimeout: 15_000,
expect: { timeout: 15_000 },
forbidOnly: !!process.env.CI,
screenshot: 'only-on-failure',
video: 'retain-on-failure',
trace: 'retain-on-failure',
```

Snapshot path template:
```
{testDir}/visual/__snapshots__/{testFilePath}/{arg}-{projectName}{ext}
```

## Test Types

### 1. Element Visibility Tests
Verify key elements are present and visible:
```typescript
test.describe('Homepage – Element visibility', () => {
  test('logo is visible', async ({ homePage }) => {
    await expect(homePage.logo).toBeVisible();
  });
});
```

### 2. Section Snapshot Tests (primary)
Pixel-level regression on individual page sections:
```typescript
test.describe('Homepage – Section snapshots', () => {
  test.beforeEach(async ({ homePage }) => {
    test.setTimeout(300_000);
    await homePage.prepareForSnapshot();   // lazy load + freeze
  });

  test('section – hero', async ({ homePage }) => {
    await homePage.scrollToSection(homePage.heroSection);
    await expect(homePage.heroSection).toHaveScreenshot('hero.png', {
      maxDiffPixelRatio: 0.05,
    });
  });
});
```

### 3. Mobile Tests
Page-level screenshot at mobile viewport (avoids Playwright's internal scrollIntoView triggering IO callbacks):
```typescript
test('mobile – hero', async ({ homePage }) => {
  await homePage.scrollToSection(homePage.heroSection);
  await freezeAnimations(homePage.page);
  await expect(homePage.page).toHaveScreenshot('mobile-hero.png', {
    maxDiffPixelRatio: 0.05,
  });
});
```

### 4. Full-Page Snapshots (mostly skipped)
Skipped on all API-driven pages due to non-deterministic page height:
```typescript
test('full page – desktop', async ({ homePage }) => {
  test.skip(true, 'Live staging API content is non-deterministic under parallel execution');
});
```

## Snapshot Preparation Sequence

Every section snapshot test follows this sequence:
1. **`goto()`** (fixture auto-calls): navigate + `networkidle` wait + cookie banner dismiss + initial `freezeAnimations()`
2. **`prepareForSnapshot()`** (beforeEach): `triggerLazyLoad()` + `waitForAllImages()` + `freezeAnimations()`
3. **`scrollToSection(locator)`** (per test): re-trigger if unmounted + `waitFor` API content + scroll via `evaluate()`
4. **`freezeAnimations()` again** (for IO-reactive sections that restart timers on scroll)
5. **`toHaveScreenshot()`**

## Key Utilities

### freezeAnimations(page)
```typescript
// Injects CSS to stop all animations/transitions
// Pauses all <video> elements
// Clears all window.setTimeout/setInterval IDs
await page.addStyleTag({ content: `*, *::before, *::after { animation-duration: 0s !important; ... }` });
await page.evaluate(() => {
  document.querySelectorAll('video').forEach(v => v.pause());
  const maxId = window.setTimeout(() => {}, 0) as unknown as number;
  for (let id = 1; id <= maxId; id++) { window.clearInterval(id); window.clearTimeout(id); }
});
```

### triggerLazyLoad(page)
```typescript
// Scrolls in 400px increments every 500ms until bottom
// Does NOT scroll back to top (would unmount IO-mounted sections)
// 2s dwell at bottom for async API fetches to resolve
```

### waitForAllImages(page, selector?)
```typescript
// Promise.all on all img elements
// 8s per-image fallback (stalled images don't block)
```

## HAR Replay (Noida page only)
```typescript
// CI mode: replay hermetically
if (process.env.CI) {
  await this.page.routeFromHAR(HAR_PATH, { url: HAR_DOMAINS, notFound: 'abort' });
  this.page.on('requestfailed', req => console.log('[REQ FAILED]', req.url(), ...));
}
// Recording mode: capture fresh
else if (process.env.RECORD_HAR) {
  await this.page.routeFromHAR(HAR_PATH, { url: HAR_DOMAINS, update: true });
}
```

## Timeout Strategy
Tests have layered timeouts:

| Level | Source | Value |
|-------|--------|-------|
| Base test timeout | `playwright.config.ts` | 120s CI / 60s local |
| Section snapshots describe | `test.setTimeout()` in beforeEach | 300,000–400,000ms |
| Individual test override | `test.setTimeout()` inline | varies |
| Action timeout | config | 15,000ms |
| Navigation timeout | config | 90s CI / 45s local |
| Per-image wait | `waitForAllImages()` | 8,000ms fallback |

## CI Behaviour
- `CI=1` enables: 4 workers, 1 retry, longer timeouts, `fullyParallel`, `forbidOnly`
- Pipeline runs: `rooftop-solar-noida.visual.spec.ts` with `--update-snapshots` (Bitbucket)
- GitHub Actions runs all specs against production URL

## Reporters
1. `list` — console (dot per test)
2. `json` → `reports/playwright-report.json` (input for brain analysis)
3. `html` → `reports/html/`
4. `junit` → `reports/junit/results.xml`
5. `allure-playwright` → `allure-results/`

## Brain Analysis (post-run)
Runs automatically via `global-teardown.ts` after every test run.
Reads `reports/playwright-report.json`, classifies every failure, updates `reports/test-health.json` and `reports/run-history.ndjson`.

See `ARCHITECTURE.md` for full brain classification logic.

## Known Skipped Tests
| Reason | Tests affected |
|--------|---------------|
| API-driven page height variance | All full-page snapshots |
| Mobile footer not rendered | Footer on mobile-chrome/mobile-safari (city pages) |
| Parallel execution non-determinism | Full-page snapshots on Solar for Commercial |
| Section timing out consistently | Solar for Commercial sections 9, 10 |
| Nav links not visible on mobile (hamburger) | Nav link visibility on mobile |
