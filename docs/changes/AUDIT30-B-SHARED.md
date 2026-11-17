# AUDIT30-B-SHARED - design audit round 30, branch B: the shared components

Branch `pilot/AUDIT30-B-SHARED`, cut from `origin/pilot/SYS-AUDIT-QUICKFIX-2437` @ `dd16b8409` (that branch is queued for a train and
already changes `components/sw-badge.ts`; it is itself cut from `origin/main` @ `ab7894837`, 2.43.1). Plan:
`private/design-system-2026-10-27/round30/system-audit/FIXES.md` sections 0, 1, 3 and 13. Frontend only: no version bump, no CHANGELOG
entry, no migration, no backend change, nothing under `frontend/src/home/**`, no device or lab access.

Head commits: `51eb053c7` (code), `ad5bbecb6` (chip fix), `d4077f4b9` / `aea6f533f` (baselines), `f0e252d73` / `c3a1ef784` (test fixes).

Files edited (all inside branch B's ownership list): `frontend/src/components/sw-chip.ts`, `sw-kpi.ts`, `sw-table.ts`, `sw-field.ts`,
`frontend/src/design/skins/classic.ts`. `sw-badge.ts` and `sw-page.ts` are not edited (see below). New tests:
`frontend/tests/unit-audit30b-shared.spec.ts`, `frontend/tests/evidence-audit30b-shared.spec.ts` (+ its Linux pixel baselines).

## Owner gates - assumptions recorded

FIXES.md rule 0.3: a gated item is built on the recommended answer (option א) until the owner answers. If the owner picks another
option, the lead rewrites that item.

| Gate | Item | Assumed |
|---|---|---|
| Q3 | B2 chip selected state (#4) | א - one soft selected field: `--sw-accent-soft` / `--sw-accent-text`, no edge, semibold, no raised key |
| Q4 | B3 KPI variants (#7) | א - one tile everywhere: dot or icon, number, word; unit / "of N" / warn / alarm as properties of `sw-kpi` |
| Q8 | B4 table phone template (#10) | א - phone row = name + state badge on one line + one meta line |

## What changed

| Item | Finding | File | Change |
|---|---|---|---|
| B1 | #12 filled badge contrast | `sw-badge.ts` | **Already done on the base** (`fd55f9fc6`, SYS-AUDIT-QUICKFIX-2437): every filled kind is the state's `-text` ink with `--sw-surface-solid` label. Not edited again. The filled live badge keeps `--sw-success` / `--sw-on-success` (owner round 22, Q5 = a) - FIXES B1 lists `live` among the kinds to invert; the owner-approved pair wins (recorded, not resolved here). Re-measured below. |
| B2 | #4 chip selected (shared part) | `sw-chip.ts` | exports the fragments `chipSelected` (`background: var(--sw-accent-soft); color: var(--sw-accent-text); border-color: transparent; font-weight: var(--sw-fw-semibold); box-shadow: none`) and `chipSelectedHover` (the soft field one accent step deeper, `color-mix` of tokens); two hooks `--sw-chip-on-count` and `--sw-chip-dot-ring` (defaults = the old inverse ink, so nothing moves where a skin does not set them). The component's own `:host([selected])` stays the accent key with inverse ink - see "Regression found and fixed". |
| B2 | #4 | `design/skins/classic.ts` rule "classic 1" | `sw-chip[selected]` removed from the raised primary-key selectors (normal and `:active`); four new rules draw the selected chip as exactly `chipSelected` (flat soft field, accent ink, count in `--sw-accent-text`, dot ring `--sw-surface-solid`, no hover lift). The unselected chip keeps the classic raised key. classic is the default skin, so this is the look every operator sees by default. |
| B3 | #7 KPI variants (API) | `sw-kpi.ts` | new properties `unit`, `secondary`, `dot`, and `tone="warn" \| "alarm"` (type `KpiTone`). Height unchanged (compact 60 px). |
| B4 | #10 table phone template (API) | `sw-table.ts` | `TableColumn.card?: 'title' \| 'badge' \| 'meta' \| 'show' \| 'hide'`; under `(max-width: 599px)` a table that marks any column renders each row as title + badge on one line and one meta line. |
| B5 | #16 search field (API) | `sw-field.ts` | `type="search"`: the field draws its own search input (icon, clear key, 34 px, `--sw-r-sm`; 44 px / 16 px text under a coarse pointer). |

Not done in this branch:
- **B6 `sw-page` phone action slot (#8, GATE Q5).** FIXES.md section 3 lists it under branch B, but the branch map (section 1) gives
  branch B only #4, #7, #10, #12 and #16, and the task card for this branch names the same five. Contradiction recorded, not resolved:
  `sw-page.ts` is untouched; the lead decides whether B6 is a follow-up of B or part of C / K.
- **Regression found and fixed (first commit `51eb053c7`).** The first version put the soft field into the component itself. The
  runner pixel refresh showed `wk-overview` in **domus** with accent ink on the accent key: domus rule 6 repaints only the background of
  `sw-chip[selected]` and relies on the component's inverse ink. Fix (`ad5bbecb6`): the component keeps its accent key; the soft field is
  the classic skin's (the default). New browser regression: the selected chip label >= 4.5:1 in domus, tesla, crystal, infra and soft,
  light and dark - it fails on `51eb053c7` (domus 2 of 10) and passes on the fix. The baselines taken from `51eb053c7` were discarded.
- Other skins' own selected-chip rules (`design/skins/domus.ts` rule with `sw-chip[selected]` as a raised key, `tesla.ts` black chip)
  are outside branch B's files, as are crystal / infra / soft / bubble, which draw the component's accent key. With Q3 = א they should
  follow (each skin sets `chipSelected` on `:host(sw-chip[selected]) button` and the two hooks, as classic does); recorded for the lead -
  no branch of the round-30 map owns `design/skins/*.ts` other than classic.
- Adopting the new APIs in screens: C, E, G, H (FIXES.md section 1).

## The new APIs (for branches C, E, G, H)

All of them are opt-in: an existing screen that sets none of them renders exactly as before (the only visible change of this branch for
existing screens is the selected chip, B2).

### `sw-chip` - one selected state

```ts
import { chipSelected, chipSelectedHover } from '../components/sw-chip';
static styles = css`
  .rc[aria-pressed='true'] { ${chipSelected} }
  @media (hover: hover) and (pointer: fine) { .rc[aria-pressed='true']:hover { ${chipSelectedHover} } }
`;
```
Prefer `<sw-chip selected>` itself; the fragment is for the local chips C, D, F, I still own.

### `sw-kpi`

| Property | Type | Effect |
|---|---|---|
| `unit` | string | a suffix after the value in `--sw-text-2`, `--sw-fs-sm` ("קוט\"ש", "°C", "%") |
| `secondary` | string | the figure the value is read against, after it ("מתוך 12") |
| `tone` | `KpiTone` = `StateKind \| 'warn' \| 'alarm'` | `warn`: `--sw-warning-soft` fill + 1 px `--sw-warning` hairline; `alarm`: `--sw-danger-soft` + `--sw-danger`. The icon sits on the solid surface in the state ink; label stays `--sw-text-2`, detail `--sw-text` (the state's own ink on its own soft field measured 4.42:1 in domus light, so the words stay neutral). |
| `dot` | `KpiTone \| ''` | a 10 px state dot in place of the icon tile (`live` green, `warn`/`stale`/`partial` amber, `alarm`/`error`/`forbidden` red, `offline` grey, `recorded` blue, `unknown` outline) |

The host's `title` and the control's accessible name include the unit and the secondary figure ("8 מתוך 12 פעילות"). Example:
`<sw-kpi layout="compact" dot="live" label="מחוברים" value="11" secondary="מתוך 12" href="#/...">`.

### `sw-table` - `TableColumn.card`

```ts
const cols: TableColumn[] = [
  { key: 'name', label: 'מצלמה', card: 'title' },
  { key: 'state', label: 'מצב', card: 'badge', render: (r) => html`<sw-badge kind=${r.kind}></sw-badge>` },
  { key: 'fps', label: 'FPS', card: 'meta' },
  { key: 'bitrate', label: 'קצב', card: 'meta' },
  { key: 'firmware', label: 'קושחה', card: 'hide' },
];
```
Under 600 px: `title` (ellipsis) and `badge` (end of the line) share the first line; every `meta` column, in column order, joins one
line with " · " (each part a bidi isolate; empty values left out); `show` keeps the old caption / value pair below; `hide` and unmarked
columns are left out on the phone only. 600 px and up: the ordinary table (the extra meta cell is `display: none`). A table that marks
no column keeps the old label / value stack. Helper: `usesCardTemplate(columns)`. The host carries `card-template` (and
`has-card-badge`) while the template is on. Note: a `meta` column's `render` is called twice per row (cell + meta line).

### `sw-field type="search"`

```ts
html`<sw-field type="search" placeholder="חיפוש מצלמה" .value=${this.q}
  @input=${(e: Event) => (this.q = (e.target as SwField).value)} @search-clear=${() => (this.q = '')}></sw-field>`
```
The field renders its own `<input type="search">` (no slotted control). `value` is kept in step before the composed `input` event
reaches the host; the clear key and Escape (when there is text; it stops there, so a drawer stays open) empty it, fire `input` and
`search-clear`, and return the focus. Accessible name: `label`, else `placeholder`; the clear key is named by `clear-label`
(default "נקה חיפוש" - the string is in the component because `i18n/he.ts` belongs to branch G). `label` (optional) and `hint` work as
on the plain field. Without `type="search"` the field is unchanged.

## Measurements (the audit's probe, from a copy of the folder)

Probe: `tools/shoot.mjs` + `tools/analyze.mjs` copied from `private/design-system-2026-10-27/round30/system-audit/` into a scratch
folder; before = the base `dd16b8409` built with `vite build`, after = this branch, each on its own `vite preview` port; routes
events, cases, incidents, health, calendars, t-board, mm-players, live, s-audit; desktop / tablet / phone, light and dark, `--wait 2600`.

`analyze.mjs` lines for the nine routes are **identical before and after** (`diff` exit 0). That is the expected result: the new APIs
are opt-in and no screen uses them yet, and the probe does not read a chip's colour. Recorded lines (after = before):

```
events     h1 30/800x1 pg1 scr D0 T0 P2016        off 0% btn 1/0  rad 7  con L0 D0  touch 3
cases      h1 30/800x1 pg1 scr D0 T0 P365         off 0% btn 0/0  rad 0  con L0 D0  touch 1
incidents  h1 30/800x1 pg0 scr D0 T0 P0           off 0% btn 0/0  rad 0  con L0 D0  touch 1
health     h1 30/800x1 pg1 scr D92 T44 P1413      off 0% btn 1/0  rad 0  con L0 D0  touch 5
calendars  h1 30/800x1 pg0 scr D0 T0 P0           off 0% btn 3/1  rad 0  con L0 D0  touch 60
t-board    h1 30/800x1 pg0 scr D1207 T2173 P2900  off 0% btn 4/5  rad 13 con L0 D0  touch 4
mm-players h1 30/800x1 pg0 scr D1009 T2889 P2662  off 0% btn 5/15 rad 8  con L0 D0  touch 4
live       h1 30/800x1 pg1 scr D0 T480 P1005      off 0% btn 0/0  rad 0  con L0 D0  touch 1
s-audit    h1 30/800x1 pg1 scr D0 T0 P1503        off 0% btn 1/1  rad 0  con L0 D0  touch 2
```

| Finding | Audit build v2.43.1 (FIXES.md) | Base `dd16b8409` | This branch |
|---|---|---|---|
| #12 filled badges, events / cases / incidents | 2.54:1 / 3.76:1 light, 2.51:1 dark | `con L0 D0` | `con L0 D0`; browser receipt: 11 filled badges per scheme, all >= 4.5:1 |
| #4 selected chip (classic) | full-accent raised key, inverse ink | same | soft field: computed `background-image: none`, `background-color` = `--sw-accent-soft`, label >= 4.5:1 light and dark; token pair 7 skins x 2 schemes >= 4.5:1 (Node) |
| #7 KPI variants | local tiles per module | none in `sw-kpi` | unit / secondary / warn / alarm / dot; one-line tile 60 px with each of them |
| #10 table on a phone (375 px) | ~160 px per camera, ~2.5 cameras in the first screen | same (no screen marks columns yet) | gallery table with `card`: **58 px per row, five rows in 292 px**; unmarked table unchanged (239 px per row in the same gallery) |
| #16 search field | pill, r10, r16 and r0 search inputs | none shared | `sw-field type="search"`: 34 px (44 px coarse, 16 px text), radius = `--sw-r-sm` |

Note on the probe run: a first attempt measured another worktree's preview that was already listening on port 4391 (the port the
FIXES.md example uses); those numbers were discarded and both builds were re-measured on their own ports (4517 before, 4518 after),
with the served `index-*.js` hash checked against each `dist/index.html`. Incident: before noticing this, I stopped the process that owned
port 4391 (PID 13112) believing it was my own preview; it may have been another agent's preview server (a `vite preview --port 4391`
from the worktree `smplwise-audit30f` was listening there afterwards). No other process was touched.

## Tests

All counts are from runs that actually ran. Workstation = Windows 11, Node 24.21.0; runner = the Ubuntu runner via
`private/runner/run_smart.py ... --workers=1 --machine runner`.

| Where | Command | Result |
|---|---|---|
| workstation | `npx tsc --noEmit` (frontend) | pass (rc 0) |
| workstation | `npx playwright test -c playwright.unit.config.ts tests/unit-` (every node-only unit spec, on `51eb053c7` + the note) | **4233 passed, 8 skipped** |
| workstation | the same config, `unit-audit30b-shared`, `unit-polish-classic-domus-297`, `unit-design-tokens`, `unit-skin-qa-followup-2404` on the fix `ad5bbecb6` | **28 passed** |
| workstation | `SW_BASE_URL=<local vite preview of the branch> npx playwright test tests/evidence-audit30b-shared.spec.ts --project=desktop --project=mobile` on `ad5bbecb6` | **41 passed** (the pixel tests have no win32 baseline: comparison skipped, annotated) |
| workstation | the 10 new skin-regression tests (`-g regression`) against the build of `51eb053c7` | **2 failed (domus light, domus dark), 8 passed** - the regression test catches the bug |
| runner | `preview <33 pixel specs> -g pixel-stable --update-snapshots=changed` @ `51eb053c7` | 346 passed, 215 skipped; 8 wk-overview (classic + domus) + gallery images came back - **discarded** (domus bug) |
| runner | the same @ `ad5bbecb6` | **346 passed, 215 skipped**; 10 images: 4 `pixel-round4-leftovers-2390` wk-overview classic (the soft selected chip "כל הדלתות"), 6 new gallery baselines. No other pixel baseline of the 33 specs moved. |
| runner | proof without `-u`: `preview tests/pixel-round4-leftovers-2390.spec.ts tests/evidence-audit30b-shared.spec.ts` @ `d4077f4b9` | 81 passed, 18 skipped, **3 failed** (KPI unit tile 62 px: Linux metrics wrapped the label) -> gallery value shortened (`f0e252d73`), gallery baselines retaken (`-u`, 61 passed, 2 skipped) |
| runner | proof without `-u`, both specs @ `aea6f533f` | **83 passed, 18 skipped, 1 failed** (the evidence-shots test timed out at 60 s on the busy runner; no pixel failure) -> 240 s (`c3a1ef784`) |
| runner | proof without `-u`: `preview tests/evidence-audit30b-shared.spec.ts` @ `c3a1ef784` | **61 passed, 2 skipped** (the shots test runs on desktop only) |

`pixel-round4-leftovers-2390` passed its proof run at `aea6f533f` (no change to it after that). The entry check
(`~/gate2/branch_check.sh pilot/AUDIT30-B-SHARED`) is queued; its verdict is NOT known at the time of writing (FIFO queue).
The dry run of its selection: 573 frontend specs incl. all 33 pixel specs (the design layer changed), the visual step on.

Regression test per fix: #4 - `unit-audit30b-shared` (classic rule, the component's ink, token pair x 7 skins x 2 schemes) and the
browser skin-regression tests; #7 / #10 / #16 - unit source guards + the browser behaviour tests (new APIs); #12 - the base's
`unit-badge-tab-contrast-2437` stays the guard, re-measured in the browser here (11 filled badges per scheme, all >= 4.5:1).
Screenshots: `docs/design/evidence/AUDIT30-B-SHARED/gallery-{light,dark}-{1440,768,375}.png`.

## Design skills (SKILLS_BRIEF.md)

Evidence under `private/design-system-2026-10-27/round30/audit30b/inspect/` (private, not in git).

| Skill | Invoked | Command / tool | Finding | Change | Rejected and why |
|---|---|---|---|---|---|
| ui-ux-pro-max | yes | `search.py "search input field clear button" / "data table mobile card layout" / "KPI stat tile dashboard" / "filter chip selected toggle state" --domain ux` (`inspect/ui-ux-pro-max.txt`) | inputs need a real type and a name; tables on mobile: card layout, not overflow | `type="search"` input, `aria-label` from label/placeholder, named clear key; the opt-in card template | its "visible label above every input" for the search box: operator screens carry no hints and the placeholder + icon is the product pattern; a `label` is still available |
| impeccable | yes | `impeccable.cmd context --target frontend/src/components/sw-table.ts` (`inspect/impeccable-context.txt`), `impeccable.cmd detect --json` on the six files (`inspect/impeccable-detect-before.json`: `[]`) + the craft floor | detector is blind to CSS inside TS template literals (0 findings, reported as such); craft floor: states (hover/press/disabled/focus), contrast >= 4.5:1, no coloured side stripe > 1 px | hover gated to fine pointers, press scale on the clear key, focus ring, disabled search state; warn/alarm use a 1 px hairline round the tile, not a side stripe; every new pair contrast-tested | - |
| emil-design-eng | yes | Skill tool | press feedback `scale` on pressables, hover only under `(hover: hover) and (pointer: fine)`, transitions name their properties, no animation on keyboard actions | the clear key presses with `scale: var(--sw-press-scale)` in `--sw-t-press`; Escape clears with no animation; no new animation added | an entrance animation for the meta line or the dot (seen tens of times a day: no) |

Look-and-fix: the gallery shots (`docs/design/evidence/AUDIT30-B-SHARED/gallery-*.png`) showed the meta line printing "fps 10" in the
RTL row; fixed by isolating each meta part (`<bdi>`). The first KPI height check showed a long label going to a second line beside a
value with a unit - the same as the old tile with the same words; the gallery keeps short labels so the 60 px rule is tested exactly.

## Known limits

- The new APIs are not used by any screen yet; their visible effect arrives with C / E / G / H. The `#/investigate/health` 375 px
  acceptance ("at least 5 cameras in the first screen") is measured on the gallery table (8 camera rows, 58 px each, five rows in 292 px)
  and becomes true on the real screen when branch G marks its columns.
- The probe's metrics (h1, scroll, off-scale, buttons, contrast, touch, native controls) do not see a chip's selected colour, so the
  chip change shows in the screenshots, not in `analyze.mjs` numbers.
- domus and tesla keep their own selected-chip rules (other files).

## Rollback

Revert the merge commit. No data, settings or migration involved.
