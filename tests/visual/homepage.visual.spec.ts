import { test, expect } from '../fixtures/base';
import { VIEWPORTS } from '../utils/visualHelpers';

test.describe('Homepage – Element visibility', () => {
  test('logo is visible', async ({ homePage }) => {
    await expect(homePage.logo).toBeVisible();
  });

  test('navbar is visible', async ({ homePage }) => {
    await expect(homePage.navbar).toBeVisible();
  });

  test('Solar for Home nav link is present', async ({ homePage }) => {
    const vp = homePage.page.viewportSize();
    test.skip(!!vp && vp.width < 1024, 'Nav links are hidden behind hamburger menu on mobile/tablet');
    await expect(homePage.navSolarForHome).toBeVisible();
  });

  test('Solar for Commercial nav link is present', async ({ homePage }) => {
    const vp = homePage.page.viewportSize();
    test.skip(!!vp && vp.width < 1024, 'Nav links are hidden behind hamburger menu on mobile/tablet');
    await expect(homePage.navSolarForCommercial).toBeVisible();
  });

  test('Book Free Site Survey CTA is present', async ({ homePage }) => {
    await expect(homePage.bookSurveyBtn).toBeVisible();
  });

  test('hero section heading is visible', async ({ homePage }) => {
    await expect(
      homePage.page.getByRole('heading', { name: /reliable solar/i }),
    ).toBeVisible();
  });

  test('footer is visible', async ({ homePage }) => {
    await homePage.scrollToSection(homePage.footer);
    await expect(homePage.footer).toBeVisible();
  });

  test('footer copyright text is present', async ({ homePage }) => {
    await homePage.scrollToSection(homePage.footer);
    await expect(
      homePage.page.getByText(/livguard.*all rights reserved/i),
    ).toBeVisible();
  });
});

test.describe('Homepage – Full-page snapshots', () => {
  test('full page – desktop', async ({ homePage }) => {
    await homePage.page.setViewportSize(VIEWPORTS.desktop);
    await homePage.prepareForSnapshot();
    await expect(homePage.page).toHaveScreenshot('full-page-desktop.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.03,
      mask: [
        // Mask dynamic/rotating content
        homePage.heroSection,
        homePage.solarDiariesSection,
      ],
    });
  });

  test('full page – mobile', async ({ homePage }) => {
    await homePage.page.setViewportSize(VIEWPORTS.mobile);
    await homePage.prepareForSnapshot();
    await expect(homePage.page).toHaveScreenshot('full-page-mobile.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.03,
      mask: [homePage.heroSection, homePage.solarDiariesSection],
    });
  });
});

test.describe('Homepage – Section snapshots', () => {
  test.beforeEach(async ({ homePage }) => {
    await homePage.prepareForSnapshot();
  });

  test('section – navbar', async ({ homePage }) => {
    await expect(homePage.navbar).toHaveScreenshot('navbar.png');
  });

  test('section – hero', async ({ homePage }) => {
    await homePage.scrollToSection(homePage.heroSection);
    await expect(homePage.heroSection).toHaveScreenshot('hero.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('section – Nationwide Reach', async ({ homePage }) => {
    await homePage.scrollToSection(homePage.weAreEverywhereSection);
    await expect(homePage.weAreEverywhereSection).toHaveScreenshot('we-are-everywhere.png');
  });

  test('section – 360 Path to Energy Savings', async ({ homePage }) => {
    await homePage.scrollToSection(homePage.goSolarStepsSection);
    await expect(homePage.goSolarStepsSection).toHaveScreenshot('go-solar-steps.png');
  });

  test('section – 360 Portfolio', async ({ homePage }) => {
    await homePage.scrollToSection(homePage.featuredProductsSection);
    await expect(homePage.featuredProductsSection).toHaveScreenshot('featured-products.png');
  });

  test('section – Why Livguard Solar', async ({ homePage }) => {
    await homePage.scrollToSection(homePage.whyLivguardSection);
    await expect(homePage.whyLivguardSection).toHaveScreenshot('why-livguard.png');
  });

  test('section – Find the Right Solar Solution', async ({ homePage }) => {
    await homePage.scrollToSection(homePage.faqSection);
    await expect(homePage.faqSection).toHaveScreenshot('faq.png');
  });

  test('section – Footer', async ({ homePage }) => {
    await homePage.scrollToSection(homePage.footer);
    // Viewport-level screenshot: avoids capturing mobile bottom-nav elements
    // that sit inside <footer> and visually resemble a header bar.
    await expect(homePage.page).toHaveScreenshot('footer.png');
  });
});

test.describe('Homepage – Mobile responsive snapshots', () => {
  test.use({ viewport: VIEWPORTS.mobile });

  test('mobile – navbar', async ({ homePage }) => {
    await expect(homePage.navbar).toHaveScreenshot('mobile-navbar.png');
  });

  test('mobile – hero', async ({ homePage }) => {
    await homePage.scrollToSection(homePage.heroSection);
    await expect(homePage.heroSection).toHaveScreenshot('mobile-hero.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('mobile – footer', async ({ homePage }) => {
    await homePage.scrollToSection(homePage.footer);
    // Viewport-level screenshot: avoids the footer-on-top / header-below
    // layout artefact caused by the mobile bottom-nav inside <footer>.
    await expect(homePage.page).toHaveScreenshot('mobile-footer.png');
  });
});
