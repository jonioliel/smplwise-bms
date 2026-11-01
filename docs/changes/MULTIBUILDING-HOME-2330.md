# MULTIBUILDING-HOME-2330 - the home screen's site level for an installation of several buildings

Owner approval 31.10 evening: every recommendation of the round-10 questions page "ריבוי בניינים"
(`private/design-system-2026-10-27/round10/multi-building/answers.html`, direction A "כרטיסי בניינים" + grouped tree, answers 1-8).
Proposal: `docs/changes/PROPOSAL-MULTI-BUILDING-HOME.md` (branch pilot/MULTI-BUILDING-HOME-PLAN). Built on the 2.31.0 train
(`release/2310-train`), consuming the floor mapping of SYNOPTIC-HA-2310 (`home_links`, migration 0187). The prefix mapping assistant is a
separate task and is not part of this change.

## How areas become buildings
`frontend/src/api/home-site.ts` (pure, unit-tested). Our catalogue (site -> buildings -> floors, as the caller may read it) is matched
against the home-system tree with `xs-model.matchFloors` for each building, `singleBuilding: false`: map placement > per-area row > the
platform-floor row. On a multi-building site the automatic level / name rules only suggest (never assign), so an unmapped installation
stays the one-building home. An area that resolves to no building is "לא משויך" (a line at the foot of the site tree).

`siteModel()` returns null - the home exactly as before, no selector drawn - when the caller sees fewer than two buildings (a user scoped to
one building, or a one-building installation) or when no area resolves to any building.

## What was built (items 1-7 of the brief)
1. **One building: unchanged.** No site bar, no tags, no new requests' effect on the page. Verified pixel-identical against a build of the
   train base on desktop 1440x900, tablet 1024x768 and mobile 390x844 (`docs/evidence/MULTIBUILDING-HOME-2330/{before,after}/one-building-*.png`,
   0 differing pixels each; the spec seeds a fixed performance verdict so the start-up probe layer does not vary between runs).
2. **Several buildings - site level** (`screens/home-site-view.ts`): a live card per building (floors · areas, lit / switches / covers /
   A/C counters, alarm rows or "אין התראות", a lit bar per floor - top floor first - each bar opens that floor, "פתח בניין",
   "כבה הכל ב<בניין>"), the site's alerts card (desktop) and the grouped tree: "כל האתר", one row per building (lit count, red alert count,
   a chevron that opens its floors). The shared building is last, with the `sparkle` icon and its own colour tokens
   `--sw-shared` / `--sw-shared-soft` / `--sw-shared-text` (design/tokens.ts). Building flag `is_shared` (migration 0188, settable in
   Explore > sites > building edit: "בניין משותף").
3. **Navigation**: card / tree row / switch -> the building view = today's home with the tree scoped to that building (`scopeTree`: only its
   areas; a platform floor that serves one of our floors takes OUR floor's name - "קומה 1", not "א · קומה 1"); a site bar with the breadcrumb
   "אתר › בניין א" and a segmented building switch (all buildings + "כל האתר"; a red dot on a building with an alarm). Two presses via cards
   (building, then a floor bar or a floor card), one via the tree (open a building's floors, press a floor) or the mini cross-section.
   A platform floor split between buildings keeps only this building's areas and loses its floor-wide bulk menu.
4. **Entry view**: installation setting + per-user override (see Settings). A user scoped to one building enters it with no selector
   (the site model needs two shown buildings). "הסתר משותף" per user. The last building is remembered per device (`localStorage`
   `sw.home.lastBuilding`) - writing a server preference on every switch would need `screen.personalize`, which not every user holds.
5. **"כבה הכל"** (`screens/home-site-off.ts`): inside a building it names the building (site bar button "כבה הכל בבניין א", and the quick-actions
   widget's pills go to the same dialog); at the site level only through the dialog: the buildings with checks, "משותף" unchecked by default
   (installation setting), then the server previews and a strong confirmation (a second step with the exact count, and for more than one
   building an "אני מאשר כיבוי ב־N בניינים" check before the danger button enables). The safe path per building is the existing bulk flow
   (`api/device-bulk.ts` preview -> `runBulk` with the preview digest -> `followBulk`): one floor request per platform floor wholly in the
   building, one area request per area on a split floor (`bulkTargets`). The building-wide server scope (= every building) is never used on a
   multi-building site. The landscape-tablet rule `building_off_tablet = hide` applies to the building's off buttons as before.
6. **Widgets**: clock / weather / Shabbat stay site-wide (no tag). The summary counters (`sw-kpi` new `tag` property), the alarm widget, the
   elevators widget and the quick-actions widget follow the level and carry a quiet tag "אתר" / "בניין א" (`home-widgets` new `scopeTag`).
   In a building: elevators = those whose area is in the building; the alarm card reads the building's own panel state when the building has
   one; the A/C strip and the counters come from the scoped tree.
7. **Mini cross-section** ("חתך האתר"): a column per building, the floors aligned by level, each floor coloured by its share of lights on,
   an alarm outlined, a press opens the building on that floor. Placed as the last card of the site level on a desktop and on a phone (a
   landscape tablet keeps the building cards at a readable height instead). **TODO**: the brief asks for it in the widgets row; making it a
   configurable home widget (a new `WidgetId` in api/home-config.ts + backend home_config + the editor) is left for a follow-up.

## Settings added
| Key | Options | Default | Where |
|---|---|---|---|
| `home.screen.site_entry` | `site` / `last` / `fixed` | `site` | Settings > home screen (shown only with 2+ buildings) |
| `home.screen.site_entry_building` | building id or `""` | `""` | same (with `fixed`) |
| `home.screen.site_off_shared` | `exclude` / `include` | `exclude` | same |
| `home.personal.screen.site_entry` (+ `site_entry_building`) | `site` / `last` / `fixed`, absent = installation's | absent | My account > my screen |
| `home.personal.screen.hide_shared` | `true` / absent | absent (shown) | My account > my screen |
| `buildings.is_shared` (migration 0188) | 0 / 1 | 0 | building edit dialog |

Backend: `services/home_screen_options.py` (CHOICES, DEFAULT, PERSONAL_KEYS, validation), `routers/catalog.py` (`is_shared` in the building
row and PATCH, audited in `building.update`). No new routes: `contracts/API_INVENTORY.md` unchanged.

## Demo
Static demo only: `?mb=1` = four buildings (8 / 6 / 5 / 3 floors) + "משותף" (garden, parking -1 / -2) on one home system, named by the
convention, mapped with layer-1 rows, one platform floor unmapped; `?mb=alarm` adds an alarm in building ג; `?mblevel=<id>` opens a building.
`screens/home-site-demo.ts`.

## Screens whose look changed
Only on a site with two or more mapped buildings: the home screen (site bar, site level, scoped building view, tags), the settings > home
screen options (three rows), my screen (two rows), the building edit dialog (the shared check - every installation). One building: unchanged.

## Known limits
- The summary counters' panel ("הצג ושלוט") still lists the whole installation inside a building (the panel has no building scope yet).
- On a landscape tablet 1024x768 the cards are short: they keep name, counters, one alert row and the off link; the floor bars and the open
  button give way (the name opens the building; the tree opens a floor).

## Tests
- `frontend/tests/unit-home-site-2330.spec.ts` (9): grouping, shared last, unmapped, no model for one building / no mapping / a scoped user,
  map placement and area rows, scoping and split floors, bulk targets, the entry rule, the all-off selection and shared default, tags.
- `frontend/tests/evidence-multibuilding-home-2330.spec.ts` (7 x desktop / tablet / mobile): one-building unchanged, site level fits
  (no vertical scroll on desktop / tablet, no horizontal anywhere), card -> building, breadcrumb, tree jump to a floor, cross-section,
  shared building, the site all-off dialog (shared unchecked, strong confirmation), building all-off naming, dark scheme.
- Backend `tests/test_multibuilding_home_2330.py` (5) + `test_home_screen_options_295.py` updated defaults.
- Evidence: `docs/evidence/MULTIBUILDING-HOME-2330/before/` (train base, one building) and `after/`.

Run on the workstation 31.10 (one worker, preview build on a private port; layout-home-widgets-wide-298 against the Vite dev server as its
header requires): `npx tsc --noEmit` clean; unit specs (home-site, home-screen-295, home-screen, home-config, homeinfo-295, home-clock,
xs-floor-match, design tokens / token lint / skins / palettes, area-popup-edit-2290) 119 passed; evidence-multibuilding-home-2330 21 passed
(7 per project); evidence-home-295 + layout-worstcase-screens-297 93 passed, 60 skipped by the specs' own project guards, 0 failed (all three
projects); layout-home-widgets-wide-298 8 passed (desktop), 16 skipped (tablet / mobile, by design); backend `-k "catalog or building or site
or migration or schema or prefs or home"` 720 passed, 7 skipped, 0 failed.
