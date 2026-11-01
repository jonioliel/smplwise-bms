# SWITCH-LIGHT-DIMMER-2331 - no dimmer on an on/off light; switches in the synoptic lights column; the floor lights popup

Branch `fix/SWITCH-LIGHT-DIMMER-2331`, cut from `origin/main` @ `52a8d9129` (v2.33.0 + test fixes). No version bump, not merged.
Fakes and mocks only: no Home Assistant, relay, light or recorder was contacted. No migration (one new `ui.xs` key with a default,
two new count keys, one new card-row field, one new optional query / body field).

## 1. The report (owner 2026-11-01)

The owner's parking lights are relay switches (`switch.*`). Since 2.32.1 (SWITCH-AS-LIGHT, merge `fdf0d2aac`) he typed them as
"תאורה" (Settings › כללי › חשמל והתקנים › סוגי התקנים) so the synoptic map counts them. Each such card then showed a brightness
slider (the blue bar under the toggle) although the device is on/off only.

### Root cause

The slider was drawn from per-screen guesses, none of which asked whether the entity takes a brightness:

| Place | Old condition | Effect |
|---|---|---|
| Lights panel (`devices-tiles-panel.ts`, the "תאורה" tile / area KPI) | `kind === 'lights' && r.color_mode !== 'onoff'` | A switch typed as a light is listed there since 2.32.1; its row has no `color_mode` (undefined !== 'onoff') -> slider. **The reported bug.** |
| Area tile (`devices-area.ts` renderTile) | `card === 'lighting'` and on | every on light, also an on/off-only light (`supported_color_modes: [onoff]`, e.g. HA "show as light") |
| Quick sheet (`area-quick-sheet.ts`) | `card === 'lighting' && brightness_pct !== undefined` | the server sends `brightness_pct: null` for an on/off light, so it passed |
| Bubble pill / sheet (`devices-area-bubble.ts`) | `domain === 'light' && brightness_pct != null` | right for switches, wrong for an on/off light that reports a brightness |

The server did not keep `supported_color_modes` (not in `ha_sync.ATTR_ALLOW`), so no screen could know.

### Fix

- `services/ha_sync.py`: `supported_color_modes` is kept.
- `services/devices.is_dimmable(e)`: a `light.*` whose supported colour modes include one other than `onoff`; with no modes
  reported, a colour mode other than `onoff`, a brightness, or the legacy `SUPPORT_BRIGHTNESS` bit. Never a switch / input_boolean.
  Every lighting card row (area cards, the lights panel) carries `dimmable`; a switch typed as a light carries `dimmable: false`.
- `frontend/src/api/devices.ts isDimmable(r)`: the ONE gate. `light.*` only; the server's `dimmable` decides; an older server or a
  demo row without the field keeps the old behaviour (dimmable unless `color_mode === 'onoff'`). Used by every slider: area tile,
  quick sheet, lights panel, bubble pill and bubble sheet, and inside `DeviceControls.renderBrightnessSlider` / `brightness()` itself
  (a non-dimmable device is never sent `light.turn_on` with a brightness). Skins and the phone draw through these same paths.
- The light look stays: a switch typed as a light keeps its place with the lights, the bulb icon and the warm card; only the slider goes.
- An entity stored before this change has no `supported_color_modes` until its next state push or snapshot: an OFF light with no
  other evidence reads as not dimmable until then (no slider rather than a wrong one).

## 2. The synoptic lights column

Verified on the real data path (`load_entities` -> `device_type_set` from `device_type_override` -> `build_tree` -> `count_into`):
a switch typed as a light is in `lights` / `lights_on`, an ON one counts as lit (`tests/test_devices.py
::test_switch_entities_counted_for_the_synoptic_all_switches_option`). No fix was needed there.

New option "מפסקים בעמודת התאורה" (`ui.xs.syn_switches`, Settings › כללי › חתך הבניין והמפה הסינופטית, group "מפה סינופטית"):

| Value | Label | Lights column |
|---|---|---|
| `typed` (default) | רק מפסקים שהוגדרו כתאורה | the server's lights (light.* + switches typed as a light) |
| `all` | כל המפסקים | + every other `switch.*` (never an input_boolean helper) |

The tree's counts gain `switch_entities` / `switch_entities_on` (the `switch.*` part of `switches`); the board and the
cross-section add them under `all` (`xs-model.areaLights`). Stored the same way as every `ui.xs` key (PATCH /settings, validated
by `services/xs_options.py`, refused values are a 422, a value stored before the key existed reads as `typed`).

## 3. The floor lights popup (owner request 2026-11-01, same branch)

A press on a floor's lights strip or lights count opens the floor's lights:

- **Where:** the synoptic board (the light cell of a row) and the cross-section on the floors screen (the facade strip or the
  "8/8" chip of a row; a press elsewhere on the row still selects the floor). Keyboard: the selected floor's detail line (synoptic)
  and the selected floor's actions (floors screen) carry a "תאורה בקומה" button. Not on the wall screen.
- **What:** the existing lights panel (`devices-tiles-panel`, `sw-drawer modal`: side panel on desktop/tablet, bottom sheet on a
  phone, focus trapped, Escape closes, focus returns) narrowed to the home-system areas our floor stands for (its match:
  `xs-model.floorLightsTarget` - one home-system floor -> that floor's scope, so a floor-scoped user can act; several -> the
  building, narrowed). Rows grouped by area, each with its state, toggle and - only when `isDimmable` - the slider. Under
  "כל המפסקים" every `switch.*` is listed too (`GET /devices/items?kind=lights&switches=all`).
- **Actions:** "הדלק הכל" / "כבה הכל" (`pairedMaster`) for the shown set, through the existing bulk flow (preview with `only` =
  the shown rows, the confirmation dialog with the count, the run, the per-device result naming every device that did not confirm,
  audit). `switches=all` on `GET /devices/actions/preview` / `POST /devices/actions` lets the lights kinds reach every `switch.*` -
  through the same SwitchPolicy (a protected switch, the door layer and alarm-managed devices stay out and are named), lights kinds
  only (422 otherwise), recorded in the audit details. Without `devices.control_bulk` in the scope (or in the demo) the two buttons
  are shown disabled with the reason in the tooltip; a row without control says why, as in the panel everywhere.
- **Live:** the panel follows state pushes in place; after a command the board / section re-read their counts.
- The phone's side tiles of the cross-section do not open the popup (the synoptic board and the floor's button do).

## 4. Files

Backend: `services/devices.py` (is_dimmable, `dimmable` on rows, switch_entities counts, build_items switches), `services/ha_sync.py`
(ATTR_ALLOW), `services/device_bulk.py` (`switches` in resolve / `_kind_reaches`), `services/xs_options.py` (syn_switches),
`routers/devices.py` (`switches` on items / preview / run). Tests: `tests/test_devices.py`, `tests/test_xs_options.py`.

Frontend: `api/devices.ts` (isDimmable, types, getDeviceItems switches), `api/device-bulk.ts`, `screens/devices-bulk.ts`,
`screens/devices-controls.ts`, `screens/devices-area.ts`, `screens/area-quick-sheet.ts`, `screens/devices-area-bubble.ts`,
`screens/devices-tiles-panel.ts` (area filter, switches, paired actions, heading), `screens/devices-synoptic.ts`,
`screens/explore-floors.ts`, `screens/system-xs-options.ts`, `xsection/xs-model.ts`, `xsection/sw-xsection.ts`,
`i18n/xsection.ts`. Tests: `tests/unit-switch-light-dimmer-2331.spec.ts`, `tests/evidence-switch-light-dimmer-2331.spec.ts`.

## 5. Tests

See the closing report of the branch for the exact runs and totals. Evidence screenshots: `docs/evidence/SWITCH-LIGHT-DIMMER-2331/`
(mocked backend on a `vite preview` build, desktop / tablet / mobile).

## 6. Pixel baselines likely affected (refresh on the runner)

- Any baseline with a lights panel row of a switch typed as a light (none in the demo data) or an on/off-only light: the slider goes.
- Area-screen baselines whose mock lighting rows are on with `brightness_pct: null` and no `dimmable` field: unchanged (the fallback
  keeps the slider for a light without `color_mode: 'onoff'`).
- Synoptic board / cross-section: no layout change (the light cell keeps its markup plus a data attribute and a pointer cursor;
  the hover tint shows only under the pointer). The floors screen's selected-floor actions gain the "תאורה בקומה" button when the
  floor has lights: the floors-screen baselines with a selected floor (e.g. `evidence-xsection-synoptic`, `evidence-synoptic-ha-2310`
  "floors + section" in the demo) are likely to change.
- The xs settings card gains one select ("מפסקים בעמודת התאורה"): settings-card baselines (`evidence-syn-columns-2321` settings shot).

## 7. Rollback

Revert the branch commits. The count keys, the row field and the query / body field are additive. One caveat: an older build's
`xs_options.normalize` refuses an unknown key, so a stored `ui.xs` that holds `syn_switches` reads there as all defaults (the
corrupt-value path) until the options card is saved once (it sends only the keys that build knows).
