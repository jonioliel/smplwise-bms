"""CR-WATER78 slice 1: the water sampler and the retention job (the electricity sampler's shape, services/energy_sampler.py).

Module switch (`water.enabled`, default OFF, section 7): while off there is no sampler thread (started at start-up only when on,
started / stopped by the switch route) and the janitor does nothing; `tick` itself checks the switch too, so a stray call never
samples. Turning the module on starts sampling at the next minute; nothing is ever backfilled (no estimates).

One poll a minute for all active water meters from the state mirror the infrastructure session keeps current (read-only: no
service call, nothing written to the infrastructure). Readings go to water.db in one transaction under its own gate; the main
database is only read, except the rare pause of a meter whose unit changed."""
from __future__ import annotations

import json
import logging
import os
import sqlite3
import threading
import time
from typing import Any

from ..audit import audit
from ..config import Settings
from ..db import Database
from . import energy_store as st
from . import water_meters as wm
from . import water_settings as ws

log = logging.getLogger("smplwise.water")

POLL_S = 60
RETENTION_EVERY_S = 3600


def _connected() -> bool:
    from . import ha_sync

    return bool(ha_sync.STATE.connected)


def tick(db: Database, settings: Settings, now: float | None = None, *, require_connection: bool = True) -> dict[str, Any]:
    """One poll. Returns a small summary (tests, diagnostics)."""
    with db.connection(mode="read", label="water.sampler.read") as conn:
        if not ws.enabled(conn):
            return {"skipped": "module_off", "samples": 0}
        if require_connection and not _connected():
            return {"skipped": "disconnected", "samples": 0}
        try:
            rows = conn.execute(
                """SELECT m.id, m.source_ref, m.unit, m.unit_factor, m.max_flow_lph, e.state, e.unit AS e_unit, e.attributes_json, e.removed_at,
                          (SELECT id FROM water_meter_epochs p WHERE p.meter_id = m.id AND p.ended_at IS NULL ORDER BY p.started_at DESC LIMIT 1) AS epoch_id
                   FROM water_meters m LEFT JOIN ha_entities e ON e.entity_id = m.source_ref WHERE m.status = 'active'"""
            ).fetchall()
        except sqlite3.OperationalError:  # before the migration
            return {"skipped": "no_schema", "samples": 0}
        tz = wm.tz_of(conn)
    ts = int(now if now is not None else time.time())
    ts -= ts % 60
    if not rows:
        return {"samples": 0}
    samples: list[st.Sample] = []
    unit_changed: list[str] = []
    for r in rows:
        value = None
        last_reset = None
        if r["e_unit"] is not None and r["removed_at"] is None:
            if wm.UNITS.get((r["e_unit"] or "").strip().lower(), (None,))[0] != r["unit"]:
                unit_changed.append(r["id"])
                continue
            value = wm.to_ml(r["state"], int(r["unit_factor"]))
            try:
                attrs = json.loads(r["attributes_json"] or "{}")
            except ValueError:
                attrs = {}
            if isinstance(attrs, dict) and str(attrs.get("state_class") or "") == "total" and attrs.get("last_reset"):
                last_reset = str(attrs.get("last_reset"))[:40]
        samples.append(st.Sample(r["id"], ts, value, float(r["max_flow_lph"] or wm.DEFAULT_MAX_FLOW_LPH), last_reset, r["epoch_id"]))
    result = wm.store_for(settings).apply(samples, tz)
    if unit_changed:
        with db.connection(label="water.sampler.unit_changed") as conn:
            for mid in unit_changed:
                wm.pause_for_unit_change(conn, mid)
                audit(conn, actor=None, action="infra.water.meter.pause", decision="allowed", resource_type="water_meter", resource_id=mid, reason="unit_changed")
        log.warning("paused %d water meter(s) whose unit changed", len(unit_changed))
    return {"samples": len(samples), "stored": sum(1 for v in result.values() if v.get("stored")), "paused": unit_changed}


class Sampler:
    """The background thread: a tick at the start of every minute until stopped. Runs only while the module is on."""

    def __init__(self) -> None:
        self.stop_evt = threading.Event()
        self.thread: threading.Thread | None = None
        self.last: dict[str, Any] = {}
        self.errors = 0

    @property
    def running(self) -> bool:
        return bool(self.thread and self.thread.is_alive())

    def start(self, db: Database, settings: Settings, *, assume_on: bool = False) -> bool:
        """Start the thread when the module is on (and the process allows samplers). Returns whether it runs now. `assume_on`: the
        switch route turning the module on inside its own (not yet committed) transaction; every tick still checks the switch."""
        if os.environ.get("SW_WATER_SAMPLER", os.environ.get("SW_ENERGY_SAMPLER", "1")) == "0" or self.running:
            return self.running
        if not assume_on:
            with db.connection(mode="read", label="water.sampler.start") as conn:
                if not ws.enabled(conn):
                    return False
        self.stop_evt.clear()
        self.thread = threading.Thread(target=self._run, args=(db, settings), name="water-sampler", daemon=True)
        self.thread.start()
        return True

    def _run(self, db: Database, settings: Settings) -> None:
        while not self.stop_evt.is_set():
            wait = POLL_S - (time.time() % POLL_S) + 0.5
            if self.stop_evt.wait(wait):
                return
            try:
                self.last = tick(db, settings)
                if self.last.get("skipped") == "module_off":
                    return  # switched off meanwhile: the thread ends
            except Exception:  # noqa: BLE001 - the sampler never dies; the next minute retries
                self.errors += 1
                log.warning("water sampler tick failed", exc_info=True)

    def shutdown(self) -> None:
        self.stop_evt.set()


SAMPLER = Sampler()


# ---------------------------------------------------------------- retention

_LAST: dict[str, float] = {"retention": 0.0}


def retention(db: Database, settings: Settings, now: float | None = None) -> dict[str, Any]:
    """Raw readings after `water.raw_retention_days`, quarter-hour buckets after `water.interval_retention_months`, daily totals after
    `water.daily_retention_years`. Only while the module is on."""
    t = int(now if now is not None else time.time())
    with db.connection(mode="read", label="water.retention.read") as conn:
        if not ws.enabled(conn):
            return {"skipped": "module_off"}
        vals = ws.values(conn)
        tz = wm.tz_of(conn)
    raw_before = t - int(vals["water.raw_retention_days"]) * 86400
    intervals_before = t - int(int(vals["water.interval_retention_months"]) * 30.44 * 86400)
    intervals_before -= intervals_before % st.BUCKET_S
    today = st.local_date(t, tz)
    years = int(vals["water.daily_retention_years"])
    try:
        daily_before = today.replace(year=today.year - years)
    except ValueError:  # 29 February
        daily_before = today.replace(year=today.year - years, day=28)
    removed = wm.store_for(settings).prune(raw_before=raw_before, intervals_before=intervals_before, daily_before=daily_before)
    return {"removed": removed, "raw_before": raw_before, "intervals_before": intervals_before, "daily_before": daily_before.isoformat()}


def janitor(db: Database, settings: Settings, now: float | None = None) -> dict[str, Any] | None:
    """Called by main.janitor_tick every 30 s; the retention once an hour (nothing while the module is off)."""
    t = now if now is not None else time.time()
    if t - _LAST["retention"] < RETENTION_EVERY_S:
        return None
    _LAST["retention"] = t
    return retention(db, settings, t)
