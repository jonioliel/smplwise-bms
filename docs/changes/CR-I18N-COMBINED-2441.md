# CR-I18N-COMBINED-2441 - all translation work on one branch, one entry check

Branch `pilot/CR-I18N-COMBINED-2441`, worktree `C:\cloude\smplwise-i18n-comb`. One candidate for the runner instead of
five: the English switch (I18N-EN-SWITCH-2438), the core codemod and the three module rows of batch -2441.

## What the branch holds

Started from `origin/pilot/CR-I18N-HOME-2441` (45c1b7649), which already contains:

| Branch | Head | How it is contained |
| --- | --- | --- |
| `pilot/I18N-EN-SWITCH-2438` | f3028d0d2 | ancestor of CORE |
| `pilot/CR-I18N-CORE-2441` | e6d320acd | ancestor of HOME |
| `main` 2.43.7 | cc69447f1 | merge 341994611 (the shared resolution of the three module rows) |
| `pilot/CR-I18N-HOME-2441` | 45c1b7649 | the starting point |

Merged here (`--no-ff`):

| Branch | Head | Merge commit | Conflicts |
| --- | --- | --- | --- |
| `pilot/CR-I18N-CAL-ELEC-2441` | 616cc7a49 | 2d8426666 | none |
| `pilot/CR-I18N-MAP-WIZARD-2441` | e085ae49a | 2be2c370b | `docs/i18n/GLOSSARY_EN.md` |

`origin/main` (cc69447f1) was already contained, so no further merge of main.

### The one conflict: `docs/i18n/GLOSSARY_EN.md`

Both HOME and MAP-WIZARD wrote after the same sentence (the list of "one Hebrew, two meanings" compromises). HOME ended
the sentence and added the section "Home interface"; MAP-WIZARD continued the sentence with its three map / plan-wizard
entries. Resolution: the union - the sentence carries MAP-WIZARD's three entries, then HOME's section follows unchanged.
MAP-WIZARD's own section ("Map, 3D view and plan wizard") merged without conflict.

### Lists that several branches extend

After the shared merge 341994611 the three rows touch separate files: each has its own table (`src/i18n/msg/home.ts`,
`map.ts`, `plan-wizard.ts`, `electricity.ts`), its own lint / completeness spec and its own source folders. No row changed
`gate_always_run.json`, a shared lint allow-list or the table registry after 341994611, so there was nothing to unite
beyond the glossary. `tests/helpers/i18n-source-scan.ts` was added by both CAL-ELEC and HOME with the same content.

Checked mechanically: every file of the combined tree has exactly the content it has on HOME, CAL-ELEC or MAP-WIZARD
(18,902 files compared by blob id; the only exception is the glossary above), and every change a row made after 341994611
is present.

## The red entry check of I18N-EN-SWITCH-2438 and its fix

Failure (desktop, tablet, mobile - one source test, so the same failure three times):
`tests/audit30-d-multimedia.spec.ts:50` "AUDIT30-D sources > D3: the three screens are framed by sw-page and draw no
`<h1>` of their own", naming `screens/multimedia-screens.ts`.

Cause: the guard looked for the exact source text `<sw-page class="page" wide heading="מסכים"`. The English switch
(461eb557d) writes the same title as `heading=${tr('מסכים')}` in the three multimedia screens so English can replace it.
The page is still framed by `<sw-page class="page" wide>`, the Hebrew title is the same text, and no `<h1>` was added
(the second assertion of D3 and the browser half of the spec - "one h1 from sw-page" with the Hebrew title - pass).
So the product is as intended and the test was stale.

Fix (test only, `fix(i18n)` commit): D3 accepts the title in either form - the literal attribute or the same Hebrew text
handed to `tr()` - still on the exact `<sw-page class="page" wide heading=` opening, per screen and per title. The `<h1>`
assertion is unchanged. No product file changed in this branch.

## Hebrew output

- The three rows each showed their Hebrew output identical (see their notes: textual un-wrapping for CAL-ELEC, pinned
  sentences for MAP-WIZARD, 297 rendered-tree dumps for HOME). Those were throw-away scripts and are not in the repository,
  so they were not re-run here. What was checked here instead: the combined tree is file for file one of the three checked
  trees (blob comparison above), and the committed specs that pin Hebrew pass on the combined tree
  (`unit-i18n-map-wizard-2441` "Hebrew: the sentences ... read exactly as before", `unit-i18n-home` "Hebrew shows the text
  as written", `unit-ui-lang` "Hebrew unchanged", `unit-nav-labels-2436`).

## Tests actually run (workstation, all `--workers=1`)

- `npx tsc --noEmit` (frontend): clean.
- Playwright unit config (Node specs): `unit-i18n-core`, `unit-i18n-home`, `unit-i18n-cal-elec-completeness`,
  `unit-i18n-cal-elec-lint`, `unit-i18n-map-wizard-2441`, `unit-nav-labels-2436`, `unit-a11y-polished-lint`,
  `unit-ui-lang`, `unit-audit30*`, `unit-glass-bridge-audit30a`: **65 passed, 0 failed**.
- Playwright unit config, the other Node specs that read a source file changed by the translation rows (found by a scan of
  the specs for the changed file names; `unit-home-*`, `unit-plan*`, `unit-geometry*`, `unit-studio-*`, `unit-still-*`,
  `unit-hud-*`, `unit-textkey-2435`, `unit-menu-lint`, `unit-uxfix-nav-295`, `unit-three-chunk` and 20 more):
  **578 passed, 0 failed**.
- `npx vite build`, then the main config on a private preview port, `--project=desktop`: `audit30-d-multimedia`,
  `audit30-f-calendars`, `layout-audit30-e-infra`, `layout-audit30h-wiskey`, `layout-audit30h2-wiskey`,
  `layout-audit30wk-components`, `unit-audit30b-shared`, `unit-audit30b2-page-action`, `unit-glass-bridge-audit30a`,
  `unit-a11y-polished-lint`: **79 passed, 1 skipped (declared by the spec), 0 failed** - D3 included.
  `dist/` deleted afterwards.
- `node scripts/i18n_missing_keys.mjs` (no `--write`): runs; 134 catalogues, 26,516 keys, 20 missing.

## NOT_RUN

- Tablet and mobile projects of the specs above (the D3 failure is a source test and is project-independent).
- `evidence-audit30*` and `pixel-audit30*`, every other evidence / layout / pixel suite, the page unit specs
  (`SW_UNIT_PAGES=1`), the backend: the runner entry check.
- The three rows' throw-away Hebrew before / after scripts (not in the repository) - see "Hebrew output".
- The two `home-v3-p2` calendar cases HOME's note reports as failing after 23:30 local were not re-run here.
- No lab or device access.

## Pixels expected to change

None. No product file was changed here, and the rows report Hebrew output identical. No baseline was refreshed.
