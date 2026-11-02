# POLISH4-WP2 LIVE-INV — live and investigation screens (polish round 4, release 2.37.0)

Branch `pilot/POLISH4-WP2-LIVEINV-2370`, from `origin/release/2360-train` (see "Base" below). No version bump, no backend change, no
shared component or design-token change (WP1 owns those). Survey: `private/planning/POLISH_ROUND4_SURVEY_2026-11-02.md`, package WP2.

Files (the package's exclusive files only): `frontend/src/screens/investigate-{rules,search,sync,playback,history-map,incidents,reviews}.ts`,
`investigate-r5-css.ts`, `live-{camera,views,overview,wall}.ts`, `kiosk-wall.ts`, `system-devices.ts`.

## Defects fixed

| # | Screen | Before | After |
|---|---|---|---|
| D7 | Rules / alerts (`#/investigate/rules`) | Rule and alert icon tiles were inline hex pairs (`#eaf0ff/#2f6bff`, `#fff4e0/#d97706`, `#f1f5f9/#64748b`): pastel tiles on the dark scheme. The demo "move" rule was green (`#16a34a`), a category in the status colour. No reduced-motion block for the row press. | Tiles take tokens: rule = `--sw-accent-soft/-text`; open alert = `--sw-warning-soft/-text`; handled alert = `--sw-offline-soft/-text`; demo kinds accent / neutral well (`--sw-surface-3` + `--sw-text-2`, "move") / warning / danger. No green. `prefers-reduced-motion` stops the row's transition and press scale. |
| D8 | Camera page, schedules card (`#/live/cameras/:id`) | Record-mode legend `#2f6bff/#16a34a/#f59e0b/#dc2626`: not skinned, not dark-aware, "תנועה" green. | `--sw-recorded` (continuous), `--sw-purple` (motion: a category, distinct from the event amber and the alarm red), `--sw-warning` (event), `--sw-danger` (alarm). Dark-aware through the tokens. |
| D9 | Saved views (`#/live/views`) | No `@media`: the columns / rows form stayed two `1fr` columns at 390, the action row (open, kiosk, edit, delete) ran past the card. `border-radius:3px` ×2. No press feedback. "משותפת" badge used the green status tone. | Phone (`max-width:767px`): the form stacks, the dialog form drops its 560 px minimum, the grid is one column, the action row wraps. Radii `--sw-r-2xs`. The open / kiosk links and the camera chips answer on pointer-down (skin press scale), still under reduced motion. "משותפת" takes the blue `recorded` badge. |
| D10 | AI search (`#/investigate/search`) | No loading state while a question runs; the error was a red text line with no retry; result rows had no hover, press or keyboard; one `@media`. | `sw-state-panel` loading ("מחפש…") while the request runs; errors as `sw-state-panel state=error` with "נסה שוב" (repeats the provider read or the last search). Rows: wash on a fine pointer only, pressed wash + skin press scale on pointer-down, `role=link` + Enter / Space, focus ring. Phone: the reference picture sits above its text. Reduced motion. |
| D10 | Sync (`#/investigate/playback/sync`) | The remove button's hover was ungated (stuck on a tablet after a tap); no reduced-motion block. | Hover under `(hover:hover) and (pointer:fine)`; press on pointer-down (scrim-strong + press scale); reduced motion. The shared R5 layer (`investigate-r5-css.ts`) also gains a reduced-motion block for its wells and keys (every investigation screen that appends it). |
| D11 | Camera health (`#/investigate/health`) | In API mode the demo rows flashed while the registry loaded and showed again after a failed read; no phone treatment (sw-table stacked nine captions per camera); the search field fixed at 200 px. | Loading skeleton (`sw-state-panel loading`) and an error panel with retry - never the demo rows. Phone: the row card keeps camera, state, picture check and last seen; FPS / rate / main stream move to the drawer (shown there on a phone). `focus-rows` on the table (keyboard). The search takes the full row under the chips on a phone. sw-table already gives the row hover (fine pointer) and press. |

## R5 drift check (1024 / 390 / dark)

Static scan of every WP2 file (hex / rgba literals, px radii, ungated `:hover`, reduced motion, press) plus rendered shots (below).
Fixed:

- Ungated hover moved under `(hover:hover) and (pointer:fine)`: live overview (`.hrow.link`, `.ev`; the second, ungated `surface-2`
  hover that stuck on touch is gone), live wall (layout buttons), kiosk (exit link), camera page (round buttons), incidents (`a.lnk`),
  reviews (drawer nav). The later "touch neutraliser" rules that reset a hover to the rest look stay (harmless).
- Token colours: history map time-bar hairline (`#cddcff` → recorded tone mix) and layer switch knob (`#fff` + rgba shadow →
  `--sw-toggle-thumb` + `--sw-shadow-1`); incidents capture chip text (`#1e2e47` → `--sw-on-lit`); live overview bar radius
  (`3px` → `--sw-r-pill`); camera page smart-rule chips (`8px` → `--sw-r-sm`).
- Video domain (fixed in both schemes, as the picture is) now reads the video tokens instead of literals: playback tile ink, phone
  control bar, stall veil and spinner, drift pill, HUD text, tile shade; camera page motion grid / mask / field / line overlays and
  their handles (SVG presentation attributes moved to classes so they can take `var()`), tile shade.
- Press on pointer-down: reviews drawer nav / segment / icon buttons (pressed wash; colour only, so it holds under reduced motion).

Found in the runner shots (1024 tablet / 390 phone, classic, light + dark; a temporary harness `tests/wp2-drift-shots.spec.ts`, run with
`-u` so the pictures came back for review, then deleted - commits f8dc4d71d / bceb49072) and fixed in b66debd20:

- Rules / alerts in API mode still used the pre-R5 card per rule (the toggle and actions fell under three lines of text, ~110 px per
  rule at 1024); the demo list already had the R5 row. The API lists now use the same row (a well inside one hero card). Data attributes
  (`data-rule-row`, `data-alert-row`, ...) unchanged.
- Sync (demo): the drift pill had `direction:ltr`, which turned its own `inset-inline-end` to the right and laid it over the camera name.
  It keeps the page direction now; the value is isolated with `<bdi>`.
- Camera health at 1024: the table scrolled sideways (network bars and an empty "more" column). Below 1280 px those two columns leave
  (the state pill already says the same). While the API registry loads, the demo subheading, demo chip counts and the demo recorder card
  are gone too.
- Search: a failed provider read lost its error panel as soon as a search started, and the provider badge said "טוען…" forever; the
  phone reference picture was a full 16:9 block (now 120 px).

Seen, not in WP2's files (for WP1): `sw-camera-tile`'s state badge ("מוקלט", "הנתונים אינם עדכניים") over a light picture is a translucent
soft fill in the dark scheme and reads poorly; it could use `sw-badge onimage`. The rules summary prints "(null)" for an HA-owned rule
without an automation id (only with mock data; a real HA rule has the id).

Left as is (recorded): `font-weight: 800` literals (no heavier weight token exists; WP1 territory); the shadow / text-shadow values that
already come from tokens.

## Base

The brief: branch from `origin/release/2360-train` once it contains `v2.34.2`. Work started on `origin/release/2360-train` @ 44b8383c2 while the train did not yet contain v2.34.2
(the v2.34.2 diff touched none of the WP2 files except playback, in other hunks). Once the train held v2.34.2 (v2.36.0, eb9525d9b) it was
merged into the branch (aa94543a1, no conflicts); tsc and the unit specs were re-run after the merge.

## Tests

- `npx tsc --noEmit` (frontend): 0 errors, after the merge too.
- Node unit specs, `playwright.unit.config.ts --workers=1`, filter `unit-`, after the merge: 3,670 tests - 3,668 passed, 1 skipped,
  1 failed: `unit-token-lint` reported four stale `ALLOW_HEX` entries (playback, camera page, history map, incidents no longer hold a hex
  literal after this branch). The four entries were removed from `frontend/tests/unit-token-lint.spec.ts` (a shared test file; four
  deleted lines, nothing else) and the spec re-run: 7 / 7 passed.
- Runner (`run_smart.py preview`, workers 1), at bceb49072 (before the base merge): `layout-camera-image-health`, `sync-dropdown`,
  `layout-sync-dropdown`, `evidence-shell`, `layout-page-background`, `evidence-security-polish`, desktop + mobile: 82 passed,
  20 skipped (by the specs' own project rules), 2 failed - `evidence-shell` "the red dot ..." on both projects: `#/investigate/rules?tab=alerts`
  opened on the rules tab. Cause: the lazy route screen read `initialTab` after `connectedCallback`, fixed on the train by GATE2342-B
  (`sw-app.ts` `waitingScreenTags`); the same test passed on `release/2360-train` @ eb9525d9b (1 passed). Not re-run on the merged
  branch: see NOT_RUN.
- Runner shots (temporary harness, tablet + mobile, light + dark, classic): round 1 72 passed, round 2 (after the fixes) 32 passed; every
  picture reviewed.

## Baselines

- visual-matrix: only `live-wall` maps to a WP2 file (`frontend/src/screens/live-`). The live-wall change is a hover gate (no rest-state
  change), so no live-wall baseline change is expected. Not run on the runner (no window - see NOT_RUN); the lead's central refresh should find no live-wall
  diff.
- No pixel spec (`pixel-*.spec.ts`) covers a WP2 screen.
- Screens whose look changes (for the lead's central refresh if a matrix entry is added later): rules icon tiles (dark), camera
  schedules legend (motion colour), saved views (phone layout, shared badge), search (loading / error panels), camera health (phone row
  card, loading), playback phone control bar (`#111827` → `--sw-video-bg`, near-identical in light, darker in dark).

## NOT_RUN

- `evidence-shell` "the red dot" on the merged branch (expected to pass with GATE2342-B; the release/2360-train run passed).
- visual-matrix `live-wall` (`run_smart.py visual`): the 2.36.0 gate held the runner.
- Rendered check at 1920 / 1440 / 1180 (only 1024 and 390 were shot), and the other skins (classic only).
- The camera page schedules legend (D8) and the saved-views API list: API-only views that need NVR / views mocks; reviewed in code only.
- `evidence-rules`, `evidence-live`, `evidence-semantic` (need `SW_LIVE=1` and a running backend).

Process note: one runner job (`evidence-shell -g "the red dot"` on release/2360-train, 10.6 s) was started while the 2.36.0 gate was
running - the gate check and the job were chained in one command and the check's "running" answer was not acted on. It did not stop or
touch the gate; no further runner job was started while the gate ran.
