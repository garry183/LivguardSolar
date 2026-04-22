# Roadmap: Livguard Solar 360 — Visual Regression Suite

## Overview

Five phases complete the v1 visual regression suite. The foundation (rooftop-solar, solar-for-home, solar-for-commercial, HAR isolation, CI pipeline) is already shipped. This roadmap locks the last unlocked baseline, extends coverage to city pages and lead/form pages, unparks the homepage, then wires the entire framework to Jenkins so every staging deploy triggers an automated visual gate.

## Phases

- [ ] **Phase 1: Lock Baselines** - Remove `--update-snapshots` from solar-for-commercial after CI runs clean
- [ ] **Phase 2: City Pages Functional Checks** - Parameterised spec verifying city name and footer links for all ~17 city pages
- [ ] **Phase 3: Lead/Form Pages Visual Regression** - HAR-isolated visual regression for lead/form pages on all 3 browsers
- [ ] **Phase 4: Homepage Fix and Unpark** - Fix React hydration failure, re-record HAR, lock homepage baselines
- [ ] **Phase 5: Jenkins Webhook Integration** - Bitbucket webhook triggers the visual framework on every staging deploy

## Phase Details

### Phase 1: Lock Baselines
**Goal**: Every currently-shipped page has immutable, locked baselines — no pipeline step still passes `--update-snapshots`
**Depends on**: Nothing (first phase — foundation already shipped)
**Requirements**: BASE-01
**Success Criteria** (what must be TRUE):
  1. solar-for-commercial pipeline step passes on all 3 browsers without `--update-snapshots` and without retries
  2. Any future pixel change to solar-for-commercial causes CI to fail, not silently update
  3. The `--update-snapshots` flag is absent from the pipeline YAML for solar-for-commercial
**Plans**: 1 plan

Plans:
- [ ] 01-01: Remove `--update-snapshots` from solar-for-commercial pipeline step, verify CI passes clean on all 3 browsers

---

### Phase 2: City Pages Functional Checks
**Goal**: All ~17 city pages are automatically verified for correct city name display and correct footer link navigation, running on chromium-desktop in CI
**Depends on**: Phase 1
**Requirements**: CITY-01, CITY-02, CITY-03, CITY-04
**Success Criteria** (what must be TRUE):
  1. A single parameterised spec file covers all ~17 city pages without manual duplication
  2. CI fails if a city page displays the wrong city name for its URL slug
  3. CI fails if a city page footer link navigates to the wrong city URL
  4. The city spec runs only on chromium-desktop in CI (not mobile-chrome or mobile-safari)
**Plans**: 2 plans

Plans:
- [ ] 02-01: Write parameterised city spec — URL slug list, city name assertion, footer link navigation assertion
- [ ] 02-02: Add chromium-desktop-only city spec step to Bitbucket pipeline, verify all ~17 pages pass

---

### Phase 3: Lead/Form Pages Visual Regression
**Goal**: Lead and form pages have HAR-isolated visual regression running on all 3 browsers with locked baselines
**Depends on**: Phase 2
**Requirements**: FORM-01, FORM-02, FORM-03, FORM-04
**Success Criteria** (what must be TRUE):
  1. HAR files are recorded for all lead/form pages using the full-page scroll test pattern
  2. Visual regression spec exists with section-level snapshots for each lead/form page
  3. The spec passes on chromium-desktop, mobile-chrome, and mobile-safari in CI
  4. Baselines are locked — `--update-snapshots` is absent from the pipeline step after the initial baseline run
**Plans**: 2 plans

Plans:
- [ ] 03-01: Record HAR for lead/form pages using full-page scroll test; write section-level visual regression spec
- [ ] 03-02: Add all-3-browser pipeline step, generate baselines in CI, lock by removing `--update-snapshots`

---

### Phase 4: Homepage Fix and Unpark
**Goal**: Homepage visual regression is unparked, passing on all 3 browsers in CI with locked baselines
**Depends on**: Phase 3
**Requirements**: HOME-01, HOME-02, HOME-03, HOME-04
**Success Criteria** (what must be TRUE):
  1. The root cause of the React hydration failure is identified and documented
  2. HAR is re-recorded for the homepage using the full-page scroll test (valid, no htmlLen mismatch)
  3. Homepage spec passes on chromium-desktop, mobile-chrome, and mobile-safari in CI without retries
  4. Homepage baselines are locked — `--update-snapshots` absent from the pipeline step
**Plans**: 2 plans

Plans:
- [ ] 04-01: Diagnose and fix React hydration failure; re-record homepage HAR using full-page scroll test
- [ ] 04-02: Unpark homepage spec in pipeline, generate baselines in CI, lock baselines

---

### Phase 5: Jenkins Webhook Integration
**Goal**: Every successful staging deploy automatically triggers the full visual regression framework via Bitbucket webhook, with results visible without manual intervention
**Depends on**: Phase 4
**Requirements**: JENK-01, JENK-02, JENK-03, JENK-04
**Success Criteria** (what must be TRUE):
  1. A staging deploy in Jenkins fires a Bitbucket webhook automatically (no manual trigger needed)
  2. The webhook causes the Bitbucket pipeline (or Jenkins job) to run the full visual framework
  3. Pass/fail result is visible in Jenkins or Bitbucket without digging into logs
  4. The webhook setup and runbook are documented so the process can be reproduced or debugged
**Plans**: 2 plans

Plans:
- [ ] 05-01: Configure Bitbucket webhook on Jenkins staging deploy event; wire Jenkins job to receive and trigger pipeline
- [ ] 05-02: Verify end-to-end trigger on a real staging deploy; document webhook setup in project runbook

---

## Progress

**Execution Order:** 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Lock Baselines | 0/1 | Not started | - |
| 2. City Pages Functional Checks | 0/2 | Not started | - |
| 3. Lead/Form Pages Visual Regression | 0/2 | Not started | - |
| 4. Homepage Fix and Unpark | 0/2 | Not started | - |
| 5. Jenkins Webhook Integration | 0/2 | Not started | - |

---

## Coverage

**v1 requirements:** 17 total
**Mapped:** 17/17

| Requirement | Phase | Status |
|-------------|-------|--------|
| BASE-01 | Phase 1 | Pending |
| CITY-01 | Phase 2 | Pending |
| CITY-02 | Phase 2 | Pending |
| CITY-03 | Phase 2 | Pending |
| CITY-04 | Phase 2 | Pending |
| FORM-01 | Phase 3 | Pending |
| FORM-02 | Phase 3 | Pending |
| FORM-03 | Phase 3 | Pending |
| FORM-04 | Phase 3 | Pending |
| HOME-01 | Phase 4 | Pending |
| HOME-02 | Phase 4 | Pending |
| HOME-03 | Phase 4 | Pending |
| HOME-04 | Phase 4 | Pending |
| JENK-01 | Phase 5 | Pending |
| JENK-02 | Phase 5 | Pending |
| JENK-03 | Phase 5 | Pending |
| JENK-04 | Phase 5 | Pending |

---
*Roadmap created: 2026-04-22*
