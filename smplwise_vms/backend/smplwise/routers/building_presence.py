"""BUILDING-PRESENCE-2271 (board r339, plan PLAN_R339 phase 1): the building's anonymous presence, from the sensors the owner tags.

GET  /presence/building          the live aggregate (presence.building.view at any scope). `configured: false` while nothing is tagged -
                                  the screens then show nothing at all.
GET  /presence/building/sensors  the candidate sensors (class-detected) with their tag (system.configure)
PUT  /presence/building/sensors  the tagged set, replaced as a whole (system.configure; audited, entity ids only)
PUT  /presence/building/settings hold (debounce) seconds and the empty-timeout minutes (system.configure; audited)

Live state only: no history table, no person, no phone. The read is not audited (anonymous, polled)."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import resolve_principal, resolve_remote_first, settings_of, touch_user
from ..errors import ApiError, forbidden, validation
from ..rbac import INSTALLATION, Principal, authorize, note_grant, permissions_anywhere, require
from ..remote_channel import is_remote
from ..services import building_presence as bp
from ..services import ha_sync

router = APIRouter()


def _principal(request: Request) -> Principal:
    return resolve_remote_first(request) if is_remote(request) else resolve_principal(request, settings_of(request))


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


class SensorsIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    entity_ids: list[str] = Field(max_length=bp.MAX_SENSORS, default_factory=list)


class SettingsIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    hold_seconds: int | None = None
    empty_minutes: int | None = None


@router.get("/presence/building")
def building_snapshot(request: Request, principal: Principal = Depends(_principal)) -> dict[str, Any]:
    db = request.app.state.db
    with db.connection(mode="read", label="presence.building") as conn:
        touch_user(conn, principal)
        if bp.VIEW not in permissions_anywhere(conn, principal):
            with db.write_aside() as w:
                audit(w, actor=principal, action=bp.VIEW, decision="denied", resource_type="installation", resource_id="*", reason="no_binding", request_id=_rid(request))
            raise forbidden(permission=bp.VIEW)
        note_grant(authorize(conn, principal, bp.VIEW, INSTALLATION), bp.VIEW)
        return bp.snapshot(conn, fresh=bool(ha_sync.STATE.connected))


@router.get("/presence/building/sensors")
def building_sensors(request: Request, principal: Principal = Depends(_principal)) -> dict[str, Any]:
    with request.app.state.db.connection(mode="read", label="presence.building.sensors") as conn:
        touch_user(conn, principal)
        require(conn, principal, bp.CONFIGURE, INSTALLATION)
        return bp.list_for_settings(conn)


@router.put("/presence/building/sensors")
def set_building_sensors(body: SensorsIn, request: Request, principal: Principal = Depends(_principal)) -> dict[str, Any]:
    with request.app.state.db.connection(label="presence.building.tag") as conn:
        touch_user(conn, principal)
        require(conn, principal, bp.CONFIGURE, INSTALLATION)
        try:
            added, removed = bp.replace_tags(conn, body.entity_ids, principal.user_id)
        except LookupError as exc:
            raise validation("חיישן לא מוכר.", entity_id=str(exc)) from None
        except ValueError:
            raise ApiError(422, "too_many", "יותר מדי חיישנים מסומנים.") from None
        audit(conn, actor=principal, action="presence.building.tag", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
              details={"added": added, "removed": removed, "total": len(bp.tagged_ids(conn))})
        return bp.list_for_settings(conn)


@router.put("/presence/building/settings")
def set_building_settings(body: SettingsIn, request: Request, principal: Principal = Depends(_principal)) -> dict[str, Any]:
    with request.app.state.db.connection(label="presence.building.settings") as conn:
        touch_user(conn, principal)
        require(conn, principal, bp.CONFIGURE, INSTALLATION)
        try:
            cfg = bp.set_config(conn, body.model_dump(exclude_none=True))
        except ValueError as exc:
            raise validation("ערך לא תקין.", field=str(exc)) from None
        audit(conn, actor=principal, action="presence.building.settings", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request), details=cfg)
        return {"settings": cfg}
