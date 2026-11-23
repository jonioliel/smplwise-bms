"""MULTI-BUILDING-SAFETY-2500 (owner decision 22.11, Q62 = the recommendation): moving a floor to another building of the same site.

Allowed only to someone who manages the content of BOTH buildings (site.content.configure on the source building AND on the target
building - the route checks both, each refusal audited), and only after an impact preview that names who loses access. The preview is
worked out without writing: for every person whose reach can change - anyone bound (directly or through a group) on the source or the
target building - what they hold on the floor now (the floor's chain: floor -> source building -> site -> installation) and what they
would hold after the move (floor -> target building -> site -> installation), with the one RBAC rule (rbac.effective_on_chain:
deny-overrides, dead places grant nothing). A floor binding, a site binding and an installation binding are in both chains, so they move
with the floor or do not change at all.

The move itself is one transaction: `floors.building_id`, the records that carry the floor with a copy of its building (tickets, requests
for quotes, maintenance tasks, notices, incidents - their `building_id` follows the floor so building-scoped lists stay true), the audit
row `floor.move`, and an access signal to every user (open sockets re-scope at once). Plans, anchors, cameras, the floor's home-system
links and its floor bindings point at the floor id and move unchanged. Nothing is deleted; undo = move it back.

Blocking (no move): a room shared between this floor and a floor that would end up in another building (shared rooms stay inside one
building - services/shared_spaces). Warnings: a target floor on the same level (allowed: two floors may share a level). Stale preview:
the move re-computes the preview and refuses with 409 `preview_stale` when its digest differs from the one the person confirmed.
"""
from __future__ import annotations

import hashlib
import json
import sqlite3
from typing import Any

from ..rbac import INSTALLATION, Principal, effective_on_chain

# the records that copy the floor's building next to the floor id (migrations 0079, 0089, 0155, 0165, 0168)
FLOOR_RECORDS: tuple[str, ...] = ("tickets", "ticket_rfqs", "maint_tasks", "notices", "incidents")
PEOPLE_MAX = 200  # the preview lists at most this many people (the counts are always complete)


def _rows(conn: sqlite3.Connection, sql: str, args: tuple[Any, ...] = ()) -> list[sqlite3.Row]:
    try:
        return conn.execute(sql, args).fetchall()
    except sqlite3.OperationalError:  # a table from a later migration (tests keep older schemas on purpose)
        return []


def live_building(conn: sqlite3.Connection, building_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT id, site_id, name FROM buildings WHERE id = ? AND deleted_at IS NULL", (building_id,)).fetchone()


def _chain(floor_id: str, building_id: str, site_id: str) -> set[tuple[str, str]]:
    return {("floor", floor_id), ("building", building_id), ("site", site_id), INSTALLATION}


def _candidates(conn: sqlite3.Connection, buildings: tuple[str, ...]) -> list[sqlite3.Row]:
    """The users whose reach on the floor can change: bound (allow or deny, directly or through a group) on one of `buildings`. Disabled
    users hold nothing anywhere (rbac: user_inactive) and are left out."""
    marks = ",".join("?" * len(buildings))
    return conn.execute(
        f"""SELECT DISTINCT u.id, u.username, u.display_name, u.source FROM users u
            WHERE u.active = 1 AND u.id IN (
              SELECT b.subject_id FROM bindings b WHERE b.subject_kind = 'user' AND b.scope_type = 'building' AND b.scope_id IN ({marks})
                AND b.revoked_at IS NULL
              UNION
              SELECT m.user_id FROM bindings b JOIN group_members m ON m.group_id = b.subject_id
               WHERE b.subject_kind = 'group' AND b.scope_type = 'building' AND b.scope_id IN ({marks}) AND b.revoked_at IS NULL)
            ORDER BY u.display_name, u.username, u.id""",
        (*buildings, *buildings),
    ).fetchall()


def people(conn: sqlite3.Connection, floor_id: str, site_id: str, source_id: str, target_id: str) -> list[dict[str, Any]]:
    """Every person whose permissions on the floor change with the move: `change` = loses (holds something now, nothing after), gains
    (nothing now, something after) or changes (some of both / fewer / more), with the permissions lost and gained."""
    from .active_users import is_disabled

    before_chain = _chain(floor_id, source_id, site_id)
    after_chain = _chain(floor_id, target_id, site_id)
    out: list[dict[str, Any]] = []
    for u in _candidates(conn, (source_id, target_id)):
        if is_disabled(conn, u["id"]):
            continue
        p = Principal(u["id"], u["username"] or "", u["display_name"] or "", u["source"] or "ingress", factor_ok=True)
        before = set(effective_on_chain(conn, p, before_chain))
        after = set(effective_on_chain(conn, p, after_chain))
        if before == after:
            continue
        change = "loses" if before and not after else "gains" if after and not before else "changes"
        out.append({"user_id": u["id"], "name": u["display_name"] or u["username"] or u["id"], "change": change,
                    "lost": sorted(before - after), "gained": sorted(after - before)})
    order = {"loses": 0, "changes": 1, "gains": 2}
    out.sort(key=lambda r: (order[r["change"]], r["name"], r["user_id"]))
    return out


def _shared_rooms(conn: sqlite3.Connection, floor_id: str, target_id: str) -> list[dict[str, Any]]:
    """Rooms shared between this floor and a floor that would sit in another building after the move (refused: a shared room stays
    inside one building)."""
    from . import shared_spaces

    if not shared_spaces.any_active(conn):
        return []
    building_of = {r[0]: r[1] for r in conn.execute("SELECT id, building_id FROM floors WHERE deleted_at IS NULL").fetchall()}
    out: list[dict[str, Any]] = []
    for s in shared_spaces.all_shares(conn):
        if floor_id not in (s.home_floor_id, s.floor_id):
            continue
        other = s.floor_id if s.home_floor_id == floor_id else s.home_floor_id
        if other != floor_id and building_of.get(other) != target_id:
            out.append({"id": s.zone_id, "name": s.zone_name})
    return out


def _level_clash(conn: sqlite3.Connection, floor: sqlite3.Row, target_id: str) -> list[dict[str, Any]]:
    return [{"id": r[0], "name": r[1]} for r in conn.execute(
        "SELECT id, name FROM floors WHERE building_id = ? AND deleted_at IS NULL AND level = ? AND id != ? ORDER BY sort_order, name",
        (target_id, floor["level"], floor["id"])).fetchall()]


def _records(conn: sqlite3.Connection, floor_id: str) -> dict[str, int]:
    out: dict[str, int] = {}
    for t in FLOOR_RECORDS:
        rows = _rows(conn, f"SELECT COUNT(*) FROM {t} WHERE floor_id = ?", (floor_id,))  # noqa: S608 - t is one of FLOOR_RECORDS
        out[t] = int(rows[0][0]) if rows else 0
    return out


def _mapped_areas(conn: sqlite3.Connection, floor_id: str) -> int:
    """The home-system areas the mapping puts on this floor: they follow it to the target building (their devices with them)."""
    from . import building_scope

    return sum(1 for _b, f in building_scope.area_targets(conn).values() if f == floor_id)


def preview(conn: sqlite3.Connection, floor: sqlite3.Row, target: sqlite3.Row) -> dict[str, Any]:
    """The impact of moving `floor` (a live floor row) to `target` (a live building row of the same site), worked out without writing."""
    source = conn.execute("SELECT id, site_id, name FROM buildings WHERE id = ?", (floor["building_id"],)).fetchone()
    who = people(conn, floor["id"], source["site_id"], source["id"], target["id"])
    counts = {k: sum(1 for p in who if p["change"] == k) for k in ("loses", "gains", "changes")}
    from . import catalog_store

    floor_bindings = conn.execute(
        "SELECT COUNT(*) FROM bindings WHERE scope_type = 'floor' AND scope_id = ? AND revoked_at IS NULL", (floor["id"],)).fetchone()[0]
    plans = conn.execute("SELECT COUNT(*) FROM plan_versions WHERE floor_id = ?", (floor["id"],)).fetchone()[0]
    moves_with = {
        "floor_bindings": int(floor_bindings),
        "cameras": catalog_store.floor_camera_count(conn, floor["id"]),
        "anchors": catalog_store.floor_anchor_count(conn, floor["id"]),
        "plans": int(plans),
        "areas": _mapped_areas(conn, floor["id"]),
        "records": _records(conn, floor["id"]),
    }
    blockers: list[dict[str, Any]] = []
    rooms = _shared_rooms(conn, floor["id"], target["id"])
    if rooms:
        blockers.append({"code": "shared_room", "items": rooms})
    warnings: list[dict[str, Any]] = []
    clash = _level_clash(conn, floor, target["id"])
    if clash:
        warnings.append({"code": "level_clash", "items": clash})
    if counts["loses"]:
        warnings.append({"code": "people_lose_access", "items": [{"id": p["user_id"], "name": p["name"]} for p in who if p["change"] == "loses"][:20]})
    core = {
        "floor": floor["id"], "from": source["id"], "to": target["id"],
        "people": [(p["user_id"], p["change"], p["lost"], p["gained"]) for p in who],
        "blockers": [(b["code"], [i["id"] for i in b["items"]]) for b in blockers],
        "moves_with": moves_with,
    }
    digest = hashlib.sha256(json.dumps(core, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()[:32]
    return {
        "floor": {"id": floor["id"], "name": floor["name"], "level": floor["level"]},
        "from_building": {"id": source["id"], "name": source["name"]},
        "to_building": {"id": target["id"], "name": target["name"]},
        "people": {**counts, "total": len(who), "items": who[:PEOPLE_MAX]},
        "moves_with": moves_with,
        "blockers": blockers,
        "warnings": warnings,
        "can_move": not blockers,
        "digest": digest,
    }


def apply(conn: sqlite3.Connection, floor_id: str, target_id: str, at: str) -> dict[str, int]:
    """The move: the floor's building, and the building copied next to the floor in its records. Returns the records updated per table."""
    conn.execute("UPDATE floors SET building_id = ?, updated_at = ? WHERE id = ?", (target_id, at, floor_id))
    out: dict[str, int] = {}
    for t in FLOOR_RECORDS:
        try:
            cur = conn.execute(f"UPDATE {t} SET building_id = ? WHERE floor_id = ? AND (building_id IS NULL OR building_id != ?)",  # noqa: S608
                               (target_id, floor_id, target_id))
            out[t] = cur.rowcount
        except sqlite3.OperationalError:
            out[t] = 0
    return out

