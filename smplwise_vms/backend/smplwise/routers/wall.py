"""Wall display (CR-030 v2, WDM S1): per-user wall profiles, the display's own reads and its websocket.

A wall tablet is an ordinary user bound to the existing `kiosk` role (live video and map only) plus `wall.view`, the one
read-only permission of these routes. The camera allow list is the user's camera-scope `kiosk` bindings, written here
through the same validated binding path as the access screen; the profile stores order and layout. The client's device
classification is presentation only - nothing in this module looks at it."""
from __future__ import annotations

import asyncio
import json
import sqlite3
import time
from typing import Any

from fastapi import APIRouter, Depends, Query, Request, WebSocket
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from starlette.concurrency import run_in_threadpool

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..db import Database, get_setting, now_iso
from ..errors import ApiError, forbidden, not_found
from ..rbac import INSTALLATION, Principal, permissions_anywhere, require
from ..services import revocation, wall
from ..services.access import visible_camera_ids
from .access import BindingBody, insert_binding, revoke_one, user_known, validate_binding

router = APIRouter()

WALL_VIEW = "wall.view"
WS_POLL_S = 1.0
WS_HEARTBEAT_STORE_S = 30.0


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _names(conn: sqlite3.Connection) -> dict[str, str]:
    rows = conn.execute("SELECT id, alias, name_source, channel FROM cameras").fetchall()
    return {r["id"]: (r["alias"] or r["name_source"] or f"ערוץ {r['channel']}") for r in rows}


def _wall_user(conn: sqlite3.Connection, principal: Principal) -> sqlite3.Row:
    """403 for a caller without `wall.view` or without an enabled profile: a user without a profile gets nothing from wall/*."""
    if WALL_VIEW not in permissions_anywhere(conn, principal):
        raise forbidden("אין הרשאה למסך קיר.", permission=WALL_VIEW)
    row = wall.enabled_profile(conn, principal.user_id)
    if row is None:
        raise ApiError(403, "wall_not_configured", "למשתמש הזה אין מסך קיר פעיל.")
    return row


def _scope_of(conn: sqlite3.Connection, principal: Principal, row: sqlite3.Row, cfg: dict[str, Any]) -> list[dict[str, str]]:
    """The cameras the display shows: its configured order, limited to what the user's bindings really allow."""
    visible = visible_camera_ids(conn, principal, "video.live")
    names = _names(conn)
    order = [c for c in cfg["cameras"] if c in names and (visible is None or c in visible)]
    if not order and cfg["scope"] == "floor":
        pool = sorted(names, key=lambda c: names[c].casefold()) if visible is None else sorted(visible & set(names), key=lambda c: names[c].casefold())
        order = pool[: wall.MAX_CAMERAS]
    return [{"id": c, "name": names[c]} for c in order]


@router.get("/wall/config")
def wall_config(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    row = _wall_user(conn, principal)
    cfg = wall.config_of(row)
    from ..remote_channel import channel_of

    channel = channel_of(request)
    wall.touch_seen(conn, principal.user_id, channel)
    return {
        "title": row["title"], "area_id": row["area_id"], "floor_id": row["floor_id"], "version": int(row["version"]),
        "config": cfg, "cameras": _scope_of(conn, principal, row, cfg),
        "server_time": now_iso(), "zone": get_setting(conn, "time.zone", "Asia/Jerusalem"),
        "alerts": [],  # WDX (S6) delivers alert tiles; the contract field exists so the client does not change later
    }


@router.get("/wall/states")
def wall_states(ids: str = Query("", max_length=1000), principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Only the state chips the profile lists: the role does not hold entity.state.read, the server filters."""
    row = _wall_user(conn, principal)
    allowed = set(wall.config_of(row)["state_entities"])
    wanted = [i for i in (s.strip() for s in ids.split(",")) if i and i in allowed]
    out = []
    for eid in wanted:
        r = conn.execute("SELECT entity_id, state, unit, original_name, available FROM ha_entities WHERE entity_id = ?", (eid,)).fetchone()
        if r is not None:
            out.append({"id": r["entity_id"], "state": r["state"] if r["available"] else "unavailable", "unit": r["unit"], "name": r["original_name"] or r["entity_id"]})
    return {"states": out}


# ---- administration (Settings > wall displays)
class ProfileCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    user_id: str = Field(min_length=1, max_length=200)
    title: str = Field(min_length=1, max_length=40)
    floor_id: str | None = Field(default=None, max_length=200)  # "everything on this floor"
    area_id: str | None = Field(default=None, max_length=200)
    cameras: list[str] = Field(default_factory=list, max_length=wall.MAX_CAMERAS)


class ProfilePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str | None = Field(default=None, min_length=1, max_length=40)
    area_id: str | None = Field(default=None, max_length=200)
    enabled: bool | None = None
    remote_allowed: bool | None = None
    config: dict[str, Any] | None = None  # a partial WallConfig, merged and validated in full


def _need_admin(conn: sqlite3.Connection, principal: Principal) -> None:
    require(conn, principal, "system.configure", INSTALLATION)


def _kiosk_bindings(conn: sqlite3.Connection, user_id: str) -> list[sqlite3.Row]:
    return conn.execute(
        "SELECT * FROM bindings WHERE subject_kind = 'user' AND subject_id = ? AND role_id = ? AND effect = 'allow' AND revoked_at IS NULL", (user_id, wall.KIOSK_ROLE)
    ).fetchall()


def _sync_bindings(conn: sqlite3.Connection, principal: Principal, request: Request, user_id: str, *, floor_id: str | None, cameras: list[str]) -> None:
    """Make the user's kiosk bindings equal the wanted set: one floor binding, or one camera binding per listed camera."""
    want = {("floor", floor_id)} if floor_id else {("camera", c) for c in cameras}
    have = {(b["scope_type"], b["scope_id"]): b for b in _kiosk_bindings(conn, user_id)}
    for key, b in have.items():
        if key not in want:
            revoke_one(conn, principal, request, b)
    for scope_type, scope_id in sorted(want):
        if (scope_type, scope_id) in have:
            continue
        body = BindingBody(subject_kind="user", subject_id=user_id, role_id=wall.KIOSK_ROLE, scope_type=scope_type, scope_id=scope_id)
        validate_binding(conn, principal, body)
        insert_binding(conn, principal, request, body, extra_audit={"via": "wall"})


def _check_cameras(conn: sqlite3.Connection, cameras: list[str]) -> list[str]:
    seen: list[str] = []
    for cid in cameras:
        if cid in seen:
            continue
        if not conn.execute("SELECT 1 FROM cameras WHERE id = ?", (cid,)).fetchone():
            raise ApiError(422, "validation", "מצלמה לא נמצאה.", details={"camera_id": cid})
        seen.append(cid)
    return seen


def _check_entities(conn: sqlite3.Connection, ids: list[str]) -> None:
    for eid in ids:
        if not conn.execute("SELECT 1 FROM ha_entities WHERE entity_id = ?", (eid,)).fetchone():
            raise ApiError(422, "validation", "ישות לא נמצאה.", details={"entity_id": eid})


@router.get("/wall/profiles")
def list_profiles(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _need_admin(conn, principal)
    names = _names(conn)
    rows = conn.execute("SELECT * FROM wall_profiles ORDER BY title COLLATE NOCASE").fetchall()
    return {"profiles": [wall.profile_dict(conn, r, names) for r in rows], "max_profiles": wall.max_profiles(conn)}


@router.get("/wall/candidates")
def candidates(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Existing users that are not wall users yet - the add dialog's picker. The product never creates accounts (CR-001)."""
    _need_admin(conn, principal)
    rows = conn.execute(
        "SELECT id, username, name FROM ha_users WHERE is_active = 1 AND id NOT IN (SELECT user_id FROM wall_profiles) ORDER BY COALESCE(name, username) COLLATE NOCASE"
    ).fetchall()
    return {"users": [{"id": r["id"], "username": r["username"] or "", "display_name": r["name"] or r["username"] or ""} for r in rows]}


@router.get("/wall/profiles/{user_id}")
def get_profile(user_id: str, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _need_admin(conn, principal)
    row = wall.profile_row(conn, user_id)
    if row is None:
        raise not_found("מסך הקיר לא נמצא.")
    return wall.profile_dict(conn, row, _names(conn))


@router.post("/wall/profiles", status_code=201)
def create_profile(body: ProfileCreate, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """One transaction: the kiosk binding(s), the profile with defaults, the audit row. A failure rolls all of it back."""
    _need_admin(conn, principal)
    require(conn, principal, "rbac.assign", INSTALLATION)
    if not user_known(conn, body.user_id):
        raise ApiError(404, "user_unknown", "המשתמש לא נמצא בספריית Home Assistant.")
    if wall.profile_row(conn, body.user_id) is not None:
        raise ApiError(409, "wall_profile_exists", "למשתמש הזה כבר יש מסך קיר.")
    count = conn.execute("SELECT COUNT(*) AS n FROM wall_profiles").fetchone()["n"]
    if count >= wall.max_profiles(conn):
        raise ApiError(409, "wall_profile_limit", "הגעת למספר המסכים המרבי.", details={"max": wall.max_profiles(conn)})
    cameras = _check_cameras(conn, body.cameras)
    cfg = wall.default_config()
    cfg["cameras"] = cameras
    cfg["scope"] = "floor" if body.floor_id else "cameras"
    now, actor = now_iso(), principal.user_id
    other = [b for b in conn.execute("SELECT role_id FROM bindings WHERE subject_kind = 'user' AND subject_id = ? AND revoked_at IS NULL", (body.user_id,)).fetchall() if b["role_id"] != wall.KIOSK_ROLE]
    conn.execute("SAVEPOINT wall_create")
    try:
        conn.execute(
            "INSERT INTO wall_profiles(user_id, title, area_id, floor_id, enabled, remote_allowed, version, config_json, created_at, created_by, updated_at, updated_by) VALUES (?,?,?,?,1,0,1,?,?,?,?,?)",
            (body.user_id, body.title.strip(), body.area_id, body.floor_id, wall.dumps(cfg), now, actor, now, actor),
        )
        _sync_bindings(conn, principal, request, body.user_id, floor_id=body.floor_id, cameras=cameras)
        audit(conn, actor=principal, action="wall.profile.create", decision="allowed", resource_type="wall_profile", resource_id=body.user_id, request_id=_rid(request),
              details={"title": body.title.strip(), "scope": cfg["scope"], "cameras": len(cameras)})
        conn.execute("RELEASE wall_create")
    except BaseException:
        conn.execute("ROLLBACK TO wall_create")
        conn.execute("RELEASE wall_create")
        raise
    out = wall.profile_dict(conn, wall.profile_row(conn, body.user_id), _names(conn))
    out["has_other_roles"] = bool(other)
    return out


def _diff(old: dict[str, Any], new: dict[str, Any], prefix: str = "") -> list[str]:
    keys = []
    for k in sorted(set(old) | set(new)):
        a, b = old.get(k), new.get(k)
        if isinstance(a, dict) and isinstance(b, dict):
            keys += _diff(a, b, f"{prefix}{k}.")
        elif a != b:
            keys.append(f"{prefix}{k}")
    return keys


def _merge(base: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    out = dict(base)
    for k, v in patch.items():
        out[k] = _merge(out[k], v) if isinstance(v, dict) and isinstance(out.get(k), dict) else v
    return out


@router.patch("/wall/profiles/{user_id}")
def patch_profile(user_id: str, body: ProfilePatch, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _need_admin(conn, principal)
    row = wall.profile_row(conn, user_id)
    if row is None:
        raise not_found("מסך הקיר לא נמצא.")
    old_cfg = wall.config_of(row)
    cfg = old_cfg
    if body.config is not None:
        try:
            cfg = wall.WallConfig.model_validate(_merge(old_cfg, body.config)).model_dump(by_alias=True)
        except ValidationError as exc:
            raise ApiError(422, "validation", "הגדרות מסך הקיר אינן תקינות.", details={"errors": [{"loc": list(e["loc"]), "msg": e["msg"]} for e in exc.errors()[:6]]}) from exc
    cfg["cameras"] = _check_cameras(conn, cfg["cameras"])
    _check_entities(conn, cfg["state_entities"])
    title = body.title.strip() if body.title is not None else row["title"]
    area_id = body.area_id if "area_id" in body.model_fields_set else row["area_id"]
    enabled = int(body.enabled) if body.enabled is not None else int(row["enabled"])
    remote = int(body.remote_allowed) if body.remote_allowed is not None else int(row["remote_allowed"])
    floor_id = row["floor_id"]
    if cfg["scope"] == "cameras":
        floor_id = None
    elif floor_id is None:
        raise ApiError(422, "validation", "בחירת 'כל הקומה' דורשת קומה שנבחרה בהוספה.")
    changed = _diff({"title": row["title"], "area_id": row["area_id"], "enabled": bool(row["enabled"]), "remote_allowed": bool(row["remote_allowed"]), "config": old_cfg},
                    {"title": title, "area_id": area_id, "enabled": bool(enabled), "remote_allowed": bool(remote), "config": cfg})
    if not changed:
        return wall.profile_dict(conn, row, _names(conn))
    conn.execute("SAVEPOINT wall_patch")
    try:
        if "config.cameras" in changed or "config.scope" in changed:
            _sync_bindings(conn, principal, request, user_id, floor_id=floor_id, cameras=cfg["cameras"])
        conn.execute(
            "UPDATE wall_profiles SET title = ?, area_id = ?, floor_id = ?, enabled = ?, remote_allowed = ?, config_json = ?, version = version + 1, updated_at = ?, updated_by = ? WHERE user_id = ?",
            (title, area_id, floor_id, enabled, remote, wall.dumps(cfg), now_iso(), principal.user_id, user_id),
        )
        if "enabled" in changed:
            audit(conn, actor=principal, action="wall.profile.enable" if enabled else "wall.profile.disable", decision="allowed", resource_type="wall_profile", resource_id=user_id, request_id=_rid(request),
                  details={"title": title})
        audit(conn, actor=principal, action="wall.profile.update", decision="allowed", resource_type="wall_profile", resource_id=user_id, request_id=_rid(request),
              details={"title": title, "changed": changed})
        conn.execute("RELEASE wall_patch")
    except BaseException:
        conn.execute("ROLLBACK TO wall_patch")
        conn.execute("RELEASE wall_patch")
        raise
    revocation.mark({user_id})  # a dropped camera must close its relay; a grant is picked up by the same signal
    return wall.profile_dict(conn, wall.profile_row(conn, user_id), _names(conn))


@router.delete("/wall/profiles/{user_id}")
def remove_profile(user_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Immediate on our side: the profile and the kiosk bindings go, the user's Arx sessions are dropped, the display's
    websocket closes with 4401 (it notices within a second) and the next request is a 401."""
    _need_admin(conn, principal)
    require(conn, principal, "rbac.assign", INSTALLATION)
    row = wall.profile_row(conn, user_id)
    if row is None:
        raise not_found("מסך הקיר לא נמצא.")
    conn.execute("SAVEPOINT wall_remove")
    try:
        for b in _kiosk_bindings(conn, user_id):
            revoke_one(conn, principal, request, b)
        conn.execute("DELETE FROM wall_profiles WHERE user_id = ?", (user_id,))
        audit(conn, actor=principal, action="wall.profile.remove", decision="allowed", resource_type="wall_profile", resource_id=user_id, request_id=_rid(request), details={"title": row["title"]})
        conn.execute("RELEASE wall_remove")
    except BaseException:
        conn.execute("ROLLBACK TO wall_remove")
        conn.execute("RELEASE wall_remove")
        raise
    dropped = 0
    try:
        from ..services import ha_user_auth as hua

        dropped = len({s.sign_in() for s in hua.STORE.drop_user(user_id)})
    except Exception:  # noqa: BLE001 - the local channel has no Arx session to drop
        pass
    revocation.mark({user_id})
    return {"removed": True, "sessions_dropped": dropped}


# ---- the display's websocket
@router.websocket("/wall/ws")
async def wall_ws(websocket: WebSocket) -> None:
    """Server -> display: `hello`, `config` (version moved), `disabled`, `revoked`, `heartbeat`. Display -> server:
    `hello {class, screen}` and `heartbeat {state}`, which feed `last_seen_at` and the Settings list."""
    from .media import _principal_for_ws

    db: Database = websocket.app.state.db
    principal = await _principal_for_ws(websocket)
    if principal is None:
        await websocket.close(code=4401)
        return

    def _state() -> tuple[str, int | None]:
        with db.connection(mode="read", label="wall/ws") as conn:
            if WALL_VIEW not in permissions_anywhere(conn, principal):
                return "revoked", None
            row = wall.profile_row(conn, principal.user_id)
            if row is None:
                return "revoked", None
            return ("ok" if row["enabled"] else "disabled"), int(row["version"])

    def _touch(channel: str) -> None:
        with db.connection(label="wall/ws seen") as conn:
            wall.touch_seen(conn, principal.user_id, channel)

    state, version = await run_in_threadpool(_state)
    if state == "revoked":
        await websocket.close(code=4401)
        return
    from ..remote_channel import channel_of

    channel = channel_of(websocket)
    await websocket.accept()
    wall.socket_opened(principal.user_id)
    seq = 0

    async def send(kind: str, payload: dict[str, Any]) -> None:
        nonlocal seq
        seq += 1
        await websocket.send_text(json.dumps({"version": 1, "type": kind, "sequence": seq, "occurred_at": now_iso(), "payload": payload}))

    async def reader() -> None:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except ValueError:
                continue
            if isinstance(msg, dict) and msg.get("type") == "hello" and isinstance(msg.get("payload"), dict):
                wall.remember_hello(principal.user_id, msg["payload"])

    listen = asyncio.create_task(reader())
    last_store = 0.0
    try:
        await send("hello", {"version": version, "state": state})
        await run_in_threadpool(_touch, channel)
        last_store = time.time()
        while not listen.done():
            await asyncio.sleep(WS_POLL_S)
            fresh, fresh_version = await run_in_threadpool(_state)
            if fresh == "revoked":
                await send("revoked", {})
                await websocket.close(code=4401)
                return
            if fresh != state:
                state = fresh
                await send("disabled" if fresh == "disabled" else "config", {"version": fresh_version})
            elif fresh_version != version:
                await send("config", {"version": fresh_version})
            version = fresh_version
            if time.time() - last_store >= WS_HEARTBEAT_STORE_S:
                last_store = time.time()
                await run_in_threadpool(_touch, channel)
                await send("heartbeat", {})
    except Exception:  # noqa: BLE001 - a dropped socket ends the loop
        pass
    finally:
        listen.cancel()
        wall.socket_closed(principal.user_id)


