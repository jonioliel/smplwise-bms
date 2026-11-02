# POLISH4-WP7-SETSYS-2370: settings (system) polish, round 4

Branch `pilot/POLISH4-WP7-SETSYS-2370`, cut from `origin/release/2360-train` @ 44b8383c2. No version bump, no merge, no tag.
Package scope: the general host tabs (media, map, bridge, access switches, remote, health, backup, support), the security shell and its
manage / public / WisKey / incident pages, audit, storage, update, wizard, readiness. Frozen structure: tabs, titles, control order and
data attributes are unchanged; every edit is a style, a token, a state or a copy line.

## Defects

| # | Before | After |
|---|---|---|
| D14 | `font-size: 32px` (storage KPI), inline `font-size:11px` (storage signing key), `font-size: 40px` (readiness ring) | `--sw-fs-4xl` (32 px: the KPI is pixel-identical; the ring digits go 40 to 32 px, still inside the 120 px ring), `--sw-fs-xs`. The storage forecast label box `fill="#fff"` is `var(--sw-surface)`. The SVG chart's own `font-size` attributes are chart units, left as they are. |
| D15 | `system-diagnostics.ts`: the save row + saved / error line copied six times; 9 rgba + 6 hex; 2 px radii; one `@media` for the whole file; the style swatches had no press / hover / focus | One `renderSaveRow()` (class `foot sticky`, so the save key stays in view on a phone while a long tab scrolls under it: owner Q7). The `data-save-*` hooks of the specs are kept (static attribute). The saved / error line now shows only on the tab that produced it (media and map used to show another tab's message). The two style previews read tokens only (`--sw-surface*`, `--sw-border*`, `color-mix` of `--sw-accent` / `--sw-warning`), so they follow the light / dark scheme. Phone block: backup rows stack, preview tiles share the width, swatches take a line each, the usage bar fills its row. Swatches: press on pointer-down, hover only on `(hover:hover) and (pointer:fine)`, focus ring, reduced motion. |
| D15+ | bridge, health and backup tabs showed a bare "טוען…" line; a failed read left "טוען…" for ever; an empty backup list was a muted line | `sw-state-panel` (compact): loading, error with "נסו שוב" retry (new `loadFailed` state), empty with an icon and a hint. |
| D16 | audit and alarm settings: no phone layout; `alarm.view / arm / disarm / bypass` in a card subheading; the panel card subheading was `integration · entity_id`; the saved / error line was bare text (`--sw-danger` on a card, below contrast) | Alarm: shared phone block (rows stack, controls full width, the code field and its keys share one line, the pairing table keeps a 520 px min width inside its own scroller); message pills on `--sw-*-soft` / `-text` tokens; the subheading names the permissions in Hebrew ("צפייה, דריכה, נטרול ועקיפה"); the entity id moved into the "שילוב" row. Audit: 2-column phone filters (search, date and refresh take a line), footer wraps; the subheading lists Hebrew column names instead of `actor, request_id, permission_revision`; the blocked-action colour is `--sw-danger-text`. |
| Q10 | "Arx writes to the NVR only through the approved actions, with a sensitive permission" | The sentence lives in `frontend/src/screens/system-setup.ts:543` (the "איפה מגדירים" card of the setup screen, hint line), **outside this package**. It already reads "Arx כותב ל־NVR רק דרך הפעולות המאושרות בעמוד הזה, ורק עם הרשאה רגישה". No copy of it in this package's files. Nothing to change here. |

Other refinements inside the package files (same rules): incident settings key (`incidents/settings-form.ts`) reads the `sw-toggle` tokens (track, thumb, spring, shadow), presses in, has a focus ring and a 44 px hit area on a coarse phone, the `#fff` thumb is gone, the foot wraps; wizard `border-radius: 2px / 999px` to `--sw-r-pill`, link hover gated to a fine pointer; update `#fff` check mark is `--sw-text-inverse`, disabled opacity is the token; off-box backup (`components/sw-offbox-backup.ts`): `--sw-radius-sm, 6px` and `--sw-space-4, 16px` fallbacks to the real tokens, semibold token, focus ring, phone wrapping, 44 px fields on a coarse pointer; WisKey diagnostics: error pill, phone head and facts; public-surface settings: key press, token focus ring, one-column fields on a phone; NVR status page: status values are message pills (green only for status).

## Files

`frontend/src/screens/`: system-diagnostics, system-alarm, system-audit, system-storage, system-update, system-wizard, system-readiness,
system-security, system-security-public, system-wiskey-diagnostics; `frontend/src/incidents/settings-form.ts`;
`frontend/src/components/sw-offbox-backup.ts`. One test file edit: `frontend/tests/unit-token-lint.spec.ts` (two `ALLOW_HEX` entries,
`system-diagnostics.ts` and `system-update.ts`, went stale because their literals are gone; the spec requires removing them).
Looked at and left alone (already tokenised, phone-ready, states in place): system-security-wiskey, system-video-conn-test.

## Tests (real totals)

- `tsc --noEmit` (frontend, workstation): 0 errors, run after the last source edit.
- Node unit specs (`playwright.unit.config.ts --workers=1`): unit-readiness-96 + unit-backup-offbox + unit-backup-offbox-restore: 21 passed;
  unit-token-lint (after dropping the two stale `ALLOW_HEX` entries): 7 passed; unit-a11y-polished-lint, unit-designtokens-297, unit-menu-lint,
  unit-backup-password, unit-entity-id-sweep, unit-dark-polish-beds: 41 passed (47 + 1 of the 48 first run was the stale-ALLOW_HEX failure fixed above).
- Runner, `preview` job, branch @ 706fb0601, desktop project, `--workers=1`: evidence-backup, evidence-health, evidence-storage,
  evidence-readiness-96, evidence-alarm, evidence-system-update (+ -apply), evidence-security-polish, evidence-setup-wizard:
  **124 passed, 17 skipped, 0 failed** (5.1 min). The skipped ones are the fixture-backend cases (they need a live fixture backend).
- Runner, `visual-matrix -g settings-diagnostics` (6 pictures: desktop / tablet / mobile x light / dark): on the train tip the six fail
  at ~0.01 ratio, because the train does not contain 2.34.2 yet and those baselines were re-taken in 2.34.2 (same failure with no change of
  mine). On `probe/POLISH4-WP7-with2342` (this branch + `v2.34.2`, only conflict the generated `contracts/API_INVENTORY.md`, train side
  kept) the six **pass (6 of 6)**: no baseline refresh is needed for this package.
- Runner, tablet + mobile projects of evidence-backup, -health, -storage, -readiness-96, -alarm, -security-polish: **43 passed, 58 skipped,
  1 failed**. The one failure, `evidence-readiness-96` "the hand-over is recorded below the advice" on **mobile**
  (`[data-below-advice]` hidden: on a phone the readiness page opens on the "checks" pane and the hand-over sits in another pane), fails
  identically on the unchanged train tip `release/2360-train` @ 44b8383c2 (re-run there: 1 failed, same line). Not caused by this package (its only
  readiness change is the ring digit size); the spec needs to open the pane first on a phone (spec fix, outside this package).

## NOT_RUN

- The `fixture` specs of these screens (live fixture backend): not run here.
- Light / dark, RTL and the 1920 / 1440 / 1180 / 1024 / 390 look of each changed screen was not captured as pictures (no evidence-capture
  run: workstation low on memory, runner time shared). The layout specs above check "no page scroll" at 1024 / 768 / 390 / 320 for readiness.
- The phone sticky save row and the phone alarm / audit layouts were not seen in a picture; they are covered by CSS only.

## Baselines

None expected to move: the six `visual-matrix` `settings-diagnostics` pictures pass unchanged against the 2.34.2 baselines (the matrix signs in
without the edit right, so the General tab shows no save row, and its pictures do not contain the previews). No pixel-spec baseline covers
storage, readiness, update, wizard, audit or the alarm settings page (only the security-alarm *screen*, WP9, and the WisKey access specs, WP8,
have baselines).
