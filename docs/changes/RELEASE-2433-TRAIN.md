# RELEASE-2433-TRAIN: assembly of the 2.43.3 train (realistic 3D round 3 + furniture merge, home follow-up B delta, gate FIFO)

Branch `release/2433-train` (worktree `C:\cloude\smplwise-train37`), cut from `origin/main` = v2.43.2 (`9186b67ff`). Assembled
2026-11-12 by the release-train agent on the lead's delegation (standing release authority: tag and push after a passing full gate).
Cut at 18:00 local (the lead's latest cut time) with the branches that were GREEN by then. No lab, Home Assistant, NVR, go2rtc,
WisKey or device contact; nothing installed.

## 1. Merges (`--no-ff`, in this order)

| # | Branch | Tip | Runner entry check | Merge commit | Conflicts |
|---|---|---|---|---|---|
| a | `pilot/GATE-FIFO-2436` (`GATE-FIFO-2436.md`) - FIFO queue for the runner entry check; tooling only (`scripts/gate/`) | 58b19e5de | GREEN (`entry_pilot-GATE-FIFO-2436_58b19e5de.md`) | 491264d0c | none |
| b | `pilot/PLAN3D-LEVEL3-2435` (`PLAN3D-LEVEL3-2435.md`), contains `pilot/PLAN3D-FURNMERGE-2434` @ 2a2a3a326 (`PLAN3D-FURNMERGE-2434.md`) - realistic 3D round 3 (floor reflections dial `plan.view.floor_reflections`, marble / porcelain floors, contact shadows, furniture shapes), furniture merged per level and material, + / - zoom buttons, the studio backdrop over the realistic sky; no migration, no backend route | a86be970b | GREEN (`entry_pilot-PLAN3D-LEVEL3-2435_a86be970b.md`, base origin/main 9186b67ff) | e5bf1122f | none |
| c | `pilot/HOME-V3-FOLLOWUP-B-2431` (`HOME-V3-FOLLOWUP-B-2431.md`) - delta since 2.43.2 (17da5c7ff): ticket photo remove button sized inside its sheet, pixel baselines and the pixel-stable tag | 1445a3ea1 | GREEN (`entry_pilot-HOME-V3-FOLLOWUP-B-2431_1445a3ea1.md`) | 4ca54059c | none |

**Preparation of b:** `origin/main` (9186b67ff) was merged into `pilot/PLAN3D-FURNMERGE-2434` (2a2a3a326, no conflicts; it brings
the `test_body_limit` fix that made 3303d5376 RED), then FURNMERGE into `pilot/PLAN3D-LEVEL3-2435` (a86be970b, no conflicts). The
LEVEL3 check judged that whole tree. FURNMERGE's own check of 2a2a3a326 was still queued when the train was cut; its content
boards through b.

**Not boarded (no GREEN entry check for the head when the train was cut):**
- `pilot/GO2RTC-STREAM-SYNC-2436` @ 844a158cb - RED only through the check's time budget (4606 s; "76-minute budget exhausted":
  backend shards at about 80 % under load 65, pixel / preview shards without a report). No product failure among the finished
  tests (5 flaky, passed alone). Re-queued with `ENTRY_TOTAL_SECS=9000`.
- `pilot/HEALTH-GO2RTC-FOLLOWUP-2431` @ 6e58412b0 - RED the same way (full backend selected, 922 files; budget exhausted; 3 flaky
  passed alone, no product failure). Re-queued with `ENTRY_TOTAL_SECS=10800`.
- `pilot/PLAN3D-R28-UI-2433`, `pilot/SYS-AUDIT-QUICKFIX-2437`, `pilot/HOME-V3-AUDITFIX-2437` (contains GAPS),
  `pilot/HOME-V3-GAPS-2436`, `pilot/NOSCROLL-1366-2437` - still queued / running. A dry run shows R28-UI conflicting with b in
  `frontend/src/map/sw-plan-3d.ts` (styles array, `willUpdate`); both sides are kept when it boards 2.43.4.

## 2. Train commits

| Commit | What |
|---|---|
| e10be948a | release: 2.43.3 - version, changelog and API inventory (1904 routes) |
| (this document) | docs |
| (next) | release: 2.43.3 - rebuilt UI (`npm run build:addon` on the runner) |

`management/tasks.json` and `test_catalog.json` are not changed; no view regenerated.

## 3. Receipts (before the UI build)

Local: workstation, main checkout `.venv` Python 3.12, Node 24.21.0; `frontend/node_modules` is a junction to the main checkout's.

| Check | Where / SHA | Result |
|---|---|---|
| `npx tsc --noEmit` | 2a2a3a326 (FURNMERGE + main); e5bf1122f (a + b) | exit 0, exit 0 |
| backend: `test_plan_view_settings`, `test_home_followup_b_2431`, `test_body_limit`, `test_home_interface`, `test_rbac_matrix` | e10be948a | **97 passed** (exit 0) |
| `scripts/release_check.py` | e10be948a | one version 2.43.3; migrations contiguous (215); only `[FAIL] git tag v2.43.3 not yet`; RESULT: ready |

## 4. Version commit (`e10be948a`)

- 2.43.2 -> **2.43.3** in `smplwise_vms/config.yaml`, the Dockerfile label and `smplwise/__init__.py`. No bridge change, no migration.
- `CHANGELOG.md`: bilingual entry (Hebrew + English per item): 3D round 3, zoom buttons, furniture merge, the studio backdrop fix,
  the ticket photo button; install: nothing to do. The gate FIFO is tooling and not in the changelog.
- `contracts/API_INVENTORY.md`: 1904 routes, header 2.43.3.

## 5. NOT_RUN and open items

- Locally: the full suites and the other Playwright projects - the runner's UI build and full release gate cover them.
- Lab: nothing installed or exercised (owner approves installs): the realistic 3D look and frame rate on the lab's real screens.
- Owner questions open: `PLAN3D-LEVEL3-2435.md` "Owner questions".

## 6. Rollback

Back to 2.43.2: no migration; the `plan.view.floor_reflections` key stays in the stored JSON value and is ignored. No bridge or
Home Assistant change.
