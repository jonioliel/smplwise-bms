# STALE-ANSWERS-2540 - a late answer never overwrites a newer selection; a double action runs once (2.54)

Source: `docs/review/DEEP-REVIEW-2520-FRONTEND-SCREENS.md` on `origin/review/DEEP-2520-FRONTEND-SCREENS` (index
`docs/review/DEEP-REVIEW-2520-INDEX.md` on `origin/chore/REVIEW-FINDINGS-INDEX-2530`). Base: `origin/release/2530-train` at
aeb05ad3d. Branch `pilot/STALE-ANSWERS-2540`.

Findings fixed here: SCR-19, SCR-24, SCR-28, SCR-32, SCR-33, SCR-35, SCR-39 (all medium; each confirmed still present at the base
before the fix). SCR-11 (incoming-call banner) and SCR-14 (NVR system card) were in the first commit and were reverted on the
coordinator's scope change: they are owned and fixed by `pilot/PHYSICAL-CONFIRM-2540` (465360eb4). The branch leaves
`components/sw-incoming-call.ts`, `components/incoming-call-logic.ts`, `home/sw-home-call.ts` and `screens/system-setup.ts` exactly as
the base has them.

## Shared helpers - reused, nothing new

The code base already had both guards, so no new helper was added:
- `api/latest.ts` `Latest` (CR-POLL-SCREENS-B-2440): `begin()` returns "is this still the newest read?", `cancel()` makes every read in
  flight stale. Used by SCR-19, SCR-24, SCR-32, SCR-33, SCR-35.
- `api/seek-coalescer.ts` `SeekCoalescer` (PLAYBACK-SCRUB-2341, the investigate screen's seek queue): one request in flight, the newest
  waiting one replaces older waiting ones. Used with `delayMs: 0` + `flush()` (no debounce) by SCR-28.

## SCR-19 - bulk dialog: an earlier run's result no longer rewrites or reopens the dialog

`screens/devices-bulk.ts`: a `Latest` token per confirmed run. Closing the dialog while it runs ("you may close this window") and
opening it for another request make the run stale: its progress and result are no longer drawn, the dialog is never reopened, and the
screen still gets `bulk-done` (it reloads its counts when the run really ends). Every run still being followed is stopped when the
dialog leaves the page (was: only the last one).
Not changed (open question 2): one failed poll of a running bulk still ends in the error step though the server run goes on.

## SCR-24 - recorded playback: the newest camera / day pick wins

`screens/investigate-playback.ts`: `selectCamera` and `setDate` each take a `Latest` token BEFORE the "same as now" check and drop
themselves after `await this.endSession()` when a newer pick began meanwhile (X playing -> A -> B: A's slow close no longer sets the
screen back to A while the picker shows B; A -> B -> A drops the waiting B). `setDate` also skips the opening position when a newer day
was picked during the read. Both tokens are cancelled when the screen leaves.

## SCR-28 - home recordings: one session per double tap, seeks never overlap

`home/home-recordings.ts`: `playAt` sets the timeline position at once and hands the request to a `SeekCoalescer` with no debounce;
`runPlay` is the old body (create when there is no session, else seek). A second tap on play while the first create is on its way
waits and then seeks the session the first tap opened (was: a second session, never closed, holding a recorder playback slot until
its lease ran out). Three quick "+10 s" send two seeks one after the other, the last one being the position asked for last (was: three
overlapping seeks, the last answer to land won). `stop()` drops a waiting request.
Not changed (open question 3): the screen's clock is still a wall-clock counter started at the seek answer.

## SCR-32 - home electricity bill: one account's money is never shown under another

`home/home-p3.ts` `loadBill`: switching to another account clears `status` / `periods` (the existing "loading the bill" panel shows
instead of the previous account's amounts), and an answer for an account no longer selected - or overtaken by a newer read - is dropped.

## SCR-33 - home scene sheet: a late detail of scene A is never saved onto, or deleted as, scene B

`home/home-scene-2500.ts`: one `Latest` token per opening of the sheet. The detail is applied only to the sheet it was read for (and
only while that sheet still shows the same scene id); save reads the scene id once before the capture (was: `ed.id` read again after
the capture); a late save / delete answer closes the sheet and shows its error only when that sheet is still the one open.

## SCR-35 - resident room list: the selected day's answer wins

`calendars/resident.ts` `loadDay`: a `Latest` token; an older day's answer (or error) landing last is dropped, and the "slow" timer
belongs to the newest read. (SCR-36, the failed "my bookings" read, is not in this row.)

## SCR-39 - home ticket note is sent once

`home/home-tickets.ts` `p2TkNoteSend`: returns while a note is on its way, and asks the host to redraw at once so the button is
disabled before a second tap (the sibling `p2TkSend` already did both). Not changed (open question 1): no `client_request_id` - the
server's note body (`routers/home_family.py` `NoteBody`, `extra="forbid"`) does not accept one.

## Files

`frontend/src/screens/devices-bulk.ts`, `frontend/src/screens/investigate-playback.ts`, `frontend/src/home/home-recordings.ts`,
`frontend/src/home/home-p3.ts`, `frontend/src/home/home-scene-2500.ts`, `frontend/src/calendars/resident.ts`,
`frontend/src/home/home-tickets.ts`; tests `frontend/tests/unit-stale-answers-2540.spec.ts` (node) and
`frontend/tests/evidence-stale-answers-2540.spec.ts` (the real screens, mocked backend, one answer held back per test).
No look change (no new text, colour, size or element): no pixel baselines and no compare page.

## Tests

Run on the workstation (Node unit specs only, one file at a time, as the PC rules allow; TZ Asia/Jerusalem from the unit config):

| Command | Code | Exit | Result |
| --- | --- | --- | --- |
| `npx playwright test -c playwright.unit.config.ts tests/unit-stale-answers-2540.spec.ts` | branch c11ea7b06 | 0 | 11 passed |
| the same spec with the 7 source files put back to the base (aeb05ad3d), then restored | base | 1 | 7 failed (SCR-19, 24, 28, 32, 33, 35, 39), 4 passed (the reused helpers' own behaviour) |
| `unit-inv-playback-2440` / `unit-home-v3-p1` / `unit-modal-stack-guard-2442` / `unit-home-v3-p3-logic` | branch | 0 each | 9 / 8 / 5 / 6 passed |
| `unit-poll-screens-b-2440` / `unit-playback-scrub` / `unit-home-lazy-2440` / `unit-screens-fix-b-2520` | branch | 0 each | 10 / 12 / 6 / 3 passed |

NOT_RUN (queued on the runner as `~/work/p2520_stale2540_run.sh`, output `~/work/p2520_stale2540_run.out`; it waits for a slot
behind the 2.53 L gate that started 12:24 UTC): `tsc` (app and tests), eslint on the touched files, `scripts/design_ratchet.py`, the
wider unit list, `vite build`, `tests/evidence-stale-answers-2540.spec.ts` on the branch and on the base (the fail-before of the
browser races), and the neighbouring browser specs (`home-v3-p1/p2/p3`, `home-favorites-2500`, `evidence-playback-stall`,
`evidence-switch-light-dimmer-2331`, the resident part of `evidence-calendars-settings-2310` on the phone project).
Pixel baselines: not needed (no look change) - NOT_RUN.

## Open questions (recommendation first)

1. Ticket note request id (SCR-39 second half): (a) a later backend row adds an optional `client_request_id` to
   `POST /home/tickets/{id}/notes` with replay protection, the home sends it; (b) leave it - the frontend guard covers the double tap.
2. A failed poll of a running bulk action (SCR-19 last sentence): (a) keep polling until the deadline and say "still running on the
   server" instead of the error step; (b) leave it.
3. Home recordings clock (SCR-28 second half): (a) take the playing time from the player (as the investigate screen does);
   (b) leave the wall-clock counter.
