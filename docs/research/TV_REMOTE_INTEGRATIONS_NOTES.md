# TV control and remote integrations - research notes for the "screens" slice (0.1.149)

Research for the multimedia area (rail entry "מולטימדיה", sub-tab "מסכים", the remote drawer, the area-screen media
card). Public web only; no device, Home Assistant or lab system was contacted, `secrets/` and `private-evidence/` were
not read. Fetched 2026-09-30. Companion documents: `docs/research/MUSIC_ASSISTANT_API_NOTES.md` (branch
`pilot/media-research`; the unified "media device" model this note builds on), the mockup
`docs/design/mockups/media/index.html` and the owner questions `docs/design/mockups/media/decisions-HE.md`.

Conventions: `[Sn]` = source list in section 13. **UNVERIFIED** = not confirmed from a primary source. Most pages
were read through a fetch tool that summarises; exact strings in backticks come from raw GitHub files or HA docs but
were not re-read line by line, so an implementation must re-check them against the installed version.

## 1. Summary

1. **Render from capabilities, not brands.** Every HA `media_player` publishes `supported_features` (bitmask, section
   3.4). Power, volume slider, volume steps, mute, sources, transport and seek are shown only when the entity (or the
   endpoint chosen as primary for that control) supports them. The brand "profile" only adds the *remote-key
   vocabulary* (d-pad, numbers, colour keys, text), and only when a key transport exists.
2. **Samsung (ha-samsungtv-smart, "SSV")** is the richest: power on by WOL or SmartThings, volume set, one merged
   `source_list` (sources + apps + channels), key sending via `media_player.play_media` type `send_key` (chaining
   with `+` and ms delays, hold with `"KEY, ms"`), text via `send_text`, a `remote` entity, Frame art mode. Power state
   is a heuristic (ping/port/SmartThings/mute check) [S1][S2][S3].
3. **LG webOS (core `webostv`)** has keys through `webostv.button`, sources = inputs + apps, `sound_output` with its own
   action, but **turn on exists only when the owner built a `webostv.turn_on` trigger automation (WOL/CEC)**, and
   `VOLUME_SET` disappears when the sound output is `external_speaker` [S7][S8].
4. **Android TV Remote (core)** gives a `remote` entity (keys, `text:` prefix, app launch by deep link as
   `activity`) plus a `media_player` with **no `VOLUME_SET` and no `SELECT_SOURCE`**; Cast (a second entity for the same
   TV) brings metadata, volume set and transport. One screen = two entities at least [S9][S10].
5. **A power toggle is dangerous.** On 2016+ Samsung `KEY_POWEROFF` behaves as `KEY_POWER` (toggle) [S3]; LG/Android
   `POWER` keys toggle as well. Power must go through `media_player.turn_on/turn_off` only, never through a key, and a
   bulk "off" must skip screens whose state is `off`, `unknown` or `unavailable`.
6. **"Off" is not reliable.** SSV derives it heuristically and keeps OFF for 20 s after a power-off command; LG is
   `unavailable` when off unless a turn-on trigger exists; some Android TVs (Xiaomi/TCL) go `unavailable` when off.
   The UI must show "not confirmed" honestly, and never infer "off" from a missing endpoint.
7. **universal-remote-card (URC)** is a good checklist of what a smart remote offers: d-pad or touchpad, volume
   buttons + slider, channel keys, numpad, colour keys, transport, app shortcuts, keyboard/textbox, hold-to-repeat,
   haptics, per-platform key maps [S4][S5][S6]. We take the feature set, not its YAML model.
8. **Dedupe first.** In the owner's houses one TV appears through several integrations (SSV + SmartThings + Cast + DLNA
   + Music Assistant), and a receiver through its own integration + Cast. The screen card is one *physical device*
   with a primary endpoint per control (section 8).

## 2. Capability matrix

Y = yes, N = no, P = partial/conditional. "Generic" = the plain HA entity model (feature flag names).

| Capability | Samsung (SSV) | LG webOS (core) | Android TV Remote + Cast | Generic HA |
|---|---|---|---|---|
| Power on | Y: websocket, then WOL or SmartThings (option `power_on_method`) | P: only with a `webostv.turn_on` trigger + owner's WOL/CEC automation | P: Remote sends `POWER` (unreliable on some brands); Cast "on" = launch an app | `TURN_ON` (128) |
| Power off | Y (`KEY_POWER`; Frame: 3 s hold to art/off) | Y | Y (Remote `POWER`; Cast quits the app) | `TURN_OFF` (256) |
| Volume slider | Y (UPnP or SmartThings) | Y, not with `external_speaker` | Remote N (level read-only); Cast Y unless fixed volume | `VOLUME_SET` (4) |
| Volume steps | Y | Y | Y (Remote) | `VOLUME_STEP` (1024) |
| Mute | Y | Y | Y | `VOLUME_MUTE` (8) |
| Source list | Y: sources + apps + channels merged | Y: inputs + apps merged, "Live TV" added | N (`SELECT_SOURCE` absent); apps via `activity` | `SELECT_SOURCE` (2048) |
| App launch | Y: `app_list`, `play_media` type `app`, or `select_source` | Y: from `source_list`; `webostv.command system.launcher/open` | Y: `remote.turn_on activity=<deep link or package>` | `PLAY_MEDIA` (512) |
| Channel up/down | Y `KEY_CHUP/KEY_CHDOWN` | Y `CHANNELUP/CHANNELDOWN` (next/prev on Live TV) | Y `CHANNEL_UP/DOWN` | none |
| Number keys | Y `KEY_0..9` | Y `0..9` | Y `0..9` | none |
| D-pad + OK | Y | Y | Y | none |
| Back / Home / Menu | Y `KEY_RETURN/KEY_HOME/KEY_MENU` | Y `BACK/HOME/MENU` | Y `BACK/HOME/MENU` | none |
| Colour keys | Y `KEY_RED/GREEN/YELLOW`, blue as `KEY_CYAN` (UNVERIFIED) | Y `RED/GREEN/YELLOW/BLUE` | Y `PROG_RED..BLUE` | none |
| Text entry | Y `send_text` (replaces field) | P: URC shows a keyboard; no core action documented (UNVERIFIED) | Y `text:` prefix, needs "Enable IME" | none |
| Transport | Y play/pause/stop/prev/next | Y (no seek) | Remote keys (assumed state); Cast full incl. seek | `PLAY/PAUSE/STOP/...` |
| Now playing art | P: app logo, not content art | P: app icon | Cast: real metadata; Remote: none | `media_image_url` |
| Sound output | P: sound mode needs SmartThings | Y `webostv.select_sound_output` | N | `SELECT_SOUND_MODE` (65536) |
| Art / ambient | Y Frame: `samsungtv_smart.set_art_mode`, `art_mode_status` | N | N (ambient = an app, e.g. backdrop) | none |
| "Off" reliability | P: heuristics, 20 s forced OFF after command | P: `unavailable` without trigger | P: some brands `unavailable` when off | `off` / `unavailable` |

## 3. Per integration

### 3.1 Samsung - ha-samsungtv-smart (custom, v0.14.5 at fetch time) [S1][S2][S3]

- Tizen 2016+ only; websocket port 8001/8002 (8002 = TLS, token stored); first pairing needs someone at the TV to
  accept; fails across VLANs; a running app can block the websocket (power-cycle fixes).
- Options flow keys: `use_st_status_info`, `use_st_channel_info`, `show_channel_number`, `logo_option`,
  `use_local_logo`, `app_load_method` (All/Default/Not Load), `power_on_method` (WOL Packet / SmartThings),
  advanced: `app_launch_method` (control ws / remote ws / REST), `wol_repeat` (1-5), `ping_port` (0 = ICMP; 9110,
  9119, 9197), `ext_power_entity` (binary sensor, e.g. power draw), `use_mute_check` (fake-on detection),
  `dump_apps`, `toggle_art_mode` (power button to art mode, Frame), `sync_turn_on/off` (up to 4 entities each - a
  cross-device side effect we must surface in settings, never trigger silently).
- Lists: `source_list` (name -> key or chain, default `TV: KEY_TV`, `HDMI: KEY_HDMI`; SmartThings auto-detect when
  empty), `app_list` (name -> id, numeric/Tizen/both joined with `/`; manual list "highly recommended"),
  `channel_list` (name -> number, optional `@source`, max ~30 recommended). The entity's `source_list` is the
  **concatenation** of the three, so one list mixes inputs, apps and channels; we split it by the config the
  installer imports (or by name matching against `app_list`), UNVERIFIED how the attribute marks the kind.
- Features: `PAUSE | VOLUME_SET | VOLUME_STEP | VOLUME_MUTE | PREVIOUS_TRACK | NEXT_TRACK | SELECT_SOURCE | TURN_OFF |
  TURN_ON | PLAY | PLAY_MEDIA | STOP`, `BROWSE_MEDIA` when on, `SELECT_SOUND_MODE` with SmartThings.
- Attributes: `source`, `source_list`, `app_id`, `media_title` (channel name with SmartThings, else source/app),
  `media_channel` (SmartThings + TV source only), `media_content_type` (channel/video/app), `volume_level`,
  `is_volume_muted` (UPnP), `media_image_url` (logo feature), `art_mode_status`, `picture_mode(_list)` and
  `sound_mode(_list)` (SmartThings), `ip_address`.
- Actions: `samsungtv_smart.select_picture_mode`, `samsungtv_smart.set_art_mode`; everything else through standard
  `media_player.*`. `play_media` types: `send_key` (`KEY_A+500+KEY_B`, delay 200-2000 ms, default 500; hold
  `"KEY_X, 2000"`, max 5 s), `send_text`, `app`, `channel`, `url`/`browser`, YouTube URL with `enqueue` (cast API).
- `remote` entity: `turn_on`, `turn_off`, `send_command` (joined with `+` into `send_key`); `num_repeats` only, no
  `delay_secs`/`hold_secs`, no activities.
- Off/state: OFF forced for 20 s after a power-off (UI feedback); no `unavailable` state from the integration; art
  mode On/Unavailable counts as not-on for power while the user-visible state in art mode is UNVERIFIED; volume and
  mute (UPnP) are unavailable while off.

### 3.2 LG webOS - core `webostv` [S7][S8]

- Setup: "LG Connect Apps" on, ports 3000/3001, pairing prompt on the TV (`auth_failed` when rejected), webOS 2.0+.
- Platforms: `media_player`, `switch` (screen on/off, disabled by default), `notify`.
- Features: `TURN_OFF | NEXT_TRACK | PAUSE | PREVIOUS_TRACK | SELECT_SOURCE | PLAY_MEDIA | PLAY | STOP` + `VOLUME_MUTE |
  VOLUME_STEP`; `VOLUME_SET` unless `sound_output == external_speaker`; `TURN_ON` only when a turn-on trigger action is
  configured. No `SEEK`. Next/previous = channel up/down on Live TV.
- `source_list`: inputs + apps, "Live TV" added; filtered by the integration options. `app_id`, `media_content_type`
  (`channel` on `com.webos.app.livetv`), `media_image_url` = app icon, attribute `sound_output`.
- Actions: `webostv.button` (`LEFT RIGHT UP DOWN ENTER BACK HOME MENU EXIT INFO DASH ASTERISK CC GUIDE MUTE VOLUMEUP
  VOLUMEDOWN CHANNELUP CHANNELDOWN PLAY PAUSE RED GREEN YELLOW BLUE 0-9`; the actions page also lists `NETFLIX`,
  `AMAZON`), `webostv.command` (`command` endpoint + `payload`, e.g. `system.launcher/open`),
  `webostv.select_sound_output` (`tv_speaker`, `external_speaker`, `external_optical`, `external_arc`, `headphone`;
  more values per model, UNVERIFIED), `play_media` type `channel` (number or name).
- Off: without the trigger the entity is `unavailable` when the TV is off; calls while off raise "Device is off and
  cannot be controlled". With a trigger the exact off/unavailable behaviour is UNVERIFIED.

### 3.3 Android TV Remote (core `androidtv_remote`) + Google Cast (core `cast`) [S9][S10]

- Remote entity: `activity_list` (configured apps), `current_activity`; `send_command` with `num_repeats`,
  `delay_secs`, `hold_secs`, prefixes `short:`, `start_long:`, `end_long:`, and `text:` (needs "Enable IME").
  Keys: `DPAD_UP/DOWN/LEFT/RIGHT/CENTER BACK HOME MENU SETTINGS SEARCH INFO GUIDE CAPTIONS TV VOLUME_UP/DOWN MUTE
  CHANNEL_UP/DOWN 0-9 PROG_RED/GREEN/YELLOW/BLUE MEDIA_PLAY_PAUSE/PLAY/PAUSE/STOP/NEXT/PREVIOUS/REWIND/FAST_FORWARD
  POWER DEL ENTER` and more (URC also uses `TV_INPUT`, `TV_INPUT_HDMI_1..4`).
- App launch: `remote.turn_on` with `activity` = deep link (`https://www.youtube.com`, `netflix://`) or package id;
  launching by package is broken for many apps since Play Store changes - prefer deep links.
- Media player: `PAUSE VOLUME_STEP VOLUME_MUTE PREVIOUS_TRACK NEXT_TRACK TURN_ON TURN_OFF PLAY STOP PLAY_MEDIA
  BROWSE_MEDIA`; state ON/OFF only (no playing/paused); `app_id`/`app_name` tracked; volume level readable, not settable.
- Limits: Xiaomi/TCL `unavailable` when off; Fire TV incompatible; some devices drop every 15 s.
- Cast `media_player` for the same TV: `PLAY_MEDIA TURN_ON TURN_OFF` always, conditional `VOLUME_SET/MUTE` (not with
  fixed volume), transport, `SEEK`, `BROWSE_MEDIA`; states off/idle/playing/paused/buffering; `app_name`, real media
  metadata. "Turn on" launches an app; "turn off" quits it. The HA docs suggest combining both through a Universal
  Media Player; we do the same in our own model instead (section 8).

### 3.4 Generic HA `media_player` and `remote` [S11][S12][S13]

`MediaPlayerEntityFeature`: PAUSE 1, SEEK 2, VOLUME_SET 4, VOLUME_MUTE 8, PREVIOUS_TRACK 16, NEXT_TRACK 32,
TURN_ON 128, TURN_OFF 256, PLAY_MEDIA 512, VOLUME_STEP 1024, SELECT_SOURCE 2048, STOP 4096, CLEAR_PLAYLIST 8192,
PLAY 16384, SHUFFLE_SET 32768, SELECT_SOUND_MODE 65536, BROWSE_MEDIA 131072, REPEAT_SET 262144, GROUPING 524288,
MEDIA_ANNOUNCE 1048576, MEDIA_ENQUEUE 2097152, SEARCH_MEDIA 4194304.
States: `off on idle playing paused standby buffering` (+ HA-wide `unavailable`/`unknown`). Device classes: `tv`,
`speaker`, `receiver`, `projector`. Useful attributes: `source`, `source_list`, `sound_mode(_list)`, `media_title`,
`media_channel`, `media_duration`, `media_position(_updated_at)`, `app_id`, `app_name`, `media_image_url`,
`volume_level` (0-1), `is_volume_muted`, `group_members`.
`remote`: features LEARN_COMMAND 1, DELETE_COMMAND 2, ACTIVITY 4; `send_command(device, command, num_repeats=1,
delay_secs=0.4, hold_secs=0)`; support for the kwargs varies per integration (SSV: `num_repeats` only).

### 3.5 universal-remote-card as the feature checklist [S4][S5][S6]

Platforms with presets: Android TV, Sony BRAVIA, Fire TV, Apple TV, Roku, LG webOS, Samsung TV (needs SSV for sources
and keyboard), Kodi, Unified Remote, Philips, Denon, Yamaha, Jellyfin, Unfolded Circle, generic. Layout elements:
`dpad`/`navigation_buttons`, `circlepad`, `touchpad`/`dragpad`/`mousepad`, `slider` (volume), `volume_buttons`,
`numpad`/`dialpad`, `xpad`/`npad`, app/source buttons, keyboard/textbox/search dialogs. Actions: `key`, `source`,
`perform-action`, `navigate`, `more-info`, `toggle`, `url`, `keyboard`, `textbox`, `search`, `repeat` (10 Hz while
held), `eval`, with tap / double-tap / hold and momentary start/end. Defaults: hold 500 ms, repeat 100 ms, auto-repeat
on arrows and volume, haptics on. Key transport per platform: `remote.send_command` (most), `webostv.button` (LG),
`kodi.call_method`; sources: `media_player.select_source` (Samsung, LG, Roku, Fire TV, Apple TV), `remote.turn_on
activity` (Android TV). Keyboard: "replace" mode on Samsung/LG/Apple TV, "insert" on Android TV/Fire TV/Roku.

What we adopt: power, back/home/menu, d-pad with OK and a touchpad alternative, volume rocker + slider + mute, channel
rocker, numpad, colour keys, transport row, sources and app shortcuts, text entry, recent items, hold-to-repeat,
pressed/haptic feedback, keyboard shortcuts on desktop. What we do not adopt: arbitrary actions (`perform-action`,
`eval`, `url`, templating) - an operator remote may only send the fixed key set of its profile (section 10).

## 4. Control surface of our remote (what shows when)

| Section | Shown when | Sends |
|---|---|---|
| Power (header, big "הפעל" when off) | `TURN_ON` / `TURN_OFF` of the primary power endpoint; disabled (tooltip only) when missing | `media_player.turn_on/turn_off` - never a key |
| Now playing | state on/idle/playing/paused | read only (`app_name`/`source`/`media_title`/`media_channel`/position) |
| Audio output switch | the screen has a linked receiver/soundbar in the device model | selects which endpoint volume/mute target; for LG optionally `select_sound_output` |
| Volume slider | `VOLUME_SET` on the volume endpoint | `media_player.volume_set` (debounced, last value wins) |
| Volume rocker + mute | `VOLUME_STEP` / `VOLUME_MUTE` (or the profile's keys) | `volume_up/down`, `volume_mute` |
| Recent | we keep the last sources/apps per screen | same as a source/app pick |
| Back/Home/Menu, d-pad/OK, touchpad | the profile has a key transport | profile keys |
| Channel rocker, numpad | profile has channel/number keys; value shown only on a TV source | profile keys / `play_media channel` |
| Transport | `PLAY`/`PAUSE` (+`PREVIOUS/NEXT_TRACK`) and media is active | `media_play_pause`, `next/previous`; rew/ff as profile keys |
| Sources tab | `SELECT_SOURCE` and a non-empty curated list | `select_source` |
| Apps tab | an app list exists (SSV `app_list`, LG apps in `source_list`, Android activities) | per profile (section 7) |
| Colour keys, text entry, extra keys | profile flags (Samsung/LG/Android; LG text off until verified) | profile keys / `send_text` / `text:` |

Generic profile (no key transport): power, volume, mute, sources, transport only - no d-pad. This is also the
fallback when the key endpoint is unavailable while the `media_player` is not.

## 5. Behaviour when the screen is off or unavailable

- **Off** (confirmed `off`, or Samsung art mode): the remote shows the big power button and a dimmed, inert preview of
  the pad; no key, volume or source action is sent to an off TV (they fail or, worse, wake some models).
  Art mode shows "מצב אמנות" with "מעבר לצפייה" (power on to TV) and the header power (full off).
- **No remote power-on** (LG without trigger, Android brands that cannot wake): the big button is disabled; the
  reason lives in its tooltip only (clean-operator rule).
- **Unavailable**: card dashed with "לא זמין · מאז HH:MM"; remote shows that state and nothing else; excluded from
  bulk actions and counted separately in the filter.
- **Pending**: a command shows a spinner until the entity state confirms; after a timeout (proposal 8 s) the UI says
  "המסך לא אישר את הפקודה" and returns to the last confirmed state. Nothing is retried or queued automatically.
- SSV's forced-OFF window (20 s) and heuristic power mean "off" may be wrong: the card still offers power on; bulk
  off skips screens not confirmed on.

## 6. Key vocabularies (our key id -> platform code)

| Our key | Samsung (`send_key`) | LG (`webostv.button`) | Android TV (`send_command`) |
|---|---|---|---|
| up/down/left/right | `KEY_UP/DOWN/LEFT/RIGHT` | `UP/DOWN/LEFT/RIGHT` | `DPAD_UP/DOWN/LEFT/RIGHT` |
| ok | `KEY_ENTER` | `ENTER` | `DPAD_CENTER` |
| back / home / menu | `KEY_RETURN` / `KEY_HOME` / `KEY_MENU` | `BACK` / `HOME` / `MENU` | `BACK` / `HOME` / `MENU` |
| exit | `KEY_EXIT` | `EXIT` | - |
| info / guide | `KEY_INFO` / `KEY_GUIDE` | `INFO` / `GUIDE` | `INFO` / `GUIDE` |
| source | `KEY_SOURCE` | - (sources list) | `TV_INPUT` |
| tools / settings | `KEY_TOOLS` / - | - | - / `SETTINGS` |
| channel list / previous | `KEY_CH_LIST` / `KEY_PRECH` | - | - |
| vol up/down, mute | `KEY_VOLUP/KEY_VOLDOWN/KEY_MUTE` | `VOLUMEUP/VOLUMEDOWN/MUTE` | `VOLUME_UP/VOLUME_DOWN/MUTE` |
| ch up/down | `KEY_CHUP/KEY_CHDOWN` | `CHANNELUP/CHANNELDOWN` | `CHANNEL_UP/CHANNEL_DOWN` |
| 0-9 | `KEY_0..KEY_9` | `0..9` | `0..9` |
| red/green/yellow/blue | `KEY_RED/GREEN/YELLOW/KEY_CYAN`(blue UNVERIFIED) | `RED/GREEN/YELLOW/BLUE` | `PROG_RED/GREEN/YELLOW/BLUE` |
| play/pause/stop | `KEY_PLAY/KEY_PAUSE/KEY_STOP` | `PLAY/PAUSE` (stop via `media_stop`) | `MEDIA_PLAY/PAUSE/STOP` |
| rew/ff | `KEY_REWIND/KEY_FF` | via `media_previous/next`? UNVERIFIED | `MEDIA_REWIND/MEDIA_FAST_FORWARD` |
| power | never as a key (toggle); use `turn_on/off` | same | same |

Profiles are data (a versioned table in the backend), not code paths. A key missing from a profile is not rendered.
Model-specific keys (Samsung "keys vary per model") are enabled per screen in settings, not guessed.

## 7. Sources and apps

- **Sources** = the entity's `source_list`, curated per screen in settings: order, hide, rename ("HDMI 1" ->
  "HDMI 1 · ממיר"), optional glyph. Selection = `media_player.select_source` with the entity's own source string
  (never the display name).
- **Apps**: Samsung - `app_list` entries also appear in `source_list`; launching by `select_source` or `play_media`
  type `app`. LG - apps are in `source_list`. Android TV - `activity_list` / deep links through `remote.turn_on`.
  The UI shows apps in their own tab with neutral glyphs; names as the TV reports them; no brand logos or colours
  (SSV's logo option downloads channel/app logos - we do not display them in the product).
- **Recent**: kept by us per screen from confirmed source/app changes (last 3 shown). Not synced to the TV.
- **Channels**: channel up/down and the numpad work on the TV source; a curated channel list (SSV `channel_list`,
  LG `play_media channel`) is a later option.
- **Public screens**: changing app/source on a screen in a shared space (lobby, sports hall) can put arbitrary content
  in front of an audience; proposed separate permission (section 9).

## 8. Model: a screen inside the unified media device

From `MUSIC_ASSISTANT_API_NOTES.md` section 4: `MediaDevice { device_key, display_name, area_id/floor_id, kind,
identity, endpoints[], primary{power, volume, mute, source, transport, browse, queue, group}, confidence }`. A screen
is a `MediaDevice` with `kind = tv` (or `projector`). For screens:

| Control | Primary endpoint (default) | Notes |
|---|---|---|
| power | vendor TV integration (SSV / webostv / androidtv_remote) | never Cast (its "on" launches an app) |
| keys | the same vendor integration (key transport of the profile) | Android: the `remote.*` entity |
| sources / apps | vendor integration | Android: activities |
| volume / mute | linked receiver/soundbar when the screen's audio goes there (owner's "מגברים" row), else the TV | LG `external_speaker` removes `VOLUME_SET` - a hint that a receiver owns volume |
| now playing / transport | Cast when it reports an active app with metadata, else the vendor integration | |
| music (MA) | none for TVs by default | MA disables Cast "TV" devices by name heuristic; MA endpoints of a TV are hidden |

Join rules (same order as the MA notes): same HA device id; MAC in device `connections`; protocol ids; IP and
name/area only as suggestions; manual link in settings. **TV vs its speakers:** a receiver/soundbar is its own
`MediaDevice` (kind `receiver`/`soundbar`) linked to the screen by an explicit `audio_link` (set by the installer);
the screen card shows it as "שמע: מגבר סלון" and the remote offers "רמקולי המסך / מגבר"; the receiver still appears as
its own device in "נגנים ורמקולים". Duplicates (SmartThings/DLNA/MA copies of the same TV) are hidden endpoints, listed
only in settings ("חיבורים").

## 9. Permissions (proposal, to reconcile with CR-007 `devices.*` and the MA notes' `media.*`)

| Permission | Allows | Default |
|---|---|---|
| `media.read` | see screens, state, now playing | viewer+ within scope |
| `media.control` | volume, mute, keys, transport, text entry | operator+ within scope |
| `media.power` | power on/off, source and app change | operator+ within scope |
| `media.public` | source/app change and text entry on screens flagged "public" (shared spaces) | site_admin (owner grants) |
| `media.bulk` | floor/area "כבה מסכים" | same as `devices.control_bulk` |
| `media.layout` | remote layout, source/app curation, hide screens | site_admin |
| `media.config` | device merge/split, profiles, audio links | system_admin, settings only |

Server-side checks on every command: role + scope (floor/area), capability of the live endpoint, profile allows the
key, not a public screen without `media.public`, audit row (actor, device, endpoint, key/action, result).

## 10. Safety rules

1. Every state-changing action is one explicit tap; no automatic power on when opening the remote; no power keys.
2. No cross-device effects from our UI: SSV `sync_turn_on/off` and LG turn-on automations are owner config - shown in
   settings as "גם מדליק: ..." (read-only); an Arx command never triggers another device by itself.
3. Key rate limit per screen (proposal: max 5/s; hold-to-repeat only for arrows and volume, 200 ms interval, stops on
   release, capped at 10 s); slider debounced to 4 updates/s; volume ceiling per screen optional (settings).
4. No queued or retried physical commands after a reconnect (AGENTS.md). Commands carry a client request id; the UI
   shows accepted / confirmed / not confirmed.
5. Bulk off: confirmation dialog (question + count, details collapsed), only screens confirmed on (or art mode),
   per-device outcome, never receivers that feed other rooms unless linked to a screen being turned off (open question).
6. Text entry sends only what was typed, max 200 chars; never pre-filled; not logged in audit (only "text sent").
7. Only the fixed key set of the profile; no arbitrary service calls from the remote (unlike URC `perform-action`).

## 11. How the mockup maps this

`docs/design/mockups/media/index.html`: rail entry "מולטימדיה" with sub-tabs מסכים / נגנים ורמקולים / קבוצות; screen
cards grouped by floor with search and a state filter; per-floor "כבה מסכים" with the confirmation dialog; the remote
as a side sheet (desktop) / bottom sheet (phone); the area screen's media section opens the same remote. The mock bar
switches the key profile (Samsung / LG / Android TV / generic) live; states: loading, empty, refresh error, view only,
"command not confirmed". Eight sample screens cover: playing app with a linked amplifier, TV source with channel,
Frame art mode, Android off, generic (no keys), LG without remote power-on, Android screensaver with amplifier,
unavailable.

## 12. UNVERIFIED items

1. Samsung blue colour key: `KEY_CYAN` per URC; `KEY_BLUE` not seen in the fetched Key_codes summary.
2. SSV user-visible state while in art mode (entity ON vs OFF); how `source_list` entries reveal their kind.
3. LG text entry transport (URC shows a keyboard in "replace" mode; no core action documented); LG rewind/fast-forward.
4. LG entity state when off with a turn-on trigger configured; full `sound_output` value list.
5. `webostv.button` extra buttons (`NETFLIX`, `AMAZON`) - in the actions page, not in strings.json.
6. Whether the HA `cast`/`samsungtv_smart`/`webostv` integrations register MAC `connections` usable for the join
   (check on real, redacted registry data).
7. The owner's installed versions of SSV, HA core and MA (nothing was contacted).
8. Whether SSV and the core `samsungtv` integration can coexist for the same TV.
9. `entity_picture` proxying for `media_image_url` of app logos (HA core behaviour, not re-read).

## 13. Sources (fetched 2026-09-30)

| ID | URL | Used for |
|---|---|---|
| S1 | https://github.com/ollo69/ha-samsungtv-smart (README; raw `README.md`) | options, lists, quirks |
| S2 | https://raw.githubusercontent.com/ollo69/ha-samsungtv-smart/master/custom_components/samsungtv_smart/ (`media_player.py`, `remote.py`, `const.py`, `services.yaml`, `manifest.json`, `api/samsungws.py`) | features, attributes, actions, art mode, remote entity |
| S3 | https://raw.githubusercontent.com/ollo69/ha-samsungtv-smart/master/docs/ (`Key_codes.md`, `Key_chaining.md`, `App_list.md`, `Smartthings.md`) | key names, chaining, app ids, SmartThings |
| S4 | https://raw.githubusercontent.com/Nerwyn/universal-remote-card/main/README.md | card features |
| S5 | https://github.com/Nerwyn/universal-remote-card/wiki (General, Layout, Actions, Platforms) | elements, actions, platforms |
| S6 | https://raw.githubusercontent.com/Nerwyn/universal-remote-card/main/src/models/maps/{samsung_tv,webos,android_tv}/defaultKeys.ts | per-platform key maps |
| S7 | https://www.home-assistant.io/integrations/webostv/ and the action pages `webostv.button`, `webostv.command`, `webostv.select_sound_output` | LG behaviour |
| S8 | https://raw.githubusercontent.com/home-assistant/core/dev/homeassistant/components/webostv/ (`media_player.py`, `const.py`, `strings.json`) | LG features, sources |
| S9 | https://www.home-assistant.io/integrations/androidtv_remote/ + core `androidtv_remote/` source | Android keys, activities, limits |
| S10 | https://www.home-assistant.io/integrations/cast/ + core `cast/` source | Cast features, states |
| S11 | https://raw.githubusercontent.com/home-assistant/core/dev/homeassistant/components/media_player/const.py | feature flag values, states |
| S12 | https://developers.home-assistant.io/docs/core/entity/media-player/ | properties |
| S13 | https://developers.home-assistant.io/docs/core/entity/remote/ and core `remote/const.py` | remote entity |
| S14 | https://www.home-assistant.io/integrations/samsungtv/ + core `samsungtv/` source | core Samsung, for contrast |
| S15 | repo `docs/research/MUSIC_ASSISTANT_API_NOTES.md` (branch `pilot/media-research`), `docs/changes/CR-007-DEVICE-CONTROL.md` | device model, permissions baseline |
