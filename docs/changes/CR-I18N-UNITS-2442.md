# CR-I18N-UNITS-2442 - durations, units and weekday letters follow the interface language

Branch `pilot/CR-I18N-UNITS-2442`, based on `pilot/CR-I18N-COMBINED-B-2442` (4f1c8988f, contains `main` 2.43.7 cc69447f1).
Follow-up of the row CR-I18N-COMBINED-B-2442 left open: an English summary could still hold a Hebrew duration
("Wait 5 דקות"), because 107 literals of `frontend/src/api/*` were allow-listed in `frontend/tests/unit-i18n-api-2442.spec.ts`
as format texts nobody had moved.

## What moved

73 literals of six api files are now read from the shared table `frontend/src/i18n/msg/time.ts` through `trTime(...)`
(the alias CR-I18N-COMBINED-B-2442 introduced). The table grew from 41 to 80 keys (39 new; the seven weekday names with a
geresh and "היום" were already there).

| file | helper | literals | English |
|---|---|---|---|
| `api/automations.ts` | `durationText` | 10 | "1 hour", "2 hours", "{n} hours", the same for minutes / seconds, joined by " and " |
| `api/automations.ts` | `WD_SHORT` (the days of a time condition) | 7 | "Sun" ... "Sat" |
| `api/automations.ts` | `formatDuration` (trace durations) | 9 | "{n} ms", "{n} s", "{m} min {s} s", "{n} min", "{h} h {m} min", "{n} h" |
| `api/frigate.ts` | `spanText` | 4 | "{n} s", "{m} min {s} s", "{n} min" |
| `api/health.ts` | `fmtUptime` | 5 | "{n} min", "{h} h {m} min", "{d} d {h} h" |
| `api/home-config.ts` | the weather units of `valueText` | 8 | "km/h", "m/s", "km", "m", "mm", "hPa", "mbar" |
| `api/home-config.ts` | `untilText` | 13 | "In {n} min", "In 1 hour", "In {n} hours", "In 2 days and 12 hours" |
| `api/home-config.ts` | `agendaWhen` | 3 | "Today", "Tomorrow", "All day" |
| `api/notifications.ts` | `WEEKDAY_LETTER` (the quiet-hours day toggles) | 7 | "S", "M", "T", "W", "T", "F", "S" |
| `api/rules.ts` | `DAY_LABEL` | 7 | "Sun" ... "Sat" |
| | | **73** | |

Every helper keeps its name, its signature and its branches; only the text of each branch goes through the table. Two private
maps became functions so that they are read at call time (`WD_SHORT()` in automations, `unitWords()` - the former `UNIT_HE` - in
home-config). The exported day maps (`WEEKDAY_LETTER`, `DAY_LABEL`) stay constants built when the module loads, like
`schedules.ts` `DAY_SHORT`: the interface language changes only by a reload. `frigate.ts`, `health.ts` and `rules.ts` gained
the `trTime` import.

## Why the catalogue and not Intl

The task preferred `Intl` (RelativeTimeFormat, NumberFormat unit style) wherever it gives the exact Hebrew the screens show
today. Checked on Node 24.21 (ICU 78.3, CLDR 48): it does not, for any of the helpers.

| helper text today | `Intl` in `he` |
|---|---|
| "שעה", "דקה", "יום" (a bare singular) | "1 שעה", "1 דקה", "1 יום" (long unit style) |
| "שנייה" | "1 שניה" (another spelling) |
| "1 שע׳", "1 דק׳" | "1 שעה", "1 דקה" in the short style (the abbreviation only from 2 up) |
| "5 ימים 3 שע׳" | "5 ימ׳" (short), "5 י׳" (narrow) |
| "999 מ״ש" | "999 ms" (short), "999 אלפיות שנייה" (long) |
| "עוד 45 דקות", "עוד יומיים" | "בעוד 45 דקות", "בעוד יומיים" (RelativeTimeFormat) |
| "1012 הקטופסקל", "1012 מ״ב" | no such short form |

Only "שעתיים", "שתי דקות", "{n} שעות / דקות / שניות" and four weather units ("קמ״ש", "מ׳/שנ׳", "ק״מ", "מ״מ") are the same. A helper
that took half of its forms from `Intl` and half from the table would also depend on the ICU data of each browser (the wall
panels run older engines), which no workstation test can pin. So every form is a catalogue entry, with the plural forms the
sources already had as separate keys: singular ("שעה" -> "1 hour"), dual ("שעתיים" -> "2 hours"), plural ("{n} שעות" ->
"{n} hours"). Where the Hebrew source has one fixed plural word for any number ("עוד {n} דקות", "{d} ימים {h} שע׳") the English
is an abbreviation ("In {n} min", "{d} d {h} h"), so no English text can read "1 minutes".

## The allow-list

`frontend/tests/unit-i18n-api-2442.spec.ts`, format texts: **107 -> 34** literals.

| file | before | after |
|---|---|---|
| `automations.ts` | 26 (+ the named maqaf) | 0 (the named maqaf of the verb table stays) |
| `frigate.ts` | 4 | no entry |
| `health.ts` | 5 | no entry |
| `home-config.ts` | 58 | 34 |
| `notifications.ts` | 7 | no entry |
| `rules.ts` | 7 | no entry |

The 34 that stay are the Hebrew calendar date of `home-config.ts`: the letters of `gematria` 29, its geresh / gershayim 2, the
two particles of `hebrewDate` 2 ("ב", "ה") and the word of `parshaText` 1 ("פרשת"). They are Hebrew in both languages until the
owner decides otherwise (question 1). The counts are exact, so a new literal or a vanished one still fails the lint. The
`trTime` case of the spec now names eight readers (`automations`, `frigate`, `health`, `home-config`, `notifications`,
`remote`, `rules`, `schedules`) and asserts that the only format entry left is `home-config.ts` 34. The demo stores, the typed
confirmation words and the other named texts of the list are untouched.

## Hebrew is unchanged

`frontend/tests/unit-i18n-locale.spec.ts` has a new case with fixed values per helper: 13 `durationText` inputs, the "המתן"
sentence, a time condition with days, 9 `formatDuration`, 4 `spanText`, 4 `fmtUptime`, 10 `untilText`, 4 `agendaWhen`,
9 `valueText`, the two exported day maps (values and key order), `gematria`. **The case was written first and run against the
unchanged sources (4f1c8988f): passed; then the sources were changed and it passed again with the same expected texts.** The
English case reads the same inputs (the day maps through the table) and also pins that `gematria`, `hebrewDate` and
`parshaText` return Hebrew in English.

The throw-away token comparison of CR-I18N-COMBINED-B-2442 was not committed and was not rebuilt here; the fixed values above
replace it for these helpers (the diff of `src/api` is 33 added / 29 removed lines, each a text wrapped in place).

## English that is still not right (not in this branch)

- `screens/investigate-rules.ts` joins the rule's days with nothing between them (`DAY_LABEL[d]` ... `.join('')`): "א׳ב׳ג׳" in
  Hebrew, "SunMonTue" in English. Putting a separator there changes the Hebrew screen, so it is left for a decision (question 3).
- `fmtUptime` and `untilText` keep the Hebrew wording for the number 1 ("1 ימים 3 שע׳", "עוד 1 דקות") - as before; English is
  not affected (abbreviations).

## Other files

- `docs/i18n/GLOSSARY_EN.md`: the "stay Hebrew" paragraph no longer lists the duration / unit helpers; a paragraph with the
  English forms above.
- `docs/i18n/MISSING_KEYS_EN.md` / `.json` regenerated (`node scripts/i18n_missing_keys.mjs --write`): 144 catalogues, 28,212
  keys (was 28,173), 20 missing (unchanged), `msg/time` 80 / 0; hard-coded Hebrew outside the catalogues 4,661 literals in 191
  files (was 4,668; the report has its own counting rules, the lint's 107 -> 34 is the figure of this change).

## Tests actually run (workstation)

- `npx tsc --noEmit` (frontend): clean, after the last edit.
- Playwright unit config, `--workers=1`: `unit-i18n-locale` (10) + `unit-i18n-api-2442` (25): 35 passed.
- Playwright unit config, `--workers=1`: `unit-i18n-core`, `unit-i18n-cal-elec-lint`, `unit-i18n-cal-elec-completeness`,
  `unit-i18n-home`, `unit-i18n-map-wizard-2441`, `unit-automations`, `unit-home-config`, `unit-frigate`, `unit-bv1-tiles`:
  136 passed.
- `npx vite build`, then `playwright.config.ts --project=desktop --workers=1` on a private preview port (4353):
  `evidence-automations-list`, `evidence-automations-builder`, `evidence-notifications`, `evidence-schedules-list`,
  `evidence-schedules-editor`: 205 tests - **204 passed, 1 skipped (declared by the spec), 0 failed** (26 min). The 245 evidence PNGs
  these specs rewrite were restored, none is committed; `dist/` deleted.
- `node scripts/i18n_missing_keys.mjs --write`: figures above.

## NOT_RUN

- The runner entry check (not queued, by instruction) and everything that belongs to it: pixel suites, layout suites, the other
  evidence specs, the tablet and mobile projects, the page unit specs (`SW_UNIT_PAGES=1`), the whole unit suite, the backend
  (no backend file changed).
- No English screen was opened in a browser; the English texts are checked by the unit cases only.
- The token comparison script (see above).
- No lab or device access.

## Pixels expected

None in Hebrew (the same strings). No PNG is committed. There is no English baseline.

## Owner questions

1. The Hebrew calendar date on the home screen ("ז׳ בכסלו התשפ״ז", "פרשת נח") in the English interface:
   a. stays in Hebrew letters (as now, recommended); b. transliterated ("7 Kislev 5787", "Parashat Noach"); c. hidden in English.
2. The quiet-hours day toggles in English show one letter ("S M T W T F S", two S and two T, like the Hebrew single letters):
   a. keep one letter (recommended, the buttons are narrow); b. two letters ("Su Mo Tu We Th Fr Sa").
3. The days of an investigation rule are written with nothing between them ("א׳ב׳ג׳", in English "SunMonTue"):
   a. add a comma and a space in both languages (changes the Hebrew row, recommended); b. only in English; c. leave.
