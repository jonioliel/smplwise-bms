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
