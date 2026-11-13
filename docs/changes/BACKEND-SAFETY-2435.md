# BACKEND-SAFETY-2435 - five P1 backend safety and stability fixes

Branch `pilot/BACKEND-SAFETY-2435`, cut from `origin/main` (v2.43.4, `665ec8f24`). Source: the code review of 2026-11-13
(`private/code-review-2026-11-13/`, reports 03, 04 and 05). No migration, no new route, no new permission, no new setting
key, no frontend change. No device was touched: every test uses fakes (httpx MockTransport, fake adapters, a fake database
failure).

Successful paths are unchanged; each fix changes only what happens on the failure path it names.

## 1. Restore path steering (05 P1-06)

A backup archive is unsigned. `case_items.file_path` and the `sites` / `buildings` `image_path` were restored unchecked, and the
case-file serve / delete / integrity routes, the catalogue picture serve / delete routes and the evidence bundle joined the stored
value to their directory without containment (an absolute value even replaces the base: `Path / "/abs"`).

- New `services/safe_paths.py`: `confine(root, rel)` (a plain relative path - no absolute path, drive, backslash, NUL, empty / `.` /
  `..` segment - that, once resolved, lies strictly under the root), `case_file(data_dir, rel)` (confined and under `cases/` or
  `imported/`, so a stored path can never name the database or a key file) and `restore_path_ok` (the exact shapes the product
  writes: `cases/<id>/<id>.jpg`, `imported/<sha256>/<clips|snapshots>/<name>`, `<site|building>-<id>.jpg`).
- Restore (`services/backup._unsafe_rows`): a value of another shape is **neutralised** - set to NULL, the row (a site, a building,
  a case item) is kept - and counted in `skipped_unsafe` as `"<table>.<column>"` (logged with the other skipped rows, count only).
  Neutralising rather than dropping the row: dropping a site row would take its buildings and floors with it.
- Sinks: `routers/cases.py` (preservation state, file serve, item delete, integrity check), `routers/catalog.py` (picture serve,
  site / building picture delete), `services/bundle.py` (snapshot and imported-file copies). A refused path answers like a missing
  file (404 / "missing"); a delete never unlinks it.

## 2. Housekeeping pass aborts on one failure (04 F01)

`main.janitor_tick` ran its first steps (playback idle / orphans / groups, export retention, event, thumbnail, audit pruning,
refusal summaries, HA history, device activity, push pruning) unguarded, so one persistent failure skipped every later step
(automatic bills, retention, privacy purges ...) every 30 s. Each of those steps now runs through `_janitor_step`, which logs
`"<step> janitor failed"` with the traceback and goes on - the rule the other 36 steps already had.

Two failures still end the pass on purpose, now logged: a demo state that cannot be read (housekeeping must not touch a demo that
may be running) and settings that cannot be read (no retention step runs on guessed values).

## 3. Slow shutdown (05 P1-08)

`notify_sources.Monitor.shutdown` set the stop event and joined, while the thread sat in `_SIGNALS.get(timeout<=1 s)`. It now
puts a private wake-up item (`_WAKE`) on the queue after setting the event. The loop drops it (never written); `_take` skips it,
and a wake-up item the thread did not consume (it was busy in a pass) is removed after the join, so the queue is left exactly
as before.

Measured over 5 app start / stop cycles (`TestClient.__exit__`, on the workstation): the median fell from 0.59 s to 0.06 s (see "Tests").

## 4. NVR write with no undo (03 F01)

`nvr_write.apply_change` does GET, PUT, GET. When the device accepted the PUT and only the read-back GET failed, the exception
skipped both the change row and the audit row: the device was changed and nothing could undo it. Now, on a read-back failure
after an accepted PUT:

- an `nvr_changes` row is written with status `applied`, `error = "verify_failed"`, `before_xml` = the previous document (when
  `keep_before`), `after_xml` = the document that was sent - so the generic undo accepts it;
- an `nvr.write` audit row (`allowed`) carries `verified: false` and `verify_error`;
- the same `ApiError` is raised to the caller as before.

`rollback` has the same shape: when the old document was accepted but its read-back fails, the original is marked `rolled_back`,
the undo row is written (`applied`, `verify_failed`, `after_xml` = the document sent), the `nvr.rollback` audit row carries
`verified: false`, and the error is raised. The request transaction commits on `ApiError` (db.connection), so the rows persist.

## 5. Event listener threads die permanently (03 F02)

The Provision-ISR and Frigate loops wrote the post-reconnect coverage gap with `publish(retry_locked(_gap))` outside any `try`;
a failing write (busy after three attempts, or any other SQLite error) left `run_loop` and ended the thread for good. New
`events_ingest.close_gap(...)` does the same write and publish, and on failure logs (the traceback once per failure streak) and
returns False: the loop keeps `disconnected_since`, so the next good round retries the same gap (its dedup key is the start, so it
is written once). Both vendor loops call it. The Hikvision alert stream loop is unchanged (its copy is already inside its `try`).

## Tests

New `smplwise_vms/backend/tests/test_backend_safety_2435.py` (10 tests):

| Test | Covers |
|---|---|
| `test_safe_paths_shapes_and_containment` | the helper: shapes, `..`, absolute, drive, backslash, the database name |
| `test_a_crafted_archive_cannot_steer_case_or_picture_paths` | a crafted archive: 4 bad case paths and a bad building picture are neutralised and counted; the good site picture and case file are kept and still served; a file outside the data dir is untouched |
| `test_serve_and_delete_routes_refuse_a_stored_path_outside_the_root` | stored bad paths (relative escape, absolute, the database file): serve answers 404, delete never unlinks |
| `test_one_failing_early_janitor_step_never_skips_the_later_ones` | `thumbnails.prune` raises; `push.prune` and `energy_billing.janitor` still run; the step is logged |
| `test_the_notification_monitor_shuts_down_at_once` | shutdown under 0.2 s, thread ended, queue empty |
| `test_a_wake_up_item_is_never_written` | the wake-up item is never written as a signal |
| `test_an_accepted_nvr_write_whose_read_back_fails_is_recorded_and_can_be_undone` | fake NVR: PUT accepted, read-back 500; change row + unverified audit; the undo works and is itself recorded when its read-back fails |
| `test_a_verified_nvr_write_is_recorded_exactly_as_before` | success path: `error` NULL, no `verified` key in the audit |
| `test_a_failing_gap_write_never_ends_the_provision_listener` | the gap write fails 3 rounds, the loop runs on; the gap is recorded once the database answers |
| `test_a_failing_gap_write_never_ends_the_frigate_listener` | same for the Frigate loop; the poll itself went on |

Against the unchanged source (fixes stashed, tests kept) 8 of the 10 fail; the helper test and the success-path test pass there
too, as intended.

Local run (workstation, Python 3.12.10 venv, CPU at 100 % from other work, so durations are long):

```
python -m pytest -p no:cacheprovider -o addopts="" -q tests/test_backend_safety_2435.py tests/test_janitor.py
  tests/test_notify_sources.py tests/test_nvr_write.py tests/test_backup.py tests/test_cases.py tests/test_catalog.py
  tests/test_catalog_images.py tests/test_bundle.py tests/test_provision_wiring.py tests/test_frigate_events.py
  "tests/test_plan_skins.py::test_restore_skips_unsafe_floor_ids_and_skin_rows_and_touches_nothing_outside"
117 passed in 3510 s
```

A broader local run (adding the other backup, privacy-mask, bundle-import, Provision-ISR and Frigate files, 314 tests in all) was
started and stopped by me after about 20 minutes: at the loaded workstation's rate it would have taken hours. Those files are
NOT_RUN locally; the runner's entry check runs the full suite.

Shutdown timing, app start then `TestClient.__exit__` (5 cycles each, same workstation):

| | exit seconds |
|---|---|
| before (notify_sources.py from main) | 0.59 0.55 0.66 0.94 0.42 |
| after | 0.06 0.38 0.11 0.06 0.05 |

## Known limits

- Not run on the runner yet when this note was written; the entry check is queued after the push.
- `plan_versions.image_path` sinks (`routers/plans.py`, `plan_geometry.py`, `zones.py`) were not changed: that column is already
  checked on restore by the existing `FILE_COLUMNS` / `restorable` rule. Report 05 also lists P2-13 / P3-06 for the same branch
  plan; they are not part of this change.
- The janitor registry of report 04 F17 is not done; this change is the per-step guard only.

## Rollback

Revert the commit. No data migration; rows written with `error = "verify_failed"` stay valid rows of the existing schema.
