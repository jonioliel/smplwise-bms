# CMP2-POLISH-2480

2.48.0 row: the held component-polish branch (`pilot/CR-CMP2-POLISH-2470`, kept out of 2.47.0 until the owner decided on its look)
with the owner's answers of 22.11 applied. LOOK RULE (owner): every module keeps its own look; a visible change needs a before /
after comparison (`private/planning/cmp2_polish_2480_compare_2026-11-23.html`, local only).

Branch `pilot/CMP2-POLISH-2480`, from `pilot/CR-CMP2-POLISH-2470` (1a2c9401d), `main` (619f94d04, v2.47.0) merged in. Merge conflicts:
`styles/fragments.ts` (both sides removed `segTrackStyles`; main's note kept) and five Linux baselines (events windows x3,
devices-schedules-ready light desktop) - main's copy taken, then re-decided by the runner pass below.

Everything else of CR-CMP2-POLISH-2470 stays (`sw-table` `rowFocusable`, `sw-chip-choice selected-look="setting"` on the events
centre's two rows, the still rows of the water alerts and the generator alert-type matrix, the polish2 kind-strip contrast checks).

## Owner answers applied

| Question | Answer | Change |
| --- | --- | --- |
| N47 generator recipients / channels | revert to the previous look with the checkbox | `generator/gen-routing.ts`, `generator/gen-styles.ts`: the choosers of both routing drawers are the `<label><input type="checkbox">` boxes of 2.47.0 again (the `sw-chip-choice multi` chooser of CR-CMP2-POLISH-2470 removed). The still-row `rowFocusable` of the alert-type matrix is kept. |
| N48 events centre chips on a phone | 28 px drawn, invisible 44 px hit area | `components/sw-chip-choice.ts`: under a coarse pointer the chip grows to `max(var(--sw-chipc-touch-h, 44px), var(--sw-chipc-h))` and always carries an invisible `::after` hit area 44 px tall (centred; `::before` is the selected-look check mark). `screens/investigate-events.ts`: `--sw-chipc-touch-h: 28px` on the two rows. Every other chip-choice row is unchanged (44 px under a finger). This also changes main (44 px chips live since 2.46.0). |
| N49 readiness badges | dark text on the same colours | `screens/system-readiness.ts`: `.badge.attention` / `.badge.ok` ink is `--sw-on-warning` / `--sw-on-success` (the dark ink tokens of those fills); the fills are unchanged. The page is on main only; fixed here. |
| N56 | accept as is | nothing |
| N61 settings key height | 28 on desktop | no code here: the settings / presence segmented key is `sw-segmented`'s default, which `pilot/CR-SEG-MODULE-LOOK-2470` (another agent) changes to the 28 px module key. This branch does not touch `sw-segmented.ts` or `styles/settings.ts`. |

## Tests

See the report of this row (numbers filled in after the runs):

- PC unit (`playwright.unit.config.ts`): see below.
- PC `tsc` (app + tests), `eslint` on the touched files: see below.
- Runner pixel verify (without `-u`): see below.

## NOT_RUN

- Full unit / evidence / pixel suites, the entry check (`branch_check.sh`), tablet captures; no lab / device test (UI only).
