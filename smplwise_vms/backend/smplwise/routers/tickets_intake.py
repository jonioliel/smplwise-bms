"""CR-INTAKE99 (owner answers 143-156, 2026-10-24; phases 1-3): the operator-side API of the free-text request intake - the draft queue,
the managed list of known numbers and the configurer's lexicon rows. NO public route. Every route checks the module switch first
(module_gate), then the permission (services/tickets/intake.py), then the body. Mounted BEFORE routers/tickets.py (its
`/tickets/{ticket_id}` would match these paths)."""
from __future__ import annotations

import sqlite3
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Path, Query, Request
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt

from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..rbac import Principal
from ..services.tickets import intake
from ..services.tickets.access import Viewer
from .tickets import ID, module_gate

router = APIRouter(dependencies=[Depends(module_gate)])
DraftId = Annotated[str, Path(pattern=ID)]


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


class EditBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: StrictInt = Field(ge=1)
    values: dict[str, str | None] = Field(default_factory=dict, max_length=len(intake.EDIT_KEYS))


class RevisionBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: StrictInt = Field(ge=1)


class MergeBody(RevisionBody):
    """The request to attach to: its id, or the number a person reads (exactly one of them)."""
    ticket_id: str | None = Field(default=None, pattern=ID)
    number: StrictInt | None = Field(default=None, ge=1, le=9_999_999)


class RejectBody(RevisionBody):
    reason: Literal["not_a_request", "duplicate", "spam", "abusive", "out_of_scope", "test"]
    block: StrictBool = False


class KnownBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    display_name: str = Field(min_length=1, max_length=intake.NAME_MAX * 2)
    phone: str = Field(min_length=5, max_length=40)
    org: str = Field(default="", max_length=intake.ORG_MAX * 2)
    lang: Literal["he", "en", "ar", "ru"] = "he"


class LexiconBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["category", "place", "urgency", "stop", "domain_map"]
    phrase: str = Field(min_length=1, max_length=120)
    target_id: str = Field(default="", max_length=64)


@router.get("/tickets/intake/summary")
def summary(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    return intake.counts(conn, Viewer(conn, principal))


@router.get("/tickets/intake/drafts")
def list_drafts(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn),
                state: Literal["open", "approved", "merged", "rejected", "expired"] = Query("open"), limit: int = Query(20, ge=1, le=50),
                offset: int = Query(0, ge=0, le=100000)) -> dict[str, Any]:
    return intake.list_drafts(conn, Viewer(conn, principal), state=state, limit=limit, offset=offset, rid=_rid(request))


@router.get("/tickets/intake/drafts/{draft_id}")
def read_draft(draft_id: DraftId, request: Request, principal: Principal = Depends(current_principal_ro),
               conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    return intake.get_draft(conn, Viewer(conn, principal), draft_id, _rid(request))


@router.put("/tickets/intake/drafts/{draft_id}")
def edit_draft(draft_id: DraftId, body: EditBody, request: Request, principal: Principal = Depends(current_principal),
               conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return intake.edit_draft(conn, Viewer(conn, principal), draft_id, body.revision, body.values, _rid(request))


@router.post("/tickets/intake/drafts/{draft_id}/approve")
def approve_draft(draft_id: DraftId, body: RevisionBody, request: Request, principal: Principal = Depends(current_principal),
                  conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    from ..services.tickets import messaging

    return intake.approve(conn, Viewer(conn, principal), draft_id, body.revision, _rid(request), rt=messaging.RUNTIME)


@router.post("/tickets/intake/drafts/{draft_id}/merge")
def merge_draft(draft_id: DraftId, body: MergeBody, request: Request, principal: Principal = Depends(current_principal),
                conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return intake.merge(conn, Viewer(conn, principal), draft_id, body.revision, body.ticket_id, _rid(request), number=body.number)


@router.post("/tickets/intake/drafts/{draft_id}/reject")
def reject_draft(draft_id: DraftId, body: RejectBody, request: Request, principal: Principal = Depends(current_principal),
                 conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return intake.reject(conn, Viewer(conn, principal), draft_id, body.revision, body.reason, body.block, _rid(request))


@router.get("/tickets/intake/known")
def list_known(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    return intake.known_list(conn, Viewer(conn, principal), _rid(request))


@router.post("/tickets/intake/known", status_code=201)
def add_known(body: KnownBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return intake.known_add(conn, Viewer(conn, principal), body.model_dump(), _rid(request))


@router.delete("/tickets/intake/known/{known_id}")
def remove_known(known_id: DraftId, request: Request, revision: int = Query(..., ge=1), principal: Principal = Depends(current_principal),
                 conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return intake.known_remove(conn, Viewer(conn, principal), known_id, revision, _rid(request))


@router.get("/tickets/intake/lexicon")
def lexicon(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    return intake.lexicon_overview(conn, Viewer(conn, principal))


@router.post("/tickets/intake/lexicon", status_code=201)
def add_lexicon(body: LexiconBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return intake.lexicon_add(conn, Viewer(conn, principal), body.model_dump(), _rid(request))


@router.delete("/tickets/intake/lexicon/{lexicon_id}")
def remove_lexicon(lexicon_id: DraftId, request: Request, principal: Principal = Depends(current_principal),
                   conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return intake.lexicon_remove(conn, Viewer(conn, principal), lexicon_id, _rid(request))
