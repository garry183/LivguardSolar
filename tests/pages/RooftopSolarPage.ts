import { Page, Locator } from '@playwright/test';
import { freezeAnimations, triggerLazyLoad, waitForAllImages } from '../utils/visualHelpers';

export class RooftopSolarPage {
  readonly page: Page;

  // Header
  readonly logo: Locator;
  readonly navbar: Locator;

  // Sections — ordered top to bottom as they appear on
  // https://stage.livguardsolar.com/rooftop-solar
  //
  // Self-healing locator pattern: primary.or(fallback)
  //   primary  = semantic (getByRole heading / ARIA role)
  //   fallback = structural (CSS position / text filter)
  readonly heroSection: Locator;
  readonly statsSection: Locator;
  readonly whyLivguardSection: Locator;
  readonly portfolioSection: Locator;
  readonly goSolarStepsSection: Locator;
  readonly bookSurveySection: Locator;
  readonly faqSection: Locator;
  readonly footer: Locator;

  constructor(page: Page) {
    this.page = page;

    // Structural base for positional fallbacks (page uses single <main>, not nested main > main)
    const sections = page.locator('main > :is(section, div)');

    // ── Header ──
    // Primary: ARIA banner role | Fallback: <header> tag
    this.navbar = page.getByRole('banner').or(page.locator('header').first());
    // Primary: role-based img inside banner | Fallback: CSS attribute selector
    this.logo = page
      .getByRole('banner')
      .getByRole('img', { name: /livguard/i })
      .or(page.locator('header img[alt*="ivguard"]').first());

    // ── Hero ── "Save Big on Every Bill — Go Solar & Reduce Costs Up to 70%"
    // Primary: heading-based semantic locator
    // Fallback: first direct child of <main>
    this.heroSection = page
      .locator('main > div')
      .filter({ has: page.getByRole('heading', { level: 1, name: /save big on every bill/i }) })
      .first()
      .or(sections.first());

    // ── Stats ── MNRE / 50,000+ installations badge strip
    // Primary: text content filter (stat keywords)
    // Fallback: 2nd direct child of <main> (immediately below hero)
    this.statsSection = page
      .locator('main > div')
      .filter({ hasText: /MNRE|50[\s,.]?000|DISCOM/i })
      .first()
      .or(sections.nth(1));

    // ── Why Choose Livguard Solar 360 ──
    // Primary: heading-based
    // Fallback: broader text filter covering old + new heading text
    this.whyLivguardSection = page
      .locator('main > div')
      .filter({ has: page.getByRole('heading', { name: /why choose livguard/i }) })
      .first()
      .or(sections.filter({ hasText: /why choose.*livguard|why livguard/i }).first());

    // ── 360 Portfolio of Solar Solutions ──
    // Primary: heading-based
    // Fallback: text filter
    this.portfolioSection = page
      .locator('main > div')
      .filter({ has: page.getByRole('heading', { name: /360 portfolio/i }) })
      .first()
      .or(sections.filter({ hasText: /360 portfolio/i }).first());

    // ── Go Solar Steps ── "Experience Livguard Solar 360 in 4 simple steps"
    // Primary: heading-based
    // Fallback: text filter
    this.goSolarStepsSection = page
      .locator('main > div')
      .filter({ has: page.getByRole('heading', { name: /simple steps/i }) })
      .first()
      .or(sections.filter({ hasText: /simple steps/i }).first());

    // ── Book Solar Consultation ── "Book Your Free Solar Consultation Now"
    // Primary: heading-based
    // Fallback: specific text filter (avoids matching hero booking CTA)
    this.bookSurveySection = page
      .locator('main > div')
      .filter({ has: page.getByRole('heading', { name: /book your free solar/i }) })
      .first()
      .or(sections.filter({ hasText: /book your free solar consultation/i }).first());

    // ── FAQ ── "Most Common Questions and Answers"
    // Primary: heading-based
    // Fallback: text filter covering old + new heading text
    this.faqSection = page
      .locator('main > div')
      .filter({ has: page.getByRole('heading', { name: /common questions/i }) })
      .first()
      .or(sections.filter({ hasText: /questions and answers|frequently asked|faq/i }).first());

    // ── Footer ──
    // Primary: <footer> HTML tag
    // Fallback: ARIA contentinfo role (fires when footer is a top-level landmark)
    this.footer = page
      .locator('footer')
      .first()
      .or(page.getByRole('contentinfo').first());
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
    if ((await locator.count()) === 0) {
      const scrollHeight = await this.page.evaluate(() => document.body.scrollHeight);
      await this.page.evaluate(() => window.scrollTo(0, 0));
      for (let y = 600; y <= scrollHeight && (await locator.count()) === 0; y += 600) {
        await this.page.evaluate((pos) => window.scrollTo(0, pos), y);
        await this.page.waitForTimeout(500);
      }
      // Scroll to absolute bottom (page may have grown during lazy load) and wait
      // for React to render remaining async sections (e.g. footer).
      await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await this.page.waitForTimeout(2_000);
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
