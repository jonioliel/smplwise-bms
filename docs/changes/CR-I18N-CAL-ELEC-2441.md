# CR-I18N-CAL-ELEC-2441 - calendars and electricity: the completion pass, a completeness spec and a lint spec

Branch `pilot/CR-I18N-CAL-ELEC-2441`, based on `origin/pilot/CR-I18N-CORE-2441` (e6d320acd) with `origin/main` (v2.43.7,
cc69447f1) merged in first. One branch for two MASTER_PLAN rows: `pilot/CR-I18N-CALENDARS-2436` and
`pilot/CR-I18N-ELECTRICITY-2436` (code review 08:F11). Rules followed: `docs/changes/CR-I18N-CORE-2441.md`, "For the area rows".

## What was already there

`src/i18n/msg/calendars.ts` (743 texts) and `src/i18n/msg/electricity.ts` (428 texts) existed on the base and the two areas
already read them through `tr()`. Measured before any change (compiler-based scan, comments not counted):

- calendars: every `tr()` text had its English, no unused table entry. 12 Hebrew literals outside `tr()` in five files, plus
  the demo file.
- electricity: the same for the files the base had moved. Three files were untouched because `FE-LEAK-TEXTKEY-2435` held them
  then: `elec-settings.ts`, `elec-settings-calendar.ts`, `elec-wizard.ts` (about 290 literal parts). That branch is in `main`
  now, so they were free.

## What changed

1. **`electricity/elec-settings.ts`, `elec-settings-calendar.ts`, `elec-wizard.ts`** - every screen text goes through `tr()`.
   157 new entries in `src/i18n/msg/electricity.ts` (585 now). Most are a text wrapped where it stood; 15 lines were rewritten
   by hand so that a sentence with a value is one text with a `{name}` (for example `tr('שלב {n} מתוך 6', { n })` instead of
   three fragments), always producing the same Hebrew string as before.
2. **`tests/unit-i18n-cal-elec-completeness.spec.ts`** (new, 9 cases): per area - every `tr()` text has its English; the
   first argument of `tr()` is a plain literal; `tr` comes from the area's own table; the table holds no text the area does not
   use; the English has no Hebrew letter, is not empty and names the same placeholders; in Hebrew `tr(text)` is the text itself
   and in English it is the table's; the table is in the registry; no key is written twice in a table's source.
3. **`tests/unit-i18n-cal-elec-lint.spec.ts`** (new, 4 cases): a Hebrew string or template text in `src/calendars/*` or
   `src/electricity/*` that is not the first argument of `tr()` fails, with file and line. It passes today and fails on a new
   literal (see the mutation run below). What stays Hebrew is listed in the spec with its reason; a listed text that is gone
   fails too, and a listed text written one more time fails.
4. **`tests/helpers/i18n-source-scan.ts`** (new): the reader both specs use (TypeScript compiler, so comments and code never
   count as text). The HOME, MAP and PLANWIZARD rows can import it for their own specs.

No change in `src/calendars/*`: nothing there was left to move (see the list below). `meter-card.ts` and
`screens/water/page-customers.ts` were not touched.

## What stays Hebrew, and why (the lint's lists)

Whole files: `calendars/demo.ts` (211, demo data and the demo server's answers), `electricity/fixtures.ts` (85, demo data),
`electricity/elec-bill-paper.ts` (30, the A4 bill - the base's decision: it stays word for word with the Hebrew PDF).

Single literals (35):
- values saved to the server, which the base left Hebrew on purpose: default event titles (`event-drawer`, `resident`,
  `view-calendar`: 7), the rejection note (`view-approvals`: 1), the "everyone" member label (`view-manage`: 1), the name of a
  new season / band and of the Israeli template's seasons, day types and bands (`elec-tou-editor`: 2, `elec-tou`: 8);
- demo-mode roles in `view-manage` (3);
- content of the Hebrew bill paper: the sample bill of the settings preview (`elec-settings`: 9), the watermark
  (`elec-bill-page`: 2, the paper compares it), the day unit (`elec-format`: 2).

For the owner / lead to decide later, not changed here: whether a default title typed by nobody ("הזמנת חדר") should be saved in
the language of the person who created the event.

## Hebrew output: identical

- By construction: the Hebrew text is the key, `tr` returns it and fills `{name}` with the same expression as before.
- Checked mechanically for the three converted files: a throw-away script undid the wrapping textually
  (`${tr('X')}` -> `X`, `=${tr('X')}` -> `="X"`, `tr('X')` -> `'X'`) and compared each line with the file before the change.
  142 changed lines came back byte for byte; the 15 hand-written lines were read one by one against the old expression.
- No text was moved between elements, so no pixel can move in Hebrew. In English the three screens now show English.

## The merge of `origin/main` (not this row's files - for the lead)

18 conflicts, all between `I18N-EN-SWITCH-2438` / `CR-I18N-CORE` and `CR-NAV-LABELS-2436` / `CR-SHELL-LAZY-2436`. The same
conflicts wait for `I18N-EN-SWITCH-2438`, `CR-I18N-CORE-2441` and every other area row; this branch's merge commit
(341994611) can be reused or redone.

- 10 catalogues under `src/i18n/` and 5 under `src/tickets/`: an import line from each side; both kept.
- `main.ts`: the lazy remote boot from `main`, plus `syncUiLang()` of the language switch.
- `shell/nav.ts`: the `nav-labels` imports from `main`, plus `tr` of `i18n/msg/shell` for the shell's own words.
- `tickets/text.ts`: `ticketsLang` is re-exported from `nav-labels` (as on `main`).
- `i18n/nav-labels.ts` (new on `main`) carried its own detector and filler, which `unit-i18n-core` forbids under `src/i18n/`.
  It now imports `docLangRaw` and `fill` from `core.ts` (which imports nothing, so no cycle). Behaviour is the same, and the
  stub-document fix (`documentElement?.lang`) now covers `ticketsLang()` too.
- Two guard specs had to learn about each other:
  - `unit-nav-labels-2436`: `nav-labels.ts` imports `tickets/naming.ts` and `i18n/core.ts`; `core.ts` and `msg/shell.ts`
    (the shell's own words) are not feature dictionaries.
  - `unit-i18n-core`: `nav-labels.ts` and `nav-label-bridges.ts` are not catalogues of their own - each label is a key of its
    dictionary, which registers it.

## Tests actually run (workstation, `--workers=1`)

- `npx tsc --noEmit` (frontend): clean - after the merge alone, and again on the final tree.
- Playwright unit config, 15 spec files, one run: **144 passed, 1 skipped, 0 failed**.
  - the two new specs: completeness 9, lint 4;
  - calendars: `unit-calendars-attendees-2343` 10, `-connect-2330` 6, `-feed-remote-2351` 5, `-grid-edit-2343` 18,
    `-switch-reach` 6, `-ui-2310` 13;
  - electricity: `unit-electricity-billing` 25, `unit-electricity-readings` 6;
  - the guards the merge touched: `unit-i18n-core` 9, `unit-nav-labels-2436` 6, `unit-ui-lang` 8;
  - neighbours of the converted files: `unit-textkey-2435` 12, `unit-mocks-lazy` 7 (+ 1 skip the spec declares itself).
- Mutation run of the new specs (then restored): a Hebrew constant added to `calendars/booking-logic.ts` and one `tr()` removed
  from a template in `electricity/elec-wizard.ts` - 3 failed, 10 passed: both lint cases named the file and line, and the
  completeness case named the table entry that was no longer used.
- `node scripts/i18n_missing_keys.mjs` (no `--write`): the two tables at 0 missing; its own count of hard-coded Hebrew in the
  two folders (223 and 138) equals the lint's lists.

## NOT_RUN

- Page, evidence, layout and pixel suites of both areas (`electricity-*.spec.ts`, `layout-electricity*.spec.ts`,
  `evidence-calendars-*.spec.ts`, `audit30-f-calendars.spec.ts` ...): they need a build and a browser; the entry check is the
  lead's. No runner job was started.
- The English screens were not opened in a browser; the English of the 157 new texts was written against
  `docs/i18n/GLOSSARY_EN.md` and the existing table, not reviewed on screen.
- `docs/i18n/MISSING_KEYS_EN.md` / `.json` were not regenerated (every area row would rewrite the same file); the script was
  run without `--write`: `msg/calendars` 743 keys, 0 missing; `msg/electricity` 585 keys, 0 missing.
- The backend: untouched.

## Pixels to refresh

None. Hebrew output is identical.

## Left for other rows

- `api/electricity-billing.ts` still holds Hebrew that these screens show (`AUTO_LABEL`, error texts); `api/*` is the base's
  "next pass", not this row.
- Server texts shown as they arrive (`kind_he`, `note_he`, `message_he`, `name_he`) stay Hebrew in the English interface.
