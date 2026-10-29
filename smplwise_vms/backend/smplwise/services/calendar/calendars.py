"""CALENDARS-298 sections 3.1, 3.4, 13.1 - calendars and their members."""
from __future__ import annotations

import json
import secrets
import sqlite3
from typing import Any

from ...db import now_iso
from ...errors import ApiError
from . import model
from .access import Ctx, NOT_FOUND_HE, scope_of


def new_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_hex(11)}"


def name_key(name: str) -> str:
    return " ".join(name.split()).casefold()


def floor_of_area(conn: sqlite3.Connection, area_ref: str | None) -> str | None:
    if not area_ref:
        return None
    try:
        r = conn.execute("SELECT floor_id FROM spatial_zones WHERE id = ?", (area_ref,)).fetchone()
    except sqlite3.Error:
        return None
    return r["floor_id"] if r and r["floor_id"] else None


def user_exists(conn: sqlite3.Connection, user_id: str) -> bool:
    return conn.execute("SELECT 1 FROM users WHERE id = ? AND active = 1", (user_id,)).fetchone() is not None


def user_label(conn: sqlite3.Connection, user_id: str | None) -> dict[str, str] | None:
    if not user_id:
        return None
    r = conn.execute("SELECT id, display_name, username FROM users WHERE id = ?", (user_id,)).fetchone()
    return {"id": user_id, "name": (r["display_name"] or r["username"]) if r else ""}


def serialize(conn: sqlite3.Connection, cal: sqlite3.Row, role: str | None) -> dict[str, Any]:
    pending = conn.execute("SELECT COUNT(*) FROM (SELECT event_id FROM cal_event_rooms WHERE room_calendar_id = ? AND state = 'pending' "
                           "UNION SELECT id FROM cal_events WHERE calendar_id = ? AND state = 'pending' AND override_of IS NULL "
                           "AND id NOT IN (SELECT event_id FROM cal_event_rooms WHERE room_calendar_id = ?))", (cal["id"], cal["id"], cal["id"])).fetchone()[0]
    return {
        "id": cal["id"], "name": cal["name"], "type": cal["type"], "description": cal["description"], "color": cal["color"], "tz": cal["tz"],
        "owner": user_label(conn, cal["owner_user_id"]), "my_role": role, "visibility": cal["visibility"], "approval_mode": cal["approval_mode"],
        "approval_timeout_h": cal["approval_timeout_h"], "capacity": cal["capacity"], "equipment": json.loads(cal["equipment_json"] or "[]"),
        "floor_id": cal["floor_id"], "area_ref": cal["area_ref"], "conflict_policy": cal["conflict_policy"],
        "buffer_before_min": cal["buffer_before_min"], "buffer_after_min": cal["buffer_after_min"], "slot_step_min": cal["slot_step_min"],
        "min_minutes": cal["min_minutes"], "max_minutes": cal["max_minutes"], "lead_min": cal["lead_min"], "horizon_days": cal["horizon_days"],
        "hours_mode": cal["hours_mode"], "hours_json": json.loads(cal["hours_json"]) if cal["hours_json"] else None, "holiday_rule": cal["holiday_rule"],
        "overlap_override": cal["overlap_override"], "sync": None, "pending_count": pending, "archived": bool(cal["archived_at"]), "revision": cal["revision"],
    }


def listing(ctx: Ctx, *, type_: str | None = None, include_archived: bool = False) -> list[dict[str, Any]]:
    out = []
    for cal in ctx.conn.execute("SELECT * FROM cal_calendars WHERE (? = 1 OR archived_at IS NULL) AND (? IS NULL OR type = ?) ORDER BY name_key",
                                (1 if include_archived else 0, type_, type_)).fetchall():
        if ctx.can_see(cal):
            out.append(serialize(ctx.conn, cal, ctx.role_in(cal)))
    return out


def create(ctx: Ctx, body: dict[str, Any], settings: dict[str, Any]) -> sqlite3.Row:
    conn, p = ctx.conn, ctx.principal
    vals = model.calendar_values(body, creating=True)
    owner = body.get("owner_user_id") or p.user_id
    if not isinstance(owner, str) or not user_exists(conn, owner):
        raise model.Invalid("owner_user_id: an active user", "owner_user_id")
    if conn.execute("SELECT COUNT(*) FROM cal_calendars WHERE archived_at IS NULL").fetchone()[0] >= settings["max_calendars"]:
        raise ApiError(409, "too_many_calendars", "הגעת למספר היומנים המרבי.")
    key = name_key(vals["name"])
    if conn.execute("SELECT 1 FROM cal_calendars WHERE name_key = ? AND archived_at IS NULL", (key,)).fetchone():
        raise ApiError(409, "name_taken", "כבר קיים יומן בשם הזה.")
    typ = vals["type"]
    from ...db import get_setting  # noqa: PLC0415

    tz = vals.get("tz") or get_setting(conn, "time.zone", "Asia/Jerusalem") or "Asia/Jerusalem"
    model.zone(tz)
    now = now_iso()
    cid = new_id("cal")
    row = {
        "id": cid, "name": vals["name"], "name_key": key, "type": typ, "description": vals.get("description", ""), "color": vals["color"], "tz": tz,
        "owner_user_id": owner, "area_ref": vals.get("area_ref"), "floor_id": floor_of_area(conn, vals.get("area_ref")), "capacity": vals.get("capacity"),
        "equipment_json": vals.get("equipment_json", "[]"), "conflict_policy": vals.get("conflict_policy") or model.default_policy(typ),
        "buffer_before_min": vals.get("buffer_before_min", 0),
        "buffer_after_min": vals.get("buffer_after_min", settings["default_room_buffer_after_min"] if typ == "room" else 0),
        "slot_step_min": vals.get("slot_step_min", 15), "min_minutes": vals.get("min_minutes", 15), "max_minutes": vals.get("max_minutes", 720),
        "lead_min": vals.get("lead_min", 0), "horizon_days": vals.get("horizon_days", 180), "hours_mode": vals.get("hours_mode", "always"),
        "hours_json": vals.get("hours_json"), "holiday_rule": vals.get("holiday_rule", "warn"), "approval_mode": vals.get("approval_mode", "none"),
        "approval_timeout_h": vals.get("approval_timeout_h", 2), "overlap_override": vals.get("overlap_override"),
        "visibility": vals.get("visibility", "members"), "created_by": p.user_id, "created_at": now, "updated_at": now,
    }
    cols = ", ".join(row)
    conn.execute(f"INSERT INTO cal_calendars({cols}) VALUES ({', '.join('?' * len(row))})", list(row.values()))
    conn.execute("INSERT INTO cal_members(calendar_id, subject_kind, subject_id, cal_role, added_by, added_at) VALUES (?, 'user', ?, 'manage', ?, ?)", (cid, owner, p.user_id, now))
    return conn.execute("SELECT * FROM cal_calendars WHERE id = ?", (cid,)).fetchone()


def update(ctx: Ctx, cal: sqlite3.Row, body: dict[str, Any]) -> sqlite3.Row:
    conn = ctx.conn
    rev = body.get("revision")
    if rev != cal["revision"]:
        raise ApiError(409, "stale", "היומן עודכן בינתיים. רענן ונסה שוב.", details={"revision": cal["revision"]})
    fields = {k: v for k, v in body.items() if k not in ("revision", "owner_user_id")}
    vals = model.calendar_values(fields, creating=False, current=dict(cal))
    if "name" in vals:
        key = name_key(vals["name"])
        if conn.execute("SELECT 1 FROM cal_calendars WHERE name_key = ? AND archived_at IS NULL AND id <> ?", (key, cal["id"])).fetchone():
            raise ApiError(409, "name_taken", "כבר קיים יומן בשם הזה.")
        vals["name_key"] = key
    if "area_ref" in vals:
        vals["floor_id"] = floor_of_area(conn, vals["area_ref"])
    vals.pop("type", None)
    if not vals:
        return cal
    vals["updated_at"] = now_iso()
    sets = ", ".join(f"{k} = ?" for k in vals)
    cur = conn.execute(f"UPDATE cal_calendars SET {sets}, revision = revision + 1 WHERE id = ? AND revision = ?", [*vals.values(), cal["id"], rev])
    if cur.rowcount != 1:
        raise ApiError(409, "stale", "היומן עודכן בינתיים. רענן ונסה שוב.")
    return conn.execute("SELECT * FROM cal_calendars WHERE id = ?", (cal["id"],)).fetchone()


def change_owner(conn: sqlite3.Connection, cal: sqlite3.Row, owner: str, actor: str) -> None:
    if not user_exists(conn, owner):
        raise model.Invalid("owner_user_id: an active user", "owner_user_id")
    conn.execute("UPDATE cal_calendars SET owner_user_id = ?, updated_at = ?, revision = revision + 1 WHERE id = ?", (owner, now_iso(), cal["id"]))
    conn.execute("INSERT OR IGNORE INTO cal_members(calendar_id, subject_kind, subject_id, cal_role, added_by, added_at) VALUES (?, 'user', ?, 'manage', ?, ?)",
                 (cal["id"], owner, actor, now_iso()))


def future_open_events(conn: sqlite3.Connection, cid: str, now: str) -> list[str]:
    return [r[0] for r in conn.execute("SELECT DISTINCT event_id FROM cal_occurrences WHERE holder_calendar_id = ? AND occ_end > ? AND state IN ('pending','confirmed')", (cid, now)).fetchall()]


def members(conn: sqlite3.Connection, cid: str) -> list[dict[str, Any]]:
    out = []
    for m in conn.execute("SELECT * FROM cal_members WHERE calendar_id = ? ORDER BY subject_kind, subject_id", (cid,)).fetchall():
        label = m["subject_id"]
        if m["subject_kind"] == "user":
            label = (user_label(conn, m["subject_id"]) or {}).get("name") or label
        elif m["subject_kind"] == "everyone":
            label = "*"
        out.append({"subject_kind": m["subject_kind"], "subject_id": m["subject_id"], "label": label, "cal_role": m["cal_role"]})
    return out


def put_members(ctx: Ctx, cal: sqlite3.Row, body: dict[str, Any]) -> list[dict[str, Any]]:
    conn = ctx.conn
    if body.get("revision") != cal["revision"]:
        raise ApiError(409, "stale", "היומן עודכן בינתיים. רענן ונסה שוב.", details={"revision": cal["revision"]})
    items = body.get("members")
    if not isinstance(items, list) or len(items) > 300:
        raise model.Invalid("members: a list of at most 300", "members")
    seen: set[tuple[str, str]] = set()
    for m in items:
        if not isinstance(m, dict) or set(m) - {"subject_kind", "subject_id", "cal_role"}:
            raise model.Invalid("members: {subject_kind, subject_id, cal_role}", "members")
        kind, sid, role = m.get("subject_kind"), m.get("subject_id"), m.get("cal_role")
        model._choice(kind, "subject_kind", model.SUBJECT_KINDS)
        model._choice(role, "cal_role", model.ROLES)
        if kind == "everyone":
            sid = "*"
            m["subject_id"] = sid
        if not isinstance(sid, str) or not 1 <= len(sid) <= 64 or (kind, sid) in seen:
            raise model.Invalid("members: a subject once", "members")
        if kind == "user" and not user_exists(conn, sid):
            raise model.Invalid("members: an active user", "members")
        seen.add((kind, sid))
    owner_key = ("user", cal["owner_user_id"])
    now = now_iso()
    conn.execute("DELETE FROM cal_members WHERE calendar_id = ?", (cal["id"],))
    for m in items:
        if (m["subject_kind"], m["subject_id"]) == owner_key:
            continue
        conn.execute("INSERT INTO cal_members VALUES (?, ?, ?, ?, ?, ?)", (cal["id"], m["subject_kind"], m["subject_id"], m["cal_role"], ctx.principal.user_id, now))
    conn.execute("INSERT INTO cal_members VALUES (?, 'user', ?, 'manage', ?, ?)", (cal["id"], cal["owner_user_id"], ctx.principal.user_id, now))  # rule 2: the owner stays
    conn.execute("UPDATE cal_calendars SET revision = revision + 1, updated_at = ? WHERE id = ?", (now, cal["id"]))
    return members(conn, cal["id"])


def archive(conn: sqlite3.Connection, cal: sqlite3.Row, body: dict[str, Any], now: str) -> list[str]:
    """Refused with future entries unless `cancel_future`; returns the cancelled event ids."""
    if body.get("revision") != cal["revision"]:
        raise ApiError(409, "stale", "היומן עודכן בינתיים. רענן ונסה שוב.")
    future = future_open_events(conn, cal["id"], now)
    if future and body.get("cancel_future") is not True:
        raise ApiError(409, "has_future_entries", "ביומן יש אירועים עתידיים.", details={"count": len(future)})
    for eid in future:
        conn.execute("UPDATE cal_events SET state = 'cancelled', updated_at = ?, revision = revision + 1 WHERE id = ? AND state IN ('pending','confirmed')", (now, eid))
        conn.execute("UPDATE cal_event_rooms SET state = 'cancelled' WHERE event_id = ? AND room_calendar_id = ?", (eid, cal["id"]))
        conn.execute("DELETE FROM cal_occurrences WHERE event_id = ? AND holder_calendar_id = ?", (eid, cal["id"]))
    conn.execute("UPDATE cal_calendars SET archived_at = ?, updated_at = ?, revision = revision + 1 WHERE id = ?", (now, now, cal["id"]))
    return future


def restore(conn: sqlite3.Connection, cal: sqlite3.Row, now: str) -> None:
    if conn.execute("SELECT 1 FROM cal_calendars WHERE name_key = ? AND archived_at IS NULL", (cal["name_key"],)).fetchone():
        raise ApiError(409, "name_taken", "כבר קיים יומן בשם הזה.")
    conn.execute("UPDATE cal_calendars SET archived_at = NULL, updated_at = ?, revision = revision + 1 WHERE id = ?", (now, cal["id"]))


__all__ = ["create", "update", "listing", "serialize", "members", "put_members", "archive", "restore", "change_owner", "scope_of", "NOT_FOUND_HE"]
