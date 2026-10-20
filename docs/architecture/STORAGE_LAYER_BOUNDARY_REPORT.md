# Storage-layer boundary: SQL outside the store modules (DATASTORE-295)

Measured 2026-10-20 on `pilot/DATASTORE-295` (base `integ/293` @ 90a50db90) with `scripts/sql_boundary_report.py` (static, ast; a
module is a store when its file is `store.py`, `*_store.py`, `store_*.py` or `db.py`). Nothing was refactored; this is the map and a
proposed order. Re-run the script to refresh the numbers.

## Summary

| Measure | Value |
|---|---|
| Backend modules holding SQL | 234 |
| ... of which store modules | 17 |
| ... outside the boundary | 217 |
| SQL statements outside a store | 2527 of 3291 (77%) |
| Write statements outside a store | 911 of 1194 (76%) |
| HTTP routers holding SQL | 57 |

The only module family with an enforced boundary is the tickets module (`tests/test_tickets_visibility.py::test_ticket_sql_lives_in_the_store`,
with 11 recorded exceptions). Everything else talks to SQLite directly. For a future engine split (owner decision 2026-10-01: decide
the engine when the ticketing system is specified) the cost is driven less by the count of statements than by **tables written from
several modules** - each such table has its rules (ordering, the permission revision bump, audit, the backup lists) spread over files.

## Worst offenders (score = (SQL + writes + execute calls), x1.5 in a router)

| # | Module | Layer | Score | SQL | Writes | Tables written |
|---|---|---|---|---|---|---|
| 1 | `services/energy_billing.py` | service | 214 | 88 | 34 | energy_* (own tables only) |
| 2 | `routers/access.py` | router | 199.5 | 58 | 8 | bindings, custom_roles, groups, users |
| 3 | `services/access_grants.py` | service | 185 | 77 | 32 | access_* (own tables) |
| 4 | `routers/events.py` | router | 148.5 | 47 | 7 | events, event_window_* |
| 5 | `routers/cases.py` | router | 147 | 41 | 16 | cases, case_items |
| 6 | `routers/ha_users.py` | router | 132 | 30 | 17 | users, group_members, ha_users, ha_managed_users |
| 7 | `routers/temperature.py` | router | 124.5 | 34 | 15 | infra_temp_* |
| 8 | `routers/local_identity.py` | router | 123 | 28 | 18 | users, bindings, identity_links, auth_local_* |
| 9 | `services/local_identity.py` | service | 123 | 44 | 25 | auth_local_* |
| 10 | `services/notify.py` | service | 119 | 45 | 25 | notification_*, notify_outbox, ... |
| 11 | `services/shared_spaces.py` | service | 113 | 49 | 13 | map_anchors, spatial_zones, shared_space* |
| 12 | `services/schedules.py` | service | 110 | 42 | 26 | schedule_* |
| 13 | `routers/catalog.py` | router | 109.5 | 29 | 15 | sites, buildings, floors, plan_versions, map_anchors |
| 14 | `routers/plans.py` | router | 96 | 26 | 12 | plan_assets, plan_versions, plan_geometry, map_anchors |
| 15 | `services/automations.py` | service | 94 | 36 | 22 | automation_* |
| 16 | `routers/alarm.py` | router | 87 | 25 | 8 | alarm_zone_overrides, ha_actions |
| 17 | `routers/ha.py` | router | 75 | 20 | 7 | ha_actions, ha_users, users |
| 18 | `routers/anchors.py` | router | 73.5 | 22 | 5 | map_anchors |
| 19 | `routers/elevators.py` | router | 66 | 18 | 8 | infra_elevator_* |
| 20 | `routers/wall.py` | router | 66 | 14 | 4 | wall_profiles |

(The script prints the top 40; ranks 21-40 are services of a single feature each - push, plan_bakes, cast_sessions, generator_alerts,
presence, switch_protection, ha_sync, nvr_batch, capture_lease, exports - plus routers access_groups, energy_billing, cameras, zones.)

## Tables written from the most modules (outside a store)

| Table | Writer modules | Where |
|---|---|---|
| `settings` | 14 | backup, bundle, elevators, generator_core, media_query, messaging_runtime, notify_whatsapp, nvr_batch, ... |
| `ha_actions` | 7 | routers access_control / alarm / ha; services device_activity, device_bulk, ha_actions, media_commands |
| `notify_policies` | 6 | routers notifications; services access_external, elevator_alerts, generator_alerts, notify_policy, temperature_alerts |
| `events` | 5 | routers events; services correlation, events_derive, events_ingest, frigate_events |
| `notification_events` | 5 | mobile_push, notify, notify_channels, notify_whatsapp, push |
| `users` | 5 | auth, routers access / ha / ha_users, services local_identity |
| `bindings` | 4 | auth, routers access / access_groups / local_identity |
| `map_anchors` | 4 | routers anchors / catalog / plans, services shared_spaces |
| `notification_deliveries` | 4 | notify, notify_channels, notify_whatsapp, push |
| `auth_local_credentials` | 4 | local_identity (router + service), local_passkeys, local_reset |
| `infra_temp_events` | 4 | temperature (router + service), temperature_runtime, temperature_tickets |

## Proposed order (not started)

Each step: move the SQL of one table family into a `*_store.py`, keep the callers' behaviour identical (same statements, same
transaction - the store takes the caller's `conn`), add a boundary test in the style of `test_ticket_sql_lives_in_the_store`, then
the next family. One family per release; no step changes the schema.

1. **`settings` -> `services/settings_store.py`** (14 writers). Typed get/set per key family, and the backup classification of each
   key (exported / never exported = today's `backup.SETTINGS_KEEP`) declared next to the key instead of in a 50-line list in
   backup.py. Smallest change with the widest effect; also removes a recurring backup review finding ("new key forgot SETTINGS_KEEP").
2. **Identity and access: `users`, `bindings`, `groups`, `group_members`, `custom_roles`, `identity_links` -> `access_store.py`**
   (routers access / access_groups / ha_users / local_identity, auth.py). Security-relevant: every write must bump the permission
   revision (which also revokes the capture leases); a store makes that impossible to forget. Highest value, needs a careful review.
3. **Notifications: `notify_policies`, `notification_events`, `notification_deliveries`, `rule_alerts` -> `notify_store.py`**
   (six alert producers write the policy table today).
4. **`ha_actions` -> `ha_actions_store.py`** (seven writers; the action ledger is audit-like and should be append-only through one
   function).
5. **Events: `events`, `event_window_*` -> `events_store.py`** (router events.py holds 47 statements). `events` and `audit_log`
   are the tables that grow; if an engine split ever happens they are the first candidates for a database of their own, so they
   should be behind a store first.
6. **Plans and catalog: `sites`, `buildings`, `floors`, `plan_*`, `map_anchors`, `spatial_zones` -> `plan_store.py`** (routers
   catalog / plans / anchors / zones, shared_spaces).
7. **Self-contained router SQL**: `routers/cases.py`, `routers/temperature.py`, `routers/elevators.py`, `routers/wall.py`,
   `routers/alarm.py` - mechanical moves into the service / a store of their feature; low risk.
8. **Large single-feature services** (`energy_billing`, `access_grants`, `schedules`, `automations`, `local_identity`): they only
   write their own tables, so they are already a boundary in all but name; split a `*_store.py` out when the feature is next touched.

Suggested guard once step 1 lands: a ratchet test that fails when the number of SQL statements in `routers/` grows beyond the
recorded baseline (today 57 router modules), so the boundary does not erode while the steps above are scheduled.
