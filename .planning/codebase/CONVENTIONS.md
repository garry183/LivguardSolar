# CONVENTIONS.md — Code Style & Patterns
_Last updated: 2026-04-20_

## TypeScript Style
- **Strict mode**: enabled (`"strict": true`)
- **Async/await** throughout (no callbacks or raw Promises)
- **Readonly** properties on all locators in page objects
- **Numeric literals**: underscore separators for timeouts (`300_000`, `15_000`)

## Naming
| Kind | Convention | Example |
|------|-----------|---------|
| Classes | PascalCase | `RooftopSolarNoidaPage` |
| Methods | camelCase | `prepareForSnapshot` |
| Constants | SCREAMING_SNAKE_CASE | `VIEWPORTS`, `HAR_PATH` |
| Test files | kebab-case `.visual.spec.ts` | `rooftop-solar-noida.visual.spec.ts` |
| Fixtures | camelCase property name | `noidaPage`, `homePage` |
| Snapshots | kebab-case with project suffix | `navbar-chromium-desktop.png` |

## Import Style
```typescript
// Playwright first
import { test as base, expect } from '@playwright/test';
import { Page, Locator } from '@playwright/test';

// Local imports (relative)
import { HomePage } from '../pages/HomePage';
import { freezeAnimations } from '../utils/visualHelpers';
```

## Page Object Pattern
```typescript
export class HomePage {
  readonly page: Page;
  readonly heroSection: Locator;   // Declare locators as readonly
  readonly navbar: Locator;

  constructor(page: Page) {
    this.page = page;
    // All locators initialized in constructor
    this.heroSection = page.getByRole('region', { name: /hero/i })
      .or(page.locator('main > div').first()); // .or() fallback pattern
  }

  async goto(): Promise<void> { ... }
  async prepareForSnapshot(): Promise<void> { ... }
  async scrollToSection(locator: Locator): Promise<void> { ... }
}
```

## Locator Strategy (Self-Healing)
Primary: semantic/ARIA selectors. Fallback via `.or()` for resilience:
```typescript
this.whyLivguardSection = page
  .locator('main > div')
  .filter({ has: page.getByRole('heading', { name: /why choose livguard/i }) })
  .first()
  .or(sections.filter({ hasText: /why choose.*livguard|why livguard/i }).first());
```
Preference order: `getByRole` → `getByText` → `locator('css')` → positional `.nth()`

## Error Handling
**Optional/non-critical operations**: try-catch with silent fallback:
```typescript
try {
  await this.page.waitForLoadState('networkidle', { timeout: 8_000 });
} catch {
  // Firefox analytics connections prevent networkidle — use fallback
  await this.page.waitForTimeout(2_000);
}
```

**Non-blocking waits**: `.catch(() => {})` pattern:
```typescript
await locator.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => {});
```

## Comments
- Explain **why**, not what
- Document timeouts with justification:
  ```typescript
  // Firefox cold-cache: goto ≈ 40s, triggerLazyLoad ≈ 18s, scrollToSection ≈ 150s
  test.setTimeout(300_000);
  ```
- Note UI change dates: `// as of 2026-03; update if site is rebranded`
- Use `// ── Section Name ──` ASCII dividers to separate page object sections

## Test Organization
```typescript
// 3-level describe hierarchy:
test.describe('Page – Category', () => {
  test.beforeEach(async ({ fixture }) => {
    test.setTimeout(300_000);
    await fixture.prepareForSnapshot();
  });

  test('section – component', async ({ fixture }) => {
    await fixture.scrollToSection(fixture.componentSection);
    await expect(fixture.componentSection).toHaveScreenshot('component.png');
  });
});
```

Test name formats:
- Element tests: `'logo is visible'`
- Section snapshots: `'section – navbar'`
- Mobile tests: `'mobile – hero'`
- Full-page: `'full page – desktop'`

## Snapshot Tolerances
Global defaults in `playwright.config.ts`:
```typescript
toHaveScreenshot: {
  maxDiffPixelRatio: 0.02,  // 2% global default
  threshold: 0.2,
  animations: 'disabled',
  maskColor: '#e0e0e0',
}
```

Per-test overrides used for complex/dynamic sections:
- `0.05` — hero sections with background variation
- `0.08–0.15` — sections with API-driven content (carousel, dynamic counts)

## Fixture Pattern
```typescript
// Each page gets its own fixture file
export const test = base.extend<{ noidaPage: RooftopSolarNoidaPage }>({
  noidaPage: async ({ page }, use) => {
    const p = new RooftopSolarNoidaPage(page);
    await p.goto();    // Auto-navigate before every test
    await use(p);
  },
});
export { expect } from '@playwright/test';
```

Tests import from their fixture, not from `@playwright/test` directly:
```typescript
import { test, expect } from '../fixtures/rooftopSolarNoida.fixture';
```

## Skipping Tests
Use `test.skip(condition, reason)` with clear rationale:
```typescript
test.skip(
  true,
  'Live staging API content is non-deterministic under parallel execution'
);
test.skip(
  ['mobile-chrome', 'mobile-safari'].includes(testInfo.project.name),
  'Footer may not render at mobile viewport on city pages',
);
```
