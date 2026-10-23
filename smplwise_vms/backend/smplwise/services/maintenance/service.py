"""CR-MAINT215 sections 3-6: the operations of the maintenance module - tasks (the ledger, plans, rounds, supplier documents),
completions, round runs, QR / NFC tags and the read helpers the elevator / generator cards and the tickets picker use.

Every function takes a `Viewer` (services/maintenance/access.py) and decides with THE rule there; a task the caller may not see
is the same 404 as an unknown id. Writes are audited (`maintenance.*`), refusals too (an audited 403). Nothing here calls a device,
Home Assistant or anything outside the database; a service request is opened only through the tickets module's one creation path
(services/tickets/create.py) and only while that module is on."""
from __future__ import annotations

import json
import secrets
import sqlite3
from datetime import date, timedelta
from typing import Any

from ...audit import audit
from ...db import new_id
from ...errors import ApiError
from ...rbac import INSTALLATION
from . import access, model
from .access import MANAGE, PERFORM, VIEW, Viewer

LIST_MAX = 500
RECORDS_MAX = 200
TAGS_MAX = 1000
EDITABLE = ("title", "category", "notes", "place", "entity_id", "elevator_id", "generator_id", "vendor_id", "doc_type", "owner_user_id",
            "interval", "anchor_date", "due_date", "lead_days", "checklist", "auto_ticket", "department_id", "active")


def invalid(exc: model.Invalid) -> ApiError:
    return ApiError(422, "validation", "ערך לא תקין: " + exc.field, details={"fields": [exc.field], "problem": exc.code})


def _row(conn: sqlite3.Connection, task_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM maint_tasks WHERE id = ?", (task_id,)).fetchone()


def require_task(viewer: Viewer, task_id: str) -> sqlite3.Row:
    row = _row(viewer.conn, task_id)
    if not access.visible(viewer, row):
        raise access.not_found()
    return row


def _user_name(conn: sqlite3.Connection, uid: str) -> str:
    r = conn.execute("SELECT display_name, username FROM users WHERE id = ?", (uid,)).fetchone()
    return (r["display_name"] or r["username"] or "") if r else ""


def _today(viewer: Viewer) -> date:
    return access.today(viewer.conn)


def task_route(task_id: str) -> str:
    """Slice 2: where the screens open a task (the section of the service-management area opens its sheet from `?task=`)."""
    return f"#/tickets/maintenance?task={task_id}"


def _read_only(conn: sqlite3.Connection) -> bool:
    try:
        return bool(conn.execute("PRAGMA query_only").fetchone()[0])
    except sqlite3.Error:
        return True


# ---------------------------------------------------------------- presentation

def _date(text: str | None) -> date | None:
    try:
        return date.fromisoformat(text) if text else None
    except ValueError:
        return None


PLACE_TABLES = {"floor": "floors", "building": "buildings", "site": "sites"}


def _place_name(conn: sqlite3.Connection, kind: str, ident: str) -> str:
    r = conn.execute(f"SELECT name FROM {PLACE_TABLES[kind]} WHERE id = ?", (ident,)).fetchone()
    return (r["name"] or "") if r else ""


def _place_out(conn: sqlite3.Connection, row: Any) -> dict[str, Any] | None:
    kind, ident = access.target_of(row)
    if kind == "installation":
        return None
    return {"kind": kind, "id": ident, "name": _place_name(conn, kind, ident)}


def _place_path(conn: sqlite3.Connection, row: Any) -> list[dict[str, str]]:
    """Slice 2: the place chain site -> building -> floor (the screens' places tree groups by it); [] for a placeless task."""
    return [{"kind": k, "id": row[f"{k}_id"], "name": _place_name(conn, k, row[f"{k}_id"])} for k in ("site", "building", "floor") if row[f"{k}_id"]]


def _names(conn: sqlite3.Connection, row: Any) -> dict[str, Any]:
    out: dict[str, Any] = {}
    if row["vendor_id"]:
        r = conn.execute("SELECT display_name FROM ticket_contacts WHERE id = ?", (row["vendor_id"],)).fetchone()
        out["vendor_name"] = r["display_name"] if r else None
    if row["elevator_id"]:
        r = conn.execute("SELECT name FROM infra_elevators WHERE id = ?", (row["elevator_id"],)).fetchone()
        out["elevator_name"] = r["name"] if r else None
    if row["generator_id"]:
        r = conn.execute("SELECT name FROM generator_devices WHERE id = ?", (row["generator_id"],)).fetchone()
        out["generator_name"] = r["name"] if r else None
    if row["entity_id"]:
        r = conn.execute("SELECT name, original_name FROM ha_entities WHERE entity_id = ?", (row["entity_id"],)).fetchone()
        out["entity_name"] = (r["name"] or r["original_name"]) if r else None
    if row["owner_user_id"]:
        out["owner_name"] = _user_name(conn, row["owner_user_id"])
    return out


def task_out(viewer: Viewer, row: Any, today: date, *, detail: bool = False) -> dict[str, Any]:
    due = _date(row["due_date"])
    st = model.due_state(due, row["lead_days"], today, active=bool(row["active"]))
    out: dict[str, Any] = {
        "id": row["id"], "kind": row["kind"], "title": row["title"], "category": row["category"], "place": _place_out(viewer.conn, row),
        "place_path": _place_path(viewer.conn, row), "checklist_count": len(json.loads(row["checklist_json"] or "[]")),
        "entity_id": row["entity_id"], "elevator_id": row["elevator_id"], "generator_id": row["generator_id"], "vendor_id": row["vendor_id"],
        "doc_type": row["doc_type"], "owner_user_id": row["owner_user_id"],
        "interval": {"unit": row["interval_unit"], "count": row["interval_count"]} if row["interval_unit"] else None,
        "anchor_date": row["anchor_date"], "due_date": row["due_date"], "lead_days": row["lead_days"], "state": st.state, "days_left": st.days_left,
        "active": bool(row["active"]), "auto_ticket": bool(row["auto_ticket"]), "department_id": row["department_id"], "ticket_id": row["ticket_id"],
        "last_done_at": row["last_done_at"], "revision": row["revision"], **_names(viewer.conn, row),
        "file_count": viewer.conn.execute("SELECT COUNT(*) FROM maint_files WHERE task_id = ? AND deleted_at IS NULL", (row["id"],)).fetchone()[0],
    }
    if row["kind"] == "round":
        out.update(_round_summary(viewer.conn, row["id"]))
    if detail:
        out["notes"] = row["notes"]
        out["checklist"] = json.loads(row["checklist_json"] or "[]")
        out["ticket_error"] = row["ticket_error"]
        open_run = viewer.conn.execute("SELECT id FROM maint_records WHERE task_id = ? AND status = 'open'", (row["id"],)).fetchone()
        out["open_run_id"] = open_run["id"] if open_run else None
        out["can"] = can(viewer, row)
        out["files"] = file_list(viewer.conn, row["id"])
    return out


def _issues(answers: dict[str, Any]) -> int:
    return sum(1 for a in answers.values() if isinstance(a, dict) and a.get("ok") is False)


def _round_summary(conn: sqlite3.Connection, task_id: str) -> dict[str, Any]:
    """Slice 2 (the rounds list): the open run (who, since when, how far) and the last finished one (when, how many problems)."""
    out: dict[str, Any] = {"open_run": None, "last_run": None}
    o = conn.execute("SELECT * FROM maint_records WHERE task_id = ? AND kind = 'run' AND status = 'open'", (task_id,)).fetchone()
    if o is not None:
        answers = json.loads(o["answers_json"] or "{}")
        out["open_run"] = {"id": o["id"], "started_by_name": o["started_by_name"], "started_at": o["started_at"], "answered": len(answers),
                           "total": len(json.loads(o["checklist_json"] or "[]"))}
    d = conn.execute("SELECT * FROM maint_records WHERE task_id = ? AND kind = 'run' AND status = 'done' ORDER BY finished_at DESC, id DESC LIMIT 1",
                     (task_id,)).fetchone()
    if d is not None:
        out["last_run"] = {"id": d["id"], "performed_on": d["performed_on"], "finished_at": d["finished_at"], "result": d["result"],
                           "issues": _issues(json.loads(d["answers_json"] or "{}"))}
    return out


def can(viewer: Viewer, row: Any) -> dict[str, bool]:
    """What the caller may do with this task (the screen hides what is false; the server checks again on every call)."""
    perform, manage = viewer.holds_on(PERFORM, row), viewer.holds_on(MANAGE, row)
    return {
        "edit": manage,
        "complete": (manage if row["kind"] in ("certificate", "vendor_document") else perform) and row["kind"] != "round",
        "start_round": row["kind"] == "round" and perform and bool(row["active"]),
        "open_request": tickets_can_create(viewer),
    }


def tickets_can_create(viewer: Viewer) -> bool:
    """Owner rule (2026-10-20): with the tickets module off there is NO "open a service request" action anywhere."""
    from ..tickets import access as taccess

    return taccess.module_on(viewer.conn) and taccess.CREATE in viewer.anywhere


# ---------------------------------------------------------------- reading

def list_tasks(viewer: Viewer, *, kind: str | None = None, state: str | None = None, category: str | None = None, q: str = "",
               include_inactive: bool = False) -> dict[str, Any]:
    viewer.require_anywhere(VIEW)
    sql, args = "SELECT * FROM maint_tasks WHERE deleted_at IS NULL", []
    if kind:
        sql += " AND kind = ?"
        args.append(kind)
    if category:
        sql += " AND category = ?"
        args.append(category)
    if not include_inactive:
        sql += " AND active = 1"
    sql += " ORDER BY due_date IS NULL, due_date, title, id"
    today = _today(viewer)
    items, counts, truncated = [], dict.fromkeys(model.STATES, 0), False
    needle = q.strip().casefold()
    for row in viewer.conn.execute(sql, args).fetchall():
        if not access.visible(viewer, row):
            continue
        if needle and needle not in row["title"].casefold():
            continue
        out = task_out(viewer, row, today)
        counts[out["state"]] += 1
        if state and out["state"] != state:
            continue
        if len(items) >= LIST_MAX:
            truncated = True
            continue
        items.append(out)
    return {"items": items, "counts": counts, "truncated": truncated, "today": today.isoformat()}


def get_task(viewer: Viewer, task_id: str) -> dict[str, Any]:
    return task_out(viewer, require_task(viewer, task_id), _today(viewer), detail=True)


def records(viewer: Viewer, task_id: str, limit: int = 50) -> dict[str, Any]:
    require_task(viewer, task_id)
    rows = viewer.conn.execute("SELECT * FROM maint_records WHERE task_id = ? ORDER BY started_at DESC, id DESC LIMIT ?",
                               (task_id, max(1, min(limit, RECORDS_MAX)))).fetchall()
    return {"items": [record_out(r) for r in rows]}


def record_out(r: Any) -> dict[str, Any]:
    return {"id": r["id"], "task_id": r["task_id"], "kind": r["kind"], "status": r["status"], "started_by_name": r["started_by_name"],
            "started_at": r["started_at"], "finished_at": r["finished_at"], "performed_on": r["performed_on"], "due_before": r["due_before"],
            "due_after": r["due_after"], "valid_until": r["valid_until"], "note": r["note"], "result": r["result"],
            "checklist": json.loads(r["checklist_json"] or "[]"), "answers": json.loads(r["answers_json"] or "{}"),
            "ticket_ids": json.loads(r["ticket_ids_json"] or "[]"), "revision": r["revision"]}


# ---------------------------------------------------------------- validation of a task body

def _place(conn: sqlite3.Connection, raw: Any) -> dict[str, str | None]:
    """{site_id, building_id, floor_id} from `{kind, id}` (None = the installation); the chain is derived server-side."""
    empty = {"site_id": None, "building_id": None, "floor_id": None}
    if raw is None:
        return empty
    if not isinstance(raw, dict) or raw.get("kind") not in ("site", "building", "floor") or not isinstance(raw.get("id"), str):
        raise model.Invalid("place", "invalid")
    kind, ident = raw["kind"], raw["id"]
    if kind == "floor":
        f = conn.execute("SELECT id, building_id FROM floors WHERE id = ? AND deleted_at IS NULL", (ident,)).fetchone()
        if f is None:
            raise model.Invalid("place", "unknown")
        b = conn.execute("SELECT site_id FROM buildings WHERE id = ?", (f["building_id"],)).fetchone()
        return {"site_id": b["site_id"] if b else None, "building_id": f["building_id"], "floor_id": f["id"]}
    if kind == "building":
        b = conn.execute("SELECT id, site_id FROM buildings WHERE id = ? AND deleted_at IS NULL", (ident,)).fetchone()
        if b is None:
            raise model.Invalid("place", "unknown")
        return {"site_id": b["site_id"], "building_id": b["id"], "floor_id": None}
    s = conn.execute("SELECT id FROM sites WHERE id = ? AND deleted_at IS NULL", (ident,)).fetchone()
    if s is None:
        raise model.Invalid("place", "unknown")
    return {"site_id": s["id"], "building_id": None, "floor_id": None}


def _references(viewer: Viewer, fields: dict[str, Any]) -> None:
    """Every link must exist - and a device the caller may not read is "unknown", never "forbidden" (no existence leak)."""
    conn = viewer.conn
    if fields.get("entity_id"):
        from ..tickets import device_context

        if device_context.readable_entity(conn, viewer.principal, fields["entity_id"]) is None:
            raise model.Invalid("entity_id", "unknown")
    if fields.get("elevator_id") and conn.execute("SELECT 1 FROM infra_elevators WHERE id = ?", (fields["elevator_id"],)).fetchone() is None:
        raise model.Invalid("elevator_id", "unknown")
    if fields.get("generator_id") and conn.execute("SELECT 1 FROM generator_devices WHERE id = ? AND status <> 'removed'", (fields["generator_id"],)).fetchone() is None:
        raise model.Invalid("generator_id", "unknown")
    if fields.get("vendor_id") and conn.execute("SELECT 1 FROM ticket_contacts WHERE id = ? AND kind = 'vendor' AND erased_at IS NULL",
                                                (fields["vendor_id"],)).fetchone() is None:
        raise model.Invalid("vendor_id", "unknown")
    if fields.get("owner_user_id") and conn.execute("SELECT 1 FROM users WHERE id = ? AND active = 1", (fields["owner_user_id"],)).fetchone() is None:
        raise model.Invalid("owner_user_id", "unknown")


def _department_gate(viewer: Viewer, department_id: str, rid: str | None) -> None:
    """Scheduling requests into a department is a department decision: tickets.configure, or a manager of that department."""
    from ..tickets import access as taccess
    from ..tickets import store as tstore

    dept = tstore.department(viewer.conn, department_id)
    if dept is None or not dept["active"]:
        raise model.Invalid("department_id", "unknown")
    tv = taccess.Viewer(viewer.conn, viewer.principal)
    if tv.holds_installation(taccess.CONFIGURE) or tv.manages_department(department_id):
        return
    audit(viewer.conn, actor=viewer.principal, action="maintenance.task.department", decision="denied", resource_type="ticket_department", resource_id=department_id,
          reason="not_department_manager", request_id=rid)
    raise ApiError(403, "forbidden", "רק מנהל המחלקה קובע בקשות מתוזמנות למחלקה.", details={"reason": "not_department_manager"})


def _normalise(viewer: Viewer, kind: str, body: dict[str, Any], current: Any | None) -> dict[str, Any]:
    """The full column set of a task from a create body or (with `current`) a partial update. Raises model.Invalid."""
    conn = viewer.conn
    cur = dict(current) if current is not None else {}
    sent = set(body)

    def pick(name: str, column: str | None = None) -> Any:
        column = column or name
        return body.get(name) if name in sent else cur.get(column)

    out: dict[str, Any] = {}
    out["title"] = model.text(pick("title"), "title", max_len=model.TITLE_MAX, required=True)
    out["category"] = pick("category") or "other"
    if out["category"] not in model.CATEGORIES:
        raise model.Invalid("category", "unknown")
    out["notes"] = model.text(pick("notes"), "notes", max_len=model.NOTES_MAX, multiline=True)
    if "place" in sent:
        out.update(_place(conn, body["place"]))
    else:
        out.update({k: cur.get(k) for k in ("site_id", "building_id", "floor_id")})
    for name in ("entity_id", "elevator_id", "generator_id", "vendor_id", "owner_user_id", "department_id"):
        v = pick(name)
        if v is not None and (not isinstance(v, str) or not v or len(v) > 255):
            raise model.Invalid(name, "invalid")
        out[name] = v or None
    out["doc_type"] = pick("doc_type")
    if kind == "vendor_document":
        if not out["vendor_id"]:
            raise model.Invalid("vendor_id", "required")
        if out["doc_type"] not in model.DOC_TYPES:
            raise model.Invalid("doc_type", "required" if not out["doc_type"] else "unknown")
        if out["site_id"]:
            raise model.Invalid("place", "not_allowed")  # a supplier's document belongs to the supplier, not to a floor
    elif out["doc_type"] is not None:
        raise model.Invalid("doc_type", "not_allowed")
    if "interval" in sent:
        iv = body["interval"]
        if iv is None:
            out["interval_unit"], out["interval_count"] = None, None
        else:
            if not isinstance(iv, dict) or iv.get("unit") not in model.UNITS or isinstance(iv.get("count"), bool) or not isinstance(iv.get("count"), int) \
                    or not 1 <= iv["count"] <= model.INTERVAL_MAX:
                raise model.Invalid("interval", "invalid")
            out["interval_unit"], out["interval_count"] = iv["unit"], iv["count"]
    else:
        out["interval_unit"], out["interval_count"] = cur.get("interval_unit"), cur.get("interval_count")
    if kind in ("preventive", "round") and not out["interval_unit"]:
        raise model.Invalid("interval", "required")
    lead = pick("lead_days")
    if lead is None:
        lead = access.default_lead(conn, kind)  # owner answer 24.10 q13: the default per kind is a setting
    if isinstance(lead, bool) or not isinstance(lead, int) or not 0 <= lead <= model.LEAD_MAX:
        raise model.Invalid("lead_days", "invalid")
    out["lead_days"] = lead
    out["checklist_json"] = json.dumps(model.checklist(body["checklist"]), ensure_ascii=False) if "checklist" in sent else cur.get("checklist_json") or "[]"
    auto = pick("auto_ticket", "auto_ticket")
    out["auto_ticket"] = 1 if auto else 0
    if out["auto_ticket"] and not out["department_id"]:
        raise model.Invalid("department_id", "required")
    if out["department_id"] and (current is None or out["department_id"] != cur.get("department_id")):
        from ..tickets import store as tstore

        if tstore.department(conn, out["department_id"]) is None:
            raise model.Invalid("department_id", "unknown")
    active = pick("active")
    out["active"] = 0 if active is not None and not active else 1
    _references(viewer, {k: out[k] for k in ("entity_id", "elevator_id", "generator_id", "vendor_id", "owner_user_id") if
                         current is None or out[k] != cur.get(k)})
    return out


def _schedule(kind: str, out: dict[str, Any], body: dict[str, Any], current: Any | None, today: date) -> None:
    """anchor_date / due_date. A plan or a round needs its first date (anchor); a certificate or a document carries its valid-until
    date (due_date). A plan whose anchor lies in the past starts at the first occurrence from today."""
    cur = dict(current) if current is not None else {}
    if kind in ("preventive", "round"):
        if "anchor_date" in body or current is None or ("interval" in body):
            anchor = model.parse_date(body.get("anchor_date", cur.get("anchor_date")), "anchor_date")
            if anchor is None:
                raise model.Invalid("anchor_date", "required")
            out["anchor_date"] = anchor.isoformat()
            if "due_date" in body and body["due_date"]:
                out["due_date"] = model.parse_date(body["due_date"], "due_date").isoformat()
            elif current is None or "anchor_date" in body or "interval" in body:
                out["due_date"] = model.next_after(anchor, out["interval_unit"], out["interval_count"], today - timedelta(days=1)).isoformat()
            else:
                out["due_date"] = cur.get("due_date")
        else:
            out["anchor_date"] = cur.get("anchor_date")
            due = model.parse_date(body["due_date"], "due_date") if "due_date" in body else _date(cur.get("due_date"))
            out["due_date"] = model.iso(due)
        return
    due = model.parse_date(body["due_date"], "due_date") if "due_date" in body else _date(cur.get("due_date"))
    if kind == "vendor_document" and due is None:
        raise model.Invalid("due_date", "required")
    out["due_date"] = model.iso(due)
    out["anchor_date"] = out["due_date"] if "due_date" in body else cur.get("anchor_date") or out["due_date"]


# ---------------------------------------------------------------- task writes

def create_task(viewer: Viewer, body: dict[str, Any], rid: str | None) -> dict[str, Any]:
    conn = viewer.conn
    viewer.require_anywhere(MANAGE)
    kind = body.get("kind")
    if kind not in model.KINDS:
        raise invalid(model.Invalid("kind", "unknown"))
    today = _today(viewer)
    try:
        fields = _normalise(viewer, kind, body, None)
        _schedule(kind, fields, body, None, today)
    except model.Invalid as exc:
        raise invalid(exc) from None
    target = access.target_of(fields)
    if not viewer.holds_where(MANAGE, target):
        audit(conn, actor=viewer.principal, action="maintenance.task.create", decision="denied", resource_type=target[0], resource_id=target[1], reason="no_binding",
              request_id=rid, details={"permission": MANAGE})
        raise ApiError(403, "forbidden", "אין הרשאה לנהל משימות אחזקה במקום הזה.", details={"permission": MANAGE})
    if fields["auto_ticket"]:
        _department_gate(viewer, fields["department_id"], rid)
    now = access.now_iso()
    tid = new_id()
    cols = {"id": tid, "kind": kind, **fields, "created_by": viewer.uid, "created_at": now, "updated_at": now}
    conn.execute(f"INSERT INTO maint_tasks({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})", tuple(cols.values()))
    audit(conn, actor=viewer.principal, action="maintenance.task.create", decision="allowed", resource_type="maint_task", resource_id=tid, request_id=rid,
          details={"kind": kind, "category": fields["category"], "target": list(target), "auto_ticket": bool(fields["auto_ticket"])})
    # answered directly: a custom role may hold manage without view (it then cannot read the task back - fail closed - but its own
    # creation is not reported as a failure)
    return task_out(viewer, _row(conn, tid), today, detail=True)


def update_task(viewer: Viewer, task_id: str, body: dict[str, Any], rid: str | None) -> dict[str, Any]:
    conn = viewer.conn
    row = require_task(viewer, task_id)
    viewer.require_on(MANAGE, row, action="maintenance.task.update")
    revision = body.pop("revision", None)
    if revision is not None and revision != row["revision"]:
        raise ApiError(409, "revision_conflict", "המשימה עודכנה בינתיים.", details={"revision": row["revision"]})
    unknown = set(body) - set(EDITABLE)
    if unknown:
        raise invalid(model.Invalid(sorted(unknown)[0], "not_editable"))
    try:
        fields = _normalise(viewer, row["kind"], body, row)
        _schedule(row["kind"], fields, body, row, _today(viewer))
    except model.Invalid as exc:
        raise invalid(exc) from None
    new_target = access.target_of(fields)
    if new_target != access.target_of(row) and not viewer.holds_where(MANAGE, new_target):
        audit(conn, actor=viewer.principal, action="maintenance.task.update", decision="denied", resource_type=new_target[0], resource_id=new_target[1],
              reason="no_binding", request_id=rid, details={"permission": MANAGE, "move": True})
        raise ApiError(403, "forbidden", "אין הרשאה להעביר את המשימה למקום הזה.", details={"permission": MANAGE})
    if fields["auto_ticket"] and (not row["auto_ticket"] or fields["department_id"] != row["department_id"]):
        _department_gate(viewer, fields["department_id"], rid)
    changed = {k: v for k, v in fields.items() if row[k] != v}
    if changed:
        if "due_date" in changed or changed.get("active") == 0:
            from . import reminders

            reminders.resolve_for(conn, task_id, row["due_date"], "rescheduled" if "due_date" in changed else "paused")
        changed["updated_at"] = access.now_iso()
        conn.execute(f"UPDATE maint_tasks SET {', '.join(f'{k} = ?' for k in changed)}, revision = revision + 1 WHERE id = ?", (*changed.values(), task_id))
        audit(conn, actor=viewer.principal, action="maintenance.task.update", decision="allowed", resource_type="maint_task", resource_id=task_id, request_id=rid,
              details={"fields": sorted(k for k in changed if k != "updated_at")})
    return get_task(viewer, task_id)


def delete_task(viewer: Viewer, task_id: str, rid: str | None) -> dict[str, Any]:
    conn = viewer.conn
    row = require_task(viewer, task_id)
    viewer.require_on(MANAGE, row, action="maintenance.task.delete")
    now = access.now_iso()
    from . import reminders

    reminders.resolve_for(conn, task_id, row["due_date"], "deleted")
    conn.execute("UPDATE maint_tasks SET deleted_at = ?, updated_at = ?, revision = revision + 1 WHERE id = ?", (now, now, task_id))
    conn.execute("UPDATE maint_records SET status = 'cancelled', finished_at = ? WHERE task_id = ? AND status = 'open'", (now, task_id))
    tags = conn.execute("UPDATE maint_tags SET revoked_at = ?, revoked_by = ? WHERE target_kind = 'task' AND target_id = ? AND revoked_at IS NULL",
                        (now, viewer.uid, task_id)).rowcount
    audit(conn, actor=viewer.principal, action="maintenance.task.delete", decision="allowed", resource_type="maint_task", resource_id=task_id, request_id=rid,
          details={"tags_revoked": tags})
    return {"id": task_id, "deleted": True, "tags_revoked": tags}


# ---------------------------------------------------------------- completion (ledger, plans, documents)

def complete(viewer: Viewer, task_id: str, body: dict[str, Any], rid: str | None) -> dict[str, Any]:
    conn = viewer.conn
    row = require_task(viewer, task_id)
    kind = row["kind"]
    if kind == "round":
        raise ApiError(409, "use_round_run", "סבב מבוצע דרך התחלת סבב.")
    needed = MANAGE if kind in ("certificate", "vendor_document") else PERFORM
    viewer.require_on(needed, row, action="maintenance.task.complete")
    if body.get("revision") is not None and body["revision"] != row["revision"]:
        raise ApiError(409, "revision_conflict", "המשימה עודכנה בינתיים.", details={"revision": row["revision"]})
    today = _today(viewer)
    try:
        done_on = model.parse_date(body.get("performed_on"), "performed_on") or today
        if done_on > today:
            raise model.Invalid("performed_on", "future")
        note = model.text(body.get("note"), "note", max_len=model.NOTE_MAX, multiline=True)
        due_before = _date(row["due_date"])
        valid_until = None
        if kind in ("certificate", "vendor_document"):
            valid_until = model.parse_date(body.get("valid_until"), "valid_until")
            if valid_until is None:
                if not row["interval_unit"]:
                    raise model.Invalid("valid_until", "required")
                valid_until = model.occurrence(done_on, row["interval_unit"], row["interval_count"], 1)
            if valid_until < done_on:
                raise model.Invalid("valid_until", "before_performed_on")
            due_after = valid_until
        else:
            override = model.parse_date(body.get("next_due"), "next_due")
            if override is not None:
                viewer.require_on(MANAGE, row, action="maintenance.task.complete")
                if override <= done_on:
                    raise model.Invalid("next_due", "not_after_performed_on")
                due_after = override
            else:
                due_after = model.advance(_date(row["anchor_date"]), row["interval_unit"], row["interval_count"], due_before, done_on)
    except model.Invalid as exc:
        raise invalid(exc) from None
    now = access.now_iso()
    rec_id = new_id()
    conn.execute("""INSERT INTO maint_records(id, task_id, kind, status, started_by, started_by_name, started_at, finished_at, performed_on, due_before,
                    due_after, valid_until, note, result) VALUES (?, ?, 'completion', 'done', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ok')""",
                 (rec_id, task_id, viewer.uid, _user_name(conn, viewer.uid), now, now, done_on.isoformat(), model.iso(due_before), model.iso(due_after),
                  model.iso(valid_until), note))
    _advance_task(conn, row, due_after, now)
    audit(conn, actor=viewer.principal, action="maintenance.task.complete", decision="allowed", resource_type="maint_task", resource_id=task_id, request_id=rid,
          details={"record_id": rec_id, "performed_on": done_on.isoformat(), "due_before": model.iso(due_before), "due_after": model.iso(due_after)})
    return {"record": record_out(conn.execute("SELECT * FROM maint_records WHERE id = ?", (rec_id,)).fetchone()), "task": get_task(viewer, task_id)}


def _advance_task(conn: sqlite3.Connection, row: Any, due_after: date | None, now: str) -> None:
    from . import reminders

    reminders.resolve_for(conn, row["id"], row["due_date"], "completed")
    sets: dict[str, Any] = {"due_date": model.iso(due_after), "last_done_at": now, "updated_at": now, "reminded_level": 0, "reminded_due": None}
    if row["kind"] in ("certificate", "vendor_document"):
        sets["anchor_date"] = model.iso(due_after)
    conn.execute(f"UPDATE maint_tasks SET {', '.join(f'{k} = ?' for k in sets)}, revision = revision + 1 WHERE id = ?", (*sets.values(), row["id"]))


# ---------------------------------------------------------------- rounds (runs)

def _run(viewer: Viewer, run_id: str) -> tuple[sqlite3.Row, sqlite3.Row]:
    r = viewer.conn.execute("SELECT * FROM maint_records WHERE id = ? AND kind = 'run'", (run_id,)).fetchone()
    if r is None:
        raise ApiError(404, "maint_run_not_found", "הסבב לא נמצא.")
    task = _row(viewer.conn, r["task_id"])
    if not access.visible(viewer, task):
        raise ApiError(404, "maint_run_not_found", "הסבב לא נמצא.")
    return r, task


def _run_writer(viewer: Viewer, run: Any, task: Any, action: str) -> None:
    """The person who started the run (still holding maintenance.perform there), or a manager of the task."""
    if run["started_by"] == viewer.uid and viewer.holds_on(PERFORM, task):
        return
    viewer.require_on(MANAGE, task, action=action)


def start_run(viewer: Viewer, task_id: str, rid: str | None) -> dict[str, Any]:
    conn = viewer.conn
    task = require_task(viewer, task_id)
    if task["kind"] != "round":
        raise ApiError(409, "not_a_round", "המשימה אינה סבב.")
    viewer.require_on(PERFORM, task, action="maintenance.run.start")
    if not task["active"]:
        raise ApiError(409, "task_inactive", "המשימה מושהית.")
    items = json.loads(task["checklist_json"] or "[]")
    if not items:
        raise ApiError(409, "checklist_empty", "לסבב אין נקודות בדיקה.")
    open_run = conn.execute("SELECT id FROM maint_records WHERE task_id = ? AND status = 'open'", (task_id,)).fetchone()
    if open_run is not None:
        raise ApiError(409, "run_open", "הסבב כבר התחיל.", details={"run_id": open_run["id"]})
    now = access.now_iso()
    run_id = new_id()
    conn.execute("""INSERT INTO maint_records(id, task_id, kind, status, started_by, started_by_name, started_at, due_before, checklist_json)
                    VALUES (?, ?, 'run', 'open', ?, ?, ?, ?, ?)""",
                 (run_id, task_id, viewer.uid, _user_name(conn, viewer.uid), now, task["due_date"], task["checklist_json"]))
    audit(conn, actor=viewer.principal, action="maintenance.run.start", decision="allowed", resource_type="maint_task", resource_id=task_id, request_id=rid,
          details={"run_id": run_id})
    return run_out(viewer, run_id)


def run_out(viewer: Viewer, run_id: str) -> dict[str, Any]:
    run, task = _run(viewer, run_id)
    out = record_out(run)
    out["task"] = {"id": task["id"], "title": task["title"], "entity_id": task["entity_id"], "department_id": task["department_id"]}
    out["can"] = {"write": run["status"] == "open" and (run["started_by"] == viewer.uid and viewer.holds_on(PERFORM, task) or viewer.holds_on(MANAGE, task)),
                  "open_request": tickets_can_create(viewer)}
    out["request_departments"] = _request_departments(viewer) if out["can"]["open_request"] and run["status"] == "open" else []
    return out


def _request_departments(viewer: Viewer) -> list[dict[str, str]]:
    """Slice 2: the departments the person may open a request in from a checkpoint (the tickets module's own rule) - names only."""
    from ..tickets import access as taccess
    from ..tickets import store as tstore

    tv = taccess.Viewer(viewer.conn, viewer.principal)
    try:
        return [{"id": d["id"], "name": d["name"]} for d in tstore.departments(viewer.conn) if tv.can_create_in(d)]
    except Exception:  # noqa: BLE001 - the picker is a convenience; the request route decides again
        return []


def save_answers(viewer: Viewer, run_id: str, body: dict[str, Any], rid: str | None) -> dict[str, Any]:
    conn = viewer.conn
    run, task = _run(viewer, run_id)
    _run_writer(viewer, run, task, "maintenance.run.answer")
    if run["status"] != "open":
        raise ApiError(409, "run_closed", "הסבב הסתיים.")
    if body.get("revision") is not None and body["revision"] != run["revision"]:
        raise ApiError(409, "revision_conflict", "הסבב עודכן בינתיים.", details={"revision": run["revision"]})
    raw = body.get("answers")
    if not isinstance(raw, dict) or len(raw) > model.CHECKLIST_MAX:
        raise invalid(model.Invalid("answers", "invalid"))
    items = {i["key"]: i for i in json.loads(run["checklist_json"] or "[]")}
    answers = json.loads(run["answers_json"] or "{}")
    at = access.now_iso()
    try:
        for key, value in raw.items():
            if key not in items:
                raise model.Invalid(f"answers.{key}", "unknown")
            prior = answers.get(key) or {}
            answers[key] = {**model.answer(items[key], value, at), **({"ticket_id": prior["ticket_id"]} if prior.get("ticket_id") else {})}
    except model.Invalid as exc:
        raise invalid(exc) from None
    conn.execute("UPDATE maint_records SET answers_json = ?, revision = revision + 1 WHERE id = ?", (json.dumps(answers, ensure_ascii=False), run_id))
    return run_out(viewer, run_id)


def finish_run(viewer: Viewer, run_id: str, body: dict[str, Any], rid: str | None) -> dict[str, Any]:
    conn = viewer.conn
    run, task = _run(viewer, run_id)
    _run_writer(viewer, run, task, "maintenance.run.finish")
    if run["status"] != "open":
        raise ApiError(409, "run_closed", "הסבב הסתיים.")
    items = json.loads(run["checklist_json"] or "[]")
    answers = json.loads(run["answers_json"] or "{}")
    missing = model.missing_required(items, answers)
    if missing:
        raise ApiError(409, "run_incomplete", "יש נקודות חובה שלא סומנו.", details={"missing": missing})
    try:
        note = model.text(body.get("note"), "note", max_len=model.NOTE_MAX, multiline=True)
    except model.Invalid as exc:
        raise invalid(exc) from None
    today = _today(viewer)
    now = access.now_iso()
    due_before = _date(task["due_date"])
    due_after = model.advance(_date(task["anchor_date"]), task["interval_unit"], task["interval_count"], due_before, today)
    result = model.result_of(answers)
    conn.execute("""UPDATE maint_records SET status = 'done', finished_at = ?, performed_on = ?, due_after = ?, note = ?, result = ?, revision = revision + 1
                    WHERE id = ?""", (now, today.isoformat(), model.iso(due_after), note, result, run_id))
    _advance_task(conn, task, due_after, now)
    audit(conn, actor=viewer.principal, action="maintenance.run.finish", decision="allowed", resource_type="maint_task", resource_id=task["id"], request_id=rid,
          details={"run_id": run_id, "result": result, "due_after": model.iso(due_after)})
    return run_out(viewer, run_id)


def cancel_run(viewer: Viewer, run_id: str, rid: str | None) -> dict[str, Any]:
    conn = viewer.conn
    run, task = _run(viewer, run_id)
    _run_writer(viewer, run, task, "maintenance.run.cancel")
    if run["status"] != "open":
        raise ApiError(409, "run_closed", "הסבב הסתיים.")
    conn.execute("UPDATE maint_records SET status = 'cancelled', finished_at = ?, revision = revision + 1 WHERE id = ?", (access.now_iso(), run_id))
    audit(conn, actor=viewer.principal, action="maintenance.run.cancel", decision="allowed", resource_type="maint_task", resource_id=task["id"], request_id=rid,
          details={"run_id": run_id})
    return run_out(viewer, run_id)


def request_from_item(viewer: Viewer, run_id: str, key: str, body: dict[str, Any], rid: str | None) -> dict[str, Any]:
    """"Open a request" from a checkpoint: the tickets module's own creation path, AS THE PERSON (tickets.create in the department,
    the device readable). With the tickets module off this does not exist (404 feature_disabled - owner rule 2026-10-20)."""
    from ..tickets import access as taccess
    from ..tickets import create as tcreate

    conn = viewer.conn
    taccess.require_module(conn)
    run, task = _run(viewer, run_id)
    _run_writer(viewer, run, task, "maintenance.run.request")
    items = {i["key"]: i for i in json.loads(run["checklist_json"] or "[]")}
    if key not in items:
        raise ApiError(404, "maint_item_not_found", "נקודת הבדיקה לא נמצאה.")
    answers = json.loads(run["answers_json"] or "{}")
    if (answers.get(key) or {}).get("ticket_id"):
        raise ApiError(409, "request_exists", "כבר נפתחה בקשה מהנקודה הזו.", details={"ticket_id": answers[key]["ticket_id"]})
    department_id = body.get("department_id") or task["department_id"]
    if not isinstance(department_id, str) or not department_id:
        raise invalid(model.Invalid("department_id", "required"))
    try:
        title = model.text(body.get("title") or f"{task['title']}: {items[key]['label']}", "title", max_len=model.TITLE_MAX, required=True)
        description = model.text(body.get("description"), "description", max_len=model.NOTES_MAX, multiline=True)
    except model.Invalid as exc:
        raise invalid(exc) from None
    a = answers.get(key) or {}
    if not description:
        parts = [items[key]["label"]]
        if a.get("value") not in (None, ""):
            parts.append(f"{a['value']}")
        if a.get("note"):
            parts.append(a["note"])
        description = " - ".join(str(p) for p in parts)[: model.NOTES_MAX]
    spec = tcreate.TicketSpec(department_id=department_id, title=title, description=description, entity_id=task["entity_id"],
                              origin="device" if task["entity_id"] else "manual")
    res = tcreate.create_ticket(conn, spec, taccess.Viewer(conn, viewer.principal), rid=rid)
    a = {**a, "ticket_id": res.ticket_id}
    answers[key] = a
    ids = json.loads(run["ticket_ids_json"] or "[]") + [res.ticket_id]
    conn.execute("UPDATE maint_records SET answers_json = ?, ticket_ids_json = ?, revision = revision + 1 WHERE id = ?",
                 (json.dumps(answers, ensure_ascii=False), json.dumps(ids), run_id))
    audit(conn, actor=viewer.principal, action="maintenance.run.request", decision="allowed", resource_type="maint_task", resource_id=task["id"], request_id=rid,
          details={"run_id": run_id, "item": key, "ticket_id": res.ticket_id})
    return {"ticket_id": res.ticket_id, "number": res.number, "run": run_out(viewer, run_id)}


# ---------------------------------------------------------------- the certificate / document file (MAINT215B)

FILE_KINDS = ("certificate", "vendor_document")


def file_out(conn: sqlite3.Connection, r: Any) -> dict[str, Any]:
    return {"id": r["id"], "name": r["name"], "kind": r["kind"], "bytes": r["bytes"], "uploaded_at": r["uploaded_at"], "uploaded_by_name": _user_name(conn, r["uploaded_by"])}


def file_list(conn: sqlite3.Connection, task_id: str) -> list[dict[str, Any]]:
    return [file_out(conn, r) for r in conn.execute("SELECT * FROM maint_files WHERE task_id = ? AND deleted_at IS NULL ORDER BY uploaded_at, id", (task_id,)).fetchall()]


def file_precheck(viewer: Viewer, task_id: str) -> sqlite3.Row:
    """Before any byte is read: the task is visible, is a certificate or a supplier document, the caller manages it, and the file limit
    of the task (Settings) is not reached."""
    row = require_task(viewer, task_id)
    viewer.require_on(MANAGE, row, action="maintenance.file.add")
    if row["kind"] not in FILE_KINDS:
        raise ApiError(409, "files_not_supported", "קבצים נשמרים באישורים ובמסמכי ספקים בלבד.")
    if viewer.conn.execute("SELECT COUNT(*) FROM maint_files WHERE task_id = ? AND deleted_at IS NULL", (task_id,)).fetchone()[0] >= access.file_max_per_task(viewer.conn):
        raise ApiError(409, "too_many_files", "הגעתם למספר הקבצים המרבי למשימה.", details={"max": access.file_max_per_task(viewer.conn)})
    return row


def file_record(viewer: Viewer, task_id: str, stored: Any, name: str, rid: str | None) -> dict[str, Any]:
    from . import files as mfiles

    conn = viewer.conn
    fid = new_id()
    conn.execute("INSERT INTO maint_files(id, task_id, kind, path, name, sha256, bytes, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                 (fid, task_id, stored.kind, stored.rel_path, mfiles.clean_name(name, stored.kind), stored.sha256, stored.bytes, viewer.uid, access.now_iso()))
    conn.execute("UPDATE maint_tasks SET updated_at = ? WHERE id = ?", (access.now_iso(), task_id))
    audit(conn, actor=viewer.principal, action="maintenance.file.add", decision="allowed", resource_type="maint_task", resource_id=task_id, request_id=rid,
          details={"file_id": fid, "kind": stored.kind, "bytes": stored.bytes})  # never the name or the bytes
    return file_out(conn, conn.execute("SELECT * FROM maint_files WHERE id = ?", (fid,)).fetchone())


def file_get(viewer: Viewer, task_id: str, file_id: str) -> sqlite3.Row:
    require_task(viewer, task_id)
    r = viewer.conn.execute("SELECT * FROM maint_files WHERE id = ? AND task_id = ? AND deleted_at IS NULL", (file_id, task_id)).fetchone()
    if r is None:
        raise ApiError(404, "maint_file_not_found", "הקובץ לא נמצא.")
    return r


def file_delete(viewer: Viewer, task_id: str, file_id: str, rid: str | None) -> sqlite3.Row:
    """Soft delete (the row stays for the audit trail); the caller removes the bytes."""
    row = require_task(viewer, task_id)
    viewer.require_on(MANAGE, row, action="maintenance.file.delete")
    r = file_get(viewer, task_id, file_id)
    viewer.conn.execute("UPDATE maint_files SET deleted_at = ? WHERE id = ?", (access.now_iso(), file_id))
    audit(viewer.conn, actor=viewer.principal, action="maintenance.file.delete", decision="allowed", resource_type="maint_task", resource_id=task_id, request_id=rid,
          details={"file_id": file_id})
    return r


# ---------------------------------------------------------------- the reminder log (MAINT215B)

LOG_MAX = 300
LOG_EVENTS = ("due_soon", "overdue", "request", "request_failed")


def reminder_log(viewer: Viewer, event: str | None = None, task_id: str | None = None, limit: int = 100) -> dict[str, Any]:
    """What the worker sent: newest first, each line a task title, a kind, an event and a date. A line of a task the caller may not see
    is left out (a deleted task's line: managers only)."""
    viewer.require_anywhere(VIEW)
    conn = viewer.conn
    where: list[str] = []
    args: list[Any] = []
    if event:
        if event not in LOG_EVENTS:
            raise invalid(model.Invalid("event", "unknown"))
        where.append("event = ?")
        args.append(event)
    if task_id:
        where.append("task_id = ?")
        args.append(task_id)
    limit = max(1, min(int(limit), LOG_MAX))
    clause = ("WHERE " + " AND ".join(where)) if where else ""
    rows = conn.execute(f"SELECT * FROM maint_reminder_log {clause} ORDER BY at DESC, id DESC LIMIT ?", (*args, limit * 3)).fetchall()
    items: list[dict[str, Any]] = []
    cache: dict[str, bool] = {}
    for r in rows:
        ok = cache.get(r["task_id"])
        if ok is None:
            t = _row(conn, r["task_id"])
            ok = access.visible(viewer, t) if t is not None and not t["deleted_at"] else MANAGE in viewer.anywhere
            cache[r["task_id"]] = ok
        if ok:
            items.append({"id": r["id"], "task_id": r["task_id"], "title": r["title"], "task_kind": r["task_kind"], "event": r["event"], "due_date": r["due_date"],
                          "detail": r["detail"], "at": r["at"]})
        if len(items) >= limit:
            break
    return {"items": items, "reminders_enabled": access.reminders_enabled(conn), "keep_days": access.log_keep_days(conn)}


# ---------------------------------------------------------------- the elevator / generator / device / supplier cards

SUBJECT_COLUMNS = {"elevator": "elevator_id", "generator": "generator_id", "entity": "entity_id", "vendor": "vendor_id"}


def by_subject(viewer: Viewer, kind: str, subject_id: str) -> dict[str, Any]:
    """The visible tasks linked to an elevator, a generator, a device or a supplier, nearest due first - the "inspection valid
    until ..." row of those cards. An unknown subject (or a device the caller may not read) is a 404."""
    conn = viewer.conn
    viewer.require_anywhere(VIEW)
    if kind not in SUBJECT_COLUMNS:
        raise ApiError(404, "not_found", "לא נמצא.")
    if kind == "elevator":
        ok = conn.execute("SELECT 1 FROM infra_elevators WHERE id = ?", (subject_id,)).fetchone() is not None
    elif kind == "generator":
        ok = conn.execute("SELECT 1 FROM generator_devices WHERE id = ? AND status <> 'removed'", (subject_id,)).fetchone() is not None
    elif kind == "vendor":
        ok = conn.execute("SELECT 1 FROM ticket_contacts WHERE id = ? AND kind = 'vendor' AND erased_at IS NULL", (subject_id,)).fetchone() is not None
    else:
        from ..tickets import device_context

        ok = device_context.readable_entity(conn, viewer.principal, subject_id) is not None
    if not ok:
        raise ApiError(404, "not_found", "לא נמצא.")
    today = _today(viewer)
    rows = conn.execute(f"SELECT * FROM maint_tasks WHERE {SUBJECT_COLUMNS[kind]} = ? AND deleted_at IS NULL AND active = 1 ORDER BY due_date IS NULL, due_date, id",
                        (subject_id,)).fetchall()
    items = [task_out(viewer, r, today) for r in rows if access.visible(viewer, r)]
    worst = next((s for s in ("overdue", "due_soon", "ok") if any(i["state"] == s for i in items)), "none")
    return {"kind": kind, "id": subject_id, "state": worst, "items": items}


def vendor_status(conn: sqlite3.Connection, vendor_ids: list[str], today: date) -> dict[str, dict[str, Any]]:
    """For the tickets assignee picker (slice 2): per supplier, whether a document of it is expired / expiring - the document
    types and dates only, never a file or a value. No permission check here: the caller decides who sees the mark."""
    out: dict[str, dict[str, Any]] = {}
    ids = [v for v in dict.fromkeys(vendor_ids) if v]
    if not ids or (conn.execute("SELECT value FROM settings WHERE key = ?", (access.FEATURE_KEY,)).fetchone() or ["false"])[0] != "true":
        return out
    marks = ",".join("?" * len(ids))
    for r in conn.execute(f"""SELECT * FROM maint_tasks WHERE kind = 'vendor_document' AND deleted_at IS NULL AND active = 1 AND vendor_id IN ({marks})""",
                          ids).fetchall():
        st = model.due_state(_date(r["due_date"]), r["lead_days"], today)
        slot = out.setdefault(r["vendor_id"], {"state": "ok", "expired": [], "expiring": []})
        if st.state == "overdue":
            slot["expired"].append({"doc_type": r["doc_type"], "valid_until": r["due_date"]})
        elif st.state == "due_soon":
            slot["expiring"].append({"doc_type": r["doc_type"], "valid_until": r["due_date"]})
    for slot in out.values():
        slot["state"] = "expired" if slot["expired"] else "expiring" if slot["expiring"] else "ok"
    return out


def insurance_marks(conn: sqlite3.Connection, vendor_ids: list[str], today: date) -> dict[str, dict[str, Any]]:
    """For the tickets assignee picker (owner review 24.10, MARKING ONLY - nothing is blocked or confirmed): per supplier the state of
    its liability insurance: `expired` (every insurance document of it has passed its date), `expiring` (the valid one ends within
    `maintenance.vendor_insurance_warn_days`), `missing` (no insurance document at all - only while `maintenance.vendor_missing_insurance_mark`
    is on) or `ok`. Document type and date only, never a file. Empty while the module is off. No permission check: the caller (the
    assign dialog, a manager) decides who sees the mark."""
    out: dict[str, dict[str, Any]] = {}
    ids = [v for v in dict.fromkeys(vendor_ids) if v]
    if not ids or not access.module_on(conn):
        return out
    warn = access.insurance_warn_days(conn)
    miss = access.missing_insurance_mark(conn)
    marks = ",".join("?" * len(ids))
    best: dict[str, date] = {}
    for r in conn.execute(f"""SELECT vendor_id, due_date FROM maint_tasks WHERE kind = 'vendor_document' AND doc_type = 'insurance' AND deleted_at IS NULL
                              AND active = 1 AND due_date IS NOT NULL AND vendor_id IN ({marks})""", ids).fetchall():
        d = _date(r["due_date"])
        if d is not None and (r["vendor_id"] not in best or d > best[r["vendor_id"]]):
            best[r["vendor_id"]] = d
    for vid in ids:
        d = best.get(vid)
        if d is None:
            if miss:
                out[vid] = {"state": "missing", "valid_until": None}
        elif d < today:
            out[vid] = {"state": "expired", "valid_until": d.isoformat()}
        elif (d - today).days <= warn:
            out[vid] = {"state": "expiring", "valid_until": d.isoformat()}
        else:
            out[vid] = {"state": "ok", "valid_until": d.isoformat()}
    return out


def vendor_documents(viewer: Viewer, vendor_id: str) -> dict[str, Any]:
    """A supplier's card: its documents (placeless tasks - maintenance.view at any scope, owner answer 24.10 q15) and the other
    tasks it is the supplier of that the caller may see."""
    viewer.require_anywhere(VIEW)
    out = by_subject(viewer, "vendor", vendor_id)
    docs = [i for i in out["items"] if i["kind"] == "vendor_document"]
    status = vendor_status(viewer.conn, [vendor_id], _today(viewer)).get(vendor_id, {"state": "none" if not docs else "ok"})
    r = viewer.conn.execute("SELECT display_name FROM ticket_contacts WHERE id = ?", (vendor_id,)).fetchone()
    return {"vendor_id": vendor_id, "name": r["display_name"] if r else "", "state": status["state"], "documents": docs,
            "tasks": [i for i in out["items"] if i["kind"] != "vendor_document"]}


def vendors(viewer: Viewer) -> dict[str, Any]:
    """Slice 2: the suppliers (the tickets module's directory, kind vendor) with the state of their documents - the supplier picker
    of the task form and the "insurance expired" mark (owner answer 24.10 q17). Names and document states only."""
    viewer.require_anywhere(VIEW)
    rows = viewer.conn.execute("SELECT id, display_name FROM ticket_contacts WHERE kind = 'vendor' AND erased_at IS NULL ORDER BY display_name, id LIMIT 1000").fetchall()
    status = vendor_status(viewer.conn, [r["id"] for r in rows], _today(viewer))
    return {"items": [{"id": r["id"], "name": r["display_name"] or "", **status.get(r["id"], {"state": "none", "expired": [], "expiring": []})} for r in rows]}


def options(viewer: Viewer) -> dict[str, Any]:
    """Slice 2: what the task form offers a manager - the places where the caller may manage, the suppliers, the active
    departments (for requests on schedule), the active people (the responsible person) and the installation's defaults."""
    viewer.require_anywhere(MANAGE)
    conn = viewer.conn
    places: list[dict[str, Any]] = []
    for s in conn.execute("SELECT id, name FROM sites WHERE deleted_at IS NULL ORDER BY name, id").fetchall():
        if viewer.holds(MANAGE, ("site", s["id"])):
            places.append({"kind": "site", "id": s["id"], "name": s["name"] or "", "parent_id": None})
    for b in conn.execute("SELECT id, name, site_id FROM buildings WHERE deleted_at IS NULL ORDER BY name, id").fetchall():
        if viewer.holds(MANAGE, ("building", b["id"])):
            places.append({"kind": "building", "id": b["id"], "name": b["name"] or "", "parent_id": b["site_id"]})
    for f in conn.execute("SELECT id, name, building_id FROM floors WHERE deleted_at IS NULL ORDER BY building_id, name, id").fetchall():
        if viewer.holds(MANAGE, ("floor", f["id"])):
            places.append({"kind": "floor", "id": f["id"], "name": f["name"] or "", "parent_id": f["building_id"]})
    depts = []
    try:
        depts = [{"id": d["id"], "name": d["name"]} for d in conn.execute("SELECT id, name FROM ticket_departments WHERE active = 1 AND deleted_at IS NULL ORDER BY name, id").fetchall()]
    except sqlite3.Error:
        depts = []
    people = [{"id": u["id"], "name": u["display_name"] or u["username"] or ""} for u in conn.execute(
        "SELECT id, display_name, username FROM users WHERE active = 1 ORDER BY COALESCE(display_name, username), id LIMIT 1000").fetchall()]
    # MAINT215B: what a certificate / plan can be attached to - the elevators and generators of the infrastructure screens
    try:
        elevators = [{"id": e["id"], "name": e["name"]} for e in conn.execute("SELECT id, name FROM infra_elevators ORDER BY sort_order, name, id LIMIT 200").fetchall()]
        generators = [{"id": g["id"], "name": g["name"]} for g in conn.execute("SELECT id, name FROM generator_devices WHERE status <> 'removed' ORDER BY name, id LIMIT 200").fetchall()]
    except sqlite3.Error:
        elevators, generators = [], []
    return {"places": places, "elevators": elevators, "generators": generators, "placeless": MANAGE in viewer.anywhere, "vendors": vendors(viewer)["items"] if VIEW in viewer.anywhere else [],
            "departments": depts, "people": people, "categories": list(model.CATEGORIES), "doc_types": list(model.DOC_TYPES),
            "defaults": access.defaults(conn), "tickets_on": _tickets_on(conn)}


def _tickets_on(conn: sqlite3.Connection) -> bool:
    from ..tickets import access as taccess

    return taccess.module_on(conn)


# ---------------------------------------------------------------- a request opened by a plan, closed in the tickets module

def _plan_of_request(conn: sqlite3.Connection, ticket_id: str) -> sqlite3.Row | None:
    """The task whose CURRENT request this is and which a closed request may mark done: a request of an older cycle, a paused or
    deleted task, a round (walked, never completed this way) and a certificate / document without an interval (its new date needs a
    person) change nothing."""
    row = conn.execute("SELECT * FROM maint_tasks WHERE ticket_id = ? AND deleted_at IS NULL", (ticket_id,)).fetchone()
    if row is None or row["kind"] == "round" or not row["active"] or row["ticket_due"] != row["due_date"] or not row["due_date"]:
        return None
    if row["kind"] in ("certificate", "vendor_document") and not row["interval_unit"]:
        return None
    return row


def _mark_done_from_request(conn: sqlite3.Connection, row: Any, ticket_id: str, performer_uid: str, now: str, via: str, actor: Any = None) -> str:
    today = access.today(conn)
    due_before = _date(row["due_date"])
    if row["kind"] == "preventive":
        due_after = model.advance(_date(row["anchor_date"]), row["interval_unit"], row["interval_count"], due_before, today)
        valid_until = None
    else:
        valid_until = model.occurrence(today, row["interval_unit"], row["interval_count"], 1)
        due_after = valid_until
    rec_id = new_id()
    conn.execute("SAVEPOINT maint_close")
    try:
        conn.execute("""INSERT INTO maint_records(id, task_id, kind, status, started_by, started_by_name, started_at, finished_at, performed_on, due_before,
                        due_after, valid_until, note, result, ticket_ids_json) VALUES (?, ?, 'completion', 'done', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ok', ?)""",
                     (rec_id, row["id"], performer_uid, _user_name(conn, performer_uid), now, now, today.isoformat(), model.iso(due_before), model.iso(due_after),
                      model.iso(valid_until), "נסגר דרך בקשת השירות", json.dumps([ticket_id])))
        _advance_task(conn, row, due_after, now)
    except Exception:
        conn.execute("ROLLBACK TO maint_close")
        conn.execute("RELEASE maint_close")
        raise
    conn.execute("RELEASE maint_close")
    audit(conn, actor=actor, action="maintenance.task.complete", decision="allowed", resource_type="maint_task", resource_id=row["id"],
          details={"record_id": rec_id, "via": via, "ticket_id": ticket_id, "performer": performer_uid, "due_before": model.iso(due_before),
                   "due_after": model.iso(due_after)})
    return rec_id


def on_ticket_closed(conn: sqlite3.Connection, ticket: Any, closer_uid: str, now: str) -> str | None:
    """Closing the service request a plan opened. Owner review 24.10: by default the closer is ASKED whether to mark the plan done
    (`close_proposal` / `confirm_close`, setting `maintenance.close_request_mode` = ask); `auto` marks it at once, the closer as the
    performer (the 24.10 q19 behaviour); `off` leaves the plan alone. This hook acts only in `auto`. Only while the module is on.
    Never raises into the close."""
    try:
        if not access.module_on(conn) or access.close_mode(conn) != "auto":
            return None
        row = _plan_of_request(conn, ticket["id"])
        if row is None:
            return None
        return _mark_done_from_request(conn, row, ticket["id"], closer_uid, now, "ticket_closed")
    except Exception:  # noqa: BLE001 - the close of a request never fails because of the maintenance module
        import logging

        logging.getLogger(__name__).warning("maintenance: could not mark a plan done from a closed request", exc_info=True)
        return None


def close_proposal(viewer: Viewer, ticket_id: str) -> dict[str, Any]:
    """After a request is closed: does it belong to a plan the caller may mark done, and is the installation set to ASK? Answers
    `{proposal: null}` for everything else (no hint about a task the caller may not see). Asking, never changing."""
    conn = viewer.conn
    none = {"proposal": None}
    if access.close_mode(conn) != "ask":
        return none
    t = conn.execute("SELECT id, status FROM tickets WHERE id = ?", (ticket_id,)).fetchone()
    if t is None or t["status"] != "closed":
        return none
    row = _plan_of_request(conn, ticket_id)
    if row is None or not access.visible(viewer, row):
        return none
    needed = MANAGE if row["kind"] in ("certificate", "vendor_document") else PERFORM
    if not viewer.holds_on(needed, row):
        return none
    due = _date(row["due_date"])
    today = access.today(conn)
    if row["kind"] == "preventive":
        nxt = model.advance(_date(row["anchor_date"]), row["interval_unit"], row["interval_count"], due, today)
    else:
        nxt = model.occurrence(today, row["interval_unit"], row["interval_count"], 1)
    return {"proposal": {"task_id": row["id"], "title": row["title"], "kind": row["kind"], "due_date": row["due_date"], "next_due": model.iso(nxt)}}


def confirm_close(viewer: Viewer, ticket_id: str, rid: str | None) -> dict[str, Any]:
    """The closer said yes: the plan is marked done for its due date with THIS person as the performer."""
    conn = viewer.conn
    prop = close_proposal(viewer, ticket_id)["proposal"]
    if prop is None:
        raise ApiError(409, "nothing_to_confirm", "אין תוכנית שממתינה לסימון.")
    row = _row(conn, prop["task_id"])
    rec = _mark_done_from_request(conn, row, ticket_id, viewer.uid, access.now_iso(), "ticket_closed_confirmed", viewer.principal)
    return {"record_id": rec, "task": get_task(viewer, prop["task_id"])}


# ---------------------------------------------------------------- QR / NFC tags

TAG_KINDS = ("task", "entity")


def _tag_target_ok(viewer: Viewer, kind: str, target_id: str, permission: str) -> bool:
    """A task tag: the task visible and `permission` on its target. A device tag: the device readable and `permission` at the
    installation (a device has no maintenance place of its own)."""
    if kind == "task":
        row = _row(viewer.conn, target_id)
        return access.visible(viewer, row) and viewer.holds_on(permission, row)
    from ..tickets import device_context

    return device_context.readable_entity(viewer.conn, viewer.principal, target_id) is not None and viewer.holds(permission, INSTALLATION)


def _target_name(conn: sqlite3.Connection, kind: str, target_id: str) -> tuple[str, str | None]:
    """A tag's target for the list: the task's title and kind, or the device's name."""
    if kind == "task":
        r = _row(conn, target_id)
        return ((r["title"] if r else ""), (r["kind"] if r else None))
    r = conn.execute("SELECT name, original_name FROM ha_entities WHERE entity_id = ?", (target_id,)).fetchone()
    return (((r["name"] or r["original_name"]) if r else "") or target_id, None)


def tag_out(r: Any, conn: sqlite3.Connection | None = None) -> dict[str, Any]:
    out = {"id": r["id"], "token": r["token"], "path": f"#/m/{r['token']}", "target_kind": r["target_kind"], "target_id": r["target_id"],
           "label": r["label"], "medium": r["medium"], "created_at": r["created_at"], "revoked_at": r["revoked_at"], "last_scan_at": r["last_scan_at"]}
    if conn is not None:
        out["target_name"], out["target_task_kind"] = _target_name(conn, r["target_kind"], r["target_id"])
    return out


def create_tag(viewer: Viewer, body: dict[str, Any], rid: str | None) -> dict[str, Any]:
    conn = viewer.conn
    viewer.require_anywhere(MANAGE)
    kind, target_id = body.get("target_kind"), body.get("target_id")
    if kind not in TAG_KINDS or not isinstance(target_id, str) or not target_id or len(target_id) > 255:
        raise invalid(model.Invalid("target", "invalid"))
    try:
        label = model.text(body.get("label"), "label", max_len=model.LABEL_MAX)
    except model.Invalid as exc:
        raise invalid(exc) from None
    if kind == "task" and not access.visible(viewer, _row(conn, target_id)):
        raise invalid(model.Invalid("target", "unknown"))
    if not _tag_target_ok(viewer, kind, target_id, MANAGE):
        if kind == "entity":
            raise invalid(model.Invalid("target", "unknown"))  # an unreadable device is unknown, never forbidden
        viewer.require_on(MANAGE, _row(conn, target_id), action="maintenance.tag.create")
    if conn.execute("SELECT COUNT(*) FROM maint_tags WHERE revoked_at IS NULL").fetchone()[0] >= TAGS_MAX:
        raise ApiError(409, "too_many_tags", "הגעתם למספר התגיות המרבי.")
    medium = body.get("medium") or "qr"
    if medium not in ("qr", "nfc"):
        raise invalid(model.Invalid("medium", "unknown"))
    tag_id, token, now = new_id(), secrets.token_urlsafe(16), access.now_iso()
    conn.execute("INSERT INTO maint_tags(id, token, target_kind, target_id, label, medium, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                 (tag_id, token, kind, target_id, label, medium, viewer.uid, now))
    audit(conn, actor=viewer.principal, action="maintenance.tag.create", decision="allowed", resource_type="maint_tag", resource_id=tag_id, request_id=rid,
          details={"target_kind": kind, "target_id": target_id, "medium": medium})  # never the token
    return tag_out(conn.execute("SELECT * FROM maint_tags WHERE id = ?", (tag_id,)).fetchone(), conn)


def list_tags(viewer: Viewer, include_revoked: bool = False) -> dict[str, Any]:
    viewer.require_anywhere(MANAGE)
    sql = "SELECT * FROM maint_tags" + ("" if include_revoked else " WHERE revoked_at IS NULL") + " ORDER BY created_at DESC, id LIMIT ?"
    items = [tag_out(r, viewer.conn) for r in viewer.conn.execute(sql, (TAGS_MAX,)).fetchall() if _tag_target_ok(viewer, r["target_kind"], r["target_id"], MANAGE)]
    return {"items": items, "base_url": access.tag_base(viewer.conn)}


def revoke_tag(viewer: Viewer, tag_id: str, rid: str | None) -> dict[str, Any]:
    conn = viewer.conn
    viewer.require_anywhere(MANAGE)
    r = conn.execute("SELECT * FROM maint_tags WHERE id = ?", (tag_id,)).fetchone()
    if r is None or not _tag_target_ok(viewer, r["target_kind"], r["target_id"], MANAGE):
        raise ApiError(404, "maint_tag_not_found", "התגית לא נמצאה.")
    if r["revoked_at"] is None:
        conn.execute("UPDATE maint_tags SET revoked_at = ?, revoked_by = ? WHERE id = ?", (access.now_iso(), viewer.uid, tag_id))
        audit(conn, actor=viewer.principal, action="maintenance.tag.revoke", decision="allowed", resource_type="maint_tag", resource_id=tag_id, request_id=rid)
    return tag_out(conn.execute("SELECT * FROM maint_tags WHERE id = ?", (tag_id,)).fetchone(), conn)


def scan(viewer: Viewer, token: str) -> dict[str, Any]:
    """A scanned sticker: what it opens for THIS person. Unknown, revoked or not visible to the caller - the same 404."""
    conn = viewer.conn
    viewer.require_anywhere(VIEW)
    gone = ApiError(404, "maint_tag_not_found", "התגית לא נמצאה.")
    r = conn.execute("SELECT * FROM maint_tags WHERE token = ?", (token,)).fetchone()
    if r is None or r["revoked_at"] is not None or not _tag_target_ok(viewer, r["target_kind"], r["target_id"], VIEW):
        raise gone
    if not _read_only(conn):  # slice 2: "last scanned" for the tags list (a time only - never who, never where)
        conn.execute("UPDATE maint_tags SET last_scan_at = ? WHERE id = ?", (access.now_iso(), r["id"]))
    today = _today(viewer)
    if r["target_kind"] == "task":
        task = _row(conn, r["target_id"])
        return {"kind": "task", "label": r["label"], "task": task_out(viewer, task, today, detail=True), "route": task_route(task["id"])}
    entity = r["target_id"]
    linked = by_subject(viewer, "entity", entity)
    out: dict[str, Any] = {"kind": "entity", "label": r["label"], "entity_id": entity, "route": f"#/devices?entity={entity}", "tasks": linked["items"],
                           "open_requests": None, "can": {"open_request": tickets_can_create(viewer)}}
    from ..tickets import access as taccess

    if taccess.module_on(conn) and taccess.VIEW in viewer.anywhere:
        tv = taccess.Viewer(conn, viewer.principal)
        reg = conn.execute("SELECT registry_id FROM ha_entities WHERE entity_id = ?", (entity,)).fetchone()
        seen = taccess.visible_for_entity(tv, entity, reg["registry_id"] if reg else None)
        out["open_requests"] = sum(1 for s in seen if s.row["status"] not in ("closed", "cancelled", "done"))
    return out
