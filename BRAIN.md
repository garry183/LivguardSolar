# Brain Layer — Explained

> A post-run intelligence layer that reads Playwright test output, classifies every failure using 5 deterministic rules, and maintains a persistent health score for every test. No database, no external APIs — just two plain files committed to git.

---

## The problem it solves

Playwright tells you a test **failed**. It does not tell you:

- Did it fail because of a flaky animation, or did the UI genuinely break?
- Is this test always flaky on mobile? (i.e. should it block the build?)
- Did the same failure happen across all three browsers, or just one?
- Has this test been silently drifting for weeks?

Without answers to these questions, every failure looks the same — and teams either over-react (block everything) or under-react (ignore failures). The brain layer answers these questions automatically after every run.

---

## How it works — the full pipeline

```
npx playwright test
        │
        ▼
reports/playwright-report.json   ← Playwright JSON reporter writes this
        │
        ▼
brain/analyze.ts                 ← runs automatically via global-teardown
   │
   ├─ flatten all suites → one entry per (test × browser)
   ├─ read existing run-history.ndjson
   ├─ for each failed test → run 5 classification rules
   ├─ append this run to run-history.ndjson
   ├─ recompute test-health.json
   └─ print structured summary to console
        │
        ▼
  reports/
    run-history.ndjson    ← append-only log, one JSON line per (test × browser × run)
    test-health.json      ← current snapshot of every test's health score
```

Everything is plain files. No database. No server. Both files are committed to git so the history survives across machines and CI runs.

---

## The 5 classification rules

When a test fails, the brain applies these rules **in order**. The first one that matches wins.

### Rule 1 — FLAKY

**Condition:** The test failed on the first attempt but passed on a retry.

**What it means:** The test itself is unreliable — an animation wasn't fully frozen, a lazy-loaded section hadn't appeared, or there was a race condition. The UI is fine.

**Action:** Mark as FLAKY. Does not block the build if the test is quarantined.

---

### Rule 2 — INFRA

**Condition:** 3 or more tests in the same run failed with timeout-related errors (`Timeout`, `navigationTimeout`, `TimeoutError`).

**What it means:** The problem is not the UI — it's the network, the test runner, or the target environment. If 3+ tests are all timing out, the site was probably slow or briefly unreachable.

**Action:** Mark all timeout failures as INFRA. These should not trigger UI alerts.

---

### Rule 3 — REAL_REGRESSION

**Condition:** The same test failed across **all three browsers** (`chromium-desktop`, `mobile-chrome`, `mobile-safari`) AND it did not pass on retry AND its historical flakiness score is below 0.3 (i.e. it has been reliable in the past).

**What it means:** A genuine UI change broke a stable test on every platform simultaneously. This is the most important signal — a developer changed something that visually broke the page.

**Action:** Mark as REAL_REGRESSION. Always blocks the build.

---

### Rule 4 — SELECTOR_BROKEN

**Condition:** The error message contains `locator.waitFor`, `locator returned 0 elements`, `strict mode violation`, or `Target closed`.

**What it means:** The test's page-object selector no longer matches anything on the page. The element was probably renamed, restructured, or removed from the DOM. The test code is broken, not the UI.

**Action:** Mark as SELECTOR_BROKEN. A developer needs to update the test's locator.

---

### Rule 5 — THRESHOLD_DRIFT

**Condition:** The error message mentions `toHaveScreenshot` or `Screenshot comparison failed` AND the test did not retry-pass AND its flakiness score is below 0.3.

**What it means:** The visual snapshot no longer matches the baseline. This is a genuine visual change — either intentional (a redesign) or unintentional (a regression). Because it's a stable test (low flakiness), this isn't noise.

**Action:** Mark as THRESHOLD_DRIFT. Either update the baseline (`npm run test:update-snapshots`) or investigate the change.

---

### Fallback — UNKNOWN

If none of the 5 rules match, the failure is categorised as `UNKNOWN`. This is the designed extension point for future AI analysis (e.g. Gemini/Claude can be dropped in here to reason about the error message and screenshot diff).

---

## Health scoring

Every test gets a **flakiness score** — a number between 0.0 and 1.0.

```
flakiness_score = (number of failed runs) / (total runs recorded)
```

Based on the score and the number of consecutive passes at the end of history, each test is assigned a **status**:

| Status | Condition | Meaning |
|---|---|---|
| `healthy` | score < 0.2 OR last 5+ runs all passed | Reliable. Failures block the build. |
| `watch` | score 0.2–0.49 | Mildly unreliable. Failures still block, but it's being watched. |
| `quarantined` | score ≥ 0.5 AND fewer than 5 consecutive passes | Consistently flaky. Failures do **not** block the build. |

A quarantined test stops blocking CI automatically — no manual config file needed. It un-quarantines itself once it passes 5 runs in a row.

---

## The two output files

### `reports/run-history.ndjson`

Newline-delimited JSON. One line per (test × browser × run). Append-only — lines are never deleted.

```json
{"run_id":"run-20260409124242-41l9","timestamp":"2026-04-09T12:42:42Z","test":"Rooftop Solar – Section snapshots › section – portfolio","project":"mobile-safari","status":"failed","category":"FLAKY","retry_passed":true,"duration_ms":4821,"error_snippet":"Screenshot comparison failed..."}
```

This is the raw material for all health computations. Over time it becomes a full audit trail of every test result.

### `reports/test-health.json`

A JSON snapshot rewritten after every run. Contains the current health of every test.

```json
{
  "last_updated": "2026-04-09T12:42:42Z",
  "run_id": "run-20260409124242-41l9",
  "summary": {
    "total_tests": 45,
    "passed": 40,
    "failed": 5,
    "quarantined_blocking": 2
  },
  "tests": {
    "rooftop-solar-section-snapshots-section-portfolio-mobile-safari": {
      "flakiness_score": 0.7,
      "runs_analyzed": 10,
      "consecutive_passes": 0,
      "status": "quarantined",
      "last_category": "FLAKY",
      "last_failure_timestamp": "2026-04-09T12:42:42Z",
      "last_error_snippet": "Screenshot comparison failed..."
    }
  }
}
```

---

## Console summary (printed after every run)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  BRAIN ANALYSIS — run-20260409124242-41l9
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Total : 45  |  Passed : 40  |  Failed : 5
  Blocking : 2  |  Quarantined : 3

  FAILURES:
  [FLAKY]            rooftop-solar-portfolio    mobile-safari      score:0.70  QUARANTINED
  [REAL_REGRESSION]  homepage-hero              chromium-desktop   score:0.10  BLOCKING
  [THRESHOLD_DRIFT]  solar-for-home-stats       mobile-chrome      score:0.05  BLOCKING

  Health : reports/test-health.json
  History: reports/run-history.ndjson
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Blocking** = a healthy/watch test that failed → needs attention.
**Quarantined** = a known-flaky test that failed → noted but ignored by CI.

---

## What the brain does NOT do

- It does not change any test code.
- It does not retry tests.
- It does not send notifications.
- It does not require any API key or internet connection.
- It has no opinion on whether a visual diff is "acceptable" — that's still a human decision when updating baselines.

---

## Architecture decisions

**Why plain files instead of a database?**
The history and health files are committed to git. This means:
- Every developer has the full history locally after `git pull`.
- CI always starts with the current health state — no cold-start problem.
- The history is auditable: `git log reports/run-history.ndjson` shows exactly when the file changed.
- Zero infrastructure to maintain.

**Why rules instead of AI?**
Rules are deterministic, fast, free, and explainable. Every classification can be traced to an exact condition. AI analysis is reserved for the `UNKNOWN` category — the one case where a human-readable description genuinely helps.

**Why is the brain separate from the test code?**
The brain reads the JSON report that Playwright produces. It touches zero test files. This means you can change, delete, or completely rewrite tests without ever touching the brain, and you can upgrade the brain independently.
