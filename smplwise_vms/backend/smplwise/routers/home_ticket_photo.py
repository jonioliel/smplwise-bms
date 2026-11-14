"""HOME-V3-FOLLOWUP-B-2431 (owner answer 2026-11-11 q2): a photo on a NEW ticket opened from the home interface (mockup v3 `tkNew`).

* `POST /home/tickets/{ticket_id}/photos` (multipart `file`) - the tickets module's own photo pipeline (services/tickets/attachments:
  the structure walk before Pillow, the pixel budget, a metadata-free re-encode to a fresh JPEG - EXIF and GPS never stored - at most
  2048 px, the storage cap, the decode slot, a random confined file name; service.check_attach / record_attachment: the ticket's own
  write rule, the 60-photo cap, the timeline row, the audit `ticket.photo`). Body limit row `home_ticket_photo` (8 MiB + framing).

Narrower than the module's own POST /tickets/{id}/attachments, which a home-only person never reaches: only the caller's OWN ticket
(the creator - the home list's rule), only while it is still `new` and at most PHOTO_WINDOW_S after it was opened (the photo belongs
to the new ticket; a later word to the handler is a note - owner answer q3), at most PHOTOS_MAX from this route, JPEG / PNG only.
The tickets module off -> 404 `feature_disabled` (no ticket action anywhere); the person's hidden "tickets" category -> 403.
"""
from __future__ import annotations

import datetime as dt
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, File, Path, Request, UploadFile

from ..audit import audit
from ..auth import current_principal, get_conn, settings_of
from ..db import unlocked
from ..errors import ApiError
from ..rbac import Principal
from . import home_family as hfr
from ._common import rid as _rid

router = APIRouter()
PHOTO_WINDOW_S = 30 * 60
PHOTOS_MAX = 3
IMAGE_TYPES = ("image/jpeg", "image/png")


def _check_new(conn: sqlite3.Connection, viewer: Any, seen: Any, now: dt.datetime) -> None:
    from ..services.tickets import store

    row = seen.row
    if row["status"] != "new":
        raise ApiError(409, "ticket_not_new", "אפשר לצרף תמונה רק לפנייה חדשה. כדי לעדכן את המטפל, הוסיפו הערה.")
    try:
        opened = dt.datetime.fromisoformat(str(row["created_at"]).replace("Z", "+00:00"))
    except ValueError:
        opened = None
    if opened is None or (now - opened).total_seconds() > PHOTO_WINDOW_S:
        raise ApiError(409, "ticket_not_new", "אפשר לצרף תמונה רק לפנייה חדשה. כדי לעדכן את המטפל, הוסיפו הערה.")
    mine = sum(1 for a in store.attachments(conn, row["id"]) if a.get("uploaded_by_kind") == "user" and a.get("uploaded_by") == viewer.uid)
    if mine >= PHOTOS_MAX:
        raise ApiError(409, "too_many_photos", f"אפשר לצרף עד {PHOTOS_MAX} תמונות לפנייה.", details={"max": PHOTOS_MAX})


@router.post("/home/tickets/{ticket_id}/photos", status_code=201)
def my_ticket_photo(request: Request, ticket_id: str = Path(..., pattern=hfr.TICKET_ID), file: UploadFile = File(...),
                    principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    from ..services.tickets import access, attachments, present, service

    viewer = hfr._viewer(conn, principal)  # module switch (404) and the person's "tickets" category (403)
    seen = hfr._mine(viewer, ticket_id)  # only a ticket the caller opened; anything else is the uniform 404
    now = dt.datetime.now(dt.timezone.utc)
    _check_new(conn, viewer, seen, now)
    service.check_attach(conn, viewer, seen, False, _rid(request))
    ctype = (file.content_type or "").split(";")[0].strip().lower()
    if ctype not in IMAGE_TYPES:
        audit(conn, actor=principal, action="ticket.photo", decision="denied", resource_type="ticket", resource_id=ticket_id, reason="image_type", request_id=_rid(request))
        raise ApiError(415, "image_type", "אפשר לצרף רק תמונה (JPEG או PNG).")
    data = file.file.read(attachments.MAX_BYTES + 1)
    data_dir = settings_of(request).data_dir
    try:
        with unlocked(conn):  # the decode never holds the database write lock (the module route's rule)
            stored = attachments.store(data_dir, ticket_id, data)
    except attachments.Refused as exc:
        audit(conn, actor=principal, action="ticket.photo", decision="denied", resource_type="ticket", resource_id=ticket_id, reason=exc.code, request_id=_rid(request))
        raise ApiError(exc.status, exc.code, exc.message, retryable=exc.status == 429, details=dict(exc.details)) from None
    # the write lock was released for the decode: everything is checked again (the ticket may have been taken or closed meanwhile)
    try:
        seen = access.visible_by_id(viewer, ticket_id)
        if seen is None or "creator" not in seen.reasons:
            raise ApiError(404, "not_found", "הפנייה לא נמצאה.")
        _check_new(conn, viewer, seen, now)
        vis = service.check_attach(conn, viewer, seen, False, _rid(request))
    except ApiError:
        attachments.remove(data_dir, stored.rel_path)
        raise
    service.record_attachment(conn, viewer, seen, stored, vis, _rid(request))
    return {"ticket": hfr._item(conn, hfr._mine(viewer, ticket_id), present.Lookups(conn))}
