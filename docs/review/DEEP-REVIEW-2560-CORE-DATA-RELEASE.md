# DEEP-REVIEW-2560-CORE-DATA-RELEASE - final deep review, area 2 (id prefix `CD`)

Reviewed head: `origin/release/2560-train` at `3739e3ded` (2.56.0 rebuilt UI `57de3270c` + RECONCILE-TEST-LEAK-2560). Rows of the 2.56
train in this area: CORE10-EVENTLOOP-2560 (merged `809326af5`), GATE-NIGHTLY-2560 (`d1a09d6d1`), GATE-SETUP-FLAKE-2560 (`0de366cc7`),
BACKEND-SUITE-COST-2560 (`e346cfcbe`), RECONCILE-TEST-LEAK-2560. New code since `v2.52.0` in this area: HA state reconcile, the state
worker, backup off the write lock, legacy source / import, pilot rollback (commit refusal, clock jumps, downgrade check), the gate
engine (trust, setup flake, green-gate rule in `release_check.py`).

Method: read-only. Code read end to end on the paths below. Executed on the PC (read-only): `scripts/migration_downgrade_check.py
--chain v2.52.0,v2.55.0,HEAD` (PASS: only 0227, compatible, rollback note present), the same over `v2.40.0,v2.45.0` (FAIL on 0210 -
the checker detects triggers on an old table, as designed), and `scripts/release_check.py --tag` with no results directory (exit 0,
see CD-02). No pytest, no runner job (a 2.56 release gate was running).

## 1. Summary

| Id | Severity | Title | file:line (at `3739e3ded`) |
|---|---|---|---|
| CD-01 | medium | The TR-03 green-gate check accepts a diff-selection gate as "green full gate" and passes `--tag` with only a warning where no results exist | `scripts/release_check.py:540-599`, `:698-699` |
| CD-02 | low | The re-read after a state-queue overflow overwrites newer states with an older listing (no time compare) | `smplwise_vms/backend/smplwise/services/ha_sync.py:842-850`, `:1385-1404` |
| CD-03 | low | The legacy-import apply compresses its safety backup while holding the single write lock (CORE-05 again, on a new path) | `services/legacy_import.py:416-424`, `routers/legacy_migration.py:106` |
| CD-04 | low | Rule notifications to Home Assistant now queue without a bound or an age limit | `services/ha_state_worker.py:115-145` |
| CD-05 | low | The legacy reader's budget counts only the bytes it keeps: a small gzip can cost minutes of CPU per dry run | `services/legacy_source.py:298-388` |

Counts: critical 0, high 0, medium 1, low 4.

## 2. Findings

### CD-01 (medium) - the TR-03 green-gate check is weaker than its name

`release_check.py` (GATE-NIGHTLY-2560) adds "green nightly or full gate at this head or an ancestor (TR-03)".

1. `load_green_reports` (`:540-555`) keeps every `gate_<b>_<sha>.json` with a verdict; `green_gate_check` (`:557-599`) accepts any one with
   `verdict == "pass"` and `tier == "L"`. It never looks at `selection.reduced` (the engine's own test for a diff selection,
   `scripts/gate/gate_budget.py:55-57` `mode_of`) nor at the backend count. Release gates run through `release_gate2.sh`, which is the
   change-impact selection gate (`release_gate2.sh:2`, `:224-234`: `GATE_SELECT_ENABLE=1`), and a targeted `--after` re-run also writes its
   report under the plain name. So the release gate's own reduced-selection report at HEAD satisfies the check: the rule "a green
   nightly or a green FULL gate" is never actually required. `gate_entry.full_run_completed` (`scripts/gate/gate_entry.py:247-258`)
   already encodes "a full run that really ran" and is not reused.
2. With `--tag` (which implies `--require-green`) and no results directory, the check returns `ok: True, warn: True` (`:566-567`).
   Run at the head on the PC: `[WARN] ... NOT_CHECKED`, `RESULT: ready for the owner's approval`, exit 0. Tags are created by the
   lead, not by the runner, so the place where the rule matters is fail-open. The change note documents the PC case, but `--tag`
   promises "required at --tag" (`:599`).

Failure scenario: a train is gated by `release_gate2.sh` with a reduced selection (green), the nightly has been red for a week (the
original TR-03 situation). `release_check.py --tag` on the runner finds the selection report at HEAD and prints "green tier-L report";
on the PC it prints a warning and exit 0. Either way the tag commands are printed.

Fix: (a) count a gate report only when `mode_of(doc) == "full"` and the backend ran (reuse `gate_entry.full_run_completed`), or count
only `nightly/` reports plus full gates; (b) with `require` and no results directory or no git, return `ok: False` unless an explicit
`--green-report <file>` (a copied report) or `--accept-no-green "<reason>"` is given, and print the reason in the checklist.
TR-03 stays PARTIAL until this lands.

### CD-02 (low) - the re-read after a full state queue can store an older state over a newer one

CORE10-EVENTLOOP-2560: when `StateWorker` refuses a frame, `resync_states` (`ha_sync.py:1385-1404`) waits for the queue to drain to half,
sends `get_states`, and on the reply submits `apply_resync` as a control job (`:1402`). `apply_resync` (`:842-850`) calls `store_states`,
which writes every listed state through `upsert_state` unconditionally (`:779-801`, `:368-418`: plain `UPDATE ... SET state = ?,
last_updated = ?`). The comment at `:1401` says every frame queued before the job is older than the listing. That holds for frames read
before the reply, but `ha_client.ws_session` reads the socket with `async for raw in ws` (`ha_client.py:589-609`): buffered frames are
handled back to back without yielding, so frames that Home Assistant sent after the listing (newer states) are handed to the worker
before the `resync_states` task resumes and submits `apply_resync`. They are applied first, then the older listing overwrites them.
Under an overflow (the only trigger) the socket is busy, so buffered frames are likely.

The same overwrite happens on reconnect when `wait_idle(DRAIN_S)` times out (`:1305-1306`): the snapshot is stored while frames of the
previous session are still being applied over it (logged as a warning).

Failure scenario: 20,000 frames back up behind a long database lock; a door contact goes `on` right after HA answered the re-read. The
mirror stores `on`, then the listing's `off`. Screens refetch on the `resync` notice and show `off` until the door's next change or
the next periodic reconcile (default 10 min; never if the owner set the interval to 0).

Fix: apply the re-read through the reconcile rule instead of `store_states` - collect the entity ids `on_event` sees from the moment the
re-read is asked for (the `touched` pattern of `reconcile_now`) and write with `reconcile_states(db, listing, seen, touched)`, which
also compares `last_updated`. A test: a frame newer than the listing delivered between the reply and the job must survive.

### CD-03 (low; new path of the old CORE-05) - legacy-import apply holds the write lock while the archive is compressed

`routers/legacy_migration.py:106` opens a write connection (`connection()` default `mode="write"`, `db.py:1069-1073`: `BEGIN IMMEDIATE`).
`legacy_import.apply` (`legacy_import.py:416-424`) then calls `backup_svc.create(settings, conn, ...)`, which is `prepare` + `write_prepared`
on the same connection (`backup.py:675-678`): the whole archive (plan files, energy / water copies) is deflated with the single write
lock held. CORE-05 moved exactly this out of the manual and daily backups (`routers/backup.py:101-110` uses `unlocked(conn)`;
`create_standalone` reads in a read transaction); only the restore keeps it on purpose.

Failure scenario: on a site with a large plan-file set the import's backup takes longer than the busy timeout; meanwhile HA state
writes (now retried 3 times on the worker, then dropped), recorder alerts and user actions fail with `database_busy`.

Fix: `prepared = backup_svc.prepare(conn, ...)`, `with unlocked(conn): entry = backup_svc.write_prepared(settings, prepared)`, then
re-run `plan()` and compare the digest once more before the guarded UPDATEs (the UPDATEs are already guarded on an empty alias, so a
change in between is harmless).

### CD-04 (low) - rule notifications to HA queue without bound or age limit

`ha_state_worker._DELIVERY` (`ha_state_worker.py:115-145`) is a one-thread `ThreadPoolExecutor` with an unbounded queue. Each job runs
`rules.deliver_pending` (`rules.py:213-236`): a synchronous notify call per service and announcements. When Home Assistant answers
slowly or times out, every fired rule queues behind it; nothing drops or marks a notification that is minutes old, and the counters
(`DELIVERY`) are not in the HA health. Before CORE-10 the same slowness blocked the feed (worse); now it turns into silent lateness: a
"door open" notify can arrive long after the fact. At interpreter exit the executor's thread is joined, so a long queue also delays
the add-on stop until the supervisor kills it (PLAUSIBLE, not run).

Fix: carry the firing time in the job and skip (count, log once) a delivery older than a limit (for example 120 s); cap the queue;
show `DELIVERY` queued / done / skipped in the HA sync health.

### CD-05 (low) - legacy reader: the decompression budget ignores skipped data

`legacy_source._Budget` counts members and the bytes of members it reads (`:131-147`). Members that are not wanted are still
decompressed to be skipped: the outer `tarfile.open(mode="r:*")` walks all members (`:340-346`) and each `extractfile` of an inner
archive seeks backwards in a gzip stream (decompress from the start again, `:366-370`); the inner `r|*` stream decompresses every
member it skips (`:306-318`). A 20 MB upload (`MAX_INPUT_BYTES`) of very compressible data expands to roughly 20 GB per pass. The
endpoint is system-admin only and the dry run needs no confirm word, so the impact is one request thread busy for minutes, not memory.

Fix: count skipped `m.size` in the budget too (a decompressed-bytes cap for the whole walk, for example 2 GB), and refuse a gzip outer
TAR with more than a few inner archives (or read it with `r|*` into a list of wanted members first).

## 3. Re-verification of old findings (area 2)

| Old id | Status at `3739e3ded` | Evidence |
|---|---|---|
| CORE-01 | FIXED | `services/backup.py:733-793` (dependents settled), `routers/backup.py:245`, `routers/backup_offbox.py:601` (rollback on refusal) |
| CORE-02 | FIXED | `services/backup.py:1311-1389` (clock + stored state decide; start delay 600 s) |
| CORE-03 | FIXED (connect window + periodic reconcile); see CD-02 for the new overflow re-read path | `ha_sync.py:1297-1325` held events + `held_event_is_stale`; `reconcile_now` `:1456-1495` with `touched` set before the listing and the repair as a control job behind queued frames (`:1484`) - the ordering is correct |
| CORE-04 | FIXED | `backup.py:375-432` (`_valid_setting_value`, `_drop_invalid_settings` before any delete, `:965`) |
| CORE-05 | FIXED for manual and daily backups; new path not fixed - CD-03 | `routers/backup.py:101-110` (`unlocked`), `backup.py:704-710` |
| CORE-06 | FIXED | `ha_sync.py:235-245` (overflow mark + `dropped_frames`), `routers/ha.py:892` |
| CORE-07 | FIXED (LOWS-BACKEND-2550; not re-read line by line) | change note + attribute trim in `upsert_state` |
| CORE-08 | FIXED | `routers/notifications.py:90` (`<last_at>|<id>` cursor) |
| CORE-09 | FIXED | `backup.py:442-463`, `:945`, `:1054`, `:1259` |
| CORE-10 | FIXED by CORE10-EVENTLOOP-2560 (`2290a0a62`, merged `809326af5`) | `ha_sync.py:1171-1182` reader only queues; `ha_state_worker.py`; residuals CD-02, CD-04 |
| CORE-11 | FIXED | `services/access_tokens.py:163-180` |
| TR-01, TR-02, TR-06, TR-11 | FIXED (2.52; not re-read in depth) | index + engine |
| TR-03 | PARTIAL | green-gate rule added but accepts selection reports and is fail-open on the PC - CD-01 |
| TR-04 | FIXED | `release_check.py:400-470` recomputes `www/build-stamp.json`; at the head: "2135 files, version 2.56.0" ok |
| TR-05 | FIXED | `scripts/gate/gate_entry.py:33`, `lint_backend.py:94`, selftest `selftest_gate_trust.py:73-107` |
| TR-07 | FIXED | `release_gate.py:86`, `:2526-2610`, `gate_baselines.json` floor |
| TR-08 | PARTIAL | no real-HA run, no aarch64 build; `coverage_lane.sh` exists but `nightly_tests.sh` does not call it |
| TR-09 | FIXED | `gate_entry.py:196-330` anchor (ancestor, 20 commits, 36 h, 40 product files; red anchor only on the same branch) |
| TR-10, TR-12, TR-13 | FIXED (LOWS-BRIDGE-GATE-2550; not re-read in depth) | change note |
| TR-14 | FIXED in the repo; the 02:00-local cron line is still an install step on the runner (GATE-NIGHTLY-2560 note, section "Install steps") | `nightly_tests.sh --local-hour` |

Totals for area 2 (25 rows): FIXED 23 (CORE-03, CORE-05 and CORE-10 with new residual findings), PARTIAL 2 (TR-03, TR-08), OPEN 0.

## 4. Improvements (short)

- `_run_on_state_worker` (`ha_sync.py:821-839`): `loop.call_soon_threadsafe` after the job is outside the `try`; on a closed loop
  it raises `RuntimeError` into the worker, which counts a "failed" job and logs a traceback. Wrap it.
- `notify_sensors.on_state(..., STATE.connected)` now reads the flag when the worker applies the frame, not when it arrived; a frame
  drained after a disconnect skips "device unavailable" notices. Pass the flag captured in `queue_event`.
- Legacy import rollback is "restore the `auto-pre-legacy-import` archive", which also rolls back every other change made since. The
  run record already holds the camera ids; an "undo this import" (alias back to empty where it still equals the imported value) would
  be exact.
- `release_check.py` prints `[FAIL] git tag for this version` and still ends "ready" - label it INFO to keep the checklist honest.

## 5. Checked and fine

- State worker: one consumer, FIFO, bounded for frames only, control jobs never refused, `wait_idle` refuses to run on the worker
  itself; `publish` is thread-safe (`queue.Queue` + lock); the debouncer is poked through `call_soon_threadsafe`; held connect-window
  events are queued in order after the snapshot; the reconcile is ordered correctly against queued frames.
- GATE-SETUP-FLAKE-2560 `setup_flake_self_skip`: requires a real self-skip (not "did not run"), every neighbour positively green and at
  least one real pass; a failing or unverified neighbour keeps the failure.
- Migration downgrade check: statement scan + schema diff; ran both a passing and a failing range. Only migration since `v2.52.0` is
  0227 (nullable columns, rollback note). `Database.migrate` applies unknown-to-it versions never and never undoes one.
- PILOT-ROLLBACK-2550: a refused COMMIT is rolled back in `db.release` and answered 507 / `database_busy` through `CommitBeforeSend`;
  clock jumps in coverage gaps use the monotonic length.
- Legacy import: admin gate before the body is read, 20 MB cap while streaming, plan digest re-checked, interactive session + typed
  confirm word, backup before any write, guarded idempotent UPDATE, audit per alias, no secrets kept (passwords / hosts reduced in the
  reader); `audit` on a read connection writes through its side path.
- Backup manual path off the write lock; restore member size caps; settings validation on restore.
- Packaging diff since `v2.52.0`: version lines and one new optional option (`unifiedpush_servers: str?`).

## 6. Not covered

- The ~690 added lines of `release_gate.py` since `v2.52.0` were read only around TR-05 / TR-07 / TR-09 and the setup-flake change;
  `gate2_select.py`, `gate_budget.py` estimates, `coverage_lane.py`, `fixture_lane.sh` and `scripts/fixture_job.py` not read end to end.
- `scripts/migrate_legacy.py` and `scripts/legacy_parity.py` (workstation tools) not read; `legacy_import.plan()` read only for the digest.
- Replay of the table-rebuild migrations against old data, the schedule / automation ops, the e-mail digest path, the Dockerfile layers
  and the aarch64 image: not reviewed. `scripts/wire_route_coverage.py`: read the header only (report-only tool).
- Nothing executed beyond the two scripts named at the top; no test confirms CD-02 (the reasoning is from the code path).
