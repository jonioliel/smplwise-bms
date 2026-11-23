# HOME-FAVORITES-2500 - home interface: favourites order, holes, drag, scene suggestion, scene editing (owner Q75-Q79)

Branch `pilot/HOME-FAVORITES-2500` from `main` 619f94d04 (2.47.0). Owner answers of 22.11 (`private/planning/questions_all_open_2026-11-22.html`,
"הממשק הביתי, השלב הבא", items 6-10 = Q75-Q79): every answer is the recommended option. Sibling branch `pilot/HOME-WALL-NIGHT-2500`
(Q70-Q74) also touches `sw-home.ts`; this branch keeps its own logic in new files and only adds small hooks in `sw-home.ts` that do not
overlap the sibling's five hooks (imports, the `static styles` line, lifecycle, `willUpdate`, `render` are left alone).

## What changed, per answer

| Q | Owner answer | Done here |
|---|---|---|
| Q75 who edits scenes | whoever holds the scene-management permission (e.g. the home manager) | Server rule unchanged and now pinned by tests: every scene write (create, update, delete, capture) needs `scene.manage` (the gate, then the scope of every member). The home interface asked for `scene.manage` at **installation** scope (`home-api.ts` `can(...)`), so a home manager bound to their own floor never saw an edit control - that was the "only the installation administrator, as today" behaviour. Now `canEdit` = the server's `can.edit` AND `scene.manage` at any scope (`canAnywhere`). New in-home scene sheet (`home-scene-2500.ts`, "הגדרות › סצנות › עריכה"): rename, "לשמור את המצב של עכשיו" (re-capture the scene's own members through `POST /automations/scene/capture`), move to the trash (asked in the sheet, then sent with `confirm: true` - the server refuses an unconfirmed delete). A home-only person (no full interface) can now edit too. Without `scene.manage` there is no edit control, even where a server row says editable |
| Q76 AC "hold" | leave it out | Nothing to remove: "החזק כך" was never built (HOME-SIMPLE-2420 table: "not built (lead: leave out)"). A browser check pins that the climate screen shows no hold control |
| Q77 favourites ordering | long-press drag on the tablet, the arrows stay | `home-fav-ui.ts` `FavDrag`: in "עריכה", a 450 ms press (10 px slop) lifts the tile (scale + shadow, `touch-action: none` on the edited grid so the browser does not pan), the cell under the finger is outlined, the drop puts the tile in that tile's place or at a "+ הוסף" hole (`dropIndex`), saved through the same debounced favourites save as the arrows, toast "הסדר נשמר". The arrows (and the settings list's up / down) are unchanged. A short press-and-move is not a drag; the release never triggers a click or the room swipe. Works with touch and mouse; enabled on every size (the phone's full-width edit rows reorder vertically) |
| Q78 a missing slot in the grid | my order is kept and the hole fills with "+ הוסף" | The grid packed with `grid-auto-flow: dense`, which pulled a later small tile up into the gap a wide tile left, so the screen showed another order than the person's (round-30 audit item 8). `home-favgrid.ts` `layoutFavPages` now places every tile explicitly in the person's order (the CSS grid's sparse auto-placement, page by page, `grid-area` inline), and each run of empty cells up to the last row in use is one "+ הוסף" cell. Tapping it opens "הוספת מועדף" (what the room - or "הבית שלי" - has that is not a favourite yet, paged, no scroll) and inserts the pick exactly at the hole. Pagination now follows the real placement (the old area count could overflow a page once holes exist). On a locked wall panel a hole is an empty cell |
| Q79 suggestion after a scene | a suggestion dialog that must be confirmed, with the usual code | `home-scene-2500.ts` `afterScene`: after a **leaving** or a **night** scene ran (the scene icon, read from its name as before), and only when nothing else is open: first "לנעול דלתות?" for doors that are unlocked and lockable from here (not a WisKey door - it relocks itself - not a gate, not unavailable), then "לדרוך אזעקה?" when the alarm is disarmed, the person may arm, and the panel's arm code rule can be met (leaving = away; night = night, else home). "כן, דרוך" goes through the alarm's own code pad whenever the panel asks for a code (`code.arm` = `pin` / `panel`) and sends nothing before the code is confirmed; a panel whose rule is "no code to arm" arms on the "כן" (the same rule as the alarm screen, where arming is one tap plus one confirmation). "לא עכשיו" closes everything and sends nothing. Personal switch "הגדרות › סצנות › הצעה אחרי סצנה" (layout key `scene_suggest`, on when absent) |

Note on "with the usual code" for doors: the product has no code for **locking** a door (only opening goes through the door rule); a
lock from the suggestion is the usual one-tap lock command after the dialog's own "כן". No code is invented on the client.

## Files

- `frontend/src/home/home-favgrid.ts` (new, pure): `layoutFavPages`, `cellArea`, `moveTo`, `dropIndex`, `insertAt`, `addCandidates`, `sceneSuggestions`, `armNeedsCode`.
- `frontend/src/home/home-fav-ui.ts` (new): `FavDrag`, `favHole`, the "הוספת מועדף" sheet (ext module `favAdd`).
- `frontend/src/home/home-scene-2500.ts` (new): the suggestion (ext module `scene2500`, kind `next`), the scene edit sheet (kind `edit`), the settings row.
- `frontend/src/home/sw-home.ts` (hooks only): imports, a `favApi` bridge object, one line in `onPointerDown`, `a_scene` calls `afterScene` once the scene ran, `sRoom` uses `layoutFavPages`, `widget()` gets its cell, the settings scenes tab uses `sceneEditBtn` / `sceneSuggestRow` (page size 8 -> 6, 5 -> 4 on a phone, for the added row).
- `frontend/src/home/home-api.ts`: `canEdit` with `canAnywhere('scene.manage')`; `HomeLayout.scene_suggest`.
- `frontend/src/home/home-styles-extra.ts`: the hole, the lifted tile, the drop outline, the picker grid.
- `frontend/src/i18n/lang/en/i18n/msg/home.ts`: 33 new English texts, 2 removed (no longer used).
- `smplwise_vms/backend/smplwise/services/home_interface.py` `clean_layout`: `scene_suggest` boolean (no migration, the layout is JSON).

## Tests

- Unit (Node): `frontend/tests/unit-home-favorites-2500.spec.ts` - 19 tests: order kept / holes / camera height / page break / no overflow (randomised 40 items x 3 grid sizes) / clamping / drop index / insert / candidates / suggestions / code rule.
- Browser (mocked backend, preview build): `frontend/tests/home-favorites-2500.spec.ts` - 9 tests (tablet 1024 x 768, phone 390): Q78 order + hole + add at hole + no scroll, phone pages, Q77 long-press drag onto a tile and onto a hole + short press is not a drag + arrows still work, Q79 lock then arm with the code (nothing sent before the code), "לא עכשיו" / another scene / the switch off, Q75 floor-scoped manager edits (rename + capture + trash with confirm) and no edit without `scene.manage`, Q76 no hold.
- Captures: `frontend/tests/home-favorites-2500-shots.spec.ts` (`SW_SHOT_TAG=before|after`, `SW_SHOT_DIR`), page `private/planning/home_favorites_2500_compare_2026-11-23.html`.
- Backend: `smplwise_vms/backend/tests/test_home_scene_manage_2500.py` - 5 tests: a floor-scoped scene manager creates / renames / captures / deletes (delete needs `confirm`); a member with only run + control gets 403 on create, update, delete, capture and `can.edit = false`, and still runs the scene; no scene outside the manager's floor; `/home/family` `scenes.capture` follows scene.manage at any scope; `scene_suggest` layout key.
- Allow-list: `unit-modal-stack-guard-2442.spec.ts` lists the two new files' dialogs (drawn in sw-home's `ovl` slot, one HandModal layer).

Results (real runs, PC, 23.11): unit 19 passed; home-favorites-2500 browser 9 passed (and 18/18 with --repeat-each=2); the
whole home browser set (home-*.spec.ts + layout-home-*, preview build, --workers=4) 158 passed, 327 skipped (project / size skips),
10 failed - all 10 in layout-home-edit-bar-wp4 and layout-home-widgets-wide-298, whose headers say they need the Vite DEV server
(widget-break harness, the full interface's home-widgets; no file of this branch); NOT_RUN on a dev server. All node unit specs:
5097 passed, 2 failed (unit-modal-stack-guard-2442: fixed by the allow-list entry, then passed; unit-replay-3d: passes alone, a
load flake unrelated to this branch). Backend: test_home_scene_manage_2500 + test_home_interface + test_setting_value_parity 39 passed;
test_automations_scope + _access + _api 26 passed.

Pixel baselines: the dense-flow change moves tiles of the default living-room favourites on the portrait tablet, so
`pixel-home-auditfix-2437` `auditfix-room-{dark,light}-768` are expected to change (4 x 5 grid: the climate tile no longer back-fills,
a "+ הוסף" hole appears). The refresh (`run_remote.sh preview ... pixel-home-*.spec.ts --project=desktop --project=mobile -u`,
SW_WORKERS=1) is queued on runner slot B and had not started when this note was written (slot B busy with other jobs); the
refreshed *-linux.png files must be reviewed and committed before this branch joins a train.

## Known limits

- The drag is verified with mouse pointer events in Chromium; not on a physical tablet (touch pointer events follow the same path, `touch-action: none` while editing).
- Scene editing in the home interface covers name, "keep the current state" of the scene's own members, and the trash; adding / removing members stays in the full interface's scene editor.
- The suggestion is offered only for scenes whose name reads as leaving / night (the existing `SCENE_ICON` rule); a per-scene choice is not built.

## Rollback

Revert the branch commits. No migration; an old client ignores `scene_suggest`.
