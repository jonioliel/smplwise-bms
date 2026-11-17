# CR-I18N-COMBINED-B-2442 - the two -2442 translation branches as one

Branch `pilot/CR-I18N-COMBINED-B-2442`. One entry check for both branches; neither is queued alone.

## Merged

| | head | based on |
|---|---|---|
| start: `pilot/CR-I18N-DATES-2442` | 2fe82a023 | `pilot/CR-I18N-COMBINED-2441` 910a7dbc0 (contains `main` 2.43.7, cc69447f1) |
| merged in: `pilot/CR-I18N-API-2442` | 7b51254ed | the same 910a7dbc0 |

Merge commit 93b8de98d (`git merge --no-ff`). The notes of the two branches stay as they are:
`docs/changes/CR-I18N-DATES-2442.md`, `docs/changes/CR-I18N-API-2442.md`.

## Conflicts and resolutions

The two branches met in five files only: `frontend/src/api/automations.ts`, `home-config.ts`, `notifications.ts`, `remote.ts`,
`schedules.ts`. No other file was changed by both (the glossary is the API branch's alone, the `unit-i18n-core` module list and
the missing-keys report are the DATES branch's alone - nothing to unite there).

1. **The import of `tr`** - a textual conflict in `automations.ts`, `remote.ts`, `schedules.ts`; a silent double declaration in
   `home-config.ts` and `notifications.ts` (git merged them, the compiler would not have). Both branches added
   `import { tr } from ...`, DATES from `i18n/msg/time`, API from the module's own `i18n/msg/api-*` table.
   Resolution, the same in the five files: `tr` is the module's api table (API owns every other string, 806 calls in these five
   files); the shared time words are read under an alias, `import { tr as trTime } from '../i18n/msg/time'`, and the 46 calls the
   DATES branch wrote (`lastRunText`, `relativeTime`, `dayLabel`, the two `whenLabel`, `sinceText`, `WEEKDAY_NAME`, `DAY_SHORT`,
   `DAY_LONG`) became `trTime(...)`. No text, key or table changed; `i18n/msg/time.ts` and the nine api tables are as the
   branches left them.
2. One line was written by both branches, identically: `lastRunText` `tr('רץ עכשיו')` in `automations.ts` (API had its English
   in `msg/api-automation`, DATES in `msg/time`). It is relative time, so it reads `msg/time` like the rest of the function; the
   api table keeps the key, which `automations.ts` still uses elsewhere (the completeness case passes). In `src/api`: 1,863
   `tr()` + 46 `trTime()` calls.
3. Everything else in the five files merged cleanly and was read: the DATES lines (`uiLocale()`, the time words) and the API
   lines (the other strings, `tr` -> `trg` in `automationSentence`) do not share a line.

## Follow-ups the merge needed (commit ab0b3bc4b)

- **The API lint's allow-list** (`frontend/tests/unit-i18n-api-2442.spec.ts`). The lint now accepts both translators (`tr`,
  `trTime`). The 54 literals the DATES branch moved left the lists (161 -> 107): `automations.ts` 35 -> 26, `home-config.ts`
  67 -> 58, `notifications.ts` 23 -> 7, `schedules.ts` 17 -> 0 (only the typed confirmation word is named), `remote.ts` 3 -> no
  entry. The counts are exact, so a listed text that disappears, or a new one, fails. What stays listed, because neither branch
  moved it (reason in the spec): `automations.ts` `durationText` 10, the weekday letters of the sentence builder 7,
  `formatDuration` 9; `home-config.ts` the Hebrew calendar date 33, `parshaText` 1, the weather units 8, `untilText` 13,
  `agendaWhen` 3 ("היום", "מחר", "כל היום"); `notifications.ts` the weekday letters 7; `frigate.ts` `spanText` 4; `health.ts`
  `fmtUptime` 5; `rules.ts` the weekday letters 7. An English summary can therefore still hold a Hebrew duration
  ("Wait 5 דקות") - a row of its own.
  A new case: every `trTime` text of `src/api` has its English in `msg/time`, the alias is imported from that table, and the
  five readers are the five files above.
- **`frontend/tests/helpers/i18n-source-scan.ts`**: `hebrewOutsideTr` / `trCalls` take an optional list of translator names
  (default `tr`, so the calendars / electricity / home / map specs read as before); `trModule` no longer takes an aliased import
  for the module's own table.
- **`scripts/i18n_missing_keys.mjs`**: it gave every `tr(` call of a file to every table the file imports, so the five files
  reported 679 "missing" keys for `msg/time`. A call is now counted for the table its own translator reads. Report regenerated
  (`--write`): 144 catalogues, 28,173 keys, 20 missing (as before both branches), `msg/time` 41 / 0, the nine api tables 0;
  hard-coded Hebrew outside the catalogues 4,668 literals in 191 files.

## Hebrew is unchanged

- The API branch's token comparison, rerun on the merged tree (throw-away script, not committed): every `tr()` / `trTime()` call
  undone textually (`tr('X')` -> the literal, `tr('a {n} b', { n: expr })` -> the template with `expr`), the added imports
  removed, and the token stream of each file compared with the file at 910a7dbc0, string tokens by value. All 64 files of
  `frontend/src/api` that differ from the base, 1,909 calls: **59 identical; 5 files differ only in the known places, no
  string token among them**:
  - `'he-IL'` -> `uiLocale()` 8 times (`building-presence-logic.ts` 1, `home-config.ts` 7) and `['he']` -> `[uiLocale()]` in
    `remote.ts` (DATES; equal in Hebrew - `unit-i18n-locale`);
  - `notifications.ts`: `WEEKDAY_NAME` is read at call time (`WEEKDAY_NAME()[t.wd]`), and the date of `dayLabel` is its own
    small template (`${t.d}.${t.m}`) - the same characters (DATES);
  - `automations.ts`: seven `String(...)` around a value, the local `tr` -> `trg` (API, as in its note).
- `unit-i18n-locale` (the DATES spec that pins the Hebrew texts and formats): 8 passed on the merged tree.

## Tests actually run (workstation)

- `npx tsc --noEmit` (frontend): clean.
- Playwright unit config, `--workers=1`: `unit-i18n-api-2442` (25), `unit-i18n-locale` (8), `unit-i18n-core`,
  `unit-i18n-cal-elec-lint`, `unit-i18n-cal-elec-completeness`, `unit-i18n-home`, `unit-i18n-map-wizard-2441`: 66 passed.
- Playwright unit config, every `tests/unit-*.spec.ts` (node-only), `--workers=2`: 4,474 tests - **4,459 passed, 10 skipped
  (declared by the specs), 5 failed**: the five of `unit-session-me-failure-2435.spec.ts`, a page spec the unit config does not
  recognise as one (`page.goto('./#/...')` with no base address). Not from this branch; it passes against the preview (next line).
- `npx vite build`, then `playwright.config.ts --project=desktop --workers=1` on a private preview port (4347):
  `evidence-automations-list`, `evidence-notifications`, `evidence-schedules-list`, `home-v3-p2`,
  `unit-session-me-failure-2435`: 140 tests - **139 passed, 1 skipped (declared by the spec), 0 failed**. The evidence PNGs these specs rewrite were restored, none is committed;
  `dist/` deleted.
- `node scripts/i18n_missing_keys.mjs --write`: figures above.

## NOT_RUN

- Pixel suites, layout suites, the other evidence specs, the tablet and mobile projects, the page unit specs
  (`SW_UNIT_PAGES=1`), the backend (no backend file changed). They belong to the runner entry check, queued once for this
  branch (short name `i18ncombB`).
- No English screen was opened in a browser.
- No lab or device access.

## Pixels expected

None in Hebrew: the Hebrew strings and formats are the same strings (comparison above). No PNG is committed. There is no
English baseline. The lists of pixel specs that cover the touched screens are in the two branch notes.

## Owner questions

None new. The open ones are in the two branch notes (the typed confirmation words, the saved building names, the demo data;
the dotted date format, `en-GB`, the public pages).
