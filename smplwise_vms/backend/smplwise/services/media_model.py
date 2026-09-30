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

CONFIDENCE_ORDER = {"exact": 0, "strong": 1, "weak": 2, "manual": 3}
RUNG_CONFIDENCE = {"device": "exact", "ma": "exact", "mac": "strong", "identifier": "strong", "manual": "manual"}
RUNG_ORDER = {"device": 1, "ma": 2, "mac": 3, "identifier": 4, "manual": 6, "single": 9}

# roles whose endpoint is a duplicate of the device's own integration when another endpoint exists (hidden in every API
# reply but the administrator's; CR 3.2)
DUPLICATE_ROLES = frozenset({"cast", "dlna", "smartthings", "ma_export", "ma_import"})
ROLES = ("vendor", "remote", "cast", "dlna", "smartthings", "ma_export", "ma_import", "ma_native", "ma_universal", "other")
KINDS = ("screen", "receiver", "speaker", "player", "group")
CONTROLS = ("power", "keys", "sources", "apps", "volume", "mute", "now_playing")
PLATFORM_PRIORITY = {"samsungtv_smart": 0, "webostv": 1, "androidtv_remote": 2, "samsungtv": 3, "androidtv": 4, "braviatv": 5, "philips_js": 6}

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


def normalise_identifier(value: Any) -> str | None:
    """A UUID / serial / Cast UUID for the identifier rung: lower-case, the `uuid:` prefix and dashes stripped; None when it is
    too short to be unique (under 8 characters)."""
    text = str(value or "").strip().lower()
    if text.startswith("uuid:"):
        text = text[5:]
    text = text.replace("-", "").replace(" ", "")
    return text if len(text) >= 8 else None


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
    if platform in profiles.VENDOR_PLATFORMS:
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


def kind_of(ents: list[dict[str, Any]]) -> str:
    """The kind of a device by its endpoints (manual kinds are applied by the caller): device class tv / projector -> screen;
    the integration of a TV brand -> screen; receiver; speaker; otherwise a player."""
    classes = {(e.get("device_class") or "").lower() for e in ents}
    platforms = {e.get("platform") or "" for e in ents}
    if classes & {"tv", "projector"}:
        return "screen"
    if platforms & set(profiles.VENDOR_PLATFORMS):
        return "screen"
    if "receiver" in classes:
        return "receiver"
    if "speaker" in classes:
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

    `entities`: dicts with entity_id, domain, platform, unique_id, device_id, device_class, name, original_name, area_id,
    attributes. `devices`: HA devices with device_id, name, name_by_user, area_id, connections [[type, value]] and
    identifiers [[domain, id]] (normalised by `normalise_*`). `rules`: the administrator's link / unlink / ignore rows.
    `existing_keys` (endpoint id -> device key) keeps a device's key stable while its endpoints change; `existing_anchors`
    (device key -> entity id) keeps its anchor. Deterministic for equal inputs (`new_key` supplies fresh keys)."""
    import uuid

    new_key = new_key or (lambda: uuid.uuid4().hex)
    existing_keys = existing_keys or {}
    existing_anchors = existing_anchors or {}
    rule_by_ep = {r["endpoint_id"]: r for r in (rules or [])}
    dev_by_id = {d["device_id"]: d for d in devices}

    cands = sorted((e for e in entities if e["domain"] in MEDIA_DOMAINS and rule_by_ep.get(endpoint_id_of(e["entity_id"]), {}).get("rule") != "ignore"), key=lambda e: e["entity_id"])
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
    for i, e in enumerate(eps):
        ent = ents[e.ref]
        if e.platform != "music_assistant":
            continue
        pids = {str(ent.get("unique_id") or "").strip().lower()}
        dev = dev_by_id.get(e.device_id or "")
        for dom, ident in (dev or {}).get("identifiers") or []:
            if dom == "music_assistant":
                pids.add(str(ident).strip().lower())
        for pid in pids:
            j = media_ids.get(pid)
            if j is not None and j != i:
                merge(i, j, "ma", False)
                eps[i].role = "ma_import"

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

    # the clusters; a cluster without a media_player is not a media device (a bare remote of a hub)
    groups = [sorted(ids) for ids in uf.groups().values()]
    groups = [g for g in groups if any(eps[i].domain == "media_player" for i in g)]
    groups.sort(key=lambda g: (-len(g), eps[g[0]].ref))

    # rung 5: weak suggestions (never merged): same area + the same normalised name
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
        here.remove(src)
        target.append(src)
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
        for e in ep_list:
            e.hidden = e.role in DUPLICATE_ROLES and any(x is not e and x.role not in DUPLICATE_ROLES for x in ep_list)
        anchor = _choose_anchor(ep_list, existing_anchors.get(key))
        platforms = {e.platform or "" for e in ep_list}
        dm = DeviceModel(key=key, endpoints=ep_list, kind=kind_of([ents[e.ref] for e in ep_list]), confidence=confidence, anchor=anchor, profile=profiles.detect(platforms))
        model.devices[key] = dm
        for e in ep_list:
            model.by_endpoint[e.endpoint_id] = key

    # the suggestions (weak rung): small clusters that look like a bigger one
    infos = []
    for key, g in keyed:
        name, area = cluster_name(g), cluster_area(g)
        if name and area:
            infos.append((key, g, name, area))
    for i, (ka, ga, na, aa) in enumerate(infos):
        for kb, gb, nb, ab in infos[i + 1:]:
            if na != nb or aa != ab:
                continue
            if _conflict([eps[x] for x in ga], [eps[x] for x in gb]):
                continue
            small, big = ((ka, ga), (kb, gb)) if len(ga) <= len(gb) else ((kb, gb), (ka, ga))
            model.suggestions.append(Suggestion(eps[small[1][0]].endpoint_id, big[0], "same_area_and_name"))
    return model


def _choose_anchor(eps: list[Endpoint], existing: str | None) -> str:
    """The device's home for name, area and scope: the kept one when it is still a member, else the vendor media_player, else
    a remote, else any media_player."""
    if existing and any(e.ref == existing for e in eps):
        return existing
    for roles, domain in ((("vendor",), "media_player"), (("remote",), None), (("other",), "media_player")):
        pool = sorted((e for e in eps if e.role in roles and (domain is None or e.domain == domain)), key=lambda e: (PLATFORM_PRIORITY.get(e.platform or "", 50), e.ref))
        if pool:
            return pool[0].ref
    mps = sorted((e for e in eps if e.domain == "media_player"), key=lambda e: e.ref)
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
    device are honoured)."""
    own = {e.ref for e in dev.endpoints}
    vendors = dev.by_role("vendor", domain="media_player")
    others = dev.by_role("other", domain="media_player")
    casts = dev.by_role("cast", domain="media_player")
    remotes = dev.by_role("remote", domain="remote")
    android_remote = next((e for e in remotes if e.platform == "androidtv_remote"), remotes[0] if remotes else None)
    chain = vendors + casts + others  # never the MA copies: MA shows only "External" for a TV

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


def caps(v: DeviceView, linked: DeviceView | None = None) -> dict[str, Any]:
    """The capability matrix of a device now (CR 3.5): from the live `supported_features` of the primaries, the profile and
    the state rules. The volume block describes the EFFECTIVE audio target (the receiver when it carries the sound)."""
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


def live(v: DeviceView, linked: DeviceView | None = None, *, pending_power_ms: float | None = None, artwork: str | None = None) -> dict[str, Any]:
    """The state a card draws (`MediaLive`)."""
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
