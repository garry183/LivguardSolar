import { Page, Locator } from '@playwright/test';
import { freezeAnimations, triggerLazyLoad, waitForAllImages } from '../utils/visualHelpers';

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
    // Navigate directly to the staging URL — this page object targets the
    // staging environment, not the production baseURL set in playwright.config.ts.
    await this.page.goto('https://stage.livguardsolar.com/solar-for-home', {
      waitUntil: 'domcontentloaded',
    });

    // networkidle fires quickly on Chromium/WebKit; Firefox keeps analytics and
    // polling connections open indefinitely so networkidle never fires there.
    // Cap the wait at 8 s — SSR content is visible well before that — then
    // fall back to a short settled-render pause so we don't waste ~30 s per
    // Firefox test (which would crowd out the lazy-load and scroll budget).
    try {
      await this.page.waitForLoadState('networkidle', { timeout: 8_000 });
    } catch {
      await this.page.waitForTimeout(2_000);
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

    // Dismiss cookie consent banner so it does not block scroll events or gate
    // the rendering of cookie-gated page sections (particularly in Chromium).
    try {
      await this.page.getByRole('button', { name: /got it/i }).click({ timeout: 3_000 });
    } catch {
      // Banner absent or already dismissed — continue.
    }

    await freezeAnimations(this.page);
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
