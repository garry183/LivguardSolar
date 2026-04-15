/**
 * Record HAR file for CI replay.
 * Runs the noida visual spec with RECORD_HAR=1 so that all API responses
 * from stage.livguardsolar.com are saved to tests/fixtures/har/.
 *
 * Usage: npm run test:record-har
 */
import { execSync } from 'child_process';

console.log('Recording HAR for rooftop-solar-noida...\n');
try {
  execSync(
    'npx playwright test tests/visual/rooftop-solar-noida.visual.spec.ts --project=chromium-desktop',
    {
      stdio: 'inherit',
      env: { ...process.env, RECORD_HAR: '1' },
    },
  );
  console.log('\nHAR recorded at tests/fixtures/har/rooftop-solar-noida.har');
  console.log('Commit it: git add tests/fixtures/har/ && git commit -m "chore: update HAR"');
} catch {
  console.log('\nSome tests may have failed — HAR was still recorded if pages loaded.');
  console.log('Check tests/fixtures/har/rooftop-solar-noida.har');
}
