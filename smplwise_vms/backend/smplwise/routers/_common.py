"""Request helpers every router used to copy (code review 2026-11-13, D5: `_rid` x108, `_raw_body` x11, `_is_json` x9, `_db` x15).

Routers import these under their old local names (`from ._common import rid as _rid`), so call sites, sibling imports and the
`dependency_overrides` keys tests use (`module._raw_body`) keep working unchanged. Only helpers whose bodies were identical in every
copy (compared by AST) live here; `_parse` and `_gate` differ per router and stay local.

Not a router: `main.py` mounts the modules it names, and this one has no `router` attribute."""
from __future__ import annotations

from fastapi import Request

from ..db import Database


def rid(request: Request) -> str | None:
    """The request's correlation id (set by the request-id middleware), for audit rows and error envelopes."""
    return getattr(request.state, "correlation_id", None)


async def raw_body(request: Request) -> bytes:
    """The request body, unparsed - a FastAPI dependency. Routes declare it AFTER their permission dependency (a read-connection
    gate) and BEFORE the write connection: an unauthorised caller gets the audited 403 whatever they sent, a body that is not JSON
    is the router's own audited refusal (its `_parse`), not FastAPI's bare 422, and a slow upload never holds SQLite's write lock
    (review L2 / L7; tests/test_raw_body_order.py)."""
    return await request.body()


def is_json(content_type: str | None) -> bool:
    """`application/json` or an `application/<x>+json` subtype, parameters (charset) ignored."""
    media = (content_type or "").split(";", 1)[0].strip().lower()
    return media == "application/json" or (media.startswith("application/") and media.endswith("+json"))


def db_of(request: Request) -> Database:
    """The application's database (for routes that open their own connections)."""
    return request.app.state.db
