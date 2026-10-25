# EMROLE-295: the emergency-open role for people who are not system administrators

Owner decisions (2026-10-24, binding); builds on WKOPENUNK-295 (the explicit retry-open after an UNKNOWN). Review 3 DW-07 / question 4 asked whether the built-in
`emergency_open` role may be given to non-administrators; the answer is yes, with the controls below.

1. The built-in `emergency_open` role (permission `access.emergency.open`) is assignable to a guard, a temporary guard, a reception desk clerk. Nothing about the permission,
   the station chain, the two-step confirmation, the hold, the rate limits or the switches changed.
2. Who may GRANT it: a system administrator, and a holder of the new built-in `security_manager` role (name_he "אחראי ביטחון"; permissions `access.read`,
   `access.stations.read`, `emergency.open.grant`). `emergency.open.grant` is sensitive, never implied, not delegable, and opens ONE module: `POST /doors/emergency/grants`
   creates a binding of the role `emergency_open` and nothing else - no other role, no deny, no `rbac.assign`, never to oneself, never above the maximum expiry. A security
   manager acts only inside the scope where the permission is held (installation / site / building). `rbac.delegable_roles` is untouched.
3. EXPIRY: the grant is an ordinary binding with `expires_at`; `rbac._active_bindings` drops an expired binding on every authorization, so the server enforces it at use time
   (emergency start, retry-open, the state `can` flags) without a sweeper. Defaults: 24 h offered when none is named; a security manager is bound by `max_hours` (168) and
   cannot grant without an expiry; only a system administrator may grant with no expiry (or beyond the maximum, up to 10 years).
4. RETRY-OPEN (`POST /doors/emergency/incidents/{id}/retry-open`): system administrators OR holders of `access.emergency.open` at the incident's scope and at the door's
   station (deny wins), while `doors.emergency.retry_open.by_holders` is on. Unchanged: the door's name typed each time (`confirm_door_required`), one at a time
   (`retry_in_progress`), 10 s apart (`too_soon`), only an UNKNOWN apply row, live non-drill OPEN incidents only, never automatic (`DW09_OPEN_RETRY_AFTER_UNKNOWN` stays False),
   never a replay, a still-live earlier attempt is never retried. The refusal code for a non-holder is `retry_not_allowed` (was `admin_only`). The audit row
   `door.emergency.retry_open` now also carries `actor_basis`, `actor_roles` (the actor's active roles with scope and expiry) and `emergency_open_holders` (ids only, capped 25).
5. SETTINGS (all in `/doors/emergency/settings`, system administrators, every change a `settings.changed` audit row): `doors.emergency.grant.default_hours` (24; 0 = none
   offered), `doors.emergency.grant.max_hours` (168), `doors.emergency.grant.by_security_manager` (on), `doors.emergency.retry_open.by_holders` (on). The permission of each
   role stays editable in the role editor (a custom role may name `emergency.open.grant` as a sensitive permission).

API: `GET /doors/emergency/grants` (holders, people, places; administrators and security managers), `POST /doors/emergency/grants`, `POST /doors/emergency/grants/{id}/revoke`;
`GET /doors/emergency/state` gains `can.grant` and `active.can_retry_open` now means "administrator or role holder". Audit: `door.emergency.grant`, `door.emergency.grant_revoke`
(plus the generic `rbac.bind` / `rbac.unbind` rows), refusals as `denied` rows with the code.

UI: the door-windows screen shows "emergency-open holders" to whoever `can.grant` (a list with expiry, one form, revoke with a second click) and four fields in the settings drawer.
No hints or badges on operator screens. Strings in he / en / ar / ru (ar / ru are the usual initial translations needing native review).

No migration. Fakes only: no door, station, installation or Home Assistant change. Not covered: a local (Arx-only) identity holds exactly ONE binding (USR2), so it can receive this
role only if it has no other; the screen is reachable only while the doors tab is on (`doors.ui.tab`).
