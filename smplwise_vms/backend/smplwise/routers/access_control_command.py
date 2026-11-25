"""WisKey tab: the write path every physical action and people write shares - the command envelope, the audit context
(`_Action`), the body / expiry / duplicate checks, the relay guard and `_perform`. No route lives here.

CR-SPLIT-ACCESS-CONTROL-2440 (review 05:P2-08): moved unchanged out of routers/access_control.py, which still exports every name."""
from __future__ import annotations

import json
import re
import sqlite3
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Literal

from fastapi import Depends, Path, Request
from pydantic import BaseModel, Field, StrictInt, ValidationError

from ..audit import audit
from ..auth import current_principal_ro, get_read_conn, read_gate, settings_of
from ..db import Database, commit_now, get_setting
from ..errors import ApiError, forbidden
from ..rbac import INSTALLATION, Principal, STATION, authorize
from ..services import capture_lease, door_authority, intercom_authority as ia, intercom_client, intercom_sync, savepoints
from ..services.access_control_core import PERSON, command_already_sent
from ..services.timeutil import parse_utc
from ._common import is_json as _is_json, rid as _rid
from .access_control_base import DOOR_OPEN, MAX_STATION_ID, log
from ..test_reset import register_reset
from ..error_text import tpl


# ---------------------------------------------------------------- physical actions (access.release)
#
# Accountability (CR-005 §3; T054 review B1). Once the caller holds access.release, EVERY request to a physical endpoint
# leaves audit rows under the real SMPLWISE actor, all with the endpoint's action (`intercom.release` / `.call` / `.tts`):
# - a request refused before anything is sent (malformed body, expired or duplicate command, unknown station, no such
#   relay, offline, missing confirmation, a release of that relay still unresolved): ONE row, decision `denied`,
#   `reason` = the refusal code, `details.phase` = "refused", `details.outcome` = "not_sent";
# - a command handed on to WisKey: an ATTEMPT row (`phase` "attempt") committed BEFORE the command is sent - if it
#   cannot be written, nothing is sent - and then an OUTCOME row (`phase` "outcome", `outcome` ok / not_sent / refused /
#   unknown, `reason` = the failure code) written in a short transaction of its own after WisKey answered. The outcome
#   row is best effort by design: if the database is locked at that moment, the caller still gets the real result and
#   the attempt row (same `command_id`) stands as the record that the command was sent.
# The request's own write transaction is committed before the WisKey call and is NOT re-taken afterwards (only a
# deferred, lock-free BEGIN), so a contended database can never turn a sent command into a 500 without a record.
#
# Command envelope (MASTER_SPEC_HE §15; T054 review S2): every physical request carries `client_request_id` and
# `expires_at`, as the HA bridge's actions do (routers/ha.py). An expired request is refused, a request whose expiry
# lies more than EXPIRY_MAX_S ahead is refused (it would make the expiry meaningless), and the command is checked
# again on the feed's loop immediately before its frame is written: it is sent only before min(expires_at, arrival +
# SEND_WITHIN_S). A `client_request_id` already used by the same caller for a command that was handed on to WisKey
# is refused as a duplicate (the attempt rows are the durable record; DEDUPE_WINDOW_S >> EXPIRY_MAX_S, so a replay can
# never outlive its dedupe).

COMMAND_ID = r"^[A-Za-z0-9-]{8,64}$"  # no LIKE wildcards: the duplicate check matches it inside the audit JSON
EXPIRY_MAX_S = 60.0
SEND_WITHIN_S = 15.0
DEDUPE_WINDOW_S = 600.0
UNKNOWN_HOLD_S = 10.0  # a relay stays blocked this long after a release with an unknown outcome settled (S1)
CALL_LIMIT_S = 60.0  # ha_client's own per-call limit: WisKey's answer to a sent command cannot come later than this
GUARD_MAX_S = 90.0  # safety net only: a relay entry never settled is free again after this long (ha_client gives up at 60 s)


class CommandEnvelope(BaseModel):
    client_request_id: str = Field(pattern=COMMAND_ID)
    expires_at: str = Field(min_length=1, max_length=40)


ORIGIN_RE = re.compile(r"notification:[A-Za-z0-9_-]{1,64}")


class ReleaseBody(CommandEnvelope):
    # the relay (`integrated_locks[].physical_index`); may be left out when the station has exactly one
    lock: StrictInt | None = Field(None, ge=1, le=64)
    # the UI's confirmation step, stated explicitly (the same rule as a sensitive HA action's `confirmation_grant`).
    # Any JSON value is accepted here and only `true` confirms, so a wrong value is an audited refusal, not a bare 422.
    confirmed: Any = None
    # CR-018: where the release was started from - `notification:<id>` when the in-app confirmation was reached through a notification's
    # "open door" deep link. Recorded in the audit rows only; it changes nothing about the permission, the confirmation or the send. Any other
    # value is ignored (never refused), so an older client behaves exactly as before.
    origin: Any = None


class CallBody(CommandEnvelope):
    command: Literal["answer", "reject", "hangUp"]


class TtsBody(CommandEnvelope):
    engine_id: str = Field(min_length=1, max_length=128)
    language: str | None = Field(None, min_length=1, max_length=64)
    message: str = Field(min_length=1, max_length=4 * intercom_client.TTS_MESSAGE_MAX)  # checked again once collapsed


# 2.4.10 (TTSLOG): the announcement's audit rows record how long the text was, never the text. The buckets are coarse on
# purpose (a length is a weak fingerprint of a short message); the last one is the refusal of an over-long text.
TTS_LENGTH_BUCKETS: tuple[tuple[int, str], ...] = ((0, "0"), (20, "1-20"), (60, "21-60"), (150, "61-150"), (intercom_client.TTS_MESSAGE_MAX, f"151-{intercom_client.TTS_MESSAGE_MAX}"))


def tts_length_bucket(length: int) -> str:
    """The bucket of a collapsed announcement's length (`TTS_LENGTH_BUCKETS`); `over_<max>` beyond WisKey's limit."""
    for upper, label in TTS_LENGTH_BUCKETS:
        if length <= upper:
            return label
    return f"over_{intercom_client.TTS_MESSAGE_MAX}"


class _Relay:
    """One relay's release in progress (see _RelayGuard)."""

    __slots__ = ("since", "settled", "unknown", "hold_until")

    def __init__(self) -> None:
        self.since = time.monotonic()
        self.settled = False
        self.unknown = False
        self.hold_until = 0.0


class _RelayGuard:
    """T054 review S1: at most one release per (station, relay) at a time, never queued. A relay is busy from the moment
    a release is accepted for sending until the WisKey call is really over - IntercomSync.action's `on_settled`, called
    when WisKey answers, the session ends or ha_client's own limit expires, which can be long after the HTTP request
    gave up with "outcome unknown" - and, after an unknown outcome, for UNKNOWN_HOLD_S more, so nobody can fire a second
    release into an ambiguous state straight away."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._relays: dict[tuple[str, int], _Relay] = {}

    def acquire(self, key: tuple[str, int]) -> _Relay | None:
        now = time.monotonic()
        with self._lock:
            held = self._relays.get(key)
            if held is not None and now - held.since < GUARD_MAX_S and (not held.settled or now < held.hold_until):
                return None
            entry = self._relays[key] = _Relay()
            return entry

    def settle(self, entry: _Relay) -> None:
        with self._lock:
            entry.settled = True
            if entry.unknown:
                entry.hold_until = max(entry.hold_until, time.monotonic() + UNKNOWN_HOLD_S)

    def remaining(self, key: tuple[str, int]) -> float:
        """An upper bound, in seconds, on how long this relay stays blocked: the rest of the hold when the call already
        settled, else the rest of ha_client's own call limit plus the hold."""
        now = time.monotonic()
        with self._lock:
            held = self._relays.get(key)
            if held is None or now - held.since >= GUARD_MAX_S:
                return 0.0
            if held.settled:
                return max(0.0, held.hold_until - now)
            return max(0.0, CALL_LIMIT_S - (now - held.since)) + (UNKNOWN_HOLD_S if held.unknown else 0.0)

    def mark_unknown(self, entry: _Relay) -> None:
        with self._lock:
            entry.unknown = True
            entry.hold_until = max(entry.hold_until, time.monotonic() + UNKNOWN_HOLD_S)

    def clear(self) -> None:
        with self._lock:
            self._relays.clear()


RELAYS = _RelayGuard()


# 2.4.9 (owner decision 2026-10-13; CR-036 owner answer 6 of 2026-10-12): the call signal (answer / reject / hang up), the
# announcement and the TTS engine list ride `access.call` - the permission S18's talk already uses - on the station chain,
# no longer `access.release` at installation scope. The gate: `access.call` anywhere a station can be, checked on a READ
# connection before the body is read (review L7; a refusal is audited as `access.call` denied); the route then judges the
# named station (`_call_station`). `access.read` alone, and the door grant alone (`access.release`), never act on a call.
_caller_ro = read_gate(lambda conn, principal: ia.require_anywhere(conn, principal, ia.CALL))


def _caller(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Principal:
    """The same `access.call` gate for the body-less read of the TTS engines. TTS-DEFAULT-ENGINE-2400: or `system.configure` on the
    installation - the system administrator choosing the fixed announcement engine in Settings reads the same list (names and
    languages only; speaking still needs `access.call` on the station's chain)."""
    if authorize(conn, principal, "system.configure", INSTALLATION).allowed:
        return principal
    ia.require_anywhere(conn, principal, ia.CALL, _rid(request))
    return principal


TTS_FIXED_ENGINE_KEY = "access.tts_engine"  # TTS-DEFAULT-ENGINE-2400 (routers/settings.py)


def tts_engine_choice(conn: sqlite3.Connection, engine_id: str) -> str:
    """TTS-DEFAULT-ENGINE-2400: how this announcement's engine relates to the installation's fixed engine, for the audit row only -
    `fixed` (the fixed engine), `override` (a fixed engine is set and the sender picked another for this send), `no_fixed` (the
    setting is the system default). Never changes what is sent."""
    fixed = str(get_setting(conn, TTS_FIXED_ENGINE_KEY, "") or "")
    if not fixed:
        return "no_fixed"
    return "fixed" if engine_id == fixed else "override"


def _call_station(act: "_Action") -> None:
    """`access.call` on the named station's chain (deny wins), before anything is sent; refused and audited as not sent."""
    if not ia.Authority(act.conn, act.principal).station(ia.CALL, act.station_id):
        raise act.refuse(ApiError(403, "forbidden", "אין הרשאה לשיחות ולהכרזות בעמדה הזו.", details={"permission": ia.CALL}))


def _door_gate_ro(request: Request, station_id: str = Path(), principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Principal:
    """CR-033 D3: the door release's permission gate, before the body is read (the read_gate pattern). The one door rule
    (services/door_authority.py) at station level: `access.doors.open` on the station's chain (or its legacy name
    `access.release` in a custom role), or `door.unlock` on a lock entity the door map links to this station, and no deny of
    either. The precise relay is judged again once the body names it. A refusal is audited as `access.doors.open` denied
    (WXPERM; it was `access.release` before the rename)."""
    sid = station_id[:MAX_STATION_ID]
    decision = door_authority.may_open_some_door(conn, principal, sid, dev_mode=bool(settings_of(request).dev_user))
    if not decision.allowed:
        audit(conn, actor=principal, action=DOOR_OPEN, decision="denied", resource_type=STATION, resource_id=sid, reason=decision.reason)
        raise forbidden(permission=DOOR_OPEN, target_type=STATION, target_id=sid, reason=decision.reason)
    return principal


class _Action:
    """One physical request's (or people write's) audit context: who, which endpoint, which station (or person), and
    what is known so far."""

    def __init__(self, request: Request, conn: sqlite3.Connection, principal: Principal, action: str, resource_id: str, resource_type: str = "intercom_station") -> None:
        self.request, self.conn, self.principal, self.action, self.resource_id, self.resource_type = request, conn, principal, action, resource_id, resource_type
        self.rid = _rid(request)
        self.details: dict[str, Any] = {"command": action.removeprefix("intercom.")}

    @property
    def station_id(self) -> str:
        return self.resource_id

    def _row(self, conn: sqlite3.Connection, decision: str, reason: str | None, fields: dict[str, Any]) -> None:
        audit(conn, actor=self.principal, action=self.action, decision=decision, resource_type=self.resource_type, resource_id=self.resource_id,
              reason=reason, request_id=self.rid, details={**self.details, **fields})

    def refuse(self, exc: ApiError) -> ApiError:
        """Audit a refusal before anything was sent, and return the error to raise (its `details.outcome` is
        `not_sent`, so the UI can say for certain that nothing happened)."""
        exc.details.setdefault("outcome", "not_sent")
        self._row(self.conn, "denied", exc.code, {"phase": "refused", "outcome": "not_sent"})
        return exc

    def attempt(self) -> None:
        """The attempt row, committed before the command is sent: no record, no command."""
        self.details["command_id"] = uuid.uuid4().hex
        self._row(self.conn, "allowed", None, {"phase": "attempt"})
        commit_now(self.conn, keep_reading=False)  # hands the write lock on: the command and the outcome row run without it

    def outcome(self, outcome: str, reason: str | None, fields: dict[str, Any]) -> None:
        try:
            db: Database = self.request.app.state.db
            with db.write_aside() as w:
                self._row(w, "allowed", reason, {"phase": "outcome", "outcome": outcome, **fields})
        except Exception:  # noqa: BLE001 - the command was sent; its attempt row stands (see the section note)
            log.exception("audit: the outcome (%s) of %s command %s could not be recorded; its attempt row stands", outcome, self.action, self.details.get("command_id"))


def _parse(act: _Action, model: type[BaseModel], raw: bytes) -> Any:
    """Validate the station id, the content type and the body; every failure is an audited refusal (nothing is sent).

    The content type is enforced explicitly (T054 final confirmation B-1): `text/plain` and form-encoded bodies are
    CORS "simple requests" that a browser sends cross-site WITHOUT a preflight, so a JSON payload smuggled in one of
    them must never actuate a door. Only `application/json` (or a `+json` subtype) is read; a JSON Content-Type forces
    the preflight. FastAPI's own body parsing rejected the others implicitly; reading the raw body here, it must be said."""
    if not 1 <= len(act.resource_id) <= MAX_STATION_ID:
        act.resource_id = act.resource_id[:MAX_STATION_ID]  # the audit row keeps a bounded id
        raise act.refuse(ApiError(422, "validation", "מזהה העמדה אינו תקין." if act.resource_type == "intercom_station" else "מזהה האדם אינו תקין.", details={"fields": ["station_id" if act.resource_type == "intercom_station" else "user_id"]}))
    content_type = act.request.headers.get("content-type")
    if not _is_json(content_type):
        raise act.refuse(ApiError(415, "unsupported_media_type", "הבקשה חייבת להישלח כ־JSON (Content-Type: application/json).", details={"content_type": (content_type or "")[:100]}))
    try:
        data = json.loads(raw) if raw.strip() else {}
    except (ValueError, RecursionError):  # RecursionError: a pathologically nested body (N-1) is a refusal, not a 500
        raise act.refuse(ApiError(422, "validation", "גוף הבקשה אינו JSON תקין.", details={"fields": ["body"]})) from None
    try:
        return model.model_validate(data)
    except ValidationError as exc:
        fields = sorted({".".join(str(p) for p in err["loc"]) or "body" for err in exc.errors()})
        raise act.refuse(ApiError(422, "validation", "הבקשה אינה תקינה: " + ", ".join(fields), details={"fields": fields})) from None


def _envelope(act: _Action, body: CommandEnvelope) -> datetime:
    """Expiry and duplicate checks. Returns the instant after which the command must not be sent."""
    act.details.update(client_request_id=body.client_request_id, expires_at=body.expires_at)
    try:
        expires = parse_utc(body.expires_at)
    except ValueError:
        raise act.refuse(ApiError(422, "validation", "expires_at חייב להיות זמן UTC (Z).")) from None
    now = datetime.now(timezone.utc)
    if expires <= now:
        raise act.refuse(ApiError(409, "expired", "הבקשה פגה לפני שהגיעה לשרת, ולכן לא נשלחה. אם השעון במכשיר שלכם אינו מדויק, תקנו אותו."))
    if expires > now + timedelta(seconds=EXPIRY_MAX_S):
        raise act.refuse(ApiError(422, "expires_too_far", tpl("תוקף הבקשה חייב להסתיים תוך {expiry_max_s} שניות.", expiry_max_s=int(EXPIRY_MAX_S))))
    since = (now - timedelta(seconds=DEDUPE_WINDOW_S)).strftime("%Y-%m-%dT%H:%M:%SZ")
    if command_already_sent(act.conn, act.action, act.principal.user_id, since, body.client_request_id):
        raise act.refuse(ApiError(409, "intercom_duplicate_command", "הפקודה הזו כבר נשלחה (אותו מזהה פקודה), ולכן לא נשלחה שוב."))
    return min(expires, now + timedelta(seconds=SEND_WITHIN_S))


def _station(act: _Action, require_online: bool = True) -> dict[str, Any] | None:
    """The station from the served copy. 404 when there is a copy and it has no such station; without any copy (feed
    not configured / never ready) there is nothing to check against, and the action fails as `not_sent` on its own."""
    station = intercom_sync.SYNC.station(act.station_id)
    if station is None and intercom_sync.SYNC.has_copy():
        raise act.refuse(ApiError(404, "intercom_station_not_found", "העמדה לא נמצאה ב־WisKey."))
    if station is not None:
        act.details["station_name"] = station["name"]
        if require_online and not station["online"]:
            raise act.refuse(ApiError(409, "intercom_station_offline", tpl("העמדה {name} אינה מחוברת כרגע, ולכן הפקודה לא נשלחה.", name=station['name'])))
    return station


def _perform(
    act: _Action,
    key: str,
    send: Callable[[intercom_client.Call], Any],
    project: Callable[[Any], dict[str, Any]],
    not_after: datetime,
    on_settled: Callable[[], None] | None = None,
    on_unknown: Callable[[], None] | None = None,
    lane: str = "action",
    summary: Callable[[dict[str, Any]], dict[str, Any]] | None = None,
    slot_wait: float = 0.0,
    free: bool = False,
    on_result: Callable[[dict[str, Any], str], None] | None = None,
    target: str | None = None,
) -> dict[str, Any]:
    """Audit the attempt (committed), send once through IntercomSync.action, audit the outcome. `target` (a people write to an
    existing person, `intercom_sync.person_target`): after an unknown outcome the next write to that person is refused, nothing
    sent, until the editor has read the person fresh (WisKey round 3, R3-06). `on_settled` is always
    called exactly once (by IntercomSync once the command was handed over, here when it never got that far);
    `on_unknown` when the outcome is unknown. `summary` turns the projected result into what the outcome row records
    (the physical actions record the result itself; a people write records counts and names only). `slot_wait`: how
    long the lane's slot may be waited for (the capture lane's; the others answer `busy` at once); `free`: no rate
    token is spent (a capture cancel); `on_result(reply, outcome)`: the caller's record of the outcome, made before the
    lane's slot is freed (IntercomSync._execute)."""
    try:
        act.attempt()
    except BaseException:
        if on_settled:
            on_settled()
        raise
    try:
        reply = intercom_sync.SYNC.action(settings_of(act.request), key, send, project, who=act.principal.user_id, not_after=not_after, on_settled=on_settled, lane=lane, slot_wait=slot_wait, free=free,
                                          on_result=on_result, target=target)
    except ApiError as exc:
        outcome = str(exc.details.get("outcome") or "unknown")
        if outcome == "unknown" and on_unknown:
            on_unknown()
        if outcome == "unknown" and act.resource_type == PERSON and act.action != "intercom.card_capture.start":
            capture_lease.on_authority_change("person_changed", person_ids=[act.resource_id])  # T12: the person may have changed
        code = str(exc.details.get("wiskey_code") or exc.code)
        act.outcome(outcome, code, {"error": exc.code, "wiskey_code": code})
        raise
    except BaseException as exc:
        if on_unknown:
            on_unknown()
        act.outcome("unknown", type(exc).__name__, {"error": type(exc).__name__})
        raise
    finally:
        savepoints.begin_deferred(act.conn)  # deferred: takes no lock, cannot wait on a busy database; nothing more is written here
    act.outcome("ok", None, {"result": summary(reply[key]) if summary else reply[key]})
    reply["command_id"] = act.details["command_id"]
    if act.resource_type == PERSON and act.action != "intercom.card_capture.start":
        # CR-WISKEY-LEASE-REVOCATION-EVENT T12: the person changed under any live capture lease for them (non-blocking, never raises)
        capture_lease.on_authority_change("person_changed", person_ids=[act.resource_id])
    return reply


def _relay_of(act: _Action, station: dict[str, Any] | None, lock: int | None) -> int:
    """The relay a release names, checked against the served copy: refused (audited, nothing sent) when the station has no
    active integrated lock, more than one relay and none named, a relay it does not have, or is offline."""
    if station is not None:
        if not station["lock_enabled"] or not station["locks"]:
            raise act.refuse(ApiError(409, "intercom_no_lock", tpl("לעמדה {name} אין מנעול משולב פעיל ב־WisKey.", name=station['name'])))
        indexes = [entry["physical_index"] for entry in station["locks"]]
        if lock is None:
            if len(indexes) != 1:
                raise act.refuse(ApiError(422, "intercom_lock_required", "לעמדה יותר ממנעול אחד - יש לבחור איזה לשחרר.", details={"locks": indexes}))
            lock = indexes[0]
        elif lock not in indexes:
            raise act.refuse(ApiError(422, "intercom_lock_unknown", "לעמדה אין מנעול במספר הזה.", details={"locks": indexes}))
        if not station["online"]:
            raise act.refuse(ApiError(409, "intercom_station_offline", tpl("העמדה {name} אינה מחוברת כרגע, ולכן הפקודה לא נשלחה.", name=station['name'])))
    if lock is None:
        lock = 1  # no copy to check against: WisKey's own default relay (panel.ts unlock(station, physical = 1))
    return lock


def _reset_for_tests() -> None:
    """Test seam: puts the module-level tables back to what a freshly started process has (smplwise.test_reset; product code never calls it)."""
    RELAYS.clear()


register_reset(__name__, ("RELAYS",), _reset_for_tests)  # CR-SINGLETONS-REST-2480: module-level tables (tests/test_singletons_registered.py)
