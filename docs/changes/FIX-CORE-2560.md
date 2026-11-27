# FIX-CORE-2560 (2.56 final review, area core / data / release)

Findings CD-01..CD-04 of docs/review/DEEP-REVIEW-2560-CORE-DATA-RELEASE.md. CD-05 is not in this row.

- CD-01 `scripts/release_check.py`: the green-before-tag check counts only a FULL tier-L report that ran the backend (no
  `selection.reduced`, `counts.backend.pass > 0`; same test as `gate_budget.mode_of` / `gate_entry.full_run_completed`). With
  `--tag` / `--require-green` and no results directory (or no git) it now FAILS, unless `--accept-no-results "<reason>"` is given;
  the reason is printed in the checklist line (warning, not silent).
- CD-02 `services/ha_sync.py`: `apply_resync` (re-read after a state-queue overflow) goes through `reconcile_states` (only states HA
  reports as newer than the stored one are written) and skips ids in `touched` (frames seen from before the listing was asked for).
  Not changed: the reconnect snapshot when `wait_idle(DRAIN_S)` times out (second path named in the review) - open, see report.
- CD-03 `services/legacy_import.py`: the safety backup is `prepare` under the lock, `write_prepared` inside `unlocked(conn)`, then the
  plan digest is compared again (409 `legacy_plan_changed` when it moved). The `backup=` test seam keeps the old behaviour.
- CD-04 `services/ha_state_worker.py`: rule delivery to HA is bounded (`DELIVERY_MAX_QUEUE` = 200) and age-limited
  (`DELIVERY_MAX_AGE_S` = 120 s). Dropped / stale deliveries are counted in `DELIVERY` (`dropped_full`, `skipped_old`) and logged
  (first and every 50th); the notifier thread is still woken, so in-app / push rows are unaffected. Surfacing the counters in the HA
  health payload is not done (additive API, left for a later row).

Tests (each fails before, passes after): tests/test_release_check_green_2560.py (5 new or changed), tests/test_core10_eventloop_2560.py
(5 new), tests/test_legacy_import_2550.py (2 new; the backup-failure test now patches `write_prepared`).
Before the fix: 12 of the new/changed tests FAILED. After: see the report of the row. NOT_RUN: runner / full backend suite, ruff
(not installed on the PC).
