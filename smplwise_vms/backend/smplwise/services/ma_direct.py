"""The direct Music Assistant connection (CR-016 phase 2b, docs/changes/CR-016-MEDIA-PLAYERS.md section 17): the full queue list, queue edits (move,
delete, play next, clear) and library search - the three things Home Assistant does not offer. Everything audible (transport, volume, power, play an
item, transfer, groups) stays on the signed bridge path; this module never starts, stops or changes the volume of anything.

Transport: MA's stateless JSON-RPC over HTTP (`POST <url>/api`, `Authorization: Bearer <token>`, body `{message_id, command, args}`) and the server
description `GET <url>/info` (the schema gate). One request per read or edit; no socket, no events, no reconnect loop. A failure opens a short
circuit (nothing is sent while it is open); a write is NEVER retried.

Rules this module keeps:
- A fixed command allow-list (`COMMANDS`): anything else raises `CommandRefused` before a byte is sent.
- The token is write-only: a 0600 file `<data>/secrets/music_assistant_token`, never returned, logged, audited or backed up. The server address is
  the setting `multimedia.ma_direct` (`system.configure` only, excluded from backups) and is never written to a log line or an audit row.
- Every player id sent is derived on the server from an approved device's MA entity (`unique_id`); a queue id comes from MA's own answer; a queue
  item is named by the browser only through an opaque `item` issued to that user for that device (10 minutes).
- Errors carry a state (`unreachable`, `unauthorized`, `schema_too_old`, `error`) and at most MA's numeric error code - never a text (an MA error text
  may carry provider details or an address)."""
from __future__ import annotations

import datetime as dt
import hashlib
import hmac
import json
import logging
import os
import re
import secrets as _secrets
import sqlite3
import time
import uuid
from pathlib import Path
from typing import Any, Protocol
from urllib.parse import urlsplit

import httpx

from ..db import get_setting, now_iso, set_setting
from ..errors import ApiError

log = logging.getLogger("smplwise.media")

CONFIG_KEY = "multimedia.ma_direct"
SECRET_NAME = "music_assistant_token"
MIN_SCHEMA_VERSION = 27  # the lowest schema the commands below are documented for (UNVERIFIED on the owner's server: raise once his number is known)
TIMEOUT_S = 8.0
CIRCUIT_S = 30.0  # after `unreachable` / `error` nothing is sent for this long
TOKEN_WARN_DAYS = 330  # MA long-lived tokens live 365 days without renewal
ANSWER_MAX = 2_000_000
TOKEN_MAX = 4096
STATES = ("off", "ready", "unreachable", "unauthorized", "schema_too_old", "error")
COMMANDS = frozenset({
    "players/all",                     # the connection test only: a COUNT is kept
    "player_queues/get_active_queue",  # the queue header of a player
    "player_queues/items",             # the queue list (paged)
    "player_queues/move_item",
    "player_queues/delete_item",
    "player_queues/clear",
    "music/search",
})
MONO = time.monotonic  # tests move the clock here


class CommandRefused(RuntimeError):
    """A command outside the allow-list: a programming error, never sent."""


class MaError(Exception):
    """`state` is one of STATES (or `refused`: MA answered the command with an error); `ma_code` MA's numeric error code when it sent one."""

    def __init__(self, state: str, ma_code: int | None = None) -> None:
        super().__init__(state)
        self.state, self.ma_code = state, ma_code


# ------------------------------------------------------------------------------------------------ the transport


class Transport(Protocol):
    def info(self, url: str) -> dict[str, Any]: ...

    def call(self, url: str, token: str, command: str, args: dict[str, Any]) -> Any: ...


def _bounded(method: str, url: str, **kw: Any) -> tuple[int, bytes]:
    """One request, its body read in chunks and refused past ANSWER_MAX (an answer is never buffered whole before its size is known)."""
    try:
        with httpx.stream(method, url, timeout=TIMEOUT_S, follow_redirects=False, **kw) as r:
            buf = bytearray()
            for chunk in r.iter_bytes():
                buf += chunk
                if len(buf) > ANSWER_MAX:
                    raise MaError("error")
            return r.status_code, bytes(buf)
    except httpx.HTTPError as exc:
        raise MaError("unreachable") from exc


class HttpTransport:
    """The real transport (httpx). Nothing here logs a URL, a token, a body or an MA error text."""

    def info(self, url: str) -> dict[str, Any]:
        status, content = _bounded("GET", url + "/info")
        if status != 200:
            raise MaError("error")
        try:
            body = json.loads(content)
        except ValueError:
            raise MaError("error") from None
        if not isinstance(body, dict):
            raise MaError("error")
        return body

    def call(self, url: str, token: str, command: str, args: dict[str, Any]) -> Any:
        status, content = _bounded("POST", url + "/api", headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                                   content=json.dumps({"message_id": uuid.uuid4().hex[:12], "command": command, "args": args}))
        if status in (401, 403):
            raise MaError("unauthorized")
        try:
            body = json.loads(content) if content else None
        except ValueError:
            raise MaError("error") from None
        if status >= 400:
            code = body.get("error_code") if isinstance(body, dict) else None
            raise MaError("refused" if status == 400 else "error", code if isinstance(code, int) and not isinstance(code, bool) else None)
        if isinstance(body, dict) and "error_code" in body and "result" not in body:
            code = body.get("error_code")
            raise MaError("refused", code if isinstance(code, int) and not isinstance(code, bool) else None)
        return body.get("result") if isinstance(body, dict) and "result" in body and "message_id" in body else body


TRANSPORT: list[Transport] = [HttpTransport()]  # tests put a fake MA server here

# the connection's last word: {"state", "at", "schema", "server", "sticky"} - `sticky` states (unauthorized, schema_too_old) hold until the settings change or a test
_STATE: dict[str, Any] = {"state": None, "at": 0.0, "schema": None, "server": None, "sticky": False}


def reset() -> None:
    """Tests, and every settings change: forget what the server said."""
    _STATE.update(state=None, at=0.0, schema=None, server=None, sticky=False)
    _QUEUES.clear()
    _ITEMS.clear()
    _DONE.clear()


# ------------------------------------------------------------------------------------------------ settings and the token file


def data_dir_of(conn: sqlite3.Connection) -> Path | None:
    """The add-on's data directory: the folder of the main database file (None for an in-memory database)."""
    try:
        row = conn.execute("PRAGMA database_list").fetchone()
    except sqlite3.Error:
        return None
    path = row[2] if row is not None else ""
    return Path(path).parent if path else None


def secret_path(data_dir: Path) -> Path:
    return data_dir / "secrets" / SECRET_NAME


def read_token(data_dir: Path | None) -> str | None:
    if data_dir is None:
        return None
    try:
        text = secret_path(data_dir).read_text(encoding="utf-8").strip()
    except OSError:
        return None
    return text or None


def write_token(data_dir: Path, token: str) -> None:
    """The token, write-only: a 0600 file in a 0700 directory, written through a temporary file renamed into place."""
    p = secret_path(data_dir)
    p.parent.mkdir(parents=True, exist_ok=True)
    try:
        os.chmod(p.parent, 0o700)
    except OSError:
        pass
    tmp = p.with_name(f".{SECRET_NAME}.{_secrets.token_hex(4)}.tmp")
    fd = os.open(str(tmp), os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_BINARY", 0), 0o600)
    try:
        os.write(fd, token.encode("utf-8"))
        os.fsync(fd)
    finally:
        os.close(fd)
    os.replace(tmp, p)


def clear_token(data_dir: Path) -> None:
    try:
        secret_path(data_dir).unlink()
    except OSError:
        pass


def load_config(conn: sqlite3.Connection) -> dict[str, Any]:
    try:
        raw = json.loads(get_setting(conn, CONFIG_KEY) or "{}")
    except ValueError:
        raw = {}
    raw = raw if isinstance(raw, dict) else {}
    return {"enabled": raw.get("enabled") is True, "url": raw.get("url") if isinstance(raw.get("url"), str) else None,
            "token_set_at": raw.get("token_set_at") if isinstance(raw.get("token_set_at"), str) else None,
            "last_test": raw.get("last_test") if isinstance(raw.get("last_test"), dict) else None}


def _save_config(conn: sqlite3.Connection, cfg: dict[str, Any]) -> None:
    set_setting(conn, CONFIG_KEY, json.dumps({k: cfg[k] for k in ("enabled", "url", "token_set_at", "last_test")}, separators=(",", ":")))


_HOST_RE = re.compile(r"[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?")
_IP6_RE = re.compile(r"[0-9a-f:.]{2,45}")


def validate_url(value: Any) -> str:
    """`http(s)://host[:port]` and nothing else: no user-info, path, query or fragment. The normalised form (lower-case scheme and host, no slash)."""
    bad = ApiError(422, "validation", "כתובת השרת: http(s)://שם-מארח:פורט בלבד.", details={"fields": ["url"]})
    if not isinstance(value, str) or not 8 <= len(value.strip()) <= 200 or any(ord(c) < 33 or ord(c) == 127 for c in value.strip()):
        raise bad
    try:
        parts = urlsplit(value.strip())
        port = parts.port
    except ValueError:
        raise bad from None
    host = (parts.hostname or "").lower()
    if parts.scheme.lower() not in ("http", "https") or not host or "@" in parts.netloc or parts.query or parts.fragment or parts.path not in ("", "/") \
            or not (_HOST_RE.fullmatch(host) or (":" in host and _IP6_RE.fullmatch(host))):
        raise bad
    host = f"[{host}]" if ":" in host else host
    return f"{parts.scheme.lower()}://{host}" + (f":{port}" if port is not None else "")


def configured(conn: sqlite3.Connection) -> bool:
    cfg = load_config(conn)
    return bool(cfg["enabled"] and cfg["url"] and read_token(data_dir_of(conn)))


def state(conn: sqlite3.Connection) -> str:
    """`off` (not configured or switched off), else the connection's last word while it holds (`ready` when nothing failed lately)."""
    if not configured(conn):
        return "off"
    s = _STATE["state"]
    if s in ("unauthorized", "schema_too_old") and _STATE["sticky"]:
        return s
    if s in ("unreachable", "error") and MONO() - _STATE["at"] < CIRCUIT_S:
        return s
    return "ready"


def usable(conn: sqlite3.Connection) -> bool:
    """Whether the queue list, queue edits and search are offered now (the device caps `queue_list` / `search`)."""
    return state(conn) == "ready"


def _note(state_: str) -> None:
    _STATE.update(state=state_, at=MONO(), sticky=state_ in ("unauthorized", "schema_too_old"))


def admin_view(conn: sqlite3.Connection) -> dict[str, Any]:
    """`MaConnection` of the settings screen (system.configure only): never the token, the address only here."""
    cfg = load_config(conn)
    ddir = data_dir_of(conn)
    expiring = False
    if cfg["token_set_at"]:
        try:
            set_at = dt.datetime.fromisoformat(cfg["token_set_at"].replace("Z", "+00:00"))
            expiring = (dt.datetime.now(dt.timezone.utc) - set_at).days >= TOKEN_WARN_DAYS
        except ValueError:
            pass
    return {"enabled": cfg["enabled"], "url": cfg["url"], "token_set": read_token(ddir) is not None, "token_set_at": cfg["token_set_at"], "token_expiring": expiring,
            "state": state(conn), "min_schema": MIN_SCHEMA_VERSION, "last_test": cfg["last_test"]}


def update_config(conn: sqlite3.Connection, body: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    """Apply `{enabled?, url?, token?, clear_token?}`; returns (the admin view, what changed for the audit row: names and `set` / `cleared`, never a value)."""
    ddir = data_dir_of(conn)
    if ddir is None:
        raise ApiError(503, "storage_unavailable", "אין מקום לשמירת האסימון.")
    cfg = load_config(conn)
    changed: dict[str, Any] = {}
    if "url" in body:
        url = validate_url(body["url"]) if body["url"] not in (None, "") else None
        if url != cfg["url"]:
            cfg["url"], changed["url_changed"] = url, True
    if body.get("clear_token") is True:
        if read_token(ddir) is not None:
            clear_token(ddir)
            changed["token"] = "cleared"
        cfg["token_set_at"] = None
    elif "token" in body and body["token"] is not None:
        token = body["token"]
        if not isinstance(token, str) or not 16 <= len(token.strip()) <= TOKEN_MAX or any(ord(c) < 33 or ord(c) == 127 for c in token.strip()):
            raise ApiError(422, "validation", "אסימון לא תקין.", details={"fields": ["token"]})
        write_token(ddir, token.strip())
        cfg["token_set_at"] = now_iso()
        changed["token"] = "set"
    if "enabled" in body:
        if not isinstance(body["enabled"], bool):
            raise ApiError(422, "validation", "הערך חייב להיות כן/לא.", details={"fields": ["enabled"]})
        if body["enabled"] != cfg["enabled"]:
            cfg["enabled"], changed["enabled"] = body["enabled"], body["enabled"]
    if cfg["enabled"] and not cfg["url"]:
        raise ApiError(422, "validation", "חיבור ישיר דורש כתובת שרת.", details={"fields": ["url"]})
    if changed:
        cfg["last_test"] = None if ("url_changed" in changed or "token" in changed) else cfg["last_test"]
        _save_config(conn, cfg)
        reset()
    return admin_view(conn), changed


# ------------------------------------------------------------------------------------------------ calls


def _schema_gate(url: str) -> None:
    if _STATE["schema"] is not None:
        return
    info = TRANSPORT[0].info(url)
    schema = info.get("schema_version")
    _STATE["server"] = info.get("server_version") if isinstance(info.get("server_version"), str) else None
    if not isinstance(schema, int) or isinstance(schema, bool):
        raise MaError("error")
    _STATE["schema"] = schema
    if schema < MIN_SCHEMA_VERSION:
        raise MaError("schema_too_old")


def call(conn: sqlite3.Connection, command: str, args: dict[str, Any]) -> Any:
    """One allow-listed command. Raises MaError (`off` when not configured, the circuit's state while it is open). Never retried."""
    if command not in COMMANDS:
        raise CommandRefused(command)
    s = state(conn)
    if s != "ready":
        raise MaError(s)
    cfg = load_config(conn)
    token = read_token(data_dir_of(conn)) or ""
    try:
        _schema_gate(cfg["url"])
        result = TRANSPORT[0].call(cfg["url"], token, command, args)
    except MaError as exc:
        if exc.state != "refused":
            _note(exc.state)
            log.warning("music assistant %s failed: %s", command, exc.state)
        raise
    except Exception as exc:  # noqa: BLE001 - class name only
        _note("error")
        log.warning("music assistant %s failed: %s", command, type(exc).__name__)
        raise MaError("error") from None
    _STATE.update(state="ready", at=MONO(), sticky=False)
    return result


def test_connection(conn: sqlite3.Connection) -> dict[str, Any]:
    """`probe` then `save_test` on one connection (a caller that holds a write lock runs `probe` unlocked itself)."""
    out = probe(conn)
    save_test(conn, out)
    return out


def save_test(conn: sqlite3.Connection, out: dict[str, Any]) -> None:
    cfg = load_config(conn)
    cfg["last_test"] = {"at": now_iso(), **out}
    _save_config(conn, cfg)


def probe(conn: sqlite3.Connection) -> dict[str, Any]:
    """The settings' "בדוק חיבור": the schema gate and a player COUNT (more players than the product manages means the account has no `player_filter`).
    Reads only; `save_test` stores the outcome as `last_test` (no address, no names)."""
    cfg = load_config(conn)
    if not (cfg["url"] and read_token(data_dir_of(conn))):
        out: dict[str, Any] = {"state": "off", "server_version": None, "schema_version": None, "players": None}
    else:
        _STATE.update(state=None, at=0.0, schema=None, sticky=False)
        out = {"state": "ready", "server_version": None, "schema_version": None, "players": None}
        try:
            _schema_gate(cfg["url"])
            players = TRANSPORT[0].call(cfg["url"], read_token(data_dir_of(conn)) or "", "players/all", {})
            out["players"] = len(players) if isinstance(players, list) else None
            _STATE.update(state="ready", at=MONO(), sticky=False)
        except MaError as exc:
            out["state"] = exc.state if exc.state in STATES else "error"
            _note(out["state"])
        except Exception:  # noqa: BLE001
            out["state"] = "error"
            _note("error")
        out["server_version"] = _STATE["server"]
        out["schema_version"] = _STATE["schema"]
    return out


# ------------------------------------------------------------------------------------------------ the queue

QUEUE_TTL_S = 2.0
ITEM_TTL_S = 600.0
PAGE_MAX = 100
_QUEUES: dict[str, tuple[float, dict[str, Any]]] = {}       # player id -> (when, the queue header)
_ITEMS: dict[tuple[str, str, str], dict[str, Any]] = {}     # (user, device key, item) -> {queue_id, queue_item_id, expires}
_DONE: dict[tuple[str, str], tuple[float, int, dict[str, Any]]] = {}  # (user, client_request_id) -> (when, status, answer): idempotency


def _text(value: Any, limit: int = 120) -> str | None:
    return value.strip()[:limit] if isinstance(value, str) and value.strip() else None


def _name_of(value: Any) -> str | None:
    if isinstance(value, list):
        value = value[0] if value else None
    if isinstance(value, dict):
        value = value.get("name")
    return _text(value)


def _int(value: Any) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) and value >= 0 else None


def item_token(key: bytes, queue_id: str, queue_item_id: str) -> str:
    return hmac.new(key, f"q|{queue_id}|{queue_item_id}".encode("utf-8"), hashlib.sha256).hexdigest()[:24]


def header(conn: sqlite3.Connection, player_id: str, *, fresh: bool = False) -> dict[str, Any]:
    """`{queue_id, count, index, buffered, shuffle, repeat}` of the player's ACTIVE queue (MA resolves a synced member to the queue that plays)."""
    hit = _QUEUES.get(player_id)
    if hit and not fresh and MONO() - hit[0] < QUEUE_TTL_S:
        return hit[1]
    q = call(conn, "player_queues/get_active_queue", {"player_id": player_id})
    if not isinstance(q, dict) or not isinstance(q.get("queue_id"), str) or not q["queue_id"]:
        raise MaError("error")
    repeat = q.get("repeat_mode")
    data = {"queue_id": q["queue_id"][:200], "count": _int(q.get("items")), "index": _int(q.get("current_index")), "buffered": _int(q.get("index_in_buffer")),
            "shuffle": q.get("shuffle_enabled") if isinstance(q.get("shuffle_enabled"), bool) else None, "repeat": repeat if repeat in ("off", "one", "all") else None}
    _QUEUES[player_id] = (MONO(), data)
    return data


def locked_to(h: dict[str, Any]) -> int:
    """The last index that may not be moved or deleted (the current item and what MA already buffered); -1 when nothing plays."""
    return max([-1, *(v for v in (h.get("index"), h.get("buffered")) if isinstance(v, int))])


def items(conn: sqlite3.Connection, queue_id: str, offset: int, limit: int) -> list[dict[str, Any]]:
    """`[{queue_item_id, index, name, artist, album, duration_s}]` of one page (raw ids: server-side only)."""
    raw = call(conn, "player_queues/items", {"queue_id": queue_id, "limit": limit, "offset": offset})
    out: list[dict[str, Any]] = []
    for i, it in enumerate(raw if isinstance(raw, list) else []):
        if not isinstance(it, dict) or not isinstance(it.get("queue_item_id"), str):
            continue
        media = it.get("media_item") if isinstance(it.get("media_item"), dict) else {}
        name = _text(it.get("name")) or _text(media.get("name"))
        if name is None:
            continue
        dur = it.get("duration", media.get("duration"))
        out.append({"queue_item_id": it["queue_item_id"][:200], "index": offset + i, "name": name,
                    "artist": _name_of(media.get("artists") or media.get("artist")), "album": _name_of(media.get("album")),
                    "duration_s": int(dur) if isinstance(dur, (int, float)) and not isinstance(dur, bool) and dur > 0 else None})
    return out


def remember(user_id: str, device_key: str, key: bytes, queue_id: str, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Give every row its opaque `item` (remembered for THIS user and device) and return the browser's view (no queue or item id)."""
    now = MONO()
    for k in [k for k, v in _ITEMS.items() if v["expires"] < now]:
        del _ITEMS[k]
    out = []
    for r in rows:
        tok = item_token(key, queue_id, r["queue_item_id"])
        _ITEMS[(user_id, device_key, tok)] = {"queue_id": queue_id, "queue_item_id": r["queue_item_id"], "expires": now + ITEM_TTL_S}
        out.append({"item": tok, **{k: r[k] for k in ("index", "name", "artist", "album", "duration_s")}})
    while len(_ITEMS) > 5000:
        _ITEMS.pop(next(iter(_ITEMS)))
    return out


def resolve(user_id: str, device_key: str, token: Any) -> dict[str, Any] | None:
    if not isinstance(token, str) or not re.fullmatch(r"[a-f0-9]{24}", token):
        return None
    hit = _ITEMS.get((user_id, device_key, token))
    if hit is None or hit["expires"] < MONO():
        _ITEMS.pop((user_id, device_key, token), None)
        return None
    return hit


def forget_queue(player_id: str) -> None:
    _QUEUES.pop(player_id, None)


def done(user_id: str, crid: str) -> tuple[int, dict[str, Any]] | None:
    hit = _DONE.get((user_id, crid))
    return (hit[1], hit[2]) if hit and MONO() - hit[0] < 120.0 else None


def note_done(user_id: str, crid: str, status: int, answer: dict[str, Any]) -> None:
    now = MONO()
    _DONE[(user_id, crid)] = (now, status, answer)
    if len(_DONE) > 1000:
        for k in [k for k, v in _DONE.items() if now - v[0] > 120.0]:
            del _DONE[k]


# ------------------------------------------------------------------------------------------------ search

SEARCH_KEYS = {"track": "tracks", "album": "albums", "artist": "artists", "playlist": "playlists", "radio": "radio"}


def search(conn: sqlite3.Connection, media_type: str, query: str, limit: int = 50) -> list[dict[str, Any]]:
    """`music/search` in the library of one media type: `[{uri, media_type, name, artist}]` (the caller filters the URIs it may play)."""
    raw = call(conn, "music/search", {"search_query": query, "media_types": [media_type], "limit": limit, "library_only": True})
    lst = raw.get(SEARCH_KEYS[media_type]) if isinstance(raw, dict) else None
    out: list[dict[str, Any]] = []
    for it in lst if isinstance(lst, list) else []:
        if not isinstance(it, dict):
            continue
        name = _text(it.get("name"))
        if name is None:
            continue
        out.append({"uri": it.get("uri"), "media_type": it.get("media_type"), "name": name, "artist": _name_of(it.get("artists") or it.get("artist"))})
        if len(out) >= limit:
            break
    return out
