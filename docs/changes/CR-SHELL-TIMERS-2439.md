# CR-SHELL-TIMERS-2439 - the shell's timers and the component polls under one rule

Branch `pilot/CR-SHELL-TIMERS-2439` (master plan row `CR-SHELL-TIMERS-2436`, section 3.3 wave 2 frontend; theme T2).
**Base: `origin/pilot/AUDIT30-COMBINED-2435` (ef7f57c07) with `origin/pilot/CR-WAVE1B-COMBINED-2436` (1a7e19ae3) merged in**: the
row needs both - `shell/sw-app.ts`, `shell/dd-place-fit.ts` and `components/poll-controller.ts` come from WAVE1B (SHELL-LAZY,
POLL-SCREENS-A, the WAVE1B placement-3 fix), and four of the component files (`media-player-panel.ts`, `media-remote.ts`,
`media-queue-list.ts`, plus the recorded `media-*` / `wk-*` clocks) are held by AUDIT30.

The merge had two conflicts (rerere replayed an earlier resolution, checked by hand):
- `frontend/src/screens/system-diagnostics.ts`: import union (WAVE1B `healthSummary` / `HealthSummary`, AUDIT30 the video-service picker).
- `smplwise_vms/backend/smplwise/routers/settings.py`: WAVE1B moved the registry to `services/settings_store.py`; AUDIT30 had added
  `media.video_notice_after_min` to `DEFAULTS` and `INT_KEYS`. The resolution keeps the WAVE1B shape and **carries the AUDIT30 key into
  `settings_store.py`** (rerere alone had dropped it); the `SettingsPatch` field and the `Literal` import merged cleanly.
  `tests/test_video_services_2431.py`: 15 passed. The lead's AUDIT30 + WAVE1B combination needs the same resolution.

No version bump, no migration, no pixel change.

## Findings covered

- **D2 / 07:F14 (shell)**: `sw-app.ts` polled the system summary and the alert counts every 60 s also while hidden, and ran `fitDd()`
  every 1.2 s for the life of the page (walking shadow roots and reading layout).
- **D2 / 07:F14 (components)**: the bare `setInterval` timers in `components/` (resolved list below).
- **07:F24 (header fit)**: the header-fit logic (`fitDd` and its bookkeeping, about 200 lines) extracted from `sw-app.ts`.

## What changed

Shell (`shell/sw-app.ts`, new `shell/header-fit.ts`):
- System status: `PollController` registration `system` every `SYS_POLL_MS` (60 s) reading the summary and the alert counts
  (`Promise.allSettled`: a failed read never backs the period off, as with the old interval). Nothing while hidden; one read on return
  (visible / focus / pageshow / online, when the last read is older than 5 s). `sysTimer` as the "already started" flag became `sysStarted`.
- Header fit: `HeaderFit` (a Lit `ReactiveController`) holds `fitDd` (now `pass()`, the measurement byte-for-byte the same), the
  first-paint burst, the collision / title-wait bookkeeping and `collideRoute`. `sw-app.updated()` calls `enterRoute(route)` and
  `sync(fitKey)` where it used to run the same code inline. When it measures:
  - after every shell render (one frame later, as before) and every frame of the burst after a route / placement change (as before);
  - when `.screen`, the chips' row or the floating corner changes size (`ResizeObserver`, a window resize included) - new;
  - on the 1.2 s tick only until the row is settled (`data-dd-fit` present, nothing pending, `DD_SETTLE_PASSES` = 4 clear passes in a
    row), then a slow re-check every `DD_IDLE_CHECK_MS` (6 s); any pass that finds something pending returns to the 1.2 s tick;
  - never while the page is hidden; once on return, then the 1.2 s tick until settled.
  **Deviation from the plan row** ("the 1.2 s tick only until the row is fitted"): the slow 6 s re-check after settling is added on
  purpose. Without it, a header control a screen draws late (its data arrived after the row settled, with no resize and no shell
  render) would never be measured, and a chip could stay over it - a functional loss compared with today. With it the collision fallback
  still happens, at most about 6 s + `DD_COLLIDE_MS` later instead of 1.2 s + `DD_COLLIDE_MS`. Lead decision: keep, or drop the re-check.

Components - resolved list of every bare `setInterval` in `frontend/src/components/` (25 timers in 20 files):

| File | Timer | Sends a request? | Now |
|---|---|---|---|
| `media-player-panel.ts` | `pollTimer` 4 s (player state) | yes | `PollController` `state`, same `when` (no pending key / join) |
| `media-remote.ts` | `pollTimer` 4 s (device state) | yes | `PollController` `state`, same `when` (no pending key, not editing) |
| `media-queue-list.ts` | "up next" re-read | yes, **also while hidden** | `PollController` `upnext` |
| `wk-call-history.ts` | call log re-read | yes | `PollController` `calls` |
| `sw-live-player.ts` | snapshot re-fetch 10 s (transcode cap) | yes (image), **also while hidden** | `PollController` `still` |
| `media-player-panel.ts`, `media-remote.ts` | `tickTimer` 1 s | no (progress clock) | kept |
| `media-now-hero.ts`, `media-player-card.ts`, `media-screen-card.ts` | 1 s ticker | no | kept |
| `cast-store.ts` | 1 s elapsed clock | no | kept |
| `notify-center.ts` | `notifyStore.tick()` 30 s | no (local "ago" recompute) | kept |
| `sw-camera-tile.ts` | 1 s still scheduler | only when visible, in view and due (`stillDue`) | kept |
| `sw-incoming-call.ts` | call clock; door picture | clock no; picture skips while hidden | kept |
| `sw-demo-banner.ts`, `update-run.ts`, `wk-installer-confirm.ts`, `wk-station-maintenance.ts`, `wk-talk-button.ts`, `wk-triage-panel.ts` | clocks | no | kept |
| `wk-announce-dialog.ts` | retry countdown | no | kept |
| `wk-listen-button.ts` | 150 ms level animation | no | kept |
| `media-remote-logic.ts` | repeat-press seam (injected timers) | no | kept |

The local clocks stay plain timers: they send nothing, `PollController`'s catch-up and back-off do not apply to them, and the browser
already throttles them in a hidden tab. `unit-shell-timers.spec.ts` pins this list: a new bare interval in `components/` fails it until
it is recorded or polls through the controller.

## Tests (run locally, Windows, Node 24.21.0)

- `npx tsc --noEmit` (full project): **0 errors** (the two new spec files were written while it ran; they were then checked with a
  temporary config extending `tsconfig.json`, only those files + `src/vite-env.d.ts`: 0 errors; the temporary config was deleted).
- `npx playwright test -c playwright.unit.config.ts --workers=1 tests/unit-shell-timers.spec.ts tests/unit-poll-controller.spec.ts
  tests/unit-live-refresh-295.spec.ts`: **58 passed**.
  - New `unit-shell-timers.spec.ts`: `FitScheduler` with a fake clock (1.2 s until settled then 6 s; pending keeps or brings back the
    fast tick; a render-time pending measurement wakes it; `wake()`; hidden = no measurement and no timer, one on return; `stop()` leaves
    no timer or listener and is restartable); the shell wiring (no `setInterval` in `sw-app.ts`, the `system` registration, `HeaderFit`
    synced after render); the system poll's behaviour (60 s, hidden, one on return, failure keeps the period, detach stops everything);
    the five component polls and the recorded clock list.
- `smplwise_vms/backend/tests/test_video_services_2431.py` (merge resolution): **15 passed**.

## Not run

- New `tests/evidence-shell-hidden-poll-2439.spec.ts` (browser, mocked backend, `page.clock`): no `/health/summary` request in ten
  hidden minutes, one on return, then 60 s again. **NOT_RUN** locally (needs a build + preview); for the runner entry check.
- Runner entry check and pixel baselines: not queued, by the lead's instruction.
- Browser evidence / layout specs of the header placements and the media components: NOT_RUN locally. Pixels: none expected; the
  header-fit specs (`layout-dd-place`, `layout-dd-first-paint`, `layout-dd-click`) are the ones to watch.
