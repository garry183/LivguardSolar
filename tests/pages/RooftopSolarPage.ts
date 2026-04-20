import { mkdirSync, existsSync, statSync } from 'fs';
import path from 'path';
import { Page, Locator } from '@playwright/test';
import { freezeAnimations, triggerLazyLoad, waitForAllImages } from '../utils/visualHelpers';

const HAR_PATH = path.resolve(__dirname, '..', 'fixtures', 'har', 'rooftop-solar.har');

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

    await this.page.goto('https://stage.livguardsolar.com/rooftop-solar', {
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
        path: 'reports/test-results/debug-after-force-visible-rooftop-solar.png',
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

  /** Force all page content visible — removes loaders, overrides hidden CSS. */
  protected async forcePageVisible(): Promise<void> {
    await this.page.evaluate(() => {
      document.body.style.setProperty('display', 'block', 'important');
      document.body.style.setProperty('visibility', 'visible', 'important');
      document.body.style.setProperty('opacity', '1', 'important');

      // Remove loader / overlay elements.
      document
        .querySelectorAll<HTMLElement>(
          '[class*="loader"], [class*="Loader"], [class*="spinner"], [class*="Spinner"], ' +
          '[class*="overlay"], [class*="Overlay"], [class*="preload"], [class*="Preload"], ' +
          '[id*="loader"], [id*="preloader"]',
        )
        .forEach((el) => el.remove());

      // Force ancestors of main content landmarks visible.
      for (const tag of ['main', 'header', 'nav']) {
        const el = document.querySelector(tag);
        let node = el?.parentElement;
        while (node && node !== document.documentElement) {
          node.style.setProperty('display', 'block', 'important');
          node.style.setProperty('visibility', 'visible', 'important');
          node.style.setProperty('opacity', '1', 'important');
          node = node.parentElement;
        }
      }

      // Un-hide every descendant of <main> and <footer> that's hidden via inline
      // display:none / visibility:hidden. The Next.js SSR output hides below-the-fold
      // sections until React scheduling un-hides them; in CI React can't hydrate in
      // time, so we do it manually.
      const roots = Array.from(document.querySelectorAll('main, footer, header'));
      for (const root of roots) {
        for (const el of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
          const cs = getComputedStyle(el);
          if (cs.display === 'none') {
            el.style.setProperty('display', 'block', 'important');
          }
          if (cs.visibility === 'hidden') {
            el.style.setProperty('visibility', 'visible', 'important');
          }
          if (cs.opacity === '0') {
            el.style.setProperty('opacity', '1', 'important');
          }
        }
      }
    });

    // Inject style rule as safety net — catches CSS that re-hides after inline overrides.
    // Note: the universal `main *, footer *` rule is intentionally broad because
    // the Next.js SSR uses class-name-hash selectors to hide below-the-fold content.
    await this.page.addStyleTag({
      content: `
        body, #__next, #root, #app, [id*="layout"], main, header, nav, footer {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
        }
        main *[style*="display: none"],
        main *[style*="display:none"],
        footer *[style*="display: none"],
        footer *[style*="display:none"] {
          display: revert !important;
        }
        [class*="loader"], [class*="spinner"], [class*="overlay"], [class*="preload"] {
          display: none !important;
        }
      `,
    });
  }

  async prepareForSnapshot(): Promise<void> {
    await triggerLazyLoad(this.page);
    await waitForAllImages(this.page);
    await freezeAnimations(this.page);
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

    // 45 s is enough: if the section hasn't attached after triggerLazyLoad +
    // full-page scroll, it isn't coming. Longer timeouts just waste pipeline minutes
    // on failing tests (7 failures × 150 s × 2 retries = 35 wasted minutes).
    await locator.waitFor({ state: 'attached', timeout: 45_000 });

    // Use evaluate to bypass Playwright's actionability check (elements inside
    // overflow:hidden carousels are in the DOM but not "actionable").
    await locator.evaluate((el) => {
      el.scrollIntoView({ behavior: 'instant', block: 'center' });
    });
    await this.page.waitForTimeout(500);
  }
}
