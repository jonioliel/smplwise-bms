"""CR-038 phase 2 (TKRULES-291, docs/changes/CR-038-TKRULES-NOTES.md): the rules that open tickets from alerts - Settings > service
management > "פתיחה אוטומטית". Every route needs `system.configure` at installation scope (tickets.configure is NOT enough: a rule
routes installation-wide alerts into a department) and sits behind the module gate.

- `GET  /tickets/rules`       the document + per rule: effective daily limit, tickets created today, "limit reached today", last fire;
                              the allowed trigger sources, the departments with their priorities / categories, the bounds
- `PUT  /tickets/rules`       the whole document with its `revision` (409 rules_stale; 422 validation with details.fields), audited
                              `tickets.rules.update` (rule ids and changed field names only)
- `POST /tickets/rules/test`  the dry run of one rule as typed in the editor - writes nothing, lists only alerts the caller may see

Mounted BEFORE routers/tickets.py (its `/tickets/{ticket_id}` would match `/tickets/rules`)."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, StrictBool, StrictInt

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, require
from ..services.tickets import rule_engine, rules_doc, store, store_rules
from ..services.tickets.access import text
from .tickets import module_gate

router = APIRouter(dependencies=[Depends(module_gate)])
PERMISSION = "system.configure"


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _invalid(conn: sqlite3.Connection, exc: rules_doc.Invalid) -> ApiError:
    return ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": [{"field": f, "code": c} for f, c in exc.problems]})


def _answer(conn: sqlite3.Connection) -> dict[str, Any]:
    doc = rules_doc.read(conn)
    day = rule_engine.local_day(conn, rule_engine.utcnow())
    stats = store_rules.day_stats(conn, day)
    for r in doc["rules"]:
        s = stats.get(r["id"], {})
        limit = rules_doc.effective_limit(doc, r)
        r["effective_limit"] = limit
        r["today_created"] = s.get("created", 0)
        r["limit_reached"] = r["today_created"] >= limit
        r["suppressed_today"] = s.get("suppressed", 0)
        r["last_fired_at"] = s.get("last_at")
    depts = []
    for d in store.departments(conn, include_inactive=False):
        depts.append({"id": d["id"], "name": d["name"],
                      "priorities": [{"id": p["id"], "name": p["name"], "is_default": bool(p.get("is_default"))} for p in store.priorities(conn, d["id"]) if p.get("active")],
                      "categories": [{"id": c["id"], "name": c["name"]} for c in store.categories(conn, d["id"], include_inactive=False)]})
    sources = [{"key": s.key, "label": s.label, "category": s.category, "subject": s.subject} for s in rules_doc.allowed_sources().values()]
    return {**doc, "day": day, "sources": sources, "departments": depts,
            "bounds": {"max_rules": rules_doc.MAX_RULES, "hard_daily_max": rules_doc.HARD_DAILY_MAX, "default_daily": rules_doc.DEFAULT_DAILY,
                       "hold_max_min": rules_doc.HOLD_MAX_MIN, "name_max": rules_doc.NAME_MAX, "title_max": rules_doc.TITLE_MAX,
                       "description_max": rules_doc.DESCRIPTION_MAX, "placeholders": list(rules_doc.PLACEHOLDERS)}}


@router.get("/tickets/rules")
def get_rules(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    require(conn, principal, PERMISSION, INSTALLATION)
    return _answer(conn)


class RulesBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: StrictInt
    enabled: StrictBool
    daily_limit_default: Any = None  # validated by rules_doc (integer 1..HARD_DAILY_MAX) so the 422 names the field like every other
    rules: list[dict[str, Any]]


@router.put("/tickets/rules")
def put_rules(body: RulesBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, PERMISSION, INSTALLATION)
    current = rules_doc.read(conn)
    if body.revision != current["revision"]:
        raise ApiError(409, "rules_stale", text(conn, "הכללים השתנו בינתיים. טענו מחדש."), details={"revision": current["revision"]})
    try:
        _doc, changes = rules_doc.save(conn, {"enabled": body.enabled, "daily_limit_default": body.daily_limit_default, "rules": body.rules})
    except rules_doc.Invalid as exc:
        raise _invalid(conn, exc) from None
    audit(conn, actor=principal, action="tickets.rules.update", decision="allowed", resource_type="ticket_rules", resource_id=rules_doc.SETTING_KEY,
          request_id=_rid(request), details=changes)
    return _answer(conn)


class TestBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    rule: dict[str, Any]


@router.post("/tickets/rules/test")
def test_rule(body: TestBody, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    require(conn, principal, PERMISSION, INSTALLATION)
    try:
        return rule_engine.dry_run(conn, principal, body.rule)
    except rules_doc.Invalid as exc:
        raise _invalid(conn, exc) from None
