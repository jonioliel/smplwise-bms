# SEG-MODULE-LOOK-2480

2.48.0 row. Branch `pilot/SEG-MODULE-LOOK-2480` (worktree `C:\cloude\smplwise-seg2480`), cut from the held row
`pilot/CR-SEG-MODULE-LOOK-2470` at 45a37ae49 (its note: `docs/changes/CR-SEG-MODULE-LOOK-2470.md`) and merged with `main` at
619f94d04 (release 2.47.0). Owner answers 22.11 on the comparison page `private/planning/settings_seg_look_2026-11-20.html`:

- Q5: the key height of the module look on a desktop is **28 px** (not 34).
- Q6: the **module look on all 14 pages** (design, brand logos, nav size, home screen, plan view, timeline colours, buildings and
  mapping, multimedia, updates, schedules, automations, quiet windows, presence, building presence). The module look = each module
  keeps its own segmented key; the unified settings key of 2.45.0 is never forced on anything.

## 1. The merge of main (2.47.0)

No textual conflict. The earlier trial merge reported a conflict with `CR-HOME-V3-SEGMENTS-2470`; at 619f94d04 that row is in main and
git resolved `system-presence.ts` (CR-CMP2-TABLES-REST-2470 moved the devices list to `sw-table` beside this row's removed knobs),
`shell/sw-home-personal.ts` (CR-CMP2-TABS-2460 moved the summary tiles to `sw-chip-choice`) and `tests/unit-sw-segmented.spec.ts`
on its own. The semantic side - the hosts main added on `sw-segmented` that might have relied on the old defaults (home v3 / home p3 /
home widgets, electricity / water / generator settings, schedules, automations, scenarios, tickets, investigate, media remote) - is
checked by the crawl in section 3.

## 2. The change on top of the held row

`screens/system-plan-view.ts` and `screens/system-update.ts` pinned their own 44 px key on a desktop (`--sw-seg-h: 44px`, plan view
through `var(--sw-touch-desktop, 44px)`). Q5 + Q6 put every one of the 14 pages on the 28 px module key on a desktop, so both pins
went: 28 px on a desktop, 44 px under a finger on a phone (the component's phone rule; plan view keeps its `pointer: coarse` 44 px rule,
which also covers a touch tablet).

## 3. Verification

All on the workstation (Windows) unless marked runner; real runs, demo fixtures, no device.

- `npx tsc --noEmit -p tsconfig.json` on the branch: exit 0.
- ESLint on the 24 source files this branch changes against main: 0 problems.
- Unit (`playwright.unit.config.ts`), the 81 unit specs that read a touched file or `sw-segmented` / presence / nav size / update /
  plan view: **834 passed, 0 failed**.
- Computed-style crawl (local helper, not committed) of **392 demo routes**, desktop 1440, classic light, on two production builds served
  side by side - main 619f94d04 and this branch: 717 / 720 visible `sw-segmented` hosts, 0 load errors.
  - Inside the 14 pages (11 roots the demo reaches without server data): **every** key changed to the module look - 28 px, 13 px,
    regular / semibold, pill keys and track, the chosen key in the text ink (199 controls; timeline colours keep `size="sm"`, 28 px).
    None stayed on the old key.
  - Outside the 14 pages exactly **two** hosts changed, both of which drew the plain 2.45.0 settings default (no knobs of their own):
    the schedule editor's view switch (`schedule-editor`, "תצוגה") and the tickets contacts' vendor-type switch
    (`tickets-handlers > tickets-contacts`, "סוג ספק"). Every host main added in 2.46.0 / 2.47.0 (home v3 / p3 / widgets, the
    electricity / water / generator / temperature / notices / maintenance / calendars modules, WisKey, glass hosts, dialogs, investigate,
    media) is unchanged - so the 2.47.0 merge brought no host that relied on the old defaults.
- Owner comparison page (local, not published): `private/planning/seg_module_look_2480_compare_2026-11-23.html` (+ the sibling folder,
  376 shots, tools in its `tools/`): the 14 pages, before (2.47.0) / after, desktop 1440 + phone 390 (Pixel 7, touch), light, classic
  and domus, the measured key under each shot and a summary table. The multimedia, update and building-presence keys appear only with
  data: multimedia is shot after opening the first screen's editor, update and building presence against a mocked backend (the shapes of
  `evidence-system-update` / `evidence-presence-2280-layout`). Measured key height after: **28 px on a desktop on all 14 pages, 44 px on
  the phone on 13** (timeline colours: the compact 28 px key, a 44 px target around it). Before: 34 (design, logos, mapping, multimedia,
  schedules, automations, quiet windows), 36 (nav size), 32 (home screen), 44 (plan view, update), 28 (timeline colours, presence,
  building presence; phone 40-44).
- Runner, own folder `~/work/seg2480`, under `flock ~/.smplwise-tests.lock`, `nice -n 19`, `--workers=2`, at 581478e0b: preview build +
  every spec file with a Linux baseline (54 files) WITHOUT `-u`: 821 passed, 6 failed, 520 skipped (no Linux baseline / one-project
  specs), 17.0 min. The 6 failures are all `pixel-sw-segmented` (the component specimen, light + dark x desktop / tablet / mobile) - the
  intended look change, reviewed image by image. No other baseline moved (the WisKey / intercom files pass 1 of the held row saw move do
  not move at this head).
- Runner pass 2 (baseline refresh of `pixel-sw-segmented` only): queued behind other jobs on the shared lock at the time of this commit; see the next commit.

## NOT_RUN

- Crawl on a phone / tablet viewport and in dark (the pixel files cover those projects for the specimen; the comparison page is light
  only, as asked).
- Backend tests (no backend change).
- Entry check (`branch_check.sh`) and trial merges with the 2.48.0 rows other than `pilot/CMP2-POLISH-2480`.

## Open points

1. Two screens outside the 14 pages took the module look because they drew the plain settings default: the schedule editor's view
   switch and the tickets vendor-type switch. Recommendation: keep (no module look of their own; the owner's rule is "never force the
   unified settings key").
2. A long row that wraps to two lines (update interval on a phone, the 5-120 minutes specimen row on a phone) draws a large pill-shaped
   track: the module look's pill radius on a wrapped track. Before, the slight radius made it a rounded box. Recommendation: a later
   row - a wrapped track takes `--sw-r-lg`; not changed here.
3. Timeline colours keep the compact `size="sm"` key (28 px on a phone too, a 44 px target around it). Recommendation: keep.

## Overlap with other 2.48.0 rows

`pilot/CMP2-POLISH-2480` (generator checkboxes, event-centre chips, readiness badges, key height) also edits
`tests/unit-sw-segmented.spec.ts` (it appends a `sw-chip-choice` block and one adopter line; this row changed the look contract block
in the held commit). Different hunks: `git merge-tree --write-tree` of this branch with `pilot/CMP2-POLISH-2480` at 6712f9c1d is clean (no conflict). It also edits `generator/gen-routing.ts`
and `screens/investigate-events.ts` (chip rows, not the `sw-segmented` keys).

## Rollback

Revert the two commits of this row on top of the merge (or do not merge the branch): the held row's own rollback is in its note.
