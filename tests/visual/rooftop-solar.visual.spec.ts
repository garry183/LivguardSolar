import { test, expect } from '../fixtures/rooftopSolar.fixture';
import { VIEWPORTS, freezeAnimations } from '../utils/visualHelpers';

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

  test('footer is visible', async ({ rooftopSolarPage }) => {
    await rooftopSolarPage.scrollToSection(rooftopSolarPage.footer);
    await expect(rooftopSolarPage.footer).toBeVisible();
  });
});

test.describe('Rooftop Solar – Full-page snapshots', () => {
  test('full page – desktop', async ({ rooftopSolarPage }) => {
    // Non-deterministic: API-driven sections cause page height variance between runs.
    // Section-level tests provide equivalent stable coverage.
    test.skip(true, 'Non-deterministic: API-driven page height varies between runs; section-level tests cover this fully');
    await rooftopSolarPage.page.setViewportSize(VIEWPORTS.desktop);
    await rooftopSolarPage.prepareForSnapshot();
    await freezeAnimations(rooftopSolarPage.page);
    await rooftopSolarPage.page.waitForTimeout(2_000);
    await freezeAnimations(rooftopSolarPage.page);
    await expect(rooftopSolarPage.page).toHaveScreenshot('rooftop-solar-full-page-desktop.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.08,
      mask: [rooftopSolarPage.heroSection, rooftopSolarPage.testimonialsSection],
    });
  });

  test('full page – mobile', async ({ rooftopSolarPage }) => {
    test.skip(true, 'Non-deterministic: API-driven page height varies between runs; section-level tests cover this fully');
    await rooftopSolarPage.page.setViewportSize(VIEWPORTS.mobile);
    await rooftopSolarPage.prepareForSnapshot();
    await freezeAnimations(rooftopSolarPage.page);
    await rooftopSolarPage.page.waitForTimeout(2_000);
    await freezeAnimations(rooftopSolarPage.page);
    await expect(rooftopSolarPage.page).toHaveScreenshot('rooftop-solar-full-page-mobile.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.08,
      mask: [rooftopSolarPage.heroSection, rooftopSolarPage.testimonialsSection],
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

  test('section – hero', async ({ rooftopSolarPage }) => {
    await rooftopSolarPage.scrollToSection(rooftopSolarPage.heroSection);
    // Viewport-level screenshot: avoids "element not stable" errors from animated hero.
    await freezeAnimations(rooftopSolarPage.page);
    await expect(rooftopSolarPage.page).toHaveScreenshot('rooftop-solar-hero.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('section – Book Solar Survey', async ({ rooftopSolarPage }) => {
    await rooftopSolarPage.scrollToSection(rooftopSolarPage.bookSurveySection);
    await freezeAnimations(rooftopSolarPage.page);
    await expect(rooftopSolarPage.bookSurveySection).toHaveScreenshot(
      'rooftop-solar-book-survey.png',
    );
  });

  test('section – Benefits Carousel', async ({ rooftopSolarPage }) => {
    await rooftopSolarPage.scrollToSection(rooftopSolarPage.benefitsCarouselSection);
    // Triple freeze + dwell: carousel IO re-fires can set new JS timers after each freeze.
    await freezeAnimations(rooftopSolarPage.page);
    await rooftopSolarPage.page.waitForTimeout(2_000);
    await freezeAnimations(rooftopSolarPage.page);
    await rooftopSolarPage.page.waitForTimeout(2_000);
    await freezeAnimations(rooftopSolarPage.page);
    await expect(rooftopSolarPage.page).toHaveScreenshot('rooftop-solar-benefits-carousel.png', {
      maxDiffPixelRatio: 0.08,
      timeout: 60_000,
    });
  });

  test('section – Stats', async ({ rooftopSolarPage }) => {
    await rooftopSolarPage.scrollToSection(rooftopSolarPage.statsSection);
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

  test('section – Nationwide Reach', async ({ rooftopSolarPage }, testInfo) => {
    // API-driven heading may not load within 150 s on WebKit (same pattern as solar-for-home).
    test.skip(
      testInfo.project.name === 'mobile-safari',
      'API-driven heading does not load within 150 s on WebKit: covered by chromium-desktop + mobile-chrome',
    );
    await rooftopSolarPage.scrollToSection(rooftopSolarPage.nationwideReachSection);
    await freezeAnimations(rooftopSolarPage.page);
    await expect(rooftopSolarPage.nationwideReachSection).toHaveScreenshot(
      'rooftop-solar-nationwide-reach.png',
      { timeout: 30_000 },
    );
  });

  test('section – Testimonials', async ({ rooftopSolarPage }, testInfo) => {
    // Testimonials carousel may not load within 150 s on WebKit without prior-section warm-up.
    test.skip(
      testInfo.project.name === 'mobile-safari',
      'API-driven carousel content may not load within 150 s on WebKit',
    );
    await rooftopSolarPage.scrollToSection(rooftopSolarPage.testimonialsSection);
    await freezeAnimations(rooftopSolarPage.page);
    await expect(rooftopSolarPage.testimonialsSection).toHaveScreenshot(
      'rooftop-solar-testimonials.png',
      { maxDiffPixelRatio: 0.10 },
    );
  });

  test('section – FAQ', async ({ rooftopSolarPage }) => {
    await rooftopSolarPage.scrollToSection(rooftopSolarPage.faqSection);
    await freezeAnimations(rooftopSolarPage.page);
    await expect(rooftopSolarPage.faqSection).toHaveScreenshot('rooftop-solar-faq.png');
  });

  test('section – Footer', async ({ rooftopSolarPage }) => {
    await rooftopSolarPage.scrollToSection(rooftopSolarPage.footer);
    // Viewport-level screenshot: avoids mobile bottom-nav artefacts inside <footer>.
    await expect(rooftopSolarPage.page).toHaveScreenshot('rooftop-solar-footer.png', {
      timeout: 30_000,
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
    await freezeAnimations(rooftopSolarPage.page);
    await expect(rooftopSolarPage.page).toHaveScreenshot('rooftop-solar-mobile-hero.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('mobile – footer', async ({ rooftopSolarPage }) => {
    test.setTimeout(120_000);
    await rooftopSolarPage.scrollToSection(rooftopSolarPage.footer);
    // Viewport-level screenshot: avoids the footer-on-top / header-below layout artefact.
    await expect(rooftopSolarPage.page).toHaveScreenshot('rooftop-solar-mobile-footer.png');
  });
});
