"""Installation mode (NVR-less mode, owner request 2026-09-29): an installation may run with Home Assistant only - device
control, floor plans and WisKey - and no Hikvision NVR ("only for electricity control").

The mode is derived from the add-on options on every start, never stored: no `nvr_host` means `ha_only`, a host means
`full`. Adding an NVR later is an options change plus a restart; nothing in the database depends on the mode, so the
switch needs no migration in either direction.

In `ha_only`:
- the NVR background work never starts (camera discovery, the alertStream listener, recording-derived events, the
  export worker, event thumbnails, the storage-report warm-up) - one INFO line at start-up says so;
- `/health`, `/health/summary` and `/health/report` show the NVR as "לא מוגדר" (neutral), never as an error;
- the routes that need the NVR answer 409 `nvr_not_configured` (after the caller is identified - an unidentified caller
  still gets 401) instead of a device timeout; local reads (the camera list, stored events, cases) keep answering;
- the UI hides the NVR areas from the navigation for everyone and answers their URLs with a "מצב ללא NVR" panel.
Hidden is not unprotected: every route keeps its own permission check in both modes."""
from __future__ import annotations

from typing import Any

from fastapi import Depends
from starlette.requests import HTTPConnection

from .config import Settings
from .errors import ApiError

FULL = "full"
HA_ONLY = "ha_only"

NVR_NOT_CONFIGURED_MESSAGE = ("ההתקנה פועלת במצב ללא NVR (Home Assistant בלבד). כדי להשתמש ב־NVR מלאו nvr_host, nvr_username "
                              "ו־nvr_password ב־Home Assistant › Add-ons › SMPLWISE VMS › Configuration והפעילו מחדש את ה־Add-on.")
NVR_LESS_LABEL = "לא מוגדר - מצב ללא NVR"


def installation_mode(settings: Settings) -> str:
    """`ha_only` when the add-on options name no NVR host, `full` otherwise (a host without credentials is a full
    installation whose NVR is not configured yet - the existing "not configured" wording applies to it)."""
    return FULL if (settings.nvr_host or "").strip() else HA_ONLY


def is_ha_only(settings: Settings) -> bool:
    return installation_mode(settings) == HA_ONLY


def describe(settings: Settings) -> dict[str, Any]:
    """The mode block the API reports (/me, /health, /setup/state)."""
    ha_only = is_ha_only(settings)
    return {"mode": installation_mode(settings), "nvr": {"configured": bool(settings.nvr_host and settings.nvr_user and settings.nvr_password),
                                                         "state": "not_configured" if ha_only else "configured" if settings.nvr_user else "incomplete",
                                                         "label": NVR_LESS_LABEL if ha_only else ""}}


def nvr_not_configured() -> ApiError:
    return ApiError(409, "nvr_not_configured", NVR_NOT_CONFIGURED_MESSAGE, details={"mode": HA_ONLY})


def _require_nvr(conn: HTTPConnection) -> None:
    settings: Settings = conn.app.state.settings
    if not is_ha_only(settings):
        return
    from .auth import resolve_principal

    resolve_principal(conn, settings)  # type: ignore[arg-type]  # 401 for an unidentified caller comes first
    raise nvr_not_configured()


# `dependencies=[REQUIRE_NVR]` on a route (or a router) that needs the NVR
REQUIRE_NVR = Depends(_require_nvr)
