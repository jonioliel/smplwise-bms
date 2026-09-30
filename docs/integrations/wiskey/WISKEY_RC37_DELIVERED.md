# WisKey rc.37: what was delivered, how Arx uses it, what remains

Status note, 2026-09-30. It answers `WISKEY_REQUEST_2026-09-30_HE.md` (the request) and `WISKEY_FOLLOWUP_REQUESTS.md` (the
detailed follow-ups). The delivered files are in `embed-api-v1/`: the contract with the additive parameters
(`WISKEY_EMBED_API_V1.md`, marked "rc.37"), the handoff (`rc37/HANDOFF_RC37_HE.md`) and the changelog entry
(`rc37/CHANGELOG_RC37.md`). Embed API version stays **1**; no `postMessage` was added.

## Answers to the five requests

| # | Request | Answer in rc.37 | What Arx does |
|---|---|---|---|
| 1 | Camera wall of 10-12 tiles | Wall budget 12 next to 4 and 9, grid built from the measured width, MSE/RTC bridge ceiling 9 -> 12 (a connection beyond 12 is still HTTP 429; no queue or still image) | `wall=<4\|9\|12>` on the address (start choice, below) |
| 2 | Automatic density from the real free space, explicit choice honoured | Automatic is computed from the measured grid; an explicit 4/6/8/9/12 is never reduced and the frame scrolls | `density=<4\|6\|8\|9\|12>` on the address, or none for automatic |
| 3 | Keep the choice | Chosen alternative: the **URL**. WisKey stores nothing (no localStorage, no Home Assistant write); a choice made inside the panel lives in the page's memory only | Arx keeps the value per user and sends it on every load (see below) |
| 4 | Clean embed (the dark frame) | With `embed=1`: document and panel edges transparent, no border/shadow/outer padding, `color-scheme` follows the panel. `chrome=none` (only with `embed=1`) also removes the main padding | Arx always adds `chrome=none` to the framed address |
| 5 | Companion app | **Not in rc.37.** `wiskey:auth-required` or a web component that takes `hass` are technically possible; WisKey waits for the outcome of Arx's Companion experiment before choosing an interface or a date | unchanged (experimental relay, `access.phone_embed`, default off) |

## The address Arx builds

`/hikvision-intercom?embed=1&chrome=none&tab=<tab>[&tool=<tool>][&density=<n>][&wall=<n>]`, built from the origin, never the
Ingress path (`frontend/src/wiskey/embed-connector.ts` `wiskeyPanelUrl`). Every previous parameter is kept; the normal
top-level deep link ("open in WisKey") is unchanged and carries none of the new parameters. Invalid values are left out
(WisKey ignores them too). The values are parsed and resolved in `frontend/src/wiskey/embed-view.ts`.

## Where the choices live (per user, else per installation, else none)

- Personal, in **החשבון שלי › WisKey** (user menu): the overview cards (default / automatic / 4 / 6 / 8 / 9 / 12) and the camera-wall
  streams (default / 4 / 9 / 12). Stored on the server per user as `wiskey.density` and `wiskey.wall` of `GET/PUT
  /me/prefs`, so they follow the user to every device.
- Installation defaults, in **הגדרות › מדיה** next to "גודל תצוגת WisKey": `ui.wiskey_density` (automatic / 4 / 6 / 8 / 9 / 12) and
  `ui.wiskey_wall` (default / 4 / 9 / 12), administrator-written.
- Per parameter: the user's value, else the installation's, else the parameter is left out and WisKey decides (automatic
  density, wall of 4; `density=4|9|12` also sets the wall when `wall` is absent). A personal "automatic" leaves the density
  out even when the installation set one.
- A change made in Arx reloads an open WisKey frame once, on the tab it shows, because WisKey reads the values from the
  address only.

## Known limits

- **Arx is not told when the user changes the count inside the panel.** WisKey adds no message (`wiskey:*` is unchanged) and
  stores nothing, so an in-panel change lasts until the next load of the frame and is not saved. The choice is therefore a
  START choice, kept in Arx; the settings copy says so in one line.
- The 12-tile wall needs 10-12 active cameras, a sound media policy and a go2rtc, browser and network able to carry the load;
  a connection beyond 12 is refused (HTTP 429), and streams shared with other windows count against the same ceiling. The
  rc.37 handoff verified layout with fake data only (12 camera elements and 10 tiles fitting a 1354x729 frame); **no ten real
  video streams were shown**, and the bridge tests did not run for lack of a Home Assistant Python environment.

## Known issue: dark frame after in-panel navigation

rc.37's `chrome=none` and transparent document do not remove a dark frame that reappears after navigating inside WisKey
(cause: the UA focus ring on `<main tabindex="-1">`, `panel.ts:6137`, with no embed rule to remove it). Arx cannot style the
frame's document, so it crops 3 px (2 px under 768 px) at each edge of the frame (`WISKEY_EDGE_CROP_PX` in
`wiskey-embed.ts`) as a mitigation. Fix requested from WisKey in `WISKEY_REQUEST_RC38_FOCUS_HE.md`.

## What remains

1. **Companion app** (request 5): waiting for the result of Arx's own Companion experiment (`access.phone_embed`), then a
   choice between `wiskey:auth-required` and a `hass`-accepting component. No date from WisKey.
2. **Live verification on the installed rc.37** (owner, in his Home Assistant): the URLs and checks listed in the closing
   report of the integration change; live 10-12 tile video is the open evidence item of request 1.
3. Ceiling above 12, queueing or still images for tiles beyond the budget: not offered by WisKey; not requested again.
