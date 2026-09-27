"""WisKey tab (CR-005, access control through the owner's `hikvision_intercom` integration).

SMPLWISE's browser never talks to Home Assistant: these endpoints check SMPLWISE's own permission first and serve
what services/intercom_sync.py read from WisKey over HA's WebSocket API. Phase 1a: the read-only entry center
(`access.read`); phase 1b: the read-only activity log and people directory, same permission (CR-005 §3).

Phase 3 (owner-approved per capability, 2026-09-27): three PHYSICAL actions, each gated on `access.release` at
installation scope - door release (`stations/test_unlock`), call answer / reject / hang up (`media/signal`) and a spoken
announcement (`tts/engines` + `tts/start`). They ride the feed's own Home Assistant session (IntercomSync.action),
are never queued or retried, and carry a command id and an expiry. Once the caller holds `access.release`, every
request to them is written to SMPLWISE's audit log under the real SMPLWISE actor: a refusal as one row, a command sent
to WisKey as an attempt row committed before sending plus an outcome row (see the section note below). WisKey's own
log sees only the add-on's single HA user (CR-005 §3, "Accountability gap and its mitigation"). No person, card,
schedule or device-setting edit lives here."""
from __future__ import annotations

import asyncio
import json
import logging
import queue
import sqlite3
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Literal

from fastapi import APIRouter, Depends, Path, Query, Request, WebSocket
from pydantic import BaseModel, Field, StrictInt, ValidationError
from starlette.concurrency import run_in_threadpool

from ..audit import audit
from ..auth import current_principal, get_conn, settings_of
from ..db import Database, now_iso, unlocked
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, require
from ..services import intercom_client, intercom_sync
from ..services.timeutil import parse_utc
from .media import _principal_for_ws

router = APIRouter()
log = logging.getLogger("smplwise.intercom")

READ = "access.read"
RELEASE = "access.release"  # every PHYSICAL WisKey command; role grants: see the note at routers/access.py PERMISSION_LABELS
RECHECK_S = 60
MAX_PAGE = 200  # WisKey's own cap for events/list and users/query
MAX_STATION_ID = 128


def _reader(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Principal:
    """`access.read` at installation scope, checked as a dependency: FastAPI resolves dependencies before it validates
    query parameters, so a caller without the permission learns nothing about them (WisKey's own handlers authorize
    first, too). Returns the principal, whose id keys the caller's own rate bucket."""
    require(conn, principal, READ, INSTALLATION)
    return principal


def _instant(name: str, value: str | None) -> str | None:
    """WisKey accepts only an aware ISO instant (<=40 chars) for `start` / `end`; refuse anything else here with a clear
    422 instead of letting WisKey answer `invalid_fields`."""
    if value is None:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        parsed = None
    if parsed is None or parsed.tzinfo is None:
        raise ApiError(422, "validation", f"{name} חייב להיות זמן ISO עם אזור זמן (למשל 2026-09-27T08:00:00Z).")
    return value


@router.get("/intercom/overview")
def overview(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The entry center: stations with online / ringing / sync state and the last access record, plus the feed's own
    state (`ha_not_configured`, `connecting`, `ha_unavailable`, `not_installed`, `forbidden`, `error`, `ready`).
    `overview` is null whenever there is nothing honest to show; `fresh` is false for a copy from before a disconnect."""
    require(conn, principal, READ, INSTALLATION)
    return intercom_sync.SYNC.snapshot(settings_of(request))


@router.get("/intercom/events")
def events(
    request: Request,
    principal: Principal = Depends(_reader),
    station_id: str | None = Query(None, min_length=1, max_length=128),
    person: str | None = Query(None, min_length=1, max_length=128),
    result: Literal["granted", "denied", "unknown"] | None = Query(None),
    authentication: Literal["card", "pin", "unknown"] | None = Query(None),
    door: int | None = Query(None, ge=1, le=2),
    start: str | None = Query(None, max_length=40),
    end: str | None = Query(None, max_length=40),
    limit: int = Query(100, ge=1, le=MAX_PAGE),
    before: str | None = Query(None, min_length=1, max_length=128),
    current_group: str | None = Query(None, min_length=1, max_length=128),
) -> dict[str, Any]:
    """The activity log: one page of WisKey's `events/list`, newest first (WisKey keeps 5 000 records / 30 days).
    `before` is the previous page's `events.next`; WisKey refusing a request that carried `before` is a 422
    `intercom_cursor_expired` (reload from page one), any other refusal a 422 `intercom_invalid_request`. WisKey's
    `current_profile` filter is deliberately not offered: matching events by a profile value (an ID number, say) would
    let a reader probe values the people endpoints never show. Reply: `{state, configured, last_error, fetched_at,
    events, sync}`, `events` null unless `state` is `ready`. WisKey has no event push: refetch on the
    `intercom_refresh` notice, like WisKey's own panel."""
    start, end = _instant("start", start), _instant("end", end)
    if start and end and datetime.fromisoformat(start.replace("Z", "+00:00")) >= datetime.fromisoformat(end.replace("Z", "+00:00")):
        raise ApiError(422, "validation", "start חייב להיות לפני end.")
    filters = {"station_id": station_id, "person": person, "result": result, "authentication": authentication, "door": door, "start": start, "end": end, "limit": limit, "before": before, "current_group": current_group}
    try:
        return intercom_sync.SYNC.command(settings_of(request), "events", lambda call: intercom_client.events_list(call, filters), intercom_sync.project_event_page, who=principal.user_id)
    except ApiError as exc:
        if exc.code == "intercom_invalid_request" and before is not None:
            # every other field was validated above, so a refused paged request is WisKey's pruned cursor
            raise ApiError(422, "intercom_cursor_expired", "רשימת האירועים התעדכנה והסמן של 'טען עוד' פג - טענו מחדש מההתחלה.", details=exc.details) from exc
        raise


@router.get("/intercom/people")
def people(
    request: Request,
    principal: Principal = Depends(_reader),
    query: str = Query("", max_length=160),
    offset: int = Query(0, ge=0, le=10_000_000),
    limit: int = Query(50, ge=1, le=MAX_PAGE),
    snapshot: str | None = Query(None, max_length=64),
    station: str | None = Query(None, min_length=1, max_length=128),
    group: str | None = Query(None, min_length=1, max_length=128),
    rights: Literal["assigned", "unassigned", "disabled"] | None = Query(None),
    state: Literal["active", "inactive", "expired", "upcoming"] | None = Query(None),
    sort: Literal["name", "name_desc", "employee"] = Query("employee"),
) -> dict[str, Any]:
    """The people directory, projected to what a read-only list shows (no phones, cards, PIN flags or profile values).
    `query` is matched by SMPLWISE against name and employee number only and is never sent to WisKey (whose own search
    also matches phone digits and card last-4); `total` and the offsets then count matches. `people.complete` is false
    when the scan stopped early (`incomplete_reason` `scan_limit` / `rate_limited`: narrow the search). Pass the
    previous page's `people.snapshot` back; `people.stale` then says the directory changed underneath the paging. The
    `credential` and `profile` filters are deliberately not offered. Reply: `{state, configured, last_error,
    fetched_at, people, sync}`."""
    filters: dict[str, Any] = {k: v for k, v in {"station": station, "group": group, "rights": rights, "state": state}.items() if v is not None}
    filters["sort"] = sort
    return intercom_sync.SYNC.people(settings_of(request), principal.user_id, query, filters, offset, limit, snapshot)


@router.get("/intercom/people/{user_id}")
def person(request: Request, principal: Principal = Depends(_reader), user_id: str = Path(min_length=1, max_length=128)) -> dict[str, Any]:
    """One person (WisKey `users/get`), same projection as a directory row; an unknown id is a 404
    `intercom_person_not_found`. Reply: `{state, configured, last_error, fetched_at, person, sync}`."""
    return intercom_sync.SYNC.command(settings_of(request), "person", lambda call: intercom_client.users_get(call, user_id), intercom_sync.project_person, who=principal.user_id)


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


class ReleaseBody(CommandEnvelope):
    # the relay (`integrated_locks[].physical_index`); may be left out when the station has exactly one
    lock: StrictInt | None = Field(None, ge=1, le=64)
    # the UI's confirmation step, stated explicitly (the same rule as a sensitive HA action's `confirmation_grant`).
    # Any JSON value is accepted here and only `true` confirms, so a wrong value is an audited refusal, not a bare 422.
    confirmed: Any = None


class CallBody(CommandEnvelope):
    command: Literal["answer", "reject", "hangUp"]


class TtsBody(CommandEnvelope):
    engine_id: str = Field(min_length=1, max_length=128)
    language: str | None = Field(None, min_length=1, max_length=64)
    message: str = Field(min_length=1, max_length=4 * intercom_client.TTS_MESSAGE_MAX)  # checked again once collapsed


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


def _releaser(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Principal:
    """`access.release` at installation scope, as a dependency (checked before the body is looked at; a refusal is
    audited by `require`). `access.read` alone is not enough: seeing the stations never implies acting on them."""
    require(conn, principal, RELEASE, INSTALLATION)
    return principal


class _Action:
    """One physical request's audit context: who, which endpoint, which station, and what is known so far."""

    def __init__(self, request: Request, conn: sqlite3.Connection, principal: Principal, action: str, station_id: str) -> None:
        self.request, self.conn, self.principal, self.action, self.station_id = request, conn, principal, action, station_id
        self.rid = getattr(request.state, "correlation_id", None)
        self.details: dict[str, Any] = {"command": action.removeprefix("intercom.")}

    def _row(self, conn: sqlite3.Connection, decision: str, reason: str | None, fields: dict[str, Any]) -> None:
        audit(conn, actor=self.principal, action=self.action, decision=decision, resource_type="intercom_station", resource_id=self.station_id,
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
        self.conn.execute("COMMIT")

    def outcome(self, outcome: str, reason: str | None, fields: dict[str, Any]) -> None:
        try:
            db: Database = self.request.app.state.db
            with db.write_aside() as w:
                self._row(w, "allowed", reason, {"phase": "outcome", "outcome": outcome, **fields})
        except Exception:  # noqa: BLE001 - the command was sent; its attempt row stands (see the section note)
            log.exception("audit: the outcome (%s) of %s command %s could not be recorded; its attempt row stands", outcome, self.action, self.details.get("command_id"))


async def _raw_body(request: Request) -> bytes:
    """The request body, unparsed. Declared AFTER the permission dependency, so a caller without access.release gets
    403 whatever they sent, and a body that is not JSON is an audited refusal (`_parse`), not FastAPI's bare 422."""
    return await request.body()


def _parse(act: _Action, model: type[BaseModel], raw: bytes) -> Any:
    """Validate the station id and the body; every failure is an audited refusal (nothing is sent)."""
    if not 1 <= len(act.station_id) <= MAX_STATION_ID:
        act.station_id = act.station_id[:MAX_STATION_ID]  # the audit row keeps a bounded id
        raise act.refuse(ApiError(422, "validation", "מזהה העמדה אינו תקין.", details={"fields": ["station_id"]}))
    try:
        data = json.loads(raw) if raw.strip() else {}
    except ValueError:
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
        raise act.refuse(ApiError(422, "expires_too_far", f"תוקף הבקשה חייב להסתיים תוך {int(EXPIRY_MAX_S)} שניות."))
    since = (now - timedelta(seconds=DEDUPE_WINDOW_S)).strftime("%Y-%m-%dT%H:%M:%SZ")
    seen = act.conn.execute(
        "SELECT 1 FROM audit_log WHERE action = ? AND actor_user_id = ? AND at >= ? AND details_json LIKE ? AND details_json LIKE ? LIMIT 1",
        (act.action, act.principal.user_id, since, f'%"client_request_id": "{body.client_request_id}"%', '%"phase": "attempt"%'),
    ).fetchone()
    if seen:
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
            raise act.refuse(ApiError(409, "intercom_station_offline", f"העמדה {station['name']} אינה מחוברת כרגע, ולכן הפקודה לא נשלחה."))
    return station


def _perform(
    act: _Action,
    key: str,
    send: Callable[[intercom_client.Call], Any],
    project: Callable[[Any], dict[str, Any]],
    not_after: datetime,
    on_settled: Callable[[], None] | None = None,
    on_unknown: Callable[[], None] | None = None,
) -> dict[str, Any]:
    """Audit the attempt (committed), send once through IntercomSync.action, audit the outcome. `on_settled` is always
    called exactly once (by IntercomSync once the command was handed over, here when it never got that far);
    `on_unknown` when the outcome is unknown."""
    try:
        act.attempt()
    except BaseException:
        if on_settled:
            on_settled()
        raise
    try:
        reply = intercom_sync.SYNC.action(settings_of(act.request), key, send, project, who=act.principal.user_id, not_after=not_after, on_settled=on_settled)
    except ApiError as exc:
        outcome = str(exc.details.get("outcome") or "unknown")
        if outcome == "unknown" and on_unknown:
            on_unknown()
        code = str(exc.details.get("wiskey_code") or exc.code)
        act.outcome(outcome, code, {"error": exc.code, "wiskey_code": code})
        raise
    except BaseException as exc:
        if on_unknown:
            on_unknown()
        act.outcome("unknown", type(exc).__name__, {"error": type(exc).__name__})
        raise
    finally:
        act.conn.execute("BEGIN")  # deferred: takes no lock, cannot wait on a busy database; nothing more is written here
    act.outcome("ok", None, {"result": reply[key]})
    reply["command_id"] = act.details["command_id"]
    return reply


@router.post("/intercom/stations/{station_id}/release")
def release(request: Request, station_id: str, principal: Principal = Depends(_releaser), conn: sqlite3.Connection = Depends(get_conn), raw: bytes = Depends(_raw_body)) -> dict[str, Any]:
    """Release a station's door relay once (WisKey `stations/test_unlock`). Body: `{lock?, confirmed, client_request_id,
    expires_at}`; `confirmed: true` is sent only by the UI's confirmation dialog. The reply's `release.accepted` means
    WisKey ACCEPTED the command; it does not mean the door moved (the device's own relay time applies, and WisKey
    reports no physical confirmation). Refused before sending, each refusal audited: a malformed body, an expired or
    duplicate command, an unknown station (404), a station without an integrated lock, offline, a relay it does not
    have, a missing confirmation, or a release of the same relay not yet resolved (409 `intercom_release_in_progress`:
    until WisKey's answer arrives, and UNKNOWN_HOLD_S longer when the outcome was unknown). Anything that then does
    not complete is an error whose `details.outcome` says whether the command was not sent, refused, or has an unknown
    outcome (IntercomSync.action). Reply: `{state, configured, last_error, fetched_at, release, sync, note, command_id}`."""
    act = _Action(request, conn, principal, "intercom.release", station_id)
    body: ReleaseBody = _parse(act, ReleaseBody, raw)
    not_after = _envelope(act, body)
    station = _station(act, require_online=False)
    lock = body.lock
    if station is not None:
        if not station["lock_enabled"] or not station["locks"]:
            raise act.refuse(ApiError(409, "intercom_no_lock", f"לעמדה {station['name']} אין מנעול משולב פעיל ב־WisKey."))
        indexes = [entry["physical_index"] for entry in station["locks"]]
        if lock is None:
            if len(indexes) != 1:
                raise act.refuse(ApiError(422, "intercom_lock_required", "לעמדה יותר ממנעול אחד - יש לבחור איזה לשחרר.", details={"locks": indexes}))
            lock = indexes[0]
        elif lock not in indexes:
            raise act.refuse(ApiError(422, "intercom_lock_unknown", "לעמדה אין מנעול במספר הזה.", details={"locks": indexes}))
        if not station["online"]:
            raise act.refuse(ApiError(409, "intercom_station_offline", f"העמדה {station['name']} אינה מחוברת כרגע, ולכן הפקודה לא נשלחה."))
    if lock is None:
        lock = 1  # no copy to check against: WisKey's own default relay (panel.ts unlock(station, physical = 1))
    act.details["lock"] = lock
    if body.confirmed is not True:
        raise act.refuse(ApiError(409, "confirmation_required", "שחרור דלת דורש אישור מפורש."))
    entry = RELAYS.acquire((station_id, lock))
    if entry is None:
        wait = RELAYS.remaining((station_id, lock))
        raise act.refuse(ApiError(409, "intercom_release_in_progress", f"שחרור קודם של הדלת הזו עדיין לא הוכרע (ממתין לתשובה, או שתוצאתו לא ידועה). המתינו עד {int(wait) + 1} שניות ובדקו במצלמה לפני שמנסים שוב.", details={"retry_after_s": round(wait, 1)}))
    try:
        reply = _perform(act, "release", lambda call: intercom_client.release_door(call, station_id, lock), intercom_sync.project_release, not_after,
                         on_settled=lambda: RELAYS.settle(entry), on_unknown=lambda: RELAYS.mark_unknown(entry))
    except ApiError as exc:
        if exc.details.get("outcome") == "unknown":
            exc.details["retry_after_s"] = round(RELAYS.remaining((station_id, lock)), 1)  # the UI holds the button this long
        raise
    reply["note"] = "WisKey קיבל את הפקודה. זה אינו אישור שהדלת נפתחה בפועל."
    return reply


@router.post("/intercom/stations/{station_id}/call")
def call_signal(request: Request, station_id: str, principal: Principal = Depends(_releaser), conn: sqlite3.Connection = Depends(get_conn), raw: bytes = Depends(_raw_body)) -> dict[str, Any]:
    """Answer / reject a ringing call or hang up a call in progress (WisKey `media/signal`). Body: `{command,
    client_request_id, expires_at}`. WisKey checks the call state on the device itself and refuses a mismatch
    (`device_unavailable`), so SMPLWISE does not second-guess it from its own copy, which can lag a ring by a moment.
    The reply's `call` is WisKey's result as sent: `acknowledged` (true, or null when the device's answer was lost),
    `observed_state` / `observation` after the signal, and `physical_result: "unverified"`. Refusals and outcomes are
    audited like a release. Reply: `{state, configured, last_error, fetched_at, call, sync, command_id}`."""
    act = _Action(request, conn, principal, "intercom.call", station_id)
    body: CallBody = _parse(act, CallBody, raw)
    act.details["signal"] = body.command
    not_after = _envelope(act, body)
    _station(act)
    return _perform(act, "call", lambda call: intercom_client.media_signal(call, station_id, body.command), intercom_sync.project_signal, not_after)


@router.get("/intercom/tts/engines")
def tts_engines(request: Request, principal: Principal = Depends(_releaser), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Home Assistant's TTS engines WisKey can speak through (`tts/engines`, a read): `{state, configured, last_error,
    fetched_at, tts, sync}` with `tts = {default, engines: [{engine_id, name, supported_languages, default_language}]}`,
    null unless `state` is `ready`. Gated like the announcement itself (WisKey gates it at manage level too)."""
    with unlocked(conn):
        return intercom_sync.SYNC.command(settings_of(request), "tts", intercom_client.tts_engines, intercom_sync.project_tts_engines, who=principal.user_id)


@router.post("/intercom/stations/{station_id}/tts")
def tts_speak(request: Request, station_id: str, principal: Principal = Depends(_releaser), conn: sqlite3.Connection = Depends(get_conn), raw: bytes = Depends(_raw_body)) -> dict[str, Any]:
    """Speak `message` through the station's speaker (WisKey `tts/start`). Body: `{engine_id, language, message,
    client_request_id, expires_at}`. The text goes to the Home Assistant TTS engine `engine_id` - which may be a cloud
    provider, so the text can leave the premises - and is recorded, as spoken, in SMPLWISE's audit log (refused
    requests too). The reply's `tts` is the announcement's progress when WisKey took it (`started`, or already
    `generating` / ...); later progress arrives as `intercom_tts` notices on /intercom/ws, ending in `completed`
    (`physical_result: "unverified"`) or `closed` with a reason. Reply: `{state, configured, last_error, fetched_at,
    tts, sync, command_id}`."""
    act = _Action(request, conn, principal, "intercom.tts", station_id)
    body: TtsBody = _parse(act, TtsBody, raw)
    message = intercom_client.collapse(body.message)
    act.details.update(engine_id=body.engine_id, language=body.language, message=message)
    if not 1 <= len(message) <= intercom_client.TTS_MESSAGE_MAX:
        raise act.refuse(ApiError(422, "validation", f"ההודעה חייבת להכיל 1-{intercom_client.TTS_MESSAGE_MAX} תווים."))
    not_after = _envelope(act, body)
    _station(act)
    language = body.language
    return _perform(act, "tts", lambda call: intercom_sync.SYNC.tts_start(call, station_id, body.engine_id, language, message), lambda status: status, not_after)


@router.websocket("/intercom/ws")
async def intercom_ws(websocket: WebSocket) -> None:
    """Change notices for the entry center (data-free, like WisKey's own `subscribe`): `intercom_refresh` when the
    stations changed, `intercom_state` when the feed's state changed, a heartbeat every 30 s. The client refetches
    GET /intercom/overview; the permission is re-checked every minute and the socket closes (4403) once it is gone."""
    db: Database = websocket.app.state.db
    principal = await _principal_for_ws(websocket)
    if principal is None:
        await websocket.close(code=4401)
        return

    def _allowed() -> bool:
        with db.connection() as conn:
            return authorize(conn, principal, READ, INSTALLATION).allowed

    if not await run_in_threadpool(_allowed):
        await websocket.close(code=4403)
        return
    q = intercom_sync.subscribe()  # before accept: nothing published after the handshake can be missed
    seq = 0
    last_check = time.time()

    def envelope(kind: str, payload: dict[str, Any]) -> str:
        return json.dumps({"version": 1, "type": kind, "sequence": seq, "subscription_id": principal.user_id, "occurred_at": now_iso(), "received_at": now_iso(), "payload": payload}, ensure_ascii=False, default=str)

    try:
        await websocket.accept()
        while True:
            try:
                msg = await asyncio.wait_for(asyncio.get_event_loop().run_in_executor(None, q.get, True, 30), timeout=31)
            except (asyncio.TimeoutError, queue.Empty):
                msg = None
            if time.time() - last_check > RECHECK_S:
                if not await run_in_threadpool(_allowed):
                    await websocket.close(code=4403)
                    return
                last_check = time.time()
            seq += 1
            if msg is None:
                await websocket.send_text(envelope("heartbeat", {"sync": intercom_sync.STATE.as_dict()}))
            else:
                await websocket.send_text(envelope(str(msg.get("type")), msg))
    except Exception:
        pass
    finally:
        intercom_sync.unsubscribe(q)
