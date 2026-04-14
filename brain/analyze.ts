import fs from 'fs';
import path from 'path';
import {
  FailureCategory,
  HistoryRecord,
  NormalizedTestEntry,
  PlaywrightReport,
  Suite,
  TestHealthEntry,
} from './types';
import { classifyFailure, toHealthKey } from './rules';
import { appendHistory, readHistory } from './history';
import { computeHealth, writeHealth } from './health';

const REPORT_PATH = path.resolve(__dirname, '..', 'reports', 'playwright-report.json');

function generateRunId(): string {
  const ts = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 6);
  return `run-${ts}-${rand}`;
}

function flattenSuites(
  suites: Suite[],
  parentTitles: string[] = [],
  skipFileTitle = true
): NormalizedTestEntry[] {
  const entries: NormalizedTestEntry[] = [];

  for (const suite of suites) {
    // Skip the file-level suite title (where suite.file is defined)
    const titles = suite.file !== undefined && skipFileTitle
      ? [...parentTitles]
      : [...parentTitles, suite.title].filter(Boolean);

    if (suite.specs) {
      for (const spec of suite.specs) {
        for (const test of spec.tests) {
          const results = test.results;
          if (results.length === 0) continue;

          const firstResult = results[0];
          const lastResult = results[results.length - 1];

          const retryPassed =
            results.length > 1 &&
            lastResult.status === 'passed' &&
            firstResult.status !== 'passed';

          const failedResult = results.find(r => r.status !== 'passed') ?? firstResult;
          const errorMessage =
            failedResult.errors.length > 0
              ? failedResult.errors.map(e => e.message).join('\n')
              : null;

          const testName = [...titles, spec.title].join(' › ');

          let status: 'passed' | 'failed' | 'skipped';
          if (lastResult.status === 'passed') {
            status = 'passed';
          } else if (lastResult.status === 'skipped') {
            status = 'skipped';
          } else {
            status = 'failed';
          }

          entries.push({
            testName,
            project: test.projectName,
            status,
            retryPassed,
            durationMs: results.reduce((sum, r) => sum + r.duration, 0),
            errorMessage,
            startTime: firstResult.startTime,
          });
        }
      }
    }

    if (suite.suites) {
      entries.push(...flattenSuites(suite.suites, titles, false));
    }
  }

  return entries;
}

function printSummary(
  runId: string,
  entries: NormalizedTestEntry[],
  classifications: Map<string, FailureCategory>,
  healthTests: Record<string, TestHealthEntry>,
  blockingCount: number
): void {
  const total = entries.length;
  const passed = entries.filter(e => e.status === 'passed').length;
  const failed = entries.filter(e => e.status === 'failed').length;
  const quarantined = failed - blockingCount;

  const line = '━'.repeat(50);
  console.log(`\n${line}`);
  console.log(`  BRAIN ANALYSIS — ${runId}`);
  console.log(line);
  console.log(
    `  Total : ${total}  |  Passed : ${passed}  |  Failed : ${failed}`
  );
  console.log(`  Blocking : ${blockingCount}  |  Quarantined : ${quarantined}`);

  const failedEntries = entries.filter(e => e.status === 'failed');
  if (failedEntries.length > 0) {
    console.log('\n  FAILURES:');
    for (const entry of failedEntries) {
      const key = toHealthKey(entry.testName, entry.project);
      const category = classifications.get(`${entry.testName}|||${entry.project}`) ?? 'UNKNOWN';
      const health = healthTests[key];
      const score = health?.flakiness_score ?? 0;
      const isQuarantined = health?.status === 'quarantined';
      const disposition = isQuarantined ? 'QUARANTINED' : 'BLOCKING';

      // Truncate names for display
      const testDisplay = entry.testName.length > 35
        ? entry.testName.slice(0, 32) + '...'
        : entry.testName;
      const projectDisplay = entry.project.padEnd(18);
      const categoryDisplay = `[${category}]`.padEnd(20);

      console.log(
        `  ${categoryDisplay} ${testDisplay.padEnd(35)} ${projectDisplay} score:${score.toFixed(2)}  ${disposition}`
      );
    }
  }

  console.log('');
  console.log('  Health : reports/test-health.json');
  console.log('  History: reports/run-history.ndjson');
  console.log(`${line}\n`);
}

export async function runBrainAnalysis(): Promise<void> {
  // 1. Read playwright-report.json
  let report: PlaywrightReport;
  try {
    const raw = await fs.promises.readFile(REPORT_PATH, 'utf8');
    report = JSON.parse(raw) as PlaywrightReport;
  } catch (e: any) {
    if (e.code === 'ENOENT') {
      console.log('[Brain] No playwright-report.json found — skipping analysis.');
      return;
    }
    throw e;
  }

  const runId = generateRunId();
  const timestamp = new Date().toISOString();

  // 2. Flatten all suites into normalized entries
  const entries = flattenSuites(report.suites ?? []);

  // 3. Read existing history and health
  const existingHistory = await readHistory();

  // Reconstruct existing health map from history (before this run)
  const existingHealthRecords: Record<string, TestHealthEntry> = {};
  const histGroups = new Map<string, HistoryRecord[]>();
  for (const r of existingHistory) {
    const key = toHealthKey(r.test, r.project);
    if (!histGroups.has(key)) histGroups.set(key, []);
    histGroups.get(key)!.push(r);
  }
  for (const [key, records] of histGroups) {
    const failed = records.filter(r => r.status === 'failed');
    const score = Math.round((failed.length / records.length) * 100) / 100;
    let consecutivePasses = 0;
    for (let i = records.length - 1; i >= 0; i--) {
      if (records[i].status === 'passed') consecutivePasses++;
      else break;
    }
    const lastFailure =
      [...failed].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0] ?? null;
    const status =
      score >= 0.5 && consecutivePasses < 5
        ? 'quarantined'
        : score < 0.2 || consecutivePasses >= 5
        ? 'healthy'
        : 'watch';
    existingHealthRecords[key] = {
      flakiness_score: score,
      runs_analyzed: records.length,
      consecutive_passes: consecutivePasses,
      status,
      last_category: lastFailure?.category ?? null,
      last_failure_timestamp: lastFailure?.timestamp ?? null,
      last_error_snippet: lastFailure?.error_snippet ?? null,
    };
  }

  // 4. Classify failures
  const classifications = new Map<string, FailureCategory>();
  const failedEntries = entries.filter(e => e.status === 'failed');
  for (const entry of failedEntries) {
    const category = classifyFailure({
      entry,
      allEntriesThisRun: entries,
      currentHealth: existingHealthRecords,
    });
    classifications.set(`${entry.testName}|||${entry.project}`, category);
  }

  // 5. Build HistoryRecord[] for this run
  const currentRunRecords: HistoryRecord[] = entries.map(entry => {
    const category = classifications.get(`${entry.testName}|||${entry.project}`) ?? null;
    const errorSnippet = entry.errorMessage
      ? entry.errorMessage.slice(0, 200)
      : null;
    return {
      run_id: runId,
      timestamp,
      test: entry.testName,
      project: entry.project,
      status: entry.status,
      category,
      retry_passed: entry.retryPassed,
      duration_ms: entry.durationMs,
      error_snippet: errorSnippet,
    };
  });

  // 6. Append to run-history.ndjson
  await appendHistory(currentRunRecords);

  // 7. Compute and write health
  const allHistory = [...existingHistory, ...currentRunRecords];
  const healthFile = computeHealth(allHistory, runId, timestamp, currentRunRecords);
  await writeHealth(healthFile);

  // 8. Print summary
  const blockingCount = healthFile.summary.quarantined_blocking;
  printSummary(runId, entries, classifications, healthFile.tests, blockingCount);
}

if (require.main === module) {
  runBrainAnalysis().catch(err => {
    console.error('Brain analysis failed:', err);
    process.exit(1);
  });
}
