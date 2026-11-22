"""WisKey tab: the person editor (`access.people.manage`, CR-005 phase 2 A1; station chain since CR-036 S11). The draft models
themselves are in services/access_control_core.py.

CR-SPLIT-ACCESS-CONTROL-2440 (review 05:P2-08): moved unchanged out of routers/access_control.py, which still exports every name."""
from __future__ import annotations

import sqlite3
from datetime import datetime
from typing import Any, Callable

from fastapi import APIRouter, Depends, Path, Request
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt

from ..auth import current_principal_ro, get_conn, get_read_conn, settings_of
from ..db import unlocked
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal
from ..services import intercom_authority as ia, intercom_adapter, intercom_client, intercom_sync, intercom_writes as iw, savepoints
from ..services.access_control_core import PERSON, PersonData
from ._common import raw_body as _raw_body, rid as _rid
from .access_control_base import CAPTURE, MANAGE, PIN_GENERATE
from .access_control_command import CommandEnvelope, _Action, _envelope, _parse, _perform
from ..wire import access_control_people as W
from ..wire import wire

router = APIRouter()


# ---------------------------------------------------------------- person editor (access.people.manage), CR-005 phase 2 A1
#
# The first write to WisKey's people store. Brief A.4-A.6, owner decisions 2026-09-28: the editor's own projection
# (`intercom_sync.project_person_editor`: phone, masked cards, PIN flag - never a PIN value or a full card number) is
# served only here, never under `access.read`; every write follows the physical actions' path exactly (permission as a
# dependency before the body, JSON only, `client_request_id` + `expires_at`, attempt row committed before sending,
# outcome row after) in the feed's config lane, so a save WisKey holds can never take a door release's slot. The draft
# is validated locally with models mirroring WisKey's USER_FIELDS / CARD_FIELDS (extra keys forbidden, strict types),
# so a malformed draft is an audited `not_sent` refusal, not a round trip. Audit details carry field NAMES and counts
# (and the person's id / employee number / display name, which every access.read holder sees anyway) - never a PIN, a
# card number (not even the masked form), a phone or a profile value.
#
# Timing in this slice is permanent / date-range only; weekly and station-native schedules, custom profile fields,
# groups and photos are slice A3 and are deliberately not accepted here (`extra="forbid"` refuses their keys). Card
# capture from a station reader is slice A2. WisKey's `pin_check` oracle is not offered (owner decision 8): a
# conflicting PIN surfaces at save time as `intercom_pin_conflict`, and `users/pin_generate` gives a free one.
#
# CR-036 S11 (owner decisions 2026-10-12: every write in stage 1; Arx RBAC the only authority; DW / PG approved): these endpoints
# moved from installation scope onto the access-control station chain - `access.people.manage` (and `access.cards.capture` /
# `access.pin.generate` where they apply) anywhere a station can be as the dependency (before the body, audited 403), then the
# person's own stations before AND after the change (services/intercom_writes.py `gate_person_write`, a fresh `users/get` unless
# the caller is unrestricted; the write then carries the revision that read returned); a sensitive field needs
# `access.people.sensitive` on the same stations. The audit rows keep the actor, the request ids, the logical target and the
# outcome, plus the field NAMES of an update - never a value (no PIN, card number, phone, name, relay map, count or hash). Every
# reply says its effect class (`effect`, `pending`); delete and the capture commands are UNKNOWN_EFFECT ("sent, result
# pending"). The editor accepts the access category, the responsible person and purpose, and the timing proposal / enforced
# policy too; the photo, archive, activation, temporary cancel and single cards have endpoints of their own
# (routers/access_control_writes.py). The editor projection is served at the caller's field level (iw.view_editor_person).


class PersonSaveBody(CommandEnvelope):
    model_config = ConfigDict(extra="forbid")  # a stray top-level key (a `pin` outside `data`, say) is refused, not ignored
    data: PersonData
    # WisKey's own "Save & sync" (queue the stations now) vs "Save" (its periodic reconciliation, ~300 s, carries it)
    sync_now: StrictBool = True


class PersonUpdateBody(PersonSaveBody):
    revision: StrictInt = Field(ge=1)  # compare-and-set: the revision the editor loaded


class PersonDeleteBody(CommandEnvelope):
    model_config = ConfigDict(extra="forbid")
    revision: StrictInt = Field(ge=1)
    confirmed: Any = None  # only `true` (from the confirmation dialog) confirms, as ReleaseBody


class PinGenerateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    user_id: str = Field("", max_length=128)  # "" for a person not saved yet


def people_writer(*extra: str):
    """CR-036 S11: `access.people.manage` - and `extra` (`access.cards.capture`, `access.pin.generate`) - somewhere a station can
    be, as a dependency on the request's READ connection, checked before the body is read (audited 403s); the person's own
    stations are checked per request (services/intercom_writes.py). Returns the request's Authority. `access.read` alone never
    reaches the editor projection, let alone a write (was: installation scope)."""

    def dep(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> ia.Authority:
        rid = _rid(request)
        auth = ia.require_anywhere(conn, principal, MANAGE, rid)
        for permission in extra:
            ia.require_anywhere(conn, principal, permission, rid)
        return auth

    return dep


def _write_summary(data: dict[str, Any]) -> dict[str, Any]:
    """What the audit records about a draft (D06, 2026-10-12): the NAMES of the fields it sets - never a value, a count, a
    relay map, a hash or a length."""
    return {"fields": sorted(data)}


def _person_summary(person: dict[str, Any]) -> dict[str, Any]:
    """The outcome row's record of the saved person: the logical target and its new revision only (D06)."""
    return {"id": person["id"], "revision": person["revision"]}


def gated(act: "_Action", conn: sqlite3.Connection, check: Callable[[], Any]) -> Any:
    """Run a station-scope check that may read the person from WisKey (services/intercom_writes.py) with the request's write lock
    released (a WisKey round trip never holds SQLite's single write lock); its refusal is an audited `not_sent`."""
    try:
        with unlocked(conn):
            return check()
    except ApiError as exc:
        raise act.refuse(exc) from None


def native_targets(stations: Any) -> list[tuple[str, str]]:
    """WKINT-295: the RBAC targets of the native write's fresh Arx decision - every station the station-scope gate covered, or the
    installation itself when the gate took the unrestricted shortcut (no station list)."""
    ids = [s for s in dict.fromkeys(stations or []) if isinstance(s, str) and s]
    return [(ia.STATION_SCOPE, s) for s in ids] or [INSTALLATION]


def people_send(act: "_Action", conn: sqlite3.Connection, command: str, business: dict[str, Any], fallback: Callable[[intercom_client.Call], Any], *,
                stations: Any, create_origin_ref: str | None = None, not_after: datetime | None = None) -> Callable[[intercom_client.Call], Any]:
    """WKINT-295: the people write's `send`. With WisKey's direct API selected (services/wiskey_direct_join.py: `access.station_media_provider
    = auto`, a pairing key that signs and an authenticated direct socket) it is the NATIVE write (services/wiskey_native_write.py:
    durable intent, signed command, verified receipt, UNKNOWN never re-sent); otherwise `fallback` - the Home Assistant send, unchanged.
    Without an installed join (no usable key, or `local`) nothing here runs at all. The selection may open the direct socket, so it
    runs with the request's write lock released."""
    from ..services import wiskey_direct_join

    if wiskey_direct_join.installed() is None:
        act.details.update(transport=wiskey_direct_join.PATH_CLASSIC, transport_reason="not_installed")  # WISKEY-JOIN-LIVE-2382
        return fallback
    with unlocked(conn):
        # WISKEY-JOIN-LIVE-2382: a direct write that provably had no effect goes over `fallback` once (never after an unknown outcome);
        # the path actually used reaches the outcome row through `record`
        native = wiskey_direct_join.people_send(conn, act.principal, command, business, targets=native_targets(stations),
                                                create_origin_ref=create_origin_ref, fallback=fallback, not_after=not_after,
                                                record=act.details.update)
    if native is None:
        act.details.update(transport=wiskey_direct_join.PATH_CLASSIC, transport_reason=wiskey_direct_join.people_path(command)["reason"])
        return fallback
    act.details["transport"] = wiskey_direct_join.PATH_DIRECT
    return native


@router.get("/intercom/people-editor/context", **wire(W.AccessControlPeoplePeopleEditorContext))
def people_editor_context(request: Request, auth: ia.Authority = Depends(people_writer())) -> dict[str, Any]:
    """What the editor needs from WisKey's `overview` beyond the entry center (intercom_sync.project_editor_context):
    the stations with their relays and whether each can take a keypad PIN, the HA display zone, WisKey's
    `api.capabilities`, whether the people-write commands are listed for the add-on's HA user (`writes_listed` /
    `users_manage`, null when WisKey does not say - the user needs WisKey's `users:manage` area), and whether a
    profile policy exists. A fresh read each time (never cached). Reply: `{state, configured, last_error, fetched_at,
    context, sync}`.

    CR-036 S11: only the stations the caller manages (`access.people.manage` on the station chain) - a station off it is
    omitted, never greyed; `capture_stations` the ids of those where the caller may also read a card (`access.cards.capture`);
    `pin_generate` whether this caller, in this session, may generate a PIN (the permission somewhere and an interactive
    session)."""
    reply = intercom_sync.SYNC.command(settings_of(request), "context", intercom_client.overview, intercom_sync.project_editor_context, who=auth.principal.user_id)
    ctx = reply.get("context")
    if ctx is not None:
        ctx["stations"] = [s for s in ctx["stations"] if auth.station(MANAGE, s["id"])]
        ctx["capture_stations"] = [s["id"] for s in ctx["stations"] if auth.station(CAPTURE, s["id"])]
        ctx["pin_generate"] = auth.anywhere(PIN_GENERATE) and iw.interactive(auth.principal)
    return reply


@router.get("/intercom/people/{user_id}/editor", **wire(W.AccessControlPeoplePersonEditor))
def person_editor(request: Request, auth: ia.Authority = Depends(people_writer()), user_id: str = Path(min_length=1, max_length=128)) -> dict[str, Any]:
    """One person for editing (WisKey `users/get`): the read projection plus phone, the PIN flag, the cards in WisKey's masked
    form (`•••• 1234` - the full number never leaves WisKey), the overrides, `identity_locked`, `has_timing`, each assignment's
    sync bookkeeping and (S11) the archive state, the access category, the responsible person and purpose, the photo flag and the
    timing proposal / policy. 404 `intercom_person_not_found`. Reply: `{state, configured, last_error, fetched_at, person, sync}`.

    CR-036 S11: only for a person the caller may change (`access.people.manage` on every station of theirs; a person they cannot
    see is the uniform 404, one shared with a station outside their chain a 403 `intercom_person_scope`), at the caller's field
    level (`person.level`; phone, the PIN flag, the cards, the photo flag, the responsible person and purpose are null below the
    sensitive level)."""
    try:
        reply = intercom_sync.SYNC.command(settings_of(request), "person", lambda call: intercom_client.users_get(call, user_id),
                                           lambda raw: {"superset": intercom_adapter.project_one_person(raw), "editor": iw.project_editor(raw)}, who=auth.principal.user_id,
                                           target=intercom_sync.person_target(user_id))
    except ApiError as exc:
        if exc.code == "intercom_person_not_found":
            raise iw.uniform_not_found() from None
        raise
    found = reply.get("person")
    if found is not None:
        target = iw.check_person(auth, found["superset"])
        reply["person"] = iw.view_editor_person(auth, found["editor"], target.level)
    return reply


@router.post("/intercom/people/pin-generate", **wire(W.AccessControlPeoplePersonPinGenerate))
def person_pin_generate(request: Request, response: Response, auth: ia.Authority = Depends(people_writer(PIN_GENERATE)), raw: bytes = Depends(_raw_body),
                        conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """A free six-digit PIN from WisKey (`users/pin_generate`; body `{user_id}`, "" for a person not saved yet). Not
    reserved: the save still answers `intercom_pin_conflict` if it was taken meanwhile. Reply: `{state, ..., pin: {pin}}`; a
    WisKey refusal is `state: error` with `last_error` (`pin_generation_failed`), an unknown person a 404.

    CR-036 S11 (owner decision 2026-10-12, PG): `access.pin.generate` on top of `access.people.manage` (and, for a saved person,
    both on every station of theirs with the sensitive level - a PIN is a credential); an interactive human session only
    (services/intercom_writes.interactive: a bearer-token client is refused 403 `intercom_pin_interactive_only`). The value is in
    THIS response only (`Cache-Control: no-store`) for the requesting operator: never stored, logged, cached, audited, put in an
    error or replayed. The audit rows say who asked, for whom, the request ids and the outcome - never the value, its hash or its
    length."""
    response.headers["Cache-Control"] = "no-store"
    act = _Action(request, conn, auth.principal, "intercom.person.pin_generate", "new", PERSON)
    body: PinGenerateBody = _parse(act, PinGenerateBody, raw)
    act.resource_id = body.user_id or "new"
    act.details.update(iw.effect_fields("users/pin_generate"))
    if not iw.interactive(auth.principal):
        raise act.refuse(ApiError(403, "intercom_pin_interactive_only", "יצירת קוד PIN זמינה רק בהפעלה אינטראקטיבית של אדם (דפדפן), לא ללקוח עם אסימון.",
                                  details={"reason": "interactive_session_required"}))
    settings = settings_of(request)
    if body.user_id:
        gated(act, conn, lambda: iw.gate_person_write(settings, auth, body.user_id, permissions=(MANAGE, PIN_GENERATE), sensitive=True))
        # R4-07: a PIN for a person whose earlier write has no clear outcome could only be saved after a fresh read - refused here, nothing
        # sent (pin_generate is a read in WisKey, so it carries no `target` of its own and never counts as that fresh read)
        blocked = intercom_sync.SYNC.write_gate(intercom_sync.person_target(body.user_id))
        if blocked is not None:
            raise act.refuse(intercom_sync.action_error({"state": "error", "last_error": blocked}, "not_sent", "config"))
    elif not auth.anywhere(ia.PEOPLE_SENSITIVE):
        raise act.refuse(iw.field_refusal())
    act.attempt()
    try:
        reply = intercom_sync.SYNC.command(settings, "pin", lambda call: intercom_client.users_pin_generate(call, body.user_id), intercom_sync.project_pin, who=auth.principal.user_id)
    except ApiError as exc:
        act.outcome("refused", exc.code, {})
        if exc.code == "intercom_person_not_found":
            raise iw.uniform_not_found() from None
        raise
    except BaseException as exc:
        act.outcome("unknown", type(exc).__name__, {})
        raise
    finally:
        savepoints.begin_deferred(conn)  # deferred, lock-free (as _perform): nothing more is written on the request's connection
    pin = reply.get("pin")
    state = reply.get("state")
    outcome = "ok" if pin is not None else ("not_sent" if state not in ("error", "forbidden", "unsupported") or reply.get("last_error") in ("busy", RATE_LIMITED_CODE) else "failed")
    act.outcome(outcome, None if pin is not None else str(reply.get("last_error") or state), {})  # never the value, its hash or length
    return reply


RATE_LIMITED_CODE = intercom_sync.RATE_LIMITED
SAVE_NOTE = "WisKey שמר את הרשומה. הסנכרון לתחנות מתבצע על ידי WisKey בנפרד - מצב הסנכרון של כל תחנה מוצג ברשומה."


@router.post("/intercom/people")
def person_create(request: Request, auth: ia.Authority = Depends(people_writer()), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Create a person in WisKey (`users/create`). Body: `{data: PersonData, sync_now, client_request_id, expires_at}`;
    `data` needs at least `display_name` and `employee_no`. Refused before sending (each refusal audited): a malformed
    draft, an expired or duplicate command. WisKey's refusals come back by name (`intercom_employee_conflict`,
    `intercom_pin_conflict`, `intercom_card_conflict`, `intercom_invalid_request` ...) with `details.outcome`
    `refused`; no clear answer is a 504 `intercom_outcome_unknown` (reload the directory before trying again - the
    person may exist). Reply: `{state, configured, last_error, fetched_at, person, sync, note, command_id, effect, pending}`;
    `person` is the saved record in the editor projection at the caller's field level (WisKey accepted it into its store - the
    stations follow, `sync_now` true asks them at once).

    CR-036 S11: `access.people.manage` on every station the draft names (unrestricted for a person with none), the sensitive
    level there for a sensitive field (403 `intercom_person_scope` / `intercom_field_level`, audited, nothing sent)."""
    act = _Action(request, conn, auth.principal, "intercom.person.create", "new", PERSON)
    body: PersonSaveBody = _parse(act, PersonSaveBody, raw)
    data = body.data.wiskey()
    act.details.update(sync_now=body.sync_now, **_write_summary(data), **iw.effect_fields("users/create"))
    not_after = _envelope(act, body)  # before the draft's own checks: every refusal row from here carries the command id
    missing = [k for k in ("display_name", "employee_no") if not data.get(k)]
    if missing:
        raise act.refuse(ApiError(422, "validation", "לאדם חדש נדרשים שם ומזהה עובד.", details={"fields": missing}))
    try:
        iw.gate_create(auth, iw.draft_stations(data), sensitive=iw.sensitive_write(auth, data))
    except ApiError as exc:
        raise act.refuse(exc) from None
    send = people_send(act, conn, "users/create", {"data": data, "sync_now": body.sync_now}, lambda call: intercom_client.users_create(call, data, body.sync_now),
                       stations=iw.draft_stations(data), create_origin_ref=f"arx-create:{body.client_request_id}", not_after=not_after)
    reply = _perform(act, "person", send, iw.project_editor, not_after, lane="config", summary=_person_summary)
    reply["person"] = iw.view_editor_person(auth, reply["person"])
    reply["note"] = SAVE_NOTE
    reply.update(iw.effect_fields("users/create"))
    return reply


@router.put("/intercom/people/{user_id}", **wire(W.AccessControlPeoplePersonUpdate))
def person_update(request: Request, user_id: str, auth: ia.Authority = Depends(people_writer()), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Update a person in WisKey (`users/update`, compare-and-set on `revision`). Body: `{data: PersonData (a patch),
    revision, sync_now, client_request_id, expires_at}`. A stale revision is a 409 `intercom_revision_conflict`
    (reload the person, then retry); the other refusals and the unknown outcome as for create. Reply as create.

    CR-036 S11: `access.people.manage` on every station of the person before AND after the change (the stations the patch
    names); the sensitive level for a sensitive field; a caller who is not unrestricted is checked against a fresh read and the
    patch must carry that read's revision."""
    act = _Action(request, conn, auth.principal, "intercom.person.update", user_id, PERSON)
    body: PersonUpdateBody = _parse(act, PersonUpdateBody, raw)
    act.details.update(client_request_id=body.client_request_id, expires_at=body.expires_at, revision=body.revision)
    data = body.data.wiskey()
    if not data:
        raise act.refuse(ApiError(422, "validation", "אין שינוי לשמור.", details={"fields": ["data"]}))
    act.details.update(sync_now=body.sync_now, **_write_summary(data), **iw.effect_fields("users/update"))
    settings = settings_of(request)
    gate = gated(act, conn, lambda: iw.gate_person_write(settings, auth, user_id, after=iw.draft_stations(data), sensitive=iw.sensitive_write(auth, data), revision=body.revision))
    not_after = _envelope(act, body)  # expiry and duplicate under the write lock again, right before the attempt row
    send = people_send(act, conn, "users/update", {"user_id": user_id, "revision": body.revision, "data": data, "sync_now": body.sync_now},
                       lambda call: intercom_client.users_update(call, user_id, body.revision, data, body.sync_now),
                       stations=None if getattr(gate, "stations", None) is None else [*gate.stations, *iw.draft_stations(data)], not_after=not_after)
    reply = _perform(act, "person", send, iw.project_editor, not_after, lane="config", summary=_person_summary,
                     target=intercom_sync.person_target(user_id))
    reply["person"] = iw.view_editor_person(auth, reply["person"])
    reply["note"] = SAVE_NOTE
    reply.update(iw.effect_fields("users/update"))
    return reply


@router.post("/intercom/people/{user_id}/delete", **wire(W.AccessControlPeoplePersonDelete))
def person_delete(request: Request, user_id: str, auth: ia.Authority = Depends(people_writer()), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Delete a person from WisKey (`users/delete`). Body: `{revision, confirmed, client_request_id, expires_at}`;
    `confirmed: true` is sent only by the confirmation dialog (WisKey's own `confirm_delete`, naming the stations the
    removal is scheduled on). WisKey answers `accepted`: the person left its list and the removal from each station
    (offline ones included) is queued, not done. Reply: `{state, ..., deleted: {accepted: true}, sync, note, command_id, effect,
    pending}`.

    CR-036 S11: `access.people.manage` on every station of the person. UNKNOWN_EFFECT (the DW matrix of 2026-10-12: WisKey
    schedules jobs): `pending: true` - the screens say "sent, result pending" until a read no longer finds the person."""
    act = _Action(request, conn, auth.principal, "intercom.person.delete", user_id, PERSON)
    body: PersonDeleteBody = _parse(act, PersonDeleteBody, raw)
    act.details.update(client_request_id=body.client_request_id, expires_at=body.expires_at, revision=body.revision, **iw.effect_fields("users/delete"))
    if body.confirmed is not True:
        _envelope(act, body)  # an expired or duplicate command is refused as such first (the order the rows always had)
        raise act.refuse(ApiError(409, "confirmation_required", "מחיקת אדם דורשת אישור מפורש."))
    settings = settings_of(request)
    gate = gated(act, conn, lambda: iw.gate_person_write(settings, auth, user_id, revision=body.revision))
    not_after = _envelope(act, body)
    send = people_send(act, conn, "users/delete", {"user_id": user_id, "revision": body.revision},
                       lambda call: intercom_client.users_delete(call, user_id, body.revision), stations=getattr(gate, "stations", None),
                       not_after=not_after)
    reply = _perform(act, "deleted", send, intercom_sync.project_accepted, not_after, lane="config",
                     target=intercom_sync.person_target(user_id))
    reply["note"] = "WisKey קיבל את המחיקה. ההסרה מכל תחנה (גם מנותקת) מתוזמנת על ידי WisKey ואינה מיידית."
    reply.update(iw.effect_fields("users/delete"))
    return reply
