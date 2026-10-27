# SPLITSWITCH2-297 - the emergency-buttons switch is a setting

Owner decision q48 (2026-10-27): both the door-window program switch and the emergency-buttons switch are selectable in Settings.

- New setting `doors.emergency.engine_switch` (default `on`; no migration: settings are key/value rows, an absent row reads as the default).
- It is a gate on top of the build, never an activation: `door_emergency.live_ok(conn)` = permit AND `EMERGENCY_ENGINE_BUILT` (or the legacy flag) AND the switch.
  The build constants stay off, so shipping this changes no live behaviour. Whether the build constants should now be turned on is a separate owner/lead activation decision.
- Who: only the installation settings-manage permission (`CONFIGURE` at the installation, a named person) via `PUT /doors/emergency/settings`; the generic settings endpoint cannot write it.
- Audit: every change writes `settings.changed` with who, when (audit `at`), `before`, `after`; refused attempts are written as `denied`.
- Turning it off: needs `confirm_engine_off: true` (the screen shows a plain Hebrew confirmation first); refused (409 `incident_active`) while an emergency is active, like the existing off rules; releasing an incident never reads the switch.
- Readers: `enabled()`, `open_enabled()`, `open_available()`, `settings_view()` and the update rules take the connection and honour the switch; turning `doors.emergency.enabled` / `open_enabled` on while the switch is off is refused (409 `engine_switch_off`). The stored values of those two are left untouched, so switching back on restores the earlier state.
- API additive: emergency settings gain `doors.emergency.engine_switch` and `build_ready` (permit + engine flag before the switch).
