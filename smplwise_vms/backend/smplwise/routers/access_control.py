"""WisKey tab (CR-005, access control through the owner's `hikvision_intercom` integration).

SMPLWISE's browser never talks to Home Assistant: these endpoints check SMPLWISE's own permission first and serve
what services/intercom_sync.py read from WisKey over HA's WebSocket API. Phase 1a: the read-only entry center
(`access.read`); no door release, call, or edit of any kind lives here."""
from __future__ import annotations

import asyncio
import json
import queue
import sqlite3
import time
from typing import Any

from fastapi import APIRouter, Depends, Request, WebSocket
from starlette.concurrency import run_in_threadpool

from ..auth import current_principal, get_conn, settings_of
from ..db import Database, now_iso
from ..rbac import INSTALLATION, Principal, authorize, require
from ..services import intercom_sync
from .media import _principal_for_ws

router = APIRouter()

READ = "access.read"
RECHECK_S = 60


@router.get("/intercom/overview")
def overview(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The entry center: stations with online / ringing / sync state and the last access record, plus the feed's own
    state (`ha_not_configured`, `connecting`, `ha_unavailable`, `not_installed`, `forbidden`, `error`, `ready`).
    `overview` is null whenever there is nothing honest to show; `fresh` is false for a copy from before a disconnect."""
    require(conn, principal, READ, INSTALLATION)
    return intercom_sync.SYNC.snapshot(settings_of(request))


@router.websocket("/intercom/ws")
async def intercom_ws(websocket: WebSocket) -> None:
    """Change notices for the entry center (data-free, like WisKey's own `subscribe`): `intercom_refresh` when the
    stations changed, `intercom_state` when the feed's state changed, a heartbeat every 30 s. The client refetches
    GET /intercom/overview; the permission is re-checked every minute and the socket closes (4403) once it is gone."""
    db: Database = websocket.app.state.db
    principal = await _principal_for_ws(websocket)
    if principal is None:
        await websocket.close(code=4401)
        return

    def _allowed() -> bool:
        with db.connection() as conn:
            return authorize(conn, principal, READ, INSTALLATION).allowed

    if not await run_in_threadpool(_allowed):
        await websocket.close(code=4403)
        return
    q = intercom_sync.subscribe()  # before accept: nothing published after the handshake can be missed
    seq = 0
    last_check = time.time()

    def envelope(kind: str, payload: dict[str, Any]) -> str:
        return json.dumps({"version": 1, "type": kind, "sequence": seq, "subscription_id": principal.user_id, "occurred_at": now_iso(), "received_at": now_iso(), "payload": payload}, ensure_ascii=False, default=str)

    try:
        await websocket.accept()
        while True:
            try:
                msg = await asyncio.wait_for(asyncio.get_event_loop().run_in_executor(None, q.get, True, 30), timeout=31)
            except (asyncio.TimeoutError, queue.Empty):
                msg = None
            if time.time() - last_check > RECHECK_S:
                if not await run_in_threadpool(_allowed):
                    await websocket.close(code=4403)
                    return
                last_check = time.time()
            seq += 1
            if msg is None:
                await websocket.send_text(envelope("heartbeat", {"sync": intercom_sync.STATE.as_dict()}))
            else:
                await websocket.send_text(envelope(str(msg.get("type")), msg))
    except Exception:
        pass
    finally:
        intercom_sync.unsubscribe(q)
