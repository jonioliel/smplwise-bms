"""CR-038 slice 9, sections 11A.5 / 11A.6 / 11A.11: the cost claims' janitor step (main.janitor_tick; self-throttled to every 10 min).

- the claim window: a REQUIRED claim whose window passed without a submission raises `claim_missing` once (costs.tick);
- pending invoice files (uploaded, never submitted) older than 24 h: the file and its row go;
- claims past their own `purge_after` (approval / payment + `costs.retention_days`, default 7 years - D32): the claim, its
  revisions, decisions and files go, whatever happened to the ticket (financial records outlive the ticket, 11A.11);
- unapproved claims of a ticket that was purged (ticket_id NULL) follow the ticket;
- deep review A4 (TK251): files under a ticket folder that no row names and that are older than an hour (a crash between the
  write and the row) - deletion.sweep_orphan_files, after the whole-folder sweep.
A failure is logged by type and never stops the tick; file deletions happen after the rows are gone (a crash leaves an orphan
file at worst, never a row pointing at nothing)."""
from __future__ import annotations

import datetime as dt
import logging
import time
from pathlib import Path

from ...db import Database
from . import cost_storage, costs, store_costs

log = logging.getLogger("smplwise.tickets.costs")
EVERY_S = 600
_LAST: dict[str, float] = {}


def janitor(db: Database, root: Path, *, force: bool = False, now: dt.datetime | None = None) -> dict[str, int]:
    key = str(db.path)
    mono = time.monotonic()
    if not force and mono - _LAST.get(key, -EVERY_S) < EVERY_S:
        return {}
    _LAST[key] = mono
    at = now or costs.now_utc()
    out = {"missing": 0, "pending_files": 0, "claims": 0}
    doomed: list[str] = []
    with db.connection(label="tickets.costs.janitor") as conn:
        if not (conn.execute("SELECT value FROM settings WHERE key = 'tickets.enabled'").fetchone() or ["false"])[0] == "true":
            return out
        out["missing"] = costs.tick(conn, at)
        for f in store_costs.expired_pending(conn, costs.iso(at - costs.PENDING_TTL)):
            store_costs.delete_file_row(conn, f["id"])
            doomed.append(f["path"])
            out["pending_files"] += 1
        claims = store_costs.purgeable(conn, costs.iso(at)) + store_costs.orphan_unapproved(conn)
        for c in claims:
            paths = [f["path"] for f in store_costs.files_of_claim(conn, c["id"])]
            store_costs.delete_claim(conn, c["id"])
            doomed.extend(paths)
            out["claims"] += 1
    for rel in doomed:
        try:
            cost_storage.remove(root, rel)
        except Exception as exc:  # noqa: BLE001 - an orphan file is retried by nothing; the storage meter re-walks anyway
            log.warning("cost file was not removed (%s)", type(exc).__name__)
    try:  # owner 14.10: the folders of deleted tickets whose removal failed after the commit (deletion.sweep_orphans)
        from . import deletion

        out["orphan_folders"] = deletion.sweep_orphans(db, root)
    except Exception as exc:  # noqa: BLE001 - never stops the tick
        log.warning("ticket folder sweep failed (%s)", type(exc).__name__)
    try:
        from . import deletion

        out["orphan_files"] = deletion.sweep_orphan_files(db, root)
    except Exception as exc:  # noqa: BLE001 - never stops the tick
        log.warning("ticket file sweep failed (%s)", type(exc).__name__)
    return out
