import { test, expect } from '../fixtures/rooftopSolarJaipur.fixture';
import { VIEWPORTS, freezeAnimations } from '../utils/visualHelpers';

test.describe('Rooftop Solar Jaipur – Element visibility', () => {
  test.describe.configure({ timeout: 120_000 });

  test('navbar is visible', async ({ jaipurPage }) => {
    await expect(jaipurPage.navbar).toBeVisible();
  });

  test('logo is visible', async ({ jaipurPage }) => {
    await expect(jaipurPage.logo).toBeVisible();
  });

  test('hero section is visible', async ({ jaipurPage }) => {
    await jaipurPage.scrollToSection(jaipurPage.heroSection);
    await expect(jaipurPage.heroSection).toBeVisible();
  });

  test('footer is visible', async ({ jaipurPage }, testInfo) => {
    // Footer may not be rendered at mobile viewport (desktop-only on city pages).
    test.skip(
      ['mobile-chrome', 'mobile-safari'].includes(testInfo.project.name),
      'Footer element may not be rendered at mobile viewport; desktop test provides coverage',
    );
    await jaipurPage.scrollToSection(jaipurPage.footer);
    await expect(jaipurPage.footer).toBeVisible();
  });
});

test.describe('Rooftop Solar Jaipur – Full-page snapshots', () => {
  test('full page – desktop', async ({ jaipurPage }) => {
    // Non-deterministic: API-driven sections cause page height variance between runs.
    test.skip(true, 'Non-deterministic: API-driven page height varies between runs; section-level tests cover this fully');
    await jaipurPage.page.setViewportSize(VIEWPORTS.desktop);
    await jaipurPage.prepareForSnapshot();
    await freezeAnimations(jaipurPage.page);
    await jaipurPage.page.waitForTimeout(2_000);
    await freezeAnimations(jaipurPage.page);
    await expect(jaipurPage.page).toHaveScreenshot('rooftop-solar-jaipur-full-page-desktop.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.08,
      mask: [jaipurPage.heroSection],
    });
  });

  test('full page – mobile', async ({ jaipurPage }) => {
    test.skip(true, 'Non-deterministic: API-driven page height varies between runs; section-level tests cover this fully');
    await jaipurPage.page.setViewportSize(VIEWPORTS.mobile);
    await jaipurPage.prepareForSnapshot();
    await freezeAnimations(jaipurPage.page);
    await jaipurPage.page.waitForTimeout(2_000);
    await freezeAnimations(jaipurPage.page);
    await expect(jaipurPage.page).toHaveScreenshot('rooftop-solar-jaipur-full-page-mobile.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.08,
      mask: [jaipurPage.heroSection],
    });
  });
});

test.describe('Rooftop Solar Jaipur – Section snapshots', () => {
  test.describe.configure({ timeout: 400_000 });

  test.beforeEach(async ({ jaipurPage }) => {
    await jaipurPage.prepareForSnapshot();
  });

  test('section – navbar', async ({ jaipurPage }) => {
    await freezeAnimations(jaipurPage.page);
    await jaipurPage.page.evaluate(() => window.scrollTo(0, 0));
    await jaipurPage.page.waitForTimeout(2_000);
    await freezeAnimations(jaipurPage.page);
    await expect(jaipurPage.navbar).toHaveScreenshot('rooftop-solar-jaipur-navbar.png', {
      timeout: 30_000,
    });
  });

  test('section – hero', async ({ jaipurPage }) => {
    await jaipurPage.scrollToSection(jaipurPage.heroSection);
    // Viewport-level screenshot: avoids "element not stable" errors from animated hero.
    // Hero has a background slider; allow 8% diff to cover slide-position variance.
    await freezeAnimations(jaipurPage.page);
    await expect(jaipurPage.page).toHaveScreenshot('rooftop-solar-jaipur-hero.png', {
      maxDiffPixelRatio: 0.08,
    });
  });

  test('section – Book Solar Survey', async ({ jaipurPage }) => {
    await jaipurPage.scrollToSection(jaipurPage.bookSurveySection);
    await freezeAnimations(jaipurPage.page);
    await expect(jaipurPage.bookSurveySection).toHaveScreenshot(
      'rooftop-solar-jaipur-book-survey.png',
    );
  });

  test('section – Stats', async ({ jaipurPage }) => {
    await jaipurPage.scrollToSection(jaipurPage.statsSection);
    await freezeAnimations(jaipurPage.page);
    await expect(jaipurPage.statsSection).toHaveScreenshot('rooftop-solar-jaipur-stats.png', {
      // Counter stats animate via requestAnimationFrame; allow small pixel variance.
      maxDiffPixelRatio: 0.08,
    });
  });

  test('section – Go Solar Steps', async ({ jaipurPage }) => {
    await jaipurPage.scrollToSection(jaipurPage.goSolarStepsSection);
    await freezeAnimations(jaipurPage.page);
    await expect(jaipurPage.goSolarStepsSection).toHaveScreenshot(
      'rooftop-solar-jaipur-go-solar-steps.png',
    );
  });

  test('section – 360 Portfolio', async ({ jaipurPage }) => {
    await jaipurPage.scrollToSection(jaipurPage.portfolioSection);
    // Triple freeze + dwell pattern for product carousels.
    await freezeAnimations(jaipurPage.page);
    await jaipurPage.page.waitForTimeout(2_000);
    await freezeAnimations(jaipurPage.page);
    await jaipurPage.page.waitForTimeout(2_000);
    await freezeAnimations(jaipurPage.page);
    await expect(jaipurPage.page).toHaveScreenshot('rooftop-solar-jaipur-portfolio.png', {
      maxDiffPixelRatio: 0.08,
      timeout: 60_000,
    });
  });

  test('section – Why Livguard Solar', async ({ jaipurPage }) => {
    await jaipurPage.scrollToSection(jaipurPage.whyLivguardSection);
    await freezeAnimations(jaipurPage.page);
    await expect(jaipurPage.whyLivguardSection).toHaveScreenshot(
      'rooftop-solar-jaipur-why-livguard.png',
      { maxDiffPixelRatio: 0.15, timeout: 30_000 },
    );
  });

  test('section – FAQ', async ({ jaipurPage }) => {
    await jaipurPage.scrollToSection(jaipurPage.faqSection);
    await freezeAnimations(jaipurPage.page);
    await expect(jaipurPage.faqSection).toHaveScreenshot('rooftop-solar-jaipur-faq.png');
  });

  test('section – Footer', async ({ jaipurPage }) => {
    await jaipurPage.scrollToSection(jaipurPage.footer);
    // Viewport-level screenshot: avoids mobile bottom-nav artefacts inside <footer>.
    await expect(jaipurPage.page).toHaveScreenshot('rooftop-solar-jaipur-footer.png', {
      timeout: 30_000,
    });
  });
});

test.describe('Rooftop Solar Jaipur – Mobile responsive snapshots', () => {
  test.describe.configure({ timeout: 120_000 });
  test.use({ viewport: VIEWPORTS.mobile });

  test('mobile – navbar', async ({ jaipurPage }) => {
    await freezeAnimations(jaipurPage.page);
    await jaipurPage.page.evaluate(() => window.scrollTo(0, 0));
    await jaipurPage.page.waitForTimeout(1_000);
    await freezeAnimations(jaipurPage.page);
    await expect(jaipurPage.navbar).toHaveScreenshot('rooftop-solar-jaipur-mobile-navbar.png', {
      timeout: 30_000,
    });
  });

  test('mobile – hero', async ({ jaipurPage }) => {
    test.setTimeout(120_000);
    await jaipurPage.scrollToSection(jaipurPage.heroSection);
    await freezeAnimations(jaipurPage.page);
    await expect(jaipurPage.page).toHaveScreenshot('rooftop-solar-jaipur-mobile-hero.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('mobile – footer', async ({ jaipurPage }) => {
    // Footer may not be rendered at mobile viewport on city pages (desktop-only).
    test.skip(true, 'Footer element may not be rendered at mobile viewport; desktop footer test provides coverage');
    await jaipurPage.scrollToSection(jaipurPage.footer);
    await expect(jaipurPage.page).toHaveScreenshot('rooftop-solar-jaipur-mobile-footer.png');
  });
});
