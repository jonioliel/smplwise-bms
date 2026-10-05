# CR-030 — Wall display mode: a fixed wall tablet paired by a six-digit code

**Numbering:** registered as CR-030 on 2026-10-05 (CR-027 mobile presence, CR-028 / CR-029 reserved by the board for
Provision push and TOU billing). Board items **WDM** (wall display mode, L, 44 h) and **WDX** (picture-frame mode and
alert tiles, M, 15 h), both planned for 2.3.0. Branch `pilot/wall-display-design` (from `origin/main` at 2.0.1).

**Status:** design and change request only - no product code, no migration, no device access. The owner decided
(2026-10-05) not to wait for answers: every open point is decided here, with its reason, in the product's design language
(DU1: one structure, skins on top, light and dark from day one, the area tree kept where a tree makes sense).
Mockups: `docs/design/mockups/wall-display/` (entry `index.html`), copied for review to `private/review/wall-display/`.

**Related:** SC31 (kiosk / wall display, `#/kiosk/:view`, T057) which this CR supersedes for fixed tablets; the `kiosk`
role (`roles.json`, `tests/test_kiosk_role.py`); CR-008 (the remote channel and its cookie-less, header-dropping
middleware); CR-018 (notification core - alert tiles are a notification channel); CR-027 (device registration with a
hashed, shown-once token - the pattern this CR copies); `docs/security/HA_IDENTITY_RBAC_HE.md` (HA is the only *human*
identity source; a display is not a human).

---

## 1. Goals

1. A tablet screwed to a wall (reception, corridor, control room, kitchen) shows the cameras and state of **its** place,
   without a person signed in on it, without an HA account living on the device, and without any way to change the
   system from that screen.
2. Pairing takes one minute and needs nothing typed on the tablet: the tablet shows a six-digit code, an administrator
   enters it in Settings (from a desktop or a phone), picks what the screen may show, done.
3. Every display is its own narrow principal: the cameras, area and alert categories it may see are an explicit allow
   list, revocable with one tap, visible in the audit trail.
4. The layout follows the screen: tablet landscape (1280x800), tablet portrait (800x1280) and a wall monitor (1920x1080)
   each get a preset; an administrator may pin one. A display is readable from across a room, not a shrunken desktop.
5. A display that hangs for years: burn-in protection, a wake / sleep schedule, honest offline behaviour (never a stale
   frame presented as live), reconnect without anyone touching it.
6. (WDX) Alert tiles - the display raises what is happening in its area (door left open, leak, camera offline, alarm
   triggered) with a priority ladder from a chip to a full takeover, and returns to its base layout by itself.
7. (WDX) Picture-frame mode - when nothing happens the display shows photos from a folder the administrator chose,
   never camera frames, and drops back to cameras the moment something needs attention.

Non-goals (v1): control from the wall (no lights, locks, alarm, PTZ, talk), playback, two-way audio, per-person
sign-in on the tablet, screen brightness / hardware control (a browser cannot; §6.6 says what a kiosk browser app can
add), Lovelace surfaces (SC32 stays as it is).

## 2. What exists today and why it is not enough

- `#/kiosk/all?cameras=...&cols=&rows=&rotate=` (SC31) is a **URL** rendered for a signed-in HA user bound to the
  `kiosk` role. The tablet therefore holds an HA session of a real HA account (or a shared "wall" account), reached
  through Ingress. Problems: an HA account per tablet; the account's session is a full HA session on an unattended
  device; the layout is a URL anyone can edit on the tablet; no per-device inventory, last-seen or revoke; no alerts;
  rotation and layout are browser-local.
- The `kiosk` role (`map.read`, `video.live`) is right in spirit - live and map only - and stays the ceiling of what a
  display may ever do (§3.4).
- The CR-027 phone registration (shown-once token, SHA-256 at rest, ownership checks, janitor) is the model for a
  machine credential in this product and is reused as-is in shape.

## 3. Security model

### 3.1 Principals: a display is a machine, not a person

A paired display is a row in `wall_devices` and resolves to a principal of **source `wall`** (next to `local` / Ingress
and `remote` / CR-008). It has no `user_id`, no HA identity, no bindings table entry. Its capability set is computed
from its own row (§3.4) and is a strict subset of the `kiosk` role plus the wall-only permissions. It can never be
promoted: there is no path from a `wall` principal to a user session, and `/me` for a wall principal answers
`{kind: "display", ...}` with no bindings.

Why not an HA user per tablet: HA_IDENTITY_RBAC makes HA the identity source for *people* so that people can be managed
in one place. A tablet is not a person; giving it an HA account creates a credential that can also open the HA UI,
which is exactly what a wall must not be able to do. A machine principal with a one-purpose token has no such reach.

### 3.2 Pairing code lifecycle (the tablet shows, the administrator types)

Direction chosen: **the tablet displays the code; an administrator enters it in Settings.** Reasons: nothing is typed
on a device with no keyboard and no identity; the person who approves is authenticated and holds `system.configure`;
seeing the code on the physical screen proves the administrator is looking at the right tablet ("what you see is what
you pair"); the code never travels anywhere but the administrator's eyes. The reverse (Settings generates, someone
types on the tablet) is kept as a fallback for a screen that cannot be seen from the admin's position - it is the same
record with the roles swapped (`entered_on: "display"`), v1 ships only the primary direction.

Lifecycle of a `wall_pairings` row:

| Step | Who | What happens | State |
|---|---|---|---|
| 1 | tablet | opens `<origin>/wall` (§3.5), has no token, `POST /wall/pair/start {hint: {ua, screen: {w,h,dpr}, tz}}` | `pending` |
| 2 | server | makes a **six-digit code** from a CSPRNG (000000-999999, leading zeros kept), a 128-bit `pair_secret` returned only to this tablet, `expires_at = now + 10 min`; stores `sha256(code) + sha256(pair_secret)`; answers `{pairing_id, code, expires_at, poll_after_s: 3}` | `pending` |
| 3 | tablet | shows the code large, polls `GET /wall/pair/{pairing_id}?s=<pair_secret>` every 3 s (then 5 s after 2 min) | `pending` |
| 4 | admin | Settings › מסכי קיר › "הוספת מסך": types the code; server finds the pending row by `sha256(code)`; shows the hint (screen size, orientation, browser, when started) so the admin can confirm it is the tablet in front of them | `claimed` (held 10 min for the admin to finish the form) |
| 5 | admin | fills name, place (area), cameras, layout, alerts, picture frame (§4) and saves | `approved` → `wall_devices` row created |
| 6 | tablet | the next poll answers `{status: "approved", token: "arxw_…", device: {...config}}` - the token appears **once**, in this response; the server keeps `sha256(token)` | row deleted after delivery |
| 7 | tablet | stores the token in IndexedDB, reloads into the wall; `GET /wall/me` with the token | device `active` |

Rules: a code is single use; **5 wrong codes per administrator per 10 minutes** and **20 per installation per 10
minutes** lock the entry form for 10 minutes (429, audited `wall.pair.throttled`); a pending row expires at 10 minutes
(the tablet shows "הקוד פג" with a button for a new one - a new code, never the same); `pair_secret` means a bystander
who reads the code off the screen cannot poll the result; a `claimed` row the admin abandons returns to `pending` (same
code) until its own expiry; one tablet may have one pending pairing (a restart starts a fresh one and the old one
expires by itself). Codes are compared in constant time; the code is never logged or audited (the audit row carries
the `pairing_id`). Six digits give a 1-in-a-million guess against a 20-per-10-minutes cap, i.e. ~1 in 50 000 per
window for the whole installation; with a 10-minute window per code that is adequate for an administrator-only form on
an authenticated session. The entry form is itself behind `system.configure`, so the attacker is already an
administrator - the cap is there to make a careless administrator's mistakes noisy, not to defend against outsiders.

### 3.3 Device token

`arxw_` + 43 base64url characters (256 bits), exactly the CR-027 shape with a different prefix so a log line or a
support bundle tells the two apart. Stored as SHA-256; shown once (step 6). The tablet sends it as
`Authorization: Bearer arxw_…` on every `/wall/*` request and as the first message on the wall WebSocket (§7.3). A wall
token is refused on every route outside `/wall/*` and the media ticket routes it is allowed (§3.4) - a wall token can
never call `/api/v1/settings`, `/ha/entities/*/actions`, `/exports`, etc., even with a bug in a permission check,
because the resolver only runs on the wall router (defence in depth, same as `presence` routes in CR-027).

Lookup is one indexed read on the hash; unknown tokens are counted (20 per token key per minute, 300 per installation
per minute → 429). **Rotation**: `POST /wall/devices/{id}/rotate-token` (admin) invalidates the hash and puts the device
back into a one-shot `re-pair` state that completes *without* a new code when the tablet is still online (it receives
the new token on its WebSocket, acks, the old hash dies); offline tablets simply get `401 display_revoked` and show the
pairing screen. **Revocation** (§3.6) replaces the hash immediately.

Not a session cookie, because: no CSRF surface (no cookie, no ambient authority), the token is explicit on every
request, and the CR-008 middleware's header dropping still protects the remote channel.

### 3.4 Permissions: the kiosk role is the ceiling, the device row is the floor

A `wall` principal's capabilities are computed per request from its row:

| Capability | Source | Notes |
|---|---|---|
| `video.live` on camera *C* | *C* ∈ `cameras` (explicit list, ordered) | never "all cameras of the area" implicitly: the admin ticks each one (an area is a shortcut that fills the list, the list is what is stored) |
| `map.read` on the display's `area_id` / floor | `show_map: true` (default false) | the tablet-portrait preset has a map band; the wall and landscape presets do not |
| `entity.state.read` on the state chips (clock, temperature, alarm state, door state) | `state_entities` (explicit list, ≤ 8) | read only, rendered as chips in the strip |
| `wall.alerts.view` for categories ⊆ {safety, alerts, doors, device_faults, security} | `alerts.enabled` + `alerts.categories` + `alerts.min_severity` | scoped by `area_id` and `cameras`: an alert reaches a display only when its subject is one of the display's cameras / area entities (the CR-018 `row_scope` rule applied to the device's lists) |
| `wall.alerts.ack` | `alerts.ack_allowed` (default **false**) | §5.4 - acknowledging from an unattended screen is an owner-level choice per device |
| `wall.frame.view` | `frame.enabled` | the photo folder is read through the server, never a direct media URL |

Not grantable to a display, ever (hard-coded deny in the resolver, tested like `test_kiosk_role`): `video.playback`,
`video.export`, `events.read` beyond its alert feed, `devices.control`, `ha.entity.control`, `alarm.arm`,
`media.*`, `access.*`, `system.*`, `map.edit`, `presence.*`. A display cannot open a door, switch a light or arm the
alarm **by design** - a wall in a corridor is reachable by everyone who walks past it; CR-007's "sensitive action needs
a confirmation" assumes a person who is accountable. If the owner later wants quick actions on a wall, that is a new
CR with a per-action PIN and a per-device allow list, not a flag here.

The existing `kiosk` *role* for HA users stays for the Lovelace / shared-account case and is unchanged.

### 3.5 Where the tablet connects: local by default, remote per device

The wall page is served at `<origin>/wall` on the add-on's direct port (CR-008 already exposes 8099 for the tunnel) and
at `https://<site>/arx/wall` through the remote channel. Both are cookie-less; the page's only credential is the token.
Ingress is not used: an Ingress session is an HA session, which is what we are removing from the tablet.

Per device `remote_allowed` (default **false**): the token is accepted only on the **local channel**
(`sw_channel = "local"` - the direct port, reached on the LAN). A token presented on `/arx/...` for a device without
`remote_allowed` is refused `403 display_remote_not_allowed` and audited. Reason: a wall tablet does not travel; if its
token is ever seen from the internet it was copied. The flag exists for a display in a second building that reaches
the server only through the tunnel - and that display's admin takes the decision knowingly.

Honest limit: on the local channel the server trusts the add-on port's reachability, not a client IP range (Docker
and the HA host rewrite addresses); "local" means "arrived without passing the tunnel path", nothing more. Firewalling
the direct port to the LAN is the installer's job and is documented in the install guide.

### 3.6 Revocation and re-pair

- **Revoke** (`DELETE /wall/devices/{id}`, `system.configure`): the hash is replaced, the WebSocket is closed with
  code 4401, the row is kept 30 days as `revoked` (for the audit view and so the same tablet can be recognised when it
  is paired again - the `hint` fingerprint matches) and then pruned by the janitor. The tablet's next poll or request
  gets `401 display_revoked` and the tablet shows "המסך הוסר מהמערכת" with one button: "צימוד מחדש".
- **Pause** (`PATCH {paused: true}`): the token stays, requests answer `403 display_paused`, the tablet shows a quiet
  "המסך מושהה" with the clock. For maintenance or a holiday without re-pairing.
- Expiry: a device not seen for `wall.inactive_days` (default 90) is marked `inactive` in the list (not revoked - a
  display in a seldom-used room is not an attacker); the list shows it in the stale colour.

### 3.7 Audit

`wall.pair.start` (actor none, resource pairing_id, the hint), `wall.pair.claim` / `wall.pair.approve` /
`wall.pair.deny` / `wall.pair.expire` (actor = admin, or none for expiry), `wall.pair.throttled`, `wall.device.update`
(the diff of §4 fields, never the token), `wall.device.rename`, `wall.device.pause`, `wall.device.revoke`,
`wall.device.rotate_token`, `wall.session.refused` (one row per device per 10 min, with the reason:
revoked / paused / remote_not_allowed / unknown_token), `wall.alert.ack` (actor = **the display**, `details.device_id`,
`details.notification_id`; §5.4), `wall.frame.folder_set`. Every row carries the device id and name as the resource; no
code, token, photo path or camera frame is audited.

The existing audit screen gets a filter chip "מסכי קיר" (the `wall.*` prefix); no new audit screen.

## 4. Per-device configuration

Edited in **הגדרות › מסכי קיר** (`#/system/wall`, `system.configure`), in the "add display" form of §3.2 step 5 and in
the device drawer afterwards. Operator-screen rules apply (short labels, no paragraphs); the explanations below are
for the developer and the user guide.

| Field | Values | Default | Why this default |
|---|---|---|---|
| `name` | text ≤ 40 | the hint ("טאבלט 1280×800") | the admin renames it ("קבלה", "מסדרון קומה 2") |
| `area_id` | an area of the installation, or none | none | scopes alerts and the map band; the camera picker opens on this area |
| `cameras` | ordered list of camera ids, ≤ 16 | the area's cameras when an area is chosen | explicit allow list (§3.4) |
| `layout` | `auto` / `tablet-landscape` / `tablet-portrait` / `wall` / `single` | `auto` | §4.1 |
| `grid` | `auto` or `{cols, rows}` within the preset's range | `auto` | the preset decides from the camera count; pinning is for odd rooms |
| `rotate_s` | 0 / 15 / 30 / 60 / 120 | 0 when the cameras fit on one page, else 30 | more cameras than cells → pages |
| `stream` | `sub` only in v1 | `sub` | the lab NVR / relay stall above ~6 sub streams at once (live review F15); a wall with 9 tiles already pushes that - `main` on a wall is a later measurement, not a checkbox |
| `strip` | which chips: clock, date, weather, alarm state, system health, up to 8 `state_entities` | clock, date, system health | the strip is the one non-video line; keep it short |
| `show_map` | bool | false | a map band only makes sense on the portrait preset; off elsewhere |
| `theme` | `follow` (installation `ui.skin` / `ui.scheme`) / `dark` / `light` | `dark` | a wall is mostly video on black; dark wastes fewer photons, burns less, and reads from a distance |
| `alerts` | `{enabled, categories[], min_severity, ack_allowed, takeover_timeout_s, sound}` | enabled, {safety, alerts, doors, device_faults, security}, `alert`, ack **off**, 120 s, sound off | §5 |
| `frame` | `{enabled, folder, idle_min, interval_s, fit, clock}` | off, -, 10, 30, `contain`, on | §6 |
| `burn_in` | `{shift: true, dim_after_min: 30, dim_to: 0.6, shuffle_h: 1}` | as shown | §4.2 |
| `schedule` | weekly windows `[{days, from, to}]`, `wake_on_alert_severity`, `wake_on_touch` | always on, `critical`, true | §4.3 |
| `offline` | `{show_last_frame_s: 60, then: "clock"}` | as shown | §4.4 |
| `remote_allowed` | bool | false | §3.5 |
| `paused` | bool | false | §3.6 |

### 4.1 Layout presets by screen size and orientation

`auto` picks by the viewport the tablet reports on every connect (`screen` in the hint; re-evaluated on
`resize` / `orientationchange`, so turning the mount rotates the layout):

| Preset | Chosen when | Structure (RTL shell; video never mirrored) | Cells |
|---|---|---|---|
| `tablet-landscape` | width ≥ 1000, landscape, height < 1000 (1280×800, 1024×768, 1180×820) | top strip 56 px (place, clock, chips), video grid below | 1, 2 (1×2), 4 (2×2), 6 (3×2); 9 only when `grid` is pinned |
| `tablet-portrait` | portrait (800×1280, 768×1024) | strip 56 px, cameras stacked in one column at full width 16:9 (two fit above the bands at 800×1280; three on a tall 1080×1920 portrait screen; more cameras page with dots), then the **map band + state band** (the map band when `show_map`), bottom status line | 1×2 (1×3 when the height allows); 2×2 when pinned |
| `wall` | width ≥ 1600 (1920×1080, 2560×1440, TV) | strip 64 px, grid 3×2 default, 4×3 for 10-12 cameras, right-side **alert column** 320 px when alerts are on | 3×2, 4×2, 4×3, 5×3; the strip and the alert column grow with `--wall-scale` |
| `single` | one camera, or pinned | one tile full bleed, strip overlaid on the top edge | 1 |

Type and touch scale with the preset: `--wall-scale` is 1 for tablets and 1.25 for `wall`; chips are 44 px tall on a
tablet (touch) and 56 px on a wall (read at 3-4 m). The strip's clock is the largest text on the screen on every preset
(it is what people look at from a distance). The tile label (camera alias + live / stale badge) sits inside the tile's
bottom edge, 15 px on a tablet, 19 px on a wall. There is no sidebar, no bottom bar, no user menu and no settings
affordance anywhere on the display - the only interactive elements are the alert tile's buttons (§5.4), the page dots
(when rotating), and a long-press (3 s) on the clock that shows the device's name, id and connection state for the
installer (no action, read-only, closes by itself after 10 s).

Why no area tree on the display: the "keep the area tree" rule is for screens where a person navigates. A display
has no navigation; its scope is fixed by the admin. The portrait preset's map band is the display's spatial context
and keeps the floor plan visible, which is the spirit of the rule.

### 4.2 Burn-in protection (OLED and cheap LCD tablets alike)

- **Pixel shift**: the whole layout moves by (±2, ±2) px on a 60 s cycle through 9 positions (CSS transform on the
  root, no reflow). Video tiles move with it.
- **Shuffle**: every `shuffle_h` hours the tile order rotates by one cell and the strip chips reverse order, so the
  static labels do not sit on the same pixels for days. Off when `grid` is pinned to a single tile.
- **Dim**: after `dim_after_min` minutes without touch and without an alert, the display fades to `dim_to` (0.6) and
  the strip clock goes to its outline style; any alert or touch restores full brightness.
- **Night**: inside a `schedule` sleep window the screen is black with a 20 % clock that drifts; that is the sleep
  state (§4.3), and the deepest burn-in protection available to a web page.
- No static white areas: every preset is dark surfaces with the video; the light theme (admin's choice) inverts the
  strip only, the video area stays black.

Honest limit: a browser cannot turn the backlight off. A kiosk browser app (Fully Kiosk, the HA Companion's kiosk
mode, Android's screen-off intents) can, and the install guide shows how to map "sleep" to it via the page's
`document.title` / a `postMessage` (`{type: "arx-wall", state: "sleep" | "wake"}`) that such apps can read - we emit
it from day one, we do not depend on it.

### 4.3 Auto wake / sleep schedule

Weekly windows in the installation's time zone (`time.zone`, IANA; never a fixed offset): e.g. awake Sun-Thu
07:00-20:00, Fri 07:00-14:00, asleep otherwise. Sleep = black screen, drifting dim clock, streams **closed** (the NVR
and relay carry nothing for a screen nobody looks at), WebSocket kept open with a slow heartbeat (so an alert can
wake it). Wake on: a schedule edge; an alert of severity ≥ `wake_on_alert_severity` (default critical - a door left
open at 03:00 does not light a corridor, a leak does); a touch when `wake_on_touch` (wakes for 10 minutes, then the
schedule decides again). The schedule uses the scheduler's own weekly-window editor (CR-014 `sw-week-grid`), so the UI
is one we already have.

### 4.4 Offline behaviour

The display distinguishes three things and shows each honestly (DESIGN_CONTRACT: offline / current / historical /
unknown visibly distinct):

| Situation | Detection | What the display shows |
|---|---|---|
| One camera's stream stalls | no frame for 8 s (one GOP) on that tile | the tile keeps its last frame **dimmed with a diagonal hatch** and a badge "אין וידאו · 12:04:31" (the time of the last frame); reconnect with backoff 2 / 4 / 8 / 15 s; after 60 s (`show_last_frame_s`) the frame is replaced by the camera's name on a dark tile - a stale frame is never shown as if it were live |
| The server is unreachable | WebSocket closed and `/wall/me` fails 3 times (≈ 15 s) | a top banner "אין חיבור למערכת · מנסה שוב" replaces the chips; every tile goes to the stale state at once; after 2 minutes the display goes to the clock state (black, big clock, the banner) so nobody reads an old picture as current; reconnect every 5 s, then 15 s after 5 min; on reconnect it reloads its config (it may have been edited meanwhile) |
| The token is refused | 401 / 403 from `/wall/me` | the pairing screen (revoked) or the paused screen (§3.6) - immediately, not after a timeout |

No local cache of alerts across a disconnect: alerts are re-fetched on reconnect, and an alert that resolved while the
display was offline is never raised late.

## 5. Alert tiles and takeover (WDX)

### 5.1 What raises them

Alert tiles are a **delivery channel of CR-018** (like the in-app centre, push and email), not a parallel system: the
notification core evaluates sources, dedupes, folds and resolves exactly as it does for people; the `wall` channel
delivers to displays whose `alerts.enabled` is on and whose scope matches the item's subject. Sources that reach a
display in v1 (all existing CR-018 source keys): `safety.*` (leak, smoke, gas, CO, alarm triggered), `doors.left_open`,
`rule.alert` for the display's cameras (motion / person / line crossing when a rule says so), `camera.offline` for the
display's cameras, `nvr.offline` / `nvr.storage` (installation-wide, shown to every display with `device_faults`),
`security.*` (alarm armed/disarmed failed, tamper), `intercom.ring` (WisKey doorbell - shown, never answered from the
wall). Automations / scheduler / system / backup items **do not** go to a wall (a corridor screen is not where a backup
failure belongs).

### 5.2 Priority ladder

| Severity | Presentation | Returns to base |
|---|---|---|
| `info` | a chip in the strip ("דלת כניסה נפתחה") for 20 s | by itself |
| `alert` | an **alert tile** replaces the top-start cell of the grid (the cell with the first camera): icon, type, place, time, the related camera's live video inside the tile when the subject is one of the display's cameras, buttons (§5.4); other tiles stay | on ack / resolve, or after `takeover_timeout_s` (120 s) it folds into a strip chip and the cell returns to its camera |
| `critical` | **takeover**: the whole screen is the alert - full-bleed related camera (or a dark field with the icon when there is none), the type and place in the largest type the preset has, a danger-coloured edge pulse (2 s cycle, stops after 60 s to limit distraction and burn), the buttons; the strip clock stays at the top | only on ack or resolve - a critical item never times out on a wall; if several criticals are open they stack as a list in the takeover with the newest first |

Several `alert` items: the alert tile shows the newest with a count badge ("+2"); a tap cycles. The wall preset has an
alert **column** instead of replacing a cell: items stack there (newest on top, max 6, then "+n"), and only `critical`
takes over. Reason: a 1920-wide wall has room, and a control room wants history-at-a-glance; a tablet does not.

Sound: off by default; when on, one short tone (no loop) for `alert`, a 3-tone pattern repeated every 30 s until ack for
`critical`. The tone is a bundled file (no network). Browsers block audio until a gesture; the install guide says to tap
the screen once after loading (the page shows "הקש פעם אחת להפעלת צליל" until it has been allowed).

Wake: an item of severity ≥ `wake_on_alert_severity` wakes a sleeping display (§4.3); the takeover is the first thing
it shows.

### 5.3 Dedupe, fold, resolve

Taken from the core: the display shows one tile per dedupe key; a repeat within the fold window bumps the time and the
count badge. A `resolve` (door closed, camera back, alarm disarmed) removes the tile and shows a 5 s strip chip
"נסגר · דלת מחסן". The display never raises an item that resolved before it was delivered (§4.4).

### 5.4 Acknowledge

Two buttons on an alert tile / takeover: **"ראיתי"** (seen) and, only when `ack_allowed`, **"אישור"** (acknowledge).

- "ראיתי" is local to the display: it collapses the tile to a chip for `takeover_timeout_s` and does not touch the
  core. A critical item comes back as a takeover when the chip's time is over. It exists so a passer-by can see the
  cameras behind a non-critical alert without having the authority to close it.
- "אישור" acknowledges in the core exactly like a person's ack (escalation stops, the item leaves the centre's open
  list), with the actor recorded as the **display** (`wall.alert.ack`, device id and name). Default **off** because an
  acknowledge is an accountable act and a wall is anonymous; the owner turns it on for a staffed desk (reception, a
  control room) where the device *is* the position. When it is on, a confirmation is required: the button needs a
  press-and-hold of 1.5 s (the tile's edge fills), which is the wall's equivalent of the operator's "critical action
  confirmation" - a brush of a sleeve must not acknowledge a leak.

No "open door", "disarm", "silence siren" on a wall, ever (§3.4).

### 5.5 Return to base

After ack / resolve / timeout the layout returns to the exact base state (same page of the rotation, same shuffle
position) with a 300 ms cross-fade. If the display was in picture-frame mode before the alert, it returns to the
cameras, not to the photos, and the idle timer starts again - the photos come back after `idle_min` quiet minutes.

## 6. Picture-frame mode (WDX)

### 6.1 Behaviour

When `frame.enabled` and nothing has needed attention for `idle_min` (default 10) minutes - no open alert of severity
≥ `alert`, no touch - the display cross-fades to photos: one photo every `interval_s` (30) seconds, `fit: contain` on
black (default; `cover` is a choice) with the clock and date in a corner (`frame.clock`), no camera, no chips. Order is
a random permutation per cycle (no repeats until the folder has been shown). A touch returns to cameras for 10 minutes.
Any alert ≥ `alert` returns to cameras immediately with the alert tile; `info` does not interrupt the photos (a strip
chip is shown over the photo). Sleep windows win over the frame (black beats photos at night). Pixel shift and dim
apply in frame mode too; the Ken Burns effect is **off** by default (`motion: "none" | "slow"`): it costs GPU on a cheap
tablet, and a slow pan over a photo is also the classic way to turn a tablet into a heater.

### 6.2 Photo source

The administrator chooses **one folder** per display from the server's media library (the HA media source the product
already reads for the media screens, path form `media-source://media_source/local/...`) **or** the product's own
"תמונות למסכי קיר" folder (`/share/smplwise/wall-photos/<set>/`) that Settings can upload into (≤ 200 files per set,
JPEG / PNG / WebP, ≤ 8 MB each; the server makes a 1920-wide cached rendition, strips EXIF - location and camera make
never reach the tablet). The display gets a signed list (`GET /wall/frame/list` → `[{id, w, h}]`) and fetches
renditions through `GET /wall/frame/{id}` with its token; there is no direct media URL on the tablet and no path
leaves the server.

### 6.3 Privacy rules (hard)

- **Never camera material.** Snapshots, thumbnails, clips, case media and NVR exports cannot be chosen as a photo
  source; the picker simply does not offer those folders, and the server refuses any folder under the media roots that
  hold them (`403 frame_source_not_allowed`).
- A frame folder is an **administrator** choice and is audited (`wall.frame.folder_set`, path at the folder level).
- The same folder may be used by several displays; deleting a set that a display uses turns that display's frame off
  with a status note in the list ("תיקיית התמונות נמחקה").
- No face detection, no captions, no map of where a photo was taken.

## 7. Data model and API sketch

### 7.1 Tables (migration `0058`; numbering to be confirmed at build time against `integ/*`)

```sql
CREATE TABLE wall_pairings (
  id TEXT PRIMARY KEY,                    -- ulid
  code_hash TEXT NOT NULL,                -- sha256(six digits)
  secret_hash TEXT NOT NULL,              -- sha256(pair_secret)
  hint_json TEXT NOT NULL,                -- {ua, screen:{w,h,dpr,orientation}, tz, channel}
  state TEXT NOT NULL,                    -- pending | claimed | approved | denied | expired
  claimed_by TEXT, claimed_at TEXT,
  device_id TEXT,                         -- set on approve, the token is delivered on the next poll
  created_at TEXT NOT NULL, expires_at TEXT NOT NULL, delivered_at TEXT
);
CREATE UNIQUE INDEX wall_pairings_code ON wall_pairings(code_hash) WHERE state IN ('pending','claimed');

CREATE TABLE wall_devices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  area_id TEXT, floor_id TEXT,
  config_json TEXT NOT NULL,              -- section 4, validated by a pydantic model
  hint_json TEXT NOT NULL,                -- last reported screen / ua / tz
  status TEXT NOT NULL,                   -- active | paused | revoked
  remote_allowed INTEGER NOT NULL DEFAULT 0,
  last_seen_at TEXT, last_channel TEXT, last_ip_class TEXT,   -- 'local' | 'remote' (never the address)
  created_at TEXT NOT NULL, created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL, revoked_at TEXT, revoked_by TEXT
);
-- alerts delivered to a display are rows of the CR-018 delivery table with channel = 'wall' and target = device id;
-- no new table. Settings rows: wall.enabled (true), wall.inactive_days (90), wall.photo_sets_root, wall.max_devices (20).
```

### 7.2 Routes (`/api/v1/wall/*`; the `wall` resolver runs only here)

| Route | Caller | Purpose |
|---|---|---|
| `POST wall/pair/start` | anonymous, rate-limited 10/min per installation | new pairing; returns code + pair_secret + expires_at |
| `GET wall/pair/{id}?s=` | the tablet | poll: pending / claimed / approved (+ token once) / denied / expired |
| `POST wall/pair/claim {code}` | admin (`system.configure`) | find the pending row, hold it, return the hint |
| `POST wall/pair/{id}/approve {config}` | admin | create the device; the next poll delivers the token |
| `POST wall/pair/{id}/deny` | admin | deny (the tablet shows "הצימוד נדחה") |
| `GET wall/devices`, `GET wall/devices/{id}` | admin | the list (§8) and one device |
| `PATCH wall/devices/{id}` | admin | config / name / paused / remote_allowed (audited diff) |
| `DELETE wall/devices/{id}` | admin | revoke |
| `POST wall/devices/{id}/rotate-token` | admin | §3.3 |
| `POST wall/devices/{id}/preview` | admin | asks the display to show a 5 s "זה המסך" overlay with its name (identify) |
| `GET wall/me` | display token | the device's config, server time, the installation's zone, the current alert list |
| `GET wall/stream/{camera_id}` | display token | the live ticket for a camera on the allow list (same go2rtc ticket flow the live wall uses; sub profile) |
| `GET wall/alerts`, `POST wall/alerts/{id}/ack`, `POST wall/alerts/{id}/seen` | display token | §5 (`ack` needs `ack_allowed`, press-and-hold is client-side; the server enforces the flag) |
| `GET wall/frame/list`, `GET wall/frame/{photo_id}` | display token | §6 |
| `WS wall/ws` | display token (first message) | server → display: `config` (edited), `alert` / `resolve`, `identify`, `revoked`, `rotate_token`, `sleep` / `wake` (schedule edges computed server-side so every display of a building wakes together); display → server: `hello {screen}`, `heartbeat {state}` every 30 s (feeds `last_seen_at`, the list's state column) |
| `GET wall/photo-sets`, `POST wall/photo-sets/{set}/upload`, `DELETE ...` | admin | §6.2 |

Unknown / revoked tokens: 401 `display_unknown` / `display_revoked`; paused: 403 `display_paused`; remote not allowed:
403 `display_remote_not_allowed`. The frontend shows one screen per code (§9 error states).

### 7.3 Frontend

A separate entry `frontend/src/wall/` (its own `index.html` → `/wall`), **not** the shell: no rail, no router, no user
menu, no service worker registration of the app (its own minimal SW caches the bundle and the tone file for the
offline banner). Shares `design/tokens.ts` and the skin layer (`data-skin`, `data-theme` on `<html>` - so classic /
domus / tesla / bubble skins apply to the strip and tiles exactly as they do in the app), `sw-camera-tile`, the live
transport (`api/media.ts` with the token instead of the cookie) and the icon set. Playwright evidence spec
`frontend/tests/evidence-wall.spec.ts` renders every state of §9 at the three viewports × 2 skins × light / dark.

Settings screen `frontend/src/screens/system-wall.ts` (list, add-display dialog, device drawer with the sections of §4,
photo sets), route `#/system/wall`, tab "מסכי קיר" in the settings navigation (TABS_CONFIG entry).

## 8. Settings › מסכי קיר (device management)

The list (a table on desktop, cards on a phone - mobile uses cards, never a shrunken table):

| Column | Content |
|---|---|
| מסך | name, the place (area) under it, the preset icon (landscape / portrait / wall) |
| מצב | **מחובר** (heartbeat < 90 s, live colour), **ישן** (sleep window, offline colour with a moon), **מושהה**, **מנותק** (no heartbeat 90 s - 90 days, stale colour, "נראה לאחרונה לפני 3 שעות"), **לא פעיל** (> `inactive_days`), **הוסר** (revoked, 30 days, grey) |
| נראה לאחרונה | relative + exact on hover; the channel (מקומי / מרחוק) as a small chip when remote |
| מצלמות | count + the first two aliases |
| התראות | on / off, "אישור מותר" chip when `ack_allowed` |
| פעולות | identify (shows "זה המסך" on the display), edit (drawer), pause / resume, revoke (confirmation dialog: name + "המסך יראה את מסך הצימוד תוך 15 שניות") |

Above the list: the "הוספת מסך" button (the code form) and a one-line count ("4 מסכים · 3 מחוברים"). Empty state: a
single card "אין מסכי קיר" with the button and one line of what a wall display is. The list polls every 15 s while
open (heartbeats), no WebSocket.

The device drawer has five sections in this order: **מסך** (name, area, remote, pause), **מצלמות ופריסה** (camera
picker with the area tree - the tree *is* kept here, it is a person's navigation -, order, preset, grid, rotation,
strip chips, theme), **התראות** (§5 fields), **תמונות** (§6 fields, the set picker, a six-thumbnail preview),
**שעות ושמירה על המסך** (schedule editor, burn-in, offline). Save is one button; the display applies the new config
live over its WebSocket and shows a 3 s "ההגדרות עודכנו" chip.

## 9. States the display renders (each is a mockup screen)

`pairing` (code shown; waiting; approved → "מתחבר…"), `pairing-expired`, `pairing-denied`, `pairing-network`
(cannot reach the server at all: "אין חיבור לשרת · בדוק את הרשת", retry by itself), `base` (per preset),
`rotating` (page dots), `alert-tile`, `takeover`, `takeover-stack`, `info-chip`, `frame`, `frame-info-chip`, `dim`,
`sleep`, `camera-stale`, `camera-lost`, `server-offline`, `server-offline-clock`, `revoked`, `paused`,
`remote-refused`, `no-cameras` (a device with an empty allow list: the strip and "לא הוגדרו מצלמות למסך הזה"; the admin
sees the same note in the list), `identify`, `installer-info` (long-press), `sound-locked`.

## 10. Slices and estimates

WDM (board 44 h) and WDX (board 15 h); the estimates below sum to 55 h, under the boards' 59 h. The slices are
independent enough for separate branches with one owner for the API / DB (S1).

| Slice | Content | Hours | Model |
|---|---|---|---|
| S1 pairing + token + principal | tables, `services/wall.py` (pairing lifecycle, token hash, throttles, janitor), the `wall` resolver on the wall router only, `/wall/me`, `/wall/stream`, audit rows, the hard deny list | 10 | Fable |
| S2 Settings › מסכי קיר | list, add-display dialog (code entry, hint, the §4 form), device drawer, identify / pause / revoke / rotate, photo sets upload, TABS_CONFIG entry, user-guide page | 9 | Sonnet |
| S3 the display | `frontend/src/wall/` entry, the four presets, strip chips, rotation, the token store, reconnect ladder, config-live-update over WS, installer long-press, the skin layer | 10 | Sonnet (Fable review of the presets) |
| S4 burn-in, schedule, offline | pixel shift, shuffle, dim, sleep / wake with server-computed edges, the three offline states, the kiosk-app `postMessage` | 6 | Sonnet |
| S5 evidence + hardening | `evidence-wall.spec.ts` at 3 viewports × skins × schemes, backend tests of §11, security review of the resolver, release notes, SCREEN_CATALOG addendum | 5 | Opus (review) + Sonnet |
| S6 alert tiles + takeover (WDX) | the `wall` channel in the notification core, scope filter, the tile / column / takeover, seen vs ack with press-and-hold, sound, wake on severity, return to base | 9 | Fable |
| S7 picture frame (WDX) | photo sets + renditions + EXIF strip, the allowed-sources rule, list / fetch with the token, the frame renderer, idle / interrupt / sleep precedence | 6 | Sonnet |

Order: S1 → S2 ∥ S3 → S4 → S5 (WDM release, 2.3.0) → S6 → S7 (WDX, may ride the same release when S5 is green early).

## 11. Tests

Backend (fixtures, no device):
- pairing: code format (six digits, zero-padded), single use, expiry at 10 min, the secret guards the poll, the
  throttles (5 / admin, 20 / installation), claim → abandon → pending again, approve delivers the token exactly once
  (a second poll has no token), deny.
- token: hash at rest, unknown-token counter → 429, a wall token refused on every non-wall route (parametrised over
  the same list `test_kiosk_role` uses plus `/media/live`, `/events`, `/notifications/*`), revoked → 401 with the
  code, paused → 403, remote channel without `remote_allowed` → 403 and the audit row, rotate-token invalidates the
  old hash.
- capabilities: `/wall/stream/{cam}` 200 only for cameras on the list, 404 for others (not 403 - the display must
  not learn which cameras exist), `/wall/alerts` scoped to the list / area, `ack` 403 without `ack_allowed`, the
  hard deny list is a constant checked against `roles.json` so a new permission cannot leak in.
- alerts: a `wall` delivery for each source key of §5.1; severity ladder → the payload's `presentation`; resolve
  removes; items resolved before delivery are not delivered; `wall.alert.ack` audit row with the device as actor;
  escalation stops on a display ack.
- frame: sources under camera / case / export roots refused; EXIF stripped in the rendition; the list is per device;
  a deleted set switches the frame off.
- schedule: edges computed in `time.zone` across a DST change (Israel, 2026-03-27 and 2026-10-25); wake on severity.
- janitor: revoked rows pruned at 30 days; expired pairings pruned.

Frontend (Playwright, static fixtures + the evidence spec against the dev backend):
- every state of §9 at 1280×800, 800×1280, 1920×1080 × {classic, bubble} × {light, dark}; no horizontal overflow;
  touch targets ≥ 44 px; the clock is the largest text; video and map not mirrored.
- the reconnect ladder with a mocked WebSocket; the stale → lost transition at 60 s; the takeover never times out
  for critical; press-and-hold ack needs 1.5 s; the frame yields to an alert and to a sleep window.

Lab (owner's tablet, read-only): pair, revoke, re-pair; sub-stream count on the real NVR at 2×2 and 3×2 for 30 min
(F15 check); a night of pixel shift on the owner's tablet (visual check in the morning).

## 12. Risks and honest limits

| Risk | Mitigation / limit |
|---|---|
| A tablet left on a public wall is a camera viewer for anyone who walks by | that is the product: the admin chooses the cameras; a display never shows playback, exports, other areas or any control; the audit shows what each display is allowed |
| The token is copied off the tablet (IndexedDB is readable with a cable and developer tools) | the token only works on `/wall/*`, only on the local channel unless `remote_allowed`, and is revoked in one tap; rotate-token exists; the install guide recommends a kiosk browser with the storage locked |
| Six digits are guessable | 20 attempts / 10 min per installation on an **admin-only** form, 10-minute code life, single use; the code is a convenience for a person already holding `system.configure`, not the security boundary |
| Too many sub streams stall (F15) | presets cap at 6 tiles on tablets; 12 on a wall is allowed but flagged in Settings ("מעל 6 זרמים - בדוק שהמקליט עומד בעומס"); `main` is not offered in v1 |
| Browser cannot sleep the screen | the sleep state is black + a dim clock; a kiosk app can act on the emitted `postMessage` / title; documented, not promised |
| Audio needs a gesture | the "tap once" note; sound is off by default |
| Alerts raise on a wall what CR-018 decided for people; a noisy rule becomes a noisy wall | per-device categories and min severity; the alert tile never covers more than one cell except critical; a rule's `cooldown_s` applies |
| Picture frame leaks private photos to a corridor | admin-only source choice, audited, EXIF stripped, camera material impossible by construction |
| DST / zone bugs in the schedule | server computes edges in `time.zone`; tests at the two Israeli transitions |
| The direct add-on port must be reachable from the tablet's Wi-Fi | install guide; if the installer only has the tunnel, `remote_allowed` is the knob, taken knowingly |

Not built in this CR: any control from the wall, playback, two-way audio, a per-person unlock of the tablet, the
reverse pairing direction (§3.2), the `main` stream profile on walls, hardware brightness, multi-server displays.

## 13. Design decisions taken without the owner (with reasons)

| # | Decision | Reason |
|---|---|---|
| 1 | The tablet shows the code, the admin types it in Settings | no typing on a keyboard-less device; the approver is the authenticated party; seeing the code proves which tablet |
| 2 | A display is a machine principal, not an HA user | HA is the human identity source; a tablet with an HA account is a tablet that can open HA |
| 3 | Default `remote_allowed: false` | a wall does not travel; a token seen from the internet is a copied token |
| 4 | No control from the wall, hard-denied in the resolver | a corridor screen is reachable by anyone; accountability needs a person |
| 5 | Ack off by default; press-and-hold when on; "seen" always available | an acknowledge is accountable; a sleeve must not ack a leak; a passer-by still needs to see the cameras |
| 6 | Critical never times out; alert folds after 120 s | a wall is unattended: a stuck takeover hides cameras, but a leak must not be hidden by a timer |
| 7 | Alerts are a CR-018 channel, not a new engine | one place decides what is an alert; the wall only renders |
| 8 | Dark theme by default on displays | video on black, fewer lit pixels, distance legibility |
| 9 | Explicit camera list, area as a shortcut only | an allow list is what the audit and the resolver can reason about |
| 10 | No area tree on the display; a map band on the portrait preset | the tree is navigation for people; the display's spatial context is the map band |
| 11 | Photos only from admin-chosen folders, camera material impossible | privacy by construction, not by policy |
| 12 | Ken Burns off, pixel shift on, shuffle hourly | cheap tablets, years on a wall |
| 13 | `sub` streams only in v1 | the F15 stall measurement; `main` is a measurement, not a checkbox |
| 14 | Schedule reuses the CR-014 weekly editor | one editor for weekly windows in the product |
| 15 | Wall preset gets an alert column, tablets an alert cell | room on a 1920 wall; a tablet cannot spare a column |

---

## תקציר בעברית (CR-030 — מסך קיר)

**מה זה.** מצב תצוגה לטאבלט קבוע בקיר: המסך מראה את המצלמות והמצב של המקום שלו, בלי משתמש מחובר ובלי חשבון של
תשתית המערכת על המכשיר, ובלי שום דרך לשנות משהו מהמסך. בהמשך (WDX): אריחי התראה ומצב מסגרת תמונות.

**צימוד.** הטאבלט פותח `/wall` ומציג קוד בן שש ספרות (תוקף 10 דקות, חד-פעמי). מנהל מערכת נכנס להגדרות › מסכי קיר ›
"הוספת מסך", מקליד את הקוד, רואה את פרטי המסך (גודל, כיוון, דפדפן), ממלא שם, מקום, מצלמות, פריסה והתראות ושומר. הטאבלט
מקבל אסימון מכשיר (מוצג פעם אחת, נשמר מגובב בשרת) ועובר לתצוגה. 5 ניסיונות שגויים למנהל / 20 להתקנה ב-10 דקות חוסמים
את הטופס ל-10 דקות. ההחלטה: הטאבלט מציג והמנהל מקליד - אין הקלדה על מכשיר בלי מקלדת, המאשר הוא זה שמזוהה, ומי שרואה את
הקוד על המסך הפיזי יודע איזה טאבלט הוא מצמד.

**אבטחה.** מסך הוא ישות מכונה, לא משתמש. היכולות שלו נגזרות רק מהרשומה שלו: רשימת מצלמות מפורשת, אזור, קריאת מצב של
עד 8 התקנים, צפייה בהתראות (קטגוריות וסף), אישור התראות (כבוי כברירת מחדל). אסור לעולם: הקלטות, ייצוא, שליטה בהתקנים,
פתיחת דלת, דריכת אזעקה, הגדרות. האסימון תקף רק בנתיבי `/wall/*` ורק בערוץ המקומי, אלא אם סומן "מותר מרחוק" למסך
הזה. ביטול - בלחיצה אחת, מיידי; המסך מציג "המסך הוסר" וכפתור צימוד מחדש. הכול ביומן הביקורת (`wall.*`), בלי קוד ובלי
אסימון.

**הגדרות לכל מסך.** שם, מקום, מצלמות וסדר, פריסה (אוטומטית לפי גודל וכיוון: טאבלט לרוחב 1280×800, טאבלט לאורך
800×1280, קיר 1920×1080, מצלמה אחת), דפדוף בין עמודים, שורת מצב (שעון, תאריך, מזג אוויר, בריאות, אזעקה), ערכה (כהה
כברירת מחדל), התראות, תמונות, הגנה על המסך (הזזת פיקסלים, ערבוב אריחים, עמעום), לו"ז ערות/שינה שבועי (באזור הזמן של
ההתקנה), התנהגות בניתוק (פריים אחרון מעומעם עם שעה, אחרי דקה שם מצלמה על רקע כהה; שרת לא זמין - באנר, ואחרי 2 דקות
מסך שעון; לעולם לא פריים ישן כאילו חי).

**אריחי התראה (WDX).** ערוץ מסירה של מרכז ההתראות הקיים: מידע = צ'יפ בשורת המצב ל-20 שניות; התראה = אריח במקום התא
הראשון (עם הווידאו של המצלמה הקשורה), מתקפל אחרי 120 שניות; קריטי = השתלטות על כל המסך עד אישור או סגירה, בלי פסק
זמן. "ראיתי" תמיד זמין (מקומי); "אישור" רק כשהמנהל הפעיל למסך הזה, בלחיצה ארוכה של 1.5 שניות, ונרשם ביומן עם המסך
כמבצע. בקיר 1920 - עמודת התראות בצד במקום אריח.

**מסגרת תמונות (WDX).** אחרי 10 דקות שקט - תמונות מתיקייה שהמנהל בחר (ספריית המדיה או סט שהועלה בהגדרות), 30 שניות
לתמונה, EXIF מוסר, לעולם לא חומר מצלמות (השרת מסרב לתיקיות כאלה). כל התראה ברמת "התראה" ומעלה מחזירה למצלמות מיד;
נגיעה מחזירה ל-10 דקות; חלון שינה גובר על התמונות.

**פרוסות.** S1 צימוד+אסימון+ישות (10 ש'), S2 מסך ההגדרות (9), S3 התצוגה והפריסות (10), S4 הגנה/לו"ז/ניתוק (6),
S5 ראיות והקשחה (5) - גרסה 2.3.0; S6 אריחי התראה (9), S7 מסגרת תמונות (6). סה"כ 55 שעות מול 59 בלוח.

**מגבלות כנות.** דפדפן לא יכול לכבות תאורה אחורית (מצב השינה הוא מסך שחור; אפליקציית קיוסק יכולה להגיב להודעה
שאנחנו שולחים); צליל דורש נגיעה ראשונה; רק זרם משני בגרסה 1 (מדידת F15); "מקומי" פירושו "לא דרך המנהרה", לא טווח
כתובות; אסימון שהועתק מהטאבלט בכבל עובד עד הביטול - לכן ביטול בלחיצה אחת ומומלץ דפדפן קיוסק נעול.
