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


_POSIX = os.name == "posix"


def _tighten(p: Path) -> None:
    """Review F13: the key file is readable by its owner only - a looser mode found on disk (a copy, a restore by hand) is
    put back to 0600. POSIX only; best effort, never raises."""
    if not _POSIX:
        return
    try:
        if os.stat(p).st_mode & 0o077:
            os.chmod(p, 0o600)
    except OSError:
        pass


def _fsync_dir(d: Path) -> None:
    """Review F13: the new directory entry of the key reaches the disk too (POSIX; best effort)."""
    if not _POSIX:
        return
    try:
        fd = os.open(str(d), os.O_RDONLY)
    except OSError:
        return
    try:
        os.fsync(fd)
    except OSError:
        pass
    finally:
        os.close(fd)


def _load_or_create_key(settings: Settings, create: bool) -> bytes | None:
    p = key_path(settings)
    with _key_lock:
        if p.exists():
            _tighten(p)
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
            _fsync_dir(d)
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


def _seal(settings: Any, aad: bytes, plaintext: str) -> str:
    try:
        key = _load_or_create_key(settings, create=True)
    except OSError:
        raise SecretError("the connection key cannot be created") from None
    assert key is not None
    nonce = secrets.token_bytes(12)
    ct = AESGCM(key).encrypt(nonce, plaintext.encode("utf-8"), aad)
    return "v1:" + base64.b64encode(nonce + ct).decode("ascii")


def _open(settings: Any, aad: bytes, blob: str) -> str:
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
        return AESGCM(key).decrypt(raw[:12], raw[12:], aad).decode("utf-8")
    except (InvalidTag, ValueError, UnicodeDecodeError):
        raise SecretError("the stored connection secret cannot be read") from None


def encrypt(settings: Settings, recorder_id: str, field: str, plaintext: str) -> str:
    if field not in SECRET_FIELDS:
        raise SecretError("not a secret field")
    return _seal(settings, _aad(recorder_id, field), plaintext)


def decrypt(settings: Settings, recorder_id: str, field: str, blob: str) -> str:
    return _open(settings, _aad(recorder_id, field), blob)


# ---------------------------------------------------------------- other services' secrets (the music server token, CR-016 section 18)
# The same key file and the same `v1:` format; the associated data is `"<kind>|<id>|<field>"`, which can never equal a recorder's
# `"<recorder_id>|<field>"` (one separator only), so a blob moved between an NVR row and another service does not decrypt.

class _Home:
    """The key location of a data folder when no Settings object is at hand (the key file is `<data>/keys/connections.key`)."""

    def __init__(self, data_dir: Path) -> None:
        self.data_dir = data_dir


SERVICE_FIELDS = {("music_assistant", "default", "token")}


def _service_aad(kind: str, ident: str, field: str) -> bytes:
    if (kind, ident, field) not in SERVICE_FIELDS:
        raise SecretError("not a secret field")
    return f"{kind}|{ident}|{field}".encode("utf-8")


def seal_service_secret(data_dir: Path, kind: str, ident: str, field: str, plaintext: str) -> str:
    return _seal(_Home(data_dir), _service_aad(kind, ident, field), plaintext)


def open_service_secret(data_dir: Path, kind: str, ident: str, field: str, blob: str) -> str:
    return _open(_Home(data_dir), _service_aad(kind, ident, field), blob)


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


def any_pending_restart(conn: sqlite3.Connection, settings: Settings) -> bool:
    """CR-024: a change to ANY recorder waits for a restart - the first recorder's connection (as before), a further recorder's
    connection, a recorder enabled / disabled / removed since this process started. `/me` and `/health` report it, so the restart
    banner survives a reload whichever recorder changed. Never raises (a database before 0055 = the first recorder only)."""
    if pending_restart(conn, settings):
        return True
    try:
        rows = conn.execute("SELECT id, enabled, removed_at FROM recorders").fetchall()
    except sqlite3.OperationalError:
        return False
    from ..recorder_scope import settings_for

    loaded = settings.recorder_settings if isinstance(settings.recorder_settings, dict) else {}
    for r in rows:
        rid = r["id"]
        if rid == DEFAULT_RECORDER:
            continue  # enable / disable of the first recorder applies at once (recorder_scope.DISABLED); its connection: above
        if r["removed_at"]:
            if rid in loaded:
                return True  # stopped at once, but its connection leaves memory only with the restart
            continue
        row = get_row(conn, rid)
        if row is None or row["vendor"] == NO_NVR:
            continue
        if rid not in loaded:
            if r["enabled"]:
                return True  # added (or enabled) after this process started: its connection is loaded by the restart
            continue
        if pending_restart(conn, settings_for(settings, rid), rid):
            return True  # its connection changed since the start
    return False


def primary_free(conn: sqlite3.Connection, settings: Settings) -> bool:
    """CR-024: no first recorder in use - no stored connection (or "no NVR") and no legacy host the process started with."""
    row = get_row(conn, DEFAULT_RECORDER)
    if row is not None:
        return row["vendor"] == NO_NVR
    return not (settings.nvr_host and settings.nvr_host != DEV_NVR_PLACEHOLDER)


def primary_has_history(conn: sqlite3.Connection) -> bool:
    """CR-024 (owner 2026-10-04): the first recorder id carries history - its recorder row, cameras, events or change-log rows.
    Such an id is never handed to another device."""
    for sql in ("SELECT 1 FROM recorders WHERE id = ? LIMIT 1", "SELECT 1 FROM cameras WHERE recorder_id = ? LIMIT 1",
                "SELECT 1 FROM events WHERE recorder_id = ? LIMIT 1", "SELECT 1 FROM nvr_changes WHERE recorder_id = ? LIMIT 1"):
        try:
            if conn.execute(sql, (DEFAULT_RECORDER,)).fetchone():
                return True
        except sqlite3.OperationalError:  # a table or column a test database lacks
            continue
    return False


def stored_identity(conn: sqlite3.Connection, recorder_id: str) -> str | None:
    try:
        row = conn.execute("SELECT device_fingerprint FROM recorders WHERE id = ?", (recorder_id,)).fetchone()
    except sqlite3.OperationalError:
        return None
    return (row["device_fingerprint"] if row else None) or None


def next_free_id(conn: sqlite3.Connection) -> str:
    """`nvr-<n>` above every recorder id ever used (in `recorders` or `recorder_connections`)."""
    from ..recorder_scope import next_id

    used = [r[0] for r in conn.execute("SELECT id FROM recorders").fetchall()]
    used += [r[0] for r in conn.execute("SELECT recorder_id FROM recorder_connections").fetchall()]
    return next_id(used)


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
    if vendor != NO_NVR:  # CR-024: a connection saved for a removed recorder brings it back (its cameras stay disabled, for review)
        _mark_recorder(conn, recorder_id, "UPDATE recorders SET removed_at = NULL, vendor = ? WHERE id = ?", (vendor, recorder_id))
    return revision


def _mark_recorder(conn: sqlite3.Connection, recorder_id: str, sql: str, args: tuple[Any, ...]) -> None:
    try:
        conn.execute(sql, args)
    except sqlite3.OperationalError:  # a database before migration 0055 (an upgrade test): nothing to mark
        pass


def remove(conn: sqlite3.Connection, settings: Settings, actor_id: str | None, recorder_id: str = DEFAULT_RECORDER) -> tuple[int, int]:
    """"Remove NVR" (section 6.5): the secrets are cleared, vendor `none`, every camera of the recorder disabled (rows, anchors,
    bindings and permissions kept). Returns (revision, cameras disabled)."""
    revision = write_row(conn, settings, vendor=NO_NVR, host=None, http_port=None, rtsp_port=None, username=None, password=None, extra=None,
                         source="ui", actor_id=actor_id, recorder_id=recorder_id)
    try:
        disabled = conn.execute("UPDATE cameras SET enabled = 0 WHERE recorder_id = ? AND enabled <> 0", (recorder_id,)).rowcount
    except sqlite3.OperationalError:
        disabled = conn.execute("UPDATE cameras SET enabled = 0 WHERE enabled <> 0").rowcount
    # CR-024 (owner decision): the recorder row stays, marked removed - its cameras are left out of every camera list, their
    # history (events, cases, anchors, bindings, the change log) is kept
    _mark_recorder(conn, recorder_id, "UPDATE recorders SET removed_at = COALESCE(removed_at, ?) WHERE id = ?", (now_iso(), recorder_id))
    from ..recorder_scope import set_disabled

    set_disabled(recorder_id, True)  # CR-024: never contacted again from this moment (its loaded connection leaves memory at the restart)
    return revision, disabled


# ---------------------------------------------------------------- one-time import of the add-on options (section 7)

def _importable(settings: Settings) -> bool:
    host = (settings.nvr_host or "").strip()
    return bool(settings.nvr_from_options and host and host != DEV_NVR_PLACEHOLDER)


def _from_options(settings: Settings, key: str) -> bool:
    """Review F16: the import takes a value only when the options file itself carried it - never an `NVR_*` environment
    value that load_settings used as a fallback for a key the options left empty (CR-022 section 19, deviation 3)."""
    return key in settings.nvr_option_keys


def import_legacy(conn: sqlite3.Connection, settings: Settings) -> bool:
    """Copy the add-on options' NVR connection into the table once: only when no row exists, the import never ran, and the
    options name a real host. Idempotent; the caller's transaction. A key / encryption failure writes nothing (the options
    keep working) and logs one WARN line without values. The options themselves are never written (owner decision D4)."""
    if get_row(conn) is not None or get_setting(conn, IMPORT_DONE_KEY) or not _importable(settings):
        return False
    from . import connection_probe  # validation only (no network here)

    host = settings.nvr_host.strip()
    http_port = settings.nvr_http_port if _from_options(settings, "nvr_http_port") else 80
    rtsp_port = settings.nvr_rtsp_port if _from_options(settings, "nvr_rtsp_port") else 554
    if not connection_probe.valid_host(host) or not connection_probe.valid_port(http_port) or not connection_probe.valid_port(rtsp_port):
        # review F16: a value the connection form would refuse is not imported; nothing is written and the options stay in use
        log.warning("the NVR connection of the add-on options was not imported (the host or a port is not valid); the options stay in use")
        return False
    username = settings.nvr_user if _from_options(settings, "nvr_username") else None
    password = settings.nvr_password if _from_options(settings, "nvr_password") else None
    try:
        write_row(conn, settings, vendor=DEFAULT_VENDOR, host=host, http_port=http_port, rtsp_port=rtsp_port,
                  username=username, password=password, extra=None, source="addon_import", actor_id=None)
    except SecretError:
        log.warning("the NVR connection of the add-on options could not be imported (key not available); the options stay in use")
        return False
    from ..audit import audit  # local import: audit -> db only

    audit(conn, actor=None, action="nvr.connection.import", decision="allowed", resource_type="nvr", resource_id="connection",
          details={"vendor": DEFAULT_VENDOR, "http_port": http_port, "rtsp_port": rtsp_port, "password_imported": bool(password)})
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
    from . import connection_probe

    if row["host"] and connection_probe.refused_host(row["host"], settings):
        # review F5: the stored host is re-checked with the connection test's source policy once per start (a name that now
        # resolves to loopback, the platform network, this host...): fail closed, the NVR is treated as not configured
        return dataclasses.replace(settings, nvr_vendor=row["vendor"], nvr_host=None, nvr_user=None, nvr_password=None, nvr_extra=extra,
                                   nvr_connection_state="refused", nvr_connection_revision=revision)
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
    """The connection this process runs with. Imports the legacy options first when that is due (section 7). CR-024: the
    further recorders' connections are overlaid at the same moment (`load_children`)."""
    if get_row(conn) is None:
        import_legacy(conn, settings)
    effective = overlay(settings, get_row(conn))
    from ..recorder_scope import DISABLED

    DISABLED.clear()  # CR-024: the disabled set of THIS process starts from the database (disable / enable then apply at once)
    if _primary_disabled(conn):
        DISABLED.add(DEFAULT_RECORDER)  # its connection stays loaded, so enabling it again needs no restart
    return dataclasses.replace(effective, recorder_settings=load_children(effective, conn))


def _primary_disabled(conn: sqlite3.Connection) -> bool:
    try:
        row = conn.execute("SELECT enabled FROM recorders WHERE id = ? AND removed_at IS NULL", (DEFAULT_RECORDER,)).fetchone()
    except sqlite3.OperationalError:
        return False
    return row is not None and not row["enabled"]


def further_recorders(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    """CR-024: the recorders other than the primary that this process loads: not removed (a disabled one is loaded too and kept
    in `recorder_scope.DISABLED`, so enabling it applies at once). Empty before 0055."""
    try:
        return conn.execute("SELECT id, enabled FROM recorders WHERE id <> ? AND removed_at IS NULL ORDER BY sort_order, id",
                            (DEFAULT_RECORDER,)).fetchall()
    except sqlite3.OperationalError:
        return []


def load_children(primary: Settings, conn: sqlite3.Connection) -> dict[str, Settings]:
    """CR-024: the effective settings of every further recorder - the primary's settings (go2rtc, Home Assistant, data folder)
    with that recorder's own connection overlaid by `overlay` (the same decryption, the same source-policy re-check, the same
    fail-closed states). A recorder without a connection row, or with "no NVR", is not loaded (its device calls answer 409)."""
    from ..recorder_scope import DISABLED, unconfigured

    out: dict[str, Settings] = {}
    for r in further_recorders(conn):
        rid = r["id"]
        row = get_row(conn, rid)
        if row is None or row["vendor"] == NO_NVR:
            continue
        out[rid] = overlay(unconfigured(primary, rid), row)
        if not r["enabled"]:
            DISABLED.add(rid)
    return out


LEGACY_FILE = "nvr_connection.json"


def remove_legacy_file(settings: Settings) -> bool:
    """Review F11: the 0.1.71 workstation file `<data>/nvr_connection.json` held the NVR password in clear. Nothing reads it
    any more (CR-022 section 5); it is overwritten with zeros, flushed and deleted at start-up. Idempotent (no file = no-op),
    never raises, one INFO line without values. Honest limit: on a copy-on-write or flash file system the overwrite does not
    guarantee the old blocks are gone; the deletion is what this guarantees."""
    p = settings.data_dir / LEGACY_FILE
    try:
        if not p.is_file():
            return False
        size = p.stat().st_size
        with open(p, "r+b") as fh:
            fh.write(b"\0" * size)
            fh.flush()
            os.fsync(fh.fileno())
        p.unlink()
    except OSError:
        log.warning("the legacy NVR connection file could not be removed; delete it by hand")
        return False
    log.info("the legacy NVR connection file of an older version was removed (the connection is stored in Arx)")
    return True


def apply_at_startup(db: Any, settings: Settings) -> tuple[Settings, bool]:
    """main.py: `load_effective` in its own transaction. Never blocks the start, and fails CLOSED (third security review): on
    an unexpected error (a locked or damaged database) the NVR is treated as not configured with state `unreadable` - the
    raw add-on options (an old host and password, never checked by the connection policy) are NOT used, because the store may
    hold "no NVR" or another destination. One line, no values. Returns (effective settings, legacy options differ)."""
    remove_legacy_file(settings)
    try:
        with db.connection(label="connection_store.startup") as conn:
            effective = load_effective(settings, conn)
            differ = legacy_options_differ(settings, get_row(conn))
    except Exception:  # noqa: BLE001 - never block the start
        from ..recorder_scope import DISABLED

        DISABLED.clear()
        log.exception("could not load the stored NVR connection; the NVR is treated as not configured until the next start")
        return dataclasses.replace(settings, nvr_host=None, nvr_user=None, nvr_password=None, nvr_connection_state="unreadable"), False
    if differ:
        log.warning("legacy add-on NVR options are ignored: the NVR connection stored in Arx is used")
    if effective.nvr_connection_state == "refused":
        log.warning("the stored NVR address is not allowed by the connection policy; the NVR is treated as not configured until it is entered again")
    if effective.nvr_connection_state == "unreadable":
        log.warning("the stored NVR connection cannot be decrypted (key missing or changed); the NVR is treated as not configured until the password is entered again")
    return effective, differ
