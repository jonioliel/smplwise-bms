# FIX-SERVER-CLOCK-2560 - command expiries on the server clock, bounded on the server, no stale resend after step-up

Row of the 2.56 final deep review (physical-action safety). Findings: VD-01, VD-03 (`DEEP-REVIEW-2560-VIDEO-DEVICES.md`), FE-01,
FE-03, FE-04 (`DEEP-REVIEW-2560-FRONTEND-CORE.md`), WA-01 (`DEEP-REVIEW-2560-WISKEY-ACCESS.md`) and the out-of-area note
"`routers/ha.py` has no upper bound on `expires_at`; `api/ha.ts:207` and `notifications.ts:1216` use the device clock".
Base: `origin/release/2560-train` at `3739e3ded`. Every finding was confirmed at the base before the fix.

## What changed

### Client stamps on the server clock (VD-01, VD-03, FE-04, WA-01)
`serverNow()` (`api/server-clock.ts`, TIME-CORRECT-2540) replaces `Date.now()` in every client-stamped command expiry that was
left on the device clock:
- `api/alarm.ts` `envelope()` - arm, disarm, zone bypass (60 s);
- `api/ha.ts` `runAction` - every HA entity action, the WisKey door tile included (60 s);
- `api/notifications.ts` `commandEnvelope` - the door release from a notification (15 s);
- `api/media-players.ts` `expiry()` (now exported; `sendQueueEdit` uses it too), `api/media-screens.ts` `expiry()`,
  `components/media-bulk-dialog.ts`, `components/media-group-dialog.ts`, `home/home-p3.ts`, `home/home-p3-media.ts` (15 s).

Deadlines the server set, counted down on the device:
- `door-windows/emergency.ts` - the emergency sheet's 20 s confirm window (WA-01);
- `screens/wiskey-bulk-people.ts` - the verified people-CSV confirm button (`canConfirm(..., serverNow())`);
- `screens/wiskey-profiles.ts` - a review's seconds left.

### Clock samples (FE-03)
`noteServerTime` ignores a sample whose round trip is over `SAMPLE_MAX_RTT_MS` (2 s) - a phone that slept with a request in flight no
longer moves the offset by minutes. Among usable samples the one with the smallest error (half the round trip, + 0.5 s for a `Date`
header) is kept; a kept sample older than `SAMPLE_FRESH_MS` (60 s, or a device clock that jumped by more) gives way to any usable one,
so a header may replace an old body sample. Exported API unchanged (`serverNow`, `serverOffset`, `noteServerTime`, `noteDateHeader`,
`resetServerClock`).

### No stale resend after step-up (FE-01)
`api/client.ts` `fetchApi`: a physical action (`PHYSICAL_STEP_UP_ACTIONS`: `door.open`, `alarm.disarm`, `alarm.bypass`) refused
403 `step_up_required` and confirmed in the dialog is re-sent with its `expires_at` rebuilt: the same life it was given (the stamp
minus the server-clock instant of the call, at most 5 min) counted from now on the server clock. The `client_request_id` and every
other field stay (the refused attempt was never recorded; the same id keeps a doubled press harmless). A body whose expiry cannot be
rebuilt (not a JSON object, unreadable `expires_at`, already spent when stamped) is not re-sent at all: the call answers 409
`step_up_confirmed_press_again` with "האישור נקלט. לחצו שוב כדי לבצע את הפעולה." / "Confirmed. Press again to carry out the
action." (`retryable: true`). A body without `expires_at` is re-sent as before; the SCR-23 120 s replay window is unchanged; a
non-physical action is still re-sent byte for byte. New export: `freshEnvelope(body, stampedAt, now)`.

### Server upper bound
`POST /api/v1/ha/entities/{id}/actions` checked only "not expired". Now an `expires_at` more than `EXPIRY_MAX_S` = 300 s ahead
(the alarm route's 5 minutes) is refused 422 `expires_too_far` ("תוקף הבקשה חייב להסתיים תוך 300 שניות.", English from the existing
template), before the idempotency lookup and before anything is sent. The WisKey door tile (`open_from_tile`, reached by the same
route before the generic check) has the same bound (`TILE_EXPIRY_MAX_S` = 300 s): the refusal is one audited `intercom.release`
`refused` row, nothing sent. Every other route that takes a client `expires_at` already enforced both bounds (alarm 5 min; WisKey
command / station people / devices bulk / media commands, queue, groups, bulk 60 s) - checked, unchanged.

Tests that posted a fixed `"2099-01-01T00:00:00Z"` to these routes (22 backend files) now use `support.waiting.soon()` (60 s ahead).

## Tests

New: `frontend/tests/unit-fix-server-clock-2560.spec.ts` (device clock -2 min and +2 min for the alarm, HA entity actions,
notification door release, media commands, emergency / CSV / profile deadlines; FE-03 sample rules; FE-01 door release confirmed
20 s later and alarm disarm 70 s later re-sent with a fresh expiry; the non-rebuildable body not re-sent; `freshEnvelope`;
a scan for device-clock expiry stamps) and `smplwise_vms/backend/tests/test_fix_server_clock_2560.py` (entity action and door tile:
10 min / 1 day / 1 year ahead -> 422 `expires_too_far`, past -> 409, 60 s / 4 min -> accepted, the tile refusal audited).

### Results (runner, 27.11, jobs `p2520_fsc_run.sh` / `p2520_fsc_run2.sh`, head `f5c6f3c2f`)

| Check | Before (base sources + the new tests) | After (this branch) |
|---|---|---|
| `tests/unit-fix-server-clock-2560.spec.ts` | 17 failed, 1 passed (the passing one is the "non-physical action re-sent byte for byte" guard) | 18 passed |
| `tests/test_fix_server_clock_2560.py` | 3 failed (no `EXPIRY_MAX_S`; 10 min ahead answered 202 for the entity action and the door tile) | 3 passed |
| Frontend unit: the new spec + `unit-time-correct-2540`, `unit-client-resilience-2540`, `unit-step-up-client`, `unit-people-csv-verify`, `unit-building-scope-control-2351`, `unit-i18n-api-2442`, `unit-i18n-en-ratchet-2490`, `unit-i18n-lang-packs-2443` | - | 104 passed |
| `tsc --noEmit -p tsconfig.json`, `-p tsconfig.tests.json`; eslint on the 14 changed sources | - | exit 0 |
| Backend, one process per file: the 22 test files moved to `soon()` (`test_alarm` 38, `test_building_scope_single_2351` 7, `test_card1_equipment_path` 14, `test_devices` 64, `test_door_bridge_block_2404` 21, `test_ha` 5, `test_ha_adapters` 3, `test_ha_authority` 3, `test_kiosk_role` 1, `test_lat1_toggle_latency` 6, `test_media_commands` 59, `test_media_review_fixes` 17, `test_outage_run_t035` 15, `test_plan_circuits_search` 6, `test_rbac_matrix` 2, `test_remote_access` 66, `test_security_review_wxd_fixes` 23, `test_service_identity` 47, `test_wiskey_d6_d8` 15, `test_wiskey_door_gate` 11, `test_wiskey_door_inventory` 13, `test_wiskey_door_path` 18) | - | all passed |
| ruff (F) on the changed backend files | - | clean (the touched test files keep their pre-existing F811 / F401 findings) |

The first backend run hit "database or disk is full" on the runner (its root file system was at 100 %, not caused by this job); the
twelve files affected were re-run one at a time and passed (table above).

NOT_RUN: the full backend suite, the Playwright browser specs and pixel baselines (no look changed: the only new text is the
"confirmed - press again" error line, shown by the existing error display); the release gate.
