'use strict';

const fs    = require('fs');
const path  = require('path');
const https = require('https');

const PLAYWRIGHT_REPORT = path.join(process.cwd(), 'reports', 'playwright-report.json');
const HEALTH_PATH       = path.join(process.cwd(), 'reports', 'test-health.json');
const WEBHOOK           = process.env.SLACK_WEBHOOK_URL;

// Mirrors brain/rules.ts toHealthKey
function toHealthKey(testName, project) {
  return `${testName}-${project}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function shortName(testName) {
  // "Describe › section – hero"  →  "section – hero"
  const parts = testName.split('›');
  return parts[parts.length - 1].trim();
}

function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

// ── flatten playwright-report.json suites ─────────────────────────────────────
function flattenSuites(suites, parentTitles = [], skipFileTitle = true) {
  const entries = [];
  for (const suite of suites) {
    const titles = suite.file !== undefined && skipFileTitle
      ? [...parentTitles]
      : [...parentTitles, suite.title].filter(Boolean);

    if (suite.specs) {
      for (const spec of suite.specs) {
        for (const test of spec.tests) {
          const results = test.results;
          if (!results.length) continue;
          const lastResult  = results[results.length - 1];
          const firstResult = results[0];
          const retryPassed = results.length > 1 && lastResult.status === 'passed' && firstResult.status !== 'passed';

          const failedResult = results.find(r => r.status !== 'passed') ?? firstResult;
          const rawError     = failedResult.errors.length > 0
            ? failedResult.errors.map(e => e.message ?? '').join('\n')
            : null;
          const errorMessage = rawError ? stripAnsi(rawError) : null;

          let status;
          if      (lastResult.status === 'passed')  status = 'passed';
          else if (lastResult.status === 'skipped') status = 'skipped';
          else                                       status = 'failed';

          entries.push({
            testName: [...titles, spec.title].join(' › '),
            project:  test.projectName,
            status,
            retryPassed,
            durationMs: results.reduce((sum, r) => sum + r.duration, 0),
            errorMessage,
          });
        }
      }
    }
    if (suite.suites) entries.push(...flattenSuites(suite.suites, titles, false));
  }
  return entries;
}

// ── table ─────────────────────────────────────────────────────────────────────
// Col widths: Test(24) | Project(16) | Status(10) | Category(17) | Health(12)
const C = [24, 16, 10, 17, 12];

function pad(s, len) {
  const str = String(s ?? '');
  return str.length > len ? str.slice(0, len - 1) + '…' : str.padEnd(len);
}
function sep(l, m, r) { return l + C.map(w => '─'.repeat(w + 2)).join(m) + r; }
function row(...cells) { return '│ ' + cells.map((c, i) => pad(c, C[i])).join(' │ ') + ' │'; }

function healthLabel(h) {
  if (!h) return '–';
  if (h.status === 'healthy')     return 'healthy';
  if (h.status === 'watch')       return `watch ${h.flakiness_score.toFixed(2)}`;
  /* quarantined */                return `quar ${h.flakiness_score.toFixed(2)}`;
}

function buildTable(entries, health) {
  const lines = [
    sep('┌', '┬', '┐'),
    row('Test', 'Project', 'Status', 'Category', 'Health'),
    sep('├', '┼', '┤'),
  ];

  for (const e of entries) {
    const key        = toHealthKey(e.testName, e.project);
    const h          = health?.tests?.[key] ?? null;
    const statusCell = e.retryPassed         ? 'flaky 🔄'
                     : e.status === 'passed'  ? 'passed ✅'
                     : e.status === 'failed'  ? 'failed ⚠️'
                     :                          'skipped –';
    const catCell    = (e.status === 'failed' || e.retryPassed) ? (h?.last_category ?? 'UNKNOWN') : '–';
    lines.push(row(shortName(e.testName), e.project, statusCell, catCell, healthLabel(h)));
  }

  lines.push(sep('└', '┴', '┘'));
  return lines.join('\n');
}

// ── failure detail block ──────────────────────────────────────────────────────
function buildFailureBlock(entries, health) {
  const failed = entries.filter(e => e.status === 'failed');
  if (!failed.length) return null;

  const lines = ['*Failures:*'];
  for (const e of failed) {
    const key      = toHealthKey(e.testName, e.project);
    const h        = health?.tests?.[key] ?? null;
    const category = h?.last_category ?? 'UNKNOWN';
    lines.push(`• \`${shortName(e.testName)}\` [${e.project}] — *${category}*`);

    if (e.errorMessage) {
      const snippet = e.errorMessage
        .split('\n')
        .map(l => l.trim())
        .find(l => l && (!l.startsWith('at ') || l.startsWith('Error:')))
        ?? '';
      if (snippet) lines.push(`  _${snippet.slice(0, 140)}_`);
    }
    if (h?.status === 'quarantined') {
      lines.push(`  _(quarantined — flakiness score ${h.flakiness_score.toFixed(2)}, not blocking CI)_`);
    }
  }
  return lines.join('\n');
}

// ── Slack post ────────────────────────────────────────────────────────────────
function postToSlack(text) {
  const body = JSON.stringify({ text });
  const url  = new URL(WEBHOOK);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: url.hostname,
      path:     url.pathname + url.search,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(PLAYWRIGHT_REPORT)) {
    console.log('reports/playwright-report.json not found — skipping Slack report.');
    return;
  }

  const report = JSON.parse(fs.readFileSync(PLAYWRIGHT_REPORT, 'utf8'));
  const health = fs.existsSync(HEALTH_PATH)
    ? JSON.parse(fs.readFileSync(HEALTH_PATH, 'utf8'))
    : null;

  const entries  = flattenSuites(report.suites ?? []);
  const total    = entries.length;
  const failed   = entries.filter(e => e.status === 'failed').length;
  const flaky    = entries.filter(e => e.retryPassed).length;
  const blocking = health?.summary?.quarantined_blocking ?? failed;

  const branch = process.env.BITBUCKET_BRANCH       ?? process.env.GITHUB_REF_NAME   ?? 'local';
  const build  = process.env.BITBUCKET_BUILD_NUMBER  ?? process.env.GITHUB_RUN_NUMBER ?? '?';

  const verdict = failed === 0 && flaky === 0
    ? '✅ All tests passed'
    : failed === 0
    ? `⚠️ ${flaky} flaky  |  all passed after retry`
    : `❌ ${failed} failed  |  ${blocking} blocking${flaky ? `  |  ${flaky} flaky` : ''}`;

  const tableStr     = buildTable(entries, health);
  const failureBlock = buildFailureBlock(entries, health);

  const header  = `*Visual Regression* — Build #${build} \`${branch}\`  |  ${total} tests`;
  const summary = `${verdict}  |  projects: chromium-desktop + mobile-chrome`;

  let slackText = `${header}\n${summary}\n\`\`\`\n${tableStr}\n\`\`\``;
  if (failureBlock) slackText += `\n\n${failureBlock}`;

  console.log(`\n${header}\n${summary}\n\n${tableStr}`);
  if (failureBlock) console.log(`\n${failureBlock}\n`);

  if (!WEBHOOK || WEBHOOK.includes('YOUR/WEBHOOK')) {
    console.log('Slack: skipped (SLACK_WEBHOOK_URL not set)');
    return;
  }

  const status = await postToSlack(slackText);
  console.log(`Slack: posted (HTTP ${status})`);
}

main().catch(err => {
  console.error(`visual-slack-report error: ${err.message}`);
});
