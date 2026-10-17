"""RFQ-VENDOR-UPLOAD (owner decision 2026-10-17; docs/tickets/RFQ_BACKEND_CONTRACT.md section 19.10, docs/changes/CR-RFQ-VENDOR-UPLOAD.md):
files and pictures a VENDOR attaches to HIS OWN quote through his personal RFQ link - the rows, the rules and who may see what. The
public routes are public_rfq.py's (`POST /t/api/rfq/upload`, `POST /t/api/rfq/upload/remove`); the managers' reads are
routers/tickets_rfq.py's. The FILE side (what a file is, the structural checks, the stored copy, the headers) is rfq_files.py's - the
SAME code as a manager's file (pictures re-encoded through the one image pipeline, PDF / DOCX / XLSX by the hardened refusal checks of
the 2.6.4 review), with two differences for an anonymous caller: WebP is refused (decision 6) and the decode runs in the public
listener's slot.

    switch    the installation setting `rfq.vendor_uploads.enabled` (OFF by default). Off: both public routes answer the uniform 404,
              the page's `uploads` block is null; files already uploaded stay readable by the managers. Word / Excel additionally need
              `rfq.attachments.allow_office` (422 `office_disabled` before any scan; and while it is off the managers' lists and reads
              leave office files out - fail closed, like the files that travel to vendors).
    upload    his own link only, past the code gate, not read-only, while the request still takes quotes (sent / collecting, before
              the deadline, his vendor row open - rfq_vendor._open_for_writes, its fixed refusal vocabulary), and only onto HIS
              current submitted quote (`quote_id`: any other id - another vendor's, a superseded or withdrawn version, an unknown id -
              is the same 409 `quote_closed` `{reason: "vendor"}`). Limits per vendor per request: 5 live files, 10 uploads in all
              (a removal gives no upload back), a picture 8 MiB / a document 10 MiB as uploaded, 20 MiB stored in all (removed files
              and thumbnails included - they stay on disk). Checked before the decode with the raw size and again inside the write
              transaction with the stored size. Plus the edge's `rfq_upload` windows (per link, per client network) and the 2 GiB cap.
    remove    the same rules: one of HIS live files is marked removed (the row and the file stay for the record until the request is
              purged; the managers see it marked). Any other id is 409 `upload_not_found` (never the uniform 404: the page would
              forget a live link).
    see       the vendor sees his own files' names / kinds / sizes on his page (no public read route - he has the originals); the
              managers see every vendor's files in the comparison and read them through the internal API with the comparison's
              rule (the request visible AND tickets.costs.view - a vendor's file is part of his quote, it may carry prices); no
              vendor ever sees another vendor's file; nothing travels to a work order (not built).
Timeline (`vendor_file_added` / `vendor_file_removed`) and audit rows (`ticket.rfq.vendor_file_add` / `_remove`) carry ids, the kind and
counts only - never a name, a size, a hash or a caption."""
from __future__ import annotations

import datetime as dt
from pathlib import Path
from typing import Any, Mapping

from . import rfq_files, settings_doc, store_rfq
from .costs import iso

KiB = 1024
MiB = 1024 * KiB
MAX_LIVE = 5  # live (not removed) files per vendor per request
MAX_UPLOADS = 10  # files ever stored per vendor per request (a removal gives none back)
IMAGE_MAX_BYTES = rfq_files.IMAGE_MAX_BYTES  # 8 MiB (the image pipeline's own cap)
DOCUMENT_MAX_BYTES = rfq_files.DOCUMENT_MAX_BYTES  # 10 MiB
TOTAL_MAX_BYTES = 20 * MiB  # stored bytes per vendor per request (removed files and thumbnails included)
NAME_FIELD_MAX = 240  # the optional `name` text field of the form (bytes); cleaned by rfq_files.display_name, never trusted for the kind


class Refused(Exception):
    """A refusal of a vendor-file write: status + code (+ small extra numbers) - the public route answers it as is."""

    def __init__(self, status: int, code: str, **extra: Any) -> None:
        super().__init__(code)
        self.status = status
        self.code = code
        self.extra = extra


def enabled(conn) -> bool:
    """The installation setting `rfq.vendor_uploads.enabled` (OFF by default; fail closed on anything unexpected)."""
    try:
        return settings_doc.read(conn)["rfq"]["vendor_uploads"]["enabled"] is True
    except (KeyError, TypeError):
        return False


def available(conn) -> bool:
    return store_rfq.has_vendor_files(conn) and enabled(conn)


def types(allow_office: bool) -> list[str]:
    """The kinds the vendor's picker offers (the server decides by content anyway). No WebP on the public side (decision 6)."""
    return ["jpg", "png", "pdf"] + (["docx", "xlsx"] if allow_office else [])


def limits(allow_office: bool) -> dict[str, Any]:
    return {"files": MAX_LIVE, "uploads": MAX_UPLOADS, "image_bytes": IMAGE_MAX_BYTES, "document_bytes": DOCUMENT_MAX_BYTES,
            "total_bytes": TOTAL_MAX_BYTES, "types": types(allow_office)}


def present_own(f: Mapping[str, Any]) -> dict[str, Any]:
    """One of HIS files as his page lists it: no path, no hash, no thumbnail address (there is no public read route)."""
    return {"id": f["id"], "name": f["name"], "kind": f["kind"], "bytes": int(f["bytes"]), "at": f["created_at"]}


def present_manager(f: Mapping[str, Any], versions: Mapping[str, int]) -> dict[str, Any]:
    return {"id": f["id"], "name": f["name"], "kind": f["kind"], "mime": f["mime"], "bytes": int(f["bytes"]), "width": f.get("width"),
            "height": f.get("height"), "thumb": bool(f.get("thumb_path")), "quote_id": f.get("quote_id"),
            "quote_version": versions.get(f.get("quote_id") or ""), "created_at": f["created_at"], "removed": bool(f.get("removed_at"))}


def _office_ok(conn) -> Any:
    office = rfq_files.office_allowed(conn)
    return lambda f: office or not rfq_files.is_office(f["kind"])


# ---------------------------------------------------------------- the vendor's page (rfq_vendor.view)

def page_block(conn, v: Mapping[str, Any], *, writable: bool, quote: Mapping[str, Any] | None) -> dict[str, Any] | None:
    """`uploads` of `GET /t/api/rfq`: null while the switch is off (the page shows nothing); else his own files, the limits and
    `can.upload` (a writable page, a submitted quote of his, room left). Only past the code gate (the caller's rule)."""
    if not available(conn):
        return None
    office = rfq_files.office_allowed(conn)
    live, every, used = store_rfq.vendor_file_usage(conn, v["id"])
    room = live < MAX_LIVE and every < MAX_UPLOADS and used < TOTAL_MAX_BYTES
    submitted = quote is not None and quote.get("state") == "submitted"
    return {"files": [present_own(f) for f in store_rfq.vendor_files_of(conn, v["id"])], "limits": limits(office),
            "quote_id": quote["id"] if submitted and quote else None, "used_bytes": used, "uploads_left": max(0, MAX_UPLOADS - every),
            "can": {"upload": bool(writable and submitted and room), "remove": bool(writable)}}


# ---------------------------------------------------------------- the writes (inside the public route's transactions)

def _his_quote(conn, v: Mapping[str, Any], quote_id: Any) -> dict[str, Any]:
    from . import rfq_vendor

    q = rfq_vendor._submitted(conn, v)
    if q is None or not isinstance(quote_id, str) or q["id"] != quote_id:
        # another vendor's quote, a superseded / withdrawn version, an unknown id: ONE answer (the withdraw route's vocabulary)
        raise rfq_vendor.VendorRefused(409, "quote_closed", reason="vendor")
    return q


def _quota(conn, v: Mapping[str, Any], incoming: int, *, stored: bool) -> None:
    live, every, used = store_rfq.vendor_file_usage(conn, v["id"])
    if live >= MAX_LIVE:
        raise Refused(409, "upload_limit", max_files=MAX_LIVE)
    if every >= MAX_UPLOADS:
        raise Refused(409, "upload_limit", max_uploads=MAX_UPLOADS)
    # before the decode a picture's raw size may be far above what it stores (a fresh JPEG): only a full quota or a document that
    # cannot fit is refused there; inside the write transaction the STORED size decides
    if used >= TOTAL_MAX_BYTES or ((stored or incoming > IMAGE_MAX_BYTES) and used + incoming > TOTAL_MAX_BYTES):
        raise Refused(413, "upload_total", max_bytes=TOTAL_MAX_BYTES)


def check_add(conn, link: Any, quote_id: Any, incoming: int, now: dt.datetime) -> None:
    """Before the body is decoded: the request still takes quotes from him, the quote is his submitted one, the quota with the raw
    size. Raises rfq_vendor.VendorRefused / VendorLinkGone / Refused."""
    from . import rfq_vendor

    if not available(conn):
        raise rfq_vendor.VendorLinkGone()  # switched off meanwhile: the uniform 404, as before the switch
    _row, v = rfq_vendor._open_for_writes(conn, link, now)
    _his_quote(conn, v, quote_id)
    _quota(conn, v, incoming, stored=False)


def record(conn, link: Any, stored: rfq_files.StoredFile, *, name: Any, quote_id: Any, now: dt.datetime) -> dict[str, Any]:
    """The row of a stored file, after everything is checked AGAIN inside this write transaction (the lock was released for the
    decode). Raises; the caller removes the stored file then."""
    from . import rfq_vendor

    if not available(conn):
        raise rfq_vendor.VendorLinkGone()
    row, v = rfq_vendor._open_for_writes(conn, link, now)
    q = _his_quote(conn, v, quote_id)
    _quota(conn, v, stored.stored_bytes, stored=True)
    at = iso(now)
    fid = store_rfq.insert_vendor_file(conn, {
        "rfq_id": row["id"], "rfq_vendor_id": v["id"], "quote_id": q["id"], "folder": row["id"], "kind": stored.kind,
        "name": rfq_files.display_name(name, stored.kind), "mime": stored.mime, "path": stored.rel_path, "thumb_path": stored.thumb_rel,
        "sha256": stored.sha256, "bytes": stored.bytes, "stored_bytes": stored.stored_bytes, "width": stored.width, "height": stored.height,
        "created_at": at})
    store_rfq.update_rfq(conn, row["id"], {"updated_at": at}, bump=False)  # a file never makes a manager's open form stale
    store_rfq.insert_event(conn, row["id"], "vendor_file_added", actor_kind="contact", actor_name=rfq_vendor._name(conn, v), rfq_vendor_id=v["id"],
                           data={"file_id": fid, "kind": stored.kind, "quote_id": q["id"]}, at=at)
    rfq_vendor._audit(conn, link, "ticket.rfq.vendor_file_add", row, vendor_id=v["id"], file_id=fid, kind=stored.kind, quote_id=q["id"])
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

def by_vendor(conn, rfq_id: str) -> dict[str, list[dict[str, Any]]]:
    """The comparison's `vendor_files` per vendor row (live and removed, marked; office files only while allow_office is on)."""
    if not store_rfq.has_vendor_files(conn):
        return {}
    ok = _office_ok(conn)
    files = [f for f in store_rfq.vendor_files_of_rfq(conn, rfq_id) if ok(f)]
    versions: dict[str, int] = {}
    for f in files:
        qid = f.get("quote_id")
        if qid and qid not in versions:
            r = conn.execute("SELECT version FROM ticket_quotes WHERE id = ?", (qid,)).fetchone()
            if r is not None:
                versions[qid] = int(r[0])
    out: dict[str, list[dict[str, Any]]] = {}
    for f in files:
        out.setdefault(f["rfq_vendor_id"], []).append(present_manager(f, versions))
    return out


def for_manager(conn, rfq_id: str, file_id: str) -> dict[str, Any] | None:
    """A vendor file OF THIS REQUEST (removed ones included, for the record), or None. Office files only while allow_office is on."""
    if not store_rfq.has_vendor_files(conn):
        return None
    f = store_rfq.vendor_file(conn, rfq_id, file_id)
    if f is None or not _office_ok(conn)(f):
        return None
    return f


def file_path(root: Path, f: Mapping[str, Any], thumb: bool = False) -> Path | None:
    rel = f.get("thumb_path") if thumb else f.get("path")
    if not rel:
        return None
    try:
        p = rfq_files.path_of(root, rel)
    except ValueError:
        return None
    return p if p.is_file() else None
