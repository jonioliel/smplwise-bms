from __future__ import annotations

import asyncio
import json
import sqlite3
import time

from typing import Any

from fastapi import APIRouter, Depends, Query, Request, WebSocket
from pydantic import BaseModel, ConfigDict, Field
from starlette.concurrency import run_in_threadpool

from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..db import Database, get_setting, now_iso, permission_revision
from ..errors import validation
from ..mode import installation_mode
from ..rbac import INSTALLATION, Principal, bindings_of, effective_permissions, has_any_binding, permissions_anywhere, permissions_fingerprint
from ..services import revocation
from ..services import user_prefs

router = APIRouter()

# /me/ws: how often the socket re-reads the fingerprint without a signal (a binding that expired, a change made by
# another process) and how often it sends a heartbeat
ME_RECHECK_S = 15.0
ME_HEARTBEAT_S = 30.0


def _active(conn: sqlite3.Connection, principal: Principal) -> bool:
    row = conn.execute("SELECT active FROM users WHERE id = ?", (principal.user_id,)).fetchone()
    return row is None or bool(row["active"])


@router.get("/me")
def me(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn),
       known: str | None = Query(None, max_length=64)) -> dict:
    """Who the caller is and what they may do - computed on this request, never cached (T055). `known` = the
    fingerprint the shell holds; `permissions_changed` says whether it moved since."""
    fingerprint = permissions_fingerprint(conn, principal)
    from ..remote_channel import channel_of

    channel = channel_of(request)
    remote = None
    if channel == "remote":  # CR-008: what the Arx client needs (session mode, idle lock, video profile policy)
        from ..services.ha_user_auth import remote_settings

        remote = {k: v for k, v in remote_settings(conn).items() if k != "remote.require_mfa_admin"}
    return {
        "channel": channel,
        "remote": remote,
        "user": {
            "id": principal.user_id,
            "username": principal.username,
            "display_name": principal.display_name,
            "source": principal.source,
        },
        "active": _active(conn, principal),
        "bindings": bindings_of(conn, principal),
        "permissions_installation": effective_permissions(conn, principal, INSTALLATION),
        "permissions_any": permissions_anywhere(conn, principal),  # what the shell may show at all (any scope)
        "has_access": has_any_binding(conn, principal),
        "permission_revision": permission_revision(conn),
        "permissions_fingerprint": fingerprint,
        "permissions_changed": bool(known) and known != fingerprint,
        "bootstrap_state": get_setting(conn, "bootstrap_state", "pending"),
        # NVR-less mode (mode.py): `ha_only` hides the NVR areas in the shell; every route still checks permissions itself
        "mode": installation_mode(settings_of(request)),
    }


class PrefsPatch(BaseModel):
    """A partial update of the caller's own preferences (CR-013). Only known keys are accepted (an unknown key is a
    422, so this is never free-form client storage); null resets a key to its default."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    nav_order: list[Any] | None = Field(default=None, alias="nav.order", max_length=user_prefs.MAX_LIST)
    ui_nav_size: dict[str, Any] | None = Field(default=None, alias="ui.nav_size")  # validated in full by services/nav_size.py
    wiskey_density: str | int | None = Field(default=None, alias="wiskey.density")  # WisKey rc.37 overview card count
    wiskey_wall: str | int | None = Field(default=None, alias="wiskey.wall")  # WisKey rc.37 camera-wall stream budget


@router.get("/me/prefs")
def get_my_prefs(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The caller's own interface preferences - every known key with its value or default (`stored` names the keys the
    user set). Another user's preferences are never readable."""
    return user_prefs.get_prefs(conn, principal.user_id)


@router.put("/me/prefs")
def put_my_prefs(body: PrefsPatch, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Set or reset (null) the caller's own preferences; `nav.order` keeps the known tab ids in the given order, drops
    unknown ids and appends the missing ones in the default order. Presentation only: no permission changes."""
    patch = {user_prefs_key(name): value for name, value in body.model_dump(by_alias=False).items() if name in body.model_fields_set}
    try:
        return user_prefs.set_prefs(conn, principal.user_id, patch)
    except ValueError as exc:
        raise validation("ההעדפה שנשלחה אינה תקינה.", reason=str(exc)) from exc


def user_prefs_key(field: str) -> str:
    return PrefsPatch.model_fields[field].alias or field


@router.websocket("/me/ws")
async def me_ws(websocket: WebSocket) -> None:
    """The shell's access channel (T055): `{"type": "permissions_changed", "payload": {...}}` as soon as the caller's
    bindings, groups, roles or HA active flag change (services/revocation signal, polled every second; and a re-read
    every ME_RECHECK_S for changes nothing signalled), plus a heartbeat. The browser then re-fetches /me and the
    navigation; what it may no longer see, the server already refuses."""
    from .media import _principal_for_ws  # local import: media imports this package's siblings

    db: Database = websocket.app.state.db
    principal = await _principal_for_ws(websocket)
    if principal is None:
        await websocket.close(code=4401)
        return

    def _state() -> dict:
        with db.connection(mode="read", label="me/ws") as conn:
            return {"permissions_fingerprint": permissions_fingerprint(conn, principal), "permission_revision": permission_revision(conn), "active": _active(conn, principal)}

    state = await run_in_threadpool(_state)
    await websocket.accept()
    seq = 0
    gen = revocation.generation(principal.user_id)
    checked = beat = time.time()

    async def send(kind: str, payload: dict) -> None:
        nonlocal seq
        seq += 1
        await websocket.send_text(json.dumps({"version": 1, "type": kind, "sequence": seq, "subscription_id": principal.user_id, "occurred_at": now_iso(), "payload": payload}))

    async def reader() -> None:  # the client never sends anything we need; this only notices a closed socket
        while True:
            await websocket.receive_text()

    listen = asyncio.create_task(reader())
    try:
        await send("hello", state)
        while not listen.done():
            await asyncio.sleep(1)
            now = time.time()
            moved = revocation.generation(principal.user_id) != gen
            if moved or now - checked >= ME_RECHECK_S:
                gen = revocation.generation(principal.user_id)
                checked = now
                fresh = await run_in_threadpool(_state)
                if fresh["permissions_fingerprint"] != state["permissions_fingerprint"] or fresh["active"] != state["active"]:
                    state = fresh
                    await send("permissions_changed", fresh)
            if now - beat >= ME_HEARTBEAT_S:
                beat = now
                await send("heartbeat", {})
    except Exception:  # noqa: BLE001 - a dropped socket ends the loop
        pass
    finally:
        listen.cancel()
