import fs from 'fs';
import path from 'path';
import { HistoryRecord, QuarantineStatus, TestHealthEntry, TestHealthFile } from './types';
import { toHealthKey } from './rules';

const HEALTH_PATH = path.resolve(__dirname, '..', 'reports', 'test-health.json');

function deriveStatus(score: number, consecutivePasses: number): QuarantineStatus {
  if (score >= 0.5 && consecutivePasses < 5) return 'quarantined';
  if (score < 0.2 || consecutivePasses >= 5) return 'healthy';
  return 'watch';
}

export function computeHealth(
  allHistory: HistoryRecord[],
  runId: string,
  timestamp: string,
  currentRunRecords: HistoryRecord[]
): TestHealthFile {
  // Group all history by health key
  const groups = new Map<string, HistoryRecord[]>();
  for (const r of allHistory) {
    const key = toHealthKey(r.test, r.project);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const tests: Record<string, TestHealthEntry> = {};
  for (const [key, records] of groups) {
    const failed = records.filter(r => r.status === 'failed');
    const score = Math.round((failed.length / records.length) * 100) / 100;
    // consecutive passes from the end
    let consecutivePasses = 0;
    for (let i = records.length - 1; i >= 0; i--) {
      if (records[i].status === 'passed') consecutivePasses++;
      else break;
    }
    const lastFailure =
      [...failed].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0] ?? null;
    tests[key] = {
      flakiness_score: score,
      runs_analyzed: records.length,
      consecutive_passes: consecutivePasses,
      status: deriveStatus(score, consecutivePasses),
      last_category: lastFailure?.category ?? null,
      last_failure_timestamp: lastFailure?.timestamp ?? null,
      last_error_snippet: lastFailure?.error_snippet ?? null,
    };
  }

  const currentFailed = currentRunRecords.filter(r => r.status === 'failed');
  const blockingFailed = currentFailed.filter(r => {
    const key = toHealthKey(r.test, r.project);
    return tests[key]?.status !== 'quarantined';
  });

  return {
    last_updated: timestamp,
    run_id: runId,
    summary: {
      total_tests: currentRunRecords.length,
      passed: currentRunRecords.filter(r => r.status === 'passed').length,
      failed: currentFailed.length,
      quarantined_blocking: blockingFailed.length,
    },
    tests,
  };
}

export async function writeHealth(file: TestHealthFile): Promise<void> {
  await fs.promises.writeFile(HEALTH_PATH, JSON.stringify(file, null, 2), 'utf8');
}
