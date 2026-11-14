"""CR-023: what the electricity module adds to the project backup (contract section 7).

- The main-DB tables in MAIN_TABLES (meters and billing, one list) join `backup.PROJECT_TABLES`; KEEP_WHEN_ABSENT and
  FILE_COLUMNS are merged into backup's lists the same way.
- Every archive carries `energy/daily.json` (the daily totals keyed by meter id; small, kept as long as bills), so a
  restore without the time-series still shows history and the bill chart.
- With the setting `energy.include_history_in_backup` (default off: the file can be hundreds of MB) the archive also
  carries `energy/energy.db`, a consistent copy made with the SQLite online backup API.
- Restore follows the allow-list pattern of services/backup.py: only the allow-listed energy tables and columns, only
  for meter ids that exist in the restored main DB, one energy.db transaction; the archived file is extracted to a temp
  file, opened read-only and must carry a known schema version; anything else in it is ignored."""
from __future__ import annotations

import json
import logging
import sqlite3
import tempfile
import zipfile
from pathlib import Path
from typing import Any

from . import energy_store as st

log = logging.getLogger("smplwise.energy")

# The ONE list of electricity tables in the main DB that join the project backup (meters + billing). energy_bill_numbers stays
# OUT on purpose: the ledger of used bill numbers is never restored or emptied, so a restore can never make a number reusable.
MAIN_TABLES = ["energy_meters", "energy_meter_epochs", "energy_meter_manual_readings", "energy_meter_calibrations",
               "energy_customers", "energy_tariffs", "energy_tariff_versions", "energy_vat_rates", "energy_accounts", "energy_account_meters",
               "energy_bills", "energy_bill_events", "energy_auto_runs", "energy_assets"]
# Issued bills are financial records and accounts reference meters by id: a `replace` restore of an archive written before the
# electricity module existed keeps the current rows instead of emptying them.
KEEP_WHEN_ABSENT = frozenset(MAIN_TABLES)
# Stored bill PDFs and business logos travel as files in the archive.
FILE_COLUMNS = {"energy_bills": ["pdf_path"], "energy_assets": ["storage_path"]}
# Where those files live under the data directory; backup.RESTORABLE_ROOTS adds them, so a restore writes them back (and keeps the
# rows that reference them). energy.db itself is never a restored file (the allow-listed import below handles it).
RESTORABLE_ROOTS = ("energy/bills/", "energy/assets/")
DAILY_MEMBER = "energy/daily.json"
DB_MEMBER = "energy/energy.db"
MAX_DB_BYTES = 4 * 1024 * 1024 * 1024


def include_history(conn: sqlite3.Connection) -> bool:
    try:
        row = conn.execute("SELECT value FROM settings WHERE key = 'energy.include_history_in_backup'").fetchone()
    except sqlite3.Error:
        return False
    return bool(row and row[0] == "true")


def add_to_zip(settings: Any, z: zipfile.ZipFile, *, with_history: bool) -> dict[str, Any]:
    """Write the energy members into an open archive. Never raises (a backup is never lost over the energy part)."""
    path = Path(settings.data_dir) / st.FILE_NAME
    if not path.exists():
        return {"daily": 0, "history": False}
    try:
        store = st.store_for(settings)
        rows = store.export_daily()
        z.writestr(DAILY_MEMBER, json.dumps(rows, ensure_ascii=False))
        info: dict[str, Any] = {"daily": len(rows), "history": False}
        if with_history:
            with tempfile.TemporaryDirectory() as tmp:
                copy = Path(tmp) / "energy.db"
                store.copy_to(copy)
                z.write(copy, DB_MEMBER)
            info["history"] = True
        return info
    except Exception:  # noqa: BLE001
        log.warning("energy part of the backup skipped", exc_info=True)
        return {"daily": 0, "history": False, "error": True}


def restore_from_zip(settings: Any, z: zipfile.ZipFile, names: set[str], *, allowed_meters: set[str], replace: bool) -> dict[str, Any]:
    """Load the energy members of an archive into the live energy.db (allow-listed, see the module docstring)."""
    out: dict[str, Any] = {"daily": 0, "history": {}}
    if not allowed_meters:
        return out
    store = st.store_for(settings)
    if DB_MEMBER in names:
        member = z.getinfo(DB_MEMBER)
        if member.file_size <= MAX_DB_BYTES:
            with tempfile.TemporaryDirectory() as tmp:
                dest = Path(tmp) / "archived-energy.db"
                with z.open(DB_MEMBER) as src, open(dest, "wb") as dst:
                    while True:
                        chunk = src.read(1024 * 1024)
                        if not chunk:
                            break
                        dst.write(chunk)
                try:
                    out["history"] = store.import_file(dest, allowed_meters, replace)
                except (ValueError, sqlite3.Error) as exc:
                    log.warning("energy history in the backup not restored: %s", exc)
                    out["history_refused"] = str(exc)[:80]
    if DAILY_MEMBER in names and not out["history"]:
        try:
            rows = json.loads(z.read(DAILY_MEMBER).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            rows = []
        if isinstance(rows, list):
            out["daily"] = store.import_daily(rows, allowed_meters, replace)
    return out
