# XS-MINI-WIDGET-2351 - the mini building cross-section on the home widgets row

Branch `pilot/XS-MINI-WIDGET-2351`, cut from `origin/release/2350-train`. Owner follow-up: a compact building cross-section among the
home widgets. No migration, no new route, no new permission, no new setting key (the widget is one more entry of `home.widgets`).

## What it is

A home widget named "חתך בניין" (id `xsection`), selectable in the home edit panel and in the personal home panel, **off by default**.
It draws one building as a stack of slabs, top floor first, with a ground line between the floors above and below ground:

- each slab is tinted by the share of the floor's lights that are on (four steps on the cross-section's `--sw-lit`: none, up to a
  third, up to two thirds, more); a floor with no data is an outline with no fill and says "אין מידע מהקומה" in its name;
- beside the slab, the cross-section's markers: alarm (an area of the floor whose alarm is triggered - the home site's own rule,
  `api/home-site.ts floorBars`), the demo fire alarm (only while the fire UI option `ui.xs.fire_ui` is on), hot / cold
  (`tempState` with the installation's threshold), open doors with their count;
- medium and large: a lights count chip per floor (`3/8`); large: the floor name inside the slab; medium and large: a one-line sum
  (lights on in the building, floors in alarm, open doors);
- a press on a slab opens the floor (`#/explore/floors/<id>`); a press on the lights chip opens the floor lights popup of 2.33.1
  (`devices-tiles-panel kind=lights`, the same `floorLightsTarget` scope and area filter as the floors screen and the synoptic board);
  "כל הקומות" opens the building's floors screen. The slab and the chip are sibling buttons (never nested); in edit mode nothing is
  pressable.

## Reuse (no second model)

`xsection/xs-mini-model.ts` is a thin layer over `xsection/xs-model.ts`: `signalsOf` (the same floor <-> home-system matching, the same
`nodata`, the same `syn_switches` lights count), `xsMetrics` / `emptyColumns` (hide-empty: a metric the building has no source for is not
drawn - no tint and no lights chip without lights, no hot / cold without temperatures, no door marker without door sensors; with
`syn_hide_empty` off everything is drawn), `tempState`, `litPercent`, `floorLightsTarget`. The drawing is
`xsection/xs-mini-widget.ts`, plugged into `home-widgets` through the same host-function pattern as the presence widget
(`building-presence-widget.ts`).

## Which building

- One-building home: the catalogue's first building that has floors (a non-shared one first).
- Multi-building view on (`home.multi_building`): the building the home shows (its level); at the site level the first building shown.
  The head then names the building. The site's own catalogue read (`siteSrc`) and mapping rows are reused.

## Availability and reads

The widget is ABSENT (no ghost, edit mode too) unless the viewer holds `devices.read` (the static demo always) and a catalogue building
has floors. The catalogue (`sites?tree=true`) and the mapping rows are read once, and only when the widget is switched on (desktop or
phone) or the editor opens - a home that never shows it never asks. The numbers come from the home screen's own device tree (pushed by
the socket), so the widget adds no poll. The model is memoised on (building, tree, rows, options, size).

## Config

Frontend `api/home-config.ts` and backend `services/home_config.py`: `xsection` is appended last to the widget ids, has only the common
keys (`on`, `sizes` a/b/c = m/s/m, `label`, `phone_on`, `phone_size`), and `WIDGETS_OFF_BY_DEFAULT` / `OFF_BY_DEFAULT` make it start off
in a fresh config and in a stored config without the key. A personal on/off applies like any widget.

## Layout rules kept

Tokens only (no literal colours), dark and light through the tokens, the cap per size (6 / 9 / 14 floors; a taller building keeps its top
floors and says "+N קומות") so the card is never taller than its neighbours and the page never scrolls; touch targets grow to 24 px rows
on a coarse pointer; reduced motion drops the press scale; accessible names say only what is drawn (`miniFloorLabel`).

## Tests

- New: `frontend/tests/unit-xs-mini-widget-2351.spec.ts` (registration, availability, building choice, tint, markers, hide-empty, cap,
  no-data, fire option, accessible names).
- Updated for the appended id: `unit-home-config`, `unit-bv1-tiles`, `unit-elevators`, `unit-generator-home-widget`,
  `unit-temperature-phase3`, `unit-door-windows-home-widget`, `unit-noticepage-295`, `evidence-home-screen` (order lists);
  backend `test_home_config` (+1 test), `test_bv1_tiles`, `test_generator_home_widget`, `test_home_screen`,
  `test_infra_temperature_phase3`.

## Baselines

The widget is off by default, so no baseline of the normal home changes (`visual-matrix devices-home-ready-*`, `devices-home-dialog-*`).
Edit-mode captures of the home (none in the pixel suites at this commit) would show one more ghost ("חתך בניין · כבוי") where the viewer
may read the devices; the evidence specs that walk the home editor list it as one more row.
