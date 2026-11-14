# RELEASE-2436-TRAIN: assembly of the 2.43.6 train (3D map room pills and room card, session retry, backend safety)

Branch `release/2436-train` (worktree `C:\cloude\smplwise-train40`), cut from `origin/main` = v2.43.5 (`0a8fb55e1`). Assembled
2026-11-14 by the release-train agent on the lead's delegation (standing release authority: tag and push after a passing full gate).
No lab, Home Assistant, NVR, go2rtc, WisKey or device contact; nothing installed. The lab Home Assistant updates the add-on by itself.

## 1. Merges (`--no-ff`, in this order)

Every verdict file was read on the runner before the merge (`~/smplwise-results/entry_<branch>_<sha>.md`): each says GREEN
("ירוק - מותר לעלות לרכבת", engine pass) for exactly the tip below, which equals the branch's origin head at merge time.

| # | Branch | Tip | Runner entry check | Merge commit | Conflicts |
|---|---|---|---|---|---|
| a | `pilot/BACKEND-SAFETY-2435` (`BACKEND-SAFETY-2435.md`) - restore path confinement, housekeeping steps isolated, fast notifier shutdown, an unverified NVR write recorded and undoable, the event listener gap write | 300945228 | GREEN (base 665ec8f24, FULL backend, run 42 min) | 5f747a218 | none (`main.py`, `backup.py`, `notify_sources.py` auto-merged with 2.43.5) |
| b | `pilot/SESSION-DEMO-WS-2435` (`SESSION-DEMO-WS-2435.md`) - a failed `/me` no longer becomes the demo (retry panel); `/me/ws` liveness check | c090f6059 | GREEN (base 665ec8f24, run 86 min) | b5df5d89a | none |
| c | `pilot/PLAN3D-R28-UI-2433` (`PLAN3D-R28-UI-2433.md`) - 3D map round 28: room pills, room card, spread levels, eight `map.*` settings | b6024ea8b | GREEN (base 665ec8f24, run 83 min) | 2688513a9 | none (`api/media.ts`, `system-diagnostics.ts`, `routers/settings.py` auto-merged with 2.43.5) |

The three branches share no file. All three were based on v2.43.4 (`665ec8f24`); the train adds the 2.43.5 changes under them.

### Branches checked and left for the next train

Verdict files read on the runner at 08:52 UTC and again before the UI build:

| Branch | Origin head | Verdict on that head |
|---|---|---|
| `pilot/AUTH-REVOKE-GATE-2435` | 0a3c570e1 | NOT RUN (the earlier run failed at `git worktree add`); re-queued, not reached |
| `pilot/TICKETS-PERF-ERASE-2435` | 5719846af | no verdict yet (queued) |
| `pilot/FE-LEAK-TEXTKEY-2435` | f7e247b60 | no verdict yet (queued) |
| `pilot/HOME-V3-AUDITFIX-2437` | ecee791a1 | RED: `pixel-home-gaps-2436.spec.ts:50 [desktop]` "my notifications" failed again alone |

## 2. Train commits

| Commit | What |
|---|---|
| 1321a9c37 | release: 2.43.6 - version, changelog and API inventory (1908 routes, unchanged: no branch adds a route) |
| (next) | docs (this document) |
| (next) | release: 2.43.6 - rebuilt UI (`npm run build:addon` on the runner) |

`management/tasks.json` and `test_catalog.json` are not changed; no view regenerated.

## 3. Pixel baselines

The only baseline changes in the train come from c, which took its R28 baselines on the runner in its own branch (after its
merge of v2.43.4). No baseline was re-taken in the train. The full release gate runs the pixel specs its selection picks on the
merged tree.

## 4. Receipts

Local: workstation, main checkout `.venv` Python 3.12, Node 24.21.0; `frontend/node_modules` is a junction to the main checkout's.

| Check | Where / SHA | Result |
|---|---|---|
| `npx tsc --noEmit` | 2688513a9 | exit 0 |
| `scripts/api_inventory.py` | 1321a9c37 | 1908 routes (header only changed) |

Further receipts (focused backend tests, release check, UI build) are recorded in the release report.

## 5. Version commit (`1321a9c37`)

- 2.43.5 -> **2.43.6** in `smplwise_vms/config.yaml`, the Dockerfile label and `smplwise/__init__.py`. No bridge change, no migration.
- `CHANGELOG.md`: bilingual entry (Hebrew + English per item): new - room pills, the room card, the building / spread switch, eight
  map settings; improved - the server-unavailable retry instead of the demo, the live connection reconnects, faster stop; fixed -
  restore path confinement, housekeeping steps, unverified recorder change recorded and undoable, event listeners survive a failed
  gap write; install: nothing to do.

## 6. NOT_RUN and open items

- Locally: the full suites and the Playwright projects - the runner's UI build and full release gate cover them.
- Lab: nothing installed or exercised: the room card controls on real devices, the retry panel against a restarting add-on behind
  Ingress, the NVR read-back failure path on the real recorder.

## 7. Rollback

Back to 2.43.5: no migration. The eight `map.*` settings keys are ignored by 2.43.5; restored rows whose unsafe paths were cleared
stay cleared.
