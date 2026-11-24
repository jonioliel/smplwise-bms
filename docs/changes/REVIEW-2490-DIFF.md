# REVIEW-2490-DIFF - independent correctness review of the 2.49.0 train

Branch `pilot/REVIEW-2490-DIFF`, cut from `origin/release/2490-train` at `f73c20728`. Reviewed: `git diff v2.48.0..origin/release/2490-train`
(558 files), generated files skipped (built `www`, wire types, `API_INVENTORY`, `MISSING_KEYS_EN.*`). Rows: I18N-EN, I18N-SETTINGS-KEYWORDS,
I18N-BACKEND, I18N-DEFAULT-NAMES, GEN-UNITS-FIELD, TICKETS-PAGING, FLAKY-CAPTURE-SCREENSHOT, PHONE-SKIP-DESKTOP-SHOTS. Nothing on
`release/2490-train` was edited.

## Verdict

**No blocker for 2.49.0.** One confirmed defect to fix in 2.50 (tickets table paging) and two cosmetic language gaps. No code change is
committed on this branch (no confirmed blocker, so no fix was due).

## Confirmed findings

### F1 - fix in 2.50: the tickets table can open on a later page instead of page 1 (TICKETS-PAGING-2490)

- `frontend/src/screens/tickets-table.ts:385` - every `load(true)` calls `this.fit.reveal(prev.length)` ("load more shows the page of
  its first new row").
- `frontend/src/screens/tickets-table.ts:392-393` - the AUTOMATIC follow-up load (a first page shorter than `min(10, limit)` that still
  has a cursor - the server's scan budget under the visibility check) is also `load(true)`, so it reveals too, although nobody asked for
  "load more".
- `frontend/src/components/page-fit.ts:168-175` - `reveal(i)`: the pages were measured for the short first batch (`starts = [0, n]`,
  `total = n`), so `i = n` is not inside them and `want = n` is kept; `sync` (new total, same signature) goes through `resetKeep()`,
  which keeps an existing `want`; `page-fit.ts:302` then opens `pageOf(n)`.

Failure scenario: a user whose visibility rules hide most tickets (a department-scoped handler on a large installation) opens the table
on a tablet or desktop. The first answer has, say, 6 rows and a cursor; the table loads on its own; the region holds 5 rows per page
(comfortable density, a short window). The table opens on page 2, so the newest tickets (page 1) are not on screen. Each further short
answer in the chain repeats the jump, so it can land on the last page. Only paged mode (`fill`, tablet and up, long lists = pages) is
affected; the phone list and the `scroll` setting are not. No data is lost - the rows are all loaded and the pager can go back.

Proof: code path above (deterministic; no timing involved). Not reproduced in a browser (PC memory rules: no Playwright on the
workstation; the runner was not used for this).

Suggested fix (small): reveal only for a user-initiated "load more" - e.g. `load(more, silent = false, auto = false)`, call
`void this.load(true, false, true)` from the short-page chain, and guard the reveal with `if (more && !auto)`. Regression check: a
`unit-tickets-table` case with a fake `tableApi().page` answering 6 rows + cursor, then 30 rows, region of 5 rows: `fit.page === 1`.

### F2 - cosmetic: generator settings stay Hebrew after an in-place switch to English (GEN-UNITS-FIELD-2490)

- `frontend/src/generator/gen-settings.ts:39` - `const ENGLISH = mergeText(he.generator.settings, en.generator?.settings)` is computed
  once, when the module is evaluated. On a page that booted in Hebrew the English pack is not loaded, so `en.generator` is undefined and
  `ENGLISH` is a copy of the Hebrew table.
- `gen-settings.ts:41` - the `S` proxy picks `ENGLISH` when `uiLang() === 'en'`, i.e. the Hebrew copy.

Scenario: the language switch takes the in-place path (browser storage blocked - `i18n/ui-lang.ts`, no reload) after the infra settings
chunk was already loaded in Hebrew: the generator settings labels and the new units stay Hebrew while the rest of the page is English.
A reload (the normal path) is correct. Not a regression (2.48.0 showed this screen in Hebrew only). Fix: build the merged table lazily
on first English read (or read `en.generator?.settings` inside the proxy getter).

### F3 - cosmetic: the hand-over preview names an unnamed schedule's door window in Hebrew for an English user (I18N-EN-2490, N53)

- `smplwise_vms/backend/smplwise/services/door_conversion.py:469` - the offers listing calls `program_plan(conn, item_id)` without
  `lang`, so the previewed `program.name` is the Hebrew default "חלון פתיחה";
- `door_conversion.py:626` - the hand-over itself calls it with the user's language, so the window is created as "Door window".

Scenario: an English administrator hands over a schedule that has no name: the preview card shows the Hebrew name, the created window
has the English one. Only unnamed schedules; the preview's `days_text` is Hebrew for everyone anyway. Fix in 2.50 with the rest of the
preview's words (pass the reader's language to `offers`).

## Checked and found correct (no finding)

- Backend i18n core (`smplwise/i18n.py`, `errors.py`, `main.py` handlers): `Msg` is a `str` whose value is the Hebrew, so stored data,
  audit rows, logs, sqlite binding (`str` subclass), `json.dumps` / `JSONResponse`, `jsonable_encoder`, f-strings, copy / pickle keep
  the Hebrew; `localize` copies containers (shared caches are not changed); the error language is read only for a resolved user, on its
  own read connection, Hebrew on any failure; `ConfirmRequired.payload` (the only `payload` override) takes `lang`.
- Every literal backend catalogue key exists (AST scan of `t()` / `Msg()` calls after importing every `smplwise.*` module: 1,340 keys,
  0 missing, 0 without English, 0 placeholder mismatches between Hebrew and English). Every dynamic key site is either built at import
  (would fail the import) or guarded; the run-time ones were checked by value (`auto.label/verb/word.<action>` for every
  `ACTION_VERBS` entry, `trace.kind.*`, `ext.who.*`, `ext.conflict_title.*`, `generator.role.*`).
- Frontend English packs: 14,597 Hebrew-keyed entries, every `{placeholder}` set equal between key and English, no Hebrew left in an
  English value. No `tr()` result is compared with server text, used as an option value, a selector or a lookup key.
- Default names (N53): no default name is matched later by its text (recorders, levels, DXF labels, incidents, cases, generator, door
  window, schedule split, intake titles, NVR channel); `ensure_recorder` never renames an existing row; the automatic / background paths
  stay Hebrew as documented; `{ticket}` in the intake English template is rendered by `naming.render_for` before the values are filled.
- RBAC / access: `localize_for` wraps only what the routes already returned (no branch or filter changed); `role_name`'s `Lit` reads the
  tickets naming document, which always resolves both languages.
- No migration, no new setting, no changed default, nothing new to back up or restore (`ui.lang` predates 2.49.0).
- GEN-UNITS: every threshold / retention / run-log field has the unit of its key (bar, °C, %, V, Hz, hours, seconds, minutes, days; RPM
  fields unitless); the labels lost their bracketed units in both languages; `sw-field` has the `message` slot the defaults use.
- TICKETS-PAGING otherwise: page cut, `keep` place on resize / poll / delete / load more, header box and Ctrl+A on the page, "select all
  N" = loaded rows only, bulk actions keep off-page selections, `fillHeight` never exceeds the room, the row stretch is removed before
  each measure (controller `hostUpdated` rAF runs before the element's `updated` rAF).
- FLAKY-CAPTURE / PHONE-SKIP (test-only): the guard retries only "Unable to capture screenshot" on `Page/Locator.screenshot`, never an
  assertion or `toHaveScreenshot`; the per-project `testIgnore` keeps `**/archive/**`.

## Tests and checks run (workstation, real results)

| Check | Result |
|---|---|
| Import of every `smplwise.*` module + catalogue key / placeholder scan (main `.venv`, scratch script) | 0 import failures, 0 missing keys, 0 slot mismatches |
| Frontend English pack placeholder scan (scratch script over `src/i18n/lang/en`) | 14,597 pairs, 0 mismatches |
| `ruff check` (py -3.12, ruff 0.17.5) on the 81 changed backend source files, default rules and `F,B006,B023` | All checks passed |
| Unit / browser tests for F1 | NOT_RUN (no Playwright or vite on the PC; finding proven by the code path) |
| Runner jobs | NOT_RUN (none needed: no fix committed) |
