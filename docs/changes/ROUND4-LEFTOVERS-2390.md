# ROUND4-LEFTOVERS-2390: polish round 4 leftovers (WisKey area WP9, calendars D22, compact presence card round 16)

Task card `ROUND4-LEFTOVERS-2380` (Display U1). Branch `pilot/ROUND4-LEFTOVERS-2390`, cut from `origin/release/2382-train` @ 2d5238efe
(2.38.1 + TALK-DIAL, DEEPLINKS, PAIRING, INBOUND-CALLS). No version bump, no merge, no tag; `management/tasks.json` not edited.

Sources: `private/planning/POLISH_ROUND4_SURVEY_2026-11-02.md` (WP9 = D18 + D23, D22), `private/planning/NEXT_PHASE_DISPLAY_MOBILE_PLAN_2026-11-02.md`
(U1), `docs/changes/CALMSG-POLISH-2331.md` (the D22 findings), `private/planning/OWNER_ANSWERS_2026-10-30_NIGHT_HE.md` (presence card
rejection 30.10, compact answers 31.10, round 14).

## Contradictions recorded (not resolved here)

| Brief / card says | Evidence says |
|---|---|
| "The owner rejected the earlier presence card and asked for a compact redesign" | Yes on 30.10 - and the compact redesign was answered on 31.10 (round 9: 1A strip, 2A only active rooms, 3B details on hover, 4A area-window sub-line, 5A last emptied room) and shipped as PRESENCE-COMPACT-2310 in 2.31.0 (`3b8a1bf54`, four styles as settings). The card's own evidence (REGISTRY-UPDATE-2380) says the compact part of U1 is a follow-up "only if the owner is not satisfied"; whether he accepted the shipped strip is not recorded. This package therefore ships nothing for the card and asks the owner (round 16), with the shipped strip as one of the answers. |
| WP9 includes external access (D18) | D18 was done in WP8 (POLISH4-WP8-SETMOD-2370, owner Q4/Q9a) and is in 2.37.0. Not touched. |
| D22: "the now pill (10:40) covers the 11:00 label" | The 11:00 label was already dropped by the old share rule. The real defect (seen zoomed in the CALMSG capture): the hour labels' rule `.tl-axis span` out-ranked the pill's own class, so "10:40" was drawn in the labels' grey on the accent fill - unreadable, it looked like a covered label - and the 10:00 label touched the pill. Fixed (below). |
| D22: "management at 1024 shows 7 rows with room for 8" | In the round-9 capture the free space under the 7th row was about 46 px for a 58 px row (+6 gap): no eighth row fitted the old row. Resolved by a 2 px tighter row from 700 px up (54 px, still over 44); the runner baseline shows 8 rows at 1024 x 768. |

## WP9 - WisKey area (survey D23), limited to screens no WisKey branch touches

Excluded on purpose (other branches are changing them now): `wiskey-people*`, `wiskey-person-*`, `wiskey-station*` (2.38.2 / 2.39.0),
`wiskey-schedules*` (2.40.0 full editing), `wiskey-profiles`, `wiskey-access-diag`, `wiskey-triage`, the installer and ops screens, and
`shell/sw-app.ts` / `nav.ts`. Checked against the frontend file lists of WISKEY-PEOPLE-COMPLETE-2390, PROFILES-EDIT-2390, DOOR-TECH-2390,
LIVE-VALIDATION-2390, ACCESS-DIAG-2400, CONFLICTS-2400, EVENT-CURSOR-2400, INSTALLER-NATIVE-2400, OPS-VIEWS-2400, JOIN-LIVE-2382,
MANAGED-INSTALL-2382: none of them changes `wiskey-overview.ts`, `security-alarm.ts` or `design/tokens.ts`.

| Screen | Finding | Change |
|---|---|---|
| WisKey › מרכז הכניסה (`wiskey-overview.ts`) | D23: no hover / press / focus of its own controls. The search field had `outline: 0` on the input and no ring on the field (a keyboard user lost the focus), 34 px on touch, no hover. | Field hover edge under a fine pointer, focus ring on the field (`:focus-within`, the stations screen's recipe), 44 px under a coarse pointer. |
| same | The ringing pill: white text on `--sw-warning` = 2.2:1 (classic) / 3.9:1 (tesla). | New token `--sw-on-warning` (near-black warm ink) - >= 4.5:1 on the warning fill of every live skin, light and dark (unit check). |
| same | Token drift: the still tag `rgba(17,24,39,0.5)` / `#fff`; error notes in the bare `--sw-danger` (the A11Y rule: `-text` inks on text). | `--sw-video-scrim` / `--sw-on-video`; `--sw-danger-text`. Tabular digits in the count and the pager. The file leaves `ALLOW_HEX` (the lint fails on a stale entry). |
| אבטחה › אזעקה (`security-alarm.ts`) | The panel switcher and the keypad hovers were ungated (a tapped key kept its wash on a touch panel); the keypad pressed with a fixed `scale(0.97)` on the hover timing. | Hovers under `(hover: hover) and (pointer: fine)`; press on pointer-down with `--sw-press-scale` / `--sw-t-press` / `--sw-ease` (the skin decides the press, as for the filter chips); switcher keys 44 px up to 1100 px, the unpaired-sensors summary 44 px on touch; the selected chip's count bubble mixes its own ink (was `rgba(255,255,255,.22)`). Resting pixels unchanged. |
| WisKey › פעילות, door windows | Read: hover gated, press, focus ring, phone layout already in place (CR-036 / POLISH-CONTROL). | No change. |

## D22 - calendars

| Where | Change |
|---|---|
| Rooms timeline (`calendars/view-rooms.ts`, new pure `calendars/rooms-axis.ts`) | The pill's rules carry the axis in the selector (`.tl-axis .tl-nowlab`), so the time is drawn in `--sw-text-inverse` on the accent. The hour labels the pill would meet are left out by MEASURED pixels (the axis width, the pill width and the widest label are measured after render and on resize) instead of a fixed 3 % / 9 % share; the pill is placed in px and stays inside the axis near 07:00 / 23:00. After the pill, the edge hours are kept first and an hour that would touch a kept label is left out (the first runner baseline at 1024 showed "07:0008:00" and "22:0023:00"). Before the first measure the old share rule applies. |
| Management list (`calendars/view-manage.ts`) | Rows a page from the measured row (`this.rowH \|\| estimate`; the estimate used to be a floor over the measure) and `padding-block: 8px` on the list rows from 700 px up: 8 calendars at 1024 x 768 (was 7). |
| Review of the newer pieces (attendees, picker, grid overlays, shared calendars CSS) | Hover only under a fine pointer: the shared `.btn` (was `(hover: hover)` alone), list names, the row menu (+ a press wash), the equipment pop-up, the attendee options. 44 px on touch: the attendees toggle, the quick-create close key and steppers (the popover also opens on a touch tablet), the row menu, the equipment rows. The phone sheet's grab uses `--sw-r-pill`. No layout change on a desktop. |

## Compact presence card - owner round 16 (no product change)

Decision page (local, not published): `private/design-system-2026-10-27/round16-presence/index.html`, served with
`python -m http.server 8796` from that folder. Three directions plus the card that ships today, every picture a runner render of the REAL
home band (real clock and alarm cards, card shell, header, tokens) via the existing presence harness: `tests/presence-design-harness/
round16-options.ts` draws an option inside the real card; `tests/evidence-presence-round16.spec.ts` captures it (runs only with `R16_SHOTS`,
so the gate skips it). Details, fit table and recommendation: on the page.

## Tests

| Where | Command | Result |
|---|---|---|
| workstation | `npx tsc --noEmit -p .` (frontend, after the last change) | 0 errors |
| workstation | `npx playwright test -c playwright.unit.config.ts --workers=1` with a file filter: `unit-round4-leftovers-2390` (new), `unit-token-lint`, `unit-calendars-ui-2310`, `unit-calendars-grid-edit-2343`, `unit-calendars-attendees-2343`, `unit-design-tokens`, `unit-polish4-shared` | 85 passed, 0 failed |
| workstation | the same config, 26 related specs (calendars connect, dark-polish beds, designtokens-297, dialog-toplayer, empty-state icons, HUD, menu surfaces, palettes, polish-phone, skincomp / skinfound, small-ui-bugs, switch-contrast, tabs, uxfix-nav, wall-plan-scene, uxrest-295, arx-pending-tokens, ...) - before the axis edge-label commit, which touches only `rooms-axis.ts` and its own spec | 208 passed, 0 failed |
| runner, preview, `--workers=1` | `pixel-round4-leftovers-2390` `--project=desktop --project=mobile --update-snapshots=changed` @ 6e81225df (22 new baselines) and @ 2a589807b (4 rooms-1024 baselines re-taken after the edge-label fix) | 23 passed, 3 skipped (the manage cases outside desktop) - both runs; includes the layout checks (pill 4.5:1, inside the axis, no label under it, no two labels touching at 1440 / 1180 / 1024 / 390; manage list at 1024: last row not cut, no room for another row) |
| runner, preview, `--workers=1` | `evidence-calendars-views-2310`, `evidence-calendars-manage-2310`, `evidence-security-polish` @ 7dbd21333, desktop + mobile | 75 passed, 13 skipped (the specs' own project gates), 0 failed |
| runner, spec (Vite dev server) | `evidence-presence-round16` with `R16_SHOTS` @ 7dbd21333, desktop + mobile | 8 passed; 72 pictures + fit reports copied to the round-16 page |

Every rewritten baseline was opened and reviewed: the 26 `pixel-round4-leftovers-2390` pictures (WisKey overview 8, rooms 12, manage 2,
plus the 4 re-taken 1024 rooms). The first 1024 rooms baselines showed "07:0008:00" / "22:0023:00" (hour labels touching at the axis
edges) - fixed in 391f6232d and re-taken; the 1024 manage list shows 8 rows. No existing baseline changed.

NOT_RUN:
- Backend tests: no backend change in this package (nothing to target).
- `visual-matrix` (none of its routes is a changed screen; the alarm change has no resting pixel), `pixel-access-events` (the WisKey
  activity log was not changed), `evidence-alarm` (needs `SW_LIVE=1` with the alarm fixture backend), the tablet project.
- The full unit suite (`tests/unit-` without a filter) - not run by rule; the gate runs it.
- No local browser run (rule); every picture comes from the runner.

## Known limits

- The overview / calendars pixel baselines cover classic and domus (the pixel skins); the other skins get the structural smoke.
- The alarm screen has no pixel spec; its change is hover / press / touch size only (no resting pixel), checked by source guards.
- The round-16 pictures are mock-ups inside the real card shell; the option the owner picks needs its own build, settings and tests.

## Rollback

Revert the branch's commits; no migration, no API, no setting. `--sw-on-warning` is a new token read only by the WisKey overview.
