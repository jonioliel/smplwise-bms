"""The media device model (CR-015 section 3, docs/architecture/MEDIA_API.md): PURE functions, no database, no Home Assistant.

The UI renders media DEVICES (physical things), never entities. An entity is an ENDPOINT of a device, tagged with a role; each
control of a device answers through one PRIMARY endpoint. This module does four things on plain dicts:

1. `build` - the dedupe ladder (rungs 1-6, section 3.3): which endpoints are one physical device, how sure we are, the kind,
   the role of every endpoint, the anchor (name, area and scope home) and the suggestions the ladder may not act on.
2. `primaries` - the endpoint behind each control (section 3.4).
3. `caps` - what the device can do now, from the LIVE `supported_features` of the primaries plus the profile (section 3.5).
4. `live` / `source_items` / `recent_items` - the state a card draws and the curated sources and apps.

Nothing here decides who may do what (routers/multimedia.py + services/media_store.py) and nothing here sends anything
(services/media_commands.py). MACs and identifiers go in, are compared and never come out: no return value carries one."""
from __future__ import annotations

import datetime as dt
import hashlib
import re
from dataclasses import dataclass, field
from typing import Any, Callable, Iterable

from . import media_profiles as profiles

MEDIA_DOMAINS = ("media_player", "remote")

# MediaPlayerEntityFeature bits (HA core media_player/const.py, TV notes 3.4)
F_PAUSE, F_SEEK, F_VOLUME_SET, F_VOLUME_MUTE, F_PREVIOUS, F_NEXT = 1, 2, 4, 8, 16, 32
F_TURN_ON, F_TURN_OFF, F_PLAY_MEDIA, F_VOLUME_STEP, F_SELECT_SOURCE, F_STOP, F_PLAY = 128, 256, 512, 1024, 2048, 4096, 16384
# CR-016: the rest of the MediaPlayerEntityFeature bits the audio kinds read (HA core media_player/const.py)
F_CLEAR_PLAYLIST, F_SHUFFLE_SET, F_SELECT_SOUND_MODE, F_BROWSE_MEDIA, F_REPEAT_SET, F_GROUPING = 8192, 32768, 65536, 131072, 262144, 524288
F_MEDIA_ANNOUNCE, F_MEDIA_ENQUEUE, F_SEARCH_MEDIA = 1048576, 2097152, 4194304
# what makes an endpoint a MUSIC layer (CR-016 5.2): it can play library items, queue them, browse, shuffle / repeat and group
MUSIC_MASK = F_PLAY_MEDIA | F_MEDIA_ENQUEUE | F_BROWSE_MEDIA | F_SHUFFLE_SET | F_REPEAT_SET | F_GROUPING

CONFIDENCE_ORDER = {"exact": 0, "strong": 1, "weak": 2, "manual": 3}
# rungs 2b ("2b": an MA id equals a vendor id), 2c ("2c": it embeds one) and 3b ("model": manufacturer + model, unique) are CR-016
RUNG_CONFIDENCE = {"device": "exact", "ma": "exact", "2b": "strong", "2c": "strong", "mac": "strong", "identifier": "strong", "3b": "strong", "manual": "manual"}
RUNG_ORDER = {"device": 1, "ma": 2, "2b": 3, "2c": 4, "mac": 5, "identifier": 6, "3b": 7, "manual": 8, "single": 9}

# roles whose endpoint is a duplicate of the device's own integration when another endpoint exists (hidden in every API
# reply but the administrator's; CR 3.2). `music` (CR-016) is the Music Assistant entity of a speaker / player: the music layer, hidden
# from the listing but eligible as a primary; `mirror` is a strictly poorer cloud twin (never a primary for any control).
DUPLICATE_ROLES = frozenset({"cast", "dlna", "smartthings", "ma_export", "ma_import", "music", "mirror"})
ROLES = ("vendor", "remote", "cast", "dlna", "smartthings", "ma_export", "ma_import", "ma_native", "ma_universal", "music", "mirror", "other")
KINDS = ("screen", "receiver", "speaker", "player", "group", "session", "virtual_group", "service")
RENDERED_KINDS = ("screen", "speaker", "player", "receiver", "group")  # shown after approval; the rest are never a card (CR 5.1)
NON_PHYSICAL_KINDS = ("session", "virtual_group", "service")
AUDIO_KINDS = ("speaker", "player", "receiver", "group")
PHYSICAL_KINDS = ("screen", "speaker", "player", "receiver")  # the kinds a merge suggestion may pair
AUDIO_PHYSICAL_KINDS = frozenset({"speaker", "player", "receiver"})  # ... a screen is paired only with a screen
CONTROLS = ("power", "keys", "sources", "apps", "volume", "mute", "now_playing", "sound_mode", "music", "group")
PLATFORM_PRIORITY = {"samsungtv_smart": 0, "webostv": 1, "androidtv_remote": 2, "samsungtv": 3, "androidtv": 4, "braviatv": 5, "philips_js": 6,
                     "denonavr": 10, "onkyo": 11, "yamaha": 12, "yamaha_musiccast": 13, "sonos": 20, "wiim": 21, "linkplay": 22, "bluesound": 23, "squeezebox": 24, "snapcast": 25, "heos": 30}
# CR-016 5.1: platforms of the audio kinds. A receiver platform makes a receiver; a speaker platform a speaker; the audio vendor platforms
# are the `vendor` role of an audio device (power / volume / sources / sound mode answer there); the non-physical platforms are never a
# device of their own (client sessions, helper groups, a Spotify Connect list)
RECEIVER_PLATFORMS = frozenset({"onkyo", "denonavr", "yamaha"})
SPEAKER_PLATFORMS = frozenset({"sonos", "linkplay", "wiim", "bluesound", "heos", "squeezebox", "snapcast", "cast", "music_assistant"})
AUDIO_VENDOR_PLATFORMS = RECEIVER_PLATFORMS | frozenset({"sonos", "linkplay", "wiim", "bluesound", "heos", "squeezebox", "snapcast", "yamaha_musiccast"})
NON_PHYSICAL_PLATFORMS = {"jellyfin": "session", "group": "virtual_group", "spotify": "service"}
MUSIC_PROVIDER_ORDER = {"music_assistant": 0, "sonos": 1, "heos": 2}  # tie-break between equally rich music layers (system-V: MA over HEOS)
PROVIDER_OF_PLATFORM = {"music_assistant": "ma", "sonos": "sonos", "heos": "heos"}

GLYPHS = ("antenna", "hdmi", "gamepad", "speaker", "image", "film", "playRect", "sparkle", "music", "ball", "news", "smile", "globe", "app")
ART_LABEL = "מצב אמנות"
SAVER_LABEL = "שומר מסך"
TV_LABEL = "טלוויזיה"
MAX_LIST = 100
_SOURCE_RE = re.compile(r"^(tv|live\s*tv|hdmi\s*\d*(\s*\(.*\))?|av\s*\d*|usb\s*\d*|component\s*\d*|pc|cable|satellite|antenna|dvi|vga|scart|s-video|analog(ue)?|aux)(\b|$)", re.I)
_TV_SOURCE_RE = re.compile(r"^(tv|live\s*tv|antenna|cable|satellite)$", re.I)
_NAME_NOISE = {"tv", "cast", "dlna", "smartthings", "smart", "samsung", "lg", "sony", "philips", "android", "google", "webos", "television", "chromecast", "remote", "טלוויזיה", "מסך", "טלויזיה"}
_APP_GLYPHS: tuple[tuple[str, str, int], ...] = (
    ("netflix", "film", 265), ("youtube", "playRect", 172), ("disney", "sparkle", 232), ("spotify", "music", 38), ("plex", "playRect", 48),
    ("sport", "ball", 135), ("ספורט", "ball", 135), ("news", "news", 217), ("חדשות", "news", 217), ("kids", "smile", 330), ("ילדים", "smile", 330),
    ("browser", "globe", 215), ("דפדפן", "globe", 215), ("web", "globe", 215), ("gallery", "image", 190), ("גלריה", "image", 190), ("photo", "image", 190),
    ("music", "music", 38), ("game", "gamepad", 310), ("prime", "film", 200), ("hbo", "film", 280), ("apple", "sparkle", 250),
)


# ------------------------------------------------------------------------------------------------ normalisation (private values)

_HEX = re.compile(r"[^0-9a-f]")


def normalise_mac(value: Any) -> str | None:
    """A MAC as 12 lower-case hex digits, no separators; None for anything else."""
    text = _HEX.sub("", str(value or "").lower())
    return text if len(text) == 12 else None


_UUID_SHAPE = re.compile(r"^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$")
_MAC_SHAPE = re.compile(r"^(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}$")
_SERIAL_SHAPE = re.compile(r"^(?=(?:.*\d){4})[0-9a-z]{8,64}$")  # a vendor serial: letters and digits only, at least four digits


def normalise_identifier(value: Any) -> str | None:
    """A UUID / serial / MAC-shaped identifier for the identifier rung: lower-case, the `uuid:` prefix and dashes stripped. Only three
    shapes are an identity (CR-015 review L1): a UUID (32 hex digits, dashed or not), a MAC, or a serial (letters and digits only, eight
    or more characters with at least four digits). An IPv4 / IPv6 address, a host name (dots, dashed words, plain letters), a URL or
    anything shorter is None: two TVs handed the same address by DHCP, or named the same, are never one screen."""
    text = str(value or "").strip().lower()
    if text.startswith("uuid:"):
        text = text[5:]
    if _UUID_SHAPE.match(text) or _MAC_SHAPE.match(text) or _SERIAL_SHAPE.match(text):
        return text.replace("-", "").replace(":", "")
    return None


def normalise_connections(raw: Any) -> list[list[str]]:
    """`connections` of an HA device as [[type, value]] with MACs normalised (the rest lower-cased); malformed pairs dropped."""
    out: list[list[str]] = []
    for pair in raw if isinstance(raw, (list, tuple)) else []:
        if not isinstance(pair, (list, tuple)) or len(pair) != 2:
            continue
        kind, value = str(pair[0]).lower(), pair[1]
        norm = normalise_mac(value) if kind == "mac" else str(value).strip().lower()
        if norm and [kind, norm] not in out:
            out.append([kind, norm])
    return out


def normalise_identifiers(raw: Any) -> list[list[str]]:
    out: list[list[str]] = []
    for pair in raw if isinstance(raw, (list, tuple)) else []:
        if not isinstance(pair, (list, tuple)) or len(pair) < 2:
            continue
        domain, value = str(pair[0]).lower(), str(pair[1]).strip().lower()
        if value and [domain, value] not in out:
            out.append([domain, value])
    return out


# ------------------------------------------------------------------------------------------------ the ladder


@dataclass
class Endpoint:
    endpoint_id: str
    ref: str  # the entity id
    domain: str
    platform: str | None
    device_id: str | None
    role: str = "other"
    rule: str = "single"
    link_source: str = "auto"
    hidden: bool = False


@dataclass
class DeviceModel:
    key: str
    endpoints: list[Endpoint]
    kind: str
    confidence: str
    anchor: str  # the anchor's entity id
    profile: str  # detected
    zones: list[dict[str, Any]] | None = None  # [{id, endpoint_id, name}] of a multi-zone receiver (CR-016 5.2), Main first
    music_provider: str = "none"  # ma | sonos | heos | vendor | none (derived by the rebuild, cached on the row)

    def by_role(self, *roles: str, domain: str | None = None) -> list[Endpoint]:
        return sorted((e for e in self.endpoints if e.role in roles and (domain is None or e.domain == domain)), key=lambda e: (PLATFORM_PRIORITY.get(e.platform or "", 50), e.ref))

    def endpoint(self, entity_id: str) -> Endpoint | None:
        return next((e for e in self.endpoints if e.ref == entity_id), None)


@dataclass
class Suggestion:
    endpoint_id: str
    device_key: str
    reason: str
    rule: str = "weak"


@dataclass
class Model:
    devices: dict[str, DeviceModel] = field(default_factory=dict)
    suggestions: list[Suggestion] = field(default_factory=list)
    by_endpoint: dict[str, str] = field(default_factory=dict)  # endpoint id -> device key


def endpoint_id_of(entity_id: str) -> str:
    return f"ha:{entity_id}"


class _Union:
    def __init__(self, n: int) -> None:
        self.parent = list(range(n))

    def find(self, i: int) -> int:
        while self.parent[i] != i:
            self.parent[i] = self.parent[self.parent[i]]
            i = self.parent[i]
        return i

    def union(self, a: int, b: int) -> bool:
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return False
        self.parent[max(ra, rb)] = min(ra, rb)
        return True

    def groups(self) -> dict[int, list[int]]:
        out: dict[int, list[int]] = {}
        for i in range(len(self.parent)):
            out.setdefault(self.find(i), []).append(i)
        return out


def normalised_name(text: str | None) -> str:
    """The name the weak rung compares: lower-case words without brand / protocol words ("TV", "Cast", "DLNA", "SmartThings"),
    without model-number words (letters and digits mixed) and without punctuation."""
    words = re.findall(r"[\w֐-׿]+", (text or "").lower())
    keep = []
    for w in words:
        if w in _NAME_NOISE:
            continue
        if (re.search(r"\d", w) and re.search(r"[a-z]", w) and len(w) >= 4) or (w.isdigit() and len(w) >= 3):
            continue
        keep.append(w)
    return " ".join(keep)


def role_of(entity: dict[str, Any]) -> str:
    """The role a media endpoint plays before the cluster is known (MA roles are refined by `build`)."""
    platform = entity.get("platform") or ""
    if entity["domain"] == "remote":
        return "remote"
    if platform in profiles.VENDOR_PLATFORMS or platform in AUDIO_VENDOR_PLATFORMS:
        return "vendor"
    return {"cast": "cast", "dlna_dmr": "dlna", "smartthings": "smartthings", "music_assistant": "ma_native"}.get(platform, "other")


def device_display_name(ents: Iterable[dict[str, Any]], anchor: str, device: dict[str, Any] | None) -> str:
    """The name a device carries unless an administrator typed one: the user's name of its HA device, the HA device's name, the
    anchor's own name."""
    if device:
        for cand in (device.get("name_by_user"), device.get("name")):
            if isinstance(cand, str) and cand.strip():
                return cand.strip()[:80]
    for e in ents:
        if e["entity_id"] == anchor:
            name = (e.get("name") or e.get("original_name") or (e.get("attributes") or {}).get("friendly_name") or "").strip()
            if name:
                return name[:80]
    return anchor.split(".", 1)[-1].replace("_", " ")


_TV_BRANDS = frozenset({"samsung", "lg", "sony", "tcl", "hisense", "philips", "vizio", "sharp", "toshiba", "panasonic", "xiaomi", "skyworth", "grundig", "loewe"})
_AUDIO_MODEL_RE = re.compile(r"speaker|soundbar|sound bar|audio|xboom|\bhw-|\bhome\b|nest mini|\bmini\b|\becho\b|\bwiim\b|\bsonos\b|subwoofer|\bplay:?\d\b", re.I)
_TV_MODEL_RE = re.compile(r"\b(tv|television|oled|qled|bravia|webos|tizen|google tv|android tv)\b|^(?:oled|qled|ue|qe|un|ke|kd|xr|xbr)\d{2}", re.I)


def tv_like(manufacturer: Any, model: Any) -> bool:
    """A manufacturer / model pair that reads as a TV (CR-016 5.1, probe system-V: the Cast TVs carry no device class, only a model string):
    a TV brand whose model is not a speaker's, or a model that names a TV outright."""
    maker = str(manufacturer or "").strip().lower()
    name = str(model or "").strip()
    if not name:
        return False
    if _AUDIO_MODEL_RE.search(name):
        return False
    first = (re.findall(r"[a-z0-9]+", maker) or [""])[0]
    return first in _TV_BRANDS or bool(_TV_MODEL_RE.search(name))


def kind_of(ents: list[dict[str, Any]], meta: list[dict[str, Any]] | None = None) -> str:
    """The kind of a device by its endpoints (manual kinds are applied by the caller). CR-015 first: device class tv / projector -> screen,
    the integration of a TV brand -> screen. CR-016 adds, in this order: a `cast` entity without a device class whose HA device reads as a TV
    (`meta`: the HA device rows, manufacturer / model) -> screen; then the NON-PHYSICAL kinds - a client session (`jellyfin`), a helper group
    (`group` platform), a Spotify Connect list (`spotify`) - when no physical endpoint is left; a Music Assistant group player -> group;
    receiver (device class, or onkyo / denonavr / yamaha); speaker (device class, or a speaker platform); otherwise a player."""
    classes = {(e.get("device_class") or "").lower() for e in ents}
    platforms = {e.get("platform") or "" for e in ents}
    if classes & {"tv", "projector"}:
        return "screen"
    if platforms & set(profiles.VENDOR_PLATFORMS):
        return "screen"
    if "cast" in platforms:
        cast_ents = [e for e in ents if (e.get("platform") or "") == "cast" and not (e.get("device_class") or "")]
        if cast_ents and any(tv_like(m.get("manufacturer"), m.get("model")) for m in (meta or [])):
            return "screen"
    physical = [e for e in ents if (e.get("platform") or "") not in NON_PHYSICAL_PLATFORMS]
    if not physical:
        for platform in ("group", "jellyfin", "spotify"):  # a cluster of helper groups reads as a helper group before a session
            if platform in platforms:
                return NON_PHYSICAL_PLATFORMS[platform]
    if any(str((e.get("attributes") or {}).get("mass_player_type") or "").lower() == "group" for e in physical):
        return "group"
    p_platforms = {e.get("platform") or "" for e in physical}
    if "receiver" in classes or p_platforms & RECEIVER_PLATFORMS or {"heos", "denonavr"} <= p_platforms:
        return "receiver"
    if "speaker" in classes or p_platforms & SPEAKER_PLATFORMS:
        return "speaker"
    return "player"


def _conflict(a: list[Endpoint], b: list[Endpoint]) -> bool:
    """The two-Samsung guard: two endpoints of the SAME platform on DIFFERENT HA devices are never merged."""
    def by_platform(eps: list[Endpoint]) -> dict[str, set[str]]:
        out: dict[str, set[str]] = {}
        for e in eps:
            if e.platform:
                out.setdefault(e.platform, set()).add(e.device_id or e.endpoint_id)
        return out

    pa, pb = by_platform(a), by_platform(b)
    return any(pa[p] != pb[p] for p in set(pa) & set(pb))


def _strong_id(value: Any) -> bool:
    """An identifier that identifies (rungs 2b / 2c): a UUID, a MAC, a serial (`normalise_identifier`) or a long number (a HEOS player id).
    Never an address or a host name: an IP, a host, a URL or anything short is not an identity."""
    text = str(value or "").strip().lower()
    if len(text) < 6 or len(text) > 128:
        return False
    return normalise_identifier(text) is not None or bool(re.fullmatch(r"-?\d{6,20}", text))


def _alnum(text: Any) -> str:
    return re.sub(r"[^0-9a-z]", "", str(text or "").lower())


_GENERIC_MAKERS = frozenset({"", "unknown", "generic", "none", "music", "n"})


def _maker(text: Any) -> str:
    """The manufacturer as its first word, lower-case ("LG Electronics" and "LG" are one)."""
    words = re.findall(r"[a-z0-9]+", str(text or "").lower())
    return words[0] if words and words[0] not in _GENERIC_MAKERS else ""


def normalised_model(text: Any) -> str:
    """A model string for the model rung: lower-case letters and digits only; fewer than three characters is no model."""
    out = _alnum(text)
    return out if len(out) >= 3 else ""


_ZONE_RE = re.compile(r"zone[\s_-]*(\d)", re.I)


def zones_of(eps: list[Endpoint], ents: dict[str, dict[str, Any]]) -> list[dict[str, Any]] | None:
    """The zones of a multi-zone receiver (CR-016 5.2): at least two entities of one receiver-platform HA device (Denon / Marantz Main and
    Zone2). `[{id, endpoint_id, name}]`, Main first (`main`, `zone2`, ...); None for everything else (a single-zone receiver has no zone switch)."""
    pool = [e for e in eps if e.domain == "media_player" and e.role == "vendor" and (e.platform or "") in RECEIVER_PLATFORMS]
    by_dev: dict[str, list[Endpoint]] = {}
    for e in pool:
        by_dev.setdefault(e.device_id or "", []).append(e)
    best = max(by_dev.values(), key=len) if by_dev else []
    if len(best) < 2:
        return None
    numbered: list[tuple[int, Endpoint]] = []
    for e in best:
        ent = ents.get(e.ref) or {}
        m = _ZONE_RE.search(f"{e.ref} {ent.get('name') or ''} {_attrs(ent).get('friendly_name') or ''}")
        numbered.append((int(m.group(1)) if m else 1, e))
    numbered.sort(key=lambda t: (t[0], t[1].ref))
    out: list[dict[str, Any]] = []
    seen: set[int] = set()
    for n, e in numbered:
        while n in seen:
            n += 1  # two entities that both read as one zone: numbered by order
        seen.add(n)
        out.append({"id": "main" if n == 1 else f"zone{n}", "endpoint_id": e.endpoint_id, "name": "ראשי" if n == 1 else f"אזור {n}"})
    return out


def eff_features(e: dict[str, Any] | None) -> int:
    """The `supported_features` bits a capability is read from: the live mask of an AVAILABLE entity; for an unavailable / restored one the
    last good mask (`last_features`, put on the entity dict by the store from its endpoint row), else the live - degraded - mask
    (CR-016 5.4: capabilities are never read from a degraded mask when a good one is known)."""
    if not e:
        return 0
    live_mask = int(e.get("supported_features") or 0)
    if available(e):
        return live_mask
    last = e.get("last_features")
    return int(last) if isinstance(last, int) and not isinstance(last, bool) else live_mask


def music_score(e: dict[str, Any] | None) -> int:
    return bin(eff_features(e) & MUSIC_MASK).count("1")


def is_music_layer(e: dict[str, Any] | None) -> bool:
    """An entity that can play library items AND queue them: Music Assistant, Sonos, HEOS (not Cast, not a WiiM, not a cloud mirror)."""
    mask = eff_features(e)
    return bool(mask & F_PLAY_MEDIA) and bool(mask & F_MEDIA_ENQUEUE)


def _audio_media_eps(dev: "DeviceModel") -> list[Endpoint]:
    return [e for e in dev.endpoints if e.domain == "media_player" and e.role != "mirror" and (e.platform or "") not in NON_PHYSICAL_PLATFORMS]


def music_endpoint(dev: "DeviceModel", ents: dict[str, dict[str, Any]]) -> Endpoint | None:
    """The device's MUSIC layer (CR-016 5.2): the endpoint with the richest music mask (play + enqueue + browse + shuffle / repeat + grouping),
    whatever its platform - the MA entity where MA exists, the Sonos entity of a house without MA, HEOS for a Denon. An available endpoint beats
    an unavailable one; a tie is broken by provider (MA, Sonos, HEOS, then the rest). A cloud mirror is never one."""
    cands = [e for e in _audio_media_eps(dev) if is_music_layer(ents.get(e.ref))]
    if not cands:
        return None
    return sorted(cands, key=lambda e: (0 if available(ents.get(e.ref)) else 1, -music_score(ents.get(e.ref)), MUSIC_PROVIDER_ORDER.get(e.platform or "", 9), e.ref))[0]


def music_provider_of(dev: "DeviceModel", ents: dict[str, dict[str, Any]]) -> str:
    """`ma` | `sonos` | `heos` | `vendor` | `none`: which layer answers the music controls of the device."""
    m = music_endpoint(dev, ents)
    if m is not None:
        return PROVIDER_OF_PLATFORM.get(m.platform or "", "vendor")
    for e in _audio_media_eps(dev):
        if e.role in ("vendor", "other", "cast") and eff_features(ents.get(e.ref)) & (F_PLAY | F_PAUSE):
            return "vendor"
    return "none"


def group_endpoint(dev: "DeviceModel", ents: dict[str, dict[str, Any]]) -> tuple[Endpoint | None, str | None]:
    """The ONE endpoint that answers grouping for a device and its layer (CR-016 5.3): the Music Assistant entity when the device has one
    (`ma`: its groups are read and written through MA only - a vendor group of the same members is an alias), else a real vendor player
    with GROUPING (`vendor`: Sonos natively, a WiiM). Never Cast (no join), a SmartThings twin, a mirror or a helper group."""
    if dev.kind in NON_PHYSICAL_KINDS:
        return None, None
    cands = [e for e in _audio_media_eps(dev) if (e.platform or "") not in ("cast", "smartthings", "dlna_dmr")]
    ma = sorted((e for e in cands if e.platform == "music_assistant"), key=lambda e: (0 if available(ents.get(e.ref)) else 1, e.ref))
    if ma:
        return ma[0], "ma"
    vend = sorted((e for e in cands if eff_features(ents.get(e.ref)) & F_GROUPING), key=lambda e: (0 if available(ents.get(e.ref)) else 1, PLATFORM_PRIORITY.get(e.platform or "", 50), e.ref))
    return (vend[0], "vendor") if vend else (None, None)


def vendor_group_endpoint(dev: "DeviceModel", ents: dict[str, dict[str, Any]]) -> Endpoint | None:
    """The vendor-layer grouping endpoint of a device that ALSO has an MA endpoint (a WiiM next to its MA copy): only used to tell an alias
    from a disagreement between the two layers."""
    for e in sorted(_audio_media_eps(dev), key=lambda e: (PLATFORM_PRIORITY.get(e.platform or "", 50), e.ref)):
        if (e.platform or "") not in ("cast", "smartthings", "dlna_dmr", "music_assistant") and eff_features(ents.get(e.ref)) & F_GROUPING:
            return e
    return None


def _build_audio_roles(ep_list: list[Endpoint], ents: dict[str, dict[str, Any]], kind: str) -> None:
    """CR-016 5.2 roles of a multi-endpoint audio cluster: a strictly poorer SmartThings twin is a `mirror` (never a primary); the richest MA
    entity is the `music` layer (the others stay exports). Screens keep their CR-015 roles."""
    if kind == "screen" or kind in NON_PHYSICAL_KINDS or len(ep_list) < 2:
        return
    rich = [e for e in ep_list if e.domain == "media_player" and e.platform != "smartthings" and (e.platform or "") not in NON_PHYSICAL_PLATFORMS and e.role != "cast"]
    best = max((music_score(ents.get(e.ref)) for e in rich), default=0)
    for e in ep_list:
        if e.platform == "smartthings" and e.domain == "media_player" and music_score(ents.get(e.ref)) < best:
            e.role = "mirror"
    ma = sorted((e for e in ep_list if e.platform == "music_assistant" and e.role in ("ma_native", "ma_export")), key=lambda e: (-music_score(ents.get(e.ref)), e.ref))
    for i, e in enumerate(ma):
        e.role = "music" if i == 0 else "ma_export"


def build(
    entities: list[dict[str, Any]],
    devices: list[dict[str, Any]],
    rules: list[dict[str, Any]] | None = None,
    *,
    existing_keys: dict[str, str] | None = None,
    existing_anchors: dict[str, str] | None = None,
    new_key: Callable[[], str] | None = None,
) -> Model:
    """The dedupe ladder over the media endpoints (media_player.* and remote.*) of one installation.

    `entities`: dicts with entity_id, domain, platform, unique_id, device_id, device_class, name, original_name, area_id, hidden, disabled,
    attributes (and, for an audio device, `last_features`). `devices`: HA devices with device_id, name, name_by_user, area_id, manufacturer,
    model, connections [[type, value]] and identifiers [[domain, id]] (normalised by `normalise_*`). `rules`: the administrator's link /
    unlink / ignore rows. `existing_keys` (endpoint id -> device key) keeps a device's key stable while its endpoints change;
    `existing_anchors` (device key -> entity id) keeps its anchor. Deterministic for equal inputs (`new_key` supplies fresh keys).

    Rungs: 1 same HA device; 2 the MA loop; 2b an MA id EQUALS another integration's id (CR-016); 2c an MA id EMBEDS one; 3 a shared MAC;
    4 a shared UUID / serial; 3b manufacturer + model across platforms (merged when the model is a single physical device, else a
    suggestion); 5 / 5b suggestions by name (area on both sides / on one side); 6 the administrator's link."""
    import uuid

    new_key = new_key or (lambda: uuid.uuid4().hex)
    existing_keys = existing_keys or {}
    existing_anchors = existing_anchors or {}
    rule_by_ep = {r["endpoint_id"]: r for r in (rules or [])}
    dev_by_id = {d["device_id"]: d for d in devices}

    cands = sorted((e for e in entities if e["domain"] in MEDIA_DOMAINS and not e.get("disabled") and rule_by_ep.get(endpoint_id_of(e["entity_id"]), {}).get("rule") != "ignore"), key=lambda e: e["entity_id"])
    eps = [Endpoint(endpoint_id_of(e["entity_id"]), e["entity_id"], e["domain"], e.get("platform"), e.get("device_id") or None, role_of(e)) for e in cands]
    ents = {e["entity_id"]: e for e in cands}
    n = len(eps)
    uf = _Union(n)
    idx = {e.ref: i for i, e in enumerate(eps)}
    edges: list[tuple[int, int, str]] = []
    pinned_apart = {i for i, e in enumerate(eps) if rule_by_ep.get(e.endpoint_id, {}).get("rule") == "unlink"}

    def members(root: int) -> list[Endpoint]:
        return [eps[i] for i in uf.groups().get(root, [])]

    def merge(a: int, b: int, rung: str, guarded: bool) -> None:
        if a in pinned_apart or b in pinned_apart:
            return
        ra, rb = uf.find(a), uf.find(b)
        if ra == rb:
            edges.append((a, b, rung))
            return
        if guarded and _conflict(members(ra), members(rb)):
            return
        uf.union(a, b)
        edges.append((a, b, rung))

    # rung 1: the same HA device id
    by_dev: dict[str, list[int]] = {}
    for i, e in enumerate(eps):
        if e.device_id:
            by_dev.setdefault(e.device_id, []).append(i)
    def hub(ids: list[int]) -> int | None:
        """The endpoint of a device the other rungs hang their merges on: its first endpoint the administrator did not `unlink`."""
        return next((i for i in ids if i not in pinned_apart), None)

    for ids in by_dev.values():
        h = hub(ids)
        for j in ids:
            if h is not None and j != h:
                merge(h, j, "device", False)

    # rung 2: the Music Assistant loop - an MA-created entity whose player id is an HA media_player entity id
    media_ids = {e.ref.lower(): i for i, e in enumerate(eps) if e.domain == "media_player"}
    ma_ids_of: dict[int, set[str]] = {}
    for i, e in enumerate(eps):
        ent = ents[e.ref]
        if e.platform != "music_assistant":
            continue
        pids = {str(ent.get("unique_id") or "").strip().lower()}
        dev = dev_by_id.get(e.device_id or "")
        for dom, ident in (dev or {}).get("identifiers") or []:
            if dom == "music_assistant":
                pids.add(str(ident).strip().lower())
        ma_ids_of[i] = {p for p in pids if p}
        for pid in pids:
            j = media_ids.get(pid)
            if j is not None and j != i:
                merge(i, j, "ma", False)
                eps[i].role = "ma_import"

    # rungs 2b / 2c (CR-016 5.1): an MA player id that EQUALS (2b: the HEOS pair of system-V) or EMBEDS (2c: the WiiM pairs of systems H and V,
    # an MA provider prefix around the vendor id) the identifier of another integration's device. Strong identifiers only - a UUID, a MAC, a
    # serial, a long number; never an address or a host name - merged under the same-platform guard (two WiiMs never merge).
    vendor_raw: dict[str, set[str]] = {}
    vendor_key: dict[str, set[str]] = {}
    for d in devices:
        if d["device_id"] not in by_dev:
            continue
        for dom, value in d.get("identifiers") or []:
            if dom == "music_assistant":
                continue
            raw = str(value).strip().lower()
            if not _strong_id(raw):
                continue
            vendor_raw.setdefault(raw, set()).add(d["device_id"])
            key = _alnum(normalise_identifier(raw) or raw)
            if len(key) >= 8:
                vendor_key.setdefault(key, set()).add(d["device_id"])
    for i, ids in sorted(ma_ids_of.items()):
        own = eps[i].device_id
        joined = False
        for ma_id in sorted(ids):
            devs = vendor_raw.get(ma_id) if _strong_id(ma_id) else None
            if devs and len(devs) == 1 and own not in devs:
                j = hub(by_dev[next(iter(devs))])
                if j is not None:
                    merge(i, j, "2b", True)
                    joined = True
        if joined:
            continue
        for ma_id in sorted(ids):
            flat = _alnum(ma_id)
            for vk, devs in sorted(vendor_key.items()):
                if len(devs) == 1 and own not in devs and vk in flat:
                    j = hub(by_dev[next(iter(devs))])
                    if j is not None:
                        merge(i, j, "2c", True)

    # rung 3: a MAC two HA devices share; rung 4: a shared UUID / serial / Cast UUID (both guarded by the same-platform rule)
    macs: dict[str, set[str]] = {}
    idents: dict[str, set[str]] = {}
    for d in devices:
        if d["device_id"] not in by_dev:
            continue
        for kind, value in d.get("connections") or []:
            if kind == "mac":
                macs.setdefault(value, set()).add(d["device_id"])
            else:
                norm = normalise_identifier(value)
                if norm:
                    idents.setdefault(norm, set()).add(d["device_id"])
        for dom, value in d.get("identifiers") or []:
            norm = normalise_identifier(value)
            if dom != "music_assistant" and norm and norm != normalise_identifier(d["device_id"]):
                idents.setdefault(norm, set()).add(d["device_id"])
    for table, rung in ((macs, "mac"), (idents, "identifier")):
        for _value, dev_ids in sorted(table.items()):
            if len(dev_ids) < 2 or len(dev_ids) > 4:  # a value shared by many devices is not an identity
                continue
            hubs = [h for h in (hub(by_dev[d]) for d in sorted(dev_ids)) if h is not None]
            for other in hubs[1:]:
                merge(hubs[0], other, rung, True)

    # rung 3b (CR-016 5.1): the same manufacturer + normalised model on endpoints of DIFFERENT platforms - the key that links Cast to MA, HEOS
    # to MA and the SmartThings / DLNA / vendor stacks of a Samsung TV. A model shared by several clusters is ONE physical device when no
    # platform appears on two different HA devices inside it AND exactly two clusters carry it (a unique pair: one Cast + one MA twin) - the merge; otherwise (the
    # same model twice, or three single-platform clusters that could be three devices of one model - review L7) it is ambiguous and only suggested.
    # A Cast model that is a prefix of the full one (shortened) counts; a non-physical platform (a Jellyfin session) never carries a model.
    def sigs_of(root: int) -> set[tuple[str, str, bool]]:
        out: set[tuple[str, str, bool]] = set()
        for i in uf.groups().get(root, []):
            e = eps[i]
            d = dev_by_id.get(e.device_id or "")
            if not d or (e.platform or "") in NON_PHYSICAL_PLATFORMS:
                continue
            mk, md = _maker(d.get("manufacturer")), normalised_model(d.get("model"))
            if mk and md:
                out.add((mk, md, e.platform == "cast"))
        return out

    roots0 = [r for r, ids in uf.groups().items() if any(eps[i].domain == "media_player" for i in ids)]
    sig_by_root = {r: sigs_of(r) for r in roots0}
    full_models = {(mk, md) for sigs in sig_by_root.values() for mk, md, _c in sigs}

    def canon(mk: str, md: str, is_cast: bool) -> tuple[str, str]:
        if is_cast and len(md) >= 5:
            longer = {m2 for (k2, m2) in full_models if k2 == mk and m2 != md and m2.startswith(md)}
            if len(longer) == 1:
                return mk, next(iter(longer))
        return mk, md

    families: dict[tuple[str, str], list[int]] = {}
    for r in sorted(roots0):
        for mk, md, is_cast in sorted(sig_by_root[r]):
            fam = families.setdefault(canon(mk, md, is_cast), [])
            if r not in fam:
                fam.append(r)
    ambiguous: list[tuple[int, int]] = []  # (hub endpoint a, hub endpoint b): suggestions once the keys exist
    for _fam_key, fam0 in sorted(families.items()):
        fam = list(dict.fromkeys(uf.find(r) for r in fam0))  # an earlier family may already have merged some of these clusters
        if len(fam) < 2:
            continue
        fam_eps = [e for r in fam for e in members(r)]
        by_platform: dict[str, set[str]] = {}
        for e in fam_eps:
            if e.platform and (e.platform or "") not in NON_PHYSICAL_PLATFORMS:
                by_platform.setdefault(e.platform, set()).add(e.device_id or e.endpoint_id)
        hubs = [h for h in (hub(sorted(uf.groups().get(r, []))) for r in fam) if h is not None]
        if len(fam) == 2 and all(len(v) <= 1 for v in by_platform.values()):
            for other in hubs[1:]:
                merge(hubs[0], other, "3b", True)
        else:
            for ia, a in enumerate(hubs):
                for b in hubs[ia + 1:]:
                    if not _conflict(members(uf.find(a)), members(uf.find(b))) and len(ambiguous) < 200:
                        ambiguous.append((a, b))

    # the clusters; a cluster without a media_player is not a media device (a bare remote of a hub)
    groups = [sorted(ids) for ids in uf.groups().values()]
    groups = [g for g in groups if any(eps[i].domain == "media_player" for i in g)]
    groups.sort(key=lambda g: (-len(g), eps[g[0]].ref))

    def cluster_name(g: list[int]) -> str:
        anchor = _choose_anchor([eps[i] for i in g], None)
        return normalised_name(device_display_name([ents[eps[i].ref] for i in g], anchor, dev_by_id.get(ents[anchor].get("device_id") or "")))

    def cluster_area(g: list[int]) -> str | None:
        for i in g:
            area = ents[eps[i].ref].get("area_id")
            if area:
                return area
        return None

    # keys: a device keeps the key its endpoints already had
    claimed: set[str] = set()
    taken = set(existing_keys.values()) | set(existing_anchors)
    keyed: list[tuple[str, list[int]]] = []
    for g in groups:
        votes: dict[str, int] = {}
        for i in g:
            k = existing_keys.get(eps[i].endpoint_id)
            if k:
                votes[k] = votes.get(k, 0) + 1
        chosen = next((k for k, _c in sorted(votes.items(), key=lambda kv: (-kv[1], kv[0])) if k not in claimed), None)
        if chosen is None:
            chosen = new_key()
            while chosen in taken or chosen in claimed:
                chosen = new_key()  # a fresh key is never one another device (or this run) already holds
        claimed.add(chosen)
        keyed.append((chosen, list(g)))

    # rung 6: the administrator's `link` rules move one endpoint into another device (applied last; they override 1-5)
    manual_eps: set[int] = set()
    for ep_id, rule in rule_by_ep.items():
        if rule["rule"] != "link" or not rule.get("device_key"):
            continue
        src = next((i for i, e in enumerate(eps) if e.endpoint_id == ep_id), None)
        if src is None:
            continue
        target = next((g for k, g in keyed if k == rule["device_key"]), None)
        here = next((g for k, g in keyed if src in g), None)
        if target is None:
            continue
        if here is target:
            manual_eps.add(src)  # the administrator's word, even where the ladder would have joined it anyway
            continue
        # the endpoint moves with the endpoints the ladder joined it to (the MA twin of a HEOS entity travels with it - CR-016 merge wizard), except the ones the
        # administrator has a rule of their own for (an `unlink`ed endpoint is not in this cluster anyway)
        carried = [src] + [i for i in here if i != src and eps[i].endpoint_id not in rule_by_ep]
        for i in carried:
            here.remove(i)
            target.append(i)
        manual_eps.add(src)
    keyed = [(k, sorted(g)) for k, g in keyed if g]

    model = Model()
    for key, g in keyed:
        ep_list = [eps[i] for i in g]
        edge_rules: dict[int, list[str]] = {}
        used: list[str] = []
        for a, b, rung in edges:
            if a in g and b in g:
                edge_rules.setdefault(a, []).append(rung)
                edge_rules.setdefault(b, []).append(rung)
                used.append(rung)
        for i in g:
            e = eps[i]
            if i in manual_eps:
                e.rule, e.link_source = "manual", "manual"
                used.append("manual")
            elif i in edge_rules:
                e.rule = min(edge_rules[i], key=lambda r: RUNG_ORDER[r])
            elif rule_by_ep.get(e.endpoint_id, {}).get("rule") == "unlink":
                e.rule, e.link_source = "manual", "manual"
            else:
                e.rule = "single"
        confidence = "exact"
        for rung in used:
            c = RUNG_CONFIDENCE[rung]
            if CONFIDENCE_ORDER[c] > CONFIDENCE_ORDER[confidence]:
                confidence = c
        # roles: the MA entities that only ride along another device's ids are exports; a duplicate is hidden when the device
        # has an endpoint of its own integration to speak for it
        for e in ep_list:
            if e.role == "ma_native" and len(ep_list) > 1:
                e.role = "ma_export"
        anchor = _choose_anchor(ep_list, existing_anchors.get(key), ents)
        platforms = {e.platform or "" for e in ep_list}
        metas = [dev_by_id[d] for d in sorted({ents[e.ref].get("device_id") for e in ep_list if ents[e.ref].get("device_id") in dev_by_id})]
        kind = kind_of([ents[e.ref] for e in ep_list], metas)
        _build_audio_roles(ep_list, ents, kind)
        for e in ep_list:
            dup = e.role in DUPLICATE_ROLES and any(x is not e and x.role not in DUPLICATE_ROLES for x in ep_list)
            user_hidden = bool(ents[e.ref].get("hidden")) and any(x is not e and not ents[x.ref].get("hidden") for x in ep_list)  # the owner's own manual dedupe
            e.hidden = dup or user_hidden
        dm = DeviceModel(key=key, endpoints=ep_list, kind=kind, confidence=confidence, anchor=anchor, profile=profiles.detect(platforms))
        dm.zones = zones_of(ep_list, ents) if kind == "receiver" else None
        dm.music_provider = music_provider_of(dm, ents) if kind in AUDIO_KINDS else "none"
        model.devices[key] = dm
        for e in ep_list:
            model.by_endpoint[e.endpoint_id] = key

    # the suggestions (never merged): 3b an ambiguous model, 5 the same area and the same normalised name, 5b the same name with an area on
    # ONE side (CR-016: most MA / WiiM / HEOS players carry no area). An empty normalised name never matches (model-number names), and
    # sessions, helper groups and Spotify lists are never suggested.
    key_of_ep = {eps[i].endpoint_id: k for k, g in keyed for i in g}
    seen_pairs: set[tuple[str, str]] = set()

    def suggest(small_ep: int, big_key: str, reason: str, rule: str) -> None:
        sk = key_of_ep.get(eps[small_ep].endpoint_id)
        pair = (eps[small_ep].endpoint_id, big_key)
        if sk is None or sk == big_key or pair in seen_pairs:
            return
        if model.devices[sk].kind not in PHYSICAL_KINDS or model.devices[big_key].kind not in PHYSICAL_KINDS:
            return
        seen_pairs.add(pair)
        model.suggestions.append(Suggestion(eps[small_ep].endpoint_id, big_key, reason, rule))

    for a, b in ambiguous:
        ka, kb = key_of_ep.get(eps[a].endpoint_id), key_of_ep.get(eps[b].endpoint_id)
        if ka is None or kb is None or ka == kb:
            continue
        ga, gb = next(g for k, g in keyed if k == ka), next(g for k, g in keyed if k == kb)
        if _conflict([eps[x] for x in ga], [eps[x] for x in gb]):
            continue  # two clusters that each hold an entity of one integration (two Cast entities, two Music Assistant players) are two things: once the owner has linked each twin, the pair is no suggestion
        small, big = ((a, kb), (b, ka)) if len(ga) <= len(gb) else ((b, ka), (a, kb))
        suggest(small[0], small[1], "same_model", "3b")
    infos = []
    for key, g in keyed:
        if model.devices[key].kind in PHYSICAL_KINDS:
            infos.append((key, g, cluster_name(g), cluster_area(g)))
    for i, (ka, ga, na, aa) in enumerate(infos):
        for kb, gb, nb, ab in infos[i + 1:]:
            if not na or na != nb or (aa is None and ab is None):
                continue
            if aa is not None and ab is not None and aa != ab:
                continue
            if _conflict([eps[x] for x in ga], [eps[x] for x in gb]):
                continue
            kinds_ab = {model.devices[ka].kind, model.devices[kb].kind}
            if len(kinds_ab) > 1 and not kinds_ab <= AUDIO_PHYSICAL_KINDS:
                continue  # a TV and a speaker that carry the same name (the room's) are two things; speakers, players and receivers may be twins
            if aa is not None and ab is not None:
                small, big = ((ka, ga), (kb, gb)) if len(ga) <= len(gb) else ((kb, gb), (ka, ga))
                suggest(small[1][0], big[0], "same_area_and_name", "weak")
            else:
                small, big = ((ka, ga), (kb, gb)) if aa is None else ((kb, gb), (ka, ga))  # the device with an area is the one the other would join
                suggest(small[1][0], big[0], "same_name_area_one_side", "5b")
    return model


def _choose_anchor(eps: list[Endpoint], existing: str | None, ents: dict[str, dict[str, Any]] | None = None) -> str:
    """The device's home for name, area and scope: the kept one when it is still a member, else the vendor media_player, else
    a remote, else any media_player - preferring, among those, one that carries an area (a Cast copy has one, its MA twin rarely does)."""
    if existing and any(e.ref == existing for e in eps):
        return existing
    for roles, domain in ((("vendor",), "media_player"), (("remote",), None), (("other",), "media_player")):
        pool = sorted((e for e in eps if e.role in roles and (domain is None or e.domain == domain)), key=lambda e: (PLATFORM_PRIORITY.get(e.platform or "", 50), e.ref))
        if pool:
            return pool[0].ref
    mps = sorted((e for e in eps if e.domain == "media_player"), key=lambda e: e.ref)
    if ents:
        mps.sort(key=lambda e: (0 if (ents.get(e.ref) or {}).get("area_id") else 1, 1 if e.role in DUPLICATE_ROLES and e.role != "cast" else 0))
    return (mps or sorted(eps, key=lambda e: e.ref))[0].ref


# ------------------------------------------------------------------------------------------------ states and primaries


def _state(e: dict[str, Any] | None) -> str | None:
    return None if e is None else e.get("state")


def available(e: dict[str, Any] | None) -> bool:
    return bool(e) and bool(e.get("available", True)) and e.get("state") not in ("unavailable", None)


def _feat(e: dict[str, Any] | None, bit: int) -> bool:
    return bool(e) and bool(int(e.get("supported_features") or 0) & bit)


def _attrs(e: dict[str, Any] | None) -> dict[str, Any]:
    a = (e or {}).get("attributes")
    return a if isinstance(a, dict) else {}


def primaries(dev: DeviceModel, ents: dict[str, dict[str, Any]], profile: str, override: dict[str, Any] | None = None) -> dict[str, str | None]:
    """The entity id behind each control (CR 3.4). `override` = the administrator's `primary_json` (only endpoints of this
    device are honoured). A speaker / player / receiver / group answers by `audio_primaries` (CR-016)."""
    if dev.kind != "screen":
        return audio_primaries(dev, ents, override)
    own = {e.ref for e in dev.endpoints}
    vendors = dev.by_role("vendor", domain="media_player")
    others = dev.by_role("other", domain="media_player")
    casts = dev.by_role("cast", domain="media_player")
    remotes = dev.by_role("remote", domain="remote")
    android_remote = next((e for e in remotes if e.platform == "androidtv_remote"), remotes[0] if remotes else None)
    # never the MA copies: MA shows only "External" for a TV. A receiver / speaker / player has no brand integration of a TV's kind: its own
    # integration (role "other": denonavr, yamaha, onkyo ...) is its vendor and outranks the Cast copy (it steps the volume, Cast may not)
    native = others if dev.kind != "screen" else []
    chain = vendors + native + casts + [e for e in others if e not in native]

    def first(pool: list[Endpoint], pred: Callable[[dict[str, Any] | None], bool] | None = None) -> str | None:
        for e in pool:
            if pred is None or pred(ents.get(e.ref)):
                return e.ref
        return None

    out: dict[str, str | None] = {}
    out["power"] = first(vendors + others)  # never Cast (its "on" launches an app), never MA
    transport = profiles.TRANSPORT.get(profile)
    if transport is None:
        out["keys"] = None
    elif transport[2] == "remote":
        out["keys"] = android_remote.ref if android_remote else None
    else:
        out["keys"] = first(vendors)
    out["sources"] = first(vendors + others, lambda e: _feat(e, F_SELECT_SOURCE))
    out["apps"] = (android_remote.ref if android_remote else None) if profile == "android_tv" else (first(vendors, lambda e: _feat(e, F_SELECT_SOURCE)) if profile in ("samsung_smart", "lg_webos") else None)
    out["volume"] = first(chain, lambda e: _feat(e, F_VOLUME_SET)) or first(chain, lambda e: _feat(e, F_VOLUME_STEP))
    out["mute"] = first(chain, lambda e: _feat(e, F_VOLUME_MUTE))
    playing_cast = first(casts, lambda e: _state(e) in ("playing", "paused") and bool(_attrs(e).get("media_title")))
    out["now_playing"] = playing_cast or first(vendors) or first(others) or first(casts)
    for control, endpoint_id in (override or {}).items():
        if control in out and isinstance(endpoint_id, str) and endpoint_id in own:
            out[control] = endpoint_id
    return out


def step_endpoint(dev: DeviceModel, ents: dict[str, dict[str, Any]], prim: dict[str, str | None]) -> str | None:
    """The endpoint that takes `volume_up` / `volume_down`: a vendor media_player with VOLUME_STEP, else the volume primary."""
    for e in dev.by_role("vendor", domain="media_player"):
        if _feat(ents.get(e.ref), F_VOLUME_STEP):
            return e.ref
    vol = prim.get("volume")
    return vol if vol and _feat(ents.get(vol), F_VOLUME_STEP) else None


# ------------------------------------------------------------------------------------------------ sources and apps


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value:
        if isinstance(item, str) and item.strip() and len(item) <= 120 and item not in out:
            out.append(item)
        if len(out) >= MAX_LIST:
            break
    return out


def heuristic_kind(name: str) -> str:
    """The default split of a merged source_list (inputs, apps and channels in one list): inputs by their names, the rest apps."""
    return "source" if _SOURCE_RE.match(name.strip()) else "app"


def default_label(item: str, kind: str) -> str:
    text = item.strip()
    if kind == "source":
        if _TV_SOURCE_RE.match(text):
            return TV_LABEL
        m = re.match(r"^hdmi\s*(\d+)$", text, re.I)
        if m:
            return f"HDMI {m.group(1)}"
        return text[:40]
    return _activity_label(text)


def _activity_label(text: str) -> str:
    """A readable default name of an app / activity id: a URL -> its host, a scheme link -> its scheme, a package -> its last
    meaningful part; already readable names stay."""
    t = text.strip()
    m = re.match(r"^[a-z][a-z0-9+.-]*://([^/?#]*)", t, re.I)
    if m and m.group(1):
        host = m.group(1).lower().removeprefix("www.")
        t = host.split(".")[0] if "." in host else host
    elif re.match(r"^[a-z][a-z0-9+.-]*://", t, re.I):
        t = t.split("://", 1)[0]
    elif re.fullmatch(r"[a-z][a-z0-9_]*(\.[a-z0-9_]+){2,}", t):
        parts = [p for p in t.split(".") if p not in ("com", "org", "net", "android", "google", "app", "tv", "ninja")]
        t = (parts or t.split("."))[-1]
    return (t[:1].upper() + t[1:])[:40] if t.isascii() else t[:40]


def glyph_of(item: str, kind: str) -> tuple[str, int | None]:
    """A neutral glyph and our own hue for a source or an app (never a brand logo or colour)."""
    low = item.lower()
    if kind == "source":
        if _TV_SOURCE_RE.match(item.strip()):
            return "antenna", None
        if "usb" in low:
            return "image", None
        return "hdmi", None
    for needle, glyph, hue in _APP_GLYPHS:
        if needle in low:
            return glyph, hue
    return "app", int(hashlib.sha1(low.encode("utf-8")).hexdigest()[:4], 16) % 360


def live_lists(dev: DeviceModel, ents: dict[str, dict[str, Any]], prim: dict[str, str | None], profile: str) -> tuple[list[str], list[str], list[str]]:
    """(source ids, app ids, channel ids) the endpoints offer now, before curation: Samsung / LG merge inputs and apps in the
    media_player's `source_list` (split by `heuristic_kind`), Android apps come from the remote's `activity_list`."""
    sources: list[str] = []
    apps: list[str] = []
    if dev.kind != "screen":  # an audio device has inputs only (a receiver's sources, a speaker's line-in): never apps
        return _string_list(_attrs(ents.get(prim.get("sources") or "")).get("source_list")), [], []
    if profile == "android_tv":
        apps = _string_list(_attrs(ents.get(prim.get("apps") or "")).get("activity_list"))
        sources = _string_list(_attrs(ents.get(prim.get("sources") or "")).get("source_list"))
        return sources, apps, []
    listing = _string_list(_attrs(ents.get(prim.get("sources") or prim.get("apps") or "")).get("source_list"))
    for item in listing:
        (sources if heuristic_kind(item) == "source" else apps).append(item)
    return sources, apps, []


def curate(live: list[str], curation: list[dict[str, Any]] | None, kind_default: str) -> list[dict[str, Any]]:
    """The curated items of one group (sources or apps) in display order: the curation's order first (entries the TV no longer
    lists are dropped), then the live items it does not know, at the end. Each item: id (the TV's own string), label, kind,
    glyph, hue, hidden."""
    by_id = {c["id"]: c for c in (curation or []) if isinstance(c, dict) and isinstance(c.get("id"), str)}
    order = [c["id"] for c in (curation or []) if isinstance(c, dict) and c.get("id") in live]
    order += [i for i in live if i not in by_id]
    out: list[dict[str, Any]] = []
    for item_id in dict.fromkeys(order):
        c = by_id.get(item_id, {})
        kind = c.get("kind") if c.get("kind") in ("source", "app", "channel") else kind_default
        glyph, hue = glyph_of(item_id, "source" if kind in ("source", "channel") else "app")
        if c.get("glyph") in GLYPHS:
            glyph = c["glyph"]
        label = c.get("label") if isinstance(c.get("label"), str) and c["label"].strip() else default_label(item_id, "source" if kind in ("source", "channel") else "app")
        out.append({"id": item_id, "label": label[:40], "kind": kind, "glyph": glyph, "hue": hue, "hidden": bool(c.get("hidden"))})
    return out


def split_curation(sources_json: list[dict[str, Any]] | None, apps_json: list[dict[str, Any]] | None, live_sources: list[str], live_apps: list[str]) -> tuple[list[str], list[str]]:
    """Reclassify the live items by the administrator's curation: an id the curation keeps in the other group moves there."""
    in_sources = {c.get("id") for c in (sources_json or []) if isinstance(c, dict)}
    in_apps = {c.get("id") for c in (apps_json or []) if isinstance(c, dict)}
    allv = list(dict.fromkeys(live_sources + live_apps))
    src = [i for i in allv if i in in_sources or (i not in in_apps and i in live_sources)]
    app = [i for i in allv if i in in_apps or (i not in in_sources and i in live_apps)]
    return src, app


# ------------------------------------------------------------------------------------------------ caps and live


def _iso(value: Any) -> str | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        parsed = dt.datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed.astimezone(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def power_state(e: dict[str, Any] | None, profile: str) -> str:
    """The screen's power as its primary endpoint reports it. Never inferred from a MISSING endpoint."""
    if e is None:
        return "unknown"
    state = e.get("state")
    if state == "unavailable" or not e.get("available", True):
        return "unavailable"
    if state is None or state == "unknown":
        return "unknown"
    if state == "off":
        return "off"
    if state == "standby":
        return "standby"
    if profile == "samsung_smart" and str(_attrs(e).get("art_mode_status") or "").lower() == "on":
        return "art"
    return "on"


def _volume_owner(dev: DeviceModel, linked: "DeviceView | None", ents: dict[str, dict[str, Any]], prim: dict[str, str | None], profile: str, audio_default: str) -> str:
    """'linked' when the receiver carries the volume: the administrator's default, or LG sending its sound to an external output."""
    if linked is None:
        return "screen"
    lg_external = profile == "lg_webos" and str(_attrs(ents.get(prim.get("power") or "")).get("sound_output") or "").startswith("external")
    return "linked" if audio_default == "linked" or lg_external else "screen"


@dataclass
class DeviceView:
    """One device with everything `caps` / `live` need: its model, the current entity dicts of its endpoints, the curated profile
    and the administrator's settings (volume ceiling, model keys, audio link, curation)."""
    dev: DeviceModel
    ents: dict[str, dict[str, Any]]
    profile: str
    prim: dict[str, str | None]
    audio_default: str = "screen"
    volume_max: int | None = None
    model_keys: list[str] = field(default_factory=list)
    sources_json: list[dict[str, Any]] | None = None
    apps_json: list[dict[str, Any]] | None = None
    recent_json: list[dict[str, Any]] | None = None
    artwork_ok: bool = False  # the caller says a content picture is available for the now-playing endpoint


def view_lists(v: DeviceView) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """(curated sources, curated apps) of a device, hidden items included (callers filter)."""
    live_src, live_app, _ch = live_lists(v.dev, v.ents, v.prim, v.profile)
    src_ids, app_ids = split_curation(v.sources_json, v.apps_json, live_src, live_app)
    sources = curate(src_ids, v.sources_json, "source")
    apps = curate(app_ids, v.apps_json, "app")
    return sources, apps


def caps(v: DeviceView, linked: DeviceView | None = None, *, group: dict[str, Any] | None = None, library: dict[str, Any] | None = None) -> dict[str, Any]:
    """The capability matrix of a device now (CR 3.5): from the live `supported_features` of the primaries, the profile and
    the state rules. The volume block describes the EFFECTIVE audio target (the receiver when it carries the sound). A speaker, player,
    receiver or group answers by `caps_audio` (CR-016)."""
    if v.dev.kind != "screen":
        return caps_audio(v, group, library)
    e_power = v.ents.get(v.prim.get("power") or "")
    owner = _volume_owner(v.dev, linked, v.ents, v.prim, v.profile, v.audio_default)
    src_view, vol_prim = (linked, linked.prim if linked else {}) if owner == "linked" and linked else (v, v.prim)
    e_vol = src_view.ents.get(vol_prim.get("volume") or "")
    e_mute = src_view.ents.get(vol_prim.get("mute") or "")
    step_id = step_endpoint(src_view.dev, src_view.ents, vol_prim)
    profile_keys = profiles.keys_of(v.profile) + [k for k in v.model_keys if k in profiles.model_key_options(v.profile)]
    key_ent = v.ents.get(v.prim.get("keys") or "")
    keys_ok = bool(profile_keys) and v.prim.get("keys") is not None and (available(key_ent) or not available(e_power))
    keys = [k for k in profiles.KEY_IDS if k in profile_keys] if keys_ok else []
    sources, apps = view_lists(v)
    e_src = v.ents.get(v.prim.get("sources") or "")
    e_play = v.ents.get(v.prim.get("now_playing") or "")
    lg_out = v.profile == "lg_webos" and _attrs(e_power).get("sound_output") is not None
    lg_external_no_slider = v.profile == "lg_webos" and owner == "screen" and str(_attrs(e_power).get("sound_output") or "").startswith("external")
    power_on = _feat(e_power, F_TURN_ON)
    reason = None
    if not power_on:
        # an LG that is off is `unavailable` by design (no wake without the owner's own trigger): that is "no remote wake", not a fault
        reason = "unavailable" if _state(e_power) == "unavailable" and v.profile != "lg_webos" else "no_remote_wake"
    dpad = {"up", "down", "left", "right", "ok"} <= set(keys)
    volume_set = _feat(e_vol, F_VOLUME_SET) and not lg_external_no_slider
    volume_step = _feat(src_view.ents.get(step_id or ""), F_VOLUME_STEP) or (owner == "screen" and {"volup", "voldown"} <= set(keys))
    return {
        "power_on": power_on, "power_on_reason": reason, "power_off": _feat(e_power, F_TURN_OFF),
        "volume_set": volume_set, "volume_step": bool(volume_step), "mute": _feat(e_mute, F_VOLUME_MUTE),
        "sources": _feat(e_src, F_SELECT_SOURCE) and any(not s["hidden"] for s in sources),
        "apps": any(not a["hidden"] for a in apps) and (v.profile == "android_tv" or _feat(v.ents.get(v.prim.get("apps") or ""), F_SELECT_SOURCE)),
        "sound_outputs": list(profiles.LG_SOUND_OUTPUTS) if lg_out else [],
        "transport": {"play": _feat(e_play, F_PLAY), "pause": _feat(e_play, F_PAUSE), "stop": _feat(e_play, F_STOP), "next": _feat(e_play, F_NEXT),
                      "previous": _feat(e_play, F_PREVIOUS), "seek": _feat(e_play, F_SEEK)},
        "keys": keys, "text": profiles.has_text(v.profile) and keys_ok, "touchpad": dpad,
        "art_mode": v.profile == "samsung_smart" and _attrs(e_power).get("art_mode_status") is not None,
    }


def _now_showing(v: DeviceView, power: str, sources: list[dict[str, Any]], apps: list[dict[str, Any]], artwork: str | None) -> dict[str, Any]:
    e_play = v.ents.get(v.prim.get("now_playing") or "")
    a = _attrs(e_play)
    e_power = v.ents.get(v.prim.get("power") or "")
    pa = _attrs(e_power)
    now: dict[str, Any] = {"kind": "none", "label": "", "app_id": None, "source_id": None, "title": None, "channel": None, "position_s": None, "duration_s": None,
                           "position_at": None, "artwork": artwork, "glyph": "app", "hue": None}
    if power == "art":
        return {**now, "kind": "art", "label": ART_LABEL, "glyph": "image", "hue": 190}
    if power in ("off", "standby", "unavailable", "unknown"):
        return now
    app_id = a.get("app_id") or pa.get("app_id")
    app_name = a.get("app_name") or pa.get("app_name")
    source = pa.get("source") or a.get("source")
    title = a.get("media_title") if isinstance(a.get("media_title"), str) and a.get("media_title") else None
    by_id = {s["id"]: s for s in sources + apps}
    channel = a.get("media_channel") if isinstance(a.get("media_channel"), (str, int)) and str(a.get("media_channel")) else None
    low_app = str(app_id or "").lower()
    if low_app and any(w in low_app for w in ("launcher", "leanback", "home")) and not title:
        now["kind"] = "home"
    elif low_app and any(w in low_app for w in ("backdrop", "screensaver", "dream", "ambient")):
        now.update(kind="saver", label=SAVER_LABEL)
    elif source and source in by_id and by_id[source]["kind"] in ("source", "channel"):
        s = by_id[source]
        now.update(kind="source", label=s["label"], source_id=source, glyph=s["glyph"], hue=s["hue"], channel=str(channel) if channel is not None else None)
    elif app_id or app_name or (source and source in by_id):
        item = by_id.get(str(source)) or by_id.get(str(app_id)) or by_id.get(str(app_name))
        label = (item or {}).get("label") or str(app_name or source or app_id)
        glyph, hue = (item["glyph"], item["hue"]) if item else glyph_of(label, "app")
        now.update(kind="app", label=label[:40], app_id=str(item["id"] if item else (app_id or app_name))[:120], glyph=glyph, hue=hue)
    elif e_play is not None and v.ents.get(v.prim.get("power") or "") is not None:
        a_act = _attrs(v.ents.get(v.prim.get("apps") or "")).get("current_activity")
        if isinstance(a_act, str) and a_act:
            item = by_id.get(a_act)
            label = (item or {}).get("label") or default_label(a_act, "app")
            now.update(kind="app", label=label, app_id=a_act[:120], glyph=(item or {}).get("glyph") or glyph_of(label, "app")[0], hue=(item or {}).get("hue"))
    if title and title.strip() not in (now["label"], str(source or ""), str(app_id or ""), str(app_name or "")):
        now["title"] = title[:120]  # a title that only repeats the source or app name adds nothing
    dur, pos = a.get("media_duration"), a.get("media_position")
    if isinstance(dur, (int, float)) and not isinstance(dur, bool) and dur > 0:
        now["duration_s"] = int(dur)
        if isinstance(pos, (int, float)) and not isinstance(pos, bool):
            now["position_s"] = int(pos)
            now["position_at"] = _iso(a.get("media_position_updated_at")) or _iso((e_play or {}).get("last_updated"))
    return now


def _epoch_ms(value: Any) -> float | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        parsed = dt.datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed.timestamp() * 1000.0


def live(v: DeviceView, linked: DeviceView | None = None, *, pending_power_ms: float | None = None, artwork: str | None = None, group: dict[str, Any] | None = None, queue: dict[str, Any] | None = None) -> dict[str, Any]:
    """The state a card draws (`MediaLive`). A speaker, player, receiver or group answers by `live_audio` (CR-016)."""
    if v.dev.kind != "screen":
        return live_audio(v, pending_power_ms=pending_power_ms, artwork=artwork, group=group, queue=queue)
    e_power = v.ents.get(v.prim.get("power") or "")
    power = power_state(e_power, v.profile)
    owner = _volume_owner(v.dev, linked, v.ents, v.prim, v.profile, v.audio_default)
    sources, apps = view_lists(v)
    sources = [s for s in sources if not s["hidden"]]
    apps = [a for a in apps if not a["hidden"]]
    e_play = v.ents.get(v.prim.get("now_playing") or "")
    play: str | None = None
    if power == "on":
        st = _state(e_play)
        play = "playing" if st in ("playing", "buffering") else "paused" if st == "paused" else "idle" if st == "idle" else None
    known = power not in ("unavailable", "unknown")
    confirmed = known
    if known and pending_power_ms:  # nothing reported since our last power command: the state is not confirmed yet
        reported = _epoch_ms((e_power or {}).get("last_updated") or (e_power or {}).get("last_changed"))
        confirmed = bool(reported is not None and reported >= pending_power_ms)
    vol_view = linked if owner == "linked" and linked else v
    vprim = vol_view.prim
    e_vol = vol_view.ents.get(vprim.get("volume") or "")
    level_src = e_vol if e_vol is not None and _attrs(e_vol).get("volume_level") is not None else next(
        (vol_view.ents.get(e.ref) for e in vol_view.dev.endpoints if vol_view.ents.get(e.ref) and _attrs(vol_view.ents.get(e.ref)).get("volume_level") is not None and e.role not in ("ma_export", "ma_import")), None)
    level = _attrs(level_src).get("volume_level")
    level_pct = None if isinstance(level, bool) or not isinstance(level, (int, float)) else max(0, min(100, round(float(level) * 100)))
    e_mute = vol_view.ents.get(vprim.get("mute") or "")
    muted = _attrs(e_mute).get("is_volume_muted")
    c_vol_set = _feat(e_vol, F_VOLUME_SET) and not (v.profile == "lg_webos" and owner == "screen" and str(_attrs(e_power).get("sound_output") or "").startswith("external"))
    out = {
        "power": power, "play": play, "confirmed": confirmed,
        "since": _iso((e_power or {}).get("last_changed")) if power == "unavailable" else None,
        "now": _now_showing(v, power, sources, apps, artwork),
        "volume": {"level": level_pct, "muted": muted if isinstance(muted, bool) else None, "target": owner, "step_only": not c_vol_set},
        "sound_output": (_attrs(e_power).get("sound_output") if isinstance(_attrs(e_power).get("sound_output"), str) else None) if v.profile == "lg_webos" else None,
    }
    return out


def recent_items(v: DeviceView) -> list[dict[str, Any]]:
    """The last confirmed picks that the TV still lists (id, kind, label, glyph), newest first, at most 6."""
    sources, apps = view_lists(v)
    by_id = {("source", s["id"]): s for s in sources if not s["hidden"]} | {("app", a["id"]): a for a in apps if not a["hidden"]}
    out = []
    for r in v.recent_json or []:
        if not isinstance(r, dict):
            continue
        item = by_id.get((r.get("kind"), r.get("id")))
        if item:
            out.append({"kind": r["kind"], "id": item["id"], "label": item["label"], "glyph": item["glyph"]})
    return out[:6]


# ------------------------------------------------------------------------------------------------ audio kinds (CR-016)
# Speakers, players, receivers and groups: the same device / endpoint / primary model as a screen, but the music layer, the one grouping
# layer, the zones of a receiver and the last good feature mask decide what a card offers (CR-016 5.2 - 5.4).


def asleep_when_unavailable(dev: DeviceModel) -> bool:
    """Availability is PER INTEGRATION (CR-016 5.4): a device reachable only through Cast drops off the network when it sleeps, so its
    `unavailable` means "off", not "broken" (system-V); a vendor integration that reports `unavailable` means exactly that."""
    mp = _audio_media_eps(dev)
    return bool(mp) and all((e.platform or "") == "cast" for e in mp)


def audio_primaries(dev: DeviceModel, ents: dict[str, dict[str, Any]], override: dict[str, Any] | None = None) -> dict[str, str | None]:
    """The entity id behind each control of a speaker / player / receiver / group (CR-016 5.2): power, volume and mute from the vendor entity
    (the main zone of a receiver), else the music layer, else Cast (never for power); sources and sound mode from the vendor entity and never
    the music layer; transport from the music layer when it owns the playback, else the vendor, else Cast; queue, favourites and transfer from
    the music layer only; grouping from the one grouping layer. A mirror is never any of them."""
    own = {e.ref for e in dev.endpoints}
    mp = _audio_media_eps(dev)
    music = music_endpoint(dev, ents)
    zone_main = next((z["endpoint_id"] for z in (dev.zones or [])[:1]), None)
    vendors = sorted((e for e in mp if e.role in ("vendor", "other")), key=lambda e: (0 if zone_main and e.endpoint_id == zone_main else 1, PLATFORM_PRIORITY.get(e.platform or "", 50), e.ref))
    casts = [e for e in mp if e.role == "cast"]

    def feat(e: Endpoint | None, *bits: int) -> bool:
        return e is not None and any(eff_features(ents.get(e.ref)) & b for b in bits)

    def first(pool: list[Endpoint], *bits: int) -> str | None:
        for e in pool:
            if not bits or feat(e, *bits):
                return e.ref
        return None

    out: dict[str, str | None] = {}
    out["power"] = first(vendors, F_TURN_ON, F_TURN_OFF) or (music.ref if feat(music, F_TURN_ON, F_TURN_OFF) and music else None)  # never Cast: its "on" launches an app
    out["volume"] = first(vendors, F_VOLUME_SET) or (music.ref if feat(music, F_VOLUME_SET) and music else None) or first(casts, F_VOLUME_SET) or first(vendors, F_VOLUME_STEP)
    out["mute"] = first(vendors, F_VOLUME_MUTE) or (music.ref if feat(music, F_VOLUME_MUTE) and music else None) or first(casts, F_VOLUME_MUTE)
    out["sources"] = first([e for e in vendors if music is None or e.ref != music.ref], F_SELECT_SOURCE)  # MA shows only "External"; Sonos favourites are the library
    out["sound_mode"] = first(vendors, F_SELECT_SOUND_MODE)
    out["apps"] = None
    out["keys"] = None
    out["music"] = music.ref if music else None
    gep, _layer = group_endpoint(dev, ents)
    out["group"] = gep.ref if gep else None
    # transport and now playing: the music layer when it plays and owns the playback (a queue), else the vendor, else Cast, else the music layer
    order: list[Endpoint] = []
    if music is not None:
        a = _attrs(ents.get(music.ref))
        if _state(ents.get(music.ref)) in ("playing", "paused", "buffering") and (a.get("active_queue") or (music.platform or "") in ("sonos", "heos")):
            order.append(music)
    order += vendors + casts
    if music is not None and music not in order:
        order.append(music)
    out["now_playing"] = first(order, F_PLAY, F_PAUSE) or (order[0].ref if order else None)
    for control, endpoint_id in (override or {}).items():
        if control in out and isinstance(endpoint_id, str) and endpoint_id in own:
            out[control] = endpoint_id
    return out


def zone_endpoint(dev: DeviceModel, zone: str | None) -> Endpoint | None:
    """The endpoint of a receiver's zone (`main`, `zone2`...): None for an unknown zone; the first zone when `zone` is None."""
    if not dev.zones:
        return None
    wanted = zone or dev.zones[0]["id"]
    ep_id = next((z["endpoint_id"] for z in dev.zones if z["id"] == wanted), None)
    return next((e for e in dev.endpoints if e.endpoint_id == ep_id), None) if ep_id else None


def zone_states(dev: DeviceModel, ents: dict[str, dict[str, Any]]) -> list[dict[str, Any]] | None:
    """`MediaDevice.zones` of a multi-zone receiver: [{id, name, power, volume, source_id, sound_mode}], Main first."""
    if not dev.zones:
        return None
    out = []
    for z in dev.zones:
        ep = next((e for e in dev.endpoints if e.endpoint_id == z["endpoint_id"]), None)
        e = ents.get(ep.ref) if ep else None
        a = _attrs(e)
        level = a.get("volume_level")
        out.append({"id": z["id"], "name": z["name"], "power": power_state(e, "generic"),
                    "volume": None if isinstance(level, bool) or not isinstance(level, (int, float)) else max(0, min(100, round(float(level) * 100))),
                    "source_id": a.get("source") if isinstance(a.get("source"), str) else None, "sound_mode": a.get("sound_mode") if isinstance(a.get("sound_mode"), str) else None})
    return out


def _members_attr(e: dict[str, Any] | None) -> list[str] | None:
    gm = _attrs(e).get("group_members")
    return [x for x in gm if isinstance(x, str)] if isinstance(gm, list) else None


NO_GROUP: dict[str, Any] = {"role": "none", "leader_key": None, "member_keys": [], "name": None, "static": False, "layer": None, "conflict": False}


def virtual_members(dev: DeviceModel, ents: dict[str, dict[str, Any]], by_entity: dict[str, str]) -> list[str]:
    """The device keys a helper group (`virtual_group`) fans out to - a shortcut, never a live group (its members are in its `entity_id` attribute)."""
    out: list[str] = []
    for e in dev.endpoints:
        raw = _attrs(ents.get(e.ref)).get("entity_id")
        for member in raw if isinstance(raw, list) else []:
            k = by_entity.get(member) if isinstance(member, str) else None
            if k and k != dev.key and k not in out:
                out.append(k)
    return out


def resolve_groups(devs: dict[str, DeviceModel], ents: dict[str, dict[str, Any]], by_entity: dict[str, str]) -> dict[str, dict[str, Any]]:
    """Group membership of every device (CR-016 5.3): `{role: leader | member | none, leader_key, member_keys (leader first), name, static, layer,
    conflict}`.

    A live group is the UNION of every player's `group_members` plus every Music Assistant player whose `active_queue` is another MA player
    (on system-V's cross-brand group of four only the leader and one member list all four; the other two list nothing). "Ungrouped" is any of
    the four encodings seen: `[]` (MA), `[self]` (WiiM, Sonos), `null` (HEOS), absent (Cast, Denon) - a member list of length 1 or less. The
    leader is the queue owner. ONE layer per device: a device with an MA endpoint is read through MA only, the others through their own
    grouping vendor; a vendor group of the same members (the WiiM pair of system-H) is an alias, and a vendor group that differs from the MA one is a
    `conflict` ("קיבוץ לא תואם"). A device of kind `group` is a static group (its members are its `group_members`); a helper group
    (`virtual_group`) is never a live group."""
    out = {k: dict(NO_GROUP, static=(d.kind == "group")) for k, d in devs.items()}
    layer_of: dict[str, tuple[Endpoint, str]] = {}
    for key, d in devs.items():
        ep, layer = group_endpoint(d, ents)
        if ep is not None and layer is not None:
            layer_of[key] = (ep, layer)
    for key, d in devs.items():
        if d.kind != "group":
            continue
        ep_layer = layer_of.get(key)
        members: list[str] = []
        for e in d.endpoints:
            for m in _members_attr(ents.get(e.ref)) or []:
                mk = by_entity.get(m)
                if mk and mk != key and mk in devs and mk not in members:
                    members.append(mk)
        out[key] = {"role": "leader", "leader_key": key, "member_keys": sorted(members), "name": None, "static": True, "layer": ep_layer[1] if ep_layer else None, "conflict": False}
    live_groups: dict[str, set[str]] = {}
    for layer in ("ma", "vendor"):
        keys = {k for k, (_ep, lay) in layer_of.items() if lay == layer and devs[k].kind != "group"}
        uid_to_key: dict[str, str] = {}
        for k in keys:
            uid = str(ents.get(layer_of[k][0].ref, {}).get("unique_id") or "").strip().lower()
            if uid:
                uid_to_key[uid] = k
        uf = _Union(len(keys))
        order = sorted(keys)
        pos = {k: i for i, k in enumerate(order)}
        points_at: dict[str, int] = {}  # a device -> how many players follow its queue
        first_listed: dict[str, int] = {}  # a device -> how many member lists name it first (the leader is listed first)
        for k in order:
            ent = ents.get(layer_of[k][0].ref)
            gm = _members_attr(ent)
            if gm and len(gm) > 1:
                head = by_entity.get(gm[0])
                if head and head in keys:
                    first_listed[head] = first_listed.get(head, 0) + 1
                for m in gm:
                    mk = by_entity.get(m)
                    if mk and mk != k and mk in keys:
                        uf.union(pos[k], pos[mk])
            if layer == "ma":
                queue = str(_attrs(ent).get("active_queue") or "").strip().lower()
                target = uid_to_key.get(queue) if queue else None
                if target and target != k:
                    uf.union(pos[k], pos[target])
                    points_at[target] = points_at.get(target, 0) + 1
        for ids in uf.groups().values():
            if len(ids) < 2:
                continue
            ks = [order[i] for i in ids]
            leader = sorted(ks, key=lambda k: (-points_at.get(k, 0), -first_listed.get(k, 0), k))[0]
            ordered = [leader] + sorted(k for k in ks if k != leader)
            for k in ks:
                out[k] = {"role": "leader" if k == leader else "member", "leader_key": leader, "member_keys": ordered, "name": None, "static": False, "layer": layer, "conflict": False}
            for k in ks:
                live_groups[k] = set(ordered)
    # layers that disagree: a device read through MA that ALSO groups natively with a different set (grouped in the vendor layer, not the same way in MA)
    for key, (ep, layer) in layer_of.items():
        if layer != "ma" or devs[key].kind == "group":
            continue
        vep = vendor_group_endpoint(devs[key], ents)
        gm = _members_attr(ents.get(vep.ref)) if vep is not None else None
        if not gm or len(gm) < 2:
            continue
        vendor_set = {by_entity.get(m) for m in gm if by_entity.get(m)} | {key}
        if vendor_set != live_groups.get(key, {key}):
            out[key] = dict(out[key], conflict=True)
    for key, d in devs.items():
        if layer_of.get(key) is not None and out[key]["layer"] is None:
            out[key]["layer"] = layer_of[key][1]
    return out


def caps_audio(v: DeviceView, group: dict[str, Any] | None = None, library: dict[str, Any] | None = None) -> dict[str, Any]:
    """The capability matrix of a speaker / player / receiver / group (CR-016 5.2 / 5.4): from the live `supported_features` of the AVAILABLE
    primary of each control, else the last good mask (`eff_features`) - never a degraded one. `group`: the device's live group (volume_group on
    a leader or a static group); `library`: `{provider, kinds_on, queue}` of the music layer (favourites, stations, playlists, up next, transfer
    follow the music provider and the administrator's list switches)."""
    dev, ents, prim = v.dev, v.ents, v.prim
    e = lambda c: ents.get(prim.get(c) or "")  # noqa: E731
    e_power, e_vol, e_mute, e_src, e_play, e_music, e_group, e_mode = e("power"), e("volume"), e("mute"), e("sources"), e("now_playing"), e("music"), e("group"), e("sound_mode")

    def has(ent: dict[str, Any] | None, bit: int) -> bool:
        return bool(eff_features(ent) & bit)

    sources, _apps = view_lists(v)
    modes = _string_list(_attrs(e_mode).get("sound_mode_list")) if has(e_mode, F_SELECT_SOUND_MODE) else []
    provider = music_provider_of(dev, ents)
    lib = library or {}
    kinds_on = lib.get("kinds_on", ("favourites", "stations", "playlists"))
    music_ok = provider in ("ma", "sonos")
    queue_attrs = _attrs(e_play).get("queue_size") is not None or _attrs(e_music).get("queue_size") is not None
    power_on = has(e_power, F_TURN_ON)
    return {
        "power_on": power_on, "power_on_reason": ("unavailable" if e_power is not None and _state(e_power) == "unavailable" and not power_on else None), "power_off": has(e_power, F_TURN_OFF),
        "volume_set": has(e_vol, F_VOLUME_SET), "volume_step": has(e_vol, F_VOLUME_STEP), "mute": has(e_mute, F_VOLUME_MUTE),
        "sources": has(e_src, F_SELECT_SOURCE) and any(not s["hidden"] for s in sources), "apps": False, "sound_outputs": modes,
        "transport": {"play": has(e_play, F_PLAY), "pause": has(e_play, F_PAUSE), "stop": has(e_play, F_STOP), "next": has(e_play, F_NEXT), "previous": has(e_play, F_PREVIOUS), "seek": has(e_play, F_SEEK)},
        "keys": [], "text": False, "touchpad": False, "art_mode": False,
        "shuffle": has(e_play, F_SHUFFLE_SET) or has(e_music, F_SHUFFLE_SET), "repeat": has(e_play, F_REPEAT_SET) or has(e_music, F_REPEAT_SET),
        "group": dev.kind != "group" and e_group is not None and has(e_group, F_GROUPING),
        "volume_group": bool(group) and (group.get("role") == "leader" or dev.kind == "group") and bool(group.get("member_keys")),
        "up_next": (provider == "ma") or (provider == "sonos" and queue_attrs),
        "favourites": music_ok and "favourites" in kinds_on, "stations": music_ok and "stations" in kinds_on, "playlists": provider == "ma" and "playlists" in kinds_on,
        "transfer": provider == "ma" and e_music is not None,
    }


def _now_audio(v: DeviceView, power: str, play: str | None, artwork: str | None) -> dict[str, Any]:
    e_play = v.ents.get(v.prim.get("now_playing") or "")
    a = _attrs(e_play)
    now: dict[str, Any] = {"kind": "none", "label": "", "app_id": None, "source_id": None, "title": None, "channel": None, "position_s": None, "duration_s": None, "position_at": None,
                           "artwork": None, "glyph": "music", "hue": None, "artist": None, "album": None}
    if power != "on":
        return now
    if v.dev.kind == "receiver":
        source = _attrs(v.ents.get(v.prim.get("sources") or v.prim.get("power") or "")).get("source")
        if isinstance(source, str) and source:
            return {**now, "kind": "source", "label": source[:40], "source_id": source[:120], "glyph": "hdmi"}
        return now
    if play not in ("playing", "paused"):
        return now
    title = a.get("media_title") if isinstance(a.get("media_title"), str) and a.get("media_title").strip() else None
    if title is None:
        return now
    artist = a.get("media_artist") if isinstance(a.get("media_artist"), str) and a.get("media_artist").strip() else None
    album = a.get("media_album_name") if isinstance(a.get("media_album_name"), str) and a.get("media_album_name").strip() else None
    dur, pos = a.get("media_duration"), a.get("media_position")
    has_dur = isinstance(dur, (int, float)) and not isinstance(dur, bool) and dur > 0
    station = str(a.get("media_content_type") or "").lower() == "radio" or not has_dur
    now.update(kind="station" if station else "music", label=title[:120], title=title[:120], artist=artist[:120] if artist else None, album=album[:120] if album else None, artwork=artwork)
    if has_dur and not station:
        now["duration_s"] = int(dur)
        if isinstance(pos, (int, float)) and not isinstance(pos, bool):
            now["position_s"] = int(pos)
            now["position_at"] = _iso(a.get("media_position_updated_at")) or _iso((e_play or {}).get("last_updated"))
    return now


def live_audio(v: DeviceView, *, pending_power_ms: float | None = None, artwork: str | None = None, group: dict[str, Any] | None = None, queue: dict[str, Any] | None = None) -> dict[str, Any]:
    """The state a speaker / player / receiver card draws (`MediaLive` with the CR-016 extension): a device without a power control is `on`
    while any endpoint is available; a device reachable through Cast only is `off` (asleep) when unavailable; `caps_known` is false when no
    endpoint is available (the card shows "לא זמין" and keeps its last controls greyed)."""
    dev, ents, prim = v.dev, v.ents, v.prim
    mp = _audio_media_eps(dev)
    avail = [e for e in mp if available(ents.get(e.ref))]
    e_power = ents.get(prim.get("power") or "")
    if prim.get("power"):
        power = power_state(e_power, "generic")
    elif avail:
        power = "on"
    else:
        power = "off" if asleep_when_unavailable(dev) else "unavailable"
    if prim.get("power") and power == "unavailable" and asleep_when_unavailable(dev):
        power = "off"
    e_play = ents.get(prim.get("now_playing") or "")
    play: str | None = None
    if power == "on":
        st = _state(e_play)
        play = "playing" if st in ("playing", "buffering") else "paused" if st == "paused" else "idle" if st in ("idle", "on", "off", "standby") else None
    known = power not in ("unavailable", "unknown")
    confirmed = known
    if known and pending_power_ms and prim.get("power"):
        reported = _epoch_ms((e_power or {}).get("last_updated") or (e_power or {}).get("last_changed"))
        confirmed = bool(reported is not None and reported >= pending_power_ms)
    e_vol = ents.get(prim.get("volume") or "")
    level_src = e_vol if e_vol is not None and _attrs(e_vol).get("volume_level") is not None else next(
        (ents.get(e.ref) for e in mp if ents.get(e.ref) and _attrs(ents.get(e.ref)).get("volume_level") is not None and available(ents.get(e.ref))), None)
    level = _attrs(level_src).get("volume_level")
    level_pct = None if isinstance(level, bool) or not isinstance(level, (int, float)) else max(0, min(100, round(float(level) * 100)))
    muted = _attrs(ents.get(prim.get("mute") or "")).get("is_volume_muted")
    a = _attrs(e_play)
    repeat = a.get("repeat") if a.get("repeat") in ("off", "one", "all") else None
    shuffle = a.get("shuffle") if isinstance(a.get("shuffle"), bool) else None
    if queue is None:
        size = a.get("queue_size")
        if isinstance(size, int) and not isinstance(size, bool):
            pos = a.get("queue_position")
            queue = {"count": size, "index": pos if isinstance(pos, int) and not isinstance(pos, bool) else None}
    mode = _attrs(ents.get(prim.get("sound_mode") or "")).get("sound_mode") if dev.kind == "receiver" else None
    return {
        "power": power, "play": play, "confirmed": confirmed, "since": _iso((e_power or ents.get(dev.anchor) or {}).get("last_changed")) if power == "unavailable" else None,
        "now": _now_audio(v, power, play, artwork),
        "volume": {"level": level_pct, "muted": muted if isinstance(muted, bool) else None, "target": "screen", "step_only": not (eff_features(e_vol) & F_VOLUME_SET)},
        "sound_output": mode if isinstance(mode, str) else None,
        "shuffle": shuffle, "repeat": repeat, "group": dict(group or NO_GROUP), "queue": queue, "caps_known": bool(avail),
    }
