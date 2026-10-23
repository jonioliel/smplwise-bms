"""CR-NOTICE106 section 5 - who a notice is for. `{"everyone": true}` = every active user; otherwise floors / areas / groups / roles,
OR-ed. A floor means "everyone whose live allow bindings reach that floor" (the floor itself, its building, its site or the
installation; section 5.3: there is no resident model). An area resolves to its floor. `{}` = no users (a TV-only notice).
The reading test `in_audience` is the same rule evaluated for one user, so a notice is visible exactly to the people it is for."""
from __future__ import annotations

import json
import sqlite3
from typing import Any

from ...db import now_iso


def _live_bindings(conn: sqlite3.Connection, user_id: str) -> list[sqlite3.Row]:
    now = now_iso()
    return conn.execute(
        """SELECT role_id, scope_type, scope_id FROM bindings
           WHERE effect = 'allow' AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)
             AND ((subject_kind = 'user' AND subject_id = ?)
                  OR (subject_kind = 'group' AND subject_id IN (SELECT group_id FROM group_members WHERE user_id = ?)))""",
        (now, user_id, user_id)).fetchall()


def _floor_chain(conn: sqlite3.Connection, floor_id: str) -> set[tuple[str, str]]:
    row = conn.execute("""SELECT f.id AS fid, b.id AS bid, b.site_id AS sid FROM floors f JOIN buildings b ON b.id = f.building_id
                          WHERE f.id = ? AND f.deleted_at IS NULL""", (floor_id,)).fetchone()
    if row is None:
        return set()
    return {("floor", row["fid"]), ("building", row["bid"]), ("site", row["sid"]), ("installation", "*")}


def _area_floors(conn: sqlite3.Connection, area_ids: list[str]) -> list[str]:
    """An area (spatial zone) resolves to its floor; a zone without one is ignored (section 5, step 4)."""
    if not area_ids:
        return []
    try:
        marks = ",".join("?" * len(area_ids))
        return [r[0] for r in conn.execute(f"SELECT DISTINCT floor_id FROM spatial_zones WHERE id IN ({marks}) AND floor_id IS NOT NULL", area_ids).fetchall()]
    except sqlite3.Error:
        return []


def parse(raw: str | None) -> dict[str, Any]:
    try:
        v = json.loads(raw or "{}")
    except ValueError:
        return {}
    return v if isinstance(v, dict) else {}


def in_audience(conn: sqlite3.Connection, user_id: str, audience: dict[str, Any], *, cache: dict[str, Any] | None = None) -> bool:
    if audience.get("everyone") is True:
        return True
    if not any(audience.get(k) for k in ("floors", "areas", "groups", "roles")):
        return False
    cache = cache if cache is not None else {}
    if "groups" not in cache:
        cache["groups"] = {r[0] for r in conn.execute("SELECT group_id FROM group_members WHERE user_id = ?", (user_id,)).fetchall()}
        cache["bindings"] = [(r["role_id"], r["scope_type"], r["scope_id"]) for r in _live_bindings(conn, user_id)]
    if set(audience.get("groups") or []) & cache["groups"]:
        return True
    roles = set(audience.get("roles") or [])
    if roles and any(b[0] in roles for b in cache["bindings"]):
        return True
    floors = list(audience.get("floors") or []) + _area_floors(conn, list(audience.get("areas") or []))
    reach = {(b[1], b[2]) for b in cache["bindings"]}
    for fid in floors:
        if _floor_chain(conn, fid) & reach:
            return True
    return False


def resolve_users(conn: sqlite3.Connection, audience: dict[str, Any]) -> list[str]:
    """Every active user the audience reaches (the compose preview count; the push of slice 2 uses the same list)."""
    users = [r[0] for r in conn.execute("SELECT id FROM users WHERE active = 1").fetchall()]
    if audience.get("everyone") is True:
        return users
    return [u for u in users if in_audience(conn, u, audience)]


def summary(conn: sqlite3.Connection, audience: dict[str, Any]) -> dict[str, Any]:
    """Counts only (the audit rows and the list chips carry no names)."""
    if audience.get("everyone") is True:
        return {"everyone": True}
    return {k: len(audience.get(k) or []) for k in ("floors", "areas", "groups", "roles") if audience.get(k)}
