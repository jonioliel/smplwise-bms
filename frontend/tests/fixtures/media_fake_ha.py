"""Fixture backend for the live parts of the multimedia specs (CR-015, docs/architecture/MEDIA_API.md section 5, S4): the REAL
SMPLWISE backend - the real /multimedia routes with their permission gates, dedupe, command path, rate limits, bulk and
audit, and the real /ha/entities/{id}/actions route - whose only fake is Home Assistant and the bridge integration's
`execute` service. Everything is synthetic: names, ids, UUIDs and MACs are made up (MACs are locally administered
`02:00:00:c0:15:xx`, addresses are the documentation range 192.0.2.0/24); nothing of a real installation is in here. No real
Home Assistant can be reached from this process: HA_URL is forced to a `.test` host (a reserved name that never resolves),
the HA WebSocket is an in-process fake and every REST call to that host is answered here. It refuses to start inside the
add-on.

The synthetic house (`build_world()`; 7 physical screens, 1 receiver, 1 speaker - 19 entities on 15 HA devices):

  living   Samsung (ha-samsungtv-smart) + remote + SmartThings + Cast + DLNA + a Music Assistant export: ONE screen.
           SmartThings and DLNA share the MAC of the vendor device (ladder rung 3; the SmartThings one is written
           02-00-00-C0-15-01, to exercise the backend's normalisation - Home Assistant's own registry would normally have
           merged two devices that share a MAC, so this is a deliberate stress of rung 3), the Cast device shares only the UUID
           (rung 4, written differently: upper case, dashes, no `uuid:` prefix), the MA export is ("music_assistant",
           <the vendor entity id>) (rung 2). Linked receiver: the living room amplifier (+ its own Cast entity, same MAC).
  kitchen  a second Samsung of the SAME platform and model on another HA device: never merged with `living`.
  bedroom  LG webOS WITH a turn-on automation (TURN_ON offered, TV speakers, VOLUME_SET).
  hall     LG webOS WITHOUT one (no TURN_ON: "no remote wake") and `external_arc` sound output (no VOLUME_SET).
  office   Android TV Remote: `remote.*` (activities, keys) + `media_player.*` (no VOLUME_SET / SELECT_SOURCE) + a Cast
           entity on another HA device (same MAC) carrying the metadata and artwork.
  lobby    a plain Cast display (device class tv): the generic profile (no keys). A natural "public" screen.
  lounge   a Samsung whose id contains `_stuck`: accepts every command and never reports an effect.
  + a Cast speaker in the kitchen (a `speaker`: not a screen, never listed on the screens page).

What the fake bridge does with `POST /api/services/smplwise_bridge/execute` (the add-on's only write path to HA):
- refuses a (domain, service) that is not in the bridge integration's own ALLOWED_SERVICES, read from
  custom_components/smplwise_bridge/__init__.py exactly as the real bridge would (`service_not_allowed`), so drift between
  the add-on's media actions and the bridge's shows up here (before bridge 0.4.0 every media call is refused this way);
- re-checks media calls independently, the way bridge 0.4.0's media_policy.py does: no power key in any transport, key
  codes against the profile tables (copied here from docs/research/TV_REMOTE_INTEGRATIONS_NOTES.md section 6, so a backend
  table that drifts is caught), `source` in the entity's current `source_list`, `activity` in `activity_list`, text length,
  `remote.turn_on` only with an `activity`, `play_media` only of type send_key / send_text;
- answers like Home Assistant for a service the entity does not support (`HomeAssistantError`: the LG without a turn-on
  automation, an Android TV asked for VOLUME_SET) and for an unavailable entity;
- otherwise answers {ok: true} and, 0.4 s later (SW_FAKE_EFFECT_DELAY), applies the effect the device would report (state and
  attributes) through the backend's own developer states endpoint - the same upsert and /ha/ws push the sync performs -
  so the confirmation the UI shows is the real poll seeing a real state change. Keys and text have no observable effect;
- never applies anything to an entity whose id contains `_stuck`;
- records every call in a log served at GET /media-log on the control server: key codes, typed text (fixture values
  only), sources, activities, power, volume and transport, with the result and whether an effect was scheduled.

The fake keeps its OWN model of every entity (state and the full attribute set, including keys the add-on does not store
such as `activity_list`, `ip_address` and the artwork URL) and pushes that to the add-on; an unavailable entity is pushed
the way Home Assistant does (capability attributes only). Home Assistant's registries (areas, floors, devices WITH
connections and identifiers, entities) are served over the fake WebSocket and posted through the dev registry route. The
artwork URL of a Cast entity is answered on the fake host (`GET /api/media_player_proxy/...`, a generated JPEG), so the
add-on's artwork proxy has something to fetch; the calls are counted in GET /status.

On start it pairs the bridge (signed ping, version SW_FAKE_BRIDGE_VERSION, default 0.4.0). A small control server
(127.0.0.1, SW_FAKE_HA_CONTROL_PORT, default SW_PORT + 1) is the spec's hand on the world:
  POST /seed-media            seed registries and states (idempotent; also clears the log); answers the world summary
  GET  /world                 the world summary: floors, areas, per screen its entities, duplicates and expectations
  GET  /media-log[?since=n]   the bridge call log  ({entries, next, pending});  POST /media-log/reset  clears it
  POST /media-set {entity_id, state?, attributes?, merge?}   a device changes on its own (power off, unavailable, source...)
  POST /media-config {bridge_version?, effect_delay?, refuse?}   re-ping with another version (503 bridge_outdated below
                               0.4.0), change the effect delay, or make the bridge answer `refuse` to everything
  GET  /status                sockets, counters, bridge version, artwork fetches

Run it (a fresh data dir each time; ports 4381-4390 are for throwaway backends):

    SW_PORT=4381 SW_DATA_DIR=<empty dir> SW_DEV_USER=joni SW_BOOTSTRAP_ADMIN=joni \
        <repo>/.venv/Scripts/python.exe frontend/tests/fixtures/media_fake_ha.py

then, from frontend/ (`npm run build` first):

    SW_LIVE=1 SW_MEDIA_FIXTURE=1 SW_API_PORT=4381 SW_BASE_URL=http://127.0.0.1:4191/ \
        npx playwright test tests/evidence-media-live.spec.ts --workers=1
"""
from __future__ import annotations

import ast
import asyncio
import copy
import json
import os
import re
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parents[3]
FAKE_HOST = "fake-media.test"
PORT = int(os.environ.get("SW_PORT", "8099"))
BASE = f"http://127.0.0.1:{PORT}/api/v1"
BRIDGE_INIT = ROOT / "custom_components" / "smplwise_bridge" / "__init__.py"

# ------------------------------------------------------------------------------------------------ HA vocabulary

PAUSE, SEEK, VOLUME_SET, VOLUME_MUTE, PREVIOUS_TRACK, NEXT_TRACK = 1, 2, 4, 8, 16, 32
TURN_ON, TURN_OFF, PLAY_MEDIA, VOLUME_STEP, SELECT_SOURCE, STOP = 128, 256, 512, 1024, 2048, 4096
PLAY, SELECT_SOUND_MODE, BROWSE_MEDIA = 16384, 65536, 131072
ACTIVITY = 4  # remote entity feature

# the integrations' feature sets as documented in the research notes (TV notes section 3)
SSV_FEATURES = PAUSE | VOLUME_SET | VOLUME_STEP | VOLUME_MUTE | PREVIOUS_TRACK | NEXT_TRACK | SELECT_SOURCE | TURN_OFF | TURN_ON | PLAY | PLAY_MEDIA | STOP | BROWSE_MEDIA
LG_FEATURES = TURN_OFF | NEXT_TRACK | PAUSE | PREVIOUS_TRACK | SELECT_SOURCE | PLAY_MEDIA | PLAY | STOP | VOLUME_MUTE | VOLUME_STEP  # + VOLUME_SET unless external_speaker, + TURN_ON with a trigger
ANDROID_FEATURES = PAUSE | VOLUME_STEP | VOLUME_MUTE | PREVIOUS_TRACK | NEXT_TRACK | TURN_ON | TURN_OFF | PLAY | STOP | PLAY_MEDIA | BROWSE_MEDIA
CAST_FEATURES = PLAY_MEDIA | TURN_ON | TURN_OFF | VOLUME_SET | VOLUME_MUTE | PAUSE | PLAY | STOP | SEEK | PREVIOUS_TRACK | NEXT_TRACK | BROWSE_MEDIA
SMARTTHINGS_FEATURES = TURN_ON | TURN_OFF | VOLUME_SET | VOLUME_STEP | VOLUME_MUTE | SELECT_SOURCE | PAUSE | PLAY
DLNA_FEATURES = VOLUME_SET | VOLUME_STEP | VOLUME_MUTE | PLAY | PAUSE | STOP | SEEK | PLAY_MEDIA
AVR_FEATURES = TURN_ON | TURN_OFF | VOLUME_SET | VOLUME_STEP | VOLUME_MUTE | SELECT_SOURCE | SELECT_SOUND_MODE | PLAY | PAUSE | STOP
# Music Assistant's HA export advertises these regardless of the device (MA notes section 1.5)
MA_FEATURES = STOP | PREVIOUS_TRACK | NEXT_TRACK | PLAY | PLAY_MEDIA | BROWSE_MEDIA | SEEK | PAUSE | VOLUME_SET | VOLUME_MUTE | 32768 | 262144 | 1048576 | 2097152

# ------------------------------------------------------------------------------------------------ key vocabularies
# An INDEPENDENT copy of TV notes section 6: the fake bridge checks the add-on's codes against this, so a drifted profile
# table in the backend is caught here. "blue" is absent for Samsung (KEY_CYAN is UNVERIFIED) and rew / ff for LG.

SAMSUNG_KEYS: dict[str, str] = {
    "up": "KEY_UP", "down": "KEY_DOWN", "left": "KEY_LEFT", "right": "KEY_RIGHT", "ok": "KEY_ENTER", "back": "KEY_RETURN", "home": "KEY_HOME",
    "menu": "KEY_MENU", "exit": "KEY_EXIT", "info": "KEY_INFO", "guide": "KEY_GUIDE", "source": "KEY_SOURCE", "tools": "KEY_TOOLS",
    "chlist": "KEY_CH_LIST", "prech": "KEY_PRECH", "volup": "KEY_VOLUP", "voldown": "KEY_VOLDOWN", "mute": "KEY_MUTE", "chup": "KEY_CHUP",
    "chdown": "KEY_CHDOWN", **{f"n{i}": f"KEY_{i}" for i in range(10)}, "red": "KEY_RED", "green": "KEY_GREEN", "yellow": "KEY_YELLOW",
    "play": "KEY_PLAY", "pause": "KEY_PAUSE", "stop": "KEY_STOP", "rew": "KEY_REWIND", "ff": "KEY_FF",
}
LG_KEYS: dict[str, str] = {
    "up": "UP", "down": "DOWN", "left": "LEFT", "right": "RIGHT", "ok": "ENTER", "back": "BACK", "home": "HOME", "menu": "MENU", "exit": "EXIT",
    "info": "INFO", "guide": "GUIDE", "volup": "VOLUMEUP", "voldown": "VOLUMEDOWN", "mute": "MUTE", "chup": "CHANNELUP", "chdown": "CHANNELDOWN",
    **{f"n{i}": str(i) for i in range(10)}, "red": "RED", "green": "GREEN", "yellow": "YELLOW", "blue": "BLUE", "play": "PLAY", "pause": "PAUSE",
}
ANDROID_KEYS: dict[str, str] = {
    "up": "DPAD_UP", "down": "DPAD_DOWN", "left": "DPAD_LEFT", "right": "DPAD_RIGHT", "ok": "DPAD_CENTER", "back": "BACK", "home": "HOME",
    "menu": "MENU", "info": "INFO", "guide": "GUIDE", "source": "TV_INPUT", "settings": "SETTINGS", "volup": "VOLUME_UP", "voldown": "VOLUME_DOWN",
    "mute": "MUTE", "chup": "CHANNEL_UP", "chdown": "CHANNEL_DOWN", **{f"n{i}": str(i) for i in range(10)}, "red": "PROG_RED", "green": "PROG_GREEN",
    "yellow": "PROG_YELLOW", "blue": "PROG_BLUE", "play": "MEDIA_PLAY", "pause": "MEDIA_PAUSE", "stop": "MEDIA_STOP", "rew": "MEDIA_REWIND", "ff": "MEDIA_FAST_FORWARD",
}
KEY_TABLES = {"samsung_smart": SAMSUNG_KEYS, "lg_webos": LG_KEYS, "android_tv": ANDROID_KEYS}
POWER_CODE = re.compile(r"POWER", re.I)  # KEY_POWER, KEY_POWEROFF, POWER, POWER_OFF...: never, in any transport
TEXT_MAX = 200
CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")

PLATFORM_PROFILE = {"samsungtv_smart": "samsung_smart", "webostv": "lg_webos", "androidtv_remote": "android_tv"}


# ------------------------------------------------------------------------------------------------ the synthetic world


def _mac(n: int, style: str = "colon") -> str:
    """Locally administered, obviously synthetic: 02:00:00:c0:15:NN ("dash_upper": 02-00-00-C0-15-NN, to exercise normalisation)."""
    m = f"02:00:00:c0:15:{n:02x}"
    return m.replace(":", "-").upper() if style == "dash_upper" else m


def _uuid(n: int, upper: bool = False) -> str:
    u = f"00000000-0000-4000-8000-c015000000{n:02x}"
    return u.upper() if upper else u


FLOORS = [
    {"floor_id": "cr015_ground", "name": "קומת קרקע", "level": 0},
    {"floor_id": "cr015_upper", "name": "קומה 1", "level": 1},
]
AREAS = [
    {"area_id": "cr015_living", "name": "סלון", "floor_id": "cr015_ground", "icon": "mdi:sofa"},
    {"area_id": "cr015_kitchen", "name": "מטבח", "floor_id": "cr015_ground", "icon": "mdi:silverware-fork-knife"},
    {"area_id": "cr015_lobby", "name": "לובי", "floor_id": "cr015_ground", "icon": "mdi:door"},
    {"area_id": "cr015_bedroom", "name": "חדר שינה", "floor_id": "cr015_upper", "icon": "mdi:bed"},
    {"area_id": "cr015_hall", "name": "מסדרון", "floor_id": "cr015_upper", "icon": "mdi:floor-plan"},
    {"area_id": "cr015_office", "name": "משרד", "floor_id": "cr015_upper", "icon": "mdi:desk"},
    {"area_id": "cr015_lounge", "name": "פינת מנוחה", "floor_id": "cr015_upper", "icon": "mdi:sofa-single"},
]

SSV_SOURCES = ["TV", "HDMI 1", "HDMI 2", "HDMI 3", "Netflix", "YouTube", "Prime Video", "Disney+"]
APP_SOURCES = ("Netflix", "YouTube", "Prime Video", "Disney+")
LG_SOURCES = ["Live TV", "HDMI 1", "HDMI 2", "Netflix", "YouTube", "Web Browser"]
ANDROID_ACTIVITIES = ["https://www.youtube.com", "netflix://", "com.synthetic.player"]
AVR_SOURCES = ["TV Audio", "Bluetooth", "Network"]


def build_world() -> dict[str, Any]:
    """Pure: the registries and the initial model. entities[] carries `state` and the FULL attribute set of the fake device;
    `devices`, `areas` and `floors` are the HA registry listings; `screens` is the summary the specs read."""
    devices: list[dict[str, Any]] = []
    entities: list[dict[str, Any]] = []
    n_reg = [0]

    def device(key: str, name: str, manufacturer: str, model: str, area: str | None, mac: int | None, ident: tuple[str, str] | None, mac_style: str = "colon") -> str:
        did = f"cr015_dev_{key}"
        devices.append({
            "id": did, "name": name, "name_by_user": None, "manufacturer": manufacturer, "model": model, "via_device_id": None, "area_id": area,
            "connections": [["mac", _mac(mac, mac_style)]] if mac is not None else [],
            "identifiers": [list(ident)] if ident else [], "sw_version": "synthetic", "config_entries": [f"cr015_ce_{key}"], "disabled_by": None,
        })
        return did

    def entity(entity_id: str, platform: str, dev: str | None, state: str, attrs: dict[str, Any], unique_id: str | None = None) -> None:
        n_reg[0] += 1
        entities.append({
            "entity_id": entity_id, "id": f"cr015_reg_{n_reg[0]:03d}", "unique_id": unique_id or entity_id.split(".", 1)[1], "platform": platform, "device_id": dev,
            "area_id": None, "config_entry_id": f"cr015_ce_{platform}", "name": None, "original_name": attrs.get("friendly_name"), "disabled_by": None, "hidden_by": None,
            "entity_category": None, "state": state, "attributes": attrs,
        })

    def ssv(slug: str, friendly: str, area: str, mac: int, uuid_n: int, *, ent: str | None = None, source: str = "HDMI 1", volume: float = 0.3) -> tuple[str, str]:
        d = device(f"ssv_{slug}", friendly, "Samsung", "SYNTH-QE55", area, mac, ("samsungtv_smart", f"uuid:{_uuid(uuid_n)}"))
        base = ent or f"{slug}_tv"
        mp, rm = f"media_player.cr015_{base}", f"remote.cr015_{base}"
        entity(mp, "samsungtv_smart", d, "on", {
            "friendly_name": friendly, "device_class": "tv", "supported_features": SSV_FEATURES, "volume_level": volume, "is_volume_muted": False,
            "source": source, "source_list": list(SSV_SOURCES), "app_id": "11101200001" if source == "Netflix" else None, "media_title": source,
            "media_content_type": "app" if source in APP_SOURCES else None, "ip_address": f"192.0.2.{mac + 10}",
        }, unique_id=f"ssv-{base}-0001")
        entity(rm, "samsungtv_smart", d, "on", {"friendly_name": friendly, "supported_features": 0}, unique_id=f"ssv-{base}-remote")
        return mp, rm

    # ---- living: one Samsung, six endpoints (five of them duplicates or siblings)
    living_mp, living_rm = ssv("living", "טלוויזיה סלון", "cr015_living", 1, 1, source="Netflix", volume=0.32)
    d_st = device("st_living", "Samsung living (SmartThings)", "Samsung", "SYNTH-QE55", "cr015_living", 1, ("smartthings", "00000000-0000-4000-8000-5700000000a1"), mac_style="dash_upper")
    entity("media_player.cr015_living_tv_st", "smartthings", d_st, "on", {
        "friendly_name": "טלוויזיה סלון (ST)", "supported_features": SMARTTHINGS_FEATURES, "volume_level": 0.32, "is_volume_muted": False, "source": "HDMI1", "source_list": ["TV", "HDMI1", "HDMI2"],
    })
    d_cast = device("cast_living", "Cast living", "Samsung", "SYNTH-QE55", "cr015_living", None, ("cast", _uuid(1, upper=True)))
    entity("media_player.cr015_living_tv_cast", "cast", d_cast, "playing", {
        "friendly_name": "טלוויזיה סלון (Cast)", "supported_features": CAST_FEATURES, "app_name": "Netflix", "media_title": "סדרה לדוגמה", "media_content_type": "tvshow",
        "media_duration": 3120, "media_position": 1520, "media_position_updated_at": "2026-09-30T18:02:11+00:00", "volume_level": 0.32, "is_volume_muted": False,
        "entity_picture": "/api/media_player_proxy/media_player.cr015_living_tv_cast?token=SYNTHETIC&cache=1",
    })
    d_dlna = device("dlna_living", "Samsung living (DLNA)", "Samsung", "SYNTH-QE55", "cr015_living", 1, ("dlna_dmr", f"uuid:{_uuid(7)}"))
    entity("media_player.cr015_living_tv_dlna", "dlna_dmr", d_dlna, "on", {
        "friendly_name": "טלוויזיה סלון (DLNA)", "supported_features": DLNA_FEATURES, "volume_level": 0.32, "is_volume_muted": False,
    })
    d_ma = device("ma_living", "Living (Music Assistant)", "Music Assistant", "Universal Player", None, None, ("music_assistant", living_mp))
    entity("media_player.cr015_living_tv_ma", "music_assistant", d_ma, "idle", {
        "friendly_name": "טלוויזיה סלון (MA)", "device_class": "speaker", "supported_features": MA_FEATURES, "mass_player_type": "player", "active_queue": living_mp, "volume_level": 0.32,
    }, unique_id=living_mp)

    # ---- kitchen: a second Samsung, same platform and model, another HA device: never merged
    ssv("kitchen", "טלוויזיה מטבח", "cr015_kitchen", 2, 2, source="HDMI 1", volume=0.2)

    # ---- bedroom: LG with a turn-on automation
    d = device("lg_bedroom", "טלוויזיה חדר שינה", "LG", "SYNTH-OLED", "cr015_bedroom", 3, ("webostv", _uuid(3)))
    entity("media_player.cr015_bedroom_tv", "webostv", d, "on", {
        "friendly_name": "טלוויזיה חדר שינה", "device_class": "tv", "supported_features": LG_FEATURES | VOLUME_SET | TURN_ON, "volume_level": 0.25, "is_volume_muted": False,
        "source": "HDMI 2", "source_list": list(LG_SOURCES), "app_id": "com.webos.app.hdmi2", "sound_output": "tv_speaker", "ip_address": "192.0.2.13",
    }, unique_id="lg-bedroom-0001")

    # ---- hall: LG without a turn-on automation, external speaker
    d = device("lg_hall", "טלוויזיה מסדרון", "LG", "SYNTH-OLED", "cr015_hall", 4, ("webostv", _uuid(4)))
    entity("media_player.cr015_hall_tv", "webostv", d, "on", {
        "friendly_name": "טלוויזיה מסדרון", "device_class": "tv", "supported_features": LG_FEATURES, "volume_level": 0.5, "is_volume_muted": False, "source": "Live TV",
        "source_list": list(LG_SOURCES), "app_id": "com.webos.app.livetv", "media_content_type": "channel", "media_channel": "Channel 7", "sound_output": "external_arc", "ip_address": "192.0.2.14",
    }, unique_id="lg-hall-0001")

    # ---- office: Android TV Remote (remote + media_player on one device) + a Cast entity on another device (same MAC)
    d = device("atv_office", "טלוויזיה משרד", "Synthetic", "ATV-4K", "cr015_office", 5, ("androidtv_remote", _uuid(5)))
    entity("remote.cr015_office_tv", "androidtv_remote", d, "on", {
        "friendly_name": "טלוויזיה משרד", "supported_features": ACTIVITY, "activity_list": list(ANDROID_ACTIVITIES), "current_activity": ANDROID_ACTIVITIES[0],
    }, unique_id="atv-office-remote")
    entity("media_player.cr015_office_tv", "androidtv_remote", d, "on", {
        "friendly_name": "טלוויזיה משרד", "supported_features": ANDROID_FEATURES, "volume_level": 0.4, "is_volume_muted": False, "app_id": "com.synthetic.video", "app_name": "YouTube",
    }, unique_id="atv-office-media")
    d_ocast = device("cast_office", "Cast office", "Synthetic", "ATV-4K", "cr015_office", 5, ("cast", _uuid(15)))
    entity("media_player.cr015_office_tv_cast", "cast", d_ocast, "playing", {
        "friendly_name": "טלוויזיה משרד (Cast)", "supported_features": CAST_FEATURES, "app_name": "YouTube", "media_title": "סרטון לדוגמה", "media_content_type": "video",
        "media_duration": 1800, "media_position": 420, "media_position_updated_at": "2026-09-30T18:05:00+00:00", "volume_level": 0.4, "is_volume_muted": False,
        "entity_picture": "/api/media_player_proxy/media_player.cr015_office_tv_cast?token=SYNTHETIC&cache=2",
    })

    # ---- lobby: Cast only, a display (generic profile)
    d = device("cast_lobby", "מסך לובי", "Synthetic", "DISPLAY-43", "cr015_lobby", 6, ("cast", _uuid(6)))
    entity("media_player.cr015_lobby_display", "cast", d, "playing", {
        "friendly_name": "מסך לובי", "device_class": "tv", "supported_features": CAST_FEATURES, "app_name": "Dashboard", "media_title": "לוח מודעות לדוגמה", "media_content_type": "video",
        "volume_level": 0.2, "is_volume_muted": False,
    })

    # ---- lounge: the stuck TV (accepts everything, reports nothing)
    stuck_mp, stuck_rm = ssv("lounge", "טלוויזיה פינת מנוחה", "cr015_lounge", 7, 8, ent="lounge_stuck", source="HDMI 2", volume=0.3)

    # ---- the living room amplifier (a receiver) with its own Cast entity on another device, same MAC
    d = device("avr_living", "מגבר סלון", "Synthetic", "AVR-X", "cr015_living", 8, ("denonavr", _uuid(9)))
    entity("media_player.cr015_avr_living", "denonavr", d, "on", {
        "friendly_name": "מגבר סלון", "device_class": "receiver", "supported_features": AVR_FEATURES, "volume_level": 0.4, "is_volume_muted": False, "source": "TV Audio",
        "source_list": list(AVR_SOURCES), "sound_mode": "Stereo", "sound_mode_list": ["Stereo", "Movie"],
    }, unique_id="avr-living-0001")
    d_acast = device("cast_avr_living", "Cast amplifier living", "Synthetic", "AVR-X", "cr015_living", 8, ("cast", _uuid(19)))
    entity("media_player.cr015_avr_living_cast", "cast", d_acast, "idle", {
        "friendly_name": "מגבר סלון (Cast)", "supported_features": CAST_FEATURES, "volume_level": 0.4, "is_volume_muted": False,
    })

    # ---- a speaker (not a screen)
    d = device("cast_kitchen_speaker", "Cast kitchen speaker", "Synthetic", "SPEAKER-MINI", "cr015_kitchen", 9, ("cast", _uuid(25)))
    entity("media_player.cr015_kitchen_speaker", "cast", d, "idle", {
        "friendly_name": "רמקול מטבח", "device_class": "speaker", "supported_features": CAST_FEATURES, "volume_level": 0.1, "is_volume_muted": False,
    })

    screens = {
        "living": {"name": "טלוויזיה סלון", "profile": "samsung_smart", "floor_id": "cr015_ground", "area_id": "cr015_living", "vendor": living_mp, "remote": living_rm,
                   "duplicates": ["media_player.cr015_living_tv_st", "media_player.cr015_living_tv_cast", "media_player.cr015_living_tv_dlna", "media_player.cr015_living_tv_ma"], "receiver": "avr_living"},
        "kitchen": {"name": "טלוויזיה מטבח", "profile": "samsung_smart", "floor_id": "cr015_ground", "area_id": "cr015_kitchen", "vendor": "media_player.cr015_kitchen_tv", "remote": "remote.cr015_kitchen_tv", "duplicates": []},
        "bedroom": {"name": "טלוויזיה חדר שינה", "profile": "lg_webos", "floor_id": "cr015_upper", "area_id": "cr015_bedroom", "vendor": "media_player.cr015_bedroom_tv", "remote": None, "duplicates": [], "turn_on": True, "sound_output": "tv_speaker"},
        "hall": {"name": "טלוויזיה מסדרון", "profile": "lg_webos", "floor_id": "cr015_upper", "area_id": "cr015_hall", "vendor": "media_player.cr015_hall_tv", "remote": None, "duplicates": [], "turn_on": False, "sound_output": "external_arc"},
        "office": {"name": "טלוויזיה משרד", "profile": "android_tv", "floor_id": "cr015_upper", "area_id": "cr015_office", "vendor": "media_player.cr015_office_tv", "remote": "remote.cr015_office_tv", "duplicates": ["media_player.cr015_office_tv_cast"]},
        "lobby": {"name": "מסך לובי", "profile": "generic", "floor_id": "cr015_ground", "area_id": "cr015_lobby", "vendor": "media_player.cr015_lobby_display", "remote": None, "duplicates": []},
        "lounge": {"name": "טלוויזיה פינת מנוחה", "profile": "samsung_smart", "floor_id": "cr015_upper", "area_id": "cr015_lounge", "vendor": stuck_mp, "remote": stuck_rm, "duplicates": [], "stuck": True},
    }
    return {
        "floors": copy.deepcopy(FLOORS), "areas": copy.deepcopy(AREAS), "devices": devices, "entities": entities, "screens": screens,
        "receivers": {"avr_living": {"name": "מגבר סלון", "vendor": "media_player.cr015_avr_living", "duplicates": ["media_player.cr015_avr_living_cast"], "area_id": "cr015_living"}},
        "speakers": {"kitchen": {"name": "רמקול מטבח", "entity": "media_player.cr015_kitchen_speaker", "area_id": "cr015_kitchen"}},
        "expect": {"screens": len(screens), "entities": len(entities), "devices": len(devices)},
    }


def registry_rows(world: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """(entity registry rows, device registry rows) as Home Assistant lists them - without the fixture's own state fields."""
    ents = [{k: v for k, v in e.items() if k not in ("state", "attributes")} for e in world["entities"]]
    return ents, copy.deepcopy(world["devices"])


def summary_of(world: dict[str, Any]) -> dict[str, Any]:
    return {k: world[k] for k in ("floors", "areas", "screens", "receivers", "speakers", "expect")} | {"keys": KEY_TABLES}


# ------------------------------------------------------------------------------------------------ the model and the bridge


def _eval_set(node: ast.AST, env: dict[str, Any]) -> Any:
    """A tiny evaluator for the bridge's allow-list: set / tuple / frozenset literals, `|` unions and names of earlier module-level
    constants (bridge 0.4.0 may split the list into groups). Anything else is an error: the bridge is read, never imported."""
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.BitOr):
        return _eval_set(node.left, env) | _eval_set(node.right, env)
    if isinstance(node, ast.Name) and node.id in env:
        return env[node.id]
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in ("set", "frozenset") and len(node.args) <= 1:
        return set(_eval_set(node.args[0], env)) if node.args else set()
    if isinstance(node, (ast.Set, ast.List, ast.Tuple)):
        try:
            return ast.literal_eval(node)
        except ValueError:
            items = [_eval_set(e, env) for e in node.elts]
            return set(items) if isinstance(node, ast.Set) else items if isinstance(node, ast.List) else tuple(items)
    return ast.literal_eval(node)


def parse_allowed(source: str) -> set[tuple[str, str]]:
    """ALLOWED_SERVICES of a bridge `__init__.py` source, without importing it (it needs Home Assistant)."""
    env: dict[str, Any] = {}
    for node in ast.parse(source).body:
        targets: list[ast.expr] = []
        value: ast.AST | None = None
        if isinstance(node, ast.Assign):
            targets, value = list(node.targets), node.value
        elif isinstance(node, ast.AnnAssign) and node.value is not None:
            targets, value = [node.target], node.value
        if value is None:
            continue
        for t in targets:
            if isinstance(t, ast.Name) and t.id.isupper():
                try:
                    env[t.id] = _eval_set(value, env)
                except (ValueError, TypeError, SyntaxError):
                    continue  # an unrelated constant the evaluator does not understand
    if "ALLOWED_SERVICES" not in env:
        raise SystemExit("media_fake_ha: ALLOWED_SERVICES not found in the bridge integration")
    return {tuple(x) for x in env["ALLOWED_SERVICES"]}  # type: ignore[misc]


def _bridge_allowed() -> set[tuple[str, str]]:
    return parse_allowed(BRIDGE_INIT.read_text(encoding="utf-8"))


class Refused(Exception):
    """A call the fake bridge / Home Assistant answers {ok: false, error: <code>} to."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def _slim(attrs: dict[str, Any]) -> dict[str, Any]:
    """What Home Assistant keeps of an entity's attributes while it is unavailable or unknown: the capability ones only."""
    keep = {k: attrs[k] for k in ("friendly_name", "device_class", "icon", "supported_features") if attrs.get(k) is not None}
    return keep


class Model:
    """The fake devices: state + full attributes per entity, the call log and the effect scheduling."""

    def __init__(self) -> None:
        self.lock = threading.RLock()
        self.ents: dict[str, dict[str, Any]] = {}
        self.log: list[dict[str, Any]] = []
        self.n = 0
        self.pending = 0
        self.artwork_calls = 0
        self.effect_delay = float(os.environ.get("SW_FAKE_EFFECT_DELAY", "0.4"))
        self.refuse: str | None = None
        self.bridge_version = os.environ.get("SW_FAKE_BRIDGE_VERSION", "0.4.0")
        self.allowed: set[tuple[str, str]] | None = None

    def load(self, world: dict[str, Any]) -> None:
        with self.lock:
            self.ents = {e["entity_id"]: {"platform": e["platform"], "device_id": e["device_id"], "state": e["state"], "attrs": copy.deepcopy(e["attributes"])} for e in world["entities"]}
            self.log.clear()

    def payload(self, entity_id: str) -> dict[str, Any]:
        """The state as Home Assistant reports it (unavailable / unknown keep only the capability attributes)."""
        with self.lock:
            e = self.ents[entity_id]
            attrs = e["attrs"] if e["state"] not in ("unavailable", "unknown") else _slim(e["attrs"])
            return {"entity_id": entity_id, "state": e["state"], "attributes": {k: v for k, v in copy.deepcopy(attrs).items() if v is not None}}

    def payloads(self) -> list[dict[str, Any]]:
        with self.lock:
            return [self.payload(eid) for eid in self.ents]

    # ---------------------------------------------------------------- the bridge's independent media policy (bridge 0.4.0, media_policy.py)

    def _profile(self, entity_id: str) -> str | None:
        e = self.ents.get(entity_id)
        return PLATFORM_PROFILE.get(e["platform"]) if e else None

    def policy(self, domain: str, service: str, data: dict[str, Any]) -> dict[str, Any]:
        """Re-validates a media call; raises Refused(code); returns the log descriptor {kind, ...}."""
        eid = str(data.get("entity_id", ""))
        ent = self.ents.get(eid)
        if domain == "media_player" and service == "play_media":
            ctype, cid = data.get("media_content_type"), data.get("media_content_id")
            if ctype == "send_key":
                if not isinstance(cid, str) or not re.fullmatch(r"KEY_[A-Z0-9_]{1,24}", cid):
                    raise Refused("media_key_invalid")
                if POWER_CODE.search(cid):
                    raise Refused("media_power_key")
                if self._profile(eid) != "samsung_smart" or cid not in SAMSUNG_KEYS.values():
                    raise Refused("media_key_not_allowed")
                return {"kind": "key", "code": cid}
            if ctype == "send_text":
                self._text_ok(cid)
                return {"kind": "text", "text": cid}
            raise Refused("media_type_not_allowed")
        if domain == "webostv" and service == "button":
            btn = data.get("button")
            if not isinstance(btn, str) or POWER_CODE.search(btn):
                raise Refused("media_power_key")
            if self._profile(eid) != "lg_webos" or btn not in LG_KEYS.values():
                raise Refused("media_key_not_allowed")
            return {"kind": "key", "code": btn}
        if domain == "webostv" and service == "select_sound_output":
            out = data.get("sound_output")
            if not isinstance(out, str) or not (1 <= len(out) <= 40):
                raise Refused("media_output_invalid")
            return {"kind": "sound_output", "output": out}
        if domain == "webostv":
            raise Refused("media_service_not_allowed")  # webostv.command and friends: never
        if domain == "remote" and service == "send_command":
            cmd = data.get("command")
            if isinstance(cmd, str) and cmd.startswith("text:"):
                self._text_ok(cmd[5:])
                return {"kind": "text", "text": cmd[5:]}
            if not isinstance(cmd, str) or POWER_CODE.search(cmd):
                raise Refused("media_power_key")
            if self._profile(eid) != "android_tv" or cmd not in ANDROID_KEYS.values():
                raise Refused("media_key_not_allowed")
            return {"kind": "key", "code": cmd}
        if domain == "remote" and service == "turn_on":
            activity = data.get("activity")
            if not activity:
                raise Refused("media_activity_required")
            if not ent or activity not in (ent["attrs"].get("activity_list") or []):
                raise Refused("media_activity_unknown")
            return {"kind": "app", "activity": activity}
        if domain == "remote":
            raise Refused("media_service_not_allowed")  # remote.turn_off and the rest
        if domain == "media_player" and service == "select_source":
            src = data.get("source")
            if not ent or src not in (ent["attrs"].get("source_list") or []):
                raise Refused("media_source_unknown")
            return {"kind": "source", "source": src}
        if domain == "media_player" and service in ("turn_on", "turn_off"):
            return {"kind": "power"}
        if domain == "media_player" and service in ("volume_set", "volume_up", "volume_down", "volume_mute"):
            return {"kind": "volume"}
        if domain == "media_player":
            return {"kind": "transport"}
        return {"kind": "other"}

    @staticmethod
    def _text_ok(text: Any) -> None:
        if not isinstance(text, str) or not (1 <= len(text) <= TEXT_MAX) or CONTROL_CHARS.search(text):
            raise Refused("media_text_invalid")

    # ---------------------------------------------------------------- Home Assistant's own behaviour

    def effect(self, domain: str, service: str, data: dict[str, Any]) -> list[str]:
        """Checks support like Home Assistant (HomeAssistantError) and returns the entity ids whose state changed. Mutates the model."""
        eid = str(data.get("entity_id", ""))
        e = self.ents.get(eid)
        if e is None:
            raise Refused("entity_not_found")
        a = e["attrs"]
        feat = int(a.get("supported_features") or 0)
        if e["state"] in ("unavailable", "unknown"):
            raise Refused("HomeAssistantError")  # "Entity is unavailable" / "Device is off and cannot be controlled"
        changed = [eid]

        def need(*bits: int) -> None:
            if not any(feat & b for b in bits):
                raise Refused("HomeAssistantError")  # the entity does not support this service

        if domain == "media_player":
            if service == "turn_on":
                need(TURN_ON)
                e["state"] = "on"
            elif service == "turn_off":
                need(TURN_OFF)
                e["state"] = "off"
            elif service in ("volume_up", "volume_down"):
                need(VOLUME_STEP)
                lvl = float(a.get("volume_level") or 0) + (0.02 if service == "volume_up" else -0.02)
                a["volume_level"] = round(min(1.0, max(0.0, lvl)), 2)
            elif service == "volume_set":
                need(VOLUME_SET)
                a["volume_level"] = float(data["volume_level"])
            elif service == "volume_mute":
                need(VOLUME_MUTE)
                a["is_volume_muted"] = bool(data["is_volume_muted"])
            elif service == "media_play":
                need(PLAY)
                e["state"] = "playing"
            elif service == "media_pause":
                need(PAUSE)
                e["state"] = "paused"
            elif service == "media_stop":
                need(STOP)
                e["state"] = "idle"
            elif service == "media_play_pause":
                need(PLAY, PAUSE)
                e["state"] = "paused" if e["state"] == "playing" else "playing"
            elif service in ("media_next_track", "media_previous_track"):
                need(NEXT_TRACK if service == "media_next_track" else PREVIOUS_TRACK)
                return []  # nothing observable in this fake
            elif service == "select_source":
                need(SELECT_SOURCE)
                a["source"] = data["source"]
                is_app = data["source"] in APP_SOURCES
                a["app_id"] = f"synthetic.{data['source'].lower().replace(' ', '_')}" if is_app else None
                a["media_content_type"] = "app" if is_app else None
                a["media_title"] = data["source"]
            elif service == "play_media":
                need(PLAY_MEDIA)
                return []  # send_key / send_text: no observable effect
            else:
                return []
        elif domain == "remote" and service == "turn_on":
            a["current_activity"] = data["activity"]
            sibling = next((k for k, v in self.ents.items() if v["device_id"] == e["device_id"] and k.startswith("media_player.")), None)
            if sibling:  # the paired media_player of the same device follows the activity
                self.ents[sibling]["attrs"]["app_id"] = data["activity"]
                changed.append(sibling)
        elif domain == "webostv" and service == "select_sound_output":
            out = str(data["sound_output"])
            a["sound_output"] = out
            # LG: VOLUME_SET disappears with an external speaker (TV notes 3.2)
            a["supported_features"] = (feat & ~VOLUME_SET) if out.startswith("external") else (feat | VOLUME_SET)
        else:
            return []  # keys (remote.send_command, webostv.button): no observable effect
        return changed


MODEL = Model()


# ------------------------------------------------------------------------------------------------ execute (the fake bridge)


def _log(domain: str, service: str, data: dict[str, Any], desc: dict[str, Any] | None, result: str, scheduled: bool) -> dict[str, Any]:
    with MODEL.lock:
        MODEL.n += 1
        entry: dict[str, Any] = {"n": MODEL.n, "at": time.strftime("%H:%M:%S"), "domain": domain, "service": service, "entity_id": data.get("entity_id"),
                                 "kind": (desc or {}).get("kind", "other"), "result": result, "effect": scheduled}
        for k in ("code", "text", "source", "activity", "output"):
            if desc and k in desc:
                entry[k] = desc[k]
        for k in ("volume_level", "is_volume_muted"):
            if k in data:
                entry[k] = data[k]
        MODEL.log.append(entry)
        return entry


def execute(body: dict[str, Any]) -> dict[str, Any]:
    """POST /api/services/smplwise_bridge/execute: returns the service_response."""
    domain, service, data = str(body.get("domain")), str(body.get("service")), dict(body.get("data") or {})
    data.pop("code", None)  # never keep a code (nothing here sends one)
    if MODEL.allowed is None:
        MODEL.allowed = _bridge_allowed()
    if MODEL.refuse:
        _log(domain, service, data, None, MODEL.refuse, False)
        return {"ok": False, "error": MODEL.refuse}
    if (domain, service) not in MODEL.allowed:
        _log(domain, service, data, None, "service_not_allowed", False)
        return {"ok": False, "error": "service_not_allowed"}
    if not data.get("entity_id"):
        _log(domain, service, data, None, "entity_required", False)
        return {"ok": False, "error": "entity_required"}
    desc: dict[str, Any] | None = None
    try:
        with MODEL.lock:
            if str(data["entity_id"]) not in MODEL.ents:
                raise Refused("entity_not_found")
            desc = MODEL.policy(domain, service, data)
            # a stuck entity accepts everything Home Assistant would accept and reports nothing
            changed = [] if "_stuck" in str(data["entity_id"]) else MODEL.effect(domain, service, data)
            if changed:
                MODEL.pending += 1
    except Refused as exc:
        _log(domain, service, data, desc, exc.code, False)
        return {"ok": False, "error": exc.code}
    _log(domain, service, data, desc, "ok", bool(changed))
    if changed:
        threading.Timer(MODEL.effect_delay, _push, args=(changed,)).start()
    return {"ok": True, "context_id": "fake-context"}


def _push(entity_ids: list[str]) -> None:
    """Pushes the changed entities through the backend's own developer states endpoint (the sync's upsert and /ha/ws push)."""
    import httpx

    try:
        states = [MODEL.payload(eid) for eid in entity_ids]
        with httpx.Client(timeout=10) as c:
            c.post(f"{BASE}/ha/dev/states", json={"states": states})
    except Exception as exc:  # noqa: BLE001
        print(f"media_fake_ha: could not push {entity_ids}: {type(exc).__name__}", flush=True)
    finally:
        with MODEL.lock:
            MODEL.pending = max(0, MODEL.pending - 1)


def artwork_bytes(entity: str) -> tuple[bytes, str]:
    """The fake host's answer to the Cast entity's `entity_picture`: a generated JPEG (a tiny PNG when PIL is missing)."""
    try:
        import io

        from PIL import Image, ImageDraw

        hue = sum(entity.encode()) % 200
        im = Image.new("RGB", (320, 180), (60 + hue // 2, 70 + hue // 3, 150))
        ImageDraw.Draw(im).rectangle([20, 20, 300, 160], outline=(255, 255, 255), width=3)
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=70)
        return buf.getvalue(), "image/jpeg"
    except Exception:  # noqa: BLE001
        import base64

        return base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=="), "image/png"


# ------------------------------------------------------------------------------------------------ Home Assistant over HTTP / WebSocket


class _World:
    """Home Assistant's registries as the fake WebSocket tells them (the devices_fake_ha.py pattern)."""

    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.entities: list[dict[str, Any]] = []
        self.devices: list[dict[str, Any]] = []
        self.areas: list[dict[str, Any]] = []
        self.floors: list[dict[str, Any]] = []
        self.sockets: list[_FakeSocket] = []

    def listing(self, kind: str) -> list[dict[str, Any]]:
        with self.lock:
            return json.loads(json.dumps(getattr(self, kind)))

    def emit(self, event_type: str, data: dict[str, Any]) -> int:
        with self.lock:
            sockets = list(self.sockets)
        return sum(s.deliver(event_type, data) for s in sockets)


WORLD = _World()


class _FakeSocket:
    """The HA WebSocket API as the sync uses it: auth, get_config, get_states, subscribe_events and the four registry listings."""

    def __init__(self) -> None:
        self.inbox: asyncio.Queue[str] = asyncio.Queue()
        self.loop = asyncio.get_running_loop()
        self.subs: dict[int, str] = {}

    async def __aenter__(self) -> "_FakeSocket":
        self.inbox.put_nowait(json.dumps({"type": "auth_required", "ha_version": "fake"}))
        with WORLD.lock:
            WORLD.sockets.append(self)
        return self

    async def __aexit__(self, *_exc: Any) -> None:
        with WORLD.lock:
            if self in WORLD.sockets:
                WORLD.sockets.remove(self)

    async def send(self, raw: str) -> None:
        msg = json.loads(raw)
        if msg.get("type") == "auth":
            self.inbox.put_nowait(json.dumps({"type": "auth_ok", "ha_version": "fake"}))
            return
        mid, kind = msg.get("id"), msg.get("type")
        listings = {"config/entity_registry/list": "entities", "config/device_registry/list": "devices", "config/area_registry/list": "areas", "config/floor_registry/list": "floors"}
        if kind == "get_config":
            result: Any = {"version": "fake-2026.9"}
        elif kind == "get_states":
            result = []  # the fixture seeds states through /ha/dev/states (POST /seed-media)
        elif kind == "subscribe_events":
            self.subs[mid] = msg.get("event_type") or "*"
            result = None
        elif kind in listings:
            result = WORLD.listing(listings[kind])
        else:
            self.inbox.put_nowait(json.dumps({"id": mid, "type": "result", "success": False, "error": {"code": "unknown_command"}}))
            return
        self.inbox.put_nowait(json.dumps({"id": mid, "type": "result", "success": True, "result": result}))

    def deliver(self, event_type: str, data: dict[str, Any]) -> int:
        n = 0
        for sid, et in self.subs.items():
            if et in (event_type, "*"):
                frame = json.dumps({"id": sid, "type": "event", "event": {"event_type": event_type, "data": data}})
                self.loop.call_soon_threadsafe(self.inbox.put_nowait, frame)
                n += 1
        return n

    async def recv(self) -> str:
        return await self.inbox.get()

    def __aiter__(self) -> "_FakeSocket":
        return self

    async def __anext__(self) -> str:
        return await self.inbox.get()


def install() -> None:
    """The process-wide fakes: HA_URL on a reserved host, the REST answers, the HA WebSocket. Only `main()` calls this, so the
    module can be imported (by the tests) without any side effect."""
    if os.environ.get("SUPERVISOR_TOKEN"):
        sys.exit("media_fake_ha: refusing to run inside the Home Assistant add-on")
    sys.path.insert(0, str(ROOT / "smplwise_vms" / "backend"))
    os.environ["HA_URL"] = f"http://{FAKE_HOST}:8123"
    os.environ["HA_TOKEN"] = "fake-fixture-token"
    import httpx
    import websockets

    real_handle = httpx.HTTPTransport.handle_request

    def handle_request(self: Any, request: Any) -> Any:
        if request.url.host == FAKE_HOST:
            path = request.url.path
            if request.method == "POST" and path == "/api/services/smplwise_bridge/execute":
                body = json.loads(request.content or b"{}")
                return httpx.Response(200, json={"service_response": execute(body)}, request=request)
            if request.method == "POST" and path == "/api/services/smplwise_bridge/set_entity_area":
                body = json.loads(request.content or b"{}")
                return httpx.Response(200, json={"service_response": {"ok": True, "context_id": None, "request_id": body.get("request_id")}}, request=request)
            if request.method == "GET" and path.startswith("/api/media_player_proxy/"):
                with MODEL.lock:
                    MODEL.artwork_calls += 1
                raw, ctype = artwork_bytes(path.rsplit("/", 1)[-1])
                return httpx.Response(200, content=raw, headers={"Content-Type": ctype}, request=request)
            raise httpx.ConnectError(f"media_fake_ha: no answer for {path}", request=request)
        return real_handle(self, request)

    httpx.HTTPTransport.handle_request = handle_request  # type: ignore[method-assign]

    def connect(url: str, **_kw: Any) -> Any:
        if threading.current_thread().name == "ha-sync":  # only the HA sync gets the fake Home Assistant
            return _FakeSocket()
        raise OSError(f"media_fake_ha: no Home Assistant WebSocket here ({url})")

    websockets.connect = connect  # type: ignore[assignment]

    from smplwise.services import ha_client

    real_maps = ha_client.registry_maps

    def registry_maps(entities: list[dict[str, Any]], devices: list[dict[str, Any]], areas: list[dict[str, Any]], floors: list[dict[str, Any]]) -> dict[str, Any]:
        """Every registry the backend maps becomes the fake HA's registry (the dev seed sets it, the sync's own refresh maps what the fake listed)."""
        with WORLD.lock:
            WORLD.entities, WORLD.devices = json.loads(json.dumps(entities)), json.loads(json.dumps(devices))
            WORLD.areas, WORLD.floors = json.loads(json.dumps(areas)), json.loads(json.dumps(floors))
        return real_maps(entities, devices, areas, floors)

    ha_client.registry_maps = registry_maps  # type: ignore[assignment]


# ------------------------------------------------------------------------------------------------ the control server


def ping(version: str) -> int:
    """The integration's signed ping with the given bridge version; returns the HTTP status."""
    import httpx

    from smplwise.services import ha_bridge

    with httpx.Client(timeout=10) as c:
        r = c.get(f"{BASE}/ha/bridge/pairing")
        if r.status_code != 200:
            return r.status_code
        code = r.json()["pairing_code"]
        return c.post(f"{BASE}/ha/bridge/ping", json=ha_bridge.sign(code, {"version": version})).status_code


def seed() -> dict[str, Any]:
    """Seeds the synthetic house: the dev registry route (entities, devices, areas, floors), the states, the fake WebSocket's
    registries; then a registry-updated event, which the real sync debounces into one refresh (it lists the registries over
    the WebSocket, devices with their connections and identifiers included)."""
    import httpx

    world = build_world()
    MODEL.load(world)
    ents, devs = registry_rows(world)
    with httpx.Client(timeout=60) as c:
        registry_ok = c.post(f"{BASE}/ha/dev/registry", json={"entities": ents, "devices": devs, "areas": world["areas"], "floors": world["floors"]}).status_code == 200
        states = MODEL.payloads()
        states_ok = True
        for i in range(0, len(states), 40):
            states_ok &= c.post(f"{BASE}/ha/dev/states", json={"states": states[i : i + 40]}).status_code == 200
    with WORLD.lock:  # make sure the fake WebSocket serves exactly this, whatever a mapping wrapper did
        WORLD.entities, WORLD.devices, WORLD.areas, WORLD.floors = copy.deepcopy(ents), copy.deepcopy(devs), copy.deepcopy(world["areas"]), copy.deepcopy(world["floors"])
    delivered = WORLD.emit("device_registry_updated", {"action": "update", "device_id": devs[0]["id"]})
    return summary_of(world) | {"registry_ok": registry_ok, "states_ok": states_ok, "registry_events": delivered}


class _Control(BaseHTTPRequestHandler):
    def log_message(self, *_args: Any) -> None:
        return

    def _reply(self, code: int, body: dict[str, Any]) -> None:
        raw = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self) -> None:  # noqa: N802
        url = urlsplit(self.path)
        if url.path == "/media-log":
            since = int((parse_qs(url.query).get("since") or ["0"])[0])
            with MODEL.lock:
                self._reply(200, {"entries": [e for e in MODEL.log if e["n"] > since], "next": MODEL.n, "pending": MODEL.pending})
            return
        if url.path == "/world":
            self._reply(200, summary_of(build_world()))
            return
        with WORLD.lock:
            sockets = len(WORLD.sockets)
        self._reply(200, {"sockets": sockets, "calls": MODEL.n, "pending": MODEL.pending, "bridge_version": MODEL.bridge_version, "effect_delay": MODEL.effect_delay,
                          "refuse": MODEL.refuse, "entities": len(MODEL.ents), "artwork_fetches": MODEL.artwork_calls})

    def do_POST(self) -> None:  # noqa: N802
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"{}")
        path = urlsplit(self.path).path
        if path == "/seed-media":
            self._reply(200, seed())
        elif path == "/media-log/reset":
            with MODEL.lock:
                MODEL.log.clear()
            self._reply(200, {"ok": True, "next": MODEL.n})
        elif path == "/media-set":
            self._reply(*set_entity(body))
        elif path == "/media-config":
            status = None
            if "effect_delay" in body:
                MODEL.effect_delay = float(body["effect_delay"])
            if "refuse" in body:
                MODEL.refuse = body["refuse"] or None
            if isinstance(body.get("bridge_version"), str):
                MODEL.bridge_version = body["bridge_version"]
                status = ping(MODEL.bridge_version)
            self._reply(200, {"ok": True, "bridge_version": MODEL.bridge_version, "ping": status, "effect_delay": MODEL.effect_delay, "refuse": MODEL.refuse})
        else:
            self._reply(404, {"error": "unknown"})


def set_entity(body: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    """A device changes on its own (someone used the TV's own remote, the TV lost power, the network dropped)."""
    import httpx

    eid = str(body.get("entity_id"))
    with MODEL.lock:
        e = MODEL.ents.get(eid)
        if e is None:
            return 404, {"error": "unknown_entity"}
        if isinstance(body.get("state"), str):
            e["state"] = body["state"]
        attrs = body.get("attributes")
        if isinstance(attrs, dict):
            if body.get("merge", True):
                e["attrs"].update(attrs)
            else:
                e["attrs"] = dict(attrs)
        payload = MODEL.payload(eid)
    with httpx.Client(timeout=10) as c:
        r = c.post(f"{BASE}/ha/dev/states", json={"states": [payload]})
    return 200, {"ok": r.status_code == 200, "state": payload["state"]}


def _serve_control() -> None:
    port = int(os.environ.get("SW_FAKE_HA_CONTROL_PORT", str(PORT + 1)))
    server = ThreadingHTTPServer(("127.0.0.1", port), _Control)
    print(f"media_fake_ha: fake Home Assistant control on http://127.0.0.1:{port}", flush=True)
    server.serve_forever()


def _pair() -> None:
    for _ in range(120):
        try:
            if ping(MODEL.bridge_version) == 200:
                print(f"media_fake_ha: bridge paired (version {MODEL.bridge_version})", flush=True)
                return
        except Exception:  # noqa: BLE001 - the backend is not up yet
            pass
        time.sleep(0.5)
    print("media_fake_ha: the backend never came up; bridge not paired", flush=True)


def main() -> None:
    install()
    MODEL.allowed = _bridge_allowed()
    threading.Thread(target=_pair, name="media-fixture-pair", daemon=True).start()
    threading.Thread(target=_serve_control, name="media-fixture-control", daemon=True).start()
    n_media = sum(1 for d, _s in MODEL.allowed if d in ("media_player", "remote", "webostv"))
    print(f"media_fake_ha: fake bridge for {len(MODEL.allowed)} allow-listed services ({n_media} media); backend on {BASE}", flush=True)
    from smplwise.__main__ import main as serve

    serve()


if __name__ == "__main__":
    main()
