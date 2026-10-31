"""CR-VENDORQ-294 (docs/changes/CR-VENDORQ-294-DESIGN.md section 5): a document (PDF / HTML report) sent to a person through a
TEMPORARY LINK - the first consumer is the temperature HACCP report (owner TODO 2026-10-19: "document sending through the WhatsApp
connection, with a temporary link and/or an attached HTML report").

    table      outbound_documents (migration 0128): a SNAPSHOT of the bytes (what is downloaded is exactly what was
               sent; its sha256 is kept and served as X-Document-Digest), at most MAX_BYTES each and LIVE_TOTAL_MAX for all live ones
    token      links.derive_token(module key, document id, 1, domain="doc") - derived, never stored; only sha256(token) is kept (UNIQUE:
               the public listener's ONE indexed lookup). The domain means a ticket / RFQ / consent token can never be a document token
    link       `<public base>/<prefix>/#d.<token>`: the token rides in the fragment (never sent to a server, never in a proxy log); the
               page sends it in X-Ticket-Token like every link
    live       documents switched on (`reports.documents`), not revoked, not purged, not expired (`reports.document_hours`, at most 7
               days), downloads left (`reports.document_max_opens`), its key still known. Anything else is the uniform 404
    end        revoke (manual / the contact's number changed / erased / a failed send / the source cancelled); the janitor drops the
               bytes at expiry or revocation and the row 90 days later

Off by default: `reports.documents` is false, and minting is refused (`document_page_missing`) until the public page's `#d.` mode ships
(PAGE_READY) - no link that opens an empty page can leave. Nothing here logs, audits or returns a token, a URL or the bytes' content."""
from __future__ import annotations

import datetime as dt
import hashlib
import re
import secrets
import sqlite3
from typing import Any, Mapping

from ...audit import audit
from . import handler_links, links, settings_doc

UTC = dt.timezone.utc
TOKEN_DOMAIN = "doc"
URL_MARK = "d."  # `#d.<token>` - '.' is not a base64url character, so a document fragment is never a ticket token
MAX_BYTES = 2 * 1024 * 1024  # also the table CHECK
LIVE_TOTAL_MAX = 64 * 1024 * 1024
HOURS_CEILING = 168
KEEP_ROWS = dt.timedelta(days=90)
# DOCLINKSEC-295 M-02 (security review 2026-10-23): the MINT-time allow-list is PDF only - the approved scope of the first consumer (the
# temperature HACCP report). HTML stays out until a consumer exists and passes its own review: the HTML check below is a regex tripwire,
# not a sanitizer, and a saved .html opens from the device with full script. The table CHECK, the filename pattern, `_check_content`'s HTML
# branch and the serving code still know `text/html` (a row minted before this change is served as opaque bytes; reinstating is one line).
MEDIA_TYPES = {"application/pdf": ".pdf"}
REVOKE_REASONS = ("manual", "contact_changed", "contact_erased", "module_key", "send_failed", "source_cancelled")
_FILENAME = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,75}\.(?:pdf|html)")
_MODULE = re.compile(r"[a-z_]{1,32}")
# an HTML report must be self-contained and inert: no script, no frame / object, no form, no meta refresh, nothing fetched from the network.
# FABLEFIX-295 D-01 (Fable review 2026-10-21): this is a TRIPWIRE, not a sanitizer. Every HTML producer escapes every interpolated
# value with `escape_text` (which also encodes `=`, `:`, `(`, `&`, `<` ... so escaped text never trips these rules) and ships a unit
# test with hostile names; the file is handed over as application/octet-stream (public_documents.FILE_MEDIA_TYPE). Hardened against:
# inline event handlers, entity-encoded / whitespace-split schemes, data:image/svg+xml, formaction, srcdoc, any <meta> but charset /
# viewport, CSS expression() / behavior / -moz-binding / escapes in url(), SVG animation of attributes.
_WS = r"[\s\x00]*"
_COLON = r"(?::|&#0*58;?|&#x0*3a;?|&colon;)"
_URL_ATTRS = r"(?:src|href|action|formaction|poster|srcset|background|data|codebase|cite|longdesc|manifest|ping|to|from|values|by)"
_SAFE_DATA_IMAGE = r"data:image/(?:png|jpe?g|gif|webp|bmp)[;,]"
_HTML_FORBIDDEN = re.compile(
    r"(?is)<\s*/?\s*(?:script|iframe|frame|frameset|object|embed|applet|form|base|link|portal|noscript|template|math|animate\w*|set|handler|listener)\b"
    # a scheme that runs code, its letters possibly split by whitespace / NUL (an entity-encoded colon is caught inside a URL attribute
    # below; in text content `escape_text` output such as `javascript&#58;` is inert and must stay acceptable)
    + r"|(?:j" + _WS + "a" + _WS + "v" + _WS + "a|v" + _WS + "b)" + _WS
    + "s" + _WS + "c" + _WS + "r" + _WS + "i" + _WS + "p" + _WS + "t" + _WS + ":"
    # inline event handlers (`<img onerror=`, `<svg/onload=`, `"onfocus=`)
    + r"|[\s/\"'`;]on[a-z]+[\s\x00]*="
    + r"|\b(?:formaction|srcdoc|attributename|xlink:actuate)\s*="
    # a <meta> other than `<meta charset="utf-8">` / `<meta name="viewport" content="...">`
    + r"|<\s*meta\b(?!\s+charset\s*=\s*[\"']?utf-8[\"']?\s*/?>)(?!\s+name\s*=\s*[\"']?viewport[\"']?\s+content\s*=\s*\"[^\"<>&]*\"\s*/?>)"
    # a URL attribute: any scheme but a raster data: image, a protocol-relative address, or any entity / backslash in the value
    + r"|\b" + _URL_ATTRS + r"\s*=\s*[\"'`]?\s*(?!" + _SAFE_DATA_IMAGE + r")(?:[a-z][a-z0-9+.\s-]*" + _COLON + r"|[/\\]{2})"
    + r"|\b" + _URL_ATTRS + r"\s*=\s*[\"'`]?[^\"'`>\s]*?(?:&#|&[a-z]+;|\\)"
    # CSS: a fetched or scripted value
    + r"|url\(\s*[\"']?\s*(?!" + _SAFE_DATA_IMAGE + r")(?:[a-z][a-z0-9+.-]*:|[/\\]{2})|url\(\s*[\"']?\s*\\"
    + r"|@import|expression\s*\(|behavior\s*:|-moz-binding|image-set\s*\(")

_ESCAPE_KEEP = re.compile(r"[A-Za-z0-9 ]")


def escape_text(value: Any) -> str:
    """FABLEFIX-295 D-01 (a): the ONLY way an HTML producer interpolates operator / vendor / sensor text into a report. Every ASCII
    character other than a letter, a digit or a space becomes a numeric entity (so `<`, `>`, `&`, quotes, `=`, `:`, `(`, `/`, a
    backslash, tabs and newlines are all inert and can never trip `_HTML_FORBIDDEN`); non-ASCII text (Hebrew, Arabic, Russian) is kept."""
    text = "" if value is None else str(value)
    return "".join(ch if ord(ch) > 127 or _ESCAPE_KEEP.fullmatch(ch) else f"&#{ord(ch)};" for ch in text)

# PAGE_READY: the public page's `#d.` mode (frontend/src/public-ticket/doc/, a lazy chunk like the consent page) exists - minting is
# allowed once `reports.documents` is switched on (OFF by default; a Fable public-surface review is required before that in a release).
# Kept as a flag so a build without the page can refuse every mint (no link that opens an empty page may leave).
PAGE_READY = True


class DocumentRefused(ValueError):
    """`code` is a stable word; the message never carries a value."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def iso(at: dt.datetime) -> str:
    return at.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def _parse(value: Any) -> dt.datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)
    except ValueError:
        return None


def config(conn: sqlite3.Connection) -> dict[str, Any]:
    r = settings_doc.read(conn)["reports"]
    return {"enabled": bool(r["documents"]), "hours": min(int(r["document_hours"]), HOURS_CEILING), "max_opens": int(r["document_max_opens"])}


def _check_content(media_type: str, content: bytes) -> None:
    if not isinstance(content, (bytes, bytearray)) or not content:
        raise DocumentRefused("document_empty")
    if len(content) > MAX_BYTES:
        raise DocumentRefused("document_too_large")
    if media_type == "application/pdf":
        if not bytes(content[:5]) == b"%PDF-":
            raise DocumentRefused("document_type_mismatch")
        return
    try:
        text = bytes(content).decode("utf-8")
    except UnicodeDecodeError:
        raise DocumentRefused("document_type_mismatch") from None
    if _HTML_FORBIDDEN.search(text):
        raise DocumentRefused("document_html_unsafe")


def mint(conn: sqlite3.Connection, *, module: str, source_id: str | None, recipient_kind: str, recipient_id: str, media_type: str, filename: str,
         content: bytes, created_by: str | None, now: dt.datetime, hours: int | None = None, max_opens: int | None = None) -> dict[str, Any]:
    """Store one document under the current module key and return its row WITHOUT the content (the caller holds the write transaction).
    Refusals (stable codes): documents_off, document_page_missing, document_module, document_recipient, document_type, document_filename,
    document_empty, document_too_large, document_type_mismatch, document_html_unsafe, document_store_full, public_link_unavailable.
    TEMPLINK-295: a consumer with its own lifetime setting passes `hours` / `max_opens` (clamped to HOURS_CEILING and the table's 1..20); the
    others keep the `reports.*` values."""
    from .keyring import KEYS
    from .module_key import ModuleKeyError

    cfg = config(conn)
    if not cfg["enabled"]:
        raise DocumentRefused("documents_off")
    if hours is not None:
        cfg["hours"] = max(1, min(int(hours), HOURS_CEILING))
    if max_opens is not None:
        cfg["max_opens"] = max(1, min(int(max_opens), 20))
    if not PAGE_READY:
        raise DocumentRefused("document_page_missing")
    if not isinstance(module, str) or not _MODULE.fullmatch(module):
        raise DocumentRefused("document_module")
    if recipient_kind not in ("contact", "user") or not isinstance(recipient_id, str) or not recipient_id:
        raise DocumentRefused("document_recipient")
    if media_type not in MEDIA_TYPES:
        raise DocumentRefused("document_type")
    if not isinstance(filename, str) or not _FILENAME.fullmatch(filename) or not filename.endswith(MEDIA_TYPES[media_type]):
        raise DocumentRefused("document_filename")
    _check_content(media_type, content)
    live = conn.execute("SELECT COALESCE(SUM(size_bytes), 0) FROM outbound_documents WHERE purged_at IS NULL").fetchone()[0]
    if int(live) + len(content) > LIVE_TOTAL_MAX:
        raise DocumentRefused("document_store_full")
    try:
        key_id, key = KEYS.current(create=False)
    except ModuleKeyError:
        raise DocumentRefused("public_link_unavailable") from None
    doc_id = secrets.token_hex(16)
    token = links.derive_token(key, doc_id, 1, domain=TOKEN_DOMAIN)
    row = {"id": doc_id, "key_id": key_id, "token_hash": links.token_hash(token), "module": module, "source_id": source_id,
           "recipient_kind": recipient_kind, "recipient_id": recipient_id, "media_type": media_type, "filename": filename,
           "size_bytes": len(content), "sha256": hashlib.sha256(bytes(content)).hexdigest(), "max_opens": cfg["max_opens"],
           "created_by": created_by, "created_at": iso(now), "expires_at": iso(now + dt.timedelta(hours=cfg["hours"]))}
    conn.execute(f"INSERT INTO outbound_documents({', '.join(row)}, content) VALUES ({', '.join('?' * len(row))}, ?)",
                 (*row.values(), sqlite3.Binary(bytes(content))))
    audit(conn, actor=None, action="report.document.mint", decision="allowed", resource_type="outbound_document", resource_id=doc_id,
          details={"module": module, "source_id": source_id, "media_type": media_type, "size": len(content), "expires_at": row["expires_at"],
                   "max_opens": cfg["max_opens"]})
    return dict(row, open_count=0)


def row(conn: sqlite3.Connection, doc_id: str) -> dict[str, Any] | None:
    r = conn.execute("SELECT id, key_id, token_hash, module, source_id, recipient_kind, recipient_id, media_type, filename, size_bytes, sha256, "
                     "max_opens, open_count, first_opened_at, last_opened_at, created_by, created_at, expires_at, revoked_at, revoked_reason, purged_at "
                     "FROM outbound_documents WHERE id = ?", (doc_id,)).fetchone()
    return dict(r) if r else None


def _key_known(key_id: str) -> bool:
    from .keyring import KEYS

    try:
        KEYS.get(key_id)
    except Exception:  # noqa: BLE001 - a retired / lost key: the link derives nothing any more
        return False
    return True


def _live(conn: sqlite3.Connection, r: Mapping[str, Any] | None, now: dt.datetime) -> bool:
    if r is None or r["revoked_at"] or r["purged_at"]:
        return False
    expires = _parse(r["expires_at"])
    if expires is None or expires <= now.astimezone(UTC):
        return False
    if int(r["open_count"] or 0) >= int(r["max_opens"]):
        return False
    return config(conn)["enabled"] and _key_known(r["key_id"])


def is_live(conn: sqlite3.Connection, doc_id: str | None, now: dt.datetime) -> bool:
    return bool(doc_id) and _live(conn, row(conn, doc_id), now)  # type: ignore[arg-type]


def token_of(r: Mapping[str, Any]) -> str:
    """The token of a document row (derived again; never stored, never logged)."""
    from .keyring import KEYS

    return links.derive_token(KEYS.get(r["key_id"]), r["id"], 1, domain=TOKEN_DOMAIN)


def url(conn: sqlite3.Connection, r: Mapping[str, Any]) -> str:
    """`<base>/<prefix>/#d.<token>`. Raises links.PublicUrlError without a public address (the caller treats it as not live)."""
    token = token_of(r)
    return links.public_url(handler_links.public_base_url(conn), f"#{URL_MARK}{token}", handler_links.public_prefix(conn))


def lookup(conn: sqlite3.Connection, token_hash: str, now: dt.datetime) -> dict[str, Any] | None:
    """The live document of a presented token (ONE indexed read by token_hash), or None - one answer for every other case."""
    r = conn.execute("SELECT id FROM outbound_documents WHERE token_hash = ?", (token_hash,)).fetchone()
    found = row(conn, r[0]) if r else None
    return found if _live(conn, found, now) else None


def meta(r: Mapping[str, Any]) -> dict[str, Any]:
    """What the page shows before the download: no recipient, no module, no source."""
    return {"filename": r["filename"], "media_type": r["media_type"], "size": int(r["size_bytes"]), "expires_at": r["expires_at"],
            "opens_left": max(0, int(r["max_opens"]) - int(r["open_count"] or 0)), "digest": r["sha256"], "_id": r["id"]}


def open_file(conn: sqlite3.Connection, token_hash: str, now: dt.datetime) -> tuple[dict[str, Any], bytes] | None:
    """One download: compare-and-set on the open count (two parallel downloads of the last open: one wins). The caller holds the write
    transaction. None = the uniform 404."""
    r = lookup(conn, token_hash, now)
    if r is None:
        return None
    at = iso(now)
    cur = conn.execute("UPDATE outbound_documents SET open_count = open_count + 1, first_opened_at = COALESCE(first_opened_at, ?), last_opened_at = ? "
                       "WHERE id = ? AND open_count = ? AND open_count < max_opens AND purged_at IS NULL AND revoked_at IS NULL",
                       (at, at, r["id"], int(r["open_count"] or 0)))
    if cur.rowcount != 1:
        return None
    content = conn.execute("SELECT content FROM outbound_documents WHERE id = ?", (r["id"],)).fetchone()[0]
    if content is None:
        return None
    audit(conn, actor=None, action="report.document.open", decision="allowed", resource_type="outbound_document", resource_id=r["id"],
          details={"module": r["module"], "opens": int(r["open_count"] or 0) + 1, "max_opens": int(r["max_opens"])})
    return dict(r, open_count=int(r["open_count"] or 0) + 1), bytes(content)


def revoke(conn: sqlite3.Connection, doc_id: str, reason: str, now: dt.datetime) -> bool:
    if reason not in REVOKE_REASONS:
        raise ValueError("reason")
    return conn.execute("UPDATE outbound_documents SET revoked_at = ?, revoked_reason = ? WHERE id = ? AND revoked_at IS NULL",
                        (iso(now), reason, doc_id)).rowcount == 1


def revoke_recipient(conn: sqlite3.Connection, recipient_kind: str, recipient_id: str, reason: str, now: dt.datetime) -> int:
    """A contact's number / e-mail changed or the contact was erased: every document sent to them dies at once."""
    if reason not in REVOKE_REASONS:
        raise ValueError("reason")
    if conn.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'outbound_documents'").fetchone() is None:
        return 0  # a database before 0128
    return conn.execute("UPDATE outbound_documents SET revoked_at = ?, revoked_reason = ? WHERE recipient_kind = ? AND recipient_id = ? "
                        "AND revoked_at IS NULL", (iso(now), reason, recipient_kind, recipient_id)).rowcount


def revoke_sent_to_user(conn: sqlite3.Connection, user_id: str, reason: str, now: dt.datetime) -> int:
    """TEMPREPORT-2310 S2: a system user withdrew his WhatsApp opt-in or his number changed - every document that was SENT to his number
    (`recipient_kind` user with a `source_id`: one recipient inside a report send) dies at once. A link the user made himself in the report
    dialog (`source_id` NULL) never went to his number and is left alone."""
    if reason not in REVOKE_REASONS:
        raise ValueError("reason")
    if conn.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'outbound_documents'").fetchone() is None:
        return 0
    return conn.execute("UPDATE outbound_documents SET revoked_at = ?, revoked_reason = ? WHERE recipient_kind = 'user' AND recipient_id = ? "
                        "AND source_id IS NOT NULL AND revoked_at IS NULL", (iso(now), reason, user_id)).rowcount


def revoke_all_live(conn: sqlite3.Connection, reason: str, now: dt.datetime) -> int:
    """The module key rotation (spec 7.4): every document link still live dies with the old key, like every ticket and RFQ link."""
    if reason not in REVOKE_REASONS:
        raise ValueError("reason")
    if conn.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'outbound_documents'").fetchone() is None:
        return 0
    return conn.execute("UPDATE outbound_documents SET revoked_at = ?, revoked_reason = ? WHERE revoked_at IS NULL AND purged_at IS NULL",
                        (iso(now), reason)).rowcount


def purge(conn: sqlite3.Connection, now: dt.datetime) -> int:
    """The janitor: the bytes go at expiry / revocation / downloads used up; the row (ids, digest, counts) goes KEEP_ROWS after expiry."""
    at = iso(now)
    n = conn.execute("UPDATE outbound_documents SET content = NULL, purged_at = ? WHERE purged_at IS NULL "
                     "AND (expires_at <= ? OR revoked_at IS NOT NULL OR open_count >= max_opens)", (at, at)).rowcount
    n += conn.execute("DELETE FROM outbound_documents WHERE purged_at IS NOT NULL AND expires_at < ?", (iso(now - KEEP_ROWS),)).rowcount
    return n


def key_ids_in_use(conn: sqlite3.Connection) -> set[str]:
    return {r[0] for r in conn.execute("SELECT DISTINCT key_id FROM outbound_documents WHERE purged_at IS NULL AND revoked_at IS NULL").fetchall() if r[0]}


__all__ = ["DocumentRefused", "mint", "lookup", "open_file", "meta", "url", "token_of", "revoke", "revoke_recipient", "revoke_sent_to_user", "revoke_all_live", "purge",
           "is_live", "config",
           "PAGE_READY", "MAX_BYTES", "LIVE_TOTAL_MAX"]
