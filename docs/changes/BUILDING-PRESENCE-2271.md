# BUILDING-PRESENCE-2271 - building presence source for the cockpit (board r339, phase 1)

Plan: `private/planning/PLAN_R339_BUILDING_PRESENCE_2026-10-28.md`. Owner decisions applied (all option A / recommended): anonymous room and
building occupancy from presence sensors the owner tags in Arx settings, no change in the automation host, invisible when nothing is tagged,
cockpit "empty for N minutes" trigger + "occupied" condition, settings list + overview chip, new permission `presence.building.view`,
live state only (no history). Branch `pilot/BUILDING-PRESENCE-2271`, cut from `origin/release/2271-assembly`.

## What is built

- Migration `0184_building_presence.sql` (renumbered from the provisional 0183 at the 2.28.0 train integration): table `presence_building_sensors`
  (entity id, who tagged, when). No person, no history.
- `services/building_presence.py`: candidates (binary sensors with device class occupancy / presence / motion / moving - the Shelly presence
  and motion sensors), the live aggregate per sensor, room (the sensor's area) and building. Rules: `on` = occupied; `off` stays occupied for
  `hold_seconds` (debounce, default 60); `unavailable` / `unknown` / missing / mirror not fresh = unknown and never read as empty; a room or
  the building is clear only when every sensor is clear. `empty_since` / `empty_minutes` / `empty_reached` use the configurable
  `empty_minutes` timeout (default 10). Sensors without an area count at building level only.
- `routers/building_presence.py` (+ `contracts/API_INVENTORY.md`): `GET /presence/building` (`presence.building.view`, any scope; answers
  `configured: false` while nothing is tagged), `GET|PUT /presence/building/sensors` and `PUT /presence/building/settings` (`system.configure`,
  audited `presence.building.tag` / `presence.building.settings`, entity ids only). The read is not audited (anonymous, polled).
- Permission `presence.building.view`: `roles.json` and `contracts/examples/role-catalog.design.json` (site_admin, system_admin), label in
  `PERMISSION_LABELS`. Not sensitive.
- Cockpit (`services/building_presence_blocks.py`, wired in `automation_model.py` / `automation_text.py` / `automation_scope.py` /
  `automation_ops.py` / `automation_ext.py`): typed trigger `building_empty` (minutes) and typed condition `room_occupied` (mode occupied |
  empty, sensors). They compile to PLAIN automation config (a fixed template over the tagged sensors, `for` = N minutes) - nothing is created
  in the automation host. They exist only while sensors are tagged (`ModelContext.presence_sensors`); any hand-edited template stays locked.
  Hebrew sentences, validation codes `presence_*`, the editors' catalogue extension carries `building_presence.sensors` (additive).
- Frontend: `api/building-presence.ts` (+ `-logic.ts`, `i18n/building-presence.ts`), `<building-presence-chip>` (last quiet part of the
  overview's thin bar, hidden unless tagged + permitted, green only when occupied, hidden on phones like the alarm part) and
  `<system-building-presence>` (a card at the end of the mobile-app settings general page: sensors grouped by room with a check each, hold and
  empty-timeout numbers).

## Checks run (local, no runner, no gate)

See the final report of the agent. Tests: `smplwise_vms/backend/tests/test_building_presence_2271.py`,
`test_building_presence_cockpit_2271.py`, `frontend/tests/unit-building-presence-logic.spec.ts`.

## Not done / next steps

1. **Cockpit editor UI (needs the mockup + owner approval, frozen structure):** the TypeScript twin of the block model
   (`frontend/src/api/automations.ts`, `automations-mock.ts`) and the block forms (`screens/automation-block-forms.ts`,
   `automation-editor-logic.ts`) do not know `building_empty` / `room_occupied` yet. Until then a saved step of this shape reads as a
   locked template in the UI (backend read/write/validate is complete and tested). Add the two entries to the trigger and condition pickers
   in the approved order, using `catalog.extension.building_presence.sensors`.
2. **Plan legend ("tagged only" filter):** not done; it touches `map/room-state.ts` / `sw-plan-3d.ts` / canvas and a legend that does not exist
   as a component today. Needs the mockup.
3. **Placement of the settings card:** it is appended to the mobile-app settings general page (no new tab or menu). Move it if the mockup puts it
   under security or devices; the component is self-contained.
4. **Mockup** (settings card + chip) in the infra-screens style, then the screenshot spec (`evidence-*.spec.ts`) - NOT_RUN, needs the runner.
5. **Entity to room:** uses the sensor's area from the mirror. If the plan's room binding should win, map through the placement tables and
   keep "building level only" for unplaced sensors.
6. **Migration number:** confirmed as 0184 at the 2.28.0 train integration.
7. **Phase 2 (owner decision pending):** phone-app aggregate count, door "last entry", identity - separate privacy decision; not started.
8. `management/tasks.json` / `test_catalog.json` entries + `python scripts/project_status.py --write` - not done (the lead owns the board).
