# KIOSK polish - wall display, kiosk route, phone PWA shell (Design ADR) - 2026-10-11

Branch `pilot/KIOSK-polish` from 2.4.4 (3e804087). Visual and ergonomic changes only: no API, setting, migration or
behaviour change. The idle-to-stills switch and the wall live / stills override belong to the Studio 6 branches; this
branch only reserves their place (section 3).

## 1. Wall display (`frontend/src/wall/sw-wall.ts`)

- **Distance type**: the scale moved one tier up and still follows the physical screen (`--s`, `wallScale`): clock 34 px·s
  (was 30), place 19, chips 16, lost-tile name 24, state screens 30 / 18, sleep clock 72 with the date under it.
- **Colours**: the per-profile theme (`cfg.theme` dark / light) is independent of the product scheme, so the theme knobs
  (`--wall-bg/-text/-text-2/-tile/-strip/-chip/-dot/-danger-*/-stale-*/-panel`) carry both themes themselves; everything
  else reads `--sw-*` (on-video family, state colours, radii, weights, shadows, motion). The light theme now has readable
  danger / stale chips (was pink-on-light).
- **Calm idle, burn-in safe**: the pixel shift glides (`transform 2 s`), the dim fades over 3 s and takes the strip's fill
  away, outlines the clock and recedes the chips (no static bright pixel); the sleep clock drifts in 2 s; the active page
  dot is 85 % white, never pure white.
- **State-change motion**: tiles / pane fade in, chips / badges / banner / panel rise 6 px, the takeover lands from 102 %
  (plus its existing border pulse), a danger dot breathes. All off under `prefers-reduced-motion`.
- **Touch**: the `+N` alert counter and the buttons are 44-48 px·s targets; the clock's long-press area is 44 px·s high.
- **Portrait cells**: the picture keeps 16:9 and sits centred in a tall cell (container units; width-fill fallback).
- **Map pane slot** (section 3).

## 2. Kiosk route (`frontend/src/screens/kiosk-wall.ts`, SC31)

No hex literal left (the `ALLOW_HEX` entry is dropped); the clock is the largest text (3xl, tabular) with the date under it;
counters at 3xl; 44 px select / exit at every size; safe areas on all four sides; the disconnected overlay carries a mark;
a cell per tile centres the 16:9 picture so a 3 x 3 page fits 1280 x 800 with the counters under it, and a portrait tablet
packs its rows; after ten idle minutes the header and counters recede to 70 % (the video never dims; a touch restores);
the footnote paragraph is gone (clean operator screens).

## 3. The Studio 6 slot

`SwWall.renderMapPane()` renders `<div class="pane" data-wall-map-slot>` when `Layout.map` is true (portrait preset with
`cfg.show_map`), as an empty surface in the tile material with the grid row `minmax(0, 0.55fr)`. Studio 6 draws the plan,
the idle-to-stills switch and the live / stills override there (built in CR-029 S5-B: `wall/sw-wall-plan.ts`, see
`docs/changes/CR-029-ST7-S5B-NOTES.md`; a profile with no floor keeps the empty surface). `show_map` defaults to false, so no installation
sees the empty pane unless it asked for the map.

## 4. Phone PWA shell

- `pwa/arx-pwa-prompts.ts`: cards rise in; 44 px buttons on a touch screen (`size="lg"`), the actions drop under the text
  under 480 px; the iOS close is 44 px; a **connection pill** under the status bar says "אין חיבור · מוצגים נתונים אחרונים"
  while the browser reports offline and "החיבור חזר" for 3 s when it is back (window `offline` / `online` events only).
- `pwa/offline-page.ts`: light and dark (`prefers-color-scheme`, the classic token values by hand - the page has no sheet),
  a 48 px retry target, body type 15 px.
- `shell/sw-app.ts`: `main { overscroll-behavior-y: contain }` on phones - a pull at the top stays in the app instead of
  reloading the shell (installed: the whole app).

## 5. Evidence

`docs/design/evidence/kiosk-polish/before/` (origin/main, `evidence-wall.spec.ts`) and `.../after/` (this branch:
`evidence-wall.spec.ts` + `evidence-kiosk-polish.spec.ts`): the wall on 1280 x 800 and 800 x 1280, classic / bubble,
light / dark, every state; the kiosk route on 1280 x 800 and 820 x 1280, light / dark; the phone install card, the
offline pill and the worker's offline page, light / dark.
