# CR-027 — Plan Studio advanced (room ↔ area links, the live plan where people work, own floor images, 3D round 2, phone pass, editor leftovers)

Status: implemented on `pilot/K88-plan-studio-advanced` (base `origin/main` 2.0.0, f9576923), target release 2.0.1.
Owner decisions of 2026-10-04 applied (`private/plan3d/OWNER_ANSWERS_2026-10-04.md`; section 7). Related: CR-003 (Plan
Studio), CR-006 (3D visual level; 2c is delivered here without AI), CR-007 §7 item 1 (the room ↔ area link),
`docs/design/MOBILE_AUDIT_2026-09-30_HE.md` recommendations 2, 3 and 5.

## 1. What it does

1. **Room ↔ area link.** A plan room (`spatial_zones`) may point at one area of the device tree. Two ways to set it:
   the editor's room panel ("אזור בעץ ההתקנים") and הגדרות › מפה › "קישור חדרים לאזורים" - one row per room with the
   best name match as a suggestion, tick + "אשר הצעות", a select per row, "נתק". The link is local: the platform's
   registry is never written (spec §12: "חיבור HA Area לחדר הוא אפשרות נפרדת").
2. **"הצג על המפה" both ways.** The device tree's area rows and the area page carry the link to the room on the map
   (`#/explore/floors/<floor>?zone=<room>`); a room tap on the map opens the room card with "פתח אזור".
3. **The live plan where people work** (setting `plan.surfaces`, default both): a third view "תוכנית" in חשמל והתקנים
   (the floors tree stays at the side; a room tap opens the area's summary popover with its actions, "פתח אזור" and
   "הצג על המפה"), and a card "על התוכנית" on the area page with the room focused.
4. **Own floor images (no AI).** An administrator uploads per floor one picture (PNG/JPEG, 12 MB, 36 MP) and optionally a
   lights-on variant, aligns it once by its four corners over the plan's rooms and walls, sets its opacity. The map draws
   the base picture under the state layer and the lit variant clipped to the rooms the state layer says are lit. A "תמונת
   הקומה" layer toggle; backup covers the files.
5. **3D round 2.** Night mode (a chip in the 3D bar: dark sky, a moon instead of the sun, the lit rooms glow; stored per
   browser, never the default - the pixel baselines keep the day look) and a floor strip beside the 3D view with state
   dots (lit · presence · open) that switches floors and keeps the 3D view.
6. **Phone pass.** The map's side list is a bottom sheet (38 % / 78 % with the grabber), the selection bar one thin row,
   the tool row fades at its edges, a short landscape viewport drops the title block and keeps the map.
7. **Editor leftovers.** Structure history with "שחזר מבנה" (the API existed since 0.1.82), calibration with up to four
   pairs (the residual is shown), the import wizard publishes through a preview (carried / needs-alignment items).

## 2. Data

Migration `0056_plan_area_links_floor_images.sql`: `spatial_zones.ha_area_id TEXT` (plain id; the area registry is
rewritten whole on every refresh, so a dangling id reads as unlinked and the table marks it), `floor_images` (one row per
floor and variant, `path` relative to the data dir under `plans/floor-images/<floor>/`), `floor_image_layout` (the four
corners and the opacity, one per floor). Backup: both tables in `PROJECT_TABLES`, `floor_images.path` in `FILE_COLUMNS`;
the plan root already covers the files.

## 3. API

| Route | Permission | Notes |
|---|---|---|
| `PATCH /zones/{id}` with `area_id` | placement.edit (floor) | `""` unlinks; an unknown area answers 422 |
| `GET /plan/areas?floor_id=` | placement.edit (floor or installation) | the room panel's choices |
| `GET /plan/area-links?floor_id=` | placement.edit | rows, suggestions (exact 1.0 · contains 0.8 · token overlap ≥ ½), counts |
| `POST /plan/area-links` | placement.edit on every touched floor | bulk set / clear; optional `revision` lock; one audit row `zone.area_links` |
| `GET /floors/{id}/images` | map.read | both variants and the layout |
| `GET /floors/{id}/images/{off\|on}` | map.read | the file |
| `POST /floors/{id}/images` (multipart `variant`, `file`) | map.edit | body limit 12 MB + slack; PNG/JPEG sniffed, decoded whole |
| `PUT /floors/{id}/images/layout` | map.edit | four corners in [-1, 2], opacity 0.2-1; 409 without an image |
| `DELETE /floors/{id}/images/{variant}` | map.edit | the layout goes with the last image |
| `GET /floors/{id}/map` | map.read | now carries `floor_images` (urls, corners, opacity) |
| `GET /devices/tree`, `GET /devices/areas/{id}` | devices.read | areas carry `map: {floor_id, zone_id} \| null` |
| `PATCH /settings` `plan.surfaces` | system.configure | list of `devices` / `area` |

## 4. Not built (and why)

- Animated presence rings (Q4: the lead's recommendation was night mode + the floor strip; the owner agreed).
- The map chrome in the chosen look / dark mode (Q5 = ב: with the design unification).
- Exports / packages, the eye-level walk-through, DWG / IFC, floor-level unification (Q6 = א: frozen).
- Perspective correction of a photographed model: the alignment is affine (least squares over the four corners); the
  stage reports the residual so the administrator sees how far a perspective picture is off. A straight render aligns exactly.
- A phone editor (the audit's decision stands: the editor is a desktop tool; the floor-image card hides on a phone).

## 5. Tests

Backend: `tests/test_plan_area_links.py` (matching, the table, bulk apply with the revision lock, dangling links, the
tree's map pointer, permissions, the setting), `tests/test_floor_images.py` (upload / replace / delete, refusals, limits,
confinement, body limit, permissions, backup round trip). Frontend: `tests/unit-floor-image.spec.ts` (the alignment
maths), `tests/evidence-k88-plan-advanced.spec.ts` on `tests/k88-mocks.ts` (the map's room card and picture layer, the
area page, the building plan view, the settings tab, the phone sheet and landscape, the 3D night chip; desktop + mobile).
