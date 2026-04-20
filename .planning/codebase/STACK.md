# STACK.md — Technology Stack
_Last updated: 2026-04-20_

## Language & Runtime
- **TypeScript** 5.7.0 (strict mode, target ES2022, CommonJS modules)
- **Node.js** 20.x
- **Package manager**: npm (package-lock.json present)

## Core Framework
- **Playwright** 1.50.0 (`@playwright/test`) — test runner + browser automation + visual snapshots
- **Playwright Core** 1.50.0

## Reporting Libraries
- `allure-playwright` 3.5.0 — Allure test reporter
- `allure-commandline` 2.37.0 — Allure HTML report generation (local only; Java required)
- `allure-js-commons` — Allure shared utilities

## Dev Dependencies
- `typescript` 5.7.0
- `ts-node` 10.9.2 — TypeScript script execution (brain analysis, utility scripts)
- `@types/node` 25.3.3
- `c8` 11.0.0 — code coverage (not actively used)

## Build & Config
- `tsconfig.json`: target ES2022, CommonJS, strict, rootDir `.`, include `tests/**`, `brain/**`, `playwright.config.ts`, `global-teardown.ts`
- No bundler (ts-node for scripts, Playwright handles test compilation)

## CI/CD
- **Bitbucket Pipelines** (`bitbucket-pipelines.yml`) — primary CI
  - Docker image: `mcr.microsoft.com/playwright:v1.50.0-jammy`
  - Runner size: `4x` (4 vCPU, 16 GB RAM)
  - npm cache enabled (`~/.npm`)
- **GitHub Actions** (`.github/workflows/visual-tests.yml`) — legacy, effectively replaced by Bitbucket
  - ubuntu-latest, Node 20, installs chromium + webkit only

## Browser Coverage
| Project | Browser | Viewport |
|---------|---------|----------|
| `chromium-desktop` | Desktop Chrome | 1440×900 |
| `mobile-chrome` | Pixel 5 (Chrome) | 393×851 |
| `mobile-safari` | iPhone 13 (WebKit) | 390×844 |

Font rendering flags on Chromium projects: `--font-render-hinting=none`, `--disable-font-subpixel-positioning`, `--disable-lcd-text`, `--force-device-scale-factor=1`

## Key npm Scripts
| Script | Purpose |
|--------|---------|
| `test:visual` | Run all visual tests + brain analysis |
| `test:update-snapshots` | Regenerate all baselines |
| `test:desktop` | Chromium-desktop only |
| `test:mobile` | mobile-chrome only |
| `test:record-har` | Record HAR for CI replay |
| `brain:analyze` | Standalone brain re-analysis |
| `ci:artifacts` | Fetch artifacts from Bitbucket Pipelines |
| `allure:serve` | Serve Allure report |

## Environment Variables
| Variable | Purpose | Default |
|----------|---------|---------|
| `BASE_URL` | Target URL | `https://www.livguardsolar.com` |
| `CI` | Enables CI mode (parallel, retries, longer timeouts) | unset |
| `RECORD_HAR` | Activates HAR recording mode | unset |
| `BITBUCKET_USERNAME` | Bitbucket API auth | (from .env) |
| `BITBUCKET_APP_PASSWORD` | Bitbucket API auth | (from .env) |
| `DEBUG=pw:api` | Playwright API debug logging | unset |
