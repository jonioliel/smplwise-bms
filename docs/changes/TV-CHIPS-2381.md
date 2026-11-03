# TV-CHIPS-2381 - portrait TV chips by priority, and sources for the parking and gym chips

Branch `pilot/TV-CHIPS-2381` (from `origin/main` = v2.38.0, efc12d0e3). Owner answers 03.11 afternoon
(`private/planning/OWNER_ANSWERS_2026-10-30_NIGHT_HE.md`, round 15): **Q3 = B**, **Q4 = A**. No version bump, no merge, no tag.
**No migration** (main ends at 0196; nothing new).

## 1. Q3 - portrait chips: hide by priority by default

The owner chose B ("hide chips by a priority order set in the settings") as the behaviour and kept the setting so a screen can be
switched between A (two rows) and B. 2.38.0 shipped A as the default (`TV-FIT-2380`, `TV-SETTINGS-2380`).

### 1.1 How the setting is stored (checked before changing anything)

| Level | Where | "Unset" | Explicit A |
|---|---|---|---|
| Installation default | settings row `notices.tv2.portrait_chips` | no row | a row holding `rows` |
| One screen (board) | `display.portrait_chips` in the board's display JSON | key absent (`null` in a PATCH removes it) | `"rows"` |

The board level always told "unset" from "rows" apart. The installation level did too, with one gap: `store.write_settings` writes a row
only when the value differs from the one in force, so an administrator who pressed "שתי שורות" while it was already the factory value
left no row. That press was a no-op in the UI (the key was already pressed) and no audit row was written either, so there is nothing to
recover; an installation that went drop -> rows **has** a stored `rows` and keeps it. Because unset and explicit values are
distinguishable where it matters, **no migration** was needed: changing the factory value is enough.

### 1.2 What changed

| Piece | Change |
|---|---|
| `services/notices/model.py` | `TV2_FACTORY["portrait_chips"] = "drop"` (so `SETTINGS_DEFAULTS` too). Unset installation -> drop; a stored `rows` and a board's own `rows` win as before (`effective_display`, `_defaults_doc` unchanged). |
| `services/notices/store.py` + `routers/notices.py` | `write_settings(..., pin=True)` for `PUT /notices/tv-defaults`: a TV default equal to the value in force is now stored when the key has no row yet (not reported as a change, not audited), so a later factory change never moves a choice an administrator made. Other settings unchanged. |
| `services/notices/model.py` `normalize_display` | `blocks.info` keeps the administrator's order (repeats dropped). Before, it was forced to the factory order, so the priority could not be edited. Stored boards keep their lists, which are already in the factory order. |
| `notice-tv/tv-fit.ts` `chipFitOf` | Fallback for a feed without the key is `drop` (the feed always carries the effective value; this keeps the page and the server in step). `dropOrder` unchanged: healthy chips leave first (then "off", then warnings, an alarm last), and within one state the chip **lower in the board's list** leaves first. |
| `notices/display-fit-model.ts` | `TVFIT_FACTORY.portrait_chips = 'drop'` (the Settings rows show "ברירת המחדל כעת: שורה אחת..." for a board that follows the default). |
| `notices/display-info.ts` (board › תצוגה › מצב הבניין) | An ordered list: each picked kind has "הזזה למעלה" / "הזזה למטה" keys (disabled at the ends); ticking a kind adds it last; a hint says the order is the order on the TV and the priority. Pure rules in new `notices/info-chips-model.ts`. |
| `i18n/notices.ts` | Only two existing texts: `portraitChips_drop` = "שורה אחת, מסתירים לפי סדר העדיפות" (en "One row, hidden by priority") and `portraitChipsHint` (names the default and the list that sets the priority). |

Default order for new boards (unchanged): elevators, generator, parking, gym.

**Decision kept (open question 1):** the state still comes before the list order - a chip with a fault or a warning outlasts a healthy chip
that is higher in the list. This is the 2.38.0 behaviour the owner saw ("תקלה נשארת עד הסוף").

## 2. Q4 - parking and gym chips read picked entities

Before: `services/notices/info.py` had no provider for `parking` / `gym`, so those chips never showed.

| Piece | Change |
|---|---|
| Settings keys | `notices.info.parking_entities`, `notices.info.gym_entities` (JSON lists in the settings table, default `[]`; no migration). API fields `parking_entities` / `gym_entities` on `GET` / `PATCH /notices/settings` (`system.configure`, audited by the existing `notices.settings.update` row with the key names). At most 8 each; each id must be of a domain the chip can read (422 otherwise). A bad stored value reads as empty / filtered. |
| Domains | parking: `sensor`, `input_number`, `counter` (a number = free spaces, summed), `binary_sensor`, `input_boolean`, `switch` (one space each, on = taken), `input_select`, `select` (the option as written). gym: `binary_sensor`, `input_boolean`, `switch`, `schedule` (on = פתוח, off = סגור; an occupancy / presence / motion binary sensor = בשימוש / פנוי), `input_select`, `select`. **No number for the gym**: a count of people is never shown. |
| Chip words (he / en) | parking: "{n} פנויות", "מקום אחד פנוי", "מלאה" (warn); gym: "פתוח", "סגור" (off colour), "בשימוש", "פנוי"; a list option as written (cut to 24 characters); "לא זמין" (off) when no picked entity is available, the mirror is disconnected, or the entity is gone. **Nothing picked = no chip.** The chip carries the state only: never the entity id, its name or a count of people. |
| Read-only | The providers read `ha_entities` (the state mirror) only; nothing is written and no service is called (a test compares the mirror before and after). |
| `GET /notices/settings` | new `info_entities: {parking: [...], gym: [...]}` - the candidates for the pickers: the chip's domains, not removed, not disabled; parking numbers only without a device class (a count, not a temperature); binary sensors only with a class that fits (parking: none / occupancy / presence; gym: also motion / door / opening). An entity already picked is always listed. Same pattern as `weather_entities` beside it. |
| `notices/info-sources.ts` (new, `<notice-info-sources>`) | In Settings › Notice board, the defaults card, right under the weather / building row: "מקורות לסמלי החניה וחדר הכושר" with a list per chip (names, "הסרה"), a select of candidates and "הוספה" - the select-of-entities pattern of the weather row, several per chip like a board's news feeds. Saved at once through the screen's `patchSettings`. A picked entity the mirror lost shows "לא נמצאה" and can be removed. Text in new `i18n/notice-chips.ts` (he + en), no platform words. |
| Board › תצוגה › מצב הבניין | A picked parking / gym kind with no source shows "אין מקור, הסמל לא יוצג. בוחרים מקור בהגדרות לוח ההודעות." |

The TV page needed no change for Q4: it already draws any chip the feed sends (icons for parking and gym existed).

## 3. Shared files touched (parallel work on the notice board)

Kept minimal: `screens/system-notices.ts` (+1 import, +2 lines mounting `<notice-info-sources>`, +1 attribute `.sources` on
`<notice-display-info>`), `i18n/notices.ts` (two existing texts reworded, he + en), `api/notices.ts` (+2 optional typed fields),
`routers/notices.py` (+1 import, +2 fields in `SettingsIn`, +1 key in the GET settings answer, the `pin=True` on tv-defaults),
`services/notices/store.py` (`write_settings` `pin` keyword). New strings live in the new `i18n/notice-chips.ts`.

## 4. Tests

| Spec | What |
|---|---|
| `smplwise_vms/backend/tests/test_notice_tvchips_2381.py` (new) | factory drop; unset installation -> drop, stored rows -> rows; a board's own rows kept, a following board gets drop; a TV default equal to the factory value pinned but not audited; `write_settings` pins only when asked; the order kept and deduplicated; the feed follows the board order; no source = no chip; parking (numbers summed, one free, full, occupancy spots, a list option, unavailable) and gym (open / closed, door + switch, in use / free, a long option cut, unknown) chips; English; a stale mirror = off; a removed or unknown entity = unavailable; no entity / name in the chip; a bad stored list; save + audit; refusals (gym number, wrong domain, bad id, not a list, 9 entities); `system.configure` needed; the candidates filter; nothing written to the mirror |
| `test_notice_tvsettings_2380.py`, `test_notice_boardv2_297.py` | factory `portrait_chips` now `drop`; the "non-default" steps use `rows` |
| `test_notices_info_295.py` | one test renamed (parking / gym have a provider now; without a source they still give no chip) |
| `frontend/tests/unit-tv-chips-2381.spec.ts` (new, node) | the defaults, the priority with a moved list, the order editor rules, the source lists, the no-source note, text (he / en, no platform words), the wiring read from the source |
| `unit-tv-fit-2380.spec.ts`, `unit-settings-rows-2380.spec.ts` | the new default and wording |
| `frontend/tests/evidence-tv-chips-2381.spec.ts` (new, preview) | Settings: sources listed by name, add / remove saved at once with the right body; board: move up / down, ends disabled, the no-source note, saved in the new order |
| `pixel-notice-tv-portrait-chips.spec.ts` | the 13 per-design cases and the landscape case pin `portrait_chips: 'rows'` (the two-rows pictures are unchanged); three new geometry tests: nothing set = one row, the chips that leave are exactly the first ones of the priority order, a warning stays, the time stays whole; a moved list changes which chip leaves; rows still keeps every chip |
| `pixel-notice-tv-mock.spec.ts` | "the default footer" test: a chip may leave, only a healthy one, never cut |
| `pixel-bustimes-295.spec.ts` | unchanged spec; its portrait pictures use the product default footer, so they follow the new default (see the receipts) |

## 5. Receipts

See the closing report of this branch (commit SHAs, tsc, unit, pytest and the runner jobs).
