# WXPERM - access-control permissions for any role (owner decisions 2026-10-13)

Branch `pilot/WXPERM`, cut from `origin/integ/249` @ `7b9b63e7`. Fakes only: no WisKey, station, door, phone, WhatsApp
account or Home Assistant was contacted; no test executes a physical door action. No migration.

## 1. Audit: every access-control gate is a permission check

| Path | Gate (permission) | Role-name check? |
|---|---|---|
| Door release `POST /intercom/stations/{id}/release`, devices tile `lock.unlock` of a WisKey lock, notification deep link, door path / run guard | `services/door_authority.check`: `access.doors.open` on the station chain (legacy `access.release` through the role expansion) or `door.unlock` on the mapped lock; deny of either wins | Restriction only: a wall-display account (enabled wall profile or a `kiosk` binding) is refused (SEC-WXD L1). Kept: it identifies an unattended screen, it grants nothing |
| Call signal / announcement / TTS engines (`/intercom/stations/{id}/call`, `/tts`, `/intercom/tts/engines`) | `access.call` anywhere, then on the station chain | none |
| Talk (`/access-control/stations/{id}/talk`, its stop and socket) and the station media view | view: `access.read` on the station; talk: `access.call` on the station chain (+ the `access.station_media` mode); live video: `video.live` on the station chain | none |
| People create / edit / delete / archive / active / temporary cancel / cards / photo | `access.people.manage` anywhere, then every station of the person; sensitive fields `access.people.sensitive` | none |
| PIN generate | `access.people.manage` + `access.pin.generate` (+ interactive session) | none |
| Card capture (start / status / cancel / confirm / readers) | `access.people.manage` + `access.cards.capture` | none |
| WhatsApp (`/access-control/messaging`, recipients, person messages, opt-out, send) | `access.people.message` (station chain per recipient); settings `system.configure` | none |
| Reads (`/access-control/*`, `/intercom/people`, `/intercom/events`, overview, background, ws) | `access.read`, `access.stations.read`, `access.events.read`, `access.events.export`, `access.people.read`, `access.admin.read` | none |
| Door-grant card (`/access/door-grants*`) | `rbac.roles.manage`, or a delegated administrator when `door_opener` is on the delegation allow-list | The card hands out the built-in `door_opener` role (it is a role-assignment card); the built-in answer "never" for viewer / kiosk is display text. Kept |
| Bulk operations | `devices.control_bulk`, `media.bulk` (no access-control bulk route exists) | none |
| Frontend: nav (`shell/nav.ts` TAB_PERMISSIONS / NATIVE_WISKEY_TABS), stations screen, entry center, people screen, message dialog | permissions only (`can` / `canAnywhere`); the door button follows the server's per-station `door_access` answer | none (`system-access.ts` shows the doors sub-tab to a delegated administrator when `door_opener` is assignable - mirrors the server's card rule) |

Role-name checks found outside the access-control area are restrictions or settings, not grants, and were left as they are:
`NEVER_DELEGABLE` (delegation never hands out `system_admin` / `site_admin`), `system_admin` bound at installation scope only,
`automations.code_view_roles` (an administrator setting), generator alert routing by role (an administrator choice),
`rbac.is_system_admin` (the wizard's administrator count and directory sync). No grant anywhere depends on a role name.

## 2. Permissions and default grants

| Permission | Built-in default | Sensitive | Station scope | Notes |
|---|---|---|---|---|
| `access.doors.open` (NEW, "פתיחת דלתות") | site_admin, system_admin, door_opener | yes | yes | door only: no call, announcement, entry log, people directory or message |
| `access.release` (LEGACY) | none | yes | yes | old name of `access.doors.open`; honoured in custom roles (section 3) |
| `access.call` | operator, site_admin, system_admin | yes | yes | calls, announcements, talk (2.4.9) |
| `access.people.manage` | site_admin, system_admin | yes | yes | |
| `access.people.message` | site_admin, system_admin | yes | yes | owner rule: part of every built-in default set that has `access.people.manage`; separately assignable |
| `access.pin.generate`, `access.cards.capture` | site_admin, system_admin | yes | yes | each needs `access.people.manage` too |
| `access.people.sensitive`, `access.events.export`, `access.admin.read` | site_admin, system_admin | export / sensitive: yes | yes | |
| `access.read` | viewer, operator, editor, site_admin, system_admin, door_opener | no | yes | |
| `access.stations.read`, `access.events.read`, `access.people.read` | operator, site_admin, system_admin | no | yes | |
| `access.schedules.manage`, `access.stations.manage`, `access.groups.manage` | system_admin | yes | - | catalogue entries for the write phase |

None of them is a system permission, so a custom role may carry any of them (sensitive ones in its explicit sensitive list).
The role editor lists them in its two existing groups ("הרשאות רגילות" / "הרשאות רגישות") with the Hebrew labels of
`routers/access.py` PERMISSION_LABELS; the legacy `access.release` is listed only for a role that already holds it.

## 3. Compatibility rule (no migration, no silent change of access)

- `rbac.LEGACY_PERMISSIONS = {"access.release": "access.doors.open"}`. A role that lists `access.release` holds
  `access.doors.open` too (`rbac.custom_roles` expands it, so every check through `role_permissions` - authorize, the
  permissions anywhere, delegation, station-scope bindings - sees it). One direction only: `access.doors.open` never implies
  `access.release`.
- Allows: a custom role saved with `access.release` keeps opening exactly the doors it opened before.
- Denies: a deny binding of such a role takes `access.doors.open` away too, so every existing deny keeps refusing the door.
  A deny of a built-in role (site_admin, door_opener) now names `access.doors.open` directly.
- Built-in roles: `access.release` was replaced by `access.doors.open` in exactly the roles that held it (site_admin,
  system_admin, door_opener). Nothing else changed in any built-in role.
- Audit: the door rows' `granted_by` is `access.doors.open`, or `access.release` when the grant came ONLY through the legacy
  name (so an administrator can find roles still riding it); the door gate's refusal is audited as `access.doors.open` denied
  (it was `access.release`).
- Role edits: the impact preview compares expanded sets, so saving a legacy role unchanged reports nothing removed; replacing
  `access.release` with `access.doors.open` reports only the old name removed and keeps the door.
- Door-grant card: "on" adds `access.doors.open` (nothing when the legacy name is already there); "off" removes both names.
- Frontend: `/me` lists `access.doors.open` for a legacy role; the screens accept either name (`DOOR_PERMISSIONS`) so an older
  backend's answer still shows the door; the server's door rule decides every open.

## 4. Responsible person
Unchanged: `responsible_person` and `access_purpose` stay sensitive fields (`intercom_writes.SENSITIVE_FIELDS`), so a
names-level manager (people.manage without people.sensitive) cannot set them, and WisKey refuses a visitor / contractor
without a responsible person (`guest_responsible_required`).

## 5. Tests
`smplwise_vms/backend/tests/test_access_permissions_wxperm.py` (default grant sets, per-role regression, owner rule, legacy
allow / deny / edit / card / notification link, custom-role matrix "only X does only X", door-only role); updated pins in
`test_intercom.py`, `test_intercom_authority.py`, `test_wiskey_door_path.py`, `test_wiskey_door_gate.py`,
`test_security_review_wxd_fixes.py`; frontend `tests/unit-role-editor-legacy.spec.ts` and `unit-wiskey-stations.spec.ts`.
