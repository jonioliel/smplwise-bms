"""Installation mode (NVR-less mode, owner request 2026-09-29): an installation may run with Home Assistant only - device
control, floor plans and WisKey - and no Hikvision NVR ("only for electricity control").

The mode is derived from the add-on options on every start, never stored: no `nvr_host` means `ha_only`, a host means
`full`. Adding an NVR later is an options change plus a restart; nothing in the database depends on the mode, so the
switch needs no migration in either direction.

In `ha_only`:
- the NVR background work never starts (camera discovery, the alertStream listener, recording-derived events, the
  export worker, event thumbnails, the storage-report warm-up) - one INFO line at start-up says so;
- `/health`, `/health/summary` and `/health/report` show the NVR as "לא מוגדר" (neutral), never as an error;
- the routes that need the NVR answer 409 `nvr_not_configured` instead of a device error. The check sits at the NVR
  boundary (`ensure_nvr`: the ISAPI client, the RTSP URL builders) and in the few handlers that reach no device, always
  after the handler's own identity and permission checks - so 401 / 403 and their audit rows are exactly as before, and
  only an authorised caller learns that the NVR is absent; local reads (the camera list, stored events, cases) keep
  answering;
- the UI hides the NVR areas from the navigation for everyone and answers their URLs with a "מצב ללא NVR" panel.
Hidden is not unprotected: every route keeps its own permission check in both modes."""
from __future__ import annotations

from typing import Any

from .capabilities import nvr_host
from .config import DEV_NVR_PLACEHOLDER, Settings
from .errors import ApiError

FULL = "full"
HA_ONLY = "ha_only"

NVR_NOT_CONFIGURED_MESSAGE = ("ההתקנה פועלת במצב ללא NVR (תשתית המערכת בלבד). כדי להשתמש ב־NVR מלאו nvr_host, nvr_username "
                              "ו־nvr_password בהגדרות SmplWise Arx בתשתית המערכת והפעילו מחדש.")
NVR_LESS_LABEL = "לא מוגדר - מצב ללא NVR"


def installation_mode(settings: Settings) -> str:
    """`ha_only` when the add-on options name no NVR host, `full` otherwise (a host without credentials is a full
    installation whose NVR is not configured yet - the existing "not configured" wording applies to it).
    NN1: a thin compatibility wrapper over the `nvr` capability (capabilities.py, the one place that reads the NVR host)."""
    return FULL if nvr_host(settings) else HA_ONLY


def is_ha_only(settings: Settings) -> bool:
    return installation_mode(settings) == HA_ONLY


def nvr_ready(settings: Settings) -> bool:
    """An NVR the add-on can talk to: a host and credentials (the developer placeholder host alone is not one)."""
    return bool(settings.nvr_host and settings.nvr_user and settings.nvr_password)


def is_placeholder(settings: Settings) -> bool:
    """The developer / test placeholder host (config.DEV_NVR_PLACEHOLDER): full mode, no real NVR."""
    return settings.nvr_host == DEV_NVR_PLACEHOLDER


def describe(settings: Settings) -> dict[str, Any]:
    """The mode block the API reports (/me, /health, /setup/state)."""
    ha_only = is_ha_only(settings)
    state = "not_configured" if ha_only else "placeholder" if is_placeholder(settings) else "configured" if nvr_ready(settings) else "incomplete"
    label = NVR_LESS_LABEL if ha_only else "כתובת NVR זמנית של סביבת פיתוח (לא NVR אמיתי)" if state == "placeholder" else ""
    return {"mode": installation_mode(settings), "nvr": {"configured": nvr_ready(settings), "state": state, "label": label}}


def nvr_not_configured() -> ApiError:
    return ApiError(409, "nvr_not_configured", NVR_NOT_CONFIGURED_MESSAGE, details={"mode": HA_ONLY})


def ensure_nvr(settings: Settings) -> None:
    """409 nvr_not_configured in the NVR-less mode. Called at the NVR boundary and by handlers that reach no device -
    always after the handler's own permission check, never instead of it."""
    if is_ha_only(settings):
        raise nvr_not_configured()
