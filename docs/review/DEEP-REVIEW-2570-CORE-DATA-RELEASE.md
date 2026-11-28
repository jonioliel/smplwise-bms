# DEEP-REVIEW-2570-CORE-DATA-RELEASE - second deep review pass, area 2 (id prefix `CD2`)

Reviewed tree: `v2.56.0` = `6ea807b2e` (read-only detached worktree). Scope: the "Not covered" list (section 6) of
`docs/review/DEEP-REVIEW-2560-CORE-DATA-RELEASE.md` (branch `origin/review/DEEP-2560-CORE-DATA-RELEASE`). The 2.56 findings CD-01..CD-05
are not repeated (CD-02, CD-03 and CD-04 are already fixed in `6ea807b2e`: `apply_resync` with the `touched` set, the legacy-import
backup outside the lock, the bounded / aged delivery queue).

Method: code read end to end on the paths named per finding; small read-only checks on the workstation (pure-Python calls of the gate
helpers, `legacy_parity.py check`, `migration_downgrade_check.py --chain`, a migration replay script in a scratch directory); the
area's tests, the gate selftests, the coverage lane and one scratch confirmation test on the runner (slot B, `~/work/p2570r_cd`, job
scripts `p2570r_cd_*`). The schedule / automation operations and the e-mail digest path were read by a helper reviewer
(read-only, same tree); its findings were spot-checked against the code before they were taken in (each says so).

## 1. Summary

| Id | Severity | State | Title | file:line (at `6ea807b2e`) |
|---|---|---|---|---|
| CD2-01 | high | CONFIRMED | A targeted `--after` re-run never re-selects the tests of a crashed / timed-out backend shard or Playwright chunk, and the red run still counts as its coverage anchor: the gate goes green while those tests never ran | `scripts/gate/gate_entry.py:247-259`, `scripts/gate/gate2_select.py:291-311`, `scripts/gate/release_gate.py:742-762`, `:1514-1534` |
| CD2-02 | high | CONFIRMED (Arx side; HA effect PLAUSIBLE) | Applying a scene checks nothing for an alarm-panel member (no `alarm.disarm` grant, no control check, no confirmation) | `services/automation_scope.py:332-337`, `:387-390`, `:500-502`; `services/automation_ops.py:1127-1158` |
| CD2-03 | medium | CONFIRMED | An all-skipped Playwright process counts as a pass; the fixture lane (no count baseline) and an unreadable `fixture_specs.json` can turn green with the fixture tests not run | `scripts/gate/release_gate.py:1526-1528`, `:204-216`, `:176-182`, `:2758-2797`, `:3015-3016` |
| CD2-04 | medium | CONFIRMED (helper, spot-checked) | Copying or restoring an automation makes it live at once and skips the enable confirmation and the self-trigger single-run rule | `services/automation_ops.py:736-742`, `:858-868` (vs `:966-975`) |
| CD2-05 | medium | CONFIRMED (helper, spot-checked) | A schedule / automation operation left `pending` (crash between begin and settle) is never settled and silences the "changed outside Arx" audit for good | `services/schedules.py:466-472`, `:846-850`; `services/automations.py:404-410` |
| CD2-06 | medium | CONFIRMED | E-mail deliveries left `queued` across a restart are never sent and never marked failed | `services/notify_email.py:676-688` (vs `notify_whatsapp.py:775-787`) |
| CD2-07 | medium | CONFIRMED | Home Assistant trace calls (up to 6 WebSocket round trips) run inside the request's write transaction | `routers/automations.py:512-515`, `services/automation_runs.py:58-80`, `:184-201` |
| CD2-08 | medium | PLAUSIBLE | The aarch64 image has never been built; the Dockerfile's default base image is the amd64 one, which newer Supervisors read from the Dockerfile | `smplwise_vms/Dockerfile:1-2`, `smplwise_vms/build.yaml` |
| CD2-09 | low | CONFIRMED (runner) | The coverage lane starts recording after `conftest.py` has imported the whole app: module-level lines never count, "modules no test imported" is wrong | `scripts/gate/coverage_lane.py:81-88` |
| CD2-10 | low | CONFIRMED | `fixture_job.py --gate` with no gate spec in scope prints `FIXTURE_PASS` and exits 0 with nothing run | `scripts/fixture_job.py:255-285` |
| CD2-11 | low | CONFIRMED (helper) | Copy / split / restore of a disabled schedule: a failed disable is silent | `services/schedule_ops.py:928-935`, `:1042`, `:1146-1150` |
| CD2-12 | low | CONFIRMED (helper) | E-mail `recover_orphans` can overwrite a mail that was just sent with `failed` (unconditional UPDATE) | `services/notify_email.py:683-687` |
| CD2-13 | low | CONFIRMED (helper) | A crashing e-mail job leaves its rows in `retry` and in `_LIVE` for good | `services/notify_email.py:741-742`, `:780-835` |
| CD2-14 | low | CONFIRMED (helper, spot-checked) | The e-mail rate limit counts notifications, not mails (up to 10 recipients each) | `services/notify_email.py:1028-1034` |
| CD2-15 | low | CONFIRMED (helper, spot-checked) | Planned monthly-report sends still leave after the delivery was switched off (only the report switch is re-checked) | `services/insights_delivery.py:476-480` |
| CD2-16 | low | CONFIRMED (helper, spot-checked) | Saving schedule folders: a folder without a position is a 500; a scoped manager deletes folders installation-wide | `services/schedule_ops.py:1328-1340` |
| CD2-17 | low | PLAUSIBLE (helper) | The SMTP test works as a LAN port-probe oracle and has no overall deadline | `services/notify_email.py:175-187` |
| CD2-18 | low | CONFIRMED (helper) | The weekly access digest counts a fixed 7 x 24 h window across a DST change | `services/access_external.py` (weekly digest window) |
| CD2-19 | low | CONFIRMED (helper, spot-checked) | A refused run-now (no switch) still blocks the next run-now for 10 s | `services/schedule_ops.py:803-810` |
| CD2-20 | low | CONFIRMED | Migration 0215 rewrites rows of an existing table without a rollback note: a rollback to 2.43.0 or older is not judged | `migrations/0215_home_v3_categories.sql` |
| CD2-21 | low | CONFIRMED | `migrate_legacy.py --apply-aliases` stops mid-way on the first HTTP error with no report of what it already wrote; `--nvr-utc-offset-minutes` defaults to a fixed 120 | `scripts/migrate_legacy.py:192-201`, `:393`, `:422-426` |
| CD2-22 | low | CONFIRMED (runner test) | CD-02's second path is still open: when the connect snapshot's drain times out, an older queued frame of the previous session overwrites the newer snapshot | `services/ha_sync.py:1310-1314`, `:710` |

Paths under `services/`, `routers/` and `migrations/` are relative to `smplwise_vms/backend/smplwise/`.
Counts: critical 0, high 2, medium 6, low 14.

## 2. Findings

### CD2-01 (high) - the targeted re-run trusts coverage that a red run never had

Path, read end to end:

1. A backend shard that times out, crashes, exits with rc not 0/1, runs zero tests or ends rc=1 without a parsed failure is recorded
   as ONE item `("backend", "shard <k>", "FAIL", ...)` (`release_gate.py:742`, `:751`, `:756`, `:759`, `:762`). The same holds for
   Playwright process failures: `"<label>: no report"`, `"<label>: timeout"`, `"<label>: zero tests"`, `"<label>: exit code"`
   (`release_gate.py:1514-1534`; `<label>` is a chunk such as `preview_desktop_c2`). The tests of that shard / chunk that never ran
   have no item of their own.
2. `gate2_verdict.classify` puts these items under "Test failures" (category `backend` / `preview` is in `TEST_CATS`), so the
   summary's next step is the targeted `release_gate2.sh <b> --after <this report>`, not a full re-gate (`gate2_verdict.py:107-113`,
   `:179-187`).
3. The coverage anchor (`gate_entry.anchor_check`, TR-09) accepts that same red report: `full_run_completed` only rejects `gate` and
   `baseline` failures and a zero backend pass count (`gate_entry.py:247-259`); a red full run of the same branch qualifies
   (`:291-293`).
4. The `--after` selection adds only the files it can parse from item ids: `tests/test_x.py...` and `x.spec.ts...`
   (`gate2_select.py:291-311`). `shard 3` and `preview_desktop_c2: timeout` match neither, so nothing of that shard / chunk is
   selected; the rest of the run is the diff since the red sha plus the core.

Executed on the workstation (`gate_entry.full_run_completed` and `gate2_select.failed_files` on a synthetic red report with a
`shard 3` timeout, a `preview_desktop_c2: timeout` and one real test failure): `(True, 'complete')` and
`{'backend': {'test_x.py'}, 'frontend': set(), ...}` - the anchor is accepted and the two process-level failures select nothing.

Second path (PLAUSIBLE, not executed): when such an item is quarantined (a match on the label), `gate2_verdict` returns 10 and the
automatic re-run uses `rerun_only_selection` (`gate2_select.py:371-384`) - again no file for it. With no backend file and no spec
selected, `backend_only` returns an empty set (`release_gate.py:1072-1078`), no shard starts and no Playwright job runs, so the re-run
has no failure and its verdict is `pass` (`compute_verdict`, `:2799`).

Failure scenario: the release gate's shard 3 hits the runner's memory limit and is killed after 40 % of its files (`no pytest
summary`); one Playwright test also failed. The lead fixes that test and runs the printed `--after` command. The re-run selects the
fixed spec, the diff and the core, and is green. The release is tagged although ~60 % of shard 3's files (hundreds of backend
tests) ran in neither run.

Fix: (a) `failed_files` must map a process-level item to the files that process owned - write the shard's file list and each
Playwright chunk's spec list into the report (`backend_shards` already has the plan; add `files`) and select them whole; (b)
`full_run_completed` must reject a run with a process-level failure (`shard <k>` / `<label>: no report|timeout|zero tests|exit code`)
as an anchor unless (a) is in place; (c) a re-run that selects nothing for a failure it is meant to re-check is `FAIL`, not pass.
Regression tests: a red report with a `shard` item must select that shard's files and must not be an anchor on its own.

### CD2-02 (high) - scene apply skips every check on an alarm-panel member

`facts_of` turns only `lock.*` members of a scene into sensitive steps (`automation_scope.py:332-337`); `sensitive_classes` for a
scene is `["lock"]` or nothing (`:387-390`). `run_reasons("scene", ...)` (`:556-563`) runs `control_reasons` over the targets, which
skips every `alarm_control_panel.*` entity on purpose ("armed / disarmed under its own grants", `:500-502`), and `grant_reasons` over
the steps, which hold no alarm step. `apply_scene` (`automation_ops.py:1127-1158`) then asks for confirmation only when
`facts["sensitive"]` or unknown effects - false for a scene of lights plus a panel. Door-class covers and sirens in a scene are also
not sensitive (control only). Arx's own scene editor refuses panel members (`automation_model.py:1439`, helper), so this concerns
scenes made in Home Assistant (`source != "integration"` path). The bridge's `apply_scene` checks only the scene entity for an
HA-user principal (helper read, `custom_components/smplwise_bridge/config_service.py:187-207`).

Failure scenario: a user allowed to control the lobby lights applies an HA scene that also holds `alarm_control_panel.house:
disarmed`. No `alarm.disarm` grant, no remote-disarm block, no confirmation. Whether HA then disarms depends on the panel needing a
code (PLAUSIBLE; HA's alarm reproduce-state passes no code).

Fix: in `facts_of` for scenes, add a step per `alarm_control_panel` member (`alarm_disarm` / `alarm_arm_*` from the member state,
`sens: "alarm"`) and per door-class cover / siren member, so `grant_reasons`, `_remote_block` and the confirmation apply exactly as for
a manual action; refuse apply when a member's domain is outside the capturable set and the caller lacks wide `automation.manage`.

### CD2-03 (medium) - "a process that runs nothing is not a pass" does not cover all-skipped processes

`settle` fails a process only when its report has no rows at all (`release_gate.py:1526-1528`); skipped rows are rows. Executed on
the workstation (`release_gate.settle` with three `skipped` rows, rc 0): counts `fixture: pass 0, skipped 3`, no item,
`compute_verdict` = `pass`.

Where this lets a green through:
- The fixture lane (`fixture_lane_run`, `:2758-2797`) has no count baseline (`:3015-3016`) and its own header promises "at least one
  ran per Playwright process" (`fixture_lane.sh` header). A group whose `pw_env` is wrong (the specs skip on `SW_LIVE !== '1'` or a
  missing fixture variable) is green with zero tests run. `scripts/fixture_job.py` judges the same case as `FAIL (nothing ran)`
  (`fixture_job.py:163-172`); the engine does not.
- A new fixture group in a full gate: its all-skipped specs add nothing, the `fixture` baseline (0.85 of the reference) is not
  touched, the gate is green.
- `fixture_groups()` (`:204-216`) and the module-level `FIXTURE_SPECS` load (`:176-182`) fall back silently to the built-in three
  `devices` specs when the branch's `fixture_specs.json` does not parse; in the fixture lane that is a green lane of the wrong groups.
  (A change to that file forces the full frontend side of a selection gate - `KEEP_FULL_FRONTEND` `frontend/tests/fixtures/` - so a
  full gate's fixture baseline would catch it; the lane would not.)

Fix: in `settle`, a process whose rows are all `skipped` (and not `norun`) is `FAIL ... zero tests ran` unless its label is on an
explicit allow list; in the fixture lane, a group with zero passed tests is a failure; an unreadable `fixture_specs.json` is a hard
failure in the fixture lane and a warning item in the gate.

### CD2-04 (medium) - automation copy / restore go live without the enable checks

`copy_item` and `restore_trash` call `_write_new(w, kind, id, j, True, ...)` with `enabled=True` (`automation_ops.py:742`, `:864`) and
raise the judgement with `confirm=True` themselves (`:741`, `:864`); the client's `confirm` on restore is not used. The enable path
asks for confirmation on a risky item (`:975`) and runs `door_run_guard.judge_enable_item` (`:971`); create / update force the
single-run mode for a self-triggering automation (helper: `:562-564`), copy / restore do not.

Failure scenario: a disabled "unlock on arrival" automation (or one with unknown effects) is copied or restored from the trash; the
new item is live at once, with no confirmation and no review entry. (The door-path guard of `judge` still runs.)

Fix: write the copy / restored item with the source's enabled state (or disabled, as schedules do), honour `confirm`, apply the
self-trigger rule on both paths.

### CD2-05 (medium) - a `pending` operation is never settled

`begin_op` commits the op row before the bridge call (`unlocked`). A process death during the call, or a non-`ApiError` after it,
leaves it `pending`. Nothing settles it: the janitor deletes only non-pending ops (`schedules.py:850`), and
`_arx_create_in_flight` matches `status = 'pending'` with no age limit (`:466-472`), so every later schedule created outside Arx is
taken for Arx's own and never audited `changed_outside`. Same pattern in `automations.py:404-410` (`_recent_arx_op`). A client retry
with the same key gets a retryable `op_pending` forever (helper).

Fix: settle `pending` ops older than a few minutes as `unknown` in the janitor (then prune them), and apply the time cutoff to the
`pending` branch of both checks.

### CD2-06 (medium) - queued e-mail deliveries are lost on a restart

Rows are inserted `queued`; the batch lives in the worker's in-memory queue. `recover_orphans` (`notify_email.py:676-688`) only looks
at `status = 'retry'`, so after a restart (an add-on update) or a crash of `_run_batch` the rows stay `queued` for good: never sent,
never `failed`, invisible in the failures panel. The WhatsApp channel covers `('queued', 'retry')` with a conditional UPDATE
(`notify_whatsapp.py:775-787`).

Fix: the WhatsApp query and conditional UPDATE (`WHERE id = ? AND status IN ('queued','retry')`), which also closes CD2-12.

### CD2-07 (medium) - trace calls under the write lock

`GET /automations/{kind}/{id}/runs` takes `get_conn` - the request's write transaction (`auth.py:145-155`, `routers/automations.py:512-515`)
- and `runs_list` makes `trace/list` plus up to five `trace/get` WebSocket calls inside it (`automation_runs.py:58-80`, through
`_prefetch_details`). `check_item` does the same inside `db.connection()` in write mode after every `automation_triggered` of an
automation with an approved notify step (`:184-201`). Each call may take up to its 10 s timeout: up to about a minute with the single
write lock held; meanwhile HA state writes (retried three times, then dropped), alerts and user actions fail with `database_busy`.
This is the CORE-05 pattern on a new path.

Fix: make the trace calls before opening the write connection (or inside `unlocked(conn)`), then store; use a read connection for
the GET route and write the cache through the side path.

### CD2-08 (medium, PLAUSIBLE) - the aarch64 image

`ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base-python:3.12-alpine3.22` is the Dockerfile default; `build.yaml` maps aarch64 to the
aarch64 image. `docs/changes/SUPERVISOR-BUILD-GATE-2341.md` records that "Supervisors from 2026.04 read the Dockerfile, older ones
build.yaml". If such a Supervisor does not pass `BUILD_FROM` per architecture, an aarch64 host builds `FROM` the amd64 image and the
first `RUN apk` fails (exec format error), so the add-on cannot be installed on aarch64. No aarch64 build has ever run
(`addon_build_check.sh` builds amd64 only; TR-08 open). Not proven either way here (no Supervisor, read-only).

Fix: build the aarch64 image once on the runner (`docker buildx --platform linux/arm64` with qemu) and add it to the nightly; make
the base image architecture-neutral (a multi-arch base tag, or `ARG BUILD_ARCH` in the image name) so the default is right on both.
Layers otherwise fine: requirements and constraints are copied and installed before the code (cache), `downloads/` read-only,
apk packages unpinned and the base tag floating on purpose (T005 audit).

### CD2-09 (low) - the coverage lane misses everything imported before `pytest_configure`

The recorder starts in `pytest_configure` (`coverage_lane.py:81-88`). Pytest loads the initial `conftest.py` before
`pytest_configure`, and `tests/conftest.py` imports `smplwise.main` (`create_app`) at module level (conftest `:49-55`), i.e. the whole
application. Module-level lines (imports, `def`, `class`, constants) of every module imported that way never count, so the total is
understated and a module whose functions no test calls is reported "never imported" although it was. Runner (section 3): with
`tests/test_version.py`, `main.py` and `config.py` - both imported by conftest - are listed as "modules no test imported"; 0 of the 39
module-level statements of `main.py` were recorded.
Report-only lane; it misleads the TR-08 work.

Fix: start the recorder when the plugin module is imported (`-p coverage_lane` imports it before conftest loading) or in
`pytest_load_initial_conftests` with `tryfirst=True`.

### CD2-10 (low) - `fixture_job.py --gate` can pass with nothing run

With `--gate`, groups without a gate spec are dropped (`fixture_job.py:255-257`). A named spec that is not a gate spec is refused
(`unknown`, exit 2), but with no names and no gate spec left (a branch whose JSON lost its `"gate": true` flags) `todo` is empty,
`ok` stays `True` (`:272`) and the job prints `FIXTURE_PASS` and exits 0 although nothing ran. Fix: no group run = exit 1
(`FIXTURE: nothing to run`).

### CD2-11 .. CD2-19 (low) - schedule / automation / e-mail details (helper reviewer, spot-checked where marked)

- CD2-11: `schedule_ops.py:928-932` (`except ApiError: pass`), `:935`, `:1042`, `:1146-1150`: on copy / split / restore of a disabled
  schedule, a failed disable is dropped silently (create reports `not_disabled`); the item is briefly enabled between `add` and
  `disable` on every path. Fix: return the warning; create disabled in the `add` where the component allows it.
- CD2-12: `notify_email.py:683-687`: `recover_orphans` reads `retry` rows, then checks `_LIVE`; a retry that finishes in between is
  overwritten `failed/unavailable` with a `delivery_failed` event. Fix: conditional UPDATE (CD2-06).
- CD2-13: `notify_email.py:741-742`, `:780-835`: a job that raises after `_HELD` was cleared leaves its rows `retry` and in `_LIVE`;
  `_job_failed` only logs. Fix: drop the job's ids from `_LIVE` (or mark them failed) in `_job_failed`.
- CD2-14 (spot-checked): `notify_email.py:1028-1034`: `GATE.allow()` takes one slot per notification, each going to up to 10
  addresses - up to 60 mails a minute against a documented 6.
- CD2-15 (spot-checked): `insights_delivery.py:476-480` re-checks only the report switch, not the delivery's enabled / channel
  settings: planned sends (retry up to ~15 min, WhatsApp held until send hours) still go out after delivery was turned off.
- CD2-16 (spot-checked): `schedule_ops.py:1331`: `int(f.get("position", i))` with `position: None` from `model_dump` is a 500;
  `:1338-1340`: a manager scoped to one area deletes / renames folders installation-wide and clears `folder_id` of schedules they
  cannot see. Fix: `i` when the position is None; limit folder deletion to folders that hold only visible schedules, or require
  installation-wide manage.
- CD2-17 (PLAUSIBLE): `notify_email.py:175-187`: an admin with `notify.manage` can point SMTP at any LAN host / port and read
  `dns` / `connect` / `tls` / `refused` back (a port probe); `refused_host` checks the literal text, so a name resolving to 127.0.0.1
  passes; `send_test` has no overall deadline (~10 s per step per recipient). Fix: resolve and re-check the address at send time; one
  overall deadline.
- CD2-18: the weekly access digest (`access_external.py`) counts a fixed 7 x 24 h UTC window ending at a local wall-clock time: in a
  DST week one hour is counted twice or missed. Fix: compute both ends as local instants (IANA zone) and convert.
- CD2-19 (spot-checked): `schedule_ops.py:803-810`: `_LAST_RUN` is set before the `switch.` check and `_slot_time`; a 422 there
  blocks the next run-now for 10 s with `run_too_soon`. Fix: set it after the checks.

### CD2-20 (low) - 0215 has no rollback note

`migration_downgrade_check.py --chain` over every release from `v2.43.0` to `v2.56.0` (run on the workstation): every single step
passes except `v2.43.0 -> v2.43.9`, which FAILS on `0215_home_v3_categories.sql` ("rewrites rows of home_interface_policy, a table
older code reads", no rollback note); every range that starts at `v2.43.0` fails for the same reason. The check was introduced in 2.55
after 0215 shipped, so nothing went red at the time. A rollback to 2.43.0 or older meets new category ids in `modules_json`
unjudged. Fix: add a `-- Rollback:` comment to 0215 (comment-only, allowed by the checker) stating what the older home screen does
with the new ids, or record that rollbacks below 2.43.9 are unsupported.

### CD2-21 (low) - `migrate_legacy.py` workstation tool

`apply_aliases` (`:192-201`) PATCHes one camera after the other with no error handling: the first 4xx / 5xx raises `HTTPError`, the
script ends with a traceback, the report (and the list of aliases already written) is never printed or saved, and there is no backup
step (the docstring already prefers the in-product apply). `--nvr-utc-offset-minutes` defaults to a fixed 120 (`:393`): a report made
in summer describes the legacy "auto" offset wrongly (the in-product `legacy_import.standard_offset_minutes` derives it from the zone).
Fix: catch per camera, record `failed` rows, always write the report; derive the default from `Asia/Jerusalem` like the product.

### CD2-22 (low) - CD-02's second path (reconnect drain timeout)

CD-02's re-read path is fixed in `6ea807b2e` (`apply_resync` with `last_updated` compare and the `touched` set). The second path the
2.56 review named is not: on a new session, `wait_idle(DRAIN_S)` may time out (`ha_sync.py:1312-1313`, logged as a warning), then
`store_states` writes the snapshot from an executor thread (`:1314`) while the state worker still applies the previous session's
frames through `on_state_changed` (`:710`), which writes unconditionally. A frame older than the snapshot then lands after it.

Confirmed on the runner with a scratch test (not committed; `tests/test_p2570r_cd02b.py` in the runner worktree only): `DRAIN_S` set
to 0.2 s, the worker held by a blocking job with the previous session's frame (`binary_sensor` `off`, 10:01) queued behind it, the
fake HA listing the same entity `on` (10:05). Inside the session the mirror reads `on` (snapshot stored after the timeout); after the
worker is released it reads `off`. Result: `1 passed` - the older frame overwrote the newer snapshot.

Fix: store the connect snapshot through the same rule as the re-read (`reconcile_states` / `apply_resync` with `last_updated`), or
submit it as a control job on the worker (behind the old frames) instead of writing it from an executor thread when the drain
timed out.

## 3. Tests run and their results

Workstation (read-only, Python 3.12):
- `gate_entry.full_run_completed` + `gate2_select.failed_files` on a synthetic red report (CD2-01): `(True, 'complete')`,
  `{'backend': {'test_x.py'}, 'frontend': set(), 'visual': set()}` - confirms CD2-01.
- `release_gate.settle("fixture", <3 skipped rows>, rc 0)` (CD2-03): `pass 0, skipped 3`, no item, verdict `pass` - confirms CD2-03.
- `scripts/legacy_parity.py check`: C1-C8 PASS (C7 ran, not skipped).
- `scripts/migration_downgrade_check.py --chain v2.43.0,v2.43.9,v2.44.0,...,v2.56.0`: every step PASS except v2.43.0 -> v2.43.9
  (0215, CD2-20); 0217-0227 compatible with notes.
- Migration replay (scratch script, not committed): an in-memory SQLite (3.49.1), every migration 0001-0227 applied in order the way
  `Database.migrate` does (foreign keys ON, `executescript` with BEGIN / COMMIT); before each migration every empty table got two
  synthetic rows (CHECK values from the table SQL, foreign keys pointed at existing parent rows); after it the row count of every
  table that still exists was compared. Result: 227 migrations applied, 418 tables, **no row lost, no error, no foreign-key
  violation at the end**; 354 tables held rows during the replay, 64 never could be filled by the generic filler (multi-column CHECK
  constraints or parents it could not build; among them `ticket_links`).
- Targeted replay of the three rebuilds whose parent is referenced `ON DELETE CASCADE` (scratch script: migrations up to N-1, one
  hand-built parent row with its own parents and one row in every child, then migration N with foreign keys ON): `0087` (ticket_links
  + 5 children), `0117` (ticket_cost_claims + 3 children), `0186` (backup_offbox_targets + 2 children): every count before = after
  (1 row each); nothing cascaded.
- Static check of the table rebuilds: the 17 rebuild migrations and 0186; only three parents are referenced `ON DELETE CASCADE`
  (`ticket_links` 0087, `ticket_cost_claims` 0117, `backup_offbox_targets` 0186) and all three copy the children aside before the
  DROP; the other rebuilt tables are referenced by no foreign key.

Runner (`~/work/p2570r_cd` at `6ea807b2e`, slot B, one pytest process per group, `-o addopts= -q -p no:cacheprovider`):

| Group | Files | Result |
|---|---|---|
| gate | test_gate2_select, test_gate_speed, test_select_tests, test_gate_hygiene, test_gate_always_run, test_gate_addon_build, test_gate_tablet_allowlist, test_gate_visual_block_t074 | 274 passed |
| release | test_release_check, test_release_check_green_2560, test_nightly_lightening_2560, test_nightly_local_hour_2550, test_coverage_lane_2550, test_fixture_job, test_wire_route_coverage_2460 | 51 passed |
| migr | test_migrations, test_migrations_263_upgrade, test_migration_downgrade_check, test_switch_protection_migration, test_tickets_migration, test_tickets_template_migration, test_vendorq_294_migration, test_wiskey_s5_migration_upgrade | 59 passed |
| legacy | test_migrate_legacy, test_legacy_import_2550, test_legacy_parity_t070, test_backup, test_core_reliability_2540_backup, test_secfix_daily_backup_2520 | 50 passed |
| hasync | test_ha_sync_1000, test_core10_eventloop_2560, test_ha_state_reconcile_2550, test_ha_state_shapes | 28 passed |
| gate selftests (run by no gate or nightly) | selftest_engine_sync, selftest_entry_check, selftest_fe_static, selftest_gate_fast, selftest_gate, selftest_gate_speed_2550, selftest_gate_trust | all 7 PASS |
| CD2-22 scratch test | tests/test_p2570r_cd02b.py (runner worktree only) | 1 passed (= the bug is real) |
| coverage lane (CD2-09) | `coverage_lane.sh --shards 1 --no-selftests tests/test_version.py` | `main.py`: 0 of 39 module-level statements recorded; `main.py` and `config.py` (both imported by conftest) listed under "Modules no test imported"; 1 passed |

Assertion strength (sampled): the area's tests assert behaviour, but three gaps let this review's findings through -
`test_fixture_job.py::test_the_gate_falls_back_to_the_devices_group_without_the_json` pins the silent fallback of CD2-03 as intended;
`test_judge_refuses_all_skipped_and_failures` covers only `fixture_job.judge`, never the engine's `settle` (CD2-03);
`test_coverage_lane_2550.py` drives `Recorder` directly, never through pytest's plugin order (CD2-09). No test feeds a
process-level failure (`shard <k>`, `<label>: timeout`) to `failed_files` / `full_run_completed` (CD2-01).
NOT_RUN: Playwright, the fixture lane itself, a real gate, any aarch64 build, any lab / HA / NVR / go2rtc / WisKey contact.

## 4. Checked and fine

- `release_gate.py` since `v2.52.0` (read in full as a diff): the per-category thresholds and the green-full-run reference baseline
  (selection reports, lanes and side records excluded; newest run wins per category, the tracked file stays the floor; a reference
  read error leaves the floor in force with a warning); `setup_flake_self_skip` (re-read, as in 2.56); fixture groups and `then`
  stages (backend start / seed / preview failures are counted, processes reaped in `finally`, the backend restarted on the same port
  only after the old one is gone); heavy-unit split (every (file, project) still runs exactly once); pixel chunks keep a global
  index so log names stay unique; CPU sampling never changes a verdict; crashed pool jobs are failures (`:2229-2230`, `:2795-2796`).
- `release_gate2.sh`: engine drift refusal, the lint lane on the worktree under test, the anchor record removed before each run, the
  earlier report of the same sha kept aside; a missing `--after` file (moved aside on a same-sha re-run) makes the selection raise,
  which the engine turns into the full tier (fail-safe).
- `gate_budget.py`: limit = max(derived cap, estimate x 1.25 x load factor), never below the estimate; explicit limit wins; history
  only from passed tier-L reports of the same mode.
- `gate2_select.py` (rest): hub attribution, migration / roles / i18n narrowing, the core lists, pixel rules, deferral never on a
  full side; `nightly_health` red on any non-pass verdict.
- `coverage_lane.sh`: never fails a run, broken shards listed; `wire_route_coverage.py`: report-only; the oracle records the route
  template (`endpoint_ctx["path"]`), so keys match; `--static` only reads test files.
- `legacy_import.plan()`: read-only, digest binds source sha + every write with target and value; apply re-plans after the backup
  (CD-03 fix) and writes only empty aliases. `legacy_parity.py`: offline, C7 is SKIPPED (never PASS) when the backend cannot be
  imported. `migrate_legacy.py --backup/--export` uses Arx's own reader; no secret printed.
- E-mail headers / HTML escaping, SMTP TLS rules, digest hold / re-check, monthly-report idempotency and DST handling, schedule write
  authorization (role and scope, sensitive grants, creator alarm code verified then dropped, WisKey door guards on every path), run-now
  (confirmation, per-item gap, no resend, honest "sent"), unknown domains read-only (helper reviewer; list in its notes).
- Dockerfile layering and run.sh (no secrets printed, crash guard as PID child).

## 5. Still not covered

- The legacy source (`legacy/hikvision_nvr_v1.5.27/`) is not in this tree: the `untilIso` format of manual-recording rows
  (`legacy_import._manual` compares it as a string with a UTC `Z` stamp) could not be checked against it.
- The generic migration replay could not fill 64 of 418 tables (multi-column CHECK constraints); apart from the three cascade
  rebuilds replayed by hand, rebuilds touching those tables were checked statically only. No replay on a real old installation database (none is in the repository or the fixtures).
- The aarch64 image was not built (read-only scope) - CD2-08 stays PLAUSIBLE.
- Schedule model validation (`schedule_model.validate_draft` / `to_component_payload`), `automation_model` / `automation_policy` /
  `automation_ext` in depth, the alarm-code verification internals, the other `smtp_send` users (tickets), DST behaviour of the HA
  Scheduler component itself (it fires the schedules; Arx only previews).
- The second CD2-01 path (quarantined process-level failure -> empty re-run -> pass) was not executed end to end.
- The helper reviewer's findings CD2-11, CD2-12, CD2-13, CD2-17, CD2-18 were not re-read line by line here.
- `gate_entry.decide` / `tagcheck`, `nightly_tests.sh`, `engine_sync.py`, `gate_quarantine.py` beyond what the findings needed.
