"""The media device model on the database (CR-015 section 3.2, docs/architecture/MEDIA_API.md): the `ha_devices` mirror, the
rebuild of `media_devices` / `media_device_endpoints` after every registry refresh, the catalogue the routes read (devices with
their live state and capabilities), scope and visibility, the administrator's operations (approve, link, curate) and the
housekeeping. The pure rules are in services/media_model.py, the brand tables in services/media_profiles.py.

Private material: MACs and identifiers live only in `ha_devices` and are read only by `rebuild`; no function here returns or
logs one. Nothing here talks to Home Assistant."""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import logging
import sqlite3
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

from ..db import now_iso
from ..errors import ApiError
from ..rbac import INSTALLATION, Decision, Principal, authorize, permissions_anywhere
from . import ha_scope, ha_sync, media_layout, media_model as mm, media_profiles as profiles

log = logging.getLogger("smplwise.media")

PERM_READ, PERM_CONTROL, PERM_POWER, PERM_PUBLIC, PERM_BULK, PERM_LAYOUT = "media.read", "media.control", "media.power", "media.public", "media.bulk", "media.layout"
ALL_PERMS = (PERM_READ, PERM_CONTROL, PERM_POWER, PERM_PUBLIC, PERM_BULK, PERM_LAYOUT)
CONFIGURE = "system.configure"
TOMBSTONE_DAYS = 30
BRIDGE_REQUIRED = "0.4.0"
PENDING_POWER_S = 20.0  # a power command younger than this whose state has not moved keeps the state "not confirmed"
CONTENT_ART_TYPES = frozenset({"video", "movie", "episode", "tvshow", "music", "track"})  # real content art, never an app or channel logo
ENDPOINT_PREFIX = "ha:"


def enabled(conn: sqlite3.Connection) -> bool:
    row = conn.execute("SELECT value FROM settings WHERE key = 'multimedia.enabled'").fetchone()
    return (row[0] if row else "true") != "false"


def version_tuple(text: str | None) -> tuple[int, ...]:
    import re

    return tuple(int(p) for p in re.findall(r"\d+", text or "")[:3])


def bridge_state(conn: sqlite3.Connection) -> dict[str, Any]:
    """`{paired, version, media_ready}`: commands need a paired bridge of at least 0.4.0 (an unknown version fails closed)."""
    row = conn.execute("SELECT key, value FROM settings WHERE key IN ('bridge.secret', 'bridge.paired_at', 'bridge.integration_version')").fetchall()
    s = {r[0]: r[1] for r in row}
    paired = bool(s.get("bridge.secret")) and bool(s.get("bridge.paired_at"))
    version = s.get("bridge.integration_version") or None
    return {"paired": paired, "version": version, "media_ready": paired and version_tuple(version) >= version_tuple(BRIDGE_REQUIRED)}


# ------------------------------------------------------------------------------------------------ in-memory index / artwork

class _Index:
    """endpoint entity id -> device key (approved or not) and the keys that are approved screens: what a state event looks up
    before it does any work. Rebuilt with every `rebuild`; loaded lazily after a restart."""

    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.by_entity: dict[str, str] = {}
        self.anchor: dict[str, str] = {}
        self.approved: set[str] = set()
        self.loaded = False
        self.last_sent: dict[str, float] = {}
        self.suggestions: list[mm.Suggestion] = []


INDEX = _Index()
# entity id -> (picture path as HA reported it, media_content_type): kept in memory ONLY, never in `attributes_json`, never in any API
ARTWORK: dict[str, tuple[str, str]] = {}
ARTWORK_MAX = 500


def note_picture(entity_id: str, attributes: dict[str, Any]) -> None:
    """`ha_sync.upsert_state`: remember (or forget) the media_player's `entity_picture` for the artwork proxy."""
    picture = attributes.get("entity_picture")
    if isinstance(picture, str) and picture.startswith("/api/") and len(picture) <= 600:
        if len(ARTWORK) >= ARTWORK_MAX and entity_id not in ARTWORK:
            ARTWORK.pop(next(iter(ARTWORK)))
        ARTWORK[entity_id] = (picture, str(attributes.get("media_content_type") or "").lower())
    else:
        ARTWORK.pop(entity_id, None)


def artwork_for(entity_id: str | None) -> tuple[str, str] | None:
    """(picture path, version hash) of the content art of an endpoint, or None (no picture, or an app / channel logo)."""
    if not entity_id:
        return None
    hit = ARTWORK.get(entity_id)
    if not hit or hit[1] not in CONTENT_ART_TYPES:
        return None
    return hit[0], hashlib.sha1(hit[0].encode("utf-8")).hexdigest()[:12]


def _refresh_index(conn: sqlite3.Connection) -> None:
    by_entity: dict[str, str] = {}
    for r in conn.execute("SELECT ref, device_key FROM media_device_endpoints WHERE source = 'ha'").fetchall():
        by_entity[r["ref"]] = r["device_key"]
    rows = conn.execute("SELECT device_key, anchor_entity_id, approved, kind FROM media_devices WHERE removed_at IS NULL").fetchall()
    with INDEX.lock:
        INDEX.by_entity = by_entity
        INDEX.anchor = {r["device_key"]: r["anchor_entity_id"] for r in rows if r["anchor_entity_id"]}
        INDEX.approved = {r["device_key"] for r in rows if r["approved"] and r["kind"] == "screen"}
        INDEX.loaded = True


def ensure_index(conn: sqlite3.Connection) -> None:
    if not INDEX.loaded:
        _refresh_index(conn)


# entities of the HA device(s) of an approved screen that could power it, switch its input or set its level (CR-015 review L3): they
# are listed read-only like its endpoints, and the generic action route refuses them too (409 use_media_screen)
SCREEN_CONTROL_DOMAINS = ("switch", "button", "select", "number", "remote", "media_player")
_DOMAINS_SQL = ",".join(f"'{d}'" for d in SCREEN_CONTROL_DOMAINS)
_SCREEN_DEVICES_SQL = (
    "SELECT ev.device_id FROM media_device_endpoints e JOIN media_devices d ON d.device_key = e.device_key JOIN ha_entities ev ON ev.entity_id = e.ref "
    "WHERE d.approved = 1 AND d.removed_at IS NULL AND e.source = 'ha' AND ev.device_id IS NOT NULL")


def managed_entities(conn: sqlite3.Connection) -> set[str]:
    """The entities operated only from "מולטימדיה": the media_player / remote endpoints of an APPROVED screen and every switch, button,
    select, number, remote or media_player entity of the HA device(s) those endpoints belong to (the generic action route answers 409
    use_media_screen; the catalogue lists them read-only)."""
    out = {r[0] for r in conn.execute(
        "SELECT e.ref FROM media_device_endpoints e JOIN media_devices d ON d.device_key = e.device_key WHERE d.approved = 1 AND d.removed_at IS NULL AND e.source = 'ha'").fetchall()}
    out.update(r[0] for r in conn.execute(
        f"SELECT entity_id FROM ha_entities WHERE removed_at IS NULL AND domain IN ({_DOMAINS_SQL}) AND device_id IN ({_SCREEN_DEVICES_SQL})").fetchall())
    return out


def is_managed(conn: sqlite3.Connection, entity_id: str) -> bool:
    if conn.execute(
            "SELECT 1 FROM media_device_endpoints e JOIN media_devices d ON d.device_key = e.device_key WHERE e.ref = ? AND e.source = 'ha' AND d.approved = 1 AND d.removed_at IS NULL", (entity_id,)).fetchone() is not None:
        return True
    return conn.execute(
        f"SELECT 1 FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL AND domain IN ({_DOMAINS_SQL}) AND device_id IN ({_SCREEN_DEVICES_SQL})", (entity_id,)).fetchone() is not None


# ------------------------------------------------------------------------------------------------ the ha_devices mirror


def apply_devices(conn: sqlite3.Connection, listing: list[dict[str, Any]]) -> int:
    """Mirror HA's device registry listing (the registry refresh already fetches it). Only a row whose content changed is written;
    a device absent from the listing is marked removed. Private values are normalised here and stored only in this table.
    Returns the number of rows written."""
    now = now_iso()
    seen: set[str] = set()
    written = 0
    existing = {r["device_id"]: r for r in conn.execute("SELECT * FROM ha_devices").fetchall()}
    for d in listing:
        device_id = d.get("id") or d.get("device_id")
        if not isinstance(device_id, str) or not device_id:
            continue
        seen.add(device_id)
        conns = json.dumps(mm.normalise_connections(d.get("connections")), ensure_ascii=False, separators=(",", ":"))
        idents = json.dumps(mm.normalise_identifiers(d.get("identifiers")), ensure_ascii=False, separators=(",", ":"))
        vals = (d.get("name") if isinstance(d.get("name"), str) else None, d.get("name_by_user") if isinstance(d.get("name_by_user"), str) else None,
                d.get("manufacturer") if isinstance(d.get("manufacturer"), str) else None, d.get("model") if isinstance(d.get("model"), str) else None,
                d.get("via_device_id") if isinstance(d.get("via_device_id"), str) else None, d.get("area_id") if isinstance(d.get("area_id"), str) else None, conns, idents)
        row = existing.get(device_id)
        if row is not None and row["removed_at"] is None and (row["name"], row["name_by_user"], row["manufacturer"], row["model"], row["via_device_id"], row["area_id"], row["connections_json"], row["identifiers_json"]) == vals:
            continue
        conn.execute(
            "INSERT INTO ha_devices(device_id, name, name_by_user, manufacturer, model, via_device_id, area_id, connections_json, identifiers_json, updated_at, removed_at) VALUES (?,?,?,?,?,?,?,?,?,?,NULL) "
            "ON CONFLICT(device_id) DO UPDATE SET name = excluded.name, name_by_user = excluded.name_by_user, manufacturer = excluded.manufacturer, model = excluded.model, via_device_id = excluded.via_device_id, "
            "area_id = excluded.area_id, connections_json = excluded.connections_json, identifiers_json = excluded.identifiers_json, updated_at = excluded.updated_at, removed_at = NULL",
            (device_id, *vals, now))
        written += 1
    for device_id in [k for k, r in existing.items() if k not in seen and r["removed_at"] is None]:
        conn.execute("UPDATE ha_devices SET removed_at = ?, updated_at = ? WHERE device_id = ?", (now, now, device_id))
        written += 1
    return written


def _load_ha_devices(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    out = []
    for r in conn.execute("SELECT * FROM ha_devices WHERE removed_at IS NULL").fetchall():
        try:
            conns, idents = json.loads(r["connections_json"] or "[]"), json.loads(r["identifiers_json"] or "[]")
        except ValueError:
            conns, idents = [], []
        out.append({"device_id": r["device_id"], "name": r["name"], "name_by_user": r["name_by_user"], "area_id": r["area_id"], "via_device_id": r["via_device_id"],
                    "connections": [tuple(x) for x in conns], "identifiers": [tuple(x) for x in idents]})
    return out


def _entity(r: sqlite3.Row) -> dict[str, Any]:
    d = dict(r)
    try:
        d["attributes"] = json.loads(d.pop("attributes_json") or "{}")
    except ValueError:
        d["attributes"] = {}
    d["disabled"], d["hidden"], d["available"] = bool(d["disabled"]), bool(d["hidden"]), bool(d["available"])
    return d


def load_media_entities(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    return [_entity(r) for r in conn.execute("SELECT * FROM ha_entities WHERE domain IN ('media_player', 'remote') AND removed_at IS NULL AND disabled = 0").fetchall()]


# ------------------------------------------------------------------------------------------------ rebuild


def _fingerprint(conn: sqlite3.Connection) -> str:
    h = hashlib.sha1()
    for sql in (
        "SELECT endpoint_id, device_key, role, rule, hidden, link_source FROM media_device_endpoints ORDER BY endpoint_id",
        "SELECT device_key, kind, kind_source, anchor_entity_id, confidence, removed_at FROM media_devices ORDER BY device_key",
    ):
        for r in conn.execute(sql):
            h.update(json.dumps(list(r), ensure_ascii=False, default=str).encode("utf-8"))
        h.update(b"|")
    return h.hexdigest()


def rebuild(conn: sqlite3.Connection) -> bool:
    """Run the dedupe ladder over the current media endpoints and bring `media_devices` / `media_device_endpoints` in line: new
    devices are created UNAPPROVED, vanished ones are tombstoned (their curation kept for TOMBSTONE_DAYS), a device keeps its key
    while its endpoints change. Returns True when something a screen shows moved (the caller publishes `media_devices_changed`)."""
    before = _fingerprint(conn)
    now = now_iso()
    entities = load_media_entities(conn)
    devices = _load_ha_devices(conn)
    rules = [dict(r) for r in conn.execute("SELECT * FROM media_link_rules").fetchall()]
    existing = {r["endpoint_id"]: r["device_key"] for r in conn.execute("SELECT endpoint_id, device_key FROM media_device_endpoints").fetchall()}
    anchors = {r["device_key"]: r["anchor_entity_id"] for r in conn.execute("SELECT device_key, anchor_entity_id FROM media_devices WHERE anchor_entity_id IS NOT NULL").fetchall()}
    # a device that was tombstoned keeps its key when it comes back: its endpoints are still in `existing` (never deleted with the tombstone)
    model = mm.build(entities, devices, rules, existing_keys=existing, existing_anchors=anchors, new_key=lambda: uuid.uuid4().hex)
    rows = {r["device_key"]: r for r in conn.execute("SELECT * FROM media_devices").fetchall()}
    for key, dev in model.devices.items():
        row = rows.get(key)
        if row is None:
            conn.execute(
                "INSERT INTO media_devices(device_key, kind, kind_source, anchor_entity_id, confidence, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
                (key, dev.kind, "auto", dev.anchor, dev.confidence, now, now))
        else:
            kind = dev.kind if row["kind_source"] == "auto" else row["kind"]
            if (row["kind"], row["anchor_entity_id"], row["confidence"], row["removed_at"]) != (kind, dev.anchor, dev.confidence, None):
                conn.execute("UPDATE media_devices SET kind = ?, anchor_entity_id = ?, confidence = ?, removed_at = NULL, updated_at = ? WHERE device_key = ?", (kind, dev.anchor, dev.confidence, now, key))
    for key in [k for k, r in rows.items() if k not in model.devices and r["removed_at"] is None]:
        conn.execute("UPDATE media_devices SET removed_at = ?, updated_at = ? WHERE device_key = ?", (now, now, key))
    have = {r["endpoint_id"]: r for r in conn.execute("SELECT * FROM media_device_endpoints").fetchall()}
    desired = {ep.endpoint_id: (key, ep) for key, dev in model.devices.items() for ep in dev.endpoints}
    # an endpoint that left a LIVE device is deleted; the endpoints of a tombstoned device stay, so the device is recognised (and keeps its key
    # and its curation) when its entities come back within TOMBSTONE_DAYS - every reader filters on the device's own `removed_at`
    for endpoint_id in [e for e in have if e not in desired and have[e]["source"] == "ha" and have[e]["device_key"] in model.devices]:
        conn.execute("DELETE FROM media_device_endpoints WHERE endpoint_id = ?", (endpoint_id,))
    for endpoint_id, (key, ep) in desired.items():
        row = have.get(endpoint_id)
        val = (key, ep.role, ep.platform, ep.rule, ep.link_source, 1 if ep.hidden else 0)
        if row is not None and (row["device_key"], row["role"], row["platform"], row["rule"], row["link_source"], row["hidden"]) == val:
            continue
        conn.execute(
            "INSERT INTO media_device_endpoints(endpoint_id, source, ref, device_key, role, platform, rule, link_source, hidden, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) "
            "ON CONFLICT(endpoint_id) DO UPDATE SET device_key = excluded.device_key, role = excluded.role, platform = excluded.platform, rule = excluded.rule, link_source = excluded.link_source, hidden = excluded.hidden, updated_at = excluded.updated_at",
            (endpoint_id, "ha", ep.ref, key, ep.role, ep.platform, ep.rule, ep.link_source, 1 if ep.hidden else 0, now))
    with INDEX.lock:
        INDEX.suggestions = list(model.suggestions)
    _refresh_index(conn)
    return _fingerprint(conn) != before


def suggestions() -> list[mm.Suggestion]:
    return list(INDEX.suggestions)


def rebuild_from(db: Any) -> bool:
    """One write transaction: rebuild and, when it changed anything a screen shows, tell the open clients."""
    with db.connection(durable=False) as conn:
        changed = rebuild(conn)
    if changed:
        ha_sync.publish({"type": "media_devices_changed", "reason": "registry"})
    return changed


# ------------------------------------------------------------------------------------------------ scope


class Access:
    """The caller's media permissions and where they hold them, computed once per request. A device is visible / operable when
    the permission holds at its anchor (installation-wide, or placed on one of the caller's floors - the scope rule of
    services/ha_scope.py; HA areas and floors are never a scope)."""

    def __init__(self, conn: sqlite3.Connection, principal: Principal, perms: tuple[str, ...] = ALL_PERMS) -> None:
        self.conn, self.principal = conn, principal
        self._sc = {p: ha_scope.visible_floors(conn, principal, p) for p in perms}
        need = any(not wide and floors for wide, floors in self._sc.values())
        self._placed = ha_scope.placements(conn) if need else {}

    def anywhere(self, perm: str) -> bool:
        wide, floors = self._sc[perm]
        return wide or bool(floors)

    def has(self, perm: str, entity_id: str | None) -> bool:
        wide, floors = self._sc[perm]
        if wide:
            return True
        return bool(entity_id) and ha_scope.entity_visible(False, floors, self._placed, entity_id or "")

    def decision(self, perm: str, entity_id: str | None) -> Decision | None:
        """The allowing decision behind `has` (installation, else the first floor the anchor is placed on) - what an audit row
        records as the scope the action ran under."""
        if not entity_id:
            return None
        placed = self._placed.get(entity_id) or ha_scope.placements(self.conn).get(entity_id, [])
        for target in [INSTALLATION] + [("floor", p["floor_id"]) for p in placed]:
            d = authorize(self.conn, self.principal, perm, target)
            if d.allowed:
                return d
        return None


# ------------------------------------------------------------------------------------------------ the catalogue


@dataclass
class Item:
    row: dict[str, Any]
    model: mm.DeviceModel
    view: mm.DeviceView
    anchor: dict[str, Any] | None
    name: str
    profile: str
    profile_source: str

    @property
    def key(self) -> str:
        return self.row["device_key"]


@dataclass
class Catalog:
    items: dict[str, Item] = field(default_factory=dict)
    pending: dict[str, int] = field(default_factory=dict)  # device key -> epoch ms of the last power command (recent: its state may not have moved yet)
    ents: dict[str, dict[str, Any]] = field(default_factory=dict)

    def linked(self, item: Item) -> Item | None:
        link = item.row.get("audio_link_key")
        other = self.items.get(link) if link else None
        return other if other is not None and other.key != item.key else None


def _loads(text: str | None, default: Any = None) -> Any:
    if not text:
        return default
    try:
        return json.loads(text)
    except ValueError:
        return default


def _override(row: dict[str, Any]) -> dict[str, str]:
    raw = _loads(row.get("primary_json"), {}) or {}
    return {c: (v[len(ENDPOINT_PREFIX):] if isinstance(v, str) and v.startswith(ENDPOINT_PREFIX) else v) for c, v in raw.items() if isinstance(v, str)}


def load_catalog(conn: sqlite3.Connection, *, approved_only: bool = True, kind: str | None = "screen", only: str | None = None) -> Catalog:
    """Every (approved) media device with its endpoints, current entity states, primaries and view (`only`: just that device and
    the receiver it is linked to)."""
    where = "removed_at IS NULL" + (" AND approved = 1" if approved_only else "") + (" AND kind = ?" if kind else "") + (" AND device_key = ?" if only else "")
    args = tuple(x for x in (kind, only) if x)
    rows = [dict(r) for r in conn.execute(f"SELECT * FROM media_devices WHERE {where} ORDER BY device_key", args)]
    # a linked receiver is a device of its own that may not be approved: its endpoints are needed too
    need = {r["device_key"] for r in rows} | {r["audio_link_key"] for r in rows if r.get("audio_link_key")}
    if need - {r["device_key"] for r in rows}:
        rows += [dict(r) for r in conn.execute(f"SELECT * FROM media_devices WHERE removed_at IS NULL AND device_key IN ({','.join('?' * len(need))})", list(need)) if r["device_key"] not in {x["device_key"] for x in rows}]
    cat = Catalog()
    if not rows:
        return cat
    eps_by_key: dict[str, list[sqlite3.Row]] = {}
    for r in conn.execute(f"SELECT * FROM media_device_endpoints WHERE device_key IN ({','.join('?' * len(need))}) AND source = 'ha'", list(need)).fetchall():
        eps_by_key.setdefault(r["device_key"], []).append(r)
    refs = [r["ref"] for lst in eps_by_key.values() for r in lst]
    ents: dict[str, dict[str, Any]] = {}
    for i in range(0, len(refs), 400):
        chunk = refs[i:i + 400]
        for r in conn.execute(f"SELECT * FROM ha_entities WHERE entity_id IN ({','.join('?' * len(chunk))})", chunk).fetchall():
            ents[r["entity_id"]] = _entity(r)
    cat.ents = ents
    device_ids = sorted({e["device_id"] for e in ents.values() if e.get("device_id")})
    hdev: dict[str, dict[str, Any]] = {}
    for i in range(0, len(device_ids), 400):
        chunk = device_ids[i:i + 400]
        for r in conn.execute(f"SELECT device_id, name, name_by_user FROM ha_devices WHERE removed_at IS NULL AND device_id IN ({','.join('?' * len(chunk))})", chunk).fetchall():
            hdev[r["device_id"]] = dict(r)
    for row in rows:
        key = row["device_key"]
        endpoints = [mm.Endpoint(e["endpoint_id"], e["ref"], e["ref"].split(".", 1)[0], e["platform"], (ents.get(e["ref"]) or {}).get("device_id"), e["role"], e["rule"], e["link_source"], bool(e["hidden"]))
                     for e in sorted(eps_by_key.get(key, []), key=lambda r: r["ref"])]
        if not endpoints:
            continue
        anchor_id = row.get("anchor_entity_id") or endpoints[0].ref
        detected = profiles.detect({e.platform or "" for e in endpoints})
        profile = row.get("profile") if row.get("profile") in profiles.PROFILE_IDS else detected
        model = mm.DeviceModel(key=key, endpoints=endpoints, kind=row["kind"], confidence=row["confidence"], anchor=anchor_id, profile=detected)
        prim = mm.primaries(model, ents, profile, _override(row))
        view = mm.DeviceView(dev=model, ents=ents, profile=profile, prim=prim, audio_default=row.get("audio_default") or "screen", volume_max=row.get("volume_max"),
                             model_keys=[k for k in (_loads(row.get("model_keys_json"), []) or []) if k in profiles.model_key_options(profile)],
                             sources_json=_loads(row.get("sources_json")), apps_json=_loads(row.get("apps_json")), recent_json=_loads(row.get("recent_json"), []))
        anchor = ents.get(anchor_id)
        name = row.get("display_name") or mm.device_display_name([e for e in (ents.get(x.ref) for x in endpoints) if e], anchor_id, hdev.get((anchor or {}).get("device_id") or ""))
        cat.items[key] = Item(row, model, view, anchor, name, profile, "pinned" if row.get("profile") in profiles.PROFILE_IDS else "detected")
    cutoff = int((time.time() - PENDING_POWER_S) * 1000)
    for r in conn.execute("SELECT device_key, MAX(created_ms) AS at FROM media_commands WHERE command IN ('power_on', 'power_off') AND status != 'refused' AND created_ms >= ? GROUP BY device_key", (cutoff,)).fetchall():
        cat.pending[r["device_key"]] = r["at"]
    return cat


def live_of(cat: Catalog, item: Item, key_url: bool = True) -> dict[str, Any]:
    linked = cat.linked(item)
    art = None
    np_id = item.view.prim.get("now_playing")
    hit = artwork_for(np_id)
    if hit and key_url:
        art = f"api/v1/multimedia/devices/{item.key}/artwork?v={hit[1]}"
    return mm.live(item.view, linked.view if linked else None, pending_power_ms=cat.pending.get(item.key), artwork=art)


def caps_of(cat: Catalog, item: Item) -> dict[str, Any]:
    linked = cat.linked(item)
    return mm.caps(item.view, linked.view if linked else None)


def installation_remote(conn: sqlite3.Connection) -> dict[str, Any]:
    row = conn.execute("SELECT value FROM settings WHERE key = 'multimedia.remote_default'").fetchone()
    if row and row[0]:
        try:
            return media_layout.normalise_remote_config(json.loads(row[0]))
        except ValueError:
            pass
    return media_layout.default_remote()


def remote_of(conn: sqlite3.Connection, item: Item) -> dict[str, Any]:
    raw = _loads(item.row.get("remote_json"))
    if raw:
        try:
            return {**media_layout.normalise_remote_config(raw), "scope": "device"}
        except ValueError:
            pass
    return {**installation_remote(conn), "scope": "default"}


def floor_area(item: Item) -> dict[str, Any]:
    a = item.anchor or {}
    return {"floor_id": a.get("ha_floor_id"), "floor_name": a.get("ha_floor_name"), "area_id": a.get("area_id"), "area_name": a.get("area_name")}


def device_item(cat: Catalog, item: Item, access: Access) -> dict[str, Any]:
    """`MediaDevice` (contract 2.1): nothing in it carries a hidden endpoint's id, a MAC, an HA identifier, an IP or an HA URL."""
    anchor = item.row.get("anchor_entity_id")
    linked = cat.linked(item)
    public = bool(item.row["is_public"])
    return {
        "key": item.key, "name": item.name, "kind": item.row["kind"], "profile": item.profile, **floor_area(item), "public": public,
        "live": live_of(cat, item), "caps": caps_of(cat, item),
        # the receiver's name only for a caller who may read the receiver itself (review L2): it is a device of its own, possibly on another floor
        "audio_link": {"key": linked.key, "name": linked.name, "default": item.row.get("audio_default") or "screen"} if linked and access.has(PERM_READ, linked.row.get("anchor_entity_id")) else None,
        "can": {"control": access.has(PERM_CONTROL, anchor), "power": access.has(PERM_POWER, anchor), "public_ok": (not public) or access.has(PERM_PUBLIC, anchor), "bulk": access.has(PERM_BULK, anchor)},
    }


def device_detail(conn: sqlite3.Connection, cat: Catalog, item: Item, access: Access) -> dict[str, Any]:
    base = device_item(cat, item, access)
    sources, apps = mm.view_lists(item.view)
    pub = lambda items: [{"id": i["id"], "label": i["label"], "kind": i["kind"], "glyph": i["glyph"], "hue": i["hue"]} for i in items if not i["hidden"]]  # noqa: E731
    return {**base, "sources": pub(sources), "apps": pub(apps), "recent": mm.recent_items(item.view), "remote": remote_of(conn, item), "model_keys": list(item.view.model_keys)}


def visible_items(cat: Catalog, access: Access) -> list[Item]:
    return [i for i in cat.items.values() if i.row["kind"] == "screen" and i.row["approved"] and access.has(PERM_READ, i.row.get("anchor_entity_id"))]


def find_visible(conn: sqlite3.Connection, principal: Principal, key: str) -> tuple[Catalog, Item, Access]:
    """The approved screen `key` when the caller may read it, else 404 (an invisible device is never a 403)."""
    cat = load_catalog(conn)
    item = cat.items.get(key)
    access = Access(conn, principal)
    if item is None or not item.row["approved"] or item.row["kind"] != "screen" or not access.has(PERM_READ, item.row.get("anchor_entity_id")):
        raise ApiError(404, "not_found", "המסך לא נמצא.")
    return cat, item, access


# ------------------------------------------------------------------------------------------------ state events


THROTTLE_S = 0.25  # media_state: at most 4 frames per second per device


def on_state_event(db: Any, entity_id: str) -> None:
    """`ha_sync`, after a state event of an entity: when it is an endpoint of an approved screen, recompute that device's `live`
    from the stored states and publish `media_state` (throttled per device; none while the feature is off). The frame carries the anchor
    `entity_id` only for the `/ha/ws` scope filter: the socket removes it before sending unless the subscriber holds system.configure.
    Never raises."""
    if not (entity_id.startswith("media_player.") or entity_id.startswith("remote.")):
        return
    try:
        if not INDEX.loaded:
            with db.connection(mode="read") as conn:
                ensure_index(conn)
        key = INDEX.by_entity.get(entity_id)
        if key is None or key not in INDEX.approved:
            return
        now = time.monotonic()
        if now - INDEX.last_sent.get(key, 0.0) < THROTTLE_S:
            return
        INDEX.last_sent[key] = now
        with db.connection(mode="read") as conn:
            if not enabled(conn):  # multimedia.enabled = false: no frames at all (CR-015 review L5)
                return
            cat = load_catalog(conn, only=key)
            item = cat.items.get(key)
            if item is None:
                return
            payload = {"type": "media_state", "device_key": key, "entity_id": item.row.get("anchor_entity_id"), "live": live_of(cat, item)}
        ha_sync.publish(payload)
    except Exception:  # noqa: BLE001 - a push never breaks the state feed
        log.warning("media_state for %s failed", entity_id, exc_info=True)


# ------------------------------------------------------------------------------------------------ status


def status(conn: sqlite3.Connection, principal: Principal) -> dict[str, Any]:
    """`GET /multimedia/status` (contract 2.3)."""
    held = set(permissions_anywhere(conn, principal))
    configure = authorize(conn, principal, CONFIGURE, INSTALLATION).allowed
    body: dict[str, Any] = {
        "enabled": enabled(conn), "bridge": bridge_state(conn),
        "can": {"read": PERM_READ in held, "control": PERM_CONTROL in held, "power": PERM_POWER in held, "public": PERM_PUBLIC in held, "bulk": PERM_BULK in held,
                "layout": PERM_LAYOUT in held, "configure": configure, "personalize": "screen.personalize" in held},
        "profiles_version": profiles.PROFILES_VERSION,
    }
    screens = on = 0
    if PERM_READ in held and body["enabled"]:
        cat = load_catalog(conn)
        access = Access(conn, principal, (PERM_READ,))
        for item in visible_items(cat, access):
            screens += 1
            on += live_of(cat, item, key_url=False)["power"] == "on"
    pending = conn.execute("SELECT COUNT(*) FROM media_devices WHERE removed_at IS NULL AND kind = 'screen' AND approved = 0").fetchone()[0] if configure else None
    body["counts"] = {"screens": screens, "on": on, "pending_approval": pending}
    return body


# ------------------------------------------------------------------------------------------------ administration


def _clean_name(value: Any) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ApiError(422, "validation", "שם התקן חייב להיות טקסט.", details={"fields": ["display_name"]})
    text = value.strip()
    if any(ord(c) < 32 or ord(c) == 127 for c in text) or len(text) > 80:
        raise ApiError(422, "validation", "שם התקן: טקסט רגיל עד 80 תווים.", details={"fields": ["display_name"]})
    return text or None


def admin_rows(conn: sqlite3.Connection) -> dict[str, Any]:
    """`GET /multimedia/admin/devices` (contract 3.11): every device with its endpoints (hidden ones too) and the weak suggestions."""
    cat = load_catalog(conn, approved_only=False, kind=None)
    out = []
    for item in sorted(cat.items.values(), key=lambda i: (i.row["kind"], i.name, i.key)):
        prim = item.view.prim
        eps = []
        for ep in item.model.endpoints:
            eps.append({"endpoint_id": ep.endpoint_id, "platform": ep.platform, "role": ep.role, "rule": ep.rule, "link_source": ep.link_source, "hidden": ep.hidden,
                        "primary_for": [c for c in mm.CONTROLS if prim.get(c) == ep.ref]})
        out.append({
            "key": item.key, "name": item.name, "kind": item.row["kind"], "kind_source": item.row["kind_source"], "approved": bool(item.row["approved"]), "public": bool(item.row["is_public"]),
            "profile": item.profile, "profile_source": item.profile_source, "confidence": item.row["confidence"], "anchor_entity_id": item.row.get("anchor_entity_id"),
            "floor_name": floor_area(item)["floor_name"], "area_name": floor_area(item)["area_name"], "audio_link_key": item.row.get("audio_link_key"),
            "audio_default": item.row.get("audio_default") or "screen", "volume_max": item.row.get("volume_max"), "model_keys": list(item.view.model_keys),
            "model_key_options": profiles.model_key_options(item.profile), "display_name": item.row.get("display_name"), "also_turns_on": [], "endpoints": eps,
        })
    names = {d["key"]: d["name"] for d in out}
    return {"devices": out, "suggestions": [{"endpoint_id": s.endpoint_id, "device_key": s.device_key, "rule": "weak", "reason": s.reason, "device_name": names.get(s.device_key)} for s in suggestions() if s.device_key in names]}


def update_device(conn: sqlite3.Connection, key: str, body: dict[str, Any]) -> dict[str, Any]:
    """`PUT /multimedia/admin/devices/{key}` (contract 3.12): every field optional; returns the changed field names."""
    row = conn.execute("SELECT * FROM media_devices WHERE device_key = ? AND removed_at IS NULL", (key,)).fetchone()
    if row is None:
        raise ApiError(404, "not_found", "ההתקן לא נמצא.")
    sets: dict[str, Any] = {}
    if "display_name" in body:
        sets["display_name"] = _clean_name(body["display_name"])
    if "kind" in body:
        kind = body["kind"]
        if kind in (None, "auto"):
            sets["kind_source"] = "auto"
        elif kind in ("screen", "receiver", "speaker", "player"):
            sets["kind"], sets["kind_source"] = kind, "manual"
        else:
            raise ApiError(422, "validation", "סוג התקן לא מוכר.", details={"fields": ["kind"]})
    if "approved" in body:
        sets["approved"] = 1 if body["approved"] else 0
    if "public" in body:
        sets["is_public"] = 1 if body["public"] else 0
    eps = conn.execute("SELECT endpoint_id, ref, platform FROM media_device_endpoints WHERE device_key = ?", (key,)).fetchall()
    profile = row["profile"] if row["profile"] in profiles.PROFILE_IDS else profiles.detect({e["platform"] or "" for e in eps})
    if "profile" in body:
        p = body["profile"]
        if p in (None, "auto"):
            sets["profile"] = None
            profile = profiles.detect({e["platform"] or "" for e in eps})
        elif p in profiles.PROFILE_IDS:
            sets["profile"], profile = p, p
        else:
            raise ApiError(422, "validation", "פרופיל לא מוכר.", details={"fields": ["profile"]})
    if "audio_link_key" in body:
        link = body["audio_link_key"]
        if link is not None:
            target = conn.execute("SELECT kind, audio_link_key FROM media_devices WHERE device_key = ? AND removed_at IS NULL", (link,)).fetchone() if isinstance(link, str) else None
            if target is None or link == key or target["kind"] not in ("receiver", "speaker", "player") or target["audio_link_key"] == key:
                raise ApiError(422, "validation", "ההתקן המקושר חייב להיות מגבר, רמקול או נגן אחר (ללא מעגל).", details={"fields": ["audio_link_key"]})
        sets["audio_link_key"] = link
        if link is None:
            sets["audio_default"] = "screen"
    if "audio_default" in body:
        if body["audio_default"] not in ("screen", "linked"):
            raise ApiError(422, "validation", "יעד שמע לא מוכר.", details={"fields": ["audio_default"]})
        if body["audio_default"] == "linked" and not (sets.get("audio_link_key", row["audio_link_key"])):
            raise ApiError(422, "validation", "יעד שמע 'מגבר' דורש מגבר מקושר.", details={"fields": ["audio_default"]})
        sets["audio_default"] = body["audio_default"]
    if "volume_max" in body:
        v = body["volume_max"]
        if v is not None and (isinstance(v, bool) or not isinstance(v, int) or not 0 <= v <= 100):
            raise ApiError(422, "validation", "תקרת עוצמה: 0 עד 100.", details={"fields": ["volume_max"]})
        sets["volume_max"] = v
    if "model_keys" in body:
        mk = body["model_keys"]
        allowed = profiles.model_key_options(profile)
        if not isinstance(mk, list) or any(k not in allowed for k in mk):
            raise ApiError(422, "validation", "מקש דגם לא מוכר לפרופיל.", details={"fields": ["model_keys"], "allowed": allowed})
        sets["model_keys_json"] = json.dumps(list(dict.fromkeys(mk)))
    if "primary" in body:
        prim = body["primary"]
        if not isinstance(prim, dict):
            raise ApiError(422, "validation", "primary חייב להיות אובייקט.", details={"fields": ["primary"]})
        stored = _loads(row["primary_json"], {}) or {}
        own = {e["endpoint_id"] for e in eps}
        for control, endpoint_id in prim.items():
            if control not in mm.CONTROLS:
                raise ApiError(422, "validation", "בקרה לא מוכרת.", details={"fields": ["primary"], "control": control})
            if endpoint_id is None:
                stored.pop(control, None)
            elif endpoint_id in own:
                stored[control] = endpoint_id
            else:
                raise ApiError(422, "validation", "נקודת הקצה אינה של ההתקן הזה.", details={"fields": ["primary"], "control": control})
        sets["primary_json"] = json.dumps(stored) if stored else None
    if sets:
        sets["updated_at"] = now_iso()
        conn.execute(f"UPDATE media_devices SET {', '.join(f'{k} = ?' for k in sets)} WHERE device_key = ?", (*sets.values(), key))
    return {"changed": sorted(k for k in sets if k != "updated_at")}


def set_link_rule(conn: sqlite3.Connection, principal: Principal, op: str, endpoint_id: str, device_key: str | None) -> None:
    import re

    if not re.fullmatch(r"ha:(media_player|remote)\.[a-z0-9_]{1,200}", endpoint_id or ""):
        raise ApiError(422, "validation", "מזהה נקודת קצה לא תקין.", details={"fields": ["endpoint_id"]})
    if op == "restore":
        conn.execute("DELETE FROM media_link_rules WHERE endpoint_id = ?", (endpoint_id,))
        return
    if op not in ("link", "unlink", "ignore"):
        raise ApiError(422, "validation", "פעולה לא מוכרת.", details={"fields": ["op"]})
    if op == "link":
        if not device_key or conn.execute("SELECT 1 FROM media_devices WHERE device_key = ? AND removed_at IS NULL", (device_key,)).fetchone() is None:
            raise ApiError(422, "validation", "ההתקן שאליו מקשרים לא נמצא.", details={"fields": ["device_key"]})
    conn.execute(
        "INSERT INTO media_link_rules(endpoint_id, rule, device_key, set_by, set_at) VALUES (?,?,?,?,?) ON CONFLICT(endpoint_id) DO UPDATE SET rule = excluded.rule, device_key = excluded.device_key, set_by = excluded.set_by, set_at = excluded.set_at",
        (endpoint_id, op, device_key if op == "link" else None, principal.user_id, now_iso()))


def approve(conn: sqlite3.Connection, keys: list[str] | None, approved: bool) -> dict[str, int]:
    """`POST /multimedia/admin/approve`: approve (or withdraw) the named devices; `keys` omitted = every detected SCREEN (decision 3,
    "approve all detected screens" in one tap)."""
    if keys is None:
        targets = [r[0] for r in conn.execute("SELECT device_key FROM media_devices WHERE removed_at IS NULL AND kind = 'screen'").fetchall()]
    else:
        targets = [r[0] for r in conn.execute(f"SELECT device_key FROM media_devices WHERE removed_at IS NULL AND device_key IN ({','.join('?' * len(keys))})", keys).fetchall()] if keys else []
    changed = 0
    now = now_iso()
    for k in targets:
        changed += conn.execute("UPDATE media_devices SET approved = ?, updated_at = ? WHERE device_key = ? AND approved != ?", (1 if approved else 0, now, k, 1 if approved else 0)).rowcount
    pending = conn.execute("SELECT COUNT(*) FROM media_devices WHERE removed_at IS NULL AND kind = 'screen' AND approved = 0").fetchone()[0]
    total = conn.execute("SELECT COUNT(*) FROM media_devices WHERE removed_at IS NULL AND kind = 'screen' AND approved = 1").fetchone()[0]
    _refresh_index(conn)
    return {"requested": len(targets), "changed": changed, "approved": total, "pending_approval": pending}


# ------------------------------------------------------------------------------------------------ curation of the remote


def _curation_items(items: Any, name: str, *, with_kind: bool) -> list[dict[str, Any]]:
    if items is None:
        return []
    if not isinstance(items, list) or len(items) > mm.MAX_LIST:
        raise ApiError(422, "validation", f"{name}: רשימה של עד {mm.MAX_LIST} פריטים.", details={"fields": [name]})
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for it in items:
        if not isinstance(it, dict) or set(it) - {"id", "label", "hidden", "kind", "glyph"}:
            raise ApiError(422, "validation", f"{name}: פריט לא תקין.", details={"fields": [name]})
        item_id = it.get("id")
        if not isinstance(item_id, str) or not item_id or len(item_id) > 120 or item_id in seen:
            raise ApiError(422, "validation", f"{name}: מזהה פריט לא תקין.", details={"fields": [name]})
        label = it.get("label")
        if label is not None and (not isinstance(label, str) or len(label.strip()) > 40 or any(ord(c) < 32 or ord(c) == 127 for c in label)):
            raise ApiError(422, "validation", f"{name}: שם עד 40 תווים.", details={"fields": [name]})
        glyph = it.get("glyph")
        if glyph is not None and glyph not in mm.GLYPHS:
            raise ApiError(422, "validation", f"{name}: אייקון לא מוכר.", details={"fields": [name]})
        kind = it.get("kind")
        if kind is not None and kind not in (("source", "app", "channel") if with_kind else ("app",)):
            raise ApiError(422, "validation", f"{name}: סוג לא מוכר.", details={"fields": [name]})
        seen.add(item_id)
        out.append({"id": item_id, "label": (label or "").strip() or None, "hidden": bool(it.get("hidden", False)), "kind": kind, "glyph": glyph})
    return out


def save_device_remote(conn: sqlite3.Connection, key: str, body: dict[str, Any]) -> None:
    """`PUT /multimedia/devices/{key}/remote` (contract 3.8): the per-screen remote override (`null` = back to the default) and the
    full ordered curation lists. Unknown ids are kept out, live ids missing from a list are appended at display time."""
    row = conn.execute("SELECT * FROM media_devices WHERE device_key = ? AND removed_at IS NULL", (key,)).fetchone()
    if row is None:
        raise ApiError(404, "not_found", "המסך לא נמצא.")
    sets: dict[str, Any] = {}
    if "remote" in body:
        remote = body["remote"]
        if remote is None:
            sets["remote_json"] = None
        else:
            try:
                norm = media_layout.normalise_remote_config(remote)
            except ValueError as exc:
                raise ApiError(422, "validation", "הגדרת השלט אינה תקינה.", details={"fields": ["remote"], "reason": str(exc)}) from None
            sets["remote_json"] = json.dumps(norm, ensure_ascii=False)
    if "sources" in body or "apps" in body:
        sources = _curation_items(body.get("sources"), "sources", with_kind=True) if "sources" in body else _loads(row["sources_json"], []) or []
        apps = _curation_items(body.get("apps"), "apps", with_kind=False) if "apps" in body else _loads(row["apps_json"], []) or []
        # an entry the administrator classed as an app in the sources list lives in the apps list (and the other way round is never offered)
        moved = [dict(s, kind="app") for s in sources if s.get("kind") == "app"]
        sources = [s for s in sources if s.get("kind") != "app"]
        ids = {a["id"] for a in apps}
        apps = apps + [m for m in moved if m["id"] not in ids]
        sets["sources_json"] = json.dumps(sources, ensure_ascii=False)
        sets["apps_json"] = json.dumps(apps, ensure_ascii=False)
    if sets:
        sets["updated_at"] = now_iso()
        conn.execute(f"UPDATE media_devices SET {', '.join(f'{k} = ?' for k in sets)} WHERE device_key = ?", (*sets.values(), key))


def note_recent(conn: sqlite3.Connection, key: str, kind: str, item_id: str) -> None:
    """A source / app pick the TV reported back: the last 6 per screen (the UI shows 3)."""
    row = conn.execute("SELECT recent_json FROM media_devices WHERE device_key = ?", (key,)).fetchone()
    if row is None:
        return
    recent = [r for r in (_loads(row["recent_json"], []) or []) if isinstance(r, dict) and not (r.get("kind") == kind and r.get("id") == item_id)]
    recent.insert(0, {"kind": kind, "id": item_id})
    conn.execute("UPDATE media_devices SET recent_json = ? WHERE device_key = ?", (json.dumps(recent[:6], ensure_ascii=False), key))


# ------------------------------------------------------------------------------------------------ layout


def read_layout(conn: sqlite3.Connection) -> tuple[dict[str, Any], int]:
    row = conn.execute("SELECT layout_json, revision FROM media_layouts WHERE scope = 'installation'").fetchone()
    if row is None:
        return media_layout.default_layout(), 0
    try:
        return media_layout.normalise_layout(json.loads(row["layout_json"])), int(row["revision"])
    except ValueError:
        return media_layout.default_layout(), int(row["revision"])


def write_layout(conn: sqlite3.Connection, principal: Principal, layout: dict[str, Any], base_revision: int | None) -> int:
    """Optimistic write (`base_revision` = the revision the editor loaded; None = reset): returns the new revision, or raises 409
    `revision_conflict` when someone saved in between."""
    _cur, rev = read_layout(conn)
    if base_revision is not None and base_revision != rev:
        raise ApiError(409, "revision_conflict", "המסך נערך במקום אחר; טענו מחדש.", details={"revision": rev})
    new = rev + 1
    conn.execute(
        "INSERT INTO media_layouts(scope, layout_json, revision, updated_by, updated_at) VALUES ('installation', ?, ?, ?, ?) "
        "ON CONFLICT(scope) DO UPDATE SET layout_json = excluded.layout_json, revision = excluded.revision, updated_by = excluded.updated_by, updated_at = excluded.updated_at",
        (json.dumps(layout, ensure_ascii=False, separators=(",", ":")), new, principal.user_id, now_iso()))
    return new


# ------------------------------------------------------------------------------------------------ housekeeping


def janitor(db: Any) -> dict[str, int]:
    """Devices deleted for TOMBSTONE_DAYS lose their row (curation and endpoints), their keys leave the stored layout, and old
    command rows go. No Home Assistant call."""
    cutoff = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=TOMBSTONE_DAYS)).strftime("%Y-%m-%dT%H:%M:%SZ")
    old = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=3)).strftime("%Y-%m-%dT%H:%M:%SZ")
    with db.connection(durable=False) as conn:
        gone = {r[0] for r in conn.execute("SELECT device_key FROM media_devices WHERE removed_at IS NOT NULL AND removed_at < ?", (cutoff,)).fetchall()}
        for key in gone:
            conn.execute("DELETE FROM media_device_endpoints WHERE device_key = ?", (key,))
            conn.execute("DELETE FROM media_devices WHERE device_key = ?", (key,))
        if gone:
            layout, rev = read_layout(conn)
            pruned = media_layout.prune_keys(layout, gone)
            if pruned != layout:
                conn.execute("UPDATE media_layouts SET layout_json = ?, revision = ?, updated_at = ? WHERE scope = 'installation'", (json.dumps(pruned, ensure_ascii=False, separators=(",", ":")), rev + 1, now_iso()))
        commands = conn.execute("DELETE FROM media_commands WHERE created_at < ?", (old,)).rowcount
    return {"devices": len(gone), "commands": commands}
