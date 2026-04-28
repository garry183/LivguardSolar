import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testIgnore: ['tests/linear/**'],
  globalTeardown: './global-teardown.ts',
  // Parallel in CI to minimise wall-clock time (Bitbucket runner is sized via
  // `size: 4x` in bitbucket-pipelines.yml → 4 vCPU, 16 GB). Sequential locally
  // so a human watching the terminal sees stable ordering.
  fullyParallel: !!process.env.CI,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 4 : 10,
  timeout: process.env.CI ? 120_000 : 60_000,

  expect: {
    timeout: 15_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
      animations: 'disabled',
      maskColor: '#e0e0e0',
    },
  },

  use: {
    baseURL: process.env.BASE_URL ?? 'https://www.livguardsolar.com',
    navigationTimeout: process.env.CI ? 90_000 : 45_000,
    actionTimeout: 15_000,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },

  snapshotPathTemplate:
    '{testDir}/visual/__snapshots__/{testFilePath}/{arg}-{projectName}{ext}',

  reporter: [
    ['list'],
    ['json', { outputFile: 'reports/playwright-report.json' }],
    ['html', { outputFolder: 'reports/html', open: 'never' }],
    ['junit', { outputFile: 'reports/junit/results.xml' }],
    ['allure-playwright', { outputFolder: 'allure-results', suiteTitle: false }],
  ],

  outputDir: 'reports/test-results',

  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        launchOptions: {
          args: [
            '--font-render-hinting=none',
            '--disable-font-subpixel-positioning',
            '--disable-lcd-text',
            '--force-device-scale-factor=1',
          ],
        },
      },
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        launchOptions: {
          args: [
            '--font-render-hinting=none',
            '--disable-font-subpixel-positioning',
            '--disable-lcd-text',
            '--force-device-scale-factor=1',
          ],
        },
      },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
    },
  ],
});
