"""CR-WATER78 slice 1: what the water module adds to the project backup (the energy_backup.py allow-list pattern, section 10).

- MAIN_TABLES (the 0151 meter registry) join `backup.PROJECT_TABLES`; an archive written before the module existed keeps the
  current rows on a `replace` restore (KEEP_WHEN_ABSENT) - an older backup never empties the meters.
- Every archive carries `water/daily.json` (the daily totals keyed by meter id) whenever water.db exists.
- With `water.include_history_in_backup` (default OFF) the archive also carries `water/water.db`, a consistent copy (SQLite online
  backup API).
- Restore: only the allow-listed tables and columns of the store (energy_store.BACKUP_COLUMNS - the same schema), only for meter ids
  that exist in the restored main DB, one water.db transaction; an archived file of an unknown schema is refused and ignored."""
from __future__ import annotations

import json
import logging
import sqlite3
import tempfile
import zipfile
from pathlib import Path
from typing import Any

from . import water_meters as wm

log = logging.getLogger("smplwise.water")

MAIN_TABLES = ["water_meters", "water_meter_epochs", "water_meter_manual_readings"]
KEEP_WHEN_ABSENT = frozenset(MAIN_TABLES)
DAILY_MEMBER = "water/daily.json"
DB_MEMBER = "water/water.db"
MAX_DB_BYTES = 4 * 1024 * 1024 * 1024


def include_history(conn: sqlite3.Connection) -> bool:
    try:
        row = conn.execute("SELECT value FROM settings WHERE key = 'water.include_history_in_backup'").fetchone()
    except sqlite3.Error:
        return False
    return bool(row and row[0] == "true")


def add_to_zip(settings: Any, z: zipfile.ZipFile, *, with_history: bool) -> dict[str, Any]:
    """Write the water members into an open archive. Never raises (a backup is never lost over the water part)."""
    path = Path(settings.data_dir) / wm.FILE_NAME
    if not path.exists():
        return {"daily": 0, "history": False}
    try:
        store = wm.store_for(settings)
        rows = store.export_daily()
        z.writestr(DAILY_MEMBER, json.dumps(rows, ensure_ascii=False))
        info: dict[str, Any] = {"daily": len(rows), "history": False}
        if with_history:
            with tempfile.TemporaryDirectory() as tmp:
                copy = Path(tmp) / wm.FILE_NAME
                store.copy_to(copy)
                z.write(copy, DB_MEMBER)
            info["history"] = True
        return info
    except Exception:  # noqa: BLE001
        log.warning("water part of the backup skipped", exc_info=True)
        return {"daily": 0, "history": False, "error": True}


def restore_from_zip(settings: Any, z: zipfile.ZipFile, names: set[str], *, allowed_meters: set[str], replace: bool) -> dict[str, Any]:
    """Load the water members of an archive into the live water.db (allow-listed, see the module docstring)."""
    out: dict[str, Any] = {"daily": 0, "history": {}}
    if not allowed_meters or not (DB_MEMBER in names or DAILY_MEMBER in names):
        return out
    store = wm.store_for(settings)
    if DB_MEMBER in names and z.getinfo(DB_MEMBER).file_size <= MAX_DB_BYTES:
        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp) / "archived-water.db"
            with z.open(DB_MEMBER) as src, open(dest, "wb") as dst:
                while True:
                    chunk = src.read(1024 * 1024)
                    if not chunk:
                        break
                    dst.write(chunk)
            try:
                out["history"] = store.import_file(dest, allowed_meters, replace)
            except (ValueError, sqlite3.Error) as exc:
                log.warning("water history in the backup not restored: %s", exc)
                out["history_refused"] = str(exc)[:80]
    if DAILY_MEMBER in names and not out["history"]:
        try:
            rows = json.loads(z.read(DAILY_MEMBER).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            rows = []
        if isinstance(rows, list):
            out["daily"] = store.import_daily(rows, allowed_meters, replace)
    return out
