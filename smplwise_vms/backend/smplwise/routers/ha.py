"""Home Assistant entities API (chapters 14/15): catalogue, per-entity detail, safe actions through the bridge,
live state push, and the bridge pairing/directory endpoints."""
from __future__ import annotations

import asyncio
import datetime as dt
import json
import queue
import socket
import sqlite3
import time
import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query, Request, WebSocket
from pydantic import BaseModel, ConfigDict, Field
from starlette.concurrency import run_in_threadpool

from ..audit import audit
from ..auth import current_principal, get_conn, settings_of
from ..config import Settings
from ..db import unlocked, Database, bump_permission_revision, get_setting, now_iso, set_setting
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, require
from ..services import bridge_install, ha_bridge, ha_client, ha_sync
from ..services.timeutil import iso_utc, parse_utc
from .media import _principal_for_ws

router = APIRouter()


# ---------------------------------------------------------------- scoping

def _visible_floors(conn: sqlite3.Connection, principal: Principal, permission: str) -> tuple[bool, set[str]]:
    if authorize(conn, principal, permission, INSTALLATION).allowed:
        return True, set()
    floors = {f["id"] for f in conn.execute("SELECT id FROM floors WHERE deleted_at IS NULL").fetchall() if authorize(conn, principal, permission, ("floor", f["id"])).allowed}
    return False, floors


def _placements(conn: sqlite3.Connection) -> dict[str, list[dict[str, str]]]:
    """Where an entity is on the maps: its anchors, and the floors whose published structure has a circuit switched by
    it (T085) - a floor viewer reads such a switch, a floor operator controls it, the push socket forwards it."""
    out: dict[str, list[dict[str, str]]] = {}
    for r in conn.execute(
        "SELECT a.resource_id, a.floor_id, f.name AS floor_name FROM map_anchors a JOIN floors f ON f.id = a.floor_id WHERE a.resource_type = 'ha_entity' AND a.effective_to IS NULL"
    ).fetchall():
        out.setdefault(r["resource_id"], []).append({"floor_id": r["floor_id"], "floor_name": r["floor_name"]})
    from ..services import geometry_store

    switches = geometry_store.circuit_switches(conn)
    if switches:
        names = {r["id"]: r["name"] for r in conn.execute("SELECT id, name FROM floors WHERE deleted_at IS NULL").fetchall()}
        for eid, floors in switches.items():
            have = {p["floor_id"] for p in out.get(eid, [])}
            for fid in floors:
                if fid in names and fid not in have:
                    out.setdefault(eid, []).append({"floor_id": fid, "floor_name": names[fid]})
                    have.add(fid)
    return out


def _entity_allowed(conn: sqlite3.Connection, principal: Principal, entity_id: str, permission: str) -> bool:
    wide, floors = _visible_floors(conn, principal, permission)
    if wide:
        return True
    placed = _placements(conn).get(entity_id, [])
    return any(p["floor_id"] in floors for p in placed)


def _grant_label(permission: str) -> str:
    from .access import PERMISSION_LABELS  # the one Hebrew label catalogue (lazy: routers stay independent)

    return PERMISSION_LABELS.get(permission, permission)


def _entity(conn: sqlite3.Connection, entity_id: str) -> dict[str, Any]:
    row = conn.execute("SELECT * FROM ha_entities WHERE entity_id = ?", (entity_id,)).fetchone()
    if not row:
        raise ApiError(404, "not_found", "הישות לא נמצאה בקטלוג.")
    return ha_sync.entity_row(row)


# ---------------------------------------------------------------- catalogue

@router.get("/ha/status")
def status(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    settings = settings_of(request)
    paired_at = get_setting(conn, "bridge.paired_at") or None
    return {
        "configured": ha_client.configured(settings),
        "sync": ha_sync.STATE.as_dict(),
        "bridge": {"paired": bool(get_setting(conn, "bridge.secret")) and bool(paired_at), "paired_at": paired_at, "directory_users": conn.execute("SELECT COUNT(*) FROM ha_users").fetchone()[0], "last_directory_at": get_setting(conn, "bridge.directory_at") or None},
        "integration": bridge_install.status(conn=conn),
        "can_configure": authorize(conn, principal, "system.configure", INSTALLATION).allowed,
    }


@router.get("/ha/entities")
def list_entities(
    principal: Principal = Depends(current_principal),
    conn: sqlite3.Connection = Depends(get_conn),
    domain: str | None = Query(None, pattern="^[a-z_]+$"),
    q: str | None = None,
    area: str | None = None,
    placed: bool | None = None,
    include_disabled: bool = False,
    limit: int = Query(500, ge=1, le=2000),
) -> dict[str, Any]:
    """The catalogue: everything for installation-wide readers, only placed entities on visible floors otherwise."""
    wide, floors = _visible_floors(conn, principal, "entity.state.read")
    placements = _placements(conn)
    if not wide and not floors:
        require(conn, principal, "entity.state.read", INSTALLATION)
    sql = "SELECT * FROM ha_entities WHERE removed_at IS NULL"
    args: list[Any] = []
    if not include_disabled:
        sql += " AND disabled = 0"
    if domain:
        sql += " AND domain = ?"
        args.append(domain)
    if area:
        sql += " AND (area_id = ? OR area_name = ?)"
        args.extend([area, area])
    if q:
        sql += " AND (entity_id LIKE ? OR name LIKE ? OR area_name LIKE ?)"
        like = f"%{q}%"
        args.extend([like, like, like])
    sql += " ORDER BY domain, name, entity_id LIMIT ?"
    args.append(limit)
    rows = [ha_sync.entity_row(r) for r in conn.execute(sql, args).fetchall()]
    out = []
    for r in rows:
        pl = placements.get(r["entity_id"], [])
        if not wide and not any(p["floor_id"] in floors for p in pl):
            continue
        if placed is True and not pl:
            continue
        if placed is False and pl:
            continue
        r["placements"] = pl
        r["actions"] = ha_bridge.actions_for(r["domain"])
        out.append(r)
    domains: dict[str, int] = {}
    for r in conn.execute("SELECT domain, COUNT(*) AS n FROM ha_entities WHERE removed_at IS NULL AND disabled = 0 GROUP BY domain").fetchall():
        domains[r["domain"]] = r["n"]
    areas = [dict(r) for r in conn.execute("SELECT DISTINCT area_id, area_name FROM ha_entities WHERE area_id IS NOT NULL ORDER BY area_name").fetchall()]
    return {"entities": out, "domains": domains, "areas": areas, "sync": ha_sync.STATE.as_dict(), "can_control": authorize(conn, principal, "ha.entity.control", INSTALLATION).allowed or bool(_visible_floors(conn, principal, "ha.entity.control")[1])}


@router.get("/ha/entities/{entity_id}")
def get_entity(entity_id: str, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    if not _entity_allowed(conn, principal, entity_id, "entity.state.read"):
        require(conn, principal, "entity.state.read", INSTALLATION)
    e = _entity(conn, entity_id)
    e["placements"] = _placements(conn).get(entity_id, [])
    e["can_control"] = _entity_allowed(conn, principal, entity_id, "ha.entity.control")
    # each action says whether this caller holds it: control plus the action's own grant when it has one (T079)
    e["actions"] = [{**a, "granted": e["can_control"] and (not a["grant"] or _entity_allowed(conn, principal, entity_id, a["grant"]))} for a in ha_bridge.actions_for(e["domain"])]
    e["recent_actions"] = [dict(r) for r in conn.execute("SELECT id, action_id, status, requested_at, confirmed_at, principal_username, error FROM ha_actions WHERE entity_id = ? ORDER BY requested_at DESC, rowid DESC LIMIT 5", (entity_id,)).fetchall()]
    return e


# ---------------------------------------------------------------- actions (through the bridge only)

class ActionBody(BaseModel):
    """contracts/schemas/entity-action.schema.json — closed: the body never carries an identity or a raw service call (T079)."""
    model_config = ConfigDict(extra="forbid")
    entity_binding_id: str | None = None
    allowed_action_id: str = Field(min_length=1, max_length=60)
    arguments: dict[str, Any] = Field(default_factory=dict)
    expected_state_version: str | None = None
    confirmation_grant: str | None = None
    client_request_id: str = Field(min_length=1, max_length=80)
    expires_at: str


def _action_row(conn: sqlite3.Connection, action_id: str) -> dict[str, Any]:
    r = conn.execute("SELECT * FROM ha_actions WHERE id = ?", (action_id,)).fetchone()
    if not r:
        raise ApiError(404, "not_found", "הפעולה לא נמצאה.")
    d = dict(r)
    d["arguments"] = json.loads(d.pop("arguments_json") or "{}")
    return d


@router.post("/ha/entities/{entity_id}/actions", status_code=202)
def run_action(entity_id: str, body: ActionBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    settings = settings_of(request)
    if not _entity_allowed(conn, principal, entity_id, "ha.entity.control"):
        require(conn, principal, "ha.entity.control", INSTALLATION)
    e = _entity(conn, entity_id)
    if e["removed_at"] or e["disabled"]:
        raise ApiError(409, "entity_unavailable", "הישות אינה זמינה ב־Home Assistant.")
    try:
        expires = parse_utc(body.expires_at)
    except ValueError:
        raise ApiError(422, "validation", "expires_at חייב להיות UTC (Z).")
    if expires < dt.datetime.now(dt.timezone.utc):
        raise ApiError(409, "expired", "הבקשה פגה; נסה שוב.")
    existing = conn.execute("SELECT * FROM ha_actions WHERE principal_user_id = ? AND client_request_id = ?", (principal.user_id, body.client_request_id)).fetchone()
    if existing:
        return _action_row(conn, existing["id"])  # idempotent: a duplicate click never sends twice
    spec, data = ha_bridge.validate_action(body.allowed_action_id, entity_id, body.arguments)
    grant = spec.get("grant")
    if grant and not _entity_allowed(conn, principal, entity_id, grant):
        # unlock and its kind need their own grant; general entity control never implies them (T079)
        audit(conn, actor=principal, action="ha.action", decision="denied", resource_type="ha_entity", resource_id=entity_id, reason="grant_required",
              request_id=getattr(request.state, "correlation_id", None), details={"action": body.allowed_action_id, "grant": grant})
        raise ApiError(403, "grant_required", f"הפעולה דורשת הרשאה נפרדת ({_grant_label(grant)}); שליטה כללית בישויות אינה כוללת אותה.", details={"action": body.allowed_action_id, "grant": grant})
    if spec["sensitive"] and body.confirmation_grant != "confirmed":
        raise ApiError(409, "confirmation_required", "פעולה רגישה דורשת אישור מפורש.", details={"action": body.allowed_action_id})
    if principal.source != "ingress" and not settings.dev_user:
        raise ApiError(403, "identity_unmapped", "לא ניתן למפות את הזהות לפעולת HA.")
    secret = ha_bridge.signing_key(conn)
    paired = bool(secret) and bool(get_setting(conn, "bridge.paired_at"))
    aid, now = uuid.uuid4().hex[:12], now_iso()
    conn.execute(
        "INSERT INTO ha_actions(id, entity_id, action_id, arguments_json, principal_user_id, principal_username, client_request_id, status, requested_at, expected_state, via) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (aid, entity_id, body.allowed_action_id, json.dumps(body.arguments, ensure_ascii=False), principal.user_id, principal.username, body.client_request_id, "pending", now, spec["expect"], "bridge"),
    )
    if not paired:
        conn.execute("UPDATE ha_actions SET status = 'failed', error = 'bridge_not_paired', responded_at = ? WHERE id = ?", (now_iso(), aid))
        audit(conn, actor=principal, action="ha.action", decision="denied", resource_type="ha_entity", resource_id=entity_id, reason="bridge_not_paired",
              request_id=getattr(request.state, "correlation_id", None), details={"action": body.allowed_action_id, "id": aid})
        raise ApiError(503, "bridge_not_paired", "פעולות HA דורשות את גשר SMPLWISE מותקן ומצומד ב־Home Assistant.", details={"action_id": aid})
    payload = ha_bridge.sign(secret or "", {"user_id": principal.user_id, "domain": spec["domain"], "service": spec["service"], "data": data, "request_id": aid})
    try:
        with unlocked(conn):
            result = ha_client.call_bridge_execute(settings, payload)
    except ApiError as exc:
        conn.execute("UPDATE ha_actions SET status = 'failed', error = ?, responded_at = ? WHERE id = ?", (exc.code, now_iso(), aid))
        audit(conn, actor=principal, action="ha.action", decision="allowed", resource_type="ha_entity", resource_id=entity_id, reason=exc.code,
              request_id=getattr(request.state, "correlation_id", None), details={"action": body.allowed_action_id, "id": aid, "status": "failed"})
        raise
    ok = bool(result.get("ok"))
    error = None if ok else str(result.get("error") or "bridge_error")
    if error in ("unauthorized", "unknown_user"):
        error = "ha_" + error  # Home Assistant's own answer about this user: a denial, whatever the bridge token could do
    status = "pending" if ok else ("denied" if error in ("ha_unauthorized", "ha_unknown_user") else "failed")
    conn.execute("UPDATE ha_actions SET status = ?, error = ?, responded_at = ? WHERE id = ?", (status, error, now_iso(), aid))
    audit(conn, actor=principal, action="ha.action", decision="allowed" if ok else "denied", resource_type="ha_entity", resource_id=entity_id, reason=error,
          request_id=getattr(request.state, "correlation_id", None), details={"action": body.allowed_action_id, "id": aid, "arguments": body.arguments, "sensitive": spec["sensitive"]})
    out = _action_row(conn, aid)
    out["note"] = "הבקשה התקבלה; המצב מאושר רק כשמגיע עדכון מ־Home Assistant." if ok else None
    return out


@router.get("/ha/actions/{action_id}")
def get_action(action_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Poll a pending action: confirmed when the entity reached the expected state after the request, unknown after 20 s."""
    a = _action_row(conn, action_id)
    if a["principal_user_id"] != principal.user_id and not authorize(conn, principal, "system.configure", INSTALLATION).allowed:
        raise ApiError(403, "forbidden", "הפעולה שייכת למשתמש אחר.")
    if a["status"] == "pending":
        e = conn.execute("SELECT state, last_changed, state_seen_at FROM ha_entities WHERE entity_id = ?", (a["entity_id"],)).fetchone()
        requested = parse_utc(a["requested_at"])
        if e and a["expected_state"] and e["state"] == a["expected_state"] and e["last_changed"] and parse_utc(e["last_changed"].replace("+00:00", "Z")) >= requested - dt.timedelta(seconds=2):
            conn.execute("UPDATE ha_actions SET status = 'confirmed', confirmed_at = ?, observed_state = ? WHERE id = ?", (now_iso(), e["state"], action_id))
        elif e and not a["expected_state"]:
            conn.execute("UPDATE ha_actions SET status = 'confirmed', confirmed_at = ?, observed_state = ? WHERE id = ?", (now_iso(), e["state"], action_id))
        elif (dt.datetime.now(dt.timezone.utc) - requested).total_seconds() > 20:
            conn.execute("UPDATE ha_actions SET status = 'unknown', observed_state = ? WHERE id = ?", (e["state"] if e else None, action_id))
        a = _action_row(conn, action_id)
    return a


# ---------------------------------------------------------------- developer identity mode only

class DevStatesIn(BaseModel):
    states: list[dict[str, Any]] = Field(min_length=1, max_length=50)


def _dev_only(settings: Settings) -> None:
    """The route exists only where SW_DEV_USER runs the backend outside the add-on: inside Home Assistant it is a 404."""
    if settings.in_addon or not settings.dev_user:
        raise ApiError(404, "not_found", "לא נמצא.")


@router.post("/ha/dev/states")
def dev_states(body: DevStatesIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Inject entity states as if Home Assistant sent them (the same upsert and the same push the sync uses), for live
    specs and manual checks without a Home Assistant. Developer identity mode only; system.configure; audited."""
    _dev_only(settings_of(request))
    require(conn, principal, "system.configure", INSTALLATION)
    now = now_iso()
    rows = []
    for st in body.states:
        eid = st.get("entity_id")
        if not isinstance(eid, str) or "." not in eid:
            raise ApiError(422, "validation", "לכל מצב צריך entity_id.")
        row = ha_sync.upsert_state(conn, {"entity_id": eid, "state": str(st.get("state")), "attributes": st.get("attributes") or {}, "last_changed": now, "last_updated": now})
        ha_sync.STATE.sequence += 1
        ha_sync.publish({"type": "entity_state_changed", "sequence": ha_sync.STATE.sequence, "entity": row})
        rows.append(row)
    audit(conn, actor=principal, action="ha.dev.states", decision="allowed", resource_type="installation", resource_id="*", request_id=getattr(request.state, "correlation_id", None),
          details={"entities": [r["entity_id"] for r in rows]})
    return {"entities": rows}


# ---------------------------------------------------------------- bridge pairing + directory (integration side)

@router.post("/ha/bridge/install")
def bridge_install_now(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Copy the integration into Home Assistant's config directory again and re-announce it (system.configure)."""
    require(conn, principal, "system.configure", INSTALLATION)
    audit(conn, actor=principal, action="bridge.install", decision="allowed", resource_type="installation", resource_id="*", request_id=getattr(request.state, "correlation_id", None))
    db: Database = request.app.state.db
    return bridge_install.install(db, settings_of(request), force=True, announce=True, conn=conn)


@router.get("/ha/bridge/pairing")
def pairing(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn), regenerate: bool = False) -> dict[str, Any]:
    require(conn, principal, "system.configure", INSTALLATION)
    secret = ha_bridge.ensure_pairing(conn, regenerate=regenerate)
    if regenerate:
        audit(conn, actor=principal, action="bridge.pairing.regenerate", decision="allowed", resource_type="installation", resource_id="*", request_id=getattr(request.state, "correlation_id", None))
    host = socket.gethostname()
    return {"pairing_code": secret, "addon_host": host, "addon_url": f"http://{host}:8099", "paired_at": get_setting(conn, "bridge.paired_at") or None}


@router.post("/ha/bridge/ping")
def bridge_ping(message: dict[str, Any], conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Called by the integration during its config flow: proves the pairing code and marks the bridge paired."""
    ha_bridge.verify(ha_bridge.signing_key(conn), message)
    set_setting(conn, "bridge.paired_at", now_iso())
    set_setting(conn, "bridge.integration_version", str(message.get("version") or ""))
    audit(conn, actor=None, action="bridge.paired", decision="allowed", resource_type="installation", resource_id="*", details={"integration_version": message.get("version")})
    return {"ok": True, "paired_at": get_setting(conn, "bridge.paired_at")}


@router.post("/ha/bridge/directory")
def bridge_directory(message: dict[str, Any], request: Request, conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Signed user directory push from the integration (id, name, username, active, admin, groups)."""
    ha_bridge.verify(ha_bridge.signing_key(conn), message)
    users = message.get("users") or []
    now = now_iso()
    for u in users:
        if not u.get("id"):
            continue
        conn.execute(
            "INSERT INTO ha_users(id, name, username, is_active, is_admin, group_ids_json, synced_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, username = excluded.username, is_active = excluded.is_active, is_admin = excluded.is_admin, group_ids_json = excluded.group_ids_json, synced_at = excluded.synced_at",
            (u["id"], u.get("name"), u.get("username"), 1 if u.get("is_active", True) else 0, 1 if u.get("is_admin") else 0, json.dumps(u.get("group_ids") or []), now),
        )
    ids = [u["id"] for u in users if u.get("id")]
    if ids:
        conn.execute(f"UPDATE ha_users SET is_active = 0 WHERE id NOT IN ({','.join('?' * len(ids))})", ids)
    _apply_directory_to_users(conn, request, {u["id"]: u for u in users if u.get("id")})
    set_setting(conn, "bridge.directory_at", now)
    if not get_setting(conn, "bridge.paired_at"):
        set_setting(conn, "bridge.paired_at", now)
    # the running integration's version travels with every push: recording it only at pairing left the connections
    # page saying "HA still runs <old>" forever after an update + restart (0.1.58)
    version = str(message.get("version") or "")
    if version and version != (get_setting(conn, "bridge.integration_version") or ""):
        set_setting(conn, "bridge.integration_version", version)
        audit(conn, actor=None, action="bridge.version_seen", decision="allowed", resource_type="installation", resource_id="*", details={"integration_version": version})
    return {"ok": True, "users": len(ids)}


def _apply_directory_to_users(conn: sqlite3.Connection, request: Request, pushed: dict[str, dict[str, Any]]) -> None:
    """Mirror HA's active flag onto users seen through Ingress: disabled or deleted in HA means no access here
    (observed at the next push, within 60 s); audit keeps the id. A current VMS administrator is never dropped
    merely because a push omitted him (that needs an explicit is_active=false from HA), so a bridge hiccup
    cannot lock the installation."""
    from ..services import revocation

    admins = {r["subject_id"] for r in conn.execute("SELECT subject_id FROM bindings WHERE subject_kind = 'user' AND role_id = 'system_admin' AND scope_type = 'installation' AND effect = 'allow' AND revoked_at IS NULL").fetchall()}
    disabled: list[str] = []
    for r in conn.execute("SELECT id, active FROM users WHERE source = 'ingress'").fetchall():
        p = pushed.get(r["id"])
        if p is None:
            active_now = 1 if r["id"] in admins else 0
        else:
            active_now = 1 if p.get("is_active", True) else 0
        if active_now == r["active"]:
            continue
        conn.execute("UPDATE users SET active = ? WHERE id = ?", (active_now, r["id"]))
        audit(conn, actor=None, action="identity.user_enabled" if active_now else "identity.user_disabled", decision="allowed", resource_type="user", resource_id=r["id"],
              reason="ha_directory" if p is not None else "missing_from_directory", request_id=getattr(request.state, "correlation_id", None))
        if not active_now:
            disabled.append(r["id"])
    if disabled:
        bump_permission_revision(conn)
        revocation.mark(disabled)


# ---------------------------------------------------------------- live push

@router.websocket("/ha/ws")
async def ha_ws(websocket: WebSocket) -> None:
    db: Database = websocket.app.state.db
    principal = await _principal_for_ws(websocket)
    if principal is None:
        await websocket.close(code=4401)
        return

    def _scope() -> tuple[bool, set[str], dict[str, list[dict[str, str]]]]:
        with db.connection() as conn:
            wide, floors = _visible_floors(conn, principal, "entity.state.read")
            return wide, floors, _placements(conn)

    wide, floors, placements = await run_in_threadpool(_scope)
    if not wide and not floors:
        await websocket.close(code=4403)
        return
    await websocket.accept()
    q = ha_sync.subscribe()
    seq = 0
    last_scope = time.time()
    try:
        while True:
            try:
                msg = await asyncio.wait_for(asyncio.get_event_loop().run_in_executor(None, q.get, True, 30), timeout=31)
            except (asyncio.TimeoutError, queue.Empty):
                seq += 1
                await websocket.send_text(json.dumps({"version": 1, "type": "heartbeat", "sequence": seq, "subscription_id": principal.user_id, "occurred_at": now_iso(), "received_at": now_iso(), "payload": {"sync": ha_sync.STATE.as_dict()}}))
                continue
            if time.time() - last_scope > 60:
                wide, floors, placements = await run_in_threadpool(_scope)
                last_scope = time.time()
            if msg.get("type") == "entity_state_changed":
                eid = msg["entity"]["entity_id"]
                if not wide and not any(p["floor_id"] in floors for p in placements.get(eid, [])):
                    continue
            seq += 1
            await websocket.send_text(json.dumps({"version": 1, "type": msg.get("type"), "sequence": seq, "subscription_id": principal.user_id, "occurred_at": now_iso(), "received_at": now_iso(), "payload": msg}, ensure_ascii=False, default=str))
    except Exception:
        pass
    finally:
        ha_sync.unsubscribe(q)
