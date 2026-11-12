# RELEASE-2431-TRAIN: assembly of the 2.43.1 train (home interface v3 phase 2 + follow-up A, 3D polish and realism round 2, nightly test fixes)

Branch `release/2431-train` (worktree `C:\cloude\smplwise-train35`), cut from `origin/main` = v2.43.0 (`60d20c9de`). Assembled
2026-11-11/12 by the release-train agent on the lead's delegation (standing release authority: tag and push after a passing full gate).
No lab, Home Assistant, NVR, go2rtc, WisKey or device contact; nothing installed.

## 1. Merges (`--no-ff`, in this order)

| # | Branch | Tip | Runner entry check | Merge commit | Conflicts |
|---|---|---|---|---|---|
| a | `pilot/NIGHTLY-FIXES-2431` - nightly test failures (t074 fixture, S12 display card wait, wall reload / pwa timeouts); tests only | a7d7dde5c | GREEN (`entry_pilot-NIGHTLY-FIXES-2431_a7d7dde5c.md`) | 4694bb84b | none |
| b | `pilot/PLAN3D-REALISM2-2433` (`PLAN3D-REALISM2-2433.md`) - realistic 3D round 2 (baked AO, wall cut caps, glass, colour grade, studio backdrop dial, materials); built on `PLAN3D-REALISM-2432` round 1 with an earlier `PLAN3D-POLISH-2430` merged; no migration | 73a73b185 | GREEN (`entry_pilot-PLAN3D-REALISM2-2433_73a73b185.md`) | 0594269a8 | none |
| c | `pilot/PLAN3D-POLISH-2430` (`PLAN3D-POLISH-2430.md`) - its product code is already inside b; since the merge base 890377a71 it adds only tests, baselines and docs | 158facc51 | GREEN (`entry_pilot-PLAN3D-POLISH-2430_158facc51.md`) | a370e495f | 12 binary baselines (below) |
| d | `pilot/HOME-V3-FOLLOWUP-A-2431` (`HOME-V3-FOLLOWUP-A-2431.md`, contains `pilot/HOME-V3-P2-2431` / `HOME-V3-P2-2431.md`) - phase 2 family and building (migration **0214**), follow-up A: recordings / log / intercom categories, the visitor switch, the bill file (migration **0215**) | 82f998330 | GREEN (`entry_pilot-HOME-V3-FOLLOWUP-A-2431_82f998330.md`) | f74063932 | none |

**Conflicts in c, resolved:** the level-3 replay baselines `frontend/tests/evidence-replay-3d.spec.ts-snapshots/`
`event-l3-lite-*`, `history-l3-lite-day-*`, `history-l3-lite-night-*`, `history-l3-realistic-day-*` (desktop / tablet / mobile, 12 files):
the train side (b's) kept - b re-took them on the realism code, which already contains every polish product change. The full gate
judges the merged tree.

**Not boarded (no GREEN entry check for the head when the train was cut):**
- `pilot/HOME-V3-FOLLOWUP-B-2431` @ 5eb975d08 - RED (`home-v3-fb-2431.spec.ts:118`, `home-v3-p1.spec.ts:168`, `home-v3-p2.spec.ts:179`,
  desktop). The same three specs also fail in a local run of df7fde1ba. A dry run of A then B on this train conflicts in `home-api.ts`,
  `sw-home-admin.ts`, `services/home_interface.py` and `tests/test_home_v3_p3.py`; a resolution (A's module lists and labels, both
  allow-list blocks, B's wall-panel kiosk check first in `enforce`, then A's category gate) is recorded in `git rerere` and passed the
  home backend tests (103) and `tsc --noEmit` locally.
- `pilot/HEALTH-GO2RTC-FOLLOWUP-2431` @ 4701b32d2 - entry check still queued on the runner (behind the nightly and the other checks).
- `pilot/WISKEY-PIXEL-QUAR-2431` @ 80db91c8e - RED (`tests/test_body_limit.py::test_a_cut_multipart_upload_leaves_the_temp_dir_empty`,
  failed twice under load; it also failed `PLAN3D-POLISH-2430` @ 5b127e991). A newer head d1b86b514 is being checked.
- `pilot/PLAN3D-R28-UI-2433`, `pilot/PLAN3D-FURNMERGE-2434` - entry checks still running / queued.
- `pilot/PLAN3D-R28-WIZARD-2433`, `pilot/PLAN3D-R28-WIZARD2-2434` - RED (`pixel-plan-wizard-2433.spec.ts:104` on 63c008eab).
- `pilot/PLAN3D-REALISM-2432` - superseded by b, not boarded on its own.

## 2. Train commits

| Commit | What |
|---|---|
| b4b80f702 | release: 2.43.1 - version, changelog and API inventory (1902 routes) |
| (this document) | docs |
| (next) | release: 2.43.1 - rebuilt UI (`npm run build:addon` on the runner) |

`management/tasks.json` and `test_catalog.json` are not changed by any boarded branch or train commit; no view regenerated.

## 3. Receipts (before the UI build)

Local: workstation, project `.venv` Python 3.12, Node 24.21.0; `frontend/node_modules` is a junction to the main checkout's
(`package.json` / lock identical to main).

| Check | Where / SHA | Result |
|---|---|---|
| `npx tsc --noEmit` | a370e495f (a + b + c) | exit 0 |
| backend: `test_home_interface`, `test_home_interface_doors_2421`, `test_home_v3_followup_a`, `test_home_v3_p1`, `test_home_v3_p2`, `test_home_v3_p3`, `test_rbac_matrix`, `test_me_permissions`, `test_body_limit`, `test_plan_view*` | f74063932 (a-d) | **146 passed** |
| `scripts/release_check.py` | b4b80f702 | one version 2.43.1; migrations contiguous (215, last 0215); only `[FAIL] git tag v2.43.1 not yet`; RESULT: ready |

Migrations: main ends at 0213; 0214 (`0214_home_family_quiet.sql`, table `home_notify_quiet`) and 0215 (`0215_home_v3_categories.sql`,
appends the new categories to stored per-person lists, `intercom` only where `doors` was on; idempotent) are contiguous.

## 4. Version commit (`b4b80f702`)

- 2.43.0 -> **2.43.1** in `smplwise_vms/config.yaml`, the Dockerfile label and `smplwise/__init__.py`. No bridge change.
- `CHANGELOG.md`: bilingual entry (Hebrew + English per item): family and building screens, the three new categories, the visitor
  switch, the bill file, the 3D map polish and realistic mode; fixed: nightly tests (tests only); install: migrations 0214 and 0215,
  no bridge update, no home-system restart.
- `contracts/API_INVENTORY.md`: 1902 routes, header 2.43.1.

## 5. NOT_RUN and open items

- Locally: the full backend and unit suites, Playwright on all projects, pixel baselines - the runner's UI build and full release gate
  cover them (results in the lead's report, not in this document, so the gated sha stays the release sha).
- Lab: nothing installed or exercised (owner approves installs).
- The `test_body_limit` cut-upload test failed twice under runner load in two entry checks; it passed locally (146 above).

## 6. Rollback

Back to 2.43.0 needs the database backup taken before the update (migrations 0214 and 0215: a new table and rewritten per-person
category lists; the previous version ignores the table and validates lists only on write). No bridge or Home Assistant change.
