"""CR-031 GEN1 - the generator control screen's API (`/api/v1/generator/...`). View and alerts only: there is no route that sends
anything to the controller.

Permissions: reads, acknowledge and mute need `generator.view`; detection, the manual pick, the sensor mapping, rated values,
thresholds, the settings and the alert routing need `generator.manage` (installation scope). Entity ids are returned only by the
two manage routes of the mapping screen; every operator route speaks in display names and role keys. Nothing here calls the
infrastructure: the values come from the state mirror."""
from __future__ import annotations

import collections
import sqlite3
import time
from typing import Any, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..db import now_iso
from ..errors import ApiError, not_found
from ..rbac import INSTALLATION, Principal, require
from ..services import generator_alerts as alerts
from ..services import generator_catalog as cat
from ..services import generator_core as core
from ..services import generator_history as history

router = APIRouter()
VIEW, MANAGE = "generator.view", "generator.manage"
_DETECT_CALLS: collections.deque[float] = collections.deque(maxlen=3)


class _Body(BaseModel):
    model_config = ConfigDict(extra="forbid")


def _view_ro(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Principal:
    require(conn, principal, VIEW, INSTALLATION)
    return principal


def _manage_ro(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Principal:
    require(conn, principal, MANAGE, INSTALLATION)
    return principal


def _view_w(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Principal:
    require(conn, principal, VIEW, INSTALLATION)
    return principal


def _manage_w(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Principal:
    require(conn, principal, MANAGE, INSTALLATION)
    return principal


def _mirror_connected() -> bool:
    from ..services import ha_sync

    return bool(ha_sync.STATE.connected)


def _device(conn: sqlite3.Connection, device_id: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM generator_devices WHERE id = ? AND status <> 'removed'", (device_id,)).fetchone()
    if row is None:
        raise ApiError(404, "generator_not_found", "הגנרטור לא נמצא.")
    return row


def _area_name(conn: sqlite3.Connection, area_id: str | None) -> str | None:
    if not area_id:
        return None
    r = conn.execute("SELECT name FROM ha_areas WHERE area_id = ?", (area_id,)).fetchone()
    return r["name"] if r else None


def _values_out(values: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {r: {"value": v["value"], "unit": v["unit"], "available": v["available"], "updated_at": v["updated_at"], "label": cat.ROLES[r][2]} for r, v in values.items()}


def _device_out(conn: sqlite3.Connection, d: sqlite3.Row, *, detail: bool, values: dict[str, dict[str, Any]] | None = None, open_alerts: int | None = None) -> dict[str, Any]:
    values = core.read_values(conn, d["id"]) if values is None else values
    roles = set(values)
    avail = core.availability(values, _mirror_connected())
    value_roles = [r for r in cat.ROLES if not r.startswith("alarm_")]
    types_ok = [t for t in cat.ALERT_TYPES if cat.type_available(t, roles)]
    out: dict[str, Any] = {
        "id": d["id"], "name": d["name"], "area_id": d["area_id"], "area_name": _area_name(conn, d["area_id"]), "status": d["status"], "source_kind": d["source_kind"],
        "rated_kw": d["rated_kw"], "rated_kva": d["rated_kva"], "fuel_type": d["fuel_type"], "detected_at": d["detected_at"], "last_seen_at": d["last_seen_at"], "revision": d["revision"],
        "availability": avail, "stale": avail != "online", "core_met": cat.is_core_met(roles),
        "open_alerts": open_alerts if open_alerts is not None else conn.execute("SELECT COUNT(*) FROM generator_alerts WHERE device_id = ? AND cleared_at IS NULL", (d["id"],)).fetchone()[0],
        "capabilities": {"roles": sorted(roles), "values": sum(1 for r in roles if r in value_roles), "values_total": len(value_roles),
                         "alert_types": len(types_ok), "alert_types_total": len(cat.ALERT_TYPES),
                         "disabled_roles": core.disabled_roles(conn, d["id"]),
                         "missing_core": [r for r in ("engine_state",) if r not in roles] + ([] if any(g in roles for g in cat.GEN_V) else ["gen_voltage"])},
    }
    if detail:
        out["values"] = _values_out(values)
        out["capabilities"]["roles_detail"] = [{"role": r, "label": cat.ROLES[r][2], "unit": cat.ROLES[r][1], "core": cat.is_core(r)} for r in sorted(roles)]
        out["alert_types"] = [{"key": t.key, "group": t.group, "title": t.title_he, "available": cat.type_available(t, roles), "needs": None if cat.type_available(t, roles) else cat.needs_label(t)} for t in cat.ALERT_TYPES]
        out["thresholds"] = core.thresholds(conn, d["id"])
    return out


# ---------------------------------------------------------------- devices

def _open_counts(conn: sqlite3.Connection) -> dict[str, int]:
    return {r[0]: r[1] for r in conn.execute("SELECT device_id, COUNT(*) FROM generator_alerts WHERE cleared_at IS NULL GROUP BY device_id").fetchall()}


@router.get("/generator/devices")
def list_devices(principal: Principal = Depends(_view_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    rows = conn.execute("SELECT * FROM generator_devices WHERE status <> 'removed' ORDER BY name, id").fetchall()
    values, counts = core.read_values_bulk(conn), _open_counts(conn)
    devices = [_device_out(conn, d, detail=False, values=values.get(d["id"], {}), open_alerts=counts.get(d["id"], 0)) for d in rows]
    return {"devices": devices, "detected": sum(1 for d in rows if d["status"] == "detected"), "partial": sum(1 for d in rows if d["status"] == "partial"),
            "open_alerts": sum(counts.values()), "last_detect_at": core.get_setting(conn, "generator.last_detect_at")}


@router.get("/generator/devices/live")
def live_all(principal: Principal = Depends(_view_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """One call for a generator picker: every generator's availability, engine state, mode, supply source, mains, load, fuel and open alerts."""
    rows = conn.execute("SELECT id, name, area_id, status FROM generator_devices WHERE status <> 'removed' ORDER BY name, id").fetchall()
    values, counts, connected = core.read_values_bulk(conn), _open_counts(conn), _mirror_connected()
    keys = ("engine_state", "controller_mode", "supply_source", "ats_position", "mains_available", "on_load", "gen_kw", "load_pct", "fuel_pct", "battery_v")
    items = []
    for d in rows:
        v = values.get(d["id"], {})
        avail = core.availability(v, connected)
        items.append({"id": d["id"], "name": d["name"], "area_id": d["area_id"], "status": d["status"], "availability": avail, "stale": avail != "online",
                      "open_alerts": counts.get(d["id"], 0), "summary": {k: {"value": v[k]["value"], "unit": v[k]["unit"]} for k in keys if k in v and v[k]["available"]}})
    return {"devices": items, "open_alerts": sum(counts.values()), "at": now_iso()}


@router.get("/generator/devices/{device_id}")
def get_device(device_id: str, principal: Principal = Depends(_view_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    return _device_out(conn, _device(conn, device_id), detail=True)


@router.get("/generator/devices/{device_id}/live")
def get_live(device_id: str, principal: Principal = Depends(_view_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    d = _device(conn, device_id)
    values = core.read_values(conn, d["id"])
    avail = core.availability(values, _mirror_connected())
    return {"id": d["id"], "availability": avail, "stale": avail != "online", "values": _values_out(values), "at": now_iso()}


@router.post("/generator/devices/detect")
def run_detect(principal: Principal = Depends(_manage_w), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    now = time.monotonic()
    if len(_DETECT_CALLS) == 3 and now - _DETECT_CALLS[0] < 60:
        raise ApiError(429, "rate_limited", "בדיקה חוזרת אפשרית שלוש פעמים בדקה.")
    _DETECT_CALLS.append(now)
    found = core.detect(conn)
    audit(conn, actor=principal, action="generator.detect", decision="allowed", resource_type="generator_device", resource_id=None, details={"found": len(found)})
    return {"found": found, "count": len(found), "last_detect_at": core.get_setting(conn, "generator.last_detect_at")}


class ManualBody(_Body):
    ha_device_id: str = Field(min_length=1, max_length=128)
    name: str | None = Field(default=None, max_length=80)


@router.get("/generator/device-candidates")
def device_candidates(q: str = Query("", max_length=80), limit: int = Query(50, ge=1, le=200), principal: Principal = Depends(_manage_ro),
                      conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The manual pick: registry devices (display names only) with how many generator roles Arx can map on each."""
    by_device = core._device_entities(conn)
    taken = {r[0] for r in conn.execute("SELECT source_device_ref FROM generator_devices WHERE status <> 'removed'").fetchall()}
    items = []
    for d in conn.execute("SELECT * FROM ha_devices WHERE removed_at IS NULL").fetchall():
        name = core._device_name(d)
        if q and q.lower() not in name.lower():
            continue
        ents = by_device.get(d["device_id"], [])
        if not ents:
            continue
        items.append({"ha_device_id": d["device_id"], "name": name or "ללא שם", "entities": len(ents), "mapped_roles": len(core.map_roles(ents)), "registered": d["device_id"] in taken})
    items.sort(key=lambda x: (-x["mapped_roles"], x["name"]))
    return {"items": items[:limit]}


@router.post("/generator/devices", status_code=201)
def add_device(body: ManualBody, principal: Principal = Depends(_manage_w), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    gid = core.add_manual(conn, body.ha_device_id, body.name)
    if gid is None:
        raise ApiError(404, "device_not_found", "ההתקן לא נמצא ברישום התשתית.")
    audit(conn, actor=principal, action="generator.device.add", decision="allowed", resource_type="generator_device", resource_id=gid)
    return _device_out(conn, _device(conn, gid), detail=True)


class DeviceBody(_Body):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    area_id: str | None = Field(default=None, max_length=128)
    rated_kw: float | None = Field(default=None, gt=0, le=100000)
    rated_kva: float | None = Field(default=None, gt=0, le=100000)
    fuel_type: Literal["diesel", "gas", "petrol", "other"] | None = None
    thresholds: dict[str, float] | None = None
    revision: int | None = None


@router.put("/generator/devices/{device_id}")
def update_device(device_id: str, body: DeviceBody, principal: Principal = Depends(_manage_w), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    d = _device(conn, device_id)
    if body.revision is not None and body.revision != d["revision"]:
        raise ApiError(409, "revision_conflict", "הגנרטור עודכן בינתיים.", details={"revision": d["revision"]})
    sent = body.model_fields_set
    sets: dict[str, Any] = {k: getattr(body, k) for k in ("name", "area_id", "rated_kw", "rated_kva", "fuel_type") if k in sent and (getattr(body, k) is not None or k in ("area_id", "rated_kw", "rated_kva"))}
    if "thresholds" in sent and body.thresholds is not None:
        stored = core.jget(conn, "generator.thresholds", {})
        stored = stored if isinstance(stored, dict) else {}
        part: dict[str, float] = {}
        for k, v in body.thresholds.items():
            lo_hi = cat.THRESHOLD_LIMITS.get(k)
            if lo_hi is None or not lo_hi[0] <= v <= lo_hi[1]:
                raise ApiError(422, "validation", "סף לא תקין: " + k, details={"fields": [f"thresholds.{k}"]})
            part[k] = v
        stored[device_id] = part
        core.jset(conn, "generator.thresholds", stored)
    if sets:
        conn.execute(f"UPDATE generator_devices SET {', '.join(f'{k} = ?' for k in sets)}, revision = revision + 1 WHERE id = ?", (*sets.values(), device_id))
    audit(conn, actor=principal, action="generator.device.update", decision="allowed", resource_type="generator_device", resource_id=device_id)
    return _device_out(conn, _device(conn, device_id), detail=True)


# ---------------------------------------------------------------- sensor mapping

@router.get("/generator/devices/{device_id}/roles")
def get_roles(device_id: str, principal: Principal = Depends(_manage_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _device(conn, device_id)
    mapped = {r["role"]: r for r in conn.execute("SELECT * FROM generator_roles WHERE device_id = ?", (device_id,)).fetchall()}
    names = {r["entity_id"]: (r["name"] or r["original_name"] or "") for r in conn.execute("SELECT entity_id, name, original_name FROM ha_entities").fetchall()}
    cands = core.candidates(conn, device_id)
    overrides = core.overrides(conn, device_id)
    disabled = set(core.disabled_roles(conn, device_id))
    items = []
    for role, (kind, unit, label) in cat.ROLES.items():
        m = mapped.get(role)
        items.append({"role": role, "label": label, "kind": kind, "unit": unit, "core": cat.is_core(role), "mapped": m is not None,
                      "entity_id": m["entity_ref"] if m else None, "entity_name": names.get(m["entity_ref"]) if m else None, "mapped_by": m["mapped_by"] if m else None,
                      "unmapped_by_user": role in overrides and overrides[role] is None, "disabled_in_source": role in disabled, "candidates": cands.get(role, [])[:10]})
    return {"items": items}


class RolesBody(_Body):
    roles: dict[str, str | None]


@router.put("/generator/devices/{device_id}/roles")
def put_roles(device_id: str, body: RolesBody, principal: Principal = Depends(_manage_w), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _device(conn, device_id)
    for role, eid in body.roles.items():
        if role not in cat.ROLES:
            raise ApiError(422, "validation", "תפקיד חיישן לא מוכר.", details={"fields": [f"roles.{role}"]})
        if eid is not None and conn.execute("SELECT 1 FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (eid,)).fetchone() is None:
            raise ApiError(422, "role_unmapped", "החיישן לא נמצא.", details={"fields": [f"roles.{role}"]})
    stored = core.jget(conn, "generator.role_overrides", {})
    stored = stored if isinstance(stored, dict) else {}
    stored.setdefault(device_id, {}).update(body.roles)
    core.jset(conn, "generator.role_overrides", stored)
    core.remap(conn, device_id)
    audit(conn, actor=principal, action="generator.roles.update", decision="allowed", resource_type="generator_device", resource_id=device_id, details={"roles": sorted(body.roles)})
    return _device_out(conn, _device(conn, device_id), detail=True)


# ---------------------------------------------------------------- history

@router.get("/generator/devices/{device_id}/history")
def get_history(device_id: str, roles: str = Query("", max_length=400), range: Literal["1h", "24h", "7d", "30d", "custom"] = "24h",
                start: str | None = Query(None, alias="from", max_length=40), end: str | None = Query(None, alias="to", max_length=40),
                max_points: int = Query(history.DEFAULT_POINTS, ge=10, le=history.MAX_POINTS), principal: Principal = Depends(_view_ro),
                conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _device(conn, device_id)
    have = [r for r in core.roles_of(conn, device_id) if cat.ROLES[r][0] == "num"]
    wanted = [r.strip() for r in roles.split(",") if r.strip()] or sorted(have)
    bad = [r for r in wanted if r not in have]
    if bad:
        raise ApiError(422, "role_unmapped", "אין חיישן כזה בגנרטור.", details={"fields": ["roles"], "roles": bad})
    now_ts = int(time.time())
    try:
        lo, hi = history.parse_range(range, start, end, now_ts, core.int_setting(conn, "history_retention_days"))
    except ValueError as exc:
        raise ApiError(422, "validation", "טווח זמן לא תקין.", details={"fields": [str(exc)]}) from None
    out = history.query(conn, device_id, wanted, lo, hi, max_points, now_ts)
    out["units"] = {r: cat.ROLES[r][1] for r in wanted}
    out["labels"] = {r: cat.ROLES[r][2] for r in wanted}
    out["range"] = range
    return out


# ---------------------------------------------------------------- alerts

@router.get("/generator/alerts")
def get_alerts(device_id: str | None = None, state: Literal["open", "closed"] | None = None, severity: Literal["critical", "alert", "info"] | None = None,
               type: str | None = Query(None, max_length=40), ack: bool | None = None, start: str | None = Query(None, alias="from", max_length=40),
               end: str | None = Query(None, alias="to", max_length=40), before: str | None = Query(None, max_length=40), limit: int = Query(50, ge=1, le=200),
               principal: Principal = Depends(_view_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    return alerts.list_alerts(conn, device_id=device_id, state=state, severity=severity, key=type, ack=ack, start=start, end=end, before=before, limit=limit)


@router.get("/generator/alerts/{alert_id}")
def get_alert(alert_id: str, principal: Principal = Depends(_view_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    d = alerts.alert_detail(conn, alert_id)
    if d is None:
        raise not_found("ההתראה לא נמצאה.")
    return d


class AckBody(_Body):
    note: str | None = Field(default=None, max_length=300)


class MuteBody(_Body):
    hours: int = Field(default=24, ge=1, le=alerts.MUTE_MAX_H)


@router.post("/generator/alerts/{alert_id}/ack")
def ack_alert(alert_id: str, body: AckBody | None = None, principal: Principal = Depends(_view_w), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    if alerts.acknowledge(conn, principal, alert_id, body.note if body else None) == "not_found":
        raise not_found("ההתראה לא נמצאה.")
    return alerts.alert_detail(conn, alert_id) or {}


@router.post("/generator/alerts/{alert_id}/mute")
def mute_alert(alert_id: str, body: MuteBody | None = None, principal: Principal = Depends(_view_w), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    until = alerts.mute(conn, principal, alert_id, body.hours if body else 24)
    if until is None:
        raise not_found("ההתראה לא נמצאה.")
    return {"muted_until": until}


@router.post("/generator/devices/{device_id}/alerts/ack-all")
def ack_all(device_id: str, principal: Principal = Depends(_view_w), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _device(conn, device_id)
    return {"acknowledged": alerts.acknowledge_all(conn, principal, device_id)}


# ---------------------------------------------------------------- routing

@router.get("/generator/devices/{device_id}/policies")
def get_policies(device_id: str, principal: Principal = Depends(_manage_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _device(conn, device_id)
    out = alerts.list_policies(conn, device_id)
    out["roles"] = [{"id": r, "label": {"operator": "מפעילים", "site_admin": "מנהלי אתר", "system_admin": "מנהלי מערכת"}[r]} for r in alerts.ROUTABLE_ROLES]
    return out


class PolicyBody(_Body):
    enabled: bool | None = None
    severity: Literal["critical", "alert", "info"] | None = None
    recipients: dict[str, list[str]] | None = None
    channels: list[str] | None = None
    quiet_mode: Literal["pass", "matrix", "hold"] | None = None
    escalate: bool | None = None
    after_s: int | None = None
    template_he: str | None = Field(default=None, max_length=alerts.TEMPLATE_MAX)  # null = the built-in template; placeholders: alerts.PLACEHOLDERS
    row_version: int | None = None


@router.put("/generator/devices/{device_id}/policies/{alert_key}")
def put_policy(device_id: str, alert_key: str, body: PolicyBody, principal: Principal = Depends(_manage_w), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _device(conn, device_id)
    if alert_key not in cat.TYPE_BY_KEY:
        raise not_found("סוג ההתראה לא נמצא.")
    try:
        return alerts.save_policy(conn, principal, device_id, alert_key, body.model_dump(exclude_unset=True))
    except alerts.RoutingInvalid as exc:
        status = 409 if exc.code == "revision_conflict" else 400 if exc.code == "template_invalid" else 422
        raise ApiError(status, exc.code, exc.message, details=exc.details) from None


class PreviewBody(_Body):
    template_he: str | None = Field(default=None, max_length=alerts.TEMPLATE_MAX)


@router.post("/generator/devices/{device_id}/policies/{alert_key}/preview")
def preview_policy(device_id: str, alert_key: str, body: PreviewBody, principal: Principal = Depends(_manage_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The message as it would read, with sample values; nothing is stored or sent."""
    _device(conn, device_id)
    if alert_key not in cat.TYPE_BY_KEY:
        raise not_found("סוג ההתראה לא נמצא.")
    try:
        return {"text": alerts.render_preview(alerts.validate_template(body.template_he), alert_key)}
    except alerts.RoutingInvalid as exc:
        raise ApiError(400, exc.code, exc.message, details=exc.details) from None


@router.post("/generator/devices/{device_id}/policies/reset")
def reset_policies(device_id: str, principal: Principal = Depends(_manage_w), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _device(conn, device_id)
    return {"reset": alerts.reset_policies(conn, principal, device_id)}


# ---------------------------------------------------------------- settings

class SettingsBody(_Body):
    integration_domains: list[str] | None = Field(default=None, max_length=20)
    thresholds: dict[str, float] | None = None
    alert_retention_days: int | None = None
    history_retention_days: int | None = None
    stale_after_s: int | None = None


def _settings_out(conn: sqlite3.Connection) -> dict[str, Any]:
    stored = core.jget(conn, "generator.thresholds", {})
    mine = core.jget(conn, "generator.integration_domains", [])
    return {"integration_domains": mine if isinstance(mine, list) else [], "known_domains": list(cat.KNOWN_DOMAINS), "thresholds": core.thresholds(conn), "threshold_defaults": cat.DEFAULT_THRESHOLDS,
            "threshold_limits": {k: list(v) for k, v in cat.THRESHOLD_LIMITS.items()}, "thresholds_set": sorted((stored.get("default") or {}).keys()) if isinstance(stored, dict) else [],
            "alert_retention_days": core.int_setting(conn, "alert_retention_days"), "history_retention_days": core.int_setting(conn, "history_retention_days"),
            "stale_after_s": core.int_setting(conn, "stale_after_s"), "limits": {k: list(v[:2]) for k, v in cat.RETENTION_LIMITS.items()}}


@router.get("/generator/settings")
def get_settings(principal: Principal = Depends(_manage_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    return _settings_out(conn)


@router.put("/generator/settings")
def put_settings(body: SettingsBody, principal: Principal = Depends(_manage_w), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    sent = body.model_fields_set
    if "integration_domains" in sent and body.integration_domains is not None:
        doms = sorted({d.strip().lower() for d in body.integration_domains if d.strip()})
        if any(len(d) > 60 or not all(c.isalnum() or c in "_-" for c in d) for d in doms):
            raise ApiError(422, "validation", "שם תשתית לא תקין.", details={"fields": ["integration_domains"]})
        core.jset(conn, "generator.integration_domains", doms)
    if "thresholds" in sent and body.thresholds is not None:
        for k, v in body.thresholds.items():
            lo_hi = cat.THRESHOLD_LIMITS.get(k)
            if lo_hi is None or not lo_hi[0] <= v <= lo_hi[1]:
                raise ApiError(422, "validation", "סף לא תקין: " + k, details={"fields": [f"thresholds.{k}"]})
        stored = core.jget(conn, "generator.thresholds", {})
        stored = stored if isinstance(stored, dict) else {}
        stored["default"] = dict(body.thresholds)
        core.jset(conn, "generator.thresholds", stored)
    for name in ("alert_retention_days", "history_retention_days", "stale_after_s"):
        if name in sent and getattr(body, name) is not None:
            lo, hi, _d = cat.RETENTION_LIMITS[name]
            v = getattr(body, name)
            if not lo <= v <= hi:
                raise ApiError(422, "validation", "ערך מחוץ לטווח.", details={"fields": [name]})
            core.jset(conn, f"generator.{name}", v)
    audit(conn, actor=principal, action="generator.settings.update", decision="allowed", resource_type="generator_settings", resource_id=None, details={"keys": sorted(sent)})
    return _settings_out(conn)

