---
phase: 6
slug: 06-linear-design-validation
date: 2026-04-28
---

# Phase 6: Linear Design-to-Code Validation — Validation Strategy

## Test Framework

| Property | Value |
|----------|-------|
| Framework | No test framework — this is a standalone script, not a test suite |
| Config file | N/A |
| Quick run command | `BITBUCKET_BRANCH=feature/ENG-1234-test LINEAR_API_KEY=... ANTHROPIC_API_KEY=... STAGING_URL=https://stage.livguardsolar.com VERIFY_PATH=/ npx ts-node tests/linear/design-to-code-validation.spec.ts` |
| Full suite command | Same — single script |

## Phase Requirements → Validation Map

| Req ID | Behavior | Validation Type | Automated Command | Wave |
|--------|----------|-----------------|-------------------|------|
| LIN-01 | Script is NOT in `npx playwright test tests/visual/` output | manual + automated | `npx playwright test tests/visual/ --list 2>&1 \| grep -ic "design-to-code"` — must return 0 | Wave 1 |
| LIN-02 | Script exits 0 when no ticket ID in branch | smoke (automated) | `BITBUCKET_BRANCH=feature/no-ticket npx ts-node tests/linear/design-to-code-validation.spec.ts; echo $?` — must print skip message and exit 0 | Wave 1 |
| LIN-02 | Script exits 0 when BITBUCKET_BRANCH is unset | smoke (automated) | `BITBUCKET_BRANCH= npx ts-node tests/linear/design-to-code-validation.spec.ts; echo $?` — must print "No BITBUCKET_BRANCH set" and exit 0 | Wave 1 |
| LIN-03 | Linear GraphQL query includes description + comments | code review | `grep "comments" tests/linear/design-to-code-validation.spec.ts` — must return lines | Wave 1 |
| LIN-03 | Auth retry on 401 | code review | `grep "401" tests/linear/design-to-code-validation.spec.ts` — must return lines | Wave 1 |
| LIN-04 | Screenshot uses chromium.launch() at 1440×900 | code review | `grep "chromium.launch\|1440" tests/linear/design-to-code-validation.spec.ts` — must return lines | Wave 1 |
| LIN-04 | visualHelpers reused | code review | `grep "freezeAnimations\|triggerLazyLoad\|waitForAllImages" tests/linear/design-to-code-validation.spec.ts` — must return ≥3 lines | Wave 1 |
| LIN-05 | Anthropic API called with correct headers and model | code review | `grep "anthropic-version.*2023-06-01\|claude-haiku-4-5-20251001" tests/linear/design-to-code-validation.spec.ts` — must return lines | Wave 1 |
| LIN-05 | Structured result parsed and exit code set | code review | `grep "isUpdated\|process.exit" tests/linear/design-to-code-validation.spec.ts` — must return lines | Wave 1 |
| LIN-06 | Pipeline step exists and wires all 4 env vars | automated | `grep "Linear Design Validation\|LINEAR_API_KEY\|ANTHROPIC_API_KEY\|STAGING_URL\|VERIFY_PATH" bitbucket-pipelines.yml` — must return ≥5 lines | Wave 2 |

## Sampling Rate

| Checkpoint | Command |
|------------|---------|
| Per task commit | `npx tsc --noEmit` — type-check the script without running it |
| Per wave 1 merge | `BITBUCKET_BRANCH=test npx ts-node tests/linear/design-to-code-validation.spec.ts` — dry-run with no ticket ID, expect exit 0 |
| Phase gate (manual) | Full end-to-end: real `LINEAR_API_KEY`, `ANTHROPIC_API_KEY`, real Linear ticket with design image, `STAGING_URL` + `VERIFY_PATH` set |

## Wave Gaps to Fill

- [ ] `tests/linear/` directory — create folder (Wave 1)
- [ ] `tests/linear/design-to-code-validation.spec.ts` — the deliverable itself (Wave 1)
- [ ] `playwright.config.ts` — add `testIgnore` to prevent test runner pickup (Wave 1)
- [ ] `bitbucket-pipelines.yml` — add post-deploy step (Wave 2)

## Notes

- No separate test files are needed. The script itself is the deliverable.
- LIN-01 isolation is verified by running the playwright test runner with `--list` and confirming zero matches for `design-to-code`.
- LIN-03 image auth (401 behaviour on uploads.linear.app) cannot be fully automated without a real LINEAR_API_KEY — tested manually at phase gate.
- TypeScript compilation (`npx tsc --noEmit`) is the primary per-commit gate since the script cannot run without real API keys.
