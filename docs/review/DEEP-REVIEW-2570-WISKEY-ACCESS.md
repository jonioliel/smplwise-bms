# DEEP-REVIEW-2570 - area 3 `WISKEY-ACCESS`, second pass (id prefix `WA2`)

Reviewed source: `v2.56.0` = `6ea807b2e` (read-only detached worktree). Brief: second deep review pass of 2.57 - the ground the 2.56
pass listed as "Not covered" in `docs/review/DEEP-REVIEW-2560-WISKEY-ACCESS.md` (branch `origin/review/DEEP-2560-WISKEY-ACCESS`).
Its findings (WA-01..03) and its "Checked and fine" ground were not re-read and are not repeated here.

Method: reading only on the PC (no product code edited); the area's backend tests and one confirmation probe ran on the runner
(slot B, job scripts `p2570r_wa_*`). Nothing was run against WisKey, Home Assistant, a station, go2rtc or the lab; `secrets/` and
`private-evidence/` were not read. The scope is about 3 MB of Python: the entry points, write paths and every authorization /
physical-action path of the files in section 4 were read end to end; the rest was sampled - section 5 says exactly what was not read.

## 1. Summary

| id | severity | status | title | file:line |
|---|---|---|---|---|
| WA2-01 | high | CONFIRMED (probe) | Emergency RELEASE over the direct engine is authorized for, and attributed to, the person who STARTED the incident - not the person releasing it | `smplwise_vms/backend/smplwise/services/wiskey_emergency_direct.py:80-94` |
| WA2-02 | medium | CONFIRMED (reading) | Managed WisKey install: any unexpected error after Home Assistant Core was stopped leaves Core stopped - no start attempt, and the start-up recovery skips the run | `smplwise_vms/backend/smplwise/services/wiskey_managed_install.py:968-977, 798-804, 1025-1032, 879, 1112` |
| WA2-03 | low | CONFIRMED (reading), narrow timing | People-write lineage: the start-up recovery can run while a first write is in flight; a verified refusal / not-sent of that write then raises `invalid_transition` and is reported as unknown | `services/wiskey_direct_join.py:739-772`, `services/wiskey_write_lineage.py:512-513, 501-503`, `services/wiskey_native_write.py:543-551` |
| WA2-04 | low | PLAUSIBLE | People-write lineage: an error between `admit` and the first settle (the anchor write on the main database) leaves the row `intent`; the person's native writes are refused `person_write_in_flight` until the process restarts | `services/wiskey_write_lineage.py:460`, `services/wiskey_native_write.py:489-495` |
| WA2-05 | low (latent) | CONFIRMED (reading) | Service-write journal: an UNKNOWN row holds its person for ever - no product caller of the status read, no operator close, never pruned. Not reachable in 2.56 (the writer has no journal connection yet) - fix before it is wired | `services/wiskey_service_write.py:502-507, 603-604, 687-721` |
| WA2-06 | low | CONFIRMED | A test assertion that cannot fail (`... or True`) | `smplwise_vms/backend/tests/test_intercom_capture_lease.py:174` |

Counts: critical 0, high 1, medium 1, low 4.

## 2. Findings

### WA2-01 (high, CONFIRMED by probe) Emergency release runs as the starter, not the releaser

`services/wiskey_emergency_direct.py:80-94`, `incident_context` - the default (and only installed) context resolver of
`DirectEmergencyEngine` (`wiskey_direct_join.py:728-736` constructs the engine without another one; `door_engine_live.LiveEmergencyEngine`
delegates to it):

```
client_id = request_id.split(":", 1)[0]
row = conn.execute("SELECT requested_by, actor_kind FROM door_emergency_incidents WHERE request_id=? OR release_request_id=? OR release_request_id=?", ...)
user = conn.execute("SELECT id, username, display_name FROM users WHERE id=?", (row[0],))
```

The dispatcher sends a release as `engine.release(kind, station, relay, f"{release_request_id or request_id}:r:{station}:{relay}")`
(`services/door_emergency.py:688`). The row is found by `release_request_id`, but the actor is always `requested_by` - the person who
STARTED the incident. The table has `released_by` (`migrations/0137_door_windows_emergency.sql:135`, written by
`door_emergency.release`, `door_emergency.py:516`), and it is never read here. (The third `release_request_id=?` of the query is a
copy of the second; it looks like a column was meant there.)

What follows from it, in `_attempt` (`:227-262`):
- `fx.human_actor(starter)` is the actor on the wire and `resolve_policy(conn, (starter,), ...)` is the policy snapshot: WisKey's
  ledger records the starter as the person who released, and the release is judged by the STARTER's current permissions.
- If the starter no longer holds `door/emergency_release` + `door/restore` on the door's station (their role was reduced, the account
  was deactivated, or deleted - then `Unauthorized`), every door of the release answers `refused` (`permission_missing` /
  `Unauthorized`) and nothing is sent. Arx already authorized the real releaser (`door_emergency.release` checks the releaser's
  permission) and moved the incident to `releasing`, so the operator sees a failed release although they are fully entitled.

Failure scenario: operator A holds every door of a building open (by mistake or on purpose). The administrator removes A's emergency
permission (or disables A's account - the natural first reaction) and presses "release". All doors answer refused; the building stays
open. The only ways out are WisKey's own screen or giving A the permission back. And in the ordinary case (A still entitled) the
release works but is recorded on WisKey's side as A's action although B did it.

Probe (runner, fake database only, not committed): an incident with `requested_by = joni`, `released_by = dana`,
`release_request_id = rel-1`; `incident_context(conn, "rel-1:r:st-a:1")` returns joni. Result in section 3.

The same resolver is right for an apply (and the worker's bounded OPEN retry): there the request id is the incident's `request_id`.

Fix: decide by which column matched - when the id is the incident's `release_request_id` (the dispatcher's `:r:` form), resolve
`released_by` (refuse `Unauthorized` when it is null); otherwise `requested_by`. Add `active` to the user lookup (as
`wiskey_auto_door._principal` does with `has_active_account`). Tests: a release by a second person while the starter has no permission
(must be sent, actor = releaser), and a release whose releaser lost the permission between the Arx check and the send (refused).
Existing tests cover only the apply form (`tests/test_wkcap_295.py:557-567`) or inject their own context
(`tests/test_t06_admission_295.py:840-850`), which is why this passed.

### WA2-02 (medium, CONFIRMED by reading) Managed install: a crash while Core is stopped leaves Core stopped

`services/wiskey_managed_install.py`. `run()` stops Home Assistant Core (`_Run.stop_core`, `:827-836`), takes the private backup,
swaps the component tree and starts Core again. Between the stop and the start it handles exactly three things: `StepFailed`,
`OSError` (and `ValueError` only around the private backup). Anything else propagates to the worker body (`:968-977`):

```
except Exception as exc:  # never leave the record "running"
    if job.get("state") == "running":
        job.update(state="failed", code="run_crashed", ...); _job_update(db, job)
finally:
    _RUN_LOCK.release()
```

No `start_core`, no restore. And `recover_interrupted` (`:1108-1113`), the start-up recovery, acts only on a job whose state is still
`running` - a job marked `failed / run_crashed` is skipped. So Core stays down until somebody starts it from the Supervisor side; the
owner cannot even reach Arx through ingress while Core is down.

What can raise something else while Core is stopped:
- every step bookkeeping call: `step()` / `done()` / `fail()` write the job record through `_write_json` -> `db.write_aside`
  (`:163-167, 798-804`), which raises `sqlite3.OperationalError` on a busy or full database. There are about ten such writes inside
  the stopped section, the first one being `self.done()` at `:836`, right after the stop was confirmed;
- the concrete case: the disk fills during `private_backup` (it copies the component and the registry files into the add-on's data
  directory, the same disk as the database). The `OSError` is caught at `:1028-1032`, but the next line is `r.fail("backup_failed")`
  -> a database write on the full disk -> `sqlite3` error -> `r.start_core()` on the following line is never reached. The preflight
  space check (`:755-760`) measures the HA config directory against three times the bundle size; the private backup's own size (the
  registry files) and the data directory are not part of it;
- `_swap` (`:879`): `tree_digest(candidate)` raises `ValueError` (`wiskey_distribution_digest.files`) and only the second digest check
  of that function is inside a `try`.

Fix: after a confirmed stop, wrap the rest of `run()` in one `try / except BaseException` that (1) puts the previous tree back when
the target is missing or is not the expected tree, (2) always attempts `start_core`, (3) only then records the outcome; make the step
bookkeeping best-effort inside the stopped section (log and continue); let `recover_interrupted` also act on `failed / run_crashed`
when a `stop_core` step is recorded without a later successful start; include the data directory in the space check. Test: a platform
double whose database write fails after `stop_core` - Core must be asked to start.

### WA2-03 (low, CONFIRMED by reading; narrow timing) Recovery during an in-flight first write

`wiskey_direct_join.py:755-772` `recover_now` runs on its own thread when a join comes up (`wiskey_join_live.py:271`): it reads the
source, then `writer.recover(scope)` turns EVERY `sending` row of the scope into `unknown` - without looking at `_recovered`. A people
write that arrives in the same moment passes `_ensure_recovered` (`:739-753`), is admitted and is `sending` when `recover_now`'s
`recover` runs. Its row becomes `unknown` (`recovered_after_send`). When WisKey then answers:
- a verified ACK: `mark_committed` allows `unknown` - fine;
- a verified pre-effect refusal: `_failed` -> `mark_refused` (`wiskey_write_lineage.py:512-513`, allowed only from `sending`) raises
  `LineageError("invalid_transition")`; the same for a proven not-sent (`mark_not_sent`, `:501-503`). The error is not a
  `NativeWriteError`, so `people_send` does not map it; the feed reports the write as unknown and the person is held for a readback,
  although WisKey verifiably refused it. The lineage row stays an open unknown that only an administrator can close.

Nothing is sent twice and nothing is reported as done, hence low. Related: `_ensure_recovered` returns as soon as ANY scope was
recovered (`if self._recovered: return`, `:743`), so a second scope (a re-pair to another repository) is never recovered in this
process.

Fix: `recover_now` takes the same check-and-mark as `_ensure_recovered` (skip when the scope is already in `_recovered`, mark before
the first write can be admitted); allow `mark_refused` / `mark_not_sent` from `unknown` when the proof is a verified answer of the
same operation (a fact about the original, like `mark_committed`); check `scope in self._recovered` in the fast path.

### WA2-04 (low, PLAUSIBLE) A stuck `intent` row blocks the person until restart

`wiskey_write_lineage.py:425-461` `admit` commits the intent row and then writes the anchor on the main database through
`SettingsAnchor.write` (`:146-153`: a raw `sqlite3.connect` with a 10 s busy timeout, outside the application's write gate). If that
write fails (`sqlite3.OperationalError`: the main database's write lock held for more than 10 s, or a full disk), the exception is not
a `LineageError`; `NativePeopleWriter.write` (`wiskey_native_write.py:489-495`) does not catch it. The row is committed in state
`intent` and nothing settles it: the partial unique index `one_inflight_per_person` then refuses every later native write to that
person (`person_write_in_flight`) until the next process start (`recover` runs once per process). Nothing was sent, but the feed
reports the failed call as unknown. The same holds for any unexpected error between `admit` and `begin_send`.

Fix: in `admit`, catch `sqlite3.Error` from the anchor write and settle the row `not_sent` before raising a `LineageError`
(the anchor then reads "main behind", which the open path already treats conservatively); in `write` / `rename`, a
`try / except BaseException` around the section between `admit` and `begin_send` that marks the row `not_sent`.

### WA2-05 (low, latent - CONFIRMED by reading) Service-write journal: an UNKNOWN holds its person for ever

`wiskey_service_write.py`: an UNKNOWN row of `users/update` / `users/temporary_cancel` holds every later service write to that person
(`holds_person`, `:502-507`; refusal `service_write_unsettled`, `:603-604`). The only way a row leaves UNKNOWN is a status read that
answers `completed` (`status`, `:687-704`). But (1) no product code calls `status()` or `settle_unknown()` (`:714` is marked test-only;
the only user of the module outside itself is `access_service_writer.writer_for`), (2) a write WisKey never committed answers UNKNOWN
for ever ("a missing record is never never_committed"), (3) UNKNOWN rows are never pruned (`prune`, `:467-486`) and there is no
operator close (the people lineage has `close_unknown`; this journal has none). One lost answer would therefore block the grant
engine's updates of that person permanently - including the update that ends a person's access - and each such row also takes one of
the 4096 journal places for good.

Not reachable in 2.56: `access_service_writer.py:250-255` says neither `FinalServiceWriter` has a journal connection in production
yet, so `available()` is false. It becomes live the moment the journal is wired. Fix before that: a periodic `settle_unknown` (the
janitor), an administrator close with audit (as the lineage has), and an age rule for UNKNOWN rows that a fresh read of the person
has reconciled (the shared people gate already demands that read).

### WA2-06 (low, CONFIRMED) A test assertion that cannot fail

`tests/test_intercom_capture_lease.py:174`:
`assert start(w).status_code == 409 or True  # the station's reservation was released (no hold for a refusal)`.
The comment's claim (a refused lease start releases the station's reservation) is not checked by anything. Fix: assert the real
expectation (the second start is admitted or refused for a reason other than `intercom_capture_station_busy`).

An AST scan of the area's 153 test files (2,660 test functions) found only three more functions without an assertion, all acceptable
smoke checks (a leak scan helper that asserts inside, a "does not raise" check, a schema validation that raises on mismatch); seven
`pytest.raises(Exception)` blocks each check the code or status right after.

## 3. Tests run (runner, v2.56.0 at `6ea807b2e`, one pytest process per file, `SW_WIRE_STRICT=1`)

Job scripts on the runner: `~/work/p2570r_wa_be.sh` (first run, stopped by me after 49 files - see below), `~/work/p2570r_wa_be4.sh`
(the probe + the prioritized files of the ground this pass read). Real results only.

| what | files | result |
|---|---|---|
| Area files of the first run (`test_access_control_wire`, `test_asgi_wiskey_295`, `test_bridge_install*` x2, `test_capture_lease_*` x5, `test_fake_wiskey*` x2, `test_intercom*` x13 incl. `test_intercom.py` 184 and `test_intercom_messaging.py` 127, `test_mac_managed_auto_policy`) | 25 | 809 passed, 0 failed |
| Prioritized run: `test_wkwrite_295`, `test_wkwrite_295_crash`, `test_wkjoin_295`, `test_wkr5_295*` x5, `test_wkcap_295`, `test_wkcapwire_295`, `test_wkdirect_295`, `test_wk4adopt_295`, `test_adoptr6_295`, `test_t06_admission_295`, `test_wiskeya06_297`, `test_wiskey_managed_install_2382` (73), `test_wiskey_native_bundle_2272`, `test_wiskey_installer_*` x4, `test_wiskey_mac_adopt_298*` x2, `test_wiskey_owner26_callers_297`, `test_wiskey_relay_map_*` x3, `test_wiskey_pairing_*` x2, `test_wiskey_station_ops`, `test_wiskey_round3`, `test_wiskey_join_live_2382`, `test_wiskey_direct_v2_2520`, `test_wiskey_service_grant*` x2, `test_door_emergency*` x3 | 38 | 1,123 passed, 3 xfailed (`test_t06_admission_295.py`, marked in the file), 0 failed |
| **Area total** | **63** | **1,932 passed, 3 xfailed, 0 failed** |
| Probe for WA2-01 (`tests/test_p2570r_wa_probe.py`, written for this review, never committed, removed after the run): an incident started by `dev-joni` and released by `dev-dana`; `incident_context(conn, "rel-1:r:st-a:1")` | 1 | FAILED as predicted: `PROBE release actor: STARTER`, `assert 'dev-joni' == 'dev-dana'` - the release context is the starter |
| The other 89 backend test files of the area (most of `test_wiskey_*`, the rest of `test_access_control_*`, `test_wkint*`, `test_acr*`, messaging accounts) | 89 | NOT_RUN |
| Frontend tests of the area's screens | - | NOT_RUN |

Why 89 files are NOT_RUN: the first job's file pattern also caught the media-player tests (not this area; 14 files, all passed, one
of them 5 minutes long) and held the shared slot while about fifteen other review jobs waited. I stopped it, and queued the short
prioritized job instead of a second hour-long one. No test of the area failed in what ran.

Assertion strength (reading, sampled): the files behind the findings were checked for what they really assert -
`test_wkcap_295.py` / `test_t06_admission_295.py` (the release context is never exercised with a second person: WA2-01),
`test_wiskey_managed_install_2382.py` (73 tests, none with a database failure while Core is stopped: WA2-02),
`test_wiskey_mac_adopt_298_review.py:159-195` (the hold of an UNKNOWN is asserted, and its release only through `settle_unknown()` with a
`completed` status - the call no product code makes; the case "WisKey never committed" has no test: WA2-05). The AST scan and the
one assertion that cannot fail are in WA2-06.

## 4. Checked and fine (read end to end unless marked "sampled")

- `services/wiskey_native_write.py` (all): source read first and parsed closed; RBAC decision at most 10 s old and never from the
  future; the full original committed (sealed) before the send marker, the marker before the frame; ACK / receipt compared field by
  field in canonical JSON (`True` is never `1`); delete expects the revision sent, never a successor; refusal only for the closed
  pre-effect codes; resolve never re-sends and never rebuilds the original; name carrier (`rename`) keeps the name out of the lineage.
- `services/wiskey_write_lineage.py` (all): forward-only states, fence check inside the same IMMEDIATE transaction as admit and
  begin_send, restore / stale / missing detection through the anchor, sealed original bound to the operation id, retention never
  purges an open unknown. `routers/wiskey_lineage.py`: every route behind the one system-administrator gate, the three actions also
  interactive, typed word for reinitialise, audit rows on refusals and actions, gates run off the event loop.
- `services/intercom_write_journal.py` (all) and its use in `intercom_sync` (`_admit`, `_journal_admit`, `begin_external` /
  `end_external`, `_execute`, `_execute_admitted`, `_settle`, `_follow_unknown`, `note_readback`, `_one_off`): one atomic admission,
  intent before dispatch, fail closed when the journal cannot be written, unknown never downgraded to not-sent, expiry checked on the
  feed loop right before the frame, no retry, slot freed only when both the call and its handling are through.
- `services/wiskey_managed_install.py` (all) + `routers/wiskey_managed.py`: system administrator on every route, typed phrases for the
  switches and the adoption, never a downgrade, bundle verified against its pin and digest, no link followed, tree re-checked right
  before the swap, automatic rollback, start-up run strict on the Core gate and once per bundle - apart from WA2-02.
- Installer tools: `routers/wiskey_installer.py`, `wiskey_installer_common.py`, `wiskey_installer_platform.py` and
  `services/wiskey_installer.py` (all): permission before the body, envelope + `confirmed` + typed phrase, attempt row before the one
  send, honest refused / unknown mapping, in-process limits, webhook key only in the one no-store reply (not in the audit summary),
  webhook URL https-only without credentials. `wiskey_installer_lifecycle / clock / technical` (routers and services): sampled only
  through the shared `Write` path.
- `routers/access_control_ws.py` (all): permission before accept, re-checked every minute, data-free notices.
- `routers/media.py` websocket paths (`_principal_for_ws`, `_live_relay`, `live_ws`, `live_ha_ws`): origin / session on the remote
  channel, service account and required-sensors and home-interface gates, both caps re-checked with nothing awaited before the
  registration, lease re-check, upstream error text never forwarded, start / stop audit rows.
- `routers/intercom_media.py` (thumbnail, live socket, talk start / stop, `_pump`, talk socket): station visibility as 404, `video.live`
  and `access.read` on the station chain, per-station viewer limit, talker slot and one session per user, frame size and rate caps,
  permission re-checked before every published packet, one end row. The stills (thumbnail and the entry-center snapshot,
  `routers/access_control_stills.py`) need `access.read` only and are not behind the station-media setting - consistent between the
  two routes and stated in their docstrings (owner's rule; noted, not a finding).
- `services/wiskey_emergency_direct.py` (all) apart from WA2-01: one new request per attempt, intent committed before the send, release
  wins over hold, a live attempt is never retried, LOCK not mapped to release, receipt never read as a physical proof.
  `services/wiskey_auto_door.py` (all): both creator and approver must be active and hold the permission now, confirmed relay map,
  one request id once, `sent` only for an acknowledged receipt.
- `services/wiskey_feature_direct.py` `DirectFeatureClient.start / _finish_start / result`, `FeatureAdapters.prepare / start`;
  `wiskey_feature_exec.resolve_policy`, `relay_row`, `relay_row_for_door`, `set_relay_map`: every commit hands the write lock on
  before network I/O.
- Relay map: `routers/wiskey_relay_map.py` (all), `services/wiskey_relay_map.py` `validate` / `save`: CAS on the station revision,
  duplicates refused, typed word when a door automation is touched, sync to the Native only after the commit and outside the
  transaction. `services/intercom_doors.py` (all): explicit map only, re-validated against the served copy at every resolve.
- `services/wiskey_media_bridge.py`: `open_reply`, `read_identity`, `DirectLink._read / _dispatch / _shutdown / call / call_command`
  (reply MAC and connection ref verified before anything of a frame is read, constant-time compares, late answers dropped never
  re-attributed, not_sent / refused / unknown exact). The rest of the file: sampled.
- `services/wiskey_service_write.py` `Journal`, `ServiceWriteClient.write / _write / _observed / _dispatch / status` apart from WA2-05.
- Capture: `routers/access_control_capture.py` classic path (start, status, cancel, confirm) end to end; `services/capture_lease.py`
  registry / `usable` / `gate_mark` / `on_authority_change`. Lease route helpers and the rest of `capture_lease.py`: sampled.
- Messaging: `routers/access_control_messaging.py` header rules, recipients preview and `send_message` end to end (permission, consent,
  credential guard, attempt recorded before the one send, unknown never shown as sent); consent link design in
  `services/intercom_consent.py` (192-bit derived token stored as a hash, single use): sampled.
- `services/intercom_listen.py` session registry, `services/wiskey_talk_pump.py` (first 200 lines: floor, batching, no retry).
- `routers/wiskey_pairing.py` (all), `routers/wiskey_switches.py` (all), `wiskey_auto_install` switch gate (`OWNER_ON_PERMITTED` is
  False; the switch is kept out of backups, `services/backup.py:318`).
- `services/wiskey_station_ops.py` module rules and `services/wiskey_people_csv.py` module rules: header and outline only.
- `scripts/wiskey_*.py` (six developer tools): no network, no execution of the parsed source, tar extraction with `filter="data"`;
  they write only their own output files. `contracts/wiskey/`: every JSON file parses; the 17 `r2/schemas` files are byte-identical
  to `alignment-v1/schemas/legacy`.
- `hikvision_intercom` managed copy: the shipped tree is verified against `hikvision_intercom.pin.json` (file map + tree hash,
  `wiskey_auto_install.verify_pin`) and against the pin's digest / file count / version / profile (`wiskey_managed_install.bundle_info`)
  before anything is installed; the digest walk refuses links, special files and case-insensitive name collisions. The pin sits next
  to the tree it verifies, so it detects a damaged or partial image copy, not a deliberate change of both - inside the add-on image
  that is the right limit. The repository-side tests of it are in section 3.

## 5. Still not covered (honest)

- Not read at all: `services/intercom_adapter.py` (112 KB), `services/intercom_client.py`, `services/intercom_media.py` beyond the
  parts the first pass named, `services/intercom_messaging.py`, `intercom_messaging_adapter.py`, `wiskey_wa_queue.py`,
  `messaging_runtime.py` / `messaging_accounts.py`, `services/intercom_capture.py`, `capture_lease_route.py`, `routers/capture_lease.py`,
  `wiskey_capture_*.py`, `lease_events.py`, `wiskey_listen_adapter.py`, `routers/intercom_listen.py`, `wiskey_pairing.py` (service),
  `wiskey_install_generation.py`, `wiskey_core_runtime_gate.py`, `wiskey_event_resume.py`, `wiskey_live_validation.py`,
  `wiskey_peer*.py`, `wiskey_intents.py`, `wiskey_profiles.py`, `wiskey_schedule_reads / writes.py`, `wiskey_door_tech.py`,
  `wiskey_access_state.py`, `wiskey_access_diag.py`, `wiskey_ops_views.py`, `wiskey_triage.py`, `wiskey_system_status.py`,
  `wiskey_feature_status.py`, `wiskey_installed_features.py`, `wiskey_relay_map_native / export / inventory.py`, `wiskey_join_live.py`,
  `wiskey_direct_discovery.py`, `wiskey_direct_catalog.py`, `wiskey_channels.py`.
- Read only in part (entry points and write paths, the rest sampled): `intercom_sync.py` (projections and the feed session not read),
  `wiskey_auto_install.py` (only the switch, the pin check and the snapshot route helper - the unattended install / restart path is
  closed by the build constant and was not read), `wiskey_direct_join.py`, `wiskey_media_bridge.py`, `capture_lease.py`,
  `wiskey_people_csv.py`, `wiskey_station_ops.py`, `intercom_consent.py`, the installer lifecycle / clock / technical tools.
- Frontend of these screens (the 2.56 pass covered the changed parts only), phone / RTL rendering.
- Anything executed against a real WisKey, Home Assistant, a station or the lab. WA2-02 was not reproduced on a platform double
  (reading only); WA2-03 / WA2-04 timing was not reproduced.
