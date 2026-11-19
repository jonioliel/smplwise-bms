# CR-BE-COMPLEXITY-2450 - O20 in the notice audience, the singleton inventory, three complexity extractions

Branch `pilot/CR-BE-COMPLEXITY-2450`, based on `origin/release/2440-train` (e9d17b5ab). Target 2.45.0. Backend only.
Sources: code review 2026-11-13 (02:P3-4, 03:F22, 01:F-19), MASTER_PLAN 3.6, REMAINING_WORK 18.11 section B, owner decision O20 a.

## 1. O20 - a permission on a deleted place does not apply to its floors (02:P3-4)

`rbac` already had the rule (CR-RBAC-EVAL-2438: `dead_places`, `_drop_dead_allows`, a deleted building cut from its site). The scope-chain
code that still disagreed was the notice audience's own copy, `services/notices/audience.py`:

- `_floor_chain` cut a floor of a deleted building, but a floor of a live building under a **deleted site** was still reached through the
  site's and the building's allow bindings. It now also requires a live site (the same place `rbac.dead_places` calls dead).
- `_live_bindings` read every allow binding, so an allow bound on a dead place still counted for a **role audience** and the read-receipt
  **place line**. It now drops allows on dead places with `rbac.dead_places` - the same query and rule as `rbac._drop_dead_allows`.

Audit: unchanged (no audit row is written or skipped differently). Deny bindings are not read by the audience (allow only), as before.

Tests - new `tests/test_o20_deleted_place_2450.py` (12): the rbac matrix and the audience matrix both ways (granted while the site / building
/ floor is live, nothing once it or a parent is deleted), a live sibling floor keeps its grants, the site node stays in the chain, the role
audience and the receipt place line both ways. 4 of the 12 fail on the base commit (the audience gaps), all 12 pass here.

Not changed (open question Q1 below): `rbac.scope_chain` still lets a LIVE building's / site's permission cover a DELETED floor (the
floor's own binding is dead). O20 is about a permission on the deleted place; the audience already reached no one through a dead floor.

## 2. `test_singletons_registered` sees shared-class singletons (REMAINING_WORK section B)

The inventory counted a module-level object only when its class was defined in the same module, so `POLLER = PeriodicWorker(...)`,
`_cache = TtlCache(...)`, `_TICK = Every(...)`, `LIMITER = RateLimiter()`, `_OWNED = OwnedStreams(...)` were invisible. The walk now also
counts an object of any class defined in the package when the module ASSIGNS the name at top level (AST check; an imported name is not
counted again, one object counts once). New self-test `test_shared_class_singletons_are_seen`.

It found 30 names. 26 now register a per-test reset in their own module (mostly the reset function the module already had):
`app_refresh` (FAILURES, FAILURES_ALL), `calendar.jobs` (_TICK, _SYNC_TICK), `calendar.attendee_notices` (_ERASE), `camera_sources`,
`ha_camera_streams`, `playback` (_OWNED: the written-at map), `device_activity` (_PRUNE), `docread.service` (_ocr_reader, MODEL, _JANITOR),
`health_report` (_probe_cache), `insights_delivery` (_PASS), `maintenance.reminders` (_CHECK), `messaging_runtime` (TRACKER),
`needs_review` (_CHECK), `notices.display` (LIMITER), `partner.webhooks` (_OUT), `recorded_days` and `recordings` (_cache),
`temperature_report_link` (LIMITER), `tickets.costs_report`, `tickets.deletion`, `tickets.export` (_RATE), `tickets.dashboard_pay` (CACHE).
4 are recorded in `tests/singletons_unregistered.txt` with the reason: `routers.cameras._CAPS_CACHE`, `routers.cameras._ZONES_CACHE`,
`routers.health._EVENTS_COUNT` (routers belong to another agent today) and `services.connection_probe._RESOLVER` (a DNS thread pool, like
the already-listed `source_policy._RESOLVER`: nothing to reset).

## 3. Complexity extractions (MASTER_PLAN 3.6; 03:F22, 01:F-19)

One function per commit, each behind a characterisation test committed first and recorded from the unchanged function.

| Function | Before (radon CC) | After | Characterisation |
|---|---|---|---|
| `services/health_report.build` | 104 | `build` 3; largest helper `_job_checks` 29 | `test_health_report_char_2450.py`: 7 scenarios (full / NVR-less, probed or not, devices up / down, NVR without go2rtc, crash record, lingering secrets, portal drops, transit states, backups, disk); ids in order, status, label, detail (digits folded), meta keys, overall status, mode, capabilities |
| `services/media_model.build` | 216 | `build` 6; one function per rung over a `_Ladder` state object; largest `_suggest_all` 35 | `test_media_model_char_2450.py`: 195 recorded `build()` calls (every distinct call of the six media test files), replayed with the same fresh keys; the whole model must match and the key count too |
| `services/tickets/contacts._fields` | 79 | `_fields` 6; one helper per field family; largest `_cost_fields` 16 | `test_contacts_fields_char_2450.py`: 992 (body, creating, current) cases - every field value alone, ten interacting pairs crossed, whole bodies where the first refusal wins; exact output or (field, code) |

The bodies moved verbatim (the contacts split is checked by a script that the moved pieces tile the old body exactly); the order of checks,
reads and refusals is unchanged.

Excluded on purpose (brief): `access_grants.approve`, `local_identity.sign_in` and any auth / session / RBAC check order;
`services/intercom_sync.py`, `services/wiskey_background_feed.py`, every router, electricity / water / tariff / billing / meter.
08:F22 is a frontend finding (large TypeScript files): out of this backend row.

Still open in the programme (not done here): `plan_ifc_read.read` (265), `plan_ifc.build` (146), `plan_dxf_map.map_geometry` (124),
`temperature_runtime.evaluate` (122), `calendar/events.update` (108), `automation_model.validate_draft` (108), `shared_spaces.plan_edits` (95),
`media_commands.run` / `plan_audio` (95 / 94), `wiskey_profiles.normalize_draft` (94), `schedule_policy.check_arguments` (91),
`tickets/outbox.enqueue` (67), `tickets/service.edit` (65).

## Tests actually run (workstation, Python 3.12, the main checkout's `.venv`, `pytest -p no:xdist`)

The workstation was at 100 % CPU all day (about eight agents running pytest), so every run below is slow; all are single-process
`pytest -p no:xdist -p no:cacheprovider` runs on the branch as committed (the refactor runs on the working tree right before its commit).

| Run | Files | Result |
|---|---|---|
| O20 | `test_o20_deleted_place_2450.py` | **12 passed**; on the base audience code **4 failed, 8 passed** (the gap the fix closes) |
| O20 neighbours | `test_rbac_eval_2438.py`, `test_notices_106.py`, `test_notices_push_295.py`, `test_notice_delete_295.py`, `test_notice_remove_295.py` | **97 passed** |
| singleton inventory | `test_singletons_registered.py` (3 tests incl. the new self-test) | **3 passed** |
| health split | `test_health_report_char_2450.py`, `test_health_report.py`, `test_nvr_less.py` | **57 passed** |
| media split | `test_media_model_char_2450.py` + `test_media_model`, `test_media_players_ladder`, `test_media_review_fixes`, `test_media_cast_caps`, `test_media_fake_ha`, `test_ha_names_2611` | **439 passed** (the replay alone: 196 passed before and after the split) |
| contacts split | `test_contacts_fields_char_2450.py` | **7 passed** before and after the split |
| contacts neighbours | `test_vendmark_295`, `test_tickets_dept_handlers`, `test_tickets_dept_handlers_decisions`, `test_tickets_vendor_portal_more`, `test_tickets_directory_permission`, `test_tickets_assignees`, `test_tickets_258_review` | **153 passed** |
| ruff (`select = ["F"]`) | `smplwise/` | **All checks passed**; every test file this branch adds or edits is clean too (the tests tree has 3049 older findings, unchanged) |
| full backend suite | all 1003 `tests/test_*.py`, 4 shards | a first in-session attempt reached about 1,700 tests in 50 minutes with no failure and was stopped (about 9 hours at that rate). Restarted **detached** on the merge head: logs, junit and the start stamp in `C:/cloude/becomplex-fullsuite/` (`shard<N>.log` last line = the shard's summary). **Not finished at the time of this note: NOT_RUN as a verdict.** |

Not run: the runner entry check (the 2.43.9 re-gate and the 2.44.0 gate have the runner today); no UI or pixel change, so no baselines.

## Open questions (recommendation first)

- Q1. Should `rbac.scope_chain` also cut a deleted FLOOR from its building (a live building's permission would then not cover a deleted
  floor, the way the audience already treats it)? a) no, leave it as is (recommended: no route serves a deleted floor and the change
  reaches every map / plan route); b) yes, for consistency with the audience (a small rbac change plus a test).
- Q2. Module-level mutable dicts / lists / sets (e.g. `presence._GATE_AUDITED`) are still not in the singleton inventory (only objects of
  package classes are). a) add them in a later row with an allow-list for constant tables (recommended); b) leave.
- Q3. The three router caches recorded in `singletons_unregistered.txt` (`cameras._CAPS_CACHE`, `cameras._ZONES_CACHE`,
  `health._EVENTS_COUNT`): a) register their resets in the router agent's next branch (recommended); b) keep them listed.
