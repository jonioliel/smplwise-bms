# CR-UI-POLISH-2443 - three small UI polish items for 2.43.9

Branch `pilot/CR-UI-POLISH-2443` (worktree `C:\cloude\smplwise-uipolish`), cut from the 2.43.8 train head `origin/release/2438-train`
= `aa20f05ae` (it contains `origin/main` 2.43.7 `cc69447f1`). Sources of the three items: `docs/changes/CR-FE-PROMISES-2442.md`
lead question 2, and `docs/changes/RELEASE-2438-TRAIN.md` section 3 (last line) and section 6 (first item).

No backend file, no style, no layout, no PNG, no dependency. By instruction: **no entry check queued, the runner not used**.

## 1. "החשבון שלי › המסך שלי" - a first read that fails shows the reason

### What was found (it differs from the row's description)

The row says: when the first read in `connectedCallback` fails, the section stays empty with no message. On this code the chain
`Promise.all([loadPersonal(), loadHomeSettings(true), loadPersonalRow(), productSettings().catch(() => null)])` **cannot reject**:
each of the four readers catches its own failure and answers a default (`api/home.ts` `loadPersonal` -> "no choices",
`loadHomeSettings` -> `HOME_DEFAULT`, `api/area-row.ts` `loadPersonalRow` -> `{}`, the settings -> `null`). So a failed read did
not leave the section empty. It did something worse and quieter: the section showed **the installation's defaults as if the user
had stored nothing**, fully editable - and every change saves the whole value (`savePersonal` = PUT `/me/prefs` `home.personal`),
so the first click after a failed read replaced the stored personal choices the screen could not read.

### The fix

- `frontend/src/shell/home-personal-read.ts` (new, no DOM):
  - `readOwnChoices()` - the user's two own values (`home.personal`, `devices.area_row`) from **one** read of `/me/prefs` that
    **rejects** when it fails. `loadPersonal` / `loadPersonalRow` are unchanged: the screens that only apply the choices
    (`devices-building.ts`) keep their "no choices" fallback, which is right there.
  - `firstRead(reads, apply)` - runs the reads and applies the answer; never rejects; answers `''` or the reason
    (`describeError`) - of a failed read, or of a fault while applying.
- `frontend/src/shell/sw-home-personal.ts`: `connectedCallback` reads through `firstRead`; the reason lands in the existing
  `failed` state; `render()` with no data returns the section's **existing** red note (`<p class="err" role="alert"
  data-home-personal-error>`, now one `errorNote()` used for a failed save and a failed first read) instead of always `nothing`.
  While the read is on its way the section is empty as before. The demo mode reads nothing, as before.
- The installation's side keeps its fallbacks (`loadHomeSettings`, the settings answer the defaults): only the user's own stored
  value is the one a save can destroy.
- **No retry control**: the screen has no retry pattern of its own (its only link-style control is "ברירת מחדל של המערכת"). The
  section is mounted only while it is open in the user menu, so closing and opening it reads again.

What the user sees now when `/me/prefs` cannot be read: the red note with the reason (the server's sentence, or "אין חיבור
לשרת." without a connection) and no choices to change. Before: the defaults, editable.

Merge note: `pilot/CR-FE-PROMISES-2442` touches the same file (five `void this.commit(`, a comment above `commit()`, the segment
style fragment) - other lines; its unit spec's pins (`data-home-personal-error` present, five `void this.commit(`) still hold.

## 2. The "מפה תלת־ממדית" settings card (owner round 32) goes through `tr()`

The card was written after the translation rows, so it stayed Hebrew in the English interface. All of it is covered - the two
files the row names and `screens/plan-view-dials.ts`, which holds the card's explanations and the round-28 rows (without it the
card would be half English):

| File | Texts | Table |
| --- | --- | --- |
| `frontend/src/api/plan-view.ts` (`DIAL_HE`, `CHOICE_HE`) | 58 | `frontend/src/i18n/msg/api-plan-view.ts` (new, `msg/api-plan-view`) |
| `frontend/src/screens/plan-view-dials.ts` (`HINT_HE`, `KIOSK_HE`, `MAP3D_ROWS`) | 66 | `frontend/src/i18n/msg/plan-view-card.ts` (new, `msg/plan-view-card`) |
| `frontend/src/screens/system-plan-view.ts` (headings, rows, buttons, messages, errors) | 46 | the same |

Two tables on purpose: `api/plan-view.ts` is also imported by the 3D view and the wall screen, so its table holds only the short
names; the card's long explanations stay with the card (the settings chunk). The names follow the catalogue conventions: the
Hebrew text is the key, plain literals only, values through `{name}` (`'לפי ההתקנה: {value}'`, `'{n} מ׳'`).

English: the glossary's terms (walk, prepared picture, wall screen, the quality rungs, m), and the same English as the
neighbouring tables for the shared words (`msg/system-b` look card: As the installation / My preference / Installation default /
Preference saved; `msg/plan-wizard` settings dialog: Included without review above (%), Included as detected; `msg/map`:
Automatic, Architectural light, Polished Calacatta marble). New terms are in `docs/i18n/GLOSSARY_EN.md` (a sub-section under
"Map, 3D view and plan wizard"). One deliberate difference: the card's "פעיל / כבוי" is "On / Off" (a switch), where
`msg/system-a` says "Active" for a status.

**Hebrew is byte-identical.** `tr()` returns its argument in Hebrew. Checked by taking `tr()` away again and comparing the three
files with the base revision (a one-time script, not committed): the only lines that differ are the three `import` lines, two
doc comments, and the four lines where a string template became a placeholder (`fmtRange` and the three "לפי ההתקנה: ..."
hints) - and the unit spec asserts those four compose to the same Hebrew.

Lint / completeness: `frontend/tests/unit-i18n-plan-view-2443.spec.ts` (new, node only, 6 cases) - no Hebrew literal outside
`tr()` in the three files; each file reads from its own table with plain literals; every `tr()` text has its English with the
same placeholders; no unused table entry; English without Hebrew letters; the Hebrew values are the texts as written; the words
shared with `msg/map`, `msg/plan-wizard`, `msg/system-a`, `msg/system-b` carry the same English (two listed exceptions).

Not translated here (outside the card): the label the site-location hint points at, "מיקום האתר לשמש בתלת־ממד", is a row of
`screens/system-diagnostics.ts` that no translation row has reached; the hint's English names it "Site location for the sun in
3D". `docs/i18n/MISSING_KEYS_EN.*` was not regenerated (a generated report; regenerating it here would conflict with every
translation branch).

### Merge hints for `pilot/CR-I18N-COMBINED-C-2442` (it also wraps `api/plan-view.ts`)

That branch wraps the pre-round-32 names of `api/plan-view.ts` with `tr` of `msg/api-home` (CR-I18N-API-2442). Whichever is
merged second conflicts in `DIAL_HE` / `CHOICE_HE` and in the import line. Resolution: **take this branch's file** (it wraps every
name, the round-32 ones included, which that branch's lint requires anyway), then:

1. `tests/unit-i18n-api-2442.spec.ts` - add `'msg/api-plan-view'` to its `TABLES` (one import, one entry);
2. `src/i18n/msg/api-home.ts` - remove the `// api/plan-view.ts` block (39 keys); the spec's "tables hold nothing else" check
   names any that another api file still uses.

Two of that block's English texts disagree with the glossary and should not survive the merge: "walkthrough" for סיור (glossary:
walk) and "ready-made image(s)" for תמונה מוכנה (glossary: prepared picture). This branch's table has the glossary's words.

## 3. The eight English texts of the train's `fix(merge)` commit (`a34698b59`)

`msg/map.ts`: "Polished Calacatta marble", "Travertine". `msg/plan-wizard.ts`: "Lobby and public areas", "Stone, reception desk,
seating", "Technical and car park", "Concrete, floor markings, no furniture", "Commercial", "Tiles, shelves, counter".

Reviewed against `docs/i18n/GLOSSARY_EN.md` and the neighbouring entries: **no change needed.** Sentence case, British spelling
("car park", as the six other "חניון" entries of the tables), the same nouns as the sibling kit lines ("Parquet, light walls,
home furniture"), "Tiles" as `msg/devices`, "reception desk" (the glossary's "station" is the intercom's עמדה, not this one),
no glossary term contradicted. Nothing was edited in the two tables, so Hebrew and English are both unchanged there.

## Tests actually run (this workstation, Node 24.21.0, `frontend/node_modules` junction to the main checkout)

1. **`npx tsc --noEmit`** (project config, the three new specs included), final tree: **exit 0, no output**.
2. **The two new unit specs** (`npx playwright test -c playwright.unit.config.ts ... --workers=1`):
   `unit-home-personal-first-read-2443` **13 passed**, `unit-i18n-plan-view-2443` **6 passed**.
3. **Node-only unit run of the touched area**, `--workers=1` - 25 spec files, **218 passed, 0 failed** (211 in one run of 24
   files + `unit-plan3d-level3` 7 on its own, see the note below): the two new specs, every i18n spec (`unit-i18n-core`,
   `-home`, `-cal-elec-lint`, `-cal-elec-completeness`, `-map-wizard-2441`, `unit-ui-lang`, `unit-nav-labels-2436`), the specs
   that read the three plan-view files (`unit-plan3d-r32-answers`, `unit-plan3d-level3`, `unit-plan3d-floor-finish`,
   `unit-plan-3d-pixel-ratio`, `unit-studio6-ui`, `unit-polish4-wp6-maps`, `unit-a11y-polished-lint`, `unit-dark-polish-beds`),
   the specs around the personal screen and its readers (`unit-area-row`, `unit-home-config`, `unit-home-lazy-2440`,
   `unit-elevators`, `unit-generator-home-widget`, `unit-temperature-phase3`, `unit-uxfix-nav-295`) and `unit-no-native-dialogs`.
4. **Hebrew unchanged, by source**: the one-time unwrap comparison against `aa20f05ae` described in item 2 - 17 differing lines
   in the three files, all of them imports, comments or the four placeholder lines.
5. **`npx vite build`**: exit 0 (7 min 41 s on the loaded workstation).
6. **Desktop evidence in a browser** (`--project=desktop --workers=1`, preview of the build on the private port 4363, mocked
   backend of `tests/st7-ui-mocks.ts`, no fixture backend needed): **6 passed**.
   - `tests/evidence-ui-polish-2443.spec.ts` (new, 4 cases, writes no screenshot): "המסך שלי" with a first read that arrives
     (the choices, no note); with `/me/prefs` answering 503 (the red note with the server's sentence, `role="alert"`, the
     colour of `--sw-danger`, no choices and no reset link); the 3D map card in Hebrew (heading, a dial name, the two composed
     "לפי ההתקנה: ..." hints, a round-28 option, the latitude label - the same texts as before); the card in the English
     interface, both targets: heading "3D map" and **no Hebrew letter** in its text, `aria-label`s and field labels.
   - `tests/evidence-st7-ui.spec.ts`, the two existing "settings: the realistic 3D card" cases (light, dark): the card's own
     flows still pass. The two PNGs they rewrote were restored - none is committed.

Note on the unit run: `tests/unit-plan3d-level3.spec.ts:18` leaves a `document` stub on `globalThis` when it is loaded, and a
spec loaded after it in the same process that imports Lit (`unit-temperature-phase3`) then fails to load
(`createTreeWalker is not a function`). It depends on which files are named together (the full unit run passed on the train, so an earlier
file there evidently loads Lit first); both files are untouched here. Not fixed in this row.

## NOT_RUN / BLOCKED

- **Runner entry check, pixel run, the full gate**: not queued, the runner was not used (instruction for this row).
- **The full node-only unit suite** (about 4,700 cases): NOT_RUN - only the 25 files above.
- **`npm run lint` (ESLint)**: NOT_RUN (the workstation was short of memory with the other agents; `lint` is not blocking on
  this base).
- **The personal screen's failure test against the code before the fix** (a negative proof in a browser): NOT_RUN - it needs a
  second build. The node spec shows the difference instead (`readOwnChoices` rejects, `loadPersonal` does not).
- **`evidence-home-screen`** (the personal screen over the devices fixture backend): BLOCKED on this workstation, as for the
  earlier rows; the new evidence spec covers the section over a mocked backend.
- **Tablet and phone projects, the layout / pixel suites, backend tests, `build:addon`, `gate:budget`**: NOT_RUN (no layout,
  style or backend change; `smplwise_vms/www` is not rebuilt here).

## Pixels to refresh

None expected: no Hebrew text, style or layout changed. (The personal screen's failed-read state has no baseline.)

## Lead questions

1. **The personal screen's strict read** (item 1): the row asked for a note on a failed first read; the reachable failure turned
   out to be a silent fallback to defaults that a save then overwrites, so the user's own values are now read strictly.
   a) keep (recommended); b) keep only the note for a rejected chain and go back to the tolerant readers (the note then never
   shows in practice).
2. **A retry control in the section** - not added (no pattern in the screen; reopening the section reads again).
   a) leave (recommended); b) add a "נסה שוב" link in a follow-up (one new text, already in the glossary: Try again).
