const BASE_URL = (process.env.STAGING_URL || '').replace(/\/$/, '');

module.exports = {
  ci: {
    collect: {
      url: [
        `${BASE_URL}/`,
        `${BASE_URL}/rooftop-solar`,
        `${BASE_URL}/solar-for-home`,
        `${BASE_URL}/solar-for-commercial`,
      ],
      numberOfRuns: 5,
      settings: {
        chromeFlags: '--no-sandbox --disable-dev-shm-usage --disable-gpu --headless=new --disable-features=VizDisplayCompositor --disable-extensions --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        maxWaitForFcp: 60000,
        maxWaitForLoad: 90000,
        throttlingMethod: 'devtools',
      },
    },
    assert: {
      assertions: {
        'categories:performance':   ['warn', { minScore: 0.7 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'first-contentful-paint':   ['warn', { maxNumericValue: 1800 }],
        'cumulative-layout-shift':  ['warn', { maxNumericValue: 0.1 }],
        'total-blocking-time':      ['warn', { maxNumericValue: 200 }],
        'interactive':              ['warn', { maxNumericValue: 3800 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
