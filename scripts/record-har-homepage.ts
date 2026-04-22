/**
 * Record HAR file for CI replay — homepage.
 * Runs the homepage visual spec with RECORD_HAR=1 so that all API responses
 * from stage.livguardsolar.com and cdndev.livguardsolar.com are saved to
 * tests/fixtures/har/homepage.har
 *
 * Uses the "full page – desktop" test because it calls prepareForSnapshot()
 * → triggerLazyLoad() which scrolls the entire page, capturing all lazy-loaded
 * JS chunks and API-driven sections. A narrow test would miss content → React crash in CI.
 *
 * Usage: npm run test:record-har:homepage
 */
import { execSync } from 'child_process';

console.log('Recording HAR for homepage...\n');
try {
  execSync(
    'npx playwright test tests/visual/homepage.visual.spec.ts --project=chromium-desktop -g "full page – desktop" --update-snapshots',
    {
      stdio: 'inherit',
      env: { ...process.env, RECORD_HAR: '1', BASE_URL: 'https://stage.livguardsolar.com/' },
    },
  );
  console.log('\nHAR recorded at tests/fixtures/har/homepage.har');
  console.log('Commit it: git add tests/fixtures/har/ && git commit -m "chore: record homepage HAR"');
} catch {
  console.log('\nSome tests may have failed — HAR was still recorded if page loaded.');
  console.log('Check tests/fixtures/har/homepage.har');
}
