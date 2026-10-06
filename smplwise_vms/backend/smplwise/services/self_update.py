"""Self-update (CR-021, docs/changes/CR-021-SELF-UPDATE.md): FIND a newer version of this add-on (S1), and the ONE door through which
Arx talks to the add-on infrastructure API (the Supervisor) for anything with an effect (S3).

S1 calls: `GET /addons/self/info` (installed / latest version, update flag; the default role) and `POST /store/reload` (the store refresh;
the `manager` role). S3 widens ALLOWED to the exact (method, path) pairs of the in-app update and the platform restart (CR-021 section 13,
owner answers of 2026-10-03):

  * `POST /store/addons/{slug}/update`  body exactly `{"backup": bool, "background": bool}`; `{slug}` is the add-on's own slug read from
                                        `GET /addons/self/info` and must match SLUG_RE (assumption to confirm in the lab: the store route
                                        does not resolve `self`, the Supervisor's self bypass excludes `update`)
  * `GET  /jobs/info`                   optional progress of the Supervisor job while Arx is still alive
  * `GET  /core/info`                   the platform version and state before / after a platform restart
  * `POST /core/check`                  the platform's configuration check; a failed check refuses the restart (owner answer 1)
  * `POST /core/restart`                body `{}`; the platform restart
  * `POST /addons/self/options`, `POST /addons/self/restart`   the two pre-existing calls of services/nvr_system.py and the Arx restart of
                                        CR-022 (services/addon_restart.py), routed through this list so manager power has exactly one door.
                                        The options body is `{"options": {...}}` with only the manifest's schema keys (OPTION_TYPES), each
                                        of its schema type.
  * `POST /discovery`                   body `{"service": "smplwise_bridge", "config": {addon_url, pairing_code}}` (services/ha_client.py);
                                        `GET /core/info` is also read by services/ha_user_auth.py (the core's port) - both through this door.

Security review of 2026-10-04: the update slug must equal the slug the infrastructure reported for THIS add-on (`GET /addons/self/info`,
remembered by `send`), so no other add-on (`core_ssh` ...) can ever be addressed; before that read no update call is possible.

Anything else raises ProbeRefused before a socket is opened: an unknown pair, a body on a call without one, a body key outside BODY_KEYS,
a non-boolean update flag, a slug that fails SLUG_RE. No request field ever reaches a path; redirects are never followed; an upstream body
is never echoed (only its class and HTTP status). No token, address or slug is stored or returned.

Network calls never run while a database connection is held (the callers read the settings first, call, then write). Tests install
`BASE_URL` (a local fake Supervisor, frontend/tests/fixtures/update_fake_supervisor.py), `TRANSPORT` (an httpx MockTransport) or
`UPDATE_FETCHER` (notify_sources' older seam).
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
TRANSPORT: Any = None            # tests: an httpx.BaseTransport
TIMEOUT_S = 8.0

P_INFO = "/addons/self/info"
P_RELOAD = "/store/reload"
P_UPDATE = "/store/addons/{slug}/update"
P_JOBS = "/jobs/info"
P_CORE_INFO = "/core/info"
P_CORE_CHECK = "/core/check"
P_CORE_RESTART = "/core/restart"
P_OPTIONS = "/addons/self/options"
P_SELF_RESTART = "/addons/self/restart"
P_DISCOVERY = "/discovery"

# The whole outgoing surface of the add-on towards its infrastructure. Anything else raises ProbeRefused before a socket is opened.
ALLOWED: frozenset[tuple[str, str]] = frozenset({
    ("GET", P_INFO), ("POST", P_RELOAD),                                     # S1
    ("POST", P_UPDATE), ("GET", P_JOBS),                                     # S3: the update
    ("GET", P_CORE_INFO), ("POST", P_CORE_CHECK), ("POST", P_CORE_RESTART),  # S3: the platform restart
    ("POST", P_OPTIONS), ("POST", P_SELF_RESTART),                           # pre-existing nvr_system calls / the CR-022 Arx restart
    ("POST", P_DISCOVERY),                                                   # the bridge announcement (services/ha_client.py)
})
# The calls that carry a JSON body, with the exact keys they may carry. Every other call sends no body.
BODY_KEYS: dict[tuple[str, str], frozenset[str]] = {
    ("POST", P_UPDATE): frozenset({"backup", "background"}),
    ("POST", P_CORE_RESTART): frozenset(),
    ("POST", P_OPTIONS): frozenset({"options"}),
    ("POST", P_DISCOVERY): frozenset({"service", "config"}),
}
SLUG_RE = re.compile(r"[a-z0-9_]{1,64}")
_SELF_SLUG: str | None = None    # the slug GET /addons/self/info last reported for this add-on (never stored, never returned)

# The add-on options (config.yaml `schema`); a test keeps this equal to the manifest. Kinds: str (required string), str? (string or
# null), port, bool, bool?, remote_path, log_level.
OPTION_TYPES: dict[str, str] = {
    "bootstrap_admin_username": "str", "nvr_host": "str?", "nvr_http_port": "port", "nvr_rtsp_port": "port", "nvr_username": "str?",
    "nvr_password": "str?", "go2rtc_url": "str?", "go2rtc_api_username": "str?", "go2rtc_api_password": "str?", "wiskey_username": "str?",
    "wiskey_password": "str?", "openai_api_key": "str?", "remote_access": "bool", "remote_path": "remote_path", "db_write_gate": "bool?",
    "log_level": "log_level",
    "push_relay_url": "str?", "push_relay_key": "str?",  # CR-027: the SmplWise push relay (config.py reads them into the environment)
    "frigate_enabled": "bool?",  # CR-029: the Frigate recorder type is selectable (run.sh maps it to SW_FRIGATE)
    "cast_relay": "bool?",  # CR-028: the cast relay's listener (18092/tcp, unmapped by default)
}
OPTION_STR_MAX = 1024
REMOTE_PATH_RE = re.compile(r"^/[a-z0-9][a-z0-9_-]{0,31}$")
LOG_LEVELS = ("debug", "info", "warning", "error")
DISCOVERY_SERVICES = frozenset({"smplwise_bridge"})   # config.yaml `discovery`
DISCOVERY_CONFIG_KEYS = frozenset({"addon_url", "pairing_code"})

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
    """`kind`: ok | forbidden | unreachable | dropped | error. `status` is the HTTP status of the infrastructure (0 when none); `data`
    the `data` object. `dropped` only for a call with an effect (POST): the request may have been received and acted upon but no answer
    arrived (the connection broke or the read timed out) - its outcome is UNKNOWN. A GET that breaks is `unreachable`."""
    kind: str
    status: int = 0
    data: dict[str, Any] | None = None


def configured(settings: Settings) -> bool:
    """True when this process can talk to an infrastructure API: a base URL was installed, or it runs in the add-on with its token."""
    return bool(_token()) and (BASE_URL is not None or settings.in_addon)


def _token() -> str | None:
    return TOKEN or os.environ.get("SUPERVISOR_TOKEN") or None


def _option_ok(kind: str, value: Any) -> bool:
    if kind in ("str", "str?", "remote_path"):
        if value is None:
            return kind == "str?"
        if not isinstance(value, str) or len(value) > OPTION_STR_MAX:
            return False
        return kind != "remote_path" or bool(REMOTE_PATH_RE.fullmatch(value))
    if kind == "port":
        return isinstance(value, int) and not isinstance(value, bool) and 1 <= value <= 65535
    if kind in ("bool", "bool?"):
        return isinstance(value, bool) or (kind == "bool?" and value is None)
    if kind == "log_level":
        return value in LOG_LEVELS
    return False


def _check_options(body: Any) -> None:
    options = body.get("options") if isinstance(body, dict) else None
    if not isinstance(options, dict):
        raise ProbeRefused("POST /addons/self/options: options")
    for key, value in options.items():
        kind = OPTION_TYPES.get(key) if isinstance(key, str) else None
        if kind is None or not _option_ok(kind, value):
            raise ProbeRefused(f"POST /addons/self/options: option {key!r}")


def _check_discovery(body: Any) -> None:
    config = body.get("config") if isinstance(body, dict) else None
    if (not isinstance(body, dict) or set(body) != BODY_KEYS[("POST", P_DISCOVERY)] or body.get("service") not in DISCOVERY_SERVICES
            or not isinstance(config, dict) or not set(config) <= DISCOVERY_CONFIG_KEYS
            or not all(isinstance(v, str) and len(v) <= OPTION_STR_MAX for v in config.values())):
        raise ProbeRefused("POST /discovery: body")


def remember_self(data: dict[str, Any] | None) -> None:
    """Keep the slug of THIS add-on as the infrastructure reported it (the only slug an update may address)."""
    global _SELF_SLUG
    slug = (data or {}).get("slug")
    _SELF_SLUG = slug if isinstance(slug, str) and SLUG_RE.fullmatch(slug) else None


def check_allowed(method: str, path: str, body: dict[str, Any] | None = None, slug: str | None = None) -> str:
    """The allow-list, the body shape and the slug, checked BEFORE anything is opened. Returns the concrete path."""
    if (method, path) not in ALLOWED:
        raise ProbeRefused(f"{method} {path}")
    keys = BODY_KEYS.get((method, path))
    if body is not None:
        if keys is None or not isinstance(body, dict) or not set(body) <= keys:
            raise ProbeRefused(f"{method} {path}: body")
        if path == P_UPDATE and (set(body) != keys or not all(isinstance(v, bool) for v in body.values())):
            raise ProbeRefused(f"{method} {path}: body values")
    elif path in (P_UPDATE, P_OPTIONS, P_DISCOVERY):
        raise ProbeRefused(f"{method} {path}: this call always carries its body")
    if path == P_OPTIONS:
        _check_options(body)
    if path == P_DISCOVERY:
        _check_discovery(body)
    if "{slug}" in path:
        if not isinstance(slug, str) or not SLUG_RE.fullmatch(slug):
            raise ProbeRefused(f"{method} {path}: slug")
        if slug != _SELF_SLUG:
            raise ProbeRefused(f"{method} {path}: not this add-on")
        return path.replace("{slug}", slug)
    if slug is not None:
        raise ProbeRefused(f"{method} {path}: slug")
    return path


def send(method: str, path: str, *, base: str, token: str, transport: Any = None, body: dict[str, Any] | None = None, slug: str | None = None,
         timeout: float | None = None) -> Reply:
    """The single place a request to the infrastructure is made. `path` is an ALLOWED template. Never raises for a network or HTTP problem."""
    concrete = check_allowed(method, path, body, slug)
    import httpx

    try:
        with httpx.Client(transport=transport, timeout=timeout or TIMEOUT_S, follow_redirects=False) as client:
            r = client.request(method, base.rstrip("/") + concrete, headers={"Authorization": f"Bearer {token}"}, json=body)
    except (httpx.ConnectError, httpx.ConnectTimeout, httpx.UnsupportedProtocol, httpx.InvalidURL):
        return Reply("unreachable")   # nothing reached the other side
    except httpx.HTTPError:
        return Reply("unreachable" if method == "GET" else "dropped")
    if r.status_code in (401, 403):
        return Reply("forbidden", r.status_code)
    if not 200 <= r.status_code < 300:
        return Reply("error", r.status_code)
    try:
        payload = r.json()
    except ValueError:
        return Reply("error", r.status_code) if method == "GET" else Reply("ok", r.status_code, {})
    data = payload.get("data") if isinstance(payload, dict) else None
    data = data if isinstance(data, dict) else {}
    if (method, path) == ("GET", P_INFO):
        remember_self(data)
    return Reply("ok", r.status_code, data)


def call(settings: Settings, method: str, path: str, *, body: dict[str, Any] | None = None, slug: str | None = None, timeout: float | None = None) -> Reply:
    """One allow-listed request with this module's seams (BASE_URL / TOKEN / TRANSPORT)."""
    check_allowed(method, path, body, slug)
    if not configured(settings):
        return Reply("unreachable")
    return send(method, path, base=BASE_URL or DEFAULT_BASE, token=_token() or "", transport=TRANSPORT, body=body, slug=slug, timeout=timeout)


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
    run = conn.execute("SELECT id, state, step, created_at, finished_at, from_version, to_version, error_code, restart_platform FROM update_runs WHERE state NOT IN ('succeeded', 'failed', 'abandoned') ORDER BY created_at DESC LIMIT 1").fetchone()
    from . import platform_restart  # S3: the "restart required" row of Settings and the user-menu dot (owner answer 7)

    reasons = platform_restart.reasons(conn)
    run_out = None
    if run:
        run_out = {k: run[k] for k in run.keys() if k != "restart_platform"}
        run_out["kind"] = "platform_restart" if run["restart_platform"] else "update"
    return {
        "installed": installed, "latest": latest or None, "update_available": available,
        "checked_at": get_setting(conn, K_CHECKED_AT) or None, "check_result": get_setting(conn, K_RESULT) or None,
        "interval_hours": get_interval(conn), "permitted": permitted if permitted in ("unknown", "yes", "no") else "unknown",
        "notes": [],  # release notes arrive with S4 (CR-021 section 4 point 3)
        "requires_platform_restart": bool(reasons), "platform_restart_reasons": reasons,
        "run": run_out,
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
