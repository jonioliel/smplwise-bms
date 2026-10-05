# Cast-to-screens UX mockups (CR-028, phases 1-2)

Interactive, self-contained HTML mockups of the whole "שדר למסך" flow the owner asked for on 2026-10-05 after reviewing the
phase-0 Settings column alone: where the button sits, the screen picker, the active-cast state, the wall (mosaic / carousel),
the global "currently casting" tray, every error and edge state, permissions and admin approval, the Settings column with
filter + sort by cast method, and the first physical lab test. Design only: no product code, no network, no device was
contacted; every name is invented fixture data. Branch `pilot/cast-ux-mockups` (from `pilot/cast-prep`).

Open `index.html` (annotated index + owner questions, Hebrew) from `file://`; every page works without a build.
A copy of the finished folder is placed in `private/review/cast-ux/` (gitignored) for the owner's review.

## Files

| File | What |
|---|---|
| `index.html` | The annotated index: where each element sits on desktop / tablet / phone, the numbered annotations of every page, the owner questions with lettered options, honest limits |
| `01-live-camera.html` | Single camera: the button in the round control group, the anchored picker (bottom sheet on the phone), busy confirmation, connecting / playing / not-confirmed / timeout pills, H.265 main-stream blocking, no permission, no targets, relay unavailable, remote (/arx) |
| `02-wall.html` | The wall: the button next to "קיוסק", the two-step wide sheet (layout: mosaic 2x2 / carousel / one camera, then the screen), tile selection mode, mosaic and carousel playing with a "what the TV shows" preview, host-overloaded (carousel only), the phase-1 "one camera from the wall" behaviour |
| `03-active-tray.html` | The global "משדר N" pill and tray: sessions of mine and of others, live 5-minute countdown, extend (8x cap), switch camera, stop, "stop all" with confirmation (media.bulk) |
| `04-errors.html` | A gallery of the 18 error / edge states, each where it appears (picker row, empty state, pill, toast) |
| `05-permissions.html` | The role matrix (who sees the button / picker / tray, who stops, who approves), the per-screen approval section of the Settings form (allow toggle, method override, main stream, 60-second test cast), audit rows |
| `06-settings.html` | הגדרות › מולטימדיה: the "שידור" column at 1440, filter by cast method, sort by cast, the tablet fold + columns control, the open form, "screens I can cast to", the general card (relay origin + "בדוק", minutes, cap, wall mode, bridge version) and the installation's active casts |
| `07-lab-test.html` | The first physical test as the admin sees it: prerequisites checked for real, origin self-check, approving the one named screen with the explicit consent text of CR-028 section 8.3, the 5-minute run, the evidence summary |
| `cast.css` | Tokens (classic light/dark from `frontend/src/design/tokens.ts`; bubble from `docs/design/mockups/bubble-taste/bubble-skin.css`) + component rules written so they can move into the Lit screens |
| `cast.js` | Icons, fixture, the chip/sentence words copied from `frontend/src/screens/media-cast-label.ts`, the shell, the pop-up controllers (centred sheet, anchored popover with the flip-up rule, bottom sheet), the tray, the mockup chrome, the numbered annotation markers |
| `fonts.css` | Embedded Heebo (copied from the bubble-taste mockup) |
| `shoot.mjs` | Playwright screenshots of every page x state x (1440 / 1024 / 390) x (light / dark) x (classic / bubble) into `shots/` |
| `shots/` | The screenshots (see below) |

## Switches (the top bar of every page; also URL parameters)

| Switch | Values | URL |
|---|---|---|
| Viewport | 1440, 1024, 390, full window (container queries on `.device`) | `vp=` |
| Scheme | light, dark (`html[data-theme]`) | `scheme=` |
| Skin | classic, bubble (`html[data-skin]`) | `skin=` |
| Annotations | shown / hidden (the numbered pink markers) | `ann=1|0` |
| State | per page (the select in the bar) | `state=` |
| Screenshot mode | hides the bar and the note | `shot=1` |

## Design decisions recorded here (to be confirmed by the owner, see the index questions)

- The button lives where each screen already puts its actions: the round control group under the video (camera), the
  actions row next to "קיוסק" (wall). It exists only when the caller holds `media.cast` and at least one target exists
  (no hint otherwise - clean operator screen).
- The picker is grouped "לאחרונה" then by floor; every row shows room · state (`פנוי` / `מנגן מוזיקה` / `משדר: X` / `כבוי`)
  and a capability badge in operator words only (מאומת / כנראה / לא ידוע / נקבע ידנית) - never a technology name. A blocked
  row shows its reason in place of the state.
- "Playing" is honest: it is set only when the relay served the first segment to the TV; 15 s without it shows
  "המסך לא הגיע לזרם" with retry / stop.
- The global tray is one pill in the actions row of every screen; sessions of other users carry their name; "stop all"
  needs `media.bulk` and confirms with the list of owners.
- Settings: the column stays where phase 0 put it (between "מצב" and "מאושר"), folded by default on the tablet width like
  "חדר" and restored through the existing columns control; the phone card gets a labelled line. Filter and sort by cast
  method reuse the toolbar's existing patterns (a multi-select field + active chips; a sort entry).

## Verification (actually run)

- `node docs/design/mockups/cast-to-screens/shoot.mjs` on the frontend's Playwright 1.63 / Chromium: the number of
  screenshots and the page-error count are printed at the end of the run and recorded in the final report of the task.
- Not run: real phones, Safari, screen readers, the product's layout guard (the mockup is not the product build).

## Limits

Classic and bubble skins only (domus / tesla not drawn). The Settings table is a visual copy of `media-admin-list`, not the
component. The picker is drawn as one panel, not in the six `sw-dropdown` styles. The latencies quoted (3-8 s, 15 s) are the
classes from the CR, not measurements.
