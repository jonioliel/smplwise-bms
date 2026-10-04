"""Installation mode (NVR-less mode, owner request 2026-09-29): an installation may run with Home Assistant only - device
control, floor plans and WisKey - and no Hikvision NVR ("only for electricity control").

The mode is derived from the EFFECTIVE NVR connection on every start, never stored: no NVR host means `ha_only`, a host
means `full`. CR-022: the connection is the stored `recorder_connections` row (services/connection_store.py, overlaid
once at start-up; vendor `none` = the installer's explicit "no NVR"), else the legacy add-on options / NVR_* values.
Adding an NVR later is a connection change in Arx plus a restart; nothing else in the database depends on the mode, so
the switch needs no migration in either direction.

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

# CR-022: operator language only - the connection is entered in Arx (הגדרות › חיבורים), never in the platform's options
NVR_NOT_CONFIGURED_MESSAGE = ("ההתקנה פועלת במצב ללא NVR. כדי להשתמש ב־NVR בחרו את סוג ה־NVR והזינו את פרטי החיבור "
                              "בהגדרות › חיבורים, ואז הפעילו את המערכת מחדש.")
NVR_LESS_LABEL = "לא מוגדר - מצב ללא NVR"
UNREADABLE_LABEL = "לא ניתן לקרוא את פרטי החיבור השמורים - יש להזין את הסיסמה מחדש"
REFUSED_LABEL = "הכתובת השמורה של ה־NVR אינה מותרת - יש להזין כתובת אחרת"
DISABLED_LABEL = "ה־NVR מושבת"


def installation_mode(settings: Settings) -> str:
    """`ha_only` when the effective connection names no NVR host, `full` otherwise (a host without credentials is a full
    installation whose NVR is not configured yet - the existing "not configured" wording applies to it).
    NN1: a thin compatibility wrapper over the `nvr` capability (capabilities.py, the one place that reads the NVR host).
    CR-024: any configured recorder makes the installation `full` (the first one may be removed while another stays)."""
    if nvr_host(settings):
        return FULL
    from .recorder_scope import any_configured, is_child

    return FULL if not is_child(settings) and any_configured(settings) else HA_ONLY


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
    if settings.nvr_connection_state == "unreadable":  # CR-022: fail closed - the NVR is treated as not configured
        return {"mode": installation_mode(settings), "nvr": {"configured": False, "state": "unreadable", "label": UNREADABLE_LABEL}}
    if settings.nvr_connection_state == "refused":  # CR-022 review F5: the stored host failed the source policy at start-up
        return {"mode": installation_mode(settings), "nvr": {"configured": False, "state": "refused", "label": REFUSED_LABEL}}
    if settings.nvr_connection_state == "disabled":  # CR-024: the administrator disabled the first recorder
        return {"mode": installation_mode(settings), "nvr": {"configured": False, "state": "disabled", "label": DISABLED_LABEL}}
    state = "not_configured" if ha_only else "placeholder" if is_placeholder(settings) else "configured" if nvr_ready(settings) else "incomplete"
    label = NVR_LESS_LABEL if ha_only else "כתובת NVR זמנית של סביבת פיתוח (לא NVR אמיתי)" if state == "placeholder" else ""
    return {"mode": installation_mode(settings), "nvr": {"configured": nvr_ready(settings), "state": state, "label": label}}


def nvr_not_configured() -> ApiError:
    return ApiError(409, "nvr_not_configured", NVR_NOT_CONFIGURED_MESSAGE, details={"mode": HA_ONLY})


RECORDER_UNAVAILABLE_MESSAGE = "ה־NVR הזה אינו מחובר כעת (מושבת, הוסר, או שפרטי החיבור שלו ממתינים להפעלה מחדש)."


def recorder_unavailable(recorder_id: str) -> ApiError:
    return ApiError(409, "recorder_unavailable", RECORDER_UNAVAILABLE_MESSAGE, details={"recorder_id": recorder_id})


def ensure_nvr(settings: Settings) -> None:
    """409 nvr_not_configured in the NVR-less mode. Called at the NVR boundary and by handlers that reach no device -
    always after the handler's own permission check, never instead of it.
    CR-024: the settings of a further recorder (recorder_scope.settings_for) without a usable connection answer 409
    `recorder_unavailable` - never another recorder's device."""
    from .recorder_scope import has_host, is_child

    if is_child(settings):
        if not has_host(settings):
            raise recorder_unavailable(settings.nvr_recorder_id)
        return
    if is_ha_only(settings):
        raise nvr_not_configured()
