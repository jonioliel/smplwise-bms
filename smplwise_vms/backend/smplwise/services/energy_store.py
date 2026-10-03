"""CR-023 P1: the electricity time-series store - the ONLY code that opens `energy.db`.

`energy.db` is a separate SQLite file next to the main database (`/data/energy.db`) with its own migration series
(`migrations_energy/E001_*.sql`, recorded in `energy_schema_migrations`) and its own write gate (`db.gate_for(path)`):
the once-a-minute sampler never waits on, or blocks, the main database's single writer (the Plan Studio round-10
"SQLite storm" lesson). Writes are synchronous=NORMAL (a power cut may lose the last seconds of readings; the next reading
closes the gap because the meter is a cumulative counter). Energy is integer Wh, instants are UTC epoch seconds.

Tables (migrations_energy/E001_core.sql): `meter_map` (text meter id -> small int), `readings` (raw, at most one per meter
per minute + a 15-minute heartbeat), `intervals` (15-minute energy + covered seconds), `daily` (per local date of the
installation zone, kept as long as bills), `cursor` (processing state). The counter rules are in energy_counter.py.
"""
from __future__ import annotations

import datetime as dt
import logging
import os
import sqlite3
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Sequence
from zoneinfo import ZoneInfo

from ..db import Database, now_iso
from . import energy_counter as ec

log = logging.getLogger("smplwise.energy")

MIGRATIONS_DIR = Path(__file__).resolve().parents[1] / "migrations_energy"
SCHEMA_VERSION = 1  # the highest E-migration this build knows (backup restore refuses a newer archive)
FILE_NAME = "energy.db"
BUCKET_S = 900
HEARTBEAT_S = 900           # an unchanged value is still written (and processed) every 15 minutes
MIN_STORE_GAP_S = 60        # never more than one raw row per meter per minute
PRUNE_BATCH = 50_000
BACKUP_TABLES = ("meter_map", "readings", "intervals", "daily", "cursor")  # the restore allow-list (section 7 of the contract)
BACKUP_COLUMNS = {
    "meter_map": ("meter_id", "ext_id"),
    "readings": ("meter_id", "ts", "value_wh", "flags"),
    "intervals": ("meter_id", "bucket", "wh", "covered_s", "quality"),
    "daily": ("meter_id", "date", "wh", "covered_s", "day_s", "quality_max"),
    "cursor": ("meter_id", "epoch_id", "last_ts", "last_value_wh", "held_ts", "held_value_wh", "held_kind", "stored_ts", "stored_value_wh",
               "seen_ts", "seen_value_wh", "last_reset", "unavailable"),
}
EVENT_FLAGS = ec.F_RESET | ec.F_REBASE | ec.F_SPIKE_DROPPED | ec.F_JUMP_ACCEPTED | ec.F_NOISE | ec.F_MANUAL | ec.F_LAST_RESET
NOT_ACCEPTED = ec.F_GLITCH | ec.F_NOISE  # rows that are not a reference reading


class EnergyDatabase(Database):
    """The main Database class (gate, durability classes, read/write connections) on a second file with its own
    migration series."""

    def migrate(self) -> list[int]:
        applied: list[int] = []
        conn = self._open()
        try:
            conn.execute("CREATE TABLE IF NOT EXISTS energy_schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)")
            done = {row[0] for row in conn.execute("SELECT version FROM energy_schema_migrations")}
            for file in sorted(MIGRATIONS_DIR.glob("E*.sql")):
                version = int(file.name[1:].split("_", 1)[0])
                if version in done:
                    continue
                sql = file.read_text(encoding="utf-8")
                conn.executescript(f"BEGIN;\n{sql}\nINSERT INTO energy_schema_migrations(version, applied_at) VALUES({version}, '{now_iso()}');\nCOMMIT;")
                applied.append(version)
        finally:
            conn.close()
        return applied

    def ensure_migration_objects(self) -> list[str]:  # no guarded migrations in this series
        return []


@dataclass(frozen=True)
class Sample:
    """One poll result for one meter: `value_wh` None = no valid numeric value (unavailable, unknown, text)."""

    ext_id: str
    ts: int
    value_wh: int | None
    max_kw: float = 100.0
    last_reset: str | None = None
    epoch_id: str | None = None


@dataclass(frozen=True)
class CursorInfo:
    seen_ts: int | None
    seen_value_wh: int | None
    last_ts: int | None
    last_value_wh: int | None
    unavailable: bool
    epoch_id: str | None


def schema_version_of(conn: sqlite3.Connection) -> int:
    try:
        row = conn.execute("SELECT MAX(version) FROM energy_schema_migrations").fetchone()
    except sqlite3.Error:
        return 0
    return int(row[0] or 0)


def local_date(ts: int, tz: ZoneInfo) -> dt.date:
    return dt.datetime.fromtimestamp(ts, dt.timezone.utc).astimezone(tz).date()


def day_bounds(day: dt.date, tz: ZoneInfo) -> tuple[int, int]:
    """UTC epoch seconds of local midnight of `day` and of the next day (23 h / 25 h on DST days)."""
    a = dt.datetime(day.year, day.month, day.day, tzinfo=tz)
    nxt = day + dt.timedelta(days=1)
    b = dt.datetime(nxt.year, nxt.month, nxt.day, tzinfo=tz)
    return int(a.timestamp()), int(b.timestamp())


class EnergyStore:
    def __init__(self, path: Path):
        self.path = Path(path)
        self.db = EnergyDatabase(self.path)
        self.db.migrate()
        self._ids: dict[str, int] = {}
        self._ids_lock = threading.Lock()

    # ------------------------------------------------------------------ ids

    def _mid(self, conn: sqlite3.Connection, ext_id: str, create: bool) -> int | None:
        with self._ids_lock:
            hit = self._ids.get(ext_id)
        if hit is not None:
            return hit
        row = conn.execute("SELECT meter_id FROM meter_map WHERE ext_id = ?", (ext_id,)).fetchone()
        if row is None:
            if not create:
                return None
            cur = conn.execute("INSERT INTO meter_map(ext_id) VALUES (?)", (ext_id,))
            mid = int(cur.lastrowid)
        else:
            mid = int(row[0])
        with self._ids_lock:
            self._ids[ext_id] = mid
        return mid

    def forget_ids(self) -> None:
        with self._ids_lock:
            self._ids.clear()

    # ------------------------------------------------------------------ writing

    def _cursor(self, conn: sqlite3.Connection, mid: int) -> sqlite3.Row | None:
        return conn.execute("SELECT * FROM cursor WHERE meter_id = ?", (mid,)).fetchone()

    def _add_span(self, conn: sqlite3.Connection, mid: int, span: ec.Span, tz: ZoneInfo) -> None:
        days: dict[dt.date, list[int]] = {}
        for bkt, wh, cov in ec.bucket_split(span.t0, span.t1, span.wh, BUCKET_S):
            conn.execute(
                """INSERT INTO intervals(meter_id, bucket, wh, covered_s, quality) VALUES (?, ?, ?, ?, ?)
                   ON CONFLICT(meter_id, bucket) DO UPDATE SET wh = wh + excluded.wh, covered_s = MIN(?, covered_s + excluded.covered_s),
                   quality = MAX(quality, excluded.quality)""",
                (mid, bkt, wh, cov, span.quality, BUCKET_S),
            )
            d = local_date(bkt, tz)
            acc = days.setdefault(d, [0, 0])
            acc[0] += wh
            acc[1] += cov
        for d, (wh, cov) in days.items():
            a, b = day_bounds(d, tz)
            conn.execute(
                """INSERT INTO daily(meter_id, date, wh, covered_s, day_s, quality_max) VALUES (?, ?, ?, ?, ?, ?)
                   ON CONFLICT(meter_id, date) DO UPDATE SET wh = wh + excluded.wh, covered_s = MIN(day_s, covered_s + excluded.covered_s),
                   quality_max = MAX(quality_max, excluded.quality_max)""",
                (mid, d.isoformat(), wh, cov, b - a, span.quality),
            )

    def apply(self, samples: Sequence[Sample], tz: ZoneInfo) -> dict[str, dict[str, Any]]:
        """Process one poll for all meters in ONE energy.db transaction. Returns {ext_id: {flags, events, stored}}."""
        out: dict[str, dict[str, Any]] = {}
        if not samples:
            return out
        with self.db.connection(label="energy.apply", durable=False) as conn:
            for s in samples:
                out[s.ext_id] = self._apply_one(conn, s, tz)
        return out

    def _apply_one(self, conn: sqlite3.Connection, s: Sample, tz: ZoneInfo) -> dict[str, Any]:
        mid = self._mid(conn, s.ext_id, create=True)
        cur = self._cursor(conn, mid)
        if cur is None:
            conn.execute("INSERT INTO cursor(meter_id, epoch_id) VALUES (?, ?)", (mid, s.epoch_id))
            cur = self._cursor(conn, mid)
        result: dict[str, Any] = {"flags": 0, "events": [], "stored": False}
        if s.value_wh is None:
            conn.execute("UPDATE cursor SET unavailable = 1 WHERE meter_id = ?", (mid,))
            return result
        after_unavailable = bool(cur["unavailable"])
        conn.execute("UPDATE cursor SET seen_ts = ?, seen_value_wh = ?, unavailable = 0 WHERE meter_id = ?", (s.ts, s.value_wh, mid))
        stored_ts = cur["stored_ts"]
        due = (
            cur["last_ts"] is None
            or cur["held_ts"] is not None
            or stored_ts is None
            or (s.value_wh != cur["stored_value_wh"] and s.ts - stored_ts >= MIN_STORE_GAP_S)
            or s.ts - stored_ts >= HEARTBEAT_S
            or (s.last_reset is not None and s.last_reset != cur["last_reset"])
            or (after_unavailable and s.ts - stored_ts >= MIN_STORE_GAP_S)
        )
        if not due:
            return result
        state = ec.CounterState(cur["last_ts"], cur["last_value_wh"], cur["held_ts"], cur["held_value_wh"], cur["held_kind"], cur["last_reset"])
        outcome = ec.process(state, s.ts, s.value_wh, s.max_kw, s.last_reset)
        for span in outcome.spans:
            self._add_span(conn, mid, span, tz)
        flags = outcome.flags | (ec.F_AFTER_UNAVAILABLE if after_unavailable else 0)
        conn.execute("INSERT OR REPLACE INTO readings(meter_id, ts, value_wh, flags) VALUES (?, ?, ?, ?)", (mid, s.ts, s.value_wh, flags))
        st = outcome.state
        conn.execute(
            """UPDATE cursor SET last_ts = ?, last_value_wh = ?, held_ts = ?, held_value_wh = ?, held_kind = ?, last_reset = ?,
               stored_ts = ?, stored_value_wh = ?, epoch_id = COALESCE(epoch_id, ?) WHERE meter_id = ?""",
            (st.last_ts, st.last_value_wh, st.held_ts, st.held_value_wh, st.held_kind, st.last_reset, s.ts, s.value_wh, s.epoch_id, mid),
        )
        result.update(flags=flags, events=outcome.events, stored=True)
        return result

    def start_epoch(self, ext_id: str, *, at: int, epoch_id: str, tz: ZoneInfo, final_wh: int | None = None, start_wh: int | None = None) -> dict[str, Any]:
        """Meter replacement / source change: close the current counter life (a typed final reading adds `final - P` over
        [t0, at] as manual energy) and start a new one (at the typed start reading, or at the first reading seen)."""
        added = 0
        with self.db.connection(label="energy.start_epoch", durable=True) as conn:
            mid = self._mid(conn, ext_id, create=True)
            cur = self._cursor(conn, mid)
            if cur is None:
                conn.execute("INSERT INTO cursor(meter_id) VALUES (?)", (mid,))
                cur = self._cursor(conn, mid)
            if final_wh is not None and cur["last_ts"] is not None and cur["last_value_wh"] is not None and at > cur["last_ts"]:
                d = final_wh - cur["last_value_wh"]
                if d >= 0:
                    self._add_span(conn, mid, ec.Span(cur["last_ts"], at, d, ec.Q_MANUAL), tz)
                    added = d
                conn.execute("INSERT OR REPLACE INTO readings(meter_id, ts, value_wh, flags) VALUES (?, ?, ?, ?)", (mid, at - 1, final_wh, ec.F_MANUAL))
            if start_wh is not None:
                conn.execute("INSERT OR REPLACE INTO readings(meter_id, ts, value_wh, flags) VALUES (?, ?, ?, ?)", (mid, at, start_wh, ec.F_MANUAL))
            conn.execute(
                """UPDATE cursor SET epoch_id = ?, last_ts = ?, last_value_wh = ?, held_ts = NULL, held_value_wh = NULL, held_kind = NULL,
                   last_reset = NULL, stored_ts = ?, stored_value_wh = ? WHERE meter_id = ?""",
                (epoch_id, at if start_wh is not None else None, start_wh, at if start_wh is not None else None, start_wh, mid),
            )
        return {"manual_wh": added}

    # ------------------------------------------------------------------ reading

    def cursor_info(self, ext_ids: Iterable[str]) -> dict[str, CursorInfo]:
        out: dict[str, CursorInfo] = {}
        with self.db.connection(mode="read", label="energy.cursor") as conn:
            for ext in ext_ids:
                mid = self._mid(conn, ext, create=False)
                row = self._cursor(conn, mid) if mid is not None else None
                if row is None:
                    continue
                out[ext] = CursorInfo(row["seen_ts"], row["seen_value_wh"], row["last_ts"], row["last_value_wh"], bool(row["unavailable"]), row["epoch_id"])
        return out

    def consumption(self, ext_id: str, start: int, end: int, *, tz: ZoneInfo, interval_floor: int | None) -> dict[str, Any]:
        """Energy in [start, end): intervals while the whole range is within the quarter-hour retention (`interval_floor`
        = the oldest bucket start still kept, None = everything kept), daily totals otherwise (local-midnight edges only).
        `wh` None = nothing known at all. Edge buckets are prorated by time."""
        total = max(0, end - start)
        with self.db.connection(mode="read", label="energy.consumption") as conn:
            mid = self._mid(conn, ext_id, create=False)
            if mid is None or total == 0:
                return {"wh": None, "covered_s": 0, "total_s": total, "source": "intervals"}
            if interval_floor is None or start >= interval_floor:
                return self._from_intervals(conn, mid, start, end)
            return self._from_daily(conn, mid, start, end, tz)

    def _from_intervals(self, conn: sqlite3.Connection, mid: int, start: int, end: int) -> dict[str, Any]:
        first = start - (start % BUCKET_S)
        rows = conn.execute("SELECT bucket, wh, covered_s FROM intervals WHERE meter_id = ? AND bucket >= ? AND bucket < ?", (mid, first, end)).fetchall()
        wh_num = 0  # exact numerators for the edge buckets (x BUCKET_S)
        cov = 0
        for r in rows:
            b = r["bucket"]
            ov = min(end, b + BUCKET_S) - max(start, b)
            if ov <= 0:
                continue
            wh_num += r["wh"] * ov
            cov += r["covered_s"] if ov == BUCKET_S else round(r["covered_s"] * ov / BUCKET_S)
        total = end - start
        if cov == 0:
            return {"wh": None, "covered_s": 0, "total_s": total, "source": "intervals"}
        return {"wh": int(round(wh_num / BUCKET_S)), "covered_s": min(cov, total), "total_s": total, "source": "intervals"}

    def _from_daily(self, conn: sqlite3.Connection, mid: int, start: int, end: int, tz: ZoneInfo) -> dict[str, Any]:
        d0 = local_date(start, tz)
        d1 = local_date(end, tz)
        if day_bounds(d0, tz)[0] != start or day_bounds(d1, tz)[0] != end:
            raise ValueError("edge_not_day_aligned")
        rows = conn.execute("SELECT wh, covered_s FROM daily WHERE meter_id = ? AND date >= ? AND date < ?", (mid, d0.isoformat(), d1.isoformat())).fetchall()
        cov = sum(r["covered_s"] for r in rows)
        wh = sum(r["wh"] for r in rows)
        return {"wh": wh if rows and cov else None, "covered_s": cov, "total_s": end - start, "source": "daily"}

    def daily(self, ext_id: str, start: dt.date, end: dt.date) -> dict[dt.date, tuple[int, int, int]]:
        """{local date: (wh, covered_s, day_s)} for start <= date < end (only dates with a row)."""
        with self.db.connection(mode="read", label="energy.daily") as conn:
            mid = self._mid(conn, ext_id, create=False)
            if mid is None:
                return {}
            rows = conn.execute("SELECT date, wh, covered_s, day_s FROM daily WHERE meter_id = ? AND date >= ? AND date < ? ORDER BY date",
                                (mid, start.isoformat(), end.isoformat())).fetchall()
        return {dt.date.fromisoformat(r["date"]): (r["wh"], r["covered_s"], r["day_s"]) for r in rows}

    def first_daily(self, ext_id: str) -> dt.date | None:
        with self.db.connection(mode="read", label="energy.first_daily") as conn:
            mid = self._mid(conn, ext_id, create=False)
            if mid is None:
                return None
            row = conn.execute("SELECT MIN(date) FROM daily WHERE meter_id = ? AND covered_s > 0", (mid,)).fetchone()
        return dt.date.fromisoformat(row[0]) if row and row[0] else None

    def intervals(self, ext_id: str, start: int, end: int) -> list[tuple[int, int, int, int]]:
        """[(bucket, wh, covered_s, quality)] with start <= bucket < end."""
        with self.db.connection(mode="read", label="energy.intervals") as conn:
            mid = self._mid(conn, ext_id, create=False)
            if mid is None:
                return []
            rows = conn.execute("SELECT bucket, wh, covered_s, quality FROM intervals WHERE meter_id = ? AND bucket >= ? AND bucket < ? ORDER BY bucket",
                                (mid, start, end)).fetchall()
        return [(r[0], r[1], r[2], r[3]) for r in rows]

    def readings(self, ext_id: str, start: int, end: int, limit: int = 500) -> list[tuple[int, int, int]]:
        with self.db.connection(mode="read", label="energy.readings") as conn:
            mid = self._mid(conn, ext_id, create=False)
            if mid is None:
                return []
            rows = conn.execute("SELECT ts, value_wh, flags FROM readings WHERE meter_id = ? AND ts >= ? AND ts < ? ORDER BY ts LIMIT ?",
                                (mid, start, end, limit)).fetchall()
        return [(r[0], r[1], r[2]) for r in rows]

    def events(self, ext_id: str, start: int, end: int) -> list[tuple[int, int, int]]:
        """Raw rows inside [start, end) that carry an event flag: [(ts, value_wh, flags)]."""
        with self.db.connection(mode="read", label="energy.events") as conn:
            mid = self._mid(conn, ext_id, create=False)
            if mid is None:
                return []
            rows = conn.execute("SELECT ts, value_wh, flags FROM readings WHERE meter_id = ? AND ts >= ? AND ts < ? AND (flags & ?) != 0 ORDER BY ts",
                                (mid, start, end, EVENT_FLAGS)).fetchall()
        return [(r[0], r[1], r[2]) for r in rows]

    def reading_around(self, ext_id: str, at: int) -> tuple[tuple[int, int] | None, tuple[int, int] | None]:
        """(last accepted reading at or before `at`, first accepted reading after `at`) as (ts, value_wh)."""
        with self.db.connection(mode="read", label="energy.reading_around") as conn:
            mid = self._mid(conn, ext_id, create=False)
            if mid is None:
                return None, None
            b = conn.execute("SELECT ts, value_wh FROM readings WHERE meter_id = ? AND ts <= ? AND (flags & ?) = 0 ORDER BY ts DESC LIMIT 1", (mid, at, NOT_ACCEPTED)).fetchone()
            a = conn.execute("SELECT ts, value_wh FROM readings WHERE meter_id = ? AND ts > ? AND (flags & ?) = 0 ORDER BY ts LIMIT 1", (mid, at, NOT_ACCEPTED)).fetchone()
        return ((b[0], b[1]) if b else None), ((a[0], a[1]) if a else None)

    # ------------------------------------------------------------------ retention and size

    def prune(self, *, raw_before: int, intervals_before: int, daily_before: dt.date, keep_intervals: Sequence[tuple[str, int, int]] = ()) -> dict[str, int]:
        """Delete raw readings older than `raw_before`, quarter-hour buckets older than `intervals_before` (except the
        ranges in `keep_intervals` = open drafts: (ext_id, start, end)) and daily rows before `daily_before`, in batches of
        PRUNE_BATCH rows per transaction (other writers get the gate between batches)."""
        removed = {"readings": 0, "intervals": 0, "daily": 0}

        def batch(sql: str, args: tuple[Any, ...], key: str) -> None:
            while True:
                with self.db.connection(label=f"energy.prune.{key}", durable=False) as conn:
                    n = conn.execute(sql, (*args, PRUNE_BATCH)).rowcount
                removed[key] += max(n, 0)
                if n < PRUNE_BATCH:
                    return

        batch("DELETE FROM readings WHERE (meter_id, ts) IN (SELECT meter_id, ts FROM readings WHERE ts < ? LIMIT ?)", (raw_before,), "readings")
        keeps: list[tuple[int, int, int]] = []
        if keep_intervals:
            with self.db.connection(mode="read", label="energy.prune.keep") as conn:
                for ext, a, b in keep_intervals:
                    mid = self._mid(conn, ext, create=False)
                    if mid is not None:
                        keeps.append((mid, a, b))
        guard = "".join(" AND NOT (meter_id = ? AND bucket >= ? AND bucket < ?)" for _ in keeps)
        guard_args: tuple[Any, ...] = tuple(v for k in keeps for v in k)
        batch(f"DELETE FROM intervals WHERE (meter_id, bucket) IN (SELECT meter_id, bucket FROM intervals WHERE bucket < ?{guard} LIMIT ?)",
              (intervals_before, *guard_args), "intervals")
        batch("DELETE FROM daily WHERE (meter_id, date) IN (SELECT meter_id, date FROM daily WHERE date < ? LIMIT ?)", (daily_before.isoformat(),), "daily")
        return removed

    def counts(self) -> dict[str, int]:
        with self.db.connection(mode="read", label="energy.counts") as conn:
            return {t: int(conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]) for t in ("readings", "intervals", "daily")}

    def file_bytes(self) -> int:
        total = 0
        for suffix in ("", "-wal", "-shm"):
            try:
                total += os.path.getsize(str(self.path) + suffix)
            except OSError:
                pass
        return total

    def vacuum_if_sparse(self, min_free_fraction: float = 0.2) -> bool:
        conn = self.db._open()
        try:
            pages = int(conn.execute("PRAGMA page_count").fetchone()[0])
            free = int(conn.execute("PRAGMA freelist_count").fetchone()[0])
            if pages == 0 or free / pages < min_free_fraction:
                return False
        finally:
            conn.close()
        token = self.db.gate.try_acquire()
        if token is None:
            return False
        try:
            conn = self.db._open()
            try:
                conn.execute("VACUUM")
            finally:
                conn.close()
        finally:
            self.db.gate.release(token)
        return True

    # ------------------------------------------------------------------ backup / restore (services/energy_backup.py)

    def export_daily(self) -> list[dict[str, Any]]:
        with self.db.connection(mode="read", label="energy.export_daily") as conn:
            rows = conn.execute("SELECT m.ext_id, d.date, d.wh, d.covered_s, d.day_s, d.quality_max FROM daily d JOIN meter_map m ON m.meter_id = d.meter_id ORDER BY m.ext_id, d.date").fetchall()
        return [{"meter": r[0], "date": r[1], "wh": r[2], "covered_s": r[3], "day_s": r[4], "quality_max": r[5]} for r in rows]

    def copy_to(self, dest: Path) -> None:
        """A consistent copy of energy.db (SQLite online backup API; readers and the sampler keep running)."""
        src = sqlite3.connect(self.path, timeout=10)
        try:
            dst = sqlite3.connect(dest)
            try:
                src.backup(dst)
            finally:
                dst.close()
        finally:
            src.close()

    def import_daily(self, rows: list[dict[str, Any]], allowed: set[str], replace: bool) -> int:
        n = 0
        verb = "INSERT OR REPLACE" if replace else "INSERT OR IGNORE"
        with self.db.connection(label="energy.import_daily") as conn:
            for r in rows:
                if not isinstance(r, dict):
                    continue
                ext = r.get("meter")
                if not isinstance(ext, str) or ext not in allowed:
                    continue
                try:
                    day = dt.date.fromisoformat(str(r.get("date")))
                    vals = (int(r.get("wh") or 0), int(r.get("covered_s") or 0), int(r.get("day_s") or 86400), int(r.get("quality_max") or 0))
                except (TypeError, ValueError):
                    continue
                mid = self._mid(conn, ext, create=True)
                conn.execute(f"{verb} INTO daily(meter_id, date, wh, covered_s, day_s, quality_max) VALUES (?, ?, ?, ?, ?, ?)", (mid, day.isoformat(), *vals))
                n += 1
        return n

    def import_file(self, archived: Path, allowed: set[str], replace: bool) -> dict[str, int]:
        """Copy the allow-listed tables/columns of an archived energy.db (opened read-only) into this one, only for meter
        ids in `allowed`, in one transaction. A file of a newer schema, or not an energy.db, is refused (ValueError)."""
        src = sqlite3.connect(f"file:{archived.as_posix()}?mode=ro", uri=True)
        src.row_factory = sqlite3.Row
        counts: dict[str, int] = {}
        try:
            try:
                ver = schema_version_of(src)
                tables = {r[0] for r in src.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()}
            except sqlite3.DatabaseError as exc:
                raise ValueError("not an energy database") from exc
            if ver == 0 or ver > SCHEMA_VERSION or not set(BACKUP_TABLES) <= tables:
                raise ValueError("energy database schema not supported")
            src_map = {int(r["meter_id"]): r["ext_id"] for r in src.execute("SELECT meter_id, ext_id FROM meter_map").fetchall() if isinstance(r["ext_id"], str)}
            verb = "INSERT OR REPLACE" if replace else "INSERT OR IGNORE"
            with self.db.connection(label="energy.import_file") as conn:
                remap: dict[int, int] = {}
                for old, ext in src_map.items():
                    if ext in allowed:
                        mid = self._mid(conn, ext, create=True)
                        remap[old] = mid
                        if replace:
                            for t in ("readings", "intervals", "daily", "cursor"):
                                conn.execute(f"DELETE FROM {t} WHERE meter_id = ?", (mid,))
                for t in ("readings", "intervals", "daily", "cursor"):
                    cols = BACKUP_COLUMNS[t]
                    have = {r[1] for r in src.execute(f"PRAGMA table_info({t})").fetchall()}
                    use = [c for c in cols if c in have]
                    n = 0
                    for r in src.execute(f"SELECT {', '.join(use)} FROM {t}"):
                        new = remap.get(int(r["meter_id"]))
                        if new is None:
                            continue
                        vals = [new if c == "meter_id" else r[c] for c in use]
                        conn.execute(f"{verb} INTO {t}({', '.join(use)}) VALUES ({', '.join('?' * len(use))})", vals)
                        n += 1
                    counts[t] = n
        finally:
            src.close()
        return counts


_STORES: dict[str, EnergyStore] = {}
_STORES_LOCK = threading.Lock()


def store_at(path: Path) -> EnergyStore:
    key = os.path.normcase(str(Path(path).resolve()))
    with _STORES_LOCK:
        st = _STORES.get(key)
        if st is None or not Path(path).exists():
            st = _STORES[key] = EnergyStore(Path(path))
        return st


def store_for(settings: Any) -> EnergyStore:
    """The energy store of an installation (`<data_dir>/energy.db`), migrated on first use."""
    return store_at(Path(settings.data_dir) / FILE_NAME)
