"""WISKEY-PEOPLE-COMPLETE-2390 (plan task T9; owner decision Q3 "a" of 03.11): people on door stations that WisKey does not manage,
the administrator's actions on them, and the people screen's duplicate checks. The WisKey side is services/station_people.py.

Permissions (Arx RBAC is the only authority; WisKey sees the add-on's one identity):
- every endpoint: `access.people.manage` somewhere a station can be, before the body is read (an audited 403);
- a station's users, and every action on them: `access.people.manage` ON THAT STATION (the station scope); a station outside it is
  the uniform 404 of a station that does not exist; the station users' PIN / card / face presence only with
  `access.people.sensitive` there; adopting or deleting a station user that holds a credential needs that level too (it moves a
  credential into, or out of, a person); a station whose user numbers the caller may not see (the administrator made the employee
  number sensitive) is refused;
- the duplicate list: unrestricted `access.people.manage` + `access.people.read` (the groups name people across every station);
  phone and unique-profile duplicates only with unrestricted `access.people.sensitive`;
- the PIN check: `access.people.manage` + `access.people.sensitive`, an interactive session, PIN_CHECKS_PER_MIN per user.

Writes (adopt, ignore, delete from the station) follow the people writes' rules (routers/access_control.py): JSON only, the command
envelope (`client_request_id`, `expires_at`; an expired or repeated command is refused), `confirmed: true` from the confirmation step
(delete: `typed` must repeat the station user number), each station's attempt row committed BEFORE its command is sent and its outcome
row after, one command per station, sent ONCE in the config lane, never queued, never retried. One request may name several stations
of the same station user number: the reply has one honest result per station (`ok`, `refused`, `unknown`, `not_sent`) - a partial
failure is shown as such, and after an `unknown` the remaining stations are not sent (their result says so).

The request uses the READ connection only; every audit row and the stored rows (first seen, ignore) go through a short write of their
own (audit.audit on a read connection, Database.write_aside) - no WisKey round trip ever holds SQLite's write lock.
Nothing here contacts a device directly; tests drive it with tests/fake_wiskey.py (tests/test_wiskey_station_people_2390.py)."""
from __future__ import annotations

import json
import logging
import re
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

from fastapi import APIRouter, Depends, Path, Query, Request, Response
from pydantic import BaseModel, ConfigDict, Field, StrictBool, ValidationError

from ..audit import audit
from ..auth import settings_of
from ..db import Database
from ..errors import ApiError
from ..services import intercom_client, intercom_sync
from ..services import intercom_authority as ia
from ..services import intercom_writes as iw
from ..services import station_people as sp
from ..services.timeutil import parse_utc
from .access_control import COMMAND_ID, DEDUPE_WINDOW_S, EXPIRY_MAX_S, SEND_WITHIN_S, _is_json, _raw_body, people_writer

log = logging.getLogger("smplwise.intercom")
router = APIRouter()

MANAGE = ia.PEOPLE_MANAGE
STATION_USER = "intercom_station_user"
A_ADOPT = "intercom.station_people.adopt"
A_DELETE = "intercom.station_people.delete"
A_IGNORE = "intercom.station_people.ignore"
A_PIN_CHECK = "intercom.person.pin_check"
STATION_ID = r"^[A-Za-z0-9_.:-]{1,128}$"
MAX_STATIONS = 32

NOT_FOUND = ("intercom_station_not_found", "העמדה לא נמצאה.")
CODES_HE: dict[str, str] = {
    "review_stale": "המשתמש השתנה בעמדה מאז שנקרא. רעננו את הרשימה ונסו שוב.",
    "already_managed": "המשתמש כבר מנוהל בעמדה הזו.",
    "unsupported_credentials": "למשתמש בעמדה יש פנים או טביעת אצבע - אי אפשר לאמץ אותו כמו שהוא.",
    "unmanaged_lock": "המשתמש מורשה בעמדה לדלת שאינה מנוהלת - אי אפשר לאמץ אותו כמו שהוא.",
    "schedule_unverified": "למשתמש בעמדה יש לוח זמנים שאי אפשר לאמת - אי אפשר לאמץ אותו כמו שהוא.",
    "pin_device_managed": "העמדה מנהלת את הקוד בעצמה - אי אפשר לאמץ את המשתמש כמו שהוא.",
    "local_validity_needs_conversion": "תוקף המשתמש בעמדה רשום בשעון מקומי - אי אפשר לאמץ אותו כמו שהוא.",
    "device_user_missing": "המשתמש כבר לא נמצא בעמדה.",
    "identity_migration_required": "האדם הקיים רשום במספר אחר - אי אפשר לקשר אליו.",
    "station_offline": "העמדה אינה מחוברת.",
    "device_unavailable": "העמדה לא ענתה.",
    "employee_conflict": "המספר הזה כבר שייך לאדם אחר.",
    "pin_conflict": "הקוד של המשתמש כבר שייך לאדם אחר.",
    "card_conflict": "כרטיס של המשתמש כבר שייך לאדם אחר.",
    "revision_conflict": "האדם השתנה בינתיים. רעננו ונסו שוב.",
}
# a WisKey code without a sentence of its own: the outcome in plain words (never the platform's own message text)
GENERIC_HE: dict[str, str] = {
    "refused": "בקרת הכניסה דחתה את הפעולה, והיא לא בוצעה.",
    "not_sent": "הפעולה לא נשלחה (בקרת הכניסה אינה זמינה כרגע או עסוקה). אפשר לנסות שוב.",
    "unknown": "לא ידוע אם הפעולה בוצעה. רעננו את הרשימה ובדקו לפני שמנסים שוב.",
}


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _db(request: Request) -> Database:
    return request.app.state.db


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------- the station scope

def _station_names() -> dict[str, str]:
    return {s["id"]: s.get("name") or s["id"] for s in intercom_sync.SYNC.stations() if isinstance(s.get("id"), str)}


def _managed_station(auth: ia.Authority, station_id: str) -> str:
    """The station's name when the caller manages people there and it is in the served copy; else the uniform 404."""
    names = _station_names()
    if station_id not in names or not auth.station(MANAGE, station_id):
        raise ApiError(404, *NOT_FOUND)
    return names[station_id]


def _numbers_visible(auth: ia.Authority, station_id: str) -> bool:
    level = ia.SENSITIVE if auth.station(ia.PEOPLE_SENSITIVE, station_id) else ia.NAMES
    return auth.employee_no_for(level)


# ---------------------------------------------------------------- reads

@router.get("/access-control/station-people/stations")
def station_list(request: Request, auth: ia.Authority = Depends(people_writer())) -> dict[str, Any]:
    """The stations whose users the caller may review (`access.people.manage` on each), from the served copy (no WisKey call):
    `{stations: [{id, name, online, ignored, credentials, numbers}]}` - `ignored` how many of its users an administrator chose to
    ignore, `credentials` whether the caller sees PIN / card / face presence there, `numbers` whether they see user numbers."""
    counts = sp.ignored_counts(auth.conn)
    out = []
    for s in intercom_sync.SYNC.stations():
        sid = s.get("id")
        if not isinstance(sid, str) or not auth.station(MANAGE, sid):
            continue
        out.append({"id": sid, "name": s.get("name") or sid, "online": s.get("online") is True, "ignored": counts.get(sid, 0),
                    "credentials": auth.station(ia.PEOPLE_SENSITIVE, sid), "numbers": _numbers_visible(auth, sid)})
    return {"state": intercom_sync.STATE.state, "stations": out}


def _scan(request: Request, auth: ia.Authority, station_id: str, refresh: bool) -> tuple[sp.Inventory | None, dict[str, Any]]:
    """The station's inventory: from memory when at most CACHE_S old (unless `refresh`), else one `stations/inventory` read."""
    if not refresh:
        cached = sp.CACHE.get(station_id, sp.CACHE_S)
        if cached is not None:
            return cached, {"state": "ready", "last_error": None, "cached": True}
    reply = intercom_sync.SYNC.command(settings_of(request), "inventory", lambda call: sp.inventory(call, station_id),
                                       lambda raw: {"rows": sp.project_rows(raw)}, who=auth.principal.user_id,
                                       timeout=sp.INVENTORY_TIMEOUT_S, channel=sp.CHANNEL, slot_wait=2.0)
    got = reply.get("inventory")
    if got is None:
        return None, {"state": reply.get("state"), "last_error": reply.get("last_error"), "cached": False}
    inv = sp.Inventory(station_id, got["rows"], time.monotonic(), reply.get("fetched_at") or _now().strftime("%Y-%m-%dT%H:%M:%SZ"))
    sp.CACHE.put(inv)
    with _db(request).write_aside() as w:
        sp.record_seen(w, station_id, [r.employee_no for r in sp.station_only(inv)], at=inv.read_at_iso)
    return inv, {"state": "ready", "last_error": None, "cached": False}


@router.get("/access-control/station-people/stations/{station_id}")
def station_users(request: Request, response: Response, auth: ia.Authority = Depends(people_writer()),
                  station_id: str = Path(pattern=STATION_ID), refresh: bool = Query(False)) -> dict[str, Any]:
    """The station's users that no WisKey person is bound to: `{state, last_error, station: {id, name}, read_at, cached, people}`; each
    person `{employee_no, display_name, first_seen_at, last_seen_at, ignored, ignored_at, ignored_in_wiskey, adoptable, import_error,
    pin, cards, biometric}` (the last three null without `access.people.sensitive` on the station). WisKey reads the station
    (`stations/inventory`); the answer is kept CACHE_S - `refresh=true` reads it again. A station the feed cannot read answers
    `people: null` with WisKey's state and code (offline, busy, forbidden ...), never an empty list."""
    response.headers["Cache-Control"] = "no-store"
    name = _managed_station(auth, station_id)
    if not _numbers_visible(auth, station_id):
        raise ApiError(403, "station_people_numbers_hidden", "מספרי המשתמשים בעמדה הזו מוגדרים כפרט רגיש, ואין לך הרשאה לפרטים רגישים בה.")
    inv, head = _scan(request, auth, station_id, refresh)
    base = {**head, "station": {"id": station_id, "name": name}}
    if inv is None:
        return {**base, "read_at": None, "people": None}
    saved = sp.stored(auth.conn, station_id)
    return {**base, "read_at": inv.read_at_iso, "people": sp.view_rows(inv, saved, credentials=auth.station(ia.PEOPLE_SENSITIVE, station_id))}


class CheckBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    station_id: str = Field(pattern=STATION_ID)
    employee_no: str = Field(pattern=sp.EMPLOYEE_NO.pattern)


def _body(request: Request, raw: bytes, model: type[BaseModel], refuse: Callable[[ApiError], ApiError]) -> Any:
    content_type = request.headers.get("content-type")
    if not _is_json(content_type):
        raise refuse(ApiError(415, "unsupported_media_type", "הבקשה חייבת להישלח כ־JSON (Content-Type: application/json).", details={"content_type": (content_type or "")[:100]}))
    try:
        data = json.loads(raw) if raw.strip() else {}
    except (ValueError, RecursionError):
        raise refuse(ApiError(422, "validation", "גוף הבקשה אינו JSON תקין.", details={"fields": ["body"]})) from None
    try:
        return model.model_validate(data)
    except ValidationError as exc:
        fields = sorted({".".join(str(p) for p in err["loc"]) or "body" for err in exc.errors()})
        raise refuse(ApiError(422, "validation", "הבקשה אינה תקינה: " + ", ".join(fields), details={"fields": fields})) from None


def _matches(request: Request, auth: ia.Authority, data: dict[str, Any], user_id: str = "") -> dict[str, Any]:
    """`users/duplicate_check` as the caller may see it: the matches by name only for an unrestricted people reader (they can be on
    any station), else only how many there are and whether one has the same number. `same_number`: the WisKey person with this
    user number (adopt links the station user to them)."""
    reply = intercom_sync.SYNC.command(settings_of(request), "check", lambda call: sp.duplicate_check(call, user_id, data), lambda raw: raw if isinstance(raw, dict) else {},
                                       who=auth.principal.user_id, channel=sp.CHANNEL)
    raw = reply.get("check")
    if raw is None:
        return {"state": reply.get("state"), "last_error": reply.get("last_error"), "checked": False, "matches": [], "total": 0, "same_number": None, "restricted": False}
    rows = [m for m in raw.get("matches") or [] if isinstance(m, dict) and isinstance(m.get("id"), str)]
    same = next((m for m in rows if "employee_no" in (m.get("reasons") or [])), None)
    full = auth.unrestricted(ia.PEOPLE_READ)
    numbers = auth.employee_no_everywhere()
    out = [{"id": m["id"], "display_name": sp._text(m.get("display_name"), sp.NAME_MAX), "employee_no": m.get("employee_no") if numbers else None,
            "reasons": [r for r in m.get("reasons") or [] if r in ("employee_no", "display_name", "phone", "card_last4")]} for m in rows] if full else []
    return {"state": "ready", "last_error": None, "checked": True, "matches": out, "total": int(raw.get("total") or len(rows)),
            "same_number": ({"id": same["id"], "display_name": sp._text(same.get("display_name"), sp.NAME_MAX)} if same is not None and full else
                            ({"id": None, "display_name": ""} if same is not None else None)),
            "restricted": not full}


@router.post("/intercom/station-people/check")
def station_user_check(request: Request, auth: ia.Authority = Depends(people_writer()), raw: bytes = Depends(_raw_body)) -> dict[str, Any]:
    """Before adopting: is this station user already a WisKey person (same user number - adopt links to them) or possibly the same
    person under another number (same name / phone; WisKey `users/duplicate_check`)? Body `{station_id, employee_no}`; the name is the
    one the station reported in the last inventory. Reply `{checked, matches, total, same_number, restricted}`."""
    def refuse(exc: ApiError) -> ApiError:
        return exc

    body: CheckBody = _body(request, raw, CheckBody, refuse)
    _managed_station(auth, body.station_id)
    inv = sp.CACHE.get(body.station_id, sp.TOKEN_MAX_AGE_S)
    row = sp.find(inv, body.employee_no) if inv is not None else None
    if row is None:
        raise ApiError(409, "station_people_rescan_required", "רשימת המשתמשים של העמדה ישנה או שהמשתמש כבר לא בה. רעננו את הרשימה ונסו שוב.")
    data: dict[str, Any] = {"employee_no": row.employee_no}
    if row.display_name:
        data["display_name"] = row.display_name
    return _matches(request, auth, data)


@router.get("/access-control/people-duplicates")
def people_duplicates(request: Request, response: Response, auth: ia.Authority = Depends(people_writer())) -> dict[str, Any]:
    """People who may be the same person twice (WisKey `users/data_quality`, duplicates only): groups `{code, field_id, label, people:
    [{id, display_name}], more}`, never the shared value. `restricted: true` (and no groups) for a caller whose people permissions do
    not cover every station. Phone / unique-profile groups only with `access.people.sensitive` everywhere. Up to DQ_MAX_PAGES pages."""
    response.headers["Cache-Control"] = "no-store"
    if not (auth.unrestricted(MANAGE) and auth.unrestricted(ia.PEOPLE_READ)):
        return {"state": "ready", "restricted": True, "groups": [], "complete": True}
    pages: list[dict[str, Any]] = []
    snapshot, offset, complete = "", 0, True
    for _ in range(sp.DQ_MAX_PAGES):
        reply = intercom_sync.SYNC.command(settings_of(request), "quality", lambda call, o=offset, s=snapshot: sp.data_quality(call, o, s),
                                           lambda raw: raw if isinstance(raw, dict) else {}, who=auth.principal.user_id, channel=sp.CHANNEL, slot_wait=1.0)
        page = reply.get("quality")
        if page is None:
            if not pages:
                return {"state": reply.get("state"), "last_error": reply.get("last_error"), "restricted": False, "groups": None, "complete": False}
            complete = False
            break
        if page.get("stale"):
            complete = False
            break
        pages.append(page)
        snapshot = str(page.get("snapshot") or "")
        nxt = page.get("next_offset")
        if not isinstance(nxt, int) or nxt <= offset:
            break
        offset = nxt
    else:
        complete = False
    groups = sp.project_duplicates(pages, sensitive=auth.unrestricted(ia.PEOPLE_SENSITIVE))
    return {"state": "ready", "last_error": None, "restricted": False, "groups": groups, "complete": complete}


# ---------------------------------------------------------------- the PIN check

class PinCheckBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    user_id: str = Field("", max_length=128)
    pin: str = Field(pattern=r"^[0-9]{1,128}$")


@router.post("/intercom/people/pin-check")
def pin_check(request: Request, response: Response, auth: ia.Authority = Depends(people_writer(ia.PEOPLE_SENSITIVE)), raw: bytes = Depends(_raw_body)) -> dict[str, Any]:
    """Whether a PIN typed in the editor is free in WisKey (`users/pin_check`; body `{user_id, pin}`, `user_id` "" for a new person).
    Reply `{state, last_error, available}` (`available` null when WisKey could not answer). The PIN goes to WisKey once and is never
    stored, logged, cached or audited; the audit row says who checked, for whom, and whether it was free. An interactive session only,
    PIN_CHECKS_PER_MIN per user (it tells whether a PIN is in use)."""
    response.headers["Cache-Control"] = "no-store"
    rid = _rid(request)

    def refuse(exc: ApiError, target: str = "new") -> ApiError:
        audit(auth.conn, actor=auth.principal, action=A_PIN_CHECK, decision="denied", resource_type="intercom_person", resource_id=target,
              reason=exc.code, request_id=rid, details={"phase": "refused"})
        return exc

    body: PinCheckBody = _body(request, raw, PinCheckBody, refuse)
    target = body.user_id or "new"
    if not iw.interactive(auth.principal):
        raise refuse(ApiError(403, "intercom_pin_interactive_only", "בדיקת קוד זמינה רק בהפעלה אינטראקטיבית של אדם (דפדפן)."), target)
    if body.user_id:
        try:
            iw.gate_person_write(settings_of(request), auth, body.user_id, sensitive=True)
        except ApiError as exc:
            raise refuse(exc, target) from None
    if not sp.PIN_BUDGET.take(auth.principal.user_id):
        raise refuse(ApiError(429, "intercom_rate_limited", "יותר מדי בדיקות קוד בזמן קצר. נסו שוב בעוד דקה.", retryable=True), target)
    reply = intercom_sync.SYNC.command(settings_of(request), "pin", lambda call: sp.pin_check(call, body.user_id, body.pin), lambda r: r,
                                       who=auth.principal.user_id, channel=sp.CHANNEL)
    got = reply.get("pin")
    available = got.get("available") if isinstance(got, dict) else None
    audit(auth.conn, actor=auth.principal, action=A_PIN_CHECK, decision="allowed", resource_type="intercom_person", resource_id=target, request_id=rid,
          details={"phase": "outcome", "outcome": "ok" if available is not None else "failed", "available": available, "wiskey_code": reply.get("last_error")})
    return {"state": reply.get("state"), "last_error": reply.get("last_error"), "available": available}


# ---------------------------------------------------------------- writes

class _Write(BaseModel):
    model_config = ConfigDict(extra="forbid")
    client_request_id: str = Field(pattern=COMMAND_ID)
    expires_at: str = Field(min_length=1, max_length=40)
    employee_no: str = Field(pattern=sp.EMPLOYEE_NO.pattern)
    station_ids: list[str] = Field(min_length=1, max_length=MAX_STATIONS)
    confirmed: Any = None


class AdoptBody(_Write):
    allow_possible_duplicate: StrictBool = False  # the operator saw "maybe the same person" and adopts anyway


class DeleteBody(_Write):
    typed: str = Field("", max_length=64)  # the station user number, typed again in the confirmation


class IgnoreBody(_Write):
    ignored: StrictBool


class _Step:
    """One station of a write: its own audit rows (attempt committed before the send, outcome after), all through a short write of
    their own (the request holds the read connection only)."""

    def __init__(self, request: Request, auth: ia.Authority, action: str, station_id: str, details: dict[str, Any]) -> None:
        self.request, self.auth, self.action, self.station_id = request, auth, action, station_id
        self.rid = _rid(request)
        self.details = {**details, "station_id": station_id}

    def _row(self, decision: str, reason: str | None, fields: dict[str, Any]) -> None:
        audit(self.auth.conn, actor=self.auth.principal, action=self.action, decision=decision, resource_type="intercom_station", resource_id=self.station_id,
              reason=reason, request_id=self.rid, details={**self.details, **fields})

    def refuse(self, exc: ApiError) -> dict[str, Any]:
        self._row("denied", exc.code, {"phase": "refused", "outcome": "not_sent"})
        return {"station_id": self.station_id, "outcome": "not_sent", "code": exc.code, "message": exc.user_message}

    def attempt(self) -> None:
        self.details["command_id"] = uuid.uuid4().hex
        self._row("allowed", None, {"phase": "attempt"})

    def outcome(self, outcome: str, reason: str | None, fields: dict[str, Any]) -> None:
        try:
            self._row("allowed", reason, {"phase": "outcome", "outcome": outcome, **fields})
        except Exception:  # noqa: BLE001 - the command was sent; its attempt row stands
            log.exception("audit: the outcome (%s) of %s for a station user could not be recorded; its attempt row stands", outcome, self.action)

    def send(self, key: str, send: Callable[[intercom_client.Call], Any], project: Callable[[Any], Any], not_after: datetime, *,
             target: str | None = None, summary: Callable[[Any], Any] | None = None) -> dict[str, Any]:
        """Attempt row, one command in the config lane on the station_people channel, outcome row. Never raises for WisKey's answer:
        the per-station result says `ok` / `refused` / `unknown` / `not_sent`."""
        self.attempt()
        try:
            reply = intercom_sync.SYNC.action(settings_of(self.request), key, send, project, who=self.auth.principal.user_id, not_after=not_after,
                                              lane="config", target=target, channel=sp.CHANNEL)
        except ApiError as exc:
            outcome = str(exc.details.get("outcome") or "unknown")
            code = str(exc.details.get("wiskey_code") or exc.code)
            self.outcome(outcome, code, {"error": exc.code, "wiskey_code": code})
            message = CODES_HE.get(code) or GENERIC_HE.get(outcome, GENERIC_HE["unknown"])
            return {"station_id": self.station_id, "outcome": outcome, "code": code, "message": message}
        except Exception as exc:  # noqa: BLE001 - after the attempt row anything unexpected is "unknown", never "not sent"
            self.outcome("unknown", type(exc).__name__, {"error": type(exc).__name__})
            return {"station_id": self.station_id, "outcome": "unknown", "code": "error", "message": "לא ידוע אם הפעולה בוצעה."}
        result = reply[key]
        self.outcome("ok", None, {"result": summary(result) if summary else None})
        return {"station_id": self.station_id, "outcome": "ok", "code": None, "message": None, "result": result, "command_id": self.details["command_id"]}


def _begin(request: Request, auth: ia.Authority, action: str, raw: bytes, model: type[_Write]) -> tuple[Any, datetime]:
    """Parse, envelope (expiry, repeated command) and confirmation - each refusal one audited row, nothing sent."""
    rid = _rid(request)
    target = {"id": "new"}

    def refuse(exc: ApiError, details: dict[str, Any] | None = None) -> ApiError:
        exc.details.setdefault("outcome", "not_sent")
        audit(auth.conn, actor=auth.principal, action=action, decision="denied", resource_type=STATION_USER, resource_id=target["id"],
              reason=exc.code, request_id=rid, details={"phase": "refused", "outcome": "not_sent", **(details or {})})
        return exc

    body = _body(request, raw, model, refuse)
    target["id"] = body.employee_no
    env = {"client_request_id": body.client_request_id, "expires_at": body.expires_at}
    try:
        expires = parse_utc(body.expires_at)
    except ValueError:
        raise refuse(ApiError(422, "validation", "expires_at חייב להיות זמן UTC (Z)."), env) from None
    now = _now()
    if expires <= now:
        raise refuse(ApiError(409, "expired", "הבקשה פגה לפני שהגיעה לשרת, ולכן לא נשלחה."), env)
    if expires > now + timedelta(seconds=EXPIRY_MAX_S):
        raise refuse(ApiError(422, "expires_too_far", f"תוקף הבקשה חייב להסתיים תוך {int(EXPIRY_MAX_S)} שניות."), env)
    since = (now - timedelta(seconds=DEDUPE_WINDOW_S)).strftime("%Y-%m-%dT%H:%M:%SZ")
    seen = auth.conn.execute(
        "SELECT 1 FROM audit_log WHERE action = ? AND actor_user_id = ? AND at >= ? AND details_json LIKE ? AND details_json LIKE ? LIMIT 1",
        (action, auth.principal.user_id, since, f'%"client_request_id": "{body.client_request_id}"%', '%"phase": "attempt"%'),
    ).fetchone()
    if seen:
        raise refuse(ApiError(409, "intercom_duplicate_command", "הפקודה הזו כבר נשלחה (אותו מזהה פקודה), ולכן לא נשלחה שוב."), env)
    if len(set(body.station_ids)) != len(body.station_ids) or any(not isinstance(s, str) or not re.match(STATION_ID, s) for s in body.station_ids):
        raise refuse(ApiError(422, "validation", "רשימת העמדות אינה תקינה.", details={"fields": ["station_ids"]}), env)
    if body.confirmed is not True:
        raise refuse(ApiError(409, "confirmation_required", "הפעולה דורשת אישור מפורש."), env)
    return body, min(expires, now + timedelta(seconds=SEND_WITHIN_S))


def _station_row(step: _Step, auth: ia.Authority, employee_no: str) -> tuple[sp.Row | None, dict[str, Any] | None]:
    """The station user from a fresh-enough inventory, under the station-scope rule; else the station's `not_sent` result."""
    if step.station_id not in _station_names() or not auth.station(MANAGE, step.station_id):
        return None, step.refuse(ApiError(404, *NOT_FOUND))
    if not _numbers_visible(auth, step.station_id):
        return None, step.refuse(ApiError(403, "station_people_numbers_hidden", "מספרי המשתמשים בעמדה הזו מוגדרים כפרט רגיש."))
    inv = sp.CACHE.get(step.station_id, sp.TOKEN_MAX_AGE_S)
    row = sp.find(inv, employee_no) if inv is not None else None
    if row is None:
        return None, step.refuse(ApiError(409, "station_people_rescan_required", "רשימת המשתמשים של העמדה ישנה או שהמשתמש כבר לא בה. רעננו את הרשימה ונסו שוב."))
    if row.managed_by is not None:
        return None, step.refuse(ApiError(409, "station_people_already_managed", CODES_HE["already_managed"]))
    return row, None


def _skip(station_id: str) -> dict[str, Any]:
    return {"station_id": station_id, "outcome": "not_sent", "code": "stopped_after_unknown",
            "message": "לא נשלח: לפעולה בעמדה קודמת אין תוצאה ברורה. רעננו את הרשימה ובדקו לפני שממשיכים."}


def _summary(results: list[dict[str, Any]]) -> dict[str, int]:
    out = {"ok": 0, "refused": 0, "unknown": 0, "not_sent": 0}
    for r in results:
        out[r["outcome"]] = out.get(r["outcome"], 0) + 1
    return out


def _public(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [{k: v for k, v in r.items() if k != "result"} for r in results]


@router.post("/intercom/station-people/adopt")
def adopt(request: Request, auth: ia.Authority = Depends(people_writer()), raw: bytes = Depends(_raw_body)) -> dict[str, Any]:
    """Adopt a station user (WisKey `users/adopt`): WisKey creates the person from the user as the station holds it and binds them -
    nothing is created on the station. Body `{employee_no, station_ids, confirmed, allow_possible_duplicate, client_request_id,
    expires_at}`. The first station creates the person, or - when WisKey already has a person with this user number - links to
    them (`user_id` + the revision a fresh read returned); every further station links to the person the first one produced. Before
    anything is sent, `users/duplicate_check`: a possible duplicate under another number (same name / phone) refuses the request
    409 `station_people_possible_duplicate` unless `allow_possible_duplicate` (the operator saw the warning). Reply `{results:
    [{station_id, outcome, code, message}], summary, person: {id, display_name} | null, effect: "sync"}`."""
    body, not_after = _begin(request, auth, A_ADOPT, raw, AdoptBody)
    details = {"client_request_id": body.client_request_id, "expires_at": body.expires_at, "employee_no": body.employee_no, "stations": len(body.station_ids)}
    steps = [_Step(request, auth, A_ADOPT, sid, details) for sid in body.station_ids]
    results: dict[str, dict[str, Any]] = {}
    rows: dict[str, sp.Row] = {}
    for step in steps:
        row, refused = _station_row(step, auth, body.employee_no)
        if refused is not None:
            results[step.station_id] = refused
            continue
        assert row is not None
        if row.import_error is not None or row.review_token is None:
            code = row.import_error or "review_stale"
            results[step.station_id] = step.refuse(ApiError(409, f"station_people_{code}", CODES_HE.get(code, "אי אפשר לאמץ את המשתמש כמו שהוא.")))
            continue
        try:
            iw.gate_create(auth, [step.station_id], sensitive=sp.has_credentials(row))
        except ApiError as exc:
            results[step.station_id] = step.refuse(exc)
            continue
        rows[step.station_id] = row
    person: dict[str, Any] | None = None
    if rows:
        first = next(iter(rows.values()))
        data: dict[str, Any] = {"employee_no": body.employee_no, **({"display_name": first.display_name} if first.display_name else {})}
        check = _matches(request, auth, data)
        if not check["checked"]:
            for sid in list(rows):
                results[sid] = next(s for s in steps if s.station_id == sid).refuse(
                    ApiError(503, "station_people_check_unavailable", "לא ניתן היה לבדוק כפילויות כרגע, ולכן לא נשלח דבר. נסו שוב בעוד רגע."))
            rows.clear()
        else:
            same = check["same_number"]
            others = check["total"] - (1 if same is not None else 0)
            if others > 0 and not body.allow_possible_duplicate:
                for sid in list(rows):
                    results[sid] = next(s for s in steps if s.station_id == sid).refuse(
                        ApiError(409, "station_people_possible_duplicate", "ייתכן שהאדם כבר קיים בשם אחר. בדקו את ההתאמות ואשרו שוב.", details={"matches": others}))
                rows.clear()
            link: tuple[str, int] | None = None
            if rows and same is not None:
                link_id = same.get("id") or (_raw_same(request, auth, data) or {}).get("id")
                try:
                    if not isinstance(link_id, str):
                        raise ApiError(503, "station_people_check_unavailable", "לא ניתן היה לבדוק כפילויות כרגע, ולכן לא נשלח דבר. נסו שוב בעוד רגע.")
                    target = iw.gate_person_write(settings_of(request), auth, link_id, after=list(rows), sensitive=any(sp.has_credentials(r) for r in rows.values()), need_person=True)
                except ApiError as exc:
                    for sid in list(rows):
                        results[sid] = next(s for s in steps if s.station_id == sid).refuse(exc)
                    rows.clear()
                else:
                    rev = (target.person or {}).get("revision")
                    if type(rev) is int:
                        link = (link_id, rev)
                    else:
                        for sid in list(rows):
                            results[sid] = next(s for s in steps if s.station_id == sid).refuse(ApiError(409, "intercom_revision_conflict", CODES_HE["revision_conflict"]))
                        rows.clear()
            stopped = False
            for step in steps:
                sid = step.station_id
                if sid not in rows:
                    continue
                if stopped:
                    results[sid] = _skip(sid)
                    continue
                row = rows[sid]
                token = row.review_token or ""
                uid, rev = link if link is not None else (None, None)
                step.details["mode"] = "link" if uid else "new"
                res = step.send("person", lambda call, s=sid, t=token, u=uid, r=rev: sp.adopt(call, s, body.employee_no, t, u, r), iw.project_editor, not_after,
                                target=intercom_sync.person_target(uid) if uid else None, summary=lambda p: {"id": p["id"], "revision": p["revision"]})
                results[sid] = res
                sp.CACHE.forget(sid)
                if res["outcome"] == "ok":
                    p = res["result"]
                    person = {"id": p["id"], "display_name": p.get("display_name") or ""}
                    link = (p["id"], int(p["revision"]))
                elif res["outcome"] == "unknown":
                    stopped = True
    ordered = [results[s.station_id] for s in steps]
    return {"results": _public(ordered), "summary": _summary(ordered), "person": person, **iw.effect_fields("users/create")}


def _raw_same(request: Request, auth: ia.Authority, data: dict[str, Any]) -> dict[str, Any] | None:
    """The WisKey person with this user number, for a caller who may not see the match list (restricted): read directly, never shown -
    the link is then decided by the station-scope rule over that person (gate_person_write)."""
    reply = intercom_sync.SYNC.command(settings_of(request), "check", lambda call: sp.duplicate_check(call, "", {"employee_no": data["employee_no"]}),
                                       lambda raw: raw if isinstance(raw, dict) else {}, who=auth.principal.user_id, channel=sp.CHANNEL)
    raw = reply.get("check") or {}
    return next((m for m in raw.get("matches") or [] if isinstance(m, dict) and "employee_no" in (m.get("reasons") or []) and isinstance(m.get("id"), str)), None)


@router.post("/intercom/station-people/delete")
def delete_from_station(request: Request, auth: ia.Authority = Depends(people_writer()), raw: bytes = Depends(_raw_body)) -> dict[str, Any]:
    """Delete a user from the station (WisKey `users/delete_unmanaged`: WisKey records the user and its removal in one commit and its
    own sync deletes it from the device - a DEVICE WRITE, not immediate). Body `{employee_no, station_ids, confirmed, typed,
    client_request_id, expires_at}`; `typed` must repeat the user number (the typed confirmation). Reply `{results, summary, effect:
    "unknown_effect", pending: true}` - the screen says "sent, removal pending" until a fresh inventory no longer lists the user."""
    body, not_after = _begin(request, auth, A_DELETE, raw, DeleteBody)
    details = {"client_request_id": body.client_request_id, "expires_at": body.expires_at, "employee_no": body.employee_no, "stations": len(body.station_ids)}
    steps = [_Step(request, auth, A_DELETE, sid, details) for sid in body.station_ids]
    if body.typed.strip() != body.employee_no:
        exc = ApiError(409, "station_people_typed_mismatch", "המספר שהוקלד אינו מספר המשתמש בעמדה, ולכן לא נשלח דבר.")
        for step in steps:
            step.refuse(exc)
        exc.details["outcome"] = "not_sent"
        raise exc
    results: list[dict[str, Any]] = []
    stopped = False
    for step in steps:
        if stopped:
            results.append(_skip(step.station_id))
            continue
        row, refused = _station_row(step, auth, body.employee_no)
        if refused is not None:
            results.append(refused)
            continue
        assert row is not None
        if row.review_token is None:
            results.append(step.refuse(ApiError(409, "station_people_review_stale", CODES_HE["review_stale"])))
            continue
        try:
            iw.gate_create(auth, [step.station_id], sensitive=sp.has_credentials(row))
        except ApiError as exc:
            results.append(step.refuse(exc))
            continue
        token = row.review_token
        res = step.send("deleted", lambda call, s=step.station_id, t=token: sp.delete_unmanaged(call, s, body.employee_no, t),
                        lambda raw: {"id": raw["id"]} if isinstance(raw, dict) and isinstance(raw.get("id"), str) else {"id": None}, not_after,
                        summary=lambda r: r)
        sp.CACHE.forget(step.station_id)
        results.append(res)
        stopped = res["outcome"] == "unknown"
    return {"results": _public(results), "summary": _summary(results), "effect": "unknown_effect", "pending": True,
            "note": "WisKey קיבל את המחיקה. ההסרה מהעמדה מתבצעת בסנכרון של WisKey ואינה מיידית - רעננו את הרשימה כדי לראות שהמשתמש ירד."}


@router.post("/intercom/station-people/ignore")
def ignore(request: Request, auth: ia.Authority = Depends(people_writer()), raw: bytes = Depends(_raw_body)) -> dict[str, Any]:
    """Ignore a station user (or undo it): stored in Arx's list first (migration 0198 - the screen hides it from then on), then
    mirrored to WisKey's own flag (`users/ignore`) so its unmanaged counts agree. Body `{employee_no, station_ids, ignored, confirmed,
    client_request_id, expires_at}`. Reply `{results: [{station_id, outcome, code, message, stored}], summary}` - `stored` says the
    Arx list changed; `outcome` is WisKey's mirror (a refused or unknown mirror leaves the Arx decision in place and says so)."""
    body, not_after = _begin(request, auth, A_IGNORE, raw, IgnoreBody)
    details = {"client_request_id": body.client_request_id, "expires_at": body.expires_at, "employee_no": body.employee_no, "stations": len(body.station_ids),
               "ignored": body.ignored}
    results: list[dict[str, Any]] = []
    for sid in body.station_ids:
        step = _Step(request, auth, A_IGNORE, sid, details)
        if sid not in _station_names() or not auth.station(MANAGE, sid):
            results.append({**step.refuse(ApiError(404, *NOT_FOUND)), "stored": False})
            continue
        if not _numbers_visible(auth, sid):
            results.append({**step.refuse(ApiError(403, "station_people_numbers_hidden", "מספרי המשתמשים בעמדה הזו מוגדרים כפרט רגיש.")), "stored": False})
            continue
        with _db(request).write_aside() as w:
            sp.set_ignored(w, sid, body.employee_no, body.ignored, auth.principal.user_id)
        step.details["stored"] = True
        res = step.send("ignored", lambda call, s=sid: sp.ignore(call, s, body.employee_no, body.ignored), lambda raw: {"accepted": True}, not_after)
        results.append({**res, "stored": True})
    return {"results": _public(results), "summary": _summary(results)}
