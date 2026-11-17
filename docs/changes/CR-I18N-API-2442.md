# CR-I18N-API-2442 - the texts built in the frontend api layer go through tr()

Branch `pilot/CR-I18N-API-2442`, based on `origin/pilot/CR-I18N-COMBINED-2441` (910a7dbc0; `main` 2.43.7 is contained).
Follow-up of the "next pass" that `CR-I18N-CAL-ELEC-2441` and `I18N-EN-SWITCH-2438` left: `frontend/src/api/*.ts`. Rules
followed: `docs/changes/CR-I18N-CORE-2441.md` ("For the area rows"), `docs/i18n/GLOSSARY_EN.md`.

## Measured before

Compiler-based scan (comments not counted) of `src/api/*.ts`: 3,811 Hebrew string / template texts in 94 files, none through
`tr()`. 1,428 of them in the 14 demo files (`*-mock.ts`, `*-demo.ts`, `messaging-fake.ts`), 2,383 in 80 other files.

## What changed

1. **63 files under `src/api/`**: 1,864 `tr()` calls replace Hebrew literals (1,620 different texts). Labels (`*_LABEL`
   tables), error sentences (`ERROR_TEXT`, `describeError`, `elecErrorText`, the automation / notification / media error
   tables), state words, and the summary sentences the screens show as they are (automation and schedule sentences, the
   notification time line, the bulk result, the connection-test verdicts). A template with values became one text with
   `{name}` placeholders (`tr('{confirmed} מתוך {total} אושרו', { confirmed: c.confirmed, total: c.total })`).
2. **Nine tables `src/i18n/msg/api-*.ts`** (new), one per domain so that a lazy screen loads only its own:
   `api-automation` 439, `api-devices` 279, `api-home` 224, `api-notify` 203, `api-video` 151, `api-media` 124,
   `api-system` 114, `api-electricity` 73, `api-core` 13 (`client.ts`, `session.ts`, `prefs.ts`, `capabilities.ts`,
   `remote.ts`, `health.ts`). Each api file imports `tr` from exactly one table. 594 of the English texts were taken from the
   existing tables (the same Hebrew already had an English), the others were written against the glossary.
3. **`tests/unit-i18n-api-2442.spec.ts`** (new, 24 cases): the lint of `src/api/` (a Hebrew literal outside `tr()` fails, with
   file and line; what stays Hebrew is listed with its reason, by text or - for a block of demo data or a format helper - by
   count; a listed text that is gone fails) and the completeness of the nine tables (every `tr()` text has its English, a
   plain literal first argument, the table holds nothing unused, English without Hebrew letters and with the same
   placeholders, Hebrew returns the source text, registered for the report, no key twice), plus three helpers called in both
   languages.
4. `docs/i18n/GLOSSARY_EN.md`: the section "API layer texts".
5. `api/automations.ts`: a local variable named `tr` in `automationSentence` was renamed `trg` (it hid the translator). Seven
   placeholders got `String(...)` around a value typed `string | undefined` / `number | undefined` (`{to}`, `{below}`): the
   template wrote the same text.

`api/closed-errors.ts` was not changed: it already carries its own he / en pair per code.

## What stays Hebrew, and why (the lint's lists)

- **Demo stores** - 14 whole files, and the demo block inside 18 other files (`setup.ts` 82, `readiness.ts` 48,
  `incidents.ts` 39, `media-admin.ts` 39, `electricity-readings.ts` 25, `nvr-settings.ts` 25, `tickets-rules.ts` 20,
  `tickets-locations.ts` 15, `ha-users.ts` 14, `tickets-messages.ts` 14, `messaging-accounts.ts` 11, `notify-whatsapp.ts` 9,
  `electricity-meters.ts` 6, `tickets-board.ts` 6, `calendar-attendees.ts` 5, `door-automations.ts` 4, `mapping.ts` 3,
  `messaging-policy.ts` 2): fake names, places and the demo server's answers, as in the other rows.
- **Date / duration / unit helpers, left for `pilot/CR-I18N-DATES-2442`** (161 literals, not touched so the two branches do not
  meet in one line): `automations.ts` `durationText`, `WD_SHORT`, `lastRunText`, `formatDuration`; `notifications.ts`
  `WEEKDAY_LETTER`, `WEEKDAY_NAME`, `relativeTime`, `dayLabel`; `schedules.ts` `DAY_SHORT`, `DAY_LONG`, `whenLabel`;
  `rules.ts` `DAY_LABEL`; `frigate.ts` `spanText`; `health.ts` `fmtUptime`; `remote.ts` `whenLabel`; `home-config.ts` the
  Hebrew calendar date (`gematria`, `hebrewDate`, `parshaText`), `UNIT_HE`, `untilText`, `agendaWhen` and `sinceText`. Until that branch lands, an English summary can hold a Hebrew duration ("Wait 5 דקות").
- **Data, not interface** (owner questions below): the confirmation words an operator types and the server compares
  (`nvr-connection.ts` "שמור" / "הסר", `schedules.ts` "אפשר נטרול", `capture-lease.ts` "הרחב בירור", `installer.ts`
  "פתיחת דלת לבדיקה"); `mapping-engine.ts` the building marker "בניין" of the naming rule and the name given to a new building
  ("בניין {token}", "משותף").
- `tts-default.ts` "עברית": the name of the language in its own script. `automations.ts` the maqaf the verb table is tested
  for.

No default event title lives in `src/api/` (those are in `src/calendars/` and `src/home/`, kept Hebrew by the earlier rows).

## Hebrew output: identical

- By construction: the Hebrew text is the key; in Hebrew `tr` returns it and fills `{name}` in one pass, as the template did.
- Checked mechanically for every converted call: a throw-away script (not committed) undid each `tr()` textually
  (`tr('X')` -> the literal, `tr('a {n} b', { n: expr })` -> the template with `expr`), removed the added import and compared the
  token stream of each file with the file at the base, string tokens by value. On the final tree: 63 files, 1,864 calls,
  0 differences (the seven `String(...)` wrappers are named in the script and were read one by one).
- The committed specs that pin Hebrew texts of these modules were run on the final tree (see below).
- English is a first pass: the summary sentences are joined from parts (see the glossary section), so some English lines read
  stiffly ("When Kitchen sensor detects motion for 5 דקות"); nothing was reviewed on screen.

## For the lead

- **Entry chunk.** The api modules are part of the entry chunk today, so the nine tables (103 KB of source) land in it too
  (seen in a local build: every table's text is in `assets/index-*.js`). The entry budget is report-only
  (`unit-entry-chunk`). The split by domain costs nothing now and pays when an api module moves to a lazy chunk.
- **Module-level label tables** (`export const X_LABEL = { a: tr('...') }`) take the language of the moment the module loads -
  correct in the app (the switch reloads the page, `ui-lang-boot` runs first), as the CORE note says. A Node spec that wants
  English from such a table must set the language before importing the module.
- **The node unit run of the whole folder** has five failures that are not from this branch:
  `unit-session-me-failure-2435.spec.ts` opens `./#/devices`, which the unit config's page-spec detector (`goto('/...`) does
  not recognise, so the node-only run tries to navigate without a base address. The same six tests pass against a preview
  build (below).
- **Server texts** (`user_message`, `*_he` fields) are shown as they arrive and stay Hebrew in the English interface, as the
  CAL-ELEC note already says; `describeError` prefers them over the client's own sentence.
- `docs/i18n/MISSING_KEYS_EN.md` / `.json` were not regenerated (every i18n branch would rewrite the same file). Without
  `--write`: 143 catalogues, 28,136 keys, 20 missing (unchanged); the nine api tables 0 missing; hard-coded Hebrew outside
  the catalogues 6,619 -> 4,700 literals.

## Owner questions

1. The words an operator types to confirm a dangerous step ("שמור", "הסר", "אפשר נטרול", "הרחב בירור", "פתיחת דלת לבדיקה")
   are compared by the server, so an English operator must type Hebrew.
   a. Keep the Hebrew words in every language.
   b. The server accepts an English word too, and each interface shows its own word. (recommended; needs a backend row)
   c. Replace the typed word by a plain confirm button in English only.
2. The name the mapping assistant gives a new building ("בניין A") and the marker word of the naming rule ("בניין") are saved
   on the server.
   a. Keep them Hebrew - a saved name is data, and the operator can rename. (recommended; the same rule as the default event
      titles already asked)
   b. Write them in the language of the person who runs the assistant.
3. The demo mode (fake names, places and the demo server's messages) stays Hebrew in the English interface.
   a. Leave it Hebrew. (recommended; shown only in demos)
   b. Translate the demo data too (about 1,800 texts, a row of its own).

## Tests actually run (workstation, `--workers=1`)

- `npx tsc --noEmit` (frontend): clean on the final tree.
- Playwright unit config, node specs, the whole `tests/unit-*` set: 4,465 tests - **4,450 passed, 10 skipped (declared by
  the specs), 5 failed** (the five of `unit-session-me-failure-2435` described above; not from this branch). The set
  includes the new spec (24) and every spec that pins Hebrew texts of the converted modules (`unit-automations*`,
  `unit-schedules*`, `unit-notifications`, `unit-notify-center`, `unit-electricity-billing`, `unit-media-*`,
  `unit-home-*` ...; 136 unit specs import a converted api file).
- Mutation run of the new spec (then restored): a Hebrew constant added to `api/health.ts` and one `tr()` removed in
  `api/alarm.ts` - 2 cases failed: the lint named both lines, the `api-devices` completeness case named the table entry
  that was no longer used.
- `npx vite build`, then the main config on a private preview port, `--project=desktop`:
  `unit-session-me-failure-2435`, `evidence-automations-list`, `evidence-notifications`, `evidence-schedules-list`:
  **124 passed, 1 skipped (declared by the spec), 0 failed**. The regenerated evidence images were discarded, `dist/` deleted.
- The throw-away Hebrew comparison described above (final tree): 63 files, 1,864 calls, 0 differences.
- `node scripts/i18n_missing_keys.mjs` (no `--write`): numbers above.

## NOT_RUN

- Tablet and mobile projects; every pixel suite; the other evidence / layout suites; the page unit specs
  (`SW_UNIT_PAGES=1`); the backend (untouched). No runner job and no entry check were started (the task said so).
- `electricity-bills.spec.ts` and the other specs that open a `/tests/*-harness/` page: they need the Vite dev server, not a
  preview build; a first attempt against the preview only timed out on the harness page and was stopped.
- The English screens were not opened in a browser; no English text was reviewed on screen.
- No lab or device access.

## Pixels to refresh

None expected. Hebrew output is identical and no text moved between elements. In English the converted texts change (no
English baselines exist).
