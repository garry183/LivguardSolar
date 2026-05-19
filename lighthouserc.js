module.exports = {
  ci: {
    collect: {
      url: [
        `${process.env.STAGING_URL}/`,
        `${process.env.STAGING_URL}/rooftop-solar`,
        `${process.env.STAGING_URL}/solar-for-home`,
        `${process.env.STAGING_URL}/solar-for-commercial`,
      ],
      numberOfRuns: 5,
      settings: {
        chromeFlags: '--no-sandbox --disable-dev-shm-usage',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
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
