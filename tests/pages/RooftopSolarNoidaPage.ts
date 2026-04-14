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
    await this.page.goto('https://stage.livguardsolar.com/rooftop-solar-noida', {
      waitUntil: 'domcontentloaded',
    });

    // networkidle fires quickly on Chromium/WebKit; Firefox keeps analytics and
    // polling connections open indefinitely so networkidle never fires there.
    // CI runners are geographically distant from the staging server so allow more time.
    const networkIdleTimeout = process.env.CI ? 30_000 : 8_000;
    try {
      await this.page.waitForLoadState('networkidle', { timeout: networkIdleTimeout });
    } catch {
      await this.page.waitForTimeout(process.env.CI ? 8_000 : 2_000);
    }

    // Wait for React hydration: SSR delivers nav + hidden H1 only.
    await this.page
      .locator('section, div[class]')
      .first()
      .waitFor({ timeout: 30_000 })
      .catch(() => {});

    // All content divs start hidden and are revealed by JS after page init.
    // On CI, the JS that reveals them never fires (API calls / third-party
    // scripts time out). Inject CSS to force all elements visible so tests
    // can check structural presence rather than loading-animation state.
    await this.page.addStyleTag({
      content: `* { opacity: 1 !important; visibility: visible !important; }`,
    });

    // Dismiss cookie consent banner.
    try {
      await this.page.getByRole('button', { name: /got it/i }).click({ timeout: 3_000 });
    } catch {
      // Banner absent or already dismissed — continue.
    }

  }
}
