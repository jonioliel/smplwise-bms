# SLACAL - working-hours calendar for ticket timers (2.9.1 / 2.10)

Status: built on `pilot/SLACAL-291` (from `integ/290`). No migration. Off by default; with the calendar off every choice below is inert and
the behaviour is exactly the old wall-clock one.

## What it does

Until now every "waiting too long" timer counted wall-clock minutes (CR-038 D7). An administrator can set ONE installation-level
working-hours calendar (with optional per-department hours); the same thresholds then count **working minutes** only.

Stored in the tickets settings document (`tickets.settings`, key `calendar`, `system.configure`, audited as `tickets.settings.update`):

```json
{ "enabled": false,
  "weekdays": [0,1,2,3,6], "start": "08:00", "end": "17:00",
  "days": { "4": { "start": "08:00", "end": "13:00" } },
  "holidays": ["2026-10-21"],
  "hold_internal": true,
  "auto_close": "calendar",
  "link_unopened": "wall",
  "departments": { "<dept id>": { "enabled": true, "weekdays": [0,1], "start": "09:00", "end": "13:00", "days": {} } } }
```

- Weekdays: Monday = 0 ... Sunday = 6. Default Sunday-Thursday. One daily window `start < end` (none across midnight, same rule as the
  vendor send hours).
- `days` (owner decision 2): per-weekday windows that REPLACE the daily one for that weekday (a short Friday, or a longer Monday). Keys "0".."6".
- Holidays: real dates, at most 400. No time counts on them. Installation-wide.
- Zone: the installation's `time.zone` setting (default Asia/Jerusalem). No second zone field.
- `hold_internal` (decision 3, default **true**): an internal reminder (assignee is a user) or a manager alert that would fire outside
  working time waits for the next opening. It is recorded as crossed at its due time; only the sending waits. An outside contact's reminder is
  governed by the vendor send window (hours.py) as before, not by this.
- `auto_close` (decision 4): `"calendar"` (default, as today: `done_at + N days`) or `"working"`: N x the standard daily window of working time
  (09:00-17:00 means 480 working minutes per "day"; per-weekday windows do not change what one day is worth).
- `link_unopened` (decision 5): `"wall"` (default) keeps the "vendor link not opened" threshold - and the reminder cadence of that crossing -
  on the vendor's wall clock; `"working"` counts it in working time like the other thresholds.
- `departments` (decision 1): a per-department override. `{"enabled": false}` = this department is 24x7. `enabled`, `weekdays`, `start`, `end`,
  `days` set its own hours; `weekdays`/`start`/`end` it leaves out are inherited, but **per-weekday windows are not inherited**: an override
  that sets any hours carries its own `days` (none = the plain daily window). An override with only hours never switches a disabled calendar on;
  `"enabled": true` does (that department alone). Holidays, hold_internal, auto_close and link_unopened are installation-wide.
- A save replaces the whole `calendar` value (missing keys read as defaults). A corrupt stored value reads as 24x7.

## The helpers (`services/tickets/work_calendar.py`, pure)

- `working_minutes_between(a, b, cal)` - working minutes in `[a, b)`.
- `add_working_time(start, minutes, cal)` - the earliest instant by which that much working time has passed. Counting starts at `start` when
  it is inside working time, else at the next opening. A due that completes exactly at closing is the closing. Zero or negative minutes return
  `start` unchanged.
- `is_working(t, cal)`, `next_opening(t, cal)` - for the hold. The end of a window is outside working time.
- `auto_close_at(done_at, days, cal)`.
- DST: the window of each local day is converted per day with the same `hours._local_instant` as the vendor send window, so a window that
  contains a clock change has 1 hour more or less of real time, and a start inside a spring-forward gap opens at the end of the gap.
- If no working time exists within about 10 years (every day a holiday) the wall clock is used, so a timer is never blocked forever.

## Where it is wired (and only there)

| Place | What changes |
| --- | --- |
| `stuck.evaluate` (unassigned, overdue, ack, stuck, waiting; unopened only with `link_unopened: working`) | `base + minutes` is added in working time. ETAs stay absolute instants. |
| `stuck.plan` (the reminder ladder) | reminder cadence and manager alert (`cadence x steps`) count working time; internal reminders and alerts are held to the opening (`hold_internal`) |
| `sla.compute` / `sla.refresh` (stored dues) | thresholds in working time; the auto-close time per `auto_close` |
| `monitor.look`, `monitor.auto_close`, `board.board_item` (SLA cell, auto-close date), `dashboard` (overdue count) | load the department's calendar and pass it on |
| `rfq_questions.remind` (the 24 h "vendor question unanswered" reminder) | a question is reminded after `question_reminder_hours` of **working** hours |
| `PUT /tickets/settings` | a changed calendar recomputes the dues of every open ticket in the same transaction (`sla.refresh_all_open`) |

The manager dashboard "stuck" number and the board's stuck group read `stuck_kind`, which the monitor sets, so they follow the calendar.

Deliberately NOT changed: vendor send hours (`hours.py`), the "wait for morning" rule for vendor messages, ETAs, the 6 hour safety re-check of
the monitor, other RFQ timers (deadline, arrival and instalment reminders), retention, link lifetimes, notification quiet hours.

## The settings card

`tickets-work-calendar-card` (Settings > the module > general): switch; working days (Sunday first); the daily window; one row per working day
with its own times (a day equal to the daily window carries no entry); holidays (a date per line: `2026-10-21`, `21.10.2026`, `21/10/2026`);
the hold switch; the auto-close and link-clock choices; and one row per department: "General" / "Around the clock" / "Own hours" (own hours
open the same editor, seeded from the installation's hours). Local validation, Hebrew + English, RTL, light / dark through the shared tokens.

## Tests

`smplwise_vms/backend/tests/test_tickets_work_calendar.py`, `frontend/tests/unit-tickets-work-calendar.spec.ts`.
