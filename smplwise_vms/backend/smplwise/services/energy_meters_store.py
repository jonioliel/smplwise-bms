"""SQL of the electricity meters API that is not a meter-registry operation (routers/energy_meters.py held it inline; moved here by
CR-RESPONSE-MODELS-CONSUMPTION-2450, review 05 SQL boundary / MASTER_PLAN 3.6). Read-only queries; the statements are unchanged."""
from __future__ import annotations

import sqlite3


def draft_usage(conn: sqlite3.Connection) -> dict[str, int]:
    """Draft bills of the billing branch (retention "טיוטות"): rows and the bytes of their JSON columns; zeros before its table exists."""
    try:
        cols = {r[1] for r in conn.execute("PRAGMA table_info(energy_bills)").fetchall()}
        if not cols:
            return {"rows": 0, "bytes_estimate": 0}
        size = " + ".join(f"COALESCE(LENGTH({c}), 0)" for c in ("snapshot_json", "totals_json") if c in cols) or "0"
        row = conn.execute(f"SELECT COUNT(*), COALESCE(SUM({size}), 0) FROM energy_bills WHERE state = 'draft'").fetchone()
        return {"rows": int(row[0]), "bytes_estimate": int(row[1])}
    except sqlite3.Error:
        return {"rows": 0, "bytes_estimate": 0}


def live_meter_count(conn: sqlite3.Connection) -> int:
    """Meters that are not retired (the storage estimate's meter count)."""
    return int(conn.execute("SELECT COUNT(*) FROM energy_meters WHERE status <> 'retired'").fetchone()[0])
