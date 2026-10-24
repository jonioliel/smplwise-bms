# NOTICEPAGE-295 - notices page parity with the approved mockup (slice D)

Branch `pilot/NOTICEPAGE-295`, cut from `release/2180`. Everything stays behind `notices.enabled` (OFF by default). Reference: `docs/changes/CR-NOTICE106.md`
section 9, `docs/design/mockups/notice-106/index.html`, gap rows N1, N2, N3 of the 2026-10-24 gap analysis.

## What was built

### 1. Places tree (N1) - `frontend/src/notices/places-tree.ts`, `places-model.ts`
- Side tree on `#/devices/notices` for notice managers: "כל הבניין", then the floors (grouped under their building only when the installation
  has more than one), each floor collapsible over its named areas; every node shows its notice count; an area shows a dot for its loudest severity.
  On the phone the same nodes are one select inside the list panel.
- A notice belongs to the places its audience names: a floor, or an area (which also counts for its floor). A notice "for everyone" or for
  groups / roles belongs to "כל הבניין" only (the audience reaches people, not rooms) - the same rule as the mockup, which counts by tag.
- Counts are over the notices the page can list at all (not archived), independent of the KPI / segment / search filters; the node filters the
  rows on top of them.
- Readers get no tree: the audience of a notice is output for managers only (`_notice_out`), so there is nothing to group by.
- Server: `GET /notices/audience/options` now also returns `areas` (`{id, name, floor}`, named, not deleted, at most 500). No migration.

### 2. "מי קרא" (N2) - `frontend/src/notices/reads-sheet.ts`, `reads-model.ts`
- In the manager's table (and on the phone cards) the read count is a button; it opens a sheet: KPI read / unread / recipients, a progress bar,
  a segmented "קראו / טרם קראו", and a table of name, place and time (read: newest first; unread: by name).
- Data: the existing `GET /notices/{id}/reads` (manager only, 403 otherwise; 404 for an unknown id). With `notices.reads_names` off the answer has
  only the two counts: the sheet then shows the KPIs and the bar and leaves the list out. Nothing is cached or exported.
- Server: each person in `users` / `unread` now carries `place` (as the CR already specified): the floor names of his live allow bindings scoped
  to a floor, comma-joined; empty when his grants reach a building, a site or the installation (there is no resident model, CR section 5.3).
  `services/notices/audience.py::places_of`. No migration.
- A draft has no readers, so it has no button. The mockup's footer sentence ("the list is visible to managers only...") is not drawn: clean
  operator screens, no hints.

### 3. Home widget "לוח הודעות" (N3) - `frontend/src/notices/home-widget.ts`, `home-widget-model.ts`
- Up to three notices active for me, urgent first, then important, then the rest (the server order inside a group); an unread dot; the first line
  of the text on the large size; the header link "הכול" to `#/devices/notices`. Small shows the top notice, medium and large three. No action of
  any kind (no service-request action; the tickets module is not consulted).
- Registered like the other home widgets: `home_config.WIDGET_IDS` (last: `... doors, notices`), `DEFAULT_SIZES`, the per-widget key whitelist;
  `api/home-config.ts` (`WidgetId`, `WIDGET_IDS`, `WIDGET_NAME`, `DEFAULT_SIZES`, `defaultConfig`, `configOf`, `resolveWidgets` with
  `noticesAvailable`); `home-widgets.ts` (`case 'notices'`, styles); `devices-building.ts` (read once, then every 30 s through the HOMELIVE live
  controller, failure panel with a retry, availability); the home editor and the personal list (`home-edit-panel.ts`, `sw-home-personal.ts`)
  list the widget only when it is available.
- Default OFF / hidden: like every widget its stored config is `on: true`, but it is ABSENT (no card, no ghost in the editor) unless the module is
  on (`/me` modules.notices) and the read succeeded. With the module off no request is made at all. An empty list shows the widget with one line
  "אין הודעות פעילות". Owner decision: with no active notice the widget is hidden (default) or shows one line, a board setting `notices.home_empty` (`hide` / `line`, in the existing settings store, no migration), chosen in הגדרות › לוח הודעות › ברירות מחדל (`notices/display-home.ts`). The editor and the personal list still offer the widget while it is hidden for emptiness, so it can be placed; the read of `GET /notices` carries the setting in `defaults.home_empty`.
- A saved order from before this release keeps its look: the widget lands last.

### 4. Words and files
- `frontend/src/i18n/notices.ts`: new keys `places`, `placeSelect`, `allPlaces`, `foldPlace`, `unfoldPlace`, `readsOf`, `readsList`,
  `readsLoadError`, `readsNone`, `segReadShort`, `segUnreadShort`, `colName`, `colPlace`, `colReadAt`, `widgetAll`, `widgetEmpty`, `widgetNew`,
  `widgetUntil` (Hebrew, English following the document language).
- Hot files touched minimally: `devices-notices.ts` (imports, 3 states, the tree + select + `notice-reads` tags, the reads button); `system-notices.ts`
  untouched. New logic lives in new files; pure parts are split into `*-model.ts` so unit specs run in Node (the repository's `home-widget-model`
  pattern).

## Tests
- Backend (`smplwise_vms/backend/tests/test_notices_106.py`, appended): the reads sheet (names, place, the read / unread split, manager only,
  counts-only with names off, unknown id), the options' named areas (blank names skipped, reader 403). Existing widget-order assertions in
  `test_home_config.py`, `test_generator_home_widget.py`, `test_bv1_tiles.py`, `test_home_screen.py`, `test_infra_temperature_phase3.py` now end
  with `notices`.
- Frontend unit (`unit-noticepage-295.spec.ts`): tree building / filtering / folding, reads view, widget list and availability, registration, words.
  The frontend widget-order assertions in the existing unit specs (`unit-home-config`, `unit-bv1-tiles`, `unit-elevators`,
  `unit-generator-home-widget`, `unit-temperature-phase3`, `unit-door-windows-home-widget`, `evidence-home-screen`) end with `notices`.
- Frontend evidence (`evidence-noticepage-295.spec.ts`, desktop + mobile): tree counts and filtering, phone select, reader has no tree, the sheet
  (read / unread / counts-only / refused), the home widget (rows, order, unread dot, link) and its absence with the module off (no request).
  Screenshots go to `frontend/test-results/noticepage/` (not committed).

## Pixel baselines
No committed pixel baseline covers `#/devices/notices` or the home screen with the widget (it is absent while the module is off, and no
snapshot spec visits the notices page). None is refreshed; none is expected to change.

## Migration / rollback
No migration. Rollback = revert the branch. A home config saved after this release may hold a `notices` entry; how the older validator treats
that unknown key was not tested (NOT_RUN) - re-save the home config from the editor after a revert if the old build rejects it.

## Owner answers (applied)
1. Home widget when empty: a board setting, default hide (built).
2. Readers get no places tree (kept).
3. "Everyone" notices stay under "כל הבניין" only (kept).
4. In the "who read" table a person with no floor binding shows "כל הבניין" (built).
