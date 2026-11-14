"""CALCONNECT-2330: the credentials of one calendar connection (contract 15.2) and the runtime the real adapters read them through.

Where each value lives (no migration: the installation's `settings` key/value table, keys under `calendar.conn.<connection id>.`):
* `client`            - JSON `{client_id, tenant}`: the owner's OAuth client id (not a secret; Google and Microsoft show it in the
                        consent screen anyway) and, for Microsoft, the directory (`common` by default);
* `secret.client_secret`, `secret.refresh_token`, `secret.feed_url` - SEALED with the per-install key (connection_store `v1:` format,
  associated data `cal_conn|<id>|<field>`: a blob copied to another connection or field does not decrypt).

Nothing here logs, audits, raises or returns a secret value to a caller outside the adapters: the routes answer `configured` /
`authorized` flags only. An unreadable blob (key file gone or replaced) reads as "not set" (fail closed: the connection asks for a new
authorisation instead of using a stale value).

The access token of an OAuth connection lives in process memory only (`_ACCESS`), until 60 s before it expires; a restart, a new
authorisation and a disconnect forget it."""
from __future__ import annotations

import json
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any, Callable

from .. import connection_store

PREFIX = "calendar.conn."
TENANT_DEFAULT = "common"
CLOCK: Callable[[], float] = time.monotonic

_LOCK = threading.Lock()
_ACCESS: dict[str, tuple[str, float]] = {}


def _key(cid: str, name: str) -> str:
    return f"{PREFIX}{cid}.{name}"


def _get(conn: sqlite3.Connection, key: str) -> str | None:
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    return row[0] if row else None


def _put(conn: sqlite3.Connection, key: str, value: str) -> None:
    conn.execute("INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", (key, value))


# ---------------------------------------------------------------- the client (non-secret part)

def client(conn: sqlite3.Connection, cid: str) -> dict[str, str]:
    raw = _get(conn, _key(cid, "client"))
    try:
        doc = json.loads(raw) if raw else {}
    except ValueError:
        doc = {}
    doc = doc if isinstance(doc, dict) else {}
    return {"client_id": str(doc.get("client_id") or ""), "tenant": str(doc.get("tenant") or TENANT_DEFAULT)}


def set_client(conn: sqlite3.Connection, cid: str, client_id: str, tenant: str = TENANT_DEFAULT) -> None:
    _put(conn, _key(cid, "client"), json.dumps({"client_id": client_id, "tenant": tenant}))


# ---------------------------------------------------------------- the sealed part

def secret(conn: sqlite3.Connection, data_dir: Path, cid: str, field: str) -> str | None:
    blob = _get(conn, _key(cid, f"secret.{field}"))
    if not blob:
        return None
    try:
        return connection_store.open_calendar_secret(data_dir, cid, field, blob)
    except Exception:  # noqa: BLE001 - unreadable = not configured (fail closed); never the value or the blob in a message
        return None


def has_secret(conn: sqlite3.Connection, data_dir: Path, cid: str, field: str) -> bool:
    return secret(conn, data_dir, cid, field) is not None


def set_secret(conn: sqlite3.Connection, data_dir: Path, cid: str, field: str, value: str) -> None:
    _put(conn, _key(cid, f"secret.{field}"), connection_store.seal_calendar_secret(data_dir, cid, field, value))


def clear_secret(conn: sqlite3.Connection, cid: str, field: str) -> bool:
    forget_access(cid)
    return conn.execute("DELETE FROM settings WHERE key = ?", (_key(cid, f"secret.{field}"),)).rowcount > 0


def clear_all(conn: sqlite3.Connection, cid: str) -> None:
    forget_access(cid)
    conn.execute("DELETE FROM settings WHERE key LIKE ? ESCAPE '\\'", (_key(cid, "").replace("_", "\\_").replace("%", "\\%") + "%",))


def status(conn: sqlite3.Connection, data_dir: Path, cid: str) -> dict[str, Any]:
    """What a route may say about the credentials: flags, never a value."""
    c = client(conn, cid)
    return {"client_id_set": bool(c["client_id"]), "client_secret_set": has_secret(conn, data_dir, cid, "client_secret"),
            "authorized": has_secret(conn, data_dir, cid, "refresh_token"), "feed_url_set": has_secret(conn, data_dir, cid, "feed_url"),
            "tenant": c["tenant"]}


# ---------------------------------------------------------------- access tokens (memory only)

def cached_access(cid: str) -> str | None:
    with _LOCK:
        hit = _ACCESS.get(cid)
        if hit and CLOCK() < hit[1] - 60:
            return hit[0]
        _ACCESS.pop(cid, None)
        return None


def remember_access(cid: str, token: str, ttl_s: int) -> None:
    with _LOCK:
        _ACCESS[cid] = (token, CLOCK() + max(0, min(int(ttl_s), 24 * 3600)))


def forget_access(cid: str) -> None:
    with _LOCK:
        _ACCESS.pop(cid, None)


# ---------------------------------------------------------------- the runtime the adapters use (configured by create_app)

class Runtime:
    """The database and data folder the real adapters read credentials through. The adapters call it only while NO transaction of
    theirs is open (engine.run_connection keeps the network outside the write lock; the routes release theirs first)."""

    def __init__(self) -> None:
        self.db: Any = None
        self.data_dir: Path | None = None

    def configure(self, db: Any, data_dir: Path) -> None:
        self.db, self.data_dir = db, Path(data_dir)

    def _need(self) -> tuple[Any, Path]:
        if self.db is None or self.data_dir is None:
            raise RuntimeError("calendar connection runtime is not configured")
        return self.db, self.data_dir

    def read(self, cid: str) -> dict[str, Any]:
        db, data_dir = self._need()
        with db.connection(mode="read", label="calendar.conn.read") as conn:
            c = client(conn, cid)
            return {**c, "client_secret": secret(conn, data_dir, cid, "client_secret"), "refresh_token": secret(conn, data_dir, cid, "refresh_token"),
                    "feed_url": secret(conn, data_dir, cid, "feed_url")}

    def store_refresh(self, cid: str, token: str) -> None:
        """A provider that rotates refresh tokens (Microsoft) hands a new one on every refresh: sealed at once."""
        db, data_dir = self._need()
        with db.write_aside(label="calendar.conn.refresh") as conn:
            set_secret(conn, data_dir, cid, "refresh_token", token)


RUNTIME = Runtime()

__all__ = ["RUNTIME", "client", "set_client", "secret", "has_secret", "set_secret", "clear_secret", "clear_all", "status",
           "cached_access", "remember_access", "forget_access"]
