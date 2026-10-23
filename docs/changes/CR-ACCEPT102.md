# CR-ACCEPT102 - smart acceptance of vendor work (board item r102)

Status: PROPOSED. Slice 1 (backend engine, temperature units only) built on `pilot/ACCEPT102-295` from `main` v2.12.4 (320e5555).
Migration `0160_ticket_acceptance.sql` is PROVISIONAL (renumber at integration). Default OFF.

## 1. Goal

Today a vendor marks a service request `done` and a manager (or the department's automatic close after N days) confirms it blind. The
sensors already know whether the fix worked. Smart acceptance holds the confirmation until the sensor data shows the fix HELD for a
configurable time (default 24 h). Outcomes: auto-confirm, reopen, or flag to the handler. Nothing is polled: the engine reads rows the
existing modules already write (alert rows of the temperature module). A person can always decide first.

## 2. Which tickets qualify

All of the following must hold, otherwise the ticket is not touched and behaves exactly as today:

1. the tickets module is on AND the acceptance switch is on (`ticket_acceptance_settings.enabled`, default 0);
2. the ticket's category is in the opted-in list (`categories_json`, empty by default = nothing qualifies);
3. the ticket status is `done` (set by the vendor, the assignee, or a manager on their behalf);
4. the ticket has a VERIFIABLE link to a subject with a defined healthy predicate. Slice 1: `infra_temp_tickets` (ticket -> temperature unit,
   written by `services/temperature_tickets.py`), the unit being enabled. A ticket with only a free-text place, a manual ticket, or a
   device without a predicate is NOT eligible.

Later types (each needs its own predicate and its own link table or column; none is built in slice 1): leak sensor dry, elevator fault
cleared, generator fault cleared, device online and stable (`tickets.entity_id` / `registry_id` of a `device`-origin ticket).

## 3. Predicates

| type | healthy means | source (existing, read only) |
|---|---|---|
| temperature (slice 1) | the unit has no `high`, `low`, `offline` or `frozen` alert row that is open or that ended after the hold started | `infra_temp_events`, produced by `temperature_runtime.evaluate` (debounce, defrost windows, quiet hours, sensor-offline already applied) |
| leak (later) | the sensor reports dry and no leak event since the hold started | HA state mirror / event history |
| elevator / generator (later) | the fault flag is cleared and no new fault row since the hold started | elevators / generator runtime event rows |
| device online (later) | no offline transition since the hold started | `ha_entities` availability history |

Door-open, defrost, predict, battery and recovery rows do not fail a temperature hold. A unit that is not reporting (no sample in the last
10 minutes) cannot START a hold. One predicate = one function; adding a type never changes the engine.

## 4. The hold

State per ticket in `ticket_acceptance` (rule frozen at start, so a settings change never moves a running verification):

```
done --> pending --(unit healthy and reporting)--> holding --(hold_minutes elapsed, no breach)--> accepted (ticket closed)
            |                                          |
            +--(start_grace_minutes elapsed)--+        +--(breach)--> per rule: flag | reopen | restart(-> pending, bounded)
                                              v
                                       flagged / reopened
```

* `hold_start` = the moment the unit was last healthy again, never earlier than `done_at` (so a fix that takes 20 minutes to show is not
  penalised, and a breach that ended before the fix is not counted).
* `hold_minutes` default 1440 (30 min .. 7 days). `start_grace_minutes` default 240: the time the unit may take to get back in range.
* The clock lives in the row (`hold_start`, `hold_until`); the engine takes the clock as a parameter; a restart loses nothing.
* Runs inside the existing SLA monitor tick (once a minute, `monitor.tick` -> `acceptance.run`), same pattern and kill switches; module off
  = idle.

## 5. Outcomes

| outcome | what happens |
|---|---|
| accepted | the system closes the ticket (`done` -> `closed`, actor `system`, timeline `auto_closed` with `data.by = acceptance`, audit `ticket.close` with `acceptance: true`), the same helper as the department's automatic close. A pending REQUIRED cost claim still blocks the close (retried each minute) |
| reopen (`on_breach = reopen`) | `done` -> `in_progress` by the system, `done_at` cleared, the assignee is told, managers alerted. Only when an assignee still holds the ticket; otherwise flag |
| flag (`on_breach = flag`, default) | the ticket STAYS `done`; timeline `acceptance_flagged`; the department managers get the existing `ticket.stuck` alert with the reason "the check after the repair did not pass"; the department's own automatic close is blocked until a person decides |
| restart (`on_breach = restart`) | the hold clock restarts when the unit is healthy again, at most `max_restarts` times (default 2), then flag |
| start timeout | the unit did not get back in range / did not report within the grace: flag (or reopen) with `outcome = start_timeout` |

Why flag is the default: a breach after a repair is information for a human (the vendor, the warranty), not something to bounce back to a
vendor automatically.

## 6. Audit trail and the human override

Every step writes a timeline row (`acceptance_started`, `acceptance_hold_started`, `acceptance_restarted`, `acceptance_flagged`,
`acceptance_overridden`, plus the standard `auto_closed` / `status`) and the `ticket_acceptance` row keeps state, times, restarts, outcome and
the breach alert id. Audit rows: `ticket.close` / `ticket.status` / `ticket.acceptance` with `actor: system`.

The person always wins: any manual move out of `done` (confirm = close, reopen, cancel, a fresh `done`) is seen on the next tick and the row
becomes `overridden` with `outcome = status_changed:<status>`; the system never writes after that. A fresh `done` starts a new verification.
A flagged ticket waits for a person; the manager's confirm or reopen is the override.

## 7. Permissions

No new route in slice 1, so no new permission. The engine acts as the system (like the SLA monitor). Slice 2 adds: read the verification state
with the ticket (anyone who sees the ticket), set the switch / hold / rule / categories (`tickets.configure`), "skip verification and confirm
now" (the existing manager close).

## 8. Notifications

Breach / timeout reuse the existing `ticket.stuck` source and its department-manager audience (matrix, quiet hours, digest all apply); the
reason text is new. No new notification source in slice 1. "Verification started / passed" are timeline rows only, to avoid noise.

## 9. Default off and opt-in

Two gates: the master switch (default off) and the opted-in category list (default empty). Turning the switch off pauses evaluation (stored
clocks resume on re-enable; a hold that elapsed meanwhile confirms on the next tick if still clean). Turning it off never changes a ticket.

## 10. Tests plan

Slice 1 (`tests/test_tickets_acceptance.py`, injected clock, real database): off by default; category opt-in; no device link; disabled unit;
module off; hold exactly the configured time (1 minute short stays done); restart persistence; the department's auto close waits; breach
flags / reopens / restarts (bounded); breach that ended before the hold; unhealthy at the start times out; not reporting; manager confirm and
reopen win; override after a flag; pending cost claim. Plus the system-reader guard in `test_tickets_monitor.py`.
Slice 2+: API and permissions, settings screen, per-type predicates, migration renumbering test.

## 11. Slices

1. Backend engine, temperature, switch + categories in the settings table (this CR). No frontend.
2. Settings + ticket detail API (state, override "confirm now / stop verification"), settings screen, ticket timeline text, dashboards.
3. Leak and device-online predicates (state mirror); 4. Elevator / generator fault predicates. 5. Reports (how many auto-confirmed / bounced).

## 12. Owner questions

1. Default breach rule: recommend A) flag to the handler (default); B) reopen to the vendor; C) restart the clock (max 2).
2. Hold length: recommend A) 24 h for all types; B) per type (temperature 24 h, leak 72 h, device online 6 h).
3. Should the department's automatic close after N days be allowed to override a longer hold? Recommend A) no, the hold wins; B) yes.
4. A unit that stays alarming at the start: recommend A) flag after 4 h; B) reopen immediately.
5. Opt-in granularity: recommend A) per category; B) per department as well.
6. Should a vendor see that the job is "under verification" on the handler page? Recommend A) no (internal only) for slice 2.
