"""The product settings registry: every key with its default (`DEFAULTS`), the integer keys, the stored-value normalisers
and `read_settings` - moved here from routers/settings.py (CR-SETTINGS-STORE-2436, review 05:P1-10 step 1) so a service
reads settings without importing a router. routers/settings.py re-exports every name, so callers are unchanged.

`setting_value(conn, key)` (review 05:P1-03) reads ONE plain key - the same value `read_settings(conn)[key]` answers -
without reading and parsing every key. A key with a normaliser (NORMALISED_KEYS) keeps using `read_settings`."""
from __future__ import annotations

import json
import re
import sqlite3
from typing import Any

from ..db import get_setting, get_settings_many
from ..errors import ApiError
from . import app_download, area_row, automation_settings, brand_colors, home_screen, home_screen_options, intercom_authority, look, media_layout, mobile_options, nav_size, dd_style, palettes, plan_bakes, plan_view, tabs_mode, timeline_colors, xs_options

DEFAULTS: dict[str, str] = {
    # auto | webrtc | mse. Automatic by default (owner decision 2026-10-05, supersedes the MSE default of 2026-09-14):
    # the player tries WebRTC first and falls back to MSE only when WebRTC cannot be used (no ICE connection within a
    # short bound, a stream the browser does not decode from RTP, go2rtc refusing the stream). `webrtc` = WebRTC only,
    # `mse` = MSE only (a deliberate choice for a customer whose browsers can never reach go2rtc over UDP: Ingress /
    # Cloudflare / CGNAT with no direct path). Migration: no row in `settings` = the new default; a stored value (only
    # ever written by an administrator's PATCH) is a choice and stays as it is - including a stored "mse".
    "media.transport_default": "auto",
    "media.max_live_sessions": "16",
    "media.wall_profile": "sub",  # sub | main — profile used by the camera wall
    # owner 2026-10-01: the notes the live player draws about HOW it plays (the banner "WebRTC לא זמין לזרם הזה · MSE דרך המנהרה", the
    # remote-policy hint and the "מנגן דרך MSE" line). "false" (default) keeps the screen clean - the badge stays and carries the same
    # text as its tooltip; "true" shows them (an installer chasing a transport problem).
    "media.video_notices": "false",
    # LIVE-H265-2341: a camera stream in H.265 that this browser cannot decode (Chrome / Edge over WebRTC). auto = the other profile
    # when it is H.264, else an H.264 variant go2rtc transcodes (smplwise_ namespace), else the message; sub = only the other profile;
    # transcode = only the transcoded variant; off = the stream as it is. The recorder's own encoding is never changed (services/live_codec.py).
    "media.h265_policy": "auto",
    "media.h265_max_transcodes": "2",  # distinct transcoded streams at once (CPU on the go2rtc host); 0 = never transcode
    # CAM-H264-VERIFY-2361 (owner 02.11 round 14): a bulk ENCODING change whose stream is refused by the NVR (that camera only) - skip = leave
    # that stream as it is, list it and continue with the next one (default); stop = the CR-020 S2C rule, the whole change stops there.
    # Never covers a permission loss, the recorder's write switch turned off, an unreachable / busy NVR or an unknown outcome: those always stop.
    "nvr.batch_on_refusal": "skip",
    "snapshots.max_age_s": "60",
    # IANA zone of the site/NVR wall clock (chapter 20). The lab NVR reports windowsZone "Israel Standard Time".
    "time.zone": "Asia/Jerusalem",
    # DEPRECATED since 0.1.148: the earlier design "SW B" was removed, SW A is the only design. Both keys stay accepted and stored
    # (an old client or a backup may still send them) but nothing reads them: the value 'b' changes nothing.
    "ui.design": "a",
    "ui.design_names": '{"a": "SW A", "b": "SW B"}',
    "ui.wall_count": "4",  # tiles the camera wall opens with (a browser can override it for itself)
    "ui.kiosk_cols": "3",  # kiosk page layout when the URL carries none
    "ui.kiosk_rows": "2",
    # WALL-PHONE-TOOLBAR-2401 (owner 04.11 evening): the camera wall's toolbar on a phone (under 768 px). icons (default) = ONE row of
    # icon keys, each control's full name on a long press / as its tooltip and accessible name; labels = the earlier two rows with the
    # full labels (each control a 150 px basis). Installation-wide; the desktop toolbar is the same in both.
    "ui.wall_phone_bar": "icons",
    "ui.hide_search": "false",  # hide the AI search tab (the owner's choice while it is not in use)
    # TOPPILL-295 (owner 2026-10-24): the search button in the top-left pill. OFF by default - a search is a way to reach places a person
    # was not sent to. `ui.global_search` = off | admins | roles | all; `roles` reads `ui.global_search_roles` (comma-separated role ids).
    # A system administrator (system.configure) always passes while it is on. Enforced by GET /search, not only by hiding the button.
    "ui.global_search": "off",
    "ui.global_search_roles": "",
    # screen the UI opens on: explore (map) | live (overview) | wall | events | playback | devices ("ראשי", the device overview).
    # CR-013 (owner request 2026-09-29): "ראשי" is the default landing screen; an administrator's saved choice still wins.
    "ui.start_route": "devices",
    "ui.hide_map": "false",  # hide the map area from the navigation for everyone (a single user: a role without map.read)
    # owner 2026-09-30: the security area's "תמונת מצב" (live overview) sub-screen; "false" hides it from the navigation and
    # redirects its route to the next live page. Per installation; the screen itself stays a normal, permitted route.
    "ui.security_snapshot": "true",
    # owner 2026-09-29 (overview tiles): the summary tiles' shape on the Live overview and the devices screens -
    # auto (compact under 600 px wide, cards above) | cards (tall, icon above) | compact (a rectangle, icon beside the
    # value). Per installation; a browser may override it for itself (frontend/src/api/tile-layout.ts).
    "ui.tile_layout": "auto",
    # POLISH-295 (owner approval 2026-10-25): control screens never scroll - a long list shows one page at a time, this many rows per
    # page on a desktop and on a phone (frontend/src/api/screen-display.ts); the schedules list opens in rows unless the browser chose.
    "ui.page_size.schedules": "10",
    "ui.page_size.schedules_phone": "7",
    "ui.page_size.automations": "12",
    "ui.page_size.automations_phone": "7",  # POLISH2-295: 9 rows scrolled a 390x844 phone
    # POLISH2-295: the automations cards' own page sizes (a card is about four rows tall); 1 a page is allowed for the cards only
    "ui.page_size.automations_cards": "6",
    "ui.page_size.automations_cards_phone": "1",
    "ui.schedules_view": "rows",  # rows | cards | table | week
    "ui.automations_view": "rows",  # rows | cards (POLISH2-295: the cards with their sentence stay a choice; a browser may keep its own)
    # Design foundation (2026-10-01): the installation's skin (classic = today's look | domus | tesla; frontend/src/design/skins)
    # and light / dark / auto choice (a browser may keep its own scheme, in the browser only). Per installation.
    "ui.skin": "classic",
    "ui.scheme": "light",
    # MOTIONSETTING-297 (owner 2026-10-27): the motion setting, separate from the skin and the scheme - auto (follow the operating
    # system's reduced-motion choice) | full (ignore that reduction for non-essential motion) | reduced (zero durations, press scale 1,
    # the same thing the OS reduction does). Per installation; frontend/src/design/apply.ts reads it (data-motion on <html>).
    "ui.motion": "auto",
    "ui.entry_animations": "on",  # 2.29.0: on | off - the panel entrance animation of the classic / domus skins; ENTER_MODES in frontend/src/design/apply.ts
    "ui.rail_tone": "auto",  # SKINCOMP-297: auto | dark - the dark (navy) rail of a skin that has one (Arx Infra = direction D); RAIL_TONES in frontend/src/design/skins/index.ts
    # 2.4.4 (owner 2026-10-10): the product's accent colour and the colour of a switch that is on - "default" (the skin's own: the
    # system blue of the classic look) | a preset id (ios_green = the earlier glass mockup's green) | "#rrggbb". services/brand_colors.py;
    # applied by the frontend on the DU1 token layer (design/brand.ts). Per installation.
    "ui.accent": brand_colors.DEFAULT,
    "ui.toggle_on": brand_colors.DEFAULT,
    # CRY (2026-10-10): the background artwork behind the glass (the crystal skin paints it) - builtin (the day / night pair that
    # ships with the product, chosen by the scheme) | none | custom (the installation's uploads, routers/ui_background.py). A user's
    # own choice (/me/prefs `ui.background`) wins. `ui.background_images` is written by the upload routes only (the version stamp of
    # each slot) and read back as an object.
    "ui.background": "builtin",
    "ui.background_images": "{}",
    # Bubble foundation (owner 2026-10-02): the look dials of the skin - density, surface, pop-up kind, corner radius, transparency,
    # scale, desktop touch target, palette - a JSON object (shape, lists and ranges in services/look.py), read back as an object.
    # The installation default carries every dial; a user's own partial override (/me/prefs) wins per dial.
    "ui.look": json.dumps(look.DEFAULT, separators=(",", ":")),
    # Release 0.1.155: the custom colour palettes of the Bubble skin - a JSON list, each checked for shape (services/palettes.py; low contrast is only a warning in the editor)
    # before it is stored; "[]" = none. A palette id in the look dial (custom-<slug>) points at one of them. Per installation.
    "ui.palettes": "[]",
    # UI round 1 (owner 2026-09-30): the size of the side rail / phone bottom bar - a JSON object, shape and ranges in
    # services/nav_size.py ({"mode":"rel","preset":"m"} or {"mode":"free","icon":..,"label":..,"item":..}); a user's own
    # value (/me/prefs) wins. Read back as an object.
    # Home redesign (owner decision 2026-09-30): the installation default is the large preset "l"; a size an administrator or
    # a user saved earlier is a stored value and is never touched by the new default.
    "ui.nav_size": '{"mode":"rel","preset":"l"}',
    # owner 2026-09-30 (tabs per section): installation-wide tab order / visibility per navigation section, a JSON object
    # {section_id: {"order": [tab_id...], "hidden": [tab_id...]}}; read back as an object, not a string. "{}" = nothing
    # configured = the built-in tabs. Contract: docs/architecture/TABS_CONFIG.md.
    "ui.tabs": "{}",
    # SERVICEIA1-295 (owner 24.10): the service-management area's section row for a user who sees ONE section only - hide_single (the
    # default: the row is not drawn, the page row is) | always. Edited in Settings > general > tabs; presentation only.
    "ui.tickets_section_row": "hide_single",
    # release 0.1.153: how the tab groups are presented - tabs (default) | hybrid | dropdown - and a per-group override (a JSON object
    # {home|area|multimedia|security|settings: mode}, read back as an object). A user's own value (/me/prefs) wins. services/tabs_mode.py.
    "ui.tabs_mode": "tabs",
    "ui.tabs_mode_groups": "{}",
    # release 0.1.157: the look of a dropdown - auto (today's) | pill | field | underline | text | prefix | tonal - global and per tab group
    # (a JSON object read back as an object). A user's own value (/me/prefs) wins. services/dd_style.py.
    "ui.dd_style": "auto",
    "ui.dd_style_groups": "{}",
    # owner 2026-10-03: how a dropdown opens on a phone - sheet (a bottom sheet) | list (the small list under the field). services/dd_style.py.
    # 2.0.3 (owner 2026-10-05): the default is list; the sheet stays selectable in Settings > tabs.
    "ui.dd_phone": "list",
    # 2.0.3 (owner 2026-10-05): from how many cameras a multi-select picker carries a search field - always | 4 (default) | 8 | never -
    # and how the camera comparison picker is shown - dropdown (default) | chips (a button per camera). services/dd_style.py.
    "ui.dd_search": "4",
    "ui.dd_picker": "dropdown",
    "ui.dd_place": "1",
    # Unreleased (owner 2026-10-04): the SIZE of a dropdown - sm | md (the reference size, default) | lg - global and per tab group
    # (a JSON object read back as an object). A user's own value (/me/prefs) wins. services/dd_style.py.
    "ui.dd_size": "md",
    "ui.dd_size_groups": "{}",
    # Unreleased (owner 2026-10-04, capsule style only): ring thickness in px - "1" | "1.5" | "2" (default) | "3" - and open-panel width -
    # "button" | "240" (default) | "300" - each global and per tab group (a JSON object). A user's own value (/me/prefs) wins. services/dd_style.py.
    "ui.dd_ring": "2",
    "ui.dd_ring_groups": "{}",
    "ui.dd_panel": "240",
    "ui.dd_panel_groups": "{}",
    # owner 2026-09-30 (phone UX guards): which kinds of management the phone UI (< 768 px) hides - a JSON object of booleans,
    # shape and defaults in services/mobile_options.py; read back as an object. A UX guard only: permissions are unchanged.
    "ui.mobile": '{"hide_structure":true,"hide_layout_editor":false,"hide_wall_arrange":false,"hide_settings_writes":false,"hide_permissions":false,"hide_control_images":true}',
    # 2.29.0 (owner decisions 2026-10-29): the building cross-section, the synoptic map and the (off by default) fire-alarm UI - one JSON object of options,
    # shape and defaults in services/xs_options.py; read back as an object. Fire detection is NOT a product feature: fire_ui only prepares the UI.
    "ui.xs": json.dumps(xs_options.DEFAULT, separators=(",", ":")),
    # owner 2026-10-01 (the person dots and the recording bars were both blue): the colour of each thing the investigation timeline
    # draws - a JSON object {recording, motion, person, vehicle, door, line, offline: palette name | #rrggbb}, shape and
    # defaults in services/timeline_colors.py; read back as an object. Applied by the frontend as custom properties.
    "timeline.colors": json.dumps(timeline_colors.DEFAULT, separators=(",", ":")),
    # owner decision 2026-10-01: who sees the two technical items of the recording screens - the grey helper line above every
    # timeline ("דיוק לפי פריים מפתח · לחיצה או גרירה = חיפוש · גלגלת = זום") and the diagnostics block under the player (session,
    # generation, state, player, time zone, coverage, range end): all | installers (callers holding system.configure at
    # installation scope - the same check as the installer-only screens) | hidden. Defaults keep today's behaviour. Presentation
    # only: nothing server-side depends on it.
    "playback.helper_line": "all",
    "playback.diagnostics": "all",
    "history.ha_secondary": "false",  # S2: the HA recorder fills entity states the local history does not know (marked as secondary)
    # CR-TIMESCRUB101 (owner-approved 2026-10-24): the time scrub of the historical map - the module flag (default off: the routes answer
    # 404 and the screen is today's), the longest period one range request covers (days, 1..30) and how long the past of presence
    # sensors is kept (days, 1..30; it only shortens the 30-day state history; applied by ha_history.prune while the flag is on)
    "history.timescrub": "false",
    "history.range_max_days": "7",
    "history.presence_retention_days": "7",
    "plan.estimates": "true",  # Plan Studio: show estimated metres (≈) before a plan is calibrated; false hides metres until calibration (owner decision 2026-09-23)
    "plan.levels": "all",  # default levels view on every map: all levels together, or the floor's default level only (owner decision 2026-09-26)
    "map.shared_levels": "show",  # CR-009: the levels of a shared room's home floor in the other floor's level bar ("מפלס ראשי · קומה -1"): show | hide (owner 2026-09-29)
    "map.default_floor": "",  # owner 2026-09-30: the floor the map's floor tab opens first when several floors exist ("" = the built-in order); an existing floor id, cleared when that floor is deleted
    "map.default_view": "2d",  # the view a floor map opens in - live map, history map, event page: 2d | 3d (owner 2026-09-29); a device's own last choice wins
    "plan.quality": "auto",  # CR-006 / owner bug 2026-10-10: the 3D view mode a browser opens with - auto (full, dropping to schematic after a sustained low frame rate), 2 (full, kept even when slow: a hint only), 1 (schematic); a user's own /me/prefs plan.quality overrides it
    "plan.surfaces": '["devices", "area"]',  # K88 (owner 2026-10-04 Q2): where the live plan shows besides the map tab - "devices" = a plan view in חשמל והתקנים, "area" = a card on the area page; [] = nowhere new
    # CR-029 S0 (Plan Studio 6, LOOK_SPEC section 10): the installation's look dials of the realistic 3D and the walk - a JSON object
    # read back as an object (services/plan_view.py: style, furniture models / procedural, texture files / procedural, wall display
    # live / stills, kiosk idle seconds, time source, mouse look, quality rung, eye height, DPR cap, section cut, temperatures, motion).
    # A person's own override (/plan-view/prefs) wins per dial; the default view stays schematic for everyone (owner 2026-10-09).
    "plan.view": json.dumps({k: plan_view.DEFAULT[k] for k in plan_view.SITE_DIALS}, separators=(",", ":")),
    # CR-029 S2 (Plan Studio 6; owner 2026-10-11): where the sun of the realistic 3D stands. "home" (default) = the home's own
    # location (the core config the HA sync reads, services/site_location.py); "manual" = the two values below, an explicit
    # override only. Without either the view uses the fallback 32.0 / 34.8 (central Israel) and says so. Never sent anywhere.
    "site.location_source": "home",
    # the manual override (degrees, east / north positive); "" = not set. Used only while site.location_source = "manual".
    "site.latitude": "",
    "site.longitude": "",
    # CR-029 S3: what the "prepare stills and lighting" step bakes per floor (presets, styles, time bands, the lightmap, the still's
    # size) and the storage caps per floor / installation (services/plan_bakes.py SETTING_*). A JSON object read back as an object.
    "plan.bakes": json.dumps(plan_bakes.SETTING_DEFAULT, separators=(",", ":")),
    # CAMSUGGEST138-295 (board r138): the defaults of "suggest the nearest camera" in the zone editor (frontend/src/map/camera-suggest.ts).
    # distance = the farthest a camera may stand from the zone, in percent of the plan width; fov = how strongly a known field of view that
    # misses the zone counts against a camera, in percent (0 = distance only, 100 = such a camera is not offered); count = suggestions offered.
    "plan.camsuggest_distance": "35",
    "plan.camsuggest_fov": "50",
    "plan.camsuggest_count": "3",
    "plan.presence_fade": "3",  # CR-006 1b: the presence tint on the floor map fades this many minutes after the last motion; "off" = the tint only while a sensor is on (owner decision 2026-09-28: on/off + minutes per installation)
    "playback.max_sessions": "4",  # playback sessions open at once (each is one NVR RTSP playback stream)
    "playback.lease_s": "600",  # idle lease; the janitor deletes the go2rtc stream after it expires
    # PLAYBACK-SCRUB-2341: at most this many seeks (new generations) per playback session in a rolling minute; over it the seek is
    # refused with a Hebrew notice (429 seek_rate) and the current generation keeps playing. 0 = no cap.
    "playback.max_seeks_per_min": "30",
    # ASYNCIO-DEFAULT-2342 (owner 02.11, answer 5A): "שרת: רכיב תקשורת מהיר" - the native event loop / HTTP parser (uvloop + httptools)
    # instead of the standard asyncio + h11. Off by default; read once at start-up by smplwise/__main__.py (applies after a restart);
    # the environment variable SW_FAST_NETWORK wins over it, the crash guard's safe mode wins over both.
    "server.fast_network": "false",
    # WARMUP-POLISH-2421 (owner-approved): the start-up warm-up - the server's bounded read-only warm-up of what the first screens read
    # (services/startup_warmup.py, read at start-up) and the browser's idle fetch of the common screens' chunks. On by default; the
    # environment variable SW_STARTUP_WARMUP wins on the server side.
    "server.startup_warmup": "true",
    # 2.0.0 stall detection (docs/changes/PLAYBACK-STALL-RESUME.md): seconds without media progress while a recording should be playing
    # before the player says "מתחבר מחדש", and how many automatic "resume from here" attempts (each a new generation of the same session,
    # the old go2rtc stream deleted) it makes before "הניגון נעצר" with a retry button; 0 = detect and stop, no automatic attempt.
    # Read by the browser only: nothing server-side depends on them.
    "playback.stall_s": "5",
    "playback.auto_resume_attempts": "3",
    # CR-024 (owner 2026-10-04): EXPERIMENTAL, unproven synchronized playback of cameras of different recorders; off = such a group
    # is refused (409 sync_cross_recorder_unproven). On = each member is asked for in its recorder's zone and clock offset
    # (services/recorder_clock.py)
    "playback.cross_recorder_sync": "false",
    "exports.max_mb": "2048",  # refuse export jobs whose NVR files exceed this estimate
    "exports.retention_days": "7",  # finished export files are deleted after this many days
    "events.retention_days": "30",  # stored events are pruned after this many days
    "audit.retention_days": "365",  # T055: the janitor prunes audit rows older than this (was a fixed constant)
    "cases.import_max_mb": "512",  # T050: the largest evidence bundle accepted for verification / import (streamed to a temp file)
    "storage.min_free_mb": "1024",  # free space kept on /data (SQLite lives there): bundle uploads / imports that would go below are refused (507); T068: new exports too, running ones pause
    # semantic search (T063): the local baseline needs no network; an external analysis provider is opt-in with a privacy acknowledgement and a daily budget — none is bundled
    "ai.provider": "local",  # none | local | external
    "ai.privacy_ack": "false",
    "ai.budget_daily": "0",
    # CR-006 phase 2 (AI-rendered floor skins, slice 2a): a family of its own, not the ai.* keys above - those are the
    # search's analysis provider (event metadata, none bundled); a skin sends a floor picture to an image provider, a
    # different piece of data and a different consent. Nothing is sent while skins.privacy_ack is false; the API key is
    # in the in-app secrets store (openai_api_key, TKSECRETS2; never a setting). Budgets count successful renders (routers/skins.py).
    "skins.provider": "openai",  # the one implementation today (owner decision 2026-09-28, CR-006 7.1 a)
    "skins.model": "gpt-image-1.5",  # the OpenAI image model for edits (the official SDK's default)
    "skins.privacy_ack": "false",
    "skins.budget_renders_per_floor": "4",  # per floor and structure (CR-006 7.3: 2 by default, up to 4)
    "skins.budget_monthly": "20",  # per installation and calendar month; the connection test counts
    # CR-005 recorded decision 2026-09-28 (embedded panel): per SMPLWISE WisKey screen, which one the WisKey area shows -
    # "wiskey" = the owner's real WisKey Home Assistant panel embedded as-is (the default), "smplwise" = the screen built
    # here. The other WisKey screens (stations, sync, health, audit, management) are always embedded.
    "access.ui.overview": "wiskey",
    "access.ui.events": "wiskey",
    "access.ui.people": "wiskey",
    "access.ui.stations": "wiskey",  # CR-036 S6: "תחנות ודלתות" (route #/wiskey/devices, the embedded panel's own devices tab); the embedded panel stays the default
    "access.ui.schedules": "wiskey",  # CR-036 S9: "לוחות זמנים" (route #/wiskey/schedules, read-only); "wiskey" = no own tab, the embedded panel's tools keep them
    # T054 follow-up (owner request): hide the whole WisKey area from the navigation for everyone, regardless of role -
    # the same "hidden for everyone" shape as ui.hide_map, but for the WisKey top-level area. The access.ui.* choices
    # above apply only while this is false.
    "ui.hide_wiskey": "false",
    # owner 2026-09-30: how much of the screen the embedded WisKey panel uses, per installation (admin-only write).
    # normal = fills the content area at 100% | fit = the frame is rendered larger and scaled down by ui.wiskey_scale
    # percent (WisKey then sees a bigger frame and shows more cards) | full = covers the whole viewport with a small exit.
    "ui.wiskey_size": "normal",
    "ui.wiskey_scale": "90",  # the scale of "fit": 100 | 90 | 80 | 70
    # WisKey rc.37 start choices per installation (a user's own choice, /me/prefs wiskey.density / wiskey.wall, wins):
    # the `density` (overview cards: auto | 4 | 6 | 8 | 9 | 12) and `wall` (camera-wall streams: auto | 4 | 9 | 12) query
    # parameters of the embedded panel's address. "auto" leaves the parameter out (WisKey's own choice).
    "ui.wiskey_density": "auto",
    "ui.wiskey_wall": "auto",
    # T054 follow-up (owner request 2026-09-29, experimental): embed WisKey inside the Home Assistant Companion app too,
    # by relaying the app's sign-in bridge from Home Assistant's top document into the nested frame
    # (frontend/src/wiskey/companion-bridge.ts). "false" (the default) keeps the 0.1.123 behaviour: no frame in the app,
    # the SMPLWISE screen or a note plus "פתח ב-WisKey".
    "access.phone_embed": "false",
    # SETTINGS-INTERCOM-CARDS-2401 (owner 04.11, round 19 Q6 = a, "with the ability to change to b or c in Settings"): how the Settings
    # tab "מתגי מסכי כניסה" is laid out, per installation - cards (a, the default: one collapsible card open at a time, the tab fits the
    # screen) | tabs (b: two tabs, the display and the announcements / voice) | list (c: the single long list of 2.40.0). Presentation
    # only; every control and every other setting is the same in the three layouts. frontend/src/access-control/settings-cards-logic.ts.
    # SETTINGS-CARDS-ACCORDION-2402 (owner 04.11 night, round 20 Q2 = a): + accordion - the same cards, opened in place (one at a time) also
    # on a desktop; a short screen then scrolls the settings content. cards (headers beside the open card) stays the default.
    "access.settings_layout": "cards",
    # CR-036 S3 (owner answers 2026-10-12: every decision is an administrator setting, the answer is the default): who sees
    # what in the access-control reads - the employee number is a names-level field, the event picture needs only the events
    # view (each view audited), sync error texts need access.admin.read. services/intercom_authority.py reads them per request.
    **intercom_authority.POLICY_DEFAULTS,
    # CR-036 S6 (the same owner answers): what the native stations screen shows. They shape the screen only - the server's filter
    # (intercom_authority) decides what data a caller gets and the physical actions keep their own gates.
    "access.call_hint": "everyone",  # the incoming-call hint (no caller name) on a station card: everyone | call (only who may act on calls)
    "access.talk_button": "classic",  # the talk button: classic (opens the classic panel - stage 1) | hidden
    "access.announce_scope": "scope",  # announcement targets: scope (all stations / a place inside the operator's scope) | station (one station)
    "access.announce_phrases": "",  # the announcement dialog's quick phrases, one per line, up to 8 (empty = the built-in ones)
    # TTS-DEFAULT-ENGINE-2400 (owner 04.11, answer 1א): the installation's fixed announcement engine and language, applied as the
    # preselection of EVERY announcement path (the intercom overview, the station drawer, the multi-station composer); each send may
    # still pick another engine / language for that one announcement. "" = the system default (WisKey's reported default engine, the
    # behaviour before this setting) / the automatic language (Hebrew when the engine has it, else the engine's default). Validated as
    # plain ids only: the engine list is WisKey's and may be unreachable at save time; a fixed engine that is not in WisKey's current
    # list is reported as such by every dialog and is never silently replaced by another engine.
    "access.tts_engine": "",
    "access.tts_language": "",
    # CR-036 S18 (owner 2026-10-12: live video and talk in stage 1, behind a per-screen setting, OFF by default): the station
    # drawer's own live video and push-to-talk - off (the still and the classic panel, as before) | video | video_talk.
    # Talk also needs a talk transport from the intercom (W10) and access.call on the station; without them the talk button
    # keeps its classic-panel mode (access.talk_button). services/intercom_media.py.
    "access.station_media": "off",
    # REL2140 review M-3 (AVW10-295): which provider serves that video - local (default: Arx's own station source, exactly as before W10) |
    # auto (WisKey's W10 media while WisKey's discovery lists its commands, falling back to Arx's own source when WisKey's answer fails).
    # An Arx decision: a WisKey upgrade alone never changes Arx's live path.
    "access.station_media_provider": "local",
    # W10CLIENT-295 (owner 2026-10-24): the longest a talk through the station may last, in seconds (default 300). WKDIRECT-295: the range is
    # WisKey's own (`station_media_max_talk_seconds`, exact int 1..86400, no 180 s clamp); WisKey's per-station value, advertised in its
    # descriptor, still applies on top: the effective limit is the smaller.
    "access.station_media_max_talk_s": "300",
    # WKAUDIN-295 (owner 2026-10-24, live streams and talk first): listening to a station's audio in Arx's own drawer - off (default) | on (needs the
    # descriptor's audio.listen) | probe (a shared session with the owner: the unknown descriptor is accepted). services/intercom_listen.py.
    "access.station_listen": "off",
    # SHAREDID-293 (owner decision 6, 2026-10-20): where the external-access screen ("גישת חוץ") sits - access (the access-control area) |
    # tickets (service management) | both. Read by every user here (navigation only); written by a system administrator through
    # PUT /access-grants/settings (services/access_external.py), never through PATCH /settings.
    "access.external.placement": "access",
    # CR-007 slice 6a: הגדרות › חשמל והתקנים - how the device-control screens look, per installation (read by every user
    # through GET /settings; changed with system.configure, audited like every product setting). Presentation only: the
    # safety rules of the bulk actions (confirmation, expiry, never locks / alarm / door release) are not settings.
    "devices.style": "smplwise",  # smplwise (the product's own look) | glass (the approved mockup's translucent style)
    "devices.theme": "default",  # the style's palette (frontend/src/styles/devices-themes.ts); default | sand | forest | graphite, picked with swatches (6b)
    "devices.default_view": "cards",  # the building screen's first view: cards (tree panel + floor cards) | tiles; a viewer's own toggle wins
    "devices.show_sensors": "true",  # the sensors card on the area screen and the sensors count on the building screen
    "devices.show_climate_strip": "true",  # DEPRECATED since 0.1.149: the per-A/C strips are gone (an A/C indicator sits next to its area, devices.area_row); accepted and stored, nothing reads it
    "devices.density": "comfortable",  # comfortable | compact (tighter tiles, rows and gaps)
    # CR-007 6b: the device area's colour scheme - light (default) | dark | auto (the viewer's operating-system scheme).
    # Light by default while the app shell is light only: dark never applies by itself (docs/design/DEVICE_THEMES.md).
    "devices.scheme": "light",
    # 2.4.4 (owner 2026-10-10): the glass screens' light / dark behaviour (devices, schedules, automations, media, notifications) -
    # follow (default: the product's scheme, the DU1 rule - never lighter than the shell; `devices.scheme` above still applies inside it)
    # | light (always light, whatever the product's scheme) | dark (always dark). Presentation only (frontend/src/screens/devices-style.ts).
    "devices.glass_scheme": "follow",
    # Owner decision 2026-09-30 (area screen redesign): the direction every area screen opens in - tiles ("אריחים צפופים":
    # section cards in columns, dense tiles) | sections ("מקטעים ברצף": one section after the other). A user holding
    # screen.personalize may override it for their own browser (frontend/src/screens/devices-area.ts).
    "devices.area_design": "tiles",
    # Release 0.1.149 (owner 2026-09-30, the big installation's home screen was crowded): what is shown next to an area's name
    # (devices.area_row) and in a floor's header (devices.floor_row) - two JSON objects read back as objects, validated by
    # services/area_row.py. A user holding screen.personalize may override them in /me/prefs `devices.area_row`.
    "devices.area_row": json.dumps(area_row.AREA_ROW_DEFAULT, separators=(",", ":")),
    "devices.floor_row": json.dumps(area_row.FLOOR_ROW_DEFAULT, separators=(",", ":")),
    # Owner notes 2026-09-30 (the home screen "ראשי" › חשמל והתקנים, edited in its edit mode by a system.configure holder):
    # the page title (empty = "חשמל והתקנים"), the installation's floor order (a JSON list of floor ids; floors not listed
    # follow in level order) and three optional read-only header widgets, all off by default - a clock (off | time |
    # datetime), the weather of one `weather.*` entity, and the weekly parsha / candle-lighting / havdalah of three
    # `sensor.*` entities (the Jewish Calendar integration's). Values come from the mirrored catalogue; no network, no keys.
    "home.title": "",
    "home.floor_order": "[]",
    "home.clock": "off",
    "home.weather": "false",
    "home.weather_entity": "",
    "home.jewish": "false",
    "home.jewish_parsha": "",
    "home.jewish_candles": "",
    "home.jewish_havdalah": "",
    # owner feedback 2026-09-30 (widgets as dashboard tiles): each widget is a small chip, a medium or a large card (default
    # medium); the clock may show seconds; the Jewish widget may also show the Hebrew date of one more sensor
    "home.clock_size": "medium",
    "home.clock_seconds": "false",
    "home.weather_size": "medium",
    "home.jewish_size": "medium",
    "home.jewish_date": "",
    # home redesign (owner decisions 2026-09-30): the direction of the layout - a control centre (default) | b side panel |
    # c compact row; the side of b's widget column; and `home.widgets`, the whole widget configuration (order, per widget
    # on / sizes per direction / heading / entities and fields; services/home_config.py) - read back as an OBJECT, "" = never
    # saved = the 0.1.146 keys above if they were used, else the built-in default with the catalogue's suggestions. A user's
    # own direction and widget choices (screen.personalize) live in /me/prefs `home.personal`, never here.
    "home.direction": "a",
    "home.side": "end",
    # POLISH-295 (owner approval 2026-10-25): the clock, the weather, Shabbat and the alarm as a thin bar in the header (bar, the
    # default before 2.22.0) or as the large widget cards (cards). HOME-295 (owner answers round 2, item 5): auto, the new default = the
    # cards in the cards view and the thin bar in the tiles view.
    "home.info_style": "auto",
    # POLISH-CONTROL-297 (owner decisions on the worst-case report, 2026-10-27): a long floor name in a card header is clamped to 2 lines
    # with a tooltip (1 = one line with an ellipsis, 3 = three lines); a huge list is paged (scroll = the whole list scrolls); a bulk
    # button with nothing to act on is disabled (enabled = always clickable) - the owner keeps the bulk item open for the design talk.
    "home.floor_title_lines": "2",
    "ui.long_lists": "paged",
    "home.bulk_idle": "disabled",
    # HOME-295 (owner answers on the home mockup round 2, 2026-10-25): the home screen's display options, one JSON object read back as an
    # object with every key (services/home_screen_options.py); "" = never saved = the defaults.
    "home.screen": "",
    "home.widgets": "",
    # CR-008 SmplWise Arx remote access (owner decisions 2026-09-29, CR-008 §3f / §7). The channel itself is the add-on
    # option remote_access; these shape who may use it and how the browser keeps its sign-in.
    "remote.policy": "flag",  # flag: only users with the per-user remote-access flag (D4) | any_role: every HA user holding an Arx role
    "remote.admins_default": "true",  # CR-008 amendment (owner 2026-10-01): true = a system administrator signs in remotely without a per-user flag (only under remote.policy = flag)
    "remote.session": "rolling_90d",  # rolling_90d (HA's sliding refresh token, localStorage) | browser_session (sessionStorage) | rolling_90d_idle_lock (D5)
    "remote.idle_lock_minutes": "720",  # the idle lock of rolling_90d_idle_lock
    "remote.default_profile": "main",  # main | sub: the stream a remote viewer gets first, over WebRTC (D7)
    "remote.mse_fallback": "true",  # MSE through the tunnel only as an announced last resort; false = never (D7)
    "security.second_factor_policy": "optional",  # K11 (owner 2026-10-06): the TOTP second factor is optional; "admins" refuses a remote sign-in of an administrator who has none
    "security.second_factor_bearer": "enforce",  # security review 2.2.0 H1: enforce = the factor / admins policy also on a new bearer sign-in (HTTP + WS); off = the pre-2.2.1 bearer path
    # USR2 (docs/changes/CR-USR2-ARX-ONLY-IDENTITY.md, owner answers 2026-10-16): Arx-only identities. `security.local_identity` is the
    # feature switch - off (default): no local user can be created or sign in, and the HA-based sign-in is exactly as before. Changing
    # it needs a system administrator and is audited; switching it off ends every local session. The other keys shape the sessions,
    # the password policy, the link lifetime and the brute-force mode (services/local_identity.py). Never restored from a backup.
    "security.local_identity": "off",
    # SVCIDENT2 (owner decisions 2026-10-17, CR-USR2 section 11): the extended mode of the service identity - off (default): exactly the 2.6.4
    # refusals (doors, zone bypass, scripts / scenes, the camera stream source). On (AND the bridge's own options-flow copy on): those are
    # allowed to an Arx-only user under the user's own Arx permission; the area write never. A system administrator, the local channel
    # only, audited, never restored from a backup. A security review is required before it is ever turned on.
    "security.local_identity_extended": "off",
    "security.local_session": "rolling_30d",  # rolling_30d | rolling_90d | browser_session
    "security.local_admin_session_days": "7",  # 1-7: the absolute lifetime of a session of a local user holding an administrative permission
    "security.local_password_min": "12",  # 10-64
    # IDENT146 (docs/changes/CR-IDENT146.md): personal-data lifecycle of Arx-only identities. All off by default; installation policy, never
    # restored from a backup. purge: delete the personal rows of a local account disabled / deleted for N days (30-3650, owner policy 30);
    # export: a person (or a system administrator on request) may download the personal data Arx holds about that person.
    "privacy.local_purge": "off",
    "privacy.local_purge_days": "30",
    "privacy.personal_export": "off",
    # BACKUP-HASH-ENC (owner 2026-10-17): the minimum length of the backup password that encrypts the local account passwords in a
    # project backup (services/backup_sensitive.py). 8-64; services clamp a stored value to that range (8 is the hard floor).
    # Security policy of this installation: never exported or restored (backup.SETTINGS_KEEP).
    "backup.password_min": "12",
    # OFFBOX-RESTORE-2300 (owner decisions 2026-10-30, services/restore_safety.py): the scope a restore from an off-box copy uses when
    # none is named (and the screen's initial choice), and whether a LOCAL restore writes the pre-restore safety archive first.
    # Installation policy: never exported or restored (backup.SETTINGS_KEEP).
    "backup.offbox_restore_scope": "project+access",  # project | project+access
    "backup.local_restore_scope": "project+access",  # project | project+access (owner answer 2026-10-30)
    "backup.safety_before_local_restore": "on",  # on | off
    "security.local_link_ttl_h": "72",  # 1-168: first-login / reset link lifetime
    # USR2-FIX F2: the per-(account, network) delay and the per-account ceiling lock behave the same in both modes; the value only names
    # the network-tier refusal in the audit (account_delay | account_locked). See CR-USR2 §6 (brute-force semantics).
    "security.local_lock_mode": "delay",
    # USR2 phase 2: the public address (https://<host>) a link sent by WhatsApp points to; "" = only links issued on the remote channel
    # (its own host) can be sent. A system administrator sets it (whoever sets it decides where reset tokens go).
    "security.local_public_url": "",
    # USR2 phase 4: passkeys. `security.local_passkey_first` lets a local user who opted in sign in with a passkey alone (UV required);
    # off by default, system administrators only, never restored from a backup. `security.local_passkey_android`: the app allowed to
    # use this site's passkeys in its WebView (`<package>:<SHA-256 fingerprint>` lines; served as /.well-known/assetlinks.json).
    "security.local_passkey_first": "off",
    "security.local_passkey_android": "",
    "remote.require_mfa_admin": "false",  # D8 (owner 2026-09-29: MFA optional): true refuses admin-permission users without HA MFA remotely
    # CR-008 P2 (hardening): live streams one remote sign-in (a browser / a bearer client) may hold open at once - the
    # next start answers 429; the installation-wide media.max_live_sessions still applies on top
    "remote.max_live_streams": "16",  # default 16 (was 4: an 11-camera wall could not play); a value an administrator saved is never overridden
    "remote.wall_profile": "sub",  # sub | main: the stream the camera wall plays on the remote channel (LAN / Ingress keep media.wall_profile)
    # CR-008 P2: false = the stricter CSP (remote_channel.CSP_STRICT) is report-only next to the enforced one; true = it is
    # the enforced policy. Switched on by the owner after reviewing the reports (הגדרות › גישה מרחוק).
    "remote.csp_enforce": "false",
    # CR-010 (אבטחה › אזעקה, owner request 2026-09-29): alarm control over the remote channel (/arx). remote_control off
    # refuses every alarm action from outside; remote_disarm off refuses only what lowers protection from outside -
    # disarming a panel and bypassing a zone. Inside the local network (Ingress) neither applies. Holders of the
    # permission still need it: these only take rights away.
    "alarm.remote_control": "true",
    "alarm.remote_disarm": "true",
    # CR-010 code policy (owner decisions 2026-09-29): which code a user whose policy is code_required types - personal_pin
    # (their own Arx PIN, a salted hash; the panel code is never revealed) or panel_code (the panel's code, compared with
    # the stored one). remote_codeless: a no_code user arms / disarms without a code from outside too (default on, owner
    # answer 2026-09-29 21:50 - he relies on the Android app's biometric lock); off = from outside everyone types a code.
    "alarm.code_mode": "personal_pin",
    "alarm.remote_codeless": "true",
    "alarm.pin_min_length": "6",  # personal PIN length: 6-8 digits by default (security review L8); 4-8 allowed
    # CR-014 (תזמונים, docs/architecture/SCHEDULER_API.md §10.1): the schedules of the scheduler component. `schedules.enabled`
    # is the feature and its tab - off until an administrator switches it on (coordinator ruling 2026-09-30; the contract's
    # own default of true is superseded). `schedules.classes` is a JSON array of the classes new schedules may use (read
    # back as an array, like ui.tabs); the safety rules (trash, confirmations, code refusal, the allow-list ceiling) are
    # not settings. `schedules.shabbat_sensor` is the "issur melacha in effect" binary_sensor the presets use.
    "schedules.enabled": "false",
    "schedules.classes": '["light", "switch", "cover", "climate", "fan", "alarm", "lock", "door", "script", "scene", "helper", "humidifier", "vacuum", "siren", "media", "number", "select"]',
    "schedules.snap_minutes": "15",
    "schedules.default_repeat": "repeat",
    "schedules.runs_retention_days": "90",
    "device_activity.retention_days": "90",  # DEVHIST S1: the long-press popup's activity rows are pruned after this many days (owner-recommended 90)
    "schedules.shabbat_sensor": "",
    # 2026-10-04 (schedules: more actions; owner decision the same day, option ג): may a NEW schedule disarm an alarm panel directly? ALLOWED by
    # default (with the disarm grant, schedule.sensitive and the explicit confirmation in the editor); a system administrator may restrict it
    # (and lift the restriction again with the typed confirmation `schedules.allow_disarm_confirm`, never stored); every change is audited on its
    # own row. A disarm that needs a code is never schedulable, whatever this says. A stored value is read as stored (no migration).
    "schedules.allow_disarm": "true",
    # CR-015 (מולטימדיה · מסכים ושלט, docs/architecture/MEDIA_API.md 9): the feature and its rail entry; `multimedia.remote_default` is the
    # installation default of the remote's sections (a JSON object, read back as an object; "" = the built-in default), written from the
    # settings page and from "עריכת השלט" (PUT /multimedia/remote-default). The safety rules (no power key, rate limits, confirmations)
    # are not settings.
    "multimedia.enabled": "true",
    "multimedia.remote_default": "",
    # CR-016: the administrator's curation of the favourites / stations / playlists lists - one list for everyone (owner decision 5א). A JSON object
    # `{kinds_on, items: [{item_ref, hidden, order}], revision}`, read back as an object; written ONLY by PUT /multimedia/favourites (optimistic revision).
    "multimedia.favourites": "",
    # CR-017 (אוטומציות · סצנות · סקריפטים, docs/architecture/AUTOMATIONS_API.md 3.1 row 23): every option of the feature, one settings tab. The JSON-valued
    # keys are read back as objects / lists (services/automation_settings.py validates them). The bridge's delegation switch is NOT here: it is read-only state.
    **automation_settings.DEFAULTS,
    # 2026-10-06 (owner): the Android app download offer on the sign-in page; empty address = nothing is offered (services/app_download.py)
    **app_download.DEFAULTS,
    # 2.4.4 (owner 2026-10-10): CR-021 self-update switch - "true" (default, today's behaviour) | "false": POST /system/update/apply is
    # refused (409 self_update_disabled) and the Updates page says so. The check, the interval, the platform restart and an update
    # installed by hand in the platform's own add-on store are never affected (docs/security/CR021_SELF_UPDATE_SECURITY_NOTES.md).
    "update.apply_enabled": "true",
    # CR-038 section 6: the optional tickets module - OFF by default. While off every /api/v1/tickets* route but GET /tickets/module
    # answers 404 feature_disabled, the area and the device tab are hidden, and the module's data is kept. Turning it on or off is
    # audited as tickets.module.enable / tickets.module.disable. Installation identity: kept out of project backups (SETTINGS_KEEP).
    "tickets.enabled": "false",
    # CR-MAINT215 (2.15.0): the maintenance module (certificates, preventive plans, rounds, supplier documents, QR / NFC tags) - OFF by
    # default. While off every /api/v1/maintenance* route but GET /maintenance/module answers 404 feature_disabled and the reminder pass
    # does nothing; the data is kept. Turning it on or off is audited as maintenance.module.enable / maintenance.module.disable.
    "maintenance.enabled": "false",
    # CR-EMERG104: the read-only emergency readiness view (an appendix of the maintenance ledger) - OFF by default. While off every
    # /api/v1/emergency-readiness* route but GET /emergency-readiness/module answers 404 feature_disabled. Audited as
    # emergency_readiness.module.enable / disable (system.configure). Its thresholds, slot bindings, cameras and contacts live in their own routes.
    "emergency_readiness.enabled": "false",
    # CR-MAINT215 slice 2 (owner answers 24.10 q13 / q16: every default editable in Settings): the reminder lead time a NEW task gets when
    # its form leaves it empty, per kind (days before the date; each task keeps its own value), and the address printed on a QR sticker
    # ("" = the installation's remote address; a scan always needs a signed-in person - a later GPS / IMEI confirmation hooks in here).
    "maintenance.lead_days.certificate": "30",
    "maintenance.lead_days.preventive": "7",
    "maintenance.lead_days.round": "0",
    "maintenance.lead_days.vendor_document": "30",
    "maintenance.tag_base_url": "",
    # MAINT215B (owner review 24.10): reminders go out ONLY after an administrator enables them here (default off); the phone round opens
    # as one checkpoint per screen ("step") or one long list ("list"); closing the request a plan opened ASKS the closer whether to mark the
    # plan done ("ask"), marks it at once ("auto") or leaves it alone ("off"); how often the worker looks (minutes), how long the reminder log
    # is kept (days) and the supplier-insurance marks of the tickets picker (a supplier with no insurance document at all; amber window in days).
    "maintenance.reminders_enabled": "false",
    "maintenance.round_phone_view": "step",
    "maintenance.close_request_mode": "ask",
    "maintenance.reminder_check_minutes": "15",
    "maintenance.reminder_log_keep_days": "365",
    "maintenance.vendor_missing_insurance_mark": "true",
    "maintenance.vendor_insurance_warn_days": "30",
    "maintenance.file_max_per_task": "10",
    # SUPPLIERDOCS-297 (provisional, owner questions q52-q56 open): reading an attached supplier certificate (text-layer PDF) into
    # PROPOSED fields that a person confirms one by one. OFF by default; needs the maintenance module. While off every
    # /api/v1/maintenance/docread* and .../files/{id}/read|extraction route answers 404 feature_disabled. No OCR, no model.
    # A security review of the reader boundary gates switching it on in a release (CR-OCR119 section 6).
    "docread.enabled": "false",
    # NVRMASK-295: privacy-mask writes to the NVR (preview + guarded apply). OFF by default: a mask blacks out live view AND the
    # recording. While off the preview and apply routes answer 409 feature_disabled; the read and the undo of earlier changes stay.
    "nvr.privacy_mask_write": "false",
    # MASKCOPY62-295: planning a copy of one camera's privacy masks to other cameras (plan / preview only in slice 1, no device write).
    # OFF by default; while off the plan route answers 409 feature_disabled.
    "nvr.privacy_mask_copy": "false",
}

SCHEDULE_CLASSES = ("light", "switch", "cover", "climate", "fan", "alarm", "lock", "door", "script", "scene", "helper", "humidifier", "vacuum", "siren", "media", "number", "select")
INT_KEYS = ("privacy.local_purge_days", "security.local_admin_session_days", "security.local_password_min", "backup.password_min", "security.local_link_ttl_h", "media.max_live_sessions", "media.h265_max_transcodes", "access.station_media_max_talk_s", "snapshots.max_age_s", "playback.max_sessions", "playback.lease_s", "playback.max_seeks_per_min", "playback.stall_s", "playback.auto_resume_attempts", "exports.max_mb", "exports.retention_days", "events.retention_days", "audit.retention_days", "cases.import_max_mb", "storage.min_free_mb", "ai.budget_daily", "skins.budget_renders_per_floor", "skins.budget_monthly", "remote.idle_lock_minutes", "remote.max_live_streams", "schedules.runs_retention_days", "device_activity.retention_days", "history.range_max_days", "history.presence_retention_days", "ui.page_size.schedules", "ui.page_size.schedules_phone", "ui.page_size.automations", "ui.page_size.automations_phone", "ui.page_size.automations_cards", "ui.page_size.automations_cards_phone", *automation_settings.INT_KEYS)
# BUBBLE-FREEZE-295 (owner 2026-10-26): skins that are frozen - kept in the code, rejected by new writes, and a stored value is read as the fallback.
# Keep in step with FROZEN_SKINS / FROZEN_FALLBACK_SKIN in frontend/src/design/skins/index.ts. Unfreeze = empty FROZEN_SKINS.
FROZEN_SKINS = ("bubble",)
FROZEN_FALLBACK_SKIN = "domus"


def stored_skin(raw: Any) -> str:
    """The installation's skin as the pages draw it: a frozen skin reads as the fallback; an unknown value as the default."""
    if raw in FROZEN_SKINS:
        return FROZEN_FALLBACK_SKIN
    return raw if raw in ("classic", "domus", "tesla", "bubble", "crystal", "infra", "soft") else DEFAULTS["ui.skin"]


PRIVATE_KEYS = ("site.latitude", "site.longitude")  # SEC247 I3: the manual site position - administrators (system.configure) only


def read_settings(conn: sqlite3.Connection, *, private: bool = False) -> dict[str, Any]:
    """Every setting with its stored value read back. `private` keeps PRIVATE_KEYS in the answer - only for a caller that
    holds system.configure (the settings screen); every other listing (GET /settings of a viewer, GET /cameras `media`,
    internal readers) leaves the site position out. The sun reads its location from /plan-view/prefs (map.read), rounded."""
    out: dict[str, Any] = {}
    stored = get_settings_many(conn, DEFAULTS)  # PERF-HOME-DEVICES-2342: one read for every key, not one SELECT per key
    for key, default in DEFAULTS.items():
        value = stored.get(key, default) or default
        out[key] = int(value) if key in INT_KEYS else value
    if out.get("access.external.placement") not in ("access", "tickets", "both"):  # SHAREDID-293: a corrupt value never moves the screen
        out["access.external.placement"] = "access"
    if out.get("access.settings_layout") not in ("cards", "accordion", "tabs", "list"):  # SETTINGS-INTERCOM-CARDS-2401 / -ACCORDION-2402: a corrupt value reads as the default
        out["access.settings_layout"] = DEFAULTS["access.settings_layout"]
    # CR-039 DOORWIN-295: READ-ONLY, derived - whether the door-windows tab is in the navigation (a door feature is switched on). Not in
    # DEFAULTS and not patchable here: the switches themselves live behind /doors/windows/settings and /doors/emergency/settings.
    out["doors.ui.tab"] = "on" if (get_setting(conn, "doors.windows.enabled") == "on" or get_setting(conn, "doors.emergency.enabled") == "on") else "off"
    # MAPPING-ASSIST-2330 (owner 31.10): READ-ONLY here - the multi-building view of the home screen, OFF by default. Switched through
    # PUT /home/multi-building (site.content.configure on every site, audited), not through PATCH /settings.
    out["home.multi_building"] = "on" if get_setting(conn, "home.multi_building.enabled") == "on" else "off"
    out["ui.skin"] = stored_skin(out["ui.skin"])  # BUBBLE-FREEZE-295: a stored frozen skin reads as the fallback (the row is left as it is)
    if out.get("ui.motion") not in ("auto", "full", "reduced"):  # MOTIONSETTING-297: a corrupt value reads as the default
        out["ui.motion"] = DEFAULTS["ui.motion"]
    if out.get("ui.entry_animations") not in ("on", "off"):  # 2.29.0: a corrupt value reads as the default
        out["ui.entry_animations"] = "on"
    if out.get("ui.rail_tone") not in ("auto", "dark"):  # SKINCOMP-297: a corrupt value reads as the default
        out["ui.rail_tone"] = "auto"
    out["ui.tabs"] = _stored_tabs(out["ui.tabs"])
    if out.get("ui.tickets_section_row") not in ("hide_single", "always"):  # SERVICEIA1-295: a corrupt value reads as the default
        out["ui.tickets_section_row"] = "hide_single"
    out["ui.nav_size"] = _stored_nav_size(out["ui.nav_size"])
    out["ui.look"] = look.stored(out["ui.look"])
    from ..routers import ui_background  # call time: the store itself never imports a router

    out["ui.background_images"] = ui_background.stored_stamps(out["ui.background_images"])
    out["ui.palettes"] = palettes.stored(out["ui.palettes"])
    out["ui.tabs_mode"] = tabs_mode.stored_mode(out["ui.tabs_mode"])
    out["ui.tabs_mode_groups"] = tabs_mode.stored_groups(out["ui.tabs_mode_groups"])
    out["ui.dd_style"] = dd_style.stored_style(out["ui.dd_style"])
    out["ui.dd_style_groups"] = dd_style.stored_groups(out["ui.dd_style_groups"])
    out["ui.dd_phone"] = dd_style.stored_phone(out["ui.dd_phone"])
    out["ui.dd_search"] = dd_style.stored_search(out["ui.dd_search"])
    out["ui.dd_picker"] = dd_style.stored_picker(out["ui.dd_picker"])
    out["ui.dd_place"] = dd_style.stored_place(out["ui.dd_place"])
    out["ui.dd_size"] = dd_style.stored_size(out["ui.dd_size"])
    out["ui.dd_size_groups"] = dd_style.stored_size_groups(out["ui.dd_size_groups"])
    out["ui.dd_ring"] = dd_style.stored_ring(out["ui.dd_ring"])
    out["ui.dd_ring_groups"] = dd_style.stored_ring_groups(out["ui.dd_ring_groups"])
    out["ui.dd_panel"] = dd_style.stored_panel(out["ui.dd_panel"])
    out["ui.dd_panel_groups"] = dd_style.stored_panel_groups(out["ui.dd_panel_groups"])
    out["ui.mobile"] = _stored_mobile(out["ui.mobile"])
    out["ui.xs"] = _stored_xs(out["ui.xs"])
    out["timeline.colors"] = _stored_timeline_colors(out["timeline.colors"])
    for key in brand_colors.KEYS:  # a corrupt stored colour never reaches the page as CSS
        out[key] = brand_colors.stored(out[key], key)
    out["devices.area_row"] = _stored_area_row(out["devices.area_row"], area_row.normalize_area, area_row.AREA_ROW_DEFAULT)
    out["devices.floor_row"] = _stored_area_row(out["devices.floor_row"], area_row.normalize_floor, area_row.FLOOR_ROW_DEFAULT)
    out["schedules.classes"] = stored_schedule_classes(out["schedules.classes"], get_setting(conn, CLASSES_REV_KEY))
    out["plan.surfaces"] = stored_plan_surfaces(out["plan.surfaces"])
    out["plan.view"] = plan_view.stored_site(out["plan.view"])
    for key in ("site.latitude", "site.longitude"):  # CR-029 S2: a number, or None when not set (or unreadable)
        try:
            out[key] = float(out[key]) if out[key] not in ("", None) else None
        except (TypeError, ValueError):
            out[key] = None
        if not private:
            del out[key]
    out["plan.bakes"] = plan_bakes.stored_setting(out["plan.bakes"])
    out["home.widgets"] = home_screen.effective_config(conn)
    out["home.screen"] = home_screen_options.stored(out["home.screen"])
    out["multimedia.remote_default"] = _stored_remote_default(out["multimedia.remote_default"])
    out["multimedia.favourites"] = _stored_favourites(conn)
    for key in (*automation_settings.JSON_KEYS, *automation_settings.ENUM_KEYS):
        out[key] = automation_settings.stored(key, out[key])
    return out


def _stored_favourites(conn: sqlite3.Connection) -> dict[str, Any]:
    """`multimedia.favourites` as an object (the defaults when nothing was saved or the stored value is corrupt)."""
    from . import media_store

    return media_store.favourites_config(conn)


def _stored_remote_default(raw: Any) -> dict[str, Any]:
    """The stored `multimedia.remote_default` as an object; nothing stored, or a corrupt value, reads as the built-in default."""
    try:
        return media_layout.normalise_remote_config(json.loads(raw) if isinstance(raw, str) and raw else media_layout.default_remote())
    except ValueError:
        return media_layout.default_remote()


def _stored_nav_size(raw: Any) -> dict[str, Any]:
    """The stored ui.nav_size as an object; a corrupt or foreign value reads as the default size."""
    try:
        return nav_size.normalize(json.loads(raw) if isinstance(raw, str) else raw)
    except ValueError:
        return dict(nav_size.DEFAULT)


def _stored_mobile(raw: Any) -> dict[str, bool]:
    """The stored ui.mobile as an object with every key; a corrupt or foreign value reads as the defaults."""
    try:
        return mobile_options.normalize(json.loads(raw) if isinstance(raw, str) else raw)
    except ValueError:
        return dict(mobile_options.DEFAULT)


def _stored_xs(raw: Any) -> dict[str, Any]:
    """The stored ui.xs as an object with every key; a corrupt or foreign value reads as the defaults."""
    try:
        return xs_options.normalize(json.loads(raw) if isinstance(raw, str) else raw)
    except ValueError:
        return xs_options.normalize({})


def _stored_timeline_colors(raw: Any) -> dict[str, str]:
    """The stored timeline.colors as an object with every option; a corrupt or foreign value reads as the defaults."""
    try:
        return timeline_colors.normalize(json.loads(raw) if isinstance(raw, str) else raw)
    except ValueError:
        return dict(timeline_colors.DEFAULT)


def _stored_area_row(raw: Any, normalize: Any, default: dict[str, Any]) -> dict[str, Any]:
    """A stored devices.area_row / devices.floor_row as an object with every key; a corrupt value reads as the default."""
    try:
        return normalize(json.loads(raw) if isinstance(raw, str) else raw)
    except ValueError:
        return json.loads(json.dumps(default))


PLAN_SURFACES = ("devices", "area")  # K88: the places the live plan may appear besides the map tab


def stored_plan_surfaces(raw: Any) -> list[str]:
    """The stored `plan.surfaces` as an ordered list of known surfaces; a corrupt value reads as the default (both)."""
    try:
        value = json.loads(raw) if isinstance(raw, str) else raw
    except ValueError:
        return list(PLAN_SURFACES)
    if not isinstance(value, list):
        return list(PLAN_SURFACES)
    return [s for s in PLAN_SURFACES if s in value]


CLASSES_REV_KEY = "schedules.classes_rev"  # "2" once `schedules.classes` was saved knowing the 2026-10-04 classes


def stored_schedule_classes(raw: Any, rev: str | None = "2") -> list[str]:
    """The stored `schedules.classes` as an ordered list of known classes; a corrupt value reads as every class (the
    default) - a schedule can never be allowed a class this build does not know."""
    try:
        data = json.loads(raw) if isinstance(raw, str) else raw
    except ValueError:
        data = None
    if not isinstance(data, list):
        data = list(SCHEDULE_CLASSES)
    original = ("light", "switch", "cover", "climate", "fan", "alarm", "lock", "door")
    if rev is None and set(original) <= set(data) and not any(c in data for c in SCHEDULE_CLASSES if c not in original):
        data = list(SCHEDULE_CLASSES)  # saved before 2026-10-04 with every class on: "every class" still means every class (the new ones too)
    return [c for c in SCHEDULE_CLASSES if c in data]


# ui.tabs (owner 2026-09-30): the backend does not know the tab registry (frontend shell/nav.ts); it stores what it is
# given, refuses anything that is not a short slug and caps the size. Nested levels are just other section ids
# ("security", "security.live").
TABS_SLUG = re.compile(r"^[a-z0-9][a-z0-9_.-]{0,47}$")
TABS_MAX_SECTIONS = 64
# Tab bar styles (owner 2026-09-30, 0.1.148): the allow-list of `style` per section and of the per-level defaults kept under
# the reserved top-level key `styles`. Missing / old values mean the built-in defaults, resolved by the frontend
# (level 1: pill, level 2: underline-compact - shell/nav.ts tabStyleOf).
TAB_STYLES = ("pill", "underline", "underline-compact")
TABS_STYLES_KEY = "styles"
TABS_LEVELS = ("level1", "level2")
TABS_MAX_PER_LIST = 64
TABS_MAX_JSON = 16 * 1024  # the serialised value is copied into every audit row and read on every GET /settings


def _stored_tabs(raw: Any) -> dict[str, Any]:
    """The stored ui.tabs JSON as an object; a corrupt or foreign value reads as nothing configured."""
    try:
        return normalize_tabs(json.loads(raw) if isinstance(raw, str) else raw)
    except (ValueError, ApiError):
        return {}


def normalize_tabs(value: Any) -> dict[str, Any]:
    """Validate ui.tabs and return it normalised: duplicates removed (first occurrence wins), both lists always present,
    a section's `style` only when set, and the reserved `styles` (per-level defaults) only when it names a level.
    422 for a non-object, unknown keys, non-slug ids, non-list / non-string entries, a style outside the allow-list or a
    size over the caps."""
    def bad(msg: str) -> ApiError:
        return ApiError(422, "validation", f"סדר הלשוניות: {msg}", details={"ui.tabs": msg})

    if not isinstance(value, dict):
        raise bad("חייב להיות אובייקט של מקטעים.")
    if len(value) > TABS_MAX_SECTIONS:
        raise bad(f"עד {TABS_MAX_SECTIONS} מקטעים.")
    out: dict[str, Any] = {}
    for section, cfg in value.items():
        if not isinstance(section, str) or not TABS_SLUG.fullmatch(section):
            raise bad("מזהה מקטע לא תקין.")
        if section == TABS_STYLES_KEY:
            # the reserved key: the bar style defaults per hierarchy level ({"level1": "pill", "level2": "underline-compact"})
            if not isinstance(cfg, dict) or set(cfg) - set(TABS_LEVELS):
                raise bad("styles הוא אובייקט עם level1 ו-level2 בלבד.")
            styles = {}
            for level in TABS_LEVELS:
                if level in cfg:
                    if cfg[level] not in TAB_STYLES:
                        raise bad("סגנון סרגל לא מוכר (pill, underline או underline-compact).")
                    styles[level] = cfg[level]
            if styles:
                out[section] = styles
            continue
        if not isinstance(cfg, dict):
            raise bad("כל מקטע הוא אובייקט עם order ו-hidden.")
        if set(cfg) - {"order", "hidden", "style"}:
            raise bad("מפתחות לא מוכרים במקטע (מותר order, hidden ו-style בלבד).")
        norm: dict[str, Any] = {}
        for name in ("order", "hidden"):
            items = cfg.get(name, [])
            if not isinstance(items, list) or len(items) > TABS_MAX_PER_LIST:
                raise bad(f"{name} חייב להיות רשימה של עד {TABS_MAX_PER_LIST} מזהים.")
            seen: list[str] = []
            for tab in items:
                if not isinstance(tab, str) or not TABS_SLUG.fullmatch(tab):
                    raise bad("מזהה לשונית לא תקין.")
                if tab not in seen:
                    seen.append(tab)
            norm[name] = seen
        if "style" in cfg:
            # a per-section override of the bar style; null / absent = follow the level's default
            if cfg["style"] is not None and cfg["style"] not in TAB_STYLES:
                raise bad("סגנון סרגל לא מוכר (pill, underline או underline-compact).")
            if cfg["style"] is not None:
                norm["style"] = cfg["style"]
        out[section] = norm
    if len(json.dumps(out, ensure_ascii=False)) > TABS_MAX_JSON:
        raise bad("ההגדרה גדולה מדי.")
    return out


# The keys `read_settings` answers with something other than `int(stored or default)` / `stored or default`: a normaliser,
# a derived value or a JSON object. `setting_value` refuses them (tests/test_setting_value_parity.py keeps this list complete).
NORMALISED_KEYS: frozenset[str] = frozenset({
    "access.external.placement", "access.settings_layout", "ui.skin", "ui.motion", "ui.entry_animations", "ui.rail_tone", "ui.tabs",
    "ui.tickets_section_row", "ui.nav_size", "ui.look", "ui.background_images", "ui.palettes", "ui.tabs_mode", "ui.tabs_mode_groups",
    "ui.dd_style", "ui.dd_style_groups", "ui.dd_phone", "ui.dd_search", "ui.dd_picker", "ui.dd_place", "ui.dd_size", "ui.dd_size_groups",
    "ui.dd_ring", "ui.dd_ring_groups", "ui.dd_panel", "ui.dd_panel_groups", "ui.mobile", "ui.xs", "timeline.colors", *brand_colors.KEYS,
    "devices.area_row", "devices.floor_row", "schedules.classes", "plan.surfaces", "plan.view", *PRIVATE_KEYS, "plan.bakes",
    "home.widgets", "home.screen", "multimedia.remote_default", "multimedia.favourites",
    *automation_settings.JSON_KEYS, *automation_settings.ENUM_KEYS,
})


def setting_value(conn: sqlite3.Connection, key: str) -> Any:
    """One plain setting exactly as `read_settings(conn)[key]` answers it: the stored value, or the default when nothing (or
    an empty value) is stored; an `int` for INT_KEYS. KeyError for a key that is not in DEFAULTS or has a normaliser."""
    if key not in DEFAULTS or key in NORMALISED_KEYS:
        raise KeyError(key)
    default = DEFAULTS[key]
    value = get_setting(conn, key, default) or default
    return int(value) if key in INT_KEYS else value
