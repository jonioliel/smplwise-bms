"""CR-EMERG104 section 5: the module switch, the clock and the permissions of the emergency readiness view.

The page is an INSTALLATION-level view. Opening it needs `maintenance.view` (the ledger it is an appendix of) OR the grantable
`emergency.view` (owner q202: "a grantable permission to view and edit"); changing its configuration (slot binding, thresholds, emergency cameras,
not-applicable marks, the contact list) needs `maintenance.manage` OR `emergency.manage`. Each ROW's detail needs the permission of the source it
reads (CR section 5); a row the caller may not see is replaced by a redacted row that still counts in the verdict, so the verdict never looks
better to a narrow role. Arx RBAC is the only authority: no client flag, no Home Assistant admin flag, no WisKey claim widens anything."""
from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from typing import Callable

from ...db import get_setting
from ...errors import ApiError
from ...rbac import Principal, permissions_anywhere

FEATURE_KEY = "emergency_readiness.enabled"
VIEW_KEYS = ("maintenance.view", "emergency.view")
MANAGE_KEYS = ("maintenance.manage", "emergency.manage")
EMERGENCY_VIEW, EMERGENCY_MANAGE = "emergency.view", "emergency.manage"

# item id -> the permission(s) of its source (ANY of them opens the row's detail)
ROW_PERMISSION: dict[str, tuple[str, ...]] = {
    "E01": ("generator.view",), "E02": ("generator.view",), "E02b": ("generator.view",),
    "E03": ("maintenance.view",), "E04": ("maintenance.view",), "E05": ("maintenance.view",), "E06": ("maintenance.view",), "E07": ("maintenance.view",),
    "E08": ("tickets.view",),
    "E09": ("maintenance.view",), "E10": ("devices.read",),
    "E11": ("access.stations.read",), "E12": ("access.stations.read",),
    "E13": ("notify.manage", "maintenance.manage", "emergency.manage"), "E14": ("maintenance.view",),
    "E15": ("notify.manage",), "E16": ("backup.manage",),
    "E17": ("system.configure", "devices.read"), "E18": ("system.configure", "devices.read"), "E19": ("system.configure", "devices.read"),
}


def _real_now() -> datetime:
    return datetime.now(timezone.utc)


_now_fn: Callable[[], datetime] = _real_now


def now() -> datetime:
    return _now_fn().astimezone(timezone.utc).replace(microsecond=0)


def set_clock(fn: Callable[[], datetime] | None) -> None:
    """Tests inject the clock (never a sleep); None restores the real one."""
    global _now_fn
    _now_fn = fn or _real_now


def now_iso() -> str:
    return now().strftime("%Y-%m-%dT%H:%M:%SZ")


def module_on(conn: sqlite3.Connection) -> bool:
    return (get_setting(conn, FEATURE_KEY, "false") or "false") == "true"


def require_module(conn: sqlite3.Connection) -> None:
    if not module_on(conn):
        raise ApiError(404, "feature_disabled", "מודול מוכנות לחירום כבוי בהגדרות המערכת.")


class Viewer:
    """One caller's permissions, decided once per request."""

    def __init__(self, conn: sqlite3.Connection, principal: Principal) -> None:
        self.conn = conn
        self.principal = principal
        self._held: frozenset[str] | None = None

    @property
    def uid(self) -> str:
        return self.principal.user_id

    @property
    def held(self) -> frozenset[str]:
        if self._held is None:
            row = self.conn.execute("SELECT active FROM users WHERE id = ?", (self.uid,)).fetchone()
            active = row is None or bool(row["active"])
            self._held = frozenset(permissions_anywhere(self.conn, self.principal)) if active else frozenset()
        return self._held

    def has_any(self, keys: tuple[str, ...]) -> bool:
        return any(k in self.held for k in keys)

    def can_view(self) -> bool:
        return self.has_any(VIEW_KEYS)

    def can_manage(self) -> bool:
        return self.has_any(MANAGE_KEYS)

    def can_row(self, item_id: str) -> bool:
        return self.has_any(ROW_PERMISSION.get(item_id, ("system.configure",)))

    def require_view(self) -> None:
        if self.can_view():
            return
        self._deny("emergency.view")

    def require_manage(self) -> None:
        if self.can_manage():
            return
        self._deny("emergency.manage")

    def _deny(self, permission: str) -> None:
        from ...audit import audit

        audit(self.conn, actor=self.principal, action=permission, decision="denied", resource_type="installation", resource_id="*", reason="no_binding")
        raise ApiError(403, "forbidden", "אין הרשאה למוכנות לחירום.", details={"permission": permission})


# ---------------------------------------------------------------- the stored configuration (settings values; no schema)

SLOTS_NOTE = "emergency.not_applicable"     # {item_id: {by, at, note}}  (owner: shown with the person and the date)
THRESHOLDS_KEY = "emergency.thresholds"     # {key: number} overrides of model.THRESHOLDS
CAMERAS_KEY = "emergency.cameras"           # [camera_id, ...] the "emergency cameras" (owner q206 b)
CONFIG_REVISION_KEY = "emergency.config_revision"
