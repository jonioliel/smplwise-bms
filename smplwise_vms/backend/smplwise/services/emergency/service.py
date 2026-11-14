"""CR-EMERG104: the readiness payload (with the per-row redaction of CR section 5), the stored configuration (slot bindings, thresholds, emergency
cameras, not-applicable marks), the dedicated emergency contact list (owner q203 b) and the history (owner q207 c / q284). The view itself is read
only: nothing here operates a door, a generator, an elevator, a fire panel or a relay."""
from __future__ import annotations

import json
import re
import sqlite3
from typing import Any

from ...audit import audit
from ...config import Settings
from ...db import get_setting, new_id, set_setting
from ...errors import ApiError
from ..maintenance import access as maccess
from . import access, engine, model
from .access import Viewer

TITLES = {
    "E01": "בדיקת גנרטור אחרונה", "E02": "דלק ומצב הגנרטור", "E02b": "רשת או גנרטור (מידע)", "E03": "תעודת בטיחות אש", "E04": "בדיקת מטפים",
    "E05": "ברזי כיבוי וממטרות", "E06": "תאורת חירום ושלטי יציאה", "E07": "סבב פינוי", "E08": "קריאות שירות פתוחות בנושא אש", "E09": "בדיקת מעליות (פיקוד כבאים)",
    "E10": "ניטור מעליות", "E11": "בקרות חירום בדלתות", "E12": "תקלות דלת ואירוע חירום פתוח", "E13": "אנשי קשר לחירום", "E14": "ספקי שירות",
    "E15": "מסירת התראות", "E16": "גיבוי", "E17": "מקליטים והקלטה", "E18": "מצלמות מחוברות", "E19": "שעון ומסמכי זמן",
}
GROUP_TITLES = {"power": "חשמל", "fire": "בטיחות אש וביקורות", "elevators": "מעליות", "doors": "דלתות", "people": "אנשים", "records": "מסירה ורשומות", "cameras": "מצלמות והקלטה"}
REDACTED_TEXT = "פריט שאין לך הרשאה לראות - משפיע על התוצאה"
NA_NOTE_MAX = 200


def _jload(conn: sqlite3.Connection, key: str, default: Any) -> Any:
    return engine._json_setting(conn, key, default)


def _jsave(conn: sqlite3.Connection, key: str, value: Any) -> None:
    set_setting(conn, key, json.dumps(value, ensure_ascii=False, sort_keys=True))


def config_revision(conn: sqlite3.Connection) -> int:
    try:
        return int(get_setting(conn, access.CONFIG_REVISION_KEY, "1") or "1")
    except ValueError:
        return 1


# ---------------------------------------------------------------- the truth (every item, no redaction) and the page

def compute(conn: sqlite3.Connection, settings: Settings | None) -> tuple[engine.Ctx, list[dict[str, Any]]]:
    ctx = engine.Ctx(conn, settings)
    raw = engine.run_all(ctx)
    na = _jload(conn, access.SLOTS_NOTE, {})
    rows: list[dict[str, Any]] = []
    for item_id, (group, crit) in model.ITEMS.items():
        r = dict(raw[item_id])
        r.update(id=item_id, group=group, title=TITLES[item_id])
        r.setdefault("critical", crit)
        if isinstance(na, dict) and isinstance(na.get(item_id), dict) and r["status"] != "not_applicable":
            r["status_measured"] = r["status"]
            r["status"] = "not_applicable"
            r["na"] = na[item_id]
            r["summary"] = "לא רלוונטי למבנה"
        rows.append(r)
    return ctx, rows


def _shape(r: dict[str, Any], viewer: Viewer) -> dict[str, Any]:
    if not viewer.can_row(r["id"]):
        return {"id": r["id"], "group": r["group"], "critical": r["critical"], "title": r["title"], "status": "hidden", "summary": REDACTED_TEXT, "facts": [], "source": None,
                "next": None, "age_s": None, "fresh": None, "redacted": True}
    out = {"id": r["id"], "group": r["group"], "critical": r["critical"], "title": r["title"], "status": r["status"], "summary": r["summary"], "code": r.get("code", ""),
           "facts": r["facts"], "source": {"href": r.get("href")}, "next": {"href": r.get("href")}, "age_s": r.get("age_s"), "fresh": r["status"] != "unknown", "redacted": False,
           "files": r.get("files", [])}
    if "na" in r:
        out["na"] = r["na"]
    return out


def page(conn: sqlite3.Connection, settings: Settings | None, viewer: Viewer) -> dict[str, Any]:
    ctx, rows = compute(conn, settings)
    c = model.counts(rows)
    hidden = sum(1 for r in rows if not viewer.can_row(r["id"]))
    items = [_shape(r, viewer) for r in rows]
    return {"verdict": model.verdict(rows), "counts": {**c, "hidden": hidden}, "items": items, "banners": engine.banners(ctx), "checked_at": ctx.now_iso,
            "thresholds_version": model.THRESHOLDS_VERSION, "groups": [{"id": g, "title": GROUP_TITLES[g]} for g in model.GROUPS],
            "can": {"manage": viewer.can_manage()}, "disclaimer": "הדף משקף נתונים שנאספו במערכת, אינו אישור ציות רגולטורי."}


def item(conn: sqlite3.Connection, settings: Settings | None, viewer: Viewer, item_id: str) -> dict[str, Any]:
    if item_id not in model.ITEMS:
        raise ApiError(404, "emergency_item_not_found", "הפריט לא נמצא.")
    _ctx, rows = compute(conn, settings)
    return _shape(next(r for r in rows if r["id"] == item_id), viewer)


# ---------------------------------------------------------------- configuration

BIND_RULES: dict[str, dict[str, Any]] = {
    "fire_certificate": {"kinds": ("certificate",), "cats": ("fire",)},
    "extinguishers": {"kinds": ("certificate", "preventive"), "cats": ("fire",)},
    "hydrants_sprinklers": {"kinds": ("certificate", "preventive"), "cats": ("fire", "water")},
    "emergency_lighting": {"kinds": ("certificate", "preventive"), "cats": ("electrical", "safety")},
    "evacuation_round": {"kinds": ("round",), "cats": ("fire", "safety", "other")},
    "elevator_inspection": {"kinds": ("certificate",), "cats": ("elevator",)},
}


def _task_view(t: sqlite3.Row) -> dict[str, Any]:
    return {"id": t["id"], "title": t["title"], "kind": t["kind"], "category": t["category"], "due_date": t["due_date"], "elevator_id": t["elevator_id"]}


def get_config(conn: sqlite3.Connection, settings: Settings | None, viewer: Viewer) -> dict[str, Any]:
    mviewer = maccess.Viewer(conn, viewer.principal)
    tasks = [t for t in conn.execute("SELECT * FROM maint_tasks WHERE deleted_at IS NULL AND active = 1 ORDER BY title").fetchall() if maccess.visible(mviewer, t)] if maccess.module_on(conn) else []
    bound = {s: [_task_view(t) for t in tasks if t["emergency_slot"] == s] for s in model.SLOTS}
    suggestions: dict[str, list[dict[str, Any]]] = {}
    for s in model.SLOTS:
        rule = BIND_RULES[s]
        suggestions[s] = [_task_view(t) for t in tasks if not t["emergency_slot"] and t["kind"] in rule["kinds"] and t["category"] in rule["cats"]
                          and (s != "elevator_inspection" or t["elevator_id"])][:20]
    stored = _jload(conn, access.THRESHOLDS_KEY, {})
    eff = model.merged_thresholds(stored)
    cams = conn.execute("SELECT c.id, c.alias, c.name_source, c.channel, r.name AS rec FROM cameras c JOIN recorders r ON r.id = c.recorder_id WHERE c.enabled = 1 ORDER BY r.name, c.channel").fetchall()
    return {"revision": config_revision(conn), "slots": bound, "suggestions": suggestions, "not_applicable": _jload(conn, access.SLOTS_NOTE, {}),
            "thresholds": {"effective": eff, "defaults": model.default_thresholds(), "overrides": stored if isinstance(stored, dict) else {},
                           "ranges": {k: [v[1], v[2]] for k, v in model.THRESHOLDS.items()}},
            "cameras": {"selected": engine.emergency_camera_ids(conn), "choices": [{"id": c["id"], "name": c["alias"] or c["name_source"] or f"ערוץ {c['channel']}", "recorder": c["rec"]} for c in cams]},
            "history_keep_days": int(eff["history_keep_days"])}


def put_config(conn: sqlite3.Connection, settings: Settings | None, viewer: Viewer, body: dict[str, Any], request_id: str | None) -> dict[str, Any]:
    viewer.require_manage()
    if "revision" in body and body["revision"] != config_revision(conn):
        raise ApiError(409, "revision_conflict", "ההגדרות שונו בינתיים. טענו מחדש ונסו שוב.", details={"revision": config_revision(conn)})
    changed: list[str] = []
    try:
        if body.get("thresholds") is not None:
            patch = body["thresholds"]
            if not isinstance(patch, dict):
                raise model.Invalid("thresholds", "type")
            resets = [k for k, v in patch.items() if v is None]
            clean = model.validate_thresholds({k: v for k, v in patch.items() if v is not None})
            for k in resets:
                if k not in model.THRESHOLDS:
                    raise model.Invalid(f"thresholds.{k}", "unknown")
            cur = _jload(conn, access.THRESHOLDS_KEY, {})
            cur = dict(cur) if isinstance(cur, dict) else {}
            for k in resets:
                cur.pop(k, None)
            cur.update(clean)
            model.check_order(model.merged_thresholds({**cur}) if False else {**model.default_thresholds(), **{k: v for k, v in cur.items() if k in model.THRESHOLDS}})
            _jsave(conn, access.THRESHOLDS_KEY, cur)
            changed.append("thresholds")
        if body.get("cameras") is not None:
            ids = body["cameras"]
            if not isinstance(ids, list) or len(ids) > 200 or any(not isinstance(i, str) or len(i) > 128 for i in ids):
                raise model.Invalid("cameras", "type")
            known = {r["id"] for r in conn.execute("SELECT id FROM cameras").fetchall()}
            if any(i not in known for i in ids):
                raise ApiError(404, "camera_not_found", "מצלמה לא נמצאה.")
            _jsave(conn, access.CAMERAS_KEY, sorted(set(ids)))
            changed.append("cameras")
        if body.get("bindings") is not None:
            _bind(conn, viewer, body["bindings"])
            changed.append("bindings")
        if body.get("not_applicable") is not None:
            _set_na(conn, viewer, body["not_applicable"], request_id)
            changed.append("not_applicable")
    except model.Invalid as exc:
        raise ApiError(422, "validation", "ערך לא תקין.", details={"fields": [exc.field], "code": exc.code}) from exc
    if changed:
        set_setting(conn, access.CONFIG_REVISION_KEY, str(config_revision(conn) + 1))
        audit(conn, actor=viewer.principal, action="emergency_readiness.config.update", decision="allowed", resource_type="installation", resource_id="emergency_readiness",
              request_id=request_id, details={"changed": changed})
    return get_config(conn, settings, viewer)


def _bind(conn: sqlite3.Connection, viewer: Viewer, raw: Any) -> None:
    if not isinstance(raw, dict) or len(raw) > 100:
        raise model.Invalid("bindings", "type")
    mviewer = maccess.Viewer(conn, viewer.principal)
    for task_id, slot in raw.items():
        if not isinstance(task_id, str) or not re.match(r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$", task_id):
            raise model.Invalid("bindings", "task_id")
        if slot is not None and slot not in model.SLOTS:
            raise model.Invalid(f"bindings.{task_id}", "slot")
        t = conn.execute("SELECT * FROM maint_tasks WHERE id = ?", (task_id,)).fetchone()
        if not maccess.module_on(conn) or not maccess.visible(mviewer, t):
            raise maccess.not_found()  # a foreign / deleted / invisible task is the same 404 as an unknown id
        if slot is not None:
            rule = BIND_RULES[slot]
            if t["kind"] not in rule["kinds"]:
                raise model.Invalid(f"bindings.{task_id}", "kind")
            if slot == "elevator_inspection" and not t["elevator_id"]:
                raise model.Invalid(f"bindings.{task_id}", "elevator_required")
        conn.execute("UPDATE maint_tasks SET emergency_slot = ? WHERE id = ?", (slot, task_id))


def _set_na(conn: sqlite3.Connection, viewer: Viewer, raw: Any, request_id: str | None) -> None:
    if not isinstance(raw, dict):
        raise model.Invalid("not_applicable", "type")
    cur = _jload(conn, access.SLOTS_NOTE, {})
    cur = dict(cur) if isinstance(cur, dict) else {}
    name = (conn.execute("SELECT display_name FROM users WHERE id = ?", (viewer.uid,)).fetchone() or {"display_name": None})["display_name"] or viewer.uid
    for item_id, v in raw.items():
        if item_id not in model.ITEMS:
            raise model.Invalid(f"not_applicable.{item_id}", "unknown")
        if v is None:
            if cur.pop(item_id, None) is not None:
                audit(conn, actor=viewer.principal, action="emergency_readiness.na.clear", decision="allowed", resource_type="installation", resource_id=item_id, request_id=request_id)
            continue
        if not isinstance(v, dict) or set(v) - {"note"}:
            raise model.Invalid(f"not_applicable.{item_id}", "shape")
        note = model.clean_text(v.get("note"), f"not_applicable.{item_id}.note", max_len=NA_NOTE_MAX)
        cur[item_id] = {"by": name, "by_id": viewer.uid, "at": access.now_iso(), "note": note}
        audit(conn, actor=viewer.principal, action="emergency_readiness.na.set", decision="allowed", resource_type="installation", resource_id=item_id, request_id=request_id)
    _jsave(conn, access.SLOTS_NOTE, cur)


# ---------------------------------------------------------------- the emergency contact list (owner q203 b)

PHONE_RE = re.compile(r"^\+?[0-9][0-9 ()\-]{4,23}$")
EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s]{2,}$")
CONTACT_MAX = 100


def _contact_shape(r: sqlite3.Row, full: bool, now_iso: str, verify_days: float) -> dict[str, Any]:
    d = model.age_days(r["last_verified_at"], now_iso) if r["last_verified_at"] else None
    out = {"id": r["id"], "display_name": r["display_name"], "role_title": r["role_title"], "priority": r["priority"], "active": bool(r["active"]), "revision": r["revision"],
           "last_verified_at": r["last_verified_at"], "verified_ok": d is not None and d <= verify_days, "has_phone": bool(r["phone"]), "has_email": bool(r["email"]), "user_id": r["user_id"]}
    if full:
        out["phone"], out["email"] = r["phone"], r["email"]
    return out


def list_contacts(conn: sqlite3.Connection, viewer: Viewer) -> dict[str, Any]:
    """A manager reads the whole list; any other viewer gets only the counts (never a name, a phone number or an e-mail - CR section 5)."""
    viewer.require_view()
    rows = conn.execute("SELECT * FROM emergency_contacts WHERE deleted_at IS NULL ORDER BY priority, display_name").fetchall()
    th = model.merged_thresholds(_jload(conn, access.THRESHOLDS_KEY, {}))
    now = access.now_iso()
    if not viewer.can_manage():
        return {"count": len(rows), "items": [], "can_manage": False}
    return {"count": len(rows), "items": [_contact_shape(r, True, now, th["contact_verify_days"]) for r in rows], "can_manage": True}


def _contact_fields(body: dict[str, Any], *, partial: bool) -> dict[str, Any]:
    out: dict[str, Any] = {}
    try:
        if not partial or "display_name" in body:
            out["display_name"] = model.clean_text(body.get("display_name"), "display_name", max_len=80, required=True)
        if "role_title" in body:
            out["role_title"] = model.clean_text(body.get("role_title"), "role_title", max_len=80)
        if "phone" in body:
            p = model.clean_text(body.get("phone"), "phone", max_len=24)
            if p and not PHONE_RE.match(p):
                raise model.Invalid("phone", "format")
            out["phone"] = p
        if "email" in body:
            e = model.clean_text(body.get("email"), "email", max_len=254)
            if e and not EMAIL_RE.match(e):
                raise model.Invalid("email", "format")
            out["email"] = e
        if "user_id" in body:
            u = body.get("user_id")
            if u is not None and (not isinstance(u, str) or len(u) > 128):
                raise model.Invalid("user_id", "type")
            out["user_id"] = u or None
        if "priority" in body:
            pr = body.get("priority")
            if isinstance(pr, bool) or not isinstance(pr, int) or not 1 <= pr <= 999:
                raise model.Invalid("priority", "range")
            out["priority"] = pr
        if "active" in body:
            if not isinstance(body["active"], bool):
                raise model.Invalid("active", "type")
            out["active"] = 1 if body["active"] else 0
    except model.Invalid as exc:
        raise ApiError(422, "validation", "ערך לא תקין.", details={"fields": [exc.field], "code": exc.code}) from exc
    return out


def _contact_or_404(conn: sqlite3.Connection, cid: str) -> sqlite3.Row:
    r = conn.execute("SELECT * FROM emergency_contacts WHERE id = ? AND deleted_at IS NULL", (cid,)).fetchone()
    if r is None:
        raise ApiError(404, "emergency_contact_not_found", "איש הקשר לא נמצא.")
    return r


def create_contact(conn: sqlite3.Connection, viewer: Viewer, body: dict[str, Any], request_id: str | None) -> dict[str, Any]:
    viewer.require_manage()
    f = _contact_fields(body, partial=False)
    if not (f.get("phone") or f.get("email") or f.get("user_id")):
        raise ApiError(422, "validation", "נדרש טלפון, דוא״ל או משתמש.", details={"fields": ["phone"], "code": "route_required"})
    if conn.execute("SELECT COUNT(*) FROM emergency_contacts WHERE deleted_at IS NULL").fetchone()[0] >= CONTACT_MAX:
        raise ApiError(422, "validation", "הגעת למספר המרבי של אנשי קשר.", details={"fields": ["display_name"], "code": "too_many"})
    now = access.now_iso()
    cid = new_id()
    conn.execute("INSERT INTO emergency_contacts(id, display_name, role_title, phone, email, user_id, priority, active, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                 (cid, f["display_name"], f.get("role_title", ""), f.get("phone", ""), f.get("email", ""), f.get("user_id"), f.get("priority", 100), f.get("active", 1), viewer.uid, now, now))
    audit(conn, actor=viewer.principal, action="emergency_readiness.contact.create", decision="allowed", resource_type="emergency_contact", resource_id=cid, request_id=request_id)
    th = model.merged_thresholds(_jload(conn, access.THRESHOLDS_KEY, {}))
    return _contact_shape(_contact_or_404(conn, cid), True, now, th["contact_verify_days"])


def update_contact(conn: sqlite3.Connection, viewer: Viewer, cid: str, body: dict[str, Any], request_id: str | None) -> dict[str, Any]:
    viewer.require_manage()
    cur = _contact_or_404(conn, cid)
    if "revision" in body and body["revision"] != cur["revision"]:
        raise ApiError(409, "revision_conflict", "איש הקשר שונה בינתיים.", details={"revision": cur["revision"]})
    f = _contact_fields({k: v for k, v in body.items() if k != "revision"}, partial=True)
    if f:
        merged = {**dict(cur), **f}
        if not (merged["phone"] or merged["email"] or merged["user_id"]):
            raise ApiError(422, "validation", "נדרש טלפון, דוא״ל או משתמש.", details={"fields": ["phone"], "code": "route_required"})
        sets = ", ".join(f"{k} = ?" for k in f)
        # a changed route is no longer a verified route
        reset = ", last_verified_at = NULL, last_verified_by = NULL" if any(k in f and f[k] != cur[k] for k in ("phone", "email", "user_id")) else ""
        conn.execute(f"UPDATE emergency_contacts SET {sets}{reset}, revision = revision + 1, updated_at = ? WHERE id = ?", (*f.values(), access.now_iso(), cid))
        audit(conn, actor=viewer.principal, action="emergency_readiness.contact.update", decision="allowed", resource_type="emergency_contact", resource_id=cid, request_id=request_id,
              details={"fields": sorted(f)})
    th = model.merged_thresholds(_jload(conn, access.THRESHOLDS_KEY, {}))
    return _contact_shape(_contact_or_404(conn, cid), True, access.now_iso(), th["contact_verify_days"])


def verify_contact(conn: sqlite3.Connection, viewer: Viewer, cid: str, request_id: str | None) -> dict[str, Any]:
    """The manager confirms the route works (a call or a message that arrived): the only thing that makes E13 green."""
    viewer.require_manage()
    _contact_or_404(conn, cid)
    now = access.now_iso()
    conn.execute("UPDATE emergency_contacts SET last_verified_at = ?, last_verified_by = ?, revision = revision + 1, updated_at = ? WHERE id = ?", (now, viewer.uid, now, cid))
    audit(conn, actor=viewer.principal, action="emergency_readiness.contact.verify", decision="allowed", resource_type="emergency_contact", resource_id=cid, request_id=request_id)
    th = model.merged_thresholds(_jload(conn, access.THRESHOLDS_KEY, {}))
    return _contact_shape(_contact_or_404(conn, cid), True, now, th["contact_verify_days"])


def delete_contact(conn: sqlite3.Connection, viewer: Viewer, cid: str, request_id: str | None) -> None:
    """Privacy (owner q203 b: a privacy review): a deleted contact keeps no name, phone number, e-mail or user link."""
    viewer.require_manage()
    _contact_or_404(conn, cid)
    now = access.now_iso()
    conn.execute("UPDATE emergency_contacts SET display_name = '-', role_title = '', phone = '', email = '', user_id = NULL, active = 0, deleted_at = ?, updated_at = ?, "
                 "revision = revision + 1 WHERE id = ?", (now, now, cid))
    audit(conn, actor=viewer.principal, action="emergency_readiness.contact.delete", decision="allowed", resource_type="emergency_contact", resource_id=cid, request_id=request_id)


# ---------------------------------------------------------------- history (owner q207 c; kept one year, editable: q284)

def snapshot(conn: sqlite3.Connection, settings: Settings | None, *, force: bool = False) -> bool:
    """Store the installation-level truth when the verdict or any item's status changed (or at least once a day). Returns True when a row was written.
    Item ids and statuses only - never a fact, a name or a number."""
    if not access.module_on(conn):
        return False
    _ctx, rows = compute(conn, settings)
    items = {r["id"]: r["status"] for r in rows}
    verdict = model.verdict(rows)
    last = conn.execute("SELECT taken_at, verdict, items_json FROM emergency_readiness_history ORDER BY taken_at DESC LIMIT 1").fetchone()
    now = access.now_iso()
    if last is not None and not force:
        same = last["verdict"] == verdict and json.loads(last["items_json"] or "{}") == items
        if same and (model.age_days(last["taken_at"], now) or 0) < 1:
            return False
    conn.execute("INSERT INTO emergency_readiness_history(id, taken_at, verdict, counts_json, items_json) VALUES (?,?,?,?,?)",
                 (new_id(), now, verdict, json.dumps(model.counts(rows)), json.dumps(items, sort_keys=True)))
    keep = int(model.merged_thresholds(_jload(conn, access.THRESHOLDS_KEY, {}))["history_keep_days"])
    cutoff = access.now().replace(microsecond=0) - __import__("datetime").timedelta(days=keep)
    conn.execute("DELETE FROM emergency_readiness_history WHERE taken_at < ?", (cutoff.strftime("%Y-%m-%dT%H:%M:%SZ"),))
    return True


def history(conn: sqlite3.Connection, viewer: Viewer, days: int) -> dict[str, Any]:
    viewer.require_view()
    keep = int(model.merged_thresholds(_jload(conn, access.THRESHOLDS_KEY, {}))["history_keep_days"])
    days = max(1, min(days, keep))
    cutoff = (access.now() - __import__("datetime").timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")
    rows = conn.execute("SELECT taken_at, verdict, counts_json FROM emergency_readiness_history WHERE taken_at >= ? ORDER BY taken_at", (cutoff,)).fetchall()
    return {"keep_days": keep, "days": days, "points": [{"at": r["taken_at"], "verdict": r["verdict"], "counts": json.loads(r["counts_json"] or "{}")} for r in rows]}


def janitor(db: Any, settings: Settings | None) -> None:
    """Called from the periodic housekeeping: nothing while the module is off."""
    with db.connection() as conn:
        snapshot(conn, settings)
