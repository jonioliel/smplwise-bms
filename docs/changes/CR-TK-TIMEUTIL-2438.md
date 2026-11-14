# CR-TK-TIMEUTIL-2438 - one module for the tickets time helpers

Code review 2026-11-13, MASTER_PLAN section 3.3 row `CR-TK-TIMEUTIL-2436` (findings 01:F-06, 01:F-07, 01:F-18).
Branch `pilot/CR-TK-TIMEUTIL-2438`, **stacked on `pilot/CR-TIMEUTIL-2438`** (`9c7859ece`, itself on
`origin/pilot/CR-WAVE1B-COMBINED-2436`): the new module builds on that branch's `services/timeutil.py`
(`DEFAULT_ZONE`, `ZONE_KEY`, `iso_utc`, `iso_utc_ms`, `iso_or_none`), so the two board together. Backend only.

## What changed

New `services/tickets/timeutil.py`: `iso_s`, `iso_ms`, `iso_s_or_none` (the product-wide formatters), `parse_utc`
(zone-less = UTC), `parse_naive_local` (zone-less = the process's local time), `zone_named(name)`, `zone_of(conn)`, and
`DEFAULT_ZONE` re-exported. Each module keeps its public name as an alias, so callers and patching tests do not move:

| Module | Name -> shared helper |
|---|---|
| `budgets` | `_iso` -> `iso_s`, `_zone` -> `zone_of` |
| `costs` | `iso` -> `iso_s`, `parse` -> `parse_naive_local` |
| `handler_links` | `iso` -> `iso_s`, `parse` -> `parse_naive_local`, `_outbox_iso` -> `iso_ms` |
| `intake` | `_iso` -> `iso_s`, `_parse` -> `parse_naive_local` |
| `out_documents` | `iso` -> `iso_ms`, `_parse` -> `parse_naive_local` |
| `outbox_store` | `iso` -> `iso_ms`, `iso_s`, `parse` -> `parse_naive_local` (import placed beside the helpers, lines 54-60) |
| `sla` | `_parse` -> `parse_naive_local`, `_iso` -> `iso_s_or_none` |
| `stuck` | `iso` -> `iso_s_or_none`, `_zone` -> `zone_named` |
| `visits` | `iso` -> `iso_s_or_none`, `parse` -> `parse_utc`, `_zone` -> `zone_of` |
| `vendor_stats` | `_iso` -> `iso_s`, `_parse` -> `parse_utc` |
| `rfq_inbound`, `public_runtime` | `_iso` -> `iso_s` |
| `rule_engine` | `_zone` -> `zone_of` |
| `messaging` | `time_zone` -> `zone_of`; `DEFAULT_TZ = DEFAULT_ZONE` |
| `dashboard_alerts`, `rfq_terms` | `_tz` -> `zone_of` (no lazy import of messaging any more) |
| `work_calendar` | `DEFAULT_ZONE` from timeutil; `Calendar.tz` -> `zone_named(self.zone)` |
| `costs_report` | `filename` -> `zone_of(conn)` |
| `text_hygiene` (F-18) | the raw U+2028 / U+2029 inside the literal are written `" "`, `" "` (same set) |

## The zone-less precondition (NOT_RUN)

MASTER_PLAN makes one read-only `SELECT` per timestamp column on a **lab database copy** the precondition for switching the
"zone-less = local" parsers to "zone-less = UTC". No lab copy is available on the workstation and device access is
read-only, so the check was **not run** and the switch was **not made**: costs, handler links, intake, the outbox, the
outgoing documents and the SLA parsers alias `parse_naive_local`, which is their earlier rule unchanged. The test
`test_both_rules_agree_on_every_value_the_product_writes` pins that the two rules answer the same instant for every value
ending in `Z` or carrying an offset, so the switch is one alias per module once the lab check reports no zone-less value.
`stuck.parse` (9 callers) keeps its own body: it already reads zone-less as UTC but answers the stored offset instead of UTC.

## Behaviour differences (error inputs only)

- A non-text value given to `costs.parse`, `handler_links.parse` or `sla._parse` reads as None (it raised AttributeError);
  `intake._parse` no longer parses `str(value)` of a non-text value. Every caller passes stored text or None.
- `zone_of` answers the default zone for a stored name that is a tzdata directory (`"Asia"`), where the old `rule_engine` /
  `costs_report` reader raised `PermissionError` / `IsADirectoryError`; the other four readers already answered the default.
  The product-wide `services/timeutil.zone` has the same gap (catches only `ZoneInfoNotFoundError` / `ValueError`); it is
  left unchanged here and reported as a follow-up.

## Tests actually run (workstation, Windows, Python 3.12 venv, `-p no:xdist`)

| Command | Result |
|---|---|
| `pytest -p no:xdist tests/test_tickets_timeutil.py` (new: verbatim old bodies vs aliases over stored `Z`, offsets, zone-less, malformed and DST-edge values; zone readers vs their five old bodies; budget month bounds and `rule_engine.local_day` across both 2026 changes; a visit window in the fold hour; F-18 source check) | 49 passed |
| `ruff check --select F` on every changed file compared with the base | no new finding |

NOT_RUN locally (workstation saturated, per the common brief): `test_tickets_msg_hours.py`, `test_tickets_work_calendar.py`,
`test_tickets_stuck.py`, `test_tickets_visits.py`, `test_tickets_budgets.py`, `test_tickets_text_hygiene.py` and the full
backend suite - they run in the runner entry check. The lab-copy `SELECT` precondition: NOT_RUN (no lab copy).

## Overlap with open branches

`outbox_store.py` is also changed by `pilot/TICKETS-PERF-ERASE-2435` (lines 31-44, 197-210, 419-431); this branch changes
lines 54-70 only. `dashboard_alerts.py` (CR-ADMIN-GATE-2438, CR-RBAC-EVAL-2438: line 125) and `visits.py`
(CR-ADMIN-GATE-2438: line 20) are touched away from those lines.

## Rollback

Revert the branch commit; no data, schema or setting is touched.
