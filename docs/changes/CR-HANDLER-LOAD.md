# CR-HANDLER-LOAD — "Handled" count on the handler cards (HANDLERLOAD)

Owner request 2026-10-17 (screenshot of the "מטפלים וספקים" cards that show open / waiting for the handler / stuck): the cards must
also show **how many requests the handler handled**, with a period selector. No migration; additive.

## Behaviour
- A fourth stat "טופלו" with the period label ("היום" / "7 ימים" / "חודש") on every handler card that already shows the load
  (department members with an account, employees without an account). Same audience as the existing numbers: only a manager of the
  person's department.
- A drop-down at the top of the people segment: היום / 7 ימים / חודש. The period applies to the "handled" number **only**; open /
  waiting / stuck stay the current state.
- Default **7 days**. Order of precedence: the viewer's own choice (localStorage `sw.tickets.handlers.handledDays`, wrapped in
  try/catch) -> the installation default `tickets.settings.ui.handled_days` -> 7.
- The installation default is edited in Settings -> service management -> display (the board's rows), `system.configure`, through the
  existing revision-checked `PUT /tickets/settings` (`ui.handled_days`, allow-list 1 / 7 / 30). It is served to every signed-in user
  with `GET /tickets/module` (`ui`), like the other display keys.

## Server
`GET /tickets/handler-load?days=1|7|30` (routers/tickets_board.py, services/tickets/handler_load.py). There was no existing load
endpoint (the open / waiting / stuck numbers are computed in the browser from `GET /tickets/board`), so this is a new, small route with
the board's manager gate and module gate. `days` outside the allow-list answers 422; omitted = the installation default. Answer: `days`,
`default_days`, `since`, `now`, `handled` (a map `user:<id>` / `contact:<id>` -> integer), `truncated`. Counts only - no ticket id,
title or any personal content.

## Definition of "handled"
A request is handled by X in a period when
1. its status is `done` or `closed` (cancelled requests, and requests a manager closed without `done`, were not resolved by a handler);
2. its completion time `done_at` - the moment it moved to `done` (by the handler, by the manager on his behalf, or through the handler
  link) - is inside the period; and
3. X is the assignee it had **at that moment** (the assignment with the latest `assigned_at` <= `done_at` that had not ended before it).

Why `done_at` and not the closing time the request first suggested: the closing is the manager's confirmation, often days after the
work (and the automatic close follows the department's N days), so counting by `closed_at` would credit the wrong day. `done_at` is kept
when the request is then closed and is cleared on every reopen or reassignment from `done`, so a request that is reopened and finished
again counts once, on its latest completion, for the latest assignee. A request reassigned before it was done counts for the last
assignee only; the later closing never moves it between people or days.

Period: 1 = today, 7 = the last seven days, 30 = the last thirty - whole calendar days in the installation's time zone (`time.zone`),
today included; `since` = local midnight (days - 1) days ago (date arithmetic on local dates, so a daylight-saving change cannot shift
the boundary). The instant of the boundary itself is inside.

Visibility: only through the manager board's scan (`access.visible_page`) and only the requests the viewer **manages**
(`Seen.manager`): a department manager gets counts for his departments' requests, never another department's; a holder of
`tickets.all_departments` + `tickets.manage` sees all. Scan cap 2000 rows, newest activity first (`truncated` is reported).

## Owner answers (2026-10-17)
- "Today" (period 1) = since the installation's local midnight - as built (`period_start`).
- A request a manager closed without "done" is NOT counted as handled - as built (no `done_at`).
- The 2000-request scan limit is kept (`board.SCAN_CAP`, `truncated` reported).
Pinned by `test_owner_decisions_today_is_local_midnight_and_the_scan_limit_stays_2000` (pilot/DEPTMGR2). No code change.

## Tests
Backend `tests/test_tickets_handler_load.py` (allow-list, gate, module off, counts-only answer, department isolation, cancelled / closed
without done, reopened and reassigned requests, the assignee at the time of `done`, contact keys, period boundaries and time zones,
default setting validation and permission, corrupt stored value) and `tests/test_tickets_board.py` (module `ui` carries the new key);
frontend unit `tests/unit-tickets-ui6.spec.ts`; browser evidence `tests/evidence-tickets-ui6.spec.ts` (selector, remembered choice,
phone width).

## Future: manager dashboard (owner wish 2026-10-17, NOT built now)
The owner wants an easy dashboard for a manager to follow staff, loads and tasks. Suggested widgets (3-5), all built on the same
visibility rule and counts-only where possible:
1. **Team load** - per handler: open / waiting / stuck / handled, sortable, with the period selector of this CR.
2. **Aging and stuck** - the oldest open requests and the stuck ones by reason (unassigned, not acknowledged, overdue, waiting), with a
   one-tap reminder or reassign.
3. **Throughput trend** - handled per day or week as a small chart, by department, against the new requests of the same days.
4. **Response and resolution times** - median time to acknowledge and to finish per handler / vendor, against the SLA targets.
5. **Today's agenda** - the requests due today (ETAs, planned visits, closing candidates in `done`) as one list.
