"""CR-017: runs ("למה זה רץ?", decision 9ג - the full trace for everyone who may view the item) and the administrator's review list
(docs/architecture/AUTOMATIONS_API.md §3.1 rows 18 and 22, CR §4.2.6, §9.4, §10.2).

Runs are read from Home Assistant's own traces (`trace/list`, `trace/get`) on demand; the list also feeds `automation_runs` (last run and the 7-day count of the
item list). A run of an item the caller may not see never leaves the server (visibility is established first). Nothing returned carries a user id, a context id
or an unmasked secret-like value."""
from __future__ import annotations

import json
import re
import sqlite3
from typing import Any

from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, require
from . import automation_draft as drafts
from . import automation_model as model
from . import automation_policy as pol
from . import automation_scope as scope
from . import automation_trace as trace
from . import automation_transport as tr
from . import automation_view as view
from . import automations as store
from . import ha_scope
from .timeutil import iso_utc, parse_utc, zone

RUN_ID_RE = re.compile(r"^[A-Za-z0-9_.:-]{1,80}$")


def _trace_domain(kind: str) -> str:
    if kind not in ("automation", "script"):
        raise ApiError(404, "item_not_found", "הפריט לא נמצא.")
    return kind


def _config_id(row: view.Row) -> str:
    if row.config_id is None:
        raise ApiError(404, "item_not_found", "הפריט לא נמצא.")
    return row.config_id


def _user_name(conn: sqlite3.Connection):
    def name(user_id: str | None) -> str | None:
        if not user_id:
            return None
        r = conn.execute("SELECT name, username FROM ha_users WHERE id = ?", (user_id,)).fetchone()
        return (r["name"] or r["username"]) if r else None

    return name


def runs_list(ctx: scope.Ctx, kind: str, item_id: str) -> dict[str, Any]:
    """`RunSummary[]`, newest first (the last TRACE_LIST_MAX stored runs). A scene has no runs."""
    row, rd, facts = view.get_item(ctx, kind, item_id)
    if kind == "scene":
        return {"items": []}
    domain = _trace_domain(kind)
    cid = _config_id(row)
    tz = zone(ctx.tz_name)
    try:
        reply = tr.get_transport().ws("trace/list", domain=domain, item_id=cid)
    except ApiError:
        raise ApiError(503, "ha_unavailable", "תשתית המערכת אינה זמינה כרגע.", retryable=True) from None
    ok, code = store.is_json_error(reply)
    if not ok:
        if code in ("not_found", "unknown_command"):
            return {"items": []}
        raise ApiError(503, "ha_unavailable", "תשתית המערכת אינה זמינה כרגע.", retryable=True, details={"error": code})
    entries = [e for e in (reply.get("result") or []) if isinstance(e, dict)]
    summaries = [trace.summary(e, ctx.name_of, tz) for e in entries]
    summaries = [s for s in summaries if s["at"]]
    summaries.sort(key=lambda s: s["at"], reverse=True)
    _remember(ctx.conn, kind, item_id, entries, summaries)
    return {"items": summaries[:store.TRACE_LIST_MAX]}


def _remember(conn: sqlite3.Connection, kind: str, item_id: str, entries: list[dict[str, Any]], summaries: list[dict[str, Any]]) -> None:
    """The traces feed the list's last-run and 7-day count (one row per HA run id)."""
    by = {e.get("run_id"): e for e in entries}
    for s in summaries[:store.TRACE_LIST_MAX]:
        e = by.get(s["run_id"]) or {}
        trig = e.get("trigger") if isinstance(e.get("trigger"), str) else None
        conn.execute("INSERT INTO automation_runs(id, kind, item_id, at, source, result, trigger_text) VALUES (?,?,?,?, 'trace', ?, ?) "
                     "ON CONFLICT(id) DO UPDATE SET result = excluded.result, at = excluded.at", (f"tr{s['run_id']}"[:80], kind, item_id, s["at"], s["result"], (trig or "")[:120]))


def run_detail(ctx: scope.Ctx, kind: str, item_id: str, run_id: str) -> dict[str, Any]:
    row, rd, facts = view.get_item(ctx, kind, item_id)
    if kind == "scene":
        raise ApiError(404, "item_not_found", "הפריט לא נמצא.")
    domain = _trace_domain(kind)
    cid = _config_id(row)
    if not RUN_ID_RE.match(run_id):
        raise ApiError(404, "item_not_found", "הפריט לא נמצא.")
    try:
        reply = tr.get_transport().ws("trace/get", domain=domain, item_id=cid, run_id=run_id)
    except ApiError:
        raise ApiError(503, "ha_unavailable", "תשתית המערכת אינה זמינה כרגע.", retryable=True) from None
    ok, code = store.is_json_error(reply)
    entry = reply.get("result") if ok else None
    if not ok or not isinstance(entry, dict):
        if code in ("not_found", None) or not ok:
            raise ApiError(404, "item_not_found", "הפריט לא נמצא.", details={"what": "run"})
    # sentences come from the config the run actually used (the trace carries it), else the stored one
    cfg_used = entry.get("config") if isinstance(entry.get("config"), dict) else row.cfg
    mrd = drafts.read(kind, cfg_used, ctx.model_ctx(code_view=False, scoped=False)) if isinstance(cfg_used, dict) else None
    sentences = drafts.path_sentences(mrd["draft"]) if mrd is not None else {}
    step_paths = [w.path for w in model.walk_draft(mrd["draft"]) if w.section == "action"] if mrd is not None else []
    tz = zone(ctx.tz_name)
    detail = trace.detail(entry, step_paths=step_paths, sentences=sentences, name_of=ctx.name_of, tz=tz, user_name=_user_name(ctx.conn))
    return detail


# ================================================================ the administrator's review list (§3.1 row 22)

def _owner_can(conn: sqlite3.Connection, user_id: str, kind: str, facts: dict[str, Any]) -> bool:
    """Whether the user who last changed an item still holds the manage permission over its targets (the review's "owner lost rights")."""
    p = Principal(user_id=user_id, username="", display_name="", source="dev")
    perm = scope.MANAGE_OF[kind]
    if authorize(conn, p, perm, INSTALLATION).allowed:
        return True
    ents = facts["targets"]
    return bool(ents) and all(ha_scope.entity_allowed(conn, p, e, perm) for e in ents)


def review(ctx: scope.Ctx) -> dict[str, Any]:
    """Installation-wide manage only: sensitive items changed outside Arx, storms, invalid items, missing devices, owners who lost their rights, masked values,
    writes made through the delegation switch, an authoring block."""
    if not ctx.access.wide(scope.MANAGE):
        require(ctx.conn, ctx.principal, scope.MANAGE, INSTALLATION)
    env = view.Env(ctx)
    items: list[dict[str, Any]] = []
    for row, rd, facts in view.visible_rows(ctx):
        item = view.build_item(ctx, env, row, rd=rd, facts=facts, detail=True)
        base = {"kind": row.kind, "id": row.item_id, "name": item["name"], "at": row.meta["updated_at"] if row.meta is not None else None}
        codes = {w["code"] for w in item["warnings"]}
        if "changed_outside" in codes and facts["sensitive"]:
            items.append({**base, "issue": "sensitive_external", "detail": "פריט רגיש שונה מחוץ למערכת"})
        if "storm" in codes:
            items.append({**base, "issue": "storm", "detail": "רץ בתדירות גבוהה מאוד"})
        if "invalid_config" in codes:
            items.append({**base, "issue": "invalid", "detail": "לא פעיל – שגיאה בהגדרה"})
        if "missing_entity" in codes:
            items.append({**base, "issue": "missing_entity", "detail": next(w["message"] for w in item["warnings"] if w["code"] == "missing_entity")})
        if row.masked:
            items.append({**base, "issue": "masked_values", "detail": "הפריט כולל ערכים חסויים"})
        uid = (row.meta["updated_by"] or row.meta["created_by"]) if row.meta is not None else None
        if uid and row.kind in scope.MANAGE_OF and not _owner_can(ctx.conn, uid, row.kind, facts):
            items.append({**base, "issue": "owner_lost_rights", "detail": "מי ששמר את הפריט אינו מורשה עוד לנהל אותו"})
    for r in ctx.conn.execute("SELECT at, actor_username, resource_id, details_json FROM audit_log WHERE action LIKE 'automation.%' AND decision = 'allowed' AND details_json LIKE '%\"delegated\": true%' "
                              "ORDER BY id DESC LIMIT 50").fetchall():
        try:
            det = json.loads(r["details_json"] or "{}")
        except ValueError:
            det = {}
        items.append({"kind": det.get("kind") or "automation", "id": (r["resource_id"] or "").split(":", 1)[-1], "name": "", "issue": "delegated_write", "at": r["at"],
                      "detail": f"נשמר באמצעות מתג ההאצלה ע״י {r['actor_username'] or ''}".strip()})
    st = tr.mirror_state(ctx.conn)
    if st.get("authoring_block"):
        items.append({"kind": "automation", "id": "", "name": "", "issue": "not_loaded", "at": None, "detail": "השמירה נחסמה: הפריט לא נטען (בדקו את שורת ההכללה בתצורה)"})
    return {"items": items}
