# AUDIT30-H2-WISKEY: the rest of the WisKey screens on the shared controls (audit round 30, branch H follow-up)

Branch `pilot/AUDIT30-H2-WISKEY`, cut from `pilot/AUDIT30-H-WISKEY` @ `ff42df2a7` (which stays queued as it is). Lead's answers to the
two questions of branch H: Q1 = ב (convert the remaining native controls and local KPI tiles now), Q2 = ב (the attention count badge
is filled like "מצלצל"). Same rules as branch H: files `frontend/src/screens/wiskey-*.ts` only, tokens only, no page scroll, frontend
only (no WisKey backend, door, intercom or go2rtc work).

## 1. Changes

| Finding | Screen (file) | Before | After |
|---|---|---|---|
| #16 | access diagnostics (`wiskey-access-diag.ts`) | 3 native `<select>` (door, review cadence, audit station) inside `<label>` | `<sw-dropdown block>` in a `div.f` (label text above, same grid) |
| #7 | access diagnostics | 16 local `class="kpi"` tiles in four rows (comparison summary, data quality, lifecycle, station audit) | compact `<sw-kpi>` (60 px, icon, tabular value); the audit row tones `matched` live and `drift` amber when non-zero; data quality "people" amber when non-zero; grid columns `minmax(var(--sw-kpi-compact-col-min, 168px), 1fr)`; the local `.kpi` CSS is gone |
| #16 | bulk people (`wiskey-bulk-people.ts`) | 6 native `<select>`, three of them `multiple` list boxes | `<sw-dropdown>`; the three multi-choice lists use its `multiple` mode (picked names on the chip, "n מתוך N", נקה / סיום) |
| #16 | card capture (`wiskey-card-capture.ts`) | 2 (station, reader) | `<sw-dropdown>`; "בחר תחנה" is the placeholder instead of a disabled option |
| #16 | events export (`wiskey-events-export.ts`) | 1 (station) | `<sw-dropdown>` |
| #16 | entry center announcement dialog (`wiskey-overview.ts`) | 2 (engine, language) | `<sw-dropdown>`; "pick an engine" is the placeholder |
| #12 | entry center (`wiskey-overview.ts`) | "דורש תשומת לב" count badge `kind="stale"`: wash + dashed edge | `kind="stale" filled`: solid amber-ink field, solid edge (as the ringing badge in branch H) |
| #16 | person actions (`wiskey-person-actions.ts`) | 1 (temporary cancel reason) | `<sw-dropdown>` |
| #16 | person editor (`wiskey-person-editor.ts`) | 4 (category, timing mode, timing enforcement, validity) | `<sw-dropdown>` |
| #16 | profiles (`wiskey-profiles.ts`) | 3 (field type, depends on, depends value) | `<sw-dropdown>` |
| #16 | relay map (`wiskey-relay-map.ts`) | 1 per relay row | `<sw-dropdown>` (`data-relay-map-pick`) |
| #16 | station permissions (`wiskey-station-permissions.ts`) | 1 (add a station) | `<sw-dropdown>` |

`sw-dropdown` has no `disabled` state (it is branch B's file); where a select was disabled (card capture while starting / without
readers, export while busy, relay map when not editable) the dropdown is `inert` + `aria-disabled="true"` and fades with
`opacity: var(--sw-disabled-opacity)`. Recorded as an "after B" item: a real `disabled` property on `sw-dropdown`.

Source counts over `frontend/src/screens/wiskey-*.ts` (comments excluded): native `<select>` **24 → 0** (10 screens),
`class="kpi"` **13 → 0** (16 rendered tiles). Rendered: the access diagnostics' quality tiles are 60 px (were the local 10 px-padded
blocks).

## 2. Tests

New `frontend/tests/layout-audit30h2-wiskey.spec.ts`: a source guard (no native `<select>`, no `class="kpi"` in any WisKey screen),
the filled attention badge (solid edge), the access diagnostics' compact tiles and dropdowns (no native control in the rendered
screen), and a "pixel-stable" baseline of the attention card. New helper `frontend/tests/helpers/wk-choose.ts` (`pickOption`,
`ddValue`); the specs that drove these selects now drive the dropdowns: evidence-access-events, evidence-stationperm-295,
evidence-tts-default-2400, evidence-wiskey-access-diag, evidence-wiskey-actions, evidence-wiskey-capture, evidence-wiskey-editor,
evidence-wiskey-people-writes, evidence-wiskey-profiles, layout-wiskey-people-writes, pixel-wiskey-access-diag,
pixel-wiskey-people-writes.

| Where | Command | Outcome |
|---|---|---|
| workstation | `npx tsc --noEmit -p .` | exit 0 |
| workstation | `npx vite build` | exit 0 |
| workstation, branch preview | `npx playwright test tests/layout-audit30h2-wiskey.spec.ts tests/layout-audit30h-wiskey.spec.ts tests/evidence-wiskey-access-diag.spec.ts tests/evidence-wiskey-profiles.spec.ts tests/evidence-tts-default-2400.spec.ts tests/evidence-stationperm-295.spec.ts tests/evidence-access-events.spec.ts tests/evidence-wiskey-people-writes.spec.ts tests/layout-wiskey-people-writes.spec.ts --project=desktop --project=mobile --workers=1` | 160 passed, 60 skipped, 0 failed (pixel compares skipped: no win32 baselines) |
| runner, `001c36225`, load < 30 | `run_smart.py preview pilot/AUDIT30-H2-WISKEY tests/layout-audit30h2-wiskey.spec.ts tests/layout-audit30h-wiskey.spec.ts tests/pixel-wiskey-access-diag.spec.ts tests/pixel-wiskey-people-writes.spec.ts tests/pixel-round4-leftovers-2390.spec.ts --project=desktop --project=mobile -g pixel-stable -u --workers=1 --machine runner` | 42 passed, 4 skipped; 22 baselines written (1 new) |
| runner | the same without `-u` | queued behind the load gate at commit time; the entry check is the verdict |

The local run rewrote evidence screenshots under `docs/design/evidence/` (branch J's folder); they were reverted, not committed.

## 3. Known limits

- `components/wk-*.ts` (announce dialog, door tech, schedule library, triage panel) still have native `<select>`; they are not in
  branch H's files (`components/**` is shared) and need an owner.
- The fixture-backend specs (evidence-wiskey-actions, -editor, -capture: `SW_LIVE=1 SW_WISKEY_FIXTURE=1`) were updated but NOT_RUN.

## 4. Rollback

Revert the merge commit. No data, settings or migration is involved.
