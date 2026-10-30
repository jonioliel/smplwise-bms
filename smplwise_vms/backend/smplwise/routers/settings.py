"""Product settings that are safe to expose (no secrets): media transport default, session caps,
snapshot freshness. Secrets stay in the add-on options."""
from __future__ import annotations

import json
import re
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field, field_validator

from ..audit import audit
from ..auth import current_principal, get_conn
from ..db import get_setting, set_setting
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, require
from . import ui_background
from ..services import app_download, area_row, automation_settings, brand_colors, home_config, home_screen, home_screen_options, intercom_authority, look, media_layout, mobile_options, nav_size, nvr_capacity, dd_style, palettes, plan_bakes, plan_view, tabs_mode, timeline_colors, xs_options

router = APIRouter()

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
ALLOW_DISARM_WORD = "אפשר נטרול"
LOCAL_PURGE_WORD = "מחיקה לצמיתות"  # REL2140 M-1: typed to switch the irreversible IDENT146 purge on

# CR-007 6a/6b: the registered device-screen palettes - keep in step with DEVICE_THEMES in
# frontend/src/styles/devices-themes.ts (docs/design/DEVICE_THEMES.md, "How to add a theme").
DEVICE_THEMES = ("default", "sand", "forest", "graphite")

INT_KEYS = ("privacy.local_purge_days", "security.local_admin_session_days", "security.local_password_min", "backup.password_min", "security.local_link_ttl_h", "media.max_live_sessions", "access.station_media_max_talk_s", "snapshots.max_age_s", "playback.max_sessions", "playback.lease_s", "playback.stall_s", "playback.auto_resume_attempts", "exports.max_mb", "exports.retention_days", "events.retention_days", "audit.retention_days", "cases.import_max_mb", "storage.min_free_mb", "ai.budget_daily", "skins.budget_renders_per_floor", "skins.budget_monthly", "remote.idle_lock_minutes", "remote.max_live_streams", "schedules.runs_retention_days", "device_activity.retention_days", "history.range_max_days", "history.presence_retention_days", "ui.page_size.schedules", "ui.page_size.schedules_phone", "ui.page_size.automations", "ui.page_size.automations_phone", "ui.page_size.automations_cards", "ui.page_size.automations_cards_phone", *automation_settings.INT_KEYS)


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
    for key, default in DEFAULTS.items():
        value = get_setting(conn, key, default) or default
        out[key] = int(value) if key in INT_KEYS else value
    if out.get("access.external.placement") not in ("access", "tickets", "both"):  # SHAREDID-293: a corrupt value never moves the screen
        out["access.external.placement"] = "access"
    # CR-039 DOORWIN-295: READ-ONLY, derived - whether the door-windows tab is in the navigation (a door feature is switched on). Not in
    # DEFAULTS and not patchable here: the switches themselves live behind /doors/windows/settings and /doors/emergency/settings.
    out["doors.ui.tab"] = "on" if (get_setting(conn, "doors.windows.enabled") == "on" or get_setting(conn, "doors.emergency.enabled") == "on") else "off"
    out["ui.skin"] = stored_skin(out["ui.skin"])  # BUBBLE-FREEZE-295: a stored frozen skin reads as the fallback (the row is left as it is)
    if out.get("ui.motion") not in ("auto", "full", "reduced"):  # MOTIONSETTING-297: a corrupt value reads as the default
        out["ui.motion"] = DEFAULTS["ui.motion"]
    if out.get("ui.rail_tone") not in ("auto", "dark"):  # SKINCOMP-297: a corrupt value reads as the default
        out["ui.rail_tone"] = "auto"
    out["ui.tabs"] = _stored_tabs(out["ui.tabs"])
    if out.get("ui.tickets_section_row") not in ("hide_single", "always"):  # SERVICEIA1-295: a corrupt value reads as the default
        out["ui.tickets_section_row"] = "hide_single"
    out["ui.nav_size"] = _stored_nav_size(out["ui.nav_size"])
    out["ui.look"] = look.stored(out["ui.look"])
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
    from ..services import media_store

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
        return dict(xs_options.DEFAULT)


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


LEAD_DAYS_PATTERN = r"^(0|[1-9][0-9]?|[12][0-9]{2}|3[0-5][0-9]|36[0-5])$"  # CR-MAINT215: 0-365 days


class SettingsPatch(BaseModel):
    media_transport_default: str | None = Field(default=None, pattern="^(auto|webrtc|mse)$", alias="media.transport_default")
    media_max_live_sessions: int | None = Field(default=None, ge=1, le=128, alias="media.max_live_sessions")
    media_wall_profile: str | None = Field(default=None, pattern="^(sub|main)$", alias="media.wall_profile")
    media_video_notices: str | None = Field(default=None, pattern="^(true|false)$", alias="media.video_notices")
    nvr_privacy_mask_write: str | None = Field(default=None, pattern="^(true|false)$", alias="nvr.privacy_mask_write")  # NVRMASK-295
    nvr_privacy_mask_copy: str | None = Field(default=None, pattern="^(true|false)$", alias="nvr.privacy_mask_copy")  # MASKCOPY62-295
    snapshots_max_age_s: int | None = Field(default=None, ge=5, le=3600, alias="snapshots.max_age_s")
    time_zone: str | None = Field(default=None, pattern=r"^[A-Za-z_]+(/[A-Za-z_\-+0-9]+)+$", alias="time.zone")
    playback_max_sessions: int | None = Field(default=None, ge=1, le=128, alias="playback.max_sessions")
    playback_lease_s: int | None = Field(default=None, ge=60, le=3600, alias="playback.lease_s")
    playback_cross_recorder_sync: str | None = Field(default=None, pattern="^(true|false)$", alias="playback.cross_recorder_sync")
    playback_stall_s: int | None = Field(default=None, ge=2, le=30, alias="playback.stall_s")
    playback_auto_resume_attempts: int | None = Field(default=None, ge=0, le=5, alias="playback.auto_resume_attempts")
    exports_max_mb: int | None = Field(default=None, ge=50, le=20480, alias="exports.max_mb")
    exports_retention_days: int | None = Field(default=None, ge=1, le=365, alias="exports.retention_days")
    events_retention_days: int | None = Field(default=None, ge=1, le=3650, alias="events.retention_days")
    audit_retention_days: int | None = Field(default=None, ge=30, le=3650, alias="audit.retention_days")
    cases_import_max_mb: int | None = Field(default=None, ge=16, le=4096, alias="cases.import_max_mb")
    storage_min_free_mb: int | None = Field(default=None, ge=0, le=102400, alias="storage.min_free_mb")
    # deprecated (0.1.148): accepted for compatibility, ignored by the app
    ui_design: str | None = Field(default=None, pattern="^(a|b)$", alias="ui.design")
    ui_design_names: str | None = Field(default=None, max_length=200, alias="ui.design_names")
    ui_wall_count: int | None = Field(default=None, ge=1, le=32, alias="ui.wall_count")
    ui_kiosk_cols: int | None = Field(default=None, ge=1, le=6, alias="ui.kiosk_cols")
    ui_kiosk_rows: int | None = Field(default=None, ge=1, le=5, alias="ui.kiosk_rows")
    ui_hide_search: str | None = Field(default=None, pattern="^(true|false)$", alias="ui.hide_search")
    ui_global_search: str | None = Field(default=None, pattern="^(off|admins|roles|all)$", alias="ui.global_search")
    ui_global_search_roles: str | None = Field(default=None, pattern=r"^[A-Za-z0-9_.\-]+(,[A-Za-z0-9_.\-]+)*$|^$", max_length=600, alias="ui.global_search_roles")
    ui_start_route: str | None = Field(default=None, pattern="^(explore|live|wall|events|playback|devices)$", alias="ui.start_route")
    ui_hide_map: str | None = Field(default=None, pattern="^(true|false)$", alias="ui.hide_map")
    ui_security_snapshot: str | None = Field(default=None, pattern="^(true|false)$", alias="ui.security_snapshot")
    ui_tile_layout: str | None = Field(default=None, pattern="^(auto|cards|compact)$", alias="ui.tile_layout")
    ui_page_size_schedules: int | None = Field(default=None, ge=3, le=50, alias="ui.page_size.schedules")
    ui_page_size_schedules_phone: int | None = Field(default=None, ge=3, le=50, alias="ui.page_size.schedules_phone")
    ui_page_size_automations: int | None = Field(default=None, ge=3, le=50, alias="ui.page_size.automations")
    ui_page_size_automations_phone: int | None = Field(default=None, ge=3, le=50, alias="ui.page_size.automations_phone")
    ui_page_size_automations_cards: int | None = Field(default=None, ge=1, le=50, alias="ui.page_size.automations_cards")
    ui_page_size_automations_cards_phone: int | None = Field(default=None, ge=1, le=50, alias="ui.page_size.automations_cards_phone")
    ui_schedules_view: str | None = Field(default=None, pattern="^(rows|cards|table|week)$", alias="ui.schedules_view")
    ui_automations_view: str | None = Field(default=None, pattern="^(rows|cards)$", alias="ui.automations_view")
    ui_skin: str | None = Field(default=None, pattern="^(classic|domus|tesla|bubble|crystal|infra|soft)$", alias="ui.skin")  # keep in step with SKIN_IDS in frontend/src/design/skins/index.ts (SKINFOUND-297: infra, soft)
    ui_scheme: str | None = Field(default=None, pattern="^(light|dark|auto)$", alias="ui.scheme")
    ui_motion: str | None = Field(default=None, pattern="^(auto|full|reduced)$", alias="ui.motion")  # MOTIONSETTING-297; keep in step with MOTION_MODES in frontend/src/design/apply.ts
    ui_rail_tone: str | None = Field(default=None, pattern="^(auto|dark)$", alias="ui.rail_tone")  # SKINCOMP-297: keep in step with RAIL_TONES in frontend/src/design/skins/index.ts

    @field_validator("ui_skin")
    @classmethod
    def _skin_not_frozen(cls, v: str | None) -> str | None:
        if v in FROZEN_SKINS:
            raise ValueError(f"the '{v}' skin is frozen and can no longer be selected; choose classic, domus, tesla, crystal, infra or soft")
        return v

    ui_accent: str | None = Field(default=None, max_length=16, alias="ui.accent")  # 2.4.4: validated by services/brand_colors.py
    ui_toggle_on: str | None = Field(default=None, max_length=16, alias="ui.toggle_on")
    ui_background: str | None = Field(default=None, pattern="^(builtin|none|custom)$", alias="ui.background")  # CRY: keep in step with BACKGROUND_MODES in frontend/src/design/background.ts
    ui_tabs: dict[str, Any] | None = Field(default=None, alias="ui.tabs")  # validated in full by normalize_tabs
    ui_tabs_mode: str | None = Field(default=None, pattern="^(tabs|hybrid|dropdown)$", alias="ui.tabs_mode")
    ui_tickets_section_row: str | None = Field(default=None, pattern="^(hide_single|always)$", alias="ui.tickets_section_row")  # SERVICEIA1-295
    ui_tabs_mode_groups: dict[str, Any] | None = Field(default=None, alias="ui.tabs_mode_groups")  # validated in full by services/tabs_mode.py
    ui_dd_style: str | None = Field(default=None, pattern="^(" + "|".join(dd_style.STYLES) + ")$", alias="ui.dd_style")
    ui_dd_phone: str | None = Field(default=None, pattern="^(" + "|".join(dd_style.PHONE_MODES) + ")$", alias="ui.dd_phone")
    ui_dd_search: str | None = Field(default=None, pattern="^(" + "|".join(dd_style.SEARCH_MODES) + ")$", alias="ui.dd_search")
    ui_dd_picker: str | None = Field(default=None, pattern="^(" + "|".join(dd_style.PICKERS) + ")$", alias="ui.dd_picker")
    ui_dd_place: str | None = Field(default=None, pattern="^(" + "|".join(dd_style.PLACES) + ")$", alias="ui.dd_place")
    ui_dd_style_groups: dict[str, Any] | None = Field(default=None, alias="ui.dd_style_groups")  # validated in full by services/dd_style.py
    ui_dd_size: str | None = Field(default=None, pattern="^(" + "|".join(dd_style.SIZES) + ")$", alias="ui.dd_size")
    ui_dd_size_groups: dict[str, Any] | None = Field(default=None, alias="ui.dd_size_groups")  # validated in full by services/dd_style.py
    ui_dd_ring: str | None = Field(default=None, pattern="^(" + "|".join(re.escape(r) for r in dd_style.RINGS) + ")$", alias="ui.dd_ring")
    ui_dd_ring_groups: dict[str, Any] | None = Field(default=None, alias="ui.dd_ring_groups")  # validated in full by services/dd_style.py
    ui_dd_panel: str | None = Field(default=None, pattern="^(" + "|".join(dd_style.PANELS) + ")$", alias="ui.dd_panel")
    ui_dd_panel_groups: dict[str, Any] | None = Field(default=None, alias="ui.dd_panel_groups")  # validated in full by services/dd_style.py
    ui_mobile: dict[str, Any] | None = Field(default=None, alias="ui.mobile")  # validated in full by services/mobile_options.py
    ui_xs: dict[str, Any] | None = Field(default=None, alias="ui.xs")  # validated in full by services/xs_options.py (2.29.0)
    ui_nav_size: dict[str, Any] | None = Field(default=None, alias="ui.nav_size")  # validated in full by services/nav_size.py
    ui_look: dict[str, Any] | None = Field(default=None, alias="ui.look")  # validated in full by services/look.py (every dial required)
    ui_palettes: list[dict[str, Any]] | None = Field(default=None, alias="ui.palettes")  # validated in full (shape; contrast is warn-only) by services/palettes.py
    timeline_palette: dict[str, Any] | None = Field(default=None, alias="timeline.colors")  # validated in full by services/timeline_colors.py
    playback_helper_line: str | None = Field(default=None, pattern="^(all|installers|hidden)$", alias="playback.helper_line")
    playback_diagnostics: str | None = Field(default=None, pattern="^(all|installers|hidden)$", alias="playback.diagnostics")
    history_ha_secondary: str | None = Field(default=None, pattern="^(true|false)$", alias="history.ha_secondary")
    history_timescrub: str | None = Field(default=None, pattern="^(true|false)$", alias="history.timescrub")  # CR-TIMESCRUB101
    history_range_max_days: int | None = Field(default=None, ge=1, le=30, alias="history.range_max_days")
    history_presence_retention_days: int | None = Field(default=None, ge=1, le=30, alias="history.presence_retention_days")
    plan_estimates: str | None = Field(default=None, pattern="^(true|false)$", alias="plan.estimates")
    plan_levels: str | None = Field(default=None, pattern="^(all|default)$", alias="plan.levels")
    map_shared_levels: str | None = Field(default=None, pattern="^(show|hide)$", alias="map.shared_levels")
    map_default_floor: str | None = Field(default=None, max_length=64, pattern=r"^[A-Za-z0-9_.\-]*$", alias="map.default_floor")  # "" or an existing floor id (checked in the handler)
    map_default_view: str | None = Field(default=None, pattern="^(2d|3d)$", alias="map.default_view")
    plan_quality: str | None = Field(default=None, pattern="^(auto|1|2)$", alias="plan.quality")
    plan_camsuggest_distance: str | None = Field(default=None, pattern="^([1-9]|[1-9][0-9]|100)$", alias="plan.camsuggest_distance")  # CAMSUGGEST138-295: 1-100 % of the plan width
    plan_camsuggest_fov: str | None = Field(default=None, pattern="^([0-9]|[1-9][0-9]|100)$", alias="plan.camsuggest_fov")  # 0-100 %
    plan_camsuggest_count: str | None = Field(default=None, pattern="^[1-3]$", alias="plan.camsuggest_count")  # 1-3 suggestions
    plan_presence_fade: str | None = Field(default=None, pattern="^(off|[1-9]|[1-9][0-9]|1[01][0-9]|120)$", alias="plan.presence_fade")  # off, or 1-120 minutes
    plan_surfaces: list[str] | None = Field(default=None, max_length=4, alias="plan.surfaces")  # each one of PLAN_SURFACES (checked in the handler)
    site_location_source: str | None = Field(default=None, pattern="^(home|manual)$", alias="site.location_source")  # CR-029 S2 (owner 2026-10-11)
    site_latitude: str | None = Field(default=None, max_length=12, pattern=r"^(|-?\d{1,3}(\.\d{1,6})?)$", alias="site.latitude")  # CR-029 S2: "" clears
    site_longitude: str | None = Field(default=None, max_length=12, pattern=r"^(|-?\d{1,3}(\.\d{1,6})?)$", alias="site.longitude")
    plan_view: dict[str, Any] | None = Field(default=None, alias="plan.view")  # CR-029 S0: a partial update of the dials, validated in full by services/plan_view.py
    plan_bakes: dict[str, Any] | None = Field(default=None, alias="plan.bakes")  # CR-029 S3: a partial update, validated in full by services/plan_bakes.py
    ai_provider: str | None = Field(default=None, pattern="^(none|local|external)$", alias="ai.provider")
    ai_privacy_ack: str | None = Field(default=None, pattern="^(true|false)$", alias="ai.privacy_ack")
    ai_budget_daily: int | None = Field(default=None, ge=0, le=100000, alias="ai.budget_daily")
    skins_provider: str | None = Field(default=None, pattern="^(openai)$", alias="skins.provider")
    skins_model: str | None = Field(default=None, pattern=r"^[a-z0-9][a-z0-9.\-]{1,63}$", alias="skins.model")
    skins_privacy_ack: str | None = Field(default=None, pattern="^(true|false)$", alias="skins.privacy_ack")
    skins_budget_renders_per_floor: int | None = Field(default=None, ge=0, le=6, alias="skins.budget_renders_per_floor")
    skins_budget_monthly: int | None = Field(default=None, ge=0, le=500, alias="skins.budget_monthly")
    access_ui_overview: str | None = Field(default=None, pattern="^(wiskey|smplwise)$", alias="access.ui.overview")
    access_ui_events: str | None = Field(default=None, pattern="^(wiskey|smplwise)$", alias="access.ui.events")
    access_ui_people: str | None = Field(default=None, pattern="^(wiskey|smplwise)$", alias="access.ui.people")
    access_ui_stations: str | None = Field(default=None, pattern="^(wiskey|smplwise)$", alias="access.ui.stations")  # CR-036 S6
    access_ui_schedules: str | None = Field(default=None, pattern="^(wiskey|smplwise)$", alias="access.ui.schedules")  # CR-036 S9
    ui_hide_wiskey: str | None = Field(default=None, pattern="^(true|false)$", alias="ui.hide_wiskey")
    ui_wiskey_size: str | None = Field(default=None, pattern="^(normal|fit|full)$", alias="ui.wiskey_size")
    ui_wiskey_scale: str | None = Field(default=None, pattern="^(100|90|80|70)$", alias="ui.wiskey_scale")
    ui_wiskey_density: str | None = Field(default=None, pattern="^(auto|4|6|8|9|12)$", alias="ui.wiskey_density")
    ui_wiskey_wall: str | None = Field(default=None, pattern="^(auto|4|9|12)$", alias="ui.wiskey_wall")
    access_phone_embed: str | None = Field(default=None, pattern="^(true|false)$", alias="access.phone_embed")
    access_employee_no_sensitive: str | None = Field(default=None, pattern="^(true|false)$", alias="access.employee_no_sensitive")  # CR-036 S3
    access_event_portrait_sensitive: str | None = Field(default=None, pattern="^(true|false)$", alias="access.event_portrait_sensitive")
    access_event_portrait_audit: str | None = Field(default=None, pattern="^(true|false)$", alias="access.event_portrait_audit")
    access_sync_errors_everyone: str | None = Field(default=None, pattern="^(true|false)$", alias="access.sync_errors_everyone")
    # SECFIX2-295: the uniform 404 for a restricted writer and a malformed person record he cannot see (default false = today's 403)
    access_unknown_person_uniform_404: str | None = Field(default=None, pattern="^(true|false)$", alias="access.unknown_person_uniform_404")
    access_call_hint: str | None = Field(default=None, pattern="^(everyone|call)$", alias="access.call_hint")  # CR-036 S6
    access_talk_button: str | None = Field(default=None, pattern="^(classic|hidden)$", alias="access.talk_button")
    access_announce_scope: str | None = Field(default=None, pattern="^(scope|station)$", alias="access.announce_scope")
    access_announce_phrases: str | None = Field(default=None, max_length=2000, alias="access.announce_phrases")  # one phrase per line
    access_station_media: str | None = Field(default=None, pattern="^(off|video|video_talk)$", alias="access.station_media")  # CR-036 S18
    access_station_media_provider: str | None = Field(default=None, pattern="^(local|auto)$", alias="access.station_media_provider")  # REL2140 M-3
    access_station_media_max_talk_s: int | None = Field(default=None, ge=1, le=86400, alias="access.station_media_max_talk_s")  # W10CLIENT-295 / WKDIRECT-295
    access_station_listen: str | None = Field(default=None, pattern="^(off|on|probe)$", alias="access.station_listen")  # WKAUDIN-295
    devices_style: str | None = Field(default=None, pattern="^(smplwise|glass)$", alias="devices.style")
    devices_theme: str | None = Field(default=None, pattern="^(" + "|".join(DEVICE_THEMES) + ")$", alias="devices.theme")
    devices_default_view: str | None = Field(default=None, pattern="^(cards|tiles)$", alias="devices.default_view")
    devices_show_sensors: str | None = Field(default=None, pattern="^(true|false)$", alias="devices.show_sensors")
    devices_show_climate_strip: str | None = Field(default=None, pattern="^(true|false)$", alias="devices.show_climate_strip")
    devices_density: str | None = Field(default=None, pattern="^(comfortable|compact)$", alias="devices.density")
    devices_scheme: str | None = Field(default=None, pattern="^(light|dark|auto)$", alias="devices.scheme")
    devices_glass_scheme: str | None = Field(default=None, pattern="^(follow|light|dark)$", alias="devices.glass_scheme")  # 2.4.4
    devices_area_design: str | None = Field(default=None, pattern="^(tiles|sections)$", alias="devices.area_design")
    devices_area_row: dict[str, Any] | None = Field(default=None, alias="devices.area_row")  # validated in full by services/area_row.py
    devices_floor_row: dict[str, Any] | None = Field(default=None, alias="devices.floor_row")  # validated in full by services/area_row.py
    home_title: str | None = Field(default=None, max_length=60, alias="home.title")
    home_floor_order: str | None = Field(default=None, max_length=6000, alias="home.floor_order")
    home_clock: str | None = Field(default=None, pattern="^(off|time|datetime)$", alias="home.clock")
    home_weather: str | None = Field(default=None, pattern="^(true|false)$", alias="home.weather")
    home_weather_entity: str | None = Field(default=None, pattern=r"^(|weather\.[a-z0-9_]{1,100})$", alias="home.weather_entity")
    home_jewish: str | None = Field(default=None, pattern="^(true|false)$", alias="home.jewish")
    home_jewish_parsha: str | None = Field(default=None, pattern=r"^(|sensor\.[a-z0-9_]{1,100})$", alias="home.jewish_parsha")
    home_jewish_candles: str | None = Field(default=None, pattern=r"^(|sensor\.[a-z0-9_]{1,100})$", alias="home.jewish_candles")
    home_jewish_havdalah: str | None = Field(default=None, pattern=r"^(|sensor\.[a-z0-9_]{1,100})$", alias="home.jewish_havdalah")
    home_clock_size: str | None = Field(default=None, pattern="^(chip|medium|large)$", alias="home.clock_size")
    home_clock_seconds: str | None = Field(default=None, pattern="^(true|false)$", alias="home.clock_seconds")
    home_weather_size: str | None = Field(default=None, pattern="^(chip|medium|large)$", alias="home.weather_size")
    home_jewish_size: str | None = Field(default=None, pattern="^(chip|medium|large)$", alias="home.jewish_size")
    home_jewish_date: str | None = Field(default=None, pattern=r"^(|sensor\.[a-z0-9_]{1,100})$", alias="home.jewish_date")
    home_direction: str | None = Field(default=None, pattern="^(a|b|c)$", alias="home.direction")
    home_side: str | None = Field(default=None, pattern="^(start|end)$", alias="home.side")
    home_info_style: str | None = Field(default=None, pattern="^(auto|bar|cards)$", alias="home.info_style")  # HOME-295: auto = by the view
    home_floor_title_lines: str | None = Field(default=None, pattern="^(1|2|3)$", alias="home.floor_title_lines")  # POLISH-CONTROL-297
    ui_long_lists: str | None = Field(default=None, pattern="^(paged|scroll)$", alias="ui.long_lists")  # POLISH-CONTROL-297
    home_bulk_idle: str | None = Field(default=None, pattern="^(disabled|enabled)$", alias="home.bulk_idle")  # POLISH-CONTROL-297
    home_screen: dict[str, Any] | None = Field(default=None, alias="home.screen")  # HOME-295: a partial update, validated in full by services/home_screen_options.py
    home_widgets: dict[str, Any] | None = Field(default=None, alias="home.widgets")  # validated in full by services/home_config.py
    remote_policy: str | None = Field(default=None, pattern="^(flag|any_role)$", alias="remote.policy")
    remote_admins_default: str | None = Field(default=None, pattern="^(true|false)$", alias="remote.admins_default")
    remote_session: str | None = Field(default=None, pattern="^(rolling_90d|browser_session|rolling_90d_idle_lock)$", alias="remote.session")
    remote_idle_lock_minutes: int | None = Field(default=None, ge=5, le=10080, alias="remote.idle_lock_minutes")
    remote_default_profile: str | None = Field(default=None, pattern="^(main|sub)$", alias="remote.default_profile")
    remote_wall_profile: str | None = Field(default=None, pattern="^(main|sub)$", alias="remote.wall_profile")
    remote_mse_fallback: str | None = Field(default=None, pattern="^(true|false)$", alias="remote.mse_fallback")
    security_second_factor_policy: str | None = Field(default=None, pattern="^(optional|admins)$", alias="security.second_factor_policy")
    security_second_factor_bearer: str | None = Field(default=None, pattern="^(enforce|off)$", alias="security.second_factor_bearer")
    remote_require_mfa_admin: str | None = Field(default=None, pattern="^(true|false)$", alias="remote.require_mfa_admin")
    security_local_identity: str | None = Field(default=None, pattern="^(on|off)$", alias="security.local_identity")  # USR2: system_admin only (checked below)
    security_local_identity_extended: str | None = Field(default=None, pattern="^(on|off)$", alias="security.local_identity_extended")  # SVCIDENT2: system_admin; on = local channel only, off = any channel (AMEND273)
    security_local_session: str | None = Field(default=None, pattern="^(rolling_30d|rolling_90d|browser_session)$", alias="security.local_session")
    security_local_admin_session_days: int | None = Field(default=None, ge=1, le=7, alias="security.local_admin_session_days")
    security_local_password_min: int | None = Field(default=None, ge=10, le=64, alias="security.local_password_min")
    privacy_local_purge: str | None = Field(default=None, pattern="^(on|off)$", alias="privacy.local_purge")  # IDENT146
    privacy_local_purge_days: int | None = Field(default=None, ge=30, le=3650, alias="privacy.local_purge_days")  # IDENT146: never below the owner's 30 days
    privacy_local_purge_confirm: str | None = Field(default=None, max_length=32, alias="privacy.local_purge_confirm")  # REL2140 M-1: the typed confirmation; never stored
    privacy_personal_export: str | None = Field(default=None, pattern="^(on|off)$", alias="privacy.personal_export")  # IDENT146
    backup_password_min: int | None = Field(default=None, ge=8, le=64, alias="backup.password_min")  # BACKUP-HASH-ENC: hard floor 8
    security_local_link_ttl_h: int | None = Field(default=None, ge=1, le=168, alias="security.local_link_ttl_h")
    security_local_lock_mode: str | None = Field(default=None, pattern="^(delay|lock)$", alias="security.local_lock_mode")
    security_local_public_url: str | None = Field(default=None, max_length=300, alias="security.local_public_url")  # USR2 phase 2: system_admin only (checked below)
    security_local_passkey_first: str | None = Field(default=None, pattern="^(on|off)$", alias="security.local_passkey_first")  # USR2 phase 4: system_admin only
    security_local_passkey_android: str | None = Field(default=None, max_length=1200, alias="security.local_passkey_android")  # USR2 phase 4: system_admin only
    remote_max_live_streams: int | None = Field(default=None, ge=1, le=128, alias="remote.max_live_streams")
    remote_csp_enforce: str | None = Field(default=None, pattern="^(true|false)$", alias="remote.csp_enforce")
    app_android_url: str | None = Field(default=None, max_length=app_download.MAX_URL, alias="app.android_url")  # https only, checked in app_download.normalize
    app_android_version: str | None = Field(default=None, max_length=32, alias="app.android_version")
    app_android_sha256: str | None = Field(default=None, max_length=64, alias="app.android_sha256")
    alarm_remote_control: str | None = Field(default=None, pattern="^(true|false)$", alias="alarm.remote_control")
    alarm_remote_disarm: str | None = Field(default=None, pattern="^(true|false)$", alias="alarm.remote_disarm")
    alarm_code_mode: str | None = Field(default=None, pattern="^(personal_pin|panel_code)$", alias="alarm.code_mode")
    alarm_remote_codeless: str | None = Field(default=None, pattern="^(true|false)$", alias="alarm.remote_codeless")
    alarm_pin_min_length: str | None = Field(default=None, pattern="^[4-8]$", alias="alarm.pin_min_length")
    schedules_enabled: str | None = Field(default=None, pattern="^(true|false)$", alias="schedules.enabled")
    schedules_classes: list[str] | None = Field(default=None, max_length=17, alias="schedules.classes")  # each one of SCHEDULE_CLASSES (checked in the handler)
    schedules_snap_minutes: str | None = Field(default=None, pattern="^(5|15|30)$", alias="schedules.snap_minutes")
    schedules_default_repeat: str | None = Field(default=None, pattern="^(repeat|pause|single)$", alias="schedules.default_repeat")
    schedules_runs_retention_days: int | None = Field(default=None, ge=7, le=365, alias="schedules.runs_retention_days")
    device_activity_retention_days: int | None = Field(default=None, ge=7, le=365, alias="device_activity.retention_days")
    schedules_shabbat_sensor: str | None = Field(default=None, pattern=r"^(|binary_sensor\.[a-z0-9_]{1,100})$", alias="schedules.shabbat_sensor")
    schedules_shabbat_sensor_force: bool | None = Field(default=None, alias="schedules.shabbat_sensor_force")  # an explicit override; never stored
    schedules_allow_disarm: str | None = Field(default=None, pattern="^(true|false)$", alias="schedules.allow_disarm")
    schedules_allow_disarm_confirm: str | None = Field(default=None, max_length=32, alias="schedules.allow_disarm_confirm")  # the typed confirmation; never stored
    multimedia_enabled: str | None = Field(default=None, pattern="^(true|false)$", alias="multimedia.enabled")
    multimedia_remote_default: dict[str, Any] | None = Field(default=None, alias="multimedia.remote_default")  # validated in full by services/media_layout.py
    automations_enabled: str | None = Field(default=None, pattern="^(true|false)$", alias="automations.enabled")
    automations_code_view_roles: list[str] | None = Field(default=None, max_length=200, alias="automations.code_view_roles")
    automations_trash_days: int | None = Field(default=None, ge=7, le=90, alias="automations.trash_days")
    automations_versions_keep: int | None = Field(default=None, ge=5, le=50, alias="automations.versions_keep")
    automations_limits: dict[str, Any] | None = Field(default=None, alias="automations.limits")
    automations_storm_auto_disable: str | None = Field(default=None, pattern="^(true|false)$", alias="automations.storm_auto_disable")
    automations_sensitive_warning: str | None = Field(default=None, pattern="^(true|false)$", alias="automations.sensitive_warning")
    automations_templates_enabled: str | None = Field(default=None, pattern="^(true|false)$", alias="automations.templates_enabled")
    automations_templates_hidden: list[str] | None = Field(default=None, max_length=200, alias="automations.templates_hidden")
    automations_templates_order: list[str] | None = Field(default=None, max_length=200, alias="automations.templates_order")
    automations_notify_targets: list[str] | None = Field(default=None, max_length=200, alias="automations.notify_targets")
    automations_ask_when_on_new: str | None = Field(default=None, pattern="^(true|false)$", alias="automations.ask_when_on_new")
    automations_blueprints_enabled: str | None = Field(default=None, pattern="^(true|false)$", alias="automations.blueprints_enabled")
    automations_phone_filter: str | None = Field(default=None, pattern="^(fold|rows)$", alias="automations.phone_filter")
    automations_sensitive_chip: str | None = Field(default=None, pattern="^(amber|red)$", alias="automations.sensitive_chip")
    # KAV079-295: the editors' extension (services/automation_ext.py; every switch OFF by default)
    automations_wall_buttons_editable: str | None = Field(default=None, pattern="^(true|false)$", alias="automations.wall_buttons_editable")
    automations_wall_double_ms: int | None = Field(default=None, ge=150, le=1500, alias="automations.wall_double_ms")
    automations_wall_long_ms: int | None = Field(default=None, ge=300, le=5000, alias="automations.wall_long_ms")
    automations_wall_debounce_ms: int | None = Field(default=None, ge=0, le=500, alias="automations.wall_debounce_ms")
    automations_wall_listen_s: int | None = Field(default=None, ge=5, le=120, alias="automations.wall_listen_s")
    automations_precheck_enabled: str | None = Field(default=None, pattern="^(true|false)$", alias="automations.precheck_enabled")
    automations_conflict_window_min: int | None = Field(default=None, ge=1, le=120, alias="automations.conflict_window_min")
    automations_save_with_warnings: str | None = Field(default=None, pattern="^(true|false)$", alias="automations.save_with_warnings")
    automations_button_reuse: str | None = Field(default=None, pattern="^(warn|error)$", alias="automations.button_reuse")
    automations_device_test_enabled: str | None = Field(default=None, pattern="^(true|false)$", alias="automations.device_test_enabled")
    automations_device_test_end: str | None = Field(default=None, pattern="^(ask|restore|keep)$", alias="automations.device_test_end")
    automations_presence_entity: str | None = Field(default=None, pattern=r"^(|(binary_sensor|input_boolean)\.[a-z0-9_]{1,100})$", alias="automations.presence_entity")
    update_apply_enabled: str | None = Field(default=None, pattern="^(true|false)$", alias="update.apply_enabled")  # 2.4.4: CR-021 self-update switch
    tickets_enabled: str | None = Field(default=None, pattern="^(true|false)$", alias="tickets.enabled")  # CR-038: the tickets module switch
    emergency_readiness_enabled: str | None = Field(default=None, pattern="^(true|false)$", alias="emergency_readiness.enabled")  # CR-EMERG104: the readiness view switch
    maintenance_enabled: str | None = Field(default=None, pattern="^(true|false)$", alias="maintenance.enabled")  # CR-MAINT215: the maintenance module switch
    # CR-MAINT215 slice 2: the default lead per kind (0-365 days) and the sticker address (empty = the remote address)
    maintenance_lead_certificate: str | None = Field(default=None, pattern=LEAD_DAYS_PATTERN, alias="maintenance.lead_days.certificate")
    maintenance_lead_preventive: str | None = Field(default=None, pattern=LEAD_DAYS_PATTERN, alias="maintenance.lead_days.preventive")
    maintenance_lead_round: str | None = Field(default=None, pattern=LEAD_DAYS_PATTERN, alias="maintenance.lead_days.round")
    maintenance_lead_vendor_document: str | None = Field(default=None, pattern=LEAD_DAYS_PATTERN, alias="maintenance.lead_days.vendor_document")
    maintenance_tag_base_url: str | None = Field(default=None, max_length=300, pattern=r"^(https://[A-Za-z0-9.-]+(:[0-9]{1,5})?(/[A-Za-z0-9._~/%-]*)?)?$", alias="maintenance.tag_base_url")
    maintenance_reminders_enabled: str | None = Field(default=None, pattern="^(true|false)$", alias="maintenance.reminders_enabled")  # MAINT215B
    maintenance_round_phone_view: str | None = Field(default=None, pattern="^(step|list)$", alias="maintenance.round_phone_view")
    maintenance_close_request_mode: str | None = Field(default=None, pattern="^(ask|auto|off)$", alias="maintenance.close_request_mode")
    maintenance_reminder_check_minutes: str | None = Field(default=None, pattern=r"^([1-9][0-9]{0,2}|1[0-3][0-9]{2}|14[0-3][0-9]|1440)$", alias="maintenance.reminder_check_minutes")
    maintenance_reminder_log_keep_days: str | None = Field(default=None, pattern=r"^([7-9]|[1-9][0-9]{1,2}|[1-2][0-9]{3}|3[0-5][0-9]{2}|36[0-4][0-9]|3650)$", alias="maintenance.reminder_log_keep_days")
    maintenance_vendor_missing_insurance_mark: str | None = Field(default=None, pattern="^(true|false)$", alias="maintenance.vendor_missing_insurance_mark")
    maintenance_vendor_insurance_warn_days: str | None = Field(default=None, pattern=LEAD_DAYS_PATTERN, alias="maintenance.vendor_insurance_warn_days")
    maintenance_file_max_per_task: str | None = Field(default=None, pattern=r"^([1-9]|[1-4][0-9]|50)$", alias="maintenance.file_max_per_task")
    docread_enabled: str | None = Field(default=None, pattern="^(true|false)$", alias="docread.enabled")  # SUPPLIERDOCS-297 (OFF by default)

    model_config = {"populate_by_name": True}


def _capacity_info(conn: sqlite3.Connection) -> dict[str, Any]:
    """`nvr_channels` (None = unknown) and `warnings` ([{key, message}]): advisory only, a warning never blocks a save."""
    channels = nvr_capacity.recorder_channels(conn)
    warnings = []
    for key, fn in (
        ("playback.max_sessions", nvr_capacity.playback_sessions_warning),
        ("media.max_live_sessions", nvr_capacity.live_sessions_warning),
        ("remote.max_live_streams", nvr_capacity.remote_live_streams_warning),
    ):
        text = fn(int(get_setting(conn, key, DEFAULTS[key]) or DEFAULTS[key]), channels)
        if text:
            warnings.append({"key": key, "message": text})
    return {"nvr_channels": channels, "warnings": warnings}


@router.get("/settings")
def get_settings(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    can_edit = authorize(conn, principal, "system.configure", INSTALLATION).allowed
    from .search import search_allowed

    return {"settings": read_settings(conn, private=can_edit), "can_edit": can_edit, "search_allowed": search_allowed(conn, principal), **_capacity_info(conn)}


LOCAL_ONLY_IDENTITY_KEYS = ("security.local_public_url", "security.local_passkey_first", "security.local_passkey_android")
LOCAL_ONLY_HE = "שינוי ההגדרה הזו אפשרי רק בגישה מקומית: פתחו את המערכת מתוך Home Assistant או ברשת המקומית."


def _local_only_identity_key(conn: sqlite3.Connection, request: Request, principal: Principal, key: str) -> None:
    """USR2 review RELEASE_264 F4 (and the P2B/P3 review's F9): the settings that shape WHO can sign in to an Arx-only identity - the
    public address (= the passkey RP id and where reset links point), passwordless sign-in, the Android app allowed to use this
    site's passkeys - change only from the local channel (Ingress / the LAN), like the tickets public address (routers/tickets_admin).
    The path itself cannot sit in remote_channel.BLOCKED_ON_REMOTE (every other setting stays remote-editable), so the refusal is per
    key and only for an actual change: a remote PATCH that repeats the current value is untouched. Audited; the whole PATCH fails
    (no partial write)."""
    from ..remote_channel import is_remote

    if not is_remote(request):
        return
    audit(conn, actor=principal, action="identity.local.setting_local_only", decision="denied", resource_type="installation", resource_id="local_identity",
          reason="remote_channel", request_id=getattr(request.state, "correlation_id", None), details={"key": key})
    raise ApiError(403, "local_only", LOCAL_ONLY_HE, details={"field": key})


@router.patch("/settings")
def patch_settings(body: SettingsPatch, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "system.configure", INSTALLATION)
    changes = {k: v for k, v in body.model_dump(by_alias=True).items() if v is not None}
    if "ui.design_names" in changes:
        try:
            names = json.loads(changes["ui.design_names"])
            assert isinstance(names, dict) and set(names) <= {"a", "b"} and all(isinstance(v, str) and 1 <= len(v.strip()) <= 24 for v in names.values())
        except (ValueError, AssertionError):
            raise ApiError(422, "validation", "שמות העיצובים: אובייקט עם a ו־b, עד 24 תווים לכל שם.")
        changes["ui.design_names"] = json.dumps({"a": names.get("a", "SW A").strip(), "b": names.get("b", "SW B").strip()}, ensure_ascii=False)
    if "ui.tabs" in changes:
        changes["ui.tabs"] = normalize_tabs(changes["ui.tabs"])
    if "ui.nav_size" in changes:
        try:
            changes["ui.nav_size"] = nav_size.normalize(changes["ui.nav_size"])
        except ValueError as exc:
            raise ApiError(422, "validation", "גודל הניווט: ערך לא תקין.", details={"ui.nav_size": str(exc)})
    if "ui.look" in changes:
        try:
            changes["ui.look"] = look.normalize(changes["ui.look"])
        except ValueError as exc:
            raise ApiError(422, "validation", "מראה: ערך לא תקין.", details={"ui.look": str(exc)})
    if "ui.palettes" in changes:
        try:
            changes["ui.palettes"] = palettes.normalize_customs(changes["ui.palettes"])
        except ValueError as exc:
            raise ApiError(422, "validation", str(exc), details={"ui.palettes": str(exc)})
    if "ui.tabs_mode_groups" in changes:
        try:
            changes["ui.tabs_mode_groups"] = tabs_mode.normalize_groups(changes["ui.tabs_mode_groups"])
        except ValueError as exc:
            raise ApiError(422, "validation", "תצוגת לשוניות לפי קבוצה: ערך לא תקין.", details={"ui.tabs_mode_groups": str(exc)})
    if "ui.dd_style_groups" in changes:
        try:
            changes["ui.dd_style_groups"] = dd_style.normalize_groups(changes["ui.dd_style_groups"])
        except ValueError as exc:
            raise ApiError(422, "validation", "סגנון תפריט נפתח לפי קבוצה: ערך לא תקין.", details={"ui.dd_style_groups": str(exc)})
    if "ui.dd_size_groups" in changes:
        try:
            changes["ui.dd_size_groups"] = dd_style.normalize_size_groups(changes["ui.dd_size_groups"])
        except ValueError as exc:
            raise ApiError(422, "validation", "גודל תפריט נפתח לפי קבוצה: ערך לא תקין.", details={"ui.dd_size_groups": str(exc)})
    if "ui.dd_ring_groups" in changes:
        try:
            changes["ui.dd_ring_groups"] = dd_style.normalize_ring_groups(changes["ui.dd_ring_groups"])
        except ValueError as exc:
            raise ApiError(422, "validation", "עובי טבעת לפי קבוצה: ערך לא תקין.", details={"ui.dd_ring_groups": str(exc)})
    if "ui.dd_panel_groups" in changes:
        try:
            changes["ui.dd_panel_groups"] = dd_style.normalize_panel_groups(changes["ui.dd_panel_groups"])
        except ValueError as exc:
            raise ApiError(422, "validation", "רוחב לוח פתוח לפי קבוצה: ערך לא תקין.", details={"ui.dd_panel_groups": str(exc)})
    if "ui.mobile" in changes:
        try:
            changes["ui.mobile"] = mobile_options.normalize(changes["ui.mobile"])
        except ValueError as exc:
            raise ApiError(422, "validation", "אפשרויות נייד: ערך לא תקין.", details={"ui.mobile": str(exc)})
    if "ui.xs" in changes:
        try:
            changes["ui.xs"] = xs_options.normalize(changes["ui.xs"])
        except ValueError as exc:
            raise ApiError(422, "validation", "אפשרויות חתך הבניין: ערך לא תקין.", details={"ui.xs": str(exc)})
    if "timeline.colors" in changes:
        try:
            changes["timeline.colors"] = timeline_colors.normalize(changes["timeline.colors"])
        except ValueError as exc:
            raise ApiError(422, "validation", "צבעי ציר הזמן: ערך לא תקין.", details={"timeline.colors": str(exc)})
    for key in brand_colors.KEYS:
        if key in changes:
            try:
                changes[key] = brand_colors.normalize(changes[key], key)
            except ValueError as exc:
                raise ApiError(422, "validation", "צבע: ברירת מחדל, צבע מוכן, קוד ‎#rrggbb, ולמתג גם \"כמו הצבע הראשי\".", details={key: str(exc)})
    if "devices.area_row" in changes:
        try:
            changes["devices.area_row"] = area_row.normalize_area(changes["devices.area_row"])
        except ValueError as exc:
            raise ApiError(422, "validation", "מה מוצג ליד שם האזור: ערך לא תקין.", details={"devices.area_row": str(exc)})
    if "devices.floor_row" in changes:
        try:
            changes["devices.floor_row"] = area_row.normalize_floor(changes["devices.floor_row"])
        except ValueError as exc:
            raise ApiError(422, "validation", "מה מוצג בכותרת הקומה: ערך לא תקין.", details={"devices.floor_row": str(exc)})
    if "home.screen" in changes:
        try:  # HOME-295: a partial update over the stored options (the defaults when nothing was saved)
            changes["home.screen"] = home_screen_options.normalize(changes["home.screen"], home_screen_options.stored(get_setting(conn, "home.screen", "")))
        except ValueError as exc:
            raise ApiError(422, "validation", "אפשרויות המסך הראשי: ערך לא תקין.", details={"home.screen": str(exc)})
    if "plan.surfaces" in changes:
        bad = [c for c in changes["plan.surfaces"] if c not in PLAN_SURFACES]
        if bad:
            raise ApiError(422, "validation", "מיקומי התוכנית החיה: ערך לא מוכר.", details={"plan.surfaces": bad})
        changes["plan.surfaces"] = [c for c in PLAN_SURFACES if c in changes["plan.surfaces"]]
    if "plan.view" in changes:
        try:  # a partial update over the stored dials (the defaults when nothing was saved)
            changes["plan.view"] = plan_view.normalize_site(changes["plan.view"], plan_view.stored_site(get_setting(conn, "plan.view", DEFAULTS["plan.view"])))
        except ValueError as exc:
            raise ApiError(422, "validation", "הגדרות התלת־ממד הריאליסטי: ערך לא תקין.", details={"plan.view": str(exc)})
    for key, limit in (("site.latitude", 90.0), ("site.longitude", 180.0)):  # CR-029 S2: degrees inside their range
        if key in changes and changes[key] != "" and abs(float(changes[key])) > limit:
            raise ApiError(422, "validation", "מיקום האתר: קו רוחב בין -90 ל-90, קו אורך בין -180 ל-180.", details={key: changes[key]})
    if "plan.bakes" in changes:
        try:  # a partial update over the stored value (the defaults when nothing was saved)
            changes["plan.bakes"] = plan_bakes.normalize_setting(changes["plan.bakes"], plan_bakes.stored_setting(get_setting(conn, "plan.bakes", DEFAULTS["plan.bakes"])))
        except ValueError as exc:
            raise ApiError(422, "validation", "הגדרות התמונות המוכנות: ערך לא תקין.", details={"plan.bakes": str(exc)})
    if "schedules.classes" in changes:
        bad = [c for c in changes["schedules.classes"] if c not in SCHEDULE_CLASSES]
        if bad:
            raise ApiError(422, "validation", "סוגי התקנים בתזמונים: ערך לא מוכר.", details={"schedules.classes": bad})
        changes["schedules.classes"] = [c for c in SCHEDULE_CLASSES if c in changes["schedules.classes"]]
    for key in automation_settings.JSON_KEYS:  # CR-017: validated in full before anything is stored
        if key in changes:
            try:
                changes[key] = automation_settings.normalize(key, changes[key])
            except ValueError as exc:
                raise ApiError(422, "validation", "הגדרות האוטומציות: ערך לא תקין.", details={key: str(exc)})
    if "multimedia.remote_default" in changes:
        try:
            changes["multimedia.remote_default"] = media_layout.normalise_remote_config(changes["multimedia.remote_default"])
        except ValueError as exc:
            raise ApiError(422, "validation", "הגדרת השלט: ערך לא תקין.", details={"multimedia.remote_default": str(exc)})
    app_download.normalize(changes)
    disarm_confirm = changes.pop("schedules.allow_disarm_confirm", None)
    disarm_change = None
    if "schedules.allow_disarm" in changes:
        current = get_setting(conn, "schedules.allow_disarm", DEFAULTS["schedules.allow_disarm"]) or DEFAULTS["schedules.allow_disarm"]
        if changes["schedules.allow_disarm"] == current:
            changes.pop("schedules.allow_disarm")
        else:
            from ..rbac import is_system_admin

            if not is_system_admin(conn, principal.user_id):
                audit(conn, actor=principal, action="schedules.allow_disarm", decision="denied", resource_type="installation", resource_id="*", reason="not_system_admin",
                      request_id=getattr(request.state, "correlation_id", None), details={"to": changes["schedules.allow_disarm"]})
                raise ApiError(403, "forbidden", "רק מנהל מערכת יכול לשנות את נטרול האזעקה בתזמונים.")
            if changes["schedules.allow_disarm"] == "true" and (disarm_confirm or "").strip() != ALLOW_DISARM_WORD:
                raise ApiError(422, "confirm_required", f"כדי לאפשר נטרול אזעקה בתזמונים יש להקליד \"{ALLOW_DISARM_WORD}\".", details={"field": "schedules.allow_disarm_confirm"})
            disarm_change = changes["schedules.allow_disarm"]
    update_switch = None  # 2.4.4: the CR-021 self-update switch gets its own audit row when it actually changes
    if "update.apply_enabled" in changes:
        current_switch = get_setting(conn, "update.apply_enabled", DEFAULTS["update.apply_enabled"]) or DEFAULTS["update.apply_enabled"]
        if changes["update.apply_enabled"] != ("false" if current_switch == "false" else "true"):
            update_switch = changes["update.apply_enabled"]
    local_switch = None  # USR2: the Arx-only identity switch - a system administrator only, its own audit row, off ends every local session
    if "security.local_identity" in changes:
        current_local = "on" if (get_setting(conn, "security.local_identity", "off") or "off") == "on" else "off"
        if changes["security.local_identity"] == current_local:
            changes.pop("security.local_identity")
        else:
            from ..rbac import is_system_admin

            if not is_system_admin(conn, principal.user_id):
                audit(conn, actor=principal, action="identity.local.feature", decision="denied", resource_type="installation", resource_id="local_identity",
                      reason="not_system_admin", request_id=getattr(request.state, "correlation_id", None), details={"to": changes["security.local_identity"]})
                raise ApiError(403, "forbidden", "רק מנהל מערכת יכול להפעיל או לכבות את משתמשי Arx.")
            local_switch = changes["security.local_identity"]
    if "security.local_identity_extended" in changes:
        # SVCIDENT2: the extended mode of the service identity widens what every Arx-only user may do in Home Assistant - like the switch
        # itself, a system administrator only; turning it ON, like the sign-in shaping keys, from the local channel only; audited
        # `identity.service_identity.*`. SVCIDENT-AMEND273 (owner decision 5, 2026-10-18; go-live pack R7): turning it OFF is a kill
        # switch and works from the remote channel too (a system administrator, no second factor by the same decision) - never ON.
        from ..remote_channel import is_remote
        from ..services import service_identity as service_identity_svc

        current_ext = "on" if (get_setting(conn, "security.local_identity_extended", "off") or "off") == "on" else "off"
        if changes["security.local_identity_extended"] == current_ext:
            changes.pop("security.local_identity_extended")
        else:
            from ..rbac import is_system_admin

            if changes["security.local_identity_extended"] == "on":  # the ON direction: local channel only (the OFF direction: any channel)
                _local_only_identity_key(conn, request, principal, "security.local_identity_extended")
            if not is_system_admin(conn, principal.user_id):
                audit(conn, actor=principal, action="identity.service_identity.extended_switch", decision="denied", resource_type="installation", resource_id="service_identity",
                      reason="not_system_admin", request_id=getattr(request.state, "correlation_id", None), details={"to": changes["security.local_identity_extended"]})
                raise ApiError(403, "forbidden", "רק מנהל מערכת יכול להפעיל או לכבות את המצב המורחב של משתמשי Arx.")
            if changes["security.local_identity_extended"] == "on" and not service_identity_svc.extended_go_live_permitted():
                # integ/270 (2.7.0 security review S7): the go-live guard - after the authority checks, this build refuses to turn the
                # extended mode on (turning it off always works); the stored value stays as it is; one audit row
                audit(conn, actor=principal, action="identity.service_identity.extended_switch", decision="denied", resource_type="installation", resource_id="service_identity",
                      reason="extended_not_permitted", request_id=getattr(request.state, "correlation_id", None), details={"to": "on"})
                raise ApiError(409, "extended_not_permitted", "המצב המורחב של משתמשי Arx אינו זמין בגרסה הזו: הוא יופעל רק אחרי השלמת תיקוני האבטחה הנדרשים.")
            audit(conn, actor=principal, action="identity.service_identity.extended_switch", decision="allowed", resource_type="installation", resource_id="service_identity",
                  request_id=getattr(request.state, "correlation_id", None),
                  details={"from": current_ext, "to": changes["security.local_identity_extended"], "channel": "remote" if is_remote(request) else "local"})
    if "security.local_public_url" in changes:
        # USR2 phase 2: where a link sent by WhatsApp points. Whoever sets it decides where reset tokens go, so - like the switch - only a
        # system administrator changes it (system.configure alone could aim every reset link at a host of its choice); https + a DNS
        # name only, no path / query / IP literal; "" clears it.
        from ..rbac import is_system_admin
        from ..services import local_reset

        raw = changes["security.local_public_url"].strip()
        value = local_reset.normalize_public_url(raw) if raw else ""
        if value is None:
            raise ApiError(422, "validation", "כתובת הגישה מרחוק: https://שם-מארח בלבד (בלי נתיב, בלי כתובת IP).", details={"field": "security.local_public_url"})
        if value != (get_setting(conn, "security.local_public_url", "") or ""):
            _local_only_identity_key(conn, request, principal, "security.local_public_url")
            if not is_system_admin(conn, principal.user_id):
                audit(conn, actor=principal, action="identity.local.public_url", decision="denied", resource_type="installation", resource_id="local_identity",
                      reason="not_system_admin", request_id=getattr(request.state, "correlation_id", None))
                raise ApiError(403, "forbidden", "רק מנהל מערכת משנה את כתובת הקישורים של משתמשי Arx.")
            audit(conn, actor=principal, action="identity.local.public_url", decision="allowed", resource_type="installation", resource_id="local_identity",
                  request_id=getattr(request.state, "correlation_id", None), details={"to": value or None})
        changes["security.local_public_url"] = value
    for key in ("security.local_passkey_first", "security.local_passkey_android"):
        # USR2 phase 4: passwordless sign-in, and which app may use this site's passkeys - each shapes who can sign in, so (like the switch)
        # only a system administrator changes them; audited; never restored from a backup (services/backup.SETTINGS_KEEP)
        if key not in changes:
            continue
        from ..rbac import is_system_admin
        from ..services import local_passkeys

        value = changes[key].strip() if isinstance(changes[key], str) else changes[key]
        if key == "security.local_passkey_android":
            targets = local_passkeys.android_targets(value)
            if targets is None:
                raise ApiError(422, "validation", "אפליקציית אנדרואיד: שורות בצורה package.name:AA:BB:...(טביעת SHA-256).", details={"field": key})
            value = "\n".join(f"{p}:{f}" for p, f in targets)
        if value == (get_setting(conn, key, DEFAULTS[key]) or DEFAULTS[key]):
            changes.pop(key)
            continue
        _local_only_identity_key(conn, request, principal, key)
        if not is_system_admin(conn, principal.user_id):
            audit(conn, actor=principal, action="identity.local.passkey_setting", decision="denied", resource_type="installation", resource_id="local_identity",
                  reason="not_system_admin", request_id=getattr(request.state, "correlation_id", None), details={"key": key})
            raise ApiError(403, "forbidden", "רק מנהל מערכת משנה את הגדרות מפתחות הגישה של משתמשי Arx.")
        audit(conn, actor=principal, action="identity.local.passkey_setting", decision="allowed", resource_type="installation", resource_id="local_identity",
              request_id=getattr(request.state, "correlation_id", None), details={"key": key, "to": value if key == "security.local_passkey_first" else ("set" if value else "cleared")})
        changes[key] = value
    purge_confirm = changes.pop("privacy.local_purge_confirm", None)
    for key in ("privacy.local_purge", "privacy.local_purge_days"):
        # REL2140 review M-1: the IDENT146 purge deletes personal rows for good. Like the Arx-only identity switch and the alarm-disarm
        # restriction, only a system administrator changes it (system.configure alone is not enough), and turning it ON or changing the
        # period only from the local channel, with the typed confirmation for ON; turning it OFF (the stop direction) works on any channel.
        # The whole PATCH fails on a refusal (no partial write); every actual change is audited on its own row.
        if key not in changes:
            continue
        from ..rbac import is_system_admin
        from ..remote_channel import is_remote
        from ..services import local_privacy

        new = str(changes[key])
        old = str(get_setting(conn, key, DEFAULTS[key]) or DEFAULTS[key])
        if key == "privacy.local_purge_days":
            old = str(local_privacy.purge_days(conn))
        if new == old:
            changes.pop(key)
            continue
        if not (key == "privacy.local_purge" and new == "off"):
            _local_only_identity_key(conn, request, principal, key)
        if not is_system_admin(conn, principal.user_id):
            audit(conn, actor=principal, action="privacy.local_purge.setting", decision="denied", resource_type="installation", resource_id="local_privacy",
                  reason="not_system_admin", request_id=getattr(request.state, "correlation_id", None), details={"key": key, "to": new})
            raise ApiError(403, "forbidden", "רק מנהל מערכת משנה את המחיקה האוטומטית של משתמשי Arx.")
        if key == "privacy.local_purge" and new == "on" and (purge_confirm or "").strip() != LOCAL_PURGE_WORD:
            due = len(local_privacy.purge_due(conn))
            raise ApiError(422, "confirm_required", f"המחיקה אינה הפיכה. כדי להפעיל אותה יש להקליד \"{LOCAL_PURGE_WORD}\".",
                           details={"field": "privacy.local_purge_confirm", "due_now": due})
        audit(conn, actor=principal, action="privacy.local_purge.setting", decision="allowed", resource_type="installation", resource_id="local_privacy",
              request_id=getattr(request.state, "correlation_id", None),
              details={"key": key, "from": old, "to": new, "channel": "remote" if is_remote(request) else "local"})
    tickets_switch = None  # CR-038: the module switch gets its own audit row when it actually changes
    if "tickets.enabled" in changes:
        current_tickets = get_setting(conn, "tickets.enabled", DEFAULTS["tickets.enabled"]) or DEFAULTS["tickets.enabled"]
        if changes["tickets.enabled"] != ("true" if current_tickets == "true" else "false"):
            tickets_switch = changes["tickets.enabled"]
    maintenance_switch = None  # CR-MAINT215: the module switch gets its own audit row when it actually changes
    if "maintenance.enabled" in changes:
        current_maint = get_setting(conn, "maintenance.enabled", DEFAULTS["maintenance.enabled"]) or DEFAULTS["maintenance.enabled"]
        if changes["maintenance.enabled"] != ("true" if current_maint == "true" else "false"):
            maintenance_switch = changes["maintenance.enabled"]
    docread_switch = None  # SUPPLIERDOCS-297: the document-reading switch gets its own audit row when it actually changes
    if "docread.enabled" in changes:
        current_dr = get_setting(conn, "docread.enabled", DEFAULTS["docread.enabled"]) or DEFAULTS["docread.enabled"]
        if changes["docread.enabled"] != ("true" if current_dr == "true" else "false"):
            docread_switch = changes["docread.enabled"]
    emergency_switch = None  # CR-EMERG104: the module switch gets its own audit row when it actually changes
    if "emergency_readiness.enabled" in changes:
        current_em = get_setting(conn, "emergency_readiness.enabled", DEFAULTS["emergency_readiness.enabled"]) or DEFAULTS["emergency_readiness.enabled"]
        if changes["emergency_readiness.enabled"] != ("true" if current_em == "true" else "false"):
            emergency_switch = changes["emergency_readiness.enabled"]
    force_sensor = bool(changes.pop("schedules.shabbat_sensor_force", False))
    forced = False
    if changes.get("schedules.shabbat_sensor"):
        row = conn.execute("SELECT entity_id, platform FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (changes["schedules.shabbat_sensor"],)).fetchone()
        if not row:
            raise ApiError(422, "validation", "חיישן השבת והחג לא נמצא.", details={"schedules.shabbat_sensor": changes["schedules.shabbat_sensor"]})
        from ..services import home_screen

        # the sensor's state is shown to schedule viewers and decides the presets: only a calendar sensor, unless an
        # administrator says explicitly that this one is right (`schedules.shabbat_sensor_force`)
        calendar_sensor = home_screen.is_jewish_calendar(dict(row)) or "issur_melacha" in row["entity_id"]
        forced = force_sensor and not calendar_sensor
        if not force_sensor and not calendar_sensor:
            raise ApiError(422, "not_calendar_sensor", "זה לא נראה כחיישן של לוח השנה היהודי. לבחירה מפורשת שלחו schedules.shabbat_sensor_force.",
                           details={"schedules.shabbat_sensor": changes["schedules.shabbat_sensor"]})
    if changes.get("map.default_floor") and not conn.execute("SELECT 1 FROM floors WHERE id = ? AND deleted_at IS NULL", (changes["map.default_floor"],)).fetchone():
        raise ApiError(422, "validation", "קומת ברירת המחדל של המפה לא קיימת.", details={"map.default_floor": changes["map.default_floor"]})
    if "home.title" in changes:
        title = changes["home.title"].strip()
        if any(ord(c) < 32 or ord(c) == 127 for c in title):
            raise ApiError(422, "validation", "כותרת המסך: טקסט רגיל בלבד.", details={"home.title": "control_characters"})
        changes["home.title"] = title
    if "home.floor_order" in changes:
        from ..services import home_screen

        order = home_screen.normalise_floor_order(changes["home.floor_order"])
        if order is None:
            raise ApiError(422, "validation", "סדר הקומות: רשימה של מזהי קומות שונים זה מזה.", details={"home.floor_order": "invalid"})
        changes["home.floor_order"] = json.dumps(order, ensure_ascii=False)
    if "home.widgets" in changes:
        # the whole widget configuration, validated in full; an empty object puts the setting back to "never saved" (the
        # default with the catalogue's suggestions)
        try:
            cfg = home_config.normalise(changes["home.widgets"]) if changes["home.widgets"] else None
        except ValueError as exc:
            raise ApiError(422, "validation", "הגדרות הווידג׳טים: ערך לא תקין.", details={"home.widgets": str(exc)})
        changes["home.widgets"] = cfg
    if "time.zone" in changes:
        from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

        try:
            ZoneInfo(changes["time.zone"])
        except (ZoneInfoNotFoundError, ValueError):
            raise ApiError(422, "validation", "אזור זמן לא מוכר.", details={"time.zone": changes["time.zone"]})
    if changes.get("ai.provider") == "external":
        # the adapter contract exists (privacy, model version, budget, opt-in) but no provider is bundled: refuse, never pretend
        raise ApiError(422, "provider_not_available", "לא מצורף ספק ניתוח חיצוני; קיים רק חוזה המתאם (פרטיות, גרסת מודל, תקציב, opt-in).", details={"choices": ["none", "local"]})
    for key, value in changes.items():
        if key == "home.widgets":
            set_setting(conn, key, json.dumps(value, ensure_ascii=False, separators=(",", ":")) if value else "")
            continue
        set_setting(conn, key, json.dumps(value, ensure_ascii=False, separators=(",", ":")) if key in ("ui.tabs", "ui.nav_size", "ui.look", "ui.palettes", "ui.tabs_mode_groups", "ui.dd_style_groups", "ui.dd_size_groups", "ui.dd_ring_groups", "ui.dd_panel_groups", "ui.mobile", "ui.xs", "timeline.colors", "schedules.classes", "plan.surfaces", "plan.view", "plan.bakes", "devices.area_row", "devices.floor_row", "home.screen", "multimedia.remote_default", *automation_settings.JSON_KEYS) else str(value))
    if "schedules.classes" in changes:
        set_setting(conn, CLASSES_REV_KEY, "2")  # from now on the list is read as saved (the 2026-10-04 classes can be switched off)
    if changes.get("schedules.enabled") == "true":  # CR-014: the feature was just switched on - start listening to the component now
        from ..services import schedules as schedules_svc

        schedules_svc.MIRROR.feature_switched_on()
    if changes.get("automations.enabled") == "true":  # CR-017: listen to the reload / run events and pull now
        from ..services import automations as automations_svc

        automations_svc.MIRROR.feature_switched_on()
    if "remote.csp_enforce" in changes:  # CR-008 P2: the remote channel's next response already follows
        from ..remote_channel import set_csp_enforce

        set_csp_enforce(changes["remote.csp_enforce"] == "true")
    if any(k in changes for k in ("access.station_media", "ui.hide_wiskey")):  # LAZYMIC-295: the microphone policy follows at once
        from ..remote_channel import load_mic_mode_from

        load_mic_mode_from(conn)
    if any(k.startswith("security.local_") for k in changes):
        from ..services import local_identity

        local_identity.flag_changed()  # the hot path reads the switch again at once
    if local_switch is not None:
        from ..services import local_identity

        ended = local_identity.revoke_all(conn, "feature_off") if local_switch == "off" else 0
        if local_switch == "off":  # USR2-P2B: every live self-service reset code ends with the switch (migration 0097's trigger does it too)
            conn.execute("DELETE FROM auth_local_reset_codes")
        audit(conn, actor=principal, action="identity.local.feature_enabled" if local_switch == "on" else "identity.local.feature_disabled", decision="allowed",
              resource_type="installation", resource_id="local_identity", request_id=getattr(request.state, "correlation_id", None),
              details={"sessions_ended": ended} if ended else None)
        if ended:
            local_identity.close_sockets_from_thread()
    if disarm_change is not None:
        audit(conn, actor=principal, action="schedules.allow_disarm", decision="allowed", resource_type="installation", resource_id="*",
              request_id=getattr(request.state, "correlation_id", None), details={"to": disarm_change})
    if update_switch is not None:
        audit(conn, actor=principal, action="system.update.apply_enabled", decision="allowed", resource_type="installation", resource_id="update",
              request_id=getattr(request.state, "correlation_id", None), details={"to": update_switch == "true"})
    if tickets_switch is not None:
        audit(conn, actor=principal, action="tickets.module.enable" if tickets_switch == "true" else "tickets.module.disable", decision="allowed",
              resource_type="installation", resource_id="tickets", request_id=getattr(request.state, "correlation_id", None))
        from ..services.tickets.public_runtime import RUNTIME as tickets_public  # CR-038 S4: the handler page follows at once (W3, W12)

        tickets_public.module_switched(tickets_switch == "true")
    if emergency_switch is not None:
        audit(conn, actor=principal, action="emergency_readiness.module.enable" if emergency_switch == "true" else "emergency_readiness.module.disable", decision="allowed",
              resource_type="installation", resource_id="emergency_readiness", request_id=getattr(request.state, "correlation_id", None))
    if maintenance_switch is not None:
        audit(conn, actor=principal, action="maintenance.module.enable" if maintenance_switch == "true" else "maintenance.module.disable", decision="allowed",
              resource_type="installation", resource_id="maintenance", request_id=getattr(request.state, "correlation_id", None))
    if docread_switch is not None:
        audit(conn, actor=principal, action="docread.enable" if docread_switch == "true" else "docread.disable", decision="allowed",
              resource_type="installation", resource_id="docread", request_id=getattr(request.state, "correlation_id", None))
    audit(conn, actor=principal, action="settings.update", decision="allowed", resource_type="installation", resource_id="*",
          request_id=getattr(request.state, "correlation_id", None), details={**changes, "forced": True} if forced else changes)  # an override of the calendar-sensor check is on the record
    return {"settings": read_settings(conn, private=True), "can_edit": True, **_capacity_info(conn)}
