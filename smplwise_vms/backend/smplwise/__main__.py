"""`python -m smplwise` — run the API (uvicorn). Inside the add-on run.sh starts it through the crash guard
(`python3 -m smplwise.crashguard`), which restarts it after a native crash (SEGFAULT-PLAYBACK-2332)."""
from __future__ import annotations

import logging
import os
from pathlib import Path

import uvicorn

from .main import create_app, warm_route_tables

LOOPS = ("auto", "asyncio", "uvloop")
HTTPS = ("auto", "h11", "httptools")


def server_impl(env: dict[str, str] | None = None) -> tuple[str, str]:
    """The uvicorn event loop and HTTP parser: `auto` (uvloop + httptools when installed) unless the crash guard's safe mode set
    SW_UVICORN_LOOP / SW_UVICORN_HTTP; an unknown value falls back to `auto`."""
    env = os.environ if env is None else env
    loop = (env.get("SW_UVICORN_LOOP") or "auto").strip().lower()
    http = (env.get("SW_UVICORN_HTTP") or "auto").strip().lower()
    return (loop if loop in LOOPS else "auto"), (http if http in HTTPS else "auto")


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
    loop, http = server_impl()
    app = create_app()
    _log_native(where)
    if os.environ.get("SW_SAFE_MODE") == "1":
        logging.getLogger("smplwise.crashguard").warning("safe mode after repeated native crashes: event loop %s, HTTP parser %s", loop, http)
    warm_route_tables(app)  # the first operator request after a restart does not pay the framework's lazy route-table build
    uvicorn.run(app, host=host, port=port, log_level=os.environ.get("SW_LOG_LEVEL", "info").lower(), proxy_headers=False, loop=loop, http=http)


if __name__ == "__main__":
    main()
