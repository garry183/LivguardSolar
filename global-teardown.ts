import { execSync, spawn } from 'child_process';
import path from 'path';

export default async function globalTeardown() {
  // Skip Allure report generation in CI — Java is not available in the pipeline
  // image. Raw allure-results are archived as artifacts and can be used locally.
  if (process.env.CI) {
    console.log('\n⏭️  Skipping Allure report generation in CI (no Java).');
    return;
  }

  const rootDir = path.resolve(__dirname);
  const resultsDir = path.join(rootDir, 'allure-results');
  const reportDir = path.join(rootDir, 'allure-report');

  console.log('\n📊 Generating Allure report...');
  try {
    execSync(
      `npx allure generate "${resultsDir}" --clean -o "${reportDir}"`,
      { cwd: rootDir, stdio: 'inherit' }
    );
    console.log('✅ Allure report generated.');
  } catch (err) {
    console.error('❌ Failed to generate Allure report:', err);
    return;
  }

  console.log('🚀 Opening Allure report in browser...');
  const child = spawn(
    'npx',
    ['allure', 'open', reportDir],
    {
      cwd: rootDir,
      stdio: 'ignore',
      detached: true,
      shell: true,
    }
  );
  child.unref();
}
