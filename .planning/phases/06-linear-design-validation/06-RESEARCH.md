# Phase 6: Linear Design-to-Code Validation - Research

**Researched:** 2026-04-27
**Domain:** Linear GraphQL API, Anthropic Vision API (raw fetch), Playwright library mode, Bitbucket Pipelines conditionals, ts-node
**Confidence:** HIGH (stack verified) / MEDIUM (Linear image auth — known open issue)

---

## Summary

Phase 6 builds a standalone TypeScript script (`tests/linear/design-to-code-validation.spec.ts`) that runs outside the Playwright test runner. When a Bitbucket branch contains a Linear ticket ID (e.g. `ENG-1234`), the script fetches the design image from that ticket, screenshots the live staging page using Playwright's library API (`chromium.launch()`), and sends both images to the Anthropic Vision API for a semantic design-vs-implementation comparison.

The core technical risk is **Linear image authentication**: images uploaded to Linear are stored at `uploads.linear.app` and require authentication to download. There is a documented open issue where personal API keys return 401 even with the correct `Authorization` header. The script must handle this gracefully. The two recovery strategies are: (1) require the user to paste a publicly-accessible design URL in the ticket description, or (2) try `Authorization: <API_KEY>` and `Authorization: Bearer <API_KEY>` and surface a clear error if both fail.

The Bitbucket Pipelines step should use a bash `if` check inside the script (not `condition.state`) because the `condition.state` feature only supports `glob()` pattern functions on exact branch names, not regex — and the pattern `[A-Z]+-\d+` needs substring matching, which bash `[[ $VAR =~ regex ]]` handles cleanly.

**Primary recommendation:** Use `chromium.launch()` with the same font-normalisation args as `playwright.config.ts`, reuse `visualHelpers.ts` helpers directly, call Anthropic via raw `fetch`, and use a structured system prompt (not `output_config`) for JSON output to avoid any beta header requirements.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Branch parsing / CI orchestration | Script (Node.js) | Bitbucket Pipelines YAML | Logic runs in the script; YAML only launches it |
| Linear ticket fetch | Script (Node.js) | — | Raw fetch POST to Linear GraphQL; no browser needed |
| Design image download | Script (Node.js) | — | HTTP GET with auth header to uploads.linear.app |
| Staging page screenshot | Script (Node.js via Playwright library) | — | chromium.launch() direct; not test runner |
| Vision comparison | Script (Node.js) | Anthropic API | Raw fetch POST; no SDK |
| CI pass/fail gate | Script (process.exit) | Bitbucket Pipelines | Script exits 0/1; pipeline propagates |

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIN-01 | Script at `tests/linear/design-to-code-validation.spec.ts`, never picked up by `npx playwright test tests/visual/` | File location isolation: `tests/linear/` is outside `tests/visual/`; existing npm scripts all point at `tests/visual/`; playwright.config.ts `testDir: './tests'` would pick up the file — **mitigation required** (see Standard Stack) |
| LIN-02 | Parse `[A-Z]+-\d+` from `$BITBUCKET_BRANCH`; exit 0 with skip message if no ID | `BITBUCKET_BRANCH` is a built-in Bitbucket Pipelines variable; JS regex `/[A-Z]+-\d+/` handles it |
| LIN-03 | Fetch image attachment URL from Linear ticket via raw fetch POST; no SDK | Linear GraphQL endpoint confirmed: `https://api.linear.app/graphql`; image URL lives in `issue.description` markdown (not a structured attachment field); auth to download is a known risk |
| LIN-04 | Screenshot staging page using `chromium.launch()` directly, reusing `visualHelpers.ts` | Playwright library mode confirmed; `chromium` import from `playwright` (not `@playwright/test`); visualHelpers accepts `Page` which is the same type |
| LIN-05 | Anthropic messages API raw fetch with both images base64-encoded; structured result shape | Exact request shape verified from official docs; model `claude-haiku-4-5` recommended for cost; `anthropic-version: 2023-06-01` header required |
| LIN-06 | Bitbucket pipeline post-deploy step; exits 0 (pass) or 1 (fail); skipped on non-Linear branches | Bash `if` check inside step script is the correct pattern; `condition.state: glob()` cannot do substring regex matching |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `playwright` | `^1.50.0` (already installed) | `chromium.launch()` for live-site screenshots | Already a project dependency; library mode is supported |
| Node.js built-in `fetch` | Node 20.10.0 (confirmed) | Linear GraphQL POST, Anthropic POST, image download | No new dependencies; available natively |
| `ts-node` | `^10.9.2` (already installed) | Execute `.ts` script directly | Already used for `scripts/*.ts` in this project |
| `fs`, `path`, `os` | Node built-ins | Temp file write/read/cleanup | No new dependencies |

[VERIFIED: package.json, node --version, bitbucket-pipelines.yml]

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `Buffer` | Node built-in | Base64-encode images | Built-in; `buffer.toString('base64')` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw `fetch` for Anthropic | `@anthropic-ai/sdk` | Constraint: no new npm deps; raw fetch is sufficient |
| Raw `fetch` for Linear | `@linear/sdk` | Constraint: no new npm deps; GraphQL is simple enough |
| System-prompt JSON | `output_config.format` structured outputs | `output_config` is a beta feature; system-prompt JSON is stable and sufficient |
| `/tmp/` for temp files | `os.tmpdir()` | Use `os.tmpdir()` — portable across Linux (Bitbucket) and Windows (dev) |

**Installation:** No new npm install required. All dependencies already present.

**Version verification:**
```bash
# All verified:
node --version         # v20.10.0 — built-in fetch confirmed
npx ts-node --version  # v10.9.2
```
[VERIFIED: Bash]

---

## Architecture Patterns

### System Architecture Diagram

```
$BITBUCKET_BRANCH env var
        |
        v
  [Parse ticket ID]  ─── no match ──> exit 0 (skip)
        |
        v
  [Linear GraphQL POST]  ─── no image ──> exit 1 (error)
  GET https://api.linear.app/graphql
  Authorization: Bearer $LINEAR_API_KEY
        |
        v
  [Download design image]  ─── 401/404 ──> exit 1 (auth error)
  GET https://uploads.linear.app/...
  Authorization: $LINEAR_API_KEY
        |
        v
  [chromium.launch()]
  → newContext({ viewport: 1440x900, args: [...font flags] })
  → goto($STAGING_URL + $VERIFY_PATH)
  → freezeAnimations, triggerLazyLoad, waitForAllImages
  → page.screenshot({ fullPage: false })
        |
        v
  [Base64-encode both images]
        |
        v
  [POST https://api.anthropic.com/v1/messages]
  x-api-key: $ANTHROPIC_API_KEY
  anthropic-version: 2023-06-01
  content-type: application/json
  model: claude-haiku-4-5
  messages: [{ role: user, content: [image1, image2, text_prompt] }]
        |
        v
  [Parse JSON result]
  { isUpdated, confidence, summary, differences[], matchingElements[] }
        |
        v
  isUpdated === true ──> exit 0 (pass)
  isUpdated === false ──> exit 1 (fail)
```

### Recommended Project Structure
```
tests/
├── linear/
│   └── design-to-code-validation.spec.ts   # standalone script (not a test spec)
├── utils/
│   └── visualHelpers.ts                     # reused as-is
├── visual/                                  # existing — unchanged
└── pages/                                   # existing — unchanged

bitbucket-pipelines.yml                      # new step added to default pipeline
```

### LIN-01 Isolation: Preventing Test Runner Pickup

`playwright.config.ts` sets `testDir: './tests'` which would pick up `tests/linear/*.spec.ts`. Two valid mitigations:

**Option A (recommended): `testPathIgnorePatterns` or `testMatch` override in `playwright.config.ts`**
```typescript
// In playwright.config.ts, add to defineConfig:
testMatch: ['tests/visual/**/*.spec.ts', 'tests/pages/**/*.spec.ts'],
// OR:
testIgnore: ['tests/linear/**'],
```
[VERIFIED: Playwright `testMatch` / `testIgnore` config options — playwright.dev/docs/test-configuration]

**Option B: Different file extension**
Name the file `design-to-code-validation.ts` (without `.spec.`) so Playwright's default `testMatch` (`**/?(*.)+(spec|test).[tj]s?(x)`) does not pick it up. This contradicts the requirement in LIN-01 which explicitly names it `.spec.ts`.

**Recommendation: Option A.** Add `testIgnore: ['tests/linear/**']` to `playwright.config.ts`. This satisfies the `.spec.ts` filename requirement in LIN-01 while guaranteeing isolation.

### Pattern 1: Playwright Library Mode (chromium.launch)
**What:** Use Playwright as a Node.js library, not as a test runner.
**When to use:** Any script that needs browser automation without the test framework (no `test()` / `expect()`).

```typescript
// Source: https://playwright.dev/docs/library
import { chromium } from 'playwright';

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

await page.goto(stagingUrl, { waitForLoadState: 'domcontentloaded' });
try {
  await page.waitForLoadState('networkidle', { timeout: 15_000 });
} catch {
  await page.waitForTimeout(3_000);
}

// Reuse visualHelpers directly — they accept `Page` from playwright/test OR playwright
// Both export the same Page type at runtime
import { freezeAnimations, triggerLazyLoad, waitForAllImages, VIEWPORTS } from '../utils/visualHelpers';

await triggerLazyLoad(page);
await waitForAllImages(page);
await freezeAnimations(page);

const screenshot = await page.screenshot({ fullPage: false });
// screenshot is a Buffer — convert to base64:
const base64Screenshot = screenshot.toString('base64');

await context.close();
await browser.close();
```

**Import note:** `visualHelpers.ts` imports `{ Page }` from `@playwright/test`. When the script imports `chromium` from `playwright` (not `@playwright/test`), the `Page` type is structurally identical at runtime — TypeScript may flag a type mismatch at compile time. Resolution: cast the page: `await freezeAnimations(page as any)` or re-export the type from `playwright` instead of `@playwright/test` in the helper. The planner should address this type compatibility in the implementation task.

[VERIFIED: playwright.dev/docs/library; playwright.config.ts font args confirmed from codebase]

### Pattern 2: Linear GraphQL Fetch
**What:** POST to `https://api.linear.app/graphql` with `Authorization: <API_KEY>` header.
**When to use:** Fetch issue by identifier (e.g. `ENG-1234`), retrieve description field, extract image URL via regex.

```typescript
// Source: https://linear.app/developers/graphql (verified endpoint and auth)
const response = await fetch('https://api.linear.app/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': process.env.LINEAR_API_KEY!, // No "Bearer" prefix for personal API keys
  },
  body: JSON.stringify({
    query: `
      query GetIssue($id: String!) {
        issue(id: $id) {
          id
          identifier
          title
          description
          attachments {
            nodes {
              id
              url
              title
            }
          }
        }
      }
    `,
    variables: { id: ticketId }, // e.g. "ENG-1234" — works as shorthand identifier
  }),
});
const data = await response.json();
const issue = data.data.issue;
```

**Finding images:** Linear does NOT expose image attachments as structured API objects with downloadable URLs. Images pasted/dragged into tickets are embedded in the issue `description` as markdown (`![alt](https://uploads.linear.app/...)`). The `attachments` connection holds external links (GitHub PRs, Jira tickets) — not uploaded images.

**Image URL extraction from description:**
```typescript
// Source: [CITED: github.com/linear/linear/issues/1043]
const imageUrlRegex = /!\[.*?\]\((https:\/\/uploads\.linear\.app\/[^)]+)\)/g;
const matches = [...(issue.description ?? '').matchAll(imageUrlRegex)];
const imageUrl = matches[0]?.[1]; // first image found
```

**Downloading the image (auth risk — MEDIUM confidence):**
```typescript
// Linear docs say: Authorization: Bearer <ACCESS_TOKEN> for OAuth, Authorization: <API_KEY> for personal keys
// [CITED: linear.app/developers/graphql — auth section]
// Known risk: github.com/schpet/linear-cli/issues/211 — personal keys may 401 on uploads.linear.app
const imgResponse = await fetch(imageUrl, {
  headers: { 'Authorization': process.env.LINEAR_API_KEY! },
});
// If 401, retry with 'Authorization': `Bearer ${process.env.LINEAR_API_KEY}`
if (imgResponse.status === 401) {
  // surface clear error — see Pitfalls section
}
```

### Pattern 3: Anthropic Vision API (raw fetch)
**What:** POST to `https://api.anthropic.com/v1/messages` with two base64 images.
**When to use:** Design vs screenshot comparison.

```typescript
// Source: https://platform.claude.com/docs/en/api/messages-examples (VERIFIED)
const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'x-api-key': process.env.ANTHROPIC_API_KEY!,
    'anthropic-version': '2023-06-01',       // required header
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    model: 'claude-haiku-4-5',               // fastest, lowest cost, supports vision
    max_tokens: 1024,
    system: `You are a design QA assistant. Compare a design mockup and a live page screenshot.
Return ONLY valid JSON with this exact shape:
{
  "isUpdated": boolean,
  "confidence": "high" | "medium" | "low",
  "summary": string,
  "differences": string[],
  "matchingElements": string[]
}
Set isUpdated=true if the implementation substantially matches the design.
Set isUpdated=false if major design elements are missing or incorrect.`,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',        // design file — detect from response Content-Type
              data: base64DesignImage,        // raw base64, no data: URI prefix
            },
          },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',        // Playwright screenshot is always PNG
              data: base64Screenshot,
            },
          },
          {
            type: 'text',
            text: 'Image 1 is the design mockup. Image 2 is the live implementation screenshot. Does the implementation match the design?',
          },
        ],
      },
    ],
  }),
});
const result = await anthropicResponse.json();
const structured = JSON.parse(result.content[0].text);
```

**Model recommendation:** `claude-haiku-4-5` (alias `claude-haiku-4-5-20251001`). Fastest, cheapest, supports vision. Adequate for design comparison where pixel-perfect precision isn't needed. Use `claude-sonnet-4-6` if higher accuracy is required.
[VERIFIED: platform.claude.com/docs/en/about-claude/models/overview]

### Pattern 4: Bitbucket Pipelines Conditional Step

**Finding:** The `condition.state: glob()` syntax exists in Bitbucket Pipelines but only supports exact glob matches (e.g. `feature/*`). It cannot do regex substring matching like `[A-Z]+-\d+` inside a branch name.

**Recommended pattern: bash `if` inside the step script (not `condition.state`):**

```yaml
- step:
    name: Linear Design Validation
    size: 2x
    caches:
      - npm
    script:
      - npm ci
      - ./node_modules/.bin/playwright install chromium
      - |
        if [[ "$BITBUCKET_BRANCH" =~ [A-Z]+-[0-9]+ ]]; then
          LINEAR_TICKET="${BASH_REMATCH[0]}"
          echo "==> Linear ticket found: $LINEAR_TICKET"
          npx ts-node tests/linear/design-to-code-validation.spec.ts
        else
          echo "==> No Linear ticket ID in branch '$BITBUCKET_BRANCH' — skipping design validation."
          exit 0
        fi
```

**Alternative (also valid): Exit-early inside the TypeScript script:**
The script itself parses `$BITBUCKET_BRANCH`, exits 0 with a message if no ticket ID found. The YAML step then simply runs the script unconditionally. This is cleaner (logic in one place) and is the approach described in LIN-02 and LIN-06.

**Recommended approach: Let the TypeScript script handle the skip logic (LIN-02), and call it unconditionally from YAML.** The YAML step should always run post-deploy; the script exits 0 gracefully when no ticket ID is present. This means the YAML doesn't need any branch conditional at all — simplifying the pipeline.

[VERIFIED: atlassian.com/blog/bitbucket/introducing-dynamic-step-condition-for-bitbucket-pipelines]

### Pattern 5: ts-node with Existing tsconfig.json

The project `tsconfig.json` has `"module": "commonjs"` and `"rootDir": "."`, which means ts-node will work correctly with `import` statements compiled to CommonJS `require`. The `tests/linear/` path is under `"include": ["tests/**/*.ts"]` so TypeScript type-checking will cover it.

**Type compatibility note:** `visualHelpers.ts` imports `{ Page }` from `@playwright/test`. The script imports `chromium` from `playwright`. Both packages expose the same `Page` interface (they share the same underlying type), but TypeScript will see them as from different module paths and complain. Two solutions:
1. Cast: `await freezeAnimations(page as import('@playwright/test').Page)` — verbose but correct.
2. Import `Page` from `playwright` in `visualHelpers.ts` — would change the shared helper (not recommended).
3. Cast to `any` inside the script at the call sites — pragmatic, low-risk.

[VERIFIED: scripts/fetch-pipeline-artifacts.ts uses `import` with commonjs tsconfig and runs successfully via `npx ts-node`]

### Anti-Patterns to Avoid

- **Using `@playwright/test` Page in library-mode script:** `import { chromium } from '@playwright/test'` works but brings the test runner with it; use `import { chromium } from 'playwright'` to stay in pure library mode.
- **Putting `condition.state` regex logic in YAML:** The `condition.state` in Bitbucket Pipelines only supports glob, not regex. Use bash `[[ =~ ]]` or handle in the TypeScript script.
- **Using `output_config.format` for structured outputs:** This is a beta feature (requires beta headers); system-prompt JSON instructions are sufficient for a predictable two-image comparison task.
- **Assuming `attachments.nodes[].url` is a downloadable image URL:** Linear's `attachments` connection stores external link URLs (GitHub PRs, Jira tickets), not uploaded image blobs. Images are in `issue.description` markdown.
- **Writing temp files to the project working directory:** Use `os.tmpdir()` so files land in `/tmp/` on Linux CI and the OS temp directory locally.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Browser automation | Custom puppeteer/CDP script | `playwright` library mode | Already installed; same API as test helpers |
| Base64 encoding | Manual string manipulation | `Buffer.from(bytes).toString('base64')` | Node built-in; handles binary correctly |
| Image media type detection | Custom parser | Check response `Content-Type` header | Linear serves correct MIME type; `image/png`, `image/jpeg`, `image/gif`, `image/webp` are all Anthropic-supported |
| JSON output parsing | Regex on Claude response | `JSON.parse(result.content[0].text)` + try/catch | Claude returns clean JSON when prompted correctly |
| Regex ticket ID extraction | Complex string split | `/[A-Z]+-\d+/` — one-liner | Standard JS regex; works in bash and TypeScript |

---

## Common Pitfalls

### Pitfall 1: Linear Image Authentication (MEDIUM — known open issue)
**What goes wrong:** `fetch(imageUrl, { headers: { Authorization: process.env.LINEAR_API_KEY } })` returns 401.
**Why it happens:** Linear's uploads service (`uploads.linear.app`) may require OAuth tokens rather than personal API keys. This is a documented unresolved issue (github.com/schpet/linear-cli/issues/211).
**How to avoid:** Write explicit error handling: if status is 401/403, exit with a clear message like "Linear image download failed — the design image at uploads.linear.app returned 401. Ensure LINEAR_API_KEY is an OAuth token, or replace the image URL in the ticket description with a publicly accessible URL." Instruct users to paste a publicly accessible design URL in the ticket body as a fallback workflow.
**Warning signs:** HTTP 401 in logs during image download step.

### Pitfall 2: Image in Comments vs. Description
**What goes wrong:** Script searches `issue.description` for image URL but the designer attached the image in a comment, not the description.
**Why it happens:** Linear images can be in issue description OR comments; the GraphQL `issue` query only returns `description` by default.
**How to avoid:** Also query `comments { nodes { body } }` and parse both. Fall back: check comments if description has no image.
**Warning signs:** "No image found on ticket ENG-XXX" even though the ticket visually has an image.

### Pitfall 3: Playwright Page Type Mismatch
**What goes wrong:** TypeScript compiler error — `Page` from `playwright` is not assignable to `Page` from `@playwright/test`.
**Why it happens:** `visualHelpers.ts` imports `Page` from `@playwright/test`; the script imports `chromium` from `playwright`. TypeScript sees them as different nominal types.
**How to avoid:** Cast at call sites: `await freezeAnimations(page as any)`. Or use `// @ts-ignore` per call. Do not change `visualHelpers.ts` since it is shared with the test runner.
**Warning signs:** TS2345 error at compile time; does not affect runtime.

### Pitfall 4: testDir Picks Up tests/linear/
**What goes wrong:** `npx playwright test tests/visual/` accidentally runs `tests/linear/design-to-code-validation.spec.ts`.
**Why it happens:** `playwright.config.ts` sets `testDir: './tests'` which covers all subdirectories; the file ends in `.spec.ts`.
**How to avoid:** Add `testIgnore: ['tests/linear/**']` to `playwright.config.ts`.
**Warning signs:** Playwright test output mentions `design-to-code-validation` in test suite counts.

### Pitfall 5: `waitForLoadState('networkidle')` Timing on Live Staging
**What goes wrong:** `networkidle` hangs or times out on the live staging site because API polling keeps the network busy.
**Why it happens:** Live staging has long-running API calls (analytics, product APIs); network never truly idles.
**How to avoid:** Mirror the pattern from `HomePage.ts`: `await page.goto(url, { waitForLoadState: 'domcontentloaded' }); try { await page.waitForLoadState('networkidle', { timeout: 15_000 }); } catch { await page.waitForTimeout(3_000); }`. This is already battle-tested for this staging site.
**Warning signs:** Timeout errors at `waitForLoadState` step.

### Pitfall 6: Empty Branch Variable Locally
**What goes wrong:** `$BITBUCKET_BRANCH` is undefined when running the script locally (it is only set by Bitbucket Pipelines).
**Why it happens:** It is a CI-only environment variable.
**How to avoid:** The script should accept the branch name from the env var and exit 0 gracefully if the variable is absent: `const branch = process.env.BITBUCKET_BRANCH ?? ''; if (!branch) { console.log('No BITBUCKET_BRANCH set — running locally, skipping.'); process.exit(0); }`. Or accept a `--branch` CLI arg for local testing.

---

## Code Examples

### Linear GraphQL Issue Query (with description + comments)
```typescript
// Source: linear.app/developers/graphql (endpoint + auth verified)
// Source: github.com/linear/linear/issues/1043 (image location in description)
const query = `
  query GetIssueWithImages($id: String!) {
    issue(id: $id) {
      id
      identifier
      title
      description
      comments {
        nodes {
          body
        }
      }
      attachments {
        nodes {
          id
          url
          title
        }
      }
    }
  }
`;

const response = await fetch('https://api.linear.app/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': process.env.LINEAR_API_KEY!,
  },
  body: JSON.stringify({ query, variables: { id: ticketId } }),
});
const json = await response.json() as { data: { issue: LinearIssue } };
```

### Extract Image URL from Markdown
```typescript
// Source: github.com/linear/linear/issues/1043 (parsing pattern confirmed)
function extractImageUrl(markdown: string): string | null {
  const regex = /!\[.*?\]\((https:\/\/uploads\.linear\.app\/[^)]+)\)/;
  const match = markdown.match(regex);
  return match?.[1] ?? null;
}

const designImageUrl =
  extractImageUrl(issue.description ?? '') ??
  issue.comments?.nodes?.map(c => extractImageUrl(c.body ?? '')).find(Boolean) ??
  null;
```

### Anthropic Vision Comparison (raw fetch, system-prompt JSON)
```typescript
// Source: platform.claude.com/docs/en/api/messages-examples (verified)
// Source: platform.claude.com/docs/en/about-claude/models/overview (model IDs verified)
const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'x-api-key': process.env.ANTHROPIC_API_KEY!,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    system: `You are a design QA assistant. Compare the two images and return ONLY valid JSON with no markdown fencing:
{
  "isUpdated": boolean,
  "confidence": "high" | "medium" | "low",
  "summary": "one sentence",
  "differences": ["list of visual differences"],
  "matchingElements": ["list of matching elements"]
}
Set isUpdated=true if the implementation substantially matches the design intent.`,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64Design } },
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64Screenshot } },
        { type: 'text', text: 'Image 1 = design mockup. Image 2 = live implementation. Does the implementation match the design?' },
      ],
    }],
  }),
});
const msg = await anthropicRes.json();
const structured: ValidationResult = JSON.parse(msg.content[0].text);
```

### Bitbucket Pipelines Step (unconditional run, script handles skip)
```yaml
# Source: existing bitbucket-pipelines.yml patterns (verified in codebase)
# Skip logic is inside the TypeScript script (LIN-02) — no YAML branching needed
- step:
    name: Linear Design Validation
    size: 2x
    caches:
      - npm
    script:
      - npm ci
      - ./node_modules/.bin/playwright install chromium
      - >-
        BASE_URL=https://stage.livguardsolar.com
        npx ts-node tests/linear/design-to-code-validation.spec.ts
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Linear formal attachment objects | Images embedded in issue description markdown | Always — Linear never had image attachment objects | Must parse description markdown to find images |
| Anthropic SDK for vision | Raw `fetch` with `base64` source type | API stable since 2023 | No SDK needed; `anthropic-version: 2023-06-01` header works |
| Playwright test runner only | `playwright` as a library (`chromium.launch()`) | Playwright 1.0+ | Can use full Playwright API without test runner |

**Deprecated / watch out for:**
- `output_config.format` structured outputs: public beta as of April 2026; requires no extra beta header on latest models. However, system-prompt JSON instructions are fully adequate for this use case and have no beta dependencies.
- `condition.state` with regex in Bitbucket Pipelines: Not supported — only glob patterns. Use bash `[[ =~ ]]` for regex matching.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `uploads.linear.app` images are accessible with `Authorization: <API_KEY>` header (no Bearer prefix) | Pitfall 1, Pattern 2 | Image download fails with 401; script exits 1 on every Linear-branched PR |
| A2 | Design image will be in the issue description (not a comment) as the primary case | Pattern 2, Code Examples | Script misses the image; exits 1 with "no image found" |
| A3 | `claude-haiku-4-5` vision output quality is sufficient for design-vs-screenshot comparison | Pattern 3 | Low-quality analysis; may need upgrade to `claude-sonnet-4-6` |
| A4 | `STAGING_URL` + `VERIFY_PATH` env vars will be set in the Bitbucket step; no documented default | Pattern 4, Bitbucket step | Script cannot navigate to the correct page; needs runtime check |

---

## Open Questions (RESOLVED)

1. **Linear image authentication** — RESOLVED
   - Decision: Script attempts download with `Authorization: <API_KEY>`, retries with `Bearer <API_KEY>`, then retries without auth. If all fail, exits 1 with a message instructing the user to switch to an OAuth token. This is reflected in `downloadImage()` in the plan.

2. **Which page does VERIFY_PATH point to?** — RESOLVED
   - Decision: `VERIFY_PATH` is a required env var (script exits 1 if absent). Screenshot uses `fullPage: false` (viewport) to match design mockup aspect ratio. Documented in LIN-06 and the pipeline step env vars.

3. **What media type does the design image have?** — RESOLVED
   - Decision: Read `Content-Type` from the download response. Map `image/jpeg`, `image/jpg`, `image/png`, `image/gif`, `image/webp` to Anthropic-supported types; default to `image/png` if absent. Reflected in `downloadImage()` mediaTypeMap.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js fetch | Linear API, Anthropic API, image download | ✓ | Node 20.10.0 | — |
| `playwright` package | chromium.launch() | ✓ | ^1.50.0 (package.json) | — |
| `ts-node` | Script execution | ✓ | 10.9.2 | — |
| `LINEAR_API_KEY` | Linear ticket fetch | Not verified | — | CI env var — must be added to Bitbucket repo variables |
| `ANTHROPIC_API_KEY` | Claude vision API | Not verified | — | CI env var — must be added to Bitbucket repo variables |
| `STAGING_URL` | Page navigation | Not verified | — | Could default to `https://stage.livguardsolar.com` |
| `VERIFY_PATH` | Page navigation | Not verified | — | Required; no sensible default |
| Chromium binary | Page screenshot | ✓ (CI image) | Playwright 1.50.0 Docker image | Runs `playwright install chromium` in pipeline step |

**Missing dependencies with no fallback:**
- `LINEAR_API_KEY` — must be added to Bitbucket repository variables (Settings → Repository variables)
- `ANTHROPIC_API_KEY` — same
- `VERIFY_PATH` — must be passed to the pipeline step

**Missing dependencies with fallback:**
- `STAGING_URL` — can default to `https://stage.livguardsolar.com` in the script

[VERIFIED: node --version, package.json, bitbucket-pipelines.yml]

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | No test framework — this is a standalone script, not a test suite |
| Config file | N/A |
| Quick run command | `BITBUCKET_BRANCH=feature/ENG-1234-test LINEAR_API_KEY=... ANTHROPIC_API_KEY=... STAGING_URL=https://stage.livguardsolar.com VERIFY_PATH=/ npx ts-node tests/linear/design-to-code-validation.spec.ts` |
| Full suite command | Same — single script |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LIN-01 | Script is NOT in `npx playwright test tests/visual/` output | manual-only | `npx playwright test tests/visual/ --list` — verify no `design-to-code` in output | ❌ Wave 0 |
| LIN-02 | Script exits 0 when no ticket ID in branch | unit smoke | `BITBUCKET_BRANCH=feature/no-ticket npx ts-node tests/linear/design-to-code-validation.spec.ts; echo $?` | ❌ Wave 0 |
| LIN-03 | Script exits 1 with message when ticket has no image | manual-only | Requires live LINEAR_API_KEY | N/A |
| LIN-04 | Screenshot uses 1440×900 viewport | manual-only | Verify screenshot dimensions in temp file | N/A |
| LIN-05 | Anthropic response parsed into correct shape | manual-only | Inspect script console output | N/A |
| LIN-06 | Pipeline step skips on non-Linear branch | smoke (pipeline) | Push non-Linear branch, observe pipeline step output | N/A |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit` (type-check the script without running it)
- **Per wave merge:** `BITBUCKET_BRANCH=test npx ts-node tests/linear/design-to-code-validation.spec.ts` (local dry-run with no ticket)
- **Phase gate:** Full end-to-end test with real `LINEAR_API_KEY`, `ANTHROPIC_API_KEY`, a real Linear ticket with a design image, and `STAGING_URL`/`VERIFY_PATH` set

### Wave 0 Gaps
- [ ] `tests/linear/` directory — create folder
- [ ] `tests/linear/design-to-code-validation.spec.ts` — new file (the deliverable itself)
- [ ] `playwright.config.ts` — add `testIgnore: ['tests/linear/**']` to prevent test runner pickup (LIN-01)
- [ ] `bitbucket-pipelines.yml` — add post-deploy step (LIN-06)

*(No separate test files needed — the script itself is the deliverable; isolation is verified manually via `--list`)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A — CI step only, no user auth |
| V3 Session Management | No | Stateless script |
| V4 Access Control | Yes | `LINEAR_API_KEY` and `ANTHROPIC_API_KEY` must be stored as Bitbucket secured variables (not plain text) |
| V5 Input Validation | Yes | Ticket ID parsed with strict regex `/[A-Z]+-\d+/`; image URLs validated before download |
| V6 Cryptography | No | No custom crypto; HTTPS for all API calls |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API key exposure in logs | Information Disclosure | Never `console.log` env vars; Bitbucket secured variables are masked in logs |
| Malicious image in ticket description | Tampering | Only send to Anthropic API (sandboxed vision inference); never `eval` or execute image content |
| SSRF via VERIFY_PATH | Tampering | Validate that `VERIFY_PATH` starts with `/`; append to known `STAGING_URL` only |
| Unvalidated JSON parse from Anthropic | Tampering | Wrap `JSON.parse(msg.content[0].text)` in try/catch; handle malformed response gracefully |

---

## Sources

### Primary (HIGH confidence)
- `playwright.dev/docs/library` — chromium.launch() library mode, import pattern, context/page API
- `platform.claude.com/docs/en/api/messages-examples` — exact headers (`x-api-key`, `anthropic-version: 2023-06-01`, `content-type`), base64 image content shape, vision example
- `platform.claude.com/docs/en/about-claude/models/overview` — current model IDs: `claude-haiku-4-5`, `claude-sonnet-4-6`, `claude-opus-4-7`; all support vision
- `linear.app/developers/graphql` — endpoint `https://api.linear.app/graphql`, `Authorization: <API_KEY>` header, `issue(id: "ENG-123")` shorthand query
- `atlassian.com/blog/bitbucket/introducing-dynamic-step-condition-for-bitbucket-pipelines` — `condition.state: glob()` syntax; bash `[[ =~ ]]` alternative

### Secondary (MEDIUM confidence)
- `github.com/linear/linear/issues/1043` — confirmed images stored in issue description markdown at `uploads.linear.app`, not as structured attachment API objects
- `github.com/schpet/linear-cli/issues/211` — personal API key 401 on uploads.linear.app (known auth issue, unresolved as of last update)
- `platform.claude.com/docs/en/build-with-claude/structured-outputs` — system-prompt JSON vs `output_config.format` tradeoffs

### Tertiary (LOW confidence — verify before use)
- `github.com/0xBigBoss/linear-cli/blob/main/skills/linear/graphql-recipes.md` — query patterns including relations; no attachments query
- Multiple search results re: `attachments { nodes { url } }` query shape — confirmed via schema search but not directly tested

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed; versions verified from package.json and node --version
- Architecture: HIGH — Playwright library mode, Anthropic raw fetch, Linear GraphQL endpoint all verified from official docs
- Linear image auth: MEDIUM — known open issue with personal API keys; flagged as A1 in assumptions log
- Bitbucket Pipelines: HIGH — bash-if-inside-script is the verified safe pattern; `condition.state` limitation confirmed from official docs
- Pitfalls: HIGH (types, testDir pickup, networkidle) / MEDIUM (Linear auth)

**Research date:** 2026-04-27
**Valid until:** 2026-07-27 (stable APIs) except Linear image auth behaviour — re-verify if Linear releases an update
