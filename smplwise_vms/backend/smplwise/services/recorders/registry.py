"""Which adapter serves a recorder. Phase 1 (CR-020): one recorder, `nvr-1`, the add-on's own Hikvision NVR. A second
recorder joins when the `recorders` row carries its vendor and connection (migration 0050, ADP section 7 - not part of S1);
until then every recorder row is the add-on's NVR."""
from __future__ import annotations

import sqlite3
from collections.abc import Callable

from ...config import Settings
from ...errors import ApiError
from .base import RecorderAdapter
from .hikvision import HikvisionAdapter

DEFAULT_RECORDER = "nvr-1"
DEFAULT_VENDOR = "hikvision"

# vendor tag -> constructor(recorder_id, settings). Other vendors register here when their adapter exists.
VENDORS: dict[str, Callable[[str, Settings], RecorderAdapter]] = {DEFAULT_VENDOR: HikvisionAdapter}


def recorder_ids(conn: sqlite3.Connection) -> list[str]:
    """The recorders to read: the rows of `recorders`, or the add-on's NVR when discovery has not created its row yet."""
    ids = [r["id"] for r in conn.execute("SELECT id FROM recorders ORDER BY id").fetchall()]
    return ids or [DEFAULT_RECORDER]


def adapter_for(conn: sqlite3.Connection, settings: Settings, recorder_id: str) -> RecorderAdapter:
    if recorder_id not in recorder_ids(conn):
        raise ApiError(404, "not_found", "ה־NVR לא נמצא.")
    return VENDORS[DEFAULT_VENDOR](recorder_id, settings)
