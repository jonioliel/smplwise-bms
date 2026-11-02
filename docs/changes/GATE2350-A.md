# GATE2350-A - release gate of 2.35.0: the six backend failures

Branch `fix/GATE2350-A` from `origin/release/2350-train` @ `3a4ac7b17`. Not merged into the train (the lead merges).
Backend only - no `frontend/src` change, no UI rebuild needed. No version bump, no API, data or settings change.
Gate report: `gate_release-2350-train_3a4ac7b17` (FAIL: 6 backend tests "failed twice", every frontend category green).

## 1. Root causes

### A. A wipe's WAL scrub never really ran; the connection pool exposed it (4 tests, security property)

- `test_wiskey_station_encryption.py::test_the_start_up_conversion_seals_every_plaintext_row_and_leaves_none_in_the_file`
- `test_wiskey_station_encryption.py::test_an_unreadable_key_keeps_the_plaintext_working_and_warns_with_names_only`
- `test_bridge_key_activation_295.py::test_h07_a_retired_keys_sealed_blob_is_not_left_in_the_database_or_the_wal`
- `test_bridge_keyrot_harness_295.py::test_restarts_of_both_sides_keep_the_key_set_and_the_replay_marks`

Both wipes (TKWISECRYPT station passwords at start-up, H-07 retired / discarded bridge keys) promise the old value is not
left in the database file or its WAL, and both ran `PRAGMA wal_checkpoint(TRUNCATE)` **inside** `db.connection()` - which
always begins a transaction. SQLite refuses a checkpoint on a connection with an open transaction
("database table is locked", verified on this machine); both callers swallowed the error. It went unnoticed because, before
DB-CONN-POOL-2343, the last connection to close checkpointed and deleted the WAL anyway. With the pool (2.35.0, default on)
idle connections keep the file open, so the old page images stayed in the WAL / the main file: the plaintext station
password and the retired sealed key blob were still on disk. Reproduced locally with the pool on; green with
`SW_DB_CONN_POOL=0`.

A second layer for the bridge keys: the card's `GET /system/bridge-key` ticks the rotation engine **inside a read request**,
whose snapshot keeps any TRUNCATE checkpoint busy until the request ends - so even a checkpoint outside a transaction could
not pass at that moment.

**Fix (`smplwise/db.py`):** `Database.scrub_wal(label)` - a TRUNCATE checkpoint on its own short connection (never a lease,
never in a transaction), under the write gate like a writer, waiting at most `SCRUB_READER_WAIT_S` (0.5 s) for readers.
When a reader keeps it busy, the scrub stays **pending** on the file (`WriteGate.scrub_path`, with a generation so a retry
only clears what it covered) and is retried without waiting each time a transaction of this process ends -
`connection()`, `write_aside()`, `release()` (CommitBeforeSend: before the response is sent) - and on the janitor's
checkpoint tick, until it passes. `wiskey_camera.apply_at_startup` and `bridge_keys.scrub` call it. The property now holds
with the pool on, and is stronger than before with it off (no longer dependent on every connection being closed).
New regression tests in `tests/test_db_conn_pool.py` (`test_scrub_wal_leaves_no_wiped_value_while_pooled_connections_stay_open`,
`test_a_scrub_kept_busy_by_a_reader_is_finished_when_the_reader_ends`).

### B. The calendar attendee notices register a messaging use (1 test, expected change - test updated)

`test_messaging_accounts_api.py::test_uses_carry_the_configured_module_name_d33` compares the exact module-name map of the
messaging accounts document. CAL-ATTENDEES-2343 (2.35.0) registers the use `calendar.attendees` with the module `calendar`
("יומנים", `services/calendar/attendee_notices._register_use`). Not the pool (fails with the pool off too). The test's
expected map gains `"calendar": "יומנים"`, as it did for the earlier additions (access, notifications, identity).

### C. A counter read before the server counted (1 test, test race - test fixed)

`test_tickets_public_server.py::test_one_upload_in_flight_per_link_at_the_socket` read `body_idle_timeouts` and the link's
`wasted` mark right after reading the 408. The public listener bumps both **after** the 408 is sent
(`public_http.py`: `_plain()` first, then the counter; `wasted` in the outer `finally`), so on a loaded runner the client
saw `{'drains': 1}` only. The product promises no ordering between the answer and the health counters; the test now waits
for them (`wait_until`, 5 s) like the neighbouring tests do. Passes locally with the pool on and off; not pool-related
(the code and the test are unchanged since 2026-10-13).
