"""CR-FLEET215 part 3: demo mode for installing and selling - realistic EXAMPLE data, clearly marked, never mixed with real data.

Rules (docs/changes/CR-FLEET215.md section 9):
- the switch `demo.enabled` is OFF by default; only a system administrator changes it, and every change is audited;
- the example data is a constant in this module. It is never written to a real table, never read by a real screen's query, never
  counted by a health check, the readiness score or the fleet report (the report only carries the boolean `demo_mode`), never in a backup;
- every object of the dataset carries `example: true`, and the envelope carries a label in plain words ("נתוני דוגמה" / "Example data")
  that a screen must show on every surface that renders it;
- turning the switch off is the whole cleanup: there is nothing to delete, because nothing was stored;
- the dataset contains no real person, place, address, phone, host or camera image: invented names that say they are examples, and
  counts. It is safe to show to a prospect on a sales call.

Slice 1 serves the dataset through GET /demo/dataset (the readiness card, a health summary and a fleet overview); feeding other screens
from it is a later slice (each screen opts in explicitly and shows the label)."""
from __future__ import annotations

import copy
import sqlite3
from typing import Any

from ..db import get_setting, set_setting

SWITCH = "demo.enabled"
LABEL = {"he": "נתוני דוגמה", "en": "Example data"}
DATASET_VERSION = 1


def enabled(conn: sqlite3.Connection) -> bool:
    return (get_setting(conn, SWITCH, "false") or "false") == "true"


def set_enabled(conn: sqlite3.Connection, on: bool) -> tuple[str, str]:
    before = "on" if enabled(conn) else "off"
    set_setting(conn, SWITCH, "true" if on else "false")
    return before, "on" if on else "off"


def _ex(obj: dict[str, Any]) -> dict[str, Any]:
    return {**obj, "example": True}


_READINESS_EXAMPLE = _ex({
    "score": 79, "ready": False, "met": 10, "total": 13,
    "missing": ["backup_recent", "alert_receivers", "backup_offsite"],
    "items": [
        _ex({"id": "addon_healthy", "met": True, "required": True, "weight": 3}),
        _ex({"id": "recorder_connected", "met": True, "required": True, "weight": 3}),
        _ex({"id": "home_system_connected", "met": True, "required": True, "weight": 3}),
        _ex({"id": "media_server", "met": True, "required": True, "weight": 3}),
        _ex({"id": "system_admin", "met": True, "required": True, "weight": 3}),
        _ex({"id": "backup_recent", "met": False, "required": True, "weight": 3}),
        _ex({"id": "floor_plan_published", "met": True, "required": False, "weight": 2}),
        _ex({"id": "camera_on_map", "met": True, "required": False, "weight": 2}),
        _ex({"id": "alert_receivers", "met": False, "required": False, "weight": 2}),
        _ex({"id": "disk_space", "met": True, "required": False, "weight": 2}),
        _ex({"id": "backup_offsite", "met": False, "required": False, "weight": 1}),
        _ex({"id": "more_people", "met": True, "required": False, "weight": 1}),
        _ex({"id": "up_to_date", "met": True, "required": False, "weight": 1}),
    ],
})

_HEALTH_EXAMPLE = _ex({
    "status": "warn",
    "items": [_ex({"id": "backups", "status": "warn", "label": {"he": "הגיבוי האחרון ישן מיומיים (דוגמה)", "en": "The last backup is older than two days (example)"}})],
    "counts": _ex({"cameras": 24, "floors_published": 3, "devices": 140, "open_alerts": 2}),
})

_FLEET_EXAMPLE = _ex({
    "installations": [
        _ex({"label": {"he": "לקוח לדוגמה א - בניין משרדים", "en": "Example customer A - office building"}, "overall": "ok", "addon": "2.12.1",
             "last_seen_h": 2, "readiness": 100, "cameras": 32, "outdated": False}),
        _ex({"label": {"he": "לקוח לדוגמה ב - מרכז מסחרי", "en": "Example customer B - shopping centre"}, "overall": "warn", "addon": "2.12.1",
             "last_seen_h": 5, "readiness": 85, "cameras": 64, "outdated": False}),
        _ex({"label": {"he": "לקוח לדוגמה ג - מפעל", "en": "Example customer C - factory"}, "overall": "error", "addon": "2.11.0",
             "last_seen_h": 30, "readiness": 62, "cameras": 18, "outdated": True}),
        _ex({"label": {"he": "לקוח לדוגמה ד - בית ספר", "en": "Example customer D - school"}, "overall": "ok", "addon": "2.12.0",
             "last_seen_h": 1, "readiness": 92, "cameras": 40, "outdated": True}),
    ],
    "totals": _ex({"installations": 4, "ok": 2, "warn": 1, "error": 1, "outdated": 2}),
})


def dataset() -> dict[str, Any]:
    """A fresh deep copy each call (a caller can never mutate the constant)."""
    return {"example": True, "label": LABEL, "version": DATASET_VERSION,
            "readiness": copy.deepcopy(_READINESS_EXAMPLE), "health": copy.deepcopy(_HEALTH_EXAMPLE), "fleet": copy.deepcopy(_FLEET_EXAMPLE)}
