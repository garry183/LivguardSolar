import { mkdirSync } from 'fs';
import path from 'path';
import { Page } from '@playwright/test';
import { RooftopSolarPage } from './RooftopSolarPage';

const HAR_PATH = path.resolve(__dirname, '..', 'fixtures', 'har', 'rooftop-solar-noida.har');

/**
 * Page object for https://stage.livguardsolar.com/rooftop-solar-noida
 *
 * Extends RooftopSolarPage — all section locators are inherited with their
 * self-healing .or() fallbacks. Only goto() is overridden to target the
 * city-specific URL.
 *
 * HAR workflow:
 *   1. Record locally:  npm run test:record-har
 *   2. Commit the HAR:  git add tests/fixtures/har/
 *   3. CI replays HAR — all API-driven sections render without staging API access
 */
export class RooftopSolarNoidaPage extends RooftopSolarPage {
  constructor(page: Page) {
    super(page);
  }

  override async goto(): Promise<void> {
    // ── HAR replay/record ──
    // In CI: replay recorded API responses so all sections render regardless of
    // staging API accessibility. Locally with RECORD_HAR=1: record fresh responses.
    if (process.env.CI) {
      await this.page.routeFromHAR(HAR_PATH, {
        url: /stage\.livguardsolar\.com/,
        notFound: 'fallback',
      });
    } else if (process.env.RECORD_HAR) {
      await this.page.routeFromHAR(HAR_PATH, {
        url: /stage\.livguardsolar\.com/,
        update: true,
      });
    }

    // Block third-party scripts that the page waits on before revealing content.
    await this.page.route(
      /\.(google-analytics\.com|googletagmanager\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|connect\.facebook\.net|hotjar\.com|clarity\.ms|doubleclick\.net)/,
      route => route.abort(),
    );

    await this.page.goto('https://stage.livguardsolar.com/rooftop-solar-noida', {
      waitUntil: 'domcontentloaded',
    });

    // Wait for networkidle — with third-party scripts blocked and HAR replay,
    // this should resolve quickly on both local and CI.
    try {
      await this.page.waitForLoadState('networkidle', { timeout: 15_000 });
    } catch {
      await this.page.waitForTimeout(3_000);
    }

    // Force all page content visible (body display:none, loaders, overlays, etc.).
    await this.forcePageVisible();

    // CI diagnostic: capture page state after forcing visibility.
    if (process.env.CI) {
      mkdirSync('reports/test-results', { recursive: true });
      await this.page.screenshot({
        path: 'reports/test-results/debug-after-force-visible.png',
        fullPage: false,
      });
    }

    // Wait for React hydration: content divs become visible once JS initialises.
    await this.page
      .locator('section, div[class]')
      .first()
      .waitFor({ state: 'visible', timeout: 30_000 })
      .catch(() => {});

    // Dismiss cookie consent banner.
    try {
      await this.page.getByRole('button', { name: /got it/i }).click({ timeout: 3_000 });
    } catch {
      // Banner absent or already dismissed — continue.
    }
  }
}
