from __future__ import annotations

import asyncio
import json
import sqlite3
import time

from fastapi import APIRouter, Depends, Query, Request, WebSocket
from starlette.concurrency import run_in_threadpool

from ..auth import current_principal_ro, get_read_conn, settings_of
from ..db import Database, get_setting, now_iso, permission_revision
from ..mode import installation_mode
from ..rbac import INSTALLATION, Principal, bindings_of, effective_permissions, has_any_binding, permissions_anywhere, permissions_fingerprint
from ..services import revocation

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
    return {
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
