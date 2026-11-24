# HAND-SWITCH-HOME-PERSONAL-2500 - the personal home section's widget on / off is the compact switch

Task card: HAND-SWITCH-HOME-PERSONAL-2490 (registered 22.11 from the owner's answers; owner Q32 "yes, after the home panel edit").
Branch `pilot/HAND-SWITCH-HOME-PERSONAL-2500`, based on `origin/pilot/HOME-NEXT-2500` (87dbf121a, the latest home panel edit,
stacked on HOME-WALL-NIGHT-2500).

## Why a merge of main first

The base sits on 2.47.0 (619f94d04). The switch this task reuses - `sw-toggle size="sm"`, the `in-label` press on the enclosing label and
`toggled()` - arrived with HAND-SWITCH-2480 in 2.48.0. `main` d6f09395e (release 2.48.0) is merged into the branch first (4f5c54fe3,
no conflicts), as HAND-SWITCH-2480 itself merged main (de7b38d16).

## What changed

`frontend/src/shell/sw-home-personal.ts` ("החשבון שלי › המסך שלי"): each widget row's on / off check box is now

```
<label class="check"><sw-toggle size="sm" labelHidden in-label label=${WIDGET_NAME[id]} data-home-personal-on=${id}
  .checked=${on} ?disabled=${this.busy} @change=${(e) => this.setOn(id, toggled(e))}></sw-toggle><span class="lbl">…</span></label>
```

the same pattern HAND-SWITCH-2480 used on the other screens: the compact 32 x 18 track, `role="switch"` with `aria-checked` and the
widget's name as its accessible name, Space / Enter on the switch, a press on the widget's name flips it (in-label), disabled while a
save is on its way, the test hook on the host (`checked` reflected). The visible name, the row, the order arrows and the size choice are
unchanged; one CSS rule keeps the track from shrinking (`.check sw-toggle { flex: none }`).

Not changed, on purpose:

- **The elevators "include" list** inside the elevators widget block stays check boxes: it is a chooser (tick the elevators to show),
  the kind HAND-SWITCH-2480 kept as check boxes (the installation's `elevator-settings` include list and the home editor's include
  lists stay check boxes too). Open question to the lead / owner below.
- **Other home cards and `screens/home-edit-panel.ts`** (the installation's home editor, whose widget list the personal list mirrors):
  out of this task's scope ("do not change other home cards"). The editor's per-widget "show" / "show on the phone" boxes are still
  check boxes, so the two lists now differ. Open question below.
- `scripts/design_ratchet_baseline.json` not lowered (hand-switch 161 -> 160 now; lowering is optional and would touch a file every
  branch edits).

## Tests

PC (Windows, node-only unit specs, one file at a time):

- `tests/unit-hand-switch-home-personal-2500.spec.ts` (new): 3 passed.
- `tests/unit-home-personal-first-read-2443.spec.ts` 13 passed, `unit-nav-labels-2436` 6 passed, `unit-perf-2490` 5 passed,
  `unit-fe-promises-2442` 12 passed, `unit-sw-tabs-2460` 13 passed.
- `scripts/design_ratchet.py`: hand-switch 160 (baseline 161, ok). The run's RESULT is UP for color-literal (1984 -> 1985) and px-literal
  (25462 -> 25513), the same with and without this change (checked with the change stashed): it comes from the base branches' home files
  (`home/home-wall-rest-styles.ts`, `home/sw-home-admin.ts`, `home/sw-home.ts`) measured against the 2.48.0 baseline, not from this task.

Spec updated: `tests/evidence-home-screen.spec.ts` (the personal screen test) clicks the switch and reads its `checked` attribute instead
of `uncheck()` on a check box.

Runner (slot B, job `~/work/hsphome_job.sh`: tsc, eslint, unit specs, ratchet, build, `evidence-ui-polish-2443` mocked,
`evidence-home-screen --grep personal` against the devices fixture backend, `--workers=2`, before / after captures into
`~/work/hsphome-out/shots`): queued 24.11 ~08:00 IL behind a running release gate and ~12 other slot-B jobs (runner memory ~3.4 GB
free); it had not started after 2 hours, so every runner item is NOT_RUN. The job stays queued and writes `~/work/hsphome_job.log`
and `~/work/hsphome-out/` when it runs (it removes its own worktree at the end).

- tsc: NOT_RUN
- eslint: NOT_RUN
- unit specs on the runner: NOT_RUN
- build: NOT_RUN
- browser specs (`evidence-ui-polish-2443`, `evidence-home-screen` personal tests): NOT_RUN
- before / after captures (`tests/hand-switch-home-personal-2500-shots.spec.ts`, desktop + phone, light + dark) and the compare page
  `private/planning/hand_switch_home_personal_compare_2026-11-24.html`: NOT_RUN
