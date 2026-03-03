import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  timeout: 60_000,

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
    navigationTimeout: 45_000,
    actionTimeout: 15_000,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },

  snapshotPathTemplate:
    '{testDir}/visual/__snapshots__/{testFilePath}/{arg}-{projectName}{ext}',

  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/html', open: 'never' }],
    ['junit', { outputFile: 'reports/junit/results.xml' }],
  ],

  outputDir: 'reports/test-results',

  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'firefox-desktop',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'tablet-safari',
      use: { ...devices['iPad (gen 7)'] },
    },
  ],
});
