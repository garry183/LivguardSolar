import { Page, Locator } from '@playwright/test';
import { freezeAnimations, triggerLazyLoad, waitForAllImages } from '../utils/visualHelpers';

export class HomePage {
  readonly page: Page;

  // Header
  readonly logo: Locator;
  readonly navbar: Locator;
  readonly navSolarForHome: Locator;
  readonly navSolarForCommercial: Locator;
  readonly bookSurveyBtn: Locator;

  // Sections
  readonly heroSection: Locator;
  readonly productCategoriesSection: Locator;
  readonly weAreEverywhereSection: Locator;
  readonly goSolarStepsSection: Locator;
  readonly featuredProductsSection: Locator;
  readonly solarDiariesSection: Locator;
  readonly projectsSection: Locator;
  readonly whyLivguardSection: Locator;
  readonly solculatorSection: Locator;
  readonly faqSection: Locator;
  readonly diveIntoSolarSection: Locator;
  readonly footer: Locator;

  constructor(page: Page) {
    this.page = page;

    // Header
    this.logo = page.getByRole('banner').getByRole('img', { name: /livguard logo/i });
    this.navbar = page.getByRole('banner');
    this.navSolarForHome = page.getByRole('navigation').getByRole('link', { name: /solar for home/i });
    this.navSolarForCommercial = page.getByRole('navigation').getByRole('link', { name: /solar for commercial/i });
    // Scoped to banner so strict-mode doesn't trip on the duplicate hero CTA
    this.bookSurveyBtn = page.getByRole('banner').getByRole('button', { name: /book free site survey/i });

    // Sections — all use semantic <section> elements. Filter by unique heading text so
    // we get the actual section element, not an ancestor wrapper.
    // NOTE: heading text reflects the live site as of 2026-03; update if site is rebranded.
    this.heroSection = page.locator('section').filter({ hasText: /reliable solar/i }).first();
    this.productCategoriesSection = page.locator('section').filter({ hasText: /solar panels|inverters|batteries/i }).first();
    this.solarDiariesSection = page.locator('section').filter({ hasText: /solar diaries/i }).first();
    this.projectsSection = page.locator('section').filter({ hasText: /patiala|sonipat/i }).first();
    this.whyLivguardSection = page.locator('section').filter({ hasText: /why.*livguard/i }).first();
    this.solculatorSection = page.locator('section').filter({ hasText: /solculator/i }).first();
    this.diveIntoSolarSection = page.locator('section').filter({ hasText: /dive into solar/i }).first();
    this.footer = page.locator('footer').first();

    // These four sections were renamed in the 2026 rebrand.
    this.weAreEverywhereSection = page.locator('section').filter({ hasText: /nationwide reach/i }).first();
    this.goSolarStepsSection = page.locator('section').filter({ hasText: /360 path to energy/i }).first();
    this.featuredProductsSection = page.locator('section').filter({ hasText: /360 portfolio/i }).first();
    // "Frequently Asked Questions" section was replaced by a product-finder section.
    this.faqSection = page.locator('section').filter({ hasText: /find the right solar/i }).first();
  }

  async goto(): Promise<void> {
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
    // Firefox keeps analytics/polling requests open indefinitely so networkidle
    // never fires; fall back to a short settled-render wait instead.
    try {
      await this.page.waitForLoadState('networkidle', { timeout: 30_000 });
    } catch {
      await this.page.waitForTimeout(2_000);
    }
    await freezeAnimations(this.page);
  }

  async prepareForSnapshot(): Promise<void> {
    await triggerLazyLoad(this.page);
    await waitForAllImages(this.page);
    await freezeAnimations(this.page);
  }

  async scrollToSection(locator: Locator): Promise<void> {
    // Use evaluate to bypass Playwright's actionability check — elements inside
    // overflow:hidden carousels are in the DOM but not "actionable", causing
    // scrollIntoViewIfNeeded to time out.
    await locator.evaluate((el) => {
      el.scrollIntoView({ behavior: 'instant', block: 'center' });
    });
    await this.page.waitForTimeout(500);
  }
}
