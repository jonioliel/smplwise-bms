"""CR-ARX-WISKEY-SHARED-IDENTITY: the staff API of external-person door grants and Arx <-> WisKey person links.

Every route reads on the request's READ connection (`current_principal_ro`) and the service writes in its own short transactions,
so no WisKey call ever runs while the write lock is held. Authority is decided in services/access_grants.py (rbac.authorize over the
access-control station chain, deny-overrides); refusals are audited there. Nothing here can turn the feature on in this build:
`access.external_grants` = `on` is refused while the owner's go-live permit (access_grants.GO_LIVE_PERMITTED) is not in the code.

- GET    /access-grants                         live grants the caller may see (names level; delivery state at the sensitive level)
- GET    /access-grants/{id}
- POST   /access-grants                         a manual request (tickets.manage + tickets.external, or the grant permission)
- POST   /access-grants/{id}/approve            interactive; access.external.grant + people.manage + people.sensitive (+ pin.generate)
- POST   /access-grants/{id}/refuse
- POST   /access-grants/{id}/revoke             grant permission OR people.manage on one station of the grant
- POST   /access-grants/{id}/rotate             a new code (the only "resend": Arx never holds a code)
- POST   /access-grants/{id}/provision-now      E1
- POST   /access-grants/links                   match an existing WisKey person to a contact (manual only)
- DELETE /access-grants/links/{id}              unlink (live grants revoked first)
- POST   /access-grants/links/{id}/delete-person   owner answer 10: "delete now" in WisKey (a person Arx created)
- POST   /access-grants/pending-contacts/{id}/accept   owner answer 7: a technician the vendor added
- PUT    /access-grants/entrances/{station_id}  the "entrance for external people" flag
- GET|PUT /access-grants/settings               system administrator only
- POST   /access-grants/revoke-all              R10, system administrator, typed confirmation
SHAREDID-293 (owner decisions 2026-10-20; services/access_external.py):
- GET    /access-grants/digest                  the last weekly period over the grants the caller may see (decision 4)
- GET    /access-grants/contacts/{id}/identity  the contact's access-control identity card (link, live grant, unresolved create)
- POST   /access-grants/links/{id}/push-name    write the Arx name to a WisKey person Arx created (decision 5)
- POST   /access-grants/{id}/read-now           the worker reads this grant now ("read back now")
- POST   /access-grants/{id}/confirm-gone       manual "confirmed gone", system administrator, checks + word + reference (decision 3)
- POST   /access-grants/{id}/attach-recovered   attach the person one lost create produced, system administrator (decision 7)"""
from __future__ import annotations

import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Path, Request
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal_ro, get_read_conn
from ..db import set_setting
from ..errors import ApiError, forbidden
from ..rbac import INSTALLATION, Principal, authorize, is_system_admin, permissions_anywhere, require
from ..services import access_external as ax
from ..services import access_grants as ag

router = APIRouter()
_ID = r"^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$"


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _db(request: Request):
    return request.app.state.db


class GrantIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    contact_id: str = Field(max_length=64, pattern=_ID)
    ticket_id: str | None = Field(default=None, max_length=64, pattern=_ID)
    doors: dict[str, list[int]]
    valid_from: str = Field(max_length=20)
    valid_until: str = Field(max_length=20)
    timing: dict[str, Any] | None = None
    credential: Literal["pin", "none", "card"] = "pin"


class ApproveIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: int
    doors: dict[str, list[int]] | None = None
    valid_from: str | None = Field(default=None, max_length=20)
    valid_until: str | None = Field(default=None, max_length=20)
    told: bool = False  # "the person was told" (the privacy notice), for a grant without an arrival-page acknowledgement


class RevisionIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: int


class LinkIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    contact_id: str = Field(max_length=64, pattern=_ID)
    wiskey_person_id: str = Field(max_length=128, pattern=_ID)


class ConfirmIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirm: str = Field(max_length=32)


class EntranceIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    entrance: bool


class SettingsIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    external_grants: Literal["off", "on"] | None = None
    max_days: int | None = Field(default=None, ge=1, le=ag.MAX_DAYS_CAP)
    max_doors: int | None = Field(default=None, ge=1, le=ag.MAX_DOORS_CAP)
    phone_fresh_days: int | None = Field(default=None, ge=30, le=365)
    code_hour: int | None = Field(default=None, ge=0, le=23)
    local_approvers: Literal["off", "on"] | None = None
    # SHAREDID-293 (owner decisions 4, 5, 6): the screen's own settings
    digest_channel: Literal["app", "app_whatsapp"] | None = None
    digest_day: int | None = Field(default=None, ge=0, le=6)
    digest_hour: int | None = Field(default=None, ge=0, le=23)
    name_sync: Literal["manual", "auto"] | None = None
    placement: Literal["access", "tickets", "both"] | None = None


class GoneIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reference: str = Field(max_length=256)
    confirm: str = Field(max_length=32)
    checks: list[bool] = Field(max_length=8)


class AttachIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    op_id: str = Field(max_length=64, pattern=_ID)
    wiskey_person_id: str = Field(max_length=128, pattern=_ID)
    evidence_ref: str = Field(max_length=256)


_SCREEN_KEYS = ("digest_channel", "digest_day", "digest_hour", "name_sync", "placement")


@router.get("/access-grants")
def list_grants(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn), all: bool = False) -> dict[str, Any]:
    # SHAREDID-293: the screen's rules panel (every reader sees the limits; changing them stays a system administrator's), the screen's own
    # settings and whether the caller is a system administrator (who alone sees the settings button, the manual closure and the attach)
    rules = ag.settings_view(conn)
    return {"grants": ag.list_for(conn, principal, live_only=not all), "enabled": ag.enabled(conn),
            "rules": {k: rules[k] for k in ("external_grants", "go_live_permitted", "max_days", "max_doors", "phone_fresh_days", "code_hour", "local_approvers")},
            "screen": ax.settings_view(conn), "system_admin": is_system_admin(conn, principal.user_id)}


@router.get("/access-grants/digest")
def get_digest(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """SHAREDID-293 (owner decision 4): the last weekly period, over the grants the caller may see."""
    return {"digest": ax.digest(conn, principal)}


@router.get("/access-grants/contacts/{contact_id}/identity")
def identity(contact_id: str = Path(..., pattern=_ID), principal: Principal = Depends(current_principal_ro),
             conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """SHAREDID-293: the access-control identity card of one directory person (link, live grant, unresolved create, allowed actions)."""
    return {"identity": ax.identity_of(conn, principal, contact_id)}


@router.post("/access-grants/links/{link_id}/push-name")
def push_name(request: Request, link_id: str = Path(..., pattern=_ID), principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    """SHAREDID-293 (owner decision 5): write the Arx name to the WisKey person Arx created."""
    return ax.push_name(_db(request), principal, link_id, _rid(request))


@router.get("/access-grants/settings")
def get_settings(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    require(conn, principal, "system.configure", INSTALLATION)
    if not is_system_admin(conn, principal.user_id):
        audit(conn, actor=principal, action="settings.read", decision="denied", resource_type="installation", resource_id="*", reason="not_system_admin",
              request_id=_rid(request), details={"keys": list(ag.KEYS)})
        raise ApiError(403, "not_system_admin", "רק מנהל מערכת יכול לצפות בהגדרה זו.")
    return {**ag.settings_view(conn), **ax.settings_view(conn)}


@router.put("/access-grants/settings")
def put_settings(body: SettingsIn, request: Request, principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    db = _db(request)
    with db.connection(label="access_grants.settings") as conn:
        require(conn, principal, "system.configure", INSTALLATION)
        changes = {k: v for k, v in body.model_dump().items() if v is not None}
        if not changes:
            raise ApiError(422, "validation", "לא נשלחה הגדרה לשינוי.")
        if not is_system_admin(conn, principal.user_id):
            audit(conn, actor=principal, action="settings.changed", decision="denied", resource_type="installation", resource_id="*", reason="not_system_admin",
                  request_id=_rid(request), details={"keys": sorted(changes)})
            raise ApiError(403, "not_system_admin", "רק מנהל מערכת יכול לשנות הגדרה זו.")
        if changes.get("external_grants") == "on" and not ag.go_live_permitted():
            audit(conn, actor=principal, action="settings.changed", decision="denied", resource_type="installation", resource_id="*", request_id=_rid(request),
                  reason="access_grants_not_permitted", details={"key": ag.FLAG_KEY, "requested": "on"})
            raise ApiError(409, "access_grants_not_permitted", "הפעלת גישה זמנית לאנשים חיצוניים דורשת אישור הפעלה נפרד מבעל המערכת, וגרסה זו אינה כוללת אותו.")
        keys = {"external_grants": ag.FLAG_KEY, "max_days": ag.MAX_DAYS_KEY, "max_doors": ag.MAX_DOORS_KEY, "phone_fresh_days": ag.FRESH_KEY,
                "code_hour": ag.CODE_HOUR_KEY, "local_approvers": ag.LOCAL_KEY}
        before = ag.settings_view(conn)
        for name, value in changes.items():
            if name in _SCREEN_KEYS:
                continue
            set_setting(conn, keys[name], str(value))
            audit(conn, actor=principal, action="settings.changed", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
                  details={"key": keys[name], "before": before.get(name), "after": value})
        # SHAREDID-293: the screen's settings (the digest's channel is its notification policy - one truth)
        for key, old, new in ax.apply_settings(conn, {k: v for k, v in changes.items() if k in _SCREEN_KEYS}):
            audit(conn, actor=principal, action="settings.changed", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
                  details={"key": key, "before": old, "after": new})
        return {**ag.settings_view(conn), **ax.settings_view(conn)}


@router.post("/access-grants/revoke-all")
def revoke_all(body: ConfirmIn, request: Request, principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    return {"revoked": ag.revoke_all(_db(request), principal, body.confirm, _rid(request))}


@router.post("/access-grants/links")
def match_link(body: LinkIn, request: Request, principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    link = ag.match_link(_db(request), principal, body.contact_id, body.wiskey_person_id, _rid(request))
    return {"link": {"id": link["id"], "origin": link["origin"], "state": link["state"]}}


@router.delete("/access-grants/links/{link_id}")
def unlink(request: Request, link_id: str = Path(..., pattern=_ID), principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    return ag.unlink(_db(request), principal, link_id, _rid(request))


@router.post("/access-grants/links/{link_id}/delete-person")
def delete_person(body: ConfirmIn, request: Request, link_id: str = Path(..., pattern=_ID), principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    return ag.delete_person_now(_db(request), principal, link_id, body.confirm, _rid(request))


@router.post("/access-grants/pending-contacts/{contact_id}/accept")
def accept_contact(request: Request, contact_id: str = Path(..., pattern=_ID), principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    return ag.accept_pending_contact(_db(request), principal, contact_id, _rid(request))


@router.post("/access-grants/pending-contacts/{contact_id}/reject")
def reject_contact(request: Request, contact_id: str = Path(..., pattern=_ID), principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    return ag.reject_pending_contact(_db(request), principal, contact_id, _rid(request))


@router.put("/access-grants/entrances/{station_id}")
def entrance(body: EntranceIn, request: Request, station_id: str = Path(..., pattern=_ID), principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    return ag.set_entrance(_db(request), principal, station_id, body.entrance, _rid(request))


@router.post("/access-grants")
def request_grant(body: GrantIn, request: Request, principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    """A manual request: `tickets.manage` + `tickets.external` (installation), or the grant permission somewhere (CR 3.2)."""
    db = _db(request)
    with db.connection(label="access_grants.request") as conn:
        if not ag.enabled(conn):
            raise ag._off()
        tickets_ok = authorize(conn, principal, "tickets.manage", INSTALLATION).allowed and authorize(conn, principal, "tickets.external", INSTALLATION).allowed
        if not tickets_ok and ag.PERMISSION not in permissions_anywhere(conn, principal):
            ag._audit(conn, principal, "access.grant.request", body.contact_id, decision="denied", reason="no_binding", resource_type="contact", request_id=_rid(request))
            raise forbidden(permission=ag.PERMISSION, target_type="installation", target_id="*", reason="no_binding")
        doors = ag.parse_doors(body.doors, ag.max_doors(conn))
        vf, vu = ag.parse_window(body.valid_from, body.valid_until, ag.max_days(conn), ag.now())
        if body.credential == "card":
            raise ApiError(409, "access_grant_card_not_built", "גישה בכרטיס לאדם חיצוני עדיין אינה זמינה (שלב מאוחר יותר).")
        if body.ticket_id and conn.execute("SELECT 1 FROM tickets WHERE id = ?", (body.ticket_id,)).fetchone() is None:
            raise ApiError(404, "ticket_not_found", "הקריאה לא נמצאה.")
        scope = ag.Scope(doors, vf, vu, ag.parse_timing(body.timing), body.credential)
        g, outcome = ag.request_grant(conn, actor=principal, requested_by=principal.user_id, contact_id=body.contact_id,
                                      source_kind="ticket" if body.ticket_id else "manual", source_ref=body.ticket_id, assignment_id=None, scope=scope,
                                      request_id=_rid(request))
        ag.notify_request(conn, g["id"])
        return {"grant": ag.present(conn, principal, g), "outcome": outcome}


def _visible_or_404(conn: sqlite3.Connection, principal: Principal, grant_id: str) -> dict[str, Any]:
    g = ag.grant_row(conn, grant_id)
    if g is None or not ag.visible(conn, principal, g):
        raise ag._not_found()
    return g


@router.get("/access-grants/{grant_id}")
def one(grant_id: str = Path(..., pattern=_ID), principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    grant = ag.present(conn, principal, _visible_or_404(conn, principal, grant_id))
    if grant.get("closure"):  # SHAREDID-293: the closure's evidence reference, to a system administrator only
        grant["closure"]["reference"] = ax.closure_reference(conn, principal, grant_id)
    return {"grant": grant}


def _answer(request: Request, principal: Principal, g: dict[str, Any]) -> dict[str, Any]:
    with _db(request).connection(mode="read", label="access_grants.answer") as conn:
        return {"grant": ag.present(conn, principal, ag.grant_row(conn, g["id"]) or g)}


@router.post("/access-grants/{grant_id}/approve")
def approve(body: ApproveIn, request: Request, grant_id: str = Path(..., pattern=_ID), principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    g = ag.approve(_db(request), principal, grant_id, body.revision, doors=body.doors, valid_from=body.valid_from, valid_until=body.valid_until, told=body.told,
                   request_id=_rid(request))
    return _answer(request, principal, g)


@router.post("/access-grants/{grant_id}/refuse")
def refuse(body: RevisionIn, request: Request, grant_id: str = Path(..., pattern=_ID), principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    return _answer(request, principal, ag.refuse(_db(request), principal, grant_id, body.revision, _rid(request)))


@router.post("/access-grants/{grant_id}/revoke")
def revoke(request: Request, grant_id: str = Path(..., pattern=_ID), principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    return _answer(request, principal, ag.revoke(_db(request), principal, grant_id, _rid(request)))


@router.post("/access-grants/{grant_id}/rotate")
def rotate(body: RevisionIn, request: Request, grant_id: str = Path(..., pattern=_ID), principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    return _answer(request, principal, ag.rotate(_db(request), principal, grant_id, body.revision, _rid(request)))


@router.post("/access-grants/{grant_id}/provision-now")
def provision_now(request: Request, grant_id: str = Path(..., pattern=_ID), principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    return _answer(request, principal, ag.provision_now(_db(request), principal, grant_id, _rid(request)))


@router.post("/access-grants/{grant_id}/read-now")
def read_now(request: Request, grant_id: str = Path(..., pattern=_ID), principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    """SHAREDID-293: "read back now" - the worker reads this grant now (its own holds apply)."""
    return _answer(request, principal, ax.read_now(_db(request), principal, grant_id, _rid(request)))


@router.post("/access-grants/{grant_id}/confirm-gone")
def confirm_gone(body: GoneIn, request: Request, grant_id: str = Path(..., pattern=_ID), principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    """SHAREDID-293 (owner decision 3): a system administrator closes by hand a revocation whose person is not found any more."""
    g = ax.confirm_gone(_db(request), principal, grant_id, reference=body.reference, confirm=body.confirm, checks=body.checks, request_id=_rid(request))
    return _answer(request, principal, g)


@router.post("/access-grants/{grant_id}/attach-recovered")
def attach_recovered(body: AttachIn, request: Request, grant_id: str = Path(..., pattern=_ID), principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    """SHAREDID-293 (owner decision 7): attach the WisKey person one lost create of this grant produced (system administrators only)."""
    out = ax.attach_recovered(_db(request), principal, grant_id, op_id=body.op_id, wiskey_person_id=body.wiskey_person_id, evidence_ref=body.evidence_ref,
                              request_id=_rid(request))
    with _db(request).connection(mode="read", label="access_grants.attach.answer") as conn:
        g = ag.grant_row(conn, grant_id)
        return {**out, "grant": ag.present(conn, principal, g) if g else None}
