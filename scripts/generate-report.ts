#!/usr/bin/env ts-node
/**
 * Reads per-spec Playwright JSON reports + brain test-health.json
 * and writes reports/summary.html — a self-contained shareable report.
 *
 * Usage: npx ts-node scripts/generate-report.ts
 */

import fs from 'fs';
import path from 'path';

// ── Types ────────────────────────────────────────────────────────────────────

interface Suite {
  title: string;
  file?: string;
  suites?: Suite[];
  specs?: {
    title: string;
    tests: {
      projectName: string;
      results: { status: string; duration: number; errors: { message: string }[] }[];
    }[];
  }[];
}

interface PlaywrightReport {
  suites: Suite[];
}

interface HealthEntry {
  flakiness_score: number;
  runs_analyzed: number;
  consecutive_passes: number;
  status: string;
  last_category: string | null;
}

interface HealthFile {
  last_updated: string;
  run_id: string;
  summary: { total_tests: number; passed: number; failed: number; quarantined_blocking: number };
  tests: Record<string, HealthEntry>;
}

interface TestEntry {
  testName: string;
  project: string;
  status: 'passed' | 'failed' | 'skipped';
  retryPassed: boolean;
  durationMs: number;
  errorMessage: string | null;
}

interface FailureRow {
  testName: string;
  project: string;
  category: string;
  healthStatus: string;
  flakinessScore: number;
  retryPassed: boolean;
  errorSnippet: string;
}

interface SpecSummary {
  displayName: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  failures: FailureRow[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function readJSON<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8')) as T;
  } catch {
    return null;
  }
}

function toHealthKey(testName: string, project: string): string {
  return `${testName}-${project}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function flattenSuites(suites: Suite[], parentTitles: string[] = [], skipFileTitle = true): TestEntry[] {
  const entries: TestEntry[] = [];
  for (const suite of suites) {
    const titles =
      suite.file !== undefined && skipFileTitle
        ? [...parentTitles]
        : [...parentTitles, suite.title].filter(Boolean);
    if (suite.specs) {
      for (const spec of suite.specs) {
        for (const test of spec.tests) {
          const results = test.results;
          if (!results.length) continue;
          const first = results[0];
          const last = results[results.length - 1];
          const retryPassed = results.length > 1 && last.status === 'passed' && first.status !== 'passed';
          const failedResult = results.find(r => r.status !== 'passed') ?? first;
          const errorMessage = failedResult.errors.length
            ? failedResult.errors.map(e => e.message).join('\n')
            : null;
          let status: 'passed' | 'failed' | 'skipped';
          if (last.status === 'passed') status = 'passed';
          else if (last.status === 'skipped') status = 'skipped';
          else status = 'failed';
          entries.push({
            testName: [...titles, spec.title].join(' › '),
            project: test.projectName,
            status,
            retryPassed,
            durationMs: results.reduce((s, r) => s + r.duration, 0),
            errorMessage,
          });
        }
      }
    }
    if (suite.suites) entries.push(...flattenSuites(suite.suites, titles, false));
  }
  return entries;
}

// ── Report generation ────────────────────────────────────────────────────────

const SPECS = [
  { name: 'homepage',            display: 'Homepage' },
  { name: 'solar-for-home',      display: 'Solar for Home' },
  { name: 'solar-for-commercial',display: 'Solar for Commercial' },
  { name: 'rooftop-solar',       display: 'Rooftop Solar' },
];

function buildSpecSummary(specName: string, displayName: string, health: HealthFile | null): SpecSummary {
  const report = readJSON<PlaywrightReport>(`reports/${specName}-report.json`);
  if (!report) {
    return { displayName, total: 0, passed: 0, failed: 0, skipped: 0, flaky: 0, failures: [] };
  }

  const entries = flattenSuites(report.suites ?? []);
  const total   = entries.length;
  const passed  = entries.filter(e => e.status === 'passed' && !e.retryPassed).length;
  const failed  = entries.filter(e => e.status === 'failed').length;
  const skipped = entries.filter(e => e.status === 'skipped').length;
  const flaky   = entries.filter(e => e.retryPassed).length;

  const failures: FailureRow[] = entries
    .filter(e => e.status === 'failed')
    .map(e => {
      const key = toHealthKey(e.testName, e.project);
      const h = health?.tests[key];
      return {
        testName: e.testName,
        project: e.project,
        category: h?.last_category ?? 'UNKNOWN',
        healthStatus: h?.status ?? 'unknown',
        flakinessScore: h?.flakiness_score ?? 0,
        retryPassed: e.retryPassed,
        errorSnippet: (e.errorMessage ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, 200),
      };
    });

  return { displayName, total, passed, failed, skipped, flaky, failures };
}

// ── HTML ─────────────────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, string> = {
  FLAKY:            '#f59e0b',
  INFRA:            '#6366f1',
  REAL_REGRESSION:  '#ef4444',
  SELECTOR_BROKEN:  '#f97316',
  THRESHOLD_DRIFT:  '#8b5cf6',
  UNKNOWN:          '#6b7280',
};

const HEALTH_COLOR: Record<string, string> = {
  quarantined: '#f59e0b',
  watch:       '#6366f1',
  healthy:     '#22c55e',
  unknown:     '#6b7280',
};

function badge(label: string, value: number | string, color: string): string {
  return `<span style="display:inline-block;padding:2px 10px;border-radius:12px;background:${color}20;color:${color};font-weight:600;font-size:13px;margin-right:6px">${label} ${value}</span>`;
}

function pill(text: string, color: string): string {
  return `<span style="display:inline-block;padding:1px 8px;border-radius:8px;background:${color}22;color:${color};font-weight:600;font-size:11px">${text}</span>`;
}

function specSection(s: SpecSummary): string {
  const allPassed = s.failed === 0;
  const borderColor = allPassed ? '#22c55e' : '#ef4444';

  const failuresHtml = s.failures.length === 0 ? '' : `
  <table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:13px">
    <thead>
      <tr style="background:#f8fafc;text-align:left">
        <th style="padding:8px 12px;border-bottom:1px solid #e2e8f0;width:45%">Test</th>
        <th style="padding:8px 12px;border-bottom:1px solid #e2e8f0">Project</th>
        <th style="padding:8px 12px;border-bottom:1px solid #e2e8f0">Rule</th>
        <th style="padding:8px 12px;border-bottom:1px solid #e2e8f0">Health</th>
        <th style="padding:8px 12px;border-bottom:1px solid #e2e8f0">Score</th>
      </tr>
    </thead>
    <tbody>
      ${s.failures.map(f => `
      <tr style="border-bottom:1px solid #f1f5f9">
        <td style="padding:8px 12px;font-family:monospace;font-size:12px;max-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${f.testName}">${f.testName}</td>
        <td style="padding:8px 12px">${pill(f.project, '#64748b')}</td>
        <td style="padding:8px 12px">${pill(f.category, CATEGORY_COLOR[f.category] ?? '#6b7280')}</td>
        <td style="padding:8px 12px">${pill(f.healthStatus, HEALTH_COLOR[f.healthStatus] ?? '#6b7280')}</td>
        <td style="padding:8px 12px;color:${f.flakinessScore >= 0.5 ? '#ef4444' : '#64748b'};font-weight:600">${(f.flakinessScore * 100).toFixed(0)}%</td>
      </tr>`).join('')}
    </tbody>
  </table>`;

  return `
  <div style="border:1px solid ${borderColor}44;border-left:4px solid ${borderColor};border-radius:8px;padding:16px 20px;margin-bottom:16px;background:#fff">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
      <h3 style="margin:0;font-size:16px;color:#1e293b">${s.displayName}</h3>
      <div>
        ${badge('Total', s.total, '#64748b')}
        ${badge('✓', s.passed, '#22c55e')}
        ${s.failed > 0 ? badge('✗', s.failed, '#ef4444') : ''}
        ${s.flaky > 0  ? badge('⚡', s.flaky,  '#f59e0b') : ''}
        ${s.skipped > 0 ? badge('⊘', s.skipped, '#94a3b8') : ''}
      </div>
    </div>
    ${failuresHtml}
  </div>`;
}

function generateHTML(summaries: SpecSummary[], health: HealthFile | null, runAt: string): string {
  const totalTests   = summaries.reduce((s, x) => s + x.total,   0);
  const totalPassed  = summaries.reduce((s, x) => s + x.passed,  0);
  const totalFailed  = summaries.reduce((s, x) => s + x.failed,  0);
  const totalSkipped = summaries.reduce((s, x) => s + x.skipped, 0);
  const totalFlaky   = summaries.reduce((s, x) => s + x.flaky,   0);
  const overallOk    = totalFailed === 0;

  const categoryLegend = Object.entries(CATEGORY_COLOR).map(
    ([cat, color]) => `<span style="margin-right:12px">${pill(cat, color)}</span>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>LG Solar 360 — Visual Test Report</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; color: #334155; }
  .wrap { max-width: 960px; margin: 0 auto; padding: 32px 20px; }
  h1 { font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 4px; }
  h2 { font-size: 15px; font-weight: 600; color: #475569; margin: 28px 0 12px; text-transform: uppercase; letter-spacing: .05em; }
  .meta { font-size: 13px; color: #94a3b8; margin-bottom: 24px; }
  .overall { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 24px; }
  .stat { flex: 1; min-width: 100px; padding: 14px 18px; border-radius: 10px; background: #fff; border: 1px solid #e2e8f0; text-align: center; }
  .stat .val { font-size: 28px; font-weight: 700; line-height: 1.1; }
  .stat .lbl { font-size: 12px; color: #94a3b8; margin-top: 2px; }
  .legend { font-size: 12px; color: #64748b; margin-bottom: 20px; }
</style>
</head>
<body>
<div class="wrap">
  <h1>LG Solar 360 — Visual Test Report</h1>
  <p class="meta">Generated ${runAt}${health ? ` &nbsp;·&nbsp; Run ID: ${health.run_id}` : ''}</p>

  <div class="overall">
    <div class="stat"><div class="val" style="color:#1e293b">${totalTests}</div><div class="lbl">Total</div></div>
    <div class="stat"><div class="val" style="color:#22c55e">${totalPassed}</div><div class="lbl">Passed</div></div>
    <div class="stat"><div class="val" style="color:${totalFailed > 0 ? '#ef4444' : '#22c55e'}">${totalFailed}</div><div class="lbl">Failed</div></div>
    <div class="stat"><div class="val" style="color:#f59e0b">${totalFlaky}</div><div class="lbl">Flaky</div></div>
    <div class="stat"><div class="val" style="color:#94a3b8">${totalSkipped}</div><div class="lbl">Skipped</div></div>
    <div class="stat" style="border-color:${overallOk ? '#22c55e' : '#ef4444'}44">
      <div class="val" style="color:${overallOk ? '#22c55e' : '#ef4444'}">${overallOk ? '✓' : '✗'}</div>
      <div class="lbl">${overallOk ? 'All Pass' : 'Has Failures'}</div>
    </div>
  </div>

  <h2>Results by Spec</h2>
  ${summaries.map(specSection).join('\n')}

  <h2>Rule Engine Legend</h2>
  <div class="legend">${categoryLegend}</div>
  <div class="legend" style="margin-top:6px">
    ${Object.entries(HEALTH_COLOR).map(([s, c]) => `<span style="margin-right:12px">${pill(s, c)}</span>`).join('')}
    &nbsp;— health status based on flakiness score across all runs
  </div>
</div>
</body>
</html>`;
}

// ── Main ─────────────────────────────────────────────────────────────────────

const health = readJSON<HealthFile>('reports/test-health.json');
const runAt  = new Date().toUTCString();
const summaries = SPECS.map(s => buildSpecSummary(s.name, s.display, health));
const html = generateHTML(summaries, health, runAt);

const outPath = path.resolve('reports/summary.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log(`[report] Written → ${outPath}`);

const total  = summaries.reduce((s, x) => s + x.total,  0);
const failed = summaries.reduce((s, x) => s + x.failed, 0);
console.log(`[report] ${total} tests  |  ${failed} failed`);
