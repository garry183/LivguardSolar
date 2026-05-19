# Lighthouse CI & Performance Testing Reference

A complete reference for the Lighthouse CI + k6 load testing setup in this repo.

---

## Table of Contents

1. [What This Does](#what-this-does)
2. [Files Overview](#files-overview)
3. [How It Works — Lighthouse CI](#how-it-works--lighthouse-ci)
4. [How It Works — k6 Load Testing](#how-it-works--k6-load-testing)
5. [Running Locally](#running-locally)
6. [CI Pipeline](#ci-pipeline)
7. [Slack Report](#slack-report)
8. [Understanding the Results](#understanding-the-results)
9. [Google Core Web Vitals Targets](#google-core-web-vitals-targets)
10. [Baseline Scores (May 2026)](#baseline-scores-may-2026)
11. [Required Environment Variables](#required-environment-variables)
12. [Known Bugs & Gotchas](#known-bugs--gotchas)
13. [Future Improvements](#future-improvements)

---

## What This Does

Two separate performance tools, two separate purposes:

| Tool | Purpose | When It Runs | Fails Build? |
|------|---------|--------------|--------------|
| **Lighthouse CI** | Measures real-user UX — Core Web Vitals, performance score, accessibility, SEO | Every commit (default pipeline) | Never — warn only |
| **k6** | Measures server capacity under concurrent load — can the server handle 50 users at once? | Manual trigger only | Only if thresholds are breached |

**Important:** Both tools run in this automation framework repo (`livguardsolar360`) and test the **staging URL** (`https://stage.livguardsolar.com`). This is post-commit monitoring, not a pre-deployment gate. To make it a true gate, these steps would need to move to the website repo's pipeline.

---

## Files Overview

```
livguardsolar360/
├── lighthouserc.js                        # Lighthouse CI configuration
├── tests/
│   └── performance/
│       └── load.k6.js                     # k6 load test script
├── scripts/
│   └── lighthouse-slack-report.js         # Posts results table to Slack after CI run
└── bitbucket-pipelines.yml                # Lighthouse step (default) + k6 (manual custom)
```

**Modified files:**
- `package.json` — added `@lhci/cli ^0.14.0` devDependency + two npm scripts
- `bitbucket-pipelines.yml` — added Lighthouse CI step to default pipeline + `load-test` custom pipeline

---

## How It Works — Lighthouse CI

Lighthouse CI (lhci) automates running Google Lighthouse against real pages and storing/comparing results over time.

### What it measures
- **Performance Score** — composite score (0–1) of all performance metrics
- **Largest Contentful Paint (LCP)** — how long until the main content is visible
- **First Contentful Paint (FCP)** — how long until any content appears
- **Total Blocking Time (TBT)** — how long the main thread is blocked from responding to user input
- **Cumulative Layout Shift (CLS)** — how much the page layout shifts unexpectedly during load
- **Time to Interactive (TTI)** — how long until the page is fully interactive

### Config (`lighthouserc.js`)

```js
module.exports = {
  ci: {
    collect: {
      url: [   // NOTE: 'url' singular — 'urls' plural is silently ignored (lhci bug)
        `${process.env.STAGING_URL}/`,
        `${process.env.STAGING_URL}/rooftop-solar`,
        `${process.env.STAGING_URL}/solar-for-home`,
        `${process.env.STAGING_URL}/solar-for-commercial`,
      ],
      numberOfRuns: 5,           // runs Lighthouse 5 times per page, uses the median
      settings: {
        chromeFlags: '--no-sandbox --disable-dev-shm-usage',  // required inside Docker
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      },
    },
    assert: {
      // No preset — 'lighthouse:no-pwa' injects dozens of hard-fail assertions
      assertions: {
        'categories:performance':   ['warn', { minScore: 0.7 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'first-contentful-paint':   ['warn', { maxNumericValue: 1800 }],
        'cumulative-layout-shift':  ['warn', { maxNumericValue: 0.1 }],
        'total-blocking-time':      ['warn', { maxNumericValue: 200 }],
        'interactive':              ['warn', { maxNumericValue: 3800 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',   // free, Google-hosted, links valid for 7 days
    },
  },
};
```

### Why `numberOfRuns: 5`?
Network conditions and CPU vary run-to-run. Taking the median of 5 runs is 2× more stable than 3. The first run is always slower (cold start). Never use 1 run for a meaningful result.

### Why `warn` not `error`?
All assertions are `warn` so the build **never fails** due to performance. This is monitoring, not a gate. You want the build to always pass so you can see trends over time — not block deploys over metrics that are already known to be poor.

---

## How It Works — k6 Load Testing

k6 simulates multiple users hitting the site simultaneously and measures how the server holds up under load.

### What it measures
- **p95 response time** — 95% of requests complete within this time (more meaningful than average)
- **Error rate** — percentage of requests that fail (non-200 or timeout)
- **Throughput** — requests per second at peak load

### Script (`tests/performance/load.k6.js`)

```js
export const options = {
  stages: [
    { duration: '2m', target: 20 },   // ramp from 0 → 20 concurrent users over 2 minutes
    { duration: '5m', target: 50 },   // hold at 50 concurrent users for 5 minutes
    { duration: '2m', target: 0 },    // ramp back down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<750'], // 95% of requests must complete in under 750ms
    errors: ['rate<0.01'],            // less than 1% error rate
  },
};
```

**Total test duration: 9 minutes** (2 + 5 + 2)

### Why 50 Virtual Users (VUs)?
For a B2C marketing site, 50 concurrent users represents realistic peak traffic. The goal is to confirm the server doesn't degrade significantly — not to find the absolute breaking point.

### Why p95 < 750ms?
Industry standard for marketing/brochure sites. The 95th percentile (p95) is the right threshold — the average is skewed by fast cached requests and hides slow outliers.

### Why `sleep(1)` in the test function?
k6 without a sleep will fire requests as fast as possible, creating an artificial spike that no real user generates. The 1-second think time simulates a real user who spends a moment on the page between navigations.

---

## Running Locally

### Lighthouse CI

```bash
# Install once (if not already installed)
npm install

# Run against staging
STAGING_URL=https://stage.livguardsolar.com npm run perf:lighthouse

# Run with only 1 run (faster, for debugging)
STAGING_URL=https://stage.livguardsolar.com npx lhci autorun --collect.numberOfRuns=1
```

Results land in `.lighthouseci/` — a set of `lhr-*.json` files (one per page per run).

### Slack Report (after running Lighthouse locally)

```bash
STAGING_URL=https://stage.livguardsolar.com \
SLACK_WEBHOOK_URL=<your-webhook-url> \
npm run perf:slack-report
```

### k6 Load Test

k6 must be installed separately — it does not use Node.js.

**Option A — Install k6 (Windows):**
```
winget install GrafanaLabs.k6
```

**Option B — Run via Docker:**
```bash
docker run --rm -e STAGING_URL=https://stage.livguardsolar.com \
  grafana/k6 run - < tests/performance/load.k6.js
```

**Run the test:**
```bash
k6 run --env STAGING_URL=https://stage.livguardsolar.com tests/performance/load.k6.js
```

**Quick smoke test (1 VU, 30 seconds — no staging load):**
```bash
k6 run --env STAGING_URL=https://stage.livguardsolar.com \
  --vus 1 --duration 30s tests/performance/load.k6.js
```

---

## CI Pipeline

### Lighthouse CI — runs on every push

Defined in `bitbucket-pipelines.yml` as the third step in the default pipeline:

```yaml
- step:
    name: Lighthouse CI
    image: patrickhulce/lhci-client:latest   # has Chromium + lhci pre-installed
    size: 2x
    script:
      - lhci autorun
      - node scripts/lighthouse-slack-report.js
    artifacts:
      - .lighthouseci/**
```

**Why `patrickhulce/lhci-client`?** It's the official LHCI Docker image. It has Chromium and the `lhci` binary pre-installed. No `npm ci` needed in this step, no Chrome binary path hacks, no `--cap-add=SYS_ADMIN` needed (handled by `--no-sandbox` in the config).

**Duration:** ~10–15 minutes (5 runs × 4 pages, sequential)

### k6 — manual trigger only

Triggered from Bitbucket → Pipelines → Run pipeline → select `load-test`.

```yaml
custom:
  load-test:
    - step:
        name: k6 Load Test (Manual)
        image: grafana/k6:latest
        script:
          - k6 run --env STAGING_URL=$STAGING_URL --summary-export=k6-summary.json tests/performance/load.k6.js
        artifacts:
          - k6-summary.json
```

The `k6-summary.json` artifact contains all thresholds pass/fail and raw p50/p95/p99 numbers. Download it from the pipeline artifacts after the run.

---

## Slack Report

After every Lighthouse CI run, `scripts/lighthouse-slack-report.js` automatically posts a table to Slack.

### What it posts

```
Lighthouse CI — Build #42 `master`
┌────────────────────────┬────────────────────────────┬────────────────────────┬─────────────────────────────┐
│ Page                   │ Metric                     │ Actual Result          │ Google Recommendation       │
├────────────────────────┼────────────────────────────┼────────────────────────┼─────────────────────────────┤
│ homepage               │ Performance Score          │ 0.47 ⚠️               │ 0.9 or above                │
│                        │ Largest Contentful Paint   │ 7.9 seconds ⚠️        │ 2.5 seconds or under        │
│                        │ First Contentful Paint     │ 3.4 seconds ⚠️        │ 1.8 seconds or under        │
│                        │ Total Blocking Time        │ 876 milliseconds ⚠️   │ 200 milliseconds or under   │
│                        │ Cumulative Layout Shift    │ Within target ✅       │ 0.1 or under                │
├────────────────────────┼────────────────────────────┼────────────────────────┼─────────────────────────────┤
│ rooftop-solar          │ ...                        │ ...                    │ ...                         │
└────────────────────────┴────────────────────────────┴────────────────────────┴─────────────────────────────┘

Full reports:
homepage: https://storage.googleapis.com/lighthouse-infrastructure.appspot.com/...
```

### How it works internally
1. Reads all `lhr-*.json` files from `.lighthouseci/`
2. Groups by URL (multiple runs per page)
3. Picks the **median run** per page (sorted by performance score)
4. Builds the ASCII table
5. Posts via Slack Incoming Webhook as plain text (not Block Kit — Block Kit fails for large table content)

### The report never fails the build
The script exits with code `0` even on error — a Slack notification failure should never block a deploy.

---

## Understanding the Results

### Reading lhci output in the pipeline log

```
Collecting results... (this takes a few minutes)
  Navigating to https://stage.livguardsolar.com/ (1/5)...
  Navigating to https://stage.livguardsolar.com/ (2/5)...
  ...

Assertion results for https://stage.livguardsolar.com/:
  ✖  `largest-contentful-paint` failure for `maxNumericValue` assertion
     expected: <=2500  actual: 7891
     [WARN] ...
```

A `[WARN]` line means the metric is outside the Google target. It does **not** fail the step. Look for `[ERROR]` lines if you ever want to understand why a build fails (there shouldn't be any with the current warn-only setup).

### Reading lhr-*.json files

Each file is a full Lighthouse Report JSON. Key paths:
```
lhr.categories.performance.score         → performance score (0–1)
lhr.audits['largest-contentful-paint'].numericValue  → LCP in milliseconds
lhr.audits['first-contentful-paint'].numericValue    → FCP in milliseconds
lhr.audits['total-blocking-time'].numericValue       → TBT in milliseconds
lhr.audits['cumulative-layout-shift'].numericValue   → CLS (unitless)
lhr.finalUrl                                          → actual URL tested
```

### Reading k6 summary output

```
scenarios: (100.00%) 1 scenario, 50 max VUs, 9m30s max duration
default: Up to 50 looping VUs for 9m0s over 3 stages

✓ status 200
✓ response < 750ms

checks.........................: 98.45% ✓ 5921  ✗ 92
data_received..................: 142 MB 263 kB/s
http_req_duration..............: avg=312ms  min=89ms   med=278ms   max=2.1s  p(90)=601ms p(95)=728ms
http_req_failed................: 0.00%  ✓ 0     ✗ 6013

✓ errors.....................: 0.00%  < 1%
✓ http_req_duration..........: p(95)=728ms < 750ms
```

`p(95)` is the most important number. If it's under 750ms, staging holds up under 50 concurrent users.

---

## Google Core Web Vitals Targets

These are Google's recommended thresholds as of 2025 (measured at p75 of real-user data):

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| **Performance Score** | ≥ 0.9 | 0.5 – 0.9 | < 0.5 |
| **Largest Contentful Paint (LCP)** | ≤ 2.5s | 2.5s – 4.0s | > 4.0s |
| **First Contentful Paint (FCP)** | ≤ 1.8s | 1.8s – 3.0s | > 3.0s |
| **Total Blocking Time (TBT)** | ≤ 200ms | 200ms – 600ms | > 600ms |
| **Cumulative Layout Shift (CLS)** | ≤ 0.1 | 0.1 – 0.25 | > 0.25 |
| **Time to Interactive (TTI)** | ≤ 3.8s | 3.8s – 7.3s | > 7.3s |

**Why do these matter?** Google uses Core Web Vitals as a ranking signal. Poor scores = lower search ranking. LCP is the most impactful for marketing sites.

---

## Baseline Scores (May 2026)

Measured against `https://stage.livguardsolar.com`, 1 run, May 19 2026.

| Page | Performance | LCP | FCP | TBT | CLS | Status |
|------|-------------|-----|-----|-----|-----|--------|
| homepage | 0.47 | 7.9s | 3.4s | 876ms | 0.005 | All metrics in red |
| rooftop-solar | 0.56 | 6.6s | 5.1s | 317ms | 0.065 | Better but still poor |
| solar-for-home | **0.12** | **16.7s** | **12.1s** | **819ms** | **0.87** | Critical — CLS 0.87 is severe |
| solar-for-commercial | 0.26 | 23.7s | 6.4s | 4,472ms | 0.000 | TBT 4.4 seconds is critical |

**Biggest wins available:**

- `solar-for-home` CLS 0.87 — something is shifting dramatically during load. Reserve space for images and lazy-loaded content.
- `solar-for-commercial` TBT 4,472ms — heavy JavaScript blocking the main thread for 4+ seconds. Defer or split JS bundles.
- All pages: LCP > 6s — hero images likely not preloaded. Add `<link rel="preload">` for above-the-fold images.

---

## Required Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `STAGING_URL` | Bitbucket repo variable | Base URL for all Lighthouse + k6 tests (e.g. `https://stage.livguardsolar.com`) |
| `SLACK_WEBHOOK_URL` | Bitbucket repo variable (secured) | Slack Incoming Webhook URL for posting results |

Both are already configured in Bitbucket repo settings.

For local runs, set them inline:
```bash
STAGING_URL=https://stage.livguardsolar.com SLACK_WEBHOOK_URL=... npm run perf:lighthouse
```

Or add to your local `.env` (already done — see `.env` in repo root, not committed).

---

## Known Bugs & Gotchas

These were all discovered during the initial setup. Do not repeat these mistakes.

### 1. `url` not `urls` in `lighthouserc.js`

lhci reads `ciConfiguration.collect.url` (singular). If you write `urls:` (plural), it is **silently ignored** — lhci falls through to `findBuildDir()` and errors with:

```
Unable to automatically determine the location of static site files
```

Always use `url:` (singular).

### 2. Never use `preset: 'lighthouse:no-pwa'`

The preset injects dozens of assertions at `error` level (color-contrast, errors-in-console, is-crawlable, third-party-cookies, etc.) on top of your explicit assertions. These will all hard-fail the step. If you want warn-only behaviour, remove the preset entirely and define only your own explicit assertions.

### 3. `filesystem` upload target is not supported

The only supported targets are `temporary-public-storage` (free, Google-hosted, 7-day links) and a self-hosted LHCI server. Using `filesystem` throws an error.

### 4. `manifest.json` does not exist with `temporary-public-storage`

When using `temporary-public-storage`, lhci writes result files as `lhr-*.json` in `.lighthouseci/`. There is no `manifest.json`. If your Slack script or any other script tries to read `manifest.json`, it will fail. Always read `lhr-*.json` directly.

### 5. Slack Block Kit fails for large table content

Sending a large ASCII table inside a Block Kit `{ blocks: [{ type: "section", text: { type: "mrkdwn", text: "..." } }] }` payload returns HTTP 400 `invalid_blocks`. Use the simple `{ text: "..." }` payload instead. It renders code blocks correctly in Slack.

---

## Future Improvements

| Improvement | Effort | Value |
|-------------|--------|-------|
| Move Lighthouse CI to the **website repo** for true pre-deploy gate | Medium | High — currently runs on test framework commits, not website deploys |
| **LHCI Server** (self-hosted on Railway/Render) | Medium | Persistent dashboard + historical trend graphs |
| **k6 browser module** — run real browser under load to get Core Web Vitals under concurrency | Medium | Shows how LCP/CLS degrade under 50 concurrent users (not just server response time) |
| Fix `solar-for-home` CLS (currently 0.87 — critical) | Low-Medium | Biggest SEO ranking impact |
| Preload hero images on all 4 pages | Low | Immediate LCP improvement across all pages |
| Defer/split JavaScript on `solar-for-commercial` | Medium | TBT currently 4,472ms — needs JS audit |
