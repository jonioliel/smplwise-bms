"""WISKEY-INSTALLER-NATIVE-2400 (owner decision 03.11, Q7 "ג"): WisKey's installer tools in Arx - הגדרות › התקנה ותחזוקת מערכת
האינטרקום. One router per phase (routers/wiskey_installer_<phase>.py, the rules in wiskey_installer_common.py), all under
`/access-control/installer/`, all system.configure at the installation. This module only gathers them and serves the overview:
which tools this WisKey offers (its `overview.api.commands` for the add-on's user; a tool WisKey does not list is shown as
unavailable, never guessed) and the state of the live session."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request

from ..auth import settings_of
from ..rbac import Principal
from ..services import intercom_sync, wiskey_channels
from ..services import wiskey_installer as wi
from . import wiskey_installer_clock
from .wiskey_installer_common import installer_reader

router = APIRouter()
router.include_router(wiskey_installer_clock.router)

TOOLS: dict[str, tuple[str, ...]] = {
    "clock": ("clock/settings_get", "clock/settings_update", "clock/host_status", "clock/host_apply", "clock/station_sync"),
}


@router.get("/access-control/installer/overview")
def installer_overview(request: Request, principal: Principal = Depends(installer_reader)) -> dict[str, Any]:
    settings = settings_of(request)
    listed = wi.listed(settings, wiskey_channels.INSTALLER)
    stations = wi.stations(settings)
    tools = {}
    for name, commands in TOOLS.items():
        facts = [listed.get(c) for c in commands]
        tools[name] = {"available": None if any(f is None for f in facts) else all(facts), "missing": sorted(c for c, f in zip(commands, facts) if f is False)}
    return {
        "feed": intercom_sync.STATE.state,
        "stations": None if stations is None else [{"id": s.get("id"), "name": s.get("name"), "online": bool(s.get("online"))} for s in stations],
        "tools": tools,
    }


def reset() -> None:
    wi.reset()
    wiskey_installer_clock.reset()
