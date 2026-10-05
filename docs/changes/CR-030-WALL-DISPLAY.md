# CR-030 — Wall display mode: a wall user on a tablet, switched on by detection

**Numbering:** registered as CR-030 on 2026-10-05 (CR-027 mobile presence, CR-028 cast to screens, CR-029 reserved by the
board for TOU billing). Board items **WDM** (wall display mode, L) and **WDX** (picture-frame mode and alert tiles, M),
both planned for 2.3.0. Branch `pilot/wall-display-design` (from `origin/main` at 2.0.1).

**Revision 2 (2026-10-05, after the owner's review of revision 1):** the pairing-code flow, the machine principal with a
device token, the per-device registry, the 1920x1080 wall template and every idea of a dedicated TV app are **removed**.
A wall tablet is a **user** (the existing `kiosk` role), recognised because that user signs in on a **tablet**; a TV shows
cameras by **casting** (CR-028). Section 14 lists exactly what was removed and what replaced it.

**Status:** design and change request only - no product code, no migration, no device access. Every open point is decided
here, with its reason, in the product's design language (DU1: one structure, skins on top, light and dark from day one,
the area tree kept where a tree makes sense). Mockups: `docs/design/mockups/wall-display/` (entry `index.html`), copied
for review to `private/review/wall-display/`.

**Related:** SC31 (kiosk / wall display, `#/kiosk/:view`, T057) which this CR supersedes for fixed tablets; the `kiosk`
role (`smplwise_vms/backend/smplwise/roles.json`, `tests/test_kiosk_role.py`); CR-001 / `docs/security/HA_IDENTITY_RBAC_HE.md`
(HA is the identity source; bindings with scope); CR-008 (remote login, session cookie, 60 s revalidation); CR-018
(notification core - alert tiles are a notification channel); CR-028 (cast to screens - how a TV shows our video).

---

## 1. Goals

1. A tablet screwed to a wall (reception, corridor, control room, kitchen) shows the cameras and state of **its** place,
   without a person operating it and without any way to change the system from that screen.
2. Setup takes one minute and needs no new concept: an administrator picks a user (or creates one in the system
   infrastructure first), gives it the wall configuration in Settings, and on the tablet someone types that user's name
   and password once. The tablet has a keyboard (on-screen), so nothing special is needed.
3. The tablet **switches to wall mode by itself** when a wall user signs in on a tablet-class device. On a phone or a
   desktop the same user simply sees the normal application limited by the `kiosk` role; the wall interface is not offered
   there at all.
4. What the wall user may see is the existing mechanism: the `kiosk` role (live video and map only) bound at a scope
   (floor / camera), plus the per-user wall configuration (areas, cameras, alerts, photos, hours). Revoked by switching the
   user off or removing it.
5. The layout follows the tablet: landscape (1280x800 and up) and portrait (800x1280), or a single camera; an
   administrator may pin one. Readable from across a room, not a shrunken desktop.
6. A display that hangs for years: burn-in protection, a wake / sleep schedule, honest offline behaviour (never a stale
   frame presented as live), a session that survives reloads and power cuts.
7. (WDX) Alert tiles - the display raises what is happening in its area (door left open, leak, camera offline, alarm
   triggered) with a priority ladder from a chip to a full takeover, and returns to its base layout by itself.
8. (WDX) Picture-frame mode - when nothing happens the display shows photos from a folder the administrator chose, never
   camera frames, and drops back to cameras the moment something needs attention.

Non-goals: control from the wall (no lights, locks, alarm, PTZ, talk), playback, two-way audio, a dedicated TV application
or a 1920x1080 "wall template" (a TV shows video by cast, CR-028), a wall interface on phones, screen brightness /
hardware control (a browser cannot; the install guide says what a kiosk browser app can add), Lovelace
surfaces (SC32 stays as it is).

## 2. What exists today and why it is not enough

- `#/kiosk/all?cameras=...&cols=&rows=&rotate=` (SC31) is a **URL** rendered for a signed-in user bound to the `kiosk` role.
  Problems: the layout is a URL anyone can edit on the tablet; nothing is stored per user (cameras, order, rotation, hours
  are browser-local); no alerts; no photos; no schedule; no burn-in protection; the user has to know the URL.
- The `kiosk` role (`map.read`, `video.live`) is right in spirit and `test_kiosk_role.py` proves a kiosk user cannot reach
  events, settings, exports, playback or HA control. **This CR keeps that principal as is** and only adds what a wall needs
  on top of it (section 3.3). No new credential type, no token, no pairing.
- The remote channel (CR-008) already gives a typed login, a "keep me signed in" session with a 90-day refresh token and
  a 60-second revalidation of revoked users. A wall tablet uses exactly that.

## 3. Security model

### 3.1 Principal: an ordinary user bound to the `kiosk` role

A wall user is a **Home Assistant user** (CR-001: HA is the only human identity source, no new password system) that an
administrator binds to the existing `kiosk` role at a scope - the usual `bindings` row (`subject_kind = user`,
`role_id = kiosk`, scope `floor` or `camera`). The Settings screen of section 8 does the binding and the wall
configuration in one transaction, so the administrator never visits the generic access screen for this. Creating the HA
user itself stays in the system infrastructure (the product never creates accounts, CR-001): Settings shows the list of
existing users that are not yet wall users, and a one-line note for the case "the user does not exist yet".

Why a user and not a machine credential (revision 1): a user already has everything a wall needs - a typed sign-in on a
device with a keyboard, a persisted session, revocation (HA deactivation, binding removal), audit with a real actor, MFA
policy, and a role that already is the ceiling. A shown-once device token, a pairing handshake and a device registry
duplicated all of that for no gain the owner asked for.

### 3.2 Sign-in, detection and the automatic switch

1. Someone types the wall user's name and password on the tablet in the **normal Arx login** (CR-008; on the local channel
   it is the same login screen served by the add-on, nothing new). "Keep me signed in" is on by default for a user that has
   a wall profile (the login screen learns this only after sign-in, so it is simply defaulted on for everybody and
   unticked by anyone on a shared device; the wall user's session is persistent regardless, section 3.4).
2. After sign-in the client calls `GET /api/v1/me`. For a user that has an **enabled wall profile** the answer carries
   `wall: {enabled: true, profile_version}` (no configuration; the configuration is fetched only in wall mode).
3. The client classifies the device with the rule of section 3.2.1. **If the class is `tablet` and `wall.enabled`, the
   bootstrap mounts the wall shell instead of the application shell** (no rail, no router, no user menu), before any
   shell paints. In every other case the normal application is mounted, exactly as for any user of that role.
4. The classification is **presentation only, not a security control**: the server's authorisation never looks at it. A
   wall user on a phone or desktop has the same (small) permissions as on the tablet; they just see the ordinary screens,
   limited by the role. Nothing about the wall (configuration, alerts feed, photos) is offered to a non-tablet device by
   the client, and the wall endpoints answer the same user the same way - the point is that the wall is not meant there,
   not that it is forbidden there.

#### 3.2.1 The detection rule (documented, deterministic, unit-tested)

Inputs, all read from the physical device and **not from the viewport** (the on-screen keyboard, split screen and rotation
change the viewport but not these):

| Signal | Source |
|---|---|
| `touch` | `navigator.maxTouchPoints > 0` **and** (`matchMedia('(pointer: coarse)')` **or** `matchMedia('(hover: none)')`) - the *primary* pointer is touch (a Windows laptop with a touch screen reports a fine primary pointer and stays a desktop) |
| `short` | `Math.min(screen.width, screen.height)` in CSS pixels (physical screen, orientation independent) |
| `mobileUA` | `navigator.userAgentData?.mobile` when present, else `/Mobi|iPhone|iPod/` on `navigator.userAgent` (Android phones carry "Mobile", Android tablets and iPad do not; iPadOS 13+ reports a Mac user agent, which is why `touch` and `short` decide, not the UA alone) |

```
class = desktop   if not touch
        phone     if touch and short < 600
        phone     if touch and mobileUA and short < 700      // large phones, a folded foldable
        tablet    otherwise                                   // touch, short >= 600 (7" and up), or >= 700 even with a Mobile token
```

Worked table (the unit test is this table): iPad Air Safari 820x1180 with a Mac UA and 5 touch points -> tablet; iPad mini
744x1133 -> tablet; Galaxy Tab A9 800x1340 (no "Mobile") -> tablet; Fire HD 8 800x1280 (Silk) -> tablet; a 7" Android
600x1024 -> tablet; iPhone 15 393x852 -> phone; Pixel 8 412x915 ("Mobile") -> phone; a foldable unfolded 673x841 with
"Mobile" -> phone (a deliberate choice: under 700 with a mobile token is a phone), an unfolded 904x1136 -> tablet;
Windows touch laptop (fine primary pointer) -> desktop; macOS / Linux / Windows desktop -> desktop; the same tablet with
the keyboard open (viewport 1280x400) -> still tablet because `short` is the screen. A Chromebook in tablet mode reports a
coarse pointer and is a tablet; in laptop mode a fine pointer and a desktop.

Evaluated on every load and on `orientationchange` (never flips on rotation: `short` is orientation independent). The
result is shown read-only in the installer panel (section 4.1) so a misclassified device is visible; there is no manual
override in v1 (a wall mini-PC with no touch is a desktop and gets the normal application; section 12 lists this).

### 3.3 What the wall user may do: the `kiosk` role is the ceiling

The role keeps `map.read` and `video.live`, and gains one **read-only** permission for the wall's own surfaces:
`wall.view` (the user's own configuration, the alert feed scoped to the user, the photo list and renditions) - nothing
else. `ROLES["kiosk"]` becomes `["map.read", "video.live", "wall.view"]` and `test_kiosk_role.py` keeps asserting the
exact list and that events, cases, storage, audit, backups, recordings, exports, HA actions, settings and anchors stay
`403`. A wall user therefore cannot open a door, switch a light, arm the alarm, play back or export **by design** - a wall
in a corridor is reachable by everyone who walks past it, and CR-007's "sensitive action needs a confirmation" assumes a
person who is accountable. If the owner later wants quick actions on a wall that is a new CR with a per-action PIN.

| Capability | Source | Notes |
|---|---|---|
| `video.live` on camera *C* | a **camera-scope `kiosk` binding** per camera on the user's list (written by Settings when the list is saved), or a floor-scope binding when the administrator picks "everything on this floor" | the existing scope mechanism (`bindings.scope_type = camera`, migration 0032) is the allow list and is enforced by the existing code; the wall configuration stores only the **order** and layout |
| `map.read` | the binding's scope; shown only when `show_map` | portrait preset only |
| state chips (clock, temperature, alarm state, door state) | `state_entities` (explicit, <= 8), read through the existing state read limited to those ids | `entity.state.read` is **not** granted to the role; the wall endpoint returns just the listed states (the server filters) |
| the alert feed | `wall.view` + `alerts.enabled` + `alerts.categories` + `alerts.min_severity` | scoped by the user's cameras / area (the CR-018 `row_scope` rule) |
| **acknowledge** | the profile flag `alerts.ack_allowed` (default **false**), checked by the server in `POST wall/alerts/{id}/ack` | **not** a role permission: the role stays read-only; the flag is an owner-level choice per wall user; the actor in the audit is the wall user, `details.via = "wall"` |
| photo frame | `wall.view` + `frame.enabled` | the folder is read through the server, never a direct media URL |

### 3.4 Session persistence, auto-login, sign-out

- The wall user's session is a normal CR-008 session: HA refresh token (90 days since last use), kept in `localStorage`
  (the "keep me signed in" mode), access token refreshed in the background. The wall page refreshes constantly, so a tablet
  that is on never expires; after a power cut or a browser restart it **resumes without anyone typing** (the stored refresh
  token is exchanged on load). A tablet that has been **off for more than 90 days** shows the login screen again.
- On the **local channel** (Ingress or the direct add-on port) the session is the HA session of that user in that browser
  - the same persistence, the same 90 days.
- There is **no sign-out on the display**: no user menu and no settings affordance (a passer-by must not be able to sign a
  wall out). The installer panel (long-press on the clock, read-only, closes after 10 s) has one control, **"יציאה"**, that
  asks for the wall user's password again (the normal login flow, so a passer-by cannot use it). Otherwise the session ends
  by administrator action (3.5) or by clearing the browser's site data.
- One user may be signed in on several tablets (same configuration on each; layout adapts to each screen). Two places
  that need different cameras need two users - the price of dropping the per-device registry, accepted because a user costs
  one row in Settings.

### 3.5 Revocation, disabling and removal

| Action (Settings) | Effect | Speed |
|---|---|---|
| **Switch the wall mode off** (`enabled = false`) | the profile stays; the next `/me` has no `wall`, the WebSocket sends `disabled`, the tablet drops to the normal application limited by the role (map and live) | seconds (WS) |
| **Remove the wall user** | the profile row is deleted, the `kiosk` bindings (role and cameras) are removed, the user's Arx sessions are dropped and their WebSockets closed with 4401; the tablet shows "הגישה למסך הזה הוסרה" with the login form | immediate on our side |
| **Deactivate the user in the system infrastructure** | the HA refresh token dies; on the **remote** channel CR-008's revalidation drops the session within 60 s; on the **local** channel the HA access token already issued stays valid for its lifetime (<= 30 min) | <= 60 s remote, <= 30 min local |

Honest limit (stated in the install guide): deactivating the HA user alone is not instant on the local channel; the Arx
"remove" action is, and is the one to use when a tablet is lost.

`remote_allowed` (per wall user, default **false**): on the remote channel the session exchange for a user that has a wall
profile is refused `403 wall_user_remote_not_allowed` (audited `wall.session.refused`) unless the flag is on. Reason: a wall
tablet does not travel; a wall user's password typed on a phone over the internet is a copied credential. The flag exists
for a display in another building that reaches the server only through the tunnel; the administrator turns it on knowingly.
Local means "arrived without passing the tunnel path" (Ingress or the direct port); the server cannot judge LAN ranges
(Docker rewrites addresses), and firewalling the direct port is the installer's job.

### 3.6 Audit

`wall.profile.create`, `wall.profile.update` (the diff of section 4 fields), `wall.profile.enable` / `.disable`,
`wall.profile.remove`, `wall.session.refused` (one row per user per 10 min, reason: remote_not_allowed / disabled),
`wall.alert.ack` (actor = **the wall user**, `details.notification_id`, `details.via = "wall"`), `wall.frame.folder_set`.
Rows carry the user and profile title; never a password, token, photo path or camera frame. The audit screen gets a filter
chip "מסכי קיר" (the `wall.*` prefix); no new audit screen.

## 4. Per-user wall configuration

Edited in **הגדרות › מסכי קיר** (`#/system/wall`, permission `system.configure` plus `rbac.assign` for the add / remove
step), in the add dialog and in the drawer afterwards. Operator-screen rules apply (short labels, no paragraphs); the
explanations below are for the developer and the user guide.

| Field | Values | Default | Why this default |
|---|---|---|---|
| `title` | text <= 40 | the user's display name | shown in the strip ("קבלה", "מסדרון קומה 2") |
| `area_id` | an area of the installation, or none | none | scopes alerts and the map band; the camera picker opens on this area |
| `cameras` | ordered list of camera ids, <= 12 | the area's cameras when an area is chosen | explicit allow list, enforced by camera-scope bindings (section 3.3) |
| `layout` | `auto` / `tablet-landscape` / `tablet-portrait` / `single` | `auto` | section 4.1 |
| `grid` | `auto` or `{cols, rows}` within the preset's range | `auto` | the preset decides from the camera count; pinning is for odd rooms |
| `rotate_s` | 0 / 15 / 30 / 60 / 120 | 0 when the cameras fit on one page, else 30 | more cameras than cells -> pages |
| `stream` | `sub` only | `sub` | the lab NVR / relay stalls above ~6 sub streams at once (live review F15); `main` on a wall is a later measurement, not a checkbox |
| `strip` | chips: clock, date, weather, alarm state, system health, up to 8 `state_entities` | clock, date, system health | the strip is the one non-video line; keep it short |
| `show_map` | bool | false | a map band only makes sense on the portrait preset |
| `theme` | `follow` (installation `ui.skin` / `ui.scheme`) / `dark` / `light` | `dark` | a wall is mostly video on black; dark burns less and reads from a distance |
| `alerts` | `{enabled, categories[], min_severity, ack_allowed, takeover_timeout_s, sound}` | enabled, {safety, alerts, doors, device_faults, security}, `alert`, ack **off**, 120 s, sound off | section 5 |
| `frame` | `{enabled, folder, idle_min, interval_s, fit, clock, motion}` | off, -, 10, 30, `contain`, on, `none` | section 6 |
| `burn_in` | `{shift: true, dim_after_min: 30, dim_to: 0.6, shuffle_h: 1}` | as shown | section 4.2 |
| `schedule` | weekly windows `[{days, from, to}]`, `wake_on_alert_severity`, `wake_on_touch` | always on, `critical`, true | section 4.3 |
| `offline` | `{show_last_frame_s: 60, then: "clock"}` | as shown | section 4.4 |
| `remote_allowed` | bool | false | section 3.5 |
| `enabled` | bool | true | section 3.5 |

### 4.1 Layout presets (tablets only)

`auto` picks by the viewport on every load and on `resize` / `orientationchange`, so turning the mount rotates the layout.
There is no TV / wall-monitor preset (section 1, a TV shows video by cast).

| Preset | Chosen when | Structure (RTL shell; video never mirrored) | Cells |
|---|---|---|---|
| `tablet-landscape` | landscape (1024x768, 1180x820, 1280x800, 1920x1200 large tablets) | top strip 56 px (place, clock, chips), video grid below | 1, 2 (1x2), 4 (2x2), 6 (3x2) |
| `tablet-portrait` | portrait (800x1280, 768x1024, 1200x1920) | strip 56 px, cameras stacked in one column at full width 16:9 (two at 800x1280; three on a tall 1200x1920 tablet; more cameras page with dots), then the **map band + state band** (map band when `show_map`), bottom status line | 1x2 (1x3 when the height allows) |
| `single` | one camera, or pinned | one tile full bleed, strip overlaid on the top edge | 1 |

Type and touch scale with the physical screen: `--wall-scale = clamp(1, short / 800, 1.4)`, chips 44 px on a 800-px-short
tablet. The strip's clock is the largest text on screen (what people read from a distance). The tile label (camera alias +
live / stale badge) sits inside the tile's bottom edge. There is no sidebar, no bottom bar, no user menu and no settings
affordance anywhere on the display - the only interactive elements are the alert tile's buttons (section 5.4), the page
dots (when rotating), and a long-press (1.2 s) on the clock that shows the **installer panel** for 10 s (user, profile
title, detected class and screen, channel, connection state, server version, session expiry; read-only, plus the
password-guarded "יציאה" of section 3.4).

Why no area tree on the display: the "keep the area tree" rule is for screens where a person navigates. A display has no
navigation; its scope is fixed by the administrator. The portrait preset's map band is the display's spatial context.

### 4.2 Burn-in protection (OLED and cheap LCD tablets alike)

- **Pixel shift**: the whole layout moves by (+-2, +-2) px on a 60 s cycle through 9 positions (CSS transform on the
  root, no reflow). Video tiles move with it.
- **Shuffle**: every `shuffle_h` hours the tile order rotates by one cell and the strip chips reverse order, so the static
  labels do not sit on the same pixels for days. Off when `grid` is pinned to a single tile.
- **Dim**: after `dim_after_min` minutes without touch and without an alert, the display fades to `dim_to` (0.6) and the
  strip clock goes to its outline style; any alert or touch restores full brightness.
- **Night**: inside a `schedule` sleep window the screen is black with a 20 % clock that drifts (section 4.3), the deepest
  burn-in protection available to a web page.
- No static white areas: every preset is dark surfaces with the video; the light theme inverts the strip only, the video
  area stays black.

Honest limit: a browser cannot turn the backlight off. A kiosk browser app (Fully Kiosk, the HA Companion's kiosk mode,
Android's screen-off intents) can; the install guide shows how to map "sleep" to it via a `postMessage`
(`{type: "arx-wall", state: "sleep" | "wake"}`) and `document.title` that such apps can read - we emit it from day one, we
do not depend on it.

### 4.3 Auto wake / sleep schedule

Weekly windows in the installation's time zone (`time.zone`, IANA; never a fixed offset): e.g. awake Sun-Thu 07:00-20:00,
Fri 07:00-14:00, asleep otherwise. Sleep = black screen, drifting dim clock, streams **closed** (the NVR and relay carry
nothing for a screen nobody looks at), WebSocket kept open with a slow heartbeat (so an alert can wake it). Wake on: a
schedule edge; an alert of severity >= `wake_on_alert_severity` (default critical - a door left open at 03:00 does not
light a corridor, a leak does); a touch when `wake_on_touch` (wakes for 10 minutes, then the schedule decides again). The
schedule uses the scheduler's own weekly-window editor (CR-014 `sw-week-grid`).

### 4.4 Offline behaviour

The display distinguishes three things and shows each honestly (DESIGN_CONTRACT: offline / current / historical / unknown
visibly distinct):

| Situation | Detection | What the display shows |
|---|---|---|
| One camera's stream stalls | no frame for 8 s (one GOP) on that tile | the tile keeps its last frame **dimmed with a diagonal hatch** and a badge "אין וידאו · 12:04:31" (the time of the last frame); reconnect with backoff 2 / 4 / 8 / 15 s; after 60 s (`show_last_frame_s`) the frame is replaced by the camera's name on a dark tile - a stale frame is never shown as if it were live |
| The server is unreachable | WebSocket closed and `/wall/config` fails 3 times (~15 s) | a top banner "אין חיבור למערכת · מנסה שוב" replaces the chips; every tile goes stale at once; after 2 minutes the display goes to the clock state (black, big clock, the banner); reconnect every 5 s, then 15 s after 5 min; on reconnect it reloads its configuration |
| The session is refused | 401 / 403 from `/me` or `/wall/config` | `401` -> the login form with "הגישה למסך הזה הוסרה" (removed) or the normal login (expired); `403 wall_user_remote_not_allowed` -> the explanatory screen of the mockups; wall mode switched off -> the normal application - immediately, not after a timeout |

When the page loads with **no** connection at all and has no session in memory it shows "אין חיבור לשרת" and retries by
itself. No local cache of alerts across a disconnect: alerts are re-fetched on reconnect, and an alert that resolved while
the display was offline is never raised late.

## 5. Alert tiles and takeover (WDX)

### 5.1 What raises them

Alert tiles are a **delivery channel of CR-018** (like the in-app centre, push and email), not a parallel system: the
notification core evaluates sources, dedupes, folds and resolves exactly as it does for people; the `wall` channel delivers
to wall users whose `alerts.enabled` is on and whose scope matches the item's subject, over the wall WebSocket. Sources that
reach a display in v1 (all existing CR-018 source keys): `safety.*` (leak, smoke, gas, CO, alarm triggered),
`doors.left_open`, `rule.alert` for the user's cameras (motion / person / line crossing when a rule says so),
`camera.offline` for the user's cameras, `nvr.offline` / `nvr.storage` (installation-wide, shown to every display with
`device_faults`), `security.*` (alarm failures, tamper), `intercom.ring` (WisKey doorbell - shown, never answered from the
wall). Automations / scheduler / system / backup items **do not** go to a wall.

### 5.2 Priority ladder

| Severity | Presentation | Returns to base |
|---|---|---|
| `info` | a chip in the strip ("דלת כניסה נפתחה") for 20 s | by itself |
| `alert` | an **alert tile** replaces the top-start cell of the grid: icon, type, place, time, the related camera's live video inside the tile when the subject is one of the user's cameras, buttons (5.4); other tiles stay | on ack / resolve, or after `takeover_timeout_s` (120 s) it folds into a strip chip and the cell returns to its camera |
| `critical` | **takeover**: the whole screen is the alert - full-bleed related camera (or a dark field with the icon), the type and place in the largest type the preset has, a danger-coloured edge pulse (2 s cycle, stops after 60 s), the buttons; the strip clock stays at the top | only on ack or resolve - a critical item never times out on a wall; several criticals stack as a list in the takeover, newest first |

Several `alert` items: the alert tile shows the newest with a count badge ("+2"); a tap cycles. (Revision 1 had a 320-px
alert column for a 1920 wall; removed with the wall template.)

Sound: off by default; when on, one short tone for `alert`, a 3-tone pattern repeated every 30 s until ack for `critical`.
The tone is a bundled file (no network). Browsers block audio until a gesture; the page shows "הקש פעם אחת להפעלת צליל"
until it has been allowed (the install guide says to tap once after loading; a kiosk browser can pre-allow autoplay).

Wake: an item of severity >= `wake_on_alert_severity` wakes a sleeping display; the takeover is the first thing it shows.

### 5.3 Dedupe, fold, resolve

Taken from the core: one tile per dedupe key; a repeat within the fold window bumps the time and the count badge. A
`resolve` removes the tile and shows a 5 s strip chip "נסגר · דלת מחסן". The display never raises an item that resolved
before it was delivered.

### 5.4 Acknowledge

Two buttons on an alert tile / takeover: **"ראיתי"** (seen) and, only when `ack_allowed`, **"אישור"** (acknowledge).

- "ראיתי" is local to the display: it collapses the tile to a chip for `takeover_timeout_s` and does not touch the core. A
  critical item comes back as a takeover when the chip's time is over.
- "אישור" acknowledges in the core exactly like a person's ack (escalation stops, the item leaves the centre's open list),
  with the actor recorded as **the wall user** (`wall.alert.ack`, `via = wall`). Default **off** because an acknowledge is
  an accountable act and a wall is anonymous; the owner turns it on for a staffed desk. When it is on the button needs a
  press-and-hold of 1.5 s (the tile's edge fills): a brush of a sleeve must not acknowledge a leak.

No "open door", "disarm", "silence siren" on a wall, ever (3.3).

### 5.5 Return to base

After ack / resolve / timeout the layout returns to the exact base state (same page of the rotation, same shuffle position)
with a 300 ms cross-fade. If the display was in picture-frame mode before the alert, it returns to the cameras, not to the
photos, and the idle timer starts again.

## 6. Picture-frame mode (WDX)

### 6.1 Behaviour

When `frame.enabled` and nothing has needed attention for `idle_min` (default 10) minutes - no open alert of severity >=
`alert`, no touch - the display cross-fades to photos: one photo every `interval_s` (30) seconds, `fit: contain` on black
(default; `cover` is a choice) with the clock and date in a corner (`frame.clock`), no camera, no chips. Order is a random
permutation per cycle. A touch returns to cameras for 10 minutes. Any alert >= `alert` returns to cameras immediately with
the alert tile; `info` does not interrupt the photos (a strip chip is shown over the photo). Sleep windows win over the
frame. Pixel shift and dim apply in frame mode too; the Ken Burns effect is **off** by default (`motion: "none" | "slow"`):
it costs GPU on a cheap tablet.

### 6.2 Photo source

The administrator chooses **one folder** per wall user from the server's media library (the HA media source the product
already reads, `media-source://media_source/local/...`) **or** the product's own "תמונות למסכי קיר" folder
(`/share/smplwise/wall-photos/<set>/`) that Settings can upload into (<= 200 files per set, JPEG / PNG / WebP, <= 8 MB each;
the server makes a 1920-wide cached rendition, strips EXIF). The display gets a list (`GET wall/frame/list` -> `[{id, w, h}]`)
and fetches renditions through `GET wall/frame/{id}` with its session; there is no direct media URL on the tablet and no
path leaves the server.

### 6.3 Privacy rules (hard)

- **Never camera material.** Snapshots, thumbnails, clips, case media and NVR exports cannot be chosen as a photo source;
  the picker does not offer those folders, and the server refuses any folder under the roots that hold them
  (`403 frame_source_not_allowed`).
- A frame folder is an **administrator** choice and is audited (`wall.frame.folder_set`, folder level).
- The same folder may serve several wall users; deleting a set that a profile uses turns that profile's frame off with a
  status note in the list ("תיקיית התמונות נמחקה").
- No face detection, no captions, no map of where a photo was taken.

## 7. Showing the cameras on a TV: by cast, not by a wall template

A TV (Chromecast, Google TV, Android TV, Nest Hub and similar) shows our video through **CR-028 cast to screens**: the
"שדר למסך" button on the live screen, a single camera in phase 1 and the camera wall as a **mosaic stream** in phase 2
(CR-028 sections 3 and 8). The wall display of this CR is **not** rendered on a TV: there is no TV application, no
1920x1080 template, no alert column and no photo frame on a TV. What a TV gets is the video only. If the owner wants alerts
or photos on a TV, that is a CR-028 follow-up (a rendered mosaic with overlays), not part of CR-030. Hours for the TV path
are in CR-028, not here.

## 8. Settings › מסכי קיר (the user's wall configuration)

A list of **wall users** (a table on desktop, cards on a phone - mobile uses cards, never a shrunken table):

| Column | Content |
|---|---|
| משתמש | the title, the user name (LTR) under it, the preset icon (landscape / portrait / single) |
| מצב | **מחובר** (a wall WebSocket is open now; with the count when more than one tablet), **ישן** (sleep window), **לא מחובר** (no heartbeat for 90 s or more, "נראה לאחרונה לפני 3 שעות"), **מושבת** (`enabled = false`), **טרם התחבר** (no session yet) |
| נראה לאחרונה | relative, exact on hover, the channel as a chip when remote |
| מצלמות | count + the first two aliases |
| התראות | on / off, "אישור מותר" chip when `ack_allowed`, "תמונות" chip |
| פעולות | edit (drawer), enable / disable, remove (confirmation: "הגישה של המשתמש תוסר והמסך יחזור למסך הכניסה") |

Above the list: the "הוספת משתמש מסך" button and a one-line count. Empty state: one card with the button and one line of
what a wall user is. The list polls every 15 s while open, no WebSocket.

**The add dialog** (replaces the pairing code form): pick an existing user from the list of users that are not wall users
yet (searchable; shows the display name and the user name), pick the place (floor or area) the user is bound at, give the
screen a title, "הוספה". One transaction: the `kiosk` binding, the profile with defaults, the audit row. The drawer opens
right after for the cameras.

The drawer has five sections in this order: **משתמש** (title, area, enabled, remote access, the user and role shown
read-only), **מצלמות ופריסה** (camera picker with the area tree - the tree *is* kept here, it is a person's navigation -,
order, preset, grid, rotation, strip chips, theme), **התראות** (section 5 fields), **תמונות** (section 6 fields, the set
picker, a six-thumbnail preview), **שעות ושמירה על המסך** (schedule editor, burn-in, offline). Save is one button; a signed-in
tablet applies the new configuration live over its WebSocket and shows a 3 s "ההגדרות עודכנו" chip. There is no
"identify this screen" and no device list: the user is the unit.

## 9. Data model and API sketch

### 9.1 One table (migration `0058`; numbering to be confirmed at build time against `integ/*`)

```sql
CREATE TABLE wall_profiles (
  user_id TEXT PRIMARY KEY,               -- the user catalog row of CR-001 (same key as bindings.subject_id)
  title TEXT NOT NULL,
  area_id TEXT, floor_id TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  remote_allowed INTEGER NOT NULL DEFAULT 0,
  config_json TEXT NOT NULL,              -- section 4, validated by a pydantic model; the camera ORDER lives here, the allow list is the kiosk bindings
  last_seen_at TEXT, last_channel TEXT,   -- 'local' | 'remote' (never an address)
  created_at TEXT NOT NULL, created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL, updated_by TEXT NOT NULL
);
-- alerts delivered to a wall are rows of the CR-018 delivery table with channel = 'wall' and target = user_id; no new table.
-- Settings rows: wall.enabled (true), wall.photo_sets_root, wall.max_profiles (20).
```

Gone from revision 1: `wall_pairings`, `wall_devices`, the token hash, the hint, the janitor jobs.

### 9.2 Routes (`/api/v1/wall/*`, ordinary session / Ingress / remote-cookie authentication)

| Route | Caller | Purpose |
|---|---|---|
| `GET /me` (extended) | any user | adds `wall: {enabled, profile_version}` when the user has an enabled profile |
| `GET wall/config` | wall user (`wall.view`) | the user's configuration, server time, the installation's zone, the current alert list |
| `GET wall/states?ids=` | wall user | the listed state chips only |
| live video | wall user | the **existing** `GET media/live/{camera_id}` (`video.live`, camera-scope bindings enforce the list), sub profile |
| `GET wall/alerts`, `POST wall/alerts/{id}/ack`, `POST wall/alerts/{id}/seen` | wall user | section 5 (`ack` needs `ack_allowed`, enforced by the server; press-and-hold is client-side) |
| `GET wall/frame/list`, `GET wall/frame/{photo_id}` | wall user | section 6 |
| `WS wall/ws` | wall user (the session) | server -> display: `config`, `alert` / `resolve`, `sleep` / `wake`, `disabled`, `revoked`; display -> server: `hello {class, screen}`, `heartbeat {state}` every 30 s (feeds `last_seen_at` and the list) |
| `GET wall/profiles`, `GET wall/profiles/{user_id}` | admin (`system.configure`) | the list and one profile |
| `POST wall/profiles` | admin (+ `rbac.assign`) | add: binding + profile in one transaction |
| `PATCH wall/profiles/{user_id}` | admin | configuration / title / enabled / remote_allowed (audited diff; the camera list also rewrites the camera-scope bindings) |
| `DELETE wall/profiles/{user_id}` | admin | remove: profile, bindings, sessions dropped, WS closed 4401 |
| `GET wall/photo-sets`, `POST wall/photo-sets/{set}/upload`, `DELETE ...` | admin | section 6.2 |

Errors: `401` login required (the removed screen or the normal login), `403 wall_user_remote_not_allowed`, `403
frame_source_not_allowed`. The client shows one screen per code (section 10).

### 9.3 Frontend

A separate bootstrap path in the existing client (`frontend/src/wall/`): `main` runs `classify()` (section 3.2.1) and, for a
tablet with `me.wall.enabled`, imports the wall entry **instead of** the shell - no rail, no router, no user menu. Shares
`design/tokens.ts` and the skin layer (`data-skin`, `data-theme`), `sw-camera-tile`, the live transport (`api/media.ts`
with the session) and the icon set. The wall entry registers no service worker of its own beyond the bundle cache. The
detector is a pure function `classifyDevice(env)` in `frontend/src/wall/device-class.ts` (unit-tested with the table of
3.2.1). Playwright evidence spec `frontend/tests/evidence-wall.spec.ts` renders every state of section 10 at the two tablet
viewports plus the phone and desktop "normal app" result, in classic and bubble, light and dark. Settings screen
`frontend/src/screens/system-wall.ts`, route `#/system/wall`, a TABS_CONFIG entry "מסכי קיר".

## 10. States the display renders (each is a mockup screen)

`login` (the normal login on a tablet: form, error, "מזהה טאבלט · עובר למצב מסך קיר"), `base` (per preset), `rotating`
(page dots), `alert-tile`, `alert-stack`, `takeover`, `takeover-stack`, `info-chip`, `resolved`, `frame`,
`frame-info-chip`, `dim`, `sleep`, `camera-stale`, `camera-lost`, `server-offline`, `server-offline-clock`,
`no-connection` (first load, no server), `access-removed` (login form with the removal note), `remote-refused`,
`no-cameras` (an empty list: the strip and "לא הוגדרו מצלמות למסך הזה"; the administrator sees the same note in the list),
`installer-info` (long-press, with "יציאה"), `config-updated`, `sound-locked`. And the **detection result** (not a state of
the display but the contract of 3.2): the same wall user on a tablet (wall mode), on a phone (the normal application) and on
a desktop (the normal application).

## 11. Slices and estimates

WDM (board 44 h) and WDX (board 15 h); revision 2 sums to **41 h** (revision 1: 55 h) against the boards' 59 h. The slices
are independent enough for separate branches with one owner for the API / DB (S1).

| Slice | Content | Hours | Model |
|---|---|---|---|
| S1 profile + role + routes | `wall_profiles` migration, `services/wall.py` (config model, profile CRUD with the binding transaction, camera-scope sync, session drop on remove, the remote-refusal check at the CR-008 session exchange), `kiosk` role gains `wall.view`, `/me` extension, `wall/config`, `wall/states`, `wall/ws`, audit rows | 5 | Fable |
| S2 Settings › מסכי קיר | list, add dialog (user picker), drawer with the five sections, enable / remove, photo sets upload, TABS_CONFIG entry, user-guide page | 6 | Sonnet |
| S3 the display + detection | `device-class.ts` and its table test, the bootstrap switch, the wall entry (two tablet presets + single, strip, rotation, installer panel with password-guarded sign-out), reconnect ladder, config-live-update over WS, the skin layer | 8 | Sonnet (Fable review of the presets and the switch) |
| S4 burn-in, schedule, offline | pixel shift, shuffle, dim, sleep / wake with server-computed edges, the three offline states, the kiosk-app `postMessage` | 5 | Sonnet |
| S5 evidence + hardening | `evidence-wall.spec.ts` (tablets x skins x schemes + the phone / desktop result), backend tests of section 12, security review of the role change and the remote refusal, release notes, SCREEN_CATALOG addendum | 4 | Opus (review) + Sonnet |
| S6 alert tiles + takeover (WDX) | the `wall` channel in the notification core, scope filter, the tile / stack / takeover, seen vs ack with press-and-hold, sound, wake on severity, return to base | 7 | Fable |
| S7 picture frame (WDX) | photo sets + renditions + EXIF strip, the allowed-sources rule, list / fetch, the frame renderer, idle / interrupt / sleep precedence | 6 | Sonnet |

Order: S1 -> S2 || S3 -> S4 -> S5 (WDM release, 2.3.0) -> S6 -> S7 (WDX, may ride the same release when S5 is green early).
Saved versus revision 1 (55 h -> 41 h, -14 h), by slice: S1 10 -> 5 (no pairing lifecycle, throttles, janitor, token, wall
principal / resolver; the camera-scope binding sync and the remote refusal are added), S2 9 -> 6 (no code dialog, hint, registry
columns, identify, rotate), S3 10 -> 8 (no token store, no 1920 preset, no alert column; the detection rule and the
password-guarded sign-out are added), S4 6 -> 5, S5 5 -> 4 (fewer states, no 1920 viewport), S6 9 -> 7 (no alert column,
delivery targets a user), S7 unchanged at 6.

## 12. Tests

Backend (fixtures, no device):
- role: `ROLES["kiosk"] == ["map.read", "video.live", "wall.view"]`; the existing `test_kiosk_role` list of 403 paths still
  passes unchanged; a user without a profile gets `403` on every `wall/*` read route; `me.wall` absent without a profile or
  with `enabled = false`.
- profiles: create (binding + profile + audit in one transaction, rolled back together on failure), update diff audited,
  disable -> `me.wall` gone and WS gets `disabled`, remove -> bindings gone, sessions dropped, WS closed 4401, the next
  request is 401; the camera list rewrites camera-scope bindings and `media/live/{cam}` is 200 for listed cameras and 404
  for others (the display must not learn which cameras exist).
- remote: the session exchange for a profile user on the remote channel is `403 wall_user_remote_not_allowed` and audited
  once per 10 min; allowed when `remote_allowed`; local channel unaffected.
- alerts: a `wall` delivery for each source key of 5.1; severity ladder -> the payload's `presentation`; resolve removes;
  items resolved before delivery are not delivered; `wall.alert.ack` audit row with the wall user as actor and `via = wall`;
  `ack` is `403` without `ack_allowed`; escalation stops on a wall ack; scoped to the user's cameras / area.
- frame: sources under camera / case / export roots refused; EXIF stripped in the rendition; the list is per user; a
  deleted set switches the frame off.
- schedule: edges computed in `time.zone` across a DST change (Israel, 2026-03-27 and 2026-10-25); wake on severity.

Frontend (Vitest + Playwright, static fixtures + the evidence spec against the dev backend):
- `classifyDevice` against the full table of 3.2.1 (iPad with a Mac UA, iPad mini, Galaxy Tab, Fire HD, 7" Android, iPhone,
  Pixel, foldable folded / unfolded, Windows touch laptop, desktop, keyboard open) - one assertion per row; viewport changes
  never change the result.
- the bootstrap: tablet + wall user -> wall entry mounted and the shell **not** loaded; phone / desktop + the same user ->
  the shell; tablet + a user without a profile -> the shell.
- every state of section 10 at 1280x800 and 800x1280 x {classic, bubble} x {light, dark}; no horizontal overflow; touch
  targets >= 44 px; the clock is the largest text; video and map not mirrored.
- the reconnect ladder with a mocked WebSocket; the stale -> lost transition at 60 s; the takeover never times out for
  critical; press-and-hold ack needs 1.5 s; the frame yields to an alert and to a sleep window; sign-out asks for the password.

Lab (owner's tablet, read-only except the sign-in): sign in as the wall user, power-cycle and see it resume; remove the user
and see the removal screen; sub-stream count on the real NVR at 2x2 and 3x2 for 30 min (F15 check); a night of pixel shift
(visual check in the morning).

## 13. Risks and honest limits

| Risk | Mitigation / limit |
|---|---|
| A tablet left on a public wall is a camera viewer for anyone who walks by | that is the product: the administrator chooses the cameras; the role is live and map only, no playback, exports, other areas or controls; the audit shows what each wall user is allowed |
| The wall user's password is typed on a tablet by an installer | a dedicated user with a throw-away strong password and the `kiosk` role; its blast radius is "live cameras of its list"; the password never has to be known after the first sign-in (session persists); sign-out on the tablet needs it again |
| Detection is wrong on an odd device | the rule is in a table with tests and is visible in the installer panel; consequence of a wrong answer is cosmetic (the normal limited app instead of the wall, or the reverse), never a permission change; no manual override in v1 (a wall mini-PC / touch-less display is a desktop and gets the normal application - an explicit non-goal; adding an "also on desktop" profile flag is a one-hour follow-up if the owner wants it) |
| Foldables and large phones sit near the 600-700 px boundary | folded / large phone (< 700 with a Mobile token) is a phone, unfolded is a tablet; documented in the table |
| One user on several tablets shows the same cameras | by design; different places need different users |
| Deactivating the HA user is not instant on the local channel | up to 30 min (access-token life); the Arx "remove" action is immediate and is the documented way to cut a lost tablet; remote revalidation is 60 s |
| Session lost after 90 days off | the tablet shows the login form; someone types the password again; the install guide says so |
| Too many sub streams stall (F15) | tablet presets cap at 6 tiles; Settings flags > 6 cameras on a page ("מעל 6 זרמים - בדוק שהמקליט עומד בעומס"); `main` is not offered |
| Browser cannot sleep the screen | the sleep state is black + a dim clock; a kiosk app can act on the emitted `postMessage` / title; documented, not promised |
| Audio needs a gesture | the "tap once" note; sound is off by default |
| A noisy rule becomes a noisy wall | per-user categories and min severity; the alert tile never covers more than one cell except critical; a rule's `cooldown_s` applies |
| Picture frame leaks private photos to a corridor | admin-only source choice, audited, EXIF stripped, camera material impossible by construction |
| DST / zone bugs in the schedule | server computes edges in `time.zone`; tests at the two Israeli transitions |
| The TV path depends on CR-028 | TV hours and risks live there; phase 1 is a single camera, phase 2 the wall mosaic; nothing in CR-030 blocks on it |

Not built in this CR: any control from the wall, playback, two-way audio, a TV application or template, a wall interface on
phones, "wall mode on desktop", a per-device registry or identify, `main` stream profile on walls, hardware brightness,
multi-server displays.

## 14. Revision 2: what was removed, what replaced it

| Revision 1 | Revision 2 |
|---|---|
| Pairing: six-digit code shown on the tablet, typed by an administrator; `wall_pairings`; 10-minute expiry; throttles; pair secret | **removed.** The tablet is identified by the user that signs in on it |
| Machine principal of source `wall`, device token `arxw_`, hashed at rest, rotation, a resolver confined to the wall router | **removed.** An ordinary user on the existing `kiosk` role; `wall.view` is the only new permission |
| `wall_devices` registry, per-device status, last channel, inactive days, identify "זה המסך", rotate token, pause | **replaced** by `wall_profiles` (one row per wall user): enabled, remote_allowed, last seen |
| Pairing mockup page and its 7 states, the claim / hint / throttled dialogs, device list columns | **removed.** Settings shows a list of wall users and an add dialog that picks a user |
| 1920x1080 `wall` preset, the 320-px alert column, 4x3 / 5x3 grids, `--wall-scale 1.25` | **removed** with every TV / dedicated-app idea; large tablets use the landscape preset with a scale clamp |
| Showing on a TV by running the wall page on it | **replaced** by cast (CR-028): video only, the wall mosaic in its phase 2 |
| Revoke = replace the token hash | **replaced** by disable / remove / deactivate the user (section 3.5), with the honest speed table |
| Remote: token accepted only on the local channel unless `remote_allowed` per device | kept in spirit: `remote_allowed` per wall **user**, default off |
| Auto layout by viewport | kept (tablet presets only); **added** the device detection rule and the automatic switch into wall mode |
| Kept unchanged: explicit camera allow list, alert tiles + ladder + press-and-hold ack, picture frame, burn-in protection, schedule, offline honesty, dark default, no control from the wall, sub streams only | |

## 15. Design decisions taken without the owner (with reasons)

| # | Decision | Reason |
|---|---|---|
| 1 | A wall tablet is an ordinary user on the existing `kiosk` role; no pairing, no token, no registry | the user already gives typed sign-in, persistence, revocation, audit with an actor and a read-only ceiling; the owner asked to drop the pairing machinery |
| 2 | Wall mode is entered when a wall user signs in on a **tablet-class** device; detection is a documented client rule on physical signals, never a security control | the owner asked for auto-detection; physical signals (touch primary, short side, mobile token) survive keyboards, split screen and rotation; a wrong answer is cosmetic |
| 3 | On a phone or desktop the same user gets the normal limited application; the wall interface is not offered | owner: not needed on phones; the role already limits that app |
| 4 | Showing on a TV is a CR-028 cast, not a TV template or app | the owner asked; casting is the supported path and keeps credentials off the TV |
| 5 | The camera allow list is stored as camera-scope `kiosk` bindings; the profile stores order and layout | the existing, already-enforced scope mechanism beats a new check; the display cannot see more than the list |
| 6 | `wall.view` is the only new role permission; ack is a profile flag checked by the server, not a role permission | the role stays read-only and the test list stays exact; ack is an owner-level choice per user |
| 7 | `remote_allowed` per wall user, default false | a wall does not travel; a wall user's password used over the internet is a copied credential |
| 8 | Persistent session (90 days since last use), no sign-out on the display except behind the password | auto-login across power cuts; a passer-by must not be able to sign a wall out |
| 9 | Remove = unbind + drop sessions (immediate); HA deactivation alone is documented as not instant locally | an honest speed table beats a promise the platform does not keep |
| 10 | One user = one configuration; several tablets share it | dropping the device registry is the point; a second place costs one user |
| 11 | No manual detection override and no "wall mode on desktop" in v1 | extra surface for a case the owner did not ask for; a one-hour follow-up |
| 12 | No control from the wall, enforced by the role's exact permission list and its test | a corridor screen is reachable by anyone; accountability needs a person |
| 13 | Ack off by default; press-and-hold when on; "seen" always available | an acknowledge is accountable; a sleeve must not ack a leak |
| 14 | Critical never times out; alert folds after 120 s | a stuck takeover hides cameras, but a leak must not be hidden by a timer |
| 15 | Alerts are a CR-018 channel, not a new engine | one place decides what is an alert; the wall only renders |
| 16 | Dark theme by default | video on black, fewer lit pixels, distance legibility |
| 17 | No area tree on the display; a map band on the portrait preset; the tree stays in the Settings picker | the tree is navigation for people |
| 18 | Photos only from admin-chosen folders, camera material impossible | privacy by construction |
| 19 | Ken Burns off, pixel shift on, shuffle hourly | cheap tablets, years on a wall |
| 20 | `sub` streams only | the F15 stall measurement |
| 21 | Schedule reuses the CR-014 weekly editor | one editor for weekly windows |

---

## תקציר בעברית (CR-030 — מסך קיר, גרסה 2)

**מה זה.** טאבלט קבוע בקיר שמציג את המצלמות והמצב של המקום שלו, בלי אפשרות לשנות שום דבר מהמסך. בהמשך (WDX): אריחי התראה
ומסגרת תמונות.

**מה השתנה אחרי הביקורת.** אין יותר צימוד בקוד, אין אסימון מכשיר ואין רשימת מכשירים. הטאבלט מזוהה פשוט כי יש **משתמש
מסך קיר** (משתמש רגיל בתפקיד "קיוסק" הקיים - רק מפה ווידאו חי) שמתחברים איתו בטאבלט. כשמשתמש כזה נכנס ממכשיר שהוא **טאבלט**,
האפליקציה עוברת לבד למצב מסך קיר. בטלפון ובמחשב אותו משתמש רואה את המערכת הרגילה (מוגבלת לפי התפקיד), ומסך הקיר לא מוצע שם בכלל.
הצגה על טלוויזיה נעשית **בשידור** (CR-028, Chromecast ודומיו) ולא באפליקציה או בתבנית 1920×1080 ייעודית - נמחקו.

**זיהוי טאבלט.** לפי המכשיר עצמו, לא לפי גודל החלון: אצבע היא ההתקן הראשי (`pointer: coarse` או `hover: none`) והצלע
הקצרה של המסך הפיזי: מתחת ל-600 פיקסלים - טלפון; מ-600 ומעלה - טאבלט; ובאנדרואיד עם "Mobile" מתחת ל-700 - טלפון (טלפון גדול או
מתקפל סגור). בלי מגע - מחשב. iPad מזוהה לפי מגע וגודל כי הוא מדווח כ-Mac. זו הצגה בלבד: ההרשאות בשרת לא תלויות בזיהוי. אין
עקיפה ידנית בגרסה 1.

**מה מוגדר בהגדרות › מסכי קיר (לכל משתמש מסך).** כותרת, מקום, מצלמות וסדר (נשמרות כהרשאות תפקיד ברמת מצלמה), פריסה (אוטומטית:
טאבלט לרוחב, לאורך עם רצועת מפה, מצלמה אחת), דפדוף, שורת מצב, ערכה (כהה כברירת מחדל), התראות, תמונות, הגנה על המסך, לו"ז
ערות/שינה, התנהגות בניתוק, גישה מרחוק (כבויה כברירת מחדל), פעיל/מושבת. הוספה: בוחרים משתמש קיים (יוצרים אותו בתשתית המערכת)
ומקום - בלחיצה אחת נוצרים ההרשאה והפרופיל.

**חיבור וביטול.** מקלידים שם משתמש וסיסמה פעם אחת; ההתחברות נשמרת (90 יום מהשימוש האחרון) וחוזרת לבד אחרי הפסקת חשמל. אין
כפתור יציאה במסך; בלוח המתקין (לחיצה ארוכה על השעון) יש "יציאה" שדורשת את הסיסמה. ביטול: השבתה (המסך חוזר לאפליקציה הרגילה
תוך שניות), הסרה (ההרשאות והחיבורים נמחקים מיד - מסך "הגישה הוסרה"), או השבתת המשתמש בתשתית המערכת (עד 60 שניות מרחוק, עד 30
דקות במקומי - מגבלה כנה).

**אריחי התראה ותמונות (WDX)** - ללא שינוי מהותי: מידע = צ'יפ; התראה = אריח במקום התא הראשון (מתקפל אחרי 2 דקות); קריטי =
השתלטות עד אישור; "אישור" רק כשהופעל, בלחיצה ארוכה, ונרשם על שם משתמש המסך. עמודת ההתראות של הקיר נמחקה. מסגרת תמונות
אחרי 10 דקות שקט, מתיקייה שהמנהל בחר, בלי חומר מצלמות.

**פרוסות ושעות.** S1 פרופיל+תפקיד+נתיבים (5 ש'), S2 הגדרות (6), S3 התצוגה והזיהוי (8), S4 הגנה/לו"ז/ניתוק (5), S5 ראיות
והקשחה (4) - גרסה 2.3.0; S6 אריחי התראה (7), S7 מסגרת תמונות (6). סה"כ **41 שעות** (היו 55) מול 59 בלוח.

**מגבלות כנות.** דפדפן לא יכול לכבות תאורה אחורית; צליל דורש נגיעה ראשונה; רק זרם משני; משתמש אחד = הגדרה אחת (שני
מקומות שונים = שני משתמשים); מכשיר בלי מגע (מיני-מחשב בקיר) נחשב מחשב ולא נכנס למצב קיר; השבתה ב-HA בלבד אינה מיידית
בערוץ המקומי; הצגה על טלוויזיה תלויה ב-CR-028.
