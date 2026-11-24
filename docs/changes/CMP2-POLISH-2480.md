# CMP2-POLISH-2480

2.48.0 row: the held component-polish branch (`pilot/CR-CMP2-POLISH-2470`, kept out of 2.47.0 until the owner decided on its look)
with the owner's answers of 22.11 applied. LOOK RULE (owner): every module keeps its own look; a visible change needs a before /
after comparison (`private/planning/cmp2_polish_2480_compare_2026-11-23.html`, local only).

Branch `pilot/CMP2-POLISH-2480`, from `pilot/CR-CMP2-POLISH-2470` (1a2c9401d), `main` (619f94d04, v2.47.0) merged in. Merge conflicts:
`styles/fragments.ts` (both sides removed `segTrackStyles`; main's note kept) and five Linux baselines (events windows x3,
devices-schedules-ready light desktop) - main's copy taken, then re-decided by the runner pass below.

Everything else of CR-CMP2-POLISH-2470 stays (`sw-table` `rowFocusable`, the still rows of the water alerts and the generator
alert-type matrix, the polish2 kind-strip contrast checks) - except the events centre's selected-chip look (below).

Lead decision (23.11, the owner's LOOK RULE "keep each module's own look, never force the unified settings look"): the events
centre's two chip rows had taken the installation's selected-chip setting look (`sw-chip-choice selected-look="setting"`: field,
ring, check). That was not approved: both rows draw the 2.47.0 module look again (the accent-filled chosen chip), desktop and phone.
The events centre was the only screen with `selected-look="setting"`, so the option itself is removed from `sw-chip-choice`
(no user left; the component is back to main's apart from the N48 rule).

## Owner answers applied

| Question | Answer | Change |
| --- | --- | --- |
| N47 generator recipients / channels | revert to the previous look with the checkbox | `generator/gen-routing.ts`, `generator/gen-styles.ts`: the choosers of both routing drawers are the `<label><input type="checkbox">` boxes of 2.47.0 again (the `sw-chip-choice multi` chooser of CR-CMP2-POLISH-2470 removed). The still-row `rowFocusable` of the alert-type matrix is kept. |
| N48 events centre chips on a phone | 28 px drawn, invisible 44 px hit area | `components/sw-chip-choice.ts`: under a coarse pointer the chip grows to `max(var(--sw-chipc-touch-h, 44px), var(--sw-chipc-h))` and always carries an invisible `::after` hit area 44 px tall (centred). `screens/investigate-events.ts`: `--sw-chipc-touch-h: 28px` on the two rows. Every other chip-choice row is unchanged (44 px under a finger). This also changes main (44 px chips live since 2.46.0). |
| N49 readiness badges | dark text on the same colours | `screens/system-readiness.ts`: `.badge.attention` / `.badge.ok` ink is `--sw-on-warning` / `--sw-on-success` (the dark ink tokens of those fills); the fills are unchanged. The page is on main only; fixed here. |
| N56 | accept as is | nothing |
| N61 settings key height | 28 on desktop | no code here: the settings / presence segmented key is `sw-segmented`'s default, which `pilot/CR-SEG-MODULE-LOOK-2470` (another agent) changes to the 28 px module key. This branch does not touch `sw-segmented.ts` or `styles/settings.ts`. |

Follow-up found by the runner pass (fb7713b20, while the selected-look was still on): in the review-window mode on a 390 px phone
the 28 px chips plus the selected-look check mark left the toolbar's spacer item (`<span class="grow">`, one more flex item = one more 12 px gap) without
room, and "mark all handled" fell to a third line (measured: 203 + 12 + 0 + 12 + 141 > 366). The key now takes
`margin-inline-start: auto` (`.tools .ackall`) instead of the spacer: same place on every width, and the phone page is 17 px
shorter than 2.47.0 there.

## Tests

PC (Windows, Node 24):

- Unit (`playwright.unit.config.ts`): `unit-sw-segmented`, `unit-readiness-96`, `unit-sw-table`, `unit-noscroll-lists-2443`,
  `unit-sw-tabs-2460`, `unit-chip-selected-2439`, `unit-a11y-rows-2443`, `unit-polish4-shared`, `unit-phone-buttons-44`,
  `unit-dark-polish-beds`: first run 108 passed / 1 failed (the sw-chip-choice coarse-pointer pattern in `unit-sw-segmented`, updated
  to the new rule); re-run of `unit-sw-segmented` + `unit-readiness-96`: 29 passed.
- `tsc --noEmit` app and tests: 0 errors (app again after fb7713b20: 0). `eslint` on the touched source files: 0 problems.
- Captures for the comparison page (PC preview of 2.47.0 and of this branch, mocked data, 1440 / 390, light): 6 + 6 passed.
  Measured on the phone (coarse pointer): events centre chip 44 -> 28 px, `::after` hit area 44 px (-9 px from the padding box).

Runner (linux, own worktree `~/work/cmp2p2480`, `flock ~/.smplwise-tests.lock`, `nice -n 19`, `--workers=2`, no gate running), at
fb7713b20: build OK; pixel verify without `-u` over pixel-events-windows-2443, pixel-sw-tabs, pixel-sw-segmented, pixel-sw-table,
pixel-plan-wizard-2433 / -2434, evidence-audit30c-tickets, pixel-audit30a-glass-bridge, evidence-audit30b-shared, pixel-home-gaps-2436,
layout-audit30-e-infra, pixel-access-events, pixel-wiskey-access-diag, pixel-audit30g-video, visual-matrix: 303 passed, 106 skipped
(no baseline for that project), 2 failed (pixel-events-windows-2443 desktop + mobile); rewrite of those only: 3 images; verify again:
305 passed, 106 skipped, 0 failed. Behaviour (evidence-polish2-295, evidence-genalert, all projects): 27 passed. evidence-readiness-96
(desktop): 18 passed. The merge-conflict baseline `visual-matrix devices-schedules-ready-light-desktop` (main's copy) matched.

After the look-rule revert (52ee4edc4), PC: unit `unit-sw-segmented`, `unit-sw-tabs-2460`, `unit-chip-selected-2439`,
`unit-phone-buttons-44`, `unit-readiness-96`: 52 passed; `tsc` app + tests 0 errors; `eslint` on `sw-chip-choice.ts` /
`investigate-events.ts`: 0 problems; events centre re-captured (desktop + phone): 2 passed, chip 28 px, hit area 44 px.
Runner (slot B, `~/work/slotb.sh`, same specs, `--workers=2`) at 52ee4edc4: verify without `-u` 303 passed, 106 skipped, 2 failed
(pixel-events-windows-2443 desktop + mobile, against the selected-look images of 9c899ce41); rewrite of those only: 3 images; verify
again 305 passed, 106 skipped, 0 failed; behaviour 27 passed; evidence-readiness-96 (desktop) 18 passed.

Baselines (looked at, old vs new, and compared with main pixel by pixel): `pixel-events-windows-2443`
`events-windows-classic-{table,drawer}-1440-desktop-linux.png` are byte-identical to main's 2.47.0 images again (the module look, no
desktop change at all); `events-windows-classic-table-390-mobile-linux.png` differs from main only from the chip rows down (y >= 508):
the chips are 28 px, the accent fill kept, the mark-all key on the view row - the page is 17 px shorter than 2.47.0.
## NOT_RUN

- Full unit / evidence / pixel suites, the entry check (`branch_check.sh`), tablet captures; no lab / device test (UI only).
- The generator routing drawers and the readiness page have no pixel baseline (behaviour specs above cover them).
