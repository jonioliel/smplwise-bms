# CR-I18N-HOME-2441 - the home interface's texts on the shared i18n core

Branch `pilot/CR-I18N-HOME-2441`. MASTER_PLAN row `pilot/CR-I18N-HOME-2436` (code review 08:F11 home, 08:F17, 08:F19 home items,
08:F21; lead decision L12). Files: `frontend/src/home/*`, the new table `frontend/src/i18n/msg/home.ts`, specs.

## Base and merge

- Base: `origin/pilot/CR-I18N-CORE-2441` (e6d320acd).
- `origin/main` (v2.43.7, cc69447f1) comes in through **341994611**, the shared main merge of the i18n branches made on
  `CR-I18N-CAL-ELEC-2441` (lead instruction). This branch had first resolved the same 18 conflicts on its own; the two results
  were equal in behaviour and differed only in the wording of four files (`i18n/nav-labels.ts`, `shell/nav.ts`,
  `unit-i18n-core.spec.ts`, `unit-nav-labels-2436.spec.ts`). The branch was then rebuilt on top of 341994611, so those files are
  its text byte for byte and the history holds one resolution only.
- `frontend/tests/helpers/i18n-source-scan.ts` is the CAL-ELEC helper, copied unchanged (the same blob), so the two branches
  merge without a conflict on it.
- The built add-on under `smplwise_vms/www*` is main's (2.43.7). It was not rebuilt here.

## What changed

### 1. 08:F11 (home) - Hebrew literals -> `tr()` and `src/i18n/msg/home.ts`

- Every Hebrew string, template text and attribute text of 33 files under `src/home/` now goes through
  `tr('<the Hebrew>', vars?)` from `src/i18n/msg/home.ts` (`msgCatalogue('msg/home', ...)`, the source-text way of
  CR-I18N-CORE rule 2). 1,124 texts, each with its English. In Hebrew `tr` returns its argument, so the Hebrew screens show
  exactly the text that was written before.
- Done with a throw-away codemod over the TypeScript syntax tree (not committed), then read and corrected by hand:
  - a string literal -> `tr('...')`;
  - a template with values -> `tr('... {name} ...', { name })` (the first argument stays a plain literal);
  - text and attribute text inside `html` templates -> `${tr('...')}` at the same place; white space around it stays in the
    template, so the rendered text nodes are the same.
- Hand corrections: the door / gate sentence that was glued from a word and a gender suffix is now two whole sentences; the
  three "ב" + name joins and the "מ" + weekday join became `tr('ב{name}', ...)` / `tr('מ{weekday} רגיל', ...)`.
- Rules of `docs/changes/CR-I18N-CORE-2441.md` kept: only `tr()` and `{name}`; no detector and no filler of its own; nothing
  touched in the ar / ru tables. Module-level constants (labels of the screen registry, theme names, weekday letters) take
  the language at load time, which is the language of the page (the switch reloads).
- Left in Hebrew on purpose (listed in the lint spec, with the reason): the title saved with a room booking
  (`הזמנה: <room>`) and the default title saved with a service request (`תקלה: <category>`) - both are stored on the server and
  read by other people, the same choice CAL-ELEC made for the calendars' saved titles.
- `docs/i18n/GLOSSARY_EN.md`: a "Home interface" section (terms, sentence parts, what stays Hebrew).

Not done from F11, on purpose:

- **Locale and time zone.** The `he-IL` / `Asia/Jerusalem` literals of the home files (clock, dates, weekday names, number
  format) are unchanged. The home data model has no installation zone today (only the recordings screen gets one, and uses
  it), and the calendars / electricity rows left theirs too; this wants one helper for all areas. In the English interface
  the dates, the weekday names of the energy screen and the month names therefore still come out in Hebrew format.
- Names that come from the data (rooms, scenes, devices, notification categories) are not texts of the interface.

### 2. 08:F17 + lead decision L12 - the home style sheet

L12 recommends "commit the generator". **There is no generator to commit**, so the row's other option was taken:

- `home-styles.ts` said "GENERATED ... edit the mockup and regenerate". No script ever produced it: the port from the round-25
  mockup was done by hand, the mockup's own `tools/` hold only the mockup's builders (assemble / shoot / contrast), the mockup
  lives outside the repository (`private/`, design material), and the sheet has been edited in place since
  (HOME-V3-AUDITFIX-2437). Writing a new generator now would have to reproduce 1,003 lines byte for byte from an input that
  is no longer their source, and would publish private design files.
- The header now says the file is hand-maintained and tells its history. Comment only: the `css` template is untouched.
- **Not done:** mapping `--hs-*` tokens to `--sw-*` and folding the near-duplicate v3 / p3 rules. Neither can be done with
  identical CSS output: the `--sw-*` values change with the skin and the theme while the `--hs-*` palette is fixed per home
  theme, and the p3 rules are refinements of the v3 ones (extra declarations), not copies. Both need the pixel gate and belong
  in a branch that may move CSS.
- CSS output: `home-styles.ts` (comment lines above the template), `home-styles-v3.ts`, `home-styles-extra.ts`,
  `home-p3-styles.ts` and the admin tab's sheet are byte-identical inside their templates.

### 3. 08:F19 (home items) - type holes

- `sw-home.ts`: the string-built dispatch `this['a_' + act]` is a typed table `acts: Record<OwnAct, ActFn>`. `OwnAct` is
  derived from the class's `a_*` methods, so a handler without an entry, or an entry without a handler, does not compile.
  Lookup is by own key (`hasOwnProperty`), as before a missing name falls through to the v3 screens' own actions.
- `sw-home.ts`: `SwHome implements P3Host`, and `new P3(this)` without the cast. Five members P3 already called lost their
  `private` (`scope`, `route`, `scopeWord`, `scopeSeg`, `sRoom`).
- `home-api.ts` `loadCameras`: the cast through `unknown` is a declared extension of the API type (`area_id`, `online`).
- `sw-home.ts` `loadTalk`: the cast through `unknown` is a declared shape. **Finding for the lead, behaviour NOT changed:**
  the code reads `feed.stations` at the top level of `GET /intercom/overview`, but the API type and the backend
  (`routers/access_control.py`) put the stations under `feed.overview.stations`. Only the home test mock
  (`tests/home-simple-mocks.ts`) sends a top-level `stations`. So on a real installation "דבר עם הכניסה" (talk to the
  entrance without a call) is most likely never offered, while the specs pass. Fixing it turns a feature on in production and
  needs the mock changed, so it is a decision, not part of a text move. `api/types.ts` was not edited (outside this row's
  files): `Camera` still lacks `area_id`.
- **Fixed 17.11 (owner approved, commit `fix(home): TALK-OVERVIEW-FIX`):** `loadTalk` now reads
  `feed.overview?.stations`; `tests/home-simple-mocks.ts` sends the real reply shape (`overview: { stations }`). Run:
  `npx tsc --noEmit` exit 0; `home-simple-2420.spec.ts` --workers=1 22 passed, 44 skipped (one-size tests); the talk test
  fails on the old code with the new mock (button never appears) and passes on the fix. NOT_RUN: a real station in the lab.

### 4. 08:F21 - favourites save

- New `src/home/keyed-debounce.ts`: one pending value and one timer per key. `sw-home.ts` saves favourites through it
  (400 ms as before). Two lists changed within the delay are now both sent (the second used to cancel the first); leaving
  the page sends every pending list (it used to send only the last).
- `tests/unit-home-favs-debounce.spec.ts`: fake timers - two lists, the same list twice, flush, a push during a send, and
  the wiring in `sw-home.ts`.

## Proof that the Hebrew screens did not move

Beyond the specs: a throw-away spec (not committed) dumped the home element's rendered tree (every element, attribute and
text; Lit's comment markers dropped; clock frozen) for 37 screens x 4 data sets (demo, worst, empty, leak) x 2 sizes
(1280x800, 390x844) plus a ringing call - 297 dumps - once on a build of the merge (before) and once on a build of this branch
(after). Result: see "Tests actually run".

## Tests actually run (workstation)

- `npx tsc --noEmit` (frontend): clean (on the final tree).
- Playwright unit config, `--workers=1`: `unit-home-*`, `unit-homeinfo-295`, `unit-i18n-core`, `unit-i18n-home` (new, 6 cases),
  `unit-home-favs-debounce` (new, 5 cases), `unit-nav-labels-2436`, `unit-ui-lang`: **110 passed, 0 failed** (run twice).
- Build: `npx vite build` (needed by the page specs; `dist/` is not committed and was deleted afterwards).
- Playwright page specs on that build, `--workers=1`, own preview port: `home-simple-2420`, `home-simple-2421`, `home-v3-*`
  (p1, p2, p3, p2-shots, fb-2431, followup-a, gaps-2436, auditfix-2437), `home-r32-answers-2438`, `home-leave-2435`:
  501 listed - **185 passed, 313 skipped** (the specs skip the tablet / mobile projects themselves), **3 failed**:
  - `home-r32-answers-2438` "Q-HOME-6: a screen change fades in place": failed once in the long run (the entry class was read
    after it had gone), **passed on the re-run** of the file (24 of 26 passed in the re-run, the two below failed again).
  - `home-v3-p2` "calendar: the day, a new event from the sheet" and "a wall panel locked to its room ...": both wait for
    today's event `.cev`. The spec's mock (`tests/home-v3-p2-mocks.ts`, `ev('e1', ..., 30, 150)`) starts that event 30 minutes
    from now; the run was at 23:45-23:57 local, so the event was on the next day. They fail on any run after 23:30 local.
    **Not re-run at another hour and not run on the base build**, so "unrelated to this branch" rests on that reading and on
    the dump below (the calendar screen with a frozen 10:30 clock is identical before and after).
- Before / after dump of the rendered home tree (see above), `--workers=1`: 297 dumps each side, compared with `diff -rq`:
  **0 files differ**. (The 298th file, the administrator tab, was not found by the dump's mock on either side.)
- `node scripts/i18n_missing_keys.mjs` (no `--write`): runs; 132 catalogues.

## NOT_RUN

- Pixel specs (`pixel-home-*`), the layout / evidence suites and the full gate: the runner's. No runner job and no entry
  check were started (brief).
- The English interface was not looked at screen by screen; the English is checked by the completeness spec only
  (present, no Hebrew in it, same placeholders). Fit of the English on the tiles (length) is not checked.
- The administrator's "ממשק ביתי" tab is not in the before / after dump (the dump's mock does not open it); it is covered by
  the home-simple-2421 / home-v3 specs listed above.
- Sheets and dialogs opened by a click are in the dump only where a screen opens them by itself; the specs above open the
  rest.
- `node scripts/i18n_missing_keys.mjs` was run without `--write` (132 catalogues, 20 missing); `docs/i18n/MISSING_KEYS_EN.*`
  were not refreshed here, to keep the i18n branches from colliding on them.

## Pixels to refresh

None expected: no CSS changed and the Hebrew DOM is the same. No pixel spec was edited.

## For the lead

1. L12: taken as "hand-maintained" because no generator exists (section 2). If a real generator is still wanted, it is new
   work with its own pixel run.
2. The `loadTalk` finding (section 3).
3. English with a fixed word order around a name ("חזרה אל " + room, n + " דולקים") is kept as sentence parts with their
   spaces; they read correctly in English but a later pass may turn the most visible ones into `{name}` sentences.
4. "סגור" has one English ("Close", the button); a closed gate's state therefore also reads "Close" in English until the
   Hebrew is split.
