# CR-WAVE2-COMBINED-2439 - the wave-2 code-review branches in one branch, one entry check

Branch `pilot/CR-WAVE2-COMBINED-2439`, based on `origin/pilot/CR-WAVE1B-COMBINED-2436` @ `1a7e19ae3` (wave 1 + its entry fixes).
Owner approval 14.11.2026 ("מאשר מיזוגים"): merge the wave-2 code-review branches into one branch with ONE runner entry check, and
cancel their individual entry checks that were still waiting in the runner queue. No version bump, no tag, no new code of its own
beyond conflict resolution and the ratchet baseline. No device, NVR, go2rtc or Home Assistant was contacted.

Frontend design / UI branches are NOT in this branch (they keep their own checks): AUDIT30-COMBINED, HOME-V3-AUDITFIX,
HOME-R32-ANSWERS, PLAN3D-R28-UI, PLAN3D-R32-ANSWERS, DOMUS-DEFAULT, DIALOG-DRAWER-ONE, I18N-EN-SWITCH.

## Merges (all `--no-ff`, origin heads of 14.11.2026, in this order)

| # | Merge commit | Branch | Head |
|---|---|---|---|
| 0 | `f75debb91` | `origin/main` (v2.43.5) | `0a8fb55e1` |
| 1 | `9f00557ef` | BACKEND-SAFETY-2435 | `300945228` |
| 2 | `c3138be60` | AUTH-REVOKE-GATE-2435 | `0a3c570e1` |
| 3 | `b59c1b1a0` | TICKETS-PERF-ERASE-2435 | `5719846af` |
| 4 | `0e210ad53` | SESSION-DEMO-WS-2435 | `c090f6059` |
| 5 | `f362be7df` | CR-RBAC-EVAL-2438 | `221a562ef` |
| 6 | `e1cfb5814` | CR-ADMIN-GATE-2438 (stacked on 5) | `fcc8060bd` |
| 7 | `4ffd7cefe` | CR-ACTIVE-USER-REST-2438 (stacked on 6) | `0dec03a6a` |
| 8 | `0c67041da` | CR-MAIN-RUNTIME-2438 | `68a5a6bbc` |
| 9 | `760bcb2f4` | CR-SYNC-GATE-2438 (stacked on 8) | `51f5dcc3c` |
| 10 | `74ea45faf` | CR-NVR-GUARD-2438 | `af8dc8240` |
| 11 | `417730fcf` | CR-WK-LIMITS-2438 | `82baed37f` |
| 12 | `07f9aad21` | CR-DEVICE-HTTP-2438 | `268df1c28` |
| 13 | `968514ce6` | CR-SECRET-FILES-2438 | `8623d3b51` |
| 14 | `321b1a279` | CR-PATH-CONFINE-2438 | `3e758e1c4` |
| 15 | `d130bc588` | CR-ROUTER-COMMON-2438 | `8f41ef680` |
| 16 | `7e1fc9b8a` | CR-TK-ROUTER-COMMON-2438 (stacked on 15) | `456c47e99` |
| 17 | `5111d61cc` | CR-TIMEUTIL-2438 | `6e4055882` |
| 18 | `e8926e350` | CR-TK-TIMEUTIL-2438 (stacked on 17) | `9d02f2a5a` |
| 19 | `8de40af9e` | CR-JANITOR-REGISTRY-2438 | `e92dfa4bb` |
| 20 | `7653f8e9d` | CR-CORE-HELPERS-2438 | `d04e618f8` |
| 21 | `15246e6a6` | CR-SESSION-CACHE-2438 | `852a23c83` |
| 22 | `05570e89e` | CR-HA-CLIENT-2438 | `82844f355` |
| 23 | `28dd553b0` | CR-GO2RTC-OWNED-2438 | `287cdda36` |
| 24 | `00fc9c54c` | CR-BRIDGE-GAPS-2438 | `2cf3ef683` |
| 25 | `133f2b698` | CR-BILL-LEDGER-B-2438 | `b5501c1c9` |
| 26 | `04a1f41a1` | OWNER-R32-BACKEND-2438 | `6b3e19eb4` |
| 27 | `c38c16002` | CR-DEAD-CODE-BE-2438 | `4428467c4` |
| 28 | `83e76d775` | CR-BUILD-GUARDS-2438 | `595ff0f2c` |
| 29 | `8275d04ab` | CR-CONFIRM-DIALOG-2438 | `6f0182a2b` |
| 30 | `56a176ea8` | DESIGN-RULEBOOK-2438 | `7d773d9aa` |

Every listed branch existed on origin; none was skipped.

Later on 14.11 (lead request): `origin/main` v2.43.6 (`4a345f8af`) merged at the top as `2703e074d` (SESSION-DEMO-WS-2435, already
here, PLAN3D-R28-UI-2433, a test-only fix, the rebuilt UI). See "2.43.6 merge" and "Shutdown fix" below.

## Conflicts

Only the first merge (`origin/main`, 2.43.5, into the 2.43.4-based wave-1 branch) conflicted textually; the 30 branch merges were
clean as text (two semantic conflicts, items 3 and 4).

1. `smplwise_vms/backend/smplwise/routers/settings.py` - wave 1 (CR-SETTINGS-STORE-2436) moved `DEFAULTS`, `INT_KEYS` and the
   readers into `services/settings_store.py`; main (HEALTH-GO2RTC-FOLLOWUP-2431) added `media.video_notice_after_min` to `DEFAULTS`
   and `INT_KEYS` in the old place. Resolution: keep the wave-1 layout (the router re-exports), carry the new key and its comment into
   `settings_store.DEFAULTS` and `settings_store.INT_KEYS`; main's `SettingsPatch` field and the `Literal` import merged on their own.
   Checked: the only 2.43.4 -> 2.43.5 changes to the file were these three hunks.
2. `frontend/src/screens/system-diagnostics.ts` - imports: wave 1 imports `healthSummary` / `HealthSummary`, main imports the video
   service picker (`api/video-services`, `components/sw-video-service-picker`). Both kept.

Two semantic conflicts (clean text merge, a focused test failed; fixed in commit "fix: merge interactions"):
3. `routers/video_services.py` (new in 2.43.5, HEALTH-GO2RTC-FOLLOWUP-2431) carried its own `_rid` copy; CR-ROUTER-COMMON-2438 (cut
   from 2.43.4) never saw the file, and its guard `test_router_common_helpers::test_no_router_outside_the_waiting_list_copies_a_request_helper`
   failed. Fix: `from ._common import rid as _rid`, the local copy removed (same body).
4. `services/notify_recipients.expand`: OWNER-R32-BACKEND-2438 (owner O1 a) removed the generator-only switches `role_via_groups`,
   `role_expiry` AND `active_only`; CR-TK-ROUTER-COMMON-2438 started calling `expand(..., active_only=False)` from
   `tickets/notify_matrix.role_members` (the digest applies visibility itself) -> `TypeError` in
   `test_tickets_router_common_2438::test_the_matrix_role_expansion_is_the_shared_one`. Fix: keep O1 (the two generator switches stay
   removed) and restore only the keyword-only `active_only: bool = True` (default unchanged for every alert module).

Overlaps checked by reading (no textual conflict, both intents present):
- `main.py`: BACKEND-SAFETY rewrote the head of `janitor_tick`, JANITOR-REGISTRY (which merged BACKEND-SAFETY itself) turned it into
  the `services/janitors.py` registry; MAIN-RUNTIME's middleware / exception / `_shutdown_step` changes sit elsewhere in the file.
- `rbac.py`: the RBAC-EVAL -> ADMIN-GATE -> ACTIVE-USER-REST chain merged in its stacked order.
- `session_cache.py`: AUTH-REVOKE created it, SESSION-CACHE builds on it and merged after it.
- notify recipients: wave 1's `notify_visibility.active_principals` (CR-NOTIFY-FANOUT) and OWNER-R32-BACKEND's recipient rules
  (roles through groups, no expired bindings) are both in. `notify_recipients.active_user_ids` / `active_principals` still read
  `users.active = 1` only: switching them to `services/active_users` is the follow-up CR-RBAC-EVAL / CR-ACTIVE-USER-REST recorded
  (a behaviour change, not a merge resolution) - not done here.
- `wiskey_lineage.py` keeps AUTH-REVOKE-GATE's local `_gate`; adopting `rbac.require_system_admin` (CR-ADMIN-GATE note) is a
  one-line follow-up, not done here.

## Shutdown fix: the feed threads' sockets after shutdown (release gate 2.43.6 finding)

The 2.43.6 release gate showed that BACKEND-SAFETY-2435 on top of 2.43.5 makes
`test_asgi_wiskey_295::test_full_app_lifecycle_media_and_talk_with_downlink_leaves_no_task_socket_thread_or_timer` fail
(`assert 4 <= 2`: OS sockets after shutdown; main alone 8/0, main + BACKEND-SAFETY 3 pass / 7 fail on the runner).

Cause (reproduced on the workstation; the runner was held by another entry check, so not re-run there):
- `ha_sync`, `intercom_sync` and `wiskey_background_feed` each run `asyncio.run` in a daemon thread. Their `shutdown()` only set a
  `threading.Event` that a `watch_stop` task polls once a second, and nobody joined the thread. So the application's shutdown could
  return while those loops (each with a self-pipe socket pair) were still alive for up to a second.
- In 2.43.5 the notification monitor's shutdown (a few steps later) waited out its own 1 s queue timeout, which happened to cover
  that second. BACKEND-SAFETY-2435 (review 05 P1-08) correctly wakes the monitor at once - and the gap became visible. The bug is
  in the feed threads, not in BACKEND-SAFETY.
- Proof: a check right after `await a.shutdown()` saw `ha-sync` and `intercom-sync` still alive and 6 sockets against 2; the
  shutdown itself took 0.06 s.

Fix (`6bab829cc`):
- new `services/loop_thread_stop.py`: `remember(owner, stop_evt)` inside the loop, `stop_and_join(owner)` sets the loop's stop
  event through `call_soon_threadsafe` (the loop wakes at once, not at the next poll) and joins the thread (2 s bound, never raises).
  The 1 s poll stays as the fallback.
- `ha_sync.SYNC.shutdown`, `intercom_sync.SYNC.shutdown`, `wiskey_background_feed.FEED.shutdown` use it; `main.py` runs these
  three stops off the event loop (`_in_thread_step`), so a join never blocks it.
- `test_asgi_wiskey_295` lifecycle test: right after `a.shutdown()` no feed thread is alive and no socket is open beyond the start.
  Without the fix this fails 2 of 2; with it, the lifecycle test passes 3 of 3 (single test, workstation).
- For BACKEND-SAFETY-2435's own note: the branch is correct; on its own it needs this fix (or this branch) to pass
  `test_asgi_wiskey_295` reliably.

## 2.43.6 merge (`2703e074d`)

- `routers/settings.py`: main added the eight `map.room_*` / `map.stack_*` defaults (PLAN3D-R28-UI) in the old `DEFAULTS` place;
  carried into `services/settings_store.DEFAULTS` after `map.default_view` (the `SettingsPatch` fields merged on their own).
- `smplwise_vms/www`, `www-public`: main's 2.43.6 build taken as is, minus its 248 debug source maps, and the 248
  `sourceMappingURL` comments stripped with `frontend/scripts/sourcemaps-archive.mjs` (CR-BUILD-GUARDS-2438; `release_check`
  enforces both). The file list equals main's minus the maps.
- Design ratchet: main 2.43.6 itself counts colour literals 2512 and px literals 25911 (PLAN3D-R28-UI, released before the ratchet
  reached main); this branch before the merge counted 2510 / 25763. The merged tree has exactly main's counts, so the wave-2
  branches add nothing. The baseline was raised to 2512 / 25911 with `--update --allow-raise` (only those two lines; native-dialog
  stays 3). Lead decision 14.11.2026 (answer a): kept. Reason: this is a sync of the baseline to the state of main at the moment the
  guard lands (PLAN3D-R28-UI shipped in 2.43.6 before the ratchet existed on main), not new debt. From the moment the guard is on
  main, any raise of the baseline needs the owner's approval.

## Follow-ups (lead decision 14.11.2026, answer b)

Both are behaviour changes, not merge resolutions. They go into ONE separate branch stacked on this one, started only AFTER
`CR-WAVE2-COMBINED-2439` has a GREEN entry check:
1. `routers/wiskey_lineage.py`: replace AUTH-REVOKE-GATE-2435's local `_gate` with `rbac.require_system_admin` (CR-ADMIN-GATE-2438),
   keeping the audit action, texts and status codes the lineage tests pin.
2. `services/notify_recipients.active_user_ids`: delegate to the shared active-user definition (`services/active_users.active_user_ids`,
   owner O16 a: disabled on either side is not active), as CR-RBAC-EVAL-2438 and CR-ACTIVE-USER-REST-2438 recorded.

## Re-checks

- Migrations: 216 files, contiguous, last `0216_review_indexes.sql`; no duplicate number, no new migration in wave 2.
- Bridge copies: `scripts/sync_integration.py --check` -> "integration mirror is up to date" (bridge 0.10.7).
- API inventory: `scripts/api_inventory.py` -> 1,908 routes, no diff.
- Design ratchet: `scripts/design_ratchet.py` -> no count above the baseline; native-dialog fell 20 -> 3 (CR-CONFIRM-DIALOG), so the
  baseline was lowered with `--update` (only that line changed).
- `scripts/release_check.py` -> "ready for the owner's approval" (2.43.5).

## Tests actually run (Windows workstation, loaded)

- `npx tsc --noEmit` (frontend): exit 0.
- `node --test scripts/sourcemaps-archive.test.mjs`: 5 passed.
- pytest (`.venv`, `-p no:xdist`, one file at a time) - every backend test file the merged branches added, plus `test_janitor.py`:
  32 files; first round 30 green, 2 red (items 3 and 4 above). After the fix:
  `test_router_common_helpers` 12 passed, `test_tickets_router_common_2438` 12 passed, `test_video_services_2431` 15 passed,
  `test_notify_recipients` 36 passed, `test_generator` 49 passed, `test_raw_body_order` 16 passed.
  The 30 green of the first round: active_user_rest 13, admin_gate 17, authorize_active 6, authrevoke 11, backend_safety 10,
  bill_ledger_lifecycle_b 25, bridge_gaps 8, build_guards 10, commit_release_limiter 2, core_helpers 14, device_http 17,
  device_http_pins 20, error_envelope_unexpected 6, go2rtc_owned_streams 21, ha_client 70, nvr_write_guard 10, path_confine 8
  (+1 skipped), rbac_eval 16, secret_files 15 (+1 skipped), session_cache 23, shutdown_safely 3, sync_gate_wait 3,
  tickets_erase_no_swallow 7, tickets_list_statement_guard 12, tickets_outbox_queue_index 6, tickets_timeutil 49, timeutil_formats 52,
  wiskey_limits_pins 39, wiskey_write_limits 13, janitor 12 (all passed).

NOT_RUN locally (the runner entry check runs them): the full backend suite, the Playwright specs added by the branches
(`unit-no-native-dialogs`, `unit-reconnecting-socket-2435`, `unit-session-me-failure-2435`, `unit-update-run-outage-2438`,
`evidence-confirm-dialog-2438`; they need a preview build), pixel / layout runs.

After the shutdown fix and the 2.43.6 merge (same workstation, one file at a time): `test_asgi_wiskey_295` 28 passed,
`test_wiskey_background` 18, `test_ha_sync_1000` 1, `test_shutdown_safely` 3, `test_fake_wiskey` 21, `test_intercom` 184,
`test_map3d_r28_settings_2433` 3, `test_build_guards_2438` 10 (all passed); tsc exit 0; `release_check` ready (2.43.6);
`sync_integration --check` up to date; API inventory 1,908 routes, no diff. The runner reproduction was NOT_RUN (the machine was
held by another entry check; `run_guarded` refused).

## Entry check 1 (`97080bbc4`, RED, 12 failures) - fixes

Runner verdict `~/smplwise-results/entry_pilot-CR-WAVE2-COMBINED-2439_97080bbc4.md`: 12 backend failures (all "failed twice"), the 26
Playwright items FLAKY only (passed alone). Every one is a merge interaction: a guard or a pin written before a wave-2 branch changed
the code it reads, and none of the wave-2 branches had run its own entry check (they were cancelled for this combined one). One is a
real product inefficiency that only the runner's clock shows (item 3). No guard was loosened; each change says why below.

1. `test_async_routes_no_inline_db::test_pending_offenders_are_fixed` (XPASS strict): the guard's `PENDING` entry
   `routers/wiskey_lineage.py::resolve` was fixed by AUTH-REVOKE-GATE-2435, merged here. As the guard's own docstring asks: `PENDING`
   emptied and the strict xfail mark removed (the test now asserts the list holds no live offender; the main guard is unchanged).
2. `test_capmap_295::test_the_receiver_source_is_the_one_the_vectors_were_made_from`: CR-TIMEUTIL-2438 replaced `trusted_caller.iso`'s
   body with the shared `timeutil.iso_utc` (same name). Read: both produce `YYYY-MM-DDTHH:MM:SSZ` from `astimezone(UTC)` for every aware
   datetime the module signs; nothing else in the file changed. Recorded as a REVIEWED_SUCCESSORS entry (old -> new hash, with the
   reason), the mechanism the test provides; WisKey's vectors file stays byte-identical. Once past it the same test found the second
   drifted source: `custom_components/smplwise_bridge/keyset.py` (CR-BRIDGE-GAPS-2438): `sign()` without a key raises `NoSigningKey`
   (a `ValueError` subclass, same text) and `handle_control()` (rotation) refuses a message with an answer's keys. `verify()` /
   `_check()`, the path `lease_contract.validate` takes for the vectors, is unchanged, and none of the 8 vector messages carries
   `reply_to` / `ok` (checked). Second REVIEWED_SUCCESSORS entry. `lease_contract.py` is unchanged; `ha_bridge.py` was already reviewed.
3. `test_core_helpers_2438::test_a_reused_lease_does_not_read_its_busy_timeout_back` (passes on Windows, fails on the runner):
   `_begin_immediate` shortened SQLite's busy_timeout to "budget minus the gate-queue wait" whenever that was below the full value. On
   Linux the uncontended BEGIN always measures a few microseconds, so every write ran `PRAGMA busy_timeout=9999` and `=10000` around
   `BEGIN IMMEDIATE` - exactly what CR-CORE-HELPERS (05:P3-04) meant to remove; Windows' coarse monotonic clock hid it. Product fix
   (`db.py`): a queue wait under `BUSY_SHORTEN_SLACK_MS` (50 ms) leaves busy_timeout as it is; the total wait can exceed the budget by
   at most 50 ms. A real queue wait (the review M3 case, `test_db_gate::test_one_attempt_never_waits_longer_than_the_busy_timeout`)
   is still shortened. Regression test `test_a_few_milliseconds_in_the_queue_do_not_shorten_the_busy_timeout` (a clock advancing 2 ms
   per read): fails without the fix on the workstation (`PRAGMA busy_timeout=9996`), passes with it.
4. `test_db_template::test_no_product_code_reads_the_schema_cookie`: CR-CORE-HELPERS-2438 added a second reader of
   `PRAGMA schema_version` in `db.py` (the `has_table` / `has_column` cache key) plus a comment naming it. The guard's rule ("the value
   never matters; only a same-file, same-process comparison") still holds: the key is (path, file identity, version), so a template
   copy or a restored file never shares an entry. Guard updated: comment lines are not reads, exactly two reads in `db.py`, the pool's
   `schema != seen` and the cache key's shape are both asserted.
5. `test_messaging_accounts_runtime::test_the_main_janitor_runs_the_step`, 6. `test_wiskey_adopt_2272_installer::
   test_start_up_activation_is_wired_and_gated`, 7. `test_tickets_s4_wiring::test_w14_w15_..._guards_the_janitor`: CR-JANITOR-REGISTRY-2438
   moved the housekeeping steps from `main.janitor_tick` into the `services/janitors.STEPS` registry; these three source pins still
   read `main.py`. They now check the registry: exactly one step with that target, its arguments, a failure text (= guarded), and that
   it resolves to the real function. The other halves (router include, `activate_software` at start-up, the listener in a worker
   thread) still read `main.py`.
8. `test_alarm::test_a_failure_inside_send_never_leaves_the_typed_slot_stuck`, 9. `test_nvr_stream_write_locks::
   test_busy_database_at_relock_leaves_the_pending_row_for_the_janitor`: both expected a raw `sqlite3.OperationalError("database is
   locked")` out of the TestClient. CR-MAIN-RUNTIME-2438 (05:P1-07, lead decision L1) answers it with the retryable envelope
   (500 `database_busy`, Retry-After). The tests now assert that envelope; what they protect (the typed slot released; the pending
   row left for the janitor and settled by a read) is unchanged and still asserted.
10. `test_no_ip_literals::test_no_unlisted_private_ip_literals`: `test_ha_client_2438.py` (CR-HA-CLIENT-2438) echoed a specific private address in a
    refusal text. Replaced with the RFC 5737 placeholder `192.0.2.9` (the assertions check the whole text and "rtsp", not the address).
11. `test_gate_always_run::test_every_package_scanner_is_listed_or_reviewed`: `test_active_user_rest_2438.py` (CR-ACTIVE-USER-REST-2438)
    walks the package (its no-drift guard) and was not listed. Added to `gate_always_run.json` "backend" with its reason.
12. `test_t06_admission_295::test_the_installed_client_sends_only_the_pinned_installation_and_read_commands`: CR-DEAD-CODE-BE-2438
    deleted `wiskey_auto_install.send_installed_template_v3` (no caller; `wiskey_wa_queue` sends `whatsapp/template_send_v3` itself,
    pinned in `test_the_2400_signing_callers_send_only_their_pinned_commands`). The module now puts one command fewer on the signing
    seam; the pin was narrowed to match (a tightening) and its docstring says why.

### Tests actually run for these fixes (Windows workstation, `.venv`, `-p no:xdist`, one file at a time)

- The 12 failing tests plus the new regression test, in one process before the keyset entry: 12 passed, 1 failed (`test_capmap_295`,
  the second drifted source, fixed next). The new regression test fails without the `db.py` fix and passes with it.
- Whole files after all fixes, every test passed (skips / xfails as before): `test_async_routes_no_inline_db`, `test_capmap_295`,
  `test_core_helpers_2438`, `test_db_template`, `test_messaging_accounts_runtime`, `test_wiskey_adopt_2272_installer` (3 skipped),
  `test_alarm`, `test_no_ip_literals`, `test_gate_always_run`, `test_nvr_stream_write_locks`, `test_t06_admission_295` (3 xfailed),
  `test_tickets_s4_wiring`, `test_ha_client_2438`, `test_db_gate`, `test_db_conn_pool`, `test_janitor`, `test_active_user_rest_2438`.
- `test_db_locking`: all passed except `test_ha_state_event_gives_up_within_the_busy_deadline` (1.3 s against its 0.9 s bound). It
  fails the same way with the `db.py` change stashed, so it is the loaded workstation, not this fix; it passed in the runner entry
  check at `97080bbc4`. The first `test_tickets_s4_wiring` run printed a thread dump at its end (machine load); the re-run passed (exit 0).
- NOT_RUN locally: the full backend suite, Playwright, pixel / layout runs (the runner entry check runs them).

### Follow-ups (unchanged decision: one separate branch stacked on this one, only AFTER a GREEN entry check; not implemented here)

- `routers/wiskey_lineage.py::_gate` -> `rbac.require_system_admin(conn, principal, action=..., text=..., request_id=_rid(request),
  resource_type="wiskey_lineage")`. Care: the lineage gate has a third step `require_system_admin` does not have - the
  `interactive_only` refusal for the three write actions - and its text depends on `interactive`. Keep that step in `_gate` after the
  shared call (same audit action, `resource_type="wiskey_lineage"`, reasons and Hebrew texts the lineage tests pin).
- `services/notify_recipients.active_user_ids` -> delegate to `services/active_users.active_user_ids` (owner O16 a). It feeds
  `expand`, `Known` and `active_principals`, so every alert module's recipients change for users disabled on the Home Assistant side
  only (they stop receiving). Other local copies of the same list exist and are a separate decision: `routers/access.py`,
  `services/tickets/store.py`, `services/tickets/store_rfq.py` (`CR-ACTIVE-USER-REST`'s no-drift guard only covers per-id reads).

## Entry check

Queued on the runner 14.11.2026 (`ENTRY_TOTAL_SECS=14400`, log `~/pre/entry_crw2comb.log`), position 10 of 10 behind a running
release gate. The 26 waiting individual entry checks of the merged branches were cancelled (SIGTERM to the waiting
`branch_check.sh` pid only; its EXIT trap removed the ticket). BACKEND-SAFETY, AUTH-REVOKE-GATE, TICKETS-PERF-ERASE and
SESSION-DEMO-WS had no waiting ticket (already GREEN on their own).
