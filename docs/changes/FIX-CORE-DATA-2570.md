# FIX-CORE-DATA-2570 (2.57; final deep review 2.56, area core / data / release)

Findings of docs/review/DEEP-REVIEW-2560-CORE-DATA-RELEASE.md (branch origin/review/DEEP-2560-CORE-DATA-RELEASE) left open after
FIX-CORE-2560: CD-05, CD-02 (second path), the delivery / reconcile counters in the health report (CD-04 residual), TR-08 (part).
Base: origin/release/2570-train (v2.56.0, 6ea807b2e). Each finding was confirmed at the base before the change.

## What changed

- **CD-05** `services/legacy_source.py`: a new budget `MAX_UNPACKED_WALK` (512 MB) counts EVERY byte a decompressor produces while
  an archive is walked - members that are skipped, and the re-decompression from the start that a backward seek in a gzip stream
  costs - not only the bytes of the members kept (`MAX_TOTAL_READ`, unchanged). A compressed outer or inner TAR (gzip / bz2 / xz)
  is decompressed by a counting, seekable view (`_Unpacked`) and read by `tarfile` as a plain TAR (`r:` / `r|`), so no
  decompression happens outside the budget. Past the cap the input is refused with the existing stable code `too_large_unpacked`
  (detail `walk <cap>`). A crafted 20 MB upload that expands to ~20 GB now stops after 512 MB (a few seconds of CPU) instead of
  minutes per dry run. `read_path` (the workstation script, a full backup up to 4 GB) gets `max(512 MB, 16 x file size)`.
- **CD-02, second path** `services/ha_sync.py`: when the earlier session's frames are still being stored after `DRAIN_S`, the
  connect snapshot is no longer stored concurrently (the older frames were then applied over it). It is a control job on the
  state worker (`apply_connect_snapshot`), FIFO behind those frames and ahead of the frames held during the snapshot, written by
  `store_states_newest`: like `store_states` (a tombstoned entity HA lists again comes back, every listed entity is seen at the
  snapshot stamp) with the reconcile rule's time compare - a stored state strictly newer than the listing's is kept (only its
  seen stamp moves). `last_snapshot_at` is set when the job has stored it; a `structure_changed` / `resync` frame makes open
  screens refetch. The session does not wait for the job (a stuck worker must not keep the session from connecting).
  The fast path (worker idle within `DRAIN_S`) is unchanged.
- **CD-02 regression found while fixing** (2.56 `apply_resync`): the re-read after an overflow sets `last_snapshot_at = seen`, but
  since FIX-CORE-2560 it writes only the states that are newer; an entity HA never registered whose state was left as stored kept
  an older `state_seen_at`, and the registry refresh's tombstone rule (`state_seen_at >= last_snapshot_at` for unregistered
  entities) would remove it at the next refresh. `apply_resync` now stamps every listed, non-tombstoned entity as seen
  (`_stamp_seen`; never moves a stamp back; the state is not touched).
- **Counters in the health report** (additive, ADR-015): the `ha_sync` check of `GET /api/v1/health/report` carries
  `meta.delivery` (`ha_state_worker.delivery_view()`: `queued`, `done`, `waiting`, `dropped_full`, `skipped_old`, `max_queue`,
  `max_age_s`) and `meta.state_feed` (`ha_sync.feed_view()`: `state_overflows`, `state_resyncs`, `dropped_frames`, the state
  worker's `depth` / `max_depth` / `refused` / `done` / `failed` / `max_wait_ms`, and `last_reconcile` = the counts of the last
  periodic reconcile, or null before one ran). The wire schema types `meta` as a free object: no wire change. The settings
  screen (system-diagnostics, tab "בריאות ועבודות") lists them under the HA sync card in three short lines (state updates, last
  state reconcile, rule notifications), Hebrew and English (`i18n/lang/en/i18n/msg/system-a.ts`; the module has no ar / ru).
  An older server that sends no counters shows the card as before.
- **TR-08 (part)** `scripts/gate/nightly_tests.sh`: after the engine, on main only (not with `--frontend-only`; `--backend-only`
  never reaches it), the report-only coverage lane `scripts/gate/coverage_lane.sh` of the tree under test runs. Runtime bound:
  weekly by default (`SW_NIGHTLY_COVERAGE=weekly` on `SW_NIGHTLY_COVERAGE_DAY`, `date +%u` in Asia/Jerusalem, default 6 = the
  Saturday 02:00 run; `daily`; `off`), under `timeout` of `SW_NIGHTLY_COVERAGE_MAX_MIN` (60) minutes or what is left before the
  engine's end mark, whichever is less, and not at all with less than 20 minutes left. Shards: `SW_NIGHTLY_COVERAGE_SHARDS` (2).
  The summary gets one line: the report path, TIMEOUT, or NOT_RUN with the reason. `--dry-run` prints the lane's decision.
  Documented in the script header. The engine (`release_gate.py`, gate2) is not touched.
  Install step (not done by this row): the runner's installed copy `~/nightly_tests.sh` must be refreshed from the repo.
  Still open of TR-08: a real-HA run and an aarch64 build.

- **CD-05, the API answer** `routers/legacy_migration.py` (lead 28.11, open question 2 = a): a readable archive that unpacks past the
  reader's caps (`too_large_unpacked`) is answered 422 `legacy_source_too_large_unpacked` with its own exact message ("the file
  unpacks to more than can be read"; Hebrew in the router, English in `smplwise/error_text_en.json`); `details.reason` is kept.
  Every other refusal keeps its answer.

## Tests

New: `smplwise_vms/backend/tests/test_fix_core_data_2570.py` (CD-05, CD-02 second path, the seen stamp, the health counters),
`smplwise_vms/backend/tests/test_nightly_coverage_lane_2570.py` (the lane's schedule via `--dry-run`, the bounded call),
`frontend/tests/ha-feed-counters-2570.spec.ts` (the card: Hebrew light / dark, English, no reconcile yet, skipped, an older
server; desktop + mobile).

The second review (docs/review/DEEP-REVIEW-2570-CORE-DATA-RELEASE.md, origin/review/DEEP2-2570-CORE-DATA-RELEASE, CD2-22) confirmed
the CD-02 second path on the runner with a scratch test (a door contact listed `on` at 10:05, the previous session's queued frame
`off` at 10:01, `DRAIN_S` 0.2 s). Its reproduction is the second case of
`test_cd02_a_drain_timeout_stores_the_snapshot_behind_the_earlier_sessions_frames`.

## Results (all on the runner, slot B, unless stated)

- New backend tests BEFORE the fix (base code 6ea807b2e, the new test files copied in): 13 failed, 2 passed (the two "a real backup
  is still read" cases pass on the base too, by design). The CD-02 cases fail on the real assertion: `'OLD' == 'NEW'`, and the
  CD2-22 reproduction `'off' == 'on'`; the seen-stamp case `'2026-11-26T10:00:01Z' >= '2026-11-26T10:20:00Z'`.
- New backend tests AFTER (branch): 16 passed (test_fix_core_data_2570.py 13 incl. the CD2-22 case, test_nightly_coverage_lane_2570.py 3).
- Related backend suites AFTER: group 1 (core10 event loop, state reconcile, structure refresh, ha_sync_1000, state shapes, legacy
  import, migrate_legacy) 65 passed; group 2 (health report x4, i18n backend, NVR-less, outage run, nightly local hour / lightening,
  coverage lane, notify sources, pilot safety, soak edges, singletons registered) 185 passed.
- ruff on the changed Python files: all checks passed. `bash -n scripts/gate/nightly_tests.sh`: OK.
- Frontend: `tsc --noEmit` app + tests: rc 0; eslint on the changed files: rc 0; `vite build`: OK.
- frontend/tests/ha-feed-counters-2570.spec.ts BEFORE (base build): the counter tests fail (desktop + mobile); AFTER: 8 passed (desktop + mobile). The i18n missing-keys report lists nothing for msg/system-a.
- Workstation (PC, one file): test_fix_core_data_2570.py 12 passed (before the CD2-22 case was added).
- Compare page (before / after, Hebrew, desktop + phone, light + dark, English): private/planning/fix_core_data_2570_compare_2026-11-28.html
  (not in the repository). Pixel baselines: not affected (no visual-matrix mock carries the new `meta` keys).
- NOT_RUN: the full backend suite, the full Playwright suite, the nightly itself with the coverage lane (the runner's installed
  `~/nightly_tests.sh` must be refreshed from the repo first; not done by this row).
- The API answer (CD-05): `test_cd05_the_api_says_why_an_over_large_archive_is_refused` BEFORE (router and English table as at the
  base): 1 failed (`'legacy_source_invalid' == 'legacy_source_too_large_unpacked'`); AFTER: test_fix_core_data_2570.py +
  test_legacy_import_2550.py + test_i18n_errors_en_2520.py 41 passed; ruff clean.
