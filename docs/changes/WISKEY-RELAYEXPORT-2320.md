# WISKEY-RELAYEXPORT-2320 — relay map contract precision, the Arx -> Native snapshot exporter, and test receipts

Branch `pilot/WISKEY-RELAYEXPORT-2320` from `pilot/WISKEY-RELAYMAP-2310` (`800308b10`). Not merged; nothing installed, released or
switched on. No WisKey, door, station, Home Assistant or runner contact. Input: the WisKey Windows team's answer of 2026-10-31
(handoff `e105e3268`, relayed by the owner).

## A. Contract precision: two revision domains

The relay map has **two independent counters**. They must never be confused.

| | Station revision | Row revision |
|---|---|---|
| Stored in | `wiskey_relay_map_stations.revision` (migration 0187) | `wiskey_relay_map.revision` (migration 0145), one per `(station_id, api_relay)` |
| API | `GET /api/v1/wiskey/relay-map` → `stations[].revision`; `PUT /api/v1/wiskey/relay-map/{station_id}` → `expected_revision` | `GET` → `stations[].rows[].row_revision` |
| Purpose | station-level compare-and-set for snapshot consistency **only** (a stale value → 409 `revision_conflict`, nothing written) | the value that goes into `StationGrant.mapping_revision` (`wiskey_feature_exec.relay_row` / `relay_row_for_door`) and into the Native startup/C07 projection |
| Moves when | every accepted approval of that station, by exactly 1 | only when **that row** changes (create, re-map, disable, re-enable), by exactly 1 |
| Goes into a grant | **never** | always |

Behaviour of the approval `PUT` (verified in code, `services/wiskey_relay_map.py:save`, and pinned by tests):

1. **Unchanged rows keep their `row_revision`.** An approval writes only the api relays whose effective value changes; the other row is
   not touched (its `revision`, `confirmed_by`, `updated_at` stay). The station revision still advances by 1.
   Pinned: `test_wiskey_relay_map_export_2320.py::test_a_unchanged_rows_keep_their_row_revision_while_the_station_revision_advances`
   (api relay 1 stays at row revision 1 over station revisions 1 → 2 → 3) and `test_wiskey_relay_map_writer_2310.py::test_disabling_a_mapped_api_relay_deactivates_its_row`.
2. **A no-op is 422** `relay_map_unchanged`, and nothing moves (no row, no station revision). "No-op" is decided on the *effective*
   map (`api_relay → physical_relay` of active rows, `None` otherwise): re-sending a disabled tombstone as disabled, or an unmapped api
   relay as disabled, is a no-op too. Pinned: `test_a_no_op_is_422_also_for_an_already_disabled_tombstone_and_an_unmapped_relay`,
   `test_a_save_without_a_change_is_refused_and_does_not_advance`.
3. **Disable = inactive tombstone.** Disabling a mapped api relay keeps the row with `active = 0`, its last `physical_relay`, and a new
   `row_revision` (+1). `GET` shows that row as `physical_relay: null, active: false, row_revision: <n>`; the grant lookups do not return
   it (`relay_map_missing` for that door). Disabling an api relay that never had a row writes **no** row. Re-enabling a tombstone
   updates the same row (+1). Pinned: `test_a_disable_is_an_inactive_tombstone_and_get_shows_physical_relay_null_with_its_row_revision`,
   `test_disabling_an_api_relay_without_a_row_invents_no_row`.
4. **Stale station revision** → 409, no row revision moves. Pinned: `test_a_stale_station_revision_writes_nothing_and_moves_no_row_revision`.

Code fix: none was needed; the code already behaved exactly as above. Hardening added in migration 0188 (database level, additive):
`wiskey_relay_map_tombstone_kept` (an inactive row can never be deleted) and `wiskey_relay_map_revision_forward` (an update of a row
revision must increase it). Neither changes any existing write path (`set_relay_map` always writes `current + 1` and never deletes).

## B. Sync direction Arx → Native: the snapshot exporter (Arx side)

Agreed proposal: Arx is the source of the counters. The Native verifies source / repository / station / API relay / physical relay and
projects the matching `row_revision` into startup/C07; it never makes a competing counter. This slice builds **only the Arx side**:
an internal, verified, numbered exporter. **No network push to WisKey**: the transport is a later joint decision.

### Service `smplwise/services/wiskey_relay_map_export.py`

- `snapshot(conn)` — the full map as plain facts, schema `arx.wiskey.relay_map_snapshot.v1`:
  - `source` `{system: smplwise_arx, map: wiskey_relay_map, station_revisions: wiskey_relay_map_stations, direction: arx_to_native}`;
  - `coverage: "full"`, `row_count`, `tombstone_count`;
  - `stations[]` sorted by `station_id`, every station that has a row or a station revision:
    `station_id`, `station_revision`, `approved_by` (Arx user id), `approved_at`,
    `rows[]` sorted by `api_relay`: `api_relay`, `physical_relay` (**also for inactive tombstones**), `active`, `row_revision`,
    `confirmed_by`, `updated_at`; and `unmapped_api_relays` (api relays with no row at all — never an invented row).
  - Rows written without a station approval (e.g. older direct `set_relay_map` calls) are exported with `station_revision: 0`.
- `digest(snapshot)` — `"sha256:" + sha256(canonical JSON)`; canonical JSON = `json.dumps(sort_keys=True, separators=(",", ":"),
  ensure_ascii=False, allow_nan=False)` in UTF-8. Integers and strings only. The same map → the same digest, whatever the key order.
- `verify(snapshot, conn=None)` — refuses (`export_unverified`) a snapshot that is not full and consistent: shape/schema, sorted unique
  stations, api relays ⊆ {1, 2} with `unmapped_api_relays` exactly the rest, valid rows, at most one **active** row per physical relay,
  counts; with `conn`, the row count must equal the table (no active-only copy can pass).
- `export(conn, by=)` — verifies, then seals the live snapshot as the next export number (`seq`). If the newest export already has the
  same digest, that record is returned (`created: false`) — re-exporting an unchanged map consumes no number.
- `ack(conn, seq=, content_digest=, by=)` — records the Native's acknowledgement by `(seq, digest)`. A different digest →
  `export_digest_mismatch`; an unknown number → `export_not_found`; both write nothing. A repeated ack is idempotent
  (`already_acked: true`, the first `acked_by` / `acked_at` stay).
- `rollback(conn, to_seq=, by=)` — re-exports the **stored** snapshot of an earlier number as a **new** number (`kind: rollback`,
  `rollback_of: to_seq`); the stored body is re-verified against its digest first (`export_corrupt` otherwise). Rolling back to the
  snapshot that is already the newest export → `rollback_noop`. A rollback never changes the map: the live map stays newer, so the
  rolled-back export reports `stale: true` and the status is `rolled_back` until the live map is exported again (a new number).
- `status(conn)` — the live snapshot with its digest, `publication` (`never_exported` | `published` | `unpublished_changes` |
  `rolled_back`), `latest` and the newest 50 export summaries.
- Per record: `seq`, `kind`, `rollback_of`, `content_digest`, `exported_by`, `exported_at`, `acked_by`, `acked_at`,
  `state` (`exported` | `acked`), `stale` (live digest differs: a newer approval exists), `current` (newest number),
  `newer_approvals` (stations whose facts differ from the live map).

### Lifecycle

| State | Meaning |
|---|---|
| (crash before commit) | the export is one transaction: nothing is stored and no number is consumed (SQLite `AUTOINCREMENT` rolls back with it) |
| `exported` | sealed under `seq`; content and digest can never change (trigger `wiskey_relay_map_exports_sealed`) |
| `acked` | the Native confirmed this `seq` by its digest; set once |
| stale (derived) | the live map digest differs — a newer approval exists; re-export gives a new number |
| superseded (derived) | `current: false` — a newer number exists |
| rollback | an earlier stored snapshot re-sealed under a new number; numbers are never reused, records never deleted (trigger `wiskey_relay_map_exports_kept`) |

### Guarantees (what WisKey asked for)

- Read, export, ack and rollback never call the approval `PUT` / `rm.save` / `set_relay_map` and never write `wiskey_relay_map` or
  `wiskey_relay_map_stations`: no counter moves. The only table written is `wiskey_relay_map_exports`.
- A map change, an export, an ack or a rollback never rewrites an intent / lease / fence / UNKNOWN history tuple: the test snapshots
  every other `wiskey_*` table (with an `unknown` intent carrying `mapping_revision` 1) before and after and requires them byte-equal.
- The startup tree must never be built from the active-only `GET`: the export carries tombstones with their physical relay and the
  api relays without a row; `verify` refuses a partial snapshot.
- Tombstones are never deleted (trigger), a row revision never goes back (trigger), an unchanged row keeps its row revision (A.1).

### Admin read endpoint (read only)

- `GET /api/v1/wiskey/relay-map/export` — `status()`; `system.configure` at installation scope only (`access.admin.read` and
  operators get 403). Reading exports nothing.
- `GET /api/v1/wiskey/relay-map/export/{seq}` — one record with its sealed snapshot; 404 `export_not_found`.
- There is no write endpoint: export / ack / rollback are service calls for the later transport. (`PUT /wiskey/relay-map/export` is
  the existing station approval route with station id `export` → 404 `intercom_station_not_found`.)

### Storage

Migration `0188_wiskey_relay_map_exports.sql` (next free number after 0187 on this line; additive; rollback = drop the table and the
four triggers). The table is in `services/backup.py` `NEVER_EXPORTED_TABLES` (a restore must never rewind an export number), like the
map itself. Ids and user ids only.

### Tests

`smplwise_vms/backend/tests/test_wiskey_relay_map_export_2320.py` (32 tests): digest stability and canonical form, every fact per
station, tombstones present with their physical relay, full coverage / no invented row, no counter movement and no approval call on
read/export/ack/rollback, idempotent export, monotonic never-reused sequence, ack by digest (match / mismatch / repeat), stale
detection, refused and crashed exports consume no number, verify refusals, rollback semantics (new number, same digest, stale,
`rollback_noop`, corrupt body refused), sealed records, tombstone and revision triggers, history tuples unchanged, admin-only read
endpoint, no write endpoint, backup exclusion, and the four part-A pins.

## C. Receipts

See `docs/evidence/WISKEY-RELAYEXPORT-2320/receipts/RECEIPTS.json` for what existed for the earlier reported counts, what was not
captured, and the fresh runs on the exact heads.
