"""MU2 voice announcements (הכרזות קוליות; services/announcements.py holds the rules). All under /api/v1/announcements.

Speaking (`media.announce`, sensitive, installation scope):
  GET  areas            the rooms that have an allowed speaker, with their speakers (the announce form)
  POST /                `{scope: area | device, ref, text}` speak now (200), 429 over the rate limit, 409 not configured, 404 off / no allowed speaker
Administration (`system.configure`):
  GET / PUT config      the switch, the speech engine, the language, the allowed speakers, the per-minute limit, the default volume,
                        pause-music, the quiet hours (suppress | lower) and the notification routing (ANN2)
  POST test             `{scope, ref}` the fixed test sentence (source `test`), same checks and same limits
  GET history           the last attempts (a person, a rule or a test; spoken, failed, limited or refused)
Every attempt is audited as `media.announce`; the setup as `media.announce.config`."""
from __future__ import annotations

import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, get_conn, settings_of
from ..db import unlocked
from ..rbac import INSTALLATION, Principal, require
from ..services import announcements as svc

router = APIRouter()


class _Body(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SpeakBody(_Body):
    scope: Literal["area", "device"]
    ref: str = Field(min_length=1, max_length=64)
    text: str = Field(min_length=1, max_length=400)
    volume: int | float | None = None  # percent, clamped to 0-100 by the service; None = the configured default
    critical: bool = False  # exempt from the quiet hours (the same permission, installation scope)


class TestBody(_Body):
    scope: Literal["area", "device"]
    ref: str = Field(min_length=1, max_length=64)
    language: Literal["he", "en"] = "he"


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


@router.get("/announcements/areas")
def get_areas(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, svc.PERM, INSTALLATION)
    cfg = svc.config(conn)
    return {"enabled": bool(cfg["enabled"] and cfg["engine"]), "areas": svc.areas(conn) if cfg["enabled"] else [], "max_text": svc.MAX_TEXT}


@router.post("/announcements")
def speak(body: SpeakBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, svc.PERM, INSTALLATION)
    return svc.announce(conn, settings_of(request), principal, _rid(request), source="manual", scope=body.scope, ref=body.ref, text=body.text, volume=body.volume, critical=body.critical, unlock=lambda: unlocked(conn))


@router.get("/announcements/config")
def get_config(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, svc.CONFIGURE, INSTALLATION)
    engines = [r[0] for r in conn.execute("SELECT entity_id FROM ha_entities WHERE entity_id LIKE 'tts.%' ORDER BY entity_id LIMIT 50").fetchall()]
    return {"config": svc.config(conn), "speakers": svc.admin_targets(conn), "engines": engines, "history": svc.history(conn, 10)}


@router.put("/announcements/config")
def put_config(body: dict[str, Any], request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, svc.CONFIGURE, INSTALLATION)
    changed = svc.update_config(conn, body)
    if changed:
        audit(conn, actor=principal, action="media.announce.config", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
              details={"changed": changed, **{k: v for k, v in body.items() if k in changed and k in ("enabled", "language", "max_per_minute", "volume", "pause_music")}, **({"quiet": body["quiet"]} if "quiet" in changed else {}), **({"notify": {k: v for k, v in body["notify"].items() if k != "ref"}} if "notify" in changed else {}), **({"devices": len(body["devices"])} if "devices" in changed else {})})
    return {"changed": changed, **get_config(principal, conn)}


@router.post("/announcements/test")
def test_announcement(body: TestBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, svc.CONFIGURE, INSTALLATION)
    return svc.announce(conn, settings_of(request), principal, _rid(request), source="test", scope=body.scope, ref=body.ref, text=svc.TEST_TEXT[body.language], unlock=lambda: unlocked(conn))


@router.get("/announcements/history")
def get_history(limit: int = Query(20, ge=1, le=100), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, svc.CONFIGURE, INSTALLATION)
    return {"history": svc.history(conn, limit)}
