# CR-POLL-FEATURES-2439 - the feature modules' hand-rolled polls moved onto the shared PollController

Branch `pilot/CR-POLL-FEATURES-2439` (master plan row `CR-POLL-FEATURES-2436`, section 3.3 wave 2 frontend; theme T2). Based on
`origin/pilot/AUDIT30-COMBINED-2435` at ef7f57c07, because three generator pages (`gen-alerts-page.ts`, `gen-live-page.ts`,
`gen-log-page.ts`) are held by it, with **`origin/pilot/CR-POLL-SCREENS-A-2436` (be4486204) merged in** for
`components/poll-controller.ts`. Only that one wave-1 branch is merged, not the whole `CR-WAVE1B-COMBINED-2436`: the file is
byte-identical in both, the branch merges into AUDIT30 without conflict, while AUDIT30 + WAVE1B conflict in
`screens/system-diagnostics.ts` and the backend `routers/settings.py` (outside this row). When the lead combines AUDIT30 + WAVE1B +
this branch, POLL-SCREENS-A is already an ancestor of WAVE1B: no extra conflict. No version bump, no backend change, no pixel change.

## Finding covered

**D2 / 08:F06**: polling hand-rolled about 15 times; three loops polled in a hidden tab (`tickets/inbound-queue.ts`,
`tickets/intake-queue.ts`, `wall/sw-wall-plan.ts`); `door-windows/emergency.ts` ran an `async` callback every 1.5 s with no
in-flight guard (slow answers overlapped, an older answer could overwrite a newer incident state).

## What changed

| File | Poll id | Period | Condition (kept) | Before |
|---|---|---|---|---|
| `tickets/inbound-queue.ts` | `inbound` (`refresh`) | 60 s | - (`refresh` itself skips a non-manager) | bare interval, polled while hidden |
| `tickets/intake-queue.ts` | `summary` (`refreshSummary`) | 60 s | - | bare interval, polled while hidden |
| `generator/gen-alerts-page.ts` | `alerts` (`load(true)`) | 15 s | alerts mode only | interval + `document.hidden` |
| `generator/gen-chart-set.ts` | `history` (`load(true)`) | 60 s | not a custom range | interval + `document.hidden` |
| `generator/gen-live-page.ts` | `live` (clock + `poll()`) | 5 s | - | interval + `document.hidden` |
| `generator/gen-log-page.ts` | `runs` (`load(true)`) | 30 s | - | interval + `document.hidden` |
| `maintenance/emergency-page.ts` | `readiness` (`load`) | 60 s | - | interval + `visibilityState` |
| `maintenance/list-page.ts` | `tasks` (`load`) | `POLL_MS` | no round / form open | interval + `visibilityState` |
| `maintenance/log-page.ts` | `log` (`load`) | 60 s | - | interval + `visibilityState` |
| `wall/sw-wall-plan.ts` | `floor` (`refresh`) | 30 s | `refresh` keeps its own guards | bare interval |
| `door-windows/emergency.ts` | `incident` (`readIncident`) | 1.5 s | only while the incident is `applying` | `setInterval(async ...)`, no guard |
| `tickets/live-refresh.ts` | `LiveRefresh` (8 ticket screens) | 20 s / caller's | visible; resume after 1 s | own `setInterval` + listeners |

- `tickets/live-refresh.ts` is now a thin alias over the same engine (`api/live-refresh.ts` `LiveController`, the one under
  `PollController`): same public API (`new LiveRefresh(run, ms)`, `start()`, `stop()`), exact period (no jitter), visible only,
  focus / visibility resume with its 1 s gap. A callback that throws is reported with `console.error` and does not back the poll
  off (as with the old interval). The eight callers are unchanged.
- `api/live-refresh.ts`: one additive optional field `LiveSource.resumeGapMs` (default `MIN_GAP_MS`, 5 s) so the tickets lists
  keep their 1 s resume gap. Every other source behaves exactly as before.
- `door-windows/emergency.ts`: the follow-up read never overlaps (the next read is armed after the previous one returned); an
  answer that arrives after the sheet was closed or reopened on another incident is dropped (id check). The 0.5 s local confirm
  countdown stays a plain timer (no request).
- `gen-live-page.ts`: the controller field is `poller` (the element already has a `poll()` method); the "ago" clock moves with
  each read, as before.

Intentional behaviour differences (the purpose of D2): no request while the tab is hidden at the four sites above that had no
check; one catch-up read per source on resume (visible / focus / pageshow / online) when its last read is older than 5 s (tickets
lists: 1 s); a slow read is never doubled and the next tick is one period after it finished. `LiveRefresh` gains `pageshow` /
`online` as resume events and pauses while offline. Nothing else: same periods, same predicates, same reads.

## Tests (run locally, Windows, Node 24.21.0)

- `npx tsc --noEmit` (full project): **0 errors**.
- `npx playwright test -c playwright.unit.config.ts --workers=1 tests/unit-poll-features.spec.ts
  tests/unit-tickets-live-refresh.spec.ts tests/unit-live-refresh-295.spec.ts tests/unit-poll-controller.spec.ts
  tests/unit-tickets-overlay-menu.spec.ts`: **70 passed**.
  - New `unit-poll-features.spec.ts`: per site, wired to `PollController` with its id, period and predicate, no bare server
    interval left; the in-flight guard (a slow incident read is never overtaken; hidden tab; self-cancel when no longer applying);
    the start / stop lifecycle (disconnect leaves no timer or listener, reconnect polls again without doubling).
  - `unit-tickets-live-refresh.spec.ts` moved with the helper: driven through the engine's fake clock (`LiveEnv`) instead of a
    stubbed `window.setInterval`; same assertions (20 s, focus, visibility, hidden, 1 s gap, stop) plus restart and throwing callback.

## Not run

- Runner entry check and pixel baselines: not queued, by the lead's instruction (combined later with other frontend branches).
- Browser evidence / layout specs of the touched screens (generator, maintenance, tickets, wall, door emergency): NOT_RUN locally.
- Pixels: none expected (no markup or CSS change).
