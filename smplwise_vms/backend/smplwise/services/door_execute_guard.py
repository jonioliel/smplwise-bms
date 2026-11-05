"""The add-on's own `execute` block for WisKey doors (CR-033 5.3 / T3, slice D5a prep on the Arx side).

Bridge 0.10.5 (DOOR-BRIDGE-BLOCK-2404; planned as "0.8.1" in CR-033 decision 20) refuses `smplwise_bridge.execute` for a
lock / button of the WisKey platform with the code `wiskey_door_execute_blocked`, and - where WisKey exists - a lock target
its registry does not know (fail closed), unless the bridge's own administrator setting `wiskey_execute_policy` (in Home
Assistant's options flow of the bridge) says `allowed`. This module is the
same contract on the add-on side, at the ONE function that sends `execute` (`ha_client.call_bridge_execute`): whatever
route, bulk run, schedule or media path built the payload, a WisKey door never leaves through `execute` - it opens only
through the one door path (routers/access_control.open_door: the door authority, the trusted door transport). It does
not depend on the bridge version and is not weakened by the bridge's own policy setting (CR-033 13.2).

Refused (nothing is sent, `details.outcome = not_sent`):
- a `lock` or `button` target whose mirror platform is `hikvision_intercom` / `smplwise_intercom`;
- a target that is a door-map row (a WisKey door by the administrator's mapping, whatever its platform says);
- where any WisKey door exists: a `lock` target the mirror does not know or whose platform is still unknown (the window
  between a state event and the registry sync, review I9).

Everything else passes untouched and without a database read (only `lock` / `button` payloads are looked at).

`note_directory_push` records the bridge's reported policy (bridge >= 0.10.5) as read-only state with an audit row when it
changes; it never decides anything here."""
from __future__ import annotations

import logging
import sqlite3
from typing import Any

from ..config import Settings
from ..errors import ApiError
from . import intercom_doors

log = logging.getLogger("smplwise.doors")

BLOCKED_CODE = "wiskey_door_execute_blocked"  # the bridge's answer code (0.10.5), used verbatim on the add-on side
# DOOR-BRIDGE-BLOCK-2404: what the bridge last reported for its own door block (its directory push): `blocked` | `allowed`; empty = the
# bridge never reported it (older than 0.10.5). Runtime state only - never restored from a backup, never a request.
BRIDGE_POLICY_KEY = "bridge.wiskey_execute_policy"
BRIDGE_POLICIES = ("blocked", "allowed")
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


def note_directory_push(conn: sqlite3.Connection, message: dict[str, Any]) -> None:
    """The bridge's door block setting travels with each signed directory push (bridge >= 0.10.5): recorded, and audited when it
    changes (`bridge.wiskey_execute_policy_seen`). Anything but exactly `allowed` is recorded as `blocked` (the bridge's own rule)."""
    if "wiskey_execute_policy" not in message:
        return
    from ..audit import audit
    from ..db import get_setting, set_setting

    value = "allowed" if message.get("wiskey_execute_policy") == "allowed" else "blocked"
    previous = get_setting(conn, BRIDGE_POLICY_KEY) or ""
    if value == previous:
        return
    set_setting(conn, BRIDGE_POLICY_KEY, value)
    audit(conn, actor=None, action="bridge.wiskey_execute_policy_seen", decision="allowed", resource_type="installation", resource_id="wiskey_execute_policy",
          details={"policy": value, "previous": previous or None})
    log.info("bridge reports its WisKey door block as %s (was %s)", value, previous or "unreported")
