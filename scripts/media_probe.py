"""CR-015 phase 0: READ-ONLY probe of the media devices on a Home Assistant instance (docs/changes/CR-015-MEDIA-SCREENS.md
section 15.2). The OWNER runs it on his own systems; nobody else runs it against a real system.

It answers the open questions of docs/research/TV_REMOTE_INTEGRATIONS_NOTES.md section 12 and MUSIC_ASSISTANT_API_NOTES.md
from a real system: which integrations register a MAC / identifiers in the device registry (and how they are written), how
many physical screens the dedupe ladder of CR 3.3 would make of the entities, how the integrations report power / art mode
/ sources / sound output, the exact feature bit-masks, the attribute key sets, the LG button list, and more - as STRUCTURE
ONLY: counts, key sets, value types, closed enumerations. Never a name, an entity id, a device id, a MAC, an address, an
identifier, a unique id, a URL, a token or a host. Nothing raw is written: there is no raw dump at all, only summary.json.

Read-only by construction: the only WebSocket message types it can send are in ALLOWED_WS_TYPES (`auth`, `get_states`,
`config/entity_registry/list`, `config/device_registry/list`, `get_services`). Anything else raises ProbeRefused before it is
sent (tests/test_media_probe.py). No service is called, no event is subscribed to, nothing is written to Home Assistant.

    python scripts/media_probe.py <env-file> [--url-var NAME] [--token-var NAME] [--label NAME] [--out DIR] [--no-write]

- `<env-file>`: KEY=VALUE lines. The URL and the token are read from it (default variable names `SW_PROBE_HA_URL` / `HA_URL`
  and `SW_PROBE_HA_TOKEN` / `HA_TOKEN`; override with --url-var / --token-var). Only the NAMES of variables appear on the
  command line; values are never printed, logged or put in an error message. Use a long-lived token of an ADMINISTRATOR:
  the registry listings are administrator commands (with another token they answer `unauthorized`; the probe then reports
  the state-based part only and says so).
- `--label NAME`: tells the two systems apart in the output folder (`home`, `office`; letters, digits, - and _ only).
- `--out DIR`: the output folder; it must be inside the repository's git-ignored `private-evidence/` folder. Default:
  `private-evidence/media-probe-<YYYY-MM-DD>[-<label>]/`.
- `--no-write`: print the summary only.

The summary is checked before it is printed or written: a string that looks like a MAC, an address, a URL, a UUID or an
entity id aborts the run (ProbeError) instead of being written.
"""
from __future__ import annotations

import argparse
import asyncio
import collections
import datetime as dt
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any, Awaitable, Callable, Protocol

REPO = Path(__file__).resolve().parents[1]
PRIVATE_EVIDENCE = REPO / "private-evidence"
PROBE_VERSION = 1

# The complete list of WebSocket message types this script may ever send.
ALLOWED_WS_TYPES = frozenset({
    "auth",
    "get_states",
    "config/entity_registry/list",
    "config/device_registry/list",
    "get_services",
})

# Integration domains / platforms whose NAME is printed as it is; any other platform is reported as "other" (a custom
# integration's name can be a product or a person's name).
KNOWN_PLATFORMS = frozenset({
    "samsungtv_smart", "samsungtv", "webostv", "androidtv_remote", "androidtv", "braviatv", "philips_js", "cast", "dlna_dmr", "dlna_dms",
    "smartthings", "music_assistant", "sonos", "denonavr", "yamaha_musiccast", "heos", "bluesound", "apple_tv", "roku", "kodi", "alexa_media",
    "squeezebox", "mpd", "snapcast", "linkplay", "onkyo", "yamaha", "harmony", "hdmi_cec", "panasonic_viera", "vizio", "lg_netcast",
    "bravia", "spotify", "plex", "jellyfin", "emby",
})  # integrations with a fixed attribute set; user-defined ones (template, mqtt, esphome, group, universal) are "other": their attribute names can be private
KNOWN_MANUFACTURERS = frozenset({"samsung", "lg", "sony", "google", "philips", "panasonic", "tcl", "xiaomi", "hisense", "sharp", "denon", "marantz", "yamaha", "onkyo", "sonos", "apple", "amazon", "roku", "nvidia", "vizio", "bose"})
KNOWN_STATES = frozenset({"on", "off", "playing", "paused", "idle", "standby", "buffering", "unavailable", "unknown"})
KNOWN_DEVICE_CLASSES = frozenset({"tv", "speaker", "receiver", "projector"})
KNOWN_CONNECTION_TYPES = frozenset({"mac", "upnp", "bluetooth", "zigbee", "ip", "serial", "network_ip"})
KNOWN_ART_STATUS = frozenset({"on", "off", "unavailable"})
KNOWN_CONTENT_TYPES = frozenset({"music", "video", "tvshow", "movie", "episode", "channel", "app", "image", "playlist", "url", "season", "album", "artist", "track"})
KNOWN_MASS_TYPES = frozenset({"player", "group", "stereo_pair", "protocol", "display", "source"})
KNOWN_DISABLED_BY = frozenset({"user", "integration", "config_entry", "device", "hass"})
STANDARD_SERVICE_DOMAINS = KNOWN_PLATFORMS | {"media_player", "remote"}
SERVICE_DOMAINS_LISTED = ("media_player", "remote", "webostv", "samsungtv_smart", "androidtv_remote", "androidtv", "cast", "music_assistant", "samsungtv", "denonavr", "smartthings")
CLOSED_LIST_FIELDS = (("webostv", "button", "button"), ("webostv", "select_sound_output", "sound_output"))  # selectors whose options are a closed list

MEDIA_DOMAINS = ("media_player", "remote")
# media_player.MediaPlayerEntityFeature / remote.RemoteEntityFeature (docs: TV notes 3.4)
PLAYER_FEATURES = {
    1: "PAUSE", 2: "SEEK", 4: "VOLUME_SET", 8: "VOLUME_MUTE", 16: "PREVIOUS_TRACK", 32: "NEXT_TRACK", 128: "TURN_ON", 256: "TURN_OFF", 512: "PLAY_MEDIA", 1024: "VOLUME_STEP",
    2048: "SELECT_SOURCE", 4096: "STOP", 8192: "CLEAR_PLAYLIST", 16384: "PLAY", 32768: "SHUFFLE_SET", 65536: "SELECT_SOUND_MODE", 131072: "BROWSE_MEDIA", 262144: "REPEAT_SET",
    524288: "GROUPING", 1048576: "MEDIA_ANNOUNCE", 2097152: "MEDIA_ENQUEUE", 4194304: "SEARCH_MEDIA",
}
REMOTE_FEATURES = {1: "LEARN_COMMAND", 2: "DELETE_COMMAND", 4: "ACTIVITY"}
TURN_ON_BIT = 128
# the heuristic of CR 7.4: these names are inputs (a source); anything else in a merged list is an app / a channel
SOURCE_NAME = re.compile(r"^(tv|live tv|hdmi\s*\d*|av\d*|usb\d*|component\d*|antenna|cable|satellite|dvi|vga|pc|input\s*\d*|arc|optical|bluetooth|aux\d*)(\s|$)", re.I)

ATTRIBUTE_NAME = re.compile(r"^[a-z_][a-z0-9_]{0,63}$")
TOKEN_VALUE = re.compile(r"^[a-z][a-z0-9_]{1,31}$")  # a closed-token enumeration value (sound_output, ...)
MAC_RE = re.compile(r"^(?:[0-9a-f]{2}[:\-.]?){5}[0-9a-f]{2}$", re.I)
MAC_FIND = re.compile(r"(?:[0-9a-f]{2}[:\-]){5}[0-9a-f]{2}", re.I)
UUID_RE = re.compile(r"^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$", re.I)
ENTITY_ID_RE = re.compile(r"^[a-z_]+\.[a-z0-9_]+$")
IP_FIND = re.compile(r"\b\d{1,3}(?:\.\d{1,3}){3}\b")
URL_FIND = re.compile(r"[a-z][a-z0-9+.\-]*://", re.I)
LABEL_RE = re.compile(r"^[A-Za-z0-9_\-]{1,24}$")


class ProbeRefused(Exception):
    """A message type outside ALLOWED_WS_TYPES was about to be sent. Never caught by the probe itself."""


class ProbeError(Exception):
    """A failure the probe reports by class and short reason only (never a value from the system)."""


def guard(msg_type: str) -> None:
    if msg_type not in ALLOWED_WS_TYPES:
        raise ProbeRefused(f"message type not allowed in the read-only probe: {msg_type!r}")


# ---------------------------------------------------------------- transport


class Connection(Protocol):
    async def send(self, obj: dict[str, Any]) -> None: ...

    async def recv(self, timeout: float | None = None) -> dict[str, Any] | None: ...

    async def close(self) -> None: ...


class WsConnection:
    """The real transport (the `websockets` package). Nothing here logs frames."""

    def __init__(self, ws: Any) -> None:
        self._ws = ws

    async def send(self, obj: dict[str, Any]) -> None:
        await self._ws.send(json.dumps(obj))

    async def recv(self, timeout: float | None = None) -> dict[str, Any] | None:
        try:
            raw = await asyncio.wait_for(self._ws.recv(), timeout) if timeout is not None else await self._ws.recv()
        except asyncio.TimeoutError:
            return None
        return json.loads(raw)

    async def close(self) -> None:
        await self._ws.close()


async def open_ws(base_url: str) -> Connection:
    import websockets  # imported late: the pure functions and the tests do not need it

    url = ("wss://" if base_url.startswith("https://") else "ws://") + base_url.split("://", 1)[1].rstrip("/") + "/api/websocket"
    return WsConnection(await websockets.connect(url, max_size=128 * 1024 * 1024, open_timeout=15))


class Session:
    """One authenticated connection; `call` checks the allow-list before anything is sent."""

    def __init__(self, conn: Connection) -> None:
        self.conn = conn
        self._id = 0
        self.ha_version: str | None = None
        self.sent_types: list[str] = []

    async def authenticate(self, token: str) -> bool:
        first = await self.conn.recv(15)
        if not first or first.get("type") != "auth_required":
            raise ProbeError("no auth_required frame")
        version = first.get("ha_version")
        self.ha_version = version if isinstance(version, str) and re.match(r"^[0-9][0-9A-Za-z.\-+]{0,30}$", version) else None
        guard("auth")
        self.sent_types.append("auth")
        await self.conn.send({"type": "auth", "access_token": token})
        answer = await self.conn.recv(15)
        return bool(answer and answer.get("type") == "auth_ok")

    async def call(self, msg_type: str, timeout: float = 120, **fields: Any) -> dict[str, Any]:
        guard(msg_type)
        self._id += 1
        mid = self._id
        self.sent_types.append(msg_type)
        await self.conn.send({"id": mid, "type": msg_type, **fields})
        deadline = time.monotonic() + timeout
        while True:
            left = deadline - time.monotonic()
            frame = await self.conn.recv(max(left, 0.01)) if left > 0 else None
            if frame is None:
                raise ProbeError(f"no answer to {msg_type}")
            if frame.get("id") == mid and frame.get("type") == "result":
                return frame


def error_code(frame: dict[str, Any]) -> str:
    code = (frame.get("error") or {}).get("code")
    return code if isinstance(code, str) and re.fullmatch(r"[a-z_]{3,40}", code) else "error"


# ---------------------------------------------------------------- structure helpers (no values)


def vtype(v: Any) -> str:
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "bool"
    if isinstance(v, int):
        return "int"
    if isinstance(v, float):
        return "float"
    if isinstance(v, str):
        return "str"
    if isinstance(v, list):
        return "list"
    if isinstance(v, dict):
        return "dict"
    return type(v).__name__


def enum_or_type(v: Any, known: frozenset[str] | set[str]) -> str:
    """A closed-enumeration value as it is, anything else as its type."""
    return v if isinstance(v, str) and v in known else f"<{vtype(v)}>"


def token_or_type(v: Any) -> str:
    """A value that is a short lower-case token (an enumeration of the integration) as it is, anything else as its type."""
    return v if isinstance(v, str) and TOKEN_VALUE.match(v) and "." not in v else f"<{vtype(v)}>"


def platform_label(p: Any) -> str:
    if p is None:
        return "unregistered"
    return p if isinstance(p, str) and p in KNOWN_PLATFORMS else "other"


def id_shape(v: Any) -> str:
    """The SHAPE of an identifier / unique id (never the value): mac, uuid, uuid_prefixed, entity_id, hex12, hex32, numeric, alnum, other."""
    if not isinstance(v, str):
        return f"<{vtype(v)}>"
    s = v.strip()
    if MAC_RE.match(s) and (":" in s or "-" in s):
        return "mac"
    if UUID_RE.match(s):
        return "uuid"
    if s.lower().startswith("uuid:") and UUID_RE.match(s[5:]):
        return "uuid_prefixed"
    if ENTITY_ID_RE.match(s):
        return "entity_id"
    if re.fullmatch(r"[0-9a-f]{12}", s, re.I):
        return "hex12"
    if re.fullmatch(r"[0-9a-f]{32}", s, re.I):
        return "hex32"
    if re.fullmatch(r"\d+", s):
        return "numeric"
    if re.fullmatch(r"[A-Za-z0-9]{10,}", s):
        return "alnum"
    return "other"


def norm_id(v: Any) -> str:
    """The normal form the ladder compares identifiers in (CR 3.3 rung 4): lower case, `uuid:` prefix and dashes stripped."""
    s = str(v).strip().lower()
    return s.removeprefix("uuid:").replace("-", "")


def norm_mac(v: Any) -> str:
    return re.sub(r"[^0-9a-f]", "", str(v).lower())


def bucket(n: int) -> str:
    for hi, label in ((0, "0"), (5, "1-5"), (15, "6-15"), (30, "16-30"), (100, "31-100")):
        if n <= hi:
            return label
    return ">100"


def counter(c: collections.Counter) -> dict[str, int]:
    return {str(k): v for k, v in sorted(c.items(), key=lambda kv: (-kv[1], str(kv[0])))}


def key_sets(rows: list[dict[str, Any]]) -> dict[str, list[str]]:
    """{keys: union, always: keys present in every row, sometimes: keys missing from some row} - names that look like attribute names only."""
    if not rows:
        return {"keys": [], "always": [], "sometimes": []}
    sets = [{str(k) for k in r if ATTRIBUTE_NAME.match(str(k))} for r in rows]
    union, inter = set().union(*sets), set.intersection(*sets)
    return {"keys": sorted(union), "always": sorted(inter), "sometimes": sorted(union - inter)}


def key_types(rows: list[dict[str, Any]]) -> dict[str, list[str]]:
    out: dict[str, set[str]] = collections.defaultdict(set)
    for r in rows:
        for k, v in r.items():
            if ATTRIBUTE_NAME.match(str(k)):
                out[str(k)].add(vtype(v))
    return {k: sorted(v) for k, v in sorted(out.items())}


def feature_names(mask: Any, table: dict[int, str]) -> list[str]:
    if isinstance(mask, bool) or not isinstance(mask, int):
        return []
    return [name for bit, name in table.items() if mask & bit]


def source_kind(item: Any) -> str:
    if not isinstance(item, str):
        return f"<{vtype(item)}>"
    return "input" if SOURCE_NAME.match(item.strip()) else "other"


# ---------------------------------------------------------------- the ladder (CR 3.3 rungs 1-4 + the guard), counts only


def ladder_preview(endpoints: list[dict[str, Any]], devices: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """Independent of the backend's services/media_model.py on purpose: the same rules, run on the owner's real registry, so
    the two can be compared. `endpoints`: [{entity_id, platform, device_id, unique_id, area_id, name}]. Returns counts."""
    by_id = {e["entity_id"]: e for e in endpoints}
    parent = {e["entity_id"]: e["entity_id"] for e in endpoints}
    merged = collections.Counter()
    guard_pairs: set[tuple[int, str, str, str]] = set()

    def find(x: str) -> str:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a: str, b: str, rung: int) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb
            merged[str(rung)] += 1

    # rung 1: the same HA device
    by_device: dict[str, list[str]] = collections.defaultdict(list)
    for e in endpoints:
        if e.get("device_id"):
            by_device[e["device_id"]].append(e["entity_id"])
    for members in by_device.values():
        for m in members[1:]:
            union(members[0], m, 1)
    # rung 2: the Music Assistant loop (an MA-created entity whose player id is an HA media_player entity id, or whose device is
    # ("music_assistant", <such an id>))
    ma_imports = ma_exports = 0
    for e in endpoints:
        if e.get("platform") != "music_assistant":
            continue
        targets = {e.get("unique_id")}
        dev = devices.get(e.get("device_id") or "", {})
        targets |= {i[1] for i in dev.get("identifiers", []) if len(i) == 2 and i[0] == "music_assistant"}
        hit = next((t for t in targets if isinstance(t, str) and t in by_id and t != e["entity_id"]), None)
        if hit:
            ma_exports += 1
            union(e["entity_id"], hit, 2)
        elif isinstance(e.get("unique_id"), str) and e["unique_id"].startswith("media_player."):
            ma_imports += 1
    # rungs 3 and 4 across devices; never two endpoints of the same platform on different devices, never the MA device
    macs: dict[str, set[str]] = collections.defaultdict(set)  # normalised mac -> device ids
    ids: dict[str, set[str]] = collections.defaultdict(set)
    for did, dev in devices.items():
        for c in dev.get("connections", []):
            if len(c) == 2 and c[0] == "mac":
                macs[norm_mac(c[1])].add(did)
        for i in dev.get("identifiers", []):
            if len(i) == 2 and i[0] != "music_assistant":
                ids[norm_id(i[1])].add(did)
    for rung, table in ((3, macs), (4, ids)):
        for _key, dids in table.items():
            if len(dids) < 2:
                continue
            members = [e for e in endpoints if e.get("device_id") in dids and e.get("platform") != "music_assistant"]
            for a in members:
                for b in members:
                    if a["entity_id"] >= b["entity_id"] or a["device_id"] == b["device_id"]:
                        continue
                    if a.get("platform") == b.get("platform"):
                        guard_pairs.add((rung, *sorted((a["device_id"], b["device_id"])), platform_label(a.get("platform"))))  # device pairs, not entity pairs
                        continue
                    union(a["entity_id"], b["entity_id"], rung)
    clusters: dict[str, list[dict[str, Any]]] = collections.defaultdict(list)
    for e in endpoints:
        clusters[find(e["entity_id"])].append(e)
    sizes = collections.Counter(len(c) for c in clusters.values())
    mixes = collections.Counter("+".join(sorted({platform_label(e.get("platform")) + ("/" + e["domain"] if e.get("domain") else "") for e in c})) for c in clusters.values() if len(c) > 1)
    # rung 5 (weak, a suggestion only): the same area and the same normalised name in two different clusters
    def norm_name(n: Any) -> str:
        s = re.sub(r"\b(samsung|lg|sony|philips|tv|cast|dlna|smartthings|webos|android|google|remote|media|player)\b", " ", str(n or "").lower())
        return re.sub(r"[\W_\d]+", "", s, flags=re.UNICODE)

    weak = 0
    keyed: dict[tuple[str, str], set[str]] = collections.defaultdict(set)
    for e in endpoints:
        area, nm = e.get("area_id"), norm_name(e.get("name"))
        if area and nm:
            keyed[(area, nm)].add(find(e["entity_id"]))
    for clusters_of_key in keyed.values():
        if len(clusters_of_key) > 1:
            weak += len(clusters_of_key) - 1
    guard_blocked = collections.Counter(f"rung{g[0]}" for g in guard_pairs)
    return {
        "endpoints": len(endpoints),
        "physical_devices": len(clusters),
        "merged_by_rung": dict(sorted(merged.items())),
        "blocked_by_same_platform_guard": dict(sorted(guard_blocked.items())),
        "cluster_sizes": {str(k): v for k, v in sorted(sizes.items())},
        "cluster_platform_mixes": counter(mixes),
        "weak_name_suggestions": weak,
        "music_assistant": {"exports_joined": ma_exports, "entity_id_shaped_unique_id_unmatched": ma_imports},
    }


# ---------------------------------------------------------------- the summary


def summarize_states(states: list[dict[str, Any]], registry: dict[str, dict[str, Any]] | None) -> dict[str, Any]:
    """Per platform structure of the media_player / remote states. `registry`: entity_id -> registry row (None: not available)."""
    rows = [s for s in states if isinstance(s, dict) and isinstance(s.get("entity_id"), str) and s["entity_id"].split(".", 1)[0] in MEDIA_DOMAINS]
    per: dict[str, list[dict[str, Any]]] = collections.defaultdict(list)
    for s in rows:
        platform = platform_label((registry or {}).get(s["entity_id"], {}).get("platform")) if registry is not None else "registry_unavailable"
        per[platform].append(s)
    out: dict[str, Any] = {}
    for platform, items in sorted(per.items()):
        detail = platform in KNOWN_PLATFORMS
        block: dict[str, Any] = {"entities": len(items), "by_domain": counter(collections.Counter(i["entity_id"].split(".", 1)[0] for i in items)), "states": counter(collections.Counter(enum_or_type(i.get("state"), KNOWN_STATES) for i in items))}
        if not detail:
            out[platform] = block
            continue
        players = [i for i in items if i["entity_id"].startswith("media_player.")]
        remotes = [i for i in items if i["entity_id"].startswith("remote.")]
        attrs = [i.get("attributes") or {} for i in players]
        block["media_player"] = {
            "device_class": counter(collections.Counter(enum_or_type(a.get("device_class"), KNOWN_DEVICE_CLASSES) if a.get("device_class") is not None else "none" for a in attrs)),
            "attribute_keys": key_sets(attrs),
            "attribute_types": key_types(attrs),
            "feature_masks": counter(collections.Counter(a.get("supported_features") if isinstance(a.get("supported_features"), int) and not isinstance(a.get("supported_features"), bool) else f"<{vtype(a.get('supported_features'))}>" for a in attrs)),
            "features": counter(collections.Counter(name for a in attrs for name in feature_names(a.get("supported_features"), PLAYER_FEATURES))),
            # LG: the state of an entity with / without a turn-on automation (TV notes 12.4) and the like, for every platform
            "turn_on_bit_by_state": counter(collections.Counter(f"turn_on={bool(isinstance(a.get('supported_features'), int) and a['supported_features'] & TURN_ON_BIT)}|state={enum_or_type(i.get('state'), KNOWN_STATES)}" for i, a in zip(players, attrs))),
            "source_list": {
                "present": sum(1 for a in attrs if isinstance(a.get("source_list"), list)),
                "length": counter(collections.Counter(bucket(len(a["source_list"])) for a in attrs if isinstance(a.get("source_list"), list))),
                "item_types": sorted({vtype(x) for a in attrs if isinstance(a.get("source_list"), list) for x in a["source_list"]}),
                "item_kind_heuristic": counter(collections.Counter(source_kind(x) for a in attrs if isinstance(a.get("source_list"), list) for x in a["source_list"])),
                "current_source_in_list": counter(collections.Counter(("yes" if a.get("source") in a["source_list"] else "no") for a in attrs if isinstance(a.get("source_list"), list) and a.get("source") is not None)),
            },
            "sound_output": counter(collections.Counter(token_or_type(a["sound_output"]) for a in attrs if "sound_output" in a)),
            "sound_mode_list_length": counter(collections.Counter(bucket(len(a["sound_mode_list"])) for a in attrs if isinstance(a.get("sound_mode_list"), list))),
            "art_mode_status": counter(collections.Counter(enum_or_type(a["art_mode_status"], KNOWN_ART_STATUS) for a in attrs if "art_mode_status" in a)),
            "state_with_art_mode_status": counter(collections.Counter(f"{enum_or_type(i.get('state'), KNOWN_STATES)}|{enum_or_type(a['art_mode_status'], KNOWN_ART_STATUS)}" for i, a in zip(players, attrs) if "art_mode_status" in a)),
            "media_content_type": counter(collections.Counter(enum_or_type(a["media_content_type"], KNOWN_CONTENT_TYPES) for a in attrs if "media_content_type" in a)),
            "with_app_id": sum(1 for a in attrs if a.get("app_id") is not None),
            "with_entity_picture": sum(1 for a in attrs if a.get("entity_picture") is not None),
            "with_entity_picture_local": sum(1 for a in attrs if a.get("entity_picture_local") is not None),
            "volume_level": {"float_0_1": sum(1 for a in attrs if isinstance(a.get("volume_level"), float) and 0 <= a["volume_level"] <= 1), "other_type_or_range": sum(1 for a in attrs if "volume_level" in a and not (isinstance(a["volume_level"], float) and 0 <= a["volume_level"] <= 1))},
            "mass_player_type": counter(collections.Counter(enum_or_type(a["mass_player_type"], KNOWN_MASS_TYPES) for a in attrs if "mass_player_type" in a)),
            "group_members_present": sum(1 for a in attrs if isinstance(a.get("group_members"), list)),
        }
        rattrs = [i.get("attributes") or {} for i in remotes]
        if remotes:
            block["remote"] = {
                "attribute_keys": key_sets(rattrs),
                "attribute_types": key_types(rattrs),
                "feature_masks": counter(collections.Counter(a.get("supported_features") if isinstance(a.get("supported_features"), int) and not isinstance(a.get("supported_features"), bool) else f"<{vtype(a.get('supported_features'))}>" for a in rattrs)),
                "features": counter(collections.Counter(name for a in rattrs for name in feature_names(a.get("supported_features"), REMOTE_FEATURES))),
                "activity_list_length": counter(collections.Counter(bucket(len(a["activity_list"])) for a in rattrs if isinstance(a.get("activity_list"), list))),
                "current_activity_in_list": counter(collections.Counter(("yes" if a.get("current_activity") in a["activity_list"] else "no") for a in rattrs if isinstance(a.get("activity_list"), list) and a.get("current_activity") is not None)),
            }
        out[platform] = block
    return out


def summarize_registry(entity_rows: list[dict[str, Any]], device_rows: list[dict[str, Any]], states: list[dict[str, Any]]) -> dict[str, Any]:
    """The registry-based part: how integrations register devices, and the dedupe ladder's effect on this system."""
    media = [r for r in entity_rows if isinstance(r, dict) and isinstance(r.get("entity_id"), str) and r["entity_id"].split(".", 1)[0] in MEDIA_DOMAINS]
    device_by_id = {d["id"]: d for d in device_rows if isinstance(d, dict) and isinstance(d.get("id"), str)}
    friendly = {s["entity_id"]: (s.get("attributes") or {}).get("friendly_name") for s in states if isinstance(s, dict) and isinstance(s.get("entity_id"), str)}
    platforms = collections.Counter(platform_label(r.get("platform")) for r in media)
    per: dict[str, Any] = {}
    for platform in sorted(platforms):
        rs = [r for r in media if platform_label(r.get("platform")) == platform]
        dids = {r["device_id"] for r in rs if r.get("device_id") in device_by_id}
        devs = [device_by_id[d] for d in dids]
        block: dict[str, Any] = {
            "entities": len(rs),
            "without_device": sum(1 for r in rs if not r.get("device_id")),
            "disabled_by": counter(collections.Counter(enum_or_type(r["disabled_by"], KNOWN_DISABLED_BY) for r in rs if r.get("disabled_by") is not None)),
            "hidden": sum(1 for r in rs if r.get("hidden_by") is not None),
            "with_entity_area": sum(1 for r in rs if r.get("area_id")),
            "unique_id_shape": counter(collections.Counter(id_shape(r.get("unique_id")) for r in rs)),
            "devices": len(devs),
            "devices_with_area": sum(1 for d in devs if d.get("area_id")),
            "connection_types": counter(collections.Counter(enum_or_type(c[0], KNOWN_CONNECTION_TYPES) for d in devs for c in d.get("connections", []) if isinstance(c, (list, tuple)) and len(c) == 2)),
            "devices_with_mac": sum(1 for d in devs if any(isinstance(c, (list, tuple)) and len(c) == 2 and c[0] == "mac" for c in d.get("connections", []))),
            "mac_format": counter(collections.Counter(("lower_colon" if re.fullmatch(r"(?:[0-9a-f]{2}:){5}[0-9a-f]{2}", str(c[1])) else "other_format") for d in devs for c in d.get("connections", []) if isinstance(c, (list, tuple)) and len(c) == 2 and c[0] == "mac")),
            "identifier_domains": counter(collections.Counter(platform_label(i[0]) for d in devs for i in d.get("identifiers", []) if isinstance(i, (list, tuple)) and len(i) == 2)),
            "identifier_shape": counter(collections.Counter(f"{platform_label(i[0])}:{id_shape(i[1])}" for d in devs for i in d.get("identifiers", []) if isinstance(i, (list, tuple)) and len(i) == 2)),
            "manufacturer": counter(collections.Counter((str(d.get("manufacturer") or "").strip().lower() if str(d.get("manufacturer") or "").strip().lower() in KNOWN_MANUFACTURERS else ("none" if not d.get("manufacturer") else "other")) for d in devs)),
            "device_key_sets": key_sets(devs),
            "devices_with_several_media_entities": sum(1 for d in dids if sum(1 for r in rs if r.get("device_id") == d) > 1),
        }
        per[platform] = block
    endpoints = [{"entity_id": r["entity_id"], "domain": r["entity_id"].split(".", 1)[0], "platform": r.get("platform"), "device_id": r.get("device_id") if r.get("device_id") in device_by_id else None, "unique_id": r.get("unique_id"),
                  "area_id": r.get("area_id") or (device_by_id.get(r.get("device_id") or "", {}) or {}).get("area_id"), "name": r.get("name") or r.get("original_name") or friendly.get(r["entity_id"])}
                 for r in media if not r.get("disabled_by")]
    devices = {d: {"connections": [list(c) for c in dev.get("connections", []) if isinstance(c, (list, tuple))], "identifiers": [list(i) for i in dev.get("identifiers", []) if isinstance(i, (list, tuple))], "area_id": dev.get("area_id")} for d, dev in device_by_id.items()}
    return {"media_entities": len(media), "enabled_media_entities": len(endpoints), "platforms": counter(platforms), "by_platform": per, "ladder": ladder_preview(endpoints, devices)}


def summarize_services(services: Any) -> dict[str, Any]:
    """Service names of the media-relevant integrations, verbatim for the known domains (a custom integration's service id can
    carry a private name), plus the closed button / sound-output lists of the LG integration."""
    if not isinstance(services, dict):
        return {"unavailable": True}
    listed: dict[str, list[str]] = {}
    fields: dict[str, dict[str, list[str]]] = {}
    for domain in SERVICE_DOMAINS_LISTED:
        svc = services.get(domain)
        if isinstance(svc, dict):
            listed[domain] = sorted(n for n in svc if isinstance(n, str) and ATTRIBUTE_NAME.match(n))
            for n, spec in svc.items():
                if isinstance(spec, dict) and isinstance(spec.get("fields"), dict) and (domain, n) in {("media_player", "play_media"), ("media_player", "select_source"), ("remote", "send_command"), ("remote", "turn_on"), ("webostv", "button"), ("webostv", "command")}:
                    fields.setdefault(domain, {})[n] = sorted(k for k in spec["fields"] if isinstance(k, str) and ATTRIBUTE_NAME.match(k))
    extra_domains = sorted({platform_label(d) for d in services if isinstance(d, str) and d not in SERVICE_DOMAINS_LISTED and d in STANDARD_SERVICE_DOMAINS})
    options: dict[str, dict[str, dict[str, list[str]]]] = {}
    for domain, name, field in CLOSED_LIST_FIELDS:
        spec = (services.get(domain) or {}).get(name) if isinstance(services.get(domain), dict) else None
        sel = (((spec or {}).get("fields") or {}).get(field) or {}).get("selector") if isinstance(spec, dict) else None
        opts = ((sel or {}).get("select") or {}).get("options") if isinstance(sel, dict) else None
        if isinstance(opts, list):
            vals = [o.get("value") if isinstance(o, dict) else o for o in opts]
            options.setdefault(domain, {}).setdefault(name, {})[field] = sorted(v for v in vals if isinstance(v, str) and re.fullmatch(r"[A-Za-z0-9_]{1,32}", v))[:120]
    return {"services": listed, "fields": fields, "other_known_domains_present": extra_domains, "closed_lists": options}


# ---------------------------------------------------------------- the sanity net

def ensure_clean(obj: Any, path: str = "$") -> None:
    """Defence in depth: nothing that looks like a MAC, an address, a URL, a UUID or an entity id may be written. (`ha_version`
    is validated by its own pattern when it is read: a four-part version would look like an address.)"""
    if isinstance(obj, dict):
        for k, v in obj.items():
            ensure_clean(str(k), f"{path}.<key>")
            if path == "$" and k == "ha_version":
                continue
            ensure_clean(v, f"{path}.{str(k)[:24]}")
    elif isinstance(obj, (list, tuple)):
        for v in obj:
            ensure_clean(v, path)
    elif isinstance(obj, str):
        if MAC_FIND.search(obj) or IP_FIND.search(obj) or URL_FIND.search(obj) or UUID_RE.match(obj) or ENTITY_ID_RE.match(obj):
            raise ProbeError(f"refusing to write: a sensitive-looking value at {path} (MAC, address, URL, UUID or entity id)")


async def run_probe(session: Session, log: Callable[[str], None] = print) -> dict[str, Any]:
    summary: dict[str, Any] = {"probe_version": PROBE_VERSION, "ha_version": session.ha_version}
    states_frame = await session.call("get_states")
    states = states_frame.get("result") if states_frame.get("success") and isinstance(states_frame.get("result"), list) else []
    summary["states"] = {"listing": "success" if states_frame.get("success") else error_code(states_frame), "total": len(states), "media_player": sum(1 for s in states if isinstance(s, dict) and str(s.get("entity_id", "")).startswith("media_player.")), "remote": sum(1 for s in states if isinstance(s, dict) and str(s.get("entity_id", "")).startswith("remote."))}
    ent_frame = await session.call("config/entity_registry/list")
    dev_frame = await session.call("config/device_registry/list")
    summary["registry"] = {"entity_registry": "success" if ent_frame.get("success") else error_code(ent_frame), "device_registry": "success" if dev_frame.get("success") else error_code(dev_frame)}
    ent_rows = ent_frame.get("result") if ent_frame.get("success") and isinstance(ent_frame.get("result"), list) else None
    dev_rows = dev_frame.get("result") if dev_frame.get("success") and isinstance(dev_frame.get("result"), list) else None
    by_entity = {r["entity_id"]: r for r in ent_rows if isinstance(r, dict) and isinstance(r.get("entity_id"), str)} if ent_rows is not None else None
    summary["states"]["by_platform"] = summarize_states(states, by_entity)
    if ent_rows is not None and dev_rows is not None:
        summary["registry"]["structure"] = summarize_registry(ent_rows, dev_rows, states)
    else:
        summary["registry"]["structure"] = {"skipped": "the registry listings need an administrator's token"}
        log("note: the registry listings were refused; only the state-based part is reported (use an administrator's long-lived token)")
    svc_frame = await session.call("get_services")
    summary["services"] = summarize_services(svc_frame.get("result")) if svc_frame.get("success") else {"listing": error_code(svc_frame)}
    return summary


# ---------------------------------------------------------------- environment, output


def read_env_file(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$", line)
        if m and not line.lstrip().startswith("#"):
            v = m.group(2)
            if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
                v = v[1:-1]
            env[m.group(1)] = v
    return env


def pick(env: dict[str, str], names: list[str]) -> str | None:
    for n in names:
        v = env.get(n) or os.environ.get(n)
        if v:
            return v
    return None


def safe_out_dir(out: str | None, label: str | None, today: dt.date | None = None) -> Path:
    """The output folder: inside the git-ignored private-evidence/ folder, `media-probe-<date>[-<label>]` by default."""
    if label is not None and not LABEL_RE.match(label):
        raise ProbeError("--label may hold letters, digits, - and _ only (at most 24)")
    name = f"media-probe-{(today or dt.date.today()).isoformat()}" + (f"-{label}" if label else "")
    target = Path(out).resolve() if out else (PRIVATE_EVIDENCE / name).resolve()
    root = PRIVATE_EVIDENCE.resolve()
    if target != root and root not in target.parents:
        raise ProbeError("--out must be a folder inside private-evidence/")
    return target


def write_summary(out_dir: Path, summary: dict[str, Any]) -> Path:
    ensure_clean(summary)
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "summary.json"
    path.write_text(json.dumps(summary, ensure_ascii=False, indent=1, sort_keys=True), encoding="utf-8")
    return path


async def main_async(args: argparse.Namespace, open_connection: Callable[[str], Awaitable[Connection]] = open_ws, log: Callable[[str], None] = print, today: dt.date | None = None) -> int:
    env_path = Path(args.env_file)
    if not env_path.is_file():
        log("env file not found")
        return 2
    env = read_env_file(env_path)
    url = pick(env, [args.url_var] if args.url_var else ["SW_PROBE_HA_URL", "HA_URL"])
    token = pick(env, [args.token_var] if args.token_var else ["SW_PROBE_HA_TOKEN", "HA_TOKEN"])
    if not url or not token:
        log("the URL or token variable is missing (names only are shown: SW_PROBE_HA_URL / HA_URL, SW_PROBE_HA_TOKEN / HA_TOKEN, or --url-var / --token-var)")
        return 2
    if not re.match(r"^https?://", url):
        log("the URL variable must start with http:// or https://")
        return 2
    try:
        out_dir = None if args.no_write else safe_out_dir(args.out, args.label, today)
    except ProbeError as exc:
        log(str(exc))
        return 2
    try:
        conn = await open_connection(url)
        session = Session(conn)
        if not await session.authenticate(token):
            log("auth: refused")
            return 2
        log("auth: ok (read-only probe)")
        summary = await run_probe(session, log)
        await conn.close()
        ensure_clean(summary)
    except ProbeRefused as exc:
        log(f"REFUSED: {exc}")
        return 3
    except Exception as exc:  # noqa: BLE001 - class name (and our own short reason) only: an error text may carry the host or a header
        log(f"probe failed: {type(exc).__name__}" + (f" ({exc})" if isinstance(exc, ProbeError) else ""))
        return 2
    log(json.dumps(summary, ensure_ascii=False, indent=1, sort_keys=True))
    if out_dir:
        path = write_summary(out_dir, summary)
        log(f"summary written to {path.relative_to(REPO) if REPO in path.parents else 'the output folder'} (structure only: counts, key sets and types; git-ignored)")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Read-only structural probe of the media devices on a Home Assistant (CR-015 phase 0).")
    p.add_argument("env_file", help="KEY=VALUE file holding the Home Assistant URL and an administrator's long-lived token")
    p.add_argument("--url-var", help="name of the URL variable (default SW_PROBE_HA_URL, then HA_URL)")
    p.add_argument("--token-var", help="name of the token variable (default SW_PROBE_HA_TOKEN, then HA_TOKEN)")
    p.add_argument("--label", help="tells two systems apart in the output folder name (letters, digits, - and _)")
    p.add_argument("--out", help="output folder inside private-evidence/ (default private-evidence/media-probe-<date>[-<label>]/)")
    p.add_argument("--no-write", action="store_true", help="print the summary only")
    return p


if __name__ == "__main__":
    sys.exit(asyncio.run(main_async(build_parser().parse_args())))
