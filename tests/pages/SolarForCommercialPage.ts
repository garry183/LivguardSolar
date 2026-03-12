import { Page, Locator } from '@playwright/test';
import { freezeAnimations, triggerLazyLoad, waitForAllImages } from '../utils/visualHelpers';

export class SolarForCommercialPage {
  readonly page: Page;

  // Header
  readonly logo: Locator;
  readonly navbar: Locator;

  // Sections
  readonly heroSection: Locator;
  readonly goSolarStepsSection: Locator;
  readonly featuredProductsSection: Locator;
  readonly whyLivguardSection: Locator;
  readonly solarImpactSection: Locator;
  readonly projectsSection: Locator;
  readonly nationwidePresenceSection: Locator;
  readonly solarDiariesSection: Locator;
  readonly faqSection: Locator;
  readonly solculatorSection: Locator;
  readonly diveIntoSolarSection: Locator;
  readonly footer: Locator;

  constructor(page: Page) {
    this.page = page;

    // Header
    this.logo = page.getByRole('banner').getByRole('img', { name: /livguard logo/i });
    this.navbar = page.getByRole('banner');

    // Hero — first section/div on the page; no unique heading text on staging.
    this.heroSection = page.locator('main > main > :is(section, div)').first();

    // Go Solar in 5 Simple Steps — process steps section.
    // Rebranded from "go solar in 4 simple steps" to "Experience Livguard Solar 360 in 5 simple steps".
    this.goSolarStepsSection = page.locator('main > main > :is(section, div)').filter({ hasText: /simple steps/i }).first();

    // 360 Portfolio — product carousel / grid.
    // Rebranded from "Featured Products" to "360 portfolio of solar solutions for every need".
    this.featuredProductsSection = page.locator('main > main > :is(section, div)').filter({ hasText: /360 portfolio/i }).first();

    // Why Livguard Solar — trust / benefits section.
    this.whyLivguardSection = page.locator('main > main > :is(section, div)').filter({ hasText: /why livguard solar/i }).first();

    // Solar Impact — counter stats / in the news section.
    // Rebranded from "3 Million+" stats to "Livguard Solar 360 In the News".
    this.solarImpactSection = page.locator('main > main > :is(section, div)').filter({ hasText: /in the news/i }).first();

    // Livguard Projects / Expert Assistance — contact form section.
    // Uses nth(5) because the staging heading text does not reliably match a keyword.
    this.projectsSection = page.locator('main > main > :is(section, div)').nth(5);

    // Nationwide Reach — pan-India pincode / dealer reach section.
    // Rebranded from "We Are Everywhere" to "Nationwide Reach, Local Support".
    this.nationwidePresenceSection = page.locator('main > main > :is(section, div)').filter({ hasText: /nationwide reach/i }).first();

    // Solar Diaries / Happy Customers — customer testimonials carousel.
    // Rebranded from "Solar Diaries" to "Over 4.5 Lakh happy customers".
    this.solarDiariesSection = page.locator('main > main > :is(section, div)').filter({ hasText: /happy customers/i }).first();

    // FAQ — Frequently Asked Questions.
    // Uses nth(8) because the staging heading text does not reliably match a keyword.
    this.faqSection = page.locator('main > main > :is(section, div)').nth(8);

    // Solculator — interactive solar sizing tool.
    // Excludes 1 px gradient divider elements that the desktop (1440 px) layout inserts
    // at index 9 between FAQ and Solculator. Without :not(), nth(9) on chromium-desktop
    // resolves to the divider, shifting Solculator to nth(10). The :not() filter restores
    // consistent nth(9) counting across all viewport widths.
    this.solculatorSection = page.locator('main > main > :is(section, div):not([class*="tw-h-[1px]"])').nth(9);

    // Dive Into Solar — educational content / blog cards section.
    // Uses nth(10) because the staging heading text may not reliably match.
    this.diveIntoSolarSection = page.locator('main > main > :is(section, div)').nth(10);

    // Footer
    this.footer = page.locator('footer').first();
  }

  async goto(): Promise<void> {
    // Navigate directly to the staging URL — this page object targets the
    // staging environment, not the production baseURL set in playwright.config.ts.
    await this.page.goto('https://stage.livguardsolar.com/solar-for-commercial', {
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
    // 150 s covers slow async API responses when 3 workers compete for bandwidth
    // simultaneously (mobile-safari cold-cache can take >90 s for deep sections).
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
