"""Self-update, slice S1 (CR-021, docs/changes/CR-021-SELF-UPDATE.md): FIND a newer version of this add-on, remember the result and the settings.

S1 is read-mostly. The only calls made to the infrastructure (the add-on Supervisor) are

  * `GET  /addons/self/info`   the installed version, the latest version, the update flag (works with the add-on's default role), and
  * `POST /store/reload`       the same refresh as the refresh button of the add-on store (needs the `manager` role; CR-021 owner decision D1).

Both are in ALLOWED below and nothing else can be sent: apply / platform restart / backup are S3 and are not reachable from this module.
The check results are rows of the existing `settings` table (`update.*`); no token, address or add-on slug is ever stored or returned - the
token addresses the add-on as `self`.

Network calls never run while a database connection is held (the callers read the settings first, call, then write). Tests install
`BASE_URL` (a local fake Supervisor, tests/update_fake_supervisor.py) or `UPDATE_FETCHER` (notify_sources' older seam).
"""
from __future__ import annotations

import datetime as dt
import math
import os
import re
import sqlite3
import threading
import time
from dataclasses import dataclass
from typing import Any

from .. import __version__
from ..config import Settings
from ..db import get_setting, set_setting
from .timeutil import iso_utc

DEFAULT_BASE = "http://supervisor"
BASE_URL: str | None = None      # tests / a developer: a local fake Supervisor (then no `in_addon` is needed)
TOKEN: str | None = None         # tests: a stand-in for SUPERVISOR_TOKEN
TIMEOUT_S = 8.0

# The whole outgoing surface of this slice. Anything else raises ProbeRefused before a socket is opened.
ALLOWED: frozenset[tuple[str, str]] = frozenset({("GET", "/addons/self/info"), ("POST", "/store/reload")})

VERSION_RE = re.compile(r"[0-9A-Za-z._+-]{1,40}")
INTERVALS = (0, 1, 3, 6, 12, 24)   # hours; 0 = off (CR-021 section 5.1)
DEFAULT_INTERVAL_H = 6             # owner decision D3

K_INTERVAL = "update.interval_hours"
K_CHECKED_AT = "update.checked_at"
K_RESULT = "update.check_result"
K_LATEST = "update.latest"
K_AVAILABLE = "update.available"
K_PERMITTED = "update.permitted"   # unknown | yes | no

RESULTS = ("current", "available", "refresh_failed_read_ok", "unreachable", "not_permitted", "error")

CHECK_MIN_GAP_S = 30.0
CHECK_PER_HOUR = 20


class ProbeRefused(Exception):
    """A call outside ALLOWED was attempted (a programming error, never a user error)."""


@dataclass(frozen=True)
class Reply:
    """`kind`: ok | forbidden | unreachable | error. `status` is the HTTP status of the infrastructure (0 when none); `data` the `data` object."""
    kind: str
    status: int = 0
    data: dict[str, Any] | None = None


def configured(settings: Settings) -> bool:
    """True when this process can talk to an infrastructure API: a base URL was installed, or it runs in the add-on with its token."""
    return bool(_token()) and (BASE_URL is not None or settings.in_addon)


def _token() -> str | None:
    return TOKEN or os.environ.get("SUPERVISOR_TOKEN") or None


def call(settings: Settings, method: str, path: str) -> Reply:
    """One allow-listed request. Never raises for a network or HTTP problem; the reply says which kind it was. No body, no query."""
    if (method, path) not in ALLOWED:
        raise ProbeRefused(f"{method} {path}")
    if not configured(settings):
        return Reply("unreachable")
    import httpx

    try:
        r = httpx.request(method, (BASE_URL or DEFAULT_BASE).rstrip("/") + path, headers={"Authorization": f"Bearer {_token()}"}, timeout=TIMEOUT_S)
    except httpx.HTTPError:
        return Reply("unreachable")
    if r.status_code in (401, 403):
        return Reply("forbidden", r.status_code)
    if r.status_code != 200:
        return Reply("error", r.status_code)
    try:
        body = r.json()
    except ValueError:
        return Reply("error", r.status_code)
    data = body.get("data") if isinstance(body, dict) else None
    return Reply("ok", 200, data if isinstance(data, dict) else {})


@dataclass(frozen=True)
class Info:
    installed: str
    latest: str
    update_available: bool


def parse_info(data: dict[str, Any]) -> Info | None:
    """Versions come only from the infrastructure's answer and only when they look like versions."""
    installed, latest = str(data.get("version") or ""), str(data.get("version_latest") or "")
    if not VERSION_RE.fullmatch(latest):
        return None
    if not VERSION_RE.fullmatch(installed):
        installed = __version__
    return Info(installed, latest, bool(data.get("update_available")) and latest != installed)


# ---------------------------------------------------------------- the check

@dataclass
class CheckOutcome:
    result: str                  # one of RESULTS
    refreshed: bool = False
    info: Info | None = None
    upstream_status: int = 0
    refresh_forbidden: bool = False


def run_check(settings: Settings, refresh: bool) -> CheckOutcome:
    """Store reload first (when `refresh`), then read. No database connection may be held by the caller."""
    refreshed, refresh_forbidden = False, False
    if refresh:
        rr = call(settings, "POST", "/store/reload")
        refreshed = rr.kind == "ok"
        refresh_forbidden = rr.kind == "forbidden"
    rd = call(settings, "GET", "/addons/self/info")
    if rd.kind != "ok":
        if rd.kind == "forbidden":
            return CheckOutcome("not_permitted", refreshed, None, rd.status)
        return CheckOutcome("unreachable" if rd.kind == "unreachable" else "error", refreshed, None, rd.status)
    info = parse_info(rd.data or {})
    if info is None:
        return CheckOutcome("error", refreshed, None, rd.status)
    if refresh and not refreshed:
        result = "refresh_failed_read_ok"
    else:
        result = "available" if info.update_available else "current"
    return CheckOutcome(result, refreshed, info, 200, refresh_forbidden)


def record(conn: sqlite3.Connection, out: CheckOutcome, now: dt.datetime, refresh: bool) -> None:
    """Persist a check. The permitted flag is learnt only from a refresh attempt (the one call that needs the `manager` role)."""
    set_setting(conn, K_CHECKED_AT, iso_utc(now))
    set_setting(conn, K_RESULT, out.result)
    if out.info is not None:
        set_setting(conn, K_LATEST, out.info.latest)
        set_setting(conn, K_AVAILABLE, "true" if out.info.update_available else "false")
    if refresh:
        if out.refreshed:
            set_setting(conn, K_PERMITTED, "yes")
        elif out.refresh_forbidden:
            set_setting(conn, K_PERMITTED, "no")


def get_interval(conn: sqlite3.Connection) -> int:
    try:
        v = int(get_setting(conn, K_INTERVAL, str(DEFAULT_INTERVAL_H)) or DEFAULT_INTERVAL_H)
    except ValueError:
        return DEFAULT_INTERVAL_H
    return v if v in INTERVALS else DEFAULT_INTERVAL_H


def set_interval(conn: sqlite3.Connection, hours: int) -> None:
    if hours not in INTERVALS:
        raise ValueError("interval_hours")
    set_setting(conn, K_INTERVAL, str(hours))


def view(conn: sqlite3.Connection) -> dict[str, Any]:
    """The page data for a holder of `system.update`. `installed` is the running version; the flag is recomputed against it, so a
    stale 'available' of an older check disappears the moment the new version runs."""
    installed = __version__
    latest = get_setting(conn, K_LATEST, "") or ""
    available = get_setting(conn, K_AVAILABLE, "false") == "true" and bool(latest) and latest != installed
    permitted = get_setting(conn, K_PERMITTED, "unknown")
    run = conn.execute("SELECT id, state, step, created_at, finished_at, from_version, to_version, error_code FROM update_runs WHERE state NOT IN ('succeeded', 'failed', 'abandoned') ORDER BY created_at DESC LIMIT 1").fetchone()
    return {
        "installed": installed, "latest": latest or None, "update_available": available,
        "checked_at": get_setting(conn, K_CHECKED_AT) or None, "check_result": get_setting(conn, K_RESULT) or None,
        "interval_hours": get_interval(conn), "permitted": permitted if permitted in ("unknown", "yes", "no") else "unknown",
        "notes": [], "requires_platform_restart": False,  # release notes arrive with S2/S4 (CR-021 section 4 point 3)
        "run": dict(run) if run else None,
    }


# ---------------------------------------------------------------- rate limit of the manual check (per installation)

_LOCK = threading.Lock()
_CHECKS: list[float] = []
_mono = time.monotonic


def take_check() -> tuple[bool, int]:
    """1 per 30 s and 20 per hour. Returns (allowed, seconds to wait)."""
    with _LOCK:
        now = _mono()
        _CHECKS[:] = [t for t in _CHECKS if now - t < 3600.0]
        if _CHECKS and now - _CHECKS[-1] < CHECK_MIN_GAP_S:
            return False, math.ceil(CHECK_MIN_GAP_S - (now - _CHECKS[-1]))
        if len(_CHECKS) >= CHECK_PER_HOUR:
            return False, math.ceil(3600.0 - (now - _CHECKS[0]))
        _CHECKS.append(now)
        return True, 0


def reset_limits() -> None:
    with _LOCK:
        _CHECKS.clear()
