"""GRANTS3-295 - CR-ARX-WISKEY-SHARED-IDENTITY phase X5: cards for a vendor's technicians (sections 3.4, 4.5, 8).

A card grant (`credential = 'card'`) is requested, approved, provisioned and revoked like any other external grant
(services/access_grants.py): approved by an interactive human holding `access.external.grant` + people.manage + people.sensitive on
every station (no `access.pin.generate` - nothing is generated), provisioned with the door map, validity and timing and NO credential;
then an approver types the card's number here and Arx writes it through the WisKey seam (`Engine.card_add`, WisKey `cards/add`).

The card number is a credential:
- it exists only inside `attach` (the request body -> one engine call) and is dropped right after; never stored (no table holds it,
  not even masked), never logged, never audited (value, mask, length or hash), never put in an exception text or an HTTP answer;
- a malformed number is refused with a fixed text that does not echo it.

Capture (a card READ at a reader) needs the capture lease route, which is OFF until the owner releases it (CR 3.4): `CAPTURE_PERMITTED`
is a code constant (False) and the capture route answers 409 `access_grant_card_capture_off` - nothing reaches WisKey or a reader.

Who may hold a card grant: a technician of a vendor (a directory person with `vendor_id`) - the "regular vendor" of the backlog item;
a lone visitor gets a PIN or nothing. The cards switch (`access.external.cards`, default off) is on only with the feature switch, and
neither can be turned on without the owner's go-live permit (`access_grants.GO_LIVE_PERMITTED`, False in this build).

At the end (R1-R10) the worker removes every card of the person Arx created (`Worker._remove_cards`) and counts the revocation done
only on a fresh readback that shows no card (`card_unverified` otherwise) - WisKey's revoke-all keeps cards.

`card_state`: awaiting -> adding -> attached | unknown (a lost answer; the next attach reads first and never adds a second card) ->
removed (the grant ended)."""
from __future__ import annotations

import re
import sqlite3
from typing import Any

from ..db import Database
from ..errors import ApiError, forbidden
from ..rbac import STATION, Principal
from . import access_grants as ag
from .access_grant_engine import EngineError

CAPTURE_PERMITTED = False  # the capture lease route is OFF (owner permit + lab run pending); a card is typed by number only
_CARD_NO = re.compile(r"[A-Za-z0-9_-]{1,32}")  # WisKey validate_card (client/access.py), the people editor's IDENTIFIER
LABEL_MAX = 32


def check_request(conn: sqlite3.Connection, contact: dict[str, Any] | None) -> None:
    """A card grant may be requested only while cards are on, for a vendor's technician."""
    if not ag.cards_enabled(conn):
        raise ApiError(409, "access_grant_cards_off", "גישה בכרטיס לאדם חיצוני כבויה.")
    if not (contact or {}).get("vendor_id"):
        raise ApiError(409, "access_grant_card_not_vendor", "כרטיס ניתן רק לטכנאי של ספק. לאורח - קוד אישי.")


ADDING_STALE_S = 120


def _left_over(g: dict[str, Any]) -> bool:
    """An `adding` mark older than ADDING_STALE_S: the write that set it is gone (no call lives that long)."""
    since = ag.parse_iso(g.get("updated_at"))
    return since is not None and (ag.now() - since).total_seconds() > ADDING_STALE_S


def _invalid_number() -> ApiError:
    # a fixed text: the refused value is never echoed (a typo is still a credential)
    return ApiError(422, "access_grant_invalid", "מספר הכרטיס אינו תקין (אותיות לטיניות, ספרות, מקף וקו תחתון, עד 32).", details={"field": "card_no", "code": "format"})


def _state_error(g: dict[str, Any]) -> ApiError:
    return ApiError(409, "access_grant_state", "אי אפשר להוסיף כרטיס לגישה זו במצב הנוכחי.",
                    details={"state": g["state"], "credential": g["credential"], "card_state": g.get("card_state")})


def _checks(conn: sqlite3.Connection, principal: Principal, grant_id: str, revision: int, action: str, request_id: str | None) -> dict[str, Any]:
    """The checks an attach / capture shares: the uniform 404 first, the session, the switch, the approve permissions on every station of
    the grant, the revision. Every refusal after the 404 is audited (ids and reason codes only)."""
    g = ag._visible_or_404(conn, principal, grant_id)

    def deny(reason: str, exc: ApiError) -> ApiError:
        ag._audit(conn, principal, action, grant_id, decision="denied", reason=reason, request_id=request_id)
        return exc

    if not ag._interactive(principal):
        raise deny("not_interactive", ApiError(403, "access_grant_interactive_only", "הוספת כרטיס אפשרית רק ממסך מחובר של אדם."))
    if not ag.cards_enabled(conn):
        raise deny("cards_off", ApiError(409, "access_grant_cards_off", "גישה בכרטיס לאדם חיצוני כבויה."))
    import json

    stations = ag.stations_of(json.loads(g["doors_json"] or "{}"))
    missing = ag.missing_on(conn, principal, ag.approve_permissions("card"), stations)
    if missing or not stations:
        perm, sid = missing[0] if missing else (ag.PERMISSION, "*")
        ag._audit(conn, principal, action, grant_id, decision="denied", reason="no_binding", request_id=request_id, permission=perm, station=sid)
        raise forbidden(permission=perm, target_type=STATION, target_id=sid, reason="no_binding")
    if g["revision"] != revision:
        raise deny("stale", ApiError(409, "stale_revision", "הגישה השתנתה מאז שנטענה. טענו מחדש."))
    return g


def attach(db: Database, principal: Principal, grant_id: str, revision: int, card_no: Any, label: Any = "", request_id: str | None = None) -> dict[str, Any]:
    """Write ONE card to the WisKey person of an ACTIVE card grant. Returns the grant row. The number never leaves this call."""
    number = card_no if isinstance(card_no, str) and _CARD_NO.fullmatch(card_no) else None
    card_no = None
    if number is None:
        raise _invalid_number()
    tag = " ".join(str(label or "").split())[:LABEL_MAX]
    try:
        with db.connection(label="access_cards.attach.begin") as conn:
            g = _checks(conn, principal, grant_id, revision, "access.grant.card_attached", request_id)
            if g.get("card_state") == "adding" and _left_over(g):
                g = {**g, "card_state": "unknown"}  # a write left `adding` (a restart while it was out): read first, like a lost answer
            if g["state"] != "active" or g["credential"] != "card" or g.get("card_state") not in ("awaiting", "unknown"):
                ag._audit(conn, principal, "access.grant.card_attached", grant_id, decision="denied", reason="state", request_id=request_id)
                raise _state_error(g)
            link = ag.link_of_grant(conn, g)
            if not ag.person_is_ours(link):
                ag._audit(conn, principal, "access.grant.card_attached", grant_id, decision="denied", reason="person_not_ours", request_id=request_id)
                raise ag._person_not_ours()
            was = g["card_state"]
            if not ag._touch(conn, grant_id, {"card_state": "adding"}, expect_revision=revision):
                raise ApiError(409, "stale_revision", "הגישה השתנתה מאז שנטענה. טענו מחדש.")
        engine = ag.engine_for(db)
        outcome, code = "attached", None
        try:
            person = engine.get_person(link["wiskey_person_id"])
            if was == "unknown" and person.cards_known and person.card_ids:
                outcome = "present"  # the lost write landed: never a second card
            elif was == "unknown" and not person.cards_known:
                outcome, code = "unknown", "cards_unreadable"
            else:
                try:
                    engine.card_add(person.id, person.revision, card_no=number, label=tag)
                except EngineError as exc:
                    if exc.kind != "revision_conflict":
                        raise
                    person = engine.get_person(link["wiskey_person_id"])
                    engine.card_add(person.id, person.revision, card_no=number, label=tag)
        except EngineError as exc:
            outcome = "unknown" if exc.kind == "unknown" else "refused"
            code = exc.code or exc.kind
        except Exception:  # noqa: BLE001 - after a possible write: unknown, never retried blindly; nothing about the card is logged
            outcome, code = "unknown", "error"
    finally:
        number = None
    state = {"attached": "attached", "present": "attached", "unknown": "unknown"}.get(outcome, "awaiting")
    with db.connection(label="access_cards.attach.done") as conn:
        cur = ag.grant_row(conn, grant_id)
        if cur is not None and cur.get("card_state") == "adding":
            ag._touch(conn, grant_id, {"card_state": state})
        # ids, the outcome and WisKey's closed code only (e.g. `card_conflict`) - never the number, its mask, length or hash
        ag._audit(conn, principal, "access.grant.card_attached", grant_id, decision="allowed" if state == "attached" else "denied",
                  reason=None if outcome == "attached" else ("engine_refused" if outcome == "refused" else outcome), request_id=request_id,
                  outcome=outcome, code=code)
        out = ag.grant_row(conn, grant_id)
    if outcome == "present":
        raise ApiError(409, "access_grant_card_present", "לאדם כבר יש כרטיס במערכת הכניסה (הכתיבה הקודמת נקלטה). לא נוסף כרטיס שני.")
    if outcome == "unknown":
        raise ApiError(409, "access_grant_card_unknown", "לא ידוע אם הכרטיס נשמר במערכת הכניסה. נסו שוב: המערכת תקרא את האדם קודם ולא תוסיף כרטיס שני.")
    if outcome == "refused":
        if code in ("card_conflict", "intercom_card_conflict"):
            raise ApiError(409, "intercom_card_conflict", "הכרטיס הזה כבר שייך לאדם אחר במערכת הכניסה.")
        if code in ("not_sent", "not_permitted", "outcome_pending", "access_grants_not_permitted"):
            raise ApiError(503, "access_grant_engine_unavailable", "מערכת הכניסה אינה זמינה כעת. הכרטיס לא נשמר.", details={"outcome": "not_sent"})
        raise ApiError(409, "access_grant_card_refused", "מערכת הכניסה סירבה לכרטיס. הכרטיס לא נשמר.", details={"code": code})
    return out or {}


def capture(db: Database, principal: Principal, grant_id: str, revision: int, request_id: str | None = None) -> dict[str, Any]:
    """A card READ at a reader for a grant: refused while the capture lease route is not released (CR 3.4) - nothing reaches WisKey."""
    with db.connection(label="access_cards.capture") as conn:
        _checks(conn, principal, grant_id, revision, "access.grant.card_capture", request_id)
        if not CAPTURE_PERMITTED:
            ag._audit(conn, principal, "access.grant.card_capture", grant_id, decision="denied", reason="capture_off", request_id=request_id)
            raise ApiError(409, "access_grant_card_capture_off", "קריאת כרטיס בקורא כבויה עד שבעל המערכת ישחרר אותה. הקלידו את מספר הכרטיס.")
    raise ApiError(409, "access_grant_card_capture_off", "קריאת כרטיס בקורא כבויה.")  # pragma: no cover - unreachable while the constant is False
