# CR-038 slice 3 - the device integration: implementation notes

Branch `pilot/TICKETS-s3`, cut from `origin/pilot/TICKETS-s1` (`02f6a57a`). Spec: `docs/changes/CR-038-TICKETS-MODULE.md` on
`origin/pilot/TICKETS-spec` (r2.7) - section 12 (device integration), D3 / D17 / D23 / D33, section 8 "Device tab", 8.1, 14.1, 14.2 and the
slice table row 3. This file records what slice 3 delivers, the readings taken where the spec met the code (the safest one each time) and
the shared-file lines the integration has to merge.

## 1. What slice 3 delivers

**Place of a device (12.2)** - `services/tickets/place.py locate_entity()`: the current map anchor -> floor / building / site (soft-deleted
rows ignored); the room is the smallest room polygon of that floor containing the anchor (the `correlation._zone_at` rule, keeping the room
id); several anchors: the lowest floor level is the place and the other floors are named in `place_text` ("... (+ <floor>)"); without an
anchor: the room linked to the entity's HA area (`plan_area_links.area_to_zone`); else the HA floor / area NAMES only - such a ticket stays
placeless for RBAC (HA areas are labels, never a scope - `services/ha_scope.py`). `place_text` = "<floor> · <room>" with the building first
only when the site has several buildings.

**Who may read a device in the module** - `device_context.readable_entity()`: `devices.read` at the entity's placement (the rule of every
devices route), `alarm.view` too for an alarm panel, and for a lock / alarm panel a permission that OPERATES it
(`device_activity.SECURITY_PERMISSIONS`, the rule of `GET /devices/{id}/activity`). One function gates the device tab, device-originated
creation, the history preview and the history on a ticket's detail.

**The frozen 24 h history (12.3)** - `device_context.capture()` as the creator: tracked domains from `device_activity.list_activity` (24 h,
200 rows), other entities from `ha_state_history` (200 rows); each line keeps time, kind, before / after scalars, changed keys and the
actor's TYPE - the actor's name only when it is not a person (an automation, a scene); sources, person names, refs and attribute dumps are
dropped. `truncated` when the window held more. Stored in `ticket_device_context` (0079) and never altered afterwards; a `device_context`
timeline row and the `ticket.create` audit row carry only counts and the source.

**Device-originated creation** - `create_ticket()` accepts `entity_id` (origin `device`): an entity the creator cannot read answers 422
`entity_id: unknown` (never 403 - the device's existence does not leak); the place is resolved server-side and `tickets.create` is then
required WHERE the ticket lies (403 otherwise); a manager creating with an assignment must hold view + manage there too (checked before any
write). `POST /tickets` takes `entity_id` and answers `open_for_entity` (the other open tickets of the device the caller may see).

**The device tab route** - `GET /tickets/by-entity/{entity_id}`: module (router gate) -> `tickets.view` (audited 403) -> the device
(`readable_entity`, else the uniform 404) -> the visibility rule per ticket (`access.visible_for_entity`, by `registry_id` first, then
`entity_id`: a renamed entity keeps its tickets). Answers the items (open first, newest first), `open_count`, `can_create`
(tickets.create where the ticket would lie and a department the caller may open in), `place_text` and - only with `can_create` - the
history preview (`device_context.summary`).

**History on a ticket** - `GET /tickets/{id}` carries `device_context` only for a viewer of the internal content (members, managers,
all-departments) who may read the device too; `shareable` tells slices 4 / 7 whether it may ever reach a handler.

**D3 / D23 server rules (the handler page is slice 4)** - `device_context.EXTERNAL_HISTORY_NEVER` = lock, alarm_control_panel, cover,
camera; `share_history_allowed()` and `resolve_share_history()` (per ticket -> contact -> department default, always False for those
domains and for a withheld / empty snapshot). Slice 4 calls `resolve_share_history` when it stores `ticket_assignments.share_history`.

**D17 long-press setting** - `tickets.settings.device_long_press` (`sheet` default | `menu`), edited in Settings > the module > כללי
(display card, `system.configure`); `/me` carries `modules.tickets_long_press`.

**Frontend** - `tickets/device-entry.ts` (the 12.1 matrix as pure functions), `components/device-activity-press.ts` (every catalogued row is
tagged while the entry exists, `tracked: false` for untracked ones; the long press follows the matrix; right click / menu key / Shift+F10 as
before), `components/device-activity.ts` (computed tabs with "{tickets}" LAST and its open count; the opaque menu extended; the create form
over the window), `tickets/device-tickets-tab.ts`, `tickets/ticket-device-context.ts` (create-sheet device block with the device's open
tickets first and the history line; the history section of a ticket), `tickets/ticket-count-chip.ts` (map card chip + entry),
`tickets/device-text.ts` (the slice's own catalogue, D33 tokens, he + en).

## 2. The 12.1 matrix as built

| Situation | Tracked device | Other catalogued device |
|---|---|---|
| Module off, or no `tickets.view` / `devices.read` | as today: window on activity (two tabs); right click = today's two items | as today: no gesture |
| Module on, `sheet` (default) | window on activity; tabs פעילות · תזמונים · "{tickets}" (last, open count); right click adds "פתיחת {ticket}" | window with the "{tickets}" tab only; right click: "פתיחת {ticket}", "ה{tickets} של הרכיב" |
| Module on, `menu` | menu: פתיחת המכשיר* · היסטוריה · תזמונים · ─ · פתיחת {ticket} · ה{tickets} של הרכיב (count) | menu: פתיחת המכשיר* · ─ · פתיחת {ticket} · ה{tickets} של הרכיב |

`*` only where the host row has an OPEN tap action of its own (a plain row pill, which fires `activate`); never on a tile whose tap would
toggle the device. "פתיחת {ticket}" needs `tickets.create`. Alt+Enter opens the window on its first tab. The menu is the existing
`renderMenu` popup (`--sw-menu-surface`, no blur), RTL-aligned to the press point, arrows / Escape / outside tap.

## 3. Readings taken

1. **Menu order and the schedules item.** D17 lists four items; the existing right-click menu has "תזמונים" too and the approved mock-up
   keeps it (device · history · schedules · divider · new · list). Kept: removing a working item from today's menu is a regression.
   "היסטוריה" is the label in mode `menu` (the same menu for the long press and the right click); "פעילות" stays in mode `sheet`.
2. **"פתיחת המכשיר" = the host's own tap action** (spec) - only plain row pills have an "open" action; tiles and rows of the area screen have
   none (their tap targets are the inner toggle / slider), so the item is absent there rather than doing nothing or toggling a device.
3. **The device tab follows the activity route's rule for locks / alarm panels** (spec section 8 "Device tab"): a viewer who reads a lock
   but does not operate it gets no tab, no menu item and 422 on creation. The same function decides the snapshot, so `withheld='permission'`
   can only appear for a snapshot taken by a code path that skips that gate (none in release 1; the field is kept for phase 2).
4. **The place of an entity on two floors is the lowest floor** (12.2). A creator who reads the device only on the higher floor and holds
   `tickets.create` only there is refused (403); choosing a per-creator floor would make the ticket's place depend on who opened it.
5. **History preview lives in the create sheet** (14.2), not in the tab (clean operator screen: the tab is the list and one button). The
   mock-up's chart is not built; the sheet shows one line ("תצורף היסטוריה של 24 שעות · N שינויים").
6. **The map card opens the window with the "{tickets}" tab only**: the floor map knows no `activity` flag, so it never offers the activity
   tab from there; the count chip renders only when > 0. Markers get no long press (12.1).
7. **Category preselect by domain** uses `ticket_categories.domains_json` (0079), now served in `GET /tickets/meta` as `domains`; editing it is
   slice 2's department screen.
8. **The D23 checkbox UI** belongs to the contact branch of the assign dialog (slice 4); slice 3 delivers the server rule and the
   `device_context.shareable` flag the dialog needs.
10. **Which rows get the gesture** - exactly the hosts' existing `data-activity` sites (12.1: "no host change beyond `activityTag()`"): the
    area screen's tiles and rows, the bubble pills and the tiles panel. The area's main sensors strip has no such site, so a sensor there
    has no long press (its tile in the sensors card, when the card is shown, has one). A follow-up can add the strip if the owner wants it.
11. **Menu placement** - with the module on, the menu grows from the press point towards the inline end (RTL: its right edge at the
    finger), clamped inside the viewport; with the module off the placement is unchanged.
12. **Timeline** - the creation of a device ticket adds a `device_context` row ("צורפה היסטוריית המכשיר · N שינויים"; counts only).
9. **Assignment history order** - `store.assignments` ordered same-second rows by their random id; now by insertion order (rowid). It made
   `test_tickets_api::test_assignment_rules` flaky.

## 4. Shared files (one-liners for the integration)

- `services/tickets/settings_doc.py` (slice 2's): one SCHEMA line `("device_long_press",): ("sheet", _choice("sheet", "menu"))`.
- `routers/tickets_admin.py`: `SettingsBody.device_long_press` (one field) + two lines in `put_settings` adding it to the patch.
- `routers/me.py`: the `modules` line gains `"tickets_long_press": ...` and one import line.
- `routers/tickets.py`: `ENTITY` pattern, `CreateBody.entity_id`, `open_for_entity` in the create answer, `domains` in meta categories, the
  new `GET /tickets/by-entity/{entity_id}` (declared before `/tickets/{ticket_id}`), two imports.
- `services/tickets/access.py`: `visible_for_entity()` (additive); `store.py`: a "devices" section (additive) + the rowid order;
  `present.py`: `entity_id` on items and `device_context` on the detail; `create.py`: the device branch.
- Frontend: `api/types.ts` (`modules.tickets_long_press`), `api/tickets.ts` / `tickets-mock.ts` (types, `byEntity`, `saveSettings(extra)`),
  `tickets/ticket-create.ts` (`device` property), `tickets/ticket-detail.ts` (the history section, two lines + styles),
  `screens/system-tickets.ts` (the D17 row), `screens/explore-floor-map.ts` (chip + entry, imports).
- Tests touched: `test_tickets_admin.py` / `test_tickets_naming.py` exact-document asserts gain the new key; the bypass guard of
  `test_tickets_visibility.py` names `entity_ticket_rows_unchecked`.
- NOT touched: `roles.json`, `rbac.py`, `routers/access.py`, migration 0079, `shell/nav.ts`, `sw-app.ts`, `tickets/text.ts`.

## 5. Tests

Backend `tests/test_tickets_device.py` (13): place resolution, snapshot (names removed, frozen, state history, truncation), creation gates
(unknown / hidden device, lock rule, tickets.create at the place), `open_for_entity`, the by-entity gate order (module, permission, device,
per ticket, rename), the detail's history visibility, D3 / D23 rules, the D17 setting and `/me`, meta domains. Frontend
`tests/unit-tickets-device.spec.ts` (the matrix row by row, tags, D33 catalogue + rename, history wording) and
`tests/evidence-tickets-device.spec.ts` (behaviour per matrix row, create flow, both modes in the five skins with the opaque-menu check,
layout guard 320-1440, evidence images in `docs/design/evidence/tickets-s3/`).
