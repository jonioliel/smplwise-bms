# FIX-WISKEY2-2570 - WisKey / access area: the second deep review (WA2-01..06)

Row FIX-WISKEY2-2570 (target 2.57). Base `origin/release/2570-train` at `6ea807b2e` (= v2.56.0). Branch `pilot/FIX-WISKEY2-2570`.
Source: `docs/review/DEEP-REVIEW-2570-WISKEY-ACCESS.md` on `origin/review/DEEP2-2570-WISKEY-ACCESS`. Every finding was re-read at the
base before it was changed: all six still existed. The bridge (`custom_components/smplwise_bridge`) and its version are not touched;
the files of FIX-WISKEY-2570 (schedule execution, visits) are not touched. Nothing was sent to WisKey, Home Assistant, a station or
the lab. No retry and no queue were added; an unknown stays unknown.

## Findings -> outcome

| ID | Severity | Outcome | Where |
|---|---|---|---|
| WA2-01 | high | fixed | `services/wiskey_emergency_direct.py` (`release_id_of`, `incident_context`) |
| WA2-02 | medium | fixed | `services/wiskey_managed_install.py` (`_Run.core_down`, `run` / `_run`, `_rescue_core`, `_previous_back`, `recover_interrupted`, `_crashed_with_core_stopped`) |
| WA2-03 | low | fixed (root cause) | `services/wiskey_write_lineage.py` (`recover`), `services/wiskey_direct_join.py` (`recover_now`) |
| WA2-04 | low | fixed | `services/wiskey_write_lineage.py` (`admit`), `services/wiskey_native_write.py` (`write`, `rename`, `_unsent_after_admit`) |
| WA2-05 | low, latent | guard test + documented (not reachable: no production caller builds the journal client) | `tests/test_fix_wiskey2_2570.py` |
| WA2-06 | low | fixed | `tests/test_intercom_capture_lease.py` |

### WA2-01 - the emergency release acts as the releaser
`incident_context` now tells the two door-call forms apart. The dispatcher's release id is `<release id>:r:<station>:<relay>`
(`door_emergency.dispatch`); it is split from the right because the OPEN-over-LOCK supersede writes a release id with a colon
(`<client id>:sup`). A release resolves the incident by `release_request_id` (or, as the dispatcher's own fallback, by `request_id` when
no release id was stored) and acts for `released_by`; an apply resolves by `request_id` and acts for `requested_by` (the former
`OR release_request_id=? OR release_request_id=?` match for an apply is gone). The person must hold an active Arx account
(`active_users.has_active_account`, as `wiskey_auto_door._principal`). No releaser on record, an unknown or inactive releaser ->
`Unauthorized` (`refused`, nothing sent); a releaser without `door/emergency_release` + `door/restore` on the door's station ->
`permission_missing` (the policy snapshot is now the releaser's). Every refusal is the door's audited `door.emergency.door_result` row.
The starter is never used in the releaser's place. WisKey's ledger now names the person who released.

### WA2-02 - the managed install never leaves Core stopped behind an unexpected error
`_Run.core_down` is true from the moment the Supervisor accepted a stop until a start was asked again. `run` wraps the steps (`_run`):
when anything escapes while `core_down` is true it first puts the stage's previous tree back when the target is missing, then asks for
ONE start (no wait loop, no retry, no database write before it - the database may be what failed), records the actions in the job
(`core_rescue`, internal) and re-raises; the worker body marks the run `failed / run_crashed` as before and now also writes an audit
row `wiskey.managed.run` (reason `run_crashed`, details `error`, `core_rescue`; best effort). The start-up recovery
(`recover_interrupted`) also covers a run marked `failed / run_crashed` whose steps end with Core stopped (a `stop_core` step asked,
no later `start_core*` step done): previous tree back if missing, Core started only if it does not answer, recorded once
(`crash_recovered`, audit reason `run_crashed_recovered`); the status stays `failed / run_crashed` (honest). The public job view is
unchanged (no new UI text). Not done: the review's other suggestions (best-effort step bookkeeping inside the stopped section, the data
directory in the space check) - with the rescue path a failed bookkeeping write now ends the run with Core asked to start, which is the
safe end; see the report.

### WA2-03 - recovery never turns this process's own in-flight write into unknown
`WriteLineage.recover(scope)` settles only crash leftovers: rows admitted under an EARLIER fence. A row at the writer's current fence
was admitted by this process (admit checks holder and fence in the same transaction) and is settled by its own call, so a verified
refusal or not-sent of it stays provable. A new process always takes a higher fence, so its first recovery still covers everything a
dead process left (the crash tests are unchanged). `DirectJoin.recover_now` also skips a scope already recovered in this process (the
check `_ensure_recovered` already made). The transitions of the lineage (`mark_refused` / `mark_not_sent` only from `sending`) are
unchanged - the race that needed them is gone. Not changed: `_ensure_recovered`'s fast path (`if self._recovered: return`) for a second
scope after a re-pair - see the report.

### WA2-04 - a stuck intent no longer holds the person until restart
`admit`: when the anchor write on the main database fails (`sqlite3.Error` / `OSError`), the committed intent is settled `not_sent`
(code `anchor_write_failed`) and `LineageError("anchor_write_failed")` is raised (the writer maps it to `NativeWriteError`, nothing
sent). `NativePeopleWriter.write` / `rename`: an unexpected error of `begin_send` (the send marker was not committed) settles the row
`not_sent` (`send_marker_failed`, best effort) and returns that outcome - no frame of the mutation had left.

### WA2-05 - service-write journal (latent)
Confirmed: an UNKNOWN row holds its person until a status read answers `completed`, there is no janitor and no administrator close.
Not reachable: no product code builds `ServiceWriteClient` / `Journal` (`FinalServiceWriter.from_join` / `from_manual_v3` have no
client, `available()` is false). A guard test fails the moment product code constructs the journal client or calls `settle_unknown`,
with the requirement in its message (bounded periodic settle, audited administrator close, age rule). The mechanism itself is not
built for a dormant path.

### WA2-06
`test_start_refused_by_the_host_destroys_the_row` ended with `assert ... == 409 or True`. It now sets the host to answer and asserts
that a new start is admitted (200 with a session) - the station's reservation was released after the refusal.

## Tests (runner, slot B, job `~/work/p2570_fixwk2_be.sh`, one pytest process per file, `SW_WIRE_STRICT=1`)

| What | Result |
|---|---|
| `tests/test_fix_wiskey2_2570.py` (18 tests) at the fix (`9c39e3c75`) | 18 passed |
| Same file with the five service files reset to the base (BEFORE) | 13 failed, 5 passed - every WA2-01..04 test that proves a change fails; the 5 that pass before are the ones that must hold either way (a starter who lost the permission and releases himself is refused; an unknown release id is Unauthorized; a new process still recovers a dead one's rows; a crashed run with Core started again is left alone; the WA2-05 guard) |
| First AFTER run at `15fbfbfe5` | 17 passed, 1 failed - the recovery test's job fixture lacked `finished_at` (the job view's wire model requires it); fixture fixed in `9c39e3c75`, rerun above |
| `tests/test_intercom_capture_lease.py` (WA2-06) | 15 passed |
| Regression: `test_wkcap_295` 42, `test_t06_admission_295` 64 + 3 xfailed (marked in the file), `test_wkr5_295_emergency` 4, `test_door_emergency` 26, `test_wiskey_managed_install_2382` 73, `test_wkwrite_295` 29, `test_wkwrite_295_crash` 6, `test_wkjoin_295` 23, `test_wiskey_join_live_2382` 38, `test_wiskey_mac_adopt_298_review` 40 | 345 passed, 3 xfailed, 0 failed |
| `ruff check` of the five changed product files | clean |

NOT_RUN: frontend (no frontend file changed), the rest of the area's backend files, anything against WisKey / Home Assistant / the lab.
