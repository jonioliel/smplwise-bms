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

## Tests

See the section at the end (filled in from the real runs).

## Baselines

Expected to move (the lead refreshes them on the train unless a runner window opened, see NOT_RUN):
- `visual-matrix` `settings-diagnostics-ready-{light,dark}-mobile`: the General tab's design card save row is the sticky phone row
  (`.foot.sticky`). Desktop and tablet should not change (the sticky rules are phone-only). 2.34.2 just re-took all six.
- No pixel-spec baseline covers storage, readiness, update, wizard, audit or the alarm settings page (only the security-alarm *screen*, WP9,
  and the WisKey access specs, WP8, have baselines).
