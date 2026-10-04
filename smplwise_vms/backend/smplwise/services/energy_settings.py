"""CR-023: the electricity settings (`energy.*` keys in the main `settings` table) - one registry with validation, the
permission that may edit each key, and the storage estimate shown next to the retention values.

Owner decision D4 (2026-10-04): raw 90 days, quarter-hour 26 months, bills and files 7 years, all editable in Settings.
Owner round 3: daily totals are kept as long as bills (`energy.bill_retention_years`) so the bill's history chart (previous
periods, same period last year) survives raw / quarter-hour retention.

Other electricity modules add their keys with `register(SettingSpec(...))` at import time (contract section 5). A key with
`own_route` (billing: `energy.billing`, a structured document with its own revision and validation behind
`/energy/billing-settings`) is registered here so the registry knows every `energy.*` key, its default and its permissions,
but the generic GET/PATCH `/energy/settings` neither shows nor accepts it."""
from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from typing import Any

from ..db import get_setting, set_setting
from ..errors import ApiError

VIEW, BILLS, MANAGE, CONFIGURE, BACKUP = "energy.view", "energy.bills", "energy.manage", "system.configure", "backup.manage"


@dataclass(frozen=True)
class SettingSpec:
    key: str
    default: Any
    kind: str                     # int | bool | enum | text | json
    permission: str               # who may change it
    minimum: int | None = None
    maximum: int | None = None
    choices: tuple[str, ...] = ()
    max_length: int = 2000
    read_permission: str = VIEW   # who may read it (money-related keys of the billing branch: energy.bills)
    label_he: str = ""
    own_route: str | None = None  # edited only through this route (not through GET/PATCH /energy/settings)


SPECS: dict[str, SettingSpec] = {}


def register(spec: SettingSpec) -> None:
    SPECS[spec.key] = spec


for _s in (
    SettingSpec("energy.raw_retention_days", 90, "int", CONFIGURE, 7, 366, label_he="נתונים גולמיים (ימים)"),
    SettingSpec("energy.interval_retention_months", 26, "int", CONFIGURE, 3, 120, label_he="נתוני רבע שעה (חודשים)"),
    SettingSpec("energy.bill_retention_years", 7, "int", CONFIGURE, 1, 15, label_he="חיובים, קבצים וסיכומים יומיים (שנים)"),
    SettingSpec("energy.draft_retention_days", 30, "int", MANAGE, 7, 365, label_he="טיוטות (ימים)"),
    SettingSpec("energy.stale_after_minutes", 60, "int", MANAGE, 15, 1440, label_he="מונה לא מדווח אחרי (דקות)"),
    SettingSpec("energy.include_history_in_backup", False, "bool", BACKUP, label_he="לכלול את נתוני המונים בגיבוי"),
):
    register(_s)


def _decode(spec: SettingSpec, raw: str | None) -> Any:
    if raw is None:
        return spec.default
    try:
        if spec.kind == "int":
            v = int(raw)
            if (spec.minimum is not None and v < spec.minimum) or (spec.maximum is not None and v > spec.maximum):
                return spec.default
            return v
        if spec.kind == "bool":
            return raw == "true"
        if spec.kind == "json":
            return json.loads(raw)
        if spec.kind == "enum":
            return raw if raw in spec.choices else spec.default
        return raw
    except (TypeError, ValueError):
        return spec.default


def value(conn: sqlite3.Connection, key: str) -> Any:
    spec = SPECS[key]
    return _decode(spec, get_setting(conn, key))


def values(conn: sqlite3.Connection, readable: set[str] | None = None) -> dict[str, Any]:
    """Every registered key with its effective value; keys whose read permission the caller lacks are left out."""
    out: dict[str, Any] = {}
    for key, spec in SPECS.items():
        if spec.own_route is not None:
            continue
        if readable is not None and spec.read_permission not in readable:
            continue
        out[key] = _decode(spec, get_setting(conn, key))
    return out


def validate(key: str, raw: Any) -> str:
    """The stored text of a new value, or 422 with a Hebrew message."""
    spec = SPECS.get(key)
    if spec is None or spec.own_route is not None:
        raise ApiError(422, "validation", f"הגדרה לא מוכרת: {key}", details={"fields": [key]})
    bad = ApiError(422, "validation", f"ערך לא תקין עבור {spec.label_he or key}", details={"fields": [key]})
    if spec.kind == "int":
        if isinstance(raw, bool) or not isinstance(raw, int):
            raise bad
        if (spec.minimum is not None and raw < spec.minimum) or (spec.maximum is not None and raw > spec.maximum):
            raise ApiError(422, "validation", f"{spec.label_he or key}: בין {spec.minimum} ל־{spec.maximum}", details={"fields": [key], "min": spec.minimum, "max": spec.maximum})
        return str(raw)
    if spec.kind == "bool":
        if not isinstance(raw, bool):
            raise bad
        return "true" if raw else "false"
    if spec.kind == "enum":
        if raw not in spec.choices:
            raise bad
        return str(raw)
    if spec.kind == "json":
        text = json.dumps(raw, ensure_ascii=False, separators=(",", ":"))
        if len(text) > spec.max_length:
            raise bad
        return text
    if not isinstance(raw, str) or len(raw) > spec.max_length:
        raise bad
    return raw


def stale_after_minutes(conn: sqlite3.Connection) -> int:
    """The one not-reporting threshold of the module (meters screen, provider and billing notes)."""
    return int(value(conn, "energy.stale_after_minutes"))


def store(conn: sqlite3.Connection, changes: dict[str, str]) -> None:
    for key, text in changes.items():
        set_setting(conn, key, text)


def ranges() -> dict[str, dict[str, Any]]:
    return {k: {"min": s.minimum, "max": s.maximum, "kind": s.kind, "choices": list(s.choices) or None, "label_he": s.label_he}
            for k, s in SPECS.items() if s.own_route is None}


# ---------------------------------------------------------------- storage estimate (contract section 6)

RAW_ROW_BYTES = 32
INTERVAL_ROW_BYTES = 24
DAILY_ROW_BYTES = 40
RAW_ROWS_PER_DAY_MAX = 1440   # one row a minute when the value changes every minute (worst case)
INTERVAL_ROWS_PER_DAY = 96
DAYS_PER_MONTH = 30.44


def estimate(meters: int, raw_days: int, interval_months: int, bill_years: int) -> dict[str, int]:
    raw = int(meters * RAW_ROWS_PER_DAY_MAX * raw_days * RAW_ROW_BYTES)
    intervals = int(meters * INTERVAL_ROWS_PER_DAY * DAYS_PER_MONTH * interval_months * INTERVAL_ROW_BYTES)
    daily = int(meters * 365 * bill_years * DAILY_ROW_BYTES)
    return {"meters": meters, "raw_bytes": raw, "intervals_bytes": intervals, "daily_bytes": daily, "total_bytes": raw + intervals + daily}
