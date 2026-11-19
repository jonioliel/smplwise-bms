"""WisKey tab: the entry center's change-notice WebSocket.

CR-SPLIT-ACCESS-CONTROL-2440 (review 05:P2-08): moved unchanged out of routers/access_control.py, which still exports every name."""
from __future__ import annotations

import asyncio
import json
import queue
import time
from typing import Any

from fastapi import APIRouter, WebSocket
from starlette.concurrency import run_in_threadpool

from ..db import Database, now_iso
from ..rbac import INSTALLATION, authorize
from ..services import intercom_sync, push_queue
from .access_control_base import READ, RECHECK_S, log
from .media import _principal_for_ws

router = APIRouter()


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
                msg = await push_queue.next_item(q, 30)  # FOLLOWUPS-2406: no executor thread held per socket
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
    except Exception as exc:  # noqa: BLE001 - the socket ended (a disconnect is the usual way); review 02:P3-3: no longer silent
        log.debug("entry-center socket ended (%s)", type(exc).__name__)
    finally:
        intercom_sync.unsubscribe(q)
