import { FailureCategory, RuleContext } from './types';

// Health key: "rooftop-solar-section-snapshots-section-portfolio-mobile-safari"
export function toHealthKey(testName: string, project: string): string {
  return `${testName}-${project}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Rule 1 — FLAKY (highest priority)
function ruleFlaky({ entry }: RuleContext): FailureCategory | null {
  return entry.retryPassed ? 'FLAKY' : null;
}

// Rule 2 — INFRA
function ruleInfra({ allEntriesThisRun }: RuleContext): FailureCategory | null {
  const timeouts = allEntriesThisRun.filter(
    e =>
      e.status === 'failed' &&
      /Timeout|navigationTimeout|TimeoutError/i.test(e.errorMessage ?? '')
  );
  return timeouts.length >= 3 ? 'INFRA' : null;
}

// Rule 3 — REAL_REGRESSION
function ruleRealRegression({
  entry,
  allEntriesThisRun,
  currentHealth,
}: RuleContext): FailureCategory | null {
  const projects = ['chromium-desktop', 'mobile-chrome', 'mobile-safari'];
  const allFailed = projects.every(p =>
    allEntriesThisRun.some(
      e => e.testName === entry.testName && e.project === p && e.status === 'failed'
    )
  );
  const score =
    currentHealth[toHealthKey(entry.testName, entry.project)]?.flakiness_score ?? 0;
  return allFailed && !entry.retryPassed && score < 0.3 ? 'REAL_REGRESSION' : null;
}

// Rule 4 — SELECTOR_BROKEN
function ruleSelectorBroken({ entry }: RuleContext): FailureCategory | null {
  const patterns =
    /locator\.waitFor|locator returned 0 elements|strict mode violation|Target closed/i;
  return entry.errorMessage && patterns.test(entry.errorMessage) ? 'SELECTOR_BROKEN' : null;
}

// Rule 5 — THRESHOLD_DRIFT
function ruleThresholdDrift({ entry, currentHealth }: RuleContext): FailureCategory | null {
  const isVisualFail = /toHaveScreenshot|Screenshot comparison failed/i.test(
    entry.errorMessage ?? ''
  );
  const score =
    currentHealth[toHealthKey(entry.testName, entry.project)]?.flakiness_score ?? 0;
  return isVisualFail && !entry.retryPassed && score < 0.3 ? 'THRESHOLD_DRIFT' : null;
}

// Orchestrator — first non-null wins
export function classifyFailure(ctx: RuleContext): FailureCategory {
  return (
    ruleFlaky(ctx) ??
    ruleInfra(ctx) ??
    ruleRealRegression(ctx) ??
    ruleSelectorBroken(ctx) ??
    ruleThresholdDrift(ctx) ??
    'UNKNOWN'
  );
}
