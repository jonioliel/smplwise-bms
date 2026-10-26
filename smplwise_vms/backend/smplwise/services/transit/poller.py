"""BUSTIMES-295 - the one background loop that talks to the third party.

Every `poll_s` seconds (installation setting, default 30, floor 30 unless acknowledged; only while the module is on, the notice boards are on and at least one enabled board shows transit) it collects the DISTINCT
stop codes the boards use - one request per code, shared by every screen - and stores for each the planned boardable arrivals of
`now .. now + the widest display window + 90 minutes`, so "the next bus after the window" and the last-known fallback exist. A circuit breaker
(1, 2, 4, 8 minutes) stops the calls while the source fails; the cache keeps serving its last rows with their age. The nightly catalogue
download (catalogue.py) is run by the same loop. Nothing here is on the path of a screen's request: the display route reads the cache only."""
from __future__ import annotations

import datetime as dt
import json
import logging
import os
import threading
from dataclasses import dataclass, field
from typing import Any, Callable

from ...config import Settings
from ...db import Database, get_setting
from . import catalogue, model, stride
from . import provider as provider_mod

log = logging.getLogger("smplwise.transit")

INTERVAL_S = 30.0  # the default of `transit.config.poll_s`; the loop reads the setting each round
EXTRA_MIN = 90
MAX_RANGE_MIN = 240 + EXTRA_MIN
BACKOFF_S = (60, 120, 240, 480)
CATALOGUE_RETRY_S = 1800


@dataclass
class Health:
    """The source's health (in memory; the durable part is `transit_cache.fetched_at`)."""

    lock: threading.Lock = field(default_factory=threading.Lock)
    last_ok_at: dt.datetime | None = None
    last_error_at: dt.datetime | None = None
    last_error: str = ""
    errors: int = 0
    consecutive: int = 0
    backoff_until: dt.datetime | None = None

    def ok(self, now: dt.datetime) -> None:
        with self.lock:
            self.last_ok_at, self.consecutive, self.backoff_until = now, 0, None

    def fail(self, now: dt.datetime, kind: str) -> None:
        with self.lock:
            self.errors += 1
            self.consecutive += 1
            self.last_error, self.last_error_at = kind, now
            self.backoff_until = now + dt.timedelta(seconds=BACKOFF_S[min(self.consecutive, len(BACKOFF_S)) - 1])

    def blocked(self, now: dt.datetime) -> bool:
        with self.lock:
            return self.backoff_until is not None and now < self.backoff_until

    def view(self) -> dict[str, Any]:
        with self.lock:
            return {"last_ok_at": _iso(self.last_ok_at), "last_error_at": _iso(self.last_error_at), "last_error": self.last_error or None,
                    "errors": self.errors, "consecutive_errors": self.consecutive, "backoff_until": _iso(self.backoff_until)}


HEALTH = Health()
_PROVIDERS: dict[int, tuple[Any, Any]] = {}  # id(fetch callable) -> (fetch, its scheduled provider)
_LAST_CATALOGUE_TRY: dict[str, dt.datetime] = {}


def _iso(t: dt.datetime | None) -> str | None:
    return t.astimezone(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z") if t else None


def load_config(conn: Any) -> dict[str, Any]:
    return model.load_config(get_setting(conn, model.CONFIG_KEY, ""))


def used_codes(conn: Any) -> dict[int, int]:
    """`{stop code: the widest window (minutes) of an enabled board showing it}` for the codes the poller must fetch; {} = nothing to do."""
    from ..notices import model as nmodel
    from ..notices import store as nstore

    cfg = load_config(conn)
    if not cfg["enabled"] or not cfg["stops"] or not nstore.module_on(conn):
        return {}
    out: dict[int, int] = {}
    for r in conn.execute("SELECT display_json FROM notice_boards WHERE deleted_at IS NULL AND enabled = 1").fetchall():
        screen = nmodel.load_display(r["display_json"]).get("transit") or {}
        if not screen.get("enabled"):
            continue
        for code in model.selection(cfg, screen):
            out[code] = max(out.get(code, 0), int(screen.get("window_min") or 60))
    return out


def _provider_for(source: Any, tz: Any) -> provider_mod.ArrivalProvider:
    """The provider of a pass: a provider object as it is; a bare Fetch callable wrapped once (its stop-id and destination caches live in the wrapper)."""
    if hasattr(source, "arrivals"):
        return source
    got = _PROVIDERS.get(id(source))
    if got is None or got[0] is not source:
        got = (source, provider_mod.RealtimeProvider(source, tz))
        _PROVIDERS[id(source)] = got
    return got[1]


def poll_once(db: Database, source: Any, now: dt.datetime) -> dict[str, Any]:
    """One pass: ask the provider once per used code and store the rows. `source` is an ArrivalProvider (provider.py) or a Stride fetch callable.
    Returns a small summary (tests, the manual refresh)."""
    from ..notices import sources

    with db.connection(mode="read", label="transit.poll.plan") as conn:
        want = used_codes(conn)
        tz = sources.installation_tz(conn)
        cfg = load_config(conn)
    if not want:
        return {"codes": 0, "fetched": 0, "skipped": "idle"}
    if HEALTH.blocked(now):
        return {"codes": len(want), "fetched": 0, "skipped": "backoff"}
    prov = _provider_for(source, tz)
    if hasattr(prov, "configure"):
        prov.configure(position_fresh_s=model.position_fresh_s(cfg), poll_s=model.poll_s(cfg))
    if hasattr(prov, "new_pass"):
        prov.new_pass()
    fetched, failed = 0, None
    for code, window in sorted(want.items()):
        try:
            to = now + dt.timedelta(minutes=min(window, 240) + EXTRA_MIN)
            try:
                rows = prov.arrivals(code, now, to)
            except provider_mod.UnknownStop:
                _store(db, code, now, now, [])  # an unknown stop: an empty cache says "nothing", it is not the source's failure
                continue
            _store(db, code, now, to, rows)
            fetched += 1
        except stride.StrideError as exc:
            failed = exc.kind
            break
        except Exception as exc:  # noqa: BLE001 - one bad pass never kills the loop
            log.exception("transit poll failed")
            failed = type(exc).__name__
            break
    if failed:
        HEALTH.fail(now, failed)
    else:
        HEALTH.ok(now)
    with db.connection(label="transit.poll.prune") as conn:
        marks = ",".join("?" * len(want))
        conn.execute(f"DELETE FROM transit_cache WHERE code NOT IN ({marks})", tuple(want))
    return {"codes": len(want), "fetched": fetched, "error": failed}


def _store(db: Database, code: int, fetched_at: dt.datetime, window_to: dt.datetime, rows: list[dict[str, Any]]) -> None:
    with db.connection(label="transit.poll.store") as conn:
        conn.execute("INSERT INTO transit_cache(code, fetched_at, window_to, rows_json) VALUES (?, ?, ?, ?) "
                     "ON CONFLICT(code) DO UPDATE SET fetched_at = excluded.fetched_at, window_to = excluded.window_to, rows_json = excluded.rows_json",
                     (code, _iso(fetched_at), _iso(window_to), json.dumps(rows, ensure_ascii=False, separators=(",", ":"))))


def catalogue_pass(db: Database, fetch: stride.Fetch, now: dt.datetime, *, force: bool = False) -> dict[str, Any] | None:
    """The nightly download when it is due (or `force`); a failure is retried at most every 30 minutes. None = nothing was due."""
    from ..notices import sources

    with db.connection(mode="read", label="transit.catalogue.plan") as conn:
        cfg = load_config(conn)
        tz = sources.installation_tz(conn)
        local = now.astimezone(tz)
        if not force and not (cfg["enabled"] and catalogue.due(conn, local)):
            return None
    last = _LAST_CATALOGUE_TRY.get("t")
    if not force and last is not None and (now - last).total_seconds() < CATALOGUE_RETRY_S:
        return None
    _LAST_CATALOGUE_TRY["t"] = now
    return catalogue.refresh(db, fetch, now, local.date())


class Poller:
    def __init__(self) -> None:
        self.thread: threading.Thread | None = None
        self.stop_evt = threading.Event()
        self.wake = threading.Event()

    def start(self, db: Database, settings: Settings, fetch: Any = None) -> None:
        if os.environ.get("SW_TRANSIT", "1") == "0" or (self.thread and self.thread.is_alive()):
            return
        self.stop_evt.clear()
        self.thread = threading.Thread(target=self._loop, args=(db, fetch or stride.http_fetch), name="transit-poller", daemon=True)
        self.thread.start()

    def kick(self) -> None:
        """Run a pass now (the settings screen just changed something)."""
        self.wake.set()

    def shutdown(self, timeout: float = 3.0) -> None:
        self.stop_evt.set()
        self.wake.set()
        t = self.thread
        if t is not None and t is not threading.current_thread():
            t.join(timeout=timeout)

    @staticmethod
    def _interval(db: Database) -> float:
        try:
            with db.connection(mode="read", label="transit.poll.interval") as conn:
                return float(model.poll_s(load_config(conn)))
        except Exception:  # noqa: BLE001 - the default cadence beats a dead loop
            return INTERVAL_S

    def _loop(self, db: Database, fetch: Any) -> None:
        if self.stop_evt.wait(20.0):
            return
        while not self.stop_evt.is_set():
            now = dt.datetime.now(dt.timezone.utc)
            try:
                catalogue_pass(db, fetch, now)
                poll_once(db, fetch, now)
            except Exception:  # noqa: BLE001 - the loop never dies on one bad pass
                log.exception("transit pass failed")
            self.wake.wait(self._interval(db))
            self.wake.clear()


POLLER = Poller()
