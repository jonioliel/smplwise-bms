# WISKEY-R4-2520 - `sync/station_v1` with a request id (WisKey adoption plan row R4, master id B7)

Branch `pilot/WISKEY-R4-2520`, cut from `origin/pilot/WISKEY-RESYNC-2520` (`a7eb3159a`, slice R1). Target version: 2.52.
The plan calls this row WISKEY-SYNC-V1-2520; the brief named it WISKEY-R4-2520 (same row).
Nothing was installed, nothing touched the lab, no message went to WisKey.

## 1. What and why

WisKey rc.19 added `sync/station_v1` (contract `station-sync-request-v1`, PRODUCT `3e7bfc585d5a`, `docs/contracts/station-sync-request-v1/`):
the same queued reconciliation as `sync/station` (`stations: manage`, the same station restriction), answered with
`{contract: wiskey-station-sync-request.v1, request_id, station_id, accepted: true, scope: current_attached_runtime_only, effect_proven: false}`.
The request id is WisKey's in-memory id of the pending batch of the CURRENT attached runtime (requests for one pending batch share it, a
request during an active batch gets the next one); `system/status_v1` shows it as the station's `sync.request` pending / active id and the
last result. WisKey's own rules (CONTRACT_HE): `accepted` is not execution or convergence; no automatic retry from the consumer on
UNKNOWN; a detached station is refused `station_offline` before acceptance; `sync/station` keeps its meaning.

Arx now:

- **Selection before sending** (`wiskey_station_ops.sync_mode`): the numbered form only when WisKey's discovery for the add-on identity
  lists BOTH `sync/station_v1` and `system/status_v1` (the id means nothing without the read that shows it) and needs no newer client;
  otherwise the classic `sync/station` on `maintenance`, byte-identical to before. Reasons kept in the audit row (`sync_mode_reason`:
  `no_copy`, `commands_unknown`, `api_incompatible`, `not_listed`, `status_not_listed`).
- **No fallback**: a refusal of the numbered form (`unauthorized`, `station_offline`, `unknown_command`, `api_incompatible`, ...) is final
  for that request; the classic command is never sent after it.
- **The frame**: exactly the contract's request keys `{id, type, station_id, api_contract: 1}`, once, on the channel `station_sync_v1`
  that slice 1 registered (only that command rides it).
- **The answer**: checked against the contract (`contract`, `accepted` true, `scope`, `effect_proven` false, the same `station_id`, a
  UUID request id); an extra key is dropped (closed construction, as slice 1). Anything else after `success: true` is UNKNOWN, never
  success. A success is reported `acknowledged` ("accepted - queued"), with `request_id`, `scope` and `effect_proven: false`.
- **UNKNOWN is held, never replayed**: the numbered sync runs with the feed's per-target gate (`target = station_sync:<id>`; the
  in-memory gate and the durable journal `intercom_write_ops`, the same mechanism as people writes). After an unknown outcome the next
  `sync` to that station - numbered OR classic - is refused before sending (409 `station_sync_unsettled`, `details.outcome: not_sent`,
  `details.gate`) until a status read that started after the call was over has answered.
- **The status read** `GET /api/v1/access-control/stations/{id}/maintenance/sync-request`: one `system/status_v1` READ on slice 1's
  `system_status` channel (only when WisKey lists it; slice 1's projection and contract checks reused unchanged), reduced to this
  station's sync observation, matched against Arx's own last request id from the audit rows: `running` / `queued` / `finished` (WisKey's
  result state; `effect_proven` stays false) / `not_observed` (a newer batch or a WisKey restart - unknown, never a failure). A read
  that WisKey refuses, does not list, or that breaks its contract settles nothing. Gate: the maintenance read's
  (`access.admin.read` or `access.stations.manage` somewhere, audited 403), the station's `access.read`, and on the station
  `access.stations.manage` or the status page's rule (else the uniform 404).
- **Permission and audit unchanged**: same route, body, `access.stations.manage` on the station, confirmation, Arx's limits, audit
  action `intercom.station_sync` (attempt + outcome rows); the rows add `sync_mode` and, on an acceptance, WisKey's `request_id`.
- **Drawer** (`wk-station-maintenance`): with the numbered form the sync cell shows the request id (short, full id in the title) and
  "the request is queued - not yet proof the station was synced"; a quiet "בדיקת מצב הסנכרון" READ (no confirmation, no command) says
  where the request stands; while held, the sync button is disabled with the reason. Hebrew + English; existing tokens only; the cell
  grows by at most three short lines (no scrolling added). A server without the row (no `sync_mode`) draws exactly what it drew before.

Rollback: revert the commit. No migration, no setting (the journal table exists since R5-A6).

## 2. Files

| file | change |
|---|---|
| `smplwise_vms/backend/smplwise/services/wiskey_station_ops.py` | `sync_mode`, `project_sync_v1`, `send_sync_v1`, `op_for` / `send_op`, `sync_target`, the status read's `project_settle` / `sync_observation` / `match` |
| `smplwise_vms/backend/smplwise/routers/access_control_station_ops.py` | mode + gate in the POST, numbered channel + target, `_unsettled`, `_last_sync_request`, view keys `sync_mode` / `sync_gate`, last run `request_id` / `mode`, the GET `sync-request` |
| `smplwise_vms/backend/smplwise/wire/access_control_station_ops.py` + `frontend/src/api/generated/wire-access-control-station-ops.ts` | two view keys, model `AccessControlStationOpsSyncRequest` (generated) |
| `frontend/src/api/station-ops.ts` | types, `getSyncRequest`, `shortId`, `syncRequestId`, `syncRequestText`, `syncGateText` |
| `frontend/src/components/wk-station-maintenance.ts` | the sync cell's request id, hold line, status read |
| `frontend/src/i18n/wiskey-station-ops.ts`, `frontend/src/i18n/lang/en/i18n/wiskey-station-ops.ts` | `syncRequest` block, nine reason codes |
| `smplwise_vms/backend/tests/test_wiskey_sync_v1_2520.py` (new) | end-to-end over the fake WisKey |
| `smplwise_vms/backend/tests/fixtures/wiskey_rc19/station-sync-request-v1/` (new) | WisKey's synthetic examples + schemas, unchanged (git blobs equal PRODUCT's: result.valid `b50a244f`, .wrong `8b4ddb52`, .extra `85258b34`, .missing `6a34c354`, request.valid `76ea1ec4`, error.valid `42c3f4a3`, result.schema `bc25439b`, request.schema `d9a65513`) |
| `frontend/tests/unit-wiskey-station-ops.spec.ts`, `frontend/tests/wiskey-station-ops-mocks.ts`, `frontend/tests/evidence-wiskey-sync-v1-2520.spec.ts` (new) | unit words / helpers; mock: optional `syncMode` / `syncGate` / `syncMatch` and the GET; evidence spec |

Not touched: `services/wiskey_channels.py`, `routers/__init__.py`, `scripts/gen_wire_types.py`, slice 1's tests and fixtures (R1 files).

## 3. Contradiction with slice 1 (recorded, not resolved here)

Slice 1's `tests/test_wiskey_system_status_2520.py::test_the_reserved_channels_are_registered_but_nobody_sends_on_them` asserts that no
module but `wiskey_channels.py` names `"station_sync_v1"` "until its row lands", and `wiskey_channels.RESERVED_CHANNELS` /
`describe()["station_sync_v1"]["in_use"]` still say reserved / not in use. This row lands it, so on this branch that one R1 test FAILS by
design. The brief forbids editing R1's registry and tests, so the fix is left to R1 / the train (patch below, three lines). The channel
itself needs no change (the guard is built for every name in `ADAPTER_CHANNELS`).

```diff
--- a/smplwise_vms/backend/smplwise/services/wiskey_channels.py
-RESERVED_CHANNELS = frozenset({"relay_inventory", "station_sync_v1"})
+RESERVED_CHANNELS = frozenset({"relay_inventory"})  # station_sync_v1: in use since WISKEY-R4-2520
-        "station_sync_v1": {"commands": sorted(STATION_SYNC_V1), "in_use": False},
+        "station_sync_v1": {"commands": sorted(STATION_SYNC_V1), "in_use": True},
--- a/smplwise_vms/backend/tests/test_wiskey_system_status_2520.py
-    assert ch.RESERVED_CHANNELS == {"relay_inventory", "station_sync_v1"}
+    assert ch.RESERVED_CHANNELS == {"relay_inventory"}
-                   and re.search(r"""["'](relay_inventory|station_sync_v1)["']""", p.read_text(encoding="utf-8")))
+                   and re.search(r"""["'](relay_inventory)["']""", p.read_text(encoding="utf-8")))
```

(R3 will need the same for `relay_inventory`; the train merging both should end with `RESERVED_CHANNELS == frozenset()`.)

## 4. Tests (real results)

PC (repo venv / Node 24), one file at a time, at commit `b5991c217` + this note:

| command | exit | result |
|---|---|---|
| `python -m pytest tests/test_wiskey_sync_v1_2520.py` | 0 | 26 passed |
| `python -m pytest tests/test_wiskey_station_ops.py` (the existing maintenance tests, classic path unchanged) | 0 | 26 passed |
| `python -m pytest tests/test_wiskey_system_status_2520.py tests/test_wiskey_channels.py tests/test_pwclean_295.py` (slice 1) | 1 | 96 passed, 7 skipped, **1 failed**: `test_the_reserved_channels_are_registered_but_nobody_sends_on_them` - expected, section 3 |
| `npx playwright test -c playwright.unit.config.ts tests/unit-wiskey-station-ops.spec.ts` | 0 | 8 passed (incl. the new sync-request test; both languages same keys / placeholders, no platform name) |
| `python scripts/gen_wire_types.py --check` | 0 | generated files match |
| `python scripts/wire_ratchet.py` | 0 | 897 unmodelled = baseline 897 (the new GET is modelled) |
| `ruff check` on the changed Python files | 0 | all checks passed |

**NOT_RUN** (queued on the runner, slot B, for about two hours; the runner stayed saturated - 10-11 queued jobs, under 1 GB free - so
the jobs were withdrawn and the runner folder removed): frontend `tsc --noEmit`, `eslint` on the changed frontend files, the route
inventory tests (`test_get_routes_read_conn`, `test_local_auth_inventory`, `test_plan_routes_unique`, `test_secfix2_pub07_guard_first`,
`test_gate_always_run`, `test_capabilities`, `test_wire_routers_*`, `test_error_envelope_family2_2500`, `test_singletons_registered`),
`test_wiskey_limits_pins_2438` / `test_wiskey_write_limits_2438`, the UI build, `tests/evidence-wiskey-sync-v1-2520.spec.ts` and the
before / after compare page (desktop + phone, light + dark). The full backend suite and Playwright gate: NOT_RUN (the train gate).
Live WisKey / lab: NOT_RUN by rule (the lab has rc.10: neither rc.19 command is listed, so every sync stays classic and nothing new is sent).

## 5. Open questions (owner; recommendation first)

1. A WisKey that stops listing `sync/station_v1` while a numbered sync of a station is UNKNOWN: the classic command is held too, and if
   `system/status_v1` is gone as well nothing can settle it from Arx (WisKey's own panel can still sync). a) keep the hold - strict "never
   replayed" (recommended) b) let the classic command through after the journal's hold time.
2. The status read is installation-wide in WisKey (`management: view` unrestricted for the add-on identity) but Arx shows only the one
   station's row, so a station-scoped administrator may read it. a) keep station-scoped (recommended: no other station's data leaves)
   b) require `access.admin.read` unrestricted, as slice 1's status route.
3. An offline station under the numbered form is refused by WisKey (`station_offline`, shown as "failed: station offline"), where the
   classic form queued it. a) show WisKey's refusal honestly (recommended; no fallback) b) refuse it in Arx before sending.
