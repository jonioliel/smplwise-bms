# CR-I18N-CORE-2441 - the shared i18n helper: already on the base; verified, guard tightened

Branch `pilot/CR-I18N-CORE-2441`, based on `origin/pilot/I18N-EN-SWITCH-2438` (f3028d0d2). MASTER_PLAN row
`pilot/CR-I18N-CORE-2436` (code review 07:F10).

## Finding first: the row was already implemented on the base

`I18N-EN-SWITCH-2438` carries the whole row in its commit 0f7c6525a ("refactor(i18n): CR-I18N-CORE ..."), and its change
note says so. On the base, before this branch:

- `frontend/src/i18n/core.ts` exists (`docLang`, `docLangRaw`, `fill`, `registerCatalogue` / `registeredCatalogues`,
  `createCatalogue`).
- 90 modules under `src/i18n/` were moved onto it (the review counted 76 by `documentElement.lang`; the others carried
  only the filler or only registered their tables).
- `frontend/tests/unit-i18n-core.spec.ts` exists.

So this branch adds **no product code**. Writing a second `core.ts` or re-running a codemod would only have produced a
conflict with the base. What this branch does instead is the part of the row that had not been done: the per-file review
of that codemod, and a tighter guard spec. If the lead prefers, the branch can be dropped and its single spec commit
cherry-picked onto the base; nothing else depends on it.

## What changed here

1. `frontend/tests/unit-i18n-core.spec.ts` (spec only):
   - the "no own copy" guard also catches the optional-chained read `documentElement?.lang` (the form `core.ts` itself has
     used since the base's stub-document fix; the old pattern missed it) and any `{name}` replace, whatever its callback
     looks like (the old pattern matched one spelling of the callback);
   - new case: `fill` against the expression the copies carried, over 12 texts x 6 value sets, plus the order
     language -> Hebrew -> key in `createCatalogue`;
   - new case: every exported `*_DEV_MARKED` under `src/i18n/` is still there and is handed to `registerCatalogue`.
2. This note.

## Per-file review of the codemod (0f7c6525a, read-only)

Method: the commit's diff for `src/i18n/*` reduced to changed lines, then each file's removed helper lines paired with its
added lines by a throw-away script (not committed). 90 files, every one has exactly one `./core` import.

- **Regular expression.** All 68 removed fillers used `/\{(\w+)\}/g`; `core.ts` has the same expression. Callback: value
  present (`k in vars`) -> `String(value)`, else the match as written. Two removed copies wrote the "else" as
  `` `{${k}}` `` - the same string.
- **Language order.** 37 files detected `en`, then `ar`, then `ru` -> `docLang(['en', 'ar', 'ru'])` (35 the ternary, 1
  `slice(0, 2)` equality, 1 `if` chain in `wiskey-managed.ts`). 31 files detected `en` only -> `docLang(['en'])`. 8 files
  chose a table directly (`... ? en : he`) -> `docLang(['en']) === 'en' ? en : he`. No file changed its language set.
- **Lookup order.** The lookup lines themselves (`TABLES[lang][key] ?? he[key] ?? key` and the variants) were not touched
  by the commit; only the detector and the filler lines were replaced. `camera-image-health.ts` and `search-access.ts`
  (inline detection inside the lookup) keep the same expression with `docLang(['en'])` in place of the prefix test.
- **One widening, harmless:** copies whose `vars` parameter was required called `.replace` unconditionally; `fill` returns
  the text when `vars` is missing (the parameter types still require it).
- **Later on the base (ed8d93ff5):** `docLangRaw` reads `documentElement?.lang`, so a Node stub `document` without
  `documentElement` reads as Hebrew instead of throwing. In a browser nothing changes.

Not moved, and correctly so: `i18n/door-windows-widget.ts` and `i18n/wiskey-triage.ts` keep their own filler because their
rule differs (a name without a value becomes `''`). The guard names them as the two exceptions.

Not in this row's files (still carry a copy): 19 files under `tickets/` (row `CR-TK-CATALOGUE`),
`water/i18n.ts`, `notice-tv/tv-logic.ts`, `notice-tv/transit-logic.ts`, `public-ticket/*`.

## The `*_DEV_MARKED` constants

32 exported constants in 32 modules. All kept; each is now the third argument of its module's `registerCatalogue` call,
so the 12 that the review found unread are read by the registry (`registeredCatalogues()[n].devMarked`). None was renamed
or removed. `door-windows-events.ts` passes a literal `['ar', 'ru']` (it never had a constant).

Left as found, for the lead: `partners.ts` registers only `{ he, en }` but passes `PT_DEV_MARKED = ['ar', 'ru']` (its
ar / ru tables are empty objects) - the registry then names two languages it holds no table for. Report-only data, no
screen effect.

## Language switch

Unchanged and still supported: the language is read from `<html lang>` on every call (`docLang` has no cache), and
`i18n/ui-lang-boot.ts` sets it before any catalogue is loaded. `ui-lang-boot.ts` keeps its own two-line detector on
purpose (it must import nothing); the guard exempts it by name.

## For the area rows that follow (CALENDARS, HOME, ELECTRICITY, PLANWIZARD, MAP)

1. **Do not add a detector or a filler.** Import from `src/i18n/core.ts`. `unit-i18n-core.spec.ts` fails on any file in
   `src/i18n/` that reads `documentElement.lang` / `documentElement?.lang` or has its own `{name}` replace.
2. **Two ways to carry text; pick by what the area already has.**
   - Named keys: a catalogue file in `src/i18n/<area>.ts` with `he` (and `en`) tables, `docLang(['en'])`, `fill`, and one
     `registerCatalogue('i18n/<file>', { he, en })` line. A new file in `src/i18n/` without that line fails the spec.
     `createCatalogue(name, he, { en })` does all of it in one call and returns `{ t, tDynamic, lang, keys, tables,
     devMarked }`; no module uses it yet, so the first adopter should read the spec case for it.
   - Source text (what the base did for calendars and electricity): `tr('<the Hebrew>', vars?)` from
     `src/i18n/msg/<module>.ts`, built by `msgCatalogue('msg/<module>', { '<Hebrew>': '<English>' })`. Hebrew output is
     the argument itself, so Hebrew pixels cannot move.
3. **`tr()` rules** (from `i18n/msg.ts`): the first argument is a plain string literal - no template with `${}`; values go
   through `{name}` (`tr('עוד {n} פריטים', { n })`); the same Hebrew in one module has one English.
4. **Placeholders:** only `\w` names are filled; a name without a value stays as `{name}` on screen. If an area's old
   code dropped missing values instead, that is a behaviour change - keep the old filler and say so, as the two modules
   above did.
5. **Language is read at call time, text built at import time is not re-read.** A module-level constant
   (`const TABS = [tr('...')]`) takes the language of the moment the module loads. In the app that is correct (the switch
   reloads the page). In a spec, set `document.documentElement.lang` before importing the module, or call the function.
6. **Node specs and `document`:** do not install a stub `document` at module level; Playwright loads every spec file in
   one process and the stub leaks into every later spec (this broke 12 files on the base's first entry check). `core`
   now survives it, other readers may not.
7. **Already covered on the base - check before starting:** `src/i18n/msg/calendars.ts` and `msg/electricity.ts` exist
   and `src/calendars/*` already calls `tr()`. CALENDARS and ELECTRICITY are therefore mostly a completeness pass plus the
   row's lint spec; ELECTRICITY still has `elec-settings*` and `elec-wizard` untouched (the base's note: held by
   FE-LEAK-TEXTKEY-2435). HOME, MAP and PLANWIZARD have no table yet.
8. **Measure with the report:** `node scripts/i18n_missing_keys.mjs` (from the repository root; `--write` refreshes
   `docs/i18n/MISSING_KEYS_EN.md` / `.json`). It reads the registry, so an unregistered table is invisible to it. Terms:
   `docs/i18n/GLOSSARY_EN.md`.
9. **Base:** these rows need `core.ts` and `msg.ts`, so they branch from `I18N-EN-SWITCH-2438` (or from whatever it has
   merged into), not from `main` - on `main` neither file exists.
10. **ar / ru:** not offered by the switch. Do not add or remove ar / ru keys; `CR-I18N-LAZY-LANG` owns those tables and
    waits for owner decisions O4 / O5.

## Tests actually run (workstation)

- `npx tsc --noEmit` (frontend): clean.
- Playwright unit config, `--workers=1`: `unit-i18n-core.spec.ts` + `unit-ui-lang.spec.ts`: 17 passed (9 + 8; three of the
  nine core cases are new or changed here).
- Playwright unit config, `--workers=1`: the 113 `tests/unit-*.spec.ts` files that import a module from `src/i18n/`
  (the per-module parity / completeness specs; found with grep; the unit config itself leaves out the page specs among
  them): 1,052 tests - 1,044 passed, 8 skipped (skips that the specs declare themselves), 0 failed.

## NOT_RUN

- Page unit specs (`SW_UNIT_PAGES=1`), evidence, layout and pixel suites, the backend: not run here - no product file
  changed, and the runner entry check is the lead's.
- No mutation run of the tightened guard (it was not made to fail on purpose with a planted copy).
- Behaviour of the codemod was checked by reading the paired diff lines and by the specs above, not by running the old and
  the new module side by side.

## Pixels to refresh

None. No product file changed.
