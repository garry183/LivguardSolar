# Linear Design-to-Code Validation

Automatically compares a Figma/design image from a Linear ticket against the live staging page after every deploy — no manual review needed.

---

## How it works

1. A developer pushes a branch prefixed with `ui/` or `design/` (e.g. `ui/LTD-2390-homepage-revamp`)
2. The Bitbucket pipeline runs visual tests, then triggers this script
3. The script reads the ticket ID from the branch name, fetches the ticket from Linear, finds the design image and verify path, screenshots the staging page, and asks Gemini Vision to compare the two
4. Pipeline passes (`exit 0`) if the implementation matches the design, fails (`exit 1`) if it does not
5. All other branch prefixes (`feature/`, `fix/`, `chore/`, etc.) are skipped immediately — zero API calls

---

## What is required in the Linear ticket

### 1. Branch name must start with `ui/` or `design/` (MANDATORY)

This is the trigger. Branches without this prefix are skipped with zero API calls — no Linear or Gemini requests made.

```
ui/LTD-2390-homepage-revamp      ✅  runs validation
design/LTD-2390-hero-update      ✅  runs validation
feature/LTD-2390-homepage        ❌  skipped (not a ui/ or design/ branch)
fix/LTD-2390-button-fix          ❌  skipped
chore/LTD-2390-cleanup           ❌  skipped
```

### 2. Branch name must contain the ticket ID (MANDATORY)

The ticket ID must be present in the branch name — it is how the script knows which Linear ticket to fetch.

```
ui/LTD-2390-homepage-revamp      ✅  ticket LTD-2390 fetched
ui/homepage-revamp               ❌  no ticket ID — script skips
```

The ticket ID format is `[TEAM KEY]-[NUMBER]`, e.g. `LTD-2390`.

### 3. Design image pasted into the ticket (MANDATORY)

Paste the design image (Figma export, screenshot, or mockup) **directly into the ticket description or a comment**. Do not attach it as a file — it must be an inline image that uploads to Linear's CDN.

How to do it:
- Export the relevant page/frame from Figma as PNG
- Open the Linear ticket
- Drag and drop the PNG into the **description** field, or paste it with Ctrl+V
- You will see the image appear inline — it is now hosted at `uploads.linear.app`

```
Description:

Verify: /solar-for-home

[paste image here — it uploads automatically to uploads.linear.app]
```

If no image is found, the pipeline will fail with:
```
ERROR: No design image found on ticket LTD-2390.
```

### 4. Verify path in the ticket description (OPTIONAL)

Add a `Verify:` line anywhere in the ticket description to specify which page to screenshot:

```
Verify: /solar-for-home
```

| Example line | Page screenshotted |
|---|---|
| `Verify: /` | Homepage |
| `Verify: /solar-for-home` | Solar for Home page |
| `Verify: /solar-for-commercial` | Solar for Commercial page |
| `Verify: /rooftop-solar` | Rooftop Solar page |
| *(line absent)* | Defaults to `/` (homepage) |

The path must start with `/`. It is appended to `STAGING_URL`.

---

## Example ticket description

```
This PR updates the homepage hero section to match the new Figma design.

Verify: /

[design image pasted here]
```

That's all — no tags, no labels, no special Linear configuration needed.

---

## Bitbucket repository variables required

Set these in **Bitbucket → Repository settings → Repository variables**:

| Variable | Description |
|---|---|
| `LINEAR_API_KEY` | Linear personal API key — get it from Linear → Settings → Account → API |
| `GEMINI_API_KEY` | Google Gemini API key — get it from [aistudio.google.com](https://aistudio.google.com) |
| `STAGING_URL` | Base URL of the staging site, e.g. `https://stage.livguardsolar.com` |

---

## Running locally

```powershell
$env:BITBUCKET_BRANCH="ui/LTD-2390-homepage-revamp"
$env:LINEAR_API_KEY="your_linear_key"
$env:GEMINI_API_KEY="your_gemini_key"
$env:STAGING_URL="https://stage.livguardsolar.com"
npx ts-node tests/linear/design-to-code-validation.spec.ts
```

---

## Pipeline output

On pass:
```
[linear-validate] PASS — implementation matches design.
```

On fail:
```
[linear-validate] FAIL — implementation does not match design.
Differences:
  - Hero section headline is missing
  - CTA button colour does not match design
```

On skip (non-UI branch):
```
[linear-validate] Branch 'feature/LTD-2390-backend-fix' is not a ui/ or design/ branch — skipping design validation.
```

On skip (no ticket ID):
```
[linear-validate] No Linear ticket ID found in branch 'ui/homepage-revamp' — skipping design validation.
```
