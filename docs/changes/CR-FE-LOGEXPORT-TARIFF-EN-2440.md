# CR-FE-LOGEXPORT-TARIFF-EN-2440 - redacted log export UI and English tariff names (2.44.0 frontend follow-ups)

Branch `pilot/CR-FE-LOGEXPORT-TARIFF-EN-2440`, based on `origin/pilot/CR-BE-SMALL-2440` (208bd6634, the backend of both rows -
docs/changes/CR-BE-SMALL-2440.md), merged with `origin/pilot/CR-W3B-FE-COMBINED-2443` (41bf2a6d6) and `origin/release/2438-train`
(5afd3af25); both merges were clean. Takes the recommended answers of CR-BE-SMALL-2440's questions 1 a, 2 a and 3 a.

## 1. Redacted log export (T033 acceptance 2, R066 / AT066)

Settings > Health and jobs (`#/system/diagnostics?tab=health`) gets a card "ייצוא יומן מצונזר" (`<health-log-export>`,
`src/components/health-log-export.ts`, loaded with the tab's own chunk `system-diagnostics-health.ts`):

- Shown only to a user who may edit the system settings (`can_edit` of `/settings`; the server checks `system.configure` again).
  It is drawn under the health cards, and also under a health report that failed to load (when the file is needed most).
- Two `sw-field` selects: the window - 15 minutes, 1 hour (default), 3, 6, 12, 24 hours (the server allows 1-1440 minutes) - and the
  level - information and above (default), warnings and errors, errors only. One line says what is hidden and that video, pictures
  and plans are never included.
- "ייצוא היומן" first opens the system's confirmation dialog (`confirmDialog`, no native box): the sentence names the chosen window
  and level, what is hidden, that nothing visual is included and that the export is recorded in the audit log; buttons "אישור
  והורדה" / "ביטול". This is the consent: only "confirm" posts `{consent: true, minutes, min_level, include_health: true}` to
  `POST /api/v1/health/logs/export` (`exportLogs` in `src/api/health.ts`, through `apiBlob`) and saves the JSON under the server's
  `Content-Disposition` name (`saveBlob`).
- States: "cancel" posts nothing and shows a toast "the export was cancelled; no file was created"; success shows a toast with the
  file name (`ToastController`, lifted above dialogs, centred with auto margins so RTL and LTR are the same rule); a 403 says only a
  user allowed to manage the system settings may export, `422 consent_required` asks to try again and confirm, any other failure
  says "the export failed: <server text>"; the error stays on the card with "נסו שוב" until the next try.
- Text: `src/i18n/log-export.ts` (Hebrew + English, registered for the missing-keys report; no platform name - the file is about this
  system only). Arabic / Russian: none - per the i18n rules only catalogues that already carried those columns keep them.

## 2. Tariff names in English (CR-BE-SMALL-2440 section 3)

- `elec-tou.ts`: `TouNamed.name_en?`; the frontend copy of the Israeli template carries the server's English names (Summer / Winter
  / Transition, Weekdays / Fridays and holiday eves / Shabbat and holidays, Off-peak / Peak). `nameEnValid` is the server's rule
  (optional, up to 40 characters after trimming, no Hebrew letter). `touName(kind, entry, namesEn?)`: Hebrew interface -> always
  `name_he`; English -> the entry's `name_en`, else the server's `names_en`, else the template's English for an entry that still has
  the template's id AND Hebrew name (the server's `known_name_en`), else `name_he`. `heOrEn` for the template's `source_en`.
- The TOU editor's structure part: under every season name and every band name an input "שם באנגלית (רשות)" (LTR, `maxlength`
  40); a new list "סוגי ימים" gives each day type (whose Hebrew name the editor does not change) the same input. Empty = the key is
  removed from the definition, so a definition without English names normalises and hashes as before. A Hebrew letter or more than
  40 characters is marked at once (red field + one line under it); the server's 422 path `<list>[i].name_en` marks the row as every
  other error path does.
- The English interface shows the English name wherever a name is shown: the editor (price table headers and rows, the day bars and
  their legend, the band and day-type selects, the "rest of the hours" hint), the tariff list summary (`elec-settings.ts`), the
  bill wizard's price card (`elec-wizard.ts`, from the version's `names_en`), and the TOU bill card and daily table
  (`elec-bill-page.ts`, from the snapshot's `names_en`). The Hebrew bill paper (`elec-bill-paper.ts`) and the PDF are unchanged.
- Types: `TariffVersion.names_en`, `SnapshotTou.names_en`, `SnapshotLine.season/band.name_en`, `by_band[].band.name_en`,
  `TouCheck.names_en`, `TouTemplate.name_en / source_en`. The demo backend (`electricity-billing-mock.ts`) answers the template's
  English and a snapshot's `names_en`.
- `msg/electricity.ts`: four new texts; `docs/i18n/GLOSSARY_EN.md`: day type / English name, redacted log / request id / audit log.

## 3. Fix found while testing: a tap on `<summary>` / `<label>` in a phone bottom sheet

`sw-sheet` starts its swipe-to-close on a pointerdown anywhere on the sheet that is not a control and captures the pointer, which
swallowed the click. On a phone the folded "מבנה התעריף" part of the TOU editor could not be opened at all (the first mobile run of
the tariff spec timed out on it; a probe on the runner showed the summary was hit and `open` stayed false). `summary` and `label` now
count as controls (`src/components/sw-sheet.ts`, one selector); a swipe from the grabber or any other part of the sheet is unchanged
(`evidence-bubble-foundation` "bottom sheet" test: skipped on this head - the bubble skin is frozen, so not proven by it).

## Tests

- `tests/unit-logexport-tariff-en-2440.spec.ts` (Node): the log export catalogue (complete, English, placeholders, registered, no
  platform name), every window / level has its label and phrase, windows inside 1-1440 with 60 offered; `nameEnValid` against the
  server's rule; `touName` order in both languages; the template's English equals the server's.
- `tests/evidence-log-export-2440.spec.ts` (mocked backend, Domus, desktop + mobile): defaults, consent dialog text, cancel posts
  nothing, confirm posts the body and downloads the server's file name, 403 / consent_required / 500 with retry, English card and
  dialog with no Hebrew letter and no platform name, no card without the settings right, no sideways scroll. Screenshots:
  `docs/design/evidence/CR-FE-LOGEXPORT-TARIFF-EN-2440/`.
- `tests/evidence-tariff-names-en-2440.spec.ts` (electricity harness on the Vite dev server, Domus, desktop + mobile): 8 English
  inputs prefilled from the template, a Hebrew letter marked, a saved tariff keeps the typed / emptied names; English interface:
  editor, tariff list, TOU bill card and daily table in English, a renamed band without English shows its Hebrew name, the Hebrew
  bill paper unchanged.
- `tests/electricity-harness/harness.ts` imports `i18n/ui-lang-boot` first (as `main.ts` does), so a spec can open it in English.

Pixel baselines: none changed. The health tab and the TOU editor are not covered by a pixel baseline with these elements
(the log export card is new; the editor's structure part is folded in the existing shots).

## Tests actually run

Workstation (Node 24, `--workers=1`):
- `npx tsc --noEmit -p tsconfig.json` and `-p tsconfig.tests.json`: clean (first head and final head).
- Unit: `unit-logexport-tariff-en-2440` (4), `unit-i18n-cal-elec-lint`, `unit-i18n-cal-elec-completeness`, `unit-i18n-api-2442`,
  `unit-i18n-core` - 53 tests: 52 passed, 1 failed on the first try (`unit-i18n-core` "every catalogue module registers its tables":
  the new catalogue used `createCatalogue`, which the textual scan does not see; changed to `registerCatalogue` as its siblings);
  then `unit-i18n-core` + the new spec: 13 passed.
- `node scripts/lazy-tags-check.mjs`: OK; `node scripts/api-client-check.mjs`: the new call has its inventory route.
- `node scripts/i18n_missing_keys.mjs --write` ran (149 catalogues, en gap 5); the regenerated report was NOT committed - it also
  carried the drift of the merged branches and would only conflict with them.

Runner (`~/work/felogexp2440`, a detached worktree of the runner checkout, own Vite dev server on one port, `nice -n 10`,
`--workers=1`, projects desktop + mobile; load average 31-47 from the other jobs):
- Run 1 (950c04ff3): 10 tests - 5 passed, 5 failed: the page-error check caught the spec's own init script writing localStorage on
  `about:blank` (test harness, fixed in 10cebbb67), and the two mobile tariff tests timed out on the folded structure part (the
  sw-sheet bug above, fixed in 742752c12).
- Run 2 (742752c12): the two new specs + `electricity-tou.spec.ts` (regression of the editor): 18 tests - 16 passed, 2 failed (the
  spec clicked the already-open structure part of a reopened tariff and folded it; fixed in 8813c0ca2). `evidence-bubble-foundation
  -g "bottom sheet"` (mobile): 1 skipped (frozen skin).
- Run 3 (8813c0ca2): `evidence-tariff-names-en-2440` desktop + mobile: 4 passed. (The log export spec and `electricity-tou.spec.ts`
  passed in run 2 on 742752c12; 8813c0ca2 changed only the tariff spec.)
- The runner folder, its results and scripts were deleted afterwards; the dev server was stopped by its own process group.

Evidence screenshots (written by the specs; 7 of the 14 committed to keep the repository small):
`docs/design/evidence/CR-FE-LOGEXPORT-TARIFF-EN-2440/`.

## NOT_RUN

- No entry check, no release gate, no full frontend suite (instructed: push only).
- Pixel baselines: none refreshed (no covered screen changed - the health tab of `layout-visdiff-246` runs in demo mode, where the
  card is not drawn; the TOU editor has no baseline).
- `layout-electricity.spec.ts` (opens the structure part on several widths) and the layout guards were not run.
- No lab test: a real export from an installation (AT066) is NOT_RUN; `management/tasks.json` / `test_catalog.json` not edited.
- No real phone: the sw-sheet fix is proven in Chromium's mobile emulation only.

## Questions (owner rule: unanswered = recommendation)

1. Should an error message offer "send this request's log" (the export filtered to the error's request id, `correlation_id`)?
   a. Not now; the Settings card is enough for 2.44.0. (recommended)
   b. Yes, a link in error toasts for administrators (a small follow-up row).
2. The English names of special days (holidays on the bill: "יום כיפור") stay Hebrew in the English interface (server data).
   a. Keep for now. (recommended)
   b. Add English names to the holiday calendar generator (a backend row).

