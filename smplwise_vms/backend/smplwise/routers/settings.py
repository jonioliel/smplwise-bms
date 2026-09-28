"""Product settings that are safe to expose (no secrets): media transport default, session caps,
snapshot freshness. Secrets stay in the add-on options."""
from __future__ import annotations

import json

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
    "ui.design": "a",
    "ui.design_names": '{"a": "SW A", "b": "SW B"}',
    "ui.wall_count": "4",  # tiles the camera wall opens with (a browser can override it for itself)
    "ui.kiosk_cols": "3",  # kiosk page layout when the URL carries none
    "ui.kiosk_rows": "2",
    "ui.hide_search": "false",  # hide the AI search tab (the owner's choice while it is not in use)
    "ui.start_route": "explore",  # screen the UI opens on: explore (map) | live (overview) | wall | events | playback
    "ui.hide_map": "false",  # hide the map area from the navigation for everyone (a single user: a role without map.read)
    "history.ha_secondary": "false",  # S2: the HA recorder fills entity states the local history does not know (marked as secondary)
    "plan.estimates": "true",  # Plan Studio: show estimated metres (≈) before a plan is calibrated; false hides metres until calibration (owner decision 2026-09-23)
    "plan.levels": "all",  # default levels view on every map: all levels together, or the floor's default level only (owner decision 2026-09-26)
    "plan.quality": "2",  # CR-006: the 3D quality level a browser opens with (1 schematic, 2 shadows/materials/cutaway); a browser can override it for itself and falls back to 1 on a slow device
    "plan.presence_fade": "3",  # CR-006 1b: the presence tint on the floor map fades this many minutes after the last motion; "off" = the tint only while a sensor is on (owner decision 2026-09-28: on/off + minutes per installation)
    "playback.max_sessions": "4",  # playback sessions open at once (each is one NVR RTSP playback stream)
    "playback.lease_s": "600",  # idle lease; the janitor deletes the go2rtc stream after it expires
    "exports.max_mb": "2048",  # refuse export jobs whose NVR files exceed this estimate
    "exports.retention_days": "7",  # finished export files are deleted after this many days
    "events.retention_days": "30",  # stored events are pruned after this many days
    "audit.retention_days": "365",  # T055: the janitor prunes audit rows older than this (was a fixed constant)
    # semantic search (T063): the local baseline needs no network; an external analysis provider is opt-in with a privacy acknowledgement and a daily budget — none is bundled
    "ai.provider": "local",  # none | local | external
    "ai.privacy_ack": "false",
    "ai.budget_daily": "0",
    # CR-006 phase 2 (AI-rendered floor skins, slice 2a): a family of its own, not the ai.* keys above - those are the
    # search's analysis provider (event metadata, none bundled); a skin sends a floor picture to an image provider, a
    # different piece of data and a different consent. Nothing is sent while skins.privacy_ack is false; the API key is
    # the add-on option openai_api_key (never a setting). Budgets count successful renders (routers/skins.py).
    "skins.provider": "openai",  # the one implementation today (owner decision 2026-09-28, CR-006 7.1 a)
    "skins.model": "gpt-image-1.5",  # the OpenAI image model for edits (the official SDK's default)
    "skins.privacy_ack": "false",
    "skins.budget_renders_per_floor": "4",  # per floor and structure (CR-006 7.3: 2 by default, up to 4)
    "skins.budget_monthly": "20",  # per installation and calendar month; the connection test counts
    # CR-005 recorded decision 2026-09-28 (embedded panel): per SMPLWISE WisKey screen, which one the WisKey area shows -
    # "wiskey" = the owner's real WisKey Home Assistant panel embedded as-is (the default), "smplwise" = the screen built
    # here. The other WisKey screens (stations, sync, health, audit, management) are always embedded.
    "access.ui.overview": "wiskey",
    "access.ui.events": "wiskey",
    "access.ui.people": "wiskey",
    # T054 follow-up (owner request): hide the whole WisKey area from the navigation for everyone, regardless of role -
    # the same "hidden for everyone" shape as ui.hide_map, but for the WisKey top-level area. The access.ui.* choices
    # above apply only while this is false.
    "ui.hide_wiskey": "false",
    # CR-007 slice 6a: הגדרות › חשמל והתקנים - how the device-control screens look, per installation (read by every user
    # through GET /settings; changed with system.configure, audited like every product setting). Presentation only: the
    # safety rules of the bulk actions (confirmation, expiry, never locks / alarm / door release) are not settings.
    "devices.style": "smplwise",  # smplwise (the product's own look) | glass (the approved mockup's translucent style)
    "devices.theme": "default",  # the style's palette (frontend/src/styles/devices-themes.ts); one built in, no picker until 6b
    "devices.default_view": "cards",  # the building screen's first view: cards (tree panel + floor cards) | tiles; a viewer's own toggle wins
    "devices.show_sensors": "true",  # the sensors card on the area screen and the sensors count on the building screen
    "devices.show_climate_strip": "true",  # the building / floor "מזגנים" strip
    "devices.density": "comfortable",  # comfortable | compact (tighter tiles, rows and gaps)
}

# CR-007 6a: the registered device-screen palettes - keep in step with DEVICE_THEMES in
# frontend/src/styles/devices-themes.ts (docs/design/DEVICE_THEMES.md, "How to add a theme").
DEVICE_THEMES = ("default",)

INT_KEYS = ("media.max_live_sessions", "snapshots.max_age_s", "playback.max_sessions", "playback.lease_s", "exports.max_mb", "exports.retention_days", "events.retention_days", "audit.retention_days", "ai.budget_daily", "skins.budget_renders_per_floor", "skins.budget_monthly")


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
    exports_max_mb: int | None = Field(default=None, ge=50, le=20480, alias="exports.max_mb")
    exports_retention_days: int | None = Field(default=None, ge=1, le=365, alias="exports.retention_days")
    events_retention_days: int | None = Field(default=None, ge=1, le=3650, alias="events.retention_days")
    audit_retention_days: int | None = Field(default=None, ge=30, le=3650, alias="audit.retention_days")
    ui_design: str | None = Field(default=None, pattern="^(a|b)$", alias="ui.design")
    ui_design_names: str | None = Field(default=None, max_length=200, alias="ui.design_names")
    ui_wall_count: int | None = Field(default=None, ge=1, le=32, alias="ui.wall_count")
    ui_kiosk_cols: int | None = Field(default=None, ge=1, le=6, alias="ui.kiosk_cols")
    ui_kiosk_rows: int | None = Field(default=None, ge=1, le=5, alias="ui.kiosk_rows")
    ui_hide_search: str | None = Field(default=None, pattern="^(true|false)$", alias="ui.hide_search")
    ui_start_route: str | None = Field(default=None, pattern="^(explore|live|wall|events|playback)$", alias="ui.start_route")
    ui_hide_map: str | None = Field(default=None, pattern="^(true|false)$", alias="ui.hide_map")
    history_ha_secondary: str | None = Field(default=None, pattern="^(true|false)$", alias="history.ha_secondary")
    plan_estimates: str | None = Field(default=None, pattern="^(true|false)$", alias="plan.estimates")
    plan_levels: str | None = Field(default=None, pattern="^(all|default)$", alias="plan.levels")
    plan_quality: str | None = Field(default=None, pattern="^(1|2)$", alias="plan.quality")
    plan_presence_fade: str | None = Field(default=None, pattern="^(off|[1-9]|[1-9][0-9]|1[01][0-9]|120)$", alias="plan.presence_fade")  # off, or 1-120 minutes
    ai_provider: str | None = Field(default=None, pattern="^(none|local|external)$", alias="ai.provider")
    ai_privacy_ack: str | None = Field(default=None, pattern="^(true|false)$", alias="ai.privacy_ack")
    ai_budget_daily: int | None = Field(default=None, ge=0, le=100000, alias="ai.budget_daily")
    skins_provider: str | None = Field(default=None, pattern="^(openai)$", alias="skins.provider")
    skins_model: str | None = Field(default=None, pattern=r"^[a-z0-9][a-z0-9.\-]{1,63}$", alias="skins.model")
    skins_privacy_ack: str | None = Field(default=None, pattern="^(true|false)$", alias="skins.privacy_ack")
    skins_budget_renders_per_floor: int | None = Field(default=None, ge=0, le=6, alias="skins.budget_renders_per_floor")
    skins_budget_monthly: int | None = Field(default=None, ge=0, le=500, alias="skins.budget_monthly")
    access_ui_overview: str | None = Field(default=None, pattern="^(wiskey|smplwise)$", alias="access.ui.overview")
    access_ui_events: str | None = Field(default=None, pattern="^(wiskey|smplwise)$", alias="access.ui.events")
    access_ui_people: str | None = Field(default=None, pattern="^(wiskey|smplwise)$", alias="access.ui.people")
    ui_hide_wiskey: str | None = Field(default=None, pattern="^(true|false)$", alias="ui.hide_wiskey")
    devices_style: str | None = Field(default=None, pattern="^(smplwise|glass)$", alias="devices.style")
    devices_theme: str | None = Field(default=None, pattern="^(" + "|".join(DEVICE_THEMES) + ")$", alias="devices.theme")
    devices_default_view: str | None = Field(default=None, pattern="^(cards|tiles)$", alias="devices.default_view")
    devices_show_sensors: str | None = Field(default=None, pattern="^(true|false)$", alias="devices.show_sensors")
    devices_show_climate_strip: str | None = Field(default=None, pattern="^(true|false)$", alias="devices.show_climate_strip")
    devices_density: str | None = Field(default=None, pattern="^(comfortable|compact)$", alias="devices.density")

    model_config = {"populate_by_name": True}


@router.get("/settings")
def get_settings(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return {"settings": read_settings(conn), "can_edit": authorize(conn, principal, "system.configure", INSTALLATION).allowed}


@router.patch("/settings")
def patch_settings(body: SettingsPatch, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "system.configure", INSTALLATION)
    changes = {k: v for k, v in body.model_dump(by_alias=True).items() if v is not None}
    if "ui.design_names" in changes:
        try:
            names = json.loads(changes["ui.design_names"])
            assert isinstance(names, dict) and set(names) <= {"a", "b"} and all(isinstance(v, str) and 1 <= len(v.strip()) <= 24 for v in names.values())
        except (ValueError, AssertionError):
            raise ApiError(422, "validation", "שמות העיצובים: אובייקט עם a ו־b, עד 24 תווים לכל שם.")
        changes["ui.design_names"] = json.dumps({"a": names.get("a", "SW A").strip(), "b": names.get("b", "SW B").strip()}, ensure_ascii=False)
    if "time.zone" in changes:
        from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

        try:
            ZoneInfo(changes["time.zone"])
        except (ZoneInfoNotFoundError, ValueError):
            raise ApiError(422, "validation", "אזור זמן לא מוכר.", details={"time.zone": changes["time.zone"]})
    if changes.get("ai.provider") == "external":
        # the adapter contract exists (privacy, model version, budget, opt-in) but no provider is bundled: refuse, never pretend
        raise ApiError(422, "provider_not_available", "לא מצורף ספק ניתוח חיצוני; קיים רק חוזה המתאם (פרטיות, גרסת מודל, תקציב, opt-in).", details={"choices": ["none", "local"]})
    for key, value in changes.items():
        set_setting(conn, key, str(value))
    audit(conn, actor=principal, action="settings.update", decision="allowed", resource_type="installation", resource_id="*",
          request_id=getattr(request.state, "correlation_id", None), details=changes)
    return {"settings": read_settings(conn), "can_edit": True}
