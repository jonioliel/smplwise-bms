"""OFFBOX-RESTORE-2300, owner decisions 2026-10-30: the pre-restore SAFETY ARCHIVE and the restore defaults, as settings.

  backup.offbox_restore_scope         the scope a restore from an off-box copy uses when the request names none, and the screen's
                                      initial choice: "project+access" (default) or "project".
  backup.safety_before_local_restore  "on" (default): a LOCAL restore (an archive in backups/) also writes the safety archive first.

The safety archive is an ordinary backup of kind `auto-pre-restore` (kept: the newest 3, backup.KEEP). Without a password it omits the
sensitive section (never plaintext); with one it seals it. A password is checked BEFORE anything is written and refused under codes of
its own (`safety_password_weak` / `safety_password_too_long`), so the screen can tell it from the copy's own backup password. The value
is never logged, audited or returned. Both settings are installation policy: never exported or restored (backup.SETTINGS_KEEP)."""
from __future__ import annotations

import sqlite3
from typing import Any

from ..config import Settings
from . import backup as backup_svc
from . import backup_sensitive as sens

SAFETY_KIND = "auto-pre-restore"
SCOPE_SETTING = "backup.offbox_restore_scope"
SCOPE_DEFAULT = "project+access"
SCOPES = ("project", "project+access")
LOCAL_SAFETY_SETTING = "backup.safety_before_local_restore"
LOCAL_SAFETY_DEFAULT = "on"


def _get(conn: sqlite3.Connection, key: str) -> Any:
    from ..db import get_setting

    return get_setting(conn, key)


def default_scope(conn: sqlite3.Connection) -> str:
    """The scope of a restore from an off-box copy when none is named; an unreadable stored value reads as the default."""
    v = _get(conn, SCOPE_SETTING)
    return v if v in SCOPES else SCOPE_DEFAULT


def local_safety_enabled(conn: sqlite3.Connection) -> bool:
    v = _get(conn, LOCAL_SAFETY_SETTING)
    return (v if v in ("on", "off") else LOCAL_SAFETY_DEFAULT) == "on"


def check_password(conn: sqlite3.Connection, password: str | None) -> None:
    """Refuse a weak / oversized safety password before anything is written (codes `safety_password_*`, never the value)."""
    if password is None:
        return
    try:
        sens.password_bytes(password, sens.min_chars(conn))
    except sens.SensitiveError as exc:
        code = exc.code.replace("backup_password_", "safety_password_", 1)
        raise sens.SensitiveError(code, "the safety archive password was refused", min_chars=exc.min_chars) from None


def write(settings: Settings, conn: sqlite3.Connection, note: str, password: str | None = None) -> dict[str, Any]:
    """Write the safety archive (the state before the restore). The caller has run `check_password`."""
    return backup_svc.create(settings, conn, SAFETY_KIND, note, backup_password=password)


def remove(settings: Settings, entry: dict[str, Any] | None) -> None:
    """Remove the safety archive made for an attempt that did not restore."""
    if entry:
        (backup_svc.backups_dir(settings) / entry["name"]).unlink(missing_ok=True)


def summary(entry: dict[str, Any] | None) -> dict[str, Any] | None:
    return {k: entry[k] for k in ("name", "bytes", "created_at")} if entry else None
