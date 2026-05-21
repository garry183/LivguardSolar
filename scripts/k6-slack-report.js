'use strict';

const fs    = require('fs');
const path  = require('path');
const https = require('https');
const { URL } = require('url');

const SUMMARY_PATH = path.join(process.cwd(), 'k6-summary.json');
const WEBHOOK      = process.env.SLACK_WEBHOOK_URL;

const THRESHOLDS = { p95: 750, errRate: 0.01 };

// Maps group name → custom Trend metric key in the summary JSON
const PAGE_METRIC = {
  'homepage':             'dur_homepage',
  'rooftop-solar':        'dur_rooftop_solar',
  'solar-for-home':       'dur_solar_for_home',
  'solar-for-commercial': 'dur_solar_for_commercial',
};

// --summary-export format: threshold value is false=not-breached (passed), true=breached (failed).
// Newer k6 versions may use { ok: true/false } objects.
function thresholdPassed(thresholds, key) {
  const val = thresholds?.[key];
  if (val === undefined) return true;
  if (typeof val === 'boolean') return !val;
  if (typeof val === 'object' && val !== null) return val.ok === true;
  return !val;
}

function parseResults() {
  const raw = JSON.parse(fs.readFileSync(SUMMARY_PATH, 'utf8'));
  const m   = raw.metrics;

  // k6 v2 changed format: values are flat on the metric, not under a 'values' key.
  // Rate metrics use '.value' for the rate; counters use '.count'/'.rate'.
  const dur    = m.http_req_duration || {};
  const reqs   = m.http_reqs        || {};
  const errs   = m.errors           || {};
  const checks = m.checks           || {};

  // Per-page data: check results from group() + response times from custom Trend metrics
  const groups = raw.root_group?.groups || {};
  const pageGroups = Object.entries(groups).map(([name, g]) => {
    const s200    = g.checks?.['status 200']       || { passes: 0, fails: 0 };
    const s750    = g.checks?.['response < 750ms'] || { passes: 0, fails: 0 };
    const total   = s200.passes + s200.fails;
    const trend   = m[PAGE_METRIC[name]] || {};
    return {
      name,
      total,
      p95: trend['p(95)'] || 0,
      avg: trend['avg']   || 0,
      max: trend['max']   || 0,
      status200:  { passes: s200.passes, ok: s200.fails === 0 },
      under750ms: { passes: s750.passes, ok: s750.fails === 0 },
    };
  });

  return {
    p95:        dur['p(95)']  || 0,
    avg:        dur['avg']    || 0,
    max:        dur['max']    || 0,
    med:        dur['med']    || 0,
    totalReqs:  reqs['count'] || 0,
    reqRate:    reqs['rate']  || 0,
    errorRate:  errs['value'] || 0,
    checkRate:  checks['value'] || 0,
    maxVUs:     m.vus_max?.value || m.vus_max?.max || 0,
    pageGroups,
    p95Passed:  thresholdPassed(dur?.thresholds, 'p(95)<750'),
    errPassed:  thresholdPassed(errs?.thresholds, 'rate<0.01'),
  };
}

function buildPageTable(pageGroups) {
  if (!pageGroups.length) return null;

  // Columns: Page | p95 | Avg | Max | Reqs | Status 200 | < 750ms
  const C = [22, 13, 8, 8, 6, 12, 12];
  function pad(s, len) { return String(s).padEnd(len); }
  function row(...cells) {
    return '│ ' + cells.map((c, i) => pad(c, C[i])).join(' │ ') + ' │';
  }
  function sep(l, m, r) {
    return l + C.map(w => '─'.repeat(w + 2)).join(m) + r;
  }

  const top = sep('┌', '┬', '┐');
  const mid = sep('├', '┼', '┤');
  const bot = sep('└', '┴', '┘');

  const lines = [
    top,
    row('Page', 'p95', 'Avg', 'Max', 'Reqs', 'Status 200', '< 750ms'),
    row('',     'thr: <750ms', '', '', '', '', ''),
    mid,
  ];

  pageGroups.forEach((p, i) => {
    const p95mark = p.p95 > 0 ? `${Math.round(p.p95)}ms ${p.p95 <= THRESHOLDS.p95 ? '✅' : '⚠️'}` : '-';
    const avg     = p.avg > 0 ? `${Math.round(p.avg)}ms` : '-';
    const max     = p.max > 0 ? `${Math.round(p.max)}ms` : '-';
    const s200    = `${p.status200.passes}/${p.total} ${p.status200.ok ? '✅' : '⚠️'}`;
    const s750    = `${p.under750ms.passes}/${p.total} ${p.under750ms.ok ? '✅' : '⚠️'}`;
    lines.push(row(p.name, p95mark, avg, max, String(p.total), s200, s750));
    lines.push(i < pageGroups.length - 1 ? mid : bot);
  });

  return lines.join('\n');
}

function buildTable(r) {
  const C = [26, 20, 22];

  function pad(s, len) { return String(s).padEnd(len); }
  function row(m, v, s) {
    return `│ ${pad(m, C[0])} │ ${pad(v, C[1])} │ ${pad(s, C[2])} │`;
  }

  const top = `┌${'─'.repeat(C[0]+2)}┬${'─'.repeat(C[1]+2)}┬${'─'.repeat(C[2]+2)}┐`;
  const mid = `├${'─'.repeat(C[0]+2)}┼${'─'.repeat(C[1]+2)}┼${'─'.repeat(C[2]+2)}┤`;
  const bot = `└${'─'.repeat(C[0]+2)}┴${'─'.repeat(C[1]+2)}┴${'─'.repeat(C[2]+2)}┘`;
  const hdr = row('Metric', 'Value', 'Threshold');

  const rows = [
    row('p95 Response Time',   `${r.p95.toFixed(0)} ms`,              r.p95Passed ? `✅ < ${THRESHOLDS.p95} ms`       : `⚠️ > ${THRESHOLDS.p95} ms`),
    row('Avg Response Time',   `${r.avg.toFixed(0)} ms`,              ''),
    row('Median Response Time',`${r.med.toFixed(0)} ms`,              ''),
    row('Max Response Time',   `${r.max.toFixed(0)} ms`,              ''),
    row('Total Requests',      r.totalReqs.toLocaleString(),          ''),
    row('Request Rate',        `${r.reqRate.toFixed(2)} req/s`,       ''),
    row('Error Rate',          `${(r.errorRate * 100).toFixed(2)}%`,  r.errPassed ? `✅ < ${THRESHOLDS.errRate * 100}%` : `⚠️ > ${THRESHOLDS.errRate * 100}%`),
    row('Check Pass Rate',     `${(r.checkRate * 100).toFixed(1)}%`,  r.checkRate >= 0.99 ? '✅' : '⚠️'),
  ];

  const lines = [top, hdr, mid];
  rows.forEach((line, i) => {
    lines.push(line);
    lines.push(i < rows.length - 1 ? mid : bot);
  });

  return lines.join('\n');
}

function sendToSlack(r, allPassed) {
  const branch = process.env.BITBUCKET_BRANCH       || 'local';
  const build  = process.env.BITBUCKET_BUILD_NUMBER || '?';
  const status = allPassed ? '✅ All thresholds passed' : '⚠️ Threshold(s) breached';

  const pageTable = buildPageTable(r.pageGroups);
  const pageBlock = pageTable ? `\`\`\`\n${pageTable}\n\`\`\`` : '';

  const text = `*k6 Load Test* — Build #${build} \`${branch}\`  |  *${r.maxVUs} max VUs*  |  2 min ramp → 5 min @ peak → 2 min ramp down\n${status}\n${pageBlock}`;
  const payload = JSON.stringify({ text });

  const url     = new URL(WEBHOOK);
  const options = {
    hostname: url.hostname,
    path:     url.pathname + url.search,
    method:   'POST',
    headers: {
      'Content-Type':   'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let body = '';
      res.on('data', d => (body += d));
      res.on('end', () => {
        if (res.statusCode === 200) { console.log('Slack notification sent.'); resolve(); }
        else reject(new Error(`Slack ${res.statusCode}: ${body}`));
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  if (!WEBHOOK) {
    console.log('SLACK_WEBHOOK_URL not set — skipping Slack report');
    return;
  }

  if (!fs.existsSync(SUMMARY_PATH)) {
    console.log('k6-summary.json not found — skipping Slack report');
    return;
  }

  const r         = parseResults();
  const allPassed = r.p95Passed && r.errPassed;

  const pageTable = buildPageTable(r.pageGroups);
  if (pageTable) console.log('\n' + pageTable + '\n');
  await sendToSlack(r, allPassed);
}

main().catch(err => {
  console.error('k6 Slack report error:', err.message);
  process.exit(0); // never fail the build over a notification
});
