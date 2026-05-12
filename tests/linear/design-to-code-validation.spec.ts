/**
 * Linear Design-to-Code Validation Script
 *
 * Standalone script (NOT a Playwright test spec). Run via:
 *   npx ts-node tests/linear/design-to-code-validation.spec.ts
 *
 * Required env vars:
 *   BITBUCKET_BRANCH   — git branch name (set automatically by Bitbucket Pipelines)
 *   LINEAR_API_KEY     — Linear personal API key or OAuth token
 *   GEMINI_API_KEY     — Google Gemini API key (free tier: gemini-2.0-flash)
 *   STAGING_URL        — base URL of the staging site (default: https://stage.livguardsolar.com)
 *
 * Verify path is read from the Linear ticket description/comments:
 *   Add a line "Verify: /solar-for-home" in the ticket. Defaults to "/" if not found.
 */

import { chromium } from 'playwright';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { freezeAnimations, triggerLazyLoad, waitForAllImages } from '../utils/visualHelpers';

// ─── Types ───────────────────────────────────────────────────────────────────

interface LinearComment {
  body: string;
}

interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  comments: { nodes: LinearComment[] };
}

interface ValidationResult {
  isUpdated: boolean;
  confidence: 'high' | 'medium' | 'low';
  summary: string;
  differences: string[];
  matchingElements: string[];
}

// ─── Step 1: Parse branch ─────────────────────────────────────────────────────

function parseTicketId(branch: string): string | null {
  const match = branch.match(/[A-Z]+-\d+/);
  return match ? match[0] : null;
}

// ─── Step 2: Fetch Linear issue (description + comments) ─────────────────────

async function fetchLinearIssue(ticketId: string, apiKey: string): Promise<LinearIssue> {
  // Split "LTD-2390" into teamKey="LTD" and number=2390
  const parts = ticketId.match(/^([A-Z]+)-(\d+)$/);
  if (!parts) throw new Error(`Cannot parse ticket ID: ${ticketId}`);
  const teamKey = parts[1];
  const issueNumber = parseInt(parts[2], 10);

  const query = `
    query GetIssueByNumber($number: Float!, $teamKey: String!) {
      issues(filter: { number: { eq: $number }, team: { key: { eq: $teamKey } } }) {
        nodes {
          id
          identifier
          title
          description
          comments {
            nodes {
              body
            }
          }
        }
      }
    }
  `;

  const response = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': apiKey,
    },
    body: JSON.stringify({ query, variables: { number: issueNumber, teamKey } }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Linear GraphQL request failed: ${response.status} ${response.statusText}\n${body}`);
  }

  const json = await response.json() as {
    data: { issues: { nodes: LinearIssue[] } };
    errors?: Array<{ message: string }>;
  };

  if (json.errors?.length) {
    throw new Error(`Linear GraphQL errors: ${json.errors.map(e => e.message).join(', ')}`);
  }

  const issue = json.data?.issues?.nodes?.[0];
  if (!issue) {
    throw new Error(`Linear ticket ${ticketId} not found. Check that LINEAR_API_KEY has access to this workspace.`);
  }

  return issue;
}

// ─── Step 3: Extract image URL and verify path from markdown ─────────────────

function extractImageUrl(markdown: string): string | null {
  const regex = /!\[.*?\]\((https:\/\/uploads\.linear\.app\/[^)]+)\)/;
  const match = markdown.match(regex);
  return match?.[1] ?? null;
}

function extractVerifyPath(markdown: string): string | null {
  // Matches "Verify: /some-path" or "verify: /some-path" (case-insensitive)
  const match = markdown.match(/verify:\s*(\/\S*)/i);
  return match?.[1] ?? null;
}

function findDesignImageUrl(issue: LinearIssue): string | null {
  // Primary: issue description
  const fromDescription = extractImageUrl(issue.description ?? '');
  if (fromDescription) return fromDescription;

  // Fallback: comments (designer may have posted image in a comment)
  for (const comment of issue.comments?.nodes ?? []) {
    const fromComment = extractImageUrl(comment.body ?? '');
    if (fromComment) return fromComment;
  }

  return null;
}

function findVerifyPath(issue: LinearIssue): string {
  // Primary: issue description
  const fromDescription = extractVerifyPath(issue.description ?? '');
  if (fromDescription) return fromDescription;

  // Fallback: comments
  for (const comment of issue.comments?.nodes ?? []) {
    const fromComment = extractVerifyPath(comment.body ?? '');
    if (fromComment) return fromComment;
  }

  // Default to homepage if not specified
  return '/';
}

// ─── Step 4: Download design image with auth retry ────────────────────────────

async function downloadImage(imageUrl: string, apiKey: string): Promise<{ buffer: Buffer; mediaType: string }> {
  // Attempt 1: Authorization: <API_KEY> (personal key format)
  let imgResponse = await fetch(imageUrl, {
    headers: { 'Authorization': apiKey },
  });

  // Attempt 2: Authorization: Bearer <API_KEY> (OAuth token format)
  if (imgResponse.status === 401) {
    console.log('[linear] First auth attempt returned 401, retrying with Bearer prefix...');
    imgResponse = await fetch(imageUrl, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
  }

  // Attempt 3: No auth header (some linear images are public CDN URLs)
  if (imgResponse.status === 401) {
    console.log('[linear] Bearer auth also returned 401, retrying without auth header...');
    imgResponse = await fetch(imageUrl);
  }

  if (!imgResponse.ok) {
    throw new Error(
      `Could not download design image from Linear — the image at uploads.linear.app returned ${imgResponse.status}. ` +
      `Ensure LINEAR_API_KEY is an OAuth token, not a personal API key. ` +
      `Alternatively, replace the image URL in the ticket description with a publicly accessible URL.`
    );
  }

  const contentType = imgResponse.headers.get('content-type') ?? 'image/png';
  const mediaTypeMap: Record<string, string> = {
    'image/jpeg': 'image/jpeg',
    'image/jpg': 'image/jpeg',
    'image/png': 'image/png',
    'image/gif': 'image/gif',
    'image/webp': 'image/webp',
  };
  const rawType = contentType.split(';')[0].trim().toLowerCase();
  const mediaType = mediaTypeMap[rawType] ?? 'image/png';

  const arrayBuffer = await imgResponse.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return { buffer, mediaType };
}

// ─── Step 5: Screenshot staging page via chromium.launch() ───────────────────

async function screenshotStagingPage(url: string): Promise<Buffer> {
  const browser = await chromium.launch({
    args: [
      '--font-render-hinting=none',
      '--disable-font-subpixel-positioning',
      '--disable-lcd-text',
      '--force-device-scale-factor=1',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    try {
      await page.waitForLoadState('networkidle', { timeout: 15_000 });
    } catch {
      await page.waitForTimeout(3_000);
    }

    // Cast to any: playwright vs @playwright/test Page type nominal mismatch — structurally identical at runtime.
    await triggerLazyLoad(page as any);
    await waitForAllImages(page as any);
    await freezeAnimations(page as any);

    const screenshot = await page.screenshot({ fullPage: false });
    return screenshot;
  } finally {
    await context.close();
    await browser.close();
  }
}

// ─── Step 6: Call Gemini Vision API (free tier) ───────────────────────────────

async function compareWithGemini(
  base64Design: string,
  designMediaType: string,
  base64Screenshot: string,
  geminiApiKey: string,
): Promise<ValidationResult> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: designMediaType,
                data: base64Design,
              },
            },
            {
              inline_data: {
                mime_type: 'image/png',
                data: base64Screenshot,
              },
            },
            {
              text: `Image 1 is the design mockup. Image 2 is the live implementation screenshot.
Does the implementation match the design? Return ONLY valid JSON with no markdown fencing:
{
  "isUpdated": boolean,
  "confidence": "high" | "medium" | "low",
  "summary": "one sentence describing the overall match quality",
  "differences": ["list of visual differences found"],
  "matchingElements": ["list of elements that match the design"]
}
Set isUpdated=true if the implementation substantially matches the design intent.
Set isUpdated=false if major design elements are missing, incorrectly positioned, or visually wrong.`,
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini API request failed: ${response.status} ${response.statusText}\n${body}`);
  }

  const msg = await response.json() as {
    candidates: Array<{
      content: { parts: Array<{ text: string }> };
    }>;
  };

  const textBlock = msg.candidates?.[0]?.content?.parts?.find(p => p.text);
  if (!textBlock) {
    throw new Error('Gemini response contained no text block. Full response: ' + JSON.stringify(msg));
  }

  let result: ValidationResult;
  try {
    result = JSON.parse(textBlock.text) as ValidationResult;
  } catch {
    throw new Error(`Gemini response was not valid JSON: ${textBlock.text}`);
  }

  return result;
}

// ─── Step 7: Format result as a human-looking QA comment ─────────────────────

function formatHumanComment(result: ValidationResult, pageUrl: string): string {
  const lines: string[] = [];

  if (result.isUpdated) {
    lines.push('Tested staging against the design mockup — looks good to ship. ✅');
  } else {
    lines.push('Tested staging against the design mockup — a few things to address before this is ready.');
  }

  lines.push('');
  lines.push(result.summary);

  if (result.matchingElements.length > 0) {
    lines.push('');
    lines.push('**What matches:**');
    result.matchingElements.forEach(m => lines.push(`- ${m}`));
  }

  if (result.differences.length > 0) {
    lines.push('');
    lines.push('**What needs attention:**');
    result.differences.forEach(d => lines.push(`- ${d}`));
  }

  lines.push('');
  lines.push(`Verified at: ${pageUrl}`);

  return lines.join('\n');
}

// ─── Step 8: Post comment to Linear ticket ────────────────────────────────────

async function postLinearComment(issueId: string, body: string, apiKey: string): Promise<void> {
  const mutation = `
    mutation CreateComment($issueId: String!, $body: String!) {
      commentCreate(input: { issueId: $issueId, body: $body }) {
        success
        comment {
          id
        }
      }
    }
  `;

  const response = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': apiKey,
    },
    body: JSON.stringify({ query: mutation, variables: { issueId, body } }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Linear comment POST failed: ${response.status} ${response.statusText}\n${text}`);
  }

  const json = await response.json() as {
    data: { commentCreate: { success: boolean } };
    errors?: Array<{ message: string }>;
  };

  if (json.errors?.length) {
    throw new Error(`Linear comment errors: ${json.errors.map(e => e.message).join(', ')}`);
  }

  if (!json.data?.commentCreate?.success) {
    throw new Error('Linear commentCreate returned success=false');
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Step 1: Validate env vars
  const branch = process.env.BITBUCKET_BRANCH ?? '';

  if (!branch) {
    console.log('[linear-validate] No BITBUCKET_BRANCH set — running outside CI, skipping design validation.');
    process.exit(0);
  }

  // Only run for UI branches — zero API calls for all other branches
  const isUiBranch = branch.startsWith('ui/') || branch.startsWith('design/');
  if (!isUiBranch) {
    console.log(`[linear-validate] Branch '${branch}' is not a ui/ or design/ branch — skipping design validation.`);
    process.exit(0);
  }

  const ticketId = parseTicketId(branch);

  if (!ticketId) {
    console.log(`[linear-validate] No Linear ticket ID found in branch '${branch}' — skipping design validation.`);
    process.exit(0);
  }

  console.log(`[linear-validate] Found Linear ticket: ${ticketId}`);

  const linearApiKey = process.env.LINEAR_API_KEY;
  if (!linearApiKey) {
    console.error('[linear-validate] ERROR: LINEAR_API_KEY env var is not set.');
    process.exit(1);
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    console.error('[linear-validate] ERROR: GEMINI_API_KEY env var is not set.');
    process.exit(1);
  }

  const stagingUrl = process.env.STAGING_URL ?? 'https://stage.livguardsolar.com';

  // Step 2: Fetch Linear issue
  console.log(`[linear-validate] Fetching Linear issue ${ticketId}...`);
  let issue: LinearIssue;
  try {
    issue = await fetchLinearIssue(ticketId, linearApiKey);
  } catch (err) {
    console.error(`[linear-validate] ERROR fetching Linear issue: ${(err as Error).message}`);
    process.exit(1);
  }

  console.log(`[linear-validate] Issue: "${issue.title}"`);

  // Extract verify path from ticket description/comments (e.g. "Verify: /solar-for-home")
  const verifyPath = findVerifyPath(issue);
  const pageUrl = `${stagingUrl}${verifyPath}`;
  console.log(`[linear-validate] Verify path: ${verifyPath}`);

  // Step 3: Find design image URL
  const designImageUrl = findDesignImageUrl(issue);
  if (!designImageUrl) {
    console.error(
      `[linear-validate] ERROR: No design image found on ticket ${ticketId}. ` +
      `Paste a design image (PNG/JPEG) directly into the ticket description or a comment. ` +
      `The image must be hosted at uploads.linear.app.`
    );
    process.exit(1);
  }

  console.log(`[linear-validate] Found design image: ${designImageUrl}`);

  // Step 4: Download design image
  console.log('[linear-validate] Downloading design image...');
  let designBuffer: Buffer;
  let designMediaType: string;
  try {
    const result = await downloadImage(designImageUrl, linearApiKey);
    designBuffer = result.buffer;
    designMediaType = result.mediaType;
  } catch (err) {
    console.error(`[linear-validate] ERROR: ${(err as Error).message}`);
    process.exit(1);
  }

  console.log(`[linear-validate] Design image downloaded (${designBuffer.length} bytes, ${designMediaType})`);

  // Step 5: Screenshot staging page
  console.log(`[linear-validate] Screenshotting staging page: ${pageUrl}`);
  let screenshotBuffer: Buffer;
  try {
    screenshotBuffer = await screenshotStagingPage(pageUrl);
  } catch (err) {
    console.error(`[linear-validate] ERROR taking screenshot: ${(err as Error).message}`);
    process.exit(1);
  }

  console.log(`[linear-validate] Screenshot captured (${screenshotBuffer.length} bytes)`);

  // Save to temp dir for debugging
  const tmpDir = os.tmpdir();
  const designPath = path.join(tmpDir, `linear-design-${ticketId}.png`);
  const screenshotPath = path.join(tmpDir, `linear-screenshot-${ticketId}.png`);
  fs.writeFileSync(designPath, designBuffer);
  fs.writeFileSync(screenshotPath, screenshotBuffer);
  console.log(`[linear-validate] Design saved to: ${designPath}`);
  console.log(`[linear-validate] Screenshot saved to: ${screenshotPath}`);

  // Step 6: Call Gemini Vision API
  const base64Design = designBuffer.toString('base64');
  const base64Screenshot = screenshotBuffer.toString('base64');

  console.log('[linear-validate] Calling Gemini Vision API...');
  let result: ValidationResult;
  try {
    result = await compareWithGemini(base64Design, designMediaType, base64Screenshot, geminiApiKey);
  } catch (err) {
    console.error(`[linear-validate] ERROR calling Gemini API: ${(err as Error).message}`);
    process.exit(1);
  }

  // Step 7: Report and exit
  console.log('\n[linear-validate] === Design Validation Result ===');
  console.log(`Ticket:     ${ticketId} — "${issue.title}"`);
  console.log(`isUpdated:  ${result.isUpdated}`);
  console.log(`Confidence: ${result.confidence}`);
  console.log(`Summary:    ${result.summary}`);

  if (result.differences.length > 0) {
    console.log('\nDifferences:');
    result.differences.forEach(d => console.log(`  - ${d}`));
  }

  if (result.matchingElements.length > 0) {
    console.log('\nMatching Elements:');
    result.matchingElements.forEach(m => console.log(`  + ${m}`));
  }

  // Step 8: Post result as comment on the Linear ticket
  const commentBody = formatHumanComment(result, pageUrl);
  console.log('\n[linear-validate] Posting result to Linear ticket...');
  try {
    await postLinearComment(issue.id, commentBody, linearApiKey);
    console.log(`[linear-validate] Comment posted to ${issue.identifier}`);
  } catch (err) {
    // Non-fatal: don't fail the pipeline if the comment can't be posted
    console.error(`[linear-validate] WARNING: Could not post comment to Linear: ${(err as Error).message}`);
  }

  if (result.isUpdated) {
    console.log('\n[linear-validate] PASS — implementation matches design.');
    process.exit(0);
  } else {
    console.log('\n[linear-validate] FAIL — implementation does not match design.');
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error('[linear-validate] Unhandled error:', (err as Error).message);
  process.exit(1);
});
