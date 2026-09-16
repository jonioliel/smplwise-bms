"""Alarm rules, dry run and alerts (T052)."""
from __future__ import annotations

import json
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field

from ..audit import audit
from ..auth import current_principal, get_conn
from ..db import new_id, now_iso
from ..errors import ApiError, conflict, not_found
from ..rbac import INSTALLATION, Principal, require
from ..services import rules as svc
from ..services.access import visible_camera_ids
from .settings import read_settings

router = APIRouter()


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


class Trigger(BaseModel):
    types: list[str] = Field(default_factory=list, max_length=20)
    sources: list[str] = Field(default_factory=list, max_length=4)
    severity_min: str = Field(default="info", pattern="^(info|alert|critical)$")


class Scope(BaseModel):
    site_ids: list[str] = Field(default_factory=list, max_length=50)
    building_ids: list[str] = Field(default_factory=list, max_length=50)
    floor_ids: list[str] = Field(default_factory=list, max_length=100)
    zone_ids: list[str] = Field(default_factory=list, max_length=100)
    camera_ids: list[str] = Field(default_factory=list, max_length=200)
    entity_ids: list[str] = Field(default_factory=list, max_length=200)


class Window(BaseModel):
    days: list[str] = Field(default_factory=list, max_length=7)
    from_time: str | None = Field(default=None, alias="from", pattern=r"^\d{2}:\d{2}$")
    to_time: str | None = Field(default=None, alias="to", pattern=r"^\d{2}:\d{2}$")
    model_config = {"populate_by_name": True}

    def dump(self) -> dict[str, Any]:
        return {"days": [d for d in self.days if d in svc.DAYS], "from": self.from_time, "to": self.to_time}


class Action(BaseModel):
    kind: str = Field(pattern="^(notify)$")
    message: str = Field(default="", max_length=300)


class RuleIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: str = Field(default="", max_length=400)
    enabled: bool = True
    owner: str = Field(default="local", pattern="^(local|ha)$")
    ha_automation_id: str | None = Field(default=None, max_length=120)
    trigger: Trigger = Field(default_factory=Trigger)
    scope: Scope = Field(default_factory=Scope)
    window: Window = Field(default_factory=Window)
    cooldown_s: int = Field(default=300, ge=0, le=86400)
    actions: list[Action] = Field(default_factory=lambda: [Action(kind="notify")], max_length=svc.MAX_ACTIONS)

    def columns(self) -> dict[str, Any]:
        types = [t for t in self.trigger.types if t]
        return {
            "name": self.name.strip(), "description": self.description, "enabled": int(self.enabled), "owner": self.owner, "ha_automation_id": self.ha_automation_id,
            "trigger_json": json.dumps({"types": types, "sources": [s for s in self.trigger.sources if s in ("alertstream", "recording", "system", "ha")], "severity_min": self.trigger.severity_min}, ensure_ascii=False),
            "scope_json": json.dumps(self.scope.model_dump(), ensure_ascii=False), "window_json": json.dumps(self.window.dump(), ensure_ascii=False),
            "cooldown_s": self.cooldown_s, "actions_json": json.dumps([a.model_dump() for a in self.actions] or [{"kind": "notify", "message": ""}], ensure_ascii=False),
        }


class RulePatch(RuleIn):
    revision: int = Field(ge=1)


class DryRunIn(BaseModel):
    rule_id: str | None = Field(default=None, max_length=32)
    rule: RuleIn | None = None
    hours: int = Field(default=24, ge=1, le=svc.DRY_RUN_MAX_HOURS)


def _get(conn: sqlite3.Connection, rule_id: str) -> sqlite3.Row:
    r = conn.execute("SELECT * FROM rules WHERE id = ?", (rule_id,)).fetchone()
    if not r:
        raise not_found("החוק לא נמצא.")
    return r


def _with_counts(conn: sqlite3.Connection, rules: list[dict[str, Any]]) -> list[dict[str, Any]]:
    counts = {r["rule_id"]: (r["n"], r["open"]) for r in conn.execute("SELECT rule_id, COUNT(*) AS n, SUM(CASE WHEN acked_at IS NULL THEN 1 ELSE 0 END) AS open FROM rule_alerts GROUP BY rule_id").fetchall()}
    for r in rules:
        n, open_ = counts.get(r["id"], (0, 0))
        r["alerts"] = {"total": n, "open": open_ or 0}
    return rules


@router.get("/rules")
def list_rules(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "rules.manage", INSTALLATION)
    rows = [svc.row_to_rule(r) for r in conn.execute("SELECT * FROM rules ORDER BY created_at").fetchall()]
    return {"rules": _with_counts(conn, rows), "types": ["motion", "person", "vehicle", "line", "field", "offline", "tamper", "door", "io", "storage", "system", "coverage_gap", "manual", "other"],
            "sources": ["alertstream", "recording", "system", "ha"], "action_kinds": list(svc.ACTION_KINDS), "days": list(svc.DAYS)}


@router.post("/rules", status_code=201)
def create_rule(body: RuleIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "rules.manage", INSTALLATION)
    if body.owner == "ha" and not body.ha_automation_id:
        raise ApiError(422, "validation", "חוק בבעלות HA חייב לציין את מזהה האוטומציה ב־HA.")
    cols = body.columns()
    rid = new_id()
    now = now_iso()
    conn.execute(
        "INSERT INTO rules(id, name, description, enabled, owner, ha_automation_id, trigger_json, scope_json, window_json, cooldown_s, actions_json, revision, created_by, created_by_username, updated_by, updated_by_username, created_at, updated_at) "
        "VALUES (:id, :name, :description, :enabled, :owner, :ha_automation_id, :trigger_json, :scope_json, :window_json, :cooldown_s, :actions_json, 1, :uid, :uname, :uid, :uname, :now, :now)",
        {**cols, "id": rid, "uid": principal.user_id, "uname": principal.username, "now": now},
    )
    audit(conn, actor=principal, action="rule.create", decision="allowed", resource_type="rule", resource_id=rid, request_id=_rid(request), details={"name": cols["name"], "owner": body.owner, "enabled": body.enabled})
    return _with_counts(conn, [svc.row_to_rule(_get(conn, rid))])[0]


@router.get("/rules/alerts")
def list_alerts(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn), unacked: bool = False, limit: int = Query(100, ge=1, le=500)) -> dict[str, Any]:
    """Alerts raised by local rules, filtered to the caller's cameras (events.read)."""
    ids = visible_camera_ids(conn, principal, "events.read")
    if ids is not None and not ids:
        require(conn, principal, "events.read", INSTALLATION)
    sql = "SELECT a.*, r.name AS rule_name FROM rule_alerts a JOIN rules r ON r.id = a.rule_id" + (" WHERE a.acked_at IS NULL" if unacked else "") + " ORDER BY a.fired_at DESC, a.occurred_at DESC LIMIT ?"
    rows = [svc.alert_row(r) for r in conn.execute(sql, (limit * 3 if ids is not None else limit,)).fetchall()]
    if ids is not None:
        rows = [a for a in rows if a["camera_id"] in ids or (a["camera_id"] is None and False)][:limit]
    return {"alerts": rows, "unacked": conn.execute("SELECT COUNT(*) FROM rule_alerts WHERE acked_at IS NULL").fetchone()[0]}


@router.post("/rules/alerts/{alert_id}/ack")
def ack_alert(alert_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "events.ack", INSTALLATION)
    a = conn.execute("SELECT * FROM rule_alerts WHERE id = ?", (alert_id,)).fetchone()
    if not a:
        raise not_found("ההתראה לא נמצאה.")
    if not a["acked_at"]:
        conn.execute("UPDATE rule_alerts SET acked_at = ?, acked_by = ?, acked_by_username = ? WHERE id = ?", (now_iso(), principal.user_id, principal.username, alert_id))
        audit(conn, actor=principal, action="rule.alert.ack", decision="allowed", resource_type="rule_alert", resource_id=alert_id, request_id=_rid(request), details={"rule_id": a["rule_id"], "event_id": a["event_id"]})
    r = conn.execute("SELECT a.*, r.name AS rule_name FROM rule_alerts a JOIN rules r ON r.id = a.rule_id WHERE a.id = ?", (alert_id,)).fetchone()
    return svc.alert_row(r)


@router.post("/rules/dry-run")
def dry_run(body: DryRunIn, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Replay stored events through a rule (stored or inline) and explain every decision; nothing is written or sent."""
    require(conn, principal, "rules.manage", INSTALLATION)
    if body.rule is not None:
        cols = body.rule.columns()
        rule = {"id": body.rule_id or "dry-run", "name": cols["name"], "trigger": json.loads(cols["trigger_json"]), "scope": json.loads(cols["scope_json"]), "window": json.loads(cols["window_json"]), "cooldown_s": cols["cooldown_s"], "actions": json.loads(cols["actions_json"])}
    elif body.rule_id:
        rule = svc.row_to_rule(_get(conn, body.rule_id))
    else:
        raise ApiError(422, "validation", "יש לשלוח חוק או מזהה חוק.")
    return {"rule_name": rule["name"], **svc.dry_run(conn, rule, body.hours, read_settings(conn)["time.zone"])}


@router.get("/rules/{rule_id}")
def get_rule(rule_id: str, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "rules.manage", INSTALLATION)
    return _with_counts(conn, [svc.row_to_rule(_get(conn, rule_id))])[0]


@router.patch("/rules/{rule_id}")
def update_rule(rule_id: str, body: RulePatch, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "rules.manage", INSTALLATION)
    r = _get(conn, rule_id)
    if body.revision != r["revision"]:
        raise conflict("stale_revision", "החוק השתנה בינתיים; טען מחדש.", current_revision=r["revision"], sent_revision=body.revision)
    if body.owner == "ha" and not body.ha_automation_id:
        raise ApiError(422, "validation", "חוק בבעלות HA חייב לציין את מזהה האוטומציה ב־HA.")
    cols = body.columns()
    before = svc.row_to_rule(r)
    conn.execute(
        "UPDATE rules SET name = :name, description = :description, enabled = :enabled, owner = :owner, ha_automation_id = :ha_automation_id, trigger_json = :trigger_json, scope_json = :scope_json, "
        "window_json = :window_json, cooldown_s = :cooldown_s, actions_json = :actions_json, revision = revision + 1, updated_by = :uid, updated_by_username = :uname, updated_at = :now WHERE id = :id",
        {**cols, "id": rule_id, "uid": principal.user_id, "uname": principal.username, "now": now_iso()},
    )
    after = svc.row_to_rule(_get(conn, rule_id))
    changed = sorted(k for k in ("name", "description", "enabled", "owner", "trigger", "scope", "window", "cooldown_s", "actions") if before[k] != after[k])
    audit(conn, actor=principal, action="rule.update", decision="allowed", resource_type="rule", resource_id=rule_id, request_id=_rid(request), details={"changed": changed, "enabled": after["enabled"], "revision": after["revision"]})
    return _with_counts(conn, [after])[0]


@router.delete("/rules/{rule_id}", status_code=204)
def delete_rule(rule_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> None:
    require(conn, principal, "rules.manage", INSTALLATION)
    r = _get(conn, rule_id)
    conn.execute("DELETE FROM rule_alerts WHERE rule_id = ?", (rule_id,))
    conn.execute("DELETE FROM rules WHERE id = ?", (rule_id,))
    audit(conn, actor=principal, action="rule.delete", decision="allowed", resource_type="rule", resource_id=rule_id, request_id=_rid(request), details={"name": r["name"]})
