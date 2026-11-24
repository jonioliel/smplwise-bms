"""MFA-POLICY-2490 (slice 5 of the second-factor train, design docs/design/full-2fa-t095/DESIGN.md 4.1 / 9): Home Assistant MFA
with provenance - when a remote sign-in may count HA's own second factor as the factor the sign-in policy asks for.

HA access tokens carry no MFA claim, so the proof is inferred (CR-011 option A) from two READ-ONLY WebSocket calls made with the
user's own access token (never an HA write, never another user's data):

1. `auth/current_user` (already asked by every validation, services/ha_user_auth.validate_token) lists an ENABLED MFA module;
2. `auth/refresh_tokens` lists the refresh token behind this access token (its id is the token's `iss`) with
   `type = normal` (not a long-lived token, not a system token), `client_id` = this Arx address (the OAuth client the Arx sign-in
   page used), `auth_provider_type = homeassistant`, and `created_at` NOT EARLIER than the first moment Arx saw MFA enabled for
   that user (`auth_mfa_seen`, migration 0221). HA's own login flow asked the code for that sign-in then.

`auth_mfa_seen` is kept by `observe()` from every validation Arx makes anyway (the exchange, a new bearer sign-in, the background
re-validation of live sessions): a row while HA reports an enabled module, deleted as soon as HA reports none (so MFA switched off
and on again starts a fresh `first_seen_at`, and a token created while it was off never counts). Writes are throttled in memory.

Failure modes (design 9): HA unreachable while a check is needed -> `HaUnavailable` (the caller fails CLOSED for a user the policy
covers); a listing whose shape is not the expected one -> verdict `shape_unknown` (never a silent pass - the Arx factor is asked).
Nothing here logs or stores a token, a refresh-token id or a code; the verdict carries a reason word only.
"""
from __future__ import annotations

import datetime as dt
import json
import logging
import sqlite3
import threading
import time
from dataclasses import dataclass
from typing import Any

log = logging.getLogger("smplwise.mfa_provenance")

TOKEN_NORMAL = "normal"
TOKEN_LONG_LIVED = "long_lived_access_token"
PROVIDER_HA = "homeassistant"
OBSERVE_EVERY_S = 3600.0  # an unchanged observation is written at most once an hour per user (last_seen_at)
CHECK_TIMEOUT_S = 10.0

# verdict reasons (a word for the audit row and the change note; never an id)
OK = "ok"
NO_HA_MFA = "no_ha_mfa"  # auth/current_user lists no enabled module now
NO_MFA_SEEN = "no_mfa_seen"  # Arx has no record of seeing MFA enabled for this user
NO_ISS = "no_iss"  # the access token names no refresh token
SHAPE_UNKNOWN = "shape_unknown"  # the listing is not the expected shape (HA changed it): never a pass
NOT_FOUND = "not_found"  # the token's refresh token is not in the user's own listing
LONG_LIVED = "long_lived"  # a long-lived access token from the HA profile: no login flow, no code
NOT_NORMAL = "not_normal"  # a system token or another type
OTHER_CLIENT = "other_client"  # a sign-in of another client (the Companion app, HA's own UI)
OTHER_PROVIDER = "other_provider"  # not HA's own user/password provider (trusted networks, command line...)
BEFORE_MFA_SEEN = "before_mfa_seen"  # the sign-in is older than the first moment Arx saw MFA enabled


@dataclass(frozen=True)
class Verdict:
    ok: bool
    reason: str
    token_type: str = ""  # HA's refresh-token type when the listing named it ("" otherwise)


def _now_iso() -> str:
    """Microsecond precision (db.now_iso drops it): `first_seen_at` is compared with HA's own `created_at`."""
    return dt.datetime.now(dt.timezone.utc).isoformat()


def parse_instant(raw: Any) -> dt.datetime | None:
    """An ISO 8601 instant with a zone (HA writes `+00:00`, Arx `Z`), else None. A naive value is not trusted."""
    if not isinstance(raw, str) or not raw or len(raw) > 64:
        return None
    try:
        value = dt.datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None
    return value if value.tzinfo is not None else None


# ---------------------------------------------------------------- auth_mfa_seen

class _Observed:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._last: dict[str, tuple[bool, float]] = {}

    def due(self, user_id: str, mfa: bool) -> bool:
        now = time.monotonic()
        with self._lock:
            prev = self._last.get(user_id)
            if prev is not None and prev[0] == mfa and now - prev[1] < OBSERVE_EVERY_S:
                return False
            self._last[user_id] = (mfa, now)
            if len(self._last) > 20000:
                self._last.clear()
            return True

    def forget(self, user_id: str | None = None) -> None:
        with self._lock:
            if user_id is None:
                self._last.clear()
            else:
                self._last.pop(user_id, None)


OBSERVED = _Observed()


def note(conn: sqlite3.Connection, user_id: str, mfa: bool, modules: tuple[str, ...] | list[str] = ()) -> None:
    """Record what HA reports now: an enabled module -> keep / start the row; none -> drop it (a later re-enable starts afresh)."""
    if not mfa:
        conn.execute("DELETE FROM auth_mfa_seen WHERE user_id = ?", (user_id,))
        return
    now = _now_iso()
    mods = json.dumps(sorted({str(m)[:40] for m in modules if m})[:10])
    conn.execute(
        "INSERT INTO auth_mfa_seen(user_id, first_seen_at, last_seen_at, modules_json) VALUES (?, ?, ?, ?) "
        "ON CONFLICT(user_id) DO UPDATE SET last_seen_at = excluded.last_seen_at, modules_json = excluded.modules_json",
        (user_id, now, now, mods))


def observe(db: Any, ha_user: Any) -> None:
    """`note()` on a short connection of its own, throttled; never raises (bookkeeping never breaks a sign-in)."""
    uid = getattr(ha_user, "id", "")
    mfa = bool(getattr(ha_user, "mfa", False))
    if not uid or not OBSERVED.due(uid, mfa):
        return
    try:
        with db.connection(label="auth mfa seen") as conn:
            note(conn, uid, mfa, tuple(getattr(ha_user, "mfa_modules", ()) or ()))
    except sqlite3.OperationalError:  # before migration 0221
        OBSERVED.forget(uid)
    except Exception:  # noqa: BLE001
        OBSERVED.forget(uid)
        log.warning("could not record the HA MFA observation", exc_info=True)


def seen(conn: sqlite3.Connection, user_id: str) -> sqlite3.Row | None:
    try:
        return conn.execute("SELECT * FROM auth_mfa_seen WHERE user_id = ?", (user_id,)).fetchone()
    except sqlite3.OperationalError:  # before migration 0221
        return None


def seen_users(conn: sqlite3.Connection) -> dict[str, str]:
    """user id -> first_seen_at for every user Arx saw with HA MFA enabled (the compliance view)."""
    try:
        return {r["user_id"]: r["first_seen_at"] for r in conn.execute("SELECT user_id, first_seen_at FROM auth_mfa_seen").fetchall()}
    except sqlite3.OperationalError:
        return {}


# ---------------------------------------------------------------- the verdict (pure: the test matrix runs it on fake shapes)

def evaluate(listing: Any, *, iss: str | None, client_id: str, first_seen_at: str | None, ha_mfa: bool = True) -> Verdict:
    """Does the refresh token `iss` in HA's `auth/refresh_tokens` answer prove a sign-in through HA's login flow with MFA on?"""
    if not ha_mfa:
        return Verdict(False, NO_HA_MFA)
    if not iss:
        return Verdict(False, NO_ISS)
    if not isinstance(listing, list) or not all(isinstance(t, dict) for t in listing):
        return Verdict(False, SHAPE_UNKNOWN)
    mine = [t for t in listing if t.get("id") == iss]
    if not mine:
        return Verdict(False, NOT_FOUND)
    if len(mine) > 1:
        return Verdict(False, SHAPE_UNKNOWN)
    entry = mine[0]
    token_type = entry.get("type")
    if not isinstance(token_type, str) or not token_type:
        return Verdict(False, SHAPE_UNKNOWN)
    if token_type == TOKEN_LONG_LIVED:
        return Verdict(False, LONG_LIVED, token_type)
    if token_type != TOKEN_NORMAL:
        return Verdict(False, NOT_NORMAL, token_type)
    if "client_id" not in entry or "auth_provider_type" not in entry or "created_at" not in entry:
        return Verdict(False, SHAPE_UNKNOWN, token_type)
    if not client_id or entry.get("client_id") != client_id:
        return Verdict(False, OTHER_CLIENT, token_type)
    if entry.get("auth_provider_type") != PROVIDER_HA:
        return Verdict(False, OTHER_PROVIDER, token_type)
    created = parse_instant(entry.get("created_at"))
    if created is None:
        return Verdict(False, SHAPE_UNKNOWN, token_type)
    seen_at = parse_instant(first_seen_at)
    if seen_at is None:
        return Verdict(False, NO_MFA_SEEN, token_type)
    if created < seen_at:
        return Verdict(False, BEFORE_MFA_SEEN, token_type)
    return Verdict(True, OK, token_type)


def token_type_of(listing: Any, iss: str | None) -> str:
    """HA's type of the refresh token `iss` in a listing ("" when the listing does not name it clearly)."""
    if not iss or not isinstance(listing, list):
        return ""
    mine = [t for t in listing if isinstance(t, dict) and t.get("id") == iss]
    if len(mine) != 1:
        return ""
    value = mine[0].get("type")
    return value if isinstance(value, str) else ""


# ---------------------------------------------------------------- the HA read (read-only WebSocket, the user's own token)

class ShapeDrift(Exception):
    """HA answered, but not with a list of refresh tokens."""


async def read_refresh_tokens(settings: Any, token: str) -> list[dict[str, Any]]:
    """HA's `auth/refresh_tokens` answer for the token's own user. HaUnavailable when HA cannot be asked (or refuses the token),
    ShapeDrift when the answer is not a list. Read-only: no other command is sent."""
    from . import ha_user_auth as hua

    try:
        ws = await hua._dial(hua.core_ws_url(settings), {})
    except Exception as exc:  # noqa: BLE001
        raise hua.HaUnavailable(type(exc).__name__) from exc
    try:
        import asyncio

        async with asyncio.timeout(CHECK_TIMEOUT_S):
            hello = json.loads(await ws.recv())
            if hello.get("type") != "auth_required":
                raise hua.HaUnavailable("unexpected hello")
            await ws.send(json.dumps({"type": "auth", "access_token": token}))
            if json.loads(await ws.recv()).get("type") != "auth_ok":
                raise hua.HaUnavailable("auth refused")
            await ws.send(json.dumps({"id": 1, "type": "auth/refresh_tokens"}))
            while True:
                msg = json.loads(await ws.recv())
                if msg.get("id") == 1 and msg.get("type") == "result":
                    break
        if not msg.get("success"):
            raise ShapeDrift("auth/refresh_tokens failed")
        result = msg.get("result")
        if not isinstance(result, list):
            raise ShapeDrift("not a list")
        return result
    except (hua.HaUnavailable, ShapeDrift):
        raise
    except Exception as exc:  # noqa: BLE001 - a dropped socket, a timeout, a malformed frame
        raise hua.HaUnavailable(type(exc).__name__) from exc
    finally:
        try:
            await ws.close()
        except Exception:  # noqa: BLE001
            pass


async def check(settings: Any, token: str, *, client_id: str, first_seen_at: str | None, ha_mfa: bool) -> Verdict:
    """The provenance verdict of `token` (HaUnavailable propagates: the caller decides fail-closed). HA is asked only when the
    answer can still be a pass, or when the token type is wanted (`ha_mfa` False still reads it for the long-lived-token rule)."""
    from . import ha_user_auth as hua

    iss = hua.jwt_iss(token)
    try:
        listing = await read_refresh_tokens(settings, token)
    except ShapeDrift:
        return Verdict(False, SHAPE_UNKNOWN)
    return evaluate(listing, iss=iss, client_id=client_id, first_seen_at=first_seen_at, ha_mfa=ha_mfa) if ha_mfa else \
        Verdict(False, NO_HA_MFA, token_type_of(listing, iss))


def reset_for_tests() -> None:
    OBSERVED.forget()
