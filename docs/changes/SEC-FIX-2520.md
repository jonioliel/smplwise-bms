# SEC-FIX-2520 - security and backup fixes from the 2.52 deep review

Branch `pilot/SEC-FIX-2520`, base `origin/release/2520-train` (f343f829b). Sources:
`docs/review/DEEP-REVIEW-2520-SECURITY.md` (origin/review/DEEP-2520-SECURITY, ca9b98d68) findings SEC-1, SEC-2, SEC-3, and - added
by the lead as a scope extension, because this row owns `services/backup.py` this round - `docs/review/DEEP-REVIEW-2520-BACKEND-CORE.md`
(origin/review/DEEP-2520-BACKEND-CORE, 1a7662f79) findings CORE-01, CORE-02, CORE-04. No other finding is touched. Backend only; no
UI change (no pixel baselines, no compare page). No lab, no device, no Home Assistant.

Each finding is its own commit with a test file that fails before the fix and passes after (checked by stashing the source change).

## SEC-1 (high) - wrong inline codes on the conditional once-actions never reached the lockout

With step-up on, a wrong code in `X-Arx-Second-Factor` on a `system_admin` binding or a restore was counted by
`second_factor.verify` on the request's transaction, and `step_up._refuse` then rolled that transaction back: no lockout, unlimited
guessing. `_refuse` now counts the wrong code again on the fresh transaction after its rollback (`_recount_wrong_code`): the same
`FAILURES` rule, limits (5 in 5 minutes, 10-minute lock) and audit (`auth.step_up.failed`, reason `step_up_invalid` /
`step_up_locked`) as every other wrong-code path. A lockout already running is left as it is (never re-counted into an unlock); an
unreadable secret is not a guess and is not counted.

Files: `services/step_up.py`. Test: `tests/test_secfix_stepup_lockout_2520.py`.

## SEC-2 (medium) - key attestation accepted a chain extended below a genuine key certificate

Both verifiers walked issuer name + signature only. One shared rule, `device_attestation.ca_path_problem`, now runs in the phone-key
verifier (`device_key_attestation.verify_chain`) and the app refresh token's verifier (`AndroidKeyAttestationVerifier`) over the path
up to the trust anchor: every certificate above the leaf has BasicConstraints `cA=TRUE`, `keyCertSign` when a KeyUsage is present, a
pathLenConstraint the intermediates below it keep; only the leaf carries the KeyDescription. New refusal reasons: `chain_not_ca`,
`chain_path_length`, `key_description_above_leaf`.

Files: `services/device_attestation.py`, `services/device_key_attestation.py`; `tests/test_app_refresh_attestation_232.py` (its generated
root / intermediate now carry `cA=TRUE` like real ones). Test: `tests/test_secfix_attest_chain_2520.py`.

## SEC-3 (medium) - a restore reverted the remote sign-in policy

Kept now (never exported, never restored): `security.second_factor_policy`, `security.second_factor_bearer`, `remote.policy`,
`remote.require_mfa_admin`, `remote.admins_default`, `remote.csp_enforce`, `remote.session`, `remote.idle_lock_minutes`,
`security.local_session`, `security.local_admin_session_days`, `security.local_password_min`, `security.local_lock_mode`,
`security.local_link_ttl_h`, `security.building_reach`. The 2.52 keys (`security.passkey_remote_factor`,
`security.factor_reset_channel`, the step-up keys) were already kept.

Fail closed for the future: every `security.*` / `remote.*` key is kept unless named in the new `SETTINGS_TRAVEL`
(`remote.default_profile`, `remote.wall_profile`, `remote.max_live_streams`, `remote.mse_fallback` - stream preferences). A ratchet
test scans DEFAULTS, every literal key of a settings read / write and every `*KEY*` constant and fails for a key of the families that is
in neither list. The replace restore's settings delete now uses the same `_kept_setting` rule. Restore drill: an archive written by an
OLDER build that carries a key kept since then is a warning (the restore ignores it), and the settings row count no longer expects it.

Files: `services/backup.py`, `services/backup_drill.py`. Test: `tests/test_secfix_restore_settings_2520.py`.

## CORE-04 (medium) - restored settings were neither validated nor fully kept

- Every archive settings row passes the checks of a normal settings write: the PATCH /settings model (type, pattern, enum, range) for a
  key it knows - the stored text, or its JSON for an object / list / number - and an integer for INT_KEYS; an empty value reads as the
  default. An invalid value is skipped, the installation keeps its current value (replace does not delete it), the answer names the keys
  (`settings_invalid`, additive; counted in `skipped_unsafe.settings`), and the `backup.restore` / `backup.offbox.restore` audit rows
  carry them. A key the PATCH model does not know (a module's own setting, written by its own route) is taken as before.
- `access.station_*` joins the fail-closed families; `access.station_listen`, `access.station_media`, `..._media_max_talk_s`,
  `..._media_provider` and `audit.retention_days` are kept.
- `settings_store.read_settings` / `setting_value` read a damaged integer row as its default.

Files: `services/backup.py`, `services/settings_store.py`, `routers/backup.py`, `routers/backup_offbox.py`, `wire/backup.py`,
`frontend/src/api/generated/wire-backup.ts` (regenerated). Test: `tests/test_secfix_restore_validate_2520.py`.

## CORE-01 (high) - a replace restore failed on any installation with a maintenance file

- `backup.restore_dependents` derives from the schema (PRAGMA foreign_key_list, transitively) every table outside the restore's list
  whose rows point into it - no hand-kept table name (today `maint_files`).
- A replace restore defers foreign keys for its transaction; at the end `_settle_dependents` removes the dependent rows whose parent
  did not come back (reported as `dependents_dropped`, answer + additive wire field + both audit rows). A row of the archive itself
  pointing at a missing parent refuses the restore, as the immediate check did; violations the database already had are left alone.
- Both restore routes map `ValueError` and `sqlite3.IntegrityError` to 409 `restore_refused` and roll the request's writes back first
  (an ApiError commits).
- The restore drill repeats the restore onto a read-only snapshot copy of the live database (sqlite backup API; skipped with a warning
  without a live database or disk space for two copies) and fails when that restore is refused or adds a foreign-key violation.

Files: `services/backup.py`, `services/backup_drill.py`, `routers/backup.py`, `routers/backup_offbox.py`, `wire/backup.py`,
`frontend/src/api/generated/wire-backup.ts`. Test: `tests/test_secfix_restore_fk_2520.py`.

## CORE-02 (medium) - the daily backup never ran on an installation that restarts daily

The stored record `backup.daily.state` (last run, its archive, the archive last handed to the off-box copies; kept - runtime state).
`daily_tick` decides by the clock: a copy when the last one is a day old (or none), then the off-box copies; the off-box copies of the
newest daily archive when a restart came between the two; a failure notifies, does not move the record and is retried at the next look.
Without a record the newest `auto-daily` archive's own time is used (an upgrade neither skips a day nor adds a copy). `daily_loop` looks
10 minutes after start-up, then when the next copy falls due, at the latest hourly. `main.py` is unchanged (same call).

Behaviour change to note: a fresh installation writes its first automatic copy 10 minutes after the first start (before: a day later).

Files: `services/backup.py`. Test: `tests/test_secfix_daily_backup_2520.py` (fake clock).

## Tests

PC (Windows, `C:\cloude\smplwisebms\.venv` Python, one pytest file per process):

| Command | Exit | Result |
|---|---|---|
| `pytest -q tests/test_secfix_stepup_lockout_2520.py` | 0 | 3 passed (before the fix: 3 failed) |
| `pytest -q tests/test_secfix_attest_chain_2520.py` | 0 | 6 passed (before: 5 failed, 1 passed - the valid chain) |
| `pytest -q tests/test_app_refresh_attestation_232.py` | 0 | 16 passed |
| `pytest -q tests/test_mfa_devicekey_attest_2490.py` | 0 | 23 passed |
| `pytest -q tests/test_secfix_restore_settings_2520.py` | 0 | 21 passed (before: 14 failed) |
| `pytest -q tests/test_secfix_restore_validate_2520.py` | 0 | 9 passed (before: 9 failed) |
| `pytest -q tests/test_secfix_restore_fk_2520.py` | 0 | 8 passed (before: 8 failed) |
| `pytest -q tests/test_secfix_daily_backup_2520.py` | 0 | 6 passed (before: 6 failed) |
| `pytest -q tests/test_backup_drill.py` | 0 | 13 passed (after the drill-status wire fix; before it: 1 failed, strict wire check) |
| `pytest -q tests/test_backup.py` | 0 | 8 passed |
| `pytest -q tests/test_mfa_reset_hardening_2510.py` | 0 | 22 passed |
| `pytest -q tests/test_notify_sources.py` | 0 | 37 passed (call updated: `start_delay_s=0`) |
| `pytest -q tests/test_offbox_api.py` | 0 | 9 passed (call updated: `start_delay_s=0`) |
| `python scripts/gen_wire_types.py` | 0 | `wire-backup.ts` regenerated |

Runner (`~/work/p2520_secfix_run.sh` through `~/work/slotb.sh`, worktree at 631c062a3, one pytest process per file with `-x`, two
lanes): the 168 test files that touch backup / restore / step-up / second factor / attestation / settings / wire. 164 files exit 0
(4429 tests passed, 1 skipped, counted from the progress lines). The other four:

- `tests/test_notify_sources.py`, `tests/test_offbox_api.py` - each called `daily_loop(interval_s=0)` and expected an immediate run;
  CORE-02 adds the start-up delay, so both calls now pass `start_delay_s=0` (re-run on the PC: both pass, table above).
- `tests/test_offbox_sftp.py` - exit 5 (pytest collected no runnable test on the runner); not related to this row. NOT_RUN in effect.
- `tests/test_t06_admission_295.py::test_the_only_modules_that_reach_a_signing_call_are_the_known_ones` - fails on
  `wiskey_schedule_reads.py` (added to the train by WISKEY-SCHED-READS-2520, 56d0d3290); not touched by this row - for the train lead.

Not run: the full backend suite, Playwright, lint of the whole tree (ruff on the changed files: only pre-existing F811 fixture
warnings in `test_app_refresh_attestation_232.py`).

Process note: during the before/after checks this row used `git stash push -- <paths>` / `pop` in its own worktree (the stash list is
shared between worktrees); the final tree and every commit were re-verified to hold only this row's files.

## Open questions

1. SEC-2 pathLen: Google's real chains are expected to keep RFC 5280; a device whose chain does not would now be `failed`
   (`chain_path_length`) instead of `hardware`. (a) keep the strict rule, watch the lab phones' verdicts - recommended; (b) enforce
   only cA / keyCertSign.
2. CORE-02: a fresh installation now writes its first daily copy 10 minutes after the first start. (a) keep - recommended; (b) wait a
   day as before for a fresh installation only.
3. SEC-3 travel list: only the four stream preferences of `remote.*` travel with an archive. (a) keep - recommended; (b) also let the
   Arx-only identities' password minimum travel when it is stricter than the current one.
