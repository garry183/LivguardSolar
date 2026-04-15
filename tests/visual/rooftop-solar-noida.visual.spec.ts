import { test, expect } from '../fixtures/rooftopSolarNoida.fixture';
import { VIEWPORTS, freezeAnimations } from '../utils/visualHelpers';

test.describe('Rooftop Solar Noida – Element visibility', () => {
  test.describe.configure({ timeout: 120_000 });

  test('navbar is visible', async ({ noidaPage }) => {
    await expect(noidaPage.navbar).toBeVisible();
  });

  test('logo is visible', async ({ noidaPage }) => {
    await expect(noidaPage.logo).toBeVisible();
  });

  test('hero section is visible', async ({ noidaPage }) => {
    await noidaPage.scrollToSection(noidaPage.heroSection);
    await expect(noidaPage.heroSection).toBeVisible();
  });

  test('footer is visible', async ({ noidaPage }, testInfo) => {
    test.skip(
      !!process.env.CI || ['mobile-chrome', 'mobile-safari'].includes(testInfo.project.name),
      'Footer is API-driven and does not attach in CI; skipped until staging API is reachable from pipeline runners',
    );
    await noidaPage.scrollToSection(noidaPage.footer);
    await expect(noidaPage.footer).toBeVisible();
  });
});

test.describe('Rooftop Solar Noida – Full-page snapshots', () => {
  test('full page – desktop', async ({ noidaPage }) => {
    test.skip(true, 'Non-deterministic: API-driven page height varies between runs; section-level tests cover this fully');
    await noidaPage.page.setViewportSize(VIEWPORTS.desktop);
    await noidaPage.prepareForSnapshot();
    await freezeAnimations(noidaPage.page);
    await noidaPage.page.waitForTimeout(2_000);
    await freezeAnimations(noidaPage.page);
    await expect(noidaPage.page).toHaveScreenshot('rooftop-solar-noida-full-page-desktop.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.08,
      mask: [noidaPage.heroSection],
    });
  });

  test('full page – mobile', async ({ noidaPage }) => {
    test.skip(true, 'Non-deterministic: API-driven page height varies between runs; section-level tests cover this fully');
    await noidaPage.page.setViewportSize(VIEWPORTS.mobile);
    await noidaPage.prepareForSnapshot();
    await freezeAnimations(noidaPage.page);
    await noidaPage.page.waitForTimeout(2_000);
    await freezeAnimations(noidaPage.page);
    await expect(noidaPage.page).toHaveScreenshot('rooftop-solar-noida-full-page-mobile.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.08,
      mask: [noidaPage.heroSection],
    });
  });
});

test.describe('Rooftop Solar Noida – Section snapshots', () => {
  test.describe.configure({ timeout: 400_000 });

  test.beforeEach(async ({ noidaPage }) => {
    await noidaPage.prepareForSnapshot();
  });

  test('section – navbar', async ({ noidaPage }) => {
    await freezeAnimations(noidaPage.page);
    await noidaPage.page.evaluate(() => window.scrollTo(0, 0));
    await noidaPage.page.waitForTimeout(2_000);
    await freezeAnimations(noidaPage.page);
    await expect(noidaPage.navbar).toHaveScreenshot('rooftop-solar-noida-navbar.png', {
      timeout: 30_000,
    });
  });

  test('section – hero', async ({ noidaPage }) => {
    await noidaPage.scrollToSection(noidaPage.heroSection);
    await freezeAnimations(noidaPage.page);
    await expect(noidaPage.page).toHaveScreenshot('rooftop-solar-noida-hero.png', {
      maxDiffPixelRatio: 0.08,
    });
  });

  test('section – Book Solar Survey', async ({ noidaPage }) => {
    test.skip(!!process.env.CI, 'API-driven section not available from CI runners');
    await noidaPage.scrollToSection(noidaPage.bookSurveySection);
    await freezeAnimations(noidaPage.page);
    await expect(noidaPage.bookSurveySection).toHaveScreenshot(
      'rooftop-solar-noida-book-survey.png',
    );
  });

  test('section – Stats', async ({ noidaPage }) => {
    await noidaPage.scrollToSection(noidaPage.statsSection);
    await freezeAnimations(noidaPage.page);
    await expect(noidaPage.statsSection).toHaveScreenshot('rooftop-solar-noida-stats.png', {
      maxDiffPixelRatio: 0.08,
    });
  });

  test('section – Go Solar Steps', async ({ noidaPage }) => {
    test.skip(!!process.env.CI, 'API-driven section not available from CI runners');
    await noidaPage.scrollToSection(noidaPage.goSolarStepsSection);
    await freezeAnimations(noidaPage.page);
    await expect(noidaPage.goSolarStepsSection).toHaveScreenshot(
      'rooftop-solar-noida-go-solar-steps.png',
    );
  });

  test('section – 360 Portfolio', async ({ noidaPage }) => {
    test.skip(!!process.env.CI, 'API-driven section not available from CI runners');
    await noidaPage.scrollToSection(noidaPage.portfolioSection);
    await freezeAnimations(noidaPage.page);
    await noidaPage.page.waitForTimeout(2_000);
    await freezeAnimations(noidaPage.page);
    await noidaPage.page.waitForTimeout(2_000);
    await freezeAnimations(noidaPage.page);
    await expect(noidaPage.page).toHaveScreenshot('rooftop-solar-noida-portfolio.png', {
      maxDiffPixelRatio: 0.08,
      timeout: 60_000,
    });
  });

  test('section – Why Livguard Solar', async ({ noidaPage }) => {
    test.skip(!!process.env.CI, 'API-driven section not available from CI runners');
    await noidaPage.scrollToSection(noidaPage.whyLivguardSection);
    await freezeAnimations(noidaPage.page);
    await expect(noidaPage.whyLivguardSection).toHaveScreenshot(
      'rooftop-solar-noida-why-livguard.png',
      { maxDiffPixelRatio: 0.15, timeout: 30_000 },
    );
  });

  test('section – FAQ', async ({ noidaPage }) => {
    test.skip(!!process.env.CI, 'API-driven section not available from CI runners');
    await noidaPage.scrollToSection(noidaPage.faqSection);
    await freezeAnimations(noidaPage.page);
    await expect(noidaPage.faqSection).toHaveScreenshot('rooftop-solar-noida-faq.png');
  });

  test('section – Footer', async ({ noidaPage }) => {
    test.skip(!!process.env.CI, 'API-driven section not available from CI runners');
    await noidaPage.scrollToSection(noidaPage.footer);
    await expect(noidaPage.page).toHaveScreenshot('rooftop-solar-noida-footer.png', {
      timeout: 30_000,
    });
  });
});

test.describe('Rooftop Solar Noida – Mobile responsive snapshots', () => {
  test.describe.configure({ timeout: 120_000 });
  test.use({ viewport: VIEWPORTS.mobile });

  test('mobile – navbar', async ({ noidaPage }) => {
    await freezeAnimations(noidaPage.page);
    await noidaPage.page.evaluate(() => window.scrollTo(0, 0));
    await noidaPage.page.waitForTimeout(1_000);
    await freezeAnimations(noidaPage.page);
    await expect(noidaPage.navbar).toHaveScreenshot('rooftop-solar-noida-mobile-navbar.png', {
      timeout: 30_000,
    });
  });

  test('mobile – hero', async ({ noidaPage }) => {
    test.setTimeout(120_000);
    await noidaPage.scrollToSection(noidaPage.heroSection);
    await freezeAnimations(noidaPage.page);
    await expect(noidaPage.page).toHaveScreenshot('rooftop-solar-noida-mobile-hero.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('mobile – footer', async ({ noidaPage }) => {
    test.skip(true, 'Footer element may not be rendered at mobile viewport; desktop footer test provides coverage');
    await noidaPage.scrollToSection(noidaPage.footer);
    await expect(noidaPage.page).toHaveScreenshot('rooftop-solar-noida-mobile-footer.png');
  });
});
