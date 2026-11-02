# TICKETS-1440-COLUMN-SETTING-2360 - which column the default tickets table keeps at a medium width

Branch `pilot/TICKETS-1440-COLUMN-SETTING-2360`, cut from `origin/release/2342-train` @ `529ae6f83` (2.34.2). No version bump, not merged.
Static demo and fakes only. No migration: one new key of the tickets settings document (`ui.table_mid_width`) with a default.

## 1. The request (owner 02.11, evening)

At about 1440 px the default tickets table cannot show both the "מה קורה" sentence column and the department column
(`docs/changes/SMALL-UI-BUGS-2343.md`, `docs/changes/GATE2342-B.md` section 2: with the sentence column on - the default - the department
column steps aside at 1440 and the chooser says so). The owner asked for a setting, default = today:

| Setting | Key | Values (first = default) |
|---|---|---|
| בטבלה ברוחב בינוני הצג | `ui.table_mid_width` | `sentence` משפט, `department` מחלקה |

Whatever is chosen, the other column stays available from the column chooser, and the viewer's own column choice wins over the default.

## 2. How it works

`tickets/table-model.ts fitTable(cols, width, select, choice, mid)` wraps `fitColumns` (unchanged) and decides the sentence column too:

| Situation | Result |
|---|---|
| `sentence` (default), any width | exactly today: `fitColumns(cols, width, select, ['sentence'])` - at 1440 the department steps aside |
| `department`, the default column set, the viewer never touched the sentence tick, the set + sentence does not fit | the sentence column steps aside; the default set is then fitted without it (at 1440 it is whole, department included; at narrower widths the usual place / priority shedding applies) |
| `department`, both fit (wider screens) or the width is not measured yet (0) | nothing dropped |
| the viewer ticked the sentence in the chooser (kept in this browser, `sw.tickets.table.sentence` = 1) | the choice wins: the sentence shows and the department steps aside as before |
| the viewer unticked the sentence | gone, with either setting; the department then fits at 1440 |
| the viewer's own column set (chooser, saved view; not the default set) | never fitted (as in SMALL-UI-BUGS-2343): the table scrolls sideways rather than drop a chosen column; the sentence as ticked |

`tickets/list-prefs.ts readSentenceChoice()` tells "never touched" (`default`) from a tick (`on` / `off`); the tick used to be a plain boolean,
so a stored `0` still means off and a stored `1` still means on - no stored value changes meaning. The chooser (`tickets/table-toolbar.ts`) shows the
sentence tick as the table shows it, and the "some columns are hidden so the table fits" note also appears when only the sentence was fitted away.

## 3. Storage and editing

- Backend: `services/tickets/settings_doc.py` SCHEMA `("ui", "table_mid_width")` (default `sentence`, a corrupt stored value reads as the default),
  `routers/tickets_admin.py UiPatch` (anything else -> 422). Served to every viewer by GET tickets/module with the rest of `ui`.
- Frontend: `api/tickets.ts UiSettings.table_mid_width`; `screens/tickets-list.ts` passes it to `<tickets-table .midWidth>`; the row lives in
  Settings > tickets module > display ("פתיחה והצגה" card) after the drawer rows (`tickets/settings-table.ts`, words in `tickets/list-text.ts`,
  Hebrew and English).

## 4. Tests

- `frontend/tests/unit-tickets-1440-column-setting-2360.spec.ts` (Node, 8 tests): the key and its parsing; the default equals today's `fitColumns` at
  1100-1920 with and without the selection column; "department" at 1440 / 1280 / 1920 / not measured; the viewer's tick, un-tick and own column
  set; the screen, the toolbar note, the settings row and the words; server <-> frontend parity.
- `smplwise_vms/backend/tests/test_tickets_admin.py::test_table_mid_width_setting_defaults_to_the_sentence_column`: default, a valid save served by
  GET tickets/module, refused values (422), a corrupt stored value reads as the default.
- `frontend/tests/evidence-tickets-table.spec.ts` (runner, desktop 1440): default = sentence and no department; `department` setting = department
  and no sentence, no sideways overflow, the chooser note and an unchecked sentence tick; ticking the sentence wins and is remembered across a reload.
  Screenshot `mid-width-department-desktop-light-classic.png` in `docs/design/evidence/tickets-s6b/`.

## 5. Pixel baselines

None expected to change: the default (`sentence`) draws exactly what 2.34.2 draws (the unit test compares the column set with the old
`fitColumns` call at every width), and the only new visible thing is one more row in Settings > tickets > display, which no committed baseline
covers (the visual matrix has no tickets-settings case; the layout sweep `layout-tickets-table` checks the table, not the settings card).
Only the `department` setting changes the table, and no baseline uses it.

## 6. Not done / for the owner

- The default stays "sentence", so at 1440 the department column is still hidden unless the owner picks "מחלקה" (or ticks it in the chooser).
- Nothing was done for widths other than the "medium" one: wide screens show both, narrow ones keep shedding place / priority as before.
