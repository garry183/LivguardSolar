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

async function apiFetch(url: string, auth: string): Promise<any> {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
  const res = await fetch(fullUrl, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status} ${res.statusText}: ${fullUrl}\n${body}`);
  }
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('json')) return res.json();
  return res;
}

async function downloadBinary(url: string, dest: string, auth: string): Promise<number> {
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) throw new Error(`Download ${res.status}: ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buffer);
  return buffer.length;
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

async function main(): Promise<void> {
  loadEnv();
  const auth = getAuth();

  // 1. Get latest pipeline
  console.log('Fetching latest pipeline...');
  const pipelines = await apiFetch('/pipelines/?sort=-created_on&pagelen=1', auth);
  const pipeline = pipelines.values?.[0];
  if (!pipeline) {
    console.error('No pipelines found.');
    process.exit(1);
  }

  const pipelineUuid = pipeline.uuid;
  const pipelineId = pipelineUuid.replace(/[{}]/g, '');
  const buildNumber = pipeline.build_number;
  const state = pipeline.state?.result?.name ?? pipeline.state?.name ?? 'unknown';
  const commit = pipeline.target?.commit?.hash?.slice(0, 7) ?? 'unknown';
  const createdOn = pipeline.created_on;

  console.log(`Pipeline: ${pipelineId}`);
  console.log(`  Commit : ${commit}`);
  console.log(`  State  : ${state}`);
  console.log(`  Created: ${createdOn}`);

  // 2. Get steps
  const stepsRes = await apiFetch(`/pipelines/${pipelineUuid}/steps/`, auth);
  const steps = stepsRes.values ?? [];
  if (steps.length === 0) {
    console.error('No steps found.');
    process.exit(1);
  }

  const runDir = path.join(LOCAL_ARTIFACTS_DIR, `${createdOn.slice(0, 10)}-${commit}-${state}`);
  fs.mkdirSync(runDir, { recursive: true });

  // 3. For each step, list and download artifacts
  for (const step of steps) {
    const stepUuid = step.uuid;
    const stepId = stepUuid.replace(/[{}]/g, '');
    const stepName = step.name ?? 'step';
    console.log(`\nStep: ${stepName}`);

    // Try listing artifacts — Bitbucket API needs URL-encoded braces %7B %7D
    const encodedPipeline = encodeURIComponent(pipelineUuid);
    const encodedStep = encodeURIComponent(stepUuid);
    let artifactItems: any[] = [];

    const urlPatterns = [
      `${API_BASE}/pipelines/${encodedPipeline}/steps/${encodedStep}/artifacts`,
      `${API_BASE}/pipelines/${pipelineId}/steps/${stepId}/artifacts`,
      `${API_BASE}/pipelines/${pipelineUuid}/steps/${stepUuid}/artifacts`,
    ];

    for (const listUrl of urlPatterns) {
      try {
        const listRes = await apiFetch(listUrl, auth);
        artifactItems = listRes.values ?? [];
        if (artifactItems.length > 0) break;
      } catch {
        continue;
      }
    }

    if (artifactItems.length === 0) {
      console.log('  Artifact list API returned empty — trying direct download...');
    }

    if (artifactItems.length > 0) {
      console.log(`  Found ${artifactItems.length} artifact(s)`);
      for (const item of artifactItems) {
        const name = item.name ?? `artifact-${item.id ?? 'unknown'}`;
        // Try multiple possible download URL locations
        const downloadUrl =
          item.links?.self?.href ??
          item.links?.content?.href ??
          `${API_BASE}/pipelines/${pipelineId}/steps/${stepId}/artifacts/${encodeURIComponent(name)}`;

        const localPath = path.join(runDir, name);
        try {
          const size = await downloadBinary(downloadUrl, localPath, auth);
          console.log(`  Downloaded: ${name} (${formatBytes(size)})`);
        } catch (err: any) {
          console.log(`  Failed ${name}: ${err.message.split('\n')[0]}`);
        }
      }
    } else {
      // Fallback: try Bitbucket web download URLs and API patterns
      const stepId = stepUuid.replace(/[{}]/g, '');
      const zipPatterns = [
        // Web UI artifact download (index 0, 1, 2 for each artifact pattern)
        ...[0, 1, 2].map(i =>
          `https://bitbucket.org/${WORKSPACE}/${REPO_SLUG}/pipelines/results/${buildNumber}/steps/${stepId}/artifacts/${i}/download`
        ),
        // API patterns
        `${API_BASE}/pipelines/${encodedPipeline}/steps/${encodedStep}/artifact`,
        `${API_BASE}/pipelines/${pipelineId}/steps/${stepId}/artifact`,
      ];
      let downloadCount = 0;
      for (let i = 0; i < zipPatterns.length; i++) {
        const zipUrl = zipPatterns[i];
        try {
          const zipPath = path.join(runDir, `artifact-${downloadCount}.gz`);
          const size = await downloadBinary(zipUrl, zipPath, auth);
          if (size < 100) {
            fs.unlinkSync(zipPath);
            continue;
          }
          console.log(`  Downloaded: artifact-${downloadCount}.gz (${formatBytes(size)})`);
          // Try to extract
          try {
            const extractDir = path.join(runDir, `artifact-${downloadCount}`);
            fs.mkdirSync(extractDir, { recursive: true });
            execSync(`cd "${extractDir}" && tar xzf "${zipPath}" 2>/dev/null || tar xf "${zipPath}" 2>/dev/null || true`, {
              stdio: 'pipe',
            });
            console.log(`  Extracted to: artifact-${downloadCount}/`);
          } catch {
            console.log('  Extract failed — file saved as-is');
          }
          downloadCount++;
        } catch {
          continue;
        }
      }
      if (downloadCount === 0) {
        console.log('  No artifacts available for download.');
      }
    }
  }

  // 4. Download step log
  for (const step of steps) {
    const stepUuid = step.uuid;
    const stepName = step.name ?? 'step';
    const logPath = path.join(runDir, `${stepName}-log.txt`);

    if (fs.existsSync(logPath)) {
      console.log(`\nLog already downloaded: ${stepName}`);
      continue;
    }

    console.log(`\nDownloading log: ${stepName}`);
    try {
      const logUrl = `${API_BASE}/pipelines/${pipelineUuid}/steps/${stepUuid}/log`;
      const res = await fetch(logUrl, {
        headers: { Authorization: `Basic ${auth}` },
      });
      if (res.ok) {
        const text = await res.text();
        fs.writeFileSync(logPath, text, 'utf8');
        console.log(`  Saved (${formatBytes(Buffer.byteLength(text))})`);
      } else {
        console.log(`  Not available (${res.status})`);
      }
    } catch {
      console.log('  Failed to download log.');
    }
  }

  // 5. Decompress any .gz files
  for (const file of getAllFiles(runDir)) {
    if (file.endsWith('.gz')) {
      try {
        execSync(`gzip -d -f "${file}"`, { stdio: 'pipe' });
        console.log(`Decompressed: ${path.basename(file)}`);
      } catch { /* ignore */ }
    }
  }

  console.log(`\n${'━'.repeat(50)}`);
  console.log(`  Artifacts saved to: ${runDir}`);
  console.log(`${'━'.repeat(50)}`);

  // 6. Copy brain reports to local reports/ for easy access
  const allFiles = getAllFiles(runDir);
  const reportFiles = ['test-health.json', 'playwright-report.json', 'run-history.ndjson'];
  const localReportsDir = path.resolve(__dirname, '..', 'reports');
  let copied = 0;
  for (const file of reportFiles) {
    const found = allFiles.find(f => f.replace(/\\/g, '/').endsWith(file));
    if (found) {
      const dest = path.join(localReportsDir, `ci-${file}`);
      fs.copyFileSync(found, dest);
      console.log(`Copied: reports/ci-${file}`);
      copied++;
    }
  }
  if (copied === 0) {
    console.log('\nNo brain reports found in artifacts to copy locally.');
  }
  console.log('');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
