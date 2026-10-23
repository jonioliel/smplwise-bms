# CR-QUIET103 - quiet mode for a floor or an area, one button, two hours

Board item r103. Branch `pilot/QUIET103-295` from `origin/main` (v2.12.3, c37c75c91). Migration **0148** (built as provisional 0155, renumbered at the 2.14.0 integration; one file,
`0148_quiet_windows.sql`). Status: slice 1 (backend) built; slices 2-4 are proposals.

## 1. Goal

A permitted person presses one button on a floor or an area and, for two hours, nobody is bothered there by informational notifications.
Safety and critical notifications are never muted (contract 7.3 and fix cad9f61ea). A lighting scenario that the owner or an administrator
configures may run with it (slice 3, behind its own default-OFF switch). Nothing is permanent: the window ends by itself and can be ended
explicitly.

## 2. Model

A **quiet window** is a row (`quiet_windows`): `scope_type` (`floor` | `area`), `scope_id` (floors.id | ha_areas.area_id), `floor_id` (the floor
judged for permission; an area with no floor = installation scope), `started_at`, `ends_at`, `started_by`, and, once over, `ended_at`,
`ended_by`, `end_reason` (`stopped` | `expired` | `switched_off`).

* **Active** means `ended_at IS NULL and started_at <= now < ends_at`. The end instant is decided by the clock. The janitor (30 s tick) only
  stamps the row afterwards (`expired`, `ended_at = ends_at`, an audit row); a late or failed janitor changes nothing about delivery.
* **Auto-expiry** is therefore exact to the second, restart-proof (state is in the database, nothing is a timer) and needs no scheduler thread.
* **Explicit end**: `POST /quiet/windows/{id}/stop`, same permission and same floor as the start.
* One active window per place: a second start answers 409 `already_active` (nothing is extended silently).
* Duration: default 120 min, 5 min to `max_minutes` (default 240). Settings are installation settings (section 6).

## 3. Suppressed and never suppressed

Suppression is applied in the one dispatch function (`notify_channels.dispatch`, through `Dispatch.held`), so every channel follows it: web push,
the phone app, e-mail, WhatsApp, and the spoken announcement. A held channel is logged as a skipped delivery with reason `quiet_window`; the
notification row itself is created as always and stays in the inbox. WhatsApp re-checks at send time (a window that began while the message
waited on pacing).

| Notification | Held in a window of its place? |
|---|---|
| severity `info` | yes |
| severity `alert` | no by default; yes when the administrator turns `quiet.windows.mute_alerts` on |
| severity `critical` | **never** |
| category `safety` (any severity) | **never** (same rule as `mobile_push.CRITICAL_CATEGORIES`) |
| an escalation re-send | **never** |
| a notification with no area (e.g. a camera row without one) | no (see question 4) |
| ticket / door / alarm rows | by the same severity rule; their category is not special-cased |

"Its place": the notification's `area_id` equals the area of an area window, or is an area whose `ha_areas.floor_id` is the floor of a floor
window.

## 4. Scenario action (lighting)

**Not built in slice 1.** The existing way to run a scene is the device-control path (`routers/ha.py`): per click, signed through the bridge,
idempotent per client request, with the runnable allowlist (SVCIDENT3), the door-chain refusal (a scene that reaches a lock), per-person grants and
a confirmation. A quiet window would have to start a scene from a service with no click, and the AGENTS.md rule is that no lighting actuation and no
blind retry of a physical command is added without an explicit task-specific approval; restoring the lights at the end would be a second unattended
command. Slice 3 proposes: the administrator picks one scene from the runnable allowlist per place (door-chain checked at save), a second switch
`quiet.windows.scenario` (default OFF), the scene runs once, on the press, **as the person who pressed** through the same path as a tile click (so
their grants apply), is never retried, and nothing runs at the end unless the administrator picks a second "end" scene by the same rules.

## 5. Permissions, scope, audit

* Start / stop: `devices.control` on the window's floor (operator and above); an area that is on no floor: the installation. A floor operator
  cannot start another floor, a viewer cannot start at all. No new permission and no new role in slice 1 (question 5).
* See the windows: `devices.read` on the window's floor.
* Settings: `system.configure`, with the explicit confirmation like the other installation switches.
* Audit rows: `quiet.window.started`, `quiet.window.stopped` (explicit or `switched_off`), `quiet.window.expired` (no actor), `settings.changed`
  with before / after, and the audited 403 of `devices.control` for a refused start or stop.
* Turning the master switch off ends every open window (`switched_off`); turning it on again never revives one.

## 6. Default OFF and interaction with the existing quiet hours

`quiet.windows.enabled` = off ships. With it off no window can start and a stored window is ignored. Settings:
`quiet.windows.default_minutes` (120), `quiet.windows.max_minutes` (240), `quiet.windows.mute_alerts` (off).
The installation **quiet hours** (22:00-07:00 and the severity x channel matrix) are untouched and independent: a channel is held when either rule
holds it. The window only ever adds holds, never releases one (an `alert` held by quiet hours stays held inside a window), and the two reasons
are logged separately (`quiet_hours` | `quiet_window`; when both apply, `quiet_window` is shown). The announcement channel's own quiet mode is
unchanged; the window adds its hold after it.

## 7. Routes (slice 1)

`GET /quiet/windows`, `POST /quiet/windows`, `POST /quiet/windows/{id}/stop`, `GET /quiet/settings`, `PUT /quiet/settings`. No frontend.

## 8. Tests (`tests/test_quiet103.py`, targeted)

Shipped off; settings validation / permission / confirmation / audit; info held only in the window's area or floor and only for its time; no area
is not held; critical, safety (also at info severity) and escalation never held, also with `mute_alerts` on; `alert` held only when turned on;
expiry exact at the end instant with the janitor not run, then the janitor stamps once (idempotent); explicit stop; duplicate start; duration
limits; switching off ends windows; permission and scope matrix (other floor, viewer, no binding, area on no floor, unknown place, stop by
others, list visibility); restart persistence (second app on the same database).

## 9. Slices

1. Backend (this change): model, routes, suppression, expiry, audit, tests.
2. Frontend: the one-button on the floor / area header, the countdown and "end now", the delivery-log wording for `quiet_window`, a settings card.
3. Scenario action (section 4), after the owner's approval of the design.
4. Optional: a banner in the notification centre ("quiet in <place> until 14:00"), and the push relay's app card.

Rollback: run the previous version (the table is ignored); or set `quiet.windows.enabled` off.

## 10. Owner questions (recommendation first)

1. What does "informational" mean? **Recommended: severity info only** (alerts such as a door left open still come through); alternative: info and
   alert (the `mute_alerts` switch, already built, default off).
2. A second press while a window is active? **Recommended: refuse with "already active" and offer "end now"**; alternative: extend by two hours.
3. Longest window? **Recommended: 4 hours** (two-hour default); alternative: up to 12.
4. A notification that has no area (a camera row, a system row) while its floor is quiet? **Recommended: not muted** (no guessing); alternative:
   map a camera to its floor through its map anchor in slice 2.
5. Who may press? **Recommended: anyone who already controls devices on that floor** (operator and above); alternative: a new permission
   `quiet.manage`, assigned per role.
6. Should e-mail and WhatsApp be muted too, or only the phone/browser push? **Recommended: all channels, as built**, because a window that mutes
   only the push is surprising; the inbox always keeps everything.
7. Scenario at the end of the window: restore the lights, or nothing? **Recommended: nothing in the first version** (see section 4).
