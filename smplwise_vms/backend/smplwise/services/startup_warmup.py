"""WARMUP-POLISH-2421 (owner-approved): a bounded, read-only warm-up of what the first screens read, right after the add-on starts.

After a start (and so after every update) the first screen opened slowly. Measured (tests/bench_startup_warmup.py): the largest cost
by far is the web framework's own first-request work - FastAPI builds the request handling state of every route (dependencies,
parameter and response models: ~880 routes here) lazily, the first time a request is matched against them, which took 2-4 s of the
first GET on the workstation. Smaller: the lazy imports of the routes' services, the database file's pages not yet in the operating
system's cache, the first parse of every entity. This runs, once, in a daemon thread a few seconds after start-up: the route matching
of one request to an address no route serves (`matches()` only - nothing is called, no response, no log or audit row), then the same
READS the home screen and the live screens make on their first load:

- never blocks readiness: it starts after the start-up handler returned, in its own thread; the add-on answers requests meanwhile;
- bounded: BUDGET_S (30 s) of wall time in all, each step timed; the remaining steps are skipped once the budget is spent;
- low priority: a short pause between steps, so a viewer's request never queues behind a burst of warm-up reads;
- read-only: every step runs on a `mode="read"` connection (`PRAGMA query_only=1` - SQLite refuses any write) and calls only reading
  functions; no device, no recorder (no NVR read at all, so its read rate limits and leases are untouched), no media server, no
  Home Assistant call, no audit row;
- never fails anything: a failing step is logged at debug level and the next one runs;
- off with the setting `server.startup_warmup` = "false" (the browser's idle warm-up of the screen chunks reads the same key) or the
  environment variable SW_STARTUP_WARMUP=0 (wins over the setting).

`run()` returns what it did (step name -> milliseconds, or the reason it skipped) for the log line and the tests.
"""

from __future__ import annotations

import logging
import os
import threading
import time
from typing import Any, Callable

log = logging.getLogger(__name__)

SETTING = "server.startup_warmup"
ENV = "SW_STARTUP_WARMUP"
BUDGET_S = 30.0
START_DELAY_S = 5.0
PAUSE_S = 0.05


def enabled(db: Any) -> bool:
    """The environment variable wins (0/false/off: off; 1/true/on: on); else the stored setting (anything but "false" is on)."""
    env = os.environ.get(ENV)
    if env is not None and env.strip() != "":
        return env.strip().lower() not in ("0", "false", "off", "no")
    try:
        from ..db import get_setting

        with db.connection(mode="read", label="warmup.setting") as conn:
            return (get_setting(conn, SETTING) or "true") != "false"
    except Exception:  # noqa: BLE001 - an unreadable setting keeps the default (on)
        return True


WARM_PATH = "/api/v1/__startup_warmup__"


def warm_routes(app: Any) -> int:
    """Match one request scope against every route of `app` (Starlette's `BaseRoute.matches`): the framework builds each route's
    request handling state on the way, exactly as for the first real request, but nothing is called. Returns how many routes."""
    scope = {"type": "http", "path": WARM_PATH, "raw_path": WARM_PATH.encode(), "method": "GET", "root_path": "", "headers": [], "query_string": b""}
    n = 0
    for route in list(getattr(getattr(app, "router", None), "routes", []) or []):
        try:
            route.matches(scope)
            n += 1
        except Exception:  # noqa: BLE001 - one route that cannot match a bare scope does not stop the others
            continue
    return n


def _settings(conn: Any) -> None:
    from ..routers.settings import read_settings

    read_settings(conn)


def _devices(conn: Any) -> None:
    # the home screen's tree: every entity parsed, the tree built, the alarm-managed set and the home widgets' payload
    from ..services import alarm, home_screen
    from ..services import devices as devices_svc

    entities = devices_svc.load_entities(conn)
    devices_svc.build_tree(conn, entities, scoped=False)
    alarm.managed_controls(conn)
    home_screen.payload(conn, entities, personalize=False, personal=None)


def _catalog(conn: Any) -> None:
    # the live screens: cameras, sites and floors as stored (the page cache of their tables; no recorder is asked anything)
    for table in ("cameras", "sites", "buildings", "floors", "areas", "events"):
        try:
            conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()  # noqa: S608 - fixed table names
        except Exception:  # noqa: BLE001 - a table this database does not have
            continue


def _imports(_conn: Any) -> None:
    # the services the hot routes import lazily on their first request
    import importlib

    for name in ("alarm", "storage", "user_prefs", "building_scope", "door_authority", "presence", "shared_spaces", "access", "recorder_health", "events_cache"):
        try:
            importlib.import_module(f"smplwise.services.{name}")
        except Exception:  # noqa: BLE001 - a module this build does not have
            continue


STEPS: list[tuple[str, Callable[[Any], None]]] = [
    ("imports", _imports),
    ("settings", _settings),
    ("devices", _devices),
    ("catalog", _catalog),
]


def run(db: Any, *, app: Any = None, budget_s: float = BUDGET_S, pause_s: float = PAUSE_S, steps: list[tuple[str, Callable[[Any], None]]] | None = None,
        clock: Callable[[], float] = time.monotonic) -> dict[str, Any]:
    """Run the warm-up once, inside the budget: the routes of `app` (when given), then the read steps. Returns
    {step: ms | "skipped: budget" | "failed: <type>"} plus "routes" (how many were matched) and "total_ms"."""
    out: dict[str, Any] = {}
    started = clock()
    if app is not None:
        t0 = clock()
        try:
            out["routes"] = warm_routes(app)
            out["routes_ms"] = round((clock() - t0) * 1000, 1)
        except Exception as exc:  # noqa: BLE001
            out["routes_ms"] = f"failed: {type(exc).__name__}"
    for name, fn in steps if steps is not None else STEPS:
        if clock() - started >= budget_s:
            out[name] = "skipped: budget"
            continue
        t0 = clock()
        try:
            with db.connection(mode="read", label=f"warmup.{name}") as conn:
                fn(conn)
            out[name] = round((clock() - t0) * 1000, 1)
        except Exception as exc:  # noqa: BLE001 - a warm-up step never fails anything
            out[name] = f"failed: {type(exc).__name__}"
            log.debug("startup warm-up step %s failed", name, exc_info=True)
        if pause_s:
            time.sleep(pause_s)
    out["total_ms"] = round((clock() - started) * 1000, 1)
    return out


def _thread(db: Any, app: Any, delay_s: float) -> None:
    try:
        if delay_s:
            time.sleep(delay_s)
        if not enabled(db):
            log.info("startup warm-up is off")
            return
        result = run(db, app=app)
        log.info("startup warm-up done: %s", result)
    except Exception:  # noqa: BLE001 - never let the thread raise
        log.debug("startup warm-up failed", exc_info=True)


def start(db: Any, app: Any = None, delay_s: float = START_DELAY_S) -> threading.Thread | None:
    """Start the warm-up in a daemon thread (returns it), or None when the environment switch is off."""
    env = os.environ.get(ENV)
    if env is not None and env.strip().lower() in ("0", "false", "off", "no"):
        return None
    t = threading.Thread(target=_thread, args=(db, app, delay_s), name="startup-warmup", daemon=True)
    t.start()
    return t
