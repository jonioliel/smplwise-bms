"""The "restart required" button of CR-022 section 8: restart this add-on through the infrastructure's API.

The whole outgoing surface is one call, `POST /addons/self/restart` (the add-on's default `hassio_api` role allows it; verified
in code, not on the owner's installation - AT-022-16). Nothing else can be sent from here. The token addresses the add-on as
`self`; no token, address or slug is stored or returned. Outside the add-on (a workstation, a test backend without a fake)
`configured` is False and the router answers 409 `restart_manual`: the service is restarted by hand.

CR-021's `self_update.call` is allow-listed to its own read-only S1 calls on purpose, so this module keeps its own single
allow-listed call instead of widening that list. Tests install `BASE_URL` / `TOKEN` / `TRANSPORT` (an httpx MockTransport)."""
from __future__ import annotations

import os

from ..config import Settings

DEFAULT_BASE = "http://supervisor"
PATH = "/addons/self/restart"
BASE_URL: str | None = None
TOKEN: str | None = None
TRANSPORT = None  # tests: an httpx.BaseTransport
TIMEOUT_S = 15.0


def _token() -> str | None:
    return TOKEN or os.environ.get("SUPERVISOR_TOKEN") or None


def configured(settings: Settings) -> bool:
    return bool(_token()) and (BASE_URL is not None or settings.in_addon)


def restart(settings: Settings) -> str:
    """`ok`, `forbidden`, `unreachable` or `error`. Never raises for a network or HTTP problem."""
    if not configured(settings):
        return "unreachable"
    import httpx

    try:
        with httpx.Client(transport=TRANSPORT, timeout=TIMEOUT_S, follow_redirects=False) as client:
            r = client.post((BASE_URL or DEFAULT_BASE).rstrip("/") + PATH, headers={"Authorization": f"Bearer {_token()}"})
    except httpx.HTTPError:
        return "unreachable"
    if r.status_code in (401, 403):
        return "forbidden"
    return "ok" if r.status_code < 300 else "error"
