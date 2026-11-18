# CR-I18N-LAZY-LANG-2443 - language packs: English / Arabic / Russian load only for a page in that language

Branch `pilot/CR-I18N-LAZY-LANG-2443`, cut from `origin/release/2438-train` at `c68904139` (release 2.43.8 rebuilt UI; it
contains every combined i18n branch). MASTER_PLAN row `pilot/CR-I18N-LAZY-LANG-2436` (code review 07:F11, theme T3 "Bundle
splitting"); owner decisions O4 = a ("load a language only when asked for") and O5 = a. REMAINING_WORK group G12: this is
the step that lets FE-GATES-ENFORCE lower the entry budget ("dictionaries wait for I18N-LAZY").

## What changed

1. **Loader** - new `frontend/src/i18n/lang-packs.ts`:
   - `packTable(lang, module, name)` returns a LIVE table: one object per (language, module, table) for the life of the
     page, empty until its pack is installed, then filled in place. Everything that kept a reference (a module's
     `*_TABLES`, `registerCatalogue`, aliases such as `PF_EN = en`, the msg translators) sees the words once they are in,
     so the 150 lookup functions are unchanged.
   - `withEntries(table, { ... })` keeps, inside the module, the few entries that read something of the module (the shell's
     labels `tab: NAV_XT.en.tab` from `nav-labels.ts`, the number formatters of `building-presence.ts`). They are present
     before any pack.
   - `ensureLangPack(lang)` fetches `src/i18n/lang/<lang>.ts` with a dynamic `import()` once (concurrent callers share the
     request; a failed fetch answers false and is retried next time), then installs it.
   - **No flash, no wrong first render**: the module itself awaits (top-level await) the pack of the language `<html lang>`
     carries when it is evaluated. `<html lang>` is set before (`i18n/ui-lang-boot.ts`, main.ts's first import, from the
     per-browser mirror of the user's choice), `main.ts` imports `lang-packs` second, and every catalogue imports it, so no
     catalogue - and nothing that renders one - is evaluated before its words are in (also in the unbundled dev server,
     where sibling imports do not wait for each other but dependents do). Hebrew fetches nothing and waits for nothing.
   - The language switch (`setUiLang`, `syncUiLang`) reloads the page, so the same wait covers it. Its in-place path (the
     mirror cannot be written: private mode / blocked storage) now awaits `ensureLangPack` BEFORE it changes `<html lang>`
     (`i18n/ui-lang.ts`, `bringPageTo` is async; both callers already awaited).
   - A later change of `<html lang>` by someone else (an embedding page, the evidence specs that set `lang` at run time):
     a `MutationObserver` fetches the pack and asks every rendered Lit component (through open shadow roots) to render again.
   - Node (the unit specs, `scripts/i18n_missing_keys.mjs`): every pack is installed while the module is evaluated, so the
     tables read exactly as before and no spec needs to load a pack itself.
2. **The tables moved** (no text changed): 223 tables from 147 modules now live under `src/i18n/lang/<lang>/<module
   path>.ts` - English 147 files (1.57 MB source; including the 29 source-text tables `i18n/msg/*`, `i18n/en.ts` (the base
   catalogue's English) and `i18n/frigate-en.ts`), Arabic 35 and Russian 35 files. `src/i18n/lang/{en,ar,ru}.ts` gather each
   language into ONE chunk; those chunks import nothing of the application (they must not: the application waits for them).
   Each module now reads `const en = packTable<typeof import('./lang/en/i18n/x').en>('en', 'i18n/x', 'en')` - the type is
   the moved literal's own type (type-only import, erased), and a declared type stays on the declaration and still checks
   it, as it checked the literal (`Record<Key, string>` tables still fail to compile when a key is missing).
3. **Codemod, kept** - `frontend/scripts/i18n-split-langs.mjs` (TypeScript AST): finds `const en / ar / ru`,
   `export const PF_EN / enStationsText / ...` and `msgCatalogue('msg/x', { ... })` literals, moves the pure part, keeps the
   module-reading entries via `withEntries`, regenerates the pack indexes. Re-runnable: after a merge brings an inline table
   back (another i18n branch adding English keys inline), `node scripts/i18n-split-langs.mjs` moves only that table (it
   refuses to overwrite a pack file that already exports the name - merge those by hand). Two tables were split by hand
   with the same rules because they spread other tables: `tickets/text.ts` English (spreads `S4_EN`, `UI6_EN`, `OTP_EN`,
   `DM_EN`, `NR_EN` - the pack file imports them from its sibling pack files; `hdTitle`, a kept entry of `text-s4`, is
   carried explicitly) and `i18n/wiskey-managed.ts` Arabic / Russian (spread the English - the pack files import it from the
   English pack file, so the Arabic chunk shares that one table).
   `format/bytes.ts` keeps its four unit names: the public pages bundle it and their build (`vite.public.config.ts`, target
   es2020) has no top-level await. `src/i18n/nav-labels.ts` (the shell's labels in four languages, a few KB) stays in the
   entry by design (CR-NAV-LABELS-2436).
4. **Untouched**: the public pages (`public-ticket/`, their own lazy Arabic / Russian since LAZYLANG-295), the TV board
   (`notice-tv/`), the service worker - none of them reaches `lang-packs.ts` (a new spec checks this with esbuild's graph).
   Hebrew text, Hebrew rendering, the switch UI, `<html lang dir>` handling: unchanged. No key added or removed.
5. Docs / tools: `src/i18n/msg.ts` header and `docs/i18n/GLOSSARY_EN.md` say where English texts are written now;
   `scripts/i18n_missing_keys.mjs` skips `i18n/lang/**` in its "hard-coded Hebrew" part (the msg tables' Hebrew keys are
   not hard-coded text). Its catalogue part needs no change (it runs in Node, every pack is installed).

## Sizes (entry chunk of the main app)

Measured with `node scripts/bundle-budget.mjs` (gzip level 9; the budget files are not changed here - FE-GATES-ENFORCE
owns them):

| Build | Entry raw | Entry gzip |
|---|---|---|
| Before: committed build of the train (`smplwise_vms/www` at `c68904139`, built on the runner from `04f735276`, `assets/index-BiEy1mLY.js`) | 3,612,094 B | 1,069,859 B |
| After: this branch, local `tsc --noEmit && vite build --outDir <scratch>` (`assets/index-E6yD3ekt.js`) | 2,790,555 B | 799,877 B |
| Difference | -821,539 B (-22.7 %) | -269,982 B (-25.2 %) |

The new chunks, fetched only when the page is in that language:

| Chunk | Raw | Gzip |
|---|---|---|
| `en-*.js` (English pack, every module's English, also of screens that are lazy chunks) | 1,408,229 B | 441,787 B |
| `ar-*.js` | 131,000 B | 36,608 B |
| `ru-*.js` | 156,211 B | 40,547 B |
| `wiskey-managed-*.js` (one English table shared by the three packs; imports nothing) | 6,240 B | - |

What remains in the entry under the deny-list's "dictionary" heading (65 modules, 342.5 KB source per the build's source
map) is Hebrew: the Hebrew tables of the catalogues the entry needs, `nav-labels.ts` (the shell's labels, four languages,
by design) and `confirm-words.ts` (shared with the backend, two languages, small). Suggested new budget for
FE-GATES-ENFORCE: the after-numbers plus its usual margin, re-measured on the runner build of the train that carries this
branch (a local build and a runner build of the same tree can differ by a few bytes in chunk names).

Cost for an English page: entry + English pack = 1,241,664 B gzip, against 1,069,859 B before (+171,805 B), because the
English pack also carries the English of lazy screens. Hebrew pages (the default) download 269,982 B gzip less. Splitting
the English pack per screen chunk is possible later (one pack per lazy chunk) but is not done here.

How to measure again: from `frontend/`, `npm run build` (or `npx vite build --outDir <dir>`), then
`node scripts/bundle-budget.mjs --dir dist` (or `--dir <dir>`); the committed build: `node scripts/bundle-budget.mjs`.

Checked in the built entry: the pack wait (`await`) sits at character 3,772 of the entry, after `ui-lang-boot` and
`core`, before any component definition (first `customElements.define` at 206,117); the three pack chunks import only
the shared `wiskey-managed` chunk, which imports nothing; the TV board chunk does not reference the loader.

## Equivalence check (the moved texts are the same texts)

A throw-away script (not committed) bundled every catalogue-registering module of the base tree (`git archive c68904139`)
and of this branch in Node with esbuild, read `registeredCatalogues()` (148 catalogues, every language) and compared them
with keys sorted: identical, except that one function value (`expires` in a WisKey catalogue) is printed with a different
indentation by esbuild - the same code. The first run found one real difference (`tickets/text` English lacked `hdTitle`,
which came through `...S4_EN`); fixed before commit. Key ORDER inside a table can differ where `withEntries` keeps entries
(they come first); no lookup depends on it, and the `*_KEYS` lists are built from the Hebrew tables.

## Tests actually run (local, `--workers=1`, Node-only unit config)

- `npx tsc --noEmit`: clean on the final source tree (run together with the build: `TSC_OK`, then `vite build` OK in
  3 min 6 s - only the usual chunk-size and "dynamic import will not move module" warnings). Two earlier runs failed on
  the first codemod output (declared types without the literal's type argument; kept entries typed away) - fixed by the
  explicit `packTable<typeof import(...)>` argument and `withEntries`.
- Run 1: `unit-i18n-lang-packs-2443` (new, 10 cases), `unit-i18n-core`, `unit-ui-lang`, `unit-i18n-locale`, `unit-i18n-home`,
  `unit-i18n-api-2442`, `unit-i18n-cal-elec-completeness`, `unit-i18n-cal-elec-lint`, `unit-i18n-map-wizard-2441`,
  `unit-i18n-plan-view-2443`, `unit-tk-catalogue-2440`, `unit-access-parity-logic`, `unit-nav-labels-2436`,
  `unit-public-lazy-lang`, `unit-fleet-report`, `unit-messaging-accounts`: 152 passed, 2 failed - `unit-i18n-core` (the
  "every module under src/i18n/ registers" list did not know `lang-packs.ts`; the loader registers nothing, spec list
  extended) and `unit-nav-labels-2436` (my first `hdTitle` fix read `NAV_TT.en.hdTitle` a second time; now it reads
  `S4_EN.hdTitle`).
- Run 2: those two specs plus every Node-only unit spec that reads a `*_TABLES` parity table (65 files): 554 passed, 0 failed.
- Spec changes because the texts moved (behaviour intended, specs were reading the old file): `unit-i18n-api-2442` and
  `unit-i18n-cal-elec-completeness` look for duplicate keys in `src/i18n/lang/en/i18n/msg/<module>.ts`;
  `unit-fleet-report` and `unit-messaging-accounts` also scan the English pack file in their "no platform name" guards.
- New `tests/unit-i18n-lang-packs-2443.spec.ts`: `packLangOf`; live table identity before / after install and kept
  entries; one request for concurrent callers; a failed fetch answers false and is retried; the real packs are installed
  in Node and the catalogues read English / Arabic / Hebrew as before; the pack indexes list every pack file and pack files
  import only pack files; no application module imports a pack statically; no non-Hebrew table is written inline any more;
  the public / TV / service-worker graphs never reach the loader; `main.ts` import order.

## NOT_RUN

- Browser / evidence / pixel specs (PC busy, runner not used tonight per the brief): in particular the eight evidence specs
  that set `<html lang>` at run time (`evidence-announcements`, `-bridge-key`, `-door-automation`, `-doorwin-295`,
  `-ha-events`, `-maskui-295`, `-plan-package`, `-wxh-leftovers-2405`): with this branch the English / Arabic / Russian
  words arrive asynchronously after such a change (MutationObserver -> fetch -> re-render). A spec that screenshots
  immediately after setting `lang` may need a wait - check them in the release gate.
- The English switch in a real browser (start in English from the mirror, switch he -> en -> he, private-mode in-place
  path), the dev server (`npm run dev`) in English, and an installed add-on. Hebrew pixel baselines are expected unchanged.
- The full unit suite (only the i18n and `*_TABLES` specs above were run).
- `scripts/i18n_missing_keys.mjs` was not re-run (its catalogue part reads the same registry the equivalence check read).
- No entry check queued (brief: push only).
