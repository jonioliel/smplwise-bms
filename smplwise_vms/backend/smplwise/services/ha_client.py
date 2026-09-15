"""Home Assistant Core API access (read: states and registries over REST/WebSocket; write: only the bridge
integration's `smplwise_bridge.execute` service, which re-issues the action with the VMS user's Context so
HA's own permission check applies — the add-on's token never impersonates a user by itself).

Inside the add-on the Supervisor proxy is used (`http://supervisor/core`, `SUPERVISOR_TOKEN`); outside, a
developer supplies HA_URL / HA_TOKEN. Nothing here logs URLs or tokens."""
from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any, AsyncIterator, Callable

import httpx

from ..config import Settings
from ..errors import ApiError

log = logging.getLogger("smplwise.ha")


def configured(settings: Settings) -> bool:
    return bool(settings.ha_url and settings.ha_token)


def _rest_base(settings: Settings) -> str:
    return (settings.ha_url or "").rstrip("/") + "/api"


def _ws_url(settings: Settings) -> str:
    base = (settings.ha_url or "").rstrip("/")
    if base.startswith("https://"):
        return "wss://" + base[len("https://"):] + ("/websocket" if base.endswith("/core") else "/api/websocket")
    return "ws://" + base[len("http://"):] + ("/websocket" if base.endswith("/core") else "/api/websocket")


def _headers(settings: Settings) -> dict[str, str]:
    return {"Authorization": f"Bearer {settings.ha_token}", "Content-Type": "application/json"}


def get_states(settings: Settings) -> list[dict[str, Any]]:
    if not configured(settings):
        raise ApiError(503, "ha_not_configured", "אין גישה ל־Home Assistant (SUPERVISOR_TOKEN חסר).")
    try:
        with httpx.Client(timeout=20) as c:
            r = c.get(_rest_base(settings) + "/states", headers=_headers(settings))
    except httpx.HTTPError as exc:
        raise ApiError(503, "ha_unavailable", "Home Assistant אינו זמין כרגע.", retryable=True, details={"error": type(exc).__name__}) from exc
    if r.status_code in (401, 403):
        raise ApiError(503, "ha_forbidden", "Home Assistant דחה את הגישה של ה־Add-on.", details={"status": r.status_code})
    if r.status_code != 200:
        raise ApiError(503, "ha_error", "Home Assistant החזיר שגיאה.", retryable=True, details={"status": r.status_code})
    return r.json()


def get_state(settings: Settings, entity_id: str) -> dict[str, Any] | None:
    try:
        with httpx.Client(timeout=10) as c:
            r = c.get(_rest_base(settings) + f"/states/{entity_id}", headers=_headers(settings))
    except httpx.HTTPError:
        return None
    return r.json() if r.status_code == 200 else None


def call_bridge_execute(settings: Settings, payload: dict[str, Any], timeout: float = 15.0) -> dict[str, Any]:
    """POST /api/services/smplwise_bridge/execute?return_response — the only write path to HA."""
    if not configured(settings):
        raise ApiError(503, "ha_not_configured", "אין גישה ל־Home Assistant.")
    try:
        with httpx.Client(timeout=timeout) as c:
            r = c.post(_rest_base(settings) + "/services/smplwise_bridge/execute?return_response", headers=_headers(settings), content=json.dumps(payload))
    except httpx.HTTPError as exc:
        raise ApiError(503, "ha_unavailable", "Home Assistant אינו זמין כרגע.", retryable=True, details={"error": type(exc).__name__}) from exc
    if r.status_code == 400 and "not found" in r.text.lower():
        raise ApiError(503, "bridge_not_installed", "גשר SMPLWISE אינו מותקן ב־Home Assistant.", details={"status": r.status_code})
    if r.status_code in (401, 403):
        raise ApiError(503, "ha_forbidden", "Home Assistant דחה את הקריאה.", details={"status": r.status_code})
    if r.status_code >= 400:
        raise ApiError(503, "bridge_error", "הגשר החזיר שגיאה.", retryable=False, details={"status": r.status_code, "body": r.text[:200]})
    try:
        body = r.json()
    except ValueError:
        return {}
    return body.get("service_response") or body


async def ws_session(settings: Settings, on_ready: Callable[[Callable[[str, dict[str, Any]], Any]], Any], on_event: Callable[[dict[str, Any]], None], stop: asyncio.Event) -> None:
    """One authenticated WebSocket session. `on_ready(call)` receives an async `call(type, **kw)` helper;
    `on_event` gets every `state_changed` event data; returns when the socket closes or `stop` is set."""
    import websockets

    async with websockets.connect(_ws_url(settings), max_size=None, open_timeout=15, ping_interval=25) as ws:
        hello = json.loads(await ws.recv())
        if hello.get("type") != "auth_required":
            raise RuntimeError("unexpected hello")
        await ws.send(json.dumps({"type": "auth", "access_token": settings.ha_token}))
        auth = json.loads(await ws.recv())
        if auth.get("type") != "auth_ok":
            raise ApiError(503, "ha_forbidden", "Home Assistant דחה את הטוקן של ה־Add-on.")
        counter = {"id": 0}
        pending: dict[int, asyncio.Future] = {}

        async def call(msg_type: str, **kw: Any) -> dict[str, Any]:
            counter["id"] += 1
            mid = counter["id"]
            fut: asyncio.Future = asyncio.get_event_loop().create_future()
            pending[mid] = fut
            await ws.send(json.dumps({"id": mid, "type": msg_type, **kw}))
            return await asyncio.wait_for(fut, timeout=60)

        async def reader() -> None:
            async for raw in ws:
                msg = json.loads(raw)
                mid = msg.get("id")
                if msg.get("type") == "result" and mid in pending:
                    fut = pending.pop(mid)
                    if not fut.done():
                        fut.set_result(msg)
                elif msg.get("type") == "event":
                    data = (msg.get("event") or {}).get("data") or {}
                    if data.get("entity_id"):
                        on_event(data)

        reader_task = asyncio.create_task(reader())
        try:
            await on_ready(call)
            stop_task = asyncio.create_task(stop.wait())
            done, _ = await asyncio.wait({reader_task, stop_task}, return_when=asyncio.FIRST_COMPLETED)
            if reader_task in done and reader_task.exception():
                raise reader_task.exception()  # type: ignore[misc]
        finally:
            reader_task.cancel()
            for fut in pending.values():
                if not fut.done():
                    fut.cancel()


def registry_maps(entities: list[dict[str, Any]], devices: list[dict[str, Any]], areas: list[dict[str, Any]], floors: list[dict[str, Any]]) -> dict[str, Any]:
    """Resolve area/floor names per entity (entity area, else its device's area)."""
    area_by_id = {a["area_id"]: a for a in areas}
    floor_by_id = {f["floor_id"]: f for f in floors}
    device_by_id = {d["id"]: d for d in devices}
    out: dict[str, dict[str, Any]] = {}
    for e in entities:
        area_id = e.get("area_id") or (device_by_id.get(e.get("device_id") or "", {}) or {}).get("area_id")
        area = area_by_id.get(area_id or "", {}) if area_id else {}
        floor_id = area.get("floor_id") if area else None
        out[e["entity_id"]] = {
            "registry_id": e.get("id"),
            "unique_id": e.get("unique_id"),
            "platform": e.get("platform"),
            "device_id": e.get("device_id"),
            "area_id": area_id,
            "area_name": area.get("name") if area else None,
            "ha_floor_id": floor_id,
            "ha_floor_name": (floor_by_id.get(floor_id or "", {}) or {}).get("name") if floor_id else None,
            "name": e.get("name") or e.get("original_name") or "",
            "original_name": e.get("original_name"),
            "icon": e.get("icon"),
            "entity_category": e.get("entity_category"),
            "disabled": 1 if e.get("disabled_by") else 0,
            "hidden": 1 if e.get("hidden_by") else 0,
        }
    return out


def supervisor_token() -> str | None:
    return os.environ.get("SUPERVISOR_TOKEN") or None


def post_discovery(settings: Settings, service: str, config: dict[str, Any]) -> dict[str, Any]:
    """Supervisor discovery API: makes Home Assistant offer `service` (the bridge) with `config` prefilled."""
    token = supervisor_token()
    if not token:
        raise ApiError(503, "supervisor_unavailable", "אין גישה ל־Supervisor (מחוץ ל־Add-on).")
    base = os.environ.get("SW_SUPERVISOR_URL", "http://supervisor").rstrip("/")
    try:
        r = httpx.post(base + "/discovery", json={"service": service, "config": config}, headers={"Authorization": f"Bearer {token}"}, timeout=10)
    except httpx.HTTPError as exc:
        raise ApiError(503, "supervisor_unavailable", "ה־Supervisor אינו זמין כרגע.", retryable=True, details={"error": type(exc).__name__}) from exc
    if r.status_code != 200:
        raise ApiError(503, "supervisor_error", "ה־Supervisor דחה את הודעת הגילוי.", details={"status": r.status_code})
    try:
        return r.json()
    except ValueError:
        return {}
