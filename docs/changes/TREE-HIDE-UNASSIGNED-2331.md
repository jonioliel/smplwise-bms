# TREE-HIDE-UNASSIGNED-2331 - hide "ללא שיוך" from the building tree

Owner request (01.11, screenshot of the building tree with "ללא שיוך · 86" at its foot): allow hiding the unassigned bucket from
the tree once editing is done. Branch `pilot/TREE-HIDE-UNASSIGNED-2331` (from `origin/main` 52a8d9129). No version bump.

## The setting

`home.screen.tree_unassigned` (one installation setting, the existing `home.screen` object; PATCH /settings, system.configure,
audited like every `home.*` key; unknown values are refused with 422):

| value | Hebrew | the tree's row |
|---|---|---|
| `always` (**default**, today's behaviour) | תמיד | always drawn |
| `editing` | רק כשאני עורך | only while the screen editor is open (`?edit=1`, which only a system.configure holder can open) |
| `never` | אף פעם | never drawn |

Settings UI: "הצג "ללא שיוך" בעץ" in the home-screen options form (הגדרות ‹ חשמל והתקנים ‹ מסך ראשי, and the screen editor's options
card), with a note on what hiding keeps and a link that opens the bucket's own screen.

## Quick hide from the row

- A system.configure holder (GET /settings `can_edit`), outside the editor, with the row shown because the choice is `always`, gets a
  "⋯" on the row with one item: **הסתר מהעץ**. It saves `{"home.screen": {"tree_unassigned": "editing"}}` at once (a partial PATCH),
  removes the row and shows a notice "'ללא שיוך' הוסתר מהעץ. יופיע שוב במצב עריכה." with **בטל** (focus moves to it; 8 s). "בטל" saves
  the previous value back. A refused save restores the row and says "השינוי לא נשמר".
- A user without system.configure sees the row exactly as before (no "⋯", no wrapper).
- In the screen editor, when the choice is not `always`, a dashed hint under the tree says the row is hidden outside the editor
  (`editing`) or hidden (`never`), with **הצג תמיד** (sets the editor draft; saved with "שמור") and where the setting lives.

## Scope and semantics

- Presentation only. No entity, area, binding or count changes; the backend devices tree still returns `unassigned`.
- **"כל המבנה" keeps its current semantics**: `building` counts are computed over every entity, including the unassigned ones
  (`services/devices.py`), and stay that way whether the row is shown or not - hiding a row must never change a number.
- The setting governs the tree row (cards view on desktop / landscape tablet, the phone's tree sheet) and the portrait-tablet
  "ללא שיוך" card that stands in for the tree where no tree is drawn. The layout editor still lays out that card. The tiles view's
  own "ללא שיוך" section is **not** a tree and is unchanged (an open question for the owner: should it follow too?).
- Still reachable when hidden: its screen `#/devices/areas/unassigned` (the settings link), the tiles view, and the screen editor.
  The global search does not list the bucket (unchanged; it never did). The mapping assistant's "לא משויך" is a different concept
  (an area or floor without a building) and was not touched; the tree keeps its own word "ללא שיוך".

## Files

- `smplwise_vms/backend/smplwise/services/home_screen_options.py` - the choice and its default.
- `frontend/src/api/home-screen.ts` - type, choice list, default, `treeUnassignedShown`, `treeUnassignedHint`.
- `frontend/src/screens/tree-unassigned.ts` (new) - the row with its "⋯", the editor hint, the undo notice, their CSS (tokens only).
- `frontend/src/screens/devices-building.ts` - gating, save / undo, the portrait-tablet card.
- `frontend/src/screens/home-screen-options.ts`, `frontend/src/i18n/home-screen.ts` - the settings choice and the words (he / en).
- Tests: `smplwise_vms/backend/tests/test_tree_unassigned_2331.py` (new), `test_home_screen_options_295.py` (defaults),
  `frontend/tests/unit-tree-unassigned-2331.spec.ts` (new), `unit-home-screen-295.spec.ts` (defaults),
  `frontend/tests/evidence-tree-unassigned-2331.spec.ts` (new; BV1 mock in API mode, desktop / tablet / mobile).
- Evidence: `docs/evidence/TREE-HIDE-UNASSIGNED-2331/`.

## Pixel baselines likely affected

The default keeps the row, but a configure holder now gets the "⋯" column beside it (the row is wrapped and its count lines up
with the other rows' count column). Baselines that draw the cards-view tree with a non-empty unassigned bucket as an administrator /
demo session: the home / devices-building cards-view shots (desktop 1440 and landscape tablet 1024; phone tree-sheet shots), e.g. the
HOME-295, HOMEINFO-295, BV1 / bubble home, POLISH-CONTROL-297 and MULTIBUILDING-HOME-2330 building-level shots, and any
`evidence-devices` building-tree shot. The tiles view and viewer-session shots are unchanged.

## Rollback

Revert the branch commit. A stored `tree_unassigned` value left behind is refused by an older `normalize` only on a later PATCH that
re-sends it; `stored()` of an older build reads the whole object as defaults if it does not know the key - so before rolling back, set
the choice to `always` (or remove the key) to avoid resetting the other home-screen options.
