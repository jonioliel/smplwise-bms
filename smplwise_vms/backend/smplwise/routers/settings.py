"""Product settings that are safe to expose (no secrets): media transport default, session caps,
snapshot freshness. Secrets stay in the add-on options."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from ..audit import audit
from ..auth import current_principal, get_conn
from ..db import get_setting, set_setting
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, require

router = APIRouter()

DEFAULTS: dict[str, str] = {
    # auto | webrtc | mse. MSE by default (owner decision 2026-09-14): it works through Ingress, Cloudflare
    # and behind CGNAT; WebRTC/auto are selectable in Settings once UDP to the go2rtc host is possible.
    "media.transport_default": "mse",
    "media.max_live_sessions": "8",
    "media.wall_profile": "sub",  # sub | main — profile used by the camera wall
    "snapshots.max_age_s": "60",
    # IANA zone of the site/NVR wall clock (chapter 20). The lab NVR reports windowsZone "Israel Standard Time".
    "time.zone": "Asia/Jerusalem",
    "playback.max_sessions": "4",  # playback sessions open at once (each is one NVR RTSP playback stream)
    "playback.lease_s": "600",  # idle lease; the janitor deletes the go2rtc stream after it expires
}

INT_KEYS = ("media.max_live_sessions", "snapshots.max_age_s", "playback.max_sessions", "playback.lease_s")


def read_settings(conn: sqlite3.Connection) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key, default in DEFAULTS.items():
        value = get_setting(conn, key, default) or default
        out[key] = int(value) if key in INT_KEYS else value
    return out


class SettingsPatch(BaseModel):
    media_transport_default: str | None = Field(default=None, pattern="^(auto|webrtc|mse)$", alias="media.transport_default")
    media_max_live_sessions: int | None = Field(default=None, ge=1, le=32, alias="media.max_live_sessions")
    media_wall_profile: str | None = Field(default=None, pattern="^(sub|main)$", alias="media.wall_profile")
    snapshots_max_age_s: int | None = Field(default=None, ge=5, le=3600, alias="snapshots.max_age_s")
    time_zone: str | None = Field(default=None, pattern=r"^[A-Za-z_]+(/[A-Za-z_\-+0-9]+)+$", alias="time.zone")
    playback_max_sessions: int | None = Field(default=None, ge=1, le=16, alias="playback.max_sessions")
    playback_lease_s: int | None = Field(default=None, ge=60, le=3600, alias="playback.lease_s")

    model_config = {"populate_by_name": True}


@router.get("/settings")
def get_settings(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return {"settings": read_settings(conn), "can_edit": authorize(conn, principal, "system.configure", INSTALLATION).allowed}


@router.patch("/settings")
def patch_settings(body: SettingsPatch, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "system.configure", INSTALLATION)
    changes = {k: v for k, v in body.model_dump(by_alias=True).items() if v is not None}
    if "time.zone" in changes:
        from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

        try:
            ZoneInfo(changes["time.zone"])
        except (ZoneInfoNotFoundError, ValueError):
            raise ApiError(422, "validation", "אזור זמן לא מוכר.", details={"time.zone": changes["time.zone"]})
    for key, value in changes.items():
        set_setting(conn, key, str(value))
    audit(conn, actor=principal, action="settings.update", decision="allowed", resource_type="installation", resource_id="*",
          request_id=getattr(request.state, "correlation_id", None), details=changes)
    return {"settings": read_settings(conn), "can_edit": True}
