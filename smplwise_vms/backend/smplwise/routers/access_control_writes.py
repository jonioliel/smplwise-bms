"""CR-036 S11: the person writes the editor did not have - archive / restore, switch on / off, end a visitor's or contractor's access
early, one card by number in or out, the person's photo. Owner decisions of 2026-10-12 (binding): stage 1 includes every WisKey
capability; writes are approved now; Arx RBAC is the only authority for Arx-started actions; the engine stays WisKey.

Every endpoint is the person editor's write path (routers/access_control.py), unchanged in kind:
- `access.people.manage` anywhere a station can be as a dependency on the READ connection, before the body is read (an audited
  403); then the person's own stations - every one of them - through services/intercom_writes.py `gate_person_write` (a fresh
  `users/get` unless the caller is unrestricted; the write must carry the revision that read returned; a sensitive field - a card,
  the photo - needs `access.people.sensitive` there too); a person the caller cannot see is the uniform 404;
- JSON only, the command envelope (`client_request_id`, `expires_at`; an expired or duplicate command refused), an audited
  refusal for anything malformed, the attempt row committed before the command is sent and the outcome row after; sent ONCE in the
  feed's config lane, never queued, never retried; a refusal only for a code proven to come before WisKey's commit
  (intercom_client.PRE_STORAGE), anything unclear a 504 "outcome unknown";
- the audit rows: the actor, the request ids, the logical target (the person; a card by its id) and the outcome - never the card
  number, the photo, its size or hash, nor any other value (D06, 2026-10-12);
- the reply: the saved record in the editor projection at the caller's field level, `effect: "sync"` (WisKey stored it; the
  stations follow through WisKey's own sync, these commands always ask them) and `pending: false`.

Nothing here contacts anything but the feed's session; tests drive it with tests/fake_wiskey.py (tests/test_intercom_writes_s11.py).
"""
from __future__ import annotations

import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Path, Request
from pydantic import ConfigDict, Field, StrictBool, StrictInt, model_validator

from ..auth import get_conn, settings_of
from ..errors import ApiError
from ..services import intercom_authority as ia
from ..services import intercom_client, intercom_sync
from ..services import intercom_writes as iw
from .access_control import (
    IDENTIFIER,
    PERSON,
    CommandEnvelope,
    _Action,
    _envelope,
    _no_control,
    _parse,
    _perform,
    _person_summary,
    _raw_body,
    gated,
    people_send,
    people_writer,
)

router = APIRouter()

class _Revisioned(CommandEnvelope):
    model_config = ConfigDict(extra="forbid")
    revision: StrictInt = Field(ge=1)  # compare-and-set: the revision the screen loaded


class ArchiveBody(_Revisioned):
    confirmed: Any = None  # only `true` (from the confirmation step) confirms, as ReleaseBody


class ActiveBody(_Revisioned):
    active: StrictBool


class TemporaryCancelBody(_Revisioned):
    reason_code: Literal["visit_cancelled", "visit_completed", "access_no_longer_needed"]  # WisKey's CANCELLATION_REASONS
    confirmed: Any = None


class CardAddBody(_Revisioned):
    card_no: str = Field(pattern=IDENTIFIER)  # WisKey validate_card
    label: str = Field("", max_length=64)
    enabled: StrictBool = True

    @model_validator(mode="after")
    def _label(self) -> "CardAddBody":
        if not _no_control(self.label):
            raise ValueError("label")
        return self


class CardRemoveBody(_Revisioned):
    confirmed: Any = None


class PhotoBody(_Revisioned):
    photo: str | None = Field(max_length=iw.PHOTO_MAX_CHARS)  # a JPEG data URL, or null to remove it
    sync_now: StrictBool = True

    @model_validator(mode="after")
    def _photo(self) -> "PhotoBody":
        self.photo = iw.photo_value(self.photo)  # WisKey's own rule (profile_settings.photo_value): refused locally, nothing sent
        return self


def _write(
    request: Request,
    auth: ia.Authority,
    conn: sqlite3.Connection,
    act: _Action,
    body: _Revisioned,
    user_id: str,
    command: str,
    send: Any,
    *,
    sensitive: bool = False,
    confirm: str | None = None,
    native: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """The shared path: the envelope's ids recorded, the confirmation (when the action asks for one), the station-scope gate (a
    WisKey read with the write lock released, unless the caller is unrestricted), expiry and duplicate under the lock again, then
    the attempt row, the one send and the outcome row."""
    act.details.update(client_request_id=body.client_request_id, expires_at=body.expires_at, revision=body.revision, **iw.effect_fields(command))
    if confirm is not None and getattr(body, "confirmed", None) is not True:
        _envelope(act, body)  # an expired or duplicate command is refused as such first
        raise act.refuse(ApiError(409, "confirmation_required", confirm))
    settings = settings_of(request)
    gate = gated(act, conn, lambda: iw.gate_person_write(settings, auth, user_id, sensitive=sensitive, revision=body.revision))
    not_after = _envelope(act, body)
    if native is not None:  # WKINT-295: the native write when WisKey's direct API is selected, else `send` unchanged
        send = people_send(act, conn, command, native, send, stations=getattr(gate, "stations", None))
    reply = _perform(act, "person", send, iw.project_editor, not_after, lane="config", summary=_person_summary, target=intercom_sync.person_target(user_id))
    reply["person"] = iw.view_editor_person(auth, reply["person"])
    reply.update(iw.effect_fields(command))
    return reply


@router.post("/intercom/people/{user_id}/archive")
def person_archive(request: Request, user_id: str = Path(min_length=1, max_length=128), auth: ia.Authority = Depends(people_writer()), raw: bytes = Depends(_raw_body),
                   conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Archive a person (WisKey `users/archive`): the identity, its history and every pending cleanup are kept, the person is
    switched off and leaves the active directory; the stations follow. Body: `{revision, confirmed, client_request_id,
    expires_at}` (`confirmed: true` from the confirmation step). An archived person is refused 409 `intercom_archive_state_changed`.
    Reply: `{state, ..., person, sync, command_id, effect, pending}`."""
    act = _Action(request, conn, auth.principal, "intercom.person.archive", user_id, PERSON)
    body: ArchiveBody = _parse(act, ArchiveBody, raw)
    return _write(request, auth, conn, act, body, user_id, "users/archive", lambda call: intercom_client.users_archive(call, user_id, body.revision, True),
                  native={"user_id": user_id, "revision": body.revision, "confirmed": True}, confirm="העברת אדם לארכיון דורשת אישור מפורש.")


@router.post("/intercom/people/{user_id}/unarchive")
def person_unarchive(request: Request, user_id: str = Path(min_length=1, max_length=128), auth: ia.Authority = Depends(people_writer()), raw: bytes = Depends(_raw_body),
                     conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Restore a person from the archive (WisKey `users/unarchive`): the record comes back SWITCHED OFF (WisKey's own rule - it is
    switched on separately). Body as archive."""
    act = _Action(request, conn, auth.principal, "intercom.person.unarchive", user_id, PERSON)
    body: ArchiveBody = _parse(act, ArchiveBody, raw)
    return _write(request, auth, conn, act, body, user_id, "users/unarchive", lambda call: intercom_client.users_archive(call, user_id, body.revision, False),
                  native={"user_id": user_id, "revision": body.revision, "confirmed": True}, confirm="שחזור אדם מהארכיון דורש אישור מפורש.")


@router.post("/intercom/people/{user_id}/active")
def person_set_active(request: Request, user_id: str = Path(min_length=1, max_length=128), auth: ia.Authority = Depends(people_writer()), raw: bytes = Depends(_raw_body),
                      conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Switch a person on or off (WisKey `users/set_active`). Body: `{active, revision, client_request_id, expires_at}`. An archived
    person cannot be switched on (409 `intercom_person_archived`). The stations follow."""
    act = _Action(request, conn, auth.principal, "intercom.person.set_active", user_id, PERSON)
    body: ActiveBody = _parse(act, ActiveBody, raw)
    act.details["active"] = body.active  # the logical action (on / off), not a value of the person's
    return _write(request, auth, conn, act, body, user_id, "users/set_active", lambda call: intercom_client.users_set_active(call, user_id, body.revision, body.active),
                  native={"user_id": user_id, "revision": body.revision, "active": body.active})


@router.post("/intercom/people/{user_id}/temporary-cancel")
def person_temporary_cancel(request: Request, user_id: str = Path(min_length=1, max_length=128), auth: ia.Authority = Depends(people_writer()), raw: bytes = Depends(_raw_body),
                            conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """End a visitor's or a contractor's access early (WisKey `users/temporary_cancel`): the credentials and every rule stay, the
    person is switched off. Body: `{reason_code, revision, confirmed, client_request_id, expires_at}`; `reason_code` one of
    visit_cancelled | visit_completed | access_no_longer_needed (it goes into WisKey's own log). Staff: 409 `intercom_not_temporary`."""
    act = _Action(request, conn, auth.principal, "intercom.person.temporary_cancel", user_id, PERSON)
    body: TemporaryCancelBody = _parse(act, TemporaryCancelBody, raw)
    act.details["reason_code"] = body.reason_code  # one of three fixed codes (the reason class, no free text)
    return _write(request, auth, conn, act, body, user_id, "users/temporary_cancel",
                  lambda call: intercom_client.users_temporary_cancel(call, user_id, body.revision, body.reason_code),
                  native={"user_id": user_id, "revision": body.revision, "reason_code": body.reason_code}, confirm="סיום גישה זמנית דורש אישור מפורש.")


@router.post("/intercom/people/{user_id}/cards")
def person_card_add(request: Request, user_id: str = Path(min_length=1, max_length=128), auth: ia.Authority = Depends(people_writer()), raw: bytes = Depends(_raw_body),
                    conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Add one card by its number (WisKey `cards/add`): `{card_no, label, enabled, revision, client_request_id, expires_at}`. A
    credential: the sensitive level on every station of the person. The number travels in the command frame only - never in an
    audit row, a log line or the reply (WisKey answers it masked). A number another person holds: 409 `intercom_card_conflict`."""
    act = _Action(request, conn, auth.principal, "intercom.person.card_add", user_id, PERSON)
    body: CardAddBody = _parse(act, CardAddBody, raw)
    card = {"card_no": body.card_no, "label": body.label, "card_type": "normalCard", "enabled": body.enabled}
    return _write(request, auth, conn, act, body, user_id, "cards/add", lambda call: intercom_client.cards_add(call, user_id, body.revision, card), sensitive=True,
                  native={"user_id": user_id, "revision": body.revision, "data": card})


@router.post("/intercom/people/{user_id}/cards/{card_id}/remove")
def person_card_remove(request: Request, user_id: str = Path(min_length=1, max_length=128), card_id: str = Path(min_length=1, max_length=64), auth: ia.Authority = Depends(people_writer()),
                       raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Remove one saved card (WisKey `cards/remove`) by its id (the editor projection's card id; never a number). Body: `{revision,
    confirmed, client_request_id, expires_at}`. A card the person no longer has: 404 `intercom_card_not_found`. The removal from
    each station follows WisKey's own sync."""
    act = _Action(request, conn, auth.principal, "intercom.person.card_remove", user_id, PERSON)
    body: CardRemoveBody = _parse(act, CardRemoveBody, raw)
    if not ia.valid_id(card_id):
        raise act.refuse(ApiError(422, "validation", "מזהה הכרטיס אינו תקין.", details={"fields": ["card_id"]}))
    act.details["card_id"] = card_id  # the logical target (WisKey's card id), never a number
    return _write(request, auth, conn, act, body, user_id, "cards/remove", lambda call: intercom_client.cards_remove(call, user_id, body.revision, card_id),
                  sensitive=True, native={"user_id": user_id, "revision": body.revision, "card_id": card_id}, confirm="הסרת כרטיס דורשת אישור מפורש.")


@router.put("/intercom/people/{user_id}/photo")
def person_photo_set(request: Request, user_id: str = Path(min_length=1, max_length=128), auth: ia.Authority = Depends(people_writer()), raw: bytes = Depends(_raw_body),
                     conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Set or remove the person's photo (WisKey `users/update` with `photo`): `{photo: "data:image/jpeg;base64,..." | null,
    revision, sync_now, client_request_id, expires_at}` - a JPEG of at most 512 x 512 and 32 KB, checked here exactly as WisKey
    checks it. A sensitive field: the sensitive level on every station of the person. The installation must allow photos
    (WisKey's own switch: `photo_disabled` otherwise). The photo is never in an audit row - not its bytes, size or hash."""
    act = _Action(request, conn, auth.principal, "intercom.person.photo", user_id, PERSON)
    body: PhotoBody = _parse(act, PhotoBody, raw)
    act.details.update(sync_now=body.sync_now, change="removed" if body.photo is None else "set")
    data = {"photo": body.photo}
    return _write(request, auth, conn, act, body, user_id, "users/update",
                  lambda call: intercom_client.users_update(call, user_id, body.revision, data, body.sync_now), sensitive=True,
                  native={"user_id": user_id, "revision": body.revision, "data": data, "sync_now": body.sync_now})
