/**
 * Record HAR file for CI replay — solar-for-home page.
 * Runs the solar-for-home visual spec with RECORD_HAR=1 so that all API responses
 * from stage.livguardsolar.com and cdndev.livguardsolar.com are saved to
 * tests/fixtures/har/solar-for-home.har
 *
 * Uses the "full page – desktop" test because it calls prepareForSnapshot()
 * → triggerLazyLoad() which scrolls the entire page, capturing all lazy-loaded
 * JS chunks and API-driven content. A narrow test would miss chunks → React crash in CI.
 *
 * Usage: npm run test:record-har:solar-for-home
 */
import { execSync } from 'child_process';

console.log('Recording HAR for solar-for-home...\n');
try {
  execSync(
    'npx playwright test tests/visual/solar-for-home.visual.spec.ts --project=chromium-desktop -g "full page – desktop" --update-snapshots',
    {
      stdio: 'inherit',
      env: { ...process.env, RECORD_HAR: '1' },
    },
  );
  console.log('\nHAR recorded at tests/fixtures/har/solar-for-home.har');
  console.log('Commit it: git add tests/fixtures/har/ && git commit -m "chore: record solar-for-home HAR"');
} catch {
  console.log('\nSome tests may have failed — HAR was still recorded if page loaded.');
  console.log('Check tests/fixtures/har/solar-for-home.har');
}
