/**
 * Record HAR file for CI replay — Jaipur city page.
 * Runs the jaipur visual spec with RECORD_HAR=1 so that all API responses
 * from stage.livguardsolar.com and cdndev.livguardsolar.com are saved to
 * tests/fixtures/har/rooftop-solar-jaipur.har
 *
 * Uses the "full page – desktop" test because it calls prepareForSnapshot()
 * → triggerLazyLoad() which scrolls the entire page, capturing all lazy-loaded
 * JS chunks. A narrow test would miss below-fold chunks → React crash in CI.
 *
 * Usage: npm run test:record-har:jaipur
 */
import { execSync } from 'child_process';

console.log('Recording HAR for rooftop-solar-jaipur...\n');
try {
  execSync(
    'npx playwright test tests/visual/rooftop-solar-jaipur.visual.spec.ts --project=chromium-desktop -g "full page – desktop" --update-snapshots',
    {
      stdio: 'inherit',
      env: { ...process.env, RECORD_HAR: '1' },
    },
  );
  console.log('\nHAR recorded at tests/fixtures/har/rooftop-solar-jaipur.har');
  console.log('Commit it: git add tests/fixtures/har/ && git commit -m "chore: record jaipur HAR"');
} catch {
  console.log('\nSome tests may have failed — HAR was still recorded if page loaded.');
  console.log('Check tests/fixtures/har/rooftop-solar-jaipur.har');
}
