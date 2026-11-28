# DEEP-REVIEW-2570-MAPS-HOME - second deep review pass, area MH (plans, maps, home interface, wall)

Reviewed source: `v2.56.0` = `6ea807b2e` (read-only detached worktree). Brief: `review2_brief_2570.md` (private handoff package).
Scope: the "Not covered" list of `docs/review/DEEP-REVIEW-2560-MAPS-HOME.md` (branch `origin/review/DEEP-2560-MAPS-HOME`). The 2.56
findings MH-01..MH-04 are not re-reported (MH-01 is fixed at `6ea807b2e`: `routers/zones.py:212-220` `FIX-MH01-2560`, and the
accept / delete routes carry the same guard).
Method: the write paths of the plan editor, the plan wizard, the site / building / floor control paths of the full interface's home
screen, the wall display and its settings, the floor-to-home link of the cross-section, `skins.py`, `palettes.py` read end to end;
the 3D view, the design tokens / skins and the home widgets sampled (named below). One backend probe was run on the PC (one file, one
process, not committed). The area's unit specs and backend tests, and phone-width captures of the home screens, ran on the runner
(section 3).

## 1. Summary

| Id | Severity | Title | file:line (at `6ea807b2e`) |
|---|---|---|---|
| MH2-01 | medium | Plan wizard, rooms step: when tagging / linking a room fails after the rooms were created, the created rooms are forgotten - "save" again creates a second set; a later discard leaves the first set on the live floor | `frontend/src/plan-wizard/plan-wizard.ts:483-505`, `:259`; `plan-wizard/wizard-backend.ts:159-169` |
| MH2-02 | medium | Site-wide "turn off" (several buildings): when the request of a later building fails, the commands already sent to the earlier buildings are not shown - the dialog shows only an error; and "בוצע" is said for devices that were only sent | `frontend/src/screens/home-site-off.ts:213-231`, `:277-283` |
| MH2-03 | low | Plan editor pins: a pin moved while a save is in flight is cleared from the unsaved set and never saved ("המיקומים נשמרו", no unsaved mark); a second Ctrl+S during a save reports a false "another editor" conflict | `frontend/src/screens/explore-plan-editor.ts:1131-1169`, `:968-973`, `:1106-1108`, `:3607-3610`, `:5206` |
| MH2-04 | low | Plan wizard links a room to an HA area by exact name over every area of the installation (no building filter) - a building-scoped editor gets a 403 (which then triggers MH2-01), an installation-wide editor silently moves another building's area | `frontend/src/plan-wizard/plan-wizard.ts:468-471`, `:496`; `wizard-backend.ts:170-173` |
| MH2-05 | low | Wall display settings: `PATCH /wall/profiles/{id}` has no version check and the screen sends the whole configuration - two administrators editing one wall: the later save restores the earlier camera list and re-syncs the kiosk bindings to it | `frontend/src/screens/system-wall.ts:247`; `smplwise_vms/backend/smplwise/routers/wall.py:345-398` |
| MH2-06 | low | `GET /skins/status` has no permission check: any signed-in person (kiosk, home-only) reads whether an OpenAI key is configured, the render budget and the last connection test | `smplwise_vms/backend/smplwise/routers/skins.py:63-75` |
| MH2-07 | low | Tests: 31 of the 113 area unit specs read the source text; none covers a failure path of MH2-01..MH2-03 | `frontend/tests/unit-home-edit-drawer.spec.ts:13-36` and others (section 3) |
| MH2-08 | low | Home interface in English: the pager reads "out of 2 1" (a hard-coded `direction: rtl`), and every back / forward chevron points the Hebrew way (previous points right, next and "back" point the wrong way) - seen on the home, room and wall panel screens at 360, 390 and 430 px | `frontend/src/home/home-styles.ts:131`; `home/home-icons.ts:26`; `home/sw-home.ts:1172`, `:1274` |
| MH2-09 | low | Home interface in English at 360 px: the "Electricity today" tile wraps its label to two lines and clips "Electricity" at the top | `frontend/src/home/sw-home.ts:1394` |

Counts: critical 0, high 0, medium 2, low 7.

Phone width / no-scroll (captures, section 3): the home interface (main screen, two rooms) and its wall panel (kiosk) have NO page
scroll, no inner scroll container and nothing wider than the screen at 360 / 390 / 430 px, Hebrew and English, light and dark (72
captures measured). The full interface's home screen (`devices-building`) scrolls on a phone by design (`devices-building.ts:1370-1373`:
"a phone (under FIT_MIN_WIDTH) scrolls as usual") - about 2.3 screens at 360 px, the building controls below the widgets. That rule
predates the owner's general "no scrolling in control screens" rule (24.10); the contradiction is recorded here as an open question,
not as a finding (section 5).

## 2. Findings

### MH2-01 (medium, CONFIRMED by reading) Plan wizard: a failed room tag leaves the created rooms orphaned; "save" again duplicates them

`saveRooms()` (`plan-wizard.ts:483-505`):

```ts
const made = await b.acceptRooms(list, this.replaceAuto, this.created.map((c) => c.id));
for (let i = 0; i < made.length; i++) await b.tagRoom(made[i], roomType(this.rooms[i]?.typeId).tags, this.areaOf(this.rooms[i]?.name ?? ''));
this.created = made;
```

`acceptRooms` (`wizard-backend.ts:159-166`) first deletes the rooms of the wizard's earlier pass (`dropFirst` = `this.created`), then
`POST /floors/{id}/zones/accept` creates the new rooms (source `auto`, live on the floor at once). `tagRoom` is one
`PATCH /zones/{id}` per room (tags, and `area_id` when the name matches an area). When any `tagRoom` throws, the `catch` shows the error
and `this.created` is NOT set to `made`: the rooms just created are known to nobody.

Failure scenario: the person names a room after an area the route refuses (MH2-04: another building's area -> the round-14
`RemapGuard` 403 `forbidden`; an area deleted meanwhile -> 422), or the network drops during the tagging loop. The wizard stays on the
rooms step with the error. The person fixes the name and presses "save" again: `dropFirst` is still the previous (empty, on a first
pass) list, so a SECOND full set of rooms is created; the first set stays on the floor - every room twice on the live map, in the
home interface and in the room search, half of them without tags. If the person then abandons the wizard ("replace" on a new file,
`confirmReplace`, `:259`), `discard` deletes `this.created` - the second set only - and the version; the first set stays on the floor
for good, attached to a deleted plan version. Rooms 0..k-1 of the failed pass also carry tags / area links, k.. do not.

Fix: set `this.created = made` right after `acceptRooms` returns (before the tagging loop), and tag in a second step whose failures are
reported per room ("3 rooms were not tagged") without losing the ids; or make the accept carry the tags and the area ids so one
request does it all. Regression test: a backend mock whose third `PATCH /zones` answers 403, then a second save - one set of rooms.

### MH2-02 (medium, CONFIRMED by reading) Site "turn off": a failure on a later building hides the commands already sent

`home-site-off.ts:213-231` `confirm()`:

```ts
const first: BulkRecord[] = [];
for (const x of this.previews) first.push(await runBulk(x.p.scope, x.p.id, this.kind, x.p.digest, ..., x.p.building_id));
this.records = first;
```

The bulk runs of the chosen buildings are started one after another. When `runBulk` of building 2 throws (its devices changed since
the preview - `target_changed` -, a 403 on that building, a 5xx, a dropped connection), building 1's run is already on its way on the
server, but `first` is a local array: `this.records` stays empty, nothing is followed, and the dialog shows only the error
(`describeError`, or for `target_changed` "חלק מהפקודות לא נשלחו"). The person is not told that building 1 is going off; a person who
reads "error" may walk over to turn things off by hand or press again.

Also `:277-283`: the result counts `confirmed + sent` as done and says "בוצע" when they add up to the total; the single-scope dialog
(`api/device-bulk.ts:235-244 bulkHeadline`) says "נשלח" / "בוצע (חלק נשלחו ללא אישור)" for the same record - a stop / screen command
that only went out is reported as confirmed on the site dialog.

Fix: assign `this.records` as each run starts (or keep `first` in a field), and on an error show the started runs' progress plus "the
request for <building> failed: nothing was sent there"; use `bulkHeadline` for the headline. Regression test: three buildings, the
second `POST` answers 409 `target_changed` - the dialog shows building 1's run and names building 2.

### MH2-03 (low, CONFIRMED by reading) Plan editor: a pin moved during a save is never saved

Every pin edit replaces the unsaved set (`apply`, `:972`: `this.dirty = new Set(this.dirty).add(id)`). `save()` (`:1131-1169`)
iterates the set it read when it started (`for (const id of this.dirty)`, one `PATCH /map-anchors/{id}` per pin, awaited in turn) and
ends with `this.dirty = new Set()`. Moving a pin is not blocked while `busy` (`@marker-move`, `:5206`, arrow keys `:1118-1124`).

Failure scenario: several pins moved, Ctrl+S (or "שמירת מיקום"); while the PATCHes go out one by one the person drags one more pin. Its
id goes into the NEW set, the loop does not see it, the final `new Set()` drops it: the toast says "המיקומים נשמרו", the pin shows no
unsaved mark, nothing asks on leaving; the next load puts it back. The same holds for a pin already saved earlier in the loop and moved
again. Ctrl+S has no `busy` check (`:1106-1108`, `:3607-3610`): a second save during the first sends the same pin with the same
revision, gets `stale_revision`, and reports "חלק מהפריטים השתנו בינתיים על ידי עורך אחר" and reloads - a conflict with itself.

Fix: snapshot `const ids = [...this.dirty]` at the start and at the end remove only the ids saved with the values that were sent (an id
edited since stays dirty); return early when `busy`. Regression test: a slow PATCH mock, a move during it, the moved pin still dirty.

### MH2-04 (low, CONFIRMED by reading) Plan wizard: room to area by name, over every building

`areaOf(name)` (`plan-wizard.ts:468-471`) links a room to the first area whose name equals the typed name; the list is
`listEntities({ limit: 1 }).areas` (`wizard-backend.ts:170-173`) - the installation's areas, with no building or floor filter - and the
datalist offers them all (`:934`). HA area names are unique per installation, so the ambiguity is not two areas of one name: it is a
room of building A named like building B's area (a "לובי", a "חדר חשמל" that exists once, in B). For a building-scoped editor the
`area_id` PATCH is refused by the round-14 `RemapGuard` (403) - which is the trigger of MH2-01; for an installation-wide editor the
link is written and building B's area (its lights, locks, covers) moves into building A's reach without any question - the only sign is
the room field's "linked" colour and the "N מקושרים לאזורים קיימים" count.
Fix: offer and auto-link only areas that resolve to this floor's building or to no building (the `building_scope.area_targets`
answer), and name the building in the "linked" hint for anything else.

### MH2-05 (low, CONFIRMED by reading) Wall settings: no version check on a profile save

`system-wall.ts:247` sends `config: this.draft.config` - the whole configuration as the dialog loaded it - and `patch_profile`
(`wall.py:345-398`) merges it without comparing the profile's `version` (the column exists and is bumped on every save). Administrator
A opens a wall's dialog; administrator B removes two cameras from the same wall and saves (the kiosk bindings are re-synced,
`_sync_bindings`); A changes only the title and saves: A's stale camera list is merged back, `config.cameras` differs again, and the
kiosk bindings to the two cameras B removed are granted again (A holds `rbac.assign`, else the save is a 403). Audited, but nobody is
told that B's change was undone.
Fix: send the `version` the dialog loaded and answer 409 `stale_version` when it moved, or send only
the changed keys.

### MH2-06 (low, CONFIRMED by reading) `GET /skins/status` is open to every signed-in person

`skins.py:63-75` reads with `current_principal_ro` and calls no `require`: a kiosk / wall user or a home-only resident gets
`key_configured`, the provider and model, the monthly budget and usage, and the last connection test's status / HTTP status / error code.
Nothing secret (never the key), but it is administrator information (the screen that shows it is under system settings) and every other
skins route needs `map.edit` or `system.configure`.
Fix: `require(conn, principal, "system.configure", INSTALLATION)` (or `map.edit` anywhere, if the plan editor reads it), plus a test
that a viewer gets 403.

### MH2-08 (low, CONFIRMED by capture and reading) Home interface in English: pager text and chevrons are Hebrew-only

`sw-home.ts:1172` draws the pager as `<span class="pg num">${p + 1} ${tr('מתוך')} ${pages}</span>`; `.num` sets `direction: ltr`, but
`.pager .pg` (`home-styles.ts:131`, more specific) sets `direction: rtl`, so in English the span lays out right to left: "1 out of 2"
is shown as "out of 2 1" (captures `home-main-*-en-*`, `home-room-*-en-*`, `wallpanel-*-en-*`, every width). The chevrons
`back` / `fwd` (`home-icons.ts:26`) are drawn for right-to-left (back points right) and no `:dir(ltr)` rule mirrors them (the
dimmer's edge has one, `home-styles.ts:263`): in English the pager's "previous" button sits on the left pointing right and "next" on
the right pointing left, and the same icons serve the header back link (`:1274`), the favourites rooms switcher (`:1277`), the menu
rows and the recordings day navigation.
Fix: drop `direction: rtl` from `.pager .pg` (let the language decide; keep `unicode-bidi: isolate` on the numbers) and mirror the
directional icons in LTR (`.rb svg.dir:dir(ltr), .tb-back svg:dir(ltr) { scale: -1 1 }`, or pick `back` / `fwd` by the document's
direction). A capture of the English pager belongs in the home's evidence.

### MH2-09 (low, CONFIRMED by capture) "Electricity today" clipped at 360 px in English

`sw-home.ts:1394` renders the energy tile's label `tr('חשמל היום')` in the tile's key row; in English ("Electricity today") it wraps to
two lines at 360 px and the tile's fixed height clips the first line ("Electricity" cut at the top, `home-main-360-en-*`); at 390 px it
fits. Fix: one line with ellipsis (`clamp1`) or a shorter English word ("Today, kWh").

### MH2-07 (low) Test strength

See section 3: 31 of the 113 unit specs of the area read the product source as text; `unit-home-edit-drawer.spec.ts` (8 tests) checks
the drawer by regular expressions over `devices-building.ts` and the drawer's template (`:13-36`) - it passes as long as the text is
there, whatever the drawer does. None of the specs covers the failure paths of MH2-01 (wizard tagging failure), MH2-02 (a later
building's run failing) or MH2-03 (an edit during a pin save); the only site-off spec drives the happy path
(`evidence-multibuilding-home-2330.spec.ts`).

## 3. Tests run (real results)

All at `6ea807b2e`, on the runner unless said otherwise.

| What | Command / job | Result |
|---|---|---|
| Frontend node-only unit lane (every `tests/unit-*.spec.ts`, which includes all 113 unit specs of this area) | `npx playwright test -c playwright.unit.config.ts --workers=2` (job `p2570r_fe_run.sh`, the FE reviewer's run at the same commit - reused, not repeated) | 5539 passed, 18 skipped, 0 failed (1.8 min) |
| Backend, the area's key files, one pytest process per file (`SW_WIRE_STRICT=1`) | job `p2570r_mh_unit.sh`: `test_zones`, `test_plan_area_links`, `test_building_reach_round14`, `test_plan_wizard_api_2434`, `test_plan_geometry_api`, `test_plan_skins`, `test_palettes`, `test_wall`, `test_wall_alerts`, `test_home_screen`, `test_home_interface`, `test_home_links`, `test_mapping_assist_2330`, `test_plans`, `test_floor_images` | 15 files, 209 passed, 0 failed |
| Build | `npx vite build` (job `p2570r_mh_shots.sh`) | exit 0 |
| Phone captures (not committed; a throw-away spec in the runner worktree) | `p2570r-mh-phone-shots.spec.ts` against `vite preview` of the build: home interface (main, two rooms) with `home-simple-mocks`, its wall panel (kiosk) with `home-v3-p2-mocks`, the full interface's home in the static demo; 360x780, 390x844, 430x932; Hebrew / English (`sw.ui.lang` + `me/prefs`); light / dark; per capture: page scroll, inner scroll containers, elements past the screen edge | 36 passed, 72 captures. Home interface and wall panel: page scroll 0, no inner scroller, nothing wider than the screen, in every combination. Full interface home: page scroll 0 but its `main` scrolls by 1017 / 953 / 865 px (360 / 390 / 430) - by design on a phone; the view-tab chip strip scrolls sideways (with its own arrow). Visual: MH2-08, MH2-09 |
| PC probe (one file, one process, deleted) | a custom palette with `wallpaper.angle: NaN` through `PATCH /settings` | `PATCH` 200, `GET /settings` 200, the value served as `null` (section 4) |

NOT_RUN: the page-driving unit specs (`SW_UNIT_PAGES=1`), the evidence / layout / pixel suites of the area, the remaining backend files
of the area (`test_plan_*` detection / IFC / DXF / package, `test_home_v3_*`, `test_mb_home_2500`, `test_xsec*` and others), the wall
display (`sw-wall`) on tablet sizes. No regression test for MH2-01..MH2-09 was written (review only, no product code).

Assertion strength (sampled): `unit-plan-wizard-2433/2434`, `unit-wall-logic`, `unit-plan-3d-perf`, `unit-home-screen`,
`unit-plan-editor-hot-2436` call the product functions with data and assert results - they can fail. 31 of the 113 area unit specs read
the source text; some are deliberate lints (`unit-token-lint`, `unit-plan-editor-hot-lint-2436`), at least one stands in for behaviour
(`unit-home-edit-drawer.spec.ts`, read in full); the other source-reading specs were counted, not read - MH2-07.

## 4. Checked and fine

- Geometry draft: `routers/plan_geometry.py:270-326 put_geometry` (revision before any write, shared-room edits planned and validated
  before the first write, rollback on an API error, map.edit / explicit deny per home floor), `:335-373 publish_geometry`,
  `:421-431 rollback_geometry` (`geometry_store.rollback` only takes an archived row of the same version), `copy-from` (same floor),
  `link` / `twin-delete` (map.edit on every floor a twin can be removed from), `services/geometry_store.py save_draft` (stale revision,
  identical document a no-op).
- `map/studio-controller.ts` (the editor's autosave): one save in flight, edits during a save go out next, a stale answer rebases only
  when the server's change touched connectors / shared items the editor did not edit, else the editor holds every save until a reload;
  answers of an older load are dropped; undo / redo bounded (60) and rewritten after a rebase.
- Zones: `routers/zones.py update_zone` (revision, share rights on every floor for an outline change, `RemapGuard` on `area_id`),
  `delete_zone` / `accept_zones` (`RemapGuard`, shared rooms kept), the editor's zone PATCH with a timeout and 409 -> reload.
- `xsection/sw-floor-home-link.ts` writes through `PUT` home links (the guarded `home_mapping` route).
- Wall display backend `routers/wall.py`: ack only when the profile allows it and the alert is in the display's scope; states only of
  the profile's entities; profile create / remove need `rbac.assign`, binding changes go through `validate_binding` / `check_delegation`
  (`rbac.assign` on the scope); frame photos only from the profile's set. `wall/sw-wall.ts`: every timer, listener and the socket are
  released in `disconnectedCallback`; reconnect backs off (5 s, 15 s after 5 minutes); no control besides the acknowledgement.
- `devices-building.ts` control paths: every quick / floor / building / area action goes through the confirmation dialog
  (`devices-bulk.ts`: preview digest, one at a time, cancel focused, the server authorises again, outcome followed to the end; poll
  misses do not turn into an error); bulk buttons only for `devices.control_bulk` and `can_bulk`; nothing while offline or editing.
- `services/palettes.py`: closed token set, strict colour formats, opacity / blur bounds; a probe stored a custom palette with
  `wallpaper.angle: NaN` - `PATCH` 200, `GET /settings` 200 with the value served as `null` (no crash; only the wallpaper gradient of that
  palette is lost). Not a finding.
- Design tokens / skins (`design/apply.ts`, `background.ts`, `palette.ts`, `look.ts`): values applied with `style.setProperty` or fixed
  constructed sheets, the background URL stripped of quotes - no rule injection. No `unsafeHTML` / `innerHTML` in any file of the area.
- 3D (`map/sw-plan-3d.ts`, `map/scene-three.ts`): read-only (selection, level, walk events only); `disconnectedCallback` /
  `dispose()` release observers, animation frames, listeners, render targets, materials, geometries and the renderer.
- Layout / home settings of the home screen: layouts carry revisions (`devices-layout.ts:1322-1350`, 409 -> reload).

## 5. Still not covered (honest)

- `explore-plan-editor.ts` (335 KB): read were the pin save / place / undo, the zone create / patch / delete / share paths, the studio
  save controller and the publish / rollback entry points; the drawing tools (walls, curves, stairs, circuits, the detect review, the
  package / IFC import dialogs) were not read beyond their save calls.
- `sw-plan-3d.ts` / `scene-three.ts`: only lifecycle and event surfaces; the scene building, the realism and walk code were not read.
- `home-widgets*.ts`, `home-edit-panel.ts`, `home-site-view.ts`: sampled for actions and edit flows (they only emit; the screen confirms);
  the widget data mapping was not read.
- `xsection/` model and widgets (`xs-model.ts`, `xs-mini-*`) not read.
- The wall display's rendering on tablets (its own device class; on a phone the normal application mounts) was not captured.
- Phone captures were made with mocked data (the specs' own invented household, `home-simple-mocks.ts` / `home-v3-p2-mocks.ts`) and,
  for the full interface's home, the static demo; worst-case data (long names, many devices), the settings / notices / recordings
  screens of the home interface and the full interface's API-mode home were not captured.
- Open question for the owner (recorded contradiction): the full interface's home screen on a phone scrolls by design (`devices-building.ts:1370-1373`)
  while the 24.10 rule forbids scrolling in control screens. (a) keep the phone exemption as documented - recommended, the phone home
  is a list of widgets and floors; (b) page it on a phone like the home interface.
