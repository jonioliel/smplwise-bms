# I18N-EN-SWITCH-2438 - English interface and the Hebrew / English switch

Branch `pilot/I18N-EN-SWITCH-2438`, based on `origin/pilot/AUDIT30-COMBINED-2435` (7a7e3dbb8): `i18n/he.ts`, `water/i18n.ts`,
the calendars, electricity, live / investigate / system screens and many components are held by that branch (MASTER_PLAN
Appendix A), so this branch starts from it.

Owner round 32: Q-SYS-7 b (language switch soon, Hebrew + English first, the lead translates the English), Q-SYS-8 a (fix the
screens module by module + a missing-strings report), Q-DES-9 b (translate every operator term except "NVR"), Q-DES-10 c ("Home
Assistant" may stay in settings screens). Code review inputs: 07:F10 (CR-I18N-CORE), 07:F11, 08:F11.

## What

1. **CR-I18N-CORE (07:F10).** `frontend/src/i18n/core.ts`: `docLang(supported)`, `fill(text, vars)`, `registerCatalogue` /
   `registeredCatalogues`, `createCatalogue`. The 85 catalogues under `src/i18n/` use them instead of their own copies and
   register their tables. Same lookup order and placeholder rule; `*_DEV_MARKED` constants kept and passed to the registry.
2. **Missing-keys report.** `scripts/i18n_missing_keys.mjs` (Node, esbuild from `frontend/node_modules`) - per catalogue: Hebrew
   keys missing / identical / still Hebrew in English, plus the hard-coded Hebrew literals outside any catalogue per module.
   Output: `docs/i18n/MISSING_KEYS_EN.md` and `.json` (`--write`; `--lang ar|ru` for the other columns, report only).
3. **Source-text tables** (`src/i18n/msg.ts`, `src/i18n/msg/<module>.ts`). Templates that wrote Hebrew directly now call
   `tr('<the Hebrew>')`: a Hebrew page gets the Hebrew unchanged, an English page the module table's English. 14 tables.
   Decision recorded for the lead: this is gettext-style (the Hebrew text is the key) rather than named keys, chosen so the
   conversion is mechanical, the Hebrew source stays readable for the spec suite and Hebrew pixels cannot move. The review's
   "lint on a Hebrew literal outside a catalogue" becomes "outside `tr()` or a catalogue" (the report's part 2).
4. **English.** All catalogue gaps closed (he.ts 1,127 keys, the access / WisKey / notices / maintenance / schedule / fleet /
   messaging catalogues; four Hebrew-only access catalogues and three WisKey catalogues made bilingual; the tickets catalogues
   registered). Module passes: shell, live, investigate, calendars, automation, components, devices, settings (two parts),
   video and media, WisKey screens, electricity, remaining screens, misc (sign-in, PWA, design, wall...). Glossary:
   `docs/i18n/GLOSSARY_EN.md` (British spelling, sentence case; "NVR" untranslated; operator screens say "the platform").
5. **The switch.** Backend: personal preference `ui.lang` (he | en; null = Hebrew; ar / ru refused) in
   `services/user_prefs.py` + the `/me/prefs` patch model. Frontend: `i18n/ui-lang-boot.ts` is the first import of `main.ts`
   and imports nothing - it sets `<html lang dir>` from this browser's copy of the choice before any module builds text;
   `i18n/ui-lang.ts` syncs with the server after start (one reload when the server's value differs from the language the page
   started in; never a loop - with blocked storage it applies in place; a later change of `<html lang>` by a test is not
   undone) and `setUiLang()` saves then reloads. My account › Language (`shell/sw-lang-prefs.ts`, each language named in
   itself; new `globe` icon). RTL for Hebrew, LTR for English. Arabic / Russian are not offered (their tables stay as they are -
   still bundled statically; making them load on demand is CR-I18N-LAZY-LANG, owner decisions O4 / O5).

## Numbers (report, English)

| measure | before (0f7c6525a, core refactor only) | after |
| --- | ---: | ---: |
| registered catalogues | 89 | 131 (14 source-text tables, 28 tickets / water / settings tables now registered) |
| catalogue keys showing Hebrew in English (gap) | 3,811 of 11,027 | 6 of 24,847 (deliberate: a typed Hebrew confirmation word, language self-names) |
| hard-coded Hebrew literals outside catalogues (app) | 25,028 in 582 files | 8,698 in 291 files |

"Before" counts the then-unregistered tickets catalogues (~2,950 literals) as hard-coded. The literal count also includes Hebrew
comments inside `css` templates (no visible text). What remains, by reason:
- files held by other open branches, not touched here: `home/*` (HOME-R32-ANSWERS-2438), `map/*`, `plan-wizard/*`,
  `explore-plan-editor`, `explore-floor-map`, `plan-studio-panel`, `plan-view-dials` (PLAN3D-R32-ANSWERS-2438),
  `electricity/elec-settings*`, `elec-wizard` (FE-LEAK-TEXTKEY-2435), `system-diagnostics`, `system-alarm`, `system-wall`,
  `system-setup`, `system-local-users` ... (OWNER-R32-BACKEND-2438 / CR-WAVE1B), see the report's per-module table;
- `api/*` (2,575): label maps and error texts of the API helpers (and demo stores) - next pass;
- demo data, Hebrew compared in code, values saved to the server (default names), `he-IL` date formatting (a locale branch).

## Known limits

- Single-key compromises where one Hebrew word has two meanings in one module (listed in the glossary).
- LTR polish not done: chevron icons and a few fixed `direction: rtl` / `‹` arrows point the RTL way in English (agents listed
  them: live-overview pager, calendars pagers, notify centre back button, sw-wall, elec-chart bar order, mapping arrows ...).
- Texts produced by API helper modules (`api/*`) and by held files stay Hebrew in English.
- `elec-bill-paper.ts` (the A4 bill preview) stays Hebrew to match the Hebrew PDF.

## Overlaps (merge order)

- `i18n/*` (12 files), `shell/nav.ts`, `shell/sw-app.ts`, `shell/sw-user-menu.ts`, `main.ts` are also edited by
  CR-WAVE1B-COMBINED-2436 / OWNER-R32-BACKEND-2438 (CR-NAV-LABELS, CR-SHELL-LAZY): whichever merges second resolves; the hunks
  here are one-line wraps.
- CR-I18N-CALENDARS / -ELECTRICITY (the non-held part) / -LAZY-LANG and CR-I18N-CORE of MASTER_PLAN are covered (or started)
  here; CR-I18N-HOME, -MAP, -PLANWIZARD remain.

## Tests actually run (workstation)

- `npx tsc --noEmit`: clean (after fixing three placeholder value types).
- Playwright unit config, `--workers=1`: the 250 node unit spec files that import or read a changed file (incl. the new
  `unit-i18n-core.spec.ts` and `unit-ui-lang.spec.ts`), in 7 chunks: 2,417 passed, 4 failed -> fixed (my own core spec's
  exclusion list; `unit-user-menu-sections` gains the new `langOpen` flag; `unit-uxfix-rtl`: the English '›' in the
  source-text tables is written `›`) -> those 4 spec files re-run: 30 passed.
- Backend: `tests/test_ui_lang_pref.py` (new, 2) + `test_settings_nav_pref.py` (1): 3 passed (`pytest -p no:xdist`).

NOT_RUN locally: pixel, layout and evidence suites, page unit specs (`SW_UNIT_PAGES=1`), the full backend suite - the runner
entry check runs them. Pixels: Hebrew screens are meant to be byte-identical; the only intended Hebrew change is one more row
("שפה") on the account level of the user menu, which no pixel spec captures. No English pixel baselines exist, so none were
refreshed.

## Entry check round 1 (RED @ e5f78173e, 12 failures) - causes and fixes

The branch touches `main.ts`, so the entry check ran the FULL frontend - the first full run over the AUDIT30-COMBINED base too.

1. **Load error / zero tests / count drop (preview_desktop-tablet-mobile, 3 of the 12).** `tests/unit-plan3d-furnmerge.spec.ts`
   (and `-level3`) put a stub `document` (`{ createElement }`, no `documentElement`) on `globalThis` at module level. Playwright
   loads every spec file in one process, so every later module that calls `tr()` while it initialises read
   `document.documentElement.lang` on the stub and threw: 12 load errors, 0 tests. Fix (product): `i18n/core.ts docLangRaw`,
   `ui-lang-boot.ts currentUiLang`, `tickets/text.ts ticketsLang`, `water/i18n.ts wtLang` read `documentElement?.lang` (a stub
   reads as Hebrew). New case in `unit-i18n-core.spec.ts`.
2. **layout-schedules-parity :165 (4 skins).** The trash / review pages of the schedules screen show sw-page's back key
   (AUDIT30 base); at 390 px it was 26-28 px, under the 44 px target. Fix: sw-page names the key `part="back"`; the schedules
   screen raises it to 44 px at a phone width (`sw-page::part(back)`, the same rule as its pager keys).
3. **evidence-menu-opaque :296 (3D view chip, classic / dark, desktop + mobile).** Classic rule 1 (AUDIT30-B-SHARED) paints the
   selected chip `--sw-accent-soft`, translucent in dark (`rgba(91,140,255,0.2)`), so the scene showed through. Fix: over the 3D
   canvas the bar's soft field is the same tint mixed into the opaque menu surface (`sw-plan-3d.ts`, dark only - light pixels
   unchanged). Overlap: `map/sw-plan-3d.ts` is also edited by PLAN3D-R32-ANSWERS-2438 (one CSS block).
4. **evidence-menu-opaque :202 (glass default / dark tree-row menu).** Since AUDIT30-A-GLASS-BRIDGE the default palette bridges
   its solid twin to the product's unless the host paints its own backdrop; the spec set `data-devices-scheme` by hand without the
   `data-devices-own-backdrop` flag that `devices-style.ts setScheme()` writes beside it. Fix (spec): it sets the flag the same way.
5. **pixel-wiskey-access-diag :63 [mobile] (review dialog).** The reason box had no focus ring: sw-dialog moves the focus to its
   first control one frame after it opens, and a fill typed in that frame lost the caret. Fix (product, `sw-dialog.ts`): a control
   already focused inside the dialog keeps the focus.
6. **backend test_intercom_authority::test_the_frontend_label_fallback_equals_the_backend_labels.** The spec reads the label
   table from `access-control/access.ts` with a regex; the labels are now `tr('...')`. Fix: the regex accepts the wrapper.

### Tests actually run (round 2, workstation)

- `npx playwright test --list` (desktop + tablet + mobile, main config): 35,358 tests in 1,074 files, no load error (before:
  12 TypeErrors, 0 tests).
- `npx tsc --noEmit` clean; `npm run build` + `vite build` OK.
- Preview (`--workers=1`): evidence-menu-opaque "tree row menu" [desktop] + "3D view ... classic / dark" [desktop, mobile]: 3 passed.
- pixel-wiskey-access-diag [desktop, mobile]: 10 passed (no win32 baselines: the image comparison itself is NOT_RUN locally) +
  a throw-away probe (reason box keeps the focus after an immediate fill, desktop + mobile): 2 passed, not committed.
- Backend: `tests/test_intercom_authority.py` 27 passed (`pytest -p no:xdist`).
