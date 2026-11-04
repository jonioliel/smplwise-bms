# WISKEY-JOIN-LIVE-2382 - WisKey's direct connection starts and stops without a restart

Branch `pilot/WISKEY-JOIN-LIVE-2382`, cut from `origin/pilot/WISKEY-TALK-DIAL-2382` (604fe0c73: the provider row and the readiness endpoint).
Task T1 of `private/planning/WISKEY_FULL_INTEGRATION_PLAN_2026-11-03.md`. Target release: **2.38.2 (activation)**. Fakes only: the lab was
not touched.

## 1. What the owner gets

- **Switching "מקור הווידאו והדיבור" to WisKey (`access.station_media_provider = auto`) now takes effect in a few seconds.** No add-on
  restart is needed. Switching back to Arx (`local`) stops it the same way.
- **The same happens when the pairing key changes.** If the key is rotated or goes missing, the direct connection stops. If the key is
  restored or paired again, it starts again.
- **Every feature that depends on the direct connection follows at once.** These are:
  - door windows tier B;
  - emergency open / release;
  - door automations;
  - the WisKey-checked people CSV;
  - native people writes;
  - WhatsApp template sends;
  - the relay-map sync.
- **Every runtime start or stop writes one audit row.** The actions are `wiskey.direct_join.start` and `wiskey.direct_join.stop`.
  - The row names the administrator whose settings save caused the change.
  - A change found by the periodic check has no actor.
  - The add-on start and stop write no row, as before.
- **People writes record the channel they used.** The person audit rows (`intercom.person.*`) carry `transport`:
  - `wiskey_direct`: the write went over WisKey's direct connection;
  - `classic`: the write went over the Home Assistant channel, with `transport_reason`;
  - `classic_after_direct`: the direct connection was chosen but did not carry the write, so the write went over the classic channel. The
    row also carries `direct_state` and `direct_code`.
- **A small read for the "מצב WisKey" status page.** `services/wiskey_join_live.py` exposes `join_state()` (section 4).

## 2. Design

The new module is `smplwise_vms/backend/smplwise/services/wiskey_join_live.py`. It holds one `JoinManager` per process (`MANAGER`).

- **Triggers.** Three things make the manager look again:
  - The settings save of `access.station_media_provider` calls `request_reevaluate("settings", actor=..., request_id=...)`. This call
    never reads the database and never starts anything inside the request: the request has not committed yet.
  - After a trigger, the manager re-reads every 0.5 s for 10 s.
  - A periodic check every 15 s catches every other change, such as a pairing, a backup restore or a key rotation. Those flows may also
    call `request_reevaluate`.
- **The two conditions.** `read_desired` reads them with the same rules `wiskey_direct_join.startup` uses:
  - the provider (`intercom_media.provider_choice`);
  - the key (`ha_bridge.signing_key` and the signer's `_key_text` rule).

  The manager keeps an in-memory hash of the key, so a different key while the connection is up (a re-pair) restarts it. The hash is never
  stored or logged.
- **Debounce.** A change is applied only when two reads at least 3 s apart agree.
  - A quick flip back cancels it.
  - A state that cannot be read (for example a locked database) changes nothing; it is recorded as `last_error = state_unreadable:...`.
  - A failed start waits 60 s before the next try.
  - A dropped socket is **not** a condition. The session has its own 60 s back-off, so network trouble never starts or stops the connection.
- **Start.** The manager calls the same `wiskey_direct_join.startup`.
  - `startup` now runs under a lifecycle lock. A second `startup` returns the installed join, so a double start cannot happen, even from
    the automatic installation's own `startup` call.
  - The scope recovery runs in the background, as at add-on start.
- **Stop, in this order:**
  1. The live capture leases are revoked (`lease_revoke scope: all`, reason `feature_off` or `key_rotation`). This happens while the direct
     path that granted them is still installed. The budget is 2 s.
  2. `wiskey_direct_join.shutdown(drain_s=8)` restores the globals at once, so no new caller can pick the join.
  3. Every new request is refused `not_sent join_stopped` before any I/O.
  4. Requests already in flight get 8 s to end on their own.
  5. The socket closes. The loop's remaining tasks are cancelled. An interrupted request settles `unknown` in the still-open lineage and is
     never sent again.
  6. The lineage closes last, so its writer lease is handed over at once.
- **Ownership.** The manager stops only a join that `startup` installed (`origin = "startup"`). A test's or a tool's join is never touched.
- **Add-on start and stop.**
  - `main.py` calls `MANAGER.boot`. Boot does the first evaluation at once, with no debounce and no audit row, exactly like the old
    `startup` call. Then it starts the `wiskey-join-live` thread.
  - At stop, `main.py` calls `MANAGER.shutdown()`. This ends the thread and stops the join with a drain. It runs before the existing
    `wiskey_direct_join.shutdown()`, which stays as a no-op guard.
  - `SW_WISKEY_JOIN_LIVE_THREAD=0` turns the thread off. The test conftest sets it, and tests call `evaluate(now=...)` directly.

### 2.1 People writes: which channel, and the safe fallback

Turning on `auto` moves people create, update and delete to the direct path once the connection is up and WisKey lists the command. The
direct path is chosen, but it may not carry the write. **The write goes over the classic (Home Assistant) channel only when Arx has proof
that the direct attempt had no effect, and that the classic write cannot duplicate an earlier native one** (`wiskey_direct_join.fallback_permitted`):

| direct result | classic fallback | why |
|---|---|---|
| `not_sent`, any code (no byte of the mutation frame left) | yes | the WKWRITE contract: nothing reached WisKey |
| writer refusal before its intent: `source_unavailable:*`, `source_invalid:*`, `action_not_offered`, `lineage_unavailable/closed/missing/stale`, `writer_busy`, `writer_fenced`, `join_stopped` | yes | transport or availability; the mutation was never sent |
| a verified pre-effect refusal saying the channel cannot carry it: `native_write_source_not_observed`, `native_write_action_unsupported`, `unknown_command` | yes | WisKey refused before its person transaction |
| a verified business refusal: `invalid_fields`, `revision_conflict`, `user_not_found`, `request_too_large`, ... | **no**: fails visibly with the code | the classic channel would only repeat the question or bypass WisKey's check |
| `unknown`: a timeout after the write, a lost answer, a MAC failure, or WisKey's `Unauthorized` (a refused signature) | **no**: fails visibly (`UnclearAnswer`); the person is fenced until a fresh read (R3-06) | it may have been applied; the writer settles it unknown (never re-sent) |
| Arx authority or actor refusal: `rbac_denied`, `actor_session_inactive`, `invalid_*`, `decision_*` | **no**: fails visibly | never bypassed through another channel |
| the lineage names an earlier native write: `create_origin_already_used`, `person_write_in_flight`, `duplicate_operation` | **no**: fails visibly | a classic write could duplicate it |

More rules for the fallback:

- The classic write is **one new request on its own channel**.
  - The native frame is never sent again, and no native nonce is reused.
  - The fallback runs at most once per write.
  - It respects the route's expiry: an expired write is refused `not_sent expired`.
- **`service_grant_required`** belongs to WisKey's service-write path (`native_service_write_api.py`), not to the direct people write.
  When it answers the source read, the write goes classic (`source_unavailable:service_grant_required`). When it would answer the mutation
  itself, the writer's conservative rule applies.
- **A refused signature on the mutation** comes back from WisKey as the verified code `Unauthorized`. The native writer's documented rule
  says that code may follow a commit (WKWRITE, source reading at d2579588). So the result is `unknown` and the write fails visibly. It is
  **not** sent classic.
- **A signature that cannot be made at all** happens on Arx's side: the key is rotated or missing. Then nothing is sent, the result is
  `not_sent`, and the write goes classic.

## 3. Safety properties kept

- **The signed path only.** The join is still installed only by `startup`'s rule: `auto` plus a key that signs. Every send still checks
  `DirectJoin.selected(command)`.
- **No unsigned fallback.** The classic fallback is the existing Home Assistant people-write path. It is not an unsigned direct frame.
- **Single-use nonces.** Every new connection signs with fresh nonces. A test runs a stop and a start against a fake that refuses a reused
  nonce.
- **Nothing replayed.** An interrupted request is `unknown`, and `unknown` never goes classic.
- **Policy B is untouched.** There is no installation step, no grant writer and no switch change.

## 4. The read for the status page (for the "מצב WisKey" agent)

`smplwise.services.wiskey_join_live.join_state() -> dict`. It does no I/O to WisKey and never raises.

```
{state: off_by_setting | key_missing | key_rotated | starting | connecting | up | stopping | error,
 since: ISO UTC, last_error: code | None, pending: {to: start|stop, reason} | None, thread: bool, installed: bool,
 people_writes: {path: direct | classic, reason: None | not_installed | lineage_* | not_configured | join_stopped |
                 wiskey_direct_not_connected | command_not_discovered | discovery_missing | ...},
 features: {feature_host | door_programs | people_csv | templates | relay_map: {available: bool, reason}}}
```

Two other public functions:

- `wiskey_join_live.request_reevaluate(trigger, *, actor=None, request_id=None)`. The pairing, restore or rotation flows may call it.
- `wiskey_direct_join.people_path(command)`. It returns the people-write channel on its own.

## 5. Files

| file | change |
|---|---|
| `backend/smplwise/services/wiskey_join_live.py` | new: the manager, `join_state`, `request_reevaluate` |
| `backend/smplwise/services/wiskey_direct_join.py` | session stop (closing, busy count, drain, `join_stopped`); `DirectJoin.close(drain_s)` order; `startup` / `shutdown` under one lock, `startup` idempotent, `origin`; `people_send(fallback, not_after, record)`, `fallback_permitted`, `people_path` |
| `backend/smplwise/main.py` | boot and stop through the manager (2 small blocks) |
| `backend/smplwise/routers/settings.py` | **shared**: one block, the provider save calls `request_reevaluate` |
| `backend/smplwise/routers/access_control.py` | **shared**: `people_send` passes `fallback`, `not_after`, `record` and records `transport` on every path |
| `backend/smplwise/routers/access_control_writes.py` | **shared**: passes `not_after`; records `transport: classic` for writes with no native form |
| `backend/tests/conftest.py` | **shared**: one line, `SW_WISKEY_JOIN_LIVE_THREAD=0` |
| `backend/tests/test_wiskey_join_live_2382.py` | new: 38 tests |

None of these files is used by the other agents running now:

- managed install: `wiskey_auto_install.py`, `bridge_install.py`;
- the rc.10 pin: `wiskey_direct_catalog.py`;
- inbound calls;
- deep links;
- the status page.

`wiskey_auto_install.reconcile_due` still calls `startup` directly. That is now safe: it cannot install a second join, and the manager
adopts that join.

## 6. Tests

New file: `tests/test_wiskey_join_live_2382.py` (38 tests). It covers:

- the start on a switch to `auto`, with the administrator in the audit row;
- a clean stop on a switch to `local`: socket closed, loop ended, lineage closed, transports restored;
- no flapping: a quick flip back, an unreadable state, a dropped socket;
- a rotated key stops the join, and the capture leases are revoked first;
- the key missing and then restored brings the join back, with fresh nonces only;
- a different key restarts the join;
- no double start, including concurrent evaluations;
- the back-off after a failed start;
- a foreign join is never touched;
- a stopping join refuses new requests `not_sent` and settles an interrupted one `unknown`;
- the add-on start and stop with the thread, with no audit rows;
- the features report correctly while stopped and while up;
- the people-write paths: committed direct, `not_sent` goes classic once, a source failure goes classic; a business refusal, `Unauthorized`
  and a timeout fail visibly and are not sent classic; a duplicate create origin is not sent classic; an expired write is not sent classic;
  an actor refusal is not bypassed;
- the fallback table;
- the route recording `transport` on every path.

Results (03-04.11, fakes only):

| run | where | result |
|---|---|---|
| `test_wiskey_join_live_2382.py` | workstation, .venv Python 3.12.10 | 38 passed |
| `test_intercom_writes_s11.py` + `test_intercom_people_s7.py` | workstation | 56 passed |
| `test_fake_doorwin_closed_rule_sr1.py` + `test_wiskey_join_live_2382.py` + `test_wkjoin_295.py` | workstation | 66 passed (after 7c1e4527f) |
| WisKey / direct-join batch (78 wiskey / wk / direct-join files + intercom people/media/lease files), one process | runner @ 5897cbb6b | 2320 passed, 3 failed, 479 errors: **invalid** - the runner disk filled up (`ENOSPC`: numbered tmp dirs, sqlite) during the run; the 3 failures pass on the workstation |
| full backend suite, 2 shards | runner @ 5897cbb6b | s1 8931 passed / 3 failed / 388 errors; s2 10075 passed / 383 errors - same disk-full window; one real finding (SR-1 scan, fixed in 7c1e4527f) |
| rerun of every failed / errored file + the changed test files (84 files), one process | runner @ 7c1e4527f | 2021 passed, 6 skipped, 3 xfailed, 1 failed, 1 error |

- The one remaining failure, `test_calendar_attendees_2343.py::test_whatsapp_channel_through_the_shared_account_on_the_fake_adapter`, fails the
  same way on the base commit 604fe0c73 (checked on the workstation). It depends on the time of day and is unrelated to this change.
- The one remaining error, `test_emergency_readiness_295.py::test_history_written_on_change_and_pruned` (`sqlite3.OperationalError: unable to
  open database file` in fixture setup), is an environment error. That file passes on the workstation (22 passed).
- The full suite was not re-run after the fix: the runner disk was short, and only the failed and changed files were rerun.

## 7. Known limits

- **NOT run against a real WisKey, Home Assistant or station.**
- The status page itself (UI) belongs to the "מצב WisKey" agent. This branch only exposes `join_state()`.
- **Delays.**
  - A provider change applies about 3.5 to 4 s after the save: the debounce plus the post-trigger poll.
  - A key change found only by the periodic check applies within about 15 to 18 s.
  - Until then, the join's own per-send key check (cached up to 30 s) already refuses to sign with a rotated or missing key.
- **The classic fallback runs inside the same feed action.** If the direct attempt used most of the action's time budget, the classic write
  may end in the feed's own timeout (`unknown`, visible). It is never retried.
- **Live W10 media sessions are not torn down.** These are the WisKey video and talk sessions opened by `intercom_media`, which uses its own
  connection. Their provider is read per request, as before.

## 8. Rollback

Revert the branch commit. `main.py` then calls `wiskey_direct_join.startup` once at start again. Nothing is stored: there is no migration
and no new setting key.
