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

    // These four sections were renamed in the 2026 rebrand and are now rendered as
    // <div> containers (not <section> tags). Target direct children of inner <main>
    // to avoid matching deeply-nested descendants with the same text.
    this.weAreEverywhereSection = page.locator('main > main > :is(section, div)').filter({ hasText: /nationwide reach/i }).first();
    this.goSolarStepsSection = page.locator('main > main > :is(section, div)').filter({ hasText: /360 path to energy/i }).first();
    this.featuredProductsSection = page.locator('main > main > :is(section, div)').filter({ hasText: /360 portfolio/i }).first();
    // "Frequently Asked Questions" section was replaced by a product-finder section.
    this.faqSection = page.locator('main > main > :is(section, div)').filter({ hasText: /find the right solar/i }).first();
  }

  async goto(): Promise<void> {
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
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
    // the nav and a hidden H1. Wait for the hero <section> to appear as a
    // reliable signal that the JavaScript bundle has loaded and React has
    // hydrated — without this, fast-firing tests (especially the first Firefox
    // test, whose JS bundle competes with the parallel Chromium test over
    // bandwidth) would scroll through a skeleton DOM and never find any content.
    await this.page.locator('section').first().waitFor({ timeout: 30_000 }).catch(() => {});
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
    // Wait for the element to be in the DOM before scrolling into view.
    // On Firefox's first cold-cache load the section's async content (text fetched
    // from an API after IntersectionObserver fires) may not have arrived yet even
    // after triggerLazyLoad + networkidle. A generous 30-s window covers this.
    await locator.waitFor({ state: 'attached', timeout: 30_000 });
    // Use evaluate to bypass Playwright's actionability check — elements inside
    // overflow:hidden carousels are in the DOM but not "actionable", causing
    // scrollIntoViewIfNeeded to time out.
    await locator.evaluate((el) => {
      el.scrollIntoView({ behavior: 'instant', block: 'center' });
    });
    await this.page.waitForTimeout(500);
  }
}
