# RELEASE-2435-TRAIN: assembly of the 2.43.5 train (live camera drafts, no-scroll control screens, video service follow-up)

Branch `release/2435-train` (worktree `C:\cloude\smplwise-train39`), cut from `origin/main` = v2.43.4 (`665ec8f24`). Assembled
2026-11-13 by the release-train agent on the lead's delegation (standing release authority: tag and push after a passing full gate).
No lab, Home Assistant, NVR, go2rtc, WisKey or device contact; nothing installed. The lab Home Assistant updates the add-on by itself.

## 1. Merges (`--no-ff`, in this order)

Every verdict file was read on the runner before the merge (`~/smplwise-results/entry_<branch>_<sha>.md`): each says GREEN
("ירוק - מותר לעלות לרכבת", engine pass) for exactly the tip below.

| # | Branch | Tip | Runner entry check | Merge commit | Conflicts |
|---|---|---|---|---|---|
| a | `pilot/LIVECAM-DRAFT-RESET-2435` (`LIVECAM-DRAFT-RESET-2435.md`) - live camera: per-camera drafts and reads reset on an in-place camera change, no wrong-camera NVR write, the record poll stops on leave | 11ed6cd49 | GREEN (base origin/main 665ec8f24, run 10 min) | 0799b33fb | none |
| b | `pilot/NOSCROLL-1366-2437` (`NOSCROLL-1366-2437.md`) - thirteen control screens fit 1366x768 / 1440x900 without scrolling; WisKey and visual-matrix linux baselines re-taken on the runner in the branch | 5b9bb0413 | GREEN (base 665ec8f24, run 38 min) | fb96751cc | none (`live-camera.ts` auto-merged with a) |
| c | `pilot/FLAKY-G2R-BACKOFF-2437` - the go2rtc reach probe counts outcomes, not timestamps (Windows ~15 ms clock) | b7ee98809 | GREEN (base 41e2a95f0, run 18 min) | 77952f29e | none |
| d | `pilot/HEALTH-GO2RTC-FOLLOWUP-2431` (`HEALTH-GO2RTC-FOLLOWUP-2431.md`) - video service notice delay setting (default 15 min), the go2rtc services found and the choice of one (`/system/video-services`, local only) | 6e58412b0 | GREEN (base ab7894837, full backend, run 95 min) | 5b4258c67 | 2, below |

**Conflicts in d:**
- `smplwise_vms/backend/smplwise/services/media_reach.py`: c and d fixed the same bug (the probe compared `last_contact`, and on
  Windows a failure and the answer right after it share a timestamp) with two differently named counters (`outcomes` in c,
  `contacts` in d). One counter kept: c's `outcomes`, read under the lock. d's 15-minute `ATTENTION_AFTER_S = 900` kept. No test
  reads either attribute; both regression tests (`test_an_answer_in_the_same_clock_tick_as_the_failure_still_counts` and d's) stay.
- `contracts/API_INVENTORY.md`: the train side kept in the merge; regenerated in the version commit.

## 2. Train commits

| Commit | What |
|---|---|
| 775fd451d | release: 2.43.5 - version, changelog and API inventory (1908 routes: + `GET /system/video-services`, `PUT` / `DELETE /system/video-services/selection`) |
| (this document) | docs |
| (next) | release: 2.43.5 - rebuilt UI (`npm run build:addon` on the runner) |

`management/tasks.json` and `test_catalog.json` are not changed; no view regenerated.

## 3. Pixel baselines

The only baseline changes in the train come from b, which re-took them on the runner in its own branch (WisKey deeplinks / station
media / stations, visual matrix). a and d change `live-camera.ts`, `system-diagnostics.ts`, `sw-live-player.ts` and the settings
picker; the pixel specs that render those screens (`pixel-access-s12`, `pixel-settings-intercom-cards-2401`) and b's re-taken specs
were re-run on the merged train as a proof run before the gate, without `-u`: `run_smart.py preview release/2435-train
pixel-access-s12 pixel-settings-intercom-cards-2401 pixel-wiskey-deeplinks pixel-wiskey-station-media pixel-wiskey-stations
visual-matrix --workers=1 --machine runner` at 775fd451d: **138 passed, 36 skipped (phone / no-baseline cases), 0 failed**
(6.2 min, rc 0). No baseline needed refreshing, so none was re-taken and no image moved into the train.

## 4. Receipts

Local: workstation, main checkout `.venv` Python 3.12, Node 24.21.0; `frontend/node_modules` is a junction to the main checkout's.

| Check | Where / SHA | Result |
|---|---|---|
| `npx tsc --noEmit` | 775fd451d | exit 0 |
| backend: `test_health_go2rtc_2430`, `test_video_services_2431`, `test_remote_access`, `test_go2rtc_stream_sync_2436`, `test_go2rtc_big_media`, `test_rbac_matrix`, `test_notice_tvsettings_2380` | 775fd451d | PENDING |

## 5. Version commit (`775fd451d`)

- 2.43.4 -> **2.43.5** in `smplwise_vms/config.yaml`, the Dockerfile label and `smplwise/__init__.py`. No bridge change, no migration.
- `CHANGELOG.md`: bilingual entry (Hebrew + English per item): new - the go2rtc services found and the choice of one, the notice
  delay setting; improved - thirteen control screens without scrolling; fixed - the live camera drafts on a camera change, the record
  poll on leave, the reach probe's same-tick count; install: nothing to do.
- `contracts/API_INVENTORY.md`: 1908 routes, header 2.43.5.

## 6. NOT_RUN and open items

- Locally: the full suites and the Playwright projects - the runner's UI build and full release gate cover them.
- Lab: nothing installed or exercised: the video service list and choice against the lab Supervisor (two read calls,
  `GET /addons` and `GET /addons/{addon}/info`), the 15-minute notice, the paged screens on a real 1366x768 display.

## 7. Rollback

Back to 2.43.4: no migration. A stored `media.video_service_selection` and `media.video_notice_after_min` are ignored by 2.43.4 (it
reads `go2rtc_url` from the add-on options and uses the 300 s notice again).
