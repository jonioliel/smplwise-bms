"""The shared restart helper of the "הפעלות מחדש" card (CR-021 S3 owner answer 9; CR-022 section 8): restart Arx itself, or restart
the platform core.

* `restart(settings)` - CR-022's Arx restart, `POST /addons/self/restart` (the add-on's default `hassio_api` role allows it). Public names
  and behaviour are those of the CR-022 helper on `pilot/nn4-backend` (`DEFAULT_BASE`, `PATH`, `BASE_URL`, `TOKEN`, `TRANSPORT`,
  `configured`, `restart` -> ok | forbidden | unreachable | error), so either branch merges onto the other without a caller change.
* `platform_info` / `check_platform_config` / `restart_platform` - CR-021 S3: `GET /core/info`, `POST /core/check` (the configuration
  check that must pass before a restart, owner answer 1) and `POST /core/restart` (the `manager` role). They return the full
  `self_update.Reply`, so the run worker can tell a refusal from an UNKNOWN outcome (`dropped`).

Every request is sent by `self_update.send`, i.e. through the single allow-list of the add-on's infrastructure calls; this module holds
no URL of its own beyond the default base. The token addresses the add-on as `self`; no token, address or slug is stored or returned.
Outside the add-on (a workstation, a test backend without a fake) `configured` is False: the CR-022 router answers 409 `restart_manual`
and the S3 routes 503 `infrastructure_unreachable`.

Seams: this module's `BASE_URL` / `TOKEN` / `TRANSPORT` when set, else those of `self_update` (so a test that installs the fake Supervisor
on `self_update` drives both buttons)."""
from __future__ import annotations

import os
from typing import Any

from ..config import Settings
from . import self_update

DEFAULT_BASE = self_update.DEFAULT_BASE
PATH = self_update.P_SELF_RESTART
BASE_URL: str | None = None
TOKEN: str | None = None
TRANSPORT: Any = None  # tests: an httpx.BaseTransport
TIMEOUT_S = 15.0
CORE_CHECK_TIMEOUT_S = 120.0   # the configuration check loads every integration's schema: slow on a small device (lab measures)
CORE_RESTART_TIMEOUT_S = 30.0  # the Supervisor may hold the answer until the core is back: a read timeout is an UNKNOWN outcome, then polled


def _base() -> str | None:
    return BASE_URL if BASE_URL is not None else self_update.BASE_URL


def _token() -> str | None:
    return TOKEN or self_update.TOKEN or os.environ.get("SUPERVISOR_TOKEN") or None


def _transport() -> Any:
    return TRANSPORT if TRANSPORT is not None else self_update.TRANSPORT


def configured(settings: Settings) -> bool:
    return bool(_token()) and (_base() is not None or settings.in_addon)


def _send(settings: Settings, method: str, path: str, *, body: dict[str, Any] | None = None, timeout: float = TIMEOUT_S) -> self_update.Reply:
    self_update.check_allowed(method, path, body)  # refused before anything else, configured or not
    if not configured(settings):
        return self_update.Reply("unreachable")
    return self_update.send(method, path, base=_base() or DEFAULT_BASE, token=_token() or "", transport=_transport(), body=body, timeout=timeout)


def restart(settings: Settings) -> str:
    """CR-022: restart this add-on. `ok`, `forbidden`, `unreachable` or `error`. Never raises for a network or HTTP problem.
    A connection that breaks after the request was sent counts as `ok`: the add-on is going down."""
    r = _send(settings, "POST", PATH)
    return "ok" if r.kind == "dropped" else r.kind


def platform_info(settings: Settings) -> self_update.Reply:
    return _send(settings, "GET", self_update.P_CORE_INFO)


def check_platform_config(settings: Settings) -> self_update.Reply:
    return _send(settings, "POST", self_update.P_CORE_CHECK, timeout=CORE_CHECK_TIMEOUT_S)


def restart_platform(settings: Settings) -> self_update.Reply:
    return _send(settings, "POST", self_update.P_CORE_RESTART, body={}, timeout=CORE_RESTART_TIMEOUT_S)
