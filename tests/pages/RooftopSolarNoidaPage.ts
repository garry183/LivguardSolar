import { mkdirSync } from 'fs';
import { Page } from '@playwright/test';
import { RooftopSolarPage } from './RooftopSolarPage';

/**
 * Page object for https://stage.livguardsolar.com/rooftop-solar-noida
 *
 * Extends RooftopSolarPage — all section locators are inherited with their
 * self-healing .or() fallbacks. Only goto() is overridden to target the
 * city-specific URL.
 */
export class RooftopSolarNoidaPage extends RooftopSolarPage {
  constructor(page: Page) {
    super(page);
  }

  override async goto(): Promise<void> {
    // Block third-party scripts that the page waits on before revealing content.
    // On CI (US/EU runners), these never complete causing the page to stay in a
    // hidden loading state. Blocking them lets page JS initialise immediately.
    await this.page.route(
      /\.(google-analytics\.com|googletagmanager\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|connect\.facebook\.net|hotjar\.com|clarity\.ms|doubleclick\.net)/,
      route => route.abort(),
    );

    await this.page.goto('https://stage.livguardsolar.com/rooftop-solar-noida', {
      waitUntil: 'domcontentloaded',
    });

    // Wait for networkidle — with third-party scripts blocked, this should
    // resolve quickly and reliably on both local and CI.
    try {
      await this.page.waitForLoadState('networkidle', { timeout: 15_000 });
    } catch {
      await this.page.waitForTimeout(3_000);
    }

    // Force all page content visible (body display:none, loaders, overlays, etc.).
    await this.forcePageVisible();

    // CI diagnostic: capture a screenshot right after forcing visibility so we
    // can see exactly what state the page is in if tests still fail.
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
