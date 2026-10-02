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

CR-016 (S4, multimedia phase 2) adds TWO more fixture houses next to the TV house above, mirroring the three read-only probes of
2026-10-01 (docs/research/*_MEDIA_PROBE_2026-10-01.md; counts and shapes only - everything here is synthetic, `cr016_` ids,
Hebrew display names, MACs `02:00:00:c0:15:xx`, addresses 192.0.2.0/24, UUIDs `00000000-0000-4000-8000-c016xxxxxxxx`). A house is
chosen at seed time (POST /seed-media {"house": "tv" | "ma" | "sonos"}, or SW_FAKE_HOUSE for the default); each house is meant for
its own throwaway backend (its floors and areas replace the registry of the previous one, the backend's own tables keep old rows):

  "ma"     the Music Assistant house (probes H + V): 35 entities on 33 HA devices, 2 floors. WiiM x4, each wiim + cast + MA (the MA id
           EMBEDS the WiiM id: rung 2c; the cast device only shares manufacturer + model: rung 3b; the living room and kitchen cast
           entities are hidden by the user); a Google-style Cast + MA pair (shortened Cast model) and a second one whose MA entity
           refuses to join; two Denon receivers (Main + Zone2 on one HA device, a HEOS device, an MA twin whose id EQUALS the HEOS
           player id: rung 2b; receiver B's HEOS device carries a different model string, so B stays two clusters without a
           suggestion - the owner links it by hand); three LG-class Cast TVs named by their model number, unavailable because
           they are off, each with an MA twin (two TVs of the SAME model: only suggestions; the third is unique: auto-merge),
           four MA-only players (three `restored`, one really unavailable, all with the degraded feature mask), one static
           MA group. Groups: a live cross-brand MA sync group of four (both receivers + both Google-style speakers) whose
           `group_members` are inconsistent (the leader and one member list all four, the other two list NOTHING, `active_queue`
           of every member is the leader's MA player id); the WiiM living room + kitchen pair grouped in BOTH layers (wiim and MA);
           the WiiM terrace + study pair grouped ONLY in the wiim layer (MA lists them ungrouped: "קיבוץ לא תואם"). Four "ungrouped"
           encodings: MA [], wiim [self], heos null, cast / denonavr absent. 7 of the 16 physical devices carry an area.
  "sonos"  the no-MA house (probe K): no floors, no Music Assistant, no `music_assistant` service. Six Sonos speakers (the full
           native music mask, favourites in `source_list`, queue size / position) each with a SmartThings twin of an IDENTICAL name
           and the degraded cloud mask (four twins share the area: suggestions rung 5; one has its area on the Sonos side only:
           rung 5b; the sixth pair has no area anywhere and needs a manual link), two Samsung TVs each with a SmartThings twin
           (manufacturer + model: auto-merge), TEN Jellyfin DLNA sessions (eight share one generic name; nine `restored`; three
           more disabled by their config entry), two HA `group` helper players (a 5-Sonos fan-out, a 2-TV fan-out; no GROUPING,
           no group_members), a Spotify Connect source (`restored`, SELECT_SOURCE only). One Sonos (terrace) refuses to join.

`world["expect"]`, `["clusters"]`, `["suggestions"]`, `["players"]`, `["groups"]` and `["nonphysical"]` declare what a correct model makes of
a house; tests/test_media_fake_ha.py checks them against an INDEPENDENT ladder (rungs 1-4, 2b, 2c, 3b, 5, 5b of CR-016 5.1), and the live
spec carries its own literal copy.

Extra bridge behaviour for bridge 0.5.0 (CR-016 6.3; the allow-list is still read from the real bridge, so before S1 lands the new
services are refused `service_not_allowed` - exactly the drift the fixture exists to show):
- media_seek / shuffle_set / repeat_set (need SEEK / SHUFFLE_SET / REPEAT_SET), join / unjoin (need GROUPING, same platform, available
  members; a member whose id contains `_refuses`, or that is listed in /media-config `join_refuse`, is silently NOT joined: the
  honest read-back is `not_joined`), music_assistant.play_media (type in the five, media id is a library uri - never http(s), file or
  a path - enqueue play / replace / next / replace_next / add) and music_assistant.transfer_queue (both MA entities, the source must
  hold a queue); `media_player.play_media` with `announce` and `music_assistant.play_announcement` are refused (6a).
- group attributes are RENDERED from one model of live groups per layer (ma / wiim / sonos / heos), so a join or an unjoin changes the
  leader and the members in that layer's own encoding, the way the probes saw them (MA: the leader and the first member list all,
  the others []; Sonos / WiiM: every member lists all; HEOS: null when alone). The other layer is NOT touched (that is how a
  "conflict" arises).
- volume and mute follow the entities of the same physical device (`twins`): an MA volume_set moves its WiiM / Cast / HEOS twin too.
- `POST /api/services/smplwise_bridge/media_query` (bridge >= 0.5.0, else HTTP 400 "not found" like a missing service): `queue` and
  `library` with fixed arguments, answered in a TRIMMED shape built from the real HA response shapes of music_assistant.get_queue /
  get_library (`raw_get_queue`, `raw_get_library`, `raw_search`: image URLs, provider mappings, queue item ids, stream details -
  everything the bridge must strip; GET /raw on the control server serves them). An MA entity answers from the fake MA library; a
  Sonos entity without MA answers from its `source_list` (favourites) and its queue attributes; anything else `no_library`; `search`
  is refused `query_not_allowed` (phase 2b) unless /media-config `search_enabled`. The envelope `{ok, request_id, query, provider,
  result}` is an ASSUMPTION until bridge 0.5.0 lands (MEDIA_PLAYERS_API.md does not fix it).
- `smplwise_bridge.set_entity_area` / `entity_area` really moves the entity in the fake registry (entity-level area overrides the
  device's) and tells the backend's sync (entity_registry_updated).

Extra control routes: POST /bridge-exec {domain, service, data}, POST /bridge-query {query, entity_id, ...} and POST /bridge-area {entity_id, area_id} drive the fake bridge as
the add-on would (for specs that test the fixture itself, before S1); GET /raw?service=get_queue|get_library|search&entity_id=...;
POST /media-config also takes `search_enabled`, `query_fail`, `ma_loaded`, `ma_down`, `join_refuse` ([entity ids]), `allow_extra` ([[domain,
service], ...]) and `allow_reset`; GET /status lists `allowed_missing` (bridge 0.5.0 services the real bridge does not allow yet).

CR-016 phase 2b: a fake Music Assistant SERVER on the reserved host `fake-ma.test` (`ma_http` / `ma_rpc`): `GET /info` (schema 28) and the
JSON-RPC `POST /api` with `Authorization: Bearer fake-ma-fixture-token-0001` for exactly the commands the add-on's direct connection may send
(`players/all`, `player_queues/get_active_queue | items | move_item | delete_item | clear`, `music/search`) over the SAME queues the fake HA
reports through get_queue; the playing row and the buffered one refuse edits (MA error 11). `ma_down` makes the host unreachable.

Run it (a fresh data dir each time; ports 4381-4390 are for throwaway backends, 4481-4490 for the CR-016 houses):

    SW_PORT=4481 SW_DATA_DIR=<empty dir> SW_DEV_USER=joni SW_BOOTSTRAP_ADMIN=joni SW_FAKE_HOUSE=ma \
        <venv-python> frontend/tests/fixtures/media_fake_ha.py        (the control server is SW_PORT + 1)

then, from frontend/ (`npm run build` first):

    SW_LIVE=1 SW_MEDIA_FIXTURE=1 SW_API_PORT=4481 SW_BASE_URL=http://127.0.0.1:4191/ \
        npx playwright test tests/evidence-media-live.spec.ts --workers=1                (the TV house: CR-015)
    SW_LIVE=1 SW_MEDIA_FIXTURE=1 SW_HOUSE=ma SW_API_PORT=4481 SW_BASE_URL=http://127.0.0.1:4191/ \
        npx playwright test tests/evidence-media-players-live.spec.ts --workers=1        (the MA house; SW_HOUSE=sonos for the other)
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
CLEAR_PLAYLIST, SHUFFLE_SET, REPEAT_SET, GROUPING, MEDIA_ANNOUNCE, MEDIA_ENQUEUE, SEARCH_MEDIA = 8192, 32768, 262144, 524288, 1048576, 2097152, 4194304

# CR-016: the feature masks the three probes of 2026-10-01 saw (numbers decode to exactly the flags named in the probe reports)
MA_LIVE_MASK = SEARCH_MEDIA | MEDIA_ENQUEUE | MEDIA_ANNOUNCE | GROUPING | REPEAT_SET | BROWSE_MEDIA | SHUFFLE_SET | PLAY | CLEAR_PLAYLIST | STOP | VOLUME_STEP | PLAY_MEDIA | NEXT_TRACK | PREVIOUS_TRACK | VOLUME_MUTE | VOLUME_SET | SEEK | PAUSE  # 8320575
MA_LIVE_SRC_MASK = MA_LIVE_MASK | SELECT_SOURCE                                           # 8322623 (adds a source list)
MA_DEGRADED_MASK = MA_LIVE_MASK & ~(GROUPING | VOLUME_SET | VOLUME_MUTE | VOLUME_STEP)   # 7795251: an unavailable / restored MA player
SONOS_MASK = MA_LIVE_MASK & ~VOLUME_STEP | SELECT_SOURCE                                  # 8321599: the full native music mask, no on/off
ST_SPEAKER_MASK = PAUSE | VOLUME_SET | VOLUME_MUTE | VOLUME_STEP | STOP | PLAY             # 21517: the SmartThings cloud twin of a speaker
ST_TV_MASK = PAUSE | VOLUME_SET | VOLUME_MUTE | PREVIOUS_TRACK | NEXT_TRACK | TURN_ON | TURN_OFF | VOLUME_STEP | SELECT_SOURCE | STOP | PLAY  # 23997
WIIM_MASK = PAUSE | VOLUME_SET | VOLUME_MUTE | PREVIOUS_TRACK | NEXT_TRACK | SELECT_SOURCE | STOP | PLAY | BROWSE_MEDIA | GROUPING  # no PLAY_MEDIA / enqueue / announce
HEOS_MASK = PAUSE | VOLUME_SET | VOLUME_MUTE | PREVIOUS_TRACK | NEXT_TRACK | PLAY_MEDIA | SELECT_SOURCE | STOP | PLAY | BROWSE_MEDIA | SHUFFLE_SET | REPEAT_SET | CLEAR_PLAYLIST | MEDIA_ENQUEUE | GROUPING  # no on/off, announce, search
CAST_AUDIO_MASK = PAUSE | VOLUME_SET | VOLUME_MUTE | TURN_ON | TURN_OFF | PLAY_MEDIA | STOP | PLAY | BROWSE_MEDIA  # no GROUPING, no shuffle / repeat, no source list
CAST_ASLEEP_MASK = TURN_ON | TURN_OFF | PLAY_MEDIA | BROWSE_MEDIA                         # what an unavailable Cast TV keeps
DENON_MAIN_MASK = VOLUME_SET | VOLUME_STEP | VOLUME_MUTE | TURN_ON | TURN_OFF | SELECT_SOURCE | SELECT_SOUND_MODE | PLAY | PAUSE | STOP | PREVIOUS_TRACK | NEXT_TRACK | PLAY_MEDIA
DENON_ZONE2_MASK = VOLUME_SET | VOLUME_STEP | VOLUME_MUTE | TURN_ON | TURN_OFF | SELECT_SOURCE | SELECT_SOUND_MODE  # no transport
HELPER_SPEAKERS_MASK = PAUSE | VOLUME_SET | VOLUME_MUTE | STOP | PLAY | PLAY_MEDIA | MEDIA_ANNOUNCE | MEDIA_ENQUEUE | SHUFFLE_SET | CLEAR_PLAYLIST  # a `group` helper: no GROUPING
HELPER_TVS_MASK = TURN_ON | TURN_OFF | VOLUME_SET | PLAY_MEDIA
JELLYFIN_MASK = PAUSE | SEEK | VOLUME_SET | VOLUME_MUTE | STOP | PLAY | PLAY_MEDIA | BROWSE_MEDIA | SEARCH_MEDIA  # a restored mask
BRIDGE_050_SERVICES = {("media_player", s) for s in ("media_seek", "shuffle_set", "repeat_set", "join", "unjoin", "select_sound_mode")} | {("music_assistant", "play_media"), ("music_assistant", "transfer_queue")}
# (CR-016 6.3 lists the first five and the two music_assistant services; select_sound_mode is the receiver zone's `sound_output` of 3.y - not in 0.4.0)
LAYER_OF = {"music_assistant": "ma", "wiim": "wiim", "sonos": "sonos", "heos": "heos"}  # the platforms whose entities carry the group attributes
NON_PHYSICAL_PLATFORMS = {"jellyfin", "group", "spotify"}  # kinds session / virtual_group / service (CR-016 5.1)
KEEP_NULL = {"group_members"}  # HEOS reports the key with a null value when it is not grouped: the one null the fixture keeps
MEDIA_TYPES = ("track", "album", "artist", "playlist", "radio")

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


def build_world(house: str = "tv") -> dict[str, Any]:
    """Pure: one fixture house - "tv" (CR-015, the default), "ma" or "sonos" (CR-016)."""
    if house == "tv":
        return build_tv_house()
    if house == "ma":
        return build_ma_house()
    if house == "sonos":
        return build_sonos_house()
    raise ValueError(f"unknown fixture house {house!r}")


def build_tv_house() -> dict[str, Any]:
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
        "house": "tv", "floors": copy.deepcopy(FLOORS), "areas": copy.deepcopy(AREAS), "devices": devices, "entities": entities, "screens": screens,
        "receivers": {"avr_living": {"name": "מגבר סלון", "vendor": "media_player.cr015_avr_living", "duplicates": ["media_player.cr015_avr_living_cast"], "area_id": "cr015_living"}},
        "speakers": {"kitchen": {"name": "רמקול מטבח", "entity": "media_player.cr015_kitchen_speaker", "area_id": "cr015_kitchen"}},
        "expect": {"screens": len(screens), "entities": len(entities), "devices": len(devices)},
    }


def registry_rows(world: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """(entity registry rows, device registry rows) as Home Assistant lists them - without the fixture's own state fields."""
    ents = [{k: v for k, v in e.items() if k not in ("state", "attributes")} for e in world["entities"]]
    return ents, copy.deepcopy(world["devices"])


def summary_of(world: dict[str, Any]) -> dict[str, Any]:
    """What the specs read: everything but the raw registry rows and the fake's own model."""
    return {k: v for k, v in world.items() if k not in ("devices", "entities", "model")} | {"keys": KEY_TABLES}


# ------------------------------------------------------------------------------------------------ CR-016: the audio houses

# A tiny synthetic Music Assistant library (what `music_assistant.get_library` / `search` would list). Names are made up.
LIB_TRACKS = [
    {"id": "t1", "name": "שיר לדוגמה א", "artist": "אמן לדוגמה", "album": "אלבום לדוגמה", "duration": 215, "favorite": True},
    {"id": "t2", "name": "שיר לדוגמה ב", "artist": "אמן לדוגמה", "album": "אלבום לדוגמה", "duration": 187, "favorite": True},
    {"id": "t3", "name": "שיר לדוגמה ג", "artist": "אמנית אחרת", "album": "אלבום שני", "duration": 243, "favorite": False},
    {"id": "t4", "name": "שיר לדוגמה ד", "artist": "אמנית אחרת", "album": "אלבום שני", "duration": 201, "favorite": True},
]
LIB_ALBUMS = [
    {"id": "a1", "name": "אלבום לדוגמה", "artist": "אמן לדוגמה", "favorite": True, "tracks": ["t1", "t2"]},
    {"id": "a2", "name": "אלבום שני", "artist": "אמנית אחרת", "favorite": False, "tracks": ["t3", "t4"]},
]
LIB_ARTISTS = [
    {"id": "x1", "name": "אמן לדוגמה", "favorite": True, "tracks": ["t1", "t2"]},
    {"id": "x2", "name": "אמנית אחרת", "favorite": False, "tracks": ["t3", "t4"]},
]
LIB_PLAYLISTS = [
    {"id": "p1", "name": "פלייליסט ערב", "favorite": True, "tracks": ["t1", "t3", "t4"]},
    {"id": "p2", "name": "פלייליסט בוקר", "favorite": True, "tracks": ["t2", "t4"]},
    {"id": "p3", "name": "פלייליסט ישן", "favorite": False, "tracks": ["t1"]},
]
LIB_RADIO = [
    {"id": "r1", "name": "תחנה לדוגמה 1", "favorite": True},
    {"id": "r2", "name": "תחנה לדוגמה 2", "favorite": True},
    {"id": "r3", "name": "תחנה לדוגמה 3", "favorite": False},
]
LIBRARY: dict[str, list[dict[str, Any]]] = {"track": LIB_TRACKS, "album": LIB_ALBUMS, "artist": LIB_ARTISTS, "playlist": LIB_PLAYLISTS, "radio": LIB_RADIO}
SONOS_FAVOURITES = ["תחנת רדיו לדוגמה 1", "תחנת רדיו לדוגמה 2", "פלייליסט ערב", "פלייליסט בוקר", "אלבום לדוגמה", "שיר מועדף"]  # a Sonos entity's source_list (+ inputs)
FAKE_IMAGE_HOST = "http://192.0.2.50:8097"  # what an MA image URL looks like: the bridge must never let it out


def _uuid6(n: int) -> str:
    """Synthetic id of the audio houses: 00000000-0000-4000-8000-c016xxxxxxxx."""
    return f"00000000-0000-4000-8000-c016{n:08x}"


def lib_item(media_type: str, item_id: str) -> dict[str, Any] | None:
    return next((i for i in LIBRARY[media_type] if i["id"] == item_id), None)


def lib_uri(media_type: str, item: dict[str, Any]) -> str:
    return f"library://{media_type}/{item['id']}"


def lib_find(uri: str) -> tuple[str, dict[str, Any]] | None:
    """The library item a `library://<type>/<id>` uri names (the only kind of media id the fake bridge lets through)."""
    m = re.fullmatch(r"library://(track|album|artist|playlist|radio)/([a-z0-9]+)", uri)
    if not m:
        return None
    item = lib_item(m.group(1), m.group(2))
    return (m.group(1), item) if item else None


def lib_tracks(media_type: str, item: dict[str, Any]) -> list[tuple[str, dict[str, Any]]]:
    """The queue entries a library item expands to when played: a track is itself, a station is itself, the rest are their tracks."""
    if media_type in ("track", "radio"):
        return [(media_type, item)]
    return [("track", lib_item("track", t)) for t in item["tracks"]]  # type: ignore[misc]


def _media_attrs(media_type: str, item: dict[str, Any], art_entity: str, cache: int = 1) -> dict[str, Any]:
    """The `media_*` attributes of an entity playing one queue entry (a station has no artist, album, duration or position)."""
    art = f"/api/media_player_proxy/{art_entity}?token=SYNTHETIC&cache={cache}"
    if media_type == "radio":
        return {"media_content_type": "music", "media_title": item["name"], "media_artist": None, "media_album_name": None, "media_duration": None, "media_position": None,
                "media_position_updated_at": None, "entity_picture": art}
    return {"media_content_type": "music", "media_title": item["name"], "media_artist": item["artist"], "media_album_name": item["album"], "media_duration": item["duration"],
            "media_position": 64, "media_position_updated_at": "2026-10-01T18:02:11+00:00", "entity_picture": art}


def render_groups(ents: dict[str, dict[str, Any]], groups: dict[str, list[dict[str, Any]]]) -> set[str]:
    """Writes `group_members` (and for Music Assistant `active_queue`) of every grouping-capable entity from ONE model of the live groups
    per layer - in the layer's own encoding, as the probes saw it - and returns the entities whose attributes changed.
      ma    ungrouped: [] and its own queue; a group: the leader AND THE FIRST MEMBER list [leader, *members], the other members list [];
            every member's `active_queue` is the leader's MA player id (`unique_id`), the leader's and the singles' their own
      wiim / sonos   ungrouped: [self]; a group: every member lists [leader, *members]
      heos  ungrouped: null (the key is present); a group: every member lists [leader, *members]
    cast and denonavr entities never carry the key. An MA entity that is a static group (`mass_player_type: group`) keeps its own list."""
    by_layer = {layer: {g["leader"]: list(g["members"]) for g in lst if g["members"]} for layer, lst in groups.items()}
    member_of = {(layer, m): ld for layer, led in by_layer.items() for ld, mem in led.items() for m in mem}
    changed: set[str] = set()
    for eid, e in ents.items():
        layer = LAYER_OF.get(e["platform"])
        a = e["attrs"]
        if layer is None or a.get("mass_player_type") == "group":
            continue
        leader = eid if eid in by_layer.get(layer, {}) else member_of.get((layer, eid))
        wanted: dict[str, Any]
        if layer == "ma":
            if leader is None:
                wanted = {"group_members": [], "active_queue": e["unique_id"]}
            else:
                mem = by_layer[layer][leader]
                wanted = {"group_members": [leader, *mem] if eid in (leader, mem[0]) else [], "active_queue": ents[leader]["unique_id"]}
        elif layer in ("wiim", "sonos"):
            wanted = {"group_members": [leader, *by_layer[layer][leader]] if leader else [eid]}
        else:  # heos
            wanted = {"group_members": [leader, *by_layer[layer][leader]] if leader else None}
        if any(k not in a or a[k] != v for k, v in wanted.items()):
            a.update(wanted)
            changed.add(eid)
    return changed


class _HB:
    """Builder of an audio house: registry rows + the declarations of what a correct model makes of them."""

    def __init__(self, house: str) -> None:
        self.house = house
        self.devices: list[dict[str, Any]] = []
        self.entities: list[dict[str, Any]] = []
        self.players: dict[str, dict[str, Any]] = {}
        self.clusters: list[list[str]] = []
        self.suggestions: list[dict[str, Any]] = []
        self.nonphysical: list[dict[str, Any]] = []
        self.twins: list[list[str]] = []
        self.groups: dict[str, list[dict[str, Any]]] = {}
        self.group_expect: list[dict[str, Any]] = []
        self.queues: dict[str, dict[str, Any]] = {}
        self._reg = 0

    def device(self, key: str, name: str, manufacturer: str | None, model: str | None, area: str | None, ident: tuple[str, str] | None, mac: int | None = None, via: str | None = None,
               disabled_by: str | None = None) -> str:
        did = f"cr016_dev_{key}"
        self.devices.append({
            "id": did, "name": name, "name_by_user": None, "manufacturer": manufacturer, "model": model, "via_device_id": via, "area_id": area,
            "connections": [["mac", _mac(mac)]] if mac is not None else [], "identifiers": [list(ident)] if ident else [], "sw_version": "synthetic",
            "config_entries": [f"cr016_ce_{key}"], "disabled_by": disabled_by,
        })
        return did

    def entity(self, entity_id: str, platform: str, dev: str | None, state: str | None, attrs: dict[str, Any], unique_id: str | None = None, hidden_by: str | None = None,
               disabled_by: str | None = None) -> str:
        self._reg += 1
        self.entities.append({
            "entity_id": entity_id, "id": f"cr016_reg_{self._reg:03d}", "unique_id": unique_id or entity_id.split(".", 1)[1], "platform": platform, "device_id": dev, "area_id": None,
            "config_entry_id": f"cr016_ce_{platform}", "name": None, "original_name": attrs.get("friendly_name"), "disabled_by": disabled_by, "hidden_by": hidden_by,
            "entity_category": None, "state": state, "attributes": attrs,
        })
        return entity_id

    def player(self, slug: str, name: str, kind: str, provider: str | None, area: str | None, floor_of: dict[str, str | None], entities: list[str], **extra: Any) -> None:
        self.players[slug] = {"name": name, "kind": kind, "music_provider": provider, "area_id": area, "floor_id": floor_of.get(area) if area else None, "entities": list(entities), **extra}

    def finish(self, floors: list[dict[str, Any]], areas: list[dict[str, Any]], extra: dict[str, Any]) -> dict[str, Any]:
        ents = {e["entity_id"]: {"platform": e["platform"], "unique_id": e["unique_id"], "attrs": e["attributes"], "state": e["state"]} for e in self.entities if not e["disabled_by"]}
        render_groups(ents, self.groups)
        enabled = [e for e in self.entities if not e["disabled_by"]]
        unplaced = [s for s, p in self.players.items() if p["area_id"] is None and p["kind"] not in ("session", "virtual_group", "service")]
        return {
            "house": self.house, "floors": floors, "areas": areas, "devices": self.devices, "entities": self.entities,
            "players": self.players, "clusters": [sorted(c) for c in self.clusters], "suggestions": self.suggestions, "nonphysical": self.nonphysical, "groups": self.group_expect,
            "expect": {"entities": len(self.entities), "enabled": len(enabled), "devices": len(self.devices), "players": len(self.players),
                       "clusters": len(self.clusters), "suggestions": len(self.suggestions), "unplaced": len(unplaced), "floors": len(floors), "areas": len(areas)} | extra,
            "model": {"twins": self.twins, "groups": self.groups, "queues": self.queues},
        }


def build_ma_house() -> dict[str, Any]:
    """Probes H + V: Music Assistant with WiiM, Cast, Denon / HEOS and cast-only TVs. 35 entities on 33 HA devices, 2 floors, 16 physical
    devices once the suggestions and the one manual link are made (see the module docstring)."""
    b = _HB("ma")
    g, u = "cr016_ground", "cr016_upper"
    floors = [{"floor_id": g, "name": "קומת קרקע", "level": 0}, {"floor_id": u, "name": "קומה 1", "level": 1}]
    areas = [
        {"area_id": "cr016_living", "name": "סלון", "floor_id": g, "icon": "mdi:sofa"}, {"area_id": "cr016_kitchen", "name": "מטבח", "floor_id": g, "icon": "mdi:silverware-fork-knife"},
        {"area_id": "cr016_terrace", "name": "פרגולה", "floor_id": g, "icon": "mdi:pergola"}, {"area_id": "cr016_garden", "name": "גינה", "floor_id": g, "icon": "mdi:flower"},
        {"area_id": "cr016_office", "name": "משרד", "floor_id": u, "icon": "mdi:desk"}, {"area_id": "cr016_bedroom", "name": "חדר שינה", "floor_id": u, "icon": "mdi:bed"},
    ]
    floor_of: dict[str, str | None] = {a["area_id"]: a["floor_id"] for a in areas}
    track = lambda eid, t, cache=1: _media_attrs("track", lib_item("track", t), eid, cache)  # noqa: E731

    # ---- four WiiM speakers: wiim + cast + MA each (MA id embeds the wiim id: 2c; the cast device shares manufacturer + model: 3b)
    wiims = [("living", "WiiM Mini", "רמקול סלון", "cr016_living", 1), ("kitchen", "WiiM Pro", "רמקול מטבח", "cr016_kitchen", 2),
             ("terrace", "WiiM Ultra", "רמקול פרגולה", "cr016_terrace", 3), ("study", "WiiM Amp", "WiiM Amp-4F2A", None, 4)]
    hidden_cast = {"living", "kitchen", "terrace"}  # the owner's own manual dedupe: hidden by the user, still live (state off)
    for slug, model, name, area, n in wiims:
        wid = _uuid6(n)
        dw = b.device(f"wiim_{slug}", name, "WiiM", model, area, ("wiim", wid), mac=n)
        dc = b.device(f"cast_wiim_{slug}", f"WiiM cast {slug}", "WiiM", model, None, ("cast", _uuid6(100 + n)))
        dm = b.device(f"ma_wiim_{slug}", name, "WiiM", model, None, ("music_assistant", f"upnp_{wid}"))
        ew, ec, em = f"media_player.cr016_wiim_{slug}", f"media_player.cr016_wiim_{slug}_cast", f"media_player.cr016_wiim_{slug}_ma"
        playing = slug in ("living", "kitchen")
        now = track(em, "t1") if playing else {}
        b.entity(ew, "wiim", dw, "playing" if playing else "idle", {"friendly_name": name, "device_class": "speaker", "supported_features": WIIM_MASK, "volume_level": 0.3 + n / 100, "is_volume_muted": False,
                                                                      "source": "Wi-Fi", "source_list": ["Wi-Fi", "Line-In"], **{k: v for k, v in now.items() if k != "entity_picture"}})
        b.entity(ec, "cast", dc, "off" if slug in hidden_cast else "idle", {"friendly_name": model, "device_class": "speaker", "supported_features": CAST_AUDIO_MASK, "volume_level": 0.3 + n / 100, "is_volume_muted": False},
                 hidden_by="user" if slug in hidden_cast else None)
        b.entity(em, "music_assistant", dm, "playing" if playing else "idle", {
            "friendly_name": name, "device_class": "speaker", "supported_features": MA_LIVE_SRC_MASK if slug == "living" else MA_LIVE_MASK, "mass_player_type": "player", "volume_level": 0.3 + n / 100,
            "is_volume_muted": False, "shuffle": False, "repeat": "off", "source_list": ["Line-In"] if slug == "living" else None, **now}, unique_id=f"upnp_{wid}")
        b.twins.append([ew, ec, em])
        b.clusters.append([ew, ec, em])
        b.player(f"wiim_{slug}", name, "speaker", "ma", area, floor_of, [ew, ec, em], hidden=[ec] if slug in hidden_cast else [], rules={ec: "3b", em: "2c"})
    # ---- two Google-style speakers: Cast + MA (the Cast model is a prefix of the MA one: 3b); the second one's MA entity refuses to join
    for slug, cmodel, mmodel, name, area, n in [("mini", "Home Mini", "Home Mini Gen2", "רמקול משרד", "cr016_office", 11), ("nest", "Nest Audio", "Nest Audio Gen2", "רמקול חדר שינה", "cr016_bedroom", 12)]:
        dc = b.device(f"cast_{slug}", name, "Google Inc.", cmodel, area, ("cast", _uuid6(n)))
        dm = b.device(f"ma_{slug}", name, "Google Inc.", mmodel, None, ("music_assistant", f"ma{n:012d}"))
        ec = f"media_player.cr016_{slug}_cast"
        em = f"media_player.cr016_{slug}_ma" + ("_refuses" if slug == "nest" else "")
        b.entity(ec, "cast", dc, "idle", {"friendly_name": name, "device_class": "speaker", "supported_features": CAST_AUDIO_MASK, "volume_level": 0.2 + n / 200, "is_volume_muted": False})
        b.entity(em, "music_assistant", dm, "paused", {"friendly_name": name, "device_class": "speaker", "supported_features": MA_LIVE_MASK, "mass_player_type": "player", "volume_level": 0.2 + n / 200,
                                                       "is_volume_muted": False, "shuffle": False, "repeat": "off", **track(em, "t3", 2)}, unique_id=f"ma{n:012d}")
        b.twins.append([ec, em])
        b.clusters.append([ec, em])
        b.player(slug, name, "speaker", "ma", area, floor_of, [ec, em], rules={em: "3b"})
    # ---- two Denon receivers: Main + Zone2 (one HA device), a HEOS device, an MA twin whose id EQUALS the HEOS player id (2b)
    denons: dict[str, str] = {}
    for slug, name, dmodel, hmodel, area, pid in [("a", "מגבר קולנוע", "AVR-X1800H", "AVR-X1800H", "cr016_living", "1100000001"), ("b", "Denon B", "AVR-S570BT", "Denon AVR-S570BT", None, "1100000002")]:
        dd = b.device(f"denon_{slug}", name, "Denon", dmodel, area, ("denonavr", f"DENON-SYNTH-{slug.upper()}"))
        dh = b.device(f"heos_{slug}", f"Denon {slug.upper()}", "Denon", hmodel, None, ("heos", pid))
        dm = b.device(f"ma_denon_{slug}", f"Denon {slug.upper()}", "Denon", hmodel, None, ("music_assistant", pid))
        e_main, e_z2, e_heos, e_ma = (f"media_player.cr016_denon_{slug}", f"media_player.cr016_denon_{slug}_zone2", f"media_player.cr016_denon_{slug}_heos", f"media_player.cr016_denon_{slug}_ma")
        on = slug == "a"
        b.entity(e_main, "denonavr", dd, "on" if on else "off", {"friendly_name": name, "device_class": "receiver", "supported_features": DENON_MAIN_MASK, "volume_level": 0.35, "is_volume_muted": False,
                                                                 "source": "TV Audio", "source_list": list(AVR_SOURCES), "sound_mode": "Stereo", "sound_mode_list": ["Stereo", "Movie", "Music", "Direct", "Pure Direct"]})
        b.entity(e_z2, "denonavr", dd, "off", {"friendly_name": f"{name} Zone2", "device_class": "receiver", "supported_features": DENON_ZONE2_MASK, "volume_level": 0.25, "is_volume_muted": False,
                                               "source": "Network", "source_list": list(AVR_SOURCES), "sound_mode": "Stereo", "sound_mode_list": ["Stereo", "Movie", "Music"]})
        b.entity(e_heos, "heos", dh, "idle", {"friendly_name": f"Denon {slug.upper()}", "supported_features": HEOS_MASK, "volume_level": 0.35, "is_volume_muted": False, "shuffle": False, "repeat": "off",
                                              "source": "Network", "source_list": ["Network", "Bluetooth"]}, unique_id=pid)
        b.entity(e_ma, "music_assistant", dm, "paused", {"friendly_name": f"Denon {slug.upper()}", "device_class": "speaker", "supported_features": MA_LIVE_MASK, "mass_player_type": "player",
                                                         "volume_level": 0.35, "is_volume_muted": False, "shuffle": False, "repeat": "off", **track(e_ma, "t3", 3)}, unique_id=pid)
        b.twins.append([e_main, e_heos, e_ma])
        denons[slug] = e_ma
        if slug == "a":
            b.clusters.append([e_main, e_z2, e_heos, e_ma])  # rung 1 (zones), 2b (MA = HEOS id), 3b (denonavr = heos model)
            b.player("denon_a", name, "receiver", "ma", area, floor_of, [e_main, e_z2, e_heos, e_ma], zones=[e_main, e_z2], rules={e_z2: "1", e_ma: "2b", e_heos: "3b"})
        else:  # HEOS B reports another model string: no automatic link and no suggestion (nothing placed): the owner links it by hand
            b.clusters.append([e_main, e_z2])
            b.clusters.append([e_heos, e_ma])
            b.player("denon_b", name, "receiver", "ma", area, floor_of, [e_main, e_z2, e_heos, e_ma], zones=[e_main, e_z2], rules={e_z2: "1", e_ma: "2b", e_heos: "manual"}, link={"endpoint": e_heos, "into": e_main})
    # ---- three Cast TVs named by their model number, asleep (unavailable), each with an MA twin; two TVs share a model (only suggestions)
    tv_casts: dict[str, str] = {}
    tv_mas: dict[str, str] = {}
    for n, model, area, restored in [("1", "OLED55C3", None, False), ("2", "OLED55C3", None, True), ("3", "OLED65G3", "cr016_bedroom", False)]:
        dc = b.device(f"cast_tv{n}", model, "LG Electronics", model, area, ("cast", _uuid6(20 + int(n))))
        dm = b.device(f"ma_tv{n}", model, "LG Electronics", model, None, ("music_assistant", f"ma{20 + int(n):012d}"))
        ec, em = f"media_player.cr016_tv{n}_cast", f"media_player.cr016_tv{n}_ma"
        tv_casts[n], tv_mas[n] = ec, em
        b.entity(ec, "cast", dc, "unavailable", {"friendly_name": model, "supported_features": CAST_ASLEEP_MASK})
        b.entity(em, "music_assistant", dm, "unavailable", {"friendly_name": model, "device_class": "speaker", "supported_features": MA_DEGRADED_MASK, "restored": True if restored else None}, unique_id=f"ma{20 + int(n):012d}")
    b.clusters.append([tv_casts["3"], tv_mas["3"]])
    b.player("tv3", "OLED65G3", "screen", None, "cr016_bedroom", floor_of, [tv_casts["3"], tv_mas["3"]], rules={tv_mas["3"]: "3b"})
    for n in ("1", "2"):
        b.clusters.append([tv_casts[n]])
        b.clusters.append([tv_mas[n]])
    for cn in ("1", "2"):
        for mn in ("1", "2"):
            b.suggestions.append({"rule": "3b", "a": [tv_casts[cn]], "b": [tv_mas[mn]], "reason": "same_model"})
    b.player("tv1", "OLED55C3", "screen", None, None, floor_of, [tv_casts["1"], tv_mas["1"]], link={"endpoint": tv_mas["1"], "into": tv_casts["1"]})
    b.player("tv2", "OLED55C3", "screen", None, None, floor_of, [tv_casts["2"], tv_mas["2"]], link={"endpoint": tv_mas["2"], "into": tv_casts["2"]})
    # ---- MA-only players: three `restored` (registry only this session), one really unavailable; all with the degraded mask
    for i, (slug, name, restored) in enumerate([("console", "קונסולה", True), ("old_a", "רמקול מחסן", True), ("old_b", "רמקול מרתף", True), ("garden", "רמקול גינה", False)]):
        dm = b.device(f"ma_{slug}", name, "Music Assistant", "Universal Player", None, ("music_assistant", f"ma{40 + i:012d}"))
        em = f"media_player.cr016_{slug}_ma"
        b.entity(em, "music_assistant", dm, "unavailable", {"friendly_name": name, "device_class": "speaker", "supported_features": MA_DEGRADED_MASK, "restored": True if restored else None}, unique_id=f"ma{40 + i:012d}")
        b.clusters.append([em])
        b.player(slug, name, "speaker", "ma", None, floor_of, [em], restored=restored)
    # ---- one static MA group (a sync group created in MA): its members are the WiiM terrace + study pair
    dg = b.device("ma_group_outside", "קבוצת חוץ", "Music Assistant", "Sync Group", None, ("music_assistant", "ma_group_outside"))
    eg = "media_player.cr016_group_outside_ma"
    ma_terrace, ma_study = "media_player.cr016_wiim_terrace_ma", "media_player.cr016_wiim_study_ma"
    b.entity(eg, "music_assistant", dg, "idle", {"friendly_name": "קבוצת חוץ", "device_class": "speaker", "supported_features": MA_LIVE_MASK, "mass_player_type": "group", "group_members": [ma_terrace, ma_study],
                                                 "active_queue": "ma_group_outside", "volume_level": 0.3, "is_volume_muted": False, "shuffle": False, "repeat": "off"}, unique_id="ma_group_outside")
    b.clusters.append([eg])
    b.player("group_outside", "קבוצת חוץ", "group", "ma", None, floor_of, [eg], members=["wiim_terrace", "wiim_study"])
    # ---- the live groups, per layer
    ma_living, ma_kitchen = "media_player.cr016_wiim_living_ma", "media_player.cr016_wiim_kitchen_ma"
    mini, nest = "media_player.cr016_mini_ma", "media_player.cr016_nest_ma_refuses"
    b.groups = {
        "ma": [{"leader": denons["a"], "members": [denons["b"], mini, nest]}, {"leader": ma_living, "members": [ma_kitchen]}],
        "wiim": [{"leader": "media_player.cr016_wiim_living", "members": ["media_player.cr016_wiim_kitchen"]}, {"leader": "media_player.cr016_wiim_terrace", "members": ["media_player.cr016_wiim_study"]}],
    }
    b.group_expect = [
        {"id": "cross", "layer": "ma", "leader": "denon_a", "members": ["denon_b", "mini", "nest"], "conflict": False, "inconsistent": True, "state": "paused",
         "lists": {"denon_a": 4, "denon_b": 4, "mini": 0, "nest": 0}},
        {"id": "pair", "layer": "ma", "leader": "wiim_living", "members": ["wiim_kitchen"], "conflict": False, "also_vendor_layer": True, "state": "playing"},
        {"id": "vendor_only", "layer": "vendor", "leader": "wiim_terrace", "members": ["wiim_study"], "conflict": True},
    ]
    # ---- queues (the fake Music Assistant's): the leader of a group owns it
    b.queues = {ma_living: {"items": [["track", "t1"], ["track", "t2"], ["track", "t3"], ["track", "t4"]], "index": 0}, denons["a"]: {"items": [["track", "t3"], ["track", "t4"]], "index": 0}}
    return b.finish(floors, areas, {"restored": 4, "hidden_cast": 3, "static_groups": 1, "live_groups_ma": 2, "zones_receivers": 2})


def build_sonos_house() -> dict[str, Any]:
    """Probe K: no Music Assistant. 34 registry entities (31 enabled), no floors; 8 physical devices (6 Sonos, 2 TVs) and 13 non-physical ones."""
    b = _HB("sonos")
    areas = [{"area_id": f"cr016_{k}", "name": n, "floor_id": None, "icon": i} for k, n, i in [
        ("living", "סלון", "mdi:sofa"), ("kitchen", "מטבח", "mdi:silverware-fork-knife"), ("bedroom", "חדר שינה", "mdi:bed"), ("study", "משרד", "mdi:desk"),
        ("terrace", "מרפסת", "mdi:balcony"), ("bath", "אמבטיה", "mdi:shower"), ("garden", "גינה", "mdi:flower")]]
    floor_of: dict[str, str | None] = {a["area_id"]: None for a in areas}
    hub = b.device("st_hub", "SmartThings hub", "Samsung", "SYNTH-HUB", None, ("smartthings", "synthetic-hub"))

    # ---- six Sonos speakers, each with a SmartThings cloud twin of an IDENTICAL name (no manufacturer, no model, no shared id)
    sonos = [("living", "סלון", "Sonos One", "cr016_living", "cr016_living", "playing", 1), ("kitchen", "מטבח", "Sonos Five", "cr016_kitchen", "cr016_kitchen", "paused", 2),
             ("bedroom", "חדר שינה", "Sonos Beam", "cr016_bedroom", "cr016_bedroom", "idle", 3), ("study", "משרד", "Sonos Roam", "cr016_study", "cr016_study", "idle", 4),
             ("terrace", "מרפסת", "Sonos Move", "cr016_terrace", None, "idle", 5), ("spare", "רמקול 6", "Sonos Era 100", None, None, "idle", 6)]
    for slug, name, model, area, st_area, state, n in sonos:
        rincon = f"RINCON_C016{n:08X}01400"
        ds = b.device(f"sonos_{slug}", name, "Sonos", model, area, ("sonos", rincon), mac=n)
        dtw = b.device(f"st_{slug}", name, None, None, st_area, ("smartthings", f"cloud-synth-{n:04d}"), via=hub)
        es = f"media_player.cr016_sonos_{slug}" + ("_refuses" if slug == "terrace" else "")
        et = f"media_player.cr016_st_{slug}"
        attrs: dict[str, Any] = {"friendly_name": name, "device_class": "speaker", "supported_features": SONOS_MASK, "volume_level": 0.2 + n / 20, "is_volume_muted": False, "shuffle": False, "repeat": "off",
                                 "source_list": SONOS_FAVOURITES + (["Line-In"] if slug == "study" else [])}
        if state != "idle":
            item = lib_item("track", "t1" if slug == "living" else "t3")
            attrs.update(_media_attrs("track", item, es, n))  # type: ignore[arg-type]
            attrs.update({"queue_position": 3 if slug == "living" else 1, "queue_size": 12 if slug == "living" else 5, "source": SONOS_FAVOURITES[2]})
        b.entity(es, "sonos", ds, state, attrs, unique_id=rincon)
        b.entity(et, "smartthings", dtw, "idle", {"friendly_name": name, "device_class": "speaker", "supported_features": ST_SPEAKER_MASK, "volume_level": 0.2 + n / 20, "is_volume_muted": False})
        b.twins.append([es, et])
        b.clusters.append([es])
        b.clusters.append([et])
        b.player(f"sonos_{slug}", name, "speaker", "sonos", area, floor_of, [es, et], mirrors=[et], hidden=[et],
                 link={"endpoint": et, "into": es, "rule": "5" if st_area and area else "5b" if area else "manual"})
        if area:
            b.suggestions.append({"rule": "5" if st_area else "5b", "a": [es], "b": [et], "reason": "same_name_area" if st_area else "same_name_area_one_side"})
    sonos_ids = [f"media_player.cr016_sonos_{s}" + ("_refuses" if s == "terrace" else "") for s in ("living", "kitchen", "bedroom", "study", "terrace")]
    b.queues = {}
    # ---- two Samsung TVs: samsungtv_smart + remote (one HA device) + a SmartThings twin with the same manufacturer + model (3b, auto)
    tv_ids: list[str] = []
    for slug, name, model, area, n in [("living", "טלוויזיה סלון", "SYNTH-QE55", "cr016_living", 31), ("bedroom", "טלוויזיה חדר שינה", "SYNTH-QE65", "cr016_bedroom", 32)]:
        dv = b.device(f"ssv_{slug}", name, "Samsung", model, area, ("samsungtv_smart", f"uuid:{_uuid6(n)}"), mac=n)
        dtw = b.device(f"st_tv_{slug}", name, "Samsung", model, area, ("smartthings", f"cloud-synth-tv-{n}"), via=hub)
        mp, rm, st = f"media_player.cr016_tv_{slug}", f"remote.cr016_tv_{slug}", f"media_player.cr016_st_tv_{slug}"
        b.entity(mp, "samsungtv_smart", dv, "off", {"friendly_name": name, "device_class": "tv", "supported_features": SSV_FEATURES, "volume_level": 0.3, "is_volume_muted": False, "source": "HDMI 1", "source_list": list(SSV_SOURCES)})
        b.entity(rm, "samsungtv_smart", dv, "unknown", {"friendly_name": name, "supported_features": 0})
        b.entity(st, "smartthings", dtw, "off", {"friendly_name": name, "device_class": "tv", "supported_features": ST_TV_MASK, "volume_level": 0.3, "is_volume_muted": False, "source_list": ["TV", "HDMI1"]})
        b.twins.append([mp, st])
        b.clusters.append([mp, rm, st])
        b.player(f"tv_{slug}", name, "screen", None, area, floor_of, [mp, rm, st], rules={rm: "1", st: "3b"})
        tv_ids.append(mp)
    # ---- two HA `group` helper players: a fan-out with a member list in `entity_id`, no GROUPING and no group_members; no device
    helper_s = b.entity("media_player.cr016_helper_sonos", "group", None, "idle", {"friendly_name": "כל הרמקולים", "supported_features": HELPER_SPEAKERS_MASK, "entity_id": list(sonos_ids), "volume_level": 0.3,
                                                                                    "is_volume_muted": False})
    helper_t = b.entity("media_player.cr016_helper_tvs", "group", None, "off", {"friendly_name": "כל הטלוויזיות", "supported_features": HELPER_TVS_MASK, "entity_id": list(tv_ids)})
    for e, kind, members in [(helper_s, "virtual_group", sonos_ids), (helper_t, "virtual_group", tv_ids)]:
        b.clusters.append([e])
        b.nonphysical.append({"entity": e, "kind": kind, "members": list(members)})
    # ---- a Spotify Connect source: restored, SELECT_SOURCE only
    dsp = b.device("spotify_user", "Spotify", "Spotify", "Spotify Connect", None, ("spotify", "synthetic-user"))
    sp = b.entity("media_player.cr016_spotify", "spotify", dsp, "unavailable", {"friendly_name": "Spotify", "supported_features": SELECT_SOURCE, "restored": True})
    b.clusters.append([sp])
    b.nonphysical.append({"entity": sp, "kind": "service", "members": []})
    # ---- ten Jellyfin DLNA sessions (eight share one generic name; nine restored) + three more disabled by their config entry / the user
    for i in range(1, 11):
        name = "SynthClient DLNA" if i <= 8 else ("Jellyfin Web" if i == 9 else "Jellyfin Android TV")
        dj = b.device(f"jf_{i}", name, "Jellyfin", "DLNA", None, ("jellyfin", f"synth-session-{i}"))
        ej = b.entity(f"media_player.cr016_jf_{i}", "jellyfin", dj, "unavailable", {"friendly_name": name, "supported_features": JELLYFIN_MASK, "restored": True if i <= 9 else None})
        b.clusters.append([ej])
        b.nonphysical.append({"entity": ej, "kind": "session", "members": []})
    for i in range(1, 4):
        dj = b.device(f"jf_d{i}", "SynthClient DLNA", "Jellyfin", "DLNA", None, ("jellyfin", f"synth-session-d{i}"), disabled_by="integration" if i < 3 else None)
        b.entity(f"media_player.cr016_jf_d{i}", "jellyfin", dj, None, {"friendly_name": "SynthClient DLNA", "supported_features": JELLYFIN_MASK}, disabled_by="integration" if i < 3 else "user")
    b.groups = {}
    b.group_expect = [{"id": "helper_speakers", "layer": None, "leader": None, "members": [], "virtual": True, "of": sonos_ids}, {"id": "helper_tvs", "layer": None, "leader": None, "members": [], "virtual": True, "of": tv_ids}]
    return b.finish([], areas, {"sessions": 10, "disabled": 3, "helpers": 2, "services": 1, "mirrors": 6, "physical": 8, "restored": 10})


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
    if attrs.get("restored"):  # a registry-only entity of this session: Home Assistant marks its state `restored: true`
        keep["restored"] = True
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
        self.bridge_version = os.environ.get("SW_FAKE_BRIDGE_VERSION") or ("0.5.0" if os.environ.get("SW_FAKE_HOUSE") in ("ma", "sonos") else "0.4.0")  # the CR-016 houses need the 0.5.0 bridge
        self.allowed: set[tuple[str, str]] | None = None
        # CR-016: the audio houses' own model
        self.house = "tv"
        self.twins: dict[str, list[str]] = {}  # entity id -> the entities of the same physical device (volume and mute follow)
        self.groups: dict[str, list[dict[str, Any]]] = {}  # layer -> [{leader, members}] (render_groups writes the attributes from it)
        self.queues: dict[str, dict[str, Any]] = {}  # Music Assistant entity id -> {items: [[media_type, id]], index}
        self.join_refuse: set[str] = set()
        self.query_fail = False
        self.ma_loaded = True
        self.search_enabled = False
        # CR-016 phase 2b: the fake Music Assistant server (`ma_rpc`): stable queue item ids per queue owner, and a switch that makes it unreachable
        self.queue_ids: dict[str, list[str]] = {}
        self.ma_down = False
        self.ma_calls: list[str] = []

    def load(self, world: dict[str, Any]) -> None:
        with self.lock:
            self.ents = {e["entity_id"]: {"platform": e["platform"], "device_id": e["device_id"], "state": e["state"], "attrs": copy.deepcopy(e["attributes"]), "unique_id": e.get("unique_id")}
                         for e in world["entities"] if not e.get("disabled_by")}  # an entity disabled by its config entry has no state at all
            self.log.clear()
            m = world.get("model") or {}
            self.house = world.get("house", "tv")
            self.twins = {eid: [x for x in grp] for grp in m.get("twins", []) for eid in grp}
            self.groups = copy.deepcopy(m.get("groups", {}))
            self.queues = copy.deepcopy(m.get("queues", {}))
            self.join_refuse, self.query_fail, self.ma_loaded, self.search_enabled = set(), False, True, False
            self.queue_ids, self.ma_down, self.ma_calls = {}, False, []

    def payload(self, entity_id: str) -> dict[str, Any]:
        """The state as Home Assistant reports it (unavailable / unknown keep only the capability attributes)."""
        with self.lock:
            e = self.ents[entity_id]
            attrs = e["attrs"] if e["state"] not in ("unavailable", "unknown") else _slim(e["attrs"])
            return {"entity_id": entity_id, "state": e["state"], "attributes": {k: v for k, v in copy.deepcopy(attrs).items() if v is not None or k in KEEP_NULL}}

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
            if data.get("announce"):
                raise Refused("media_announce_not_allowed")  # 6a: no announcements in 0.1.150
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
        # ---- bridge 0.5.0 (CR-016 6.3): the players' own services, re-checked independently of the add-on
        if domain == "media_player" and service == "media_seek":
            pos = data.get("seek_position")
            if isinstance(pos, bool) or not isinstance(pos, (int, float)) or not (0 <= pos <= 86400):
                raise Refused("media_seek_invalid")
            return {"kind": "seek", "position": pos}
        if domain == "media_player" and service == "shuffle_set":
            if not isinstance(data.get("shuffle"), bool):
                raise Refused("media_shuffle_invalid")
            return {"kind": "shuffle", "shuffle": data["shuffle"]}
        if domain == "media_player" and service == "repeat_set":
            if data.get("repeat") not in ("off", "one", "all"):
                raise Refused("media_repeat_invalid")
            return {"kind": "repeat", "repeat": data["repeat"]}
        if domain == "media_player" and service == "select_sound_mode":
            mode = data.get("sound_mode")
            if not ent or mode not in (ent["attrs"].get("sound_mode_list") or []):
                raise Refused("media_sound_mode_unknown")
            return {"kind": "sound_mode", "sound_mode": mode}
        if domain == "media_player" and service == "join":
            members = data.get("group_members")
            if not isinstance(members, list) or not (1 <= len(members) <= 16) or not all(isinstance(m, str) and re.fullmatch(r"media_player\.[a-z0-9_]+", m) for m in members):
                raise Refused("media_group_invalid")  # only media_player entities, never a helper's list of anything else
            return {"kind": "join", "members": list(members)}
        if domain == "media_player" and service == "unjoin":
            return {"kind": "unjoin"}
        if domain == "music_assistant" and service == "play_media":
            if not ent or ent["platform"] != "music_assistant":
                raise Refused("media_target_not_music_assistant")
            mtype, mid, enq = data.get("media_type"), data.get("media_id"), data.get("enqueue", "play")
            if mtype not in MEDIA_TYPES:
                raise Refused("media_type_not_allowed")
            if not isinstance(mid, str) or not mid or re.match(r"(?i)(https?|file)://", mid) or mid.startswith(("/", ".", "\\")) or ".." in mid or "\\" in mid:
                raise Refused("media_id_not_allowed")  # a URL, a file or a path is never a media id
            if enq not in ("play", "replace", "next", "replace_next", "add"):
                raise Refused("media_enqueue_invalid")
            return {"kind": "play_item", "media_id": mid, "media_type": mtype, "enqueue": enq}
        if domain == "music_assistant" and service == "transfer_queue":
            src = self.ents.get(str(data.get("source_player", "")))
            if not ent or not src or ent["platform"] != "music_assistant" or src["platform"] != "music_assistant":
                raise Refused("media_transfer_not_music_assistant")
            return {"kind": "transfer", "source_player": data["source_player"]}
        if domain == "music_assistant":
            raise Refused("media_service_not_allowed")  # play_announcement, get_* (reads go through media_query) and the rest
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
                changed += self._follow(eid, {"volume_level": a["volume_level"]})
            elif service == "volume_set":
                need(VOLUME_SET)
                a["volume_level"] = float(data["volume_level"])  # a leader's own volume only: the member levels are the add-on's fan-out
                changed += self._follow(eid, {"volume_level": a["volume_level"]})
            elif service == "volume_mute":
                need(VOLUME_MUTE)
                a["is_volume_muted"] = bool(data["is_volume_muted"])
                changed += self._follow(eid, {"is_volume_muted": a["is_volume_muted"]})
            elif service in ("media_play", "media_pause", "media_stop", "media_play_pause"):
                need({"media_play": PLAY, "media_pause": PAUSE, "media_stop": STOP}.get(service, PLAY | PAUSE))
                e["state"] = {"media_play": "playing", "media_pause": "paused", "media_stop": "idle"}.get(service) or ("paused" if e["state"] == "playing" else "playing")
                changed += self._group_follow(eid, e["state"])  # the members of a live group play and pause with their leader
            elif service in ("media_next_track", "media_previous_track"):
                need(NEXT_TRACK if service == "media_next_track" else PREVIOUS_TRACK)
                moved = self._step_queue(eid, 1 if service == "media_next_track" else -1)
                if not moved:
                    return []  # nothing observable in this fake
                changed += moved
            elif service == "media_seek":
                need(SEEK)
                a["media_position"] = float(data["seek_position"])
                a["media_position_updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%S+00:00", time.gmtime())
            elif service == "shuffle_set":
                need(SHUFFLE_SET)
                a["shuffle"] = bool(data["shuffle"])
            elif service == "repeat_set":
                need(REPEAT_SET)
                a["repeat"] = data["repeat"]
            elif service == "select_sound_mode":
                need(SELECT_SOUND_MODE)
                a["sound_mode"] = data["sound_mode"]
            elif service in ("join", "unjoin"):
                need(GROUPING)
                changed = self._group_op(eid, service, [str(m) for m in data.get("group_members") or []])
            elif service == "select_source":
                need(SELECT_SOURCE)
                a["source"] = data["source"]
                if e["platform"] == "sonos" and data["source"] in SONOS_FAVOURITES:  # a Sonos favourite starts playing: its own metadata and queue
                    e["state"] = "playing"
                    a.update(_media_attrs("track", lib_item("track", "t1"), eid), media_title=data["source"], queue_position=1, queue_size=6)
                else:
                    is_app = data["source"] in APP_SOURCES
                    a["app_id"] = f"synthetic.{data['source'].lower().replace(' ', '_')}" if is_app else None
                    a["media_content_type"] = "app" if is_app else None
                    a["media_title"] = data["source"]
            elif service == "play_media":
                need(PLAY_MEDIA)
                return []  # send_key / send_text: no observable effect
            else:
                return []
        elif domain == "music_assistant" and service == "play_media":
            need(PLAY_MEDIA)
            found = lib_find(str(data["media_id"]))
            if found is None:
                raise Refused("HomeAssistantError")  # "media not found"
            changed += self._play_item(eid, found, str(data.get("enqueue", "play")))
        elif domain == "music_assistant" and service == "transfer_queue":
            changed = self._transfer(eid, str(data["source_player"]), bool(data.get("auto_play", True)))
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

    # ---------------------------------------------------------------- CR-016: twins, groups and queues

    def _follow(self, eid: str, attrs: dict[str, Any]) -> list[str]:
        """The entities of the same physical device report the same volume / mute (an MA volume_set moves its WiiM / Cast / HEOS twin)."""
        out = []
        for other in self.twins.get(eid, []):
            o = self.ents.get(other)
            if other == eid or o is None or o["state"] in ("unavailable", "unknown") or not any(k in o["attrs"] for k in attrs):
                continue
            o["attrs"].update(attrs)
            out.append(other)
        return out

    def _leader_of(self, eid: str) -> str | None:
        """The leader of the live group an entity belongs to in its own layer (itself for a leader), else None."""
        for g in self.groups.get(LAYER_OF.get(self.ents[eid]["platform"], ""), []):
            if eid == g["leader"] or eid in g["members"]:
                return g["leader"]
        return None

    def _members_of(self, eid: str) -> list[str]:
        for g in self.groups.get(LAYER_OF.get(self.ents[eid]["platform"], ""), []):
            if g["leader"] == eid:
                return list(g["members"])
        return []

    def _queue_owner(self, eid: str) -> str | None:
        """Music Assistant: a member of a live group plays the LEADER's queue."""
        if self.ents[eid]["platform"] != "music_assistant":
            return None
        return self._leader_of(eid) or eid

    def _group_follow(self, eid: str, state: str) -> list[str]:
        """A leader's transport state reaches its members and its own twins (a paused MA group pauses the WiiM entities behind it)."""
        out = []
        for target in {t for x in [eid, *self._members_of(eid)] for t in [x, *self.twins.get(x, [])]} - {eid}:
            o = self.ents.get(target)
            if o is not None and o["state"] in ("playing", "paused", "idle"):
                o["state"] = state
                out.append(target)
        return out

    def _apply_now(self, owner: str) -> list[str]:
        """Writes the media attributes of the queue's current entry onto the owner, its members and the playing twins; returns who changed."""
        q = self.queues.get(owner)
        entry = None
        if q and q["items"]:
            mt, iid = q["items"][min(q["index"], len(q["items"]) - 1)]
            entry = (mt, lib_item(mt, iid))
        changed = []
        for t in [owner, *self._members_of(owner)]:
            for x in [t, *[o for o in self.twins.get(t, []) if "media_title" in self.ents[o]["attrs"] and not o.endswith("_cast")]]:
                e = self.ents[x]
                if e["state"] in ("unavailable", "unknown"):
                    continue
                if entry and entry[1]:
                    e["attrs"].update(_media_attrs(entry[0], entry[1], t))
                else:
                    e["attrs"].update({"media_title": None, "media_artist": None, "media_album_name": None, "media_duration": None, "media_position": None, "entity_picture": None})
                changed.append(x)
        return sorted(set(changed))

    def _step_queue(self, eid: str, d: int) -> list[str]:
        owner = self._queue_owner(eid)
        q = self.queues.get(owner or "")
        if not q or not q["items"]:
            return []
        idx = min(len(q["items"]) - 1, max(0, q["index"] + d))
        if idx == q["index"]:
            return []
        q["index"] = idx
        return self._apply_now(owner)  # type: ignore[arg-type]

    def _play_item(self, eid: str, found: tuple[str, dict[str, Any]], enqueue: str) -> list[str]:
        """music_assistant.play_media with a library uri: `play` / `replace` replace the queue, `next` / `add` / `replace_next` change what follows."""
        owner = self._queue_owner(eid) or eid
        entries = [[mt, it["id"]] for mt, it in lib_tracks(*found)]
        q = self.queues.setdefault(owner, {"items": [], "index": 0})
        fresh = enqueue in ("play", "replace") or not q["items"]
        if fresh:
            self.queues[owner] = q = {"items": entries, "index": 0}
        elif enqueue == "next":
            q["items"][q["index"] + 1:q["index"] + 1] = entries
        elif enqueue == "replace_next":
            q["items"][q["index"] + 1:] = entries
        else:
            q["items"].extend(entries)
        changed = {owner, *self._members_of(owner)}
        if fresh:
            for t in changed:
                if self.ents[t]["state"] not in ("unavailable", "unknown"):
                    self.ents[t]["state"] = "playing"
        return sorted(changed | set(self._apply_now(owner)))

    def _transfer(self, target: str, source: str, auto_play: bool) -> list[str]:
        """music_assistant.transfer_queue: the source's queue moves to the target (the target plays when auto_play), the source goes idle."""
        s_owner, t_owner = self._queue_owner(source), self._queue_owner(target)
        q = self.queues.get(s_owner or "")
        if not q or not q["items"] or not s_owner or not t_owner:
            raise Refused("HomeAssistantError")  # nothing to transfer
        self.queues[t_owner] = self.queues.pop(s_owner)
        changed = set()
        for t in [s_owner, *self._members_of(s_owner)]:
            if self.ents[t]["state"] not in ("unavailable", "unknown"):
                self.ents[t]["state"] = "idle"
            changed.add(t)
        changed |= set(self._apply_now(s_owner))
        for t in [t_owner, *self._members_of(t_owner)]:
            if self.ents[t]["state"] not in ("unavailable", "unknown"):
                self.ents[t]["state"] = "playing" if auto_play else "paused"
            changed.add(t)
        changed |= set(self._apply_now(t_owner))
        return sorted(changed)

    def _leave(self, layer: str, eid: str) -> None:
        groups = self.groups.setdefault(layer, [])
        for g in list(groups):
            if g["leader"] == eid:
                rest = g["members"]
                if len(rest) >= 2:
                    g["leader"], g["members"] = rest[0], rest[1:]  # the group lives on with a new leader
                else:
                    groups.remove(g)
            elif eid in g["members"]:
                g["members"].remove(eid)
                if not g["members"]:
                    groups.remove(g)

    def _group_op(self, eid: str, service: str, members: list[str]) -> list[str]:
        """media_player.join / unjoin in the entity's own layer. A member that cannot be joined (unavailable, another platform, no GROUPING) fails
        the call like Home Assistant; a member that REFUSES (`_refuses` in its id, or /media-config join_refuse) is accepted and simply not joined."""
        e = self.ents[eid]
        layer = LAYER_OF.get(e["platform"])
        if layer is None:
            raise Refused("HomeAssistantError")
        groups = self.groups.setdefault(layer, [])
        if service == "unjoin":
            self._leave(layer, eid)
        else:
            for m in members:
                o = self.ents.get(m)
                if o is None or o["platform"] != e["platform"] or not int(o["attrs"].get("supported_features") or 0) & GROUPING or o["state"] in ("unavailable", "unknown"):
                    raise Refused("HomeAssistantError")
            effective = [m for m in members if m != eid and "_refuses" not in m and m not in self.join_refuse]
            if effective:
                own = next((g for g in groups if g["leader"] == eid), None)
                if own is None:
                    self._leave(layer, eid)
                    own = {"leader": eid, "members": []}
                    groups.append(own)
                for m in effective:
                    if m not in own["members"]:
                        self._leave(layer, m)
                        own["members"].append(m)
        return sorted(render_groups(self.ents, self.groups))


MODEL = Model()


# ------------------------------------------------------------------------------------------------ execute (the fake bridge)


def _log(domain: str, service: str, data: dict[str, Any], desc: dict[str, Any] | None, result: str, scheduled: bool) -> dict[str, Any]:
    with MODEL.lock:
        MODEL.n += 1
        entry: dict[str, Any] = {"n": MODEL.n, "at": time.strftime("%H:%M:%S"), "domain": domain, "service": service, "entity_id": data.get("entity_id"),
                                 "kind": (desc or {}).get("kind", "other"), "result": result, "effect": scheduled}
        for k in ("code", "text", "source", "activity", "output", "position", "shuffle", "repeat", "sound_mode", "members", "media_id", "media_type", "enqueue", "source_player", "area_id", "query", "provider"):
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


# ------------------------------------------------------------------------------------------------ media_query (bridge 0.5.0): the real HA response shapes, then the bridge's trim


def _version(v: str) -> tuple[int, ...]:
    return tuple(int(x) for x in re.findall(r"\d+", v)[:3])


def _raw_item(media_type: str, item: dict[str, Any]) -> dict[str, Any]:
    """A Music Assistant media item the way `music_assistant.get_library` / `search` return it: MORE than the bridge may let through
    (an image URL on the MA server, provider mappings with a URL, the provider item id)."""
    out: dict[str, Any] = {
        "media_type": media_type, "uri": lib_uri(media_type, item), "name": item["name"], "version": "", "image": f"{FAKE_IMAGE_HOST}/imageproxy?path=synthetic-{item['id']}",
        "favorite": bool(item["favorite"]), "provider": "library", "item_id": item["id"],
        "provider_mappings": [{"provider_domain": "spotify", "provider_instance": "spotify--synthetic", "item_id": f"sp-{item['id']}", "available": True, "url": f"https://open.example.invalid/{item['id']}"}],
    }
    if media_type == "track":
        out["artists"] = [{"media_type": "artist", "uri": "library://artist/x1", "name": item["artist"]}]
        out["album"] = {"media_type": "album", "uri": "library://album/a1", "name": item["album"]}
        out["duration"] = item["duration"]
    elif media_type == "album":
        out["artists"] = [{"media_type": "artist", "uri": "library://artist/x1", "name": item["artist"]}]
    return out


def raw_get_queue(entity_id: str) -> dict[str, Any]:
    """`music_assistant.get_queue` with return_response: `{entity_id: {queue_id, active, name, items (a COUNT), shuffle_enabled, repeat_mode,
    current_index, elapsed_time, current_item, next_item}}` - "now" and "up next" only, never the list (MA notes section 7)."""
    with MODEL.lock:
        owner = MODEL._queue_owner(entity_id) or entity_id
        q = MODEL.queues.get(owner) or {"items": [], "index": 0}
        attrs = MODEL.ents[entity_id]["attrs"]

        def entry(i: int) -> dict[str, Any] | None:
            if not (0 <= i < len(q["items"])):
                return None
            mt, iid = q["items"][i]
            it = lib_item(mt, iid)
            assert it is not None
            return {"queue_item_id": f"qi-{i:04d}", "name": it["name"], "duration": it.get("duration"), "media_item": _raw_item(mt, it), "stream_title": None,
                    "stream_details": {"provider": "spotify--synthetic", "item_id": f"sp-{iid}", "audio_format": {"content_type": "flac", "sample_rate": 44100}}}

        idx = q["index"] if q["items"] else None
        return {entity_id: {"queue_id": MODEL.ents[owner]["unique_id"], "active": bool(q["items"]), "name": MODEL.ents[owner]["attrs"].get("friendly_name"), "items": len(q["items"]),
                            "shuffle_enabled": bool(attrs.get("shuffle")), "repeat_mode": attrs.get("repeat") or "off", "current_index": idx,
                            "elapsed_time": float(attrs.get("media_position") or 0) if idx is not None else 0.0, "current_item": entry(idx) if idx is not None else None,
                            "next_item": entry(idx + 1) if idx is not None else None}}


def _filtered(media_type: str, favorite: bool | None, order_by: str, text: str | None = None) -> list[dict[str, Any]]:
    items = [i for i in LIBRARY[media_type] if (not favorite or i["favorite"]) and (not text or text.casefold() in i["name"].casefold())]
    return sorted(items, key=lambda i: i["name"]) if order_by == "name" else list(items)


def raw_get_library(args: dict[str, Any]) -> dict[str, Any]:
    """`music_assistant.get_library`: `{items: [...], limit, offset, order_by, media_type}` (the config entry id is the bridge's own business)."""
    mt, limit, offset, order = args["media_type"], int(args.get("limit", 50)), int(args.get("offset", 0)), args.get("order_by") or "name"
    items = _filtered(mt, args.get("favorite"), order)
    return {"items": [_raw_item(mt, i) for i in items[offset:offset + limit]], "limit": limit, "offset": offset, "order_by": order, "media_type": mt}


def raw_search(args: dict[str, Any]) -> dict[str, Any]:
    """`music_assistant.search` (phase 2b): one list per media type."""
    text, limit = str(args["search"]), int(args.get("limit", 10))
    plural = {"track": "tracks", "album": "albums", "artist": "artists", "playlist": "playlists", "radio": "radio"}
    return {plural[mt]: [_raw_item(mt, i) for i in _filtered(mt, None, "name", text)[:limit]] for mt in MEDIA_TYPES}


def _trim_item(raw: dict[str, Any]) -> dict[str, Any]:
    out = {"uri": raw["uri"], "media_type": raw["media_type"], "name": raw["name"]}
    if raw.get("artists"):
        out["artist"] = raw["artists"][0]["name"]
    return out


def _trim_queue_entry(raw: dict[str, Any] | None) -> dict[str, Any] | None:
    if raw is None:
        return None
    mi = raw["media_item"]
    return {"name": raw["name"], "artist": (mi.get("artists") or [{}])[0].get("name"), "album": (mi.get("album") or {}).get("name"), "duration": raw["duration"]}


def media_query(body: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    """POST /api/services/smplwise_bridge/media_query?return_response (bridge >= 0.5.0): read-only, fixed arguments, trimmed answer (CR-016 4.3).
    Returns (HTTP status, JSON). Older than 0.5.0 the service does not exist: HTTP 400 "not found", like Home Assistant for a missing service."""
    if _version(MODEL.bridge_version) < (0, 5, 0):
        return 400, {"message": "Service smplwise_bridge.media_query not found."}
    q, eid, rid = body.get("query"), str(body.get("entity_id") or ""), body.get("request_id")
    provider: str | None = None
    with MODEL.lock:
        e = MODEL.ents.get(eid)
        if MODEL.refuse:
            ans: dict[str, Any] = {"ok": False, "error": MODEL.refuse}
        elif q not in ("queue", "library") and not (q == "search" and MODEL.search_enabled):
            ans = {"ok": False, "error": "query_not_allowed"}  # `search` is phase 2b
        elif e is None:
            ans = {"ok": False, "error": "entity_not_found"}
        elif e["state"] in ("unavailable", "unknown"):
            ans = {"ok": False, "error": "entity_unavailable"}
        else:
            provider = "ma" if e["platform"] == "music_assistant" and MODEL.ma_loaded else "sonos" if e["platform"] == "sonos" else None
            if provider is None:
                ans = {"ok": False, "error": "no_library"}  # no Music Assistant entry loaded and no native provider: the panel shows no library tabs
            elif MODEL.query_fail:
                ans = {"ok": False, "error": "timeout"}
            elif q == "queue" and provider == "ma":
                raw = raw_get_queue(eid)[eid]
                ans = {"ok": True, "result": {"count": raw["items"], "index": raw["current_index"], "shuffle": raw["shuffle_enabled"], "repeat": raw["repeat_mode"],
                                              "current": _trim_queue_entry(raw["current_item"]), "next": _trim_queue_entry(raw["next_item"])}}
            elif q == "queue":  # Sonos without MA: position and size from the entity's attributes, no names beyond media_*
                ans = {"ok": True, "result": {"count": e["attrs"].get("queue_size"), "index": e["attrs"].get("queue_position"), "current": None, "next": None}}
            else:
                ans = _library_answer(q, provider, e, body)
        ans = {**ans, "request_id": rid, "query": q} | ({"provider": provider} if ans.get("ok") else {})
    _log("smplwise_bridge", "media_query", {"entity_id": eid or None}, {"kind": "query", "query": q, "provider": provider, "media_type": body.get("media_type")}, "ok" if ans.get("ok") else str(ans.get("error")), False)
    return 200, {"service_response": ans}


def _library_answer(q: str, provider: str, e: dict[str, Any], body: dict[str, Any]) -> dict[str, Any]:
    mt, fav, order, limit, offset = body.get("media_type"), body.get("favorite"), body.get("order_by") or "name", body.get("limit", 50), body.get("offset", 0)
    if q == "search":
        text = body.get("search")
        if provider != "ma" or not isinstance(text, str) or not (1 <= len(text) <= 80):
            return {"ok": False, "error": "arguments_invalid"}
        raw = raw_search({"search": text, "limit": min(int(body.get("limit", 10)), 25)})
        return {"ok": True, "result": {k: [_trim_item(i) for i in v] for k, v in raw.items()}}
    if provider == "ma":
        if (mt not in MEDIA_TYPES or not isinstance(fav, (bool, type(None))) or isinstance(limit, bool) or not isinstance(limit, int) or not (1 <= limit <= 100)
                or isinstance(offset, bool) or not isinstance(offset, int) or offset < 0 or order not in ("name", "last_played", "timestamp_added")):
            return {"ok": False, "error": "arguments_invalid"}
        raw = raw_get_library({"media_type": mt, "favorite": fav, "limit": limit, "offset": offset, "order_by": order})
        return {"ok": True, "result": {"items": [_trim_item(i) for i in raw["items"]], "offset": raw["offset"], "limit": raw["limit"]}}
    # Sonos without MA: the favourites are the entity's own `source_list`; a "station" is one named like a radio entry; no playlists (UNVERIFIED shape)
    names = [s for s in e["attrs"].get("source_list") or []]
    picked = [] if mt == "playlist" else [n for n in names if n.startswith("תחנת רדיו")] if mt == "radio" else names if mt in (None, "track", "album", "artist") else []
    return {"ok": True, "result": {"items": [{"name": n, "source": n} for n in picked], "offset": 0, "limit": len(picked)}}


# ------------------------------------------------------------------------------------------------ the fake Music Assistant server (CR-016 phase 2b)

FAKE_MA_HOST = "fake-ma.test"  # the live specs paste http://fake-ma.test:8095 and FAKE_MA_TOKEN in Settings > Multimedia > Connection
FAKE_MA_TOKEN = "fake-ma-fixture-token-0001"
FAKE_MA_SCHEMA = 28


def _qids(owner: str) -> list[str]:
    """Stable queue item ids of one queue, kept parallel to MODEL.queues[owner]['items'] (new rows get new ids, removed rows lose theirs)."""
    items = (MODEL.queues.get(owner) or {}).get("items") or []
    ids = MODEL.queue_ids.setdefault(owner, [])
    while len(ids) < len(items):
        ids.append(f"qi-{owner.split('.')[-1]}-{len(ids):04d}-{MODEL.n}")
    del ids[len(items):]
    return ids


def _ma_owner(player_id: str) -> str | None:
    eid = next((k for k, e in MODEL.ents.items() if e["platform"] == "music_assistant" and e.get("unique_id") == player_id), None)
    return (MODEL._queue_owner(eid) or eid) if eid else None


def _queue_by_id(queue_id: str) -> str | None:
    return next((k for k, e in MODEL.ents.items() if e["platform"] == "music_assistant" and e.get("unique_id") == queue_id), None)


def ma_rpc(command: str, args: dict[str, Any]) -> tuple[int, Any]:
    """`POST /api` of the fake MA server: the JSON-RPC answer `{message_id, result}` (or an `error_code`) for the commands ma_direct may send. Anything
    else is MA's own InvalidCommand (12). The queues are the fake HA model's own (a move here is what get_queue shows next)."""
    with MODEL.lock:
        MODEL.ma_calls.append(command)
        if command == "players/all":
            return 200, [{"player_id": e["unique_id"], "name": "synthetic"} for e in MODEL.ents.values() if e["platform"] == "music_assistant"]
        if command == "player_queues/get_active_queue":
            owner = _ma_owner(str(args.get("player_id")))
            if owner is None:
                return 400, {"error_code": 10, "details": "player not found"}
            q = MODEL.queues.get(owner) or {"items": [], "index": 0}
            idx = q["index"] if q["items"] else None
            attrs = MODEL.ents[owner]["attrs"]
            return 200, {"queue_id": MODEL.ents[owner]["unique_id"], "active": bool(q["items"]), "items": len(q["items"]), "current_index": idx,
                         "index_in_buffer": min(idx + 1, len(q["items"]) - 1) if idx is not None else None, "shuffle_enabled": bool(attrs.get("shuffle")),
                         "repeat_mode": attrs.get("repeat") or "off", "name": "synthetic"}
        if command == "player_queues/items":
            owner = _queue_by_id(str(args.get("queue_id")))
            if owner is None:
                return 400, {"error_code": 2, "details": "queue not found"}
            q = MODEL.queues.get(owner) or {"items": [], "index": 0}
            ids, off, lim = _qids(owner), int(args.get("offset", 0)), int(args.get("limit", 500))
            out = []
            for i in range(off, min(len(q["items"]), off + lim)):
                mt, iid = q["items"][i]
                it = lib_item(mt, iid)
                if it is not None:
                    out.append({"queue_item_id": ids[i], "name": it["name"], "duration": it.get("duration"), "sort_index": i, "media_item": _raw_item(mt, it)})
            return 200, out
        if command in ("player_queues/move_item", "player_queues/delete_item", "player_queues/clear"):
            owner = _queue_by_id(str(args.get("queue_id")))
            if owner is None or owner not in MODEL.queues:
                return 400, {"error_code": 8, "details": "queue empty"}
            q, ids = MODEL.queues[owner], _qids(owner)
            if command == "player_queues/clear":
                del q["items"][q["index"] + 1:]
                _qids(owner)
                return 200, None
            qid = args.get("queue_item_id") if command == "player_queues/move_item" else args.get("item_id_or_index")
            if qid not in ids:
                return 400, {"error_code": 3, "details": "item not found"}
            i = ids.index(qid)
            if i <= q["index"]:
                return 400, {"error_code": 11, "details": "cannot change the playing item"}
            row, rid = q["items"].pop(i), ids.pop(i)
            if command == "player_queues/move_item":
                j = max(q["index"] + 1, min(len(q["items"]), i + int(args.get("pos_shift", 1))))
                q["items"].insert(j, row)
                ids.insert(j, rid)
            return 200, None
        if command == "music/search":
            text, types, lim = str(args.get("search_query") or ""), args.get("media_types") or list(MEDIA_TYPES), int(args.get("limit", 25))
            plural = {"track": "tracks", "album": "albums", "artist": "artists", "playlist": "playlists", "radio": "radio"}
            return 200, {plural[mt]: [_raw_item(mt, i) for i in _filtered(mt, None, "name", text)[:lim]] for mt in MEDIA_TYPES if mt in types}
        return 400, {"error_code": 12, "details": "invalid command"}


def ma_http(method: str, path: str, headers: Any, content: bytes) -> tuple[int, Any]:
    """The fake MA server over HTTP: `GET /info` (no token), `POST /api` (Bearer FAKE_MA_TOKEN, else 401). `MODEL.ma_down` = unreachable."""
    if method == "GET" and path == "/info":
        return 200, {"server_id": "synthetic", "server_version": "2.10.4", "schema_version": FAKE_MA_SCHEMA, "min_supported_schema_version": 24, "homeassistant_addon": True, "onboard_done": True}
    if method == "POST" and path == "/api":
        if headers.get("authorization") != f"Bearer {FAKE_MA_TOKEN}":
            return 401, {"error_code": 20, "details": "authentication required"}
        body = json.loads(content or b"{}")
        return ma_rpc(str(body.get("command")), body.get("args") or {})  # the stateless HTTP API answers the RAW result (MA notes 2.1), not the WebSocket envelope
    return 404, {"error": "not found"}


def entity_area(body: dict[str, Any]) -> dict[str, Any]:
    """`smplwise_bridge.set_entity_area` / `entity_area` (admin only): the entity registry changes (an entity-level area overrides its device's)
    and the backend's sync is told. Refusals like the real bridge: entity_not_found, area_not_found."""
    eid, area = str(body.get("entity_id") or ""), body.get("area_id")
    err: str | None = None
    with WORLD.lock:
        row = next((x for x in WORLD.entities if x["entity_id"] == eid), None)
        if row is None:
            err = "entity_not_found"
        elif area not in {a["area_id"] for a in WORLD.areas}:
            err = "area_not_found"
        else:
            row["area_id"] = area
    _log("smplwise_bridge", "entity_area", {"entity_id": eid}, {"kind": "set_area", "area_id": area}, err or "ok", False)
    if err is None:
        WORLD.emit("entity_registry_updated", {"action": "update", "entity_id": eid})
    return {"ok": err is None, "context_id": None, "request_id": body.get("request_id"), **({"error": err} if err else {})}


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
        if request.url.host == FAKE_MA_HOST:  # CR-016 phase 2b: the direct Music Assistant connection
            if MODEL.ma_down:
                raise httpx.ConnectError("media_fake_ha: the fake Music Assistant server is down", request=request)
            status, answer = ma_http(request.method, request.url.path, request.headers, request.content)
            return httpx.Response(status, json=answer, request=request)
        if request.url.host == FAKE_HOST:
            path = request.url.path
            if request.method == "POST" and path == "/api/services/smplwise_bridge/execute":
                body = json.loads(request.content or b"{}")
                return httpx.Response(200, json={"service_response": execute(body)}, request=request)
            if request.method == "POST" and path in ("/api/services/smplwise_bridge/set_entity_area", "/api/services/smplwise_bridge/entity_area"):
                body = json.loads(request.content or b"{}")
                return httpx.Response(200, json={"service_response": entity_area(body)}, request=request)
            if request.method == "POST" and path == "/api/services/smplwise_bridge/media_query":
                status, answer = media_query(json.loads(request.content or b"{}"))
                return httpx.Response(status, json=answer, request=request)
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


def seed(house: str | None = None) -> dict[str, Any]:
    """Seeds a synthetic house (`tv` by default, or SW_FAKE_HOUSE): the dev registry route (entities, devices, areas, floors), the states, the
    fake WebSocket's registries; then a registry-updated event, which the real sync debounces into one refresh (it lists the registries over
    the WebSocket, devices with their connections and identifiers included)."""
    import httpx

    world = build_world(house or os.environ.get("SW_FAKE_HOUSE") or "tv")
    MODEL.load(world)
    ents, devs = registry_rows(world)
    with httpx.Client(timeout=60) as c:
        registry_ok = c.post(f"{BASE}/ha/dev/registry", json={"entities": ents, "devices": devs, "areas": world["areas"], "floors": world["floors"]}).status_code == 200
        states = MODEL.payloads()  # an entity disabled by its config entry has no state: it is in the registry only
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
            self._reply(200, summary_of(build_world((parse_qs(url.query).get("house") or [MODEL.house])[0])))
            return
        if url.path == "/raw":  # the real HA response shapes of music_assistant.get_queue / get_library / search (what the bridge must trim)
            q = {k: v[0] for k, v in parse_qs(url.query).items()}
            try:
                with MODEL.lock:
                    if q.get("service") == "get_queue":
                        out: Any = raw_get_queue(q["entity_id"])
                    elif q.get("service") == "get_library":
                        out = raw_get_library({"media_type": q["media_type"], "favorite": q.get("favorite") == "true", "limit": int(q.get("limit", 50)), "offset": int(q.get("offset", 0)), "order_by": q.get("order_by")})
                    elif q.get("service") == "search":
                        out = raw_search({"search": q["search"], "limit": int(q.get("limit", 10))})
                    else:
                        return self._reply(404, {"error": "unknown_service"})
            except (KeyError, ValueError):
                return self._reply(422, {"error": "bad_arguments"})
            self._reply(200, out)
            return
        with WORLD.lock:
            sockets = len(WORLD.sockets)
        if MODEL.allowed is None:
            MODEL.allowed = _bridge_allowed()
        with MODEL.lock:
            self._reply(200, {"sockets": sockets, "calls": MODEL.n, "pending": MODEL.pending, "bridge_version": MODEL.bridge_version, "effect_delay": MODEL.effect_delay,
                              "refuse": MODEL.refuse, "entities": len(MODEL.ents), "artwork_fetches": MODEL.artwork_calls, "house": MODEL.house,
                              "allowed_missing": sorted(f"{d}.{s}" for d, s in BRIDGE_050_SERVICES - MODEL.allowed), "groups": copy.deepcopy(MODEL.groups),
                              "ma_loaded": MODEL.ma_loaded, "search_enabled": MODEL.search_enabled, "query_fail": MODEL.query_fail, "join_refuse": sorted(MODEL.join_refuse)})

    def do_POST(self) -> None:  # noqa: N802
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"{}")
        path = urlsplit(self.path).path
        if path == "/seed-media":
            try:
                self._reply(200, seed(body.get("house") if isinstance(body, dict) else None))
            except ValueError:
                self._reply(422, {"error": "unknown_house"})
        elif path == "/bridge-exec":  # drive the fake bridge as the add-on's execute call would
            self._reply(200, execute(body))
        elif path == "/bridge-query":
            status, answer = media_query(body)
            self._reply(status, answer)
        elif path == "/bridge-area":  # the entity registry write, as the add-on's set_entity_area call would make it
            self._reply(200, entity_area(body))
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
            for flag in ("search_enabled", "query_fail", "ma_loaded", "ma_down"):
                if isinstance(body.get(flag), bool):
                    setattr(MODEL, flag, body[flag])
            if isinstance(body.get("join_refuse"), list):
                MODEL.join_refuse = {str(x) for x in body["join_refuse"]}
            if MODEL.allowed is None:
                MODEL.allowed = _bridge_allowed()
            if body.get("allow_reset"):
                MODEL.allowed = _bridge_allowed()
            for pair in body.get("allow_extra") or []:
                MODEL.allowed = MODEL.allowed | {(str(pair[0]), str(pair[1]))}
            if isinstance(body.get("bridge_version"), str):
                MODEL.bridge_version = body["bridge_version"]
                status = ping(MODEL.bridge_version)
            self._reply(200, {"ok": True, "bridge_version": MODEL.bridge_version, "ping": status, "effect_delay": MODEL.effect_delay, "refuse": MODEL.refuse,
                              "search_enabled": MODEL.search_enabled, "query_fail": MODEL.query_fail, "ma_loaded": MODEL.ma_loaded, "join_refuse": sorted(MODEL.join_refuse)})
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
