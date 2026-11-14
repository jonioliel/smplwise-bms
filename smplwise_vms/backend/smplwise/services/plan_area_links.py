"""Room ↔ area links (K88, owner decision 2026-10-04 Q1 = ג): a plan room (`spatial_zones`) may point at one area of the
device tree (`ha_areas`). The link is local to this product - nothing is written to the platform's registry (spec §12:
a separate, confirmed option). Two ways to set it: the editor's room panel (one room) and the settings table, which
proposes matches by name and applies the ticked ones in one call.

Matching is by normalised name: exact match first, then one name contained in the other, then a token overlap of at
least half the tokens. A room that already has a link gets no suggestion; an area already linked to a room on the same
floor is not proposed again for that floor (one room per area per floor is the normal case; several floors may share one
area, e.g. a stairwell, and that is allowed)."""
from __future__ import annotations

import re
import sqlite3
import unicodedata
from typing import Any

from ..errors import validation

_STRIP = re.compile(r"[֑-ׇ]")  # Hebrew points (niqqud) never decide a match
_NONWORD = re.compile(r"[^\w\s]", re.UNICODE)
_PREFIXES = ("חדר ", "אזור ", "the ", "room ")


def normalise(name: str) -> str:
    s = unicodedata.normalize("NFKC", name or "").strip().lower()
    s = _STRIP.sub("", s)
    s = _NONWORD.sub(" ", s)
    s = re.sub(r"\s+", " ", s).strip()
    for p in _PREFIXES:
        if s.startswith(p) and len(s) > len(p) + 1:
            s = s[len(p):]
    return s


def score(zone_name: str, area_name: str) -> float:
    """1.0 exact, 0.8 one contains the other, 0.5-0.79 by token overlap, 0 no match."""
    a, b = normalise(zone_name), normalise(area_name)
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    if a in b or b in a:
        return 0.8
    ta, tb = set(a.split()), set(b.split())
    common = ta & tb
    if not common:
        return 0.0
    ratio = len(common) / max(len(ta), len(tb))
    return round(0.5 + 0.29 * ratio, 2) if ratio >= 0.5 else 0.0


def areas(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    """Every area of the device tree with its floor name (the platform's floor, not a plan floor)."""
    rows = conn.execute(
        "SELECT a.area_id, a.name, a.floor_id, f.name AS floor_name FROM ha_areas a LEFT JOIN ha_floors f ON f.floor_id = a.floor_id ORDER BY f.position, f.name, a.position, a.name"
    ).fetchall()
    return [{"area_id": r["area_id"], "name": r["name"], "floor_id": r["floor_id"], "floor_name": r["floor_name"]} for r in rows]


def check_area(conn: sqlite3.Connection, area_id: str | None) -> str | None:
    """"" or None → None (unlink); otherwise the id must name a known area (422)."""
    if not area_id:
        return None
    r = conn.execute("SELECT area_id FROM ha_areas WHERE area_id = ?", (area_id,)).fetchone()
    if not r:
        raise validation("האזור לא נמצא ברשימת האזורים.", area_id=area_id)
    return r["area_id"]


def zone_rows(conn: sqlite3.Connection, floor_ids: list[str] | None = None) -> list[sqlite3.Row]:
    sql = (
        "SELECT z.id, z.name, z.kind, z.floor_id, z.ha_area_id, z.revision, f.name AS floor_name, f.level AS floor_level, b.name AS building_name "
        "FROM spatial_zones z JOIN floors f ON f.id = z.floor_id JOIN buildings b ON b.id = f.building_id "
        "WHERE z.deleted_at IS NULL AND f.deleted_at IS NULL"
    )
    args: list[Any] = []
    if floor_ids is not None:
        if not floor_ids:
            return []
        sql += f" AND z.floor_id IN ({','.join('?' * len(floor_ids))})"
        args.extend(floor_ids)
    sql += " ORDER BY f.level DESC, f.name, z.name, z.created_at"
    return conn.execute(sql, args).fetchall()


def table(conn: sqlite3.Connection, floor_ids: list[str] | None = None) -> dict[str, Any]:
    """The settings table: every room (of the given floors, or all) with its current link and the best suggestion."""
    all_areas = areas(conn)
    by_id = {a["area_id"]: a for a in all_areas}
    zones = zone_rows(conn, floor_ids)
    taken: dict[tuple[str, str], str] = {}  # (floor_id, area_id) → zone_id already linked
    for z in zones:
        if z["ha_area_id"] and z["ha_area_id"] in by_id:
            taken[(z["floor_id"], z["ha_area_id"])] = z["id"]
    rows: list[dict[str, Any]] = []
    counts = {"linked": 0, "suggested": 0, "none": 0, "dangling": 0}
    for z in zones:
        linked = by_id.get(z["ha_area_id"]) if z["ha_area_id"] else None
        row: dict[str, Any] = {
            "zone_id": z["id"], "zone_name": z["name"], "kind": z["kind"], "revision": z["revision"],
            "floor_id": z["floor_id"], "floor_name": z["floor_name"], "floor_level": z["floor_level"], "building_name": z["building_name"],
            "area_id": linked["area_id"] if linked else None, "area_name": linked["name"] if linked else None,
            "dangling": bool(z["ha_area_id"]) and linked is None,
            "suggestion": None, "status": "none",
        }
        rows.append(row)
        if linked:
            row["status"] = "linked"
            counts["linked"] += 1
        else:
            if row["dangling"]:
                counts["dangling"] += 1
            best: tuple[float, dict[str, Any]] | None = None
            for a in all_areas:
                if (z["floor_id"], a["area_id"]) in taken:
                    continue
                sc = score(z["name"], a["name"])
                if sc and (best is None or sc > best[0] or (sc == best[0] and a["name"] < best[1]["name"])):
                    best = (sc, a)
            if best:
                row["suggestion"] = {"area_id": best[1]["area_id"], "area_name": best[1]["name"], "score": best[0]}
                row["status"] = "suggested"
                counts["suggested"] += 1
            else:
                counts["none"] += 1
    return {"rows": rows, "areas": all_areas, "counts": counts}


def area_to_zone(conn: sqlite3.Connection) -> dict[str, dict[str, str]]:
    """area_id → {floor_id, zone_id} of the first (oldest) room linked to it. Used by the device tree for "show on the map"."""
    out: dict[str, dict[str, str]] = {}
    for r in conn.execute(
        "SELECT z.ha_area_id AS area_id, z.floor_id, z.id FROM spatial_zones z JOIN floors f ON f.id = z.floor_id "
        "WHERE z.ha_area_id IS NOT NULL AND z.deleted_at IS NULL AND f.deleted_at IS NULL ORDER BY z.created_at, z.rowid"
    ).fetchall():
        out.setdefault(r["area_id"], {"floor_id": r["floor_id"], "zone_id": r["id"]})
    return out
