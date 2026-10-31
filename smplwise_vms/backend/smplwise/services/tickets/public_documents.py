"""CR-VENDORQ-294 (docs/changes/CR-VENDORQ-294-DESIGN.md section 5): a document sent by a temporary link - its two routes on the public
listener (services/tickets/out_documents.py has the rules; the edge's ROUTES carry their kinds and limits). Added to public_app through
`PublicDeps.extra_routers`.

- `GET /t/api/doc`      - what the page shows before the download: the file name, type, size, expiry, downloads left and the digest. No
                          recipient, no module, no source. Unknown / expired / revoked / used-up / purged token, documents switched off,
                          the key gone, or no token: the uniform 404.
- `GET /t/api/doc/file` - the bytes, as a DOWNLOAD (`attachment`, the exact type for a PDF and application/octet-stream for HTML, `nosniff`, `private, no-store`, the digest in
                          X-Document-Digest); every download counts one against `max_opens` (compare-and-set: the last download is won
                          once). The edge replaces any route CSP with the listener's `default-src 'none'; ...` (at least as strict as
                          `sandbox` for a download).

The token travels in the `X-Ticket-Token` HEADER (`#d.<token>` stays in the page's fragment; a cross-site request cannot set the header and
the listener sends no CORS headers). The rate: the edge's token kinds - `token_read` for the metadata, `file_read` for the bytes (per-token
windows, failure caps per client network and installation-wide). Nothing here logs a token, a name of a person or a number.

THE PAGE (the `#d.` mode of the public bundle) IS NOT BUILT in this slice; out_documents.PAGE_READY keeps minting refused until it is."""
from __future__ import annotations

import datetime as dt
import logging
import urllib.parse
from typing import Any, Callable

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response
from starlette.concurrency import run_in_threadpool

from ...db import Database
from . import out_documents as D
from .public_app import PublicError, public_request

log = logging.getLogger("smplwise.tickets.public.documents")
UTC = dt.timezone.utc
META_ROUTE = "/t/api/doc"
FILE_ROUTE = "/t/api/doc/file"
# FABLEFIX-295 D-01 (c) / D-02: an HTML document is handed over as opaque bytes - no browser or in-app WebView ever renders it from the
# link (the `.html` file name and the `attachment` disposition still save it as a report). A PDF keeps its own type.
FILE_MEDIA_TYPE = "application/octet-stream"
# PUBSURF-2310 (DOCLINKS review 2026-10-23 P4, belt): every document URL is ONE URL for every token, so a CDN that stored an answer would hand
# one recipient's file to the next request. Besides the origin's `private, no-store`, tell a CDN explicitly (RFC 9213 + Cloudflare's own
# header). A belt only: the Cloudflare bypass rule (docs/security/DOCLINKS_CLOUDFLARE_CACHE_RULE.md) must still be verified live.
CDN_NO_STORE = {"CDN-Cache-Control": "no-store", "Cloudflare-CDN-Cache-Control": "no-store"}


def file_media_type(media_type: str) -> str:
    return media_type if media_type == "application/pdf" else FILE_MEDIA_TYPE


def download_headers(r: dict[str, Any]) -> dict[str, str]:
    name = r["filename"]  # already [A-Za-z0-9._-] (mint): the ASCII name is the name
    return {"Content-Disposition": f"attachment; filename=\"{name}\"; filename*=UTF-8''{urllib.parse.quote(name, safe='')}",
            "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store", "X-Document-Digest": r["sha256"], **CDN_NO_STORE}


def page_brand(conn: Any) -> dict[str, Any]:
    """The organisation the page names (the public pages' name and logo) and the look - never a person."""
    from . import brand, settings_doc

    pub = brand.public_brand(conn)
    return {"organization": pub.get("organization") or "", "logo": pub.get("logo"), "theme": settings_doc.read(conn)["public"].get("theme", "light")}


def build_router(db: Database, *, clock: Callable[[], float] | None = None) -> APIRouter:
    r = APIRouter()

    def now() -> dt.datetime:
        t = clock() if clock is not None else dt.datetime.now(UTC).timestamp()
        return dt.datetime.fromtimestamp(t, UTC)

    def token_hash(request: Request) -> str:
        pr = public_request(request)
        if pr.token_hash is None or pr.token_key is None:
            raise PublicError(404, "link_unavailable")
        return pr.token_hash

    @r.get(META_ROUTE)
    async def doc_meta(request: Request) -> JSONResponse:
        th = token_hash(request)

        def read() -> dict[str, Any] | None:
            with db.connection(mode="read", label="tickets.public.doc.meta") as conn:
                found = D.lookup(conn, th, now())
                return dict(D.meta(found), **page_brand(conn)) if found else None

        row = await run_in_threadpool(read)
        pr = public_request(request)
        if row is None:
            pr.cost.unknown()
            raise PublicError(404, "link_unavailable")
        pr.cost.proved(row.pop("_id"))
        return JSONResponse(row, headers={"Cache-Control": "no-store", **CDN_NO_STORE})

    @r.get(FILE_ROUTE)
    async def doc_file(request: Request) -> Response:
        th = token_hash(request)

        def take() -> tuple[dict[str, Any], bytes] | None:
            with db.connection(label="tickets.public.doc.file") as conn:
                return D.open_file(conn, th, now())

        got = await run_in_threadpool(take)
        pr = public_request(request)
        if got is None:
            pr.cost.unknown()
            raise PublicError(404, "link_unavailable")
        row, content = got
        pr.cost.proved(row["id"])
        return Response(content, media_type=file_media_type(row["media_type"]), headers=download_headers(row))

    return r
