# CR-007 — Electricity and device control area: floors → areas → per-domain cards, bulk actions, screens and remotes, editable layouts, two styles

**Numbering:** registered as CR-007 on 2026-09-28 (CR-005 WisKey phase 2 and CR-006 3D visuals are in progress).

**Status:** Approved for development by the owner on 2026-09-28 after reviewing the mockup
(`https://claude.ai/artifact/6NnnMPQR62w3mqyNwGjtwZ`, 6 boards). Build order in §5; the open items in §7 are
decided by default as the mockup shows them, since the owner approved the mockup with those assumptions written
on it - each can still be changed by the owner at any time.

## 1. The request (owner, 2026-09-28, translated)

A new top-level area "חשמל והתקנים" (electricity / device control): a tree of floors and the areas inside them;
choosing an area opens a screen like the DomusUI room screen (cards per device type: climate, sensors, switches,
security with camera still and lock, media, lights, shutters), "as visual and convenient as possible", for
controlling one area or looking at the whole building - what is on, turn everything off, and so on. Later
messages added: per-floor and per-area "turn off" with a visible popover/menu; air-conditioning and shutters
simulated in full; a separate screen for TV screens and projection with a remote control (the owner will send an
explanation of how these are to be implemented - HDMI-CEC / IP / HA media_player - before that slice is built);
easy editing of the screens (positions, sizes, text sizes, colours, titles); a choice between the SMPLWISE style
and a style close to DomusUI's, both with RTL. The owner's reference is DomusUI (https://github.com/Mattia2399/DomusUI,
GPL-3.0 - ideas and structure, no code copying); its extraction is `docs/integrations/domusui/DOMUSUI_EXTRACTION.md`.
Navigation note from the owner: SMPLWISE has a side rail, not a top bar - the mockup's top bar is only a
placeholder; the real screens live under the existing shell (icon rail in design A, flat entry in design B, as
WisKey does).

## 2. Facts that shape the design

- HA already holds the structure: floor, area, device and entity registries. `services/ha_sync.py:352-356`
  already fetches all four; `routers/ha.py` already serves entities (`GET /ha/entities`), a per-entity action
  with the confirmation envelope (`POST /ha/entities/{id}/actions`, 202 + `GET /ha/actions/{id}`), and a live
  WebSocket (`/ha/ws`) scoped by the caller's floor bindings. CR-007 composes these; it does not add a second HA
  connection.
- DomusUI (extraction §data flow): rooms come from HA's area/floor registries; cards are per HA domain
  (light, switch, fan, humidifier, climate, alarm, lock, cover, camera, media_player, vacuum, sensor); state
  updates are optimistic with a per-domain confirmation timeout and rollback; there is **no area-wide or
  building-wide action** at all - every command targets one entity. Its still/"live" camera is MJPEG through HA
  (we keep go2rtc, CR-005 decision). Its lock unlock is a 1 s hold or a slide with a browser-side code check; ours
  keeps server-side confirmation (CR-005 pattern). It has **no RTL support**; its look is iOS "liquid glass" with
  the system font.
- Plan Studio rooms (T039) are polygons on our plans; HA areas are the owner's own naming. The tree uses HA
  floors/areas as the source of truth for structure and names (that is what the owner's screenshot shows), with an
  optional link from a Plan Studio room to an HA area so "show on the map" works both ways (§7.1).

## 3. Architecture

- **Backend** (`routers/devices.py`, `services/devices.py`): `GET /devices/tree` (floors → areas with live counts:
  lights on, switches on, covers open, climate active, screens on, alarm state, locks), `GET /devices/areas/{area_id}`
  (entities of the area grouped into cards by domain/device_class, with the fields each card needs),
  `GET /devices/building` (the same counts for the whole installation). Live updates ride the existing `/ha/ws`
  notices. Entity → card rules (DomusUI's, adapted): `light`→תאורה, `switch`/`input_boolean`→מתגים, `climate`→מיזוג,
  `cover`→תריסים, `lock`/`alarm_control_panel`/`camera`/`binary_sensor` (door, window, motion, ...)→אבטחה,
  `media_player`→מסכים והקרנה, `sensor`/other `binary_sensor`→חיישנים, `fan`/`humidifier`→אקלים. An entity with no
  area is listed under "ללא שיוך" with an assign action (writes `entity_registry/update area_id` through the
  bridge - a config write, audited).
- **Actions.** Single entity: reuse `POST /ha/entities/{id}/actions` (one tap, optimistic in the UI, confirmed by
  the HA state change, rolled back on timeout - the DomusUI pattern, our existing envelope). Bulk: new
  `POST /devices/actions` with `{scope: building|floor|area, id, kind: lights_off|covers_close|climate_off|
  screens_off|all_off, confirmed: true, client_request_id, expires_at}` - server-enforced confirmation, one audit
  attempt row before sending, per-entity outcome rows, the result reported honestly per entity (accepted / not
  confirmed / unknown), never "everything is off" unless every entity confirmed. Locks, alarm and door release
  are never part of a bulk action.
- **Permissions** (new, registered like `access.read`/`access.release`): `devices.read`
  (viewer and above, like `map.read`; scoped like `map.read`/`entity.state.read` - held at installation scope it
  covers everything, held by a floor binding it narrows the tree and the area cards to the entities placed on those
  floors, exactly as `/ha/entities` does; the nav entry is therefore not installation-only, unlike WisKey's -
  coordinator ruling on the slice-1 review, 2026-09-28), `devices.control` (single-entity one-tap actions on light,
  switch, input_boolean, cover, climate, fan and media_player only; operator, site_admin, system_admin - see §7.7),
  `devices.control_bulk` (floor/area/building actions; site_admin + system_admin, in the sensitive list).
  Locks/alarm keep their own gates (`access.release` for WisKey doors; HA lock, alarm panel, siren, script, scene
  and button entities stay behind `ha.entity.control` - `devices.control` never reaches them, §7.7 - plus the server
  confirmation and, for unlock / disarm, `door.unlock` / `alarm.disarm`).
- **Layout editor** (§5 slice 6): per-area card layout (order, span, title, title size, colours, text size,
  visible entities, visibility) stored per installation with per-device variants (desktop/tablet/phone), a
  "default" that returns to the automatic layout, undo/redo in the session, `map.edit`-tier permission
  (`devices.layout`, site_admin+). Not a free-form page builder: a 12-column grid of cards, like the mockup.
- **Styles.** Two token sets behind the existing design-token system: "SMPLWISE" (current tokens) and "Glass"
  (dark backdrop gradient, blurred translucent surfaces, 2rem radii, system font, iOS-like accent/success),
  chosen per user with an installation default; both fully RTL. The glass style is our own token set inspired by
  DomusUI's look, not its CSS.
- **Screens and remotes** (§5 slice 5): waits for the owner's explanation of the hardware; the mockup shows the
  target (device list per floor, sources, projection actions, a remote whose buttons follow what HA exposes).

## 4. Deliberately different from DomusUI

Bulk actions with server-side confirmation and honest per-entity outcomes (DomusUI has none); RTL from day one;
our RBAC instead of HA admin/non-admin; camera stills through go2rtc; lock actions confirmed server-side; layouts
stored in our database (DomusUI stores its layout in HA `frontend/*_system_data`).

## 5. Build order (each slice: implementer → reviewer → fix round → release, as CR-005)

| Slice | Scope | Estimate |
|---|---|---|
| 1 | Read-only: `devices.read`, tree + area screen with automatic cards, building counts, live updates, nav entry in both designs, phone layout | 1.5-3 h, 1-2 reviews |
| 2 | Single-entity control: lights/switches/covers/climate one-tap + sliders via the existing action envelope, optimistic UI with confirmation/rollback, `devices.control` | 2-3 h, 2 reviews |
| 3 | Bulk actions: floor menu, area popover, building buttons, `devices.control_bulk`, confirmation, per-entity outcomes, audit | 3-4 h, 2-3 reviews (safety) |
| 4 | Climate and covers in full (modes, fan, tilt, group control), sensors card, "ללא שיוך" assign | 2-3 h, 1-2 reviews |
| 5 | Screens and projection + remote (after the owner's explanation) | 3-5 h, 2 reviews |
| 6 | Layout editor + style selector (glass tokens, RTL) | 5-8 h, 2-3 reviews |

## 6. Scope impact

New router/service, three permissions, a `device_layouts` table (slice 6), a second token set, a new nav area
in both designs, tests: backend (tree/area projection, permission gates, bulk safety), live Playwright against the
existing HA fixture. No device access beyond HA's own service calls; no WisKey changes.

## 7. Defaults taken from the approved mockup (owner may override)

1. Areas and floors come from HA's registries; Plan Studio rooms link to an HA area (optional) for "show on the map".
2. Entity → card assignment is automatic by domain/device_class, correctable per entity.
3. "Turn everything off" (building/floor/area) requires a confirmation dialog; a single switch is one tap.
4. Entities without an area appear under "ללא שיוך" with an assign action (hidden for viewers without `devices.control`).
5. Permission defaults as in §3 (viewer reads; operator controls single entities; site_admin+ bulk and layout).
   `devices.read` follows the holder's scope: installation-wide sees the whole building, a floor binding sees only
   what is placed on those floors (slice 1, recorded 2026-09-28).
6. Style: SMPLWISE by default; glass selectable per user.
7. `devices.control` (coordinator ruling on the slice-2 review, 2026-09-28): granted by default to operator,
   site_admin and system_admin - NOT editor, keeping the recorded decision (routers/access.py, access.release) that
   editor's permissions are content authoring and it holds no control permission at all; not viewer, not kiosk. A
   caller who passes the action route only through `devices.control` reaches the domains light, switch,
   input_boolean, cover, climate, fan and media_player - never lock, alarm_control_panel, siren, script, scene or
   button, which stay behind `ha.entity.control` (an audited 403 otherwise; `ha.entity.control` keeps every right it
   had before this slice).
8. Cover movement is one physical action whichever control starts it (coordinator ruling on the slice-2 review,
   2026-09-28): `cover.set_cover_position` has the same "attention" risk as open / close, so the position slider arms
   on release and runs on a confirming tap (the server insists on the confirmation), rather than open / close being
   loosened. Stop stays routine and is never disabled, least of all while the cover moves.
9. Honesty of the optimistic UI (slice-2 review): the row's text is always what Home Assistant last reported; a
   pending command shows a visible "ממתין לאישור" line and its target only on the control itself. An action is
   "confirmed" only when HA reported the effect - the state, or the attribute that carries it (`current_position`,
   `percentage` within the fan's step, `temperature`, `fan_mode`, `is_volume_muted`); an action with nothing
   observable (stop, a target temperature on an entity without a single `temperature`, mute on a player that does
   not report it) is shown as "נשלח" (sent), never as confirmed. The HA-side bridge allow-list is 0.2.4 (the new
   services), and a backend test now fails whenever the add-on's allow-list holds an action the bridge's does not.

## 8. Next step

Slice 1 dispatched 2026-09-28 from this document; the DomusUI extraction is the reference for card rules and
copy, the mockup for layout.
