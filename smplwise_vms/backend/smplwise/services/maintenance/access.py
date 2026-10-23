"""CR-MAINT215 section 4: the module switch, the clock and THE visibility rule of the maintenance module.

WHAT a caller may do is a permission (maintenance.view / perform / manage); WHERE is the task's place - its floor, else its
building, else its site. A placeless task (and every supplier document) follows the tickets module's rule for a placeless
ticket (owner answer 24.10 q15): the permission held at ANY scope. Every read of a task goes through `visible()`: an invisible, unknown, deleted or foreign id is the same 404
`maint_task_not_found`. While `maintenance.enabled` is off every route but GET /maintenance/module answers 404 `feature_disabled`
and the worker does nothing. Arx RBAC is the only authority: no client flag, no Home Assistant admin flag."""
from __future__ import annotations

import sqlite3
from datetime import date, datetime, timezone
from typing import Any, Callable

from ...db import get_setting
from ...errors import ApiError
from ...rbac import INSTALLATION, Principal, authorize, permissions_anywhere

FEATURE_KEY = "maintenance.enabled"
VIEW, PERFORM, MANAGE = "maintenance.view", "maintenance.perform", "maintenance.manage"
PERMISSIONS = (VIEW, PERFORM, MANAGE)


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


def zone(conn: sqlite3.Connection):
    from ..access_grants import zone_of

    return zone_of(conn)


def today(conn: sqlite3.Connection, at: datetime | None = None) -> date:
    """The installation's local calendar date (IANA zone from the settings; never a fixed offset)."""
    return (at or now()).astimezone(zone(conn)).date()


def module_on(conn: sqlite3.Connection) -> bool:
    return (get_setting(conn, FEATURE_KEY, "false") or "false") == "true"


def require_module(conn: sqlite3.Connection) -> None:
    if not module_on(conn):
        raise ApiError(404, "feature_disabled", "מודול האחזקה כבוי בהגדרות המערכת.")


def not_found() -> ApiError:
    return ApiError(404, "maint_task_not_found", "המשימה לא נמצאה.")


def target_of(row: dict[str, Any] | sqlite3.Row | None) -> tuple[str, str]:
    """The RBAC target of a task: floor, else building, else site, else the installation."""
    if row is not None:
        for kind in ("floor", "building", "site"):
            v = row[f"{kind}_id"]
            if v:
                return (kind, v)
    return INSTALLATION


class Viewer:
    """One caller's view of the module for one request: each (permission, target) decided once."""

    def __init__(self, conn: sqlite3.Connection, principal: Principal) -> None:
        self.conn = conn
        self.principal = principal
        self._cache: dict[tuple[str, tuple[str, str]], bool] = {}
        self._anywhere: frozenset[str] | None = None

    @property
    def uid(self) -> str:
        return self.principal.user_id

    def holds(self, permission: str, target: tuple[str, str]) -> bool:
        key = (permission, target)
        if key not in self._cache:
            self._cache[key] = authorize(self.conn, self.principal, permission, target).allowed
        return self._cache[key]

    def holds_where(self, permission: str, target: tuple[str, str]) -> bool:
        """The permission WHERE a task lies: on its place target, or at any scope for a placeless task (owner answer 24.10 q15,
        like a placeless ticket). An explicit deny at the installation still wins through `authorize` for a placed task only."""
        if target == INSTALLATION:
            return permission in self.anywhere
        return self.holds(permission, target)

    def holds_on(self, permission: str, row: Any) -> bool:
        return self.holds_where(permission, target_of(row))

    @property
    def anywhere(self) -> frozenset[str]:
        if self._anywhere is None:
            row = self.conn.execute("SELECT active FROM users WHERE id = ?", (self.uid,)).fetchone()
            active = row is None or bool(row["active"])
            self._anywhere = frozenset(permissions_anywhere(self.conn, self.principal)) if active else frozenset()
        return self._anywhere

    def require_anywhere(self, permission: str) -> None:
        """The permission at some scope - the entry check of a list route (the rows are then filtered per target)."""
        if permission in self.anywhere:
            return
        from ...audit import audit

        audit(self.conn, actor=self.principal, action=permission, decision="denied", resource_type="installation", resource_id="*", reason="no_binding")
        raise ApiError(403, "forbidden", "אין הרשאה למודול האחזקה.", details={"permission": permission})

    def require_on(self, permission: str, row: Any, *, action: str | None = None) -> None:
        """`permission` on the task's target - an audited 403 (the caller already proved it may SEE the task)."""
        target = target_of(row)
        if self.holds_where(permission, target):
            return
        from ...audit import audit

        audit(self.conn, actor=self.principal, action=action or permission, decision="denied", resource_type=target[0], resource_id=target[1], reason="no_binding",
              details={"permission": permission})
        raise ApiError(403, "forbidden", "אין הרשאה לפעולה הזו במשימה.", details={"permission": permission})


def visible(viewer: Viewer, row: Any) -> bool:
    """THE rule: module on, the task not deleted, maintenance.view on its target."""
    if row is None or row["deleted_at"]:
        return False
    if not module_on(viewer.conn):
        return False
    return viewer.holds_where(VIEW, target_of(row))


DEFAULT_LEAD_KEY = "maintenance.lead_days."
TAG_BASE_KEY = "maintenance.tag_base_url"


def default_lead(conn: sqlite3.Connection, kind: str) -> int:
    """The lead time a new task gets when its form leaves it empty (Settings, owner answer 24.10 q13); the built-in value otherwise."""
    from . import model

    raw = get_setting(conn, DEFAULT_LEAD_KEY + kind, None)
    try:
        v = int(str(raw))
    except (TypeError, ValueError):
        return model.DEFAULT_LEAD[kind]
    return v if 0 <= v <= model.LEAD_MAX else model.DEFAULT_LEAD[kind]


# MAINT215B (owner review 24.10): every behaviour switch and threshold is a setting; the built-in value is the second argument.
REMINDERS_KEY = "maintenance.reminders_enabled"          # reminders go out only after an administrator enables them (default off)
ROUND_VIEW_KEY = "maintenance.round_phone_view"          # step (one checkpoint per screen) | list (one long list) - the default of the phone round
CLOSE_MODE_KEY = "maintenance.close_request_mode"        # ask (default) | auto | off: what closing a plan's request does to the plan
CHECK_MINUTES_KEY = "maintenance.reminder_check_minutes"  # how often the worker looks (1-1440)
LOG_KEEP_KEY = "maintenance.reminder_log_keep_days"      # how long the reminder log is kept (7-3650)
MISSING_INSURANCE_KEY = "maintenance.vendor_missing_insurance_mark"  # mark a supplier with no insurance document at all
INSURANCE_WARN_KEY = "maintenance.vendor_insurance_warn_days"        # amber mark when the insurance ends within this many days (0-365)
FILE_MAX_KEY = "maintenance.file_max_per_task"           # certificate / document files per task (1-50)
CLOSE_MODES = ("ask", "auto", "off")
ROUND_VIEWS = ("step", "list")
DEFAULT_CHECK_MINUTES, DEFAULT_LOG_KEEP_DAYS, DEFAULT_INSURANCE_WARN = 15, 365, 30


def _int_setting(conn: sqlite3.Connection, key: str, default: int, lo: int, hi: int) -> int:
    try:
        v = int(str(get_setting(conn, key, None)))
    except (TypeError, ValueError):
        return default
    return v if lo <= v <= hi else default


def _flag(conn: sqlite3.Connection, key: str, default: bool) -> bool:
    raw = get_setting(conn, key, None)
    return default if raw is None else str(raw) == "true"


def file_max_per_task(conn: sqlite3.Connection) -> int:
    return _int_setting(conn, FILE_MAX_KEY, 10, 1, 50)


def reminders_enabled(conn: sqlite3.Connection) -> bool:
    return _flag(conn, REMINDERS_KEY, False)


def close_mode(conn: sqlite3.Connection) -> str:
    v = get_setting(conn, CLOSE_MODE_KEY, "ask")
    return v if v in CLOSE_MODES else "ask"


def round_view(conn: sqlite3.Connection) -> str:
    v = get_setting(conn, ROUND_VIEW_KEY, "step")
    return v if v in ROUND_VIEWS else "step"


def check_minutes(conn: sqlite3.Connection) -> int:
    return _int_setting(conn, CHECK_MINUTES_KEY, DEFAULT_CHECK_MINUTES, 1, 1440)


def log_keep_days(conn: sqlite3.Connection) -> int:
    return _int_setting(conn, LOG_KEEP_KEY, DEFAULT_LOG_KEEP_DAYS, 7, 3650)


def missing_insurance_mark(conn: sqlite3.Connection) -> bool:
    return _flag(conn, MISSING_INSURANCE_KEY, True)


def insurance_warn_days(conn: sqlite3.Connection) -> int:
    return _int_setting(conn, INSURANCE_WARN_KEY, DEFAULT_INSURANCE_WARN, 0, 365)


def remote_address(conn: sqlite3.Connection) -> str:
    """The installation's remote address (Settings > local identity `security.local_public_url`), else the tickets module's public
    address; "" when neither is set."""
    v = (get_setting(conn, "security.local_public_url", "") or "").strip()
    if v:
        return v
    try:
        from ..tickets import handler_links

        return (handler_links.public_base_url(conn) or "").strip()
    except Exception:  # noqa: BLE001 - an address problem never breaks a screen; the sticker then falls back to this page's address
        return ""


def tag_base(conn: sqlite3.Connection) -> str:
    """The address a sticker carries (owner 24.10: the REMOTE address): the explicit override in Settings, else the remote address."""
    return (get_setting(conn, TAG_BASE_KEY, "") or "").strip() or remote_address(conn)


def defaults(conn: sqlite3.Connection) -> dict[str, Any]:
    """The installation's editable defaults the screens show (lead per kind, the sticker address, the behaviours)."""
    from . import model

    return {"lead_days": {k: default_lead(conn, k) for k in model.KINDS}, "tag_base_url": get_setting(conn, TAG_BASE_KEY, "") or "",
            "tag_effective_url": tag_base(conn), "reminders_enabled": reminders_enabled(conn), "round_phone_view": round_view(conn),
            "close_request_mode": close_mode(conn), "reminder_check_minutes": check_minutes(conn), "reminder_log_keep_days": log_keep_days(conn),
            "vendor_missing_insurance_mark": missing_insurance_mark(conn), "vendor_insurance_warn_days": insurance_warn_days(conn),
            "file_max_per_task": file_max_per_task(conn)}


def can_see_task(conn: sqlite3.Connection, principal: Principal, task_id: str | None) -> bool:
    """For the notification centre (subject kind `maintenance`): exactly visible()."""
    if not task_id:
        return False
    row = conn.execute("SELECT * FROM maint_tasks WHERE id = ?", (task_id,)).fetchone()
    return visible(Viewer(conn, principal), row)
