# DOORLIVE-2310: the door engines are wired into the regular release (switches OFF)

Branch `pilot/DOOR-ENGINE-LIVE-2310`, cut from origin/main (2.27.2). Owner decisions of 2026-10-30 (private planning notes) are binding:
host-timer relock accepted; programs and emergency OPEN together; regular release with OFF switches; LOCK hidden until a command exists; no read-only
probe of a real WisKey now; `door_automation` in scope. Target release 2.31.0 together with WisKey 2.0.1-rc.3.

## What is wired

| Feature | Build flag (now True) | Owner switches (all OFF by default) | Live path |
|---|---|---|---|
| Door-window programs | `door_windows_engine.PROGRAM_ENGINE_BUILT` | `doors.windows.enabled` (+ a rule per door, interior doors first) | `WiskeyProgramEngine` -> `DirectProgramEngine` -> selected join only (list / save / pause) |
| Emergency OPEN | `door_windows_engine.EMERGENCY_ENGINE_BUILT` | `doors.emergency.enabled`, `doors.emergency.open_enabled` (+ the life-safety attestation); `doors.emergency.engine_switch` is the kill switch (default on, only ever turns things off) | `door_engine_live.LiveEmergencyEngine` -> `DirectEmergencyEngine` (wiskey-emergency-event.v2) while the join selects `features/start` |
| Door automation | `door_automation.GO_LIVE_PERMITTED` (now True) | `doors.automation_open` (kill: `doors.automation_kill`) | `NativeDoorSender` over `features/start`, selected join only |

* `services/door_engine_live.py` is installed from `main.py` right after `wiskey_direct_join.startup` (`door_engine_live.startup`). It changes no switch.
* Without a selected direct connection nothing is sent: `not_sent transport_not_selected`; nothing is queued or retried blindly after a reconnect.
* LOCK (`lock_secure`): `lock_supported = False` on the live engines. `GET /doors/emergency/state` reports `can.lock = false` and no lock scopes, `prepare` and `start` of
  a real LOCK answer 409 `lock_unavailable`. Drills (simulation) and the release of an existing LOCK are unchanged.
* Release is never gated by a switch, a permit or the attestation (E-01, DW-05). Per-call deadline (8 s), two-step + hold confirmation, audit, permissions and SR-1 are unchanged.
* Startup reconcile (plan G6): a real incident still active at process start is audited (`door.emergency.reconcile`), flagged `active.verify_required` in the state API and
  announced (`door.emergency.verify`, critical). Nothing is re-sent. Resolved when the incident ends.
* Link-lost alert (plan G10): the door-windows worker calls `door_engine_live.tick`; while a real incident is active and the access link cannot be (re)opened it raises
  `door.emergency.link_lost` once per incident and resolves it when the link is back. Reads and notifies only.
* `door_engine_live.readiness(conn, settings)`: read-only dict of flags, switches and wiring (not yet exposed by a route or a screen).

## Rollback
Switches off (instant). Layer 2: set `PROGRAM_ENGINE_BUILT` / `EMERGENCY_ENGINE_BUILT` / `door_automation.GO_LIVE_PERMITTED` to False per feature. No migration.

## Still blocked on WisKey (NOT proven, nothing run against a real WisKey)
* `selected(command)` for `stations/technical_program_*` and `features/start` / `features/result` on a real rc.3 (G3), selection ON for the commands.
* No `lock_secure` command in v2 (LOCK stays hidden).
* Relock contract at the end of a hold-open window: the host timer is accepted by the owner; what the door does when HA / WisKey drops or restarts inside a window is unknown (G5).
* No read command for the status of an emergency event after a restart (G6 on the WisKey side); `physical_result` is always `unknown` (a receipt is not a physical confirmation, G12).
* Safety-advisor wording of the attestation (G14) and UI wording "receipt is not a physical confirmation".
