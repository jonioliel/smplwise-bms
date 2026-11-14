"""Group operations of the players page (CR-016 5.3, 6.2, docs/architecture/MEDIA_PLAYERS_API.md 3.18 - 3.24).

Live groups (join / leave by ticking rooms), the group volume, the floor "עצור מוזיקה" and the saved groups ("סלון + מטבח", one tap) all run on the devices
area's bulk engine (services/device_bulk.py: signed bridge calls as the caller, at most 8 in flight, honest per-record confirmation) and are reported PER
DEVICE: `joined` / `not_joined` / `left` / `set` / `clamped` / `skipped_muted` / `skipped_off` / `skipped_unavailable` / `not_allowed` / `unknown` - never an
optimistic "done". This module only PLANS (it sends nothing): it resolves the devices, applies the rules below and returns the plan dict the bulk engine
records and runs; the routes are in routers/multimedia.py.

Rules kept here:
- One grouping LAYER per join: every device through the same one (Music Assistant, or the same vendor with GROUPING) - never a mix, never Cast (no
  GROUPING), never a mirror or a helper group; a device whose two layers disagree (`conflict`) cannot join until an administrator ungroups one.
- media.group AND media.control at EVERY involved device's anchor (a room outside the caller's scope is refused, the group volume skips it as
  `not_allowed` instead of failing). A group of four or more devices, or one that spans more than one floor, needs `confirmed: true` after a preview
  (409 confirm_required); a group that covers the whole building additionally needs media.bulk (403 bulk_required).
- No volume above a ceiling that an administrator set (the per-speaker `volume_max`, and inside the optional night window its `max`); NO default ceiling.
  Group volume `relative` keeps the balance (every member scaled by the same factor from its current level), `absolute` sets one level on all; a member
  that is muted, off or unavailable is skipped with its reason. Joining, leaving, a saved group without volumes and the transfer never change a volume.
- One join / leave / saved-group apply in flight per leader (409 group_pending, 8 s: the bulk engine's scope reservation)."""
from __future__ import annotations

import json
import sqlite3
import time
import uuid
from typing import Any

from ..db import now_iso
from ..errors import ApiError
from ..rbac import Principal
from . import device_bulk as bulk, media_commands as mc, media_model as mm, media_store as store

CAT_KINDS = tuple(mm.AUDIO_KINDS) + ("virtual_group",)  # what the group routes load: the audio devices and the helper groups (shortcuts)
JOINABLE_KINDS = ("speaker", "player", "receiver")
PARTY_DEVICES = 4  # a group of this many devices or more needs a confirmation
MAX_GROUP = 16
PRESET_NAME_MAX = 40
VOLUME_RATE = (2.0, 2.0)  # group volume: 2 per second per group (the client debounces; the last value wins)
RUNNING_RECENT_S = 30


class ConfirmRequired(ApiError):
    """409 `confirm_required`: the body carries the `preview` (at its top level, as MEDIA_PLAYERS_API.md 3.x says, and in `details` for the shared envelope)."""

    def __init__(self, preview: dict[str, Any]) -> None:
        super().__init__(409, "confirm_required", mc.MESSAGES["confirm_required"], details={"preview": preview})
        self.preview = preview

    def payload(self, correlation_id: str) -> dict[str, Any]:
        return {**super().payload(correlation_id), "preview": self.preview}


def load_catalog(conn: sqlite3.Connection) -> store.Catalog:
    return store.load_catalog(conn, approved_only=False, kind=CAT_KINDS)


def _visible(cat: store.Catalog, access: store.Access, key: Any) -> store.Item | None:
    it = cat.items.get(key) if isinstance(key, str) else None
    return it if it is not None and it.row["approved"] and it.row["kind"] != "screen" and access.has(store.PERM_READ, it.row.get("anchor_entity_id")) else None


def _anchor(item: store.Item) -> str | None:
    return item.row.get("anchor_entity_id")


def _require(access: store.Access, item: store.Item, *perms: str, reason: str) -> None:
    for perm in perms:
        if not access.has(perm, _anchor(item)):
            raise mc.err(403, "forbidden", permission=perm, reason=reason)


def installation_has_floors(conn: sqlite3.Connection) -> bool:
    return conn.execute("SELECT 1 FROM ha_floors LIMIT 1").fetchone() is not None


def _unit(item: store.Item, has_floors: bool) -> str | None:
    """The place a device counts in for the party rule: its floor - or its area on an installation that has no floors (floor scopes degrade to areas)."""
    fa = store.floor_area(item)
    return fa["floor_id"] if has_floors else fa["area_id"]


def groupable_reason(cat: store.Catalog, item: store.Item) -> str | None:
    """Why a device cannot take part in a group, or None: not a speaker / player / receiver, no grouping layer or live GROUPING, the two layers disagree,
    or its grouping endpoint is unavailable."""
    if item.row["kind"] not in JOINABLE_KINDS:
        return "kind"
    g = cat.group_info(item.key)
    if g["layer"] is None or not store.caps_of(cat, item)["group"]:
        return "no_grouping"
    if g["conflict"]:
        return "conflict"
    if not mm.available(cat.ents.get(item.view.prim.get("group") or "")):
        return "unavailable"
    return None


def candidates(cat: store.Catalog, access: store.Access, item: store.Item) -> list[store.Item]:
    """The devices a join from `item` may offer (CR-016 5.3): approved, of the same layer, available, with live GROUPING, not in another live group, within
    the caller's media.group and media.control scope."""
    mine = cat.group_info(item.key)
    out = []
    for other in cat.items.values():
        if other.key == item.key or not other.row["approved"] or groupable_reason(cat, other) is not None or not access.has(store.PERM_READ, _anchor(other)):
            continue
        g = cat.group_info(other.key)
        if g["layer"] != mine["layer"] or (g["role"] != "none" and g["leader_key"] != (mine["leader_key"] or item.key)):
            continue
        if access.has(store.PERM_GROUP, _anchor(other)) and access.has(store.PERM_CONTROL, _anchor(other)):
            out.append(other)
    return out


def preview_of(cat: store.Catalog, conn: sqlite3.Connection, devices: list[dict[str, Any]], keys: list[str]) -> dict[str, Any]:
    """`GroupPreview`: how many devices and floors the result spans, whether it needs a confirmation / media.bulk, and what each device will do."""
    has_floors = installation_has_floors(conn)
    items = [cat.items[k] for k in keys if k in cat.items]
    units = {u for u in (_unit(i, has_floors) for i in items) if u}
    floors = {f for f in (store.floor_area(i)["floor_id"] for i in items) if f} if has_floors else set()  # the party rule counts real floors: a house without floors has none
    every = {u for u in (_unit(i, has_floors) for i in cat.items.values() if i.row["approved"] and i.row["kind"] in JOINABLE_KINDS) if u}
    building = len(every) >= 2 and every <= units
    return {"devices": len(items), "floors": len(floors), "needs_confirmation": len(items) >= PARTY_DEVICES or len(floors) > 1, "needs_bulk": building, "members": devices}


def _row(item: store.Item, will: str, reason: str | None = None) -> dict[str, Any]:
    return {"key": item.key, "name": item.name, "area_name": store.floor_area(item)["area_name"], "will": will, "reason": reason}


def _more(count: int, will: str) -> list[dict[str, Any]]:
    """The one preview row that stands for rooms the caller may not read (CR-016 review L1): a count, never a name or a key."""
    return [{"key": "*", "name": "חדרים נוספים", "area_name": None, "will": will, "reason": None, "count": count}] if count else []


def _target(cat: store.Catalog, item: store.Item, entity: str, action_id: str, args: dict[str, Any]) -> dict[str, Any]:
    e = cat.ents.get(entity) or {}
    return {"entity_id": entity, "name": item.name, "domain": "media_player", "action_id": action_id, "state": e.get("state"), "area_id": e.get("area_id"),
            "area_name": e.get("area_name"), "args": args, "device_key": item.key}


def _plan(kind: str, scope: str, scope_id: str, name: str, targets: list[dict[str, Any]], members: list[dict[str, Any]], phases: list[list[dict[str, Any]]] | None = None, **extra: Any) -> dict[str, Any]:
    by_domain = {"media_player": len(targets)} if targets else {}
    return {
        "scope": scope, "id": scope_id, "name": name, "floor_name": None, "kind": kind, "kind_label": bulk.KIND_LABELS[kind], "count": len(targets), "targets": targets,
        "by_domain": by_domain, "domain_labels": {"media_player": bulk.DOMAIN_LABELS["media_player"]}, "skipped": {}, "excluded": [], "never_included": {},
        "digest": bulk.digest([t["entity_id"] for t in targets], kind), "narrowed": False, "server_time_ms": int(time.time() * 1000), "position": None, "note": "",
        "origin": "media", "members": members, "phases": phases, **extra,
    }


# ------------------------------------------------------------------------------------------------ join


def _not_a_player(conn: sqlite3.Connection, access: store.Access, key: Any) -> None:
    """A key that is no player of the catalogue: a screen the caller may read is `not_groupable` (422); anything else is unknown (404)."""
    row = conn.execute("SELECT kind, approved, anchor_entity_id FROM media_devices WHERE device_key = ? AND removed_at IS NULL", (key,)).fetchone() if isinstance(key, str) else None
    if row is not None and row["approved"] and row["kind"] == "screen" and access.has(store.PERM_READ, row["anchor_entity_id"]):
        raise mc.err(422, "not_groupable", key=key, reason="kind")
    raise mc.err(404, "not_found")


def _resolve_join(conn: sqlite3.Connection, cat: store.Catalog, access: store.Access, leader_key: Any, member_keys: Any) -> tuple[store.Item, list[store.Item], list[store.Item], list[store.Item]]:
    """(leader, new members to join, members already in the leader's group, the leader's other current members) - or the refusal."""
    leader = _visible(cat, access, leader_key)
    if leader is None:
        _not_a_player(conn, access, leader_key)
    if not isinstance(member_keys, list) or not 1 <= len(member_keys) <= MAX_GROUP - 1:
        raise mc.err(422, "validation", fields=["member_keys"])
    members: list[store.Item] = []
    for k in member_keys:
        m = _visible(cat, access, k)
        if m is None:
            _not_a_player(conn, access, k)
        if m.key != leader.key and m not in members:
            members.append(m)
    if not members:
        raise mc.err(422, "validation", fields=["member_keys"])
    for it in [leader, *members]:
        _require(access, it, store.PERM_GROUP, store.PERM_CONTROL, reason="member")
    lg = cat.group_info(leader.key)
    for it in [leader, *members]:
        reason = groupable_reason(cat, it)
        if reason is None and cat.group_info(it.key)["layer"] != lg["layer"]:
            reason = "layer"
        if reason is not None:
            raise mc.err(422, "not_groupable", key=it.key, reason=reason)
    if lg["role"] == "member":
        raise mc.err(422, "not_groupable", key=leader.key, reason="leader_is_member")
    joins, stays = [], []
    for m in members:
        g = cat.group_info(m.key)
        if g["role"] != "none":
            if g["leader_key"] == leader.key:
                stays.append(m)
                continue
            raise mc.err(422, "not_groupable", key=m.key, reason="in_other_group")
        joins.append(m)
    others = [cat.items[k] for k in lg["member_keys"] if k != leader.key and k in cat.items and cat.items[k] not in stays]
    return leader, joins, stays, others


def plan_join(conn: sqlite3.Connection, access: store.Access, cat: store.Catalog, leader_key: Any, member_keys: Any, confirmed: bool) -> dict[str, Any]:
    """`POST /multimedia/groups/join`: leader + members -> ONE `media_player.join` on the leader's grouping endpoint (through its layer), confirmed by reading
    the leader's `group_members` back for 8 s, an outcome per room. 409 confirm_required (with the preview) for a party; 403 bulk_required for the whole
    building without media.bulk; 409 nothing_to_do when everyone is already in."""
    leader, joins, stays, others = _resolve_join(conn, cat, access, leader_key, member_keys)
    final = [leader.key] + [m.key for m in stays] + [o.key for o in others] + [m.key for m in joins]
    seen = [o for o in others if _visible(cat, access, o.key) is not None]  # the leader's other rooms are named only to a caller who may read them
    devices = [_row(leader, "stay")] + [_row(m, "stay") for m in stays + seen] + [_row(m, "join") for m in joins] + _more(len(others) - len(seen), "stay")
    preview = preview_of(cat, conn, devices, final)
    if preview["needs_bulk"] and not all(access.has(store.PERM_BULK, _anchor(cat.items[k])) for k in final):
        raise mc.err(403, "bulk_required", permission=store.PERM_BULK)
    if preview["needs_confirmation"] and not confirmed:
        raise ConfirmRequired(preview)
    if not joins:
        raise ApiError(409, "nothing_to_do", "כולם כבר בקבוצה.", details={"preview": preview})
    target = _target(cat, leader, leader.view.prim["group"], "media_player.join", {"group_members": [m.view.prim["group"] for m in joins]})
    members = [{"device_key": leader.key, "role": "leader", "will": "stay", "leader_key": leader.key, "target": None}]
    members += [{"device_key": m.key, "role": "member", "will": "stay", "leader_key": leader.key, "target": None} for m in stays]
    members += [{"device_key": m.key, "role": "member", "will": "join", "leader_key": leader.key, "target": target} for m in joins]
    return _plan("group_join", "group", leader.key, leader.name, [target], members, preview=preview)


# ------------------------------------------------------------------------------------------------ leave


def plan_leave(conn: sqlite3.Connection, access: store.Access, cat: store.Catalog, device_keys: Any) -> dict[str, Any]:
    """`POST /multimedia/groups/leave`: one `media_player.unjoin` per device that is in a live group (through its own grouping endpoint); a device that is
    not grouped is `stay`. media.group and media.control at each device's anchor; 409 nothing_to_do when none is grouped."""
    if not isinstance(device_keys, list) or not 1 <= len(device_keys) <= MAX_GROUP:
        raise mc.err(422, "validation", fields=["device_keys"])
    items: list[store.Item] = []
    for k in device_keys:
        it = _visible(cat, access, k)
        if it is None:
            raise mc.err(404, "not_found")
        if it not in items:
            items.append(it)
    targets, members = [], []
    for it in items:
        _require(access, it, store.PERM_GROUP, store.PERM_CONTROL, reason="member")
        reason = groupable_reason(cat, it)
        if reason is not None and reason != "unavailable":
            raise mc.err(422, "not_groupable", key=it.key, reason=reason)
        g = cat.group_info(it.key)
        if g["role"] == "none":
            members.append({"device_key": it.key, "role": "target", "will": "stay", "reason": "not_grouped", "target": None})
            continue
        t = _target(cat, it, it.view.prim["group"], "media_player.unjoin", {})
        targets.append(t)
        members.append({"device_key": it.key, "role": "target", "will": "leave", "target": t})
    if not targets:
        raise ApiError(409, "nothing_to_do", "אף אחד מהם אינו בקבוצה.")
    return _plan("group_leave", "group", items[0].key, items[0].name, targets, members)


# ------------------------------------------------------------------------------------------------ volume


def group_members_of(cat: store.Catalog, leader: store.Item) -> list[str]:
    """The devices a group volume reaches: a live group's members (leader first), a static group's children, a helper group's shortcuts."""
    g = cat.group_info(leader.key)
    kind = leader.row["kind"]
    if kind == "virtual_group":
        return mm.virtual_members(leader.model, cat.ents, cat.by_entity)
    if kind == "group" or g["role"] == "leader":
        return list(g["member_keys"])
    raise mc.err(422, "not_groupable", key=leader.key, reason="not_a_leader")


def _volume_rows(conn: sqlite3.Connection, access: store.Access, cat: store.Catalog, keys: list[str], wanted: dict[str, int] | None, level: int | None, mode: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """(targets, member rows) of a volume write over `keys`. `wanted` (a saved group's per-member levels) or `level` + `mode`; a member the caller may not
    control is `not_allowed`, one that is muted / off / unavailable is skipped with its reason, every level is clamped to the member's ceilings WHEN one is
    set (reason `ceiling`: the outcome is `clamped`)."""
    members, targets, eligible = [], [], []
    shown: list[int] = []  # the levels the group's slider shows: every readable member that is powered (on / art) and reports a level - `list_groups`' `volume`
    if wanted is not None:
        keys = [k for k in keys if k in wanted]  # a saved group touches only the volumes it saved
    for k in keys:
        it = _visible(cat, access, k)
        if it is None:
            continue  # a device the caller cannot read is neither sent to nor described
        reason: str | None = None
        live, caps = store.live_of(cat, it, key_url=False), store.caps_of(cat, it)
        if live["power"] in ("on", "art") and live["volume"]["level"] is not None:
            shown.append(live["volume"]["level"])
        if not (access.has(store.PERM_CONTROL, _anchor(it)) and access.has(store.PERM_GROUP, _anchor(it))) or not caps["volume_set"] or not it.view.prim.get("volume"):
            reason = "not_allowed"
        elif not live["caps_known"] or live["power"] == "unavailable" or not mm.available(cat.ents.get(it.view.prim.get("volume") or "")):
            reason = "unavailable"
        elif live["power"] in ("off", "standby"):
            reason = "off"
        elif live["volume"]["muted"] is True:
            reason = "muted"
        if reason is not None:
            members.append({"device_key": it.key, "role": "target", "will": "skip", "reason": reason, "target": None})
        else:
            eligible.append((it, live["volume"]["level"]))
    if wanted is not None:
        asked = {it.key: wanted.get(it.key) for it, _l in eligible}
    else:
        # `relative` scales from the level the slider SHOWS (the loudest readable powered member, a muted or not-controllable one included - review M3): the
        # slider is the user's reference, so a muted leader at 80 and a member at 10 dragged 80 -> 50 gives the member 6, never 50
        now = max(shown, default=None)
        asked = {}
        for it, lv in eligible:
            if mode == "relative" and now and lv is not None:
                value = round(lv * level / now)  # the same factor for everyone: the balance is kept
                asked[it.key] = min(value, lv) if level <= now else value  # a drag DOWN never raises a member
            else:
                asked[it.key] = level
    for it, _lv in eligible:
        want = asked.get(it.key)
        if want is None:
            members.append({"device_key": it.key, "role": "target", "will": "skip", "reason": "not_allowed", "target": None})
            continue
        new = max(0, min(100, int(want)))
        ceiling = store.effective_ceiling(conn, it.row)
        clamped = ceiling is not None and new > ceiling
        if clamped:
            new = ceiling
        t = _target(cat, it, it.view.prim["volume"], "media_player.volume_set", {"volume_level": round(new / 100.0, 4)})
        targets.append(t)
        members.append({"device_key": it.key, "role": "target", "will": "set", "reason": "ceiling" if clamped else None, "level": new, "target": t})
    return targets, members


def plan_volume(conn: sqlite3.Connection, access: store.Access, cat: store.Catalog, leader_key: Any, level: Any, mode: Any) -> dict[str, Any]:
    """`POST /multimedia/groups/{leader_key}/volume`: a `media_player.volume_set` per member (a per-member fan-out; HA's own group volume on an MA entity is
    UNVERIFIED), `relative` by default. 422 validation for a bad level / mode, 422 not_groupable when the device leads no group."""
    if isinstance(level, bool) or not isinstance(level, (int, float)) or not 0 <= level <= 100 or mode not in ("relative", "absolute"):
        raise mc.err(422, "validation", fields=["level" if mode in ("relative", "absolute") else "mode"])
    leader = _visible(cat, access, leader_key)
    if leader is None:
        raise mc.err(404, "not_found")
    _require(access, leader, store.PERM_GROUP, reason="leader")
    targets, members = _volume_rows(conn, access, cat, group_members_of(cat, leader), None, int(round(level)), mode)
    if not targets:
        raise ApiError(409, "nothing_to_do", "אין חדר שאפשר לשנות בו עוצמה.", details={"members": [{"key": m["device_key"], "reason": m["reason"]} for m in members]})
    return _plan("group_volume", "group", leader.key, leader.name, targets, members)


# ------------------------------------------------------------------------------------------------ saved groups (presets)


def _preset_dict(conn: sqlite3.Connection, cat: store.Catalog, access: store.Access | None, r: sqlite3.Row) -> dict[str, Any]:
    keys = json.loads(r["members_json"] or "[]")
    volumes = json.loads(r["volumes_json"]) if r["volumes_json"] else None
    missing = [k for k in [r["leader_key"], *keys] if not (cat.items.get(k) is not None and cat.items[k].row["approved"])]
    shown = [k for k in keys if access is None or _visible(cat, access, k) is not None]
    run = conn.execute("SELECT id, requested_at, status, done_at FROM device_bulk_actions WHERE scope = 'preset' AND scope_id = ? ORDER BY requested_at DESC LIMIT 1", (r["preset_id"],)).fetchone()
    running = None
    if run is not None:
        import datetime as dt

        recent = run["status"] != "done" or (run["done_at"] and (dt.datetime.now(dt.timezone.utc) - dt.datetime.fromisoformat(run["done_at"].replace("Z", "+00:00"))).total_seconds() < RUNNING_RECENT_S)
        running = {"bulk_id": run["id"], "started_at": run["requested_at"]} if recent else None
    return {"id": r["preset_id"], "name": r["name"], "leader_key": r["leader_key"], "member_keys": shown, "volumes": ({k: v for k, v in volumes.items() if access is None or k in shown or k == r["leader_key"]} if volumes else None),
            "revision": r["revision"], "missing": missing, "running": running}


def list_presets(conn: sqlite3.Connection, cat: store.Catalog, access: store.Access) -> list[dict[str, Any]]:
    out = []
    for r in conn.execute("SELECT * FROM media_group_presets ORDER BY name, preset_id").fetchall():
        if _visible(cat, access, r["leader_key"]) is None and not any(_visible(cat, access, k) is not None for k in json.loads(r["members_json"] or "[]")):
            continue  # a saved group of rooms the caller cannot see is not listed
        out.append(_preset_dict(conn, cat, access, r))
    return out


def _clean_preset(cat: store.Catalog, body: dict[str, Any]) -> tuple[str, str, list[str], dict[str, int] | None]:
    name = body.get("name")
    if not isinstance(name, str) or not 1 <= len(name.strip()) <= PRESET_NAME_MAX or any(ord(c) < 32 or ord(c) == 127 for c in name):
        raise mc.err(422, "validation", fields=["name"])
    leader_key, member_keys = body.get("leader_key"), body.get("member_keys")
    if not isinstance(member_keys, list) or not 1 <= len(member_keys) <= MAX_GROUP - 1 or len(set(member_keys)) != len(member_keys) or leader_key in member_keys:
        raise mc.err(422, "validation", fields=["member_keys"])
    for k in [leader_key, *member_keys]:
        it = cat.items.get(k) if isinstance(k, str) else None
        if it is None or not it.row["approved"]:
            raise mc.err(404, "not_found")
        if it.row["kind"] not in JOINABLE_KINDS:
            raise mc.err(422, "not_groupable", key=k, reason="kind")  # a saved group names speakers, players and receivers; whether each can join NOW is decided when it is applied
    volumes = body.get("volumes")
    if volumes is not None:
        ok = isinstance(volumes, dict) and set(volumes) <= {leader_key, *member_keys} and all(isinstance(v, int) and not isinstance(v, bool) and 0 <= v <= 100 for v in volumes.values())
        if not ok:
            raise mc.err(422, "validation", fields=["volumes"])
    return name.strip(), leader_key, list(member_keys), (dict(volumes) if volumes else None)


def create_preset(conn: sqlite3.Connection, principal: Principal, cat: store.Catalog, body: dict[str, Any]) -> sqlite3.Row:
    name, leader_key, member_keys, volumes = _clean_preset(cat, body)
    pid = uuid.uuid4().hex
    now = now_iso()
    conn.execute("INSERT INTO media_group_presets(preset_id, name, leader_key, members_json, volumes_json, revision, created_by, updated_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
                 (pid, name, leader_key, json.dumps(member_keys), json.dumps(volumes) if volumes else None, 1, principal.user_id, principal.user_id, now, now))
    return conn.execute("SELECT * FROM media_group_presets WHERE preset_id = ?", (pid,)).fetchone()


def update_preset(conn: sqlite3.Connection, principal: Principal, cat: store.Catalog, preset_id: str, body: dict[str, Any], base_revision: int) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM media_group_presets WHERE preset_id = ?", (preset_id,)).fetchone()
    if row is None:
        raise mc.err(404, "not_found")
    if row["revision"] != base_revision:
        raise ApiError(409, "revision_conflict", "הקבוצה נערכה במקום אחר; טענו מחדש.", details={"revision": row["revision"]})
    name, leader_key, member_keys, volumes = _clean_preset(cat, body)
    conn.execute("UPDATE media_group_presets SET name = ?, leader_key = ?, members_json = ?, volumes_json = ?, revision = revision + 1, updated_by = ?, updated_at = ? WHERE preset_id = ?",
                 (name, leader_key, json.dumps(member_keys), json.dumps(volumes) if volumes else None, principal.user_id, now_iso(), preset_id))
    return conn.execute("SELECT * FROM media_group_presets WHERE preset_id = ?", (preset_id,)).fetchone()


def delete_preset(conn: sqlite3.Connection, preset_id: str, base_revision: int | None = None) -> None:
    row = conn.execute("SELECT revision FROM media_group_presets WHERE preset_id = ?", (preset_id,)).fetchone()
    if row is None:
        raise mc.err(404, "not_found")
    if base_revision is not None and row["revision"] != base_revision:
        raise ApiError(409, "revision_conflict", "הקבוצה נערכה במקום אחר; טענו מחדש.", details={"revision": row["revision"]})
    conn.execute("DELETE FROM media_group_presets WHERE preset_id = ?", (preset_id,))


def plan_preset(conn: sqlite3.Connection, access: store.Access, cat: store.Catalog, row: sqlite3.Row, confirmed: bool) -> dict[str, Any]:
    """`POST /multimedia/groups/presets/{id}/apply`: the saved group as a DIFF against the leader's live group - unjoin the extras, join the missing, then the
    saved volumes (clamped to each member's ceilings) - three ordered phases on the bulk engine, an outcome per room. The same permission, party and layer
    rules as a join, but a room that CANNOT join (it is offline, its two layers disagree, it follows another group, it is no longer approved) is not a
    refusal of the whole group: it is a `skip` row that names it (its outcome is `not_joined`) while the others are done. The LEADER must be able to take
    the group (422 not_groupable otherwise)."""
    keys = json.loads(row["members_json"] or "[]")
    leader = _visible(cat, access, row["leader_key"])
    if leader is None:
        _not_a_player(conn, access, row["leader_key"])
    _require(access, leader, store.PERM_GROUP, store.PERM_CONTROL, reason="member")
    reason = groupable_reason(cat, leader)
    if reason is not None:
        raise mc.err(422, "not_groupable", key=leader.key, reason=reason)
    lg = cat.group_info(leader.key)
    if lg["role"] == "member":
        raise mc.err(422, "not_groupable", key=leader.key, reason="leader_is_member")
    joins, stays, skips = [], [], []  # skips: (key, name, reason)
    unseen_skips = 0  # rooms the caller may not read: counted, never named (review L1)
    for k in keys:
        it = _visible(cat, access, k)
        if it is None:
            gone = cat.items.get(k)
            if gone is None or not gone.row["approved"]:
                if gone is not None and access.has(store.PERM_READ, _anchor(gone)):
                    skips.append((k, gone.name, "not_approved"))
                else:
                    unseen_skips += 1
            continue  # a room the caller may not read is neither sent to nor described
        _require(access, it, store.PERM_GROUP, store.PERM_CONTROL, reason="member")
        why = groupable_reason(cat, it)
        g = cat.group_info(it.key)
        if why is None and g["layer"] != lg["layer"]:
            why = "layer"
        if why is None and g["role"] != "none" and g["leader_key"] != leader.key:
            why = "in_other_group"
        if why is not None:
            skips.append((it.key, it.name, why))
        elif g["role"] != "none":
            stays.append(it)
        else:
            joins.append(it)
    wanted = {m.key for m in joins + stays} | {k for k, _n, _r in skips}
    extras = [cat.items[k] for k in lg["member_keys"] if k != leader.key and k in cat.items and k not in wanted]
    for it in extras:
        _require(access, it, store.PERM_GROUP, store.PERM_CONTROL, reason="member")
    final = [leader.key] + [m.key for m in stays + joins]
    extras_seen = [o for o in extras if _visible(cat, access, o.key) is not None]
    devices = [_row(leader, "stay")] + [_row(m, "stay") for m in stays] + [_row(m, "join") for m in joins] + [_row(o, "leave") for o in extras_seen] \
        + [{"key": k, "name": n, "area_name": None, "will": "skip", "reason": r} for k, n, r in skips] + _more(len(extras) - len(extras_seen), "leave") + _more(unseen_skips, "skip")
    preview = preview_of(cat, conn, devices, final)
    if preview["needs_bulk"] and not all(access.has(store.PERM_BULK, _anchor(cat.items[k])) for k in final):
        raise mc.err(403, "bulk_required", permission=store.PERM_BULK)
    if preview["needs_confirmation"] and not confirmed:
        raise ConfirmRequired(preview)
    leaves = [_target(cat, o, o.view.prim["group"], "media_player.unjoin", {}) for o in extras]
    join_t = _target(cat, leader, leader.view.prim["group"], "media_player.join", {"group_members": [m.view.prim["group"] for m in joins]}) if joins else None
    volumes = json.loads(row["volumes_json"]) if row["volumes_json"] else None
    vol_targets, vol_members = _volume_rows(conn, access, cat, [leader.key] + [m.key for m in stays + joins], volumes, None, "absolute") if volumes else ([], [])
    members = [{"device_key": leader.key, "role": "leader", "will": "stay", "leader_key": leader.key, "target": None}]
    members += [{"device_key": m.key, "role": "member", "will": "stay", "leader_key": leader.key, "target": None} for m in stays]
    members += [{"device_key": m.key, "role": "member", "will": "join", "leader_key": leader.key, "target": join_t} for m in joins]
    members += [{"device_key": o.key, "role": "member", "will": "leave", "target": t} for o, t in zip(extras, leaves)]
    members += [{"device_key": k, "role": "target", "will": "skip", "reason": r, "target": None} for k, _n, r in skips if k in cat.items]
    # a room is ONE row: its membership, and - when the saved group names a level for it - the volume record and the level asked
    by_device = {m["device_key"]: m for m in members}
    for vm in vol_members:
        row_ = by_device.get(vm["device_key"])
        if row_ is None:
            members.append(vm)
        elif vm["will"] == "set":
            row_["volume_target"], row_["level"], row_["volume_reason"] = vm["target"], vm["level"], vm.get("reason")
        else:
            row_["volume_skip"] = vm.get("reason")
    targets = leaves + ([join_t] if join_t else []) + vol_targets
    if not targets:
        raise ApiError(409, "nothing_to_do", "הקבוצה כבר פועלת כפי ששמרתם.", details={"preview": preview})
    phases = [p for p in (leaves, [join_t] if join_t else [], vol_targets) if p]
    return _plan("group_join", "preset", row["preset_id"], row["name"], targets, members, phases, preview=preview)


# ------------------------------------------------------------------------------------------------ the groups list


def list_groups(cat: store.Catalog, access: store.Access) -> list[dict[str, Any]]:
    """`GET /multimedia/groups` (MediaGroup[]): the live groups (one per leader), the static groups (a device of kind `group`) and the helper groups
    (a shortcut: `virtual: true`) with at least one member the caller may read; the members are the readable ones."""
    out: list[dict[str, Any]] = []
    seen: set[str] = set()

    def entry(leader: store.Item, keys: list[str], *, static: bool, shortcut: bool = False) -> None:
        shown = [m for m in (_visible(cat, access, k) for k in keys) if m is not None]
        if not shown:
            return
        rows, levels = [], []
        for m in shown:
            live = store.live_of(cat, m, key_url=False)
            rows.append({"key": m.key, "name": m.name, "area_name": store.floor_area(m)["area_name"], "volume": live["volume"]["level"], "muted": live["volume"]["muted"],
                         "available": live["caps_known"] and live["power"] != "unavailable"})
            if live["power"] in ("on", "art") and live["volume"]["level"] is not None:
                levels.append(live["volume"]["level"])
        floors = sorted({f for f in (store.floor_area(m)["floor_id"] for m in shown) if f})
        can_group = bool(shown) and all(access.has(store.PERM_GROUP, _anchor(m)) and access.has(store.PERM_CONTROL, _anchor(m)) for m in shown)
        # a helper group is a shortcut (play / pause / volume fan-out): listed as a static group that can never be joined or split
        out.append({"leader_key": leader.key, "name": leader.name, "static": static or shortcut, "floor_ids": floors, "members": rows, "volume": max(levels) if levels else None,
                    "can": {"group": can_group and not (static or shortcut), "volume": can_group}})

    for key, item in sorted(cat.items.items(), key=lambda kv: (kv[1].name, kv[0])):
        if not item.row["approved"]:
            continue
        g = cat.group_info(key)
        if item.row["kind"] == "group":
            entry(item, g["member_keys"], static=True)
        elif item.row["kind"] == "virtual_group":
            entry(item, mm.virtual_members(item.model, cat.ents, cat.by_entity), static=False, shortcut=True)
        elif g["role"] == "leader" and key not in seen:
            seen.add(key)
            entry(item, g["member_keys"], static=False)
    return out


# ------------------------------------------------------------------------------------------------ the outcome of a group operation (read back)


_MEMBER_OUTCOME_COUNT = {"joined": "confirmed", "left": "confirmed", "set": "confirmed", "clamped": "confirmed", "not_joined": "not_confirmed", "unknown": "unknown",
                         "not_allowed": "refused", "skipped_muted": "refused", "skipped_off": "refused", "skipped_unavailable": "refused", "skipped_ceiling": "refused"}
_FINISHED = frozenset({"confirmed", "failed", "denied", "unknown"})
_JOIN_SKIPS = frozenset({"conflict", "no_grouping", "kind", "layer", "in_other_group", "leader_is_member"})  # why a saved group's room could not join


def member_outcomes(conn: sqlite3.Connection, bulk_id: str, kind: str) -> tuple[list[dict[str, Any]], dict[str, int]]:
    """The per-DEVICE report of a group operation (what `GET /devices/actions/{bulk_id}` returns for these kinds): every device the operation named,
    `{device_key, name, area_name, will, outcome, level?, volume_outcome?}` and no entity id. The membership is READ BACK from the live state (the leader's
    `group_members` and the members' `active_queue`, `services/media_model.resolve_groups`), so a join one room refused is `not_joined` - named by the room -
    even though HA accepted the call; while its record is unconfirmed a room is `unknown` (the bulk's `done` says when the report is final). A saved group's
    volume has its own record: `volume_outcome` is `set` / `clamped` / `unknown`."""
    rows = conn.execute("SELECT * FROM device_bulk_members WHERE bulk_id = ? ORDER BY rowid", (bulk_id,)).fetchall()
    actions = {r["id"]: r for r in conn.execute("SELECT id, status, error FROM ha_actions WHERE bulk_id = ?", (bulk_id,)).fetchall()}
    cat = load_catalog(conn)
    groups = cat.groups()

    def record_outcome(action_id: str | None, reason: str | None) -> str:
        a = actions.get(action_id) if action_id else None
        if a is None or a["status"] not in _FINISHED:
            return "unknown"
        if a["status"] == "confirmed":
            return "clamped" if reason == "ceiling" else "set"
        return "not_allowed" if a["status"] == "denied" else "unknown"

    items: list[dict[str, Any]] = []
    for m in rows:
        a = actions.get(m["action_id"]) if m["action_id"] else None
        finished = a is not None and a["status"] in _FINISHED
        it = cat.items.get(m["device_key"])
        g = groups.get(m["device_key"]) or mm.NO_GROUP
        will, reason = m["will"], m["reason"]
        volume_outcome = None
        if will == "skip":
            # a room that could not join (offline, in conflict, in another group ...) did not join - named; a muted / off / unavailable room was skipped for it
            outcome = {"muted": "skipped_muted", "off": "skipped_off", "unavailable": "skipped_unavailable"}.get(reason or "", "not_joined" if reason in _JOIN_SKIPS else "not_allowed")
        elif will in ("join", "stay") and m["role"] in ("leader", "member"):
            in_group = g["role"] != "none" and g["leader_key"] == m["leader_key"]
            outcome = "joined" if in_group else ("not_joined" if (finished or will == "stay") else "unknown")
            if m["volume_action_id"]:
                volume_outcome = record_outcome(m["volume_action_id"], reason)
        elif will == "leave":
            outcome = "left" if g["role"] == "none" else "unknown"
        elif will in ("set", "pause"):
            outcome = record_outcome(m["action_id"], reason)
        else:
            outcome = "unknown"
        item = {"device_key": m["device_key"], "name": it.name if it else "", "area_name": store.floor_area(it)["area_name"] if it else None, "will": will, "outcome": outcome,
                "error": a["error"] if a is not None and a["status"] in ("failed", "denied") else None}
        if m["level"] is not None:
            item["level"] = m["level"]
        if volume_outcome is not None:
            item["volume_outcome"] = volume_outcome
        items.append(item)
    counts = {k: 0 for k in bulk.OUTCOMES}
    for it_ in items:
        counts[_MEMBER_OUTCOME_COUNT.get(it_["outcome"], "unknown")] += 1
    counts["total"] = len(items)
    return items, counts
