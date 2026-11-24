"""MFA-TOKENS-2490 (slice 6 of the MFA train, docs/changes/MFA-TOKENS-2490.md): which access token a remote bearer caller uses, and the
user's own token list.

Owner decision Q48 (2026-11-22): a long-lived token from outside stays ALLOWED while step-up is on. Slice 1 could not tell a long-lived
token from a normal sign-in's short-lived access token on the bearer path, so it exempted every bearer caller from step-up. This module
tells them apart, and services/step_up.py exempts only the long-lived ones (a short-lived bearer caller is gated like a session).

How the kind is known. Every Home Assistant access token is a JWT that HA signs with a key of the refresh token behind it: `iss` (that
refresh token's id), `iat`, `exp`. The bearer path asks HA to accept the token (ha_user_auth.validate_token) BEFORE a session exists, so
once a session exists its token's claims are HA's own - a client cannot stretch them without HA's key. A normal sign-in's access token
lives 30 minutes (HA's ACCESS_TOKEN_EXPIRATION); a long-lived access token lives its `lifespan` in days (default 3650). So:
`exp - iat >= LONG_LIVED_MIN_S` (12 hours) = long_lived; shorter = short_lived; no usable claims = unknown, which is gated like
short_lived (fail closed). HA's own `auth/refresh_tokens` type is read only for the list (read-only, the caller's own token).

What Arx keeps: `remote_token_uses` (migration 0219): one row per HA sign-in seen on the bearer path (hashed key, kind, first / last
seen, masked address, client family). The first sighting writes ONE audit row `auth.token.first_use` (design T6: "an audit row on every
first use of a token from outside"); later sightings only update the row (at most every PERSIST_EVERY_S per token).

What Arx never does: create, change or revoke a Home Assistant token or user. The list shows HA's tokens read-only with where to delete
them in Home Assistant; only the tokens Arx itself issues (the phone app's saved sign-ins, services/app_refresh) can be revoked here.
"""
from __future__ import annotations

import asyncio
import datetime as dt
import hashlib
import json
import logging
import threading
import time
from typing import Any
from urllib.parse import urlparse

log = logging.getLogger("smplwise.access_tokens")

KIND_LONG = "long_lived"
KIND_SHORT = "short_lived"
KIND_UNKNOWN = "unknown"
KIND_APP = "app"  # a token Arx issued itself (the phone app's saved sign-in, an app refresh-token family)
LONG_LIVED_MIN_S = 12 * 3600  # HA: a normal access token lives 1800 s; a long-lived one at least a day
PERSIST_EVERY_S = 600.0  # a token already recorded is written again at most this often (last seen, address)
MAX_TRACKED = 5000  # the in-memory "last written" map is bounded (the oldest tenth goes first)
HA_TIMEOUT_S = 8.0
HA_ROWS_MAX = 50
HA_ID_PREFIX = "ha_"

HA_TYPES = {"long_lived_access_token": KIND_LONG, "normal": KIND_SHORT}  # HA's RefreshToken.token_type; `system` tokens are not users'

TOKEN_READ_ONLY_HE = "את האסימון הזה יצר Home Assistant, ו־Arx אינו משנה או מבטל אותו. מבטלים אותו ב־Home Assistant: פרופיל › אבטחה."
NOT_FOUND_HE = "האסימון לא נמצא או שכבר בוטל."


# ---------------------------------------------------------------- the kind of a bearer token

def _claims(token: str) -> dict[str, Any] | None:
    from .ha_user_auth import _jwt_payload

    return _jwt_payload(token) if isinstance(token, str) else None


def kind_of(token: str) -> str:
    """long_lived | short_lived | unknown, from the lifetime HA gave the token (`exp - iat`). Only meaningful for a token HA accepted."""
    payload = _claims(token)
    if not payload:
        return KIND_UNKNOWN
    iat, exp = payload.get("iat"), payload.get("exp")
    if not isinstance(iat, (int, float)) or not isinstance(exp, (int, float)) or isinstance(iat, bool) or isinstance(exp, bool) or exp <= iat:
        return KIND_UNKNOWN
    return KIND_LONG if exp - iat >= LONG_LIVED_MIN_S else KIND_SHORT


def exempt(kind: str) -> bool:
    """Owner decision Q48: only a long-lived token skips step-up."""
    return kind == KIND_LONG


def session_kind(request: Any) -> str:
    """The token kind of the remote bearer session the current request runs under ("" when it is not a bearer session)."""
    from . import ha_user_auth as hua

    s = hua.session_of(request)
    if s is None or getattr(s, "via", "") != "bearer":
        return ""
    return getattr(s, "token_kind", "") or KIND_UNKNOWN


# ---------------------------------------------------------------- what Arx has seen (remote_token_uses)

def key_of(s: Any) -> str:
    """The row key of a bearer session: the hashed refresh-token id (every access token of one HA sign-in), else the token's hash."""
    return getattr(s, "iss_hash", "") or getattr(s, "token_key", "") or ""


def public_id(key: str) -> str:
    """What the list shows and DELETE takes for an HA token: never the key itself."""
    return HA_ID_PREFIX + hashlib.sha256(("token:" + key).encode("utf-8", "replace")).hexdigest()[:20]


def ha_key(refresh_token_id: str) -> str:
    """The key of an HA refresh token by its id - the same hash as ha_user_auth.iss_hash (`iss:` + id)."""
    return hashlib.sha256(("iss:" + refresh_token_id).encode("utf-8", "replace")).hexdigest()


_LOCK = threading.Lock()
_WRITTEN: dict[str, float] = {}  # token key -> when its row was last written by this process


def _due(key: str, first: bool, now: float) -> bool:
    with _LOCK:
        if not first and now - _WRITTEN.get(key, 0.0) < PERSIST_EVERY_S:
            return False
        if key not in _WRITTEN and len(_WRITTEN) >= MAX_TRACKED:
            for k in list(_WRITTEN)[: MAX_TRACKED // 10]:
                _WRITTEN.pop(k, None)
        _WRITTEN.pop(key, None)
        _WRITTEN[key] = now
    return True


def reset_for_tests() -> None:
    with _LOCK:
        _WRITTEN.clear()


def _iso(ts: float) -> str:
    return dt.datetime.fromtimestamp(ts, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def note_bearer_use(db: Any, s: Any, *, first: bool, request_id: str | None = None) -> bool:
    """Record that the bearer session `s` was used from outside. `first`: a new session (a new access token) - always written; else
    (a re-validated session) at most every PERSIST_EVERY_S. The token's FIRST sighting ever writes one `auth.token.first_use` audit row.
    Never raises (before migration 0219 there is nothing to write); returns True when this was the first sighting."""
    key = key_of(s)
    if not key or getattr(s, "via", "") != "bearer":
        return False
    now = time.time()
    if not _due(key, first, now):
        return False
    from ..audit import audit
    from .ha_user_auth import agent_family, mask_address

    kind = getattr(s, "token_kind", "") or KIND_UNKNOWN
    address = mask_address(getattr(s, "last_ip", "") or getattr(s, "client_ip", "")) or None
    country = (getattr(s, "country", "") or "")[:8] or None
    agent = agent_family(getattr(s, "user_agent", "") or "")[:60] or None
    at = _iso(now)
    try:
        with db.connection(label="remote token use") as conn:
            found = conn.execute("SELECT 1 FROM remote_token_uses WHERE token_key = ?", (key,)).fetchone()
            if found is None:
                conn.execute("""INSERT INTO remote_token_uses(token_key, user_id, kind, first_seen_at, last_seen_at, last_address, last_country, agent)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?)""", (key, s.principal.user_id, kind, at, at, address, country, agent))
                audit(conn, actor=s.principal, action="auth.token.first_use", decision="allowed", resource_type="token", resource_id=public_id(key),
                      request_id=request_id, details={"kind": kind, "address": address, "country": country, "agent": agent})
                return True
            conn.execute("""UPDATE remote_token_uses SET last_seen_at = ?, last_address = COALESCE(?, last_address), last_country = COALESCE(?, last_country),
                            agent = COALESCE(?, agent), uses = uses + 1 WHERE token_key = ?""", (at, address, country, agent, key))
    except Exception:  # noqa: BLE001 - a database before 0219, a busy database: the request is served anyway
        log.warning("could not record a remote token use", exc_info=True)
    return False


def seen_rows(conn: Any, user_id: str) -> dict[str, dict[str, Any]]:
    """The user's recorded bearer tokens by key."""
    try:
        rows = conn.execute("SELECT * FROM remote_token_uses WHERE user_id = ? ORDER BY last_seen_at DESC LIMIT 200", (user_id,)).fetchall()
    except Exception:  # noqa: BLE001 - before migration 0219
        return {}
    return {r["token_key"]: dict(r) for r in rows}


def active_app_devices(conn: Any, user_id: str) -> list[str]:
    """The devices of the user's live app sign-ins (`DELETE auth/tokens` releases their key pins). RELEASE-2510-TRAIN: moved out of the
    router (the SQL boundary of CR-ROUTER-SQL-C-2450, `test_wire_routers_d_2470`)."""
    try:
        rows = conn.execute("SELECT device_id FROM app_refresh_families WHERE user_id = ? AND revoked_at IS NULL", (user_id,)).fetchall()
    except Exception:  # noqa: BLE001 - before migration 0146
        return []
    return [r["device_id"] for r in rows]


# ---------------------------------------------------------------- Home Assistant's own list (read-only)

async def ha_refresh_tokens(settings: Any, token: str) -> list[dict[str, Any]] | None:
    """HA's `auth/refresh_tokens` for the owner of `token` (the caller's own HA access token), or None when HA could not be asked.
    READ-ONLY: the one command sent after `auth` is the listing; nothing is created, changed or deleted at HA."""
    from . import ha_user_auth as hua

    try:
        ws = await hua._dial(hua.core_ws_url(settings), {})
    except Exception:  # noqa: BLE001
        return None
    try:
        async with asyncio.timeout(HA_TIMEOUT_S):
            if json.loads(await ws.recv()).get("type") != "auth_required":
                return None
            await ws.send(json.dumps({"type": "auth", "access_token": token}))
            if json.loads(await ws.recv()).get("type") != "auth_ok":
                return None
            await ws.send(json.dumps({"id": 1, "type": "auth/refresh_tokens"}))
            while True:
                msg = json.loads(await ws.recv())
                if msg.get("id") == 1 and msg.get("type") == "result":
                    break
            result = msg.get("result")
            if not msg.get("success") or not isinstance(result, list):
                return None
            return [t for t in result if isinstance(t, dict)]
    except Exception:  # noqa: BLE001 - HA away, a dropped socket, a changed shape
        return None
    finally:
        try:
            await ws.close()
        except Exception:  # noqa: BLE001
            pass


def _norm_time(value: Any) -> str | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        d = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if d.tzinfo is None:
        d = d.replace(tzinfo=dt.timezone.utc)
    return d.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _client_of(client_id: Any) -> str | None:
    """A normal sign-in's client as a host name (HA's client ids are URLs); never a path or a query."""
    if not isinstance(client_id, str) or not client_id:
        return None
    host = urlparse(client_id).hostname
    return host[:80] if host else None


def _text(value: Any, limit: int = 80) -> str | None:
    if not isinstance(value, str):
        return None
    text = " ".join(value.split())
    text = "".join(c for c in text if ord(c) >= 32 and ord(c) != 127)
    return text[:limit] or None


def _seen_fields(row: dict[str, Any] | None) -> dict[str, Any]:
    if row is None:
        return {"used_in_arx": False, "arx_first_seen_at": None, "arx_last_seen_at": None, "arx_address": None, "arx_agent": None}
    return {"used_in_arx": True, "arx_first_seen_at": row["first_seen_at"], "arx_last_seen_at": row["last_seen_at"],
            "arx_address": row["last_address"], "arx_agent": row["agent"]}


def ha_rows(listing: list[dict[str, Any]], seen: dict[str, dict[str, Any]], current_key: str) -> list[dict[str, Any]]:
    """HA's refresh tokens of the user as list rows: long-lived tokens first, then sign-ins by last use. No HA id leaves the server."""
    out = []
    for t in listing:
        kind = HA_TYPES.get(str(t.get("type") or ""))
        rid = t.get("id")
        if kind is None or not isinstance(rid, str) or not rid:
            continue
        key = ha_key(rid)
        out.append({"id": public_id(key), "source": "ha", "kind": kind, "name": _text(t.get("client_name")),
                    "client": None if kind == KIND_LONG else _client_of(t.get("client_id")),
                    "created_at": _norm_time(t.get("created_at")), "last_used_at": _norm_time(t.get("last_used_at")),
                    "expires_at": None, "current": bool(current_key) and key == current_key, "revocable": False,
                    **_seen_fields(seen.get(key))})
    out.sort(key=lambda r: (r["kind"] != KIND_LONG, -(_epoch(r["last_used_at"] or r["arx_last_seen_at"] or r["created_at"]))))
    return out[:HA_ROWS_MAX]


def seen_only_rows(seen: dict[str, dict[str, Any]], current_key: str) -> list[dict[str, Any]]:
    """HA could not be asked: what Arx itself saw on the bearer path."""
    out = []
    for key, r in seen.items():
        out.append({"id": public_id(key), "source": "arx", "kind": r["kind"] if r["kind"] in (KIND_LONG, KIND_SHORT) else KIND_UNKNOWN,
                    "name": None, "client": None, "created_at": None, "last_used_at": None, "expires_at": None,
                    "current": bool(current_key) and key == current_key, "revocable": False, **_seen_fields(r)})
    out.sort(key=lambda r: (r["kind"] != KIND_LONG, -_epoch(r["arx_last_seen_at"])))
    return out[:HA_ROWS_MAX]


def _epoch(value: str | None) -> float:
    if not value:
        return 0.0
    try:
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
    except ValueError:
        return 0.0


def app_rows(conn: Any, user_id: str) -> list[dict[str, Any]]:
    """The tokens Arx itself issued to this user: the phone app's live saved sign-ins (app refresh-token families). Revocable."""
    from . import app_refresh

    try:
        families = app_refresh.list_families(conn, user_id)
    except Exception:  # noqa: BLE001 - before migration 0146
        return []
    out = []
    for f in families:
        ends = min((x for x in (f.get("idle_expires_at"), f.get("absolute_expires_at")) if x), default=None)
        out.append({"id": f["family_id"], "source": "arx", "kind": KIND_APP, "name": _text(f.get("device_name")), "client": _text(f.get("platform"), 40),
                    "created_at": f.get("created_at"), "last_used_at": f.get("last_used_at"), "expires_at": ends, "current": False, "revocable": True,
                    **_seen_fields(None)})
    out.sort(key=lambda r: -_epoch(r["last_used_at"]))
    return out


from ..test_reset import register_reset  # noqa: E402 - imports nothing from the package

register_reset(__name__, ("_WRITTEN",), reset_for_tests)
