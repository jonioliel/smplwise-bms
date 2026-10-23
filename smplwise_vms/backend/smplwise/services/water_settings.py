"""CR-WATER78: the water settings (`water.*` keys in the main `settings` table) - their own registry (never mixed into the
electricity `energy.*` registry), with the permission that may edit each key. The spec shape and the value checks are the
electricity module's (energy_settings.SettingSpec / validate_spec).

Owner decisions 2026-10-23: the module switch `water.enabled` is OFF by default (system.configure); retention and the switch are
system.configure, the not-reporting threshold water.manage, the backup choice backup.manage."""
from __future__ import annotations

import sqlite3
from typing import Any

from ..db import get_setting, set_setting
from ..errors import ApiError
from . import energy_settings as es

VIEW, ACK, MANAGE, CONFIGURE, BACKUP = "water.view", "water.ack", "water.manage", "system.configure", "backup.manage"
ENABLED = "water.enabled"

SPECS: dict[str, es.SettingSpec] = {s.key: s for s in (
    es.SettingSpec(ENABLED, False, "bool", CONFIGURE, read_permission=VIEW, label_he="מודול מוני מים"),
    es.SettingSpec("water.raw_retention_days", 90, "int", CONFIGURE, 7, 366, read_permission=VIEW, label_he="נתונים גולמיים (ימים)"),
    es.SettingSpec("water.interval_retention_months", 26, "int", CONFIGURE, 3, 120, read_permission=VIEW, label_he="נתוני רבע שעה (חודשים)"),
    es.SettingSpec("water.daily_retention_years", 7, "int", CONFIGURE, 1, 15, read_permission=VIEW, label_he="סיכומים יומיים (שנים)"),
    es.SettingSpec("water.stale_after_minutes", 120, "int", MANAGE, 15, 1440, read_permission=VIEW, label_he="מונה לא מדווח אחרי (דקות)"),
    es.SettingSpec("water.include_history_in_backup", False, "bool", BACKUP, read_permission=VIEW, label_he="לכלול את נתוני מוני המים בגיבוי"),
)}


def value(conn: sqlite3.Connection, key: str) -> Any:
    return es._decode(SPECS[key], get_setting(conn, key))


def values(conn: sqlite3.Connection) -> dict[str, Any]:
    return {k: es._decode(s, get_setting(conn, k)) for k, s in SPECS.items()}


def enabled(conn: sqlite3.Connection) -> bool:
    """The module switch; False before the migration or when never set (owner standing rule: new modules start OFF)."""
    try:
        return bool(value(conn, ENABLED))
    except sqlite3.Error:
        return False


def validate(key: str, raw: Any) -> str:
    spec = SPECS.get(key)
    if spec is None:
        raise ApiError(422, "validation", f"הגדרה לא מוכרת: {key}", details={"fields": [key], "message_en": f"Unknown setting: {key}"})
    return es.validate_spec(spec, key, raw)


def store(conn: sqlite3.Connection, changes: dict[str, str]) -> None:
    for key, text in changes.items():
        set_setting(conn, key, text)


def ranges() -> dict[str, dict[str, Any]]:
    return {k: {"min": s.minimum, "max": s.maximum, "kind": s.kind, "label_he": s.label_he, "permission": s.permission} for k, s in SPECS.items()}
