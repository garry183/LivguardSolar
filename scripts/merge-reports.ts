#!/usr/bin/env ts-node
/**
 * Merges per-spec Playwright JSON reports into a single combined
 * reports/playwright-report.json for a unified brain analysis.
 *
 * Usage: npx ts-node scripts/merge-reports.ts
 */

import fs from 'fs';
import path from 'path';

interface PlaywrightReport {
  suites: object[];
  stats: {
    expected: number;
    unexpected: number;
    flaky: number;
    skipped: number;
    duration: number;
  };
}

const SPEC_REPORTS = [
  'reports/homepage-report.json',
  'reports/solar-for-home-report.json',
  'reports/solar-for-commercial-report.json',
  'reports/rooftop-solar-report.json',
];

const merged: PlaywrightReport = {
  suites: [],
  stats: { expected: 0, unexpected: 0, flaky: 0, skipped: 0, duration: 0 },
};

for (const filePath of SPEC_REPORTS) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    console.log(`[merge] skipping missing: ${filePath}`);
    continue;
  }
  const report = JSON.parse(fs.readFileSync(abs, 'utf8')) as PlaywrightReport;
  merged.suites.push(...(report.suites ?? []));
  merged.stats.expected   += report.stats?.expected   ?? 0;
  merged.stats.unexpected += report.stats?.unexpected ?? 0;
  merged.stats.flaky      += report.stats?.flaky      ?? 0;
  merged.stats.skipped    += report.stats?.skipped    ?? 0;
  merged.stats.duration   += report.stats?.duration   ?? 0;
  console.log(`[merge] added: ${filePath}`);
}

const outPath = path.resolve('reports/playwright-report.json');
fs.writeFileSync(outPath, JSON.stringify(merged, null, 2), 'utf8');
console.log(`[merge] written → ${outPath}  (${merged.suites.length} suites)`);
