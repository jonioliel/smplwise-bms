"""CR-023 P1: the electricity sampler and the retention job.

Sampler: ONE poll a minute for ALL active meters. It reads the state mirror that the existing infrastructure WebSocket
session keeps current (services/ha_sync.py) - no second connection, no service call, nothing written to the
infrastructure (read-only by construction). While that session is disconnected nothing is sampled (a stale mirror is not
a reading); the counter closes the gap when it is back. Readings go to energy.db in one transaction under its own gate;
the main database is only read (a read-mode connection), except the rare pause of a meter whose unit changed.

Retention (hourly, from the janitor): raw readings after `energy.raw_retention_days`, quarter-hour buckets after
`energy.interval_retention_months` (never inside the period of an open draft bill), daily totals after
`energy.bill_retention_years`; a VACUUM at most once a week at night when a fifth of the file is free."""
from __future__ import annotations

import datetime as dt
import json
import logging
import os
import sqlite3
import threading
import time
from typing import Any

from ..audit import audit
from ..config import Settings
from ..db import Database, get_setting
from . import energy_meters as meters
from . import energy_settings as es
from . import energy_store as st
from .timeutil import zone

log = logging.getLogger("smplwise.energy")

POLL_S = 60
RETENTION_EVERY_S = 3600
VACUUM_EVERY_S = 7 * 86400


def _connected() -> bool:
    from . import ha_sync

    return bool(ha_sync.STATE.connected)


def tick(db: Database, settings: Settings, now: float | None = None, *, require_connection: bool = True) -> dict[str, Any]:
    """One poll. Returns a small summary (tests, diagnostics)."""
    if require_connection and not _connected():
        return {"skipped": "disconnected", "samples": 0}
    ts = int(now if now is not None else time.time())
    ts -= ts % 60
    with db.connection(mode="read", label="energy.sampler.read") as conn:
        try:
            rows = conn.execute(
                """SELECT m.id, m.source_ref, m.unit, m.unit_factor, m.max_kw, e.state, e.unit AS e_unit, e.attributes_json, e.removed_at,
                          (SELECT id FROM energy_meter_epochs p WHERE p.meter_id = m.id AND p.ended_at IS NULL ORDER BY p.started_at DESC LIMIT 1) AS epoch_id
                   FROM energy_meters m LEFT JOIN ha_entities e ON e.entity_id = m.source_ref WHERE m.status = 'active'"""
            ).fetchall()
        except sqlite3.OperationalError:  # before the migration
            return {"skipped": "no_schema", "samples": 0}
        tz = zone(get_setting(conn, "time.zone", "Asia/Jerusalem") or "Asia/Jerusalem")
    if not rows:
        return {"samples": 0}
    samples: list[st.Sample] = []
    unit_changed: list[str] = []
    for r in rows:
        value = None
        last_reset = None
        if r["e_unit"] is not None and r["removed_at"] is None:
            if (r["e_unit"] or "").strip().lower() != (r["unit"] or "").lower():
                unit_changed.append(r["id"])
                continue
            value = meters.numeric_wh(r["state"], int(r["unit_factor"]))
            try:
                attrs = json.loads(r["attributes_json"] or "{}")
            except ValueError:
                attrs = {}
            if isinstance(attrs, dict) and str(attrs.get("state_class") or "") == "total" and attrs.get("last_reset"):
                last_reset = str(attrs.get("last_reset"))[:40]
        samples.append(st.Sample(r["id"], ts, value, float(r["max_kw"] or 100), last_reset, r["epoch_id"]))
    store = st.store_for(settings)
    result = store.apply(samples, tz)
    if unit_changed:
        with db.connection(label="energy.sampler.unit_changed") as conn:
            for mid in unit_changed:
                meters.pause_for_unit_change(conn, mid)
                audit(conn, actor=None, action="energy.meter.pause", decision="allowed", resource_type="energy_meter", resource_id=mid, reason="unit_changed")
        log.warning("paused %d electricity meter(s) whose unit changed", len(unit_changed))
    return {"samples": len(samples), "stored": sum(1 for v in result.values() if v.get("stored")), "paused": unit_changed}


class Sampler:
    """The background thread: a tick at the start of every minute until stopped."""

    def __init__(self) -> None:
        self.stop_evt = threading.Event()
        self.thread: threading.Thread | None = None
        self.last: dict[str, Any] = {}
        self.errors = 0

    def start(self, db: Database, settings: Settings) -> None:
        if os.environ.get("SW_ENERGY_SAMPLER", "1") == "0" or (self.thread and self.thread.is_alive()):
            return
        self.stop_evt.clear()
        self.thread = threading.Thread(target=self._run, args=(db, settings), name="energy-sampler", daemon=True)
        self.thread.start()

    def _run(self, db: Database, settings: Settings) -> None:
        while not self.stop_evt.is_set():
            wait = POLL_S - (time.time() % POLL_S) + 0.5
            if self.stop_evt.wait(wait):
                return
            try:
                self.last = tick(db, settings)
            except Exception:  # noqa: BLE001 - the sampler never dies; the next minute retries
                self.errors += 1
                log.warning("energy sampler tick failed", exc_info=True)

    def shutdown(self) -> None:
        self.stop_evt.set()


SAMPLER = Sampler()


# ---------------------------------------------------------------- retention

_LAST: dict[str, float] = {"retention": 0.0, "vacuum": 0.0}


def _draft_keeps(conn: sqlite3.Connection, tz: Any) -> list[tuple[str, int, int]]:
    """(meter id, start, end) of every open draft bill of the billing branch (contract 2.3); [] before its tables exist."""
    tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('energy_bills', 'energy_account_meters')").fetchall()}
    if tables != {"energy_bills", "energy_account_meters"}:
        return []
    out: list[tuple[str, int, int]] = []
    try:
        rows = conn.execute("""SELECT am.meter_id, b.period_start, b.period_end FROM energy_bills b JOIN energy_account_meters am ON am.account_id = b.account_id
                               WHERE b.state = 'draft'""").fetchall()
    except sqlite3.OperationalError:
        return []
    for r in rows:
        try:
            a = dt.date.fromisoformat(str(r[1])[:10])
            b = dt.date.fromisoformat(str(r[2])[:10])
        except ValueError:
            continue
        out.append((r[0], st.day_bounds(a, tz)[0], st.day_bounds(b, tz)[0]))
    return out


def retention(db: Database, settings: Settings, now: float | None = None) -> dict[str, Any]:
    t = int(now if now is not None else time.time())
    with db.connection(mode="read", label="energy.retention.read") as conn:
        try:
            conn.execute("SELECT 1 FROM energy_meters LIMIT 1")
        except sqlite3.OperationalError:
            return {"skipped": "no_schema"}
        vals = es.values(conn)
        tz = zone(get_setting(conn, "time.zone", "Asia/Jerusalem") or "Asia/Jerusalem")
        keeps = _draft_keeps(conn, tz)
    raw_before = t - int(vals["energy.raw_retention_days"]) * 86400
    intervals_before = t - int(int(vals["energy.interval_retention_months"]) * es.DAYS_PER_MONTH * 86400)
    intervals_before -= intervals_before % st.BUCKET_S
    today = st.local_date(t, tz)
    years = int(vals["energy.bill_retention_years"])
    try:
        daily_before = today.replace(year=today.year - years)
    except ValueError:  # 29 February
        daily_before = today.replace(year=today.year - years, day=28)
    store = st.store_for(settings)
    removed = store.prune(raw_before=raw_before, intervals_before=intervals_before, daily_before=daily_before, keep_intervals=keeps)
    return {"removed": removed, "raw_before": raw_before, "intervals_before": intervals_before, "daily_before": daily_before.isoformat(), "kept_drafts": len(keeps)}


def janitor(db: Database, settings: Settings, now: float | None = None) -> dict[str, Any] | None:
    """Called by main.janitor_tick every 30 s; runs the retention once an hour and a sparse-file VACUUM at most weekly at night."""
    t = now if now is not None else time.time()
    if t - _LAST["retention"] < RETENTION_EVERY_S:
        return None
    _LAST["retention"] = t
    out = retention(db, settings, t)
    try:
        with db.connection(mode="read", label="energy.janitor.tz") as conn:
            tz = zone(get_setting(conn, "time.zone", "Asia/Jerusalem") or "Asia/Jerusalem")
        hour = dt.datetime.fromtimestamp(t, dt.timezone.utc).astimezone(tz).hour
        if 2 <= hour < 5 and t - _LAST["vacuum"] >= VACUUM_EVERY_S:
            _LAST["vacuum"] = t
            out["vacuum"] = st.store_for(settings).vacuum_if_sparse()
    except Exception:  # noqa: BLE001
        log.warning("energy vacuum check failed", exc_info=True)
    return out
