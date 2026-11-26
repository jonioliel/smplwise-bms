# TIME-CORRECT-2540 - time, day and booking truth (target 2.54)

Branch `pilot/TIME-CORRECT-2540`, base `origin/release/2530-train` at `aeb05ad3d`. Review findings from
`docs/review/DEEP-REVIEW-2520-FRONTEND-SCREENS.md` (SCR-13, SCR-20, SCR-34, SCR-36, SCR-37, SCR-38) and
`docs/review/DEEP-REVIEW-2520-DOMAIN-MODULES.md` (D-04). Every finding was confirmed still present at the base before the fix.

## What changed and why

### SCR-37 - booking times one hour off on the two DST-change days
`instantAt(day, min)` (grid), `slotGrid` (resident start grid) and `firstFree` ("find a free room") built an instant as
*midnight + elapsed minutes*. On the 23-hour day (Fri 27.03.2026 in Asia/Jerusalem) a 10:00 selection was stored as 11:00, on the
25-hour day (Sun 25.10.2026) as 09:00, while entries are drawn by the wall clock.
- `calendars/model.ts`: new `atMinute(day, min)` = `new Date(y, m, d, 0, min)` (the clock; 1440 = next midnight); `slotGrid` uses it.
- `calendars/grid-logic.ts`: `instantAt` = `atMinute`; the hint's end minute is "same date ? clock minute : 1440" (the old
  `end - midnight >= 24 h` read a booking ending at midnight on the 23-hour day as 00:00).
- `calendars/booking-logic.ts`: `firstFree` builds by the clock.
- `calendars/event-drawer.ts`: the availability bar is drawn by the clock, the "next free" search stops at 22:00 by the clock.
- Not changed (on purpose): the rooms timeline (`view-rooms.ts` tap + `model.span`) and the resident's time bar (`resident.ts` tap) still
  use elapsed minutes. They are self-consistent (the tap and the drawing agree, the stored instant is what the label shows); on a DST day
  their hour axis is off by one after the change hour. Changing `span` needs the resident tap lines too, and `resident.ts` is
  STALE-ANSWERS-2540's file in this release (open question 1).

### SCR-38 - drawer cancel on one date of a weekly entry cancelled the whole series silently
- `calendars/booking-logic.ts`: `drawerDetail(o)` - opening the drawer on an occurrence carries `occurrenceKey` (the server's local key,
  `occurrenceKey(o)`) and `occurrenceStart`; `view-calendar.ts` and `view-rooms.ts` open the drawer with it; `ctx.ts` `NewEventDetail` has the
  two optional fields.
- `calendars/event-drawer.ts`: the confirm step of a recurring entry asks "מה לבטל?" with a radio segmented control - "רק <day dd.mm>"
  (default when the date is known) / "כל הסדרה"; the button says "ביטול המועד" / "ביטול הסדרה"; the request sends
  `scope: occurrence` + the local key only for "only this date"; the toast names what was cancelled. Without a usable key (an older server
  row) the note says the whole series and the button says "ביטול הסדרה". A single booking keeps the one-step "כן, לבטל". Shown in the read-only
  view and in the edit form (at the top of the form, scrolled into view when the cancel is pressed). A pending request is still withdrawn /
  cancelled as a whole (as on the home screen).
- `calendars/demo.ts`: the demo's weekly entries carry their local key, like the server's rows.

### SCR-36 - resident "my bookings": a failed load read as "no bookings"
`calendars/resident.ts` (my-bookings error state only; the day race is STALE-ANSWERS-2540's): a failed `mine()` keeps `mine = null` and
sets `mineError`; the tab shows `sw-state-panel state="error"` "לא הצלחנו לטעון את ההזמנות שלך" with "לנסות שוב" (the upcoming / past switch
stays). The shared `error` (the rooms read) is no longer overwritten by this read.

### SCR-34 - home: a displaced booking shown as "approved"
`home/home-p2-api.ts` `bookingLook(state)`: confirmed (ok) / pending (warn) / displaced (danger, "נדחקה בגלל תחזוקה") / done (neutral,
"הסתיימה") / anything else "מצב לא ידוע" - never "approved" by default. `home/home-calendar.ts` draws the row's state through it.

### SCR-20 - electricity bill times printed in UTC
`electricity/elec-format.ts`: `fmtDateTime(iso, zone?)` and `fmtDate(iso, zone?)` - an instant WITH a zone (`...Z`, `+hh:mm`) is formatted
through `api/day-format.ts` on the clock of `zone` (the bill snapshot's `period.timezone`, which the server reports; else the browser =
the installation's zone, as the rest of the UI). A text without a zone (a local time, a bare day) stays as written. Used for the bill log
(`elec-bill-page.ts`), the "sent" / "paid" dates and the bill paper's "end of period reading at" (`elec-bill-paper.ts`). The closing
reading of 01:30 on 01.12 now prints "01.12.2026 01:30" (was "30.11.2026 23:30").

### SCR-13 - physical commands stamped from an unsynchronised device clock
Backend contract checked (`routers/access_control_command.py` `_envelope`: `expires_at` must be within (now, now + 45 s] on the server's
clock; the overview and `/intercom/calls/active` already send `server_time_ms`; `/access-control/stations` does not). No backend change:
- new `api/server-clock.ts` - `noteServerTime` (exact, from a body's `server_time_ms`), `noteDateHeader` (the HTTP `Date` header, 1 s
  resolution, never replaces an exact sample), `serverNow`;
- `api/client.ts` `fetchApi` feeds every API answer's `Date` header (so the native stations screen, which never reads the overview, is on
  the server's time line too); `api/intercom-calls.ts` `getActiveCalls` feeds its `server_time_ms` (the banner ignored it);
  `api/intercom.ts` re-exports `serverNow` from there (every importer unchanged) and the overview feeds it as before.
A mock's `server_time_ms: 0` or an unparsable header teaches nothing.

### D-04 - room double booking beyond the series cache horizon (backend)
`services/calendar/occ.py`:
- `blockers(..., now=None)`: past the cache edge (`cache_edge`: the last nightly roll + `series_horizon_days` - 1, at most
  `now + horizon - 1`; no roll on record = `now`) the holder's open series (its own calendar at the event state, a room half at the room
  state, terminal states skipped) are expanded on the fly for the spans' own window only (exceptions / overrides excluded as the cache does)
  and merged with the cached rows (deduplicated by event + local key). Every caller (booking, preview, approval, sync engine) gets it.
- `spans_past_window(...)`: the mirror - a NEW series is also expanded from its horizon window's end up to the farthest cached entry on the
  holder, so a single booking further ahead is met.
- `event_occurrences(..., window=)`: an explicit UTC window for a series.
`services/calendar/events.py` `evaluate`: uses both (passes `now`).
`services/calendar/jobs.py`: the nightly roll checks the dates it just added (from the previous roll's edge to `now + horizon`) for two
confirmed entries of different bookings at the same time on an exclusive holder (two series whose first common date is past the horizon -
the one case a booking-time check cannot see) and reports them: one audit row `calendar.occurrence.collision` (ids and instants only) and
a log warning; `run()` returns `collisions`. The calendars module has no notification channel yet (`notices.py`), so nothing is sent.
Not done: refusing `series_horizon_days` below the largest `horizon_days` (with the live expansion the gap no longer double-books; a new
422 on settings save could block an existing installation - open question 2).

Additive only: no response field removed or renamed; `run()` gains a key; no new setting (the behaviour change is a correctness fix).

## Tests

All runs on the Linux runner (`~/work/p2520_timecorrect_run.sh`, log `~/work/p2520_timecorrect_run.out`). "Before" = the base with the
branch's new test files copied in.

Run 1 (`~/work/p2520_timecorrect_run.sh`, head `418a8c33d`) and run 2 (`~/work/p2520_timecorrect_run2.sh`, head `8c47fb951`).

**Before (fails at the base, as it should):**
| Check | Command | Exit | Result |
|---|---|---|---|
| backend D-04 | `pytest tests/test_calendar_far_series_2540.py` | 1 | 5 of 5 failed (booking `confirmed` instead of `pending`; preview `[]`; roll reports nothing) |
| frontend unit | `playwright test -c playwright.unit.config.ts tests/unit-time-correct-2540.spec.ts` | 1 | the file does not load (`server-clock` / `atMinute` do not exist) |
| evidence | `playwright test tests/evidence-time-correct-2540.spec.ts --project=desktop --project=mobile` | 1 | 8 failed, 1 passed (the single-booking guard), 5 skipped (project filters) |

**After (the branch):**
| Check | Exit | Result |
|---|---|---|
| ruff `smplwise/services/calendar` + the new test | 0 | all checks passed |
| pytest new D-04 file | 0 | 5 passed |
| pytest calendar engine + recurrence + values-char | 0 | 1867 passed |
| pytest calendar grid-edit + attendees | 0 | 38 passed |
| pytest calendar sync + connect + feed review | 0 | 84 passed |
| pytest home v3 p2 + home followup + screens-fix-b2 + wire calendar + janitor + be-small-unify | 0 | 87 passed |
| pytest singletons registered + wire ratchet | 0 | 11 passed |
| `npm run build` (tsc + vite) | 0 | |
| `npm run typecheck` (tests + scripts) | 0 | 0 TS errors |
| eslint `src` + new specs | 0 | 0 errors (2 warnings: the new spec files match the lint ignore pattern) |
| `scripts/design_ratchet.py` | 0 | no count above the baseline |
| unit: new + calendars (ui, grid-edit, conflict-hint, attendees, switch-reach) + electricity billing + format pins + response models + incoming calls + screens-fix-b2 + i18n cal/elec completeness + lint + rtl-logical | 0 | 151 passed (new file alone: 9 passed) |
| unit i18n English ratchet | 0 | 6 passed |
| unit `-g "intercom\|access\|wiskey\|client\|server"` (every unit spec touching the API client / intercom clock) | 0 | 985 passed, 1 skipped |
| evidence new (desktop + mobile) | 0 | 9 passed, 5 skipped (project filters) |
| evidence calendars views + settings + grid-edit | 1 | 102 passed, 1 failed, 21 skipped - the failure is `SCR-03 "only this date"` (resident, mobile; "element was detached" for 60 s under load). Re-run x3 at the base: 3 passed; x3 on the branch: 3 passed - a load flake, not this change |
| home-v3-p2 + home-v3-auditfix + evidence-incoming-call (preview server) | - | passed (63 passed in the combined run); `electricity-bills.spec.ts` needs the Vite DEV server (its harness page) and timed out on the preview server - re-run below |
| electricity bills + readings + accounts on the Vite dev server | 0 | 92 passed |
| pixel compare of the touched screens' existing baselines (home-fb, mb-filter, round4-leftovers, sw-segmented, incoming-call, home-gaps, home-auditfix) | 0 | 73 passed, 9 skipped - no existing baseline changed |
| new pixel spec `pixel-time-correct-2540.spec.ts` | 0 | baselines generated (`--update-snapshots`, 8 passed), then compared twice: 16 passed |

New Linux baselines (`frontend/tests/pixel-time-correct-2540.spec.ts-snapshots/`, 8 files): the drawer's cancel step (desktop light /
dark), the resident's load error (phone light / dark), home my bookings with a displaced booking (desktop / phone; the home screen keeps its
own theme, so its light and dark files are the same picture). Compare page (Hebrew, local):
`private/planning/time-correct-2540_compare_2026-11-26.html` (before / after shots of the three states, desktop + phone, light + dark).

NOT_RUN: the full release gate; the lab (no lab in this row); tablet project.

## Open questions

1. The rooms timeline and the resident time bar draw by elapsed time on a DST day (axis one hour off after the change; stored times are
   right). Fix them in a follow-up row after STALE-ANSWERS-2540 merges (it owns `resident.ts`)?
   a. yes, a small follow-up in 2.55 (recommended)  b. now, in this branch  c. leave it
2. Also refuse a `series_horizon_days` smaller than the largest calendar `horizon_days` (the review's third suggestion)?
   a. no - the live expansion closes the gap and a new refusal could block a settings save (recommended)  b. yes, a 422 on save
3. Tell the room manager about a collision the nightly roll finds (today: audit row + log only, the module has no notice channel)?
   a. later, with the calendars notification channel (recommended)  b. a system notice now
