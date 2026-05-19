'use strict';

const fs   = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

const LHCI_DIR   = path.join(process.cwd(), '.lighthouseci');
const WEBHOOK    = process.env.SLACK_WEBHOOK_URL;
const STAGING_URL = (process.env.STAGING_URL || 'https://stage.livguardsolar.com').replace(/\/$/, '');

const TARGETS = { perf: 0.9, lcp: 2500, fcp: 1800, tbt: 200, cls: 0.1 };

const PAGE_NAMES = {
  '/':                     'homepage',
  '/rooftop-solar':        'rooftop-solar',
  '/solar-for-home':       'solar-for-home',
  '/solar-for-commercial': 'solar-for-commercial',
};

function fmtPerf(v) {
  return v >= TARGETS.perf ? `${v.toFixed(2)} ✅` : `${v.toFixed(2)} ⚠️`;
}

function fmtSeconds(ms, target) {
  const s = (ms / 1000).toFixed(1);
  return ms <= target ? `${s} seconds ✅` : `${s} seconds ⚠️`;
}

function fmtTbt(ms) {
  const n = Math.round(ms).toLocaleString('en-US');
  return ms <= TARGETS.tbt ? `${n} milliseconds ✅` : `${n} milliseconds ⚠️`;
}

function fmtCls(v) {
  return v <= TARGETS.cls ? 'Within target ✅' : `${v.toFixed(2)} ⚠️`;
}

function getPageName(url) {
  const pathname = url.replace(STAGING_URL, '').replace(/\/$/, '') || '/';
  return PAGE_NAMES[pathname] || pathname;
}

function parseResults() {
  const lhrFiles = fs.readdirSync(LHCI_DIR)
    .filter(f => f.startsWith('lhr-') && f.endsWith('.json'));

  if (!lhrFiles.length) throw new Error('No lhr-*.json files found in .lighthouseci/');

  // Parse all runs and group by URL
  const byUrl = {};
  lhrFiles.forEach(f => {
    const lhr = JSON.parse(fs.readFileSync(path.join(LHCI_DIR, f), 'utf8'));
    const url = lhr.finalUrl || lhr.requestedUrl;
    if (!byUrl[url]) byUrl[url] = [];
    byUrl[url].push({
      url,
      page: getPageName(url),
      perf: lhr.categories.performance.score,
      lcp:  lhr.audits['largest-contentful-paint'].numericValue,
      fcp:  lhr.audits['first-contentful-paint'].numericValue,
      tbt:  lhr.audits['total-blocking-time'].numericValue,
      cls:  lhr.audits['cumulative-layout-shift'].numericValue,
    });
  });

  // Pick median run per URL (by perf score)
  return Object.values(byUrl).map(runs => {
    runs.sort((a, b) => a.perf - b.perf);
    return runs[Math.floor(runs.length / 2)];
  });
}

function loadLinks() {
  const linksPath = path.join(LHCI_DIR, 'links.json');
  return fs.existsSync(linksPath)
    ? JSON.parse(fs.readFileSync(linksPath, 'utf8'))
    : {};
}

function buildTable(results) {
  // Column widths (characters between │ borders, excluding the space padding)
  const C = [22, 26, 22, 27];

  const METRICS = [
    { label: 'Performance Score',        fmt: r => fmtPerf(r.perf),           target: '0.9 or above' },
    { label: 'Largest Contentful Paint', fmt: r => fmtSeconds(r.lcp, TARGETS.lcp), target: '2.5 seconds or under' },
    { label: 'First Contentful Paint',   fmt: r => fmtSeconds(r.fcp, TARGETS.fcp), target: '1.8 seconds or under' },
    { label: 'Total Blocking Time',      fmt: r => fmtTbt(r.tbt),             target: '200 milliseconds or under' },
    { label: 'Cumulative Layout Shift',  fmt: r => fmtCls(r.cls),             target: '0.1 or under' },
  ];

  function pad(str, len) { return String(str).padEnd(len); }
  function row(p, m, v, t) {
    return `│ ${pad(p,C[0])} │ ${pad(m,C[1])} │ ${pad(v,C[2])} │ ${pad(t,C[3])} │`;
  }

  const top = `┌${'─'.repeat(C[0]+2)}┬${'─'.repeat(C[1]+2)}┬${'─'.repeat(C[2]+2)}┬${'─'.repeat(C[3]+2)}┐`;
  const mid = `├${'─'.repeat(C[0]+2)}┼${'─'.repeat(C[1]+2)}┼${'─'.repeat(C[2]+2)}┼${'─'.repeat(C[3]+2)}┤`;
  const bot = `└${'─'.repeat(C[0]+2)}┴${'─'.repeat(C[1]+2)}┴${'─'.repeat(C[2]+2)}┴${'─'.repeat(C[3]+2)}┘`;
  const hdr = row('Page', 'Metric', 'Actual Result', 'Google Recommendation');

  const lines = [top, hdr, mid];

  results.forEach((r, idx) => {
    METRICS.forEach((m, mi) => {
      lines.push(row(mi === 0 ? r.page : '', m.label, m.fmt(r), m.target));
    });
    lines.push(idx < results.length - 1 ? mid : bot);
  });

  return lines.join('\n');
}

function buildLinks(results, links) {
  return results
    .map(r => `${r.page}: ${links[r.url] || 'no link'}`)
    .join('\n');
}

function sendToSlack(table, linksList) {
  const branch = process.env.BITBUCKET_BRANCH || 'local';
  const build  = process.env.BITBUCKET_BUILD_NUMBER || '?';

  const text = `*Lighthouse CI* — Build #${build} \`${branch}\`\n\`\`\`\n${table}\n\`\`\`\n*Full reports:*\n${linksList}`;

  const payload = JSON.stringify({ text });

  const url = new URL(WEBHOOK);
  const options = {
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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

  const results   = parseResults();
  const links     = loadLinks();
  const table     = buildTable(results);
  const linksList = buildLinks(results, links);

  console.log('\n' + table + '\n');
  await sendToSlack(table, linksList);
}

main().catch(err => {
  console.error('Slack report error:', err.message);
  process.exit(0); // never fail the build over a notification
});
