'use strict';

const fs    = require('fs');
const path  = require('path');
const https = require('https');

const HEALTH_FILE = path.join(process.cwd(), 'reports', 'test-health.json');
const WEBHOOK     = process.env.SLACK_WEBHOOK_URL;
const BUILD_URL   = process.env.BITBUCKET_BUILD_URL ||
  (process.env.BITBUCKET_WORKSPACE && process.env.BITBUCKET_REPO_SLUG && process.env.BITBUCKET_BUILD_NUMBER
    ? `https://bitbucket.org/${process.env.BITBUCKET_WORKSPACE}/${process.env.BITBUCKET_REPO_SLUG}/pipelines/results/${process.env.BITBUCKET_BUILD_NUMBER}`
    : null);

if (!WEBHOOK) { console.error('SLACK_WEBHOOK_URL not set'); process.exit(1); }
if (!fs.existsSync(HEALTH_FILE)) { console.error('test-health.json not found'); process.exit(1); }

const health = JSON.parse(fs.readFileSync(HEALTH_FILE, 'utf8'));
const { total_tests, passed, failed, quarantined_blocking } = health.summary;

const allTests   = Object.entries(health.tests);
const failing    = allTests.filter(([, t]) => t.status === 'failing');
const quarantine = allTests.filter(([, t]) => t.status === 'quarantined');

const allPassed  = failed === 0;
const statusIcon = allPassed ? '✅' : '❌';
const statusText = allPassed ? 'All visual tests passed' : `${failed} visual test${failed > 1 ? 's' : ''} failed`;

function fmtTestName(key) {
  return key.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const blocks = [
  {
    type: 'header',
    text: { type: 'plain_text', text: `${statusIcon} Visual Regression — ${statusText}` }
  },
  {
    type: 'section',
    fields: [
      { type: 'mrkdwn', text: `*Total*\n${total_tests}` },
      { type: 'mrkdwn', text: `*Passed*\n${passed}` },
      { type: 'mrkdwn', text: `*Failed*\n${failed}` },
      { type: 'mrkdwn', text: `*Quarantined*\n${quarantine.length}` },
    ]
  }
];

if (failing.length) {
  const lines = failing.map(([key, t]) =>
    `• *${fmtTestName(key)}*${t.last_category ? ` — \`${t.last_category}\`` : ''}`
  ).join('\n');
  blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*Failures:*\n${lines}` } });
}

if (quarantine.length) {
  const lines = quarantine.map(([key, t]) =>
    `• ${fmtTestName(key)}${t.last_category ? ` — \`${t.last_category}\`` : ''}`
  ).join('\n');
  blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*Quarantined (non-blocking):*\n${lines}` } });
}

if (BUILD_URL) {
  blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `<${BUILD_URL}|View pipeline>` } });
}

const payload = JSON.stringify({ blocks });
const url     = new URL(WEBHOOK);
const options = { hostname: url.hostname, path: url.pathname + url.search, method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } };

const req = https.request(options, res => {
  console.log(`Slack response: ${res.statusCode}`);
  if (res.statusCode !== 200) process.exit(1);
});
req.on('error', e => { console.error(e); process.exit(1); });
req.write(payload);
req.end();
