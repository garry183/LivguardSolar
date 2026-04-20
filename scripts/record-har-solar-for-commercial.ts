/**
 * Record HAR file for CI replay — solar-for-commercial page.
 * Runs the solar-for-commercial visual spec with RECORD_HAR=1 so that all API responses
 * from stage.livguardsolar.com and cdndev.livguardsolar.com are saved to
 * tests/fixtures/har/solar-for-commercial.har
 *
 * Usage: npm run test:record-har:solar-for-commercial
 */
import { execSync } from 'child_process';

console.log('Recording HAR for solar-for-commercial...\n');
try {
  execSync(
    'npx playwright test tests/visual/solar-for-commercial.visual.spec.ts --project=chromium-desktop -g "full page – desktop" --update-snapshots',
    {
      stdio: 'inherit',
      env: { ...process.env, RECORD_HAR: '1' },
    },
  );
  console.log('\nHAR recorded at tests/fixtures/har/solar-for-commercial.har');
  console.log('Commit it: git add tests/fixtures/har/ && git commit -m "chore: record solar-for-commercial HAR"');
} catch {
  console.log('\nSome tests may have failed — HAR was still recorded if page loaded.');
  console.log('Check tests/fixtures/har/solar-for-commercial.har');
}
