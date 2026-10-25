"""GDRIVEBK-295 (scaffold, OFF by default): the Google Drive backup destination's settings, sealed tokens and runs.

Design: docs/design/GDRIVE_BACKUP.md. No migration:
- settings (the `settings` table): `backup.gdrive.config` - the switch and every threshold / retention value, validated by
  `GDriveSettingsIn`; `backup.gdrive.state` - the folder id, who connected and when, the last test / push outcome (codes only).
  Both are `backup.SETTINGS_KEEP_PREFIXES` (`backup.gdrive.`): never written to an archive, never taken from one.
- secrets (the `app_secrets` table of the in-app secrets store, migration 0093): `gdrive_refresh_token` and the optional
  `gdrive_client_secret`, each sealed with the installation key (connection_store.seal_app_secret; associated data names the
  secret). They are not `secrets_store.SPECS` entries on purpose: the Secrets screen does not offer them for typing - the refresh
  token only ever arrives from the consent flow. Not a backup table; never returned, logged or audited.

One transfer at a time across ALL off-box destinations (offbox_runtime._LOCK). The network never runs inside a transaction: the
settings and the sealed tokens are read first, the transfer runs, the state is written afterwards with `write_aside`.

Not wired yet (open items in the design): the push after the daily backup (offbox_runtime.after_backup) and the
`backup.offbox_failed` alert for this destination; the real consent flow (`OAUTH_FLOW`, TODO(GDRIVEBK-OAUTH))."""
from __future__ import annotations

import json
import logging
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any, Callable, Literal

import httpx
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from ..config import Settings
from ..db import Database, get_setting, now_iso, set_setting
from . import offbox_keys
from .backup_offbox import CredentialRef, OffboxError, RetentionPolicy, check_connection, push
from .connection_store import SecretError, open_app_secret, seal_app_secret
from .offbox_gdrive import (CLIENT_ID_RE, FOLDER_NAME_RE, GRANULE, SCOPE, DeviceAuthorization, GDriveDestination, NotImplementedFlow,
                            OAuthFlow, RefreshTokenSource, RetryPolicy, revoke)

log = logging.getLogger("smplwise.backup.gdrive")

CONFIG_KEY = "backup.gdrive.config"
STATE_KEY = "backup.gdrive.state"
REFRESH_SECRET = "gdrive_refresh_token"
CLIENT_SECRET = "gdrive_client_secret"
MIB = 1024 * 1024

# seams: tests inject a fake Drive (httpx.MockTransport) and a fake consent flow; production keeps None / NotImplementedFlow
HTTP_TRANSPORT: httpx.BaseTransport | None = None
OAUTH_FLOW: OAuthFlow = NotImplementedFlow()
SLEEP: Callable[[float], None] = time.sleep

_PENDING: dict[str, Any] = {}  # the one pending device authorization (in memory only: the device_code is never persisted)
_PENDING_LOCK = threading.Lock()


def _lock() -> threading.Lock:
    from . import offbox_runtime

    return offbox_runtime._LOCK


def offbox_runtime_workdir(settings: Settings) -> Path:
    from . import offbox_runtime

    return offbox_runtime.workdir(settings)


# ---------------------------------------------------------------- settings (every threshold editable, OFF by default)


class RetentionIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    keep_last: int = Field(default=3, ge=1, le=1000)
    keep_daily: int = Field(default=14, ge=0, le=1000)
    keep_weekly: int = Field(default=4, ge=0, le=1000)
    keep_monthly: int = Field(default=6, ge=0, le=1000)


class GDriveSettingsIn(BaseModel):
    """The whole configuration; a PUT replaces it. Defaults = the shipped values; `enabled` is False until an administrator turns it on."""

    model_config = ConfigDict(extra="forbid")
    enabled: bool = False
    client_id: str = Field(default="", max_length=200)          # the OAuth client of the owner's Google Cloud project (not a secret)
    folder_name: str = Field(default="SmplWise Arx backups", min_length=1, max_length=100)
    retention: RetentionIn = Field(default_factory=RetentionIn)
    verify: Literal["deep", "hash"] = "deep"
    prune_mode: Literal["delete", "trash"] = "delete"
    chunk_mib: int = Field(default=8, ge=1, le=64)               # resumable chunk (a multiple of 256 KiB by construction)
    simple_upload_max_mib: int = Field(default=5, ge=1, le=5)    # above it: resumable upload
    max_retries: int = Field(default=5, ge=0, le=10)
    retry_base_ms: int = Field(default=500, ge=50, le=60000)
    retry_max_ms: int = Field(default=32000, ge=100, le=600000)
    request_timeout_s: int = Field(default=60, ge=5, le=600)
    quota_margin_pct: int = Field(default=10, ge=0, le=100)      # headroom over the copy's size required before an upload
    min_free_mib: int = Field(default=100, ge=0, le=1_000_000)   # and this much left free afterwards

    @field_validator("client_id")
    @classmethod
    def _client_id(cls, v: str) -> str:
        v = v.strip()
        if v and not CLIENT_ID_RE.fullmatch(v):
            raise ValueError("client_id must look like <digits>-<id>.apps.googleusercontent.com")
        return v

    @field_validator("folder_name")
    @classmethod
    def _folder(cls, v: str) -> str:
        v = v.strip()
        if not FOLDER_NAME_RE.fullmatch(v):
            raise ValueError("folder_name: 1-100 characters, no quote, backslash or control character")
        return v

    @field_validator("retry_max_ms")
    @classmethod
    def _retry_max(cls, v: int, info: Any) -> int:
        base = (info.data or {}).get("retry_base_ms", 500)
        if v < base:
            raise ValueError("retry_max_ms must be at least retry_base_ms")
        return v


DEFAULTS = GDriveSettingsIn()


def load_settings(conn: sqlite3.Connection) -> GDriveSettingsIn:
    """The stored configuration, or the defaults. A stored value that no longer validates fails CLOSED (defaults: disabled)."""
    raw = get_setting(conn, CONFIG_KEY)
    if not raw:
        return DEFAULTS
    try:
        return GDriveSettingsIn.model_validate(json.loads(raw))
    except (ValueError, ValidationError):
        log.warning("the stored Google Drive backup settings are not valid; using the defaults (disabled)")
        return DEFAULTS


def save_settings(conn: sqlite3.Connection, cfg: GDriveSettingsIn) -> None:
    set_setting(conn, CONFIG_KEY, cfg.model_dump_json())


def load_state(conn: sqlite3.Connection) -> dict[str, Any]:
    try:
        v = json.loads(get_setting(conn, STATE_KEY) or "{}")
    except ValueError:
        v = {}
    return v if isinstance(v, dict) else {}


def _patch_state(conn: sqlite3.Connection, **patch: Any) -> dict[str, Any]:
    st = {**load_state(conn), **patch}
    st = {k: v for k, v in st.items() if v is not None}
    set_setting(conn, STATE_KEY, json.dumps(st, sort_keys=True))
    return st


def _write_state(db: Database, **patch: Any) -> None:
    try:
        with db.write_aside(label="gdrive.state") as conn:
            _patch_state(conn, **patch)
    except Exception:  # noqa: BLE001 - recording an outcome never fails the transfer's answer
        log.warning("Google Drive backup state could not be recorded", exc_info=True)


# ---------------------------------------------------------------- sealed secrets (app_secrets rows; never returned)


def _secret_row(conn: sqlite3.Connection, name: str) -> str | None:
    try:
        r = conn.execute("SELECT value_enc FROM app_secrets WHERE name = ?", (name,)).fetchone()
    except sqlite3.OperationalError:
        return None
    return r[0] if r and r[0] else None


def set_secret(conn: sqlite3.Connection, data_dir: Path, name: str, value: str, actor: str | None) -> None:
    if name not in (REFRESH_SECRET, CLIENT_SECRET) or not isinstance(value, str) or not value or len(value) > 4096:
        raise OffboxError("secret_invalid", "not a Google Drive secret")
    try:
        blob = seal_app_secret(Path(data_dir), name, value)  # sealed BEFORE anything is written
    except SecretError:
        raise OffboxError("secret_store_unavailable", "the installation key is not available") from None
    conn.execute("INSERT INTO app_secrets(name, value_enc, source, updated_at, updated_by) VALUES (?, ?, 'ui', ?, ?) "
                 "ON CONFLICT(name) DO UPDATE SET value_enc = excluded.value_enc, source = excluded.source, "
                 "updated_at = excluded.updated_at, updated_by = excluded.updated_by", (name, blob, now_iso(), actor))


def clear_secret(conn: sqlite3.Connection, name: str) -> bool:
    try:
        return conn.execute("DELETE FROM app_secrets WHERE name = ?", (name,)).rowcount > 0
    except sqlite3.OperationalError:
        return False


def secret_lookup(conn: sqlite3.Connection, data_dir: Path) -> Callable[[str], str | None]:
    """The resolver of `store:gdrive.<name>` references; the blobs are read now and opened only when the transport connects."""
    blobs = {n: _secret_row(conn, n) for n in (REFRESH_SECRET, CLIENT_SECRET)}

    def lookup(ref: str) -> str | None:
        name = {"gdrive.refresh_token": REFRESH_SECRET, "gdrive.client_secret": CLIENT_SECRET}.get(ref)
        blob = blobs.get(name) if name else None
        if not blob:
            return None
        try:
            return open_app_secret(Path(data_dir), name, blob)
        except SecretError:
            return None  # an unreadable blob is "not connected" (fail closed)

    return lookup


def connected(conn: sqlite3.Connection, data_dir: Path) -> bool:
    return secret_lookup(conn, data_dir)("gdrive.refresh_token") is not None


# ---------------------------------------------------------------- the destination


def http_client(cfg: GDriveSettingsIn) -> httpx.Client:
    return httpx.Client(transport=HTTP_TRANSPORT, timeout=httpx.Timeout(float(cfg.request_timeout_s), connect=20.0), follow_redirects=False)


def build(cfg: GDriveSettingsIn, state: dict[str, Any], lookup: Callable[[str], str | None], http: httpx.Client) -> GDriveDestination:
    if lookup("gdrive.refresh_token") is None:
        raise OffboxError("gdrive_not_connected", "no Google account is connected")
    tokens = RefreshTokenSource(cfg.client_id, CredentialRef("store:gdrive.refresh_token"), http,
                                client_secret=CredentialRef("store:gdrive.client_secret") if lookup("gdrive.client_secret") else None,
                                secret_store=lookup)
    chunk = max(GRANULE, (cfg.chunk_mib * MIB) // GRANULE * GRANULE)
    return GDriveDestination(tokens, http, folder_name=cfg.folder_name, folder_id=state.get("folder_id"), chunk_bytes=chunk,
                             simple_max_bytes=cfg.simple_upload_max_mib * MIB,
                             retry=RetryPolicy(cfg.max_retries, cfg.retry_base_ms, cfg.retry_max_ms),
                             quota_margin_pct=cfg.quota_margin_pct, min_free_bytes=cfg.min_free_mib * MIB, prune_mode=cfg.prune_mode,
                             sleep=SLEEP)


def _load(db: Database, settings: Settings, *, require_enabled: bool = True) -> tuple[GDriveSettingsIn, dict[str, Any], Callable[[str], str | None]]:
    with db.connection(mode="read", label="gdrive.load") as conn:
        cfg, state = load_settings(conn), load_state(conn)
        lookup = secret_lookup(conn, Path(settings.data_dir))
    if require_enabled and not cfg.enabled:
        raise OffboxError("gdrive_disabled", "the Google Drive backup is switched off")
    return cfg, state, lookup


def status(conn: sqlite3.Connection, settings: Settings) -> dict[str, Any]:
    cfg, state = load_settings(conn), load_state(conn)
    lookup = secret_lookup(conn, Path(settings.data_dir))
    return {"settings": cfg.model_dump(), "connected": lookup("gdrive.refresh_token") is not None,
            "client_secret_configured": lookup("gdrive.client_secret") is not None,
            "scope": SCOPE, "oauth_available": not isinstance(OAUTH_FLOW, NotImplementedFlow),
            "pending_authorization": _pending_view(),
            "state": {k: state.get(k) for k in ("folder_id", "connected_at", "connected_by", "last_test", "last_push")},
            "running": _lock().locked()}


def run_check(db: Database, settings: Settings) -> dict[str, Any]:
    """The connection test: the folder found / created, a marker written, read back, deleted, the copies listed. Never raises for a
    transfer problem (the answer says ok / error); `gdrive_disabled` / `push_running` are raised (the caller answers 409)."""
    cfg, state, lookup = _load(db, settings)
    if not _lock().acquire(blocking=False):
        raise OffboxError("push_running", "another off-box transfer is running")
    try:
        with http_client(cfg) as http:
            try:
                dest = build(cfg, state, lookup, http)
                folder = dest.ensure_folder()
            except OffboxError as exc:
                result: dict[str, Any] = {"ok": False, "error": exc.code, "steps": []}
                folder = None
            else:
                result = check_connection(dest)
                result.pop("destination", None)
                try:
                    result["free_bytes"] = dest.free_bytes()
                except OffboxError:
                    result["free_bytes"] = None
        _write_state(db, folder_id=folder, last_test={"at": now_iso(), "ok": bool(result.get("ok")), "error": result.get("error")})
        return result
    finally:
        _lock().release()


def run_push(db: Database, settings: Settings, archive: Path, *, dry_run: bool = False) -> dict[str, Any]:
    """Seal + upload + verify + prune `archive` (backup_offbox.push: the same pipeline as S3 / SFTP). Never raises for a transfer
    problem. Not reachable from an API route or the daily loop yet (design: open items)."""
    cfg, state, lookup = _load(db, settings)
    if not _lock().acquire(blocking=False):
        raise OffboxError("push_running", "another off-box transfer is running")
    try:
        folder = state.get("folder_id")
        with http_client(cfg) as http:
            try:
                key = offbox_keys.load(Path(settings.data_dir), create=True).active_key()
                dest = build(cfg, state, lookup, http)
                folder = dest.ensure_folder()
            except OffboxError as exc:
                result: dict[str, Any] = {"ok": False, "error": exc.code, "dry_run": dry_run, "verified": False, "deleted": []}
            else:
                result = push(archive, dest, key, policy=RetentionPolicy(**cfg.retention.model_dump()), dry_run=dry_run, verify=cfg.verify,
                              workdir=offbox_runtime_workdir(settings))
                result.pop("destination", None)
                result["resumed_chunks"] = dest.resumed_chunks
        if not dry_run:
            _write_state(db, folder_id=folder, last_push={"at": now_iso(), "ok": bool(result.get("ok")), "error": result.get("error"),
                                                          "object": result.get("object"), "verified": bool(result.get("verified")),
                                                          "deleted_count": len(result.get("deleted") or [])})
        return result
    finally:
        _lock().release()


# ---------------------------------------------------------------- connect / disconnect


def _pending_view() -> dict[str, Any] | None:
    with _PENDING_LOCK:
        p = _PENDING.get("auth")
        if p is None:
            return None
        if time.monotonic() > _PENDING["deadline"]:
            _PENDING.clear()
            return None
        a: DeviceAuthorization = p
        return {"user_code": a.user_code, "verification_url": a.verification_url, "interval": a.interval,
                "expires_in": max(0, int(_PENDING["deadline"] - time.monotonic()))}


def connect_start(conn: sqlite3.Connection) -> dict[str, Any]:
    """Begin the consent: the administrator opens `verification_url` on any device and types `user_code`. With the TODO flow this
    raises `gdrive_oauth_not_implemented`; nothing calls Google."""
    cfg = load_settings(conn)
    if not cfg.enabled:
        raise OffboxError("gdrive_disabled", "the Google Drive backup is switched off")
    if not cfg.client_id:
        raise OffboxError("gdrive_client_missing", "no Google client id is configured")
    auth = OAUTH_FLOW.start(cfg.client_id, SCOPE)
    with _PENDING_LOCK:
        _PENDING.clear()
        _PENDING.update({"auth": auth, "deadline": time.monotonic() + max(60, min(int(auth.expires_in), 1800))})
    return _pending_view() or {}


def connect_poll(conn: sqlite3.Connection, settings: Settings, actor: str | None) -> dict[str, Any]:
    """One poll of the pending authorization. On `connected` the refresh token is sealed at once (the caller's transaction) and
    the pending entry is dropped; the token is never part of the answer."""
    cfg = load_settings(conn)
    with _PENDING_LOCK:
        auth = _PENDING.get("auth")
        deadline = _PENDING.get("deadline", 0.0)
    if auth is None or time.monotonic() > deadline:
        with _PENDING_LOCK:
            _PENDING.clear()
        return {"state": "expired"}
    res = OAUTH_FLOW.poll(cfg.client_id, auth)
    if res.state == "connected":
        if not res.refresh_token:
            raise OffboxError("remote_error", "the consent ended without a refresh token")
        set_secret(conn, Path(settings.data_dir), REFRESH_SECRET, res.refresh_token, actor)
        _patch_state(conn, connected_at=now_iso(), connected_by=actor, last_test=None, last_push=None)
        with _PENDING_LOCK:
            _PENDING.clear()
    elif res.state in ("denied", "expired"):
        with _PENDING_LOCK:
            _PENDING.clear()
    return {"state": res.state if res.state in ("pending", "slow_down", "connected", "denied", "expired") else "pending"}


def revoke_remote(db: Database, settings: Settings) -> bool | None:
    """Best effort, before the local token is dropped: None = nothing to revoke."""
    with db.connection(mode="read", label="gdrive.revoke") as conn:
        cfg = load_settings(conn)
        token = secret_lookup(conn, Path(settings.data_dir))("gdrive.refresh_token")
    if token is None:
        return None
    with http_client(cfg) as http:
        return revoke(http, token)


def disconnect(conn: sqlite3.Connection) -> bool:
    """Drop the sealed refresh token and the connection facts. The folder id is kept (the copies stay in that Drive folder; the
    same account connecting again through the same client sees them again). True when a token was there."""
    had = clear_secret(conn, REFRESH_SECRET)
    _patch_state(conn, connected_at=None, connected_by=None, last_test=None)  # None removes the key
    with _PENDING_LOCK:
        _PENDING.clear()
    return had
