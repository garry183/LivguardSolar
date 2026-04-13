import { Page } from '@playwright/test';
import { RooftopSolarPage } from './RooftopSolarPage';
import { freezeAnimations } from '../utils/visualHelpers';

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
    await this.page.goto('https://stage.livguardsolar.com/rooftop-solar-noida', {
      waitUntil: 'domcontentloaded',
    });

    // networkidle fires quickly on Chromium/WebKit; Firefox keeps analytics and
    // polling connections open indefinitely so networkidle never fires there.
    // Cap at 8 s then fall back to a short pause to avoid blocking slow Firefox runs.
    try {
      await this.page.waitForLoadState('networkidle', { timeout: 8_000 });
    } catch {
      await this.page.waitForTimeout(2_000);
    }

    // Wait for React hydration: SSR delivers nav + hidden H1 only.
    await this.page
      .locator('section, div[class]')
      .first()
      .waitFor({ timeout: 30_000 })
      .catch(() => {});

    // Dismiss cookie consent banner.
    try {
      await this.page.getByRole('button', { name: /got it/i }).click({ timeout: 3_000 });
    } catch {
      // Banner absent or already dismissed — continue.
    }

    await freezeAnimations(this.page);
  }
}
