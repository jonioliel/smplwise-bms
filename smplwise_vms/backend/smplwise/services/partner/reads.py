"""PARTNERAPI113-295: what a partner token reads (and the one write, `tickets.create`) - CR section 5.

Every object is judged by the token's restriction with the people's placement rules: a ticket by its site / building / floor (a placeless
ticket only for an installation-wide token) and the token's departments; a temperature unit by its temperature sensor's placement; an
elevator only when ALL its sensors are covered. Outside the restriction = the same 404 as a missing object (no existence oracle).
Answers carry ids, keys, states, numbers, times and friendly names of places, departments and devices - never an entity id, a phone, an
e-mail, an address or a URL. Owner answer 167: the request's title and description are included by default (`personal.ticket_text`),
people's names only when `personal.ticket_people` was switched on for the token."""
from __future__ import annotations

import re
import sqlite3
from typing import Any

from ...db import get_setting
from . import core
from .core import TokenCtx

PAGE = 100
EXTERNAL_REF_RE = re.compile(r"[A-Za-z0-9._:-]{1,64}")
STATUSES = ("new", "assigned", "acknowledged", "in_progress", "waiting_part", "done", "returned", "closed", "cancelled")
PRIORITY_KEYS = ("urgent", "high", "normal", "low")
CREATE_FIELDS = {"department_id", "title", "description", "template_id", "category_id", "priority_key", "floor_id", "external_ref"}


class Invalid(Exception):
    def __init__(self, field: str, code: str) -> None:
        super().__init__(f"{field}:{code}")
        self.field, self.code = field, code


def tickets_on(conn: sqlite3.Connection) -> bool:
    return (get_setting(conn, "tickets.enabled", "false") or "false") == "true"


def whoami(ctx: TokenCtx) -> dict[str, Any]:
    return {"token_id": ctx.id, "partner": ctx.client_label, "scopes": list(ctx.scopes), "restriction_kind": ctx.kind,
            "restriction_count": len(ctx.ids), "expires_at": ctx.expires_at, "installation": ctx.opaque_ref}


def parse_json(raw: bytes) -> dict[str, Any]:
    from ..tickets.public_app import parse_json_object

    try:
        data = parse_json_object(raw)
    except ValueError:
        raise Invalid("body", "json") from None
    if not isinstance(data, dict):
        raise Invalid("body", "json")
    return data


# ---------------------------------------------------------------- tickets

_TICKET_SQL = """SELECT t.*, d.key AS department_key, d.name AS department_name, c.name AS category_name, p.key AS priority_key,
                        f.name AS floor_name, a.assignee_name AS assignee_name, l.client_id AS partner_client, l.external_ref AS external_ref
                 FROM tickets t JOIN ticket_departments d ON d.id = t.department_id
                 LEFT JOIN ticket_categories c ON c.id = t.category_id JOIN ticket_priorities p ON p.id = t.priority_id
                 LEFT JOIN floors f ON f.id = t.floor_id LEFT JOIN ticket_assignments a ON a.id = t.current_assignment_id
                 LEFT JOIN partner_ticket_links l ON l.ticket_id = t.id"""


def _ticket_visible(conn: sqlite3.Connection, ctx: TokenCtx, row: sqlite3.Row, reach: core.Reach) -> bool:
    if ctx.departments and row["department_id"] not in ctx.departments:
        return False
    if row["deleted_at"] if "deleted_at" in row.keys() else False:
        return False
    return reach.covers_place(row["site_id"], row["building_id"], row["floor_id"])


def ticket_json(row: sqlite3.Row, ctx: TokenCtx) -> dict[str, Any]:
    from .webhooks import ticket_people, ticket_place

    own = row["partner_client"] == ctx.client_id
    out: dict[str, Any] = {
        "id": row["id"], "number": row["number"], "department_key": row["department_key"], "department": row["department_name"],
        "category": row["category_name"], "priority_key": row["priority_key"], "status": row["status"], "place": ticket_place(row),
        "origin": "partner" if row["partner_client"] else row["origin"], "created_at": row["created_at"], "updated_at": row["updated_at"],
        "done_at": row["done_at"], "closed_at": row["closed_at"], "own": own, "external_ref": row["external_ref"] if own else None,
    }
    if ctx.personal.get("ticket_text"):
        out["title"] = row["title"]
        out["description"] = row["description"]
    if ctx.personal.get("ticket_people"):
        out.update(ticket_people(row))
    return out


def tickets_page(conn: sqlite3.Connection, ctx: TokenCtx, params: dict[str, str]) -> dict[str, Any]:
    from .api_app import decode_cursor, encode_cursor

    unknown = set(params) - {"updated_since", "cursor", "status"}
    if unknown:
        raise Invalid(sorted(unknown)[0][:32], "unknown")
    where, args = ["1=1"], []
    if params.get("updated_since"):
        at = core.parse_iso(params["updated_since"])
        if at is None:
            raise Invalid("updated_since", "datetime")
        where.append("t.updated_at >= ?")
        args.append(core.iso(at))
    if params.get("status"):
        wanted = params["status"].split(",")
        if not all(s in STATUSES for s in wanted) or len(wanted) > len(STATUSES):
            raise Invalid("status", "unknown")
        where.append(f"t.status IN ({','.join('?' * len(wanted))})")
        args += wanted
    if params.get("cursor"):
        cur = decode_cursor(params["cursor"])
        if cur is None:
            raise Invalid("cursor", "invalid")
        where.append("(t.updated_at > ? OR (t.updated_at = ? AND t.id > ?))")
        args += [cur[0], cur[0], cur[1]]
    if ctx.departments:
        where.append(f"t.department_id IN ({','.join('?' * len(ctx.departments))})")
        args += list(ctx.departments)
    reach = core.reach_of(conn, ctx.kind, ctx.ids)
    items: list[dict[str, Any]] = []
    last: sqlite3.Row | None = None
    window = PAGE * 5
    rows = conn.execute(_TICKET_SQL + " WHERE " + " AND ".join(where) + " ORDER BY t.updated_at, t.id LIMIT ?", (*args, window)).fetchall()
    # the restriction is applied row by row (the same rule as one read); a page scans a bounded window of rows
    for row in rows:
        if _ticket_visible(conn, ctx, row, reach):
            items.append(ticket_json(row, ctx))
        last = row
        if len(items) >= PAGE:
            break
    more = last is not None and (len(items) >= PAGE or len(rows) >= window)
    return {"items": items, "next_cursor": encode_cursor(last["updated_at"], last["id"]) if more and last is not None else None}


def ticket_one(conn: sqlite3.Connection, ctx: TokenCtx, ticket_id: str) -> dict[str, Any] | None:
    row = conn.execute(_TICKET_SQL + " WHERE t.id = ?", (ticket_id,)).fetchone()
    if row is None or not _ticket_visible(conn, ctx, row, core.reach_of(conn, ctx.kind, ctx.ids)):
        return None
    return ticket_json(row, ctx)


def create_ticket(conn: sqlite3.Connection, ctx: TokenCtx, data: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    from ..tickets import create as tcreate

    extra = set(data) - CREATE_FIELDS
    if extra:
        raise Invalid("body", "extra_forbidden")
    for k in CREATE_FIELDS:
        if k in data and data[k] is not None and not isinstance(data[k], str):
            raise Invalid(k, "string")
    dept = data.get("department_id")
    if not dept or dept not in ctx.departments:
        raise Invalid("department_id", "unknown")
    if data.get("priority_key") is not None and data["priority_key"] not in PRIORITY_KEYS:
        raise Invalid("priority_key", "unknown")
    ref = data.get("external_ref")
    if ref is not None and not EXTERNAL_REF_RE.fullmatch(ref):
        raise Invalid("external_ref", "pattern")
    if ctx.personal.get("ticket_text"):
        title, description = data.get("title") or "", data.get("description") or ""
        if data.get("template_id"):
            tpl = _template(conn, data["template_id"], dept)
            title = title or tpl["title"]
    else:
        # without the free-text option the title comes from a ticket template of the department, never typed text (CR 4.5)
        if data.get("title") or data.get("description"):
            raise Invalid("title", "not_allowed")
        if not data.get("template_id"):
            raise Invalid("template_id", "required")
        tpl = _template(conn, data["template_id"], dept)
        title, description = tpl["title"], ""
    floor = data.get("floor_id")
    reach = core.reach_of(conn, ctx.kind, ctx.ids)
    if floor:
        row = conn.execute("SELECT f.id, b.id AS bid, b.site_id AS sid FROM floors f JOIN buildings b ON b.id = f.building_id WHERE f.id = ? AND f.deleted_at IS NULL",
                           (floor,)).fetchone()
        if row is None or not reach.covers_place(row["sid"], row["bid"], row["id"]):
            raise Invalid("floor_id", "unknown")
    elif not reach.wide:
        raise Invalid("floor_id", "required")  # a restricted token places its request inside its restriction (else it could never read it)
    res = tcreate.create_by_partner(conn, token_id=ctx.id, client_id=ctx.client_id, client_label=ctx.client_label, department_id=dept, title=title,
                                    description=description, category_id=data.get("category_id"), priority_key=data.get("priority_key"),
                                    floor_id=floor, external_ref=ref)
    row = conn.execute(_TICKET_SQL + " WHERE t.id = ?", (res.ticket_id,)).fetchone()
    return 201, ticket_json(row, ctx)


def _template(conn: sqlite3.Connection, template_id: str, dept: str) -> sqlite3.Row:
    tpl = conn.execute("""SELECT title FROM ticket_templates WHERE id = ? AND kind = 'ticket' AND active = 1 AND deleted_at IS NULL
                          AND (department_id IS NULL OR department_id = ?)""", (template_id, dept)).fetchone()
    if tpl is None or not (tpl["title"] or "").strip():
        raise Invalid("template_id", "unknown")
    return tpl


# ---------------------------------------------------------------- temperature and elevators

def _area_names(conn: sqlite3.Connection) -> dict[str, str]:
    try:
        return {r[0]: r[1] for r in conn.execute("SELECT area_id, name FROM ha_areas").fetchall()}
    except sqlite3.Error:
        return {}


def _open_state(conn: sqlite3.Connection, kind: str, subject_id: str, sources: tuple[str, ...]) -> str | None:
    marks = ",".join("?" * len(sources))
    row = conn.execute(f"""SELECT source FROM notifications WHERE subject_kind = ? AND subject_id = ? AND state != 'resolved' AND source IN ({marks})
                           ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'alert' THEN 1 ELSE 2 END LIMIT 1""", (kind, subject_id, *sources)).fetchone()
    return row[0].split(".", 1)[1] if row else None


def temperature_units(conn: sqlite3.Connection, ctx: TokenCtx) -> dict[str, Any]:
    from .. import ha_scope

    reach = core.reach_of(conn, ctx.kind, ctx.ids)
    placed = None if reach.wide else ha_scope.placements(conn)
    areas = _area_names(conn)
    try:
        rows = conn.execute("SELECT * FROM infra_temp_units WHERE enabled = 1 ORDER BY sort_order, name").fetchall()
    except sqlite3.Error:
        rows = []
    items = []
    for u in rows:
        if not core.entity_covered(conn, reach, u["temp_entity_id"], placed):
            continue
        st = conn.execute("SELECT state, available FROM ha_entities WHERE entity_id = ?", (u["temp_entity_id"],)).fetchone()
        try:
            reading = round(float(st["state"]), 2) if st else None
        except (TypeError, ValueError):
            reading = None
        door = None
        if u["door_entity_id"] and core.entity_covered(conn, reach, u["door_entity_id"], placed):
            d = conn.execute("SELECT state FROM ha_entities WHERE entity_id = ?", (u["door_entity_id"],)).fetchone()
            if d and d["state"] in ("on", "off"):
                is_on = d["state"] == "on"
                door = "closed" if bool(u["door_invert"]) == is_on else "open"
        alarm = _open_state(conn, "temperature", u["id"], ("temperature.alarm", "temperature.warning", "temperature.offline", "temperature.escalation"))
        status = alarm or ("unknown" if reading is None else "ok" if u["low"] <= reading <= u["high"] else "out_of_band")
        items.append({"id": u["id"], "name": u["name"], "place": areas.get(u["area_id"] or ""), "kind": u["kind"], "reading": reading,
                      "low": u["low"], "high": u["high"], "status": status, "door": door, "alarm": alarm})
    return {"items": items}


def elevators(conn: sqlite3.Connection, ctx: TokenCtx) -> dict[str, Any]:
    from .. import elevators as el
    from .. import ha_scope

    reach = core.reach_of(conn, ctx.kind, ctx.ids)
    placed = None if reach.wide else ha_scope.placements(conn)
    areas = _area_names(conn)
    try:
        rows = conn.execute("SELECT * FROM infra_elevators WHERE enabled = 1 ORDER BY sort_order, name").fetchall()
    except sqlite3.Error:
        rows = []
    sensors = el.sensors_of(conn, [r["id"] for r in rows]) if rows else {}
    try:
        connected = el.mirror_connected()
    except Exception:  # noqa: BLE001
        connected = False
    items = []
    for e in rows:
        mine = sensors.get(e["id"], [])
        if not mine or not all(core.entity_covered(conn, reach, s["entity_id"], placed) for s in mine):
            continue
        live = el.live_of(mine, connected=connected)
        items.append({"id": e["id"], "name": e["name"], "place": areas.get(e["area_id"] or ""), "state": live["state"], "since": live["since"],
                      "stale": live["stale"]})
    return {"items": items}
