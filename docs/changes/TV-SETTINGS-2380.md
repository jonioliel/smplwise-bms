# TV-SETTINGS-2380 - the two TV-fit settings are saved, validated, audited and served

Branch `pilot/TV-SETTINGS-2380` (from `pilot/TV-FIT-2380`). Plan row D3 (BOARD-ADMIN), backend and API part only. No version bump, no merge.
Frontend screen files (`system-notices.ts`, `display-*.ts`, `i18n/notices.ts`) are untouched on purpose: the Settings screen is being
merged in the 2.37.0 train. `docs/changes/TV-FIT-2380.md` section 3 lists these two keys as "not wired yet"; this change wires the server side.

## 1. What changed

The two keys join the V2 group of TV board options (`TV2_CHOICES`, `services/notices/model.py`) - the same mechanism as
`portrait_order` / `next_row`: the installation default is stored in the settings table (`notices.tv2.*`), a board may hold its own value in
its display JSON, and the TV feed carries the effective value (the board's own, else the installation default, else the factory value).
No migration, no new route.

| Key | Values | Factory | Installation default (stored string) | Board's own value |
|---|---|---|---|---|
| `portrait_chips` | `rows`, `drop` | `rows` | `notices.tv2.portrait_chips` | `display.portrait_chips` (absent = follow the default; `null` in a PATCH removes it) |
| `safe_margin` | integer 0..5 (percent of each side) | `0` | `notices.tv2.safe_margin` | `display.safe_margin` (same) |

- **Validation** (`tv_value_ok`, shared with every TV option): the exact type of the list - `safe_margin` must be a JSON integer (no `2.5`,
  no `3.0`, no `"3"`, no `true`), `portrait_chips` a string from the list. Out of range / wrong type = 422 on `PUT /notices/tv-defaults`
  and on a board `PATCH` / create (`display.<key>`), nothing saved. A bad value already stored reads as the factory value and is never sent to
  the TV. `TvDefaultsIn` gets `portrait_chips: str | None` and `safe_margin: StrictInt | None`.
- **Permission**: unchanged - `notices.boards` for both the defaults (`PUT /notices/tv-defaults`) and a board's display (`PATCH /notices/boards/{id}`);
  `GET /notices/tv-defaults` and `GET /notices/settings` (`settings.tv2_defaults`) return them under `notices.boards` read access.
- **Audit**: `PUT /notices/tv-defaults` already audits `notices.tv_defaults.update` with the changed setting names (only when a value really
  changed). New: a board `PATCH` that changes either key adds `details.tv_fit = {key: new value | null}` to the `notices.board.update` row
  (null = the board went back to the default).
- **Served to the TV page**: `GET /notices/display/{slug}` -> `board.display.portrait_chips` / `.safe_margin` (always present, effective values);
  the Settings preview (`POST /notices/boards/{id}/preview`, draft display) resolves them the same way.
- **Safe margin per device**: the TV's own `?safe=<n>` still wins over the board value (TV-FIT-2380). The server accepts whole percents only; the
  page tolerates halves from the address (`?safe=1.5`) because overscan is a per-device measurement, but the saved setting is a whole percent.
- **API inventory**: no route was added or changed, so `contracts/API_INVENTORY.md` is not regenerated.

## 2. Tests

`tests/test_notice_tvsettings_2380.py` (new): choices and factory; every valid value; model refusal of bad values (wrong enum, empty, number
for the enum, -1, 6, 2.5, 3.0, "3", bool); a stored bad default reads as factory; the effective display (own value, default, factory);
board follows default until it chooses (a board's own `0` beats a default of 3; `null` returns to the default), settings document and
preview carry the keys; API refusal (422, nothing changed); permission (viewer 403, `notices_boards` allowed); audit (defaults row lists the
keys, an unchanged save writes no row, board row carries `tv_fit`, an unrelated change carries none).
`tests/test_notice_boardv2_297.py`: its `KEYS` / `FACTORY` now include the two keys (they assert the whole `tv2_defaults` document).

## 3. The UI rows the Settings screen needs later (D3, after 2.37.0)

Both rows belong to the "TV boards" card of Settings > Notice board (installation defaults, `mode="defaults"`) and to the board's display
tab (`mode="board"`, with the first button "ברירת מחדל" that sends `null`). They are segmented choices like the existing rows
(`display-design.ts` is the closest pattern: add `portrait_chips` and `safe_margin` to its `ROWS` with `PORTRAIT_CHIPS` / `SAFE_MARGINS`
lists, factory `rows` / `0` in `TV2_FACTORY` of `tv-logic.ts`, text keys `portraitChips_*` / `safeMargin_*` in `i18n/notices.ts` with an English
twin). Both rows are for a portrait / TV-specific screen, so they sit near "סדר במסך אנכי".

| Row | Label (he) | Values and button text (he) | Hint (he) |
|---|---|---|---|
| `portrait_chips` (seg `portrait-chips`) | `תצוגת אייקוני המבנה במסך אנכי` | `rows` = `שתי שורות` ; `drop` = `שורה אחת, מסתירים את התקינים קודם` | `במסך אנכי אייקוני המבנה (מעליות, גנרטור, חניה, חדר כושר) והשורה "עודכן" יכולים לא להיכנס בשורה אחת. "שתי שורות" מציג את כולם; "שורה אחת" שומר על שורה אחת ומסתיר קודם את התקינים (תקלה נשארת עד הסוף).` |
| `safe_margin` (seg `safe-margin`) | `שוליים בטוחים בקצוות המסך` | `0` = `ללא` ; `1`..`5` = `1%` .. `5%` (the value, with a percent sign) | `מרחק מכל קצה של המסך שבו לא מציירים. מתאים לטלוויזיה שחותכת את הקצוות (overscan). לבדיקה על מכשיר אחד אפשר להוסיף לכתובת ‎?safe=3‎ (גובר על ההגדרה). ברירת המחדל: ללא.` |

Behaviour of the rows:

- The board-mode note under an unset row is the existing `tvDefaultNow` ("ברירת המחדל כעת: ...") with the default's button text.
- `safe_margin` is a stepper of six buttons (0..5), not a free field: the server takes whole percents only. A board value of `0` is a real
  choice (it turns an installation margin off for that board); "ברירת מחדל" is the only way to follow the installation value.
- Neither row is disabled by another setting (they apply to every design; `portrait_chips` only matters on the classic footer, and the
  hint says when it matters, so no disabled state is needed).
- A refused save returns 422 with `field: "display.<key>"` / `"<key>"`; the screen already shows the message of any 422, no new copy.
- The English twins for `i18n/notices.ts` (not Hebrew-only product text): "Building chips in portrait" (Two rows / One row, healthy ones hidden
  first) and "Safe margin" (None / 1% .. 5%).

## 4. Not run / open

- Frontend: nothing changed, nothing to type-check or build here.
- The default `safe_margin` for a real TV is chosen by the owner after the real-TV session (D2); the factory stays 0.
- If a later decision wants half-percent steps, widen `SAFE_MARGINS` (the TV page already rounds to halves); the type check rejects floats today.
