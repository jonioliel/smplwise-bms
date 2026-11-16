# CR-POLL-SCREENS-A-2436 - the shared polling controller and six screens moved onto it

Branch `pilot/CR-POLL-SCREENS-A-2436`, from `origin/main` at 665ec8f24 (v2.43.4). Code-review master plan
(`private/code-review-2026-11-13/MASTER_PLAN.md`) section 3.2, wave 1 frontend; theme T2. No version bump, no backend change,
no migration, no pixel change.

## Findings covered

- **D2 / 06:POLL-1** (for the files free of `AUDIT30-COMBINED-2435`): bare `setInterval` polls that kept requesting in a hidden
  tab, started a second read while a slow first one was pending, and did not catch up when a sleeping phone woke up.
- T2: creates `frontend/src/components/poll-controller.ts`, the shared controller that `CR-POLL-SCREENS-B`, `CR-HOME-RELOAD`,
  `CR-POLL-FEATURES`, `CR-SHELL-TIMERS`, `CR-MULTIMEDIA-BASE` and `CR-WISKEY-NOTIF` import.

## The controller (`components/poll-controller.ts`)

A Lit `ReactiveController` on top of `api/live-refresh.ts` (`LiveController`, unchanged). API:

```ts
private poll = new PollController(this);                        // start on hostConnected, stop on hostDisconnected
this.poll.every(id, ms, run, { when?, fresh? });                 // register / replace
this.poll.cancel(id);                                            // safe from inside its own read
this.poll.has(id); this.poll.now(id);                            // registered? / run now (retry button)
```

From `LiveController`: the next tick is armed after the previous read finished (no overlap); nothing runs while hidden or
offline; on resume (visible / focus / pageshow / online) a source older than 5 s runs once; a read that resolves `false` or
throws backs off. On purpose different from using `LiveController` directly: the period is exact unless `{ jitter: true }`
(so a migrated screen keeps its period), `every()` with a known id replaces it, and `cancel()` from inside the read leaves no
orphaned timer (each registration gets its own internal key; a cancelled-while-running one is dropped one tick after it
finishes). `fresh` (default true) counts the host's own first read, so a resume right after `every()` does not repeat it.

## Screens migrated (period and condition unchanged)

| File | Poll | Period | Condition |
|---|---|---|---|
| `screens/door-windows.ts` | `state` (`load`), `emergency` (`loadEmergency`) | 15 s, 5 s | live backend only (as before) |
| `screens/system-wall.ts` | `profiles` (`load(true)`) | 15 s | not while editing / adding |
| `screens/system-transit.ts` | `catalogue` (status while a catalogue refresh runs) | 3 s | stops itself when done; cancelled on detach (as before) |
| `screens/devices-synoptic.ts` | `board` (`refresh`) | 30 s | - (the 15 s clock stays a plain timer: no request) |
| `screens/messaging-policy-card.ts` | `window` (`refreshWindow`) | 30 s | only while a self-messages window is active |
| `screens/wiskey-events.ts` | `notices` (`onChangeNotice`) | 30 s | only while the change-notice socket is down |

Every migrated read already catches its own errors, so no screen gains a back-off: the period stays the same also on failure.
`wiskey-events.onChangeNotice` now returns the promise of its two reads (the callers `void` it) so the poll waits for them.

Behaviour difference (the purpose of D2, no other change): no request while the page is hidden; one catch-up read per source on
resume; a slow read is never doubled, and the next tick is one period after it finished (was: a fixed wall-clock interval).
`kiosk-wall.ts` (always visible) is left alone, as the row says.

## Tests (run locally, Windows, Node 24.21.0, `playwright.unit.config.ts`)

- New `frontend/tests/unit-poll-controller.spec.ts`, written before the code (first run: module not found): 27 tests - the
  controller (lifecycle, exact period / jitter, hidden + resume, no overlap, `when`, replace, cancel inside the read, replaced
  while pending, `fresh`, back-off) and, per migrated screen, a source check (wired to `PollController`, its ids, no bare server
  interval left, its predicate) and a behaviour check (no request while hidden, one per source on resume, no overlap).
- `unit-poll-controller.spec.ts` + `unit-live-refresh-295.spec.ts`: **41 passed**.
- Touched-area node unit specs (`unit-a11y-polished-lint`, `unit-dark-polish-beds`, `unit-dialog-toplayer-2381`,
  `unit-door-emergency-roles-emrole-295`, `unit-door-retry-open-295`, `unit-door-windows-events`,
  `unit-door-windows-home-widget`, `unit-door-windows`, `unit-messaging-policy`, `unit-synoptic-mobile-2342`,
  `unit-synoptic-phone-settings-2360`, `unit-wiskey-live-validation-2390`): **89 passed**.
- Type check: the full `tsc --noEmit` did not finish within 10 minutes on this workstation (NOT_RUN as a whole). A `tsc --noEmit` over the seven touched files + the new spec (and everything they import) reported **0 errors in them**; its single error, `src/pwa/register.ts(185): Property 'env' does not exist on type 'ImportMeta'`, comes from that subset config not including the Vite client typings (untouched file, not an error in the normal project config). The full type check runs in the runner entry check.

## Not run / skipped

- Browser evidence specs of these screens (`evidence-wiskey-events`, `evidence-access-events`, `evidence-polish4-wp8`,
  `evidence-wall*`, `evidence-door-*`) and the pixel gate: NOT_RUN locally (they need a build + preview; the lead's combined
  wave-1 runner entry check covers them). "Pixels: no" - nothing in markup or CSS changed.
- No runner, device or lab action.
