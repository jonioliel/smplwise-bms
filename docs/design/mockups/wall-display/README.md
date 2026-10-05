# Wall display mockups (CR-030)

Interactive, self-contained mockups for `docs/changes/CR-030-WALL-DISPLAY.md` (WDM wall display mode, WDX picture frame
and alert tiles). Design only: no product code, no network, fixture data with invented names. Open `index.html` from
`file://` - it lists every screenshot with its annotation and links each one to the interactive page at the right size.

| File | What |
|---|---|
| `index.html` | Annotated index: decisions table, every screenshot grouped (pairing, display states, presets, skins, settings) |
| `frame.html` | Viewer: the chosen page in an iframe at 1280×800 / 800×1280 / 1920×1080 / 1440×900 / 390×844, skin and scheme switches |
| `wall.html` | The display. `?state=` (base, rotating, info, alert, alert-stack, takeover, takeover-stack, resolved, frame, frame-info, dim, sleep, cam-stale, cam-lost, server-offline, server-clock, config-updated, identify, installer, sound-locked, no-cameras, revoked, paused, remote-refused, pairing-network), `?preset=` (auto, tablet-landscape, tablet-portrait, wall, single), `?cams=`, `?grid=`, `?alerts=off`, `?fit=cover`, `?photo=n`, `?shift=1`, `?clock=live` |
| `pair.html` | Pairing on the tablet. `?step=` (start, code, claimed, approved, expired, denied, network) |
| `settings.html` | הגדרות › מסכי קיר. `?view=` (list, empty, error, add-code, add-bad, add-throttled, add-hint, add-form, drawer, drawer-alerts, drawer-frame, drawer-schedule, revoke, identify, saved), `?device=wd_0n` |
| `wall.css` | Tokens of both skins (classic from `frontend/src/design/tokens.ts`, bubble from `mockups/bubble-taste/bubble-skin.css`) in light and dark, then the display, pairing and settings rules reading only tokens, then the mockup chrome |
| `wall.js` | Fixtures, icons, URL state, the three renderers and the interactions |
| `fonts.css` | Embedded Heebo subsets (copied from the bubble taste mockup) |
| `shoot.mjs` | Playwright: 102 screenshots into `screens/` + `screens/manifest.js` (read by the index); reports page errors and horizontal overflow |

Common parameters on every page: `skin=classic|bubble`, `scheme=light|dark`, `chrome=0` (hides the mockup bar).

Shooting: `node docs/design/mockups/wall-display/shoot.mjs` from the repo root (Playwright from `frontend/node_modules`,
or from the main checkout when run in a worktree - `SW_MAIN_CHECKOUT`).

Interactions: on the display "ראיתי" folds the alert into a strip chip, a 1.5 s press on "אישור" acknowledges (only when the
device allows it), a long press on the clock opens the installer panel, a tap on the picture frame returns to the cameras.
On the pairing page the mockup bar simulates the administrator. In settings every action button navigates to its state,
toggles and chips flip locally.

Rules kept: RTL shell, video / map / code digits / sizes LTR and never mirrored; touch targets >= 44 px on the tablet,
scaled 1.25 on the wall preset; state is always shape + text, never colour alone; `prefers-reduced-motion` and
`prefers-reduced-transparency` respected; no infrastructure branding outside the settings screens.
