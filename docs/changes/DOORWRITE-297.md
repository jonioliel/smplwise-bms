# DOORWRITE-297 - writing the door-window program from Arx to WisKey (board r129)

Branch `pilot/DOORWRITE-297`, cut from `pilot/SPLITSWITCH-297`. Builds the program-write path of CR-039 4.3 end to end against fakes.
Nothing was sent to a WisKey, a station or a door. `PROGRAM_ENGINE_BUILT` and `EMERGENCY_ENGINE_BUILT` stay **False**; emergency
buttons are untouched (owner's fire-safety review and WisKey's written confirmation pending).

## The contract used (no guessing)

The three Native commands are known (R: rc.37 extraction; registered in WisKey CODE e732562e; already wired by WISKEY-OWNER26-297 in
`services/wiskey_program_direct.py`):

| step | command | body |
| --- | --- | --- |
| read | `stations/technical_program_list` | `{station_id}` -> `{programs: [{door, revision, enabled, removing, policy, execution{owned, status}}], ...}` |
| save | `stations/technical_program_save` | `{station_id, door, revision, policy, enabled}` (compare-and-set on `revision`, 0 = new) |
| pause | `stations/technical_program_action` | `{station_id, door, revision, action: "pause"}` (bumps `revision`) |

`policy = {timezone, schedule: {name, weekly{Monday..Sunday: [{start,end}]}, holidays[{name,start,end,periods}]}}`. An enabled program
must be paused before an edit (`hold_pause_before_edit`); there is no resume (save-and-activate). The pinned catalog accepts no extra
keys (no `request_id` until U2), so idempotency is Arx's: read first, compare, write only on difference, never a blind second save.

## What was built

| Piece | Where |
| --- | --- |
| Compose the weekly program from the Arx schedule (unchanged compiler, one program per door) | `services/door_windows.py` `compile_door` (existing), `_compose` (new: the compose step factored out of `sync`) |
| Validate before anything is sent: WisKey's policy shape (R), Arx name prefix, catalog size cap (64 KiB) | `services/door_window_program.py` `validate_policy` -> outcome `invalid`, nothing sent |
| Write through the adapter: read -> (pause if enabled) -> save -> **read-back proof** (the save listing, else one fresh read) | `door_windows._write_program` -> outcome `written` only when proven, else `readback_mismatch` |
| Idempotent and versioned | unchanged documents are never re-sent (canonical comparison `canonical_sha`); `program_version` +1 per proven write; `program_revision` = WisKey's CAS revision |
| Drift detection | a door believed written is re-read at most every 15 min (`DRIFT_CHECK_S`); `missing / disabled / changed / foreign` -> state `drift`, audit `door.window.program_drift`, future occurrences back to `planned`. **Never corrected automatically**: a person may have paused the door on purpose in the intercom window |
| Failure and retry | `error` / `readback_mismatch` -> `retry_wait` with a growing wait (60 s, 2, 5, 15, 30 min), then `failed` (waits for a person or a new document). `not_permitted` / `not_implemented` -> `failed` at once. Every retry starts with a read |
| Close direction always wins | a door whose desired program becomes "none" (switch off, rules removed) is read and paused even in `drift` / `retry_wait` / `failed` |
| Operator messages (Hebrew, no codes) | `door_window_program.message_he`; `GET /doors/windows/state` -> each door has `program: {state, message, version, verified_at, drift_kind, attempts, next_attempt_at, revision}` |
| Dry run / preview | `GET /doors/windows/doors/{station}/{relay}/program/preview` (`access.windows.manage` on the door): the program, validity, what the engine holds (one READ, only in tier B), `action` (`write / unchanged / pause / nothing / foreign / held / blocked / invalid / prepared / unreadable`), `two_writes` (pause first), `in_window` (the door is held open now: it closes and re-opens within ~15 s). Writes nothing |
| "Write again" | `POST /doors/windows/doors/{station}/{relay}/program/apply {confirmed: true, expect_sha?}` (`.manage`, identified person): clears the door's drift / failed / wait and writes that door now; `expect_sha` refuses a stale preview (`preview_stale`); refused in tier D (`prepared`) and with windows off. A foreign program stays untouched |
| Audit (ids and codes only) | `door.window.engine_write` details: tier, outcome, code, revision, sha prefix, version, write_state, attempts. `door.window.program_drift`, `door.window.program_apply` (with the person). No policy text, no names, no times |

Write states (`door_window_engine.write_state`): `idle, written, verified, retry_wait, failed, drift, foreign, blocked, invalid, prepared`.

## Migration / rollback

- `0181_door_window_program_write.sql` - built as provisional 0180 (0179 was the highest on its base); renumbered to 0181 at the 2.24.1
  integration (release/2241), after EXTERNALBUILD-297's `0180_external_codes_visitors.sql`.
  Additive: seven columns on `door_window_engine` (`write_state, write_attempts, next_attempt_at, verified_at, drift_at, drift_kind,
  program_version`). One owner for the DB change: this branch.
- Rollback = run the previous version (it never reads the columns). Dropping them is optional.

## Tests (fakes only)

`smplwise_vms/backend/tests/test_doorwrite_297.py`: pure rules (validation, canonical comparison, drift kinds, retry bound, Hebrew
messages, shipped flags) and the product path through the LIVE seam classes (`WiskeyProgramEngine` -> `DirectProgramEngine` ->
`DirectProgramPort` -> a stub direct connection over the W0 `FakeProgramEngine`): verified versioned write, no second write, pause-then-save
on edit, ids-only audit, read-back mismatch, retry -> failed -> write again, new document after failed, unknown save settled by a read,
revision conflict, drift (paused / changed) never auto-corrected, switch-off pauses even in drift, foreign never overwritten, invalid not
sent, dry run writes nothing, in-window warning, permissions, stale preview, tier D refusal.

## Not done here (by design)

- No activation: `PROGRAM_ENGINE_BUILT` stays False; turning it on is the owner's decision (after the lab write below).
- No UI for the preview / "write again" buttons yet (the API and the per-door `program` block are ready; screen work is a separate slice).
- The single internal-door lab write is prepared, not run: `docs/integrations/wiskey/RUNBOOK_DOORWRITE_FIRST_LAB_WRITE.md`.

## Open questions for WisKey / the owner

1. Does WisKey list the program's `policy` back exactly as saved (key order aside)? Arx compares a canonical form, so reordering is fine,
   but a normalisation of times (e.g. `24:00`) or names would read as drift. Needs one real read-back in the lab write.
2. The cap on date exceptions per program (Arx assumes 100, W?) and the real error code for an unreachable station on save (U7 / W13 h).
3. Drift policy: keep "never correct automatically" (a person presses "write again"), or re-write automatically when the drift is
   `changed` but the program is still enabled?
