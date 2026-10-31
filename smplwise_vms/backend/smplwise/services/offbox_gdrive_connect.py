"""GDRIVEBK-2310: connecting a `gdrive` off-box target to the owner's Google account (the OAuth 2.0 device authorization grant).

1. start: the target's client id (configuration) and client secret (sealed) go to Google's device endpoint with the `drive.file` scope.
   The screen gets the short user code and google.com/device; the device code stays HERE, in process memory only (`_PENDING`), until
   the grant ends - never stored, returned, logged or audited.
2. poll (the screen calls it every `interval` seconds): pending / slow_down (the interval grows by 5 s) / denied / expired /
   connected. On `connected` the refresh token is sealed at once into backup_offbox_secrets (field `refresh_token`, the installation
   key) and forgotten here. A restart of the add-on drops a pending grant: the administrator presses "connect" again.
3. disconnect: Google is asked to revoke the refresh token (best effort), the sealed token is deleted and the target is switched off.

Database work never spans a call to Google: the configuration and the secret lookup are read first, the request runs with no
transaction open, the token is written in a short write afterwards. Tests inject the HTTP client (offbox_runtime.GDRIVE_HTTP) in
front of tests/fake_gdrive.py; no test reaches Google."""
from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

from ..config import Settings
from ..db import Database
from . import offbox_gdrive, offbox_runtime, offbox_store
from .backup_offbox import CredentialRef, OffboxError

log = logging.getLogger("smplwise.backup.gdrive")

_LOCK = threading.Lock()
CLOCK: Callable[[], float] = time.monotonic


@dataclass
class _Pending:
    auth: offbox_gdrive.DeviceAuthorization
    client_id: str
    expires_at: float
    interval: int
    next_poll_at: float


_PENDING: dict[str, _Pending] = {}


def _http() -> Any:
    return (offbox_runtime.GDRIVE_HTTP or offbox_gdrive.default_http)()


def _client(db: Database, settings: Settings, target_id: str) -> tuple[str, str]:
    """(client id, client secret) of a gdrive target; OffboxError when it is not one or they are not configured."""
    target, lookup = offbox_runtime._load(db, settings, target_id)
    if target["kind"] != "gdrive":
        raise OffboxError("destination_invalid", "not a Google Drive target")
    cfg = offbox_gdrive.config_values(target["config"])
    if not cfg["client_id"]:
        raise OffboxError("gdrive_client_missing", "no Google client id is configured")
    try:
        secret = CredentialRef(offbox_store.store_ref(target_id, "client_secret")).resolve(lookup)
    except OffboxError:
        raise OffboxError("gdrive_client_missing", "the Google client secret is not configured") from None
    return cfg["client_id"], secret


def pending(target_id: str) -> bool:
    with _LOCK:
        p = _PENDING.get(target_id)
        return bool(p and CLOCK() < p.expires_at)


def start(db: Database, settings: Settings, target_id: str) -> dict[str, Any]:
    """Ask Google for a device code. Returns what the screen shows: user_code, verification_url, expires_in, interval."""
    client_id, secret = _client(db, settings, target_id)
    http = _http()
    try:
        auth = offbox_gdrive.DeviceCodeFlow(http).start(client_id, secret)
    finally:
        http.close()
    now = CLOCK()
    with _LOCK:
        _PENDING[target_id] = _Pending(auth, client_id, now + auth.expires_in, auth.interval, now)
    return {"user_code": auth.user_code, "verification_url": auth.verification_url, "expires_in": auth.expires_in, "interval": auth.interval}


def poll(db: Database, settings: Settings, target_id: str, actor: str | None) -> dict[str, Any]:
    """One poll of the pending grant: {state, interval?}. state: none | pending | slow_down | denied | expired | connected."""
    now = CLOCK()
    with _LOCK:
        p = _PENDING.get(target_id)
        if p is None:
            return {"state": "none"}
        if now >= p.expires_at:
            _PENDING.pop(target_id, None)
            return {"state": "expired"}
        if now < p.next_poll_at:  # the screen polled too early: Google would answer slow_down, so do not ask it
            return {"state": "pending", "interval": p.interval}
        p.next_poll_at = now + p.interval
    client_id, secret = _client(db, settings, target_id)
    if client_id != p.client_id:  # the client changed while the grant was pending
        with _LOCK:
            _PENDING.pop(target_id, None)
        return {"state": "expired"}
    http = _http()
    try:
        res = offbox_gdrive.DeviceCodeFlow(http).poll(client_id, secret, p.auth)
    except OffboxError:
        with _LOCK:
            _PENDING.pop(target_id, None)
        raise
    finally:
        http.close()
    if res.state == "slow_down":
        with _LOCK:
            p.interval = min(60, p.interval + 5)
            p.next_poll_at = CLOCK() + p.interval
        return {"state": "slow_down", "interval": p.interval}
    if res.state == "pending":
        return {"state": "pending", "interval": p.interval}
    with _LOCK:
        _PENDING.pop(target_id, None)
    if res.state != "connected" or not res.refresh_token:
        return {"state": res.state}
    with db.write_aside(label="offbox.gdrive.connect") as conn:
        offbox_store.set_secret(conn, Path(settings.data_dir), target_id, "refresh_token", res.refresh_token, actor)
    log.info("Google Drive account connected to off-box target %s", target_id)
    return {"state": "connected"}


def cancel(target_id: str) -> bool:
    with _LOCK:
        return _PENDING.pop(target_id, None) is not None


def disconnect(db: Database, settings: Settings, target_id: str, actor: str | None) -> dict[str, Any]:
    """Revoke at Google (best effort), delete the sealed refresh token, switch the target off. {had_token, revoked: bool | None}."""
    cancel(target_id)
    target, lookup = offbox_runtime._load(db, settings, target_id)
    if target["kind"] != "gdrive":
        raise OffboxError("destination_invalid", "not a Google Drive target")
    token = lookup(f"offbox.{target_id}.refresh_token")
    revoked: bool | None = None
    if token:
        http = _http()
        try:
            revoked = offbox_gdrive.revoke(http, token)
        finally:
            http.close()
    with db.write_aside(label="offbox.gdrive.disconnect") as conn:
        offbox_store.clear_secret(conn, target_id, "refresh_token")
        offbox_store.set_enabled(conn, target_id, False, actor)
    return {"had_token": bool(token), "revoked": revoked}
