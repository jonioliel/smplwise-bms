"""NVR-H264-BULK-2341: the per-recorder switch "אפשר שינויי הגדרות ב־NVR" (docs/changes/NVR-H264-BULK-2341.md).

Arx writes stream encoding settings to a recorder (CR-020: a single stream's editor, the multi-camera batch, the bulk encoding
change and their undos) only while this switch is on for that recorder. The switch lives in the `settings` table under
`nvr.writes_enabled:<recorder id>` ("1" / "0") and in the process (recorder_scope.WRITES), so turning it off applies AT ONCE:
every adapter built from that moment refuses the write before a request is built (Provision-ISR: `writes_enabled`; Hikvision:
`writes_enabled`, both read recorder_scope.WRITES). It is loaded at start-up (`load_all`).

CR-NVR-GUARD-2438 (owner decision O2 = b, 14.11): the switch covers EVERY settings change to the recorder, not only stream
encoding - notifications, motion, clock / NTP, OSD, schedules, smart rules, privacy masks, any undo - and the two reboots; the
operational actions (manual recording, output pulse, disk test) stay outside it. The kind table and the guard are in
services/nvr_write_guard.py.

Never switched (no row): the vendor's own default - Provision-ISR reads the legacy `nvr_extra.writes_enabled` (off unless set),
Hikvision stays on as shipped since CR-020 S2. Other vendors (Frigate, "no NVR") have no encoding writes: 409 `writes_not_supported`.

Only an administrator with BOTH `system.configure` (the connection settings) and `nvr.configure` (the sensitive NVR-write
permission) may change it; turning it on needs `confirm: true` (the screen's Hebrew confirmation dialog). Every change, and every
refused attempt, is an audit row `nvr.writes.switch` (who / when / from / to). Nothing here talks to a device.
"""
from __future__ import annotations

import json
import sqlite3
from typing import Any

from ..audit import audit
from ..db import get_setting, set_setting
from ..errors import ApiError
from ..recorder_scope import WRITES, set_writes_override, writes_override

KEY_PREFIX = "nvr.writes_enabled:"
ACTION = "nvr.writes.switch"
PERMISSIONS = ("system.configure", "nvr.configure")
# vendor -> its default when the switch was never set (Provision-ISR: the legacy extra flag decides; see `effective`)
VENDORS: dict[str, bool] = {"hikvision": True, "provision_isr": False}


def key(recorder_id: str) -> str:
    return KEY_PREFIX + recorder_id


def stored(conn: sqlite3.Connection, recorder_id: str) -> bool | None:
    raw = get_setting(conn, key(recorder_id))
    return None if raw is None else raw == "1"


def load_all(conn: sqlite3.Connection) -> int:
    """Start-up: every stored switch into the process (recorder_scope.WRITES). Returns how many were loaded."""
    WRITES.clear()
    n = 0
    for r in conn.execute("SELECT key, value FROM settings WHERE key LIKE ?", (KEY_PREFIX + "%",)).fetchall():
        set_writes_override(str(r[0])[len(KEY_PREFIX):], str(r[1]) == "1")
        n += 1
    return n


def supported(vendor: str | None) -> bool:
    return vendor in VENDORS


def effective(recorder_id: str, vendor: str | None, extra: dict[str, Any] | None) -> bool:
    """What the adapter of this recorder does right now (the same rule as the adapters' `writes_enabled`)."""
    if not supported(vendor):
        return False
    override = writes_override(recorder_id)
    if override is not None:
        return override
    e = extra or {}
    if vendor == "provision_isr":
        return e.get("writes_enabled") is True
    return e.get("writes_enabled") is not False


def _last_change(conn: sqlite3.Connection, recorder_id: str) -> dict[str, Any] | None:
    """Who turned it on / off last, and when (the latest allowed audit row)."""
    r = conn.execute("SELECT at, actor_username, details_json FROM audit_log WHERE action = ? AND resource_type = 'recorder' AND resource_id = ? "
                     "AND decision = 'allowed' ORDER BY id DESC LIMIT 1", (ACTION, recorder_id)).fetchone()
    if r is None:
        return None
    try:
        d = json.loads(r["details_json"] or "{}")
    except ValueError:
        d = {}
    return {"at": r["at"], "by": r["actor_username"], "enabled": bool(d.get("enabled"))}


def state(conn: sqlite3.Connection, recorder_id: str, vendor: str | None, extra: dict[str, Any] | None) -> dict[str, Any]:
    """The switch as the settings screen shows it. Never an address or a credential."""
    explicit = stored(conn, recorder_id)
    return {"recorder_id": recorder_id, "vendor": vendor, "supported": supported(vendor), "enabled": effective(recorder_id, vendor, extra),
            "explicit": explicit is not None, "default": VENDORS.get(vendor or "", False), "last_change": _last_change(conn, recorder_id)}


def set_switch(conn: sqlite3.Connection, principal: Any, recorder_id: str, vendor: str | None, extra: dict[str, Any] | None, *, enabled: bool,
               confirm: bool, request_id: str | None = None) -> dict[str, Any]:
    """Turn the switch on / off. The caller has checked both permissions. Turning it on needs `confirm` (the dialog); turning it
    off never does (a safety action). Applies at once (no restart) and is audited."""
    previous = effective(recorder_id, vendor, extra)

    def deny(code: str, status: int, message: str) -> ApiError:
        audit(conn, actor=principal, action=ACTION, decision="denied", resource_type="recorder", resource_id=recorder_id, reason=code, request_id=request_id,
              details={"enabled": enabled, "previous": previous, "vendor": vendor})
        return ApiError(status, code, message)

    if not supported(vendor):
        raise deny("writes_not_supported", 409, "ל־NVR הזה אין שינויי הגדרות דרך Arx.")
    if enabled and confirm is not True:
        raise deny("confirm_required", 422, "יש לאשר את הפעלת שינויי ההגדרות ב־NVR.")
    set_setting(conn, key(recorder_id), "1" if enabled else "0")
    set_writes_override(recorder_id, enabled)
    audit(conn, actor=principal, action=ACTION, decision="allowed", resource_type="recorder", resource_id=recorder_id, request_id=request_id,
          details={"enabled": enabled, "previous": previous, "changed": previous != enabled, "vendor": vendor})
    return state(conn, recorder_id, vendor, extra)
