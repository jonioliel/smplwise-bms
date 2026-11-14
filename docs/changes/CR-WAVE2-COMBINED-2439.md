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

## Entry check

Queued on the runner 14.11.2026 (`ENTRY_TOTAL_SECS=14400`, log `~/pre/entry_crw2comb.log`), position 10 of 10 behind a running
release gate. The 26 waiting individual entry checks of the merged branches were cancelled (SIGTERM to the waiting
`branch_check.sh` pid only; its EXIT trap removed the ticket). BACKEND-SAFETY, AUTH-REVOKE-GATE, TICKETS-PERF-ERASE and
SESSION-DEMO-WS had no waiting ticket (already GREEN on their own).
