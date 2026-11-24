# DOOR-PREVIEW-I18N-2500 - the door hand-over preview in the reader's language

Branch `pilot/DOOR-PREVIEW-I18N-2500`, cut from `origin/pilot/REVIEW-2490-FIXES-2500` at `21e444071` (it builds on F3's `lang`
parameter of `door_conversion.listing` / `_offer` / `program_plan`). Follow-up of REVIEW-2490-FIXES-2500 F3, which left "the rest of
the preview's words (`days_text`, reason texts)" Hebrew. No setting, migration, wire model or API shape change; no look change (only
the language of texts the screen already shows verbatim).

## What changed

Mechanism: I18N-BACKEND-2490 (`smplwise/i18n.py`). A text is a `Msg` whose string value IS the Hebrew the code wrote before; only the
edge that answers one request renders it in the requester's `ui.lang` (`default_names.lang_of`; no user / no stored value = Hebrew).

* `smplwise/services/door_conversion_text.py` (new): the catalogue, two namespaces, 104 keys.
  * `doorconv.*` (62): `category.*` (6), `action.*` (3), `state.*` (2), `why.*` (33, every "why not available" reason), `err.*` (10,
    the refusals of an action / an undo), `day.*` (7) and `day_sep`.
  * `doorpath.*` (42): the inventory words the preview carries - `kind.*`, `origin.*`, `approver.*`, `guard.*`, `suggestion.*`,
    `unresolved.*`, `door_problem.unmapped`, and the labels of a door with no name of its own (`relay` "ממסר {n}", `door_unmapped`,
    `door_unknown`).
  * `as_msgs(prefix, table)`: turns a module's Hebrew table into `Msg`s and refuses at import if a catalogue Hebrew differs from the
    module's word (so a Hebrew reader's bytes cannot drift).
  * English handwritten with the words of the frontend's English catalogue (`msg/system-a.ts`: "Disable and record", "Convert to an
    Arx door task", "Move to a fixed opening window", "No items that open a door were found"; `automation.ts` / `components.ts`:
    "Created outside the system", "Unknown source", "Schedule", "Scene", "Script", "Automation"; "Approved").
* Day names: no second day table. The English is the existing `default_names.DAY_SHORT["en"]` (Sun .. Sat, the same words as the
  automation sentences' `auto.wd.*`). Its Hebrew is NOT reused: `DAY_SHORT["he"]` / `auto.wd.*` write a geresh (U+05F3, "א׳") while
  the preview has always written an ASCII apostrophe ("א'"); reusing them would change a Hebrew reader's bytes. `days_text` is now
  `i18n.join(day_sep, days)`: Hebrew "א' ב' ה'" (unchanged), English "Sun, Mon, Thu".
* `services/door_conversion.py`: `CATEGORY_TEXT`, `ACTION_TEXT`, `STATE_TEXT`, `UNAVAILABLE_TEXT` are `Msg` tables (the Hebrew literal
  tables stay as their source); `DAY_MSG` + `days_text()`; `listing(..., lang)` returns the answer rendered in `lang` (Hebrew: the
  `Msg`s as they are). The ten Hebrew `ApiError` messages of `act` / `undo` are catalogue texts, and `action_not_offered` /
  `already_handled` carry the reason's `Msg`, so the error envelope (I18N-BACKEND-2490 `ApiError.payload(cid, lang)`) answers an
  English user in English with no change at the router.
* `services/door_path.py`: `UNRESOLVED_TEXT`, `DOOR_PROBLEM_TEXT`, `KIND_TEXT`, `ORIGIN_TEXT`, `SUGGESTION_TEXT`, `GUARD_TEXT`,
  `APPROVER_TEXT` are `Msg` tables; a door label without a name is a `Msg` / `Cat` ("<station> · ממסר 3" keeps its bytes). An unnamed
  item's NAME stays the plain Hebrew word of its kind (`KIND_NAME`): it is a name - sorted, and stored in the conversion register's
  `item_name` - as `schedule_view.display_name`'s fallback in I18N-BACKEND-2490.
* `routers/doors.py`: `GET /intercom/door-path-inventory` answers through `localize_for` (the report the preview is built from: its
  kind / origin / approver / guard / suggestion / unresolved texts in the reader's language). `GET /intercom/door-path-conversion`
  is unchanged (it already passes `lang` since F3; the service now renders the whole answer in it).
* Frontend: no behaviour change. The screen logic (`screens/system-doors-logic.ts`) shows `state_text`, `days_text`, `kind_text`,
  `origin_text`, `approver_text` verbatim and never maps them; only the comment in `api/doors.ts` ("`reason_text` is the server's
  Hebrew") now says "the server's text in the reader's language".

Not translated on purpose: data (item names, station / relay names, door labels from the door windows, window names); the door job's
default name "משימת דלת" (`_door_job_name`: a stored name made by `act`, not shown by the preview - a default-names follow-up);
`services/door_blocks.py` and its route `GET /doors/blocks` (it reads `kind_text` / `run_guard_text` from the inventory, now `Msg`s,
but its own texts such as `door_run_guard.NOT_YET` are plain Hebrew and its route is not localized - it still answers all-Hebrew,
exactly as before).

## Tests

`tests/test_wxd10_door_jobs.py`, two new tests:
* `test_door_preview_i18n_2500_hebrew_unchanged_english_for_an_english_reader` - a reader with no stored language gets the old Hebrew
  literals (days "א' ב' ג' ד' ה'", category, origin, approver, run guard, why-not reasons) and the route's Hebrew equals the service's
  string for string; after `ui.lang = en`: the same machine fields (codes, offers, counts, names, doors), English days "Sun, Mon, Tue,
  Wed, Thu", English reasons / categories / inventory words, `unresolved` English, and no Hebrew letter left except data (names,
  doors); the inventory route in English; the 409 `door_conversion_off` and `action_not_offered` `user_message` in English, and in
  Hebrew again after `ui.lang = he`; the Hebrew listing afterwards equals the first one.
* `test_door_preview_i18n_2500_every_text_has_a_key_and_no_hebrew_literal_is_left` - the missing-key scan of this pass: every
  `doorconv.*` / `doorpath.*` key has Hebrew and English (no Hebrew letter in the English, the same slots); every table the preview
  and the report read is made of `Msg`s with the right key and the module's Hebrew; `KIND_NAME` plain Hebrew; the days render
  Sun .. Sat; every reason literal the planners / `_offer` can return has a text; and no Hebrew string literal is left in
  `door_conversion.py`, `door_path.py`, `door_conversion_text.py` outside the catalogue's words (docstrings aside; "משימת דלת" listed).

Runs (real results):

| Check | Where | Result |
|---|---|---|
| `tests/test_wxd10_door_jobs.py` (whole file, 16 tests incl. the two new ones), main `.venv`, Python 3.12 | workstation | **16 passed** (16 dots, exit 0) |
| `tests/test_i18n_backend_2490.py` (the 2.49 backend catalogue scan: every key Hebrew + English, English without Hebrew, same slots - it now covers `doorconv` / `doorpath`) | workstation | **14 passed** (107 s) |
| `tests/test_singletons_registered.py` | workstation | **exit 0** (no failure) |
| `ruff check` (ruff 0.17.5, py -3.12) on the four changed package files | workstation | **all checks passed**; the test file shows the 4 old F811/F841 findings on lines this change does not touch |
| Runner slot B job `~/work/doori18n_job.sh` (log `~/work/doori18n_job.log`): `scripts/gate/lint_backend.py --strict`, `scripts/gen_wire_types.py --check`, 27 backend test files in 3 shards (every door / door-path / conversion / door-blocks file, the three `test_i18n_backend_2490*` files, `test_singletons_registered`) | runner | **NOT_RUN** - queued 08:18 UTC behind the 2.49.0 gate (ended ~08:50 UTC) and 15-20 other slot-B jobs; at 11:18 UTC it had not started. Left queued: the log fills when it runs. |
