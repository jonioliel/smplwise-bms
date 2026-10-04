"""Product settings that are safe to expose (no secrets): media transport default, session caps,
snapshot freshness. Secrets stay in the add-on options."""
from __future__ import annotations

import json
import re
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from ..audit import audit
from ..auth import current_principal, get_conn
from ..db import get_setting, set_setting
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, require
from ..services import area_row, automation_settings, home_config, home_screen, look, media_layout, mobile_options, nav_size, nvr_capacity, dd_style, palettes, tabs_mode, timeline_colors

router = APIRouter()

DEFAULTS: dict[str, str] = {
    # auto | webrtc | mse. MSE by default (owner decision 2026-09-14): it works through Ingress, Cloudflare
    # and behind CGNAT; WebRTC/auto are selectable in Settings once UDP to the go2rtc host is possible.
    "media.transport_default": "mse",
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
    # Design foundation (2026-10-01): the installation's skin (classic = today's look | domus | tesla; frontend/src/design/skins)
    # and light / dark / auto choice (a browser may keep its own scheme, in the browser only). Per installation.
    "ui.skin": "classic",
    "ui.scheme": "light",
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
    # release 0.1.153: how the tab groups are presented - tabs (default) | hybrid | dropdown - and a per-group override (a JSON object
    # {home|area|multimedia|security|settings: mode}, read back as an object). A user's own value (/me/prefs) wins. services/tabs_mode.py.
    "ui.tabs_mode": "tabs",
    "ui.tabs_mode_groups": "{}",
    # release 0.1.157: the look of a dropdown - auto (today's) | pill | field | underline | text | prefix | tonal - global and per tab group
    # (a JSON object read back as an object). A user's own value (/me/prefs) wins. services/dd_style.py.
    "ui.dd_style": "auto",
    "ui.dd_style_groups": "{}",
    # owner 2026-10-03: how a dropdown opens on a phone - sheet (a bottom sheet, default) | list (the small list under the field). services/dd_style.py.
    "ui.dd_phone": "sheet",
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
    "plan.estimates": "true",  # Plan Studio: show estimated metres (≈) before a plan is calibrated; false hides metres until calibration (owner decision 2026-09-23)
    "plan.levels": "all",  # default levels view on every map: all levels together, or the floor's default level only (owner decision 2026-09-26)
    "map.shared_levels": "show",  # CR-009: the levels of a shared room's home floor in the other floor's level bar ("מפלס ראשי · קומה -1"): show | hide (owner 2026-09-29)
    "map.default_floor": "",  # owner 2026-09-30: the floor the map's floor tab opens first when several floors exist ("" = the built-in order); an existing floor id, cleared when that floor is deleted
    "map.default_view": "2d",  # the view a floor map opens in - live map, history map, event page: 2d | 3d (owner 2026-09-29); a device's own last choice wins
    "plan.quality": "2",  # CR-006: the 3D quality level a browser opens with (1 schematic, 2 shadows/materials/cutaway); a browser can override it for itself and falls back to 1 on a slow device
    "plan.presence_fade": "3",  # CR-006 1b: the presence tint on the floor map fades this many minutes after the last motion; "off" = the tint only while a sensor is on (owner decision 2026-09-28: on/off + minutes per installation)
    "playback.max_sessions": "4",  # playback sessions open at once (each is one NVR RTSP playback stream)
    "playback.lease_s": "600",  # idle lease; the janitor deletes the go2rtc stream after it expires
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
    # the add-on option openai_api_key (never a setting). Budgets count successful renders (routers/skins.py).
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
    "home.widgets": "",
    # CR-008 SmplWise Arx remote access (owner decisions 2026-09-29, CR-008 §3f / §7). The channel itself is the add-on
    # option remote_access; these shape who may use it and how the browser keeps its sign-in.
    "remote.policy": "flag",  # flag: only users with the per-user remote-access flag (D4) | any_role: every HA user holding an Arx role
    "remote.admins_default": "true",  # CR-008 amendment (owner 2026-10-01): true = a system administrator signs in remotely without a per-user flag (only under remote.policy = flag)
    "remote.session": "rolling_90d",  # rolling_90d (HA's sliding refresh token, localStorage) | browser_session (sessionStorage) | rolling_90d_idle_lock (D5)
    "remote.idle_lock_minutes": "720",  # the idle lock of rolling_90d_idle_lock
    "remote.default_profile": "main",  # main | sub: the stream a remote viewer gets first, over WebRTC (D7)
    "remote.mse_fallback": "true",  # MSE through the tunnel only as an announced last resort; false = never (D7)
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
    "schedules.classes": '["light", "switch", "cover", "climate", "fan", "alarm", "lock", "door"]',
    "schedules.snap_minutes": "15",
    "schedules.default_repeat": "repeat",
    "schedules.runs_retention_days": "90",
    "schedules.shabbat_sensor": "",
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
}

SCHEDULE_CLASSES = ("light", "switch", "cover", "climate", "fan", "alarm", "lock", "door")

# CR-007 6a/6b: the registered device-screen palettes - keep in step with DEVICE_THEMES in
# frontend/src/styles/devices-themes.ts (docs/design/DEVICE_THEMES.md, "How to add a theme").
DEVICE_THEMES = ("default", "sand", "forest", "graphite")

INT_KEYS = ("media.max_live_sessions", "snapshots.max_age_s", "playback.max_sessions", "playback.lease_s", "exports.max_mb", "exports.retention_days", "events.retention_days", "audit.retention_days", "cases.import_max_mb", "storage.min_free_mb", "ai.budget_daily", "skins.budget_renders_per_floor", "skins.budget_monthly", "remote.idle_lock_minutes", "remote.max_live_streams", "schedules.runs_retention_days", *automation_settings.INT_KEYS)


def read_settings(conn: sqlite3.Connection) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key, default in DEFAULTS.items():
        value = get_setting(conn, key, default) or default
        out[key] = int(value) if key in INT_KEYS else value
    out["ui.tabs"] = _stored_tabs(out["ui.tabs"])
    out["ui.nav_size"] = _stored_nav_size(out["ui.nav_size"])
    out["ui.look"] = look.stored(out["ui.look"])
    out["ui.palettes"] = palettes.stored(out["ui.palettes"])
    out["ui.tabs_mode"] = tabs_mode.stored_mode(out["ui.tabs_mode"])
    out["ui.tabs_mode_groups"] = tabs_mode.stored_groups(out["ui.tabs_mode_groups"])
    out["ui.dd_style"] = dd_style.stored_style(out["ui.dd_style"])
    out["ui.dd_style_groups"] = dd_style.stored_groups(out["ui.dd_style_groups"])
    out["ui.dd_phone"] = dd_style.stored_phone(out["ui.dd_phone"])
    out["ui.dd_size"] = dd_style.stored_size(out["ui.dd_size"])
    out["ui.dd_size_groups"] = dd_style.stored_size_groups(out["ui.dd_size_groups"])
    out["ui.dd_ring"] = dd_style.stored_ring(out["ui.dd_ring"])
    out["ui.dd_ring_groups"] = dd_style.stored_ring_groups(out["ui.dd_ring_groups"])
    out["ui.dd_panel"] = dd_style.stored_panel(out["ui.dd_panel"])
    out["ui.dd_panel_groups"] = dd_style.stored_panel_groups(out["ui.dd_panel_groups"])
    out["ui.mobile"] = _stored_mobile(out["ui.mobile"])
    out["timeline.colors"] = _stored_timeline_colors(out["timeline.colors"])
    out["devices.area_row"] = _stored_area_row(out["devices.area_row"], area_row.normalize_area, area_row.AREA_ROW_DEFAULT)
    out["devices.floor_row"] = _stored_area_row(out["devices.floor_row"], area_row.normalize_floor, area_row.FLOOR_ROW_DEFAULT)
    out["schedules.classes"] = stored_schedule_classes(out["schedules.classes"])
    out["home.widgets"] = home_screen.effective_config(conn)
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


def stored_schedule_classes(raw: Any) -> list[str]:
    """The stored `schedules.classes` as an ordered list of known classes; a corrupt value reads as every class (the
    default) - a schedule can never be allowed a class this build does not know."""
    try:
        data = json.loads(raw) if isinstance(raw, str) else raw
    except ValueError:
        data = None
    if not isinstance(data, list):
        data = list(SCHEDULE_CLASSES)
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


class SettingsPatch(BaseModel):
    media_transport_default: str | None = Field(default=None, pattern="^(auto|webrtc|mse)$", alias="media.transport_default")
    media_max_live_sessions: int | None = Field(default=None, ge=1, le=128, alias="media.max_live_sessions")
    media_wall_profile: str | None = Field(default=None, pattern="^(sub|main)$", alias="media.wall_profile")
    media_video_notices: str | None = Field(default=None, pattern="^(true|false)$", alias="media.video_notices")
    snapshots_max_age_s: int | None = Field(default=None, ge=5, le=3600, alias="snapshots.max_age_s")
    time_zone: str | None = Field(default=None, pattern=r"^[A-Za-z_]+(/[A-Za-z_\-+0-9]+)+$", alias="time.zone")
    playback_max_sessions: int | None = Field(default=None, ge=1, le=128, alias="playback.max_sessions")
    playback_lease_s: int | None = Field(default=None, ge=60, le=3600, alias="playback.lease_s")
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
    ui_start_route: str | None = Field(default=None, pattern="^(explore|live|wall|events|playback|devices)$", alias="ui.start_route")
    ui_hide_map: str | None = Field(default=None, pattern="^(true|false)$", alias="ui.hide_map")
    ui_security_snapshot: str | None = Field(default=None, pattern="^(true|false)$", alias="ui.security_snapshot")
    ui_tile_layout: str | None = Field(default=None, pattern="^(auto|cards|compact)$", alias="ui.tile_layout")
    ui_skin: str | None = Field(default=None, pattern="^(classic|domus|tesla|bubble)$", alias="ui.skin")  # keep in step with SKIN_IDS in frontend/src/design/skins/index.ts
    ui_scheme: str | None = Field(default=None, pattern="^(light|dark|auto)$", alias="ui.scheme")
    ui_tabs: dict[str, Any] | None = Field(default=None, alias="ui.tabs")  # validated in full by normalize_tabs
    ui_tabs_mode: str | None = Field(default=None, pattern="^(tabs|hybrid|dropdown)$", alias="ui.tabs_mode")
    ui_tabs_mode_groups: dict[str, Any] | None = Field(default=None, alias="ui.tabs_mode_groups")  # validated in full by services/tabs_mode.py
    ui_dd_style: str | None = Field(default=None, pattern="^(" + "|".join(dd_style.STYLES) + ")$", alias="ui.dd_style")
    ui_dd_phone: str | None = Field(default=None, pattern="^(" + "|".join(dd_style.PHONE_MODES) + ")$", alias="ui.dd_phone")
    ui_dd_style_groups: dict[str, Any] | None = Field(default=None, alias="ui.dd_style_groups")  # validated in full by services/dd_style.py
    ui_dd_size: str | None = Field(default=None, pattern="^(" + "|".join(dd_style.SIZES) + ")$", alias="ui.dd_size")
    ui_dd_size_groups: dict[str, Any] | None = Field(default=None, alias="ui.dd_size_groups")  # validated in full by services/dd_style.py
    ui_dd_ring: str | None = Field(default=None, pattern="^(" + "|".join(re.escape(r) for r in dd_style.RINGS) + ")$", alias="ui.dd_ring")
    ui_dd_ring_groups: dict[str, Any] | None = Field(default=None, alias="ui.dd_ring_groups")  # validated in full by services/dd_style.py
    ui_dd_panel: str | None = Field(default=None, pattern="^(" + "|".join(dd_style.PANELS) + ")$", alias="ui.dd_panel")
    ui_dd_panel_groups: dict[str, Any] | None = Field(default=None, alias="ui.dd_panel_groups")  # validated in full by services/dd_style.py
    ui_mobile: dict[str, Any] | None = Field(default=None, alias="ui.mobile")  # validated in full by services/mobile_options.py
    ui_nav_size: dict[str, Any] | None = Field(default=None, alias="ui.nav_size")  # validated in full by services/nav_size.py
    ui_look: dict[str, Any] | None = Field(default=None, alias="ui.look")  # validated in full by services/look.py (every dial required)
    ui_palettes: list[dict[str, Any]] | None = Field(default=None, alias="ui.palettes")  # validated in full (shape; contrast is warn-only) by services/palettes.py
    timeline_palette: dict[str, Any] | None = Field(default=None, alias="timeline.colors")  # validated in full by services/timeline_colors.py
    playback_helper_line: str | None = Field(default=None, pattern="^(all|installers|hidden)$", alias="playback.helper_line")
    playback_diagnostics: str | None = Field(default=None, pattern="^(all|installers|hidden)$", alias="playback.diagnostics")
    history_ha_secondary: str | None = Field(default=None, pattern="^(true|false)$", alias="history.ha_secondary")
    plan_estimates: str | None = Field(default=None, pattern="^(true|false)$", alias="plan.estimates")
    plan_levels: str | None = Field(default=None, pattern="^(all|default)$", alias="plan.levels")
    map_shared_levels: str | None = Field(default=None, pattern="^(show|hide)$", alias="map.shared_levels")
    map_default_floor: str | None = Field(default=None, max_length=64, pattern=r"^[A-Za-z0-9_.\-]*$", alias="map.default_floor")  # "" or an existing floor id (checked in the handler)
    map_default_view: str | None = Field(default=None, pattern="^(2d|3d)$", alias="map.default_view")
    plan_quality: str | None = Field(default=None, pattern="^(1|2)$", alias="plan.quality")
    plan_presence_fade: str | None = Field(default=None, pattern="^(off|[1-9]|[1-9][0-9]|1[01][0-9]|120)$", alias="plan.presence_fade")  # off, or 1-120 minutes
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
    ui_hide_wiskey: str | None = Field(default=None, pattern="^(true|false)$", alias="ui.hide_wiskey")
    ui_wiskey_size: str | None = Field(default=None, pattern="^(normal|fit|full)$", alias="ui.wiskey_size")
    ui_wiskey_scale: str | None = Field(default=None, pattern="^(100|90|80|70)$", alias="ui.wiskey_scale")
    ui_wiskey_density: str | None = Field(default=None, pattern="^(auto|4|6|8|9|12)$", alias="ui.wiskey_density")
    ui_wiskey_wall: str | None = Field(default=None, pattern="^(auto|4|9|12)$", alias="ui.wiskey_wall")
    access_phone_embed: str | None = Field(default=None, pattern="^(true|false)$", alias="access.phone_embed")
    devices_style: str | None = Field(default=None, pattern="^(smplwise|glass)$", alias="devices.style")
    devices_theme: str | None = Field(default=None, pattern="^(" + "|".join(DEVICE_THEMES) + ")$", alias="devices.theme")
    devices_default_view: str | None = Field(default=None, pattern="^(cards|tiles)$", alias="devices.default_view")
    devices_show_sensors: str | None = Field(default=None, pattern="^(true|false)$", alias="devices.show_sensors")
    devices_show_climate_strip: str | None = Field(default=None, pattern="^(true|false)$", alias="devices.show_climate_strip")
    devices_density: str | None = Field(default=None, pattern="^(comfortable|compact)$", alias="devices.density")
    devices_scheme: str | None = Field(default=None, pattern="^(light|dark|auto)$", alias="devices.scheme")
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
    home_widgets: dict[str, Any] | None = Field(default=None, alias="home.widgets")  # validated in full by services/home_config.py
    remote_policy: str | None = Field(default=None, pattern="^(flag|any_role)$", alias="remote.policy")
    remote_admins_default: str | None = Field(default=None, pattern="^(true|false)$", alias="remote.admins_default")
    remote_session: str | None = Field(default=None, pattern="^(rolling_90d|browser_session|rolling_90d_idle_lock)$", alias="remote.session")
    remote_idle_lock_minutes: int | None = Field(default=None, ge=5, le=10080, alias="remote.idle_lock_minutes")
    remote_default_profile: str | None = Field(default=None, pattern="^(main|sub)$", alias="remote.default_profile")
    remote_wall_profile: str | None = Field(default=None, pattern="^(main|sub)$", alias="remote.wall_profile")
    remote_mse_fallback: str | None = Field(default=None, pattern="^(true|false)$", alias="remote.mse_fallback")
    remote_require_mfa_admin: str | None = Field(default=None, pattern="^(true|false)$", alias="remote.require_mfa_admin")
    remote_max_live_streams: int | None = Field(default=None, ge=1, le=128, alias="remote.max_live_streams")
    remote_csp_enforce: str | None = Field(default=None, pattern="^(true|false)$", alias="remote.csp_enforce")
    alarm_remote_control: str | None = Field(default=None, pattern="^(true|false)$", alias="alarm.remote_control")
    alarm_remote_disarm: str | None = Field(default=None, pattern="^(true|false)$", alias="alarm.remote_disarm")
    alarm_code_mode: str | None = Field(default=None, pattern="^(personal_pin|panel_code)$", alias="alarm.code_mode")
    alarm_remote_codeless: str | None = Field(default=None, pattern="^(true|false)$", alias="alarm.remote_codeless")
    alarm_pin_min_length: str | None = Field(default=None, pattern="^[4-8]$", alias="alarm.pin_min_length")
    schedules_enabled: str | None = Field(default=None, pattern="^(true|false)$", alias="schedules.enabled")
    schedules_classes: list[str] | None = Field(default=None, max_length=8, alias="schedules.classes")  # each one of SCHEDULE_CLASSES (checked in the handler)
    schedules_snap_minutes: str | None = Field(default=None, pattern="^(5|15|30)$", alias="schedules.snap_minutes")
    schedules_default_repeat: str | None = Field(default=None, pattern="^(repeat|pause|single)$", alias="schedules.default_repeat")
    schedules_runs_retention_days: int | None = Field(default=None, ge=7, le=365, alias="schedules.runs_retention_days")
    schedules_shabbat_sensor: str | None = Field(default=None, pattern=r"^(|binary_sensor\.[a-z0-9_]{1,100})$", alias="schedules.shabbat_sensor")
    schedules_shabbat_sensor_force: bool | None = Field(default=None, alias="schedules.shabbat_sensor_force")  # an explicit override; never stored
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
    automations_phone_filter: str | None = Field(default=None, pattern="^(fold|rows)$", alias="automations.phone_filter")
    automations_sensitive_chip: str | None = Field(default=None, pattern="^(amber|red)$", alias="automations.sensitive_chip")

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
    return {"settings": read_settings(conn), "can_edit": authorize(conn, principal, "system.configure", INSTALLATION).allowed, **_capacity_info(conn)}


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
    if "timeline.colors" in changes:
        try:
            changes["timeline.colors"] = timeline_colors.normalize(changes["timeline.colors"])
        except ValueError as exc:
            raise ApiError(422, "validation", "צבעי ציר הזמן: ערך לא תקין.", details={"timeline.colors": str(exc)})
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
        set_setting(conn, key, json.dumps(value, ensure_ascii=False, separators=(",", ":")) if key in ("ui.tabs", "ui.nav_size", "ui.look", "ui.palettes", "ui.tabs_mode_groups", "ui.dd_style_groups", "ui.dd_size_groups", "ui.dd_ring_groups", "ui.dd_panel_groups", "ui.mobile", "timeline.colors", "schedules.classes", "devices.area_row", "devices.floor_row", "multimedia.remote_default", *automation_settings.JSON_KEYS) else str(value))
    if changes.get("schedules.enabled") == "true":  # CR-014: the feature was just switched on - start listening to the component now
        from ..services import schedules as schedules_svc

        schedules_svc.MIRROR.feature_switched_on()
    if changes.get("automations.enabled") == "true":  # CR-017: listen to the reload / run events and pull now
        from ..services import automations as automations_svc

        automations_svc.MIRROR.feature_switched_on()
    if "remote.csp_enforce" in changes:  # CR-008 P2: the remote channel's next response already follows
        from ..remote_channel import set_csp_enforce

        set_csp_enforce(changes["remote.csp_enforce"] == "true")
    audit(conn, actor=principal, action="settings.update", decision="allowed", resource_type="installation", resource_id="*",
          request_id=getattr(request.state, "correlation_id", None), details={**changes, "forced": True} if forced else changes)  # an override of the calendar-sensor check is on the record
    return {"settings": read_settings(conn), "can_edit": True, **_capacity_info(conn)}
