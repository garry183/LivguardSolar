// Playwright report shapes
export interface PlaywrightReport {
  suites: Suite[];
  stats: PlaywrightStats;
}

export interface PlaywrightStats {
  expected: number;
  unexpected: number;
  flaky: number;
  skipped: number;
  duration: number;
}

export interface Suite {
  title: string;
  file?: string;
  suites?: Suite[];
  specs?: Spec[];
}

export interface Spec {
  title: string;
  ok: boolean;
  tests: Test[];
}

export interface Test {
  projectName: string;
  results: TestResult[];
  status: 'expected' | 'unexpected' | 'flaky' | 'skipped';
}

export interface TestResult {
  status: 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted';
  duration: number;
  retry: number;
  errors: Array<{ message: string }>;
  startTime: string;
}

// Brain domain
export type FailureCategory =
  | 'FLAKY'
  | 'INFRA'
  | 'REAL_REGRESSION'
  | 'SELECTOR_BROKEN'
  | 'THRESHOLD_DRIFT'
  | 'UNKNOWN';

export type QuarantineStatus = 'quarantined' | 'healthy' | 'watch';

// Normalized flat entry (one test × one project)
export interface NormalizedTestEntry {
  testName: string;      // full title e.g. "Rooftop Solar – Section snapshots › section – portfolio"
  project: string;       // e.g. "mobile-safari"
  status: 'passed' | 'failed' | 'skipped';
  retryPassed: boolean;  // first attempt failed, last attempt passed
  durationMs: number;
  errorMessage: string | null;
  startTime: string;
}

// One line in run-history.ndjson
export interface HistoryRecord {
  run_id: string;
  timestamp: string;
  test: string;
  project: string;
  status: 'passed' | 'failed' | 'skipped';
  category: FailureCategory | null;
  retry_passed: boolean;
  duration_ms: number;
  error_snippet: string | null;
}

// One entry in test-health.json tests map
export interface TestHealthEntry {
  flakiness_score: number;
  runs_analyzed: number;
  consecutive_passes: number;
  status: QuarantineStatus;
  last_category: FailureCategory | null;
  last_failure_timestamp: string | null;
  last_error_snippet: string | null;
}

export interface TestHealthFile {
  last_updated: string;
  run_id: string;
  summary: {
    total_tests: number;
    passed: number;
    failed: number;
    quarantined_blocking: number;
  };
  tests: Record<string, TestHealthEntry>;
}

export interface RuleContext {
  entry: NormalizedTestEntry;
  allEntriesThisRun: NormalizedTestEntry[];
  currentHealth: Record<string, TestHealthEntry>;
}
