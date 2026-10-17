"""CR-040 (WXROT): the add-on's half of the bridge trust-key rotation - one ATOMIC switch, owned by the bridge (bridge 0.9.1,
custom_components/smplwise_bridge/trust.py). Owner / lead decisions of 2026-10-13 (docs/changes/CR-040-KEY-ROTATION.md section 0).

- Who: a holder of `access.trust.rotate` (sensitive, installation scope, any role may carry it), in an interactive session, on the
  local channel, after an explicit confirmation (routers/bridge_trust.py). Events only: nothing here starts a rotation by itself.
- How: Arx derives the next key exactly as the bridge does (HKDF-SHA256 from the current key, a 32-byte random salt, the epoch and the
  request id - no key travels), writes the request row (`dispatching`, the open slot) and the pending key in one transaction and
  COMMITS them before the signed `trust_rotate` leaves (two-phase: after a crash the row reads "may have been dispatched"). An answer
  `rotated` whose proof verifies under the next key switches Arx in one transaction (`bridge.secret` = the next key, the epoch, the
  row); a definite refusal or a request that never left keeps the current key (`not_rotated`); anything else is `unknown`.
- Requests in the middle: while a row is open, `refuse_while_rotating` - called by `ha_bridge.signing_key`, the one place every signed
  call takes the key from - refuses with a clear message and `outcome: not_sent`; nothing is queued or retried. The discovery
  announcement (it carries the pairing code to Home Assistant) is skipped while a row is open.
- UNKNOWN is resolved only by the bridge's status read, never by sending the rotation again: a query signed with the pending key that
  the bridge accepts means the bridge holds it (`rotated`); otherwise a query signed with the current key that it accepts means it
  still holds that one (`not_rotated` - the bridge fenced the request id durably, so it can never apply later); neither key accepted
  stays `unknown` (`neither_key`: re-pairing is needed). A manual check, or the janitor (first check after the message's lifetime,
  then at most once a minute). A resolved row never re-opens and no row is ever deleted (migration 0115 triggers).
- Records: the audit holds the logical initiator (the actor), the request id, the non-secret epochs and the outcome / code. No key,
  pending key, salt, proof, nonce, signature, signed text or hash of any of them is logged, audited, stored in the table or served.
  Nothing here touches an anchor, a capability or a mapping, and nothing claims a capability survives a rotation (NOT_PROVEN)."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import re
import secrets
import sqlite3
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from ..config import Settings
from ..db import Database, get_setting, now_iso, set_setting, unlocked
from ..errors import ApiError
from . import ha_bridge, ha_client

log = logging.getLogger(__name__)

PERMISSION = "access.trust.rotate"
MIN_BRIDGE_FOR_ROTATION = "0.9.1"  # the first bridge with trust_rotate / trust_status (the MIN_BRIDGE_FOR_TRUSTED_PATH precedent)
PROTOCOL = "smplwise-bridge-trust-v1"
SERVICE_ROTATE = "trust_rotate"
SERVICE_STATUS = "trust_status"
LIFETIME_S = 30
HISTORY = 20
SAFE_INT = 2**53 - 1

SETTINGS_PREFIX = "bridge.trust."  # never exported, never restored (services/backup.py SETTINGS_KEEP_PREFIXES)
EPOCH_KEY = "bridge.trust.epoch"
PENDING_KEY = "bridge.trust.pending_key"
EPOCH_SEEN_KEY = "bridge.trust.epoch_seen"
SEEN_AT_KEY = "bridge.trust.seen_at"
CAPABLE_KEY = "bridge.trust.capable"

OPEN_STATES = ("dispatching", "unknown")
TERMINAL_STATES = ("rotated", "not_rotated", "superseded")
NOT_SENT_ERRORS = frozenset({"ConnectError", "ConnectTimeout", "PoolTimeout"})  # the connection was never made: nothing left
FIRST_AUTOMATIC_CHECK_S = LIFETIME_S + 5
AUTOMATIC_EVERY_S = 60
STATUS_PER_MIN = 6
SYSTEM_ACTOR = ("arx-system", "Arx")
_CODE = re.compile(r"^[a-z_]{1,40}$")
_CTRL = re.compile(r"[\x00-\x1f\x7f-\x9f]")

GATE_MESSAGE = "הפעולה לא נשלחה: מפתח האבטחה של החיבור לתשתית המערכת מוחלף כרגע. נסו שוב בעוד רגע."
MESSAGES = {
    "rotated": "המפתח הוחלף. Arx והגשר עברו יחד לדור {epoch}.",
    "not_rotated": "המפתח לא הוחלף; המפתח הקודם נשאר בתוקף. דבר לא נשלח שוב.",
    "unknown": "לא ידוע אם המפתח הוחלף. הפעולות דרך הגשר מושהות עד שבדיקת המצב תברר זאת; הבקשה לא תישלח שוב.",
    "superseded": "צימוד מחדש החליף את הבקשה.",
}

_IN_FLIGHT: set[str] = set()  # request ids this process is waiting on (a status check of one of them is refused)
_IN_FLIGHT_LOCK = threading.Lock()
_CHECK_LOCK = threading.Lock()  # one status check at a time (the manual one and the janitor's)
_HITS: dict[str, list[float]] = {}
_HITS_LOCK = threading.Lock()


def utcnow() -> datetime:
    """The add-on's clock for the signed messages (a seam for tests)."""
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------- derivation (byte-identical to the bridge's trust.py)

def hkdf_sha256(ikm: bytes, salt: bytes, info: bytes, length: int = 32) -> bytes:
    """RFC 5869 HKDF with SHA-256."""
    if length <= 0 or length > 255 * 32:
        raise ValueError("length")
    prk = hmac.new(salt if salt else b"\x00" * 32, ikm, hashlib.sha256).digest()
    out, block, counter = b"", b"", 1
    while len(out) < length:
        block = hmac.new(prk, block + info + bytes([counter]), hashlib.sha256).digest()
        out += block
        counter += 1
    return out[:length]


def derive_next_key(current_key: str, salt_hex: str, epoch_to: int, request_id: str) -> str:
    info = f"{PROTOCOL}|epoch|{epoch_to}|{request_id}".encode("utf-8")
    okm = hkdf_sha256(current_key.encode("utf-8"), bytes.fromhex(salt_hex), info, 32)
    return base64.urlsafe_b64encode(okm).rstrip(b"=").decode("ascii")


def proof(key: str, kind: str, *fields: Any) -> str:
    text = "|".join([PROTOCOL, kind, *(str(f) for f in fields)])
    return hmac.new(key.encode("utf-8"), text.encode("utf-8"), hashlib.sha256).hexdigest()


# ---------------------------------------------------------------- state

def open_row(conn: sqlite3.Connection) -> sqlite3.Row | None:
    """The one open request (`dispatching` or `unknown`), or None. A database before 0115 has none."""
    try:
        return conn.execute("SELECT * FROM bridge_trust_rotations WHERE open_slot = 1").fetchone()
    except sqlite3.OperationalError:
        return None


def refuse_while_rotating(conn: sqlite3.Connection) -> None:
    """The gate (CR-040 section 6): no signed call is built while a rotation is open - refused here, before anything is sent, with
    a clear message and no retry. ha_bridge.signing_key calls it for every caller."""
    if open_row(conn) is not None:
        raise ApiError(409, "bridge_rotation_in_progress", GATE_MESSAGE, details={"outcome": "not_sent", "reason": "trust_rotation"})


def epoch(conn: sqlite3.Connection) -> int:
    """Arx's mirror of the bridge's trust epoch (1 for a pairing made before bridge 0.9.1)."""
    raw = get_setting(conn, EPOCH_KEY)
    try:
        value = int(raw) if raw else 1
    except ValueError:
        value = 1
    return value if 1 <= value <= SAFE_INT else 1


def _version_tuple(v: str) -> tuple[int, ...]:
    out = []
    for part in v.split("."):
        digits = re.match(r"\d+", part)
        out.append(int(digits.group(0)) if digits else 0)
    return tuple(out)


def bridge_version(conn: sqlite3.Connection) -> str:
    return get_setting(conn, "bridge.integration_version") or ""


def supported(conn: sqlite3.Connection) -> bool:
    """A bridge that can rotate: the version of its last verified push is at least MIN_BRIDGE_FOR_ROTATION AND that push carried the
    capability flag. Either missing: no rotation (fail closed)."""
    seen = bridge_version(conn)
    return bool(seen) and _version_tuple(seen) >= _version_tuple(MIN_BRIDGE_FOR_ROTATION) and get_setting(conn, CAPABLE_KEY) == "1"


def paired(conn: sqlite3.Connection) -> bool:
    return bool(get_setting(conn, "bridge.secret")) and bool(get_setting(conn, "bridge.paired_at"))


def _set_if_changed(conn: sqlite3.Connection, key: str, value: str) -> bool:
    if get_setting(conn, key) == value:
        return False
    set_setting(conn, key, value)
    return True


def note_push(conn: sqlite3.Connection, message: dict[str, Any]) -> None:
    """The bridge's directory push, already verified under the current key: its capability flag and its epoch. The bridge owns the
    epoch: while no rotation is open, a different value it reports (a re-pair through Home Assistant, an older add-on's state) is
    adopted and audited. Only ever called after the signature check (routers/ha.py bridge_directory)."""
    from ..audit import audit

    capable = type(message.get("trust_rotation")) is int and message.get("trust_rotation") == 1
    _set_if_changed(conn, CAPABLE_KEY, "1" if capable else "0")
    value = message.get("trust_epoch")
    if type(value) is not int or not 1 <= value <= SAFE_INT:
        return
    set_setting(conn, EPOCH_SEEN_KEY, str(value))
    set_setting(conn, SEEN_AT_KEY, now_iso())
    mine = epoch(conn)
    if value != mine and open_row(conn) is None:
        set_setting(conn, EPOCH_KEY, str(value))
        audit(conn, actor=None, action="bridge.trust.epoch_adopted", decision="allowed", resource_type="bridge_trust", resource_id="epoch",
              details={"epoch_from": mine, "epoch_to": value})


def discovery_blocked(conn: sqlite3.Connection) -> bool:
    """While a rotation is open the discovery announcement is not sent: it carries the add-on's current pairing code, and a bridge that
    already switched must never be pushed back to the previous key through the config flow (CR-040 T9)."""
    return open_row(conn) is not None


# ---------------------------------------------------------------- views

def row_view(r: sqlite3.Row) -> dict[str, Any]:
    return {"request_id": r["request_id"], "initiator": r["initiator_name"] or r["initiator_id"], "epoch_from": r["epoch_from"], "epoch_to": r["epoch_to"],
            "state": r["state"], "code": r["code"], "requested_at": r["requested_at"], "resolved_at": r["resolved_at"], "status_checks": r["status_checks"]}


def _blocked(conn: sqlite3.Connection, settings: Settings) -> str | None:
    if not ha_client.configured(settings):
        return "ha_not_configured"
    if not paired(conn):
        return "not_paired"
    if not supported(conn):
        return "unsupported"
    if open_row(conn) is not None:
        return "in_progress"
    return None


def view(conn: sqlite3.Connection, settings: Settings) -> dict[str, Any]:
    """The Settings segment's data: never a key, salt, proof, nonce or signature (CR-040 section 9)."""
    o = open_row(conn)
    try:
        rows = conn.execute("SELECT * FROM bridge_trust_rotations ORDER BY requested_at DESC, rowid DESC LIMIT ?", (HISTORY,)).fetchall()
    except sqlite3.OperationalError:
        rows = []
    seen = get_setting(conn, EPOCH_SEEN_KEY)
    blocked = _blocked(conn, settings)
    return {
        "epoch": epoch(conn),
        "bridge": {"paired": paired(conn), "version": bridge_version(conn) or None, "required": MIN_BRIDGE_FOR_ROTATION, "supported": supported(conn),
                   "epoch_seen": int(seen) if seen and seen.isdigit() else None, "seen_at": get_setting(conn, SEEN_AT_KEY) or None},
        "open": row_view(o) if o is not None else None,
        "history": [row_view(r) for r in rows],
        "can_rotate": blocked is None,
        "blocked": blocked,
    }


# ---------------------------------------------------------------- the signed messages

def _iso(at: datetime) -> str:
    return at.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _text_ok(value: Any) -> bool:
    import unicodedata

    return isinstance(value, str) and 1 <= len(value) <= 128 and not _CTRL.search(value) and not any(unicodedata.category(ch) in ("Cf", "Cs") for ch in value)


def actor_of(principal: Any) -> tuple[str, str]:
    """(id, display name) of the logical initiator signed into a message: the principal's id, and the first of its display name,
    user name and id that passes the door DTO's text rule (the same rule as trusted_door.actor_name)."""
    from . import trusted_door

    actor_id = str(getattr(principal, "user_id", "") or "")
    if not _text_ok(actor_id):
        raise ApiError(422, "trust_actor_invalid", "לא ניתן לזהות את מבקש ההחלפה.")
    return actor_id, trusted_door.actor_name(principal)


def sign_trust(key: str, action: str, actor: tuple[str, str], params: dict[str, Any], request_id: str, now: datetime | None = None) -> str:
    """One `smplwise-bridge-trust-v1` wire message, signed with `key` (the recipe of every signed path): an explicit 32-hex nonce,
    `ts = epoch(issued_at)`, a 30 s lifetime. Returns the exact text sent; the caller never logs or stores it."""
    issued = (now or utcnow()).replace(microsecond=0)
    body = {"protocol": PROTOCOL, "action": action, "actor": {"id": actor[0], "display_name": actor[1]}, "params": params, "request_id": request_id,
            "issued_at": _iso(issued), "expires_at": _iso(issued + timedelta(seconds=LIFETIME_S))}
    wire = ha_bridge.sign(key, body, ts=int(issued.timestamp()), nonce=secrets.token_hex(16))
    return json.dumps(wire, ensure_ascii=False, separators=(",", ":"))


def _call(settings: Settings, service: str, text: str) -> Any:
    return ha_client.call_service(settings, "smplwise_bridge", service, {"signed_message_json": text}, return_response=True)


def _response_of(answer: Any) -> dict[str, Any] | None:
    if isinstance(answer, dict) and isinstance(answer.get("service_response"), dict):
        answer = answer["service_response"]
    return answer if isinstance(answer, dict) else None


def _transport(exc: ApiError) -> tuple[str, str]:
    """A transport failure of a call: never left (definite) or may have been delivered (unknown)."""
    err = (exc.details or {}).get("error")
    if exc.code == "ha_unavailable" and err in NOT_SENT_ERRORS:
        return "not_rotated", "not_sent"
    if exc.code == "ha_not_configured":
        return "not_rotated", "not_sent"
    if exc.code == "service_not_found":  # Home Assistant refused before the service ran: no such service (an older bridge)
        return "not_rotated", "bridge_outdated"
    if exc.code == "ha_forbidden":  # Home Assistant refused the token before the service ran
        return "not_rotated", "ha_forbidden"
    if exc.code == "ha_error":  # the service ran and failed in a way the bridge never answers: it may have switched
        return "unknown", "bridge_error"
    return "unknown", "transport"


def _refusal_code(r: dict[str, Any]) -> str:
    stage, code = r.get("stage"), r.get("code")
    if isinstance(stage, str) and isinstance(code, str) and _CODE.match(stage) and _CODE.match(code):
        return f"refused:{stage}/{code}"
    return "refused"


def classify_rotate(answer: Any, request_id: str, next_key: str, epoch_to: int) -> tuple[str, str]:
    """(state, code) of the bridge's answer to `trust_rotate`. `rotated` only with this request's id, the expected epoch and a proof
    made with the next key; a refusal of this request is definite (the bridge refuses only before changing anything); anything else -
    an answer that is not one of the closed shapes, another request's id, a proof that does not verify - is `unknown`."""
    r = _response_of(answer)
    if r is None:
        return "unknown", "invalid_response"
    if r.get("result") == "rejected":
        if r.get("request_id") not in (None, request_id):
            return "unknown", "invalid_response"
        return "not_rotated", _refusal_code(r)
    if (r.get("result") == "rotated" and r.get("request_id") == request_id and type(r.get("epoch")) is int and r.get("epoch") == epoch_to
            and isinstance(r.get("proof"), str) and hmac.compare_digest(r["proof"], proof(next_key, "rotated", request_id, epoch_to))):
        return "rotated", "rotated"
    return "unknown", "invalid_response"


def resolve_by_status(settings: Settings, row: sqlite3.Row, current_key: str | None, pending_key: str | None, actor: tuple[str, str]) -> tuple[str, str, int | None]:
    """(state, code, the bridge's epoch) of an open row, by the bridge's status read - never by sending the rotation again."""
    target = row["request_id"]
    for which, key in (("pending", pending_key), ("current", current_key)):
        if not key:
            continue
        status_id = str(uuid.uuid4())
        text = sign_trust(key, SERVICE_STATUS, actor, {"target_request_id": target}, status_id)
        try:
            answer = _call(settings, SERVICE_STATUS, text)
        except ApiError as exc:
            return "unknown", "status_unreachable" if _transport(exc)[1] == "not_sent" else "status_transport", None
        r = _response_of(answer)
        if r is None:
            return "unknown", "invalid_response", None
        if r.get("result") == "rejected":
            if r.get("stage") == "signature" and r.get("code") == "bad_signature":
                continue  # the bridge does not hold this key
            return "unknown", "status_" + _refusal_code(r), None
        verdict, bridge_epoch = r.get("target"), r.get("epoch")
        if (r.get("result") != "status" or r.get("request_id") != status_id or r.get("target_request_id") != target or verdict not in ("applied", "not_applied")
                or type(bridge_epoch) is not int or not isinstance(r.get("proof"), str)
                or not hmac.compare_digest(r["proof"], proof(key, "status", status_id, target, verdict, bridge_epoch))):
            return "unknown", "invalid_response", None
        if which == "pending":  # the bridge holds the next key: it applied this very request
            if verdict == "applied" and bridge_epoch == row["epoch_to"]:
                return "rotated", "status_applied", bridge_epoch
            return "unknown", "inconsistent", None
        # the bridge holds the current key: the request is fenced (never applied) or was applied and later undone on the bridge
        return "not_rotated", "fenced" if verdict == "not_applied" else "reverted_on_bridge", bridge_epoch
    return "unknown", "neither_key", None


# ---------------------------------------------------------------- recording outcomes

def _lease_key_rotation() -> None:
    """CR-WISKEY-LEASE-REVOCATION-EVENT T9 (the extension point routers/ha._lease_repair names): a switched pairing key revokes every
    live capture lease and asks the lease worker for a new stream with reason `key_rotation`. Neither call touches the database or
    blocks (capture_lease.on_authority_change never raises; the worker signs later, in its own round, with the key now stored), so it
    is safe inside the switching transaction. Never lets a lease problem undo a recorded switch."""
    try:
        from . import capture_lease, lease_events

        capture_lease.on_authority_change("key_rotation", all=True)
        lease_events.WORKER.request_reset("key_rotation")
    except Exception as exc:  # noqa: BLE001 - the key switch stands; the lease side recovers on its own next start
        log.warning("bridge trust rotation: capture lease reset not requested (%s)", type(exc).__name__)


def _finish(conn: sqlite3.Connection, request_id: str, state: str, code: str, *, actor: Any, via: str, bridge_epoch: int | None = None) -> sqlite3.Row:
    """Record one outcome in the request's transaction. Terminal states switch (or keep) the key together with the row; a row that
    another path already resolved is left alone (nothing is switched twice)."""
    from ..audit import audit

    row = conn.execute("SELECT * FROM bridge_trust_rotations WHERE request_id = ?", (request_id,)).fetchone()
    if row is None or row["state"] not in OPEN_STATES:
        return row
    at = now_iso()
    if state == "rotated":
        pending = get_setting(conn, PENDING_KEY)
        if not pending:  # cannot happen (written with the row); never switch to a key we do not hold
            state, code = "unknown", "inconsistent"
    if state in ("rotated", "not_rotated"):
        done = conn.execute("UPDATE bridge_trust_rotations SET state = ?, code = ?, open_slot = NULL, resolved_at = ? WHERE request_id = ? AND open_slot = 1",
                            (state, code, at, request_id)).rowcount
        if done != 1:
            return conn.execute("SELECT * FROM bridge_trust_rotations WHERE request_id = ?", (request_id,)).fetchone()
        if state == "rotated":
            set_setting(conn, "bridge.secret", get_setting(conn, PENDING_KEY) or "")
            set_setting(conn, EPOCH_KEY, str(row["epoch_to"]))
            _lease_key_rotation()
        elif bridge_epoch is not None and 1 <= bridge_epoch <= SAFE_INT:
            set_setting(conn, EPOCH_KEY, str(bridge_epoch))  # the bridge's epoch for the key it still holds (it owns the epoch)
        conn.execute("DELETE FROM settings WHERE key = ?", (PENDING_KEY,))
    else:
        conn.execute("UPDATE bridge_trust_rotations SET state = 'unknown', code = ? WHERE request_id = ? AND open_slot = 1", (code, request_id))
        if via == "status":  # still open after a status read: its own audit row says so (bridge.trust.rotation.status_check)
            (log.info if row["code"] != code else log.debug)("bridge trust rotation %s: still unknown (%s)", request_id, code)
            return conn.execute("SELECT * FROM bridge_trust_rotations WHERE request_id = ?", (request_id,)).fetchone()
    audit(conn, actor=actor, action="bridge.trust.rotation.result", decision="allowed", resource_type="bridge_trust", resource_id=request_id,
          details={"request_id": request_id, "epoch_from": row["epoch_from"], "epoch_to": row["epoch_to"], "outcome": state, "code": code, "via": via})
    log.info("bridge trust rotation %s: %s (%s), epoch %s -> %s", request_id, state, code, row["epoch_from"], row["epoch_to"])
    return conn.execute("SELECT * FROM bridge_trust_rotations WHERE request_id = ?", (request_id,)).fetchone()


def _result(conn: sqlite3.Connection, settings: Settings, row: sqlite3.Row) -> dict[str, Any]:
    state = row["state"] if row["state"] != "dispatching" else "unknown"
    return {"request_id": row["request_id"], "state": state, "code": row["code"], "epoch_from": row["epoch_from"], "epoch_to": row["epoch_to"],
            "message": MESSAGES[state].format(epoch=row["epoch_to"]), "trust": view(conn, settings)}


def _refuse(conn: sqlite3.Connection, principal: Any, exc: ApiError, reason: str) -> ApiError:
    from ..audit import audit

    audit(conn, actor=principal, action="bridge.trust.rotation.refused", decision="denied", resource_type="bridge_trust", resource_id="rotation", reason=reason)
    return exc


# ---------------------------------------------------------------- the rotation

def start(conn: sqlite3.Connection, settings: Settings, principal: Any) -> dict[str, Any]:
    """One rotation, synchronously. The caller has checked the permission, the interactive session and the confirmation."""
    from ..audit import audit

    blocked = _blocked(conn, settings)
    if blocked == "ha_not_configured":
        raise _refuse(conn, principal, ApiError(503, "ha_not_configured", "אין גישה לתשתית המערכת."), blocked)
    if blocked == "not_paired":
        raise _refuse(conn, principal, ApiError(503, "bridge_not_paired", "הגשר לא צומד עדיין."), blocked)
    if blocked == "unsupported":
        raise _refuse(conn, principal, ApiError(409, "rotation_unsupported", f"נדרש עדכון של רכיב החיבור לגרסה {MIN_BRIDGE_FOR_ROTATION} לפחות, ודיווח ממנו שהוא תומך בהחלפת מפתח.",
                                                details={"required": MIN_BRIDGE_FOR_ROTATION, "seen": bridge_version(conn) or None}), blocked)
    if blocked == "in_progress":
        o = open_row(conn)
        raise _refuse(conn, principal, ApiError(409, "rotation_in_progress", "החלפת מפתח קודמת עדיין לא הסתיימה. יש לברר את מצבה לפני החלפה נוספת.",
                                                details={"request_id": o["request_id"] if o is not None else None}), blocked)
    actor = actor_of(principal)
    current = get_setting(conn, "bridge.secret") or ""
    epoch_from = epoch(conn)
    epoch_to = epoch_from + 1
    request_id = str(uuid.uuid4())
    salt = secrets.token_hex(32)
    next_key = derive_next_key(current, salt, epoch_to, request_id)
    try:
        conn.execute("INSERT INTO bridge_trust_rotations(request_id, initiator_id, initiator_name, epoch_from, epoch_to, state, open_slot, requested_at) "
                     "VALUES (?, ?, ?, ?, ?, 'dispatching', 1, ?)", (request_id, actor[0], actor[1], epoch_from, epoch_to, now_iso()))
    except sqlite3.IntegrityError:
        raise _refuse(conn, principal, ApiError(409, "rotation_in_progress", "החלפת מפתח קודמת עדיין לא הסתיימה. יש לברר את מצבה לפני החלפה נוספת."), "in_progress") from None
    set_setting(conn, PENDING_KEY, next_key)
    audit(conn, actor=principal, action="bridge.trust.rotation.requested", decision="allowed", resource_type="bridge_trust", resource_id=request_id,
          details={"request_id": request_id, "epoch_from": epoch_from, "epoch_to": epoch_to})
    text = sign_trust(current, SERVICE_ROTATE, actor, {"epoch_from": epoch_from, "salt": salt}, request_id)
    del salt, current
    with _IN_FLIGHT_LOCK:
        _IN_FLIGHT.add(request_id)
    try:
        with unlocked(conn):  # commits the row and the pending key first: from here on the request "may have been dispatched"
            try:
                answer: Any = _call(settings, SERVICE_ROTATE, text)
            except ApiError as exc:
                answer = exc
    finally:
        with _IN_FLIGHT_LOCK:
            _IN_FLIGHT.discard(request_id)
        text = ""  # noqa: F841 - the signed text is dropped as soon as the call is over
    state, code = _transport(answer) if isinstance(answer, ApiError) else classify_rotate(answer, request_id, next_key, epoch_to)
    row = _finish(conn, request_id, state, code, actor=principal, via="answer")
    return _result(conn, settings, row)


def _rate(user_id: str) -> None:
    now = time.monotonic()
    with _HITS_LOCK:
        hits = [t for t in _HITS.get(user_id, []) if now - t < 60.0]
        if len(hits) >= STATUS_PER_MIN:
            _HITS[user_id] = hits
            raise ApiError(429, "rate_limited", "יותר מדי בדיקות מצב ברצף; נסו שוב בעוד רגע.", retryable=True)
        hits.append(now)
        _HITS[user_id] = hits


def reset_limits() -> None:
    with _HITS_LOCK:
        _HITS.clear()


def check(conn: sqlite3.Connection, settings: Settings, principal: Any, request_id: str, *, automatic: bool = False) -> dict[str, Any]:
    """Resolve an open request by the bridge's status read (CR-040 3.1). Manual (a person, rate limited) or automatic (the janitor)."""
    from ..audit import audit

    row = conn.execute("SELECT * FROM bridge_trust_rotations WHERE request_id = ?", (request_id,)).fetchone()
    if row is None:
        raise ApiError(404, "not_found", "הבקשה לא נמצאה.")
    if row["state"] not in OPEN_STATES:
        return _result(conn, settings, row)  # already resolved: nothing is asked again
    with _IN_FLIGHT_LOCK:
        in_flight = request_id in _IN_FLIGHT
    if in_flight:
        raise ApiError(409, "rotation_in_flight", "ההחלפה עדיין ממתינה לתשובת הגשר.")
    if not ha_client.configured(settings):
        raise ApiError(503, "ha_not_configured", "אין גישה לתשתית המערכת.")
    if not automatic:
        _rate(getattr(principal, "user_id", "") or "")
    if not _CHECK_LOCK.acquire(blocking=False):
        raise ApiError(409, "status_check_running", "בדיקת מצב אחרת רצה כרגע; נסו שוב בעוד רגע.", retryable=True)
    try:
        actor = SYSTEM_ACTOR if automatic or principal is None else actor_of(principal)
        current, pending = get_setting(conn, "bridge.secret"), get_setting(conn, PENDING_KEY)
        conn.execute("UPDATE bridge_trust_rotations SET status_checks = status_checks + 1, last_check_at = ? WHERE request_id = ?", (now_iso(), request_id))
        with unlocked(conn):
            state, code, bridge_epoch = resolve_by_status(settings, row, current, pending, actor)
        current = pending = None  # noqa: F841
        if not (automatic and state == "unknown" and code == row["code"]):  # the janitor repeating the same answer adds no audit row
            audit(conn, actor=principal, action="bridge.trust.rotation.status_check", decision="allowed", resource_type="bridge_trust", resource_id=request_id,
                  details={"request_id": request_id, "outcome": state, "code": code, "automatic": automatic})
        row = _finish(conn, request_id, state, code, actor=principal, via="status", bridge_epoch=bridge_epoch)
    finally:
        _CHECK_LOCK.release()
    return _result(conn, settings, row)


# ---------------------------------------------------------------- start-up, janitor, re-pair

def recover(db: Database) -> int:
    """Start-up: a row left `dispatching` by the previous process may have been dispatched - it becomes `unknown` (`interrupted`);
    the gate stays closed until a status check resolves it. Never re-sends anything."""
    from ..audit import audit

    n = 0
    with db.connection(label="bridge_trust.recover") as conn:
        try:
            rows = conn.execute("SELECT * FROM bridge_trust_rotations WHERE state = 'dispatching'").fetchall()
        except sqlite3.OperationalError:
            return 0
        for r in rows:
            with _IN_FLIGHT_LOCK:
                if r["request_id"] in _IN_FLIGHT:
                    continue
            conn.execute("UPDATE bridge_trust_rotations SET state = 'unknown', code = 'interrupted' WHERE request_id = ? AND state = 'dispatching'", (r["request_id"],))
            audit(conn, actor=None, action="bridge.trust.rotation.interrupted", decision="allowed", resource_type="bridge_trust", resource_id=r["request_id"],
                  details={"request_id": r["request_id"], "epoch_from": r["epoch_from"], "epoch_to": r["epoch_to"], "outcome": "unknown", "code": "interrupted"})
            n += 1
    return n


def _instant(value: str | None) -> float | None:
    if not value:
        return None
    try:
        return datetime.strptime(value[:19], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc).timestamp()
    except ValueError:
        return None


def janitor(db: Database, settings: Settings, now: float | None = None) -> str | None:
    """The 30 s housekeeping pass: when a request is open (and not in flight here), ask the bridge's status - first once the
    message's lifetime is over, then at most once a minute. Returns the outcome when it asked (for tests), else None."""
    if not ha_client.configured(settings):
        return None
    with db.connection(mode="read", label="bridge_trust.janitor.read") as conn:
        row = open_row(conn)
    if row is None:
        return None
    with _IN_FLIGHT_LOCK:
        if row["request_id"] in _IN_FLIGHT:
            return None
    now = time.time() if now is None else now
    last = _instant(row["last_check_at"])
    due = (last + AUTOMATIC_EVERY_S) if last is not None else ((_instant(row["requested_at"]) or 0) + FIRST_AUTOMATIC_CHECK_S)
    if now < due:
        return None
    with db.connection(label="bridge_trust.janitor") as conn:
        try:
            return check(conn, settings, None, row["request_id"], automatic=True)["state"]
        except ApiError as exc:
            log.info("bridge trust status check skipped: %s", exc.code)
            return None


def on_repair(conn: sqlite3.Connection, actor: Any) -> None:
    """A re-pair (a new pairing code) replaces the trust relationship: an open request becomes `superseded` (its question is moot, it
    is not re-opened), the pending key is deleted and the epoch starts again at 1 (the bridge's config flow does the same)."""
    from ..audit import audit

    o = open_row(conn)
    if o is not None:
        conn.execute("UPDATE bridge_trust_rotations SET state = 'superseded', code = 'repaired', open_slot = NULL, resolved_at = ? WHERE request_id = ? AND open_slot = 1",
                     (now_iso(), o["request_id"]))
        audit(conn, actor=actor, action="bridge.trust.rotation.superseded", decision="allowed", resource_type="bridge_trust", resource_id=o["request_id"],
              details={"request_id": o["request_id"], "epoch_from": o["epoch_from"], "epoch_to": o["epoch_to"], "outcome": "superseded", "code": "repaired"})
    conn.execute("DELETE FROM settings WHERE key IN (?, ?, ?)", (PENDING_KEY, EPOCH_SEEN_KEY, SEEN_AT_KEY))
    set_setting(conn, EPOCH_KEY, "1")


def in_flight_ids() -> set[str]:
    with _IN_FLIGHT_LOCK:
        return set(_IN_FLIGHT)
