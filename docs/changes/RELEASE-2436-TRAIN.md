# RELEASE-2436-TRAIN: assembly of the 2.43.6 train (3D map room pills and room card, session retry)

Branch `release/2436-train-r2` (worktree `C:\cloude\smplwise-train40`), cut from `origin/main` = v2.43.5 (`0a8fb55e1`). Assembled
2026-11-14 by the release-train agent on the lead's delegation (standing release authority: tag and push after a passing full gate).
No lab, Home Assistant, NVR, go2rtc, WisKey or device contact; nothing installed. The lab Home Assistant updates the add-on by itself.

This is the second assembly. The first (`release/2436-train`, head `0e5c61b9c`, with `pilot/BACKEND-SAFETY-2435` as well) failed
the full release gate on one backend test caused by that branch (section 2); the branch was dropped and the train rebuilt.

## 1. Merges (`--no-ff`, in this order)

Every verdict file was read on the runner before the merge (`~/smplwise-results/entry_<branch>_<sha>.md`): each says GREEN
("ירוק - מותר לעלות לרכבת", engine pass) for exactly the tip below, which equals the branch's origin head at merge time.

| # | Branch | Tip | Runner entry check | Merge commit | Conflicts |
|---|---|---|---|---|---|
| a | `pilot/SESSION-DEMO-WS-2435` (`SESSION-DEMO-WS-2435.md`) - a failed `/me` no longer becomes the demo (retry panel); `/me/ws` liveness check | c090f6059 | GREEN (base 665ec8f24, run 86 min) | 4f87f670e | none |
| b | `pilot/PLAN3D-R28-UI-2433` (`PLAN3D-R28-UI-2433.md`) - 3D map round 28: room pills, room card, spread levels, eight `map.*` settings | b6024ea8b | GREEN (base 665ec8f24, run 83 min) | 2e0fcadf7 | none (`api/media.ts`, `system-diagnostics.ts`, `routers/settings.py` auto-merged with 2.43.5) |

The two branches share no file. Both were based on v2.43.4 (`665ec8f24`); the train adds the 2.43.5 changes under them.

### Branches checked and left for the next train

Verdict files read on the runner at 08:52 UTC and again at 09:09 UTC (the ~30 minute window):

| Branch | Origin head | Verdict on that head |
|---|---|---|
| `pilot/BACKEND-SAFETY-2435` | 300945228 | GREEN on base 665ec8f24, but **dropped**: a real failure on top of 2.43.5 (section 2) |
| `pilot/AUTH-REVOKE-GATE-2435` | 0a3c570e1 | NOT RUN (the earlier run failed at `git worktree add`); re-queued, not reached |
| `pilot/TICKETS-PERF-ERASE-2435` | 5719846af | no verdict (queued) |
| `pilot/FE-LEAK-TEXTKEY-2435` | f7e247b60 | no verdict (queued) |
| `pilot/HOME-V3-AUDITFIX-2437` | ecee791a1 | RED: `pixel-home-gaps-2436.spec.ts:50 [desktop]` "my notifications" failed again alone |

## 2. The first gate and why BACKEND-SAFETY-2435 left the train

Full release gate on `release/2436-train` @ `0e5c61b9c` (main + BACKEND-SAFETY + SESSION-DEMO-WS + PLAN3D-R28-UI, version, UI):
verdict **fail**, 8194 s. Counts (pass / fail / flaky): backend 21376 / 1 / 4, preview 13249 / 0 / 32, dev 727 / 0 / 3, pixel 244 / 0 / 2,
visual 72 / 0 / 0, fixture 28 / 0 / 0, tsc, build, release check and add-on build pass. The only hard failure:

`tests/test_asgi_wiskey_295.py::test_full_app_lifecycle_media_and_talk_with_downlink_leaves_no_task_socket_thread_or_timer` -
"no OS socket more than before startup", `assert 4 <= 2`, in its shard and again alone.

Evidence that it is the branch, not the runner (the same single test, `-k`, one process):

| Tree | Where | Result |
|---|---|---|
| main `0a8fb55e1` (v2.43.5) | runner, alternating with the train | 8 / 8 pass |
| train `4e78bfeae` (backend = `0e5c61b9c`) | runner, alternating with main | 6 / 8 pass, 2 fail (`4 <= 2`) |
| main + BACKEND-SAFETY only (`5f747a218`) | runner | 3 / 10 pass, 7 fail (`4 <= 2`) |
| main `0a8fb55e1` | workstation | 6 / 6 pass |
| train | workstation | 7 / 9 pass, 2 fail (`3 <= 2`) |

Among the train's backend changes only BACKEND-SAFETY touches runtime code (the other backend diff is eight settings keys and the
version). Its own entry check passed on base `665ec8f24`, before 2.43.5; on top of 2.43.5 the application shutdown leaves OS sockets
open at the moment the test counts them. A likely contributor is the faster notification-monitor shutdown (it no longer waits up to
one second), which this test's timing exposes; not proven. Not a stale test or an infra flake, so the branch was dropped, not patched
in the train. It goes back to its owner with this evidence.

## 3. Train commits

| Commit | What |
|---|---|
| 6847141fa | release: 2.43.6 - version, changelog and API inventory (1908 routes, unchanged: no branch adds a route) |
| (next) | docs (this document) |
| (next) | release: 2.43.6 - rebuilt UI, cherry-picked from `c54fdbc6a` (section 4) |

`management/tasks.json` and `test_catalog.json` are not changed; no view regenerated.

## 4. The UI build

`npm run build:addon` ran on the runner at `4e78bfeae` (first assembly; DONE rc=0, the licence notice in the bundle) and was
committed as `c54fdbc6a` (only `smplwise_vms/www` and `www-public`). BACKEND-SAFETY changes no frontend file:
`git diff 2688513a9 2e0fcadf7 -- frontend` is empty, and the version is the same 2.43.6, so the build input is byte-identical and
that UI commit is cherry-picked instead of waiting hours for the runner lock again.

## 5. Pixel baselines

The only baseline changes in the train come from b, which took its R28 baselines on the runner in its own branch (after its merge of
v2.43.4). No baseline was re-taken in the train. The first full gate on the same frontend ran 244 pixel cases: 0 failed, 2 flaky
(passed alone; one is the quarantined S12 phone card).

## 6. Receipts

Local: workstation, main checkout `.venv` Python 3.12, Node 24.21.0; `frontend/node_modules` is a junction to the main checkout's.

| Check | Where / SHA | Result |
|---|---|---|
| `npx tsc --noEmit` | 2688513a9 (same frontend as this train) | exit 0 |
| backend: `test_map3d_r28_settings_2433`, `test_backup`, `test_backup_drill`, `test_backup_offbox`, `test_backup_sensitive`, `test_rbac_matrix`, `test_video_services_2431`, `test_backend_safety_2435` (`-p no:xdist`) | 1321a9c37 (first assembly) | 108 passed (exit 0) |
| `scripts/api_inventory.py` | 6847141fa | 1908 routes (header only changed) |

The full release gate's verdict on this train is recorded in the release report, not here (this document is part of the gated head).

## 7. Version commit (`6847141fa`)

- 2.43.5 -> **2.43.6** in `smplwise_vms/config.yaml`, the Dockerfile label and `smplwise/__init__.py`. No bridge change, no migration.
- `CHANGELOG.md`: bilingual entry (Hebrew + English per item): new - room pills, the room card, the building / spread switch, eight
  map settings; improved - the server-unavailable retry instead of the demo, the live connection reconnects; install: nothing to do.

## 8. NOT_RUN and open items

- Locally: the full suites and the Playwright projects - the runner's full release gate covers them.
- Lab: nothing installed or exercised: the room card controls on real devices, the retry panel against a restarting add-on behind
  Ingress.
- BACKEND-SAFETY-2435: back to its owner (rebase on 2.43.5, find the socket left open, entry check again).

## 9. Rollback

Back to 2.43.5: no migration. The eight `map.*` settings keys are ignored by 2.43.5.
