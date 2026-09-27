"""WisKey tab (CR-005, access control through the owner's `hikvision_intercom` integration).

SMPLWISE's browser never talks to Home Assistant: these endpoints check SMPLWISE's own permission first and serve
what services/intercom_sync.py read from WisKey over HA's WebSocket API. Phase 1a: the read-only entry center
(`access.read`); phase 1b: the read-only activity log and people directory, same permission (CR-005 §3). No door
release, call, or edit of any kind lives here."""
from __future__ import annotations

import asyncio
import json
import queue
import sqlite3
import time
from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, Path, Query, Request, WebSocket
from starlette.concurrency import run_in_threadpool

from ..auth import current_principal, get_conn, settings_of
from ..db import Database, now_iso
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, require
from ..services import intercom_client, intercom_sync
from .media import _principal_for_ws

router = APIRouter()

READ = "access.read"
RECHECK_S = 60
MAX_PAGE = 200  # WisKey's own cap for events/list and users/query


def _reader(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> None:
    """`access.read` at installation scope, checked as a route dependency so it runs before query validation: a caller
    without the permission learns nothing about the parameters (WisKey's own handlers authorize first, too)."""
    require(conn, principal, READ, INSTALLATION)


def _instant(name: str, value: str | None) -> str | None:
    """WisKey accepts only an aware ISO instant (<=40 chars) for `start` / `end`; refuse anything else here with a clear
    422 instead of letting WisKey answer `invalid_fields`."""
    if value is None:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        parsed = None
    if parsed is None or parsed.tzinfo is None:
        raise ApiError(422, "validation", f"{name} חייב להיות זמן ISO עם אזור זמן (למשל 2026-09-27T08:00:00Z).")
    return value


@router.get("/intercom/overview")
def overview(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The entry center: stations with online / ringing / sync state and the last access record, plus the feed's own
    state (`ha_not_configured`, `connecting`, `ha_unavailable`, `not_installed`, `forbidden`, `error`, `ready`).
    `overview` is null whenever there is nothing honest to show; `fresh` is false for a copy from before a disconnect."""
    require(conn, principal, READ, INSTALLATION)
    return intercom_sync.SYNC.snapshot(settings_of(request))


@router.get("/intercom/events", dependencies=[Depends(_reader)])
def events(
    request: Request,
    station_id: str | None = Query(None, min_length=1, max_length=128),
    person: str | None = Query(None, min_length=1, max_length=128),
    result: Literal["granted", "denied", "unknown"] | None = Query(None),
    authentication: Literal["card", "pin", "unknown"] | None = Query(None),
    door: int | None = Query(None, ge=1, le=2),
    start: str | None = Query(None, max_length=40),
    end: str | None = Query(None, max_length=40),
    limit: int = Query(100, ge=1, le=MAX_PAGE),
    before: str | None = Query(None, min_length=1, max_length=128),
    current_group: str | None = Query(None, min_length=1, max_length=128),
    current_profile: list[str] | None = Query(None),
) -> dict[str, Any]:
    """The activity log: one page of WisKey's `events/list`, newest first (WisKey keeps 5 000 records / 30 days).
    `before` is the previous page's `events.next`; an expired cursor is a 422 `intercom_invalid_request` (reload from
    page one). `current_profile` repeats as `field_id=value`. Reply: `{state, configured, last_error, fetched_at,
    events, sync}`, `events` null unless `state` is `ready`. WisKey has no event push: refetch on the
    `intercom_refresh` notice, like WisKey's own panel."""
    start, end = _instant("start", start), _instant("end", end)
    if start and end and datetime.fromisoformat(start.replace("Z", "+00:00")) >= datetime.fromisoformat(end.replace("Z", "+00:00")):
        raise ApiError(422, "validation", "start חייב להיות לפני end.")
    profile: dict[str, str] | None = None
    if current_profile:
        pairs = [item.partition("=") for item in current_profile]
        if len(pairs) > 32 or any(not field or not sep or len(field) > 128 or len(value) > 100 for field, sep, value in pairs):
            raise ApiError(422, "validation", "current_profile הוא field_id=value (עד 32 שדות, 128 / 100 תווים).")
        profile = {field: value for field, _sep, value in pairs}
    filters = {"station_id": station_id, "person": person, "result": result, "authentication": authentication, "door": door, "start": start, "end": end, "limit": limit, "before": before, "current_group": current_group, "current_profile": profile}
    return intercom_sync.SYNC.command(settings_of(request), "events", lambda call: intercom_client.events_list(call, filters), intercom_sync.project_event_page)


@router.get("/intercom/people", dependencies=[Depends(_reader)])
def people(
    request: Request,
    query: str = Query("", max_length=160),
    offset: int = Query(0, ge=0, le=10_000_000),
    limit: int = Query(50, ge=1, le=MAX_PAGE),
    snapshot: str | None = Query(None, max_length=64),
    station: str | None = Query(None, min_length=1, max_length=128),
    group: str | None = Query(None, min_length=1, max_length=128),
    rights: Literal["assigned", "unassigned", "disabled"] | None = Query(None),
    state: Literal["active", "inactive", "expired", "upcoming"] | None = Query(None),
    sort: Literal["name", "name_desc", "employee"] = Query("employee"),
) -> dict[str, Any]:
    """The people directory: one page of WisKey's `users/query`, projected to what a read-only list shows (no phones,
    cards, PIN flags or profile values). Pass the previous page's `people.snapshot` back; `people.stale` then says the
    directory changed underneath the paging. The `credential` and `profile` filters are deliberately not offered.
    Reply: `{state, configured, last_error, fetched_at, people, sync}`."""
    filters: dict[str, Any] = {k: v for k, v in {"station": station, "group": group, "rights": rights, "state": state}.items() if v is not None}
    filters["sort"] = sort
    return intercom_sync.SYNC.command(
        settings_of(request), "people", lambda call: intercom_client.users_query(call, query, filters, offset, limit, snapshot), intercom_sync.project_people_page
    )


@router.get("/intercom/people/{user_id}", dependencies=[Depends(_reader)])
def person(request: Request, user_id: str = Path(min_length=1, max_length=128)) -> dict[str, Any]:
    """One person (WisKey `users/get`), same projection as a directory row; an unknown id is a 404
    `intercom_person_not_found`. Reply: `{state, configured, last_error, fetched_at, person, sync}`."""
    return intercom_sync.SYNC.command(settings_of(request), "person", lambda call: intercom_client.users_get(call, user_id), intercom_sync.project_person)


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
