"""RFQATT (owner 17.10; docs/tickets/RFQ_BACKEND_CONTRACT.md section 19): the files and pictures a manager attaches to a request for
quotation so the vendors get every detail (site photos, plans, specifications) - the rows, who may do what, and who may see what.
The file side (what a file is, the checks, the stored copy, the headers) is rfq_files.py.

    add        an RFQ manager (rfq.need_manager: creator / internal owner / department manager, with tickets.external on the place)
               while the request is a draft or open (sent / collecting / due_passed); at most rfq_files.MAX_FILES live files and
               rfq_files.TOTAL_MAX_BYTES stored bytes per request (checked before the decode, then again inside the write
               transaction). Adding never bumps the request's revision (a manager's open form never goes stale for it) and sends
               nothing (a file added after the send simply appears on the vendors' pages; the manager may write to them).
    caption /  the same manager, same states: an optional caption (<= 200) and "visible to vendors" (default ON) vs internal-only.
    visible
    remove     the same manager, same states. Before any quote arrived: the row and the file are deleted. After a quote arrived
               (any vendor, any state, also entered on a vendor's behalf): the row is MARKED removed (the file stays - what the vendors
               priced against is kept until the request is purged), the vendors stop seeing it, the managers still see it as removed.
               Both: an RFQ timeline row `attachment_removed` and the audit row `ticket.rfq.attachment_remove` (ids only) in the same
               transaction - no audit row, no removal.
    see        everyone who sees the request (rfq.visible) sees its live files, internal ones included (a manager also the removed);
               vendors: ONLY through their own live RFQ link past the code gate (public_rfq), ONLY live vendor-visible files of THEIR
               request, never on a closed / cancelled page; anything else is the uniform 404. Never on a public index or list.
               Word / Excel files travel (vendor page, its file route, the work order's reference copy, `{files}`) only while the
               installation setting `rfq.attachments.allow_office` is on (OFF by default; review 2.6.4) - managers always see them.
    order      a work order (TKRFQ4) REFERENCES every live vendor-visible file of the request from the new service request (no copy):
               the vendor keeps them on that request's handler page after the RFQ link ends, the request's viewers see them in its
               "opened from RFQ" block.
Timeline and audit rows carry ids (and the kind) only - never a file name, a caption, a hash or a size."""
from __future__ import annotations

from pathlib import Path
from typing import Any, Mapping

from ...audit import audit
from ...errors import ApiError
from . import rfq, rfq_files, store_rfq
from .access import Viewer, text
from .costs import iso, now_utc
from .image_intake import IntakeError

EDITABLE_STATES = frozenset({"draft", "sent", "collecting", "due_passed"})

MESSAGES = {
    "attachment_not_found": "הקובץ לא נמצא בבקשה הזאת.",
    "attachment_limit": "הגעתם למספר הקבצים המרבי לבקשה.",
    "attachment_total": "הנפח הכולל של הקבצים בבקשה מלא.",
    "attachment_locked": "אפשר לצרף, לשנות או להסיר קבצים רק בטיוטה או בזמן איסוף ההצעות.",
    "payload_too_large": "הקובץ גדול מדי.",
    "unsupported_format": "סוג הקובץ אינו נתמך. אפשר לצרף תמונה (JPEG, PNG, WebP), PDF, Word (DOCX) או Excel (XLSX).",
    "heic_refused": "תמונות HEIC אינן נתמכות. יש לצרף JPEG (בטלפון: הגדרות המצלמה › \"התואם ביותר\").",
    "image_invalid": "התמונה פגומה ואי אפשר לפתוח אותה.",
    "too_many_pixels": "התמונה גדולה מדי (רזולוציה).",
    "pdf_invalid": "קובץ ה-PDF פגום.",
    "pdf_refused": "קובץ ה-PDF מכיל תוכן פעיל או הצפנה ולכן לא צורף. אפשר לשמור אותו מחדש כ-PDF רגיל.",
    "office_invalid": "הקובץ אינו מסמך Word או Excel תקין.",
    "office_refused": "המסמך מכיל מאקרו, אובייקט מוטמע, קישור חיצוני או רכיב שאינו נתמך ולכן לא צורף. אפשר לשמור אותו כ-PDF.",
    "office_disabled": "צירוף מסמכי Word ו-Excel כבוי בהגדרות המערכת. שמרו את המסמך כ-PDF וצרפו אותו.",
    "busy": "העלאת קובץ אחר מתבצעת כעת. נסו שוב בעוד רגע.",
    "storage_full": "נפח הקבצים המותר מלא. פנו למנהל המערכת.",
}
_STATUS = {"payload_too_large": 413, "too_large": 413, "unsupported_format": 415, "heic_refused": 415, "webp_refused": 415, "image_invalid": 422,
           "too_many_pixels": 422, "pdf_invalid": 422, "pdf_refused": 422, "office_invalid": 422, "office_refused": 422, "office_disabled": 422, "busy": 429,
           "storage_full": 507}


def _err(conn, status: int, code: str, **details: Any) -> ApiError:
    return ApiError(status, code, text(conn, MESSAGES.get(code, "הפעולה נדחתה.")), retryable=status == 429, details=details or None)


def refused(conn, exc: IntakeError) -> ApiError:
    """The pipeline's refusal in this route's words (fixed codes; details are small numbers only - never content or names)."""
    code = "payload_too_large" if exc.code == "too_large" else ("unsupported_format" if exc.code == "webp_refused" else exc.code)
    if code not in MESSAGES:
        code = "image_invalid"
    details = {k: v for k, v in (exc.details or {}).items() if isinstance(v, int)}
    return _err(conn, _STATUS.get(code, 422), code, **details)


def not_found(conn) -> ApiError:
    return _err(conn, 404, "attachment_not_found")


# ---------------------------------------------------------------- presentation

def present(a: Mapping[str, Any], *, manager: bool = False) -> dict[str, Any]:
    """A file as the managers' screens show it (`manager` adds the removal marks)."""
    out = {"id": a["id"], "name": a["name"], "caption": a.get("caption") or "", "kind": a["kind"], "mime": a["mime"], "bytes": int(a["bytes"]),
           "width": a.get("width"), "height": a.get("height"), "thumb": bool(a.get("thumb_path")), "visible_vendors": bool(a["visible_vendors"]),
           "created_at": a["created_at"], "removed": bool(a.get("removed_at"))}
    if manager and a.get("removed_at"):
        out["removed_at"] = a["removed_at"]
    return out


def present_public(a: Mapping[str, Any]) -> dict[str, Any]:
    """A file as a VENDOR sees it (contract 19.4 / the 15.5 row `rfq.attachments`): no author, no flags, no hash, no path."""
    return {"id": a["id"], "name": a["name"], "caption": a.get("caption") or "", "kind": a["kind"], "bytes": int(a["bytes"]),
            "width": a.get("width"), "height": a.get("height"), "thumb": bool(a.get("thumb_path"))}


def detail_block(conn, viewer: Viewer, seen: rfq.RfqSeen, state: str) -> dict[str, Any]:
    """The detail's `attachments` (live files; a manager also the removed ones) and `can.attach`."""
    if not store_rfq.has_attachments(conn):
        return {"attachments": [], "attach": False}
    manager = rfq.is_manager(viewer, seen)
    rows = store_rfq.attachments_of(conn, seen.row["id"], include_removed=manager)
    return {"attachments": [present(a, manager=manager) for a in rows], "attach": manager and state in EDITABLE_STATES}


def _travels(conn) -> Any:
    """Which stored kinds may leave towards a vendor (and a work order's viewers): Word / Excel only while the installation setting
    `rfq.attachments.allow_office` is on - turning it off also stops the office files already attached (fail closed)."""
    office = rfq_files.office_allowed(conn)
    return lambda a: office or not rfq_files.is_office(a["kind"])


def vendor_list(conn, rfq_id: str) -> list[dict[str, Any]]:
    """The request's live, vendor-visible files (the vendor page's `rfq.attachments`)."""
    if not store_rfq.has_attachments(conn):
        return []
    ok = _travels(conn)
    return [present_public(a) for a in store_rfq.attachments_of(conn, rfq_id) if a["visible_vendors"] and ok(a)]


def vendor_count(conn, rfq_id: str) -> int:
    return len(vendor_list(conn, rfq_id))


def ticket_list(conn, ticket_id: str) -> list[dict[str, Any]]:
    """The request files a service request references (its handler page and its "opened from RFQ" block)."""
    if not store_rfq.has_attachments(conn):
        return []
    ok = _travels(conn)
    return [present_public(a) for a in store_rfq.attachments_of_ticket(conn, ticket_id) if ok(a)]


# ---------------------------------------------------------------- manager writes

def _editable(conn, viewer: Viewer, seen: rfq.RfqSeen, action: str, rid: str | None) -> dict[str, Any]:
    rfq.need_manager(conn, viewer, seen, action, rid)
    row = rfq.require_visible(viewer, seen.row["id"]).row  # the request as it is now, through THE visibility rule
    if rfq.effective_state(row, now_utc()) not in EDITABLE_STATES:
        raise _err(conn, 409, "attachment_locked")
    return row


def check_add(conn, viewer: Viewer, seen: rfq.RfqSeen, incoming: int, rid: str | None) -> None:
    """Before the body is decoded: the role, the state and the quota with the raw size (a re-encoded picture is never larger than its
    upload's cap). An audited 403 / a 409 / a 413."""
    row = _editable(conn, viewer, seen, "ticket.rfq.attachment_add", rid)
    count, used = store_rfq.attachment_usage(conn, row["id"])
    if count >= rfq_files.MAX_FILES:
        raise _err(conn, 409, "attachment_limit", max_files=rfq_files.MAX_FILES)
    # a re-encoded picture is usually far smaller than its upload: only a full request is refused here; the stored size is checked in
    # `record`. A document is stored as uploaded, so its raw size already decides.
    if used >= rfq_files.TOTAL_MAX_BYTES or (incoming > rfq_files.IMAGE_MAX_BYTES and used + incoming > rfq_files.TOTAL_MAX_BYTES):
        raise _err(conn, 413, "attachment_total", max_bytes=rfq_files.TOTAL_MAX_BYTES)


def record(conn, viewer: Viewer, seen: rfq.RfqSeen, stored: rfq_files.StoredFile, *, name: Any, caption: Any, visible: bool,
           rid: str | None) -> str:
    """The row of a stored file, after everything is checked AGAIN inside this write transaction (the lock was released for the
    decode). Raises ApiError; the caller removes the stored file then."""
    row = _editable(conn, viewer, seen, "ticket.rfq.attachment_add", rid)
    count, used = store_rfq.attachment_usage(conn, row["id"])
    if count >= rfq_files.MAX_FILES:
        raise _err(conn, 409, "attachment_limit", max_files=rfq_files.MAX_FILES)
    if used + stored.bytes > rfq_files.TOTAL_MAX_BYTES:
        raise _err(conn, 413, "attachment_total", max_bytes=rfq_files.TOTAL_MAX_BYTES)
    try:
        cap = rfq_files.clean_caption(caption)
    except ValueError:
        raise rfq.invalid(conn, "caption", "too_long") from None
    at = iso(now_utc())
    aid = store_rfq.insert_attachment(conn, {
        "rfq_id": row["id"], "folder": row["id"], "kind": stored.kind, "name": rfq_files.display_name(name, stored.kind), "caption": cap,
        "mime": stored.mime, "path": stored.rel_path, "thumb_path": stored.thumb_rel, "sha256": stored.sha256, "bytes": stored.bytes,
        "width": stored.width, "height": stored.height, "visible_vendors": 1 if visible else 0,
        "position": store_rfq.next_attachment_position(conn, row["id"]), "created_by": viewer.uid, "created_at": at, "updated_at": at})
    store_rfq.update_rfq(conn, row["id"], {"updated_at": at}, bump=False)
    store_rfq.insert_event(conn, row["id"], "attachment_added", actor_kind="user", actor_user_id=viewer.uid, actor_name=rfq.actor_name(viewer),
                           data={"attachment_id": aid, "kind": stored.kind, "visible_vendors": bool(visible)}, at=at)
    rfq._audit(conn, viewer, "ticket.rfq.attachment_add", row, rid, attachment_id=aid, kind=stored.kind)
    return aid


def update(conn, viewer: Viewer, seen: rfq.RfqSeen, attachment_id: str, *, caption: Any = None, visible: bool | None = None,
           caption_given: bool = False, rid: str | None = None) -> list[str]:
    row = _editable(conn, viewer, seen, "ticket.rfq.attachment_edit", rid)
    a = store_rfq.attachment(conn, row["id"], attachment_id)
    if a is None or a.get("removed_at"):
        raise not_found(conn)
    fields: dict[str, Any] = {}
    if caption_given:
        try:
            cap = rfq_files.clean_caption(caption)
        except ValueError:
            raise rfq.invalid(conn, "caption", "too_long") from None
        if cap != (a.get("caption") or ""):
            fields["caption"] = cap
    if visible is not None and bool(visible) != bool(a["visible_vendors"]):
        fields["visible_vendors"] = 1 if visible else 0
    if not fields:
        return []
    at = iso(now_utc())
    store_rfq.update_attachment(conn, a["id"], {**fields, "updated_at": at})
    store_rfq.update_rfq(conn, row["id"], {"updated_at": at}, bump=False)
    changed = sorted(fields)
    data: dict[str, Any] = {"attachment_id": a["id"], "fields": changed}
    if "visible_vendors" in fields:
        data["visible_vendors"] = bool(fields["visible_vendors"])
    store_rfq.insert_event(conn, row["id"], "attachment_changed", actor_kind="user", actor_user_id=viewer.uid, actor_name=rfq.actor_name(viewer),
                           data=data, at=at)
    rfq._audit(conn, viewer, "ticket.rfq.attachment_edit", row, rid, attachment_id=a["id"], fields=changed)
    return changed


def remove(conn, viewer: Viewer, seen: rfq.RfqSeen, attachment_id: str, rid: str | None = None) -> list[str]:
    """Remove a file (module docstring). Returns the stored paths the caller deletes AFTER the commit (empty when only marked)."""
    row = _editable(conn, viewer, seen, "ticket.rfq.attachment_remove", rid)
    a = store_rfq.attachment(conn, row["id"], attachment_id)
    if a is None or a.get("removed_at"):
        raise not_found(conn)
    at = iso(now_utc())
    keep = store_rfq.quotes_arrived(conn, row["id"])
    if keep:
        store_rfq.update_attachment(conn, a["id"], {"removed_at": at, "removed_by": viewer.uid, "updated_at": at})
        doomed: list[str] = []
    else:
        store_rfq.delete_attachment(conn, a["id"])
        doomed = [p for p in (a["path"], a.get("thumb_path")) if p]
    store_rfq.update_rfq(conn, row["id"], {"updated_at": at}, bump=False)
    store_rfq.insert_event(conn, row["id"], "attachment_removed", actor_kind="user", actor_user_id=viewer.uid, actor_name=rfq.actor_name(viewer),
                           data={"attachment_id": a["id"], "kept": keep}, at=at)
    rfq._audit(conn, viewer, "ticket.rfq.attachment_remove", row, rid, attachment_id=a["id"], kept=keep)
    return doomed


# ---------------------------------------------------------------- reads of one file

def for_manager(conn, seen: rfq.RfqSeen, attachment_id: str) -> dict[str, Any]:
    """A file of a request the caller sees (internal-only and - for the record - removed files included); 404 otherwise."""
    a = store_rfq.attachment(conn, seen.row["id"], attachment_id) if store_rfq.has_attachments(conn) else None
    if a is None:
        raise not_found(conn)
    return a


def for_vendor(conn, rfq_id: str, attachment_id: str) -> dict[str, Any] | None:
    """A live, vendor-visible file of THIS request, or None (the route answers the uniform 404)."""
    if not store_rfq.has_attachments(conn):
        return None
    a = store_rfq.attachment(conn, rfq_id, attachment_id)
    if a is None or a.get("removed_at") or not a["visible_vendors"] or not _travels(conn)(a):
        return None
    return a


def for_ticket(conn, ticket_id: str, attachment_id: str) -> dict[str, Any] | None:
    if not store_rfq.has_attachments(conn):
        return None
    a = store_rfq.attachment_of_ticket(conn, ticket_id, attachment_id)
    return a if a is not None and _travels(conn)(a) else None


def file_path(root: Path, a: Mapping[str, Any], thumb: bool = False) -> Path | None:
    rel = a.get("thumb_path") if thumb else a.get("path")
    if not rel:
        return None
    try:
        p = rfq_files.path_of(root, rel)
    except ValueError:
        return None
    return p if p.is_file() else None


# ---------------------------------------------------------------- the work order (TKRFQ4) and the vendor message

def reference_for_order(conn, rfq_id: str, ticket_id: str, award_id: str | None, at: str) -> int:
    if not store_rfq.has_attachments(conn):
        return 0
    return store_rfq.add_attachment_refs(conn, rfq_id, ticket_id, award_id, at)


FILES_TEXT = {
    "he": ("מצורף לבקשה קובץ אחד (בקישור).", "מצורפים לבקשה {n} קבצים (בקישור)."),
    "en": ("1 file is attached to the request (see the link).", "{n} files are attached to the request (see the link)."),
    "ar": ("مرفق بالطلب ملف واحد (في الرابط).", "مرفق بالطلب {n} ملفات (في الرابط)."),
    "ru": ("К запросу приложен 1 файл (по ссылке).", "К запросу приложено файлов: {n} (по ссылке)."),
}


def files_param(conn, rfq_id: str, lang: str) -> str:
    """The `{files}` placeholder of an RFQ message: "N files are attached (see the link)" in the vendor's language - a COUNT only,
    never a file name or an address (owner 17.10). Empty (the line is dropped) when no vendor-visible file exists."""
    n = vendor_count(conn, rfq_id)
    if n <= 0:
        return ""
    one, many = FILES_TEXT.get(lang, FILES_TEXT["he"])
    return one if n == 1 else many.format(n=n)


def janitor(conn) -> int:
    return store_rfq.drop_orphan_attachments(conn) if store_rfq.has_attachments(conn) else 0
