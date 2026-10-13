"""The add-on's own `execute` block for WisKey doors (CR-033 5.3 / T3, slice D5a prep on the Arx side).

Bridge 0.8.1 (decision 20) will refuse `smplwise_bridge.execute` for a lock of the WisKey platform with the code
`wiskey_door_execute_blocked`, and refuse a lock target its registry does not know (fail closed). This module is the
same contract on the add-on side, at the ONE function that sends `execute` (`ha_client.call_bridge_execute`): whatever
route, bulk run, schedule or media path built the payload, a WisKey door never leaves through `execute` - it opens only
through the one door path (routers/access_control.open_door: the door authority, the trusted door transport). It does
not depend on the bridge version and is not weakened by the bridge's own policy setting (CR-033 13.2).

Refused (nothing is sent, `details.outcome = not_sent`):
- a `lock` or `button` target whose mirror platform is `hikvision_intercom` / `smplwise_intercom`;
- a target that is a door-map row (a WisKey door by the administrator's mapping, whatever its platform says);
- where any WisKey door exists: a `lock` target the mirror does not know or whose platform is still unknown (the window
  between a state event and the registry sync, review I9).

Everything else passes untouched and without a database read (only `lock` / `button` payloads are looked at)."""
from __future__ import annotations

import logging
import sqlite3
from typing import Any

from ..config import Settings
from ..errors import ApiError
from . import intercom_doors

log = logging.getLogger("smplwise.doors")

BLOCKED_CODE = "wiskey_door_execute_blocked"  # the bridge 0.8.1 answer code, used verbatim on the add-on side
DOOR_DOMAINS = frozenset({"lock", "button"})
BLOCKED_TEXT = "דלת אינטרקום נפתחת רק מכפתור הדלת. הפקודה לא נשלחה."


def _targets(data: Any) -> list[str]:
    value = data.get("entity_id") if isinstance(data, dict) else None
    if isinstance(value, str):
        return [v.strip() for v in value.split(",") if v.strip()]
    if isinstance(value, list):
        return [v for v in value if isinstance(v, str)]
    return []


def refusal(conn: sqlite3.Connection, domain: str, data: Any) -> str | None:
    """The reason an `execute` of `domain` on `data`'s targets must not be sent (None: send). Reasons: `wiskey_platform`,
    `door_map`, `unknown_lock` (fail closed, only where a WisKey door exists)."""
    if domain not in DOOR_DOMAINS:
        return None
    ids = _targets(data)
    if not ids:
        return None  # the bridge refuses a call without a target itself (entity_required)
    present: bool | None = None
    for entity_id in ids:
        row = conn.execute("SELECT platform FROM ha_entities WHERE entity_id = ?", (entity_id,)).fetchone()
        platform = (row["platform"] if row is not None else None) or ""
        if platform in intercom_doors.WISKEY_PLATFORMS:
            return "wiskey_platform"
        if intercom_doors.map_row(conn, entity_id) is not None:
            return "door_map"
        if domain == "lock" and not platform:
            if present is None:
                present = bool(intercom_doors.wiskey_lock_ids(conn)) or bool(intercom_doors.map_rows(conn))
            if present:
                return "unknown_lock"
    return None


def blocked(reason: str) -> ApiError:
    return ApiError(409, BLOCKED_CODE, BLOCKED_TEXT, details={"outcome": "not_sent", "sent": False, "reason": reason})


def check_payload(settings: Settings, payload: dict[str, Any]) -> None:
    """Raise `blocked` before anything leaves when the signed `execute` payload targets a WisKey door. A database that
    cannot be read refuses a `lock` / `button` payload (fail closed); every other domain is never looked at."""
    domain = payload.get("domain") if isinstance(payload, dict) else None
    if domain not in DOOR_DOMAINS:
        return
    from ..db import Database

    try:
        with Database(settings.db_path).connection(mode="read", label="door execute guard") as conn:
            reason = refusal(conn, str(domain), payload.get("data"))
    except Exception as exc:  # noqa: BLE001 - fail closed for the two domains that can hold a door
        log.warning("door execute guard: the mirror could not be read (%s); %s.%s not sent", type(exc).__name__, domain, payload.get("service"))
        raise blocked("guard_unavailable") from None
    if reason:
        log.warning("door execute guard: %s.%s not sent (%s)", domain, payload.get("service"), reason)
        raise blocked(reason)
