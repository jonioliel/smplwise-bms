# SYS-AUDIT-QUICKFIX-2437 - design audit round 30: the fixes that need no owner decision

Branch `pilot/SYS-AUDIT-QUICKFIX-2437`, cut from `origin/main` @ `ab7894837` (2.43.1). No version bump, no CHANGELOG entry, no
migration, no backend change. Frontend only; nothing in `frontend/src/home/**` touched; no layout or scroll rule changed (the
1366x768 no-scroll work runs on its own branch). Source of the findings: `private/design-system-2026-10-27/round30/system-audit/`
(`index.html`, `FIXES.md`, `data/measure.json`). The gated items of that audit (owner questions Q1-Q14) are NOT in this branch.

## What changed

| Audit item | Finding | File | Change |
|---|---|---|---|
| C1 | #3 dark: the selected tab of the service-calls settings and the selected gender segment read white on white (1:1, measured `rgb(245,245,247)` on `rgb(245,245,247)`) | `frontend/src/screens/system-tickets.ts` | `--sw-seg-on-fg: var(--mm-seg-fg-on, var(--dv-text))`: the label on the thumb is the thumb's own ink, as on every other glass segment (POLISH2-295). Light: `--mm-seg-fg-on` is `--dv-text`, so light is unchanged. |
| I1 | #3 notification settings, severity pills | `frontend/src/screens/system-notifications.ts` | **No change** - see "Contradiction recorded" below. |
| B1 | #12 filled badges: "סגור" 2.54:1, "קריטי" 3.76:1 light, "מידע" 2.51:1 dark | `frontend/src/components/sw-badge.ts` | `:host([filled])` and each filled kind: the field is the state's contrast-proven ink (`--sw-text-2`, `--sw-danger-text`, `--sw-offline-text`, `--sw-accent-text`, `--sw-stale-text`) and the label is `--sw-surface-solid` (the panel colour): the `-text` / panel pair inverted. The filled live badge keeps `--sw-success` + `--sw-on-success` (owner round 22, SKIN-QA-FOLLOWUP-2404 Q5 = a). Filled unknown is unchanged (soft field, dashed edge). |
| G5 (token part only) | #12 the incident screen's local `span.badge` ("נסגר" 2.54:1, "פעיל" 3.76:1) | `frontend/src/screens/investigate-incidents.ts` | the same pair: `background: var(--c-text, var(--sw-text-2)); color: var(--sw-surface-solid)`. Converting it to `<sw-badge>` and `sw-page` (rest of G5) stays with branch G. |
| G2 (ungated part) | #15 "Capability matrix" on camera health | `frontend/src/screens/system-devices.ts` | demo subtitle "Capability matrix לפי ראיות" -> "יכולות לפי בדיקה בפועל" |
| G2 (ungated part) | #15 "HA" in the events centre (demo source column, drawer) | `frontend/src/screens/investigate-events.ts` | `DEMO_SOURCE_WORDS`: `HA` -> "מערכת הבית", `NVR` -> "מקליט" (the mapping FIXES.md names), in the table's time column and the event drawer. The raw key stays in the fixture. |
| A1 | #2 twelve glass screens drew 22 % of their text in the OS face | `frontend/src/styles/devices-themes.ts`, `frontend/src/components/media-remote-css.ts` | `--dv-font: var(--sw-font)` and `--mr-font: var(--sw-font)` (the product stack, Heebo first). The bridge line `--sw-font: var(--dv-font)` on the same host is removed: with both it would be a custom-property cycle (both invalid). |

Not done here (need an owner answer or belong to another branch): the remaining G2 strings ("Asia/Jerusalem", "Presets", "Triggers"
- GATE Q10), `i18n/he.ts` (no string of these items lives there), A2 (glass colour bridge), every Blue Wash / chip change (GATE Q3).

### Contradiction recorded (I1, finding 3 on the notification settings)

Measured on this build in dark (`tests/evidence-sys-audit-quickfix-2437.spec.ts`, and before the change on the same code): the selected
severity pill is a light thumb with dark ink, label 15.6:1, key 11.3:1 from its track - readable, not 1:1. The audit's word for it is
"solid white in dark" (a look, not a contrast failure), and FIXES I1 asks for the Blue Wash pair. A soft blue wash on the dark glass
track would fall under the owner-approved DARK-SEG-ALL-2380 rule (the chosen key at least 3:1 from its track), and choosing the selected
look is owner question Q3. So the pill is left as it is and guarded by the new spec; the lead/owner decides with Q3.

## Tests

New:
- `frontend/tests/unit-badge-tab-contrast-2437.spec.ts` (Node): reads the filled pairs from `sw-badge.ts` itself and resolves them
  through every skin's token table, light and dark (7 skins x 2 schemes x 10 kinds), threshold 4.5:1; plus a source guard (no white
  ink on a bare state colour; the owner's live pair kept). **Fails on the old file** (checked by restoring `origin/main`'s
  `sw-badge.ts`): classic light offline 2.54, error 3.76; classic dark neutral 2.51 - the audit's numbers exactly. New: lowest 5.0+.
- `frontend/tests/evidence-sys-audit-quickfix-2437.spec.ts` (browser, demo fixtures, computed styles composited through every
  ancestor and shadow host): dark selected tab / segments of `#/system/tickets` (label >= 4.5:1, key >= 3:1 from its track), dark
  severity pills of `#/system/notifications`, filled badges on events / cases / incidents in light and dark, no "HA" / "Capability" in
  the text of six operator screens, the product face (Heebo, no OS stack) on four glass screens. Screenshots in
  `docs/design/evidence/SYS-AUDIT-QUICKFIX-2437/`.

Run (workstation, Windows, `vite preview` of this branch's build on port 4391, `SW_BASE_URL=http://127.0.0.1:4391/`):

| Command | Result |
|---|---|
| `npm run build` (tsc --noEmit + vite build) | PASS |
| `npx playwright test tests/unit-badge-tab-contrast-2437.spec.ts` on the OLD `sw-badge.ts` | FAIL as intended (2.54 / 3.76 / 2.51) |
| `npx playwright test tests/evidence-sys-audit-quickfix-2437.spec.ts tests/unit-badge-tab-contrast-2437.spec.ts --project=desktop` before the system-tickets / copy fixes | the four intended failures: tickets tab "כללי" 1.00, ten segments 1.00, "HA" on events, "Capability matrix" on health (the two unit tests also failed then, on a parser bug in the test, since fixed) |
| the same, after | 21 passed |
| `unit-dark-polish-beds`, `unit-design-tokens`, `unit-palettes`, `unit-incidents-nav`, `unit-skinfound-297`, `unit-muted-contrast`, `unit-skin-qa-followup-2404`, `evidence-dark-seg-all-2380`, `evidence-cases`, `layout-page-background`, `layout-incidents` (desktop) | 84 passed, 1 skipped (a pre-existing skip) + 6 passed |

Measured after (dark): tickets tabs and segments label 15.63, track 13.11; notification pills label 15.63, track 11.26. Filled badges:
light 5.02-7.53, dark 7.62-9.24; incidents "נסגר" 6.84, "פעיל" 6.47.

Not run locally: the mobile / tablet projects of the new evidence spec, the full suite (the runner entry check runs the selection).

## Pixel baselines

Refreshed on the runner from this branch only (`private/runner/run_smart.py preview pilot/SYS-AUDIT-QUICKFIX-2437 <spec> -u
--workers=1 --machine runner`):
- the 33 pixel specs that have linux baselines (all projects): 473 passed, 364 skipped (structural smokes / other skins), 1 baseline
  rewritten (`pixel-wiskey-stations` classic settings 1440 desktop);
- `tests/visual-matrix.spec.ts`: 75 passed, 18 rewritten (`devices-schedules`, `multimedia-screens`, `settings-notifications`, light and
  dark, desktop / tablet / mobile - the font).
Proof run without `-u` on the runner @ `e29654e2b` (`tests/visual-matrix.spec.ts tests/pixel-wiskey-stations.spec.ts --workers=1`): 92 passed, 10 skipped, rc 0. The other 32 pixel specs matched their committed baselines in the `-u` run (nothing rewritten), so they were not run a second time.

## Known limits

- The badge colours move on every screen that draws `sw-badge filled` (events, cases, reviews, tickets lists ...): darker fields in
  light, lighter fields with dark labels in dark. That is the fix, not a side effect.
- Heebo is slightly wider than Segoe UI: re-checked by the refreshed baselines only, not by a 375 px truncation sweep of the 12 screens.

## Rollback

Revert the merge commit. No data, setting or migration is involved.
