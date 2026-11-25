# PILOT-ROLLBACK-2550 - safe rollback of an add-on version; pilot disconnection / safety gaps (T035, T036)

Branch `pilot/PILOT-ROLLBACK-2550` from `origin/release/2520-train` @ `91de5c377`. Target 2.55. Software only: no lab, no device, no
Home Assistant, no WisKey, no go2rtc. No UI change, no migration, no setting.

## 1. Gap analysis

Read: the T035 / T036 cards, T068-EDGE-2450 (both passes), T035-OUTAGE-RUN-2405, `docs/operations/*`, `smplwise_vms/DOCS.md`,
`services/backup.py` (pre-upgrade copy, restore), `db.py` (`migrate`), `services/bridge_install.py`, `services/wiskey_auto_install.py`,
`scripts/release_check.py`, `scripts/smoke_after_upgrade.py`, the WisKey bridge-keyset / direct-v2 notes (bridge 0.10.9).

Already there: a pre-upgrade data copy on every version change (also a downgrade), daily copies, restore refusing a newer-schema
backup, a read-only smoke after an upgrade, a short rollback paragraph in DOCS.md, and the outage / soak runs on fakes (HA restart /
unreachable / token revoked, WisKey restarting, NVR and go2rtc down, tunnel drop, disk full on a STATEMENT, add-on restart mid-write).

Missing, built here:
1. Nothing checked that the previous version can run on the newer database (the only rollback that keeps data). -> section 2.
2. No owner runbook (data kept / lost, bridge, WisKey, verification). -> `docs/operations/PILOT_ROLLBACK_RUNBOOK_HE.md` (Hebrew,
   English appendix with the gap table, the 2.48 -> 2.52 run, bridge / WisKey details).
3. A full disk at COMMIT - where a real full volume fails a WAL database - was never tested: it answered a bare 500. -> section 3.
4. Wall-clock jumps were never tested: two silent-"ok" defects. -> section 3.

## 2. Downgrade-safety check of migrations

`scripts/migration_downgrade_check.py`: for two versions A -> B (git refs or the working tree), the migrations B added (`migrations/`
and `migrations_energy/`), each classified backward-compatible or not, from two independent looks - the statements (comments removed,
split with `sqlite3.complete_statement`, so a trigger body stays whole) and the schema before / after the file in an in-memory SQLite
built from A's migrations (a table of A that vanished or lost a column is caught even when the statement scan misses it). Rules in the
script's docstring and in the runbook appendix B. A not-compatible migration needs `Rollback: ...` (20+ characters) in a comment of
the file, else FAIL; a shipped migration changed beyond comments, removed or renumbered also FAILS. A new column on a table that A's
code fills positionally (`INSERT INTO t VALUES` without a column list) is not compatible (A's source is scanned).

`scripts/release_check.py`: new check "migrations downgrade-safe since the previous release" (previous `vX.Y.Z` tag below the
version -> the tree; skipped with a note when there is no git / no earlier tag). The hunk sits apart from GATE-HARDEN-2520's
release_check changes (docstring and bundle check untouched).

Run over 2.48 -> 2.52 (`--chain v2.48.0,v2.49.0,v2.50.0,v2.51.0,HEAD`, HEAD = 91de5c377): **PASS** - 10 migrations (0217-0226), all
backward-compatible; per-file table in the runbook appendix C. Control run v2.30.0 -> v2.40.0: FAIL as expected - 0196 (two triggers on
`wiskey_relay_map`, no note), 0186 / 0204 flagged but carry notes.

## 3. Product fixes (each with a test that fails on the base code)

| # | Defect | Fix | Test |
|---|---|---|---|
| P1 | Disk full at COMMIT: the request's commit runs in `CommitBeforeSend` as the answer starts, outside the exception handlers, so a write that was NOT stored answered `internal_error` 500 (the operator read "unexpected error"). | `CommitBeforeSend` answers a refused commit with the same envelope as a refusal inside the handler: 507 `storage_full` (or `database_busy`), correlation header kept; `main.db_refusal_response` shared with the handler (no behaviour change there). | `test_p1_...` |
| P2 | The refused transaction stayed open until the request's connection closed, where `connection()` committed again: with space freed in between, a change reported as failed was stored. | `db.release` rolls back at once on a refused COMMIT and hands the gate on. | `test_p2_...` |
| C1 | NTP moving the clock back while the NVR stream is down: `down_for` negative -> the top bar's "NVR disconnected" disappeared (silent ok). | `IngestState.disconnected_since` also records the monotonic instant; `outage_s()`; the summary uses it. | `test_c1_...` |
| C2/C3 | Same for coverage gaps (ISAPI, Frigate, Provision): a clock moved back dropped a long outage's gap; moved forward, a 10 s blip became an hour-long gap. | `events_ingest.gap_window` / `close_gap(outage_s=)`: threshold and span from the monotonic length when the clocks disagree by > 5 s (one log line); otherwise exactly the old wall-clock span. | `test_c2_...`, `test_c3_...` |
| C4 | `media_reach`: a clock moved back pushed the next probe an hour away - a "reachable" video service went unchecked (silent ok); `down_for_s` could be negative. | `due()` also when the schedule is further ahead than any it sets; `down_for_s` >= 0. | `test_c4_...` |

`disconnected_since` stays the wall stamp (tests and the gap's start use it); `ha_sync` already used the monotonic clock.

## 4. Tests

Workstation (Windows 11, Python 3.12, `C:\cloude\smplwisebms\.venv`, one file per process, `pytest -o addopts= -p no:cacheprovider`):

| Command | Exit | Result |
|---|---|---|
| `tests/test_pilot_safety_2550.py` on the BASE code (product files from 91de5c377, tests from this branch) | 1 | 6 failed (P1 500 internal_error; P2 not rolled back; C1 nvr item missing; C2/C3 `close_gap` has no `outage_s`; C4 not due) |
| `tests/test_pilot_safety_2550.py` | 0 | 6 passed |
| `tests/test_migration_downgrade_check.py` | 0 | 28 passed |
| `tests/test_health_summary.py` | 0 | 1 passed |
| `tests/test_commit_release_limiter.py` | 0 | 2 passed |
| `scripts/migration_downgrade_check.py --chain v2.48.0,v2.49.0,v2.50.0,v2.51.0,HEAD` | 0 | PASS (5 steps) |
| `scripts/migration_downgrade_check.py --from v2.30.0 --to v2.40.0` | 1 | FAIL as expected (0196) |
| `scripts/release_check.py` | 0 | ready; new check "v2.51.0 -> this tree: 2 migration(s) added, 2 backward-compatible, 0 not" |

Runner (slot B, `~/work/p2520_pilotrb_run.sh`): RUNNER_RESULTS_PENDING

Not run: AT069 / AT070 / AT071 / AT072 on the real equipment (lab and owner); a real rollback on the lab (hard limit of this row);
frontend checks (no frontend change).

## 5. Observations (not changed here)

1. **The update screen's rollback text points at the wrong copy.** `frontend/src/api/system-update-runs.ts` GUIDE_ARX_COPY: "reinstall
   the previous version and restore the LAST file named auto-pre-upgrade". Starting the previous version writes a new auto-pre-upgrade
   copy (`before upgrade 2.52.0 -> 2.51.0`, the newer version's data), so "the last" is that one, not the pre-update data. The runbook
   says to pick by the note. UI text change, so not done here (question 1).
2. **CHANGELOG 2.52.0 (train draft) says "No new migration"** under Install, but the train adds 0225 and 0226 (both
   backward-compatible). For the lead's final release text.
3. A commit refused for a request with TWO connections (rare: a read plus a write) may have committed the first; the answer is still
   the refusal. Not seen in the routes; not changed.
4. Clock jumps elsewhere (by reading, not changed): ages computed from stored wall-clock ISO stamps (`health_report._age_s`: heartbeat,
   bridge directory, backups) read as "fresh" for as long as a clock moved back; a device action's pending -> unknown window and a
   door envelope's expiry are wall-clock (a forward jump refuses / marks unknown early - safe; a backward one only delays "unknown";
   a resubmitted command is still refused by its id). No false success found.
5. After a rollback and a later re-upgrade, rows the newer version wrote in its own tables come back as of the rollback (runbook D).

## 6. Rollback of this row

Revert the commits: the release check loses its new line, the commit-time refusal is a 500 again, outages are measured on the wall
clock again. No data, migration or setting.

## 7. Open questions (recommendation first)

1. Rollback text on the update screen (observation 1): a) fix the text in a small UI row ("restore the auto-pre-upgrade copy whose note
   reads `<previous> -> <new>`"), with its baseline (recommended) b) leave it; the runbook covers it.
2. Rollback route from the store: a) the lead publishes a "revert" release (previous code, newer number, migration files kept) when a
   pilot rollback is needed, and the platform backup restore stays the first choice (recommended) b) document only the platform backup.
3. The new release-check line: a) blocking, as built (recommended) b) a warning only.
