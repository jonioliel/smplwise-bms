# Wall display mockups (CR-030, revision 2)

Interactive, self-contained mockups for `docs/changes/CR-030-WALL-DISPLAY.md` (WDM wall display mode, WDX picture frame
and alert tiles). Design only: no product code, no network, fixture data with invented names. Open `index.html` from
`file://` - it lists every screenshot with its annotation and links each one to the interactive page at the right size.

Revision 2 (owner review, 2026-10-05): no pairing code, no device token, no device registry, no 1920x1080 wall template
and no TV application. A wall tablet is a **user** on the existing `kiosk` role; signing in on a **tablet-class** device
switches the app to wall mode by itself; a phone or desktop shows the normal application. A TV shows video by cast (CR-028).

| File | What |
|---|---|
| `index.html` | Annotated index: decisions table, every screenshot grouped (login and detection, display states, presets, skins, settings) |
| `detect.html` | The detection rule, the three results side by side (tablet -> wall mode, phone and desktop -> normal app), the check table computed live in the browser, and this browser's own class |
| `frame.html` | Viewer: the chosen page in an iframe at 1280x800 / 800x1280 / 1920x1200 / 1440x900 / 390x844, skin and scheme switches |
| `login.html` | The normal login on a tablet. `?step=` (form, error, detect, removed) |
| `app.html` | What a wall user sees on a phone or desktop: the normal application limited by the role. `?cls=` (phone, desktop) |
| `wall.html` | The display. `?state=` (base, rotating, info, alert, alert-stack, takeover, takeover-stack, resolved, frame, frame-info, dim, sleep, cam-stale, cam-lost, server-offline, server-clock, config-updated, installer, sound-locked, no-cameras, access-removed, remote-refused, no-connection), `?preset=` (auto, tablet-landscape, tablet-portrait, single), `?cams=`, `?grid=`, `?alerts=off`, `?ack=on`, `?fit=cover`, `?photo=n`, `?shift=1`, `?clock=live` |
| `settings.html` | הגדרות › מסכי קיר: the list of wall users. `?view=` (list, empty, error, add, add-form, drawer, drawer-alerts, drawer-frame, drawer-schedule, remove, saved), `?device=<user>` |
| `wall.css` | Tokens of both skins (classic from `frontend/src/design/tokens.ts`, bubble from `mockups/bubble-taste/bubble-skin.css`) in light and dark, then the display, login / normal-app and settings rules reading only tokens, then the mockup chrome |
| `wall.js` | Fixtures, icons, URL state, the renderers and the interactions |
| `fonts.css` | Embedded Heebo subsets (copied from the bubble taste mockup) |
| `shoot.mjs` | Playwright: 86 screenshots into `screens/` + `screens/manifest.js` (read by the index); reports page errors and horizontal overflow |

Common parameters on every page: `skin=classic|bubble`, `scheme=light|dark`, `chrome=0` (hides the mockup bar).

Shooting: `node docs/design/mockups/wall-display/shoot.mjs` from the repo root (Playwright from `frontend/node_modules`,
or from the main checkout when run in a worktree - `SW_MAIN_CHECKOUT`).

Interactions: on the display "ראיתי" folds the alert into a strip chip, a 1.5 s press on "אישור" acknowledges (only when the
user's profile allows it, `?ack=on`), a long press on the clock opens the installer panel (read-only, with a
password-guarded "יציאה"), a tap on the picture frame returns to the cameras. On the login page "כניסה" leads to the
"זוהה טאבלט" screen. In settings every action button navigates to its state, toggles and chips flip locally.

Rules kept: RTL shell, video / map / user names / sizes LTR and never mirrored; touch targets >= 44 px on the tablet;
state is always shape + text, never colour alone; `prefers-reduced-motion` and `prefers-reduced-transparency` respected; no
infrastructure branding outside the settings screens.
