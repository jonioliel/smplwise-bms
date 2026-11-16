# FE-WAVE2-COMBINED-2440 - paging setting + frontend batch A, one combined entry check

Branch `pilot/FE-WAVE2-COMBINED-2440`. Plan: `private/handoff-package/READ_FIRST_2026-11-15.md`, "Merge order", frontend chain
(after AUDIT30, build one FE-WAVE2-COMBINED branch with PAGING + FE batch A, one entry check).

## Base

- `origin/main` was checked first: the 2.43.7 train has **not** landed there (v2.43.7 not tagged, `release/2437-train` is not an
  ancestor of `origin/main`), so the base is the train.
- `origin/release/2437-train` had moved past the named `ec1905db2` by three commits: `f5450a913` (2.43.7 version, changelog, API
  inventory), `e5adf7d13` (the train's change note), `32c4a2275` (test: the async-route PENDING list emptied now that
  AUTH-REVOKE-GATE is in). They hold no frontend source change, and the last one is a gate test fix the entry check needs, so the base
  is the train tip **`32c4a2275`** (it contains `ec1905db2`). `release/2437-train` itself was not touched.

## Merges (in order, `--no-ff`)

| # | Branch | Head | Merge commit | Conflicts |
|---|---|---|---|---|
| 1 | `pilot/PAGING-SETTING-2439` | `f68da7544` | `00ea1c821` | none |
| 2 | `pilot/CR-POLL-FEATURES-2439` | `ca6a7c478` | `22fe40616` | `frontend/src/maintenance/emergency-page.ts` (below) |
| 3 | `pilot/CR-SHELL-TIMERS-2439` | `03f9e01f7` | `50cc8e720` | none |
| 4 | `pilot/CR-SOCKETS-2439` | `830b4fd69` | `7a0b83c42` | none |
| 5 | `pilot/CR-API-PATHS-2439` | `c450bc8af` | `fb41d5e94` | none |

### Resolutions

1. `frontend/src/maintenance/emergency-page.ts` (merge 2): PAGING added the `PageFit` field (`fit`, the checklist pages) next to the
   old `private timer?: number`; POLL-FEATURES replaced the `timer` field with `private poll = new PollController(this)` and the
   interval with `this.poll.every('readiness', 60_000, ...)`. Kept both new fields (`fit` and `poll`), dropped `timer` (nothing
   references it any more: no `setInterval` / `clearInterval` left in the file). The rest of the file (the PAGING foot band and
   pager, the POLL-FEATURES `connectedCallback`) merged cleanly. `maintenance/list-page.ts` auto-merged the same way (PAGING's
   `PageFit` + POLL-FEATURES' `PollController` with the `!this.run && !this.form` predicate) - checked by hand.
2. `media.video_notice_after_min` (SHELL-TIMERS note): already in `smplwise_vms/backend/smplwise/services/settings_store.py` on the
   train (`DEFAULTS` line 34, `INT_KEYS`), once each, and the `SettingsPatch` field in `routers/settings.py`. Merge 3 was clean and
   added nothing there; not duplicated.
3. CR-SOCKETS: `api/reconnecting-socket.ts` (SESSION-DEMO-WS-2435) is already in the base; the branch's merge of it is a no-op here.
4. SHELL-TIMERS' slow 6 s header re-check after the row settles is kept (accepted by the lead).

### Combined-only fix

5. `frontend/tests/unit-shell-timers.spec.ts` (SHELL-TIMERS) pins every bare `setInterval` in `frontend/src/components/`. On this base
   it failed once: `components/sw-room-card.ts` (the 3D room card, PLAN3D-R28-UI-2433, on main since 2.43.4) was not in SHELL-TIMERS'
   base and has one interval. It only bumps the still image's cache key (`bust`) every `STILL_MS`, and only while the card shows a
   still, no live video, and the tab is visible - the same kind as the recorded door-picture refresh of `sw-incoming-call.ts`. Recorded
   in `LOCAL_CLOCKS` with that reason (commit `647056938`); the component itself is unchanged (no behaviour or pixel change on the 3D map).

## Tests (run locally, Windows, Node 24.21.0, `--workers=1`, one run at a time)

| Run | Outcome |
|---|---|
| `npx tsc --noEmit` (full project) | exit 0 |
| `npm run build` (tsc + vite build) | exit 0 (built in 6 min 26 s; the usual chunk-size warnings) |
| PAGING: `unit-long-lists-2439.spec.ts` (unit config) | 7 passed |
| POLL-FEATURES: `unit-poll-features`, `unit-tickets-live-refresh`, `unit-live-refresh-295`, `unit-poll-controller`, `unit-tickets-overlay-menu` | 70 passed |
| SHELL-TIMERS: `unit-shell-timers`, `unit-poll-controller`, `unit-live-refresh-295` | first run 57 passed, 1 failed (the `sw-room-card.ts` interval, resolution 5); after the fix `unit-shell-timers` 17 passed |
| SHELL-TIMERS: backend `tests/test_video_services_2431.py` (`.venv` Python, `-p no:xdist`) | exit 0 (the summary line was cut by my output filter; no failure) |
| SOCKETS: `unit-sockets-2439`, `unit-reconnecting-socket-2435`, `unit-live-refresh-295` | 34 passed |
| SOCKETS: the 21 `unit-wiskey-*` + `unit-wkaudin-295` + `unit-wkf01f02-295` | 252 passed |
| API-PATHS: `unit-client-path` + the 13 source-reading unit specs of its note | 132 passed |
| PAGING: `layout-noscroll-1366.spec.ts -g "long lists set to scroll"`, `--project=desktop` (vite preview of this build, demo backend) | 40 passed (8.6 min) |
| SHELL-TIMERS: `evidence-shell-hidden-poll-2439.spec.ts`, `--project=desktop` | first try: Playwright's 30 s webServer start timed out (loaded PC, no test ran); second try with the preview started first: 1 passed |

## Pixels

No baseline refreshed. PAGING's own analysis (its change note, section 4) is that no compared baseline covers a surface that changes
in the default paged mode; the four other branches have no markup or CSS change. Checked again on this branch: none of the pixel
specs images the General settings tab, the Devices settings tab, the playback compare grid, the maintenance ledger or the emergency
checklist; the paged screens they do image (temperatures in `layout-audit30-e-infra`, camera health in `pixel-audit30g-video`,
calendars in `audit30-f-calendars`, schedules / multimedia in `visual-matrix`) are unchanged in paged mode. The entry check's pixel
step is the proof; if it turns red on a pixel, the baselines are refreshed on the runner and the check re-queued.

## Not run

- Full suites, evidence / layout / pixel suites beyond the rows above: for the runner entry check (queued, see below).
- `unit-session-me-failure-2435.spec.ts` (SESSION-DEMO-WS): needs a running preview, NOT_RUN here (as in the SOCKETS note).
- The original NOSCROLL-1366 block of `layout-noscroll-1366.spec.ts` (paged mode): for the entry check.

## Entry check

Queued on the runner: `ENTRY_TOTAL_SECS=10800 ~/gate2/branch_check.sh pilot/FE-WAVE2-COMBINED-2440 --max-wait 0`, log
`~/pre/entry_few2.log`, verdict `~/smplwise-results/entry_pilot-FE-WAVE2-COMBINED-2440_<sha9>.md`.
