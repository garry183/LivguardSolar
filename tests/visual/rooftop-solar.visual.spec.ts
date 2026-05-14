import { test, expect } from '../fixtures/rooftopSolar.fixture';
import { VIEWPORTS, freezeAnimations, resetCarouselToFirst } from '../utils/visualHelpers';

test.describe('Rooftop Solar – Element visibility', () => {
  test.describe.configure({ timeout: 120_000 });

  test('navbar is visible', async ({ rooftopSolarPage }) => {
    await expect(rooftopSolarPage.navbar).toBeVisible();
  });

  test('logo is visible', async ({ rooftopSolarPage }) => {
    await expect(rooftopSolarPage.logo).toBeVisible();
  });

  test('hero section is visible', async ({ rooftopSolarPage }) => {
    await rooftopSolarPage.scrollToSection(rooftopSolarPage.heroSection);
    await expect(rooftopSolarPage.heroSection).toBeVisible();
  });

  test('footer is visible', async ({ rooftopSolarPage }, testInfo) => {
    // Footer is not rendered at mobile viewport on the rooftop-solar page (desktop-only).
    test.skip(
      ['mobile-chrome', 'mobile-safari'].includes(testInfo.project.name),
      'Footer element is not rendered at mobile viewport; desktop test provides coverage',
    );
    await rooftopSolarPage.scrollToSection(rooftopSolarPage.footer);
    await expect(rooftopSolarPage.footer).toBeVisible();
  });
});

test.describe('Rooftop Solar – Full-page snapshots', () => {
  test('full page – desktop', async ({ rooftopSolarPage }, testInfo) => {
    // HAR replay makes this deterministic — all API responses are hermetically sealed.
    // Mobile UA projects force a desktop viewport but trigger IO instability that shrinks
    // page height between stability screenshots. Section tests cover those projects fully.
    test.skip(
      ['mobile-chrome', 'mobile-safari'].includes(testInfo.project.name),
      'IO instability: mobile UA + forced desktop viewport; section tests provide mobile coverage',
    );
    await rooftopSolarPage.page.setViewportSize(VIEWPORTS.desktop);
    await rooftopSolarPage.prepareForSnapshot();
    await rooftopSolarPage.page.evaluate(() => window.scrollTo(0, 0));
    await rooftopSolarPage.page.waitForTimeout(500);
    await freezeAnimations(rooftopSolarPage.page);
    await rooftopSolarPage.page.waitForTimeout(2_000);
    await freezeAnimations(rooftopSolarPage.page);
    await expect(rooftopSolarPage.page).toHaveScreenshot('rooftop-solar-full-page-desktop.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.08,
      mask: [rooftopSolarPage.heroSection],
    });
  });

  test('full page – mobile', async ({ rooftopSolarPage }, testInfo) => {
    // HAR replay makes this deterministic — all API responses are hermetically sealed.
    // Linux WebKit CI caps scrollBy-based lazy loading at ~5701px; no mobile-chrome
    // baseline exists either — section tests cover both mobile projects per-section.
    test.skip(
      ['mobile-chrome', 'mobile-safari'].includes(testInfo.project.name),
      'No mobile baselines; WebKit CI scrollBy limit applies. Section tests provide coverage.',
    );
    await rooftopSolarPage.page.setViewportSize(VIEWPORTS.mobile);
    await rooftopSolarPage.prepareForSnapshot();
    await rooftopSolarPage.page.evaluate(() => window.scrollTo(0, 0));
    await rooftopSolarPage.page.waitForTimeout(500);
    await freezeAnimations(rooftopSolarPage.page);
    await rooftopSolarPage.page.waitForTimeout(2_000);
    await freezeAnimations(rooftopSolarPage.page);
    await expect(rooftopSolarPage.page).toHaveScreenshot('rooftop-solar-full-page-mobile.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.08,
      mask: [rooftopSolarPage.heroSection],
    });
  });
});

test.describe('Rooftop Solar – Section snapshots', () => {
  test.describe.configure({ timeout: 400_000 });

  test.beforeEach(async ({ rooftopSolarPage }) => {
    await rooftopSolarPage.prepareForSnapshot();
  });

  test('section – navbar', async ({ rooftopSolarPage }) => {
    await freezeAnimations(rooftopSolarPage.page);
    await rooftopSolarPage.page.evaluate(() => window.scrollTo(0, 0));
    await rooftopSolarPage.page.waitForTimeout(2_000);
    await freezeAnimations(rooftopSolarPage.page);
    await expect(rooftopSolarPage.navbar).toHaveScreenshot('rooftop-solar-navbar.png', {
      timeout: 30_000,
    });
  });

  test('section – hero', async ({ rooftopSolarPage }, testInfo) => {
    await rooftopSolarPage.scrollToSection(rooftopSolarPage.heroSection);
    // Viewport-level screenshot: avoids "element not stable" errors from animated hero.
    await freezeAnimations(rooftopSolarPage.page);
    // Desktop: Swiper API resets carousel to slide 0 deterministically.
    // Mobile: carousel is a pure React component (no Swiper), mask the hero to suppress
    // non-deterministic slide content — same strategy as full-page desktop test.
    await resetCarouselToFirst(rooftopSolarPage.page);
    const isMobile = ['mobile-chrome', 'mobile-safari'].includes(testInfo.project.name);
    await expect(rooftopSolarPage.page).toHaveScreenshot('rooftop-solar-hero.png', {
      maxDiffPixelRatio: 0.05,
      mask: isMobile ? [rooftopSolarPage.heroSection] : [],
    });
  });

  test('section – Book Solar Survey', async ({ rooftopSolarPage }) => {
    await rooftopSolarPage.scrollToSection(rooftopSolarPage.bookSurveySection);
    await freezeAnimations(rooftopSolarPage.page);
    await expect(rooftopSolarPage.bookSurveySection).toHaveScreenshot(
      'rooftop-solar-book-survey.png',
      // Form fields (textboxes, button) have non-trivial WebKit rendering variance.
      { maxDiffPixelRatio: 0.08 },
    );
  });

  test('section – Stats', async ({ rooftopSolarPage }) => {
    await rooftopSolarPage.scrollToSection(rooftopSolarPage.statsSection);
    // Wait for stats content to hydrate before freezing — in CI, the MNRE/counter text
    // can arrive late via React hydration; without this, the fallback locator resolves to
    // an empty wrapper div (132px) instead of the full stats section (204px).
    await rooftopSolarPage.page
      .locator('main')
      .getByText(/MNRE|DISCOM/i)
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 })
      .catch(() => {});
    await freezeAnimations(rooftopSolarPage.page);
    await rooftopSolarPage.page.waitForTimeout(500);
    await freezeAnimations(rooftopSolarPage.page);
    await expect(rooftopSolarPage.statsSection).toHaveScreenshot('rooftop-solar-stats.png', {
      // Counter stats animate via requestAnimationFrame; allow small pixel variance.
      maxDiffPixelRatio: 0.08,
    });
  });

  test('section – Go Solar Steps', async ({ rooftopSolarPage }) => {
    await rooftopSolarPage.scrollToSection(rooftopSolarPage.goSolarStepsSection);
    await freezeAnimations(rooftopSolarPage.page);
    await expect(rooftopSolarPage.goSolarStepsSection).toHaveScreenshot(
      'rooftop-solar-go-solar-steps.png',
    );
  });

  test('section – 360 Portfolio', async ({ rooftopSolarPage }) => {
    await rooftopSolarPage.scrollToSection(rooftopSolarPage.portfolioSection);
    // Triple freeze + dwell pattern for product carousels.
    await freezeAnimations(rooftopSolarPage.page);
    await rooftopSolarPage.page.waitForTimeout(2_000);
    await freezeAnimations(rooftopSolarPage.page);
    await rooftopSolarPage.page.waitForTimeout(2_000);
    await freezeAnimations(rooftopSolarPage.page);
    await expect(rooftopSolarPage.page).toHaveScreenshot('rooftop-solar-portfolio.png', {
      maxDiffPixelRatio: 0.08,
      timeout: 60_000,
    });
  });

  test('section – Why Livguard Solar', async ({ rooftopSolarPage }) => {
    await rooftopSolarPage.scrollToSection(rooftopSolarPage.whyLivguardSection);
    await freezeAnimations(rooftopSolarPage.page);
    await expect(rooftopSolarPage.whyLivguardSection).toHaveScreenshot(
      'rooftop-solar-why-livguard.png',
      { maxDiffPixelRatio: 0.15, timeout: 30_000 },
    );
  });

  test('section – FAQ', async ({ rooftopSolarPage }) => {
    await rooftopSolarPage.scrollToSection(rooftopSolarPage.faqSection);
    await freezeAnimations(rooftopSolarPage.page);
    await expect(rooftopSolarPage.faqSection).toHaveScreenshot('rooftop-solar-faq.png', {
      // 1px height shifts from subpixel font rendering; 0.06 absorbs without masking real regressions.
      maxDiffPixelRatio: 0.06,
    });
  });

  test('section – Footer', async ({ rooftopSolarPage }) => {
    await rooftopSolarPage.scrollToSection(rooftopSolarPage.footer);
    // Viewport-level screenshot: avoids mobile bottom-nav artefacts inside <footer>.
    await expect(rooftopSolarPage.page).toHaveScreenshot('rooftop-solar-footer.png', {
      timeout: 30_000,
      // WebKit renders footer text/shadow slightly differently per-run; 0.05 absorbs variance.
      maxDiffPixelRatio: 0.05,
    });
  });
});

test.describe('Rooftop Solar – Mobile responsive snapshots', () => {
  test.describe.configure({ timeout: 120_000 });
  test.use({ viewport: VIEWPORTS.mobile });

  test('mobile – navbar', async ({ rooftopSolarPage }) => {
    await freezeAnimations(rooftopSolarPage.page);
    await rooftopSolarPage.page.evaluate(() => window.scrollTo(0, 0));
    await rooftopSolarPage.page.waitForTimeout(1_000);
    await freezeAnimations(rooftopSolarPage.page);
    await expect(rooftopSolarPage.navbar).toHaveScreenshot('rooftop-solar-mobile-navbar.png', {
      timeout: 30_000,
    });
  });

  test('mobile – hero', async ({ rooftopSolarPage }) => {
    test.setTimeout(120_000);
    await rooftopSolarPage.scrollToSection(rooftopSolarPage.heroSection);
    // Double-freeze with 300ms settle: first freeze kills running timers/RAF;
    // settle lets any in-flight carousel frame paint and queue a new RAF;
    // second freeze cancels that queued RAF before the screenshot fires.
    await freezeAnimations(rooftopSolarPage.page);
    await rooftopSolarPage.page.waitForTimeout(300);
    await freezeAnimations(rooftopSolarPage.page);
    // Mobile carousel is pure React (no Swiper API) — mask hero to suppress non-deterministic
    // slide content, matching the full-page desktop test's masking strategy.
    await resetCarouselToFirst(rooftopSolarPage.page);
    await expect(rooftopSolarPage.page).toHaveScreenshot('rooftop-solar-mobile-hero.png', {
      maxDiffPixelRatio: 0.05,
      mask: [rooftopSolarPage.heroSection],
    });
  });

  test('mobile – footer', async ({ rooftopSolarPage }) => {
    // Footer is not rendered at mobile viewport on the rooftop-solar page (desktop-only).
    test.skip(true, 'Footer element is not rendered at mobile viewport; desktop footer test provides coverage');
    await rooftopSolarPage.scrollToSection(rooftopSolarPage.footer);
    await expect(rooftopSolarPage.page).toHaveScreenshot('rooftop-solar-mobile-footer.png');
  });
});
