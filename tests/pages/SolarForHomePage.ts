import { mkdirSync, existsSync, statSync } from 'fs';
import path from 'path';
import { Page, Locator } from '@playwright/test';
import { freezeAnimations, triggerLazyLoad, waitForAllImages } from '../utils/visualHelpers';

const HAR_PATH = path.resolve(__dirname, '..', 'fixtures', 'har', 'solar-for-home.har');

export class SolarForHomePage {
  readonly page: Page;

  // Header
  readonly logo: Locator;
  readonly navbar: Locator;

  // Sections — ordered top to bottom as they appear on
  // https://stage.livguardsolar.com/solar-for-home
  readonly heroSection: Locator;
  readonly portfolioSection: Locator;
  readonly solarCalculatorSection: Locator;
  readonly inTheNewsSection: Locator;
  readonly nationwideReachSection: Locator;
  readonly whoAreWeSection: Locator;
  readonly testimonialsSection: Locator;
  readonly footer: Locator;

  constructor(page: Page) {
    this.page = page;

    // Header
    this.logo = page.getByRole('banner').getByRole('img', { name: /livguard/i });
    this.navbar = page.getByRole('banner');

    // Hero — the first <section> on the page contains the main banner.
    // Heading text on staging site: "Best Solar Solutions for Home"
    this.heroSection = page.locator('section').filter({ hasText: /best solar solutions for home/i }).first();

    // 360 Portfolio — product categories grid.
    // Text: "360 portfolio of solar solutions for every need"
    this.portfolioSection = page.locator('main > main > :is(section, div)').filter({ hasText: /360 portfolio of solar solutions/i }).first();

    // Solar Calculator — section at index 2 (hero=0, portfolio=1, calculator=2).
    // The heading text varies between "Find the right solar solution for you" and
    // "Solar Calculator" on staging. Use positional nth to avoid text-mismatch timeouts.
    this.solarCalculatorSection = page.locator('main > main > :is(section, div)').nth(2);

    // In the News — "Livguard Solar 360 In the News"
    this.inTheNewsSection = page.locator('main > main > :is(section, div)').filter({ hasText: /in the news/i }).first();

    // Nationwide Reach — pincode / service reach section.
    // Text: "Nationwide Reach, Local Support"
    this.nationwideReachSection = page.locator('main > main > :is(section, div)').filter({ hasText: /nationwide reach/i }).first();

    // Who Are We — stats section (years, installations, savings).
    // Text: "Who are we?"
    this.whoAreWeSection = page.locator('main > main > :is(section, div)').filter({ hasText: /who are we/i }).first();

    // Testimonials — customer testimonials / carousel.
    // Text: "happy customers" (e.g. "Over 6.5 Lakh happy customers")
    this.testimonialsSection = page.locator('main > main > :is(section, div)').filter({ hasText: /happy customers/i }).first();

    // Footer
    this.footer = page.locator('footer').first();
  }

  async goto(): Promise<void> {
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
        updateContent: 'embed', // store response bodies inline so HAR works offline in CI
      });
    }

    // Navigate directly to the staging URL — this page object targets the
    // staging environment, not the production baseURL set in playwright.config.ts.
    await this.page.goto('https://stage.livguardsolar.com/solar-for-home', {
      waitUntil: 'domcontentloaded',
    });

    // Wait for networkidle — with third-party scripts blocked and HAR replay,
    // this should resolve quickly on both local and CI.
    try {
      await this.page.waitForLoadState('networkidle', { timeout: 15_000 });
    } catch {
      await this.page.waitForTimeout(3_000);
    }

    // CI diagnostic: capture page state after networkidle.
    if (process.env.CI) {
      mkdirSync('reports/test-results', { recursive: true });
      await this.page.screenshot({
        path: 'reports/test-results/debug-after-networkidle-solar-for-home.png',
        fullPage: false,
      });
    }

    // The page is fully client-rendered (Next.js): the SSR HTML only contains
    // the nav and a hidden H1. Wait for the first <section> or any top-level
    // <div> with a class to appear as a reliable signal that the JavaScript
    // bundle has loaded and React has hydrated.
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
        mainChildren: document.querySelectorAll('main > *').length,
        sectionCount: document.querySelectorAll('section').length,
        scriptCount: document.querySelectorAll('script').length,
        headings: Array.from(document.querySelectorAll('h1, h2, h3'))
          .map(h => (h.textContent || '').trim().slice(0, 80))
          .filter(Boolean),
        hasFooter: !!document.querySelector('footer'),
        hasHero: /best solar solutions for home/i.test(document.body.innerText || ''),
        hasPortfolio: /360 portfolio of solar solutions/i.test(document.body.innerText || ''),
        hasCalculator: /find the right solar solution|solar calculator/i.test(document.body.innerText || ''),
        hasWhoAreWe: /who are we/i.test(document.body.innerText || ''),
        hasTestimonials: /happy customers/i.test(document.body.innerText || ''),
      }));
      console.log('[DIAG after goto()]', JSON.stringify(diag));
    }
  }

  async prepareForSnapshot(): Promise<void> {
    await triggerLazyLoad(this.page);
    await waitForAllImages(this.page);
    await freezeAnimations(this.page);
    // Note: overflow:visible for Firefox fullPage screenshots is NOT applied here.
    // Applying it in prepareForSnapshot causes Firefox's IntersectionObserver to
    // re-fire on the layout change, unmounting sections and breaking later scrollToSection
    // calls. It is applied in the full-page snapshot tests, right before toHaveScreenshot.
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
          /360 portfolio of solar solutions|who are we|happy customers/i.test(txt)
        );
      });
      if (ready) return;
      await this.page.waitForTimeout(1_000);
    }
  }

  async scrollToSection(locator: Locator): Promise<void> {
    // If the section is absent from the DOM (unmounted by IntersectionObserver after
    // triggerLazyLoad scrolled back to the top), re-trigger lazy loading by scrolling
    // incrementally from the top until the element appears.
    if (await locator.count() === 0) {
      const scrollHeight = await this.page.evaluate(() => document.body.scrollHeight);
      await this.page.evaluate(() => window.scrollTo(0, 0));
      for (let y = 600; y <= scrollHeight && await locator.count() === 0; y += 600) {
        await this.page.evaluate((pos) => window.scrollTo(0, pos), y);
        await this.page.waitForTimeout(500);
      }
    }

    // Wait for the element (and its async text content) to be in the DOM.
    // 150 s covers slow async API responses that populate section headings,
    // particularly on mobile-safari and cold-cache runs with bandwidth contention.
    await locator.waitFor({ state: 'attached', timeout: 150_000 });

    // Use evaluate to bypass Playwright's actionability check — elements inside
    // overflow:hidden carousels are in the DOM but not "actionable", causing
    // scrollIntoViewIfNeeded to time out.
    await locator.evaluate((el) => {
      el.scrollIntoView({ behavior: 'instant', block: 'center' });
    });
    await this.page.waitForTimeout(500);
  }
}
