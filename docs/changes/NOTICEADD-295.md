# NOTICEADD-295 - writing notices from the notice board settings, the rail entry, the TV board's name

Owner reports on released 2.16.0 (2026-10-24), notice board module enabled:

1. Settings › לוח הודעות › a board › tab "הודעות (0)": no way to add a notice.
2. The notice board should be in the navigation once the module is on.
3. The TV page greets with "מתנס" although the project name was changed in Settings › כללי › מראה המערכת.

## 1. No add control on a board's "הודעות" tab

Root cause: the creation flow was never built on that screen (cause (a); not a permission gate, not a state bug).
`frontend/src/screens/system-notices.ts` (2.16.0, `noticesTab()`, lines 501-515) drew only a `<select>` of *existing* notices
(`candidates`), and only when at least one existed; with an empty installation the toolbar was empty and the empty state
(`boardEmptyHint`) pointed elsewhere. The compose dialog existed only inside `devices-notices.ts` (ראשי › לוח הודעות). The owner
(system_admin) holds `notices.manage` / `notices.boards` (`roles.json`), so `can.manage` was true - nothing hid a control.

Change:

- `frontend/src/notices/compose-dialog.ts` (new, `<notice-compose>`): the compose dialog moved out of `devices-notices.ts` unchanged
  in fields and selectors (`data-compose-dialog`, `#nt-title`, `data-sev`, `data-aud`, `data-boards`, `data-publish`,
  `data-save-draft`, `data-compose-error`), shared by both screens. Added: archive of a published notice and delete of a draft from
  the dialog, each asked once in place (the button turns into "להעביר לארכיון?" / "למחוק את הטיוטה?"). The server never deletes a
  published notice (`DELETE /notices/{id}` is drafts only, 409 otherwise) - archive is its removal.
- Board page › "הודעות": the mockup's primary "הודעה חדשה ללוח" (`data-board-compose`) - a new draft tagged to that board and
  for the TV boards only (`boardDraft`, `notices/model.ts`; the author may widen the audience); per row "עריכה" (`data-edit-notice`,
  active / scheduled / draft rows) next to "הסרה מהלוח"; the empty state carries the same action and no paragraph.
- Settings › לוח הודעות (overview), module on and `can.manage`: "כל ההודעות" (to `#/devices/notices`) and "הודעה חדשה".
- No backend change for this part: `POST/PATCH /notices`, `/publish`, `/archive`, `DELETE` already existed.

## 2. Navigation (owner decision 2026-10-24, final)

"When the notices module is enabled, the notice board appears in the main app left navigation rail. If multimedia is enabled it sits
directly under 'Multimedia'; if multimedia is not enabled it is its own item in the rail. It is NOT a settings tab. Hide it entirely when
the module is off."

- `NOTICES_AREA` (`frontend/src/shell/nav.ts`): rail / bottom-bar entry "לוח הודעות" (icon `pin`) to `#/devices/notices`.
  `withNoticesArea` adds it in `visibleAreas` only while `noticesModuleOn()` (the session's `modules.notices`, and at once after the
  switch in Settings): right after `multimedia`, or - without it - before the first entry the user's order puts after מולטימדיה.
- It is not a movable tab: not in `NAV_A` / `NAV_TAB_IDS` (the server's `nav.order` list is unchanged) and filtered out of the
  "סדר הלשוניות" editor; it follows מולטימדיה wherever the user put it.
- `areaOf('#/devices/notices')` is now `'notices'` (the entry lights, `AREA_TABS.notices = []`: no tab row; crumbs "לוח הודעות").
- The tab "לוח הודעות" left the home area's row (`DEVICES_TABS`); the route id is unchanged.
- The settings page (module switch, defaults, TV boards) stays where 2.16.0 had it (Settings tab row after "מסכי קיר", side column
  under "מראה ותצוגה"): it is the module's configuration, needed to switch the module on, not the notice board.

## 3. The TV board's name ("מתנס")

Where each text of the TV page comes from (`frontend/src/notice-tv/main.ts`):

| Text | Source |
| --- | --- |
| "ברוכים הבאים" | `tv-logic.ts` strings (`welcome`), shown while the board's display block `welcome` is on |
| the large name (welcome column, template-3 header) | `feed.board.building` (`main.ts` `welcomeHtml`, line 146; template 3 line 304) |
| "<name> · יום נעים" (empty stage) | `feed.board.building` + `niceDay` (`main.ts` line 174) |
| footer "<name> · <board name>" | `feed.board.building` + the board's own name (`main.ts` line 314) |
| the template-3 sub line | the board's `display.place` (Settings › a board › כללי › "מקום") |
| clock / Hebrew date | the browser clock in the installation's zone; `blocks.clock`, `blocks.hebdate` |
| "אין הודעות כרגע" | `tv-logic.ts` (`empty`) |
| SmplWise logo | inlined asset; the company logo beside it is `brand_assets` (Settings › כללי › מראה המערכת), only once one is uploaded |

Root cause: `feed.board.building` is `services/notices/display.py` `building_name()` (2.16.0 lines 76-85): the notices setting
`notices.building_name` (Settings › לוח הודעות › ברירות מחדל › "שם הבניין בלוחות"), else **the first building of the site tree**, else
`home.title`. The project name of Settings › כללי › מראה המערכת (`brand.project.name`) was never consulted, so an empty notices field
fell through to the site building's name - "מתנס" is that building's name in the owner's data (not a hard-coded default, not a cache).

Change: `building_name()` -> explicit `notices.building_name`, else `fallback_name()`: `brand.project.name`
(`brand_assets.project_name()`, new), else the first building, else `home.title`. The Settings field's placeholder
(`building_fallback`) now shows the fallback, not the explicit value. The explicit field stays where it was and keeps winning. The feed
version hashes the payload, so a polling TV redraws within one poll after a brand or settings change (asserted in the test). The company
logo beside the SmplWise logo was already wired (CR-LOGOS295; `test_brand_notice_tv_295.py`); the owner had not uploaded one.

## Tests

- `smplwise_vms/backend/tests/test_notice_tv_project_name_295.py` (new): project name over the first building, version moves; explicit
  notices name wins and the placeholder keeps the fallback; no project name -> the first building.
- `frontend/tests/unit-noticeadd-295.spec.ts` (new): rail entry off / under מולטימדיה / own item, follows the user's order, route lights
  it, no tab row, crumbs, settings tab unchanged; `boardDraft`.
- `frontend/tests/evidence-notices.spec.ts`: board tab new / edit / archive, empty board action, settings "הודעה חדשה", rail on / off.
- `unit-schedules-nav.spec.ts`, `unit-tabs-config.spec.ts`: the home row lost "לוח הודעות".
