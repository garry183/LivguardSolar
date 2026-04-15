/**
 * Fetch artifacts from the latest Bitbucket Pipeline run and save them locally
 * so the brain analysis reports and failure screenshots are available for debugging.
 *
 * Usage:
 *   npx ts-node scripts/fetch-pipeline-artifacts.ts
 *
 * Required env vars:
 *   BITBUCKET_USERNAME  — Bitbucket username (e.g. garryLTD)
 *   BITBUCKET_APP_PASSWORD — App password with Pipelines:Read scope
 *
 * These can be set in a .env file in the project root (git-ignored).
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const WORKSPACE = 'lipl-dev';
const REPO_SLUG = 'livguardsolar360';
const API_BASE = `https://api.bitbucket.org/2.0/repositories/${WORKSPACE}/${REPO_SLUG}`;
const LOCAL_ARTIFACTS_DIR = path.resolve(__dirname, '..', 'ci-artifacts');

// Load .env if present
function loadEnv(): void {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

function getAuth(): string {
  const user = process.env.BITBUCKET_USERNAME;
  const pass = process.env.BITBUCKET_APP_PASSWORD;
  if (!user || !pass) {
    console.error(
      'Missing BITBUCKET_USERNAME or BITBUCKET_APP_PASSWORD.\n' +
        'Set them in .env or as environment variables.\n\n' +
        'To create an app password:\n' +
        '  Bitbucket → Personal settings → App passwords → Create\n' +
        '  Scope needed: Pipelines: Read\n'
    );
    process.exit(1);
  }
  return Buffer.from(`${user}:${pass}`).toString('base64');
}

async function apiFetch(endpoint: string, auth: string): Promise<any> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) {
    throw new Error(`API ${res.status} ${res.statusText}: ${url}`);
  }
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('json')) return res.json();
  return res;
}

async function downloadFile(url: string, dest: string, auth: string): Promise<void> {
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buffer);
}

async function main(): Promise<void> {
  loadEnv();
  const auth = getAuth();

  // 1. Get latest pipeline
  console.log('Fetching latest pipeline...');
  const pipelines = await apiFetch(
    '/pipelines/?sort=-created_on&pagelen=1',
    auth
  );
  const pipeline = pipelines.values?.[0];
  if (!pipeline) {
    console.error('No pipelines found.');
    process.exit(1);
  }

  const pipelineUuid = pipeline.uuid.replace(/[{}]/g, '');
  const state = pipeline.state?.result?.name ?? pipeline.state?.name ?? 'unknown';
  const commit = pipeline.target?.commit?.hash?.slice(0, 7) ?? 'unknown';
  const createdOn = pipeline.created_on;

  console.log(`Pipeline: ${pipelineUuid}`);
  console.log(`  Commit : ${commit}`);
  console.log(`  State  : ${state}`);
  console.log(`  Created: ${createdOn}`);

  // 2. Get steps
  const stepsRes = await apiFetch(
    `/pipelines/${pipelineUuid}/steps/`,
    auth
  );
  const steps = stepsRes.values ?? [];
  if (steps.length === 0) {
    console.error('No steps found in pipeline.');
    process.exit(1);
  }

  // 3. For each step, download artifacts
  const runDir = path.join(
    LOCAL_ARTIFACTS_DIR,
    `${createdOn.slice(0, 10)}-${commit}-${state}`
  );

  for (const step of steps) {
    const stepUuid = step.uuid.replace(/[{}]/g, '');
    const stepName = step.name ?? 'step';
    console.log(`\nStep: ${stepName} (${stepUuid})`);

    // Get artifact list
    let artifacts: any;
    try {
      artifacts = await apiFetch(
        `/pipelines/${pipelineUuid}/steps/${stepUuid}/artifacts`,
        auth
      );
    } catch {
      console.log('  No artifacts for this step.');
      continue;
    }

    const items = artifacts.values ?? [];
    if (items.length === 0) {
      console.log('  No artifacts found.');
      continue;
    }

    console.log(`  Found ${items.length} artifact(s)`);

    for (const item of items) {
      const artifactPath = item.name ?? `artifact-${item.id}`;
      const downloadUrl = item.links?.self?.href;
      if (!downloadUrl) {
        console.log(`  Skipping ${artifactPath} — no download URL`);
        continue;
      }

      const localPath = path.join(runDir, artifactPath);
      console.log(`  Downloading: ${artifactPath}`);
      try {
        await downloadFile(downloadUrl, localPath, auth);
      } catch (err: any) {
        console.error(`  Failed: ${err.message}`);
      }
    }
  }

  // 4. Also try downloading the step log
  for (const step of steps) {
    const stepUuid = step.uuid.replace(/[{}]/g, '');
    const stepName = step.name ?? 'step';
    const logUrl = `${API_BASE}/pipelines/${pipelineUuid}/steps/${stepUuid}/log`;
    const logPath = path.join(runDir, `${stepName}-log.txt`);
    console.log(`\nDownloading log: ${stepName}`);
    try {
      const res = await fetch(logUrl, {
        headers: { Authorization: `Basic ${auth}` },
      });
      if (res.ok) {
        const text = await res.text();
        fs.mkdirSync(path.dirname(logPath), { recursive: true });
        fs.writeFileSync(logPath, text, 'utf8');
        console.log(`  Saved: ${logPath}`);
      } else {
        console.log(`  Log not available (${res.status})`);
      }
    } catch {
      console.log('  Could not download log.');
    }
  }

  // 5. Unzip any .gz or .zip artifacts
  const allFiles = getAllFiles(runDir);
  for (const file of allFiles) {
    if (file.endsWith('.gz')) {
      try {
        execSync(`gzip -d -f "${file}"`, { stdio: 'pipe' });
        console.log(`Decompressed: ${file}`);
      } catch { /* ignore */ }
    }
  }

  console.log(`\n${'━'.repeat(50)}`);
  console.log(`  Artifacts saved to: ${runDir}`);
  console.log(`${'━'.repeat(50)}\n`);

  // 6. Copy key brain reports to local reports/ for easy access
  const reportFiles = ['test-health.json', 'playwright-report.json', 'run-history.ndjson'];
  const localReportsDir = path.resolve(__dirname, '..', 'reports');
  for (const file of reportFiles) {
    const found = allFiles.find(f => f.endsWith(file));
    if (found) {
      const dest = path.join(localReportsDir, `ci-${file}`);
      fs.copyFileSync(found, dest);
      console.log(`Copied to reports/ci-${file}`);
    }
  }
}

function getAllFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...getAllFiles(full));
    else results.push(full);
  }
  return results;
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
