# SPLITSWITCH-297 - door-window programs and emergency buttons: two independent engine flags

Owner decision 2026-10-27. Branch `pilot/SPLITSWITCH-297` (from `pilot/WISKEY-OWNER26-297`). Answers owner26 question 3
(`OWNER26_ADOPTION_RECEIPT.md` section 6): "split `LIVE_ENGINE_BUILT` into a program flag and an emergency flag" - option (a).

## What changed

| Before | After |
| --- | --- |
| `door_windows_engine.LIVE_ENGINE_BUILT` (one build flag) turned on BOTH the door-window program engine (time windows written to WisKey) and the emergency-button engine | `PROGRAM_ENGINE_BUILT` and `EMERGENCY_ENGINE_BUILT`, independent, both **False** (off) |
| readers: `live_ready()` / `live_engine_built()` | window factory and windows routes read `program_ready()`; `door_emergency.live_ok()` reads `emergency_ready()` |

- `LIVE_ENGINE_BUILT` stays as the **legacy combined flag**: a build that sets it True turns both engines on, exactly as before.
  This is the upgrade path ("copy the old value to both new switches") without a migration: the flags are build constants, not
  installation settings, so there is no DB row to copy and no migration number is used.
- `live_ready()` / `live_engine_built()` are kept for compatibility and now mean "both engines on"; nothing in the backend reads them.
- The installation switches `doors.windows.enabled` and `doors.emergency.enabled` were already separate and are unchanged (both off).
- `GO_LIVE_PERMITTED` still gates both engines; no permit and no activation constant was flipped.

## API (backward compatible, additive)

- `GET /doors/windows/settings`: `go_live_permitted` = `program_ready()`; new `program_engine_built`.
- `GET /doors/windows/state`: `go_live_permitted` = `program_ready()`.
- `GET /doors/emergency/settings`: `go_live_permitted` = `emergency_ready()`; `live_engine_built` kept (now the emergency engine's flag);
  new `emergency_engine_built`.

## UI

Door windows > Settings: the windows section shows its own read-only notice (`sProgramsGoLiveNo`, he/en/ar/ru) when the program engine
is not on, independent of the emergency section's existing notice (`sGoLiveNo`). No new admin toggle: activation stays a build decision.

## Tests

- Backend: `smplwise_vms/backend/tests/test_splitswitch_297.py` (shipped off, legacy flag keeps both on, each flag alone, permit, API).
- UI: `frontend/tests/evidence-doorwin-295.spec.ts` - the windows notice, and a programs-on / emergency-off independence case.
- Fakes only: no WisKey, no door action.

## Activation status

`scripts/eccact_activation_status.py` lists `door_windows_program_engine`, `door_emergency_engine` and `door_engine_legacy_combined`.
