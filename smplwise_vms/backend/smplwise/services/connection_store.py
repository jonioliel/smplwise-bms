"""The NVR connection stored by Arx (CR-022, docs/changes/CR-022-NVR-CONNECTION-IN-ARX.md): `recorder_connections` (migration
0052), the encryption of its one secret, the one-time import of the legacy add-on options, and the effective-settings overlay.

Secrets (CR-022 section 3, the narrow owner-approved exception to DEPENDENCY_AND_SECRETS_AUDIT.md section 3):
- only `password_enc` (and the reserved `secret_json_enc`) hold a secret: AES-256-GCM, a fresh 96-bit nonce per encryption,
  associated data `"<recorder_id>|<field>"` (a blob copied to another row or column does not decrypt), stored as
  `v1:<base64(nonce|ciphertext|tag)>`;
- the key is 32 random bytes in its own file `<data>/keys/connections.key` (mode 0600 in a 0700 directory, created
  atomically: a temporary file hard-linked into place, so the loser of a creation race reads the winner's key), not shared
  with the alarm-code key; `keys/` never enters an Arx backup (services/backup._rel) and the table is not a backup table;
- the plaintext exists only inside `load_effective` (start-up) and inside the connection test of one request; no function
  here logs, audits, raises or returns it. Errors are fixed text (`SecretError`).
Honest limit (section 3.3): the key lives beside the database, so this protects a leaked database file or Arx backup,
not a reader of the whole data folder.

Effective settings (section 5): `load_effective(settings, conn)` runs ONCE at start-up (main.py, after the migrations, before
any background worker) and is the only place that decides where the connection comes from: the stored row (vendor `none`
= NVR-less; an unreadable password = `unreadable`, treated as no NVR, start-up continues), else the legacy add-on options /
NVR_* environment (through the one-time import), else the development placeholder. A save or a removal never changes the
running process: the row revision moves on and `pending_restart` says so until the next start.
"""
from __future__ import annotations

import base64
import dataclasses
import ipaddress
import json
import logging
import os
import secrets
import sqlite3
import threading
from pathlib import Path
from typing import Any

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from ..config import DEV_NVR_PLACEHOLDER, Settings
from ..db import get_setting, now_iso, set_setting
from .recorders.registry import DEFAULT_RECORDER, DEFAULT_VENDOR, NO_NVR

log = logging.getLogger("smplwise.connection_store")

KEY_NAME = "connections.key"
IMPORT_DONE_KEY = "nvr.legacy_import_done"  # in backup.SETTINGS_KEEP: a restore never resets it
VENDOR_IDS = ("hikvision", "provision_isr", "frigate", NO_NVR)
SECRET_FIELDS = ("password", "secret_json")
_key_lock = threading.Lock()


class SecretError(Exception):
    """A stored secret cannot be written or read. The message is fixed text - never a secret, a ciphertext or the key."""


# ---------------------------------------------------------------- the key file

def key_path(settings: Settings) -> Path:
    return settings.data_dir / "keys" / KEY_NAME


def _load_or_create_key(settings: Settings, create: bool) -> bytes | None:
    p = key_path(settings)
    with _key_lock:
        if p.exists():
            raw = p.read_bytes()
            if len(raw) != 32:
                raise SecretError("the connection key file is damaged")
            return raw
        if not create:
            return None
        d = p.parent
        d.mkdir(parents=True, exist_ok=True)
        try:
            os.chmod(d, 0o700)
        except OSError:
            pass
        key = secrets.token_bytes(32)
        # written to a temporary file (0600, binary), flushed, then hard-linked into place: a crash never leaves a half
        # key, and of two processes creating it at once the second finds the first one's file and uses it
        tmp = p.with_name(f".{KEY_NAME}.{secrets.token_hex(4)}.tmp")
        fd = os.open(str(tmp), os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_BINARY", 0), 0o600)
        try:
            os.write(fd, key)
            os.fsync(fd)
        finally:
            os.close(fd)
        try:
            try:
                os.link(tmp, p)  # fails when the file exists: never overwrites a key another process just created
            except FileExistsError:
                return _read_key(p)
            except (OSError, NotImplementedError):  # a file system without hard links
                if p.exists():
                    return _read_key(p)
                os.replace(tmp, p)
            return key
        finally:
            try:
                tmp.unlink()
            except OSError:
                pass


def _read_key(p: Path) -> bytes:
    raw = p.read_bytes()
    if len(raw) != 32:
        raise SecretError("the connection key file is damaged")
    return raw


def _aad(recorder_id: str, field: str) -> bytes:
    return f"{recorder_id}|{field}".encode("utf-8")


def encrypt(settings: Settings, recorder_id: str, field: str, plaintext: str) -> str:
    if field not in SECRET_FIELDS:
        raise SecretError("not a secret field")
    try:
        key = _load_or_create_key(settings, create=True)
    except OSError:
        raise SecretError("the connection key cannot be created") from None
    assert key is not None
    nonce = secrets.token_bytes(12)
    ct = AESGCM(key).encrypt(nonce, plaintext.encode("utf-8"), _aad(recorder_id, field))
    return "v1:" + base64.b64encode(nonce + ct).decode("ascii")


def decrypt(settings: Settings, recorder_id: str, field: str, blob: str) -> str:
    try:
        key = _load_or_create_key(settings, create=False)
    except OSError:
        key = None
    if key is None or not isinstance(blob, str) or not blob.startswith("v1:"):
        raise SecretError("the stored connection secret cannot be read")
    try:
        raw = base64.b64decode(blob[3:], validate=True)
        if len(raw) < 12 + 16:
            raise ValueError("short")
        return AESGCM(key).decrypt(raw[:12], raw[12:], _aad(recorder_id, field)).decode("utf-8")
    except (InvalidTag, ValueError, UnicodeDecodeError):
        raise SecretError("the stored connection secret cannot be read") from None


# ---------------------------------------------------------------- rows

def get_row(conn: sqlite3.Connection, recorder_id: str = DEFAULT_RECORDER) -> sqlite3.Row | None:
    try:
        return conn.execute("SELECT * FROM recorder_connections WHERE recorder_id = ?", (recorder_id,)).fetchone()
    except sqlite3.OperationalError:  # a database before migration 0052 (an upgrade test): no stored connection
        return None


def revision_of(conn: sqlite3.Connection, recorder_id: str = DEFAULT_RECORDER) -> int | None:
    row = get_row(conn, recorder_id)
    return int(row["revision"]) if row else None


def pending_restart(conn: sqlite3.Connection, settings: Settings, recorder_id: str = DEFAULT_RECORDER) -> bool:
    """True when the stored connection moved on since this process loaded it (a save or a removal waits for a restart)."""
    return revision_of(conn, recorder_id) != settings.nvr_connection_revision


def readable(conn: sqlite3.Connection, settings: Settings, row: sqlite3.Row | None) -> bool:
    if row is None or not row["password_enc"]:
        return True
    try:
        decrypt(settings, row["recorder_id"], "password", row["password_enc"])
        return True
    except SecretError:
        return False


def stored_password(settings: Settings, row: sqlite3.Row | None) -> str | None:
    """The stored password of `row`, for the connection test / the save of ONE request. Raises SecretError when unreadable."""
    if row is None or not row["password_enc"]:
        return None
    return decrypt(settings, row["recorder_id"], "password", row["password_enc"])


def camera_count(conn: sqlite3.Connection, recorder_id: str = DEFAULT_RECORDER) -> int:
    try:
        return int(conn.execute("SELECT COUNT(*) FROM cameras WHERE recorder_id = ?", (recorder_id,)).fetchone()[0])
    except sqlite3.OperationalError:
        return int(conn.execute("SELECT COUNT(*) FROM cameras").fetchone()[0])


def write_row(conn: sqlite3.Connection, settings: Settings, *, vendor: str, host: str | None, http_port: int | None, rtsp_port: int | None,
              username: str | None, password: str | None, extra: dict[str, Any] | None, source: str, actor_id: str | None,
              recorder_id: str = DEFAULT_RECORDER) -> int:
    """Insert or replace the row in the caller's transaction; returns the new revision. `password` is the plaintext to store
    (None = no password). Encryption happens BEFORE anything is written, so a key failure writes nothing."""
    if vendor not in VENDOR_IDS:
        raise ValueError("unknown vendor")
    password_enc = encrypt(settings, recorder_id, "password", password) if password else None
    state = "ok" if vendor == NO_NVR or password_enc else "incomplete"
    old = revision_of(conn, recorder_id)
    revision = (old or 0) + 1
    conn.execute(
        """INSERT INTO recorder_connections(recorder_id, vendor, host, http_port, rtsp_port, username, password_enc, secret_json_enc, extra_json,
                                            enabled, state, revision, source, updated_at, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, 1, ?, ?, ?, ?, ?)
           ON CONFLICT(recorder_id) DO UPDATE SET vendor = excluded.vendor, host = excluded.host, http_port = excluded.http_port,
             rtsp_port = excluded.rtsp_port, username = excluded.username, password_enc = excluded.password_enc, secret_json_enc = NULL,
             extra_json = excluded.extra_json, enabled = 1, state = excluded.state, revision = excluded.revision, source = excluded.source,
             updated_at = excluded.updated_at, updated_by = excluded.updated_by""",
        (recorder_id, vendor, host if vendor != NO_NVR else None, http_port if vendor != NO_NVR else None, rtsp_port if vendor != NO_NVR else None,
         username if vendor != NO_NVR else None, password_enc, json.dumps(extra or {}, ensure_ascii=False, sort_keys=True), state, revision, source,
         now_iso(), actor_id or "system"),
    )
    set_setting(conn, IMPORT_DONE_KEY, "1")  # any stored connection supersedes the legacy options for good
    return revision


def remove(conn: sqlite3.Connection, settings: Settings, actor_id: str | None, recorder_id: str = DEFAULT_RECORDER) -> tuple[int, int]:
    """"Remove NVR" (section 6.5): the secrets are cleared, vendor `none`, every camera of the recorder disabled (rows, anchors,
    bindings and permissions kept). Returns (revision, cameras disabled)."""
    revision = write_row(conn, settings, vendor=NO_NVR, host=None, http_port=None, rtsp_port=None, username=None, password=None, extra=None,
                         source="ui", actor_id=actor_id, recorder_id=recorder_id)
    try:
        disabled = conn.execute("UPDATE cameras SET enabled = 0 WHERE recorder_id = ? AND enabled <> 0", (recorder_id,)).rowcount
    except sqlite3.OperationalError:
        disabled = conn.execute("UPDATE cameras SET enabled = 0 WHERE enabled <> 0").rowcount
    return revision, disabled


# ---------------------------------------------------------------- one-time import of the add-on options (section 7)

def _importable(settings: Settings) -> bool:
    host = (settings.nvr_host or "").strip()
    return bool(settings.nvr_from_options and host and host != DEV_NVR_PLACEHOLDER)


def import_legacy(conn: sqlite3.Connection, settings: Settings) -> bool:
    """Copy the add-on options' NVR connection into the table once: only when no row exists, the import never ran, and the
    options name a real host. Idempotent; the caller's transaction. A key / encryption failure writes nothing (the options
    keep working) and logs one WARN line without values. The options themselves are never written (owner decision D4)."""
    if get_row(conn) is not None or get_setting(conn, IMPORT_DONE_KEY) or not _importable(settings):
        return False
    try:
        write_row(conn, settings, vendor=DEFAULT_VENDOR, host=settings.nvr_host.strip(), http_port=settings.nvr_http_port, rtsp_port=settings.nvr_rtsp_port,
                  username=settings.nvr_user, password=settings.nvr_password, extra=None, source="addon_import", actor_id=None)
    except SecretError:
        log.warning("the NVR connection of the add-on options could not be imported (key not available); the options stay in use")
        return False
    from ..audit import audit  # local import: audit -> db only

    audit(conn, actor=None, action="nvr.connection.import", decision="allowed", resource_type="nvr", resource_id="connection",
          details={"vendor": DEFAULT_VENDOR, "http_port": settings.nvr_http_port, "rtsp_port": settings.nvr_rtsp_port, "password_imported": bool(settings.nvr_password)})
    log.info("the NVR connection of the add-on options was imported into Arx; the add-on options are ignored from now on")
    return True


# ---------------------------------------------------------------- effective settings (section 5)

def connect_host(host: str | None) -> str | None:
    """The host as URL builders need it: an IPv6 literal in brackets (`http://[fd00::1]:80`), anything else unchanged."""
    if not host:
        return host
    try:
        if isinstance(ipaddress.ip_address(host), ipaddress.IPv6Address):
            return f"[{host}]"
    except ValueError:
        pass
    return host


def overlay(settings: Settings, row: sqlite3.Row | None) -> Settings:
    """`settings` with the stored connection applied (pure apart from decrypting the row's password)."""
    if row is None:
        return settings
    revision = int(row["revision"])
    try:
        extra = json.loads(row["extra_json"] or "{}")
    except ValueError:
        extra = {}
    if row["vendor"] == NO_NVR:
        return dataclasses.replace(settings, nvr_vendor=NO_NVR, nvr_host=None, nvr_user=None, nvr_password=None, nvr_extra={},
                                   nvr_connection_state="ok", nvr_connection_revision=revision)
    try:
        password = stored_password(settings, row)
    except SecretError:
        return dataclasses.replace(settings, nvr_vendor=row["vendor"], nvr_host=None, nvr_user=None, nvr_password=None, nvr_extra=extra,
                                   nvr_connection_state="unreadable", nvr_connection_revision=revision)
    return dataclasses.replace(
        settings, nvr_vendor=row["vendor"], nvr_host=connect_host(row["host"]), nvr_http_port=int(row["http_port"] or 80),
        nvr_rtsp_port=int(row["rtsp_port"] or 554), nvr_user=row["username"], nvr_password=password, nvr_extra=extra,
        nvr_connection_state=row["state"], nvr_connection_revision=revision)


def legacy_options_differ(settings_before: Settings, row: sqlite3.Row | None) -> bool:
    """The add-on options still name another host than the stored row (they are ignored; one neutral line in Settings)."""
    if row is None or not _importable(settings_before):
        return False
    return (settings_before.nvr_host or "").strip().lower() != (row["host"] or "").strip().lower()


def load_effective(settings: Settings, conn: sqlite3.Connection) -> Settings:
    """The connection this process runs with. Imports the legacy options first when that is due (section 7)."""
    if get_row(conn) is None:
        import_legacy(conn, settings)
    return overlay(settings, get_row(conn))


def apply_at_startup(db: Any, settings: Settings) -> tuple[Settings, bool]:
    """main.py: `load_effective` in its own transaction. Never blocks the start: on an unexpected error the legacy settings
    stay in use (one line, no values). Returns (effective settings, legacy options differ)."""
    try:
        with db.connection(label="connection_store.startup") as conn:
            effective = load_effective(settings, conn)
            differ = legacy_options_differ(settings, get_row(conn))
    except Exception:  # noqa: BLE001 - never block the start
        log.exception("could not load the stored NVR connection; the add-on options stay in use")
        return settings, False
    if differ:
        log.warning("legacy add-on NVR options are ignored: the NVR connection stored in Arx is used")
    if effective.nvr_connection_state == "unreadable":
        log.warning("the stored NVR connection cannot be decrypted (key missing or changed); the NVR is treated as not configured until the password is entered again")
    return effective, differ
