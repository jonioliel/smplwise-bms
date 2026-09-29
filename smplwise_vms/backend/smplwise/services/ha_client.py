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
        raise ApiError(503, "ha_not_configured", "אין גישה לתשתית המערכת (SUPERVISOR_TOKEN חסר).")
    try:
        with httpx.Client(timeout=20) as c:
            r = c.get(_rest_base(settings) + "/states", headers=_headers(settings))
    except httpx.HTTPError as exc:
        raise ApiError(503, "ha_unavailable", "תשתית המערכת אינה זמינה כרגע.", retryable=True, details={"error": type(exc).__name__}) from exc
    if r.status_code in (401, 403):
        raise ApiError(503, "ha_forbidden", "תשתית המערכת דחתה את הגישה.", details={"status": r.status_code})
    if r.status_code != 200:
        raise ApiError(503, "ha_error", "תשתית המערכת החזירה שגיאה.", retryable=True, details={"status": r.status_code})
    return r.json()


def get_state(settings: Settings, entity_id: str) -> dict[str, Any] | None:
    try:
        with httpx.Client(timeout=10) as c:
            r = c.get(_rest_base(settings) + f"/states/{entity_id}", headers=_headers(settings))
    except httpx.HTTPError:
        return None
    return r.json() if r.status_code == 200 else None


def get_config(settings: Settings) -> tuple[dict[str, Any], str | None]:
    """GET /api/config (read-only): Home Assistant's version and time zone, plus the response's `Date` header - HA's own
    clock at one-second resolution, which the setup wizard compares with the add-on's (T071)."""
    if not configured(settings):
        raise ApiError(503, "ha_not_configured", "אין גישה לתשתית המערכת (SUPERVISOR_TOKEN חסר).")
    try:
        with httpx.Client(timeout=8) as c:
            r = c.get(_rest_base(settings) + "/config", headers=_headers(settings))
    except httpx.HTTPError as exc:
        raise ApiError(503, "ha_unavailable", "תשתית המערכת אינה זמינה כרגע.", retryable=True, details={"error": type(exc).__name__}) from exc
    if r.status_code in (401, 403):
        raise ApiError(503, "ha_forbidden", "תשתית המערכת דחתה את הגישה.", details={"status": r.status_code})
    if r.status_code != 200:
        raise ApiError(503, "ha_error", "תשתית המערכת החזירה שגיאה.", retryable=True, details={"status": r.status_code})
    try:
        body = r.json()
    except ValueError as exc:
        raise ApiError(503, "ha_error", "תשתית המערכת החזירה תשובה שאינה JSON.", retryable=True) from exc
    return (body if isinstance(body, dict) else {}), r.headers.get("date")


def call_bridge_execute(settings: Settings, payload: dict[str, Any], timeout: float = 15.0) -> dict[str, Any]:
    """POST /api/services/smplwise_bridge/execute?return_response — the only write path to HA."""
    if not configured(settings):
        raise ApiError(503, "ha_not_configured", "אין גישה לתשתית המערכת.")
    try:
        with httpx.Client(timeout=timeout) as c:
            r = c.post(_rest_base(settings) + "/services/smplwise_bridge/execute?return_response", headers=_headers(settings), content=json.dumps(payload))
    except httpx.HTTPError as exc:
        raise ApiError(503, "ha_unavailable", "תשתית המערכת אינה זמינה כרגע.", retryable=True, details={"error": type(exc).__name__}) from exc
    if r.status_code == 400 and "not found" in r.text.lower():
        raise ApiError(503, "bridge_not_installed", "גשר SMPLWISE אינו מותקן.", details={"status": r.status_code})
    if r.status_code in (401, 403):
        raise ApiError(503, "ha_forbidden", "תשתית המערכת דחתה את הקריאה.", details={"status": r.status_code})
    if r.status_code >= 400:
        raise ApiError(503, "bridge_error", "הגשר החזיר שגיאה.", retryable=False, details={"status": r.status_code, "body": r.text[:200]})
    try:
        body = r.json()
    except ValueError:
        return {}
    return body.get("service_response") or body


def call_bridge_set_area(settings: Settings, payload: dict[str, Any], timeout: float = 15.0) -> dict[str, Any]:
    """POST /api/services/smplwise_bridge/set_entity_area?return_response (CR-007 slice 4) - the one Home Assistant
    CONFIG write this product makes: move an entity to an area through the bridge's registry-write path, never a
    domain service call. Same envelope and error handling as call_bridge_execute; a distinct function (not a shared
    helper) so each write path stays a single, easily audited block of code."""
    if not configured(settings):
        raise ApiError(503, "ha_not_configured", "אין גישה לתשתית המערכת.")
    try:
        with httpx.Client(timeout=timeout) as c:
            r = c.post(_rest_base(settings) + "/services/smplwise_bridge/set_entity_area?return_response", headers=_headers(settings), content=json.dumps(payload))
    except httpx.HTTPError as exc:
        raise ApiError(503, "ha_unavailable", "תשתית המערכת אינה זמינה כרגע.", retryable=True, details={"error": type(exc).__name__}) from exc
    if r.status_code == 400 and "not found" in r.text.lower():
        raise ApiError(503, "bridge_not_installed", "גשר SMPLWISE אינו מותקן (או ישן מדי לתמוך בשיוך אזור).", details={"status": r.status_code})
    if r.status_code in (401, 403):
        raise ApiError(503, "ha_forbidden", "תשתית המערכת דחתה את הקריאה.", details={"status": r.status_code})
    if r.status_code >= 400:
        raise ApiError(503, "bridge_error", "הגשר החזיר שגיאה.", retryable=False, details={"status": r.status_code, "body": r.text[:200]})
    try:
        body = r.json()
    except ValueError:
        return {}
    return body.get("service_response") or body


async def ws_session(
    settings: Settings,
    on_ready: Callable[[Callable[[str, dict[str, Any]], Any]], Any],
    on_event: Callable[[dict[str, Any]], None],
    stop: asyncio.Event,
    on_message: Callable[[dict[str, Any]], None] | None = None,
) -> None:
    """One authenticated WebSocket session. `on_ready(call)` receives an async `call(type, **kw)` helper;
    `on_event` gets every `state_changed` event data; `on_message`, when given, gets every raw `event` frame
    first (subscriptions whose events carry no `entity_id`, e.g. an integration's own `subscribe` command or
    `subscribe_entities`); returns when the socket closes or `stop` is set."""
    import websockets

    async with websockets.connect(_ws_url(settings), max_size=None, open_timeout=15, ping_interval=25) as ws:
        hello = json.loads(await ws.recv())
        if hello.get("type") != "auth_required":
            raise RuntimeError("unexpected hello")
        await ws.send(json.dumps({"type": "auth", "access_token": settings.ha_token}))
        auth = json.loads(await ws.recv())
        if auth.get("type") != "auth_ok":
            raise ApiError(503, "ha_forbidden", "תשתית המערכת דחתה את האסימון.")
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
                    if on_message is not None:
                        on_message(msg)
                    event = msg.get("event")
                    data = (event.get("data") if isinstance(event, dict) else None) or {}
                    if data.get("entity_id"):
                        on_event(data)

        reader_task = asyncio.create_task(reader())
        stop_task: asyncio.Task | None = None
        try:
            await on_ready(call)
            stop_task = asyncio.create_task(stop.wait())
            done, _ = await asyncio.wait({reader_task, stop_task}, return_when=asyncio.FIRST_COMPLETED)
            if reader_task in done and reader_task.exception():
                raise reader_task.exception()  # type: ignore[misc]
        finally:
            reader_task.cancel()
            if stop_task is not None:
                stop_task.cancel()  # a socket that closed first left it waiting forever ("Task was destroyed but it is pending")
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
        raise ApiError(503, "supervisor_unavailable", "שירות הניהול אינו זמין (מחוץ להתקנה).")
    base = os.environ.get("SW_SUPERVISOR_URL", "http://supervisor").rstrip("/")
    try:
        r = httpx.post(base + "/discovery", json={"service": service, "config": config}, headers={"Authorization": f"Bearer {token}"}, timeout=10)
    except httpx.HTTPError as exc:
        raise ApiError(503, "supervisor_unavailable", "שירות הניהול אינו זמין כרגע.", retryable=True, details={"error": type(exc).__name__}) from exc
    if r.status_code != 200:
        raise ApiError(503, "supervisor_error", "שירות הניהול דחה את הודעת הגילוי.", details={"status": r.status_code})
    try:
        return r.json()
    except ValueError:
        return {}


def call_service(settings: Settings, domain: str, service: str, data: dict[str, Any], return_response: bool = False, timeout: float = 15.0) -> dict[str, Any]:
    """POST /api/services/<domain>/<service> on Home Assistant Core (only used for the bridge's own services)."""
    if not configured(settings):
        raise ApiError(503, "ha_not_configured", "אין גישה לתשתית המערכת (SUPERVISOR_TOKEN חסר).")
    url = _rest_base(settings) + f"/services/{domain}/{service}" + ("?return_response" if return_response else "")
    try:
        with httpx.Client(timeout=timeout) as c:
            r = c.post(url, headers=_headers(settings), json=data)
    except httpx.HTTPError as exc:
        raise ApiError(503, "ha_unavailable", "תשתית המערכת אינה זמינה כרגע.", retryable=True, details={"error": type(exc).__name__}) from exc
    if r.status_code in (400, 404):
        raise ApiError(503, "service_not_found", "השירות אינו רשום בתשתית המערכת (האינטגרציה חסרה או ישנה).", details={"status": r.status_code})
    if r.status_code in (401, 403):
        raise ApiError(503, "ha_forbidden", "תשתית המערכת דחתה את הקריאה.", details={"status": r.status_code})
    if r.status_code >= 300:
        raise ApiError(503, "ha_error", "תשתית המערכת החזירה שגיאה.", retryable=True, details={"status": r.status_code})
    try:
        body = r.json()
    except ValueError:
        return {}
    return body.get("service_response", body) if isinstance(body, dict) else {}
