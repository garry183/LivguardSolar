import { Page, Locator } from '@playwright/test';
import { freezeAnimations, triggerLazyLoad, waitForAllImages } from '../utils/visualHelpers';

export class RooftopSolarPage {
  readonly page: Page;

  // Header
  readonly logo: Locator;
  readonly navbar: Locator;

  // Sections — ordered top to bottom as they appear on
  // https://stage.livguardsolar.com/rooftop-solar
  readonly heroSection: Locator;
  readonly bookSurveySection: Locator;
  readonly benefitsCarouselSection: Locator;
  readonly statsSection: Locator;
  readonly goSolarStepsSection: Locator;
  readonly portfolioSection: Locator;
  readonly whyLivguardSection: Locator;
  readonly nationwideReachSection: Locator;
  readonly testimonialsSection: Locator;
  readonly faqSection: Locator;
  readonly footer: Locator;

  constructor(page: Page) {
    this.page = page;

    // Header
    this.logo = page.getByRole('banner').getByRole('img', { name: /livguard/i });
    this.navbar = page.getByRole('banner');

    // Hero — main banner: "Save Big on Every Bill — Go Solar & Reduce Costs Up to 70%"
    this.heroSection = page.locator('main > main > :is(section, div)').first();

    // Book Free Solar Survey — consultation form section.
    // Text: "Book free solar consultation" / "BOOK FREE SOLAR SURVEY"
    this.bookSurveySection = page.locator('main > main > :is(section, div)').filter({ hasText: /book free solar/i }).first();

    // Benefits Carousel — image carousel with subsidy / warranty / net metering slides.
    // Text: "Government subsidy assistance" | "27-years comprehensive warranty"
    this.benefitsCarouselSection = page.locator('main > main > :is(section, div)').filter({ hasText: /government subsidy assistance|27-years|net metering setup/i }).first();

    // Stats — installation count + approvals.
    // Text: "50,000+" or "MNRE" or "DISCOM"
    this.statsSection = page.locator('main > main > :is(section, div)').filter({ hasText: /50,000|MNRE|DISCOM/i }).first();

    // Go Solar Steps — process/steps section.
    // Text: "simple steps" (shared pattern across the site)
    this.goSolarStepsSection = page.locator('main > main > :is(section, div)').filter({ hasText: /simple steps/i }).first();

    // 360 Portfolio — product categories grid.
    // Text: "360 portfolio of solar solutions"
    this.portfolioSection = page.locator('main > main > :is(section, div)').filter({ hasText: /360 portfolio/i }).first();

    // Why Livguard Solar — trust / benefits section.
    this.whyLivguardSection = page.locator('main > main > :is(section, div)').filter({ hasText: /why livguard solar/i }).first();

    // Nationwide Reach — pan-India service reach section.
    // Text: "Nationwide Reach, Local Support"
    this.nationwideReachSection = page.locator('main > main > :is(section, div)').filter({ hasText: /nationwide reach/i }).first();

    // Testimonials / Happy Customers — customer testimonials carousel.
    // Text: "happy customers"
    this.testimonialsSection = page.locator('main > main > :is(section, div)').filter({ hasText: /happy customers/i }).first();

    // FAQ — Frequently Asked Questions.
    // Text: "frequently asked questions" or "FAQ"
    this.faqSection = page.locator('main > main > :is(section, div)').filter({ hasText: /frequently asked questions|faq/i }).first();

    // Footer
    this.footer = page.locator('footer').first();
  }

  async goto(): Promise<void> {
    await this.page.goto('https://stage.livguardsolar.com/rooftop-solar', {
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

  async prepareForSnapshot(): Promise<void> {
    await triggerLazyLoad(this.page);
    await waitForAllImages(this.page);
    await freezeAnimations(this.page);
  }

  async scrollToSection(locator: Locator): Promise<void> {
    // Re-trigger lazy loading if the section was unmounted by IntersectionObserver.
    if (await locator.count() === 0) {
      const scrollHeight = await this.page.evaluate(() => document.body.scrollHeight);
      await this.page.evaluate(() => window.scrollTo(0, 0));
      for (let y = 600; y <= scrollHeight && await locator.count() === 0; y += 600) {
        await this.page.evaluate((pos) => window.scrollTo(0, pos), y);
        await this.page.waitForTimeout(500);
      }
    }

    // 150 s covers slow async API responses on cold-cache Firefox / mobile-safari.
    await locator.waitFor({ state: 'attached', timeout: 150_000 });

    // Use evaluate to bypass Playwright's actionability check (elements inside
    // overflow:hidden carousels are in the DOM but not "actionable").
    await locator.evaluate((el) => {
      el.scrollIntoView({ behavior: 'instant', block: 'center' });
    });
    await this.page.waitForTimeout(500);
  }
}
