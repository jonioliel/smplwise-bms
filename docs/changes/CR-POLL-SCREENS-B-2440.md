# CR-POLL-SCREENS-B-2440 - the shared poll for the screens AUDIT30 held, the wall's timer leak, the alarm's read order

Branch `pilot/CR-POLL-SCREENS-B-2440`, one commit `4eddadb04` on `origin/release/2437-train` @ `6c5541485`. The branch was
pushed without a change note; this one was written by the combine agent of `pilot/CR-W3-FE-COMBINED-2441` from the commit
(message and diff), as the wave-3 combine brief asks. Plan row: `pilot/CR-POLL-SCREENS-B-2436` in
`private/code-review-2026-11-13/MASTER_PLAN.md` (findings D2 / 06:POLL-1 for the files AUDIT30 held, 06:LW-1, 06:ALARM-1).
No version bump, no CHANGELOG entry, no backend file, no device or lab access.

## What (from the commit)

- **D2 / 06:POLL-1** - `screens/electricity/page-meters.ts`, `screens/water/page-meters.ts`, `screens/water/page-alerts.ts`,
  `screens/live-overview.ts`, `screens/investigate-exports.ts`: `PollController` (`components/poll-controller.ts`, from
  CR-POLL-SCREENS-A-2436) instead of a bare `setInterval`, with the same periods (60 s rows, 60 s overview, 3 s export jobs).
  Nothing is requested while the page is hidden, never two reads of one source at once, one catch-up read on return. The
  overview's 30 s header clock stays a plain interval (it requests nothing).
- **06:LW-1** - `screens/live-wall.ts`: the snapshot and the poster refreshes tick through the shared poll; a read that ends
  after the wall left the page arms nothing (`isConnected` guard right after the awaited read).
- **06:ALARM-1** - `screens/security-alarm.ts` with the new `api/latest.ts` (the newest read wins) around `load()`; the action
  follow-up keeps and stops its signal and ends in a `catch`; `stopHa` is reset on disconnect, so a re-attached screen
  subscribes and polls again; the 15 s read is a poll registration.

## Files

`frontend/src/api/latest.ts` (new), the seven screens above, `frontend/tests/unit-poll-screens-b-2440.spec.ts` (new, 317 lines:
node tests of `latest`, source assertions for the wall, the alarm and the five polls).

## In the combined branch

`CR-DUP-METERS-2440` moved the poll of the two meters pages into `screens/meters-page-base.ts`, so this branch's hunk for
those two files is applied there (see `docs/changes/CR-W3-FE-COMBINED-2441.md`), and the two lines of the "D2: each screen
polls" test that read the two page files read the base instead.

## Tests

What the branch's own agent ran is not recorded anywhere (no note, nothing in the commit message). Runs on the combined
branch are listed in `docs/changes/CR-W3-FE-COMBINED-2441.md`.

## NOT_RUN / pixels

Browser specs of the seven screens, the pixel gate: runner only (the combined entry check). Pixels to refresh: none
expected - no markup or style changed.
