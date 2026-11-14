"""RFQ-VENDOR-UPLOAD (owner decisions 2026-10-17; docs/tickets/RFQ_BACKEND_CONTRACT.md section 19.10, docs/changes/CR-RFQ-VENDOR-UPLOAD.md):
files and pictures a VENDOR attaches to HIS OWN quote or to HIS OWN question, through his personal RFQ link - the rows, the rules and
who may see what. The public routes are public_rfq.py's (`POST /t/api/rfq/upload`, `POST /t/api/rfq/upload/remove`); the managers'
reads are routers/tickets_rfq.py's. The FILE side (what a file is, the structural checks, the stored copy, the headers) is
rfq_files.py's - the SAME code as a manager's file (pictures re-encoded through the one image pipeline, PDF / DOCX / XLSX by the hardened
refusal checks of the 2.6.4 review), with two differences for an anonymous caller: WebP is refused (decision 6) and the decode runs in
the public listener's slot.

    switch    the installation setting `rfq.vendor_uploads.enabled` (OFF by default). Off: both public routes answer the uniform 404,
              the page's `uploads` block is null; files already uploaded stay readable by the managers. Word / Excel additionally need
              `rfq.attachments.allow_office` (422 `office_disabled` before any scan; and while it is off the managers' lists and reads
              leave office files out - fail closed, like the files that travel to vendors).
    limits    administrator settings `rfq.vendor_uploads.max_files` / `max_uploads` / `max_image_mb` / `max_doc_mb` / `max_total_mb`
              (defaults 5 / 10 / 8 / 10 / 20; validated by settings_doc against the HARD caps below, and clamped to them again here -
              the hard caps also hold at the edge: the route's body cap is the document hard cap + the multipart framing, the image
              pipeline refuses more than 8 MiB whatever the setting).
    upload    his own link only, past the code gate, not read-only, while the request still takes quotes (sent / collecting, before
              the deadline, his vendor row open - rfq_vendor._open_for_writes, its fixed refusal vocabulary), and onto EXACTLY ONE
              target of his own: `quote_id` = HIS current submitted quote (any other id - another vendor's, a superseded or withdrawn
              version, unknown - is 409 `quote_closed` `{reason: "vendor"}`), or `message_id` = one of HIS OWN questions in his own
              thread (inbound, not a WhatsApp reply; any other id is 409 `question_not_found`) - the question path needs no quote. Both
              share ONE quota per vendor per request (live files, uploads in all - a removal gives none back - and stored bytes incl.
              removed files and thumbnails), checked before the decode with the raw size and again inside the write transaction with
              the stored size; plus the edge's `rfq_upload` windows (per link, per client network) and the 2 GiB cap.
    remove    the same request rules: one of HIS live files is marked removed (the row and the file stay for the record until the
              request is purged; the managers see it marked). Any other id is 409 `upload_not_found` (never the uniform 404: the page
              would forget a live link).
    see       the vendor sees his own files' names / kinds / sizes on his page (no public read route - he has the originals). Managers:
              a QUOTE file with the comparison's rule (the request visible AND tickets.costs.view - it may carry prices), listed in the
              comparison; a QUESTION file with the thread's rule (whoever sees the request sees its threads), listed next to the
              question; the WORK ORDER (TKRFQ4) references the awarded vendor's live files (no copy) - listed in its "opened from RFQ"
              block and read only by a caller who holds tickets.costs.view on that ticket. No vendor ever sees another vendor's file.
Timeline (`vendor_file_added` / `vendor_file_removed`) and audit rows (`ticket.rfq.vendor_file_add` / `_remove`) carry ids, the kind and
the target only - never a name, a size, a hash. No notification (owner decision 2026-10-17)."""
from __future__ import annotations

import datetime as dt
from pathlib import Path
from typing import Any, Mapping

from . import rfq_files, settings_doc, store_rfq
from .costs import COSTS_VIEW, iso

KiB = 1024
MiB = 1024 * KiB
# the HARD caps (settings_doc validates the administrator's numbers against them; enforced again here and at the edge)
HARD_FILES = 10
HARD_UPLOADS = 30
HARD_IMAGE_MB = 8  # the image pipeline's own cap (image_intake.MAX_BYTES)
HARD_DOC_MB = 10  # rfq_files.DOCUMENT_MAX_BYTES and the edge's body cap (public_http.RFQ_UPLOAD_MAX)
HARD_TOTAL_MB = 50
DEFAULTS = {"max_files": 5, "max_uploads": 10, "max_image_mb": 8, "max_doc_mb": 10, "max_total_mb": 20}
HARD = {"max_files": HARD_FILES, "max_uploads": HARD_UPLOADS, "max_image_mb": HARD_IMAGE_MB, "max_doc_mb": HARD_DOC_MB, "max_total_mb": HARD_TOTAL_MB}
NAME_FIELD_MAX = 240  # the optional `name` text field of the form (bytes); cleaned by rfq_files.display_name, never trusted for the kind


class Refused(Exception):
    """A refusal of a vendor-file write: status + code (+ small extra numbers) - the public route answers it as is."""

    def __init__(self, status: int, code: str, **extra: Any) -> None:
        super().__init__(code)
        self.status = status
        self.code = code
        self.extra = extra


def _section(conn) -> dict[str, Any]:
    try:
        sec = settings_doc.read(conn)["rfq"]["vendor_uploads"]
        return sec if isinstance(sec, dict) else {}
    except (KeyError, TypeError):
        return {}


def enabled(conn) -> bool:
    """The installation setting `rfq.vendor_uploads.enabled` (OFF by default; fail closed on anything unexpected)."""
    return _section(conn).get("enabled") is True


def available(conn) -> bool:
    return store_rfq.has_vendor_files(conn) and enabled(conn)


class Limits:
    """The administrator's limits, clamped to the hard caps (a stored value outside them - an older document, a hand edit - never
    widens anything)."""

    def __init__(self, sec: Mapping[str, Any]) -> None:
        def pick(key: str) -> int:
            v = sec.get(key, DEFAULTS[key])
            v = v if isinstance(v, int) and not isinstance(v, bool) else DEFAULTS[key]
            return max(1, min(HARD[key], v))

        self.files = pick("max_files")
        self.uploads = max(self.files, pick("max_uploads"))
        self.image_bytes = pick("max_image_mb") * MiB
        self.document_bytes = pick("max_doc_mb") * MiB
        self.total_bytes = pick("max_total_mb") * MiB

    def cap(self, coarse: str) -> int:
        return self.image_bytes if coarse == "image" else self.document_bytes


def limits_of(conn) -> Limits:
    return Limits(_section(conn))


def types(allow_office: bool) -> list[str]:
    """The kinds the vendor's picker offers (the server decides by content anyway). No WebP on the public side (decision 6)."""
    return ["jpg", "png", "pdf"] + (["docx", "xlsx"] if allow_office else [])


def present_limits(lim: Limits, allow_office: bool) -> dict[str, Any]:
    return {"files": lim.files, "uploads": lim.uploads, "image_bytes": lim.image_bytes, "document_bytes": lim.document_bytes,
            "total_bytes": lim.total_bytes, "types": types(allow_office)}


def present_own(f: Mapping[str, Any]) -> dict[str, Any]:
    """One of HIS files as his page lists it: no path, no hash, no thumbnail address (there is no public read route)."""
    return {"id": f["id"], "name": f["name"], "kind": f["kind"], "bytes": int(f["bytes"]), "at": f["created_at"],
            "on": "question" if f.get("message_id") else "quote", "message_id": f.get("message_id")}


def present_manager(f: Mapping[str, Any], versions: Mapping[str, int] | None = None) -> dict[str, Any]:
    return {"id": f["id"], "name": f["name"], "kind": f["kind"], "mime": f["mime"], "bytes": int(f["bytes"]), "width": f.get("width"),
            "height": f.get("height"), "thumb": bool(f.get("thumb_path")), "quote_id": f.get("quote_id"), "message_id": f.get("message_id"),
            "quote_version": (versions or {}).get(f.get("quote_id") or ""), "created_at": f["created_at"], "removed": bool(f.get("removed_at"))}


def _office_ok(conn) -> Any:
    office = rfq_files.office_allowed(conn)
    return lambda f: office or not rfq_files.is_office(f["kind"])


# ---------------------------------------------------------------- the vendor's page (rfq_vendor.view)

def page_block(conn, v: Mapping[str, Any], *, writable: bool, quote: Mapping[str, Any] | None, can_ask: bool = False) -> dict[str, Any] | None:
    """`uploads` of `GET /t/api/rfq`: null while the switch is off (the page shows nothing); else his own files, the limits,
    `can.upload` (onto his submitted quote), `can.question` (with a new question - no quote needed) and `can.remove`. Only past the code
    gate (the caller's rule)."""
    if not available(conn):
        return None
    office = rfq_files.office_allowed(conn)
    lim = limits_of(conn)
    live, every, used = store_rfq.vendor_file_usage(conn, v["id"])
    room = live < lim.files and every < lim.uploads and used < lim.total_bytes
    submitted = quote is not None and quote.get("state") == "submitted"
    return {"files": [present_own(f) for f in store_rfq.vendor_files_of(conn, v["id"])], "limits": present_limits(lim, office),
            "quote_id": quote["id"] if submitted and quote else None, "used_bytes": used, "uploads_left": max(0, lim.uploads - every),
            "can": {"upload": bool(writable and submitted and room), "question": bool(writable and can_ask and room), "remove": bool(writable)}}


# ---------------------------------------------------------------- the writes (inside the public route's transactions)

def _his_quote(conn, v: Mapping[str, Any], quote_id: Any) -> dict[str, Any]:
    from . import rfq_vendor

    q = rfq_vendor._submitted(conn, v)
    if q is None or not isinstance(quote_id, str) or q["id"] != quote_id:
        # another vendor's quote, a superseded / withdrawn version, an unknown id: ONE answer (the withdraw route's vocabulary)
        raise rfq_vendor.VendorRefused(409, "quote_closed", reason="vendor")
    return q


def _his_question(conn, row: Mapping[str, Any], v: Mapping[str, Any], message_id: Any) -> dict[str, Any]:
    m = store_rfq.message(conn, message_id) if isinstance(message_id, str) else None
    if (m is None or m.get("rfq_id") != row["id"] or m.get("rfq_vendor_id") != v["id"] or m.get("direction") != "in"
            or m.get("author_kind") != "contact" or str(m.get("source_id") or "").startswith("whatsapp:")):
        raise Refused(409, "question_not_found")  # another vendor's, an answer, a WhatsApp reply, unknown: ONE answer
    return m


def _target(conn, row: Mapping[str, Any], v: Mapping[str, Any], target: Mapping[str, Any]) -> tuple[str | None, str | None]:
    """(quote_id, message_id) - exactly one, both his own."""
    qid, mid = target.get("quote_id") or None, target.get("message_id") or None
    if (qid is None) == (mid is None):
        raise Refused(422, "invalid", fields=[{"field": "quote_id", "code": "one_of"}])
    if qid is not None:
        return _his_quote(conn, v, qid)["id"], None
    return None, _his_question(conn, row, v, mid)["id"]


def _quota(conn, v: Mapping[str, Any], lim: Limits, incoming: int, *, stored: bool) -> None:
    live, every, used = store_rfq.vendor_file_usage(conn, v["id"])
    if live >= lim.files:
        raise Refused(409, "upload_limit", max_files=lim.files)
    if every >= lim.uploads:
        raise Refused(409, "upload_limit", max_uploads=lim.uploads)
    # before the decode a picture's raw size may be far above what it stores (a fresh JPEG): only a full quota or a document that
    # cannot fit is refused there; inside the write transaction the STORED size decides
    if used >= lim.total_bytes or ((stored or incoming > lim.image_bytes) and used + incoming > lim.total_bytes):
        raise Refused(413, "upload_total", max_bytes=lim.total_bytes)


def check_add(conn, link: Any, target: Mapping[str, Any], data: bytes, now: dt.datetime) -> None:
    """Before the body is decoded: the request still takes writes from him, the target is his own, the administrator's size cap for
    the kind (by content: rfq_files.kind_of - a 415 for anything not offered), the quota with the raw size. Raises
    rfq_vendor.VendorRefused / VendorLinkGone / Refused / IntakeError."""
    from . import rfq_vendor

    if not available(conn):
        raise rfq_vendor.VendorLinkGone()  # switched off meanwhile: the uniform 404, as before the switch
    row, v = rfq_vendor._open_for_writes(conn, link, now)
    _target(conn, row, v, target)
    lim = limits_of(conn)
    coarse = rfq_files.check_size(data)  # 415 / 413 by the HARD caps
    if len(data) > lim.cap(coarse):
        raise Refused(413, "too_large", max_bytes=lim.cap(coarse))
    _quota(conn, v, lim, len(data), stored=False)


def record(conn, link: Any, stored: rfq_files.StoredFile, *, name: Any, target: Mapping[str, Any], now: dt.datetime) -> dict[str, Any]:
    """The row of a stored file, after everything is checked AGAIN inside this write transaction (the lock was released for the
    decode). Raises; the caller removes the stored file then."""
    from . import rfq_vendor

    if not available(conn):
        raise rfq_vendor.VendorLinkGone()
    row, v = rfq_vendor._open_for_writes(conn, link, now)
    qid, mid = _target(conn, row, v, target)
    _quota(conn, v, limits_of(conn), stored.stored_bytes, stored=True)
    at = iso(now)
    fid = store_rfq.insert_vendor_file(conn, {
        "rfq_id": row["id"], "rfq_vendor_id": v["id"], "quote_id": qid, "message_id": mid, "folder": row["id"], "kind": stored.kind,
        "name": rfq_files.display_name(name, stored.kind), "mime": stored.mime, "path": stored.rel_path, "thumb_path": stored.thumb_rel,
        "sha256": stored.sha256, "bytes": stored.bytes, "stored_bytes": stored.stored_bytes, "width": stored.width, "height": stored.height,
        "created_at": at})
    store_rfq.update_rfq(conn, row["id"], {"updated_at": at}, bump=False)  # a file never makes a manager's open form stale
    if mid:  # HARDEN271 (review F3): a late file on an answered (or already read) question is not missed - pending and unread again
        store_rfq.reopen_question_for_file(conn, mid)
    ref = {"quote_id": qid} if qid else {"message_id": mid}
    store_rfq.insert_event(conn, row["id"], "vendor_file_added", actor_kind="contact", actor_name=rfq_vendor._name(conn, v), rfq_vendor_id=v["id"],
                           data={"file_id": fid, "kind": stored.kind, **ref}, at=at)
    rfq_vendor._audit(conn, link, "ticket.rfq.vendor_file_add", row, vendor_id=v["id"], file_id=fid, kind=stored.kind, **ref)
    f = store_rfq.vendor_file(conn, row["id"], fid) or {}
    return present_own(f)


def remove(conn, link: Any, file_id: Any, now: dt.datetime) -> None:
    from . import rfq_vendor

    if not available(conn):
        raise rfq_vendor.VendorLinkGone()
    row, v = rfq_vendor._open_for_writes(conn, link, now)
    f = store_rfq.vendor_file(conn, row["id"], file_id) if isinstance(file_id, str) else None
    if f is None or f["rfq_vendor_id"] != v["id"] or f.get("removed_at"):
        raise Refused(409, "upload_not_found")  # another vendor's file, a removed or an unknown one: the same answer
    at = iso(now)
    store_rfq.mark_vendor_file_removed(conn, f["id"], at)
    store_rfq.update_rfq(conn, row["id"], {"updated_at": at}, bump=False)
    store_rfq.insert_event(conn, row["id"], "vendor_file_removed", actor_kind="contact", actor_name=rfq_vendor._name(conn, v), rfq_vendor_id=v["id"],
                           data={"file_id": f["id"]}, at=at)
    rfq_vendor._audit(conn, link, "ticket.rfq.vendor_file_remove", row, vendor_id=v["id"], file_id=f["id"])


# ---------------------------------------------------------------- the managers (internal API)

def _versions(conn, files: list[Mapping[str, Any]]) -> dict[str, int]:
    versions: dict[str, int] = {}
    for f in files:
        qid = f.get("quote_id")
        if qid and qid not in versions:
            r = conn.execute("SELECT version FROM ticket_quotes WHERE id = ?", (qid,)).fetchone()
            if r is not None:
                versions[qid] = int(r[0])
    return versions


def by_vendor(conn, rfq_id: str) -> dict[str, list[dict[str, Any]]]:
    """The comparison's `vendor_files` per vendor row: his QUOTE files (live and removed, marked; office files only while
    allow_office is on). Question files are shown next to their question (by_message)."""
    if not store_rfq.has_vendor_files(conn):
        return {}
    ok = _office_ok(conn)
    files = [f for f in store_rfq.vendor_files_of_rfq(conn, rfq_id) if ok(f) and f.get("quote_id")]
    versions = _versions(conn, files)
    out: dict[str, list[dict[str, Any]]] = {}
    for f in files:
        out.setdefault(f["rfq_vendor_id"], []).append(present_manager(f, versions))
    return out


def by_message(conn, rfq_id: str, message_ids: list[str]) -> dict[str, list[dict[str, Any]]]:
    """The files bound to these questions (the thread's and the pending questions' `files`)."""
    if not store_rfq.has_vendor_files(conn):
        return {}
    ok = _office_ok(conn)
    return {mid: [present_manager(f) for f in fs if ok(f)] for mid, fs in store_rfq.vendor_files_of_message(conn, rfq_id, message_ids).items()}


def sees_request_files(viewer: Any, seen: Any) -> bool:
    """HARDEN271 (vendor-upload review F1, owner-accepted): ONE rule for every vendor file of a request - quote files AND question files -
    `tickets.costs.view` on the request (the comparison's rule). A vendor may write prices in a question file."""
    from . import rfq

    return bool(rfq.sees_amounts(viewer, seen))


def by_message_for(conn, viewer: Any, seen: Any, message_ids: list[str]) -> tuple[dict[str, list[dict[str, Any]]], dict[str, int]]:
    """(files by question, hidden counts by question). A viewer without costs.view gets no file at all - no id, no name, no size - only
    the neutral count of files attached (`files_hidden`), so the thread still shows that something was attached."""
    files = by_message(conn, seen.row["id"], message_ids)
    if sees_request_files(viewer, seen):
        return files, {}
    return {}, {mid: len(fs) for mid, fs in files.items() if fs}


def for_manager(conn, rfq_id: str, file_id: str) -> dict[str, Any] | None:
    """A vendor file OF THIS REQUEST (removed ones included, for the record), or None. Office files only while allow_office is on."""
    if not store_rfq.has_vendor_files(conn):
        return None
    f = store_rfq.vendor_file(conn, rfq_id, file_id)
    if f is None or not _office_ok(conn)(f):
        return None
    return f


def sees_ticket_files(viewer: Any, ticket_row: Mapping[str, Any]) -> bool:
    """The work order's list / read: only a caller who may see the costs of THAT ticket (owner decision 2026-10-17)."""
    return bool(viewer.holds(COSTS_VIEW, dict(ticket_row)))


def ticket_list(conn, viewer: Any, ticket_row: Mapping[str, Any]) -> list[dict[str, Any]]:
    """The awarded vendor's files a work order references (`rfq_origin.vendor_files`); [] for a caller without costs.view."""
    if not store_rfq.has_vendor_files(conn) or not sees_ticket_files(viewer, ticket_row):
        return []
    ok = _office_ok(conn)
    files = [f for f in store_rfq.vendor_files_of_ticket(conn, ticket_row["id"]) if ok(f)]
    return [present_manager(f, _versions(conn, files)) for f in files]


def for_ticket(conn, ticket_id: str, file_id: str) -> dict[str, Any] | None:
    if not store_rfq.has_vendor_files(conn):
        return None
    f = store_rfq.vendor_file_of_ticket(conn, ticket_id, file_id)
    return f if f is not None and _office_ok(conn)(f) else None


def file_path(root: Path, f: Mapping[str, Any], thumb: bool = False) -> Path | None:
    rel = f.get("thumb_path") if thumb else f.get("path")
    if not rel:
        return None
    try:
        p = rfq_files.path_of(root, rel)
    except ValueError:
        return None
    return p if p.is_file() else None
