# CATALOG-SWEEP-C-2406 - acceptance / release gate / manual NOT_RUN sweep, and the 07.11 lab runbook

Branch `chore/CATALOG-SWEEP-C-2406` from `release/2405-train` @ `eadc5b080`. Documentation only: no product code, no test, no
`management/test_catalog.json` or `management/tasks.json` edit. No lab, Home Assistant, WisKey, NVR or station contact; the runner was
only read (nightly reports and release gate reports under `~/smplwise-results/`).

## 1. Scope

Every `management/test_catalog.json` row (at `eadc5b080`) with status `NOT_RUN` and kind `acceptance` (43), `release gate` (11) or
`manual/visual` (3): **57 rows**. Each row is put in one class:

| Class | Meaning | Count |
|---|---|---|
| COVERED-AUTO | proven by automated tests; receipts = nightly per-file counts, runner gate report on the exact tag commit, tag | **25** |
| LAB | needs the real installation, devices or a phone; mapped to steps of the 07.11 runbook | **17** |
| OWNER | needs an owner judgement or decision (nothing to run) | **7** |
| BLOCKED-WISKEY | waits on the WisKey team | **8** |

Per-row results, reasons, test files with nightly counts and receipts: `docs/changes/receipts/CATALOG-SWEEP-C-2406.json`.

## 2. Method and the nightly receipt

- Nightly: `main` @ `eab715e53` (v2.40.4), tier L, **PASS**, 2026-11-06 02:00-04:08 UTC (runner
  `~/smplwise-results/nightly/gate_main_eab715e53.md`): tsc, build, release_check, dev 1049, preview 19547, fixture 28, pixel 309,
  backend 20818 passed; 0 failed; flaky 17 (retried green); 4 quarantined tests (listed in the JSON).
- A per-file index was built read-only from the nightly logs (`backend_s*.xml` junit, `pw_*.json` Playwright reports; 892 backend
  modules, 1004 spec files). Every test file named in a row's change record(s) was looked up there; only files with passing results on
  the first attempt or after a retry are listed. Live-only specs that the nightly skips (e.g. `evidence-plan-studio-4`,
  `evidence-tabs-live`, `evidence-mobile-wall-kiosk`, `guide-screenshots`) are never counted as proof.
- Release gates: every tag v2.36.0 ... v2.40.1 is an ancestor of `eab715e53`, and each has a runner gate report with verdict PASS on the
  exact tag commit (`gate_<branch>_<sha>.md` + `.gate2.md`); the earlier failing gate of a train is listed where it explains a gate-fix
  card (GATE2370, GATE2380).
- Decision rule for LAB vs COVERED-AUTO: a row is COVERED-AUTO only when its acceptance sentence is about behaviour a test can prove
  without the installation (selection logic, settings rows, contract pins, UI rendering, release mechanics). A row whose acceptance names
  a real station, a real call, a real WisKey answer, a restart or a person at a door is LAB, even when its code is fully tested on fakes.

## 3. Findings

1. **`GUIDE_ALL_HE.html` is stale on the 2.40.5 train.** `python scripts/build_guide.py --check` fails at `eadc5b080`
   ("GUIDE_ALL_HE.html is stale"); it passes on `ccb77f28d` (2.40.2) and `eab715e53` (2.40.4). Cause: WXH-LEFTOVERS-2405 (`b5aa0548c`)
   edited `docs/user-guide/he/` without rebuilding. Fix on `release/2405-train` before its tag: run `scripts/build_guide.py` and commit.
   Not fixed here (outside this branch's scope; the train owns it).
2. **T091 (Hebrew documentation) is far from its acceptance.** `scripts/docs_he_check.py` at `eadc5b080`: 11 drifted mirrors, 42
   mirrors without a header, 293 sources with no mirror. `guide-screenshots.spec.ts` is opt-in (`SW_GUIDE=1`) and skipped by the
   nightly. AT181-AT183 are OWNER: the owner decides whether and when the full mirror and role training are still wanted.
3. **WISKEY-STATUS-PAGE-2382** was never compared line by line with its T3 list; that is now runbook step D2 (lead, read-only).
4. **STATION-WS-PATH-2381**: the unit spec replays only the Ingress base; the remote `/arx/` path has no test. Step D3 covers it on
   the phone.
5. The 2.40.4 release gate on `eab715e53` first failed only on quarantined tests and passed on the quarantine re-run; the nightly on the
   same commit passed outright (consistent with the quarantine list).

## 4. Row results

| Row | Kind | Class | Test files with nightly passes | Runbook steps |
|---|---|---|---|---|
| AT-RELEASE-2360-TRAIN-1 | release gate | COVERED-AUTO | 2 | - |
| AT-RELEASE-2361-TRAIN-1 | release gate | COVERED-AUTO | 2 | - |
| AT-RELEASE-2370-TRAIN-1 | release gate | COVERED-AUTO | 4 | - |
| AT-RELEASE-2380-TRAIN-1 | release gate | COVERED-AUTO | 5 | - |
| AT-RELEASE-2371-WISKEY-1 | release gate | COVERED-AUTO | 20 | - |
| AT-GATE2370-1 | acceptance | COVERED-AUTO | 4 | - |
| AT-TV-SETTINGS-2380-1 | acceptance | COVERED-AUTO | 2 | C10 |
| AT-DARK-SEG-ALL-2380-1 | acceptance | COVERED-AUTO | 3 | - |
| AT-PUSH-RELAY-SAFE-2380-1 | acceptance | COVERED-AUTO | 8 | - |
| AT-A11Y-R4-LEFTOVERS-2380-1 | acceptance | COVERED-AUTO | 19 | - |
| AT-GATE2380-1 | acceptance | COVERED-AUTO | 5 | - |
| AT-RELEASE-2381-1 | release gate | COVERED-AUTO | 1 | - |
| AT-RELEASE-2382-TRAIN-1 | release gate | COVERED-AUTO | 5 | - |
| AT-TV-CHIPS-2381-1 | acceptance | COVERED-AUTO | 14 | - |
| AT-DIALOG-TOPLAYER-2381-1 | acceptance | COVERED-AUTO | 3 | B8 |
| AT-WISKEY-TALK-CAPS-2382-1 | acceptance | COVERED-AUTO | 7 | D7 |
| AT-WISKEY-PAIRING-2382-1 | acceptance | COVERED-AUTO | 2 | D1 |
| AT-WISKEY-JOIN-LIVE-2382-1 | acceptance | COVERED-AUTO | 7 | D2 |
| AT-WISKEY-RC10-PIN-2382-1 | acceptance | COVERED-AUTO | 5 | - |
| AT-WISKEY-DEEPLINKS-2382-1 | acceptance | COVERED-AUTO | 4 | - |
| AT-RELEASE-2390-TRAIN-1 | release gate | COVERED-AUTO | 9 | - |
| AT-RELEASE-2391-1 | release gate | COVERED-AUTO | 3 | - |
| AT-RELEASE-2400-TRAIN-1 | release gate | COVERED-AUTO | 7 | - |
| AT-RELEASE-2401-TRAIN-1 | release gate | COVERED-AUTO | 4 | - |
| AT-GUIDE-BOARD-2402-1 | acceptance | COVERED-AUTO | 3 | - |
| AT-STATION-WS-PATH-2381-1 | acceptance | LAB | 1 | D3 |
| AT-WISKEY-TALK-DIAL-2382-1 | acceptance | LAB | 2 | D4, D6, D7 |
| AT-WISKEY-INBOUND-CALLS-2382-1 | acceptance | LAB | 8 | D8 |
| AT-WISKEY-STATUS-PAGE-2382-1 | acceptance | LAB | 1 | D2 |
| AT-WISKEY-STATION-OPS-2390-1 | acceptance | LAB | 14 | D10 |
| AT-WISKEY-CONFLICTS-2390-1 | acceptance | LAB | 26 | D15 |
| AT-WISKEY-DOOR-TECH-2390-1 | acceptance | LAB | 14 | E3, E5 |
| AT-WISKEY-PROFILES-EDIT-2390-1 | acceptance | LAB | 7 | D14 |
| AT-WISKEY-PEOPLE-COMPLETE-2390-1 | acceptance | LAB | 5 | D13 |
| AT-WISKEY-ACCESS-DIAG-2400-1 | acceptance | LAB | 16 | D12 |
| AT-WISKEY-OPS-VIEWS-2400-1 | acceptance | LAB | 4 | D12 |
| AT-WISKEY-CLOCK-VIEW-2400-1 | acceptance | LAB | 12 | D11 |
| AT-WISKEY-EVENT-CURSOR-2390-1 | acceptance | LAB | 4 | G1, G3 |
| AT-WISKEY-LIVE-VALIDATION-2390-1 | acceptance | LAB | 10 | E6 |
| AT-WISKEY-INSTALLER-NATIVE-2400-1 | acceptance | LAB | 12 | D11 |
| AT-WISKEY-LAB-ACTIVATION-0411-1 | acceptance | LAB | 0 | D1, D6, E1, E4, E6 |
| AT-OWNER-LAB-ACTIONS-0411-1 | acceptance | LAB | 0 | A2, A4, B1, B2, B3, B4, C1, C3, C11, D14, E2, G2 |
| AT181 | manual/visual | OWNER | 0 | - |
| AT182 | manual/visual | OWNER | 0 | - |
| AT183 | manual/visual | OWNER | 0 | - |
| AT-WISKEY-VISITS-2400-1 | acceptance | OWNER | 0 | - |
| AT-WISKEY-ACTIVATION-RUNBOOK-0411-1 | acceptance | OWNER | 0 | - |
| AT-LAB-AUDITS-0411-1 | acceptance | OWNER | 0 | - |
| AT-LAB-NVR-DOOR-READONLY-0411-1 | acceptance | OWNER | 0 | C11, E2 |
| AT-WISKEY-MANAGED-INSTALL-2382-1 | acceptance | BLOCKED-WISKEY | 5 | - |
| AT-WISKEY-SCHED-WRITE-2390-1 | acceptance | BLOCKED-WISKEY | 18 | - |
| AT-WISKEY-WA-QUEUE-2400-1 | acceptance | BLOCKED-WISKEY | 23 | - |
| AT-WISKEY-SVC-GRANT-2400-1 | acceptance | BLOCKED-WISKEY | 0 | - |
| AT-WISKEY-LISTEN-2410-1 | acceptance | BLOCKED-WISKEY | 0 | - |
| AT-WISKEY-EMERGENCY-LOCK-2410-1 | acceptance | BLOCKED-WISKEY | 0 | - |
| AT-WISKEY-RING-STATION-2410-1 | acceptance | BLOCKED-WISKEY | 0 | - |
| AT-WISKEY-ADDENDUM-GAPS-0411-1 | acceptance | BLOCKED-WISKEY | 0 | - |

## 5. The 07.11 lab runbook

Owner-facing page (Hebrew, gitignored): `private/design-system-2026-10-27/lab-0711/index.html`, served locally at
`http://127.0.0.1:8797/lab-0711/`. One checkbox and one result field per step, saved in `localStorage`
(`lab-session-2026-11-07`), a "copy results" button that produces a plain-text report for the chat, and a reset button.

### 5.1 Sources (deduplicated)

- The 17 LAB rows above.
- NOT_RUN / lab sections of the change records added since v2.38.0 (62 files) plus the 2.38.0 records in this slice:
  VIDEO-TRANSPORT-2400 section 9 (owner test plan, 6 items), VIDEO-SUB-FALLBACK-2402 and VIDEO-2403 ("Lab check for the owner"),
  HA-2026-11-COMPAT-2404 section 7, DOOR-BRIDGE-BLOCK-2404 section 5 (live DR-8), BRIDGE-UPDATE-LISTENER-2401 (warning gone after a
  Home Assistant start), WALL-PHONE-TOOLBAR-2401 section 4 (physical long press), SKIN-QA-2403 / SKIN-QA-FOLLOWUP-2404 / PIXEL-DRIFT-2405
  (physical phone, non-Chromium), DIALOG-TOPLAYER-2381 (real devices), SETTINGS-INTERCOM-CARDS-2401 / SETTINGS-CARDS-ACCORDION-2402
  (other skins, dark), TTS-DEFAULT-ENGINE-2400 (the lab's engine languages), WISKEY-INBOUND-CALLS-2382, WISKEY-CONFLICTS-2400 (first
  real review, Q-WK-11), WISKEY-INSTALLER-NATIVE-2400, WISKEY-OPS-VIEWS-2400, WISKEY-DOOR-TECH-2390, T035-OUTAGE-RUN-2405 (AT069 /
  AT070 on real equipment), WXH-LEFTOVERS-2405 (owner contacts' real delivery), T097-LOWS-2405 (a real Ingress request with a long
  bulk list), T074-VISUAL-METRICS-2405 (real time-to-camera / time-to-recording numbers), FRIGATE-F2B-2405 (supervised writes,
  AT230 / AT240 / AT241, runbook `docs/operations/FRIGATE_SUPERVISED_VERIFICATION_HE.md`), TV-SETTINGS-2380 (real-TV safe margin).
- Owner plans: the 04.11 WisKey activation ladder (`private/handoff-package/SESSION_2026-11-04/02_WISKEY_ACTIVATION_HE.md`; its done
  steps are not repeated), the open owner steps of OWNER-LAB-ACTIONS-0411, the 05.11 morning page's lab session, and
  `private/planning/HA_2026_11_UPGRADE_REVIEW_2026-11-05_HE.md`.

Duplicates merged: the bridge load, the update-listener warning check, the DR-8 block check, the event-cursor check and the HA 2026.11
name check share ONE Home Assistant restart (block G); the station drawer of VIDEO-TRANSPORT item 3 and the remote path of
STATION-WS-PATH are one pair of steps (D3 / D4); cameras 8 / 10 appear in VIDEO-SUB-FALLBACK, VIDEO-2403, SKIN-QA-FOLLOWUP and the
owner's sub-stream fix and are ordered test-first, fix-last (C1-C3, B7, C11); the live validation pulse and the activation ladder's
door steps are one door block (E).

### 5.2 Blocks, order and time

Order minimises switching: start and backups, phone, wall / kiosk / PC, stations, doors, optional Frigate, and the Home Assistant
restart last. Lead remote steps that run while the owner works are marked "in parallel" and do not add time.

| Block | Where | Steps | Required | With optional |
|---|---|---|---|---|
| A. Start: versions and backups | PC | 6 | 22 min | 22 min |
| B. Phone | phone via `/arx/` (domain, not IP) | 9 | 26 min | 32 min |
| C. Wall, kiosk and PC | PC + wall tablet | 11 | 37 min | 42 min |
| D. Intercom stations | PC, phone, a person at a station | 15 | 55 min | 59 min |
| E. Doors | PC, the owner at one door | 6 | 34 min | 34 min |
| F. Frigate (optional block) | PC | 4 | - | 28 min |
| G. Home Assistant restart (last) | PC, the owner at one door for G6 | 9 | 30 min | 36 min |
| **Total** | | **60** | **3 h 24 min** | **4 h 13 min** |

Step types: lead checks remotely (read-only) 10, owner looks / taps 26, needs the owner's explicit approval (any write, door, talk,
call or Home Assistant restart) 24. Each approval step shows its approval sentence; a general approval for the whole session is not
accepted.

### 5.3 Row to step map (LAB rows)

| Row | Steps |
|---|---|
| AT-STATION-WS-PATH-2381-1 | D3 |
| AT-WISKEY-TALK-DIAL-2382-1 | D4, D6, D7 |
| AT-WISKEY-INBOUND-CALLS-2382-1 | D8 |
| AT-WISKEY-STATUS-PAGE-2382-1 | D2 |
| AT-WISKEY-STATION-OPS-2390-1 | D10 |
| AT-WISKEY-CONFLICTS-2390-1 | D15 (review only; a resolve needs a separate approval) |
| AT-WISKEY-DOOR-TECH-2390-1 | E3, E5 (code write and programs excluded: may close only partly) |
| AT-WISKEY-PROFILES-EDIT-2390-1 | D14 |
| AT-WISKEY-PEOPLE-COMPLETE-2390-1 | D13 |
| AT-WISKEY-ACCESS-DIAG-2400-1, AT-WISKEY-OPS-VIEWS-2400-1 | D12 |
| AT-WISKEY-CLOCK-VIEW-2400-1, AT-WISKEY-INSTALLER-NATIVE-2400-1 | D11 |
| AT-WISKEY-EVENT-CURSOR-2390-1 | G1, G3 |
| AT-WISKEY-LIVE-VALIDATION-2390-1 | E6 |
| AT-WISKEY-LAB-ACTIVATION-0411-1 | D1, D6, E1, E4, E6 |
| AT-OWNER-LAB-ACTIONS-0411-1 | A2, A4, B1-B4, C1, C3, C11, D14, E2, G2 |

Not in the session (listed on the page): every BLOCKED-WISKEY row; the public code write and program save / pause; a restore drill and a
multi-day soak; forwarding the WisKey addendum and choosing the next joint session; the three owner decisions (visits, Hebrew docs,
accepting the 04.11 audits).

## 6. Receipts

| Command / check | Where | Result |
|---|---|---|
| Read `~/smplwise-results/nightly/gate_status.json`, `gate_main_eab715e53.md`, `quarantine.json` | runner, read-only (scp) | PASS, tier L, `eab715e53` |
| Per-file index over `gate_main_eab715e53.logs` (a throw-away script in `/tmp`, removed after the run; stdout only) | runner | 892 backend modules (20818 passed), 1004 spec files (21003 passed) |
| `grep` of the verdict line in `~/smplwise-results/gate_*_<tag sha>.md` / `.gate2.md` for every tag v2.36.0 ... v2.40.1 | runner, read-only | PASS on each tag commit |
| `git merge-base --is-ancestor <tag> eab715e53` for the same tags | workstation | all ancestors |
| `python scripts/build_guide.py --check` | workstation, at `eadc5b080` / archives of `ccb77f28d` and `eab715e53` | rc 1 (stale) / rc 0 / rc 0 |
| `python scripts/docs_he_check.py` | workstation, `eadc5b080` | 11 drifted, 42 without header, 293 without mirror |
| The runbook page in the browser pane (`http://127.0.0.1:8797/lab-0711/`) | workstation | 7 blocks, 60 steps / checkboxes, totals 3:24 / 4:13; a checkbox and a note survive a reload (`localStorage`); no horizontal scroll at 375 px; the test entry was removed afterwards |

## 7. NOT_RUN / limits

- No test, gate or suite was run; the classification relies on the existing nightly and gate reports.
- The "copy results" clipboard path was not exercised in the pane (the pane has no clipboard permission; the code falls back to a
  prompt with the text).
- Nightly per-file counts are taken from the first-attempt reports; a file with a first-attempt failure that the gate then retried green
  shows that failure count in the JSON (`evidence-wiskey-installer.spec.ts`: 1).
- `management/test_catalog.json` and `management/tasks.json` are not edited (as instructed); recording the 25 COVERED-AUTO rows as PASS
  and the LAB rows after the session is the lead's next step.
- The lab page is gitignored (`private/`), like every owner page.

## 8. Files

- `docs/changes/receipts/CATALOG-SWEEP-C-2406.json` (new)
- `docs/changes/CATALOG-SWEEP-C-2406.md` (this file)
- `private/design-system-2026-10-27/lab-0711/index.html` (new, gitignored, in the main checkout)
