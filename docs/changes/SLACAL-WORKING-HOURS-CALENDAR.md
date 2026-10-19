# SLACAL - working-hours calendar for ticket timers (2.9.1 / 2.10)

Status: built on `pilot/SLACAL-291` (from `integ/290`). No migration. Off by default.

## What it does

Until now every "waiting too long" timer counted wall-clock minutes (CR-038 D7). An administrator can now set ONE installation-level
working-hours calendar; the same thresholds then count **working minutes** only.

Stored in the tickets settings document (`tickets.settings`, key `calendar`, `system.configure`, audited as `tickets.settings.update`):

```json
{ "enabled": false, "weekdays": [0,1,2,3,6], "start": "08:00", "end": "17:00",
  "holidays": ["2026-10-21"], "departments": { "<dept id>": { "enabled": false } } }
```

- Weekdays: Monday = 0 ... Sunday = 6. Default Sunday-Thursday.
- One daily window, `start < end`, local time (no window across midnight; same rule as the vendor send hours).
- Holidays: real dates, at most 400. No time counts on them.
- Zone: the installation's `time.zone` setting (default Asia/Jerusalem). No second zone field.
- `enabled: false` (the default) is **exactly** the old behaviour: every code path takes the plain `base + timedelta` branch.
- `departments`: optional per-department override of `weekdays` / `start` / `end`, or `{"enabled": false}` for 24x7. An override of the hours
  never switches a disabled calendar on; `{"enabled": true}` does. API only, the settings card keeps the stored overrides unchanged.
- A save replaces the whole `calendar` value (missing keys read as defaults). A corrupt stored value reads as 24x7.

## The helpers (`services/tickets/work_calendar.py`, pure)

- `working_minutes_between(a, b, cal)` - working minutes in `[a, b)`.
- `add_working_time(start, minutes, cal)` - the earliest instant by which that much working time has passed. Counting starts at `start` when
  it is inside working time, else at the next opening. A due that completes exactly at closing is the closing. Zero or negative minutes return
  `start` unchanged.
- DST: the window of each local day is converted per day with the same `hours._local_instant` as the vendor send window, so a window that
  contains a clock change has 1 hour more or less of real time, and a start inside a spring-forward gap opens at the end of the gap.
- If no working time exists within about 10 years (every day a holiday) the wall clock is used, so a timer is never blocked forever.

## Where it is wired (and only there)

| Place | What changes |
| --- | --- |
| `stuck.evaluate` (the six thresholds: unassigned, overdue, link-not-opened, ack, stuck, waiting) | `since/created/sent/assigned/last_activity + minutes` is added in working time. ETAs stay absolute instants. |
| `stuck.plan` (the reminder ladder) | the reminder cadence `remind_every_min` and the manager alert (`cadence x steps`) count working time |
| `sla.compute` / `sla.refresh` (stored dues `ack_due_at`, `stuck_due_at`, `resolve_due_at`, `next_check_at`) | thresholds in working time; **auto-close stays in calendar days** |
| `monitor.look` / `monitor.evaluate`, `board.board_item` (SLA cell), `dashboard` (overdue count) | load the department's calendar and pass it on |
| `rfq_questions.remind` (the 24 h "vendor question unanswered" reminder) | a question is reminded after `question_reminder_hours` of **working** hours |
| `PUT /tickets/settings` | a changed calendar recomputes the dues of every open ticket in the same transaction (`sla.refresh_all_open`) |

The manager dashboard "stuck" number and the board's stuck group read `stuck_kind`, which the monitor sets, so they follow the calendar
without a change of their own.

Deliberately NOT changed: vendor send hours (`hours.py`), the "wait for morning" rule, ETAs, auto-close days, the 6 hour safety re-check of
the monitor, other RFQ timers (deadline reminders, arrival reminders, instalment reminders), retention, link lifetimes, notification quiet hours.

## Behaviour to know

- An internal reminder or manager alert may fire exactly at closing time (the working minute that completes the wait is the last one of the
  day). It does not wait for the morning. Only vendor messages wait (send window).
- Turning the calendar on or off, or editing it, recomputes the stored dues at once. The monitor's `next_check_at` follows.
- The settings card (`tickets-work-calendar-card`, Settings > the module > general): switch, working days (Sunday first), window, holidays
  (a date per line: `2026-10-21`, `21.10.2026` or `21/10/2026`), local validation, Hebrew + English, light / dark through the shared tokens.

## Tests

`smplwise_vms/backend/tests/test_tickets_work_calendar.py`, `frontend/tests/unit-tickets-work-calendar.spec.ts`.
