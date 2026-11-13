# RELEASE-2434-TRAIN: assembly of the 2.43.4 train (home interface v3 gaps, go2rtc stream sync)

Branch `release/2434-train` (worktree `C:\cloude\smplwise-train38`), cut from `origin/main` = v2.43.3 (`41e2a95f0`). Assembled
2026-11-13 by the release-train agent on the lead's delegation (standing release authority: tag and push after a passing full gate).
No lab, Home Assistant, NVR, go2rtc, WisKey or device contact; nothing installed.

## 1. Merges (`--no-ff`, in this order)

| # | Branch | Tip | Runner entry check | Merge commit | Conflicts |
|---|---|---|---|---|---|
| a | `pilot/HOME-V3-GAPS-2436` (`HOME-V3-GAPS-2436.md`) - home interface v3: the alarm in the house log (`GET /home/alarm-log`), tickets from the water and systems screens, the personal alarm code row; no migration | 6b95207e5 | GREEN (`entry_pilot-HOME-V3-GAPS-2436_6b95207e5.md`, base origin/main 9186b67ff) | a10867baf | none |
| b | `pilot/GO2RTC-STREAM-SYNC-2436` (`GO2RTC-STREAM-SYNC-2436.md`) - the stream sync writes a stream only when it changed, `GET /media/streams` `state` / `consumers`, a replaced playback socket; no migration | 844a158cb | GREEN (`entry_pilot-GO2RTC-STREAM-SYNC-2436_844a158cb.md`; the second run, `ENTRY_TOTAL_SECS=9000`; the first ran out of its 4606 s budget) | 8fc4b7845 | none |

**Not boarded (no GREEN entry check for the head when the train was cut):**
- `pilot/HEALTH-GO2RTC-FOLLOWUP-2431` @ 6e58412b0 - RED only through the check's budget (full backend selected); re-queued with
  `ENTRY_TOTAL_SECS=10800 --max-wait 0`, still queued behind the round-30 audit branches.
- `pilot/SYS-AUDIT-QUICKFIX-2437` @ dd16b8409 - NOT RUN (12 h queue limit); re-queued with `--max-wait 0`.
- `pilot/HOME-V3-AUDITFIX-2437` @ 4b969588b - RED (72 failures; an earlier run of the same head was OOM-killed, rc 137).
- `pilot/NOSCROLL-1366-2437` @ 9eb11941c - RED (warm-up attention card at 1024x768, WisKey drawer specs; budget 40 min exhausted).
- `pilot/PLAN3D-R28-UI-2433` @ 93a94c546 - RED (`unit-token-lint.spec.ts:84/110` on every project, `evidence-k88-plan-advanced.spec.ts:21`,
  ...; base a5618fad6). A dry run conflicts with 2.43.3 in `frontend/src/map/sw-plan-3d.ts` (styles array, `willUpdate`): keep both.

## 2. Train commits

| Commit | What |
|---|---|
| f2299f30b | release: 2.43.4 - version, changelog and API inventory (1905 routes: + `GET /home/alarm-log`) |
| (this document) | docs |
| (next) | release: 2.43.4 - rebuilt UI (`npm run build:addon` on the runner) |

`management/tasks.json` and `test_catalog.json` are not changed; no view regenerated.

## 3. Receipts (before the UI build)

Local: workstation, main checkout `.venv` Python 3.12, Node 24.21.0; `frontend/node_modules` is a junction to the main checkout's.

| Check | Where / SHA | Result |
|---|---|---|
| `npx tsc --noEmit` | 8fc4b7845 (a + b) | exit 0 |
| backend: `test_go2rtc_stream_sync_2436`, `test_home_v3_gaps_2436`, `test_recordings`, `test_home_interface`, `test_rbac_matrix`, `test_home_followup_b_2431` | 8fc4b7845 | **84 passed** (exit 0) |
| `scripts/release_check.py` | f2299f30b | one version 2.43.4; migrations contiguous (215); only `[FAIL] git tag v2.43.4 not yet`; RESULT: ready |

## 4. Version commit (`f2299f30b`)

- 2.43.3 -> **2.43.4** in `smplwise_vms/config.yaml`, the Dockerfile label and `smplwise/__init__.py`. No bridge change, no migration.
- `CHANGELOG.md`: bilingual entry (Hebrew + English per item): the alarm in the house log, tickets from the water and systems screens,
  the alarm code row; fixed: the stream sync, the diagnostics stream state, the replaced recording player; install: nothing to do.
- `contracts/API_INVENTORY.md`: 1905 routes, header 2.43.4.

## 5. NOT_RUN and open items

- Locally: the full suites and the other Playwright projects - the runner's UI build and full release gate cover them.
- Lab: nothing installed or exercised (owner approves installs): the stream sync against the lab go2rtc (writes once per restart,
  then none), the alarm log on a real panel.
- Owner questions open: `HOME-V3-GAPS-2436.md` section 4.

## 6. Rollback

Back to 2.43.3: no migration, nothing new stored. The stream sync of 2.43.3 rewrites every stream again on each sync.
