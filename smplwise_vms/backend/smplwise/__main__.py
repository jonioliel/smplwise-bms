"""`python -m smplwise` — run the API (uvicorn). Inside the add-on run.sh starts it through the crash guard
(`python3 -m smplwise.crashguard`), which restarts it after a native crash (SEGFAULT-PLAYBACK-2332)."""
from __future__ import annotations

import importlib.util
import logging
import os
from pathlib import Path
from typing import Callable

import uvicorn

from .main import create_app, warm_route_tables

LOOPS = ("auto", "asyncio", "uvloop")
HTTPS = ("auto", "h11", "httptools")

# ASYNCIO-DEFAULT-2342 (owner 02.11, round 13, answer 5A): the server runs on the standard-library asyncio event loop and the pure-Python
# h11 HTTP parser BY DEFAULT. uvloop / httptools (the native code that drove the playback relay sockets at the 2.33.0 SIGSEGV,
# docs/changes/SEGFAULT-PLAYBACK-2332.md) are an opt-in: the setting `server.fast_network` ("שרת: רכיב תקשורת מהיר", "false" by
# default) or the environment variable SW_FAST_NETWORK (1/true/on or 0/false/off; it wins over the setting). Read once at start-up;
# a change applies after the add-on restarts. The crash guard's safe mode still forces asyncio + h11 over an opt-in.
FAST_SETTING = "server.fast_network"
FAST_ENV = "SW_FAST_NETWORK"
_TRUE = ("1", "true", "on", "yes")
_FALSE = ("0", "false", "off", "no")


def _flag(raw: str | None) -> bool | None:
    v = (raw or "").strip().lower()
    return True if v in _TRUE else False if v in _FALSE else None


def fast_network_wanted(env: dict[str, str] | None = None, stored: str | None = None) -> tuple[bool, str]:
    """Whether the native loop / parser are asked for, and by whom: ("env" | "setting" | "default"). The environment wins when it
    holds a readable value; then the stored setting ("true" only); otherwise off."""
    env = os.environ if env is None else env
    from_env = _flag(env.get(FAST_ENV))
    if from_env is not None:
        return from_env, "env"
    from_setting = _flag(stored)
    if from_setting is not None:
        return from_setting, "setting"
    return False, "default"


def _installed(module: str) -> bool:
    try:
        return importlib.util.find_spec(module) is not None
    except (ImportError, ValueError):
        return False


def server_impl(env: dict[str, str] | None = None, *, fast: bool = False, installed: Callable[[str], bool] = _installed) -> tuple[str, str]:
    """The uvicorn event loop and HTTP parser.
    - safe mode (SW_SAFE_MODE=1, set by the crash guard after repeated native crashes): asyncio + h11, whatever else is asked;
    - an explicit, valid SW_UVICORN_LOOP / SW_UVICORN_HTTP (an operator's / a test's override) is used as given;
    - otherwise asyncio + h11, or uvloop + httptools when `fast` is on AND the module is installed (uvloop does not exist on Windows:
      that half falls back to asyncio / h11 on its own)."""
    env = os.environ if env is None else env
    if env.get("SW_SAFE_MODE") == "1":
        return "asyncio", "h11"
    loop = (env.get("SW_UVICORN_LOOP") or "").strip().lower()
    http = (env.get("SW_UVICORN_HTTP") or "").strip().lower()
    if loop not in LOOPS:
        loop = "uvloop" if fast and installed("uvloop") else "asyncio"
    if http not in HTTPS:
        http = "httptools" if fast and installed("httptools") else "h11"
    return loop, http


def _stored_fast_setting(app: object) -> str | None:
    """The stored `server.fast_network` value (None when unset or unreadable: a start never fails on this read)."""
    from .db import get_setting

    try:
        with app.state.db.connection("read", label="startup.fast_network") as conn:  # type: ignore[attr-defined]
            return get_setting(conn, FAST_SETTING)
    except Exception:  # noqa: BLE001 - an unreadable setting means the default (asyncio + h11)
        return None


def describe_impl(loop: str, http: str, fast: bool, source: str, safe: bool) -> str:
    """The start-up log line: which loop / parser run and why."""
    why = ("safe mode after repeated native crashes" + (" (overrides the fast-network opt-in)" if fast else "")) if safe else (
        f"fast network component on ({source})" if fast else f"standard (fast network component off, {source})")
    return f"server: event loop {loop}, HTTP parser {http} - {why}"


def _enable_faulthandler() -> Path | None:
    """faulthandler to <data>/crash/faulthandler.log first thing, so even a crash during start-up leaves a traceback."""
    from . import crashguard

    return crashguard.enable_faulthandler(Path(os.environ.get("SW_DATA_DIR") or (Path.cwd() / "data")))


def _log_native(where: Path | None) -> None:
    """One log line naming the native libraries of this process (after create_app() configured logging)."""
    from . import crashguard

    log = logging.getLogger("smplwise.crashguard")
    try:
        versions = " ".join(f"{k}={v}" for k, v in crashguard.native_versions().items())
    except Exception as exc:  # noqa: BLE001 - a diagnostics line never stops the start
        versions = f"unavailable ({type(exc).__name__})"
    log.info("faulthandler on (%s); native: %s", "crash/faulthandler.log" if where else "stderr", versions)


def main() -> None:
    where = _enable_faulthandler()
    host = os.environ.get("SW_HOST", "127.0.0.1")
    port = int(os.environ.get("SW_PORT", "8099"))
    app = create_app()
    _log_native(where)
    fast, source = fast_network_wanted(os.environ, _stored_fast_setting(app))
    safe = os.environ.get("SW_SAFE_MODE") == "1"
    loop, http = server_impl(os.environ, fast=fast)
    log = logging.getLogger("smplwise.crashguard")
    (log.warning if safe else log.info)("%s", describe_impl(loop, http, fast, source, safe))
    warm_route_tables(app)  # the first operator request after a restart does not pay the framework's lazy route-table build
    uvicorn.run(app, host=host, port=port, log_level=os.environ.get("SW_LOG_LEVEL", "info").lower(), proxy_headers=False, loop=loop, http=http)

if __name__ == "__main__":
    main()
