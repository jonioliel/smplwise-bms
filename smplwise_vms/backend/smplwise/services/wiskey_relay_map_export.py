"""WISKEY-RELAYEXPORT-2320: the internal, verified, numbered exporter of the WisKey relay map snapshot (Arx -> Native).

Agreed direction with the WisKey Windows team (31.10): Arx is the source of the relay map counters; the Native verifies the source,
repository, station, api relay and physical relay of a snapshot and projects the matching row revision into its startup/C07 tree; it
never makes a competing counter. This module is the Arx side of that: it reads the WHOLE map and writes a sealed, numbered record.

Two revision domains (docs/changes/WISKEY-RELAYEXPORT-2320.md):
- station revision (`wiskey_relay_map_stations.revision`, GET `revision`, PUT `expected_revision`): a station-level compare-and-set
  for snapshot consistency only. It never goes into a grant.
- row revision (`wiskey_relay_map.revision`, GET `rows[].row_revision`): the value of StationGrant.mapping_revision and of the
  Native startup/C07 projection. An unchanged row keeps it.

Guarantees (pinned by tests/test_wiskey_relay_map_export_2320.py):
- read, export, ack and rollback never call the approval, never write `wiskey_relay_map` / `wiskey_relay_map_stations` and never
  touch an intent, lease, fence or UNKNOWN history tuple: the only table written is `wiskey_relay_map_exports` (migration 0188);
- the snapshot has FULL coverage: every row, inactive tombstones too WITH their physical relay (the approval screen shows null), and
  per station the api relays that have no row at all (never an invented row);
- the content digest is sha256 over the canonical JSON of the snapshot (sorted keys, no whitespace, UTF-8, integers only); the same
  map gives the same digest, so exporting an unchanged map returns the existing record instead of a new number;
- the export number (`seq`, AUTOINCREMENT) is monotonic and never reused; a record is never deleted and its content never rewritten
  (triggers); a failed export writes nothing and consumes no number;
- ack is by (seq, content digest): a mismatch is refused, a repeated ack is idempotent;
- an export is stale when the live map digest differs from it (a newer approval exists);
- rollback re-exports the stored snapshot of an earlier number, verified against its digest, as a NEW number (`kind = rollback`,
  `rollback_of`); it never changes the map, so the rolled back export is stale while the live map is newer.

Internal only: nothing is sent to WisKey (the transport is a later joint decision). The admin read endpoint is in
routers/wiskey_relay_map.py (system.configure)."""
from __future__ import annotations

import hashlib
import json
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from . import wiskey_relay_map as rm

SCHEMA = "arx.wiskey.relay_map_snapshot.v1"
SOURCE = {"system": "smplwise_arx", "map": "wiskey_relay_map", "station_revisions": "wiskey_relay_map_stations", "direction": "arx_to_native"}
DIGEST_PREFIX = "sha256:"
LIST_LIMIT = 50


class RelayMapExportError(Exception):
    def __init__(self, code: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(code)
        self.code = code
        self.details = details or {}


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def canonical_json(obj: Any) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode("utf-8")


def digest(snapshot: Any) -> str:
    return DIGEST_PREFIX + hashlib.sha256(canonical_json(snapshot)).hexdigest()


def snapshot(conn: sqlite3.Connection) -> dict[str, Any]:
    """The full relay map as plain facts (no export number, no export time: those are outside the digest)."""
    stations = []
    rows_total = tombstones = 0
    for sid in rm.mapped_station_ids(conn):
        st = rm.station_state(conn, sid)
        rows = []
        for r in conn.execute("SELECT api_relay, physical_relay, active, revision, confirmed_by, updated_at FROM wiskey_relay_map "
                              "WHERE station_id = ? ORDER BY api_relay", (sid,)):
            rows.append({"api_relay": int(r[0]), "physical_relay": int(r[1]), "active": r[2] == 1, "row_revision": int(r[3]),
                         "confirmed_by": r[4], "updated_at": r[5]})
            tombstones += r[2] != 1
        rows_total += len(rows)
        have = {r["api_relay"] for r in rows}
        stations.append({"station_id": sid, "station_revision": int(st["revision"]), "approved_by": st["approved_by"], "approved_at": st["approved_at"],
                         "rows": rows, "unmapped_api_relays": [a for a in rm.API_RELAYS if a not in have]})
    return {"schema": SCHEMA, "source": dict(SOURCE), "coverage": "full", "stations": stations, "row_count": rows_total, "tombstone_count": tombstones}


def verify(snap: Any, conn: sqlite3.Connection | None = None) -> None:
    """Refuse a snapshot that is not a full, consistent map (export_unverified). With `conn`, it must cover every row of the table."""
    def bad(why: str) -> RelayMapExportError:
        return RelayMapExportError("export_unverified", {"reason": why})
    if not isinstance(snap, dict) or snap.get("schema") != SCHEMA or snap.get("coverage") != "full" or not isinstance(snap.get("stations"), list):
        raise bad("shape")
    ids = [s.get("station_id") for s in snap["stations"] if isinstance(s, dict)]
    if len(ids) != len(snap["stations"]) or ids != sorted(set(ids)) or not all(isinstance(i, str) and i for i in ids):
        raise bad("stations")
    rows_total = tombstones = 0
    for s in snap["stations"]:
        rows = s.get("rows")
        if not isinstance(rows, list) or type(s.get("station_revision")) is not int or s["station_revision"] < 0:
            raise bad("station")
        apis = [r.get("api_relay") for r in rows]
        if apis != sorted(set(apis)) or not set(apis) <= set(rm.API_RELAYS) or s.get("unmapped_api_relays") != [a for a in rm.API_RELAYS if a not in apis]:
            raise bad("coverage")
        for r in rows:
            if (r.get("physical_relay") not in rm.PHYSICAL_RELAYS or type(r.get("physical_relay")) is not int or type(r.get("active")) is not bool
                    or type(r.get("row_revision")) is not int or r["row_revision"] < 1):
                raise bad("row")
        active = [r["physical_relay"] for r in rows if r["active"]]
        if len(active) != len(set(active)):
            raise bad("duplicate_physical")
        rows_total += len(rows)
        tombstones += sum(1 for r in rows if not r["active"])
    if snap.get("row_count") != rows_total or snap.get("tombstone_count") != tombstones:
        raise bad("counts")
    if conn is not None and conn.execute("SELECT COUNT(*) FROM wiskey_relay_map").fetchone()[0] != rows_total:
        raise bad("partial")


@dataclass(frozen=True)
class ExportRecord:
    seq: int
    kind: str
    rollback_of: int | None
    content_digest: str
    snapshot: dict[str, Any]
    exported_by: str
    exported_at: str
    acked_by: str | None
    acked_at: str | None
    state: str  # exported | acked
    stale: bool  # the live map differs (a newer approval exists)
    current: bool  # the newest export number
    newer_approvals: list[str]  # stations whose live station revision is above the exported one (or that are new / gone)
    created: bool = False  # export / rollback: a new number was written
    already_acked: bool = False  # ack: it was acked before

    def summary(self) -> dict[str, Any]:
        return {"seq": self.seq, "kind": self.kind, "rollback_of": self.rollback_of, "content_digest": self.content_digest,
                "exported_by": self.exported_by, "exported_at": self.exported_at, "acked_by": self.acked_by, "acked_at": self.acked_at,
                "state": self.state, "stale": self.stale, "current": self.current, "newer_approvals": self.newer_approvals}

    def full(self) -> dict[str, Any]:
        return {**self.summary(), "snapshot": self.snapshot}


_COLS = "seq, kind, rollback_of, content_digest, snapshot_json, exported_by, exported_at, acked_by, acked_at"


def _latest_seq(conn: sqlite3.Connection) -> int | None:
    r = conn.execute("SELECT MAX(seq) FROM wiskey_relay_map_exports").fetchone()
    return r[0] if r and r[0] is not None else None


def _newer(stored: dict[str, Any], live: dict[str, Any]) -> list[str]:
    a = {s["station_id"]: s for s in stored.get("stations", [])}
    b = {s["station_id"]: s for s in live["stations"]}
    return sorted(sid for sid in set(a) | set(b) if sid not in a or sid not in b or a[sid] != b[sid])


def _record(conn: sqlite3.Connection, row: Any, live: dict[str, Any] | None = None, latest: int | None = None, **flags: bool) -> ExportRecord:
    live = live if live is not None else snapshot(conn)
    latest = latest if latest is not None else _latest_seq(conn)
    snap = json.loads(row[4])
    return ExportRecord(seq=row[0], kind=row[1], rollback_of=row[2], content_digest=row[3], snapshot=snap, exported_by=row[5], exported_at=row[6],
                        acked_by=row[7], acked_at=row[8], state="acked" if row[8] else "exported", stale=row[3] != digest(live),
                        current=row[0] == latest, newer_approvals=_newer(snap, live), **flags)


def _row(conn: sqlite3.Connection, seq: Any) -> Any:
    if type(seq) is not int or seq < 1:
        raise RelayMapExportError("export_not_found", {"seq": seq})
    r = conn.execute(f"SELECT {_COLS} FROM wiskey_relay_map_exports WHERE seq = ?", (seq,)).fetchone()
    if r is None:
        raise RelayMapExportError("export_not_found", {"seq": seq})
    return r


def get(conn: sqlite3.Connection, seq: int) -> ExportRecord:
    return _record(conn, _row(conn, seq))


def _insert(conn: sqlite3.Connection, *, kind: str, rollback_of: int | None, snap: dict[str, Any], by: str, now: str | None) -> ExportRecord:
    body = canonical_json(snap).decode("utf-8")
    cur = conn.execute("INSERT INTO wiskey_relay_map_exports(kind, rollback_of, content_digest, snapshot_json, exported_by, exported_at) VALUES (?,?,?,?,?,?)",
                       (kind, rollback_of, digest(snap), body, by, now or _now()))
    return _record(conn, _row(conn, cur.lastrowid), created=True)


def export(conn: sqlite3.Connection, *, by: str, now: str | None = None) -> ExportRecord:
    """Seal the live map as the next export number, verified first. The live map equal to the newest export returns that record."""
    if not isinstance(by, str) or not by:
        raise RelayMapExportError("export_invalid", {"fields": ["by"]})
    snap = snapshot(conn)
    verify(snap, conn)
    latest = _latest_seq(conn)
    if latest is not None:
        row = _row(conn, latest)
        if row[3] == digest(snap):
            return _record(conn, row, live=snap, latest=latest)
    return _insert(conn, kind="export", rollback_of=None, snap=snap, by=by, now=now)


def ack(conn: sqlite3.Connection, *, seq: int, content_digest: str, by: str, now: str | None = None) -> ExportRecord:
    """Record that the Native acknowledged export `seq` by its content digest. Idempotent; never touches the map."""
    if not isinstance(by, str) or not by:
        raise RelayMapExportError("export_invalid", {"fields": ["by"]})
    row = _row(conn, seq)
    if content_digest != row[3]:
        raise RelayMapExportError("export_digest_mismatch", {"seq": seq})
    if row[8]:
        return _record(conn, row, already_acked=True)
    conn.execute("UPDATE wiskey_relay_map_exports SET acked_by = ?, acked_at = ? WHERE seq = ? AND acked_at IS NULL", (by, now or _now(), seq))
    return _record(conn, _row(conn, seq))


def rollback(conn: sqlite3.Connection, *, to_seq: int, by: str, now: str | None = None) -> ExportRecord:
    """Re-export the stored snapshot of `to_seq` as a NEW number. The map itself is never changed."""
    if not isinstance(by, str) or not by:
        raise RelayMapExportError("export_invalid", {"fields": ["by"]})
    row = _row(conn, to_seq)
    snap = json.loads(row[4])
    if digest(snap) != row[3]:
        raise RelayMapExportError("export_corrupt", {"seq": to_seq})
    verify(snap)
    latest = _row(conn, _latest_seq(conn))
    if latest[3] == row[3]:
        raise RelayMapExportError("rollback_noop", {"seq": to_seq, "latest": latest[0]})
    return _insert(conn, kind="rollback", rollback_of=to_seq, snap=snap, by=by, now=now)


def status(conn: sqlite3.Connection, limit: int = LIST_LIMIT) -> dict[str, Any]:
    """The live snapshot with its digest, the publication state and the newest export records (summaries). Read only."""
    live = snapshot(conn)
    live_digest = digest(live)
    latest = _latest_seq(conn)
    rows = conn.execute(f"SELECT {_COLS} FROM wiskey_relay_map_exports ORDER BY seq DESC LIMIT ?", (limit,)).fetchall()
    records = [_record(conn, r, live=live, latest=latest) for r in rows]
    newest = records[0] if records else None
    if newest is None:
        publication = "never_exported"
    elif newest.content_digest == live_digest:
        publication = "published"
    elif newest.kind == "rollback":
        publication = "rolled_back"
    else:
        publication = "unpublished_changes"
    return {"live": {"content_digest": live_digest, "snapshot": live}, "publication": publication,
            "latest": newest.summary() if newest else None, "exports": [r.summary() for r in records]}
