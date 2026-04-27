/**
 * Record HAR file for CI replay — homepage.
 * Runs the homepage visual spec with RECORD_HAR=1 so that all API responses
 * from stage.livguardsolar.com and cdndev.livguardsolar.com are saved to
 * tests/fixtures/har/homepage.har
 *
 * Uses "Homepage – Section snapshots" because its beforeEach calls
 * prepareForSnapshot() → triggerLazyLoad(), which scrolls the full page and
 * forces every lazy-loaded JS chunk and API-driven section to load.
 * "full page – desktop" is permanently skipped so triggerLazyLoad never ran
 * when targeting that test — leaving chunk files off the HAR → React crash in CI.
 *
 * Usage: npm run test:record-har:homepage
 */
import { execSync } from 'child_process';

console.log('Recording HAR for homepage...\n');
try {
  execSync(
    'npx playwright test tests/visual/homepage.visual.spec.ts --project=chromium-desktop -g "Homepage – Section snapshots" --update-snapshots',
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
