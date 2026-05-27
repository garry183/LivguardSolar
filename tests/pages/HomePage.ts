import { mkdirSync } from 'fs';
import path from 'path';
import { Page, Locator } from '@playwright/test';
import { freezeAnimations, triggerLazyLoad, waitForAllImages } from '../utils/visualHelpers';

const HAR_PATH = path.resolve(__dirname, '..', 'fixtures', 'har', 'homepage.har');

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
    // Re-record responses locally with RECORD_HAR=1 when site content changes.
    if (process.env.RECORD_HAR) {
      await this.page.routeFromHAR(HAR_PATH, {
        url: /(stage|cdndev)\.livguardsolar\.com/,
        update: true,
        updateContent: 'embed',
      });
    }

    // Suppress CTA modal before page scripts run — modal sets body{overflow:hidden}
    // which silently breaks all subsequent scroll calls and prevents IntersectionObserver
    // from firing, leaving all below-fold sections as empty <div>s.
    await this.page.addInitScript(() => {
      try { localStorage.setItem('form_shown', '1'); } catch {}
    });

    await this.page.goto('https://stage.livguardsolar.com/', { waitUntil: 'domcontentloaded' });

    try {
      await this.page.waitForLoadState('networkidle', { timeout: 15_000 });
    } catch {
      await this.page.waitForTimeout(3_000);
    }

    // CI diagnostic: capture page state after networkidle.
    if (process.env.CI) {
      mkdirSync('reports/test-results', { recursive: true });
      await this.page.screenshot({
        path: 'reports/test-results/debug-after-networkidle-homepage.png',
        fullPage: false,
      });
    }

    await this.page.locator('section, div[class]').first().waitFor({ timeout: 30_000 }).catch(() => {});

    // Dismiss CTA modal (#free-consultation-cta): sets body{overflow:hidden} on load,
    // silently breaking all scroll calls. localStorage flag suppresses it most of the time;
    // this is a backstop for when it still appears.
    try {
      await this.page.locator('#free-consultation-cta').getByRole('button').first().click({ timeout: 2_000 });
    } catch {
      // Modal absent or already suppressed by localStorage flag.
    }
    // Force-reset overflow — the CTA modal sets it even before React renders,
    // so this is the guaranteed backstop regardless of whether the click landed.
    await this.page.evaluate(() => { document.body.style.overflow = ''; });

    if (process.env.CI) {
      await this.waitForHydration(30_000);
    }

    // Dismiss cookie consent banner AFTER hydration — the banner is rendered by a
    // React component that mounts post-hydration, so clicking before waitForHydration
    // targets a non-existent element and the banner remains for all screenshots.
    try {
      await this.page.getByRole('button', { name: /got it/i }).click({ timeout: 5_000 });
    } catch {
      // Banner absent or already dismissed.
    }

    if (process.env.CI) {
      const diag = await this.page.evaluate(() => ({
        url: location.href,
        title: document.title,
        htmlLen: document.documentElement.outerHTML.length,
        bodyTextLen: (document.body.innerText || '').length,
        sectionCount: document.querySelectorAll('section').length,
        headings: Array.from(document.querySelectorAll('h1, h2, h3'))
          .map(h => (h.textContent || '').trim().slice(0, 80))
          .filter(Boolean),
        hasFooter: !!document.querySelector('footer'),
        hasHero: /reliable solar/i.test(document.body.innerText || ''),
        hasPortfolio: /360 portfolio/i.test(document.body.innerText || ''),
      }));
      console.log('[DIAG after goto()]', JSON.stringify(diag));
    }

    await freezeAnimations(this.page);
  }

  async waitForHydration(timeoutMs = 30_000): Promise<void> {
    await this.page.evaluate(() => { document.body.style.overflow = ''; });
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await this.page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight / 2); });
      await this.page.waitForTimeout(500);
      await this.page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight); });
      await this.page.waitForTimeout(500);

      const ready = await this.page.evaluate(() => {
        const txt = document.body.innerText || '';
        return (
          !!document.querySelector('footer') &&
          /reliable solar|360 portfolio/i.test(txt)
        );
      });
      if (ready) return;
      await this.page.waitForTimeout(1_000);
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
    // 150 s covers Firefox cold-cache runs where async API responses that populate
    // section headings are delayed by bandwidth contention with the parallel Chromium worker.
    // weAreEverywhereSection and faqSection text is API-driven and can take >90 s on
    // slow/contended connections (observed in CI: Nationwide Reach timed out at 90 s).
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
