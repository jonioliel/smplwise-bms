# HAND-SWITCH-HOME-EDIT-2500 - the home editor's widget on / off choices are the compact switch

Follow-up of HAND-SWITCH-HOME-PERSONAL-2500 (its open question: the installation's home editor still drew check boxes, so the editor
and the personal list looked different). Branch `pilot/HAND-SWITCH-HOME-EDIT-2500`, cut from `origin/pilot/HAND-SWITCH-HOME-PERSONAL-2500`
(ca28a964d), which already carries main 2.48.0 (the shared `sw-toggle size="sm"`, `in-label`, `toggled()` of HAND-SWITCH-2480).

## What changed

`frontend/src/screens/home-edit-panel.ts` (the installation's home editor, `#/devices/building?edit=1`, the edit drawer's home tab):
the two on / off choices of each widget row are now the same switch the personal list uses:

```
<label class="check"><sw-toggle size="sm" labelHidden in-label label=${tr('הצג {name}', …)} data-home-toggle=${id}
  .checked=${w.on} ?disabled=${this.busy} @change=${(e) => this.setWidget(id, { on: toggled(e) })}></sw-toggle><span class="w-name">…</span></label>

<label class="check"><sw-toggle size="sm" labelHidden in-label label=${tr('הצג בנייד: {name}', …)} data-home-phone-on=${id}
  .checked=${widgetOn(w, true)} ?disabled=${this.busy} @change=${(e) => this.setPhoneOn(id, toggled(e))}></sw-toggle>${tr('הצג')}</label>
```

- The compact 32 x 18 track, `role="switch"` with `aria-checked`; the accessible name is the old check box's `aria-label`
  (same translation keys, nothing new to translate); a press on the visible text (the widget's name / "הצג") flips it (in-label);
  the test hooks stay on the host (`checked` reflected). One CSS rule keeps the track from shrinking (`.check sw-toggle { flex: none }`).
- **Disabled while saving**: the panel edits a draft and had no saving state of its own; the layout bar's "שמור" runs in the screen's
  layout controller. The panel gets a `busy` property and `screens/devices-building.ts` passes `?busy=${this.lay.busy}` (the
  controller re-renders the screen when `busy` changes). Only the two switches use it; the panel's other controls are unchanged.
- The visible row (name, size choice, order arrows, settings key, the phone line with its size select) is unchanged.

Not changed, on purpose (HAND-SWITCH-2480 rule: pick-lists stay check boxes): the clock's "with seconds" / "Hebrew date", the weather
field list, the elevators and temperature "include" lists and the quick-action list. `screens/home-edit-bv1.ts` (agenda / launcher
bodies) untouched. `scripts/design_ratchet_baseline.json` not lowered (hand-switch 160 -> 158; lowering is optional and touches a file
every branch edits).

## Tests

Spec updated: `tests/evidence-home-screen.spec.ts` (the phone edit-mode test) clicks the "הצג בנייד" switch of the alarm widget and
reads its `checked` attribute instead of `uncheck()`. No other spec touched `data-home-toggle` / `data-home-phone-on`.

New: `tests/unit-hand-switch-home-edit-2500.spec.ts` (node-only, source checks) and `tests/hand-switch-home-edit-2500-shots.spec.ts`
(SW_SHOTS=1 only: before / after captures over the BV1 mocks, desktop 1440x900 + phone 390x844, light + dark, the full page and the
drawer alone).

PC (Windows, node-only unit specs, one file at a time):

- `tests/unit-hand-switch-home-edit-2500.spec.ts` (new): 4 passed.
- `unit-home-edit-drawer` 8 passed, `unit-dark-polish-beds` 7 passed, `unit-a11y-polished-lint` 6 passed, `unit-sw-segmented` 22 passed,
  `unit-hand-switch-home-personal-2500` 3 passed, `unit-home-lazy-2440` 6 passed.
- `scripts/design_ratchet.py`: hand-switch 158 (baseline 161, ok). RESULT UP for color-literal (1984 -> 1985) and px-literal
  (25462 -> 25513): the same totals as on the base branch (HAND-SWITCH-HOME-PERSONAL-2500 recorded the same two numbers), from the
  base branches' home files measured against the 2.48.0 baseline, not from this task (it adds no px or colour literal).

Runner (slot B, job `~/work/hshedit_job.sh`: tsc, eslint on the changed files, the unit specs above, ratchet, build,
`evidence-home-edit-drawer-2351` over the BV1 mocks (desktop), `evidence-home-screen --grep "phone: the edit mode"` against the devices
fixture backend (mobile), `--workers=2`, before (ca28a964d) / after captures into `~/work/hshedit-out/shots`): queued 24.11 08:17 UTC
behind the 2.49.0 release gate (it ended `pass` ~09:00 UTC) and 14-23 other slot-B jobs; at 11:18 UTC (3 hours) it had not started, so
every runner item is NOT_RUN. The job stays queued and writes `~/work/hshedit_job.log` and `~/work/hshedit-out/` when it runs (it removes
its own worktree at the end).

- tsc: NOT_RUN
- eslint: NOT_RUN
- unit specs on the runner: NOT_RUN
- build: NOT_RUN
- browser specs (`evidence-home-edit-drawer-2351`, `evidence-home-screen` phone edit-mode test): NOT_RUN
- before / after captures (`tests/hand-switch-home-edit-2500-shots.spec.ts`, desktop + phone, light + dark) and the compare page
  `private/planning/hand_switch_home_edit_compare_2026-11-24.html`: NOT_RUN (no shots, so no page)
