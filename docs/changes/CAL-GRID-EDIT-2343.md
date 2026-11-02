# CAL-GRID-EDIT-2343 - Outlook-style editing on the calendar grid (phase 1)

Branch `pilot/CAL-GRID-EDIT-2343` (from `release/2340-train`). Owner-approved 02.11 from the interactive prototype
`private/design-system-2026-10-27/round13/calendar-outlook/index.html` (round 13). Named attendees are a separate branch
(`pilot/CAL-ATTENDEES-2343`); this branch leaves the slot where its picker plugs in.

## Owner answers (02.11) and where they live

| # | Answer | Implemented as |
|---|---|---|
| 1 | A: drag-create + move + resize, with an installation setting to switch to B (create only) | setting `grid_edit` = `drag` (default) / `create_only` |
| 2 | C: snapping uses each calendar's time step (default 15) | `slot_step_min` of the calendar (5/10/15/30/60); the server's `slot_step` rule unchanged |
| 3 | C: per-calendar setting for moving an approved booking in an approval room, default re-approval | calendar field `approved_move` = `reapproval` (default) / `managers` |
| 4 | A: phone / tablet long press selects, drag extends; "+ חדש" stays; long press on an entry picks it up | touch long press 450 ms (slot) / 350 ms (entry), a first-time hint |
| - | Undo toast after move / resize / delete; the cancel notice to the organizer waits ~6 s (approved) | toast "בטל" + Ctrl+Z; setting `cancel_notice_delay_s` = 6 |
| - | Existing events editable in the drawer, by permission (approved) | bookers their own, editors / managers all, viewers none |

## What the user gets

Week and day views (יומנים › יומן):

- **Drag over free time** selects it; a **click** is 30 minutes (or one step when the calendar's step is longer). The **quick create**
  opens next to the selection: title, calendar, times on the calendar's step, "כל היום" (= the calendar's open hours), the recurrence
  shortcut (one time / every <day> / every day + count, checked by the server's preview), organizer / "בשם" for whoever holds
  `calendar.book_for_others`, headcount against the capacity, the attendee slot, and a live status line (פנוי / תישלח לאישור / חופף /
  אי אפשר לשמור כאן + the reason). Enter saves, Esc cancels, "פרטים נוספים" opens the full drawer with everything typed so far.
  On the phone the quick create is a bottom sheet (big time steppers, duration chips).
- **Click an entry**: the peek card - where, when, who, state chips, the held slot of a change request, and the actions this viewer has:
  ערוך, שכפל, מחק (or "משיכה" / "משיכת השינוי"), and אישור / דחייה for the calendar's manager on a request ("לאשר ולדחוק" when the
  window is held and the installation allows displacing). **Double click**: the full drawer.
- **Drag an entry** to move it (week: across days; day: across calendars), drag its **bottom edge** to resize. While dragging: the time,
  the target calendar / day, and a red frame with the reason when the drop would be refused; a dashed frame when it goes to approval.
  A refused drop puts the entry back. A started entry keeps its start (its end may still change); a series is not dragged (phase 2).
- **Keyboard** (focus the grid): arrows move the selection by a step / a column, Shift + arrows extend it, Enter opens the quick create,
  Esc cancels, Ctrl+Z undoes the last action, Delete deletes the entry whose card is open. Keyboard actions never animate.
- **"בטל"** for 6 seconds after a move, a resize, a delete or a create (and Ctrl+Z while the view is open).
- **The drawer** now edits an existing entry for whoever may change it; a viewer sees it read-only with the reason. A series edits its
  title, people and notes (its times stay; one occurrence's time is a phase-2 drag).
- **The resident** (phone flow) gets a third tab "יומן": the day grid of the rooms he may book only; other people's bookings read "תפוס".

The client's hints follow the product's rules (open hours, min / max length with the manager's override, past times, the step, capacity,
buffers, the overlap policy `contested_requests`, maintenance windows through `maintenance_overlap` / the room's `overlap_override`,
approval, `approved_move`). **They are hints only**: every change is a server call that checks everything again.

## Server rules (authoritative)

- `PATCH /api/v1/calendar/events/{id}` (existing) is the move / resize / edit. New: `calendar_id` moves a single entry to another calendar
  the caller may book in (a series, an override row or an event holding rooms is refused, 422 `move_calendar_unsupported`); a moved start
  is never in the past (422 `past_start`); a started entry keeps its start (422 `started_immutable`). The audit row
  `calendar.event.update` carries `moved`, `from`, `to` (calendar id + instants, never a title), `held`, `change_withdrawn`.
- **Moving an approved booking that now needs approval** (contract section 7: "the old slot is released only on approval"):
  - `approved_move = reapproval` (default): the booking becomes a pending change request; its approved slot is kept in
    `cal_events.held_json` and in the occurrence cache as a confirmed row of the pseudo id `<id>#held`, so every conflict check (new
    bookings, approvals, maintenance) sees it. Approve releases it. Reject, withdraw, expiry (`approval_timeout_h`) and a move back onto
    it (the grid's undo) put the booking back, confirmed. A manager displacing the held slot gives it up (the request stays pending).
  - `approved_move = managers`: a booker gets 409 `change_needs_manager`; an editor / manager of the calendar moves it directly.
  - A series, an override row or an entry holding rooms keeps the earlier refusal (409 `change_needs_new_request`) in this phase.
- `POST /api/v1/calendar/events/{id}/restore` (new, audited `calendar.event.restore`): the undo of a delete - a single entry cancelled or
  withdrawn within `undo_window_s` returns to the state it had (`cal_events.cancelled_from`), unless its time was taken meanwhile
  (409 `conflict`) or the window closed (409 `undo_expired`).
- **Delayed notice**: when someone else cancels or moves an organizer's entry, a notice (`calendar.booking.cancelled` / `.changed`) is
  queued in `cal_notices` with `due_at = now + cancel_notice_delay_s`; an undo (restore, move back, withdraw of the change) withdraws it,
  so the organizer never gets "cancelled" followed by "booked again". The janitor (every 30 s) delivers what is due: the row is marked
  sent and an audit row `calendar.notice.sent` (ids only) is written. The calendars module has no notification channel yet (contract:
  a later slice); a channel registers in `services/calendar/notices.DELIVERERS`.
- **Maintenance windows**: a booking (new or moved) over a confirmed maintenance window follows the room's maintenance-overlap mode -
  `override_notify` or `block`: refused, 409 `maintenance_window`; `first_holds` (default) / `ask`: the window holds and the booking is a
  contested request for the manager (as before).
- `GET /calendar/occurrences` rows carry `can_edit`, `revision`, `local_start`, `all_day`, `held`, and the held slots (`held_slot: true`);
  calendars carry `approved_move` and `open_hours`; `GET /calendar/requests` rows carry `change_of`; an event carries `held` and
  `can.restore`.

## Settings

| Where | Key | Values (default) | Meaning |
|---|---|---|---|
| הגדרות › יומנים › התנהגות › הזמנות | `grid_edit` | `drag` / `create_only` (`drag`) | create + move + resize on the grid, or create only (answer 1B) |
| הגדרות › יומנים › התנהגות › בקשות ואישורים | `cancel_notice_delay_s` | 0-60 (6) | how long a cancel / move notice to the organizer waits for "בטל" |
| הגדרות › יומנים › התנהגות › בקשות ואישורים | `undo_window_s` | 10-600 (120) | how long after a delete the server still restores it |
| ניהול יומנים › <יומן> › כללי היומן (when the calendar needs approval) | `approved_move` | `reapproval` / `managers` (`reapproval`) | moving an approved booking: a new request with the old slot held, or managers only (answer 3C) |

## Owner steps

1. After the release with this branch: open יומנים › יומן › שבוע or יום. Drag on free time, type a title, Enter.
2. Drag the booking to another hour, then press "בטל" in the message at the bottom.
3. In a room that needs approval: as a booker, move an approved booking - it turns "ממתין לאישור" and the old time stays dotted;
   as the room's manager, open it and reject - it goes back to the old time.
4. To turn dragging off: הגדרות › יומנים › התנהגות › "עבודה על לוח היומן" › "יצירה בלבד".
5. On the phone: hold a free hour for half a second, then drag to extend.

## Not in this phase (phase 2 candidates)

Assembly with pilot/CAL-ATTENDEES-2343: append `calendar_attendees.on_restore` to `services/calendar/events.ON_EVENT_RESTORED`; register the picker in `calHooks.attendees`.

Dragging a series occurrence (needs scope "this occurrence" on the grid and a held slot for override rows), dragging in the month view,
moving an event that holds rooms, an animated return of a refused drop (it returns at once), the calendars notification channels (push /
inbox) for the delayed notices, named attendees (the other branch plugs into `calHooks.attendees`).

## Tests and baselines

- Backend: `smplwise_vms/backend/tests/test_calendar_grid_edit_2343.py` - 18 tests (incl. the `ON_EVENT_RESTORED` hook) (move / resize rules and permissions, calendar move,
  re-approval hold / reject restore / approve release / undo / withdraw / expiry, `approved_move = managers`, restore + delayed notice,
  maintenance overlap). The existing calendar suites (engine, recurrence, sync, connect: 133) pass unchanged.
- Frontend unit: `frontend/tests/unit-calendars-grid-edit-2343.spec.ts` - 18 (snap, click / drag / move / resize geometry, the press state
  machine incl. long press, keyboard, every hint rule, undo stack, popover placement, the drawer's edit rule).
- Evidence: `frontend/tests/evidence-calendars-grid-edit-2343.spec.ts` (demo mode; desktop / tablet / phone; screenshots to
  `private/design-system-2026-10-27/round13/calendar-outlook/shots`). No pixel baseline covers the calendars screens, so none changes.
- Migration `0205_calendar_grid_edit.sql` (two columns on `cal_events`, one on `cal_calendars`, the `cal_notices` table). Numbered with a
  gap after the 019x numbers other branches already use.
- `contracts/API_INVENTORY.md` gains `POST /calendar/events/{eid}/restore` when the release regenerates it (`scripts/api_inventory.py`).
