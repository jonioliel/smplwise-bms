# CR-FIELD-UNIT-2470

2.47.0 row. `sw-field` gets a unit / affix slot, the electricity time-of-use price editor (left out by
`CR-CMP2-TABLES-CONSUMPTION-2450`: "`sw-field` has no unit slot yet") moves onto it and onto `sw-table`, then the other hand-built
"input + unit" pairs of the consumption modules move the same way, one screen per commit (owner N10, N21-N46: a mixed form moves all its
fields together; shared tones / breakpoints in tables).

Branch `pilot/CR-FIELD-UNIT-2470`, base `origin/release/2450-train` (521165ad4). Not touched: `management/tasks.json`, segmented controls,
chips and the routing chips (owner 20.11: module looks stay; nothing here moves a module toward the settings-key look), the bill paper,
`shell/sw-app.ts`, `router.ts`.

## 1. `sw-field` unit (1ec5bce90, 59fac3c4a) - opt-in, a field without `unit` renders as before

| API | What it does |
|---|---|
| `unit="₪"` | the unit is drawn INSIDE the slotted input's frame, laid over the input's padding on its side; the padding is the unit's measured width (ResizeObserver) + the inset + 6 px, so the figure never runs under it; a press on the unit lands in the input |
| `unit-at="start" \| "end"` | the side in the READING direction (default `end`, after the figure: the left edge in Hebrew, the right in English). The padding side is physical, picked from the host's `:dir()` - an LTR figure in an RTL page has the opposite logical sides |
| numeric inputs | `inputmode` decimal / numeric or `type=number`: LTR digits, tabular figures, the text aligned against its unit |
| a11y | the unit is the input's `aria-description` (ours is marked and leaves with the unit; a screen's own description is kept); a press on the field's label focuses the slotted control (the label cannot point across the shadow boundary) |
| `aria-invalid="true"` | draws the danger frame inside any shadow root (a shared table cell, where a screen's `.err` does not reach) |
| `slot="message"` | a field's own message (role="alert") under the frame, outside the unit box |
| parts | `label`, `hint`, `unit-box`, `unit`; custom property `--sw-field-unit-inset` (11 px) |

A module skin's plain `input { padding }` sits in the outer tree and outranks `::slotted()`: the unit-side padding is the one
`!important` declaration (commented). Module skin (`electricity/styles.ts`, shared by water): `sw-field class="fld"` keeps the module's
`.fld` column / gap / message, its label size (`::part(label)`), its own input look, and the unit on the module inset (13 px).

## 2. Screens moved (one commit each)

| Screen | Commit | Units | Hooks kept |
|---|---|---|---|
| electricity time-of-use price editor (`elec-tou-editor.ts`) | ebb2b115f | ₪ | `data-tou-prices`, `data-tou-price` (+ `.err`, now also aria-invalid), header 'פס' / 'Band'; new row hook `data-tou-band` |
| electricity prices: tariff + VAT dialogs (`elec-settings.ts`) | c99e12bdc | ₪, % | `data-tariff-name/-price/-from`, `data-vat-input/-from`, ids |
| electricity business details (`elec-settings.ts`) | d452c502a | ימים / בחודש, "שעות אחרי סוף התקופה" | `#b-<key>`, `data-field-error`, `data-days`, `data-day-of-month`, `data-delay` |
| electricity account wizard: period step + tariff dialog (`elec-wizard.ts`) | 0dcee3ff6 | בחודש, ₪ | `data-anchor-month/-day`, `data-first-start`, `data-tariff-*` |
| electricity meter card: replace dialog (`meter-card.ts`) | 396125c4f | קוט״ש | `data-replace-final/-start/-note`, `data-replace-error` |
| electricity data retention (`screens/electricity/settings-retention.ts`) | f60228498 | ימים / חודשים / שנים | `data-retention-input`, `data-retention-error` |
| water meter card dialogs (`water/meter-card.ts`) | 8eafb740d | מ״ק | ids (`wfr`, `wsr`, `wkd`, `wru`, ...) |
| water tariff version dialog (`screens/water/page-settings.ts`) | c7b831a30 | ₪ (new: the label already said "per m³") | `data-tariff-name`, `data-water-price`, `data-sewage-price` |

The time-of-use prices are `sw-table` now (bare in the card, read-only rows, one row per band, one column per season, the VAT's other side
as the field's hint); the `.scrollx` wrapper is gone - on a phone the rows stack under the season captions (owner rule: no scrolling in
control screens).

Not moved (recorded, not guessed):
- generator settings (`generator/gen-settings.ts`): the units are part of the labels in the i18n catalogue in four languages
  ("הספק נקוב (kW)", "לחץ שמן מינימלי (bar)"...), not a hand-built affix; moving them is a catalogue change (open question 1).
- electricity reading / calibration dialogs (`meter-readings.ts`): the unit there is a select (kWh / Wh / MWh), not an affix.
- the water snooze row (a number + a unit select) - same.

## Visible differences (owner 20.11: report any)

- The unit moved from beside the input (`.unit` / `.inp` patterns) to inside the frame, on the reading end (the left in Hebrew).
- Module form labels, gaps, input frames and error colours are unchanged (module rules kept); the retention values' unit is text-2
  (was text-3).
- The water tariff prices show ₪ inside the frame (new).
- The time-of-use price grid: the shared table header band and row rules; on a phone a stacked card per band instead of a sideways scroll.
- Not changed: any segmented control, chip, routing chip or `chip_selected` look.

## Tests actually run (workstation, Vite dev server of this worktree on its own port and dependency cache, `--workers=1`)

- `npx tsc --noEmit -p tsconfig.json`: exit 0; `-p tsconfig.tests.json`: exit 0 (code head 71755755d; the train merge touches no file of
  this row - not re-run after it).
- ESLint on the 9 touched source files: exit 0, no findings. `node scripts/unused-exports.mjs --enforce`: OK.
- Unit (`playwright.unit.config.ts`): `unit-field-unit-2470` (new) 11 passed; `unit-a11y-polished-lint`, `unit-a11y-r4-leftovers-2380`,
  `unit-audit30b-shared`, `unit-dark-polish-beds`, `unit-fe-nits-2442`, `unit-i18n-cal-elec-lint`, `unit-i18n-cal-elec-completeness`,
  `unit-polish-classic-domus-297`, `unit-sw-segmented`, `unit-sw-table`, `unit-wall-phone-bar-2401`, `unit-electricity-customer-form`
  (+ the new file): 127 passed, 0 failed.
- Browser, desktop: `electricity-accounts`, `electricity-wizard`, `electricity-meters`, `electricity-tou`, `evidence-wkwater-2331`,
  `pixel-sw-field`: 64 passed, 3 skipped (pixel shots without a win32 baseline), 1 failed - the accounts list's loading-state probe
  (600 ms mock latency on a PC at 100 % CPU; the list is untouched); rerun alone: 1 passed. `evidence-tariff-names-en-2440`: passed
  (desktop + mobile, with `electricity-tou` and `pixel-sw-field`: 16 passed, 4 skipped).
- Browser, mobile: `electricity-accounts`, `electricity-wizard`, `electricity-meters`, `evidence-wkwater-2331`: 58 passed, 2 skipped.
- No-scroll / layout (owner rule): `layout-electricity` (`LAYOUT_QUICK=1`, 4 widths, 4 skins, 336 checks each) 0 findings, 0 page errors;
  `layout-electricity-meters` 36 checks, 0 findings; `layout-audit30-e-infra` (water / electricity / generator no-scroll at 1366x768 and
  the AUDIT30-E checks, desktop) 26 passed.
- Looked at in the browser: the sw-field specimen (light / dark, desktop / phone, Hebrew + English), the time-of-use price grid (desktop
  light / dark, phone), the business settings form, the wizard period step. The look found the figure / unit separation fixed in 59fac3c4a.

## Runner pass and baselines

Runner, no gate running (gate_status `pass`, release/2450-train done), own folder `~/work/fieldunit`, `nice -n 19`, `--workers=1`, script
`~/work/fieldunit-run1.sh 71755755d` (log `~/work/fieldunit-run1.log`, results `~/work/fieldunit-out1/summary.txt`), 00:19-00:28:

- build: rc 0.
- `pixel-sw-field` (new specimen): `--update-snapshots` 6 written; verify without `-u` on desktop / tablet / mobile: 12 passed.
- unchanged by construction, verified without `-u`: `evidence-audit30b-shared` pixel (the gallery with the sw-field search box) 4 passed;
  `pixel-sw-table` 9 passed; `layout-audit30-e-infra` (desktop) 26 passed; `layout-dropdown-fit` (capsule sw-field) 2 passed.
- tablet project against the folder's dev server: `electricity-tou`, `electricity-accounts`, `electricity-wizard`, `electricity-meters`,
  `evidence-wkwater-2331`: 63 passed, 1 skipped.
- the only changed images: the six new baselines. Disk 84 % -> 87 % during the pass; the folder's dist / test-results / vite cache removed.

Baselines added (each looked at: light and dark, the units inside the frames at the reading end, the figures against their units, "-12.50 ₪"
in Hebrew, the wrong and the disabled values, the English block):
`frontend/tests/pixel-sw-field.spec.ts-snapshots/sw-field-{light,dark}-{desktop,tablet,mobile}-linux.png`.

Train: `origin/release/2450-train` moved to b643e8e7a (2.45.0 gate run 1 fixes: events keys, temperature report) and was merged in
(9ece2af80); no overlap with this row.

## Open questions (recommendation taken, for the owner's page)

1. Generator thresholds / ratings carry their unit in the label text ("(kW)", "(bar)", "(%)"). Move the unit into the frame (a catalogue
   change in 4 languages, its own small row)? Recommendation: yes, as a separate row.
2. The unit sits inside the input's frame at the reading end (left in Hebrew). Keep? Recommendation: yes (the figure and its unit read as
   one value, as in the shared table cells).
3. Water tariff prices show ₪ inside the frame (they had no unit; the label says "per m³"). Keep? Recommendation: yes.
4. The automatic-draft field keeps its phrase "שעות אחרי סוף התקופה" as the unit (copy unchanged). Shorten to "שעות" + a hint later?
   Recommendation: keep the copy now.
