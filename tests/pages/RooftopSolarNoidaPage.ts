import { mkdirSync, existsSync, statSync } from 'fs';
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
    // In CI: replay recorded responses hermetically. Bitbucket Pipelines can't
    // reach cdndev.livguardsolar.com (where the JS/CSS bundles are hosted), so
    // we must bundle stage + cdndev responses into the HAR for offline replay.
    // Without this, React never hydrates and below-fold sections never render.
    //
    // Locally with RECORD_HAR=1: capture fresh responses from both domains.
    const HAR_DOMAINS = /(stage|cdndev)\.livguardsolar\.com/;
    if (process.env.CI) {
      const harExists = existsSync(HAR_PATH);
      const harSize = harExists ? statSync(HAR_PATH).size : 'N/A';
      console.log('[HAR] path=', HAR_PATH, 'exists=', harExists, 'size=', harSize);

      // 'abort' surfaces HAR misses as net::ERR_FAILED (visible in requestfailed events).
      await this.page.routeFromHAR(HAR_PATH, {
        url: HAR_DOMAINS,
        notFound: 'abort',
      });

      // Log every failed request so we can see which URLs HAR couldn't serve.
      this.page.on('requestfailed', req => {
        console.log('[REQ FAILED]', req.url(), req.failure()?.errorText);
      });
    } else if (process.env.RECORD_HAR) {
      await this.page.routeFromHAR(HAR_PATH, {
        url: HAR_DOMAINS,
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

    // CI: actively wait for client-side rendered sections to hydrate.
    // This scrolls the page and polls for key below-the-fold content.
    if (process.env.CI) {
      await this.waitForHydration(30_000);
    }

    // CI diagnostic: log page state so we can see what actually renders.
    if (process.env.CI) {
      const diag = await this.page.evaluate(() => ({
        url: location.href,
        title: document.title,
        htmlLen: document.documentElement.outerHTML.length,
        bodyTextLen: (document.body.innerText || '').length,
        bodyTextPreview: (document.body.innerText || '').slice(0, 300),
        mainChildren: document.querySelectorAll('main > *').length,
        sectionCount: document.querySelectorAll('section').length,
        divInMainCount: document.querySelectorAll('main > div').length,
        allDivCount: document.querySelectorAll('div').length,
        scriptCount: document.querySelectorAll('script').length,
        headings: Array.from(document.querySelectorAll('h1, h2, h3'))
          .map(h => (h.textContent || '').trim().slice(0, 80))
          .filter(Boolean),
        hasFooter: !!document.querySelector('footer'),
        hasBookSurvey: /book your free solar/i.test(document.body.innerText || ''),
        hasPortfolio: /360 portfolio/i.test(document.body.innerText || ''),
        hasFaq: /(common questions|questions and answers|faq)/i.test(
          document.body.innerText || '',
        ),
        hasWhyLivguard: /why choose livguard/i.test(document.body.innerText || ''),
        hasMnre: /MNRE/i.test(document.body.innerText || ''),
      }));
      console.log('[DIAG after goto()]', JSON.stringify(diag));
    }
  }

  /**
   * Wait for React to finish hydrating client-side sections.
   * Polls until key below-the-fold content appears, or timeout.
   */
  async waitForHydration(timeoutMs = 30_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      // Scroll progressively to trigger IntersectionObserver-based lazy mounts.
      await this.page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight / 2);
      });
      await this.page.waitForTimeout(500);
      await this.page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await this.page.waitForTimeout(500);

      const ready = await this.page.evaluate(() => {
        const txt = document.body.innerText || '';
        return (
          !!document.querySelector('footer') &&
          /360 portfolio|why choose livguard|book your free solar/i.test(txt)
        );
      });
      if (ready) return;
      await this.page.waitForTimeout(1_000);
    }
  }
}
