# SCREENS-FIX-B-2520 - high findings of the deep screens review (2.52)

Source: `docs/review/DEEP-REVIEW-2520-FRONTEND-SCREENS.md` on `review/DEEP-2520-FRONTEND-SCREENS` (aa0a3b4aa), findings SCR-02,
SCR-03, SCR-04 and SCR-05 (all high). Base: `origin/release/2520-train` (bd20831e6). Branch `pilot/SCREENS-FIX-B-2520`.
One commit per finding, each with a test that fails before the fix and passes after it.

## SCR-05 - public handler page: only a pressed "send" goes out when the phone is back online

Why: `public-ticket/main.ts` posted any draft on the browser's `online` event (`hasDraft()` is true for a tapped status chip or any
typed text). A network flap could move a ticket to "done" with a half-typed note on the unauthenticated link page.

What:
- `state.ts`: the draft carries `queued: true` only when "send" was pressed and a call failed for want of reception
  (`afterSendFailure`); any other refusal is not queued (a 409 is never retried by itself). Any change to the draft - chip, note,
  ETA, "ask the manager" - makes it a draft again (`editDraft`). A stored `queued` flag without the request ids a press creates is
  ignored (`parseDraft`). `resendOnReconnect(draft)` is the only rule the `online` handler reads.
- `main.ts`: every draft edit goes through `editDraft`; `send()` sets the queue on an offline failure and clears it when everything
  went out. A queued send is shown as a line "ממתין לשליחה: יישלח כשתחזור הקליטה" with "ביטול השליחה" (the draft stays; nothing goes
  out). The line replaces the old "saved on this device" banner for that case; typing removes it in place (no re-render, the
  keyboard stays).
- Strings in Hebrew, English, Arabic and Russian; one CSS rule (`.banner.queued`, tokens only).

Files: `frontend/src/public-ticket/{state.ts,main.ts,strings.ts,styles.css,lang/lang-ar.ts,lang/lang-ru.ts}`.

## SCR-04 - home "my bookings": one date of a series cancels only that date and names it

Why: every date of a recurring booking is a row with the same `event_id`. The trash looked the row up by `event_id` (the dialog named
the first date) and posted no scope, so the server's default `scope = "series"` cancelled every future date.

What: rows are keyed by `occurrence_id` (pending requests keep their event id). A confirmed date of a series opens its own dialog
naming THAT date with "רק המועד הזה" (first; `scope: "occurrence"` + its local key, the same API call as the full interface),
"כל הסדרה" (only as its own explicit choice) and "ביטול". A row without a usable key offers the series alone, never silently.
Single bookings and withdrawals are unchanged (same ask dialog as before). English texts added to the home catalogue.

Files: `frontend/src/home/{home-calendar.ts,home-p2-api.ts}`, `frontend/src/i18n/lang/en/i18n/msg/home.ts`.

## SCR-03 - resident flow: "cancel only this date" works

Why: `calendars/resident.ts` sent the UTC instant `o.start` as `occurrence_start`; the server requires the local key
`YYYY-MM-DDTHH:MM` (`services/calendar/events.py` `_scope`), so the default choice failed with 422 every time.

What: the resident flow sends `local_start` through `occurrenceKey()` (`calendars/booking-logic.ts`), as the operator grid does. A
series row without a usable key opens with "the whole series" selected and does not draw "only this date". The demo API refuses a
non-local key like the server and cancels only the named date; the demo's weekly resident lesson carries its local key.

Files: `frontend/src/calendars/{resident.ts,booking-logic.ts,demo.ts}`.

## SCR-02 - recorded playback follows the playing position past midnight

Why: `this.date` was set only on open and on a picked date; the ticks moved only the cursor. A session is not clipped to the local
day, so after midnight (or a late seek the server moved into a next-day segment) the stamp showed yesterday's date with today's time,
the timeline kept yesterday's segments, "add to case" bookmarked 24 h earlier, the export opened on yesterday and the next timeline
click sought 24 h back.

What: `tick`, `tickGroup`, `startAt` and the frame step call `followDay()`, which switches the date to the position's local day
(installation zone) and loads that day's recordings, events and bookmarks without ending the session. The stamp date and the
"add to case" instant come from the position (`screens/playback-day.ts`); picking a date clears the old day's position. The export
and the timeline seek keep using `this.date`, which now is the playing day.

Files: `frontend/src/screens/{investigate-playback.ts,playback-day.ts}`.

## Tests

New or extended:
- `frontend/tests/unit-public-ticket.spec.ts` - SCR-05 case (queue only after a pressed offline send; edits and cancel un-queue;
  reload keeps it; the `online` handler wiring; four languages).
- `frontend/tests/evidence-public-ticket.spec.ts` - SCR-05 browser case on the built bundle: chip + note + `online` posts nothing;
  pressed offline -> the waiting line; cancel -> nothing on `online`; an edit un-queues; pressed and left alone goes out on `online`
  with the request id of the press. Writes `public-queued-he-*.png`.
- `frontend/tests/unit-screens-fix-b-2520.spec.ts` (new) - SCR-04 (`cancelBody`, `occurrenceKey`), SCR-03 (`occurrenceKey`, the
  cancel path never sends `o.start`), SCR-02 (midnight on an ordinary night and on the nights into both 2026 DST changes in
  Asia/Jerusalem; stamp date and bookmark instant from the position; the screen wiring).
- `frontend/tests/home-v3-p2.spec.ts` + `home-v3-p2-mocks.ts` (`series` option) - SCR-04 browser case: the third date's dialog names
  it, "only this date" posts `scope: occurrence` + its key; "the whole series" only as the explicit choice.
- `frontend/tests/evidence-calendars-settings-2310.spec.ts` - SCR-03 resident case: "only this date" (default) cancels with no error.

Fails-before evidence (PC): the SCR-05 unit spec against the stashed old `src/public-ticket` fails at import
(`does not provide an export named 'afterSendFailure'`); the SCR-02/03/04 cases import modules or exports that do not exist before.

Results: see "Runs" below.

## Runs

Runner (Linux, slot B, job `~/work/p2520_scrfixb_run.sh` at 9e87a9126, then `~/work/p2520_scrfixb_fb.sh` at ede2e93be):

| Check | Command | Result |
|---|---|---|
| App types | `npx tsc --noEmit -p tsconfig.json` | exit 0 |
| Test types | `npx tsc --noEmit -p tsconfig.tests.json` | exit 0 |
| Lint (changed files) | `npx eslint --pass-on-unpruned-suppressions <changed files>` | exit 0 |
| Design ratchet | `python3 scripts/design_ratchet.py` | exit 0, no count above the baseline |
| Builds | `npx vite build`; `npm run build:public:addon` | exit 0 (public-ticket chunk 19.87 kB gzip) |
| Unit | `playwright -c playwright.unit.config.ts` unit-public-ticket, unit-screens-fix-b-2520, unit-i18n-home, unit-inv-playback-2440, unit-calendars-ui-2310, unit-playback-scrub, unit-playback-stall | 88 passed, exit 0 (incl. the 62 KB public bundle budget on the fresh build) |
| Public page | `evidence-public-ticket.spec.ts --project=desktop --project=mobile` | 14 passed, exit 0 |
| Home calendar | `home-v3-p2.spec.ts --project=desktop` | 16 passed, exit 0 |
| Calendars settings + resident | `evidence-calendars-settings-2310.spec.ts --project=desktop --project=mobile` | 59 passed, 12 skipped, 1 failed at 9e87a9126 (the new SCR-03 case did not page to the booking - a test fault, fixed in ede2e93be); re-run of the resident flow at ede2e93be: 10 passed, exit 0 |
| Playback | evidence-playback-display, evidence-playback-stall, layout-playback-stall, evidence-playback-controls-below `--project=desktop` | 18 passed, 1 skipped, exit 0 |
| Pixel (screens touched) | `pixel-mb-filter-2520.spec.ts pixel-home-auditfix-2437.spec.ts` (all projects) | 14 passed, 16 skipped, exit 0 - existing Linux baselines unchanged, no refresh needed |

Fails before (the branch's new browser cases on the base build `origin/release/2520-train`):
- SCR-04 `home-v3-p2.spec.ts -g SCR-04`: 1 failed (the row has no occurrence key / the old dialog), exit 1 - as expected.
- SCR-05 `evidence-public-ticket.spec.ts -g SCR-05`: 1 failed ("a draft is never sent without send" - the old page posted the draft on `online`), exit 1 - as expected.
- SCR-03 `evidence-calendars-settings-2310.spec.ts -g SCR-03`: 1 passed on the base - the base DEMO accepted any key, so the base cannot
  show the 422 in the browser. The demo now refuses a non-local key like the server, so this case guards against a regression; the
  fails-before proof for SCR-03 is the unit case (no `occurrenceKey` export, and the cancel path sent `o.start`).
- SCR-02: unit only (no browser case: a midnight crossing needs a media clock the mocks do not drive).

Before/after pictures (desktop + phone, light + dark): `private/planning/screens_fix_b_2520_compare_2026-11-25.html` (local).

NOT_RUN: the full gate; backend (no backend file changed); a live check in the lab (not allowed for this row).

## Open questions

1. SCR-40 (medium, not in this row) - the public page keeps one draft per tab, not per link: a queued send pressed on link A in a
   tab that then opens link B would go to B on `online`. a) fix in a follow-up row: store the token with the draft and drop it when the
   token differs (recommended); b) leave.
2. The low note under SCR-04 - a pending request with no matching occurrence row posts `{}` and gets 409 "stale" from home, so it cannot
   be withdrawn there. a) follow-up: send the revision from `/me/calendar` `pending` (needs the server to add it, additive) (recommended);
   b) leave.
3. SCR-02 - at midnight the timeline reloads the new day (a short "loading" on the bar while playback continues). a) keep (recommended);
   b) prefetch the next day near midnight.
