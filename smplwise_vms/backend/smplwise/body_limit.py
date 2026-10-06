"""Request body size limits, enforced while the body streams - before anything is parsed or spooled.

Round-10 §6.1 / CR-008 §9 open item (closed 2026-09-30). The routes' own limits (`max_upload_bytes`, catalog
IMAGE_MAX_BYTES, the backup upload's MAX_UPLOAD, the skins control image) were checked only after Starlette had spooled
the whole multipart body to a temporary file - FastAPI reads a form body BEFORE it runs the route's dependencies, so even
the authentication came after the spool. A huge upload filled the temp disk before the 413, and on the internet-facing
remote channel (`/arx`) that was reachable by any signed-in user and, on the unauthenticated routes, by anyone.

This pure ASGI middleware sits directly inside remote_channel.RemoteChannel (so it sees the channel and the stripped
headers, and its 413 carries the remote security headers) and outside everything else:

- a `Content-Length` above the route's limit is answered 413 before a single body byte is read;
- a body without one (chunked) is counted message by message; the message that crosses the limit is never handed on,
  the application gets an error from `receive()` (a multipart parse then closes the files it spooled), and whatever the
  application answers is replaced by the 413;
- the 413 is the project's error envelope (`payload_too_large`, details.max_bytes, details.stage = "request_body") with
  `Connection: close`, so the server drops the rest of the upload instead of reading it;
- WebSockets and lifespan pass through untouched; responses (streaming, the media relay's) are only watched for their
  start, never buffered.

The limits (LIMITS below; docs/changes/CR-008-ARX-REMOTE-APP.md §9 has the table):
- every route: 1 MiB (JSON bodies of the API are far below it);
- the upload routes: their own cap + 64 KiB of multipart framing - plan files (`max_upload_bytes`), site / building
  images (catalog.IMAGE_MAX_BYTES), the skins control image (skins store CONTROL_MAX_BYTES), the backup upload (backup
  MAX_UPLOAD), the plan package preview / import (plan_package.MAX_PACKAGE_BYTES); evidence bundles (verify / import): the ceiling of the `cases.import_max_mb` setting - those two routes
  stream the body themselves after authorising the caller and stop at the configured value while it streams;
- large JSON documents: the Plan Studio geometry document and a detection acceptance 16 MiB, a catalog import 8 MiB;
- the CSP report sink 16 KiB (its own streaming bound, routers/remote.CSP_BODY_MAX).
The rule is looked up on the path the router will match (the scope's path minus its root_path: RemoteChannel's remote
prefix), in its own spelling AND canonicalised (percent escapes decoded, repeated slashes collapsed, dot segments
resolved, no trailing slash); the STRICTEST of the two applies, so no odd spelling gets a larger limit than the route has
nor escapes a tight one (the CSP sink, the sign-in paths).
On the remote channel, the paths that need no sign-in (`auth/session`, `auth/remote-config`, `/.well-known/...`) take
4 KiB, and a request that names no live session (no Arx cookie of a session this process knows, no bearer token of a
known bearer session - services/ha_user_auth.holds_live_credential, memory only) takes at most 64 KiB on any path: an
anonymous caller cannot make the add-on spool an upload at all. A bearer client's first request therefore stays small
(its token becomes a known bearer session on that request)."""
from __future__ import annotations

import json
import re
import uuid
from functools import lru_cache
from typing import Any, Callable
from urllib.parse import unquote

from .config import Settings
from .remote_channel import CHANNEL_KEY, REMOTE

KiB = 1024
MiB = 1024 * 1024
MULTIPART_SLACK = 64 * KiB  # boundaries, part headers and the small form fields next to the file
DEFAULT_MAX = 1 * MiB
LARGE_JSON_MAX = 16 * MiB
CATALOG_IMPORT_MAX = 8 * MiB
REMOTE_PUBLIC_MAX = 4 * KiB
REMOTE_ANONYMOUS_MAX = 64 * KiB
STAGE = "request_body"


class BodyTooLarge(Exception):
    """Raised from receive() to the application when the body crossed its limit; never reaches a client."""


def _cases_ceiling() -> int:
    """The largest value the `cases.import_max_mb` setting accepts (its validator's `le`), in bytes."""
    return _cases_ceiling_mb() * MiB + MULTIPART_SLACK


@lru_cache(maxsize=1)
def _cases_ceiling_mb() -> int:
    from .routers.settings import SettingsPatch

    for m in SettingsPatch.model_fields["cases_import_max_mb"].metadata:
        le = getattr(m, "le", None)
        if le is not None:
            return int(le)
    return 4096


def _plan_upload(s: Settings) -> int:
    return s.max_upload_bytes + MULTIPART_SLACK


def _catalog_image(_s: Settings) -> int:
    from .routers import catalog

    return catalog.IMAGE_MAX_BYTES + MULTIPART_SLACK


def _floor_image(_s: Settings) -> int:
    from .services import floor_images

    return floor_images.MAX_BYTES + MULTIPART_SLACK


def _control_image(_s: Settings) -> int:
    from .services.skins import store

    return store.CONTROL_MAX_BYTES + MULTIPART_SLACK


def _backup_upload(_s: Settings) -> int:
    from .services import backup

    return backup.MAX_UPLOAD + MULTIPART_SLACK


def _csp_report(_s: Settings) -> int:
    from .routers import remote

    return remote.CSP_BODY_MAX


def _plan_package(_s: Settings) -> int:
    from .services import plan_package

    return plan_package.MAX_PACKAGE_BYTES + MULTIPART_SLACK


def _const(n: int) -> Callable[[Settings], int]:
    return lambda _s: n


_ID = r"[^/]+"
# (methods, path under /api/v1 as a full-match pattern, limit, name). The first match wins; everything else: DEFAULT_MAX.
LIMITS: list[tuple[frozenset[str], re.Pattern[str], Callable[[Settings], int], str]] = [
    (frozenset({"POST"}), re.compile(rf"/api/v1/floors/{_ID}/plan-assets"), _plan_upload, "plan_upload"),
    (frozenset({"POST"}), re.compile(rf"/api/v1/(sites|buildings)/{_ID}/image"), _catalog_image, "catalog_image"),
    (frozenset({"POST"}), re.compile(rf"/api/v1/floors/{_ID}/skins/control-image"), _control_image, "skins_control_image"),
    (frozenset({"POST"}), re.compile(rf"/api/v1/floors/{_ID}/images"), _floor_image, "floor_image"),
    (frozenset({"POST"}), re.compile(r"/api/v1/backups/upload"), _backup_upload, "backup_upload"),
    (frozenset({"POST"}), re.compile(r"/api/v1/cases/bundles/(verify|import)"), lambda _s: _cases_ceiling(), "evidence_bundle"),
    (frozenset({"PUT"}), re.compile(rf"/api/v1/plan-versions/{_ID}/geometry"), _const(LARGE_JSON_MAX), "geometry_document"),
    (frozenset({"POST"}), re.compile(rf"/api/v1/plan-versions/{_ID}/detect/accept"), _const(LARGE_JSON_MAX), "detection_accept"),
    (frozenset({"POST"}), re.compile(rf"/api/v1/plan-versions/{_ID}/package/(preview|import)"), _plan_package, "plan_package"),
    (frozenset({"POST"}), re.compile(r"/api/v1/catalog/import"), _const(CATALOG_IMPORT_MAX), "catalog_import"),
    (frozenset({"POST"}), re.compile(r"/api/v1/csp-report"), _csp_report, "csp_report"),
]

# the remote channel's paths that need no sign-in (routers/remote.py, the static /.well-known files)
REMOTE_PUBLIC = re.compile(r"/api/v1/auth/(session|remote-config|app-download)|/\.well-known/.*")


def route_limit(method: str, path: str, settings: Settings) -> tuple[int, str]:
    for methods, pattern, limit, name in LIMITS:
        if method in methods and pattern.fullmatch(path):
            return limit(settings), name
    return DEFAULT_MAX, "default"


def routed_path(scope: dict[str, Any]) -> str:
    """The path Starlette's router will match: the scope's `path` with the `root_path` stripped (the routing scope state -
    RemoteChannel sets root_path to the remote prefix, so the limit follows the very path the routes see, not a second
    string parse of the raw one; the same rule as starlette._utils.get_route_path)."""
    path: str = scope.get("path") or "/"
    root = scope.get("root_path") or ""
    if root and path.startswith(root):
        if path == root:
            return ""
        if path[len(root)] == "/":
            return path[len(root):]
    return path


def canonical_path(path: str) -> str:
    """The spelling a limit rule is judged on beside the routed one: percent escapes decoded (repeatedly - a doubly encoded
    slash is still a slash to a proxy in front), repeated slashes collapsed, dot segments resolved, no trailing slash.
    A request spelled oddly (`/api/v1//backups/upload/`, `/api/v1/backups/%75pload`, `.../x/../backups/upload`) is not
    routed to a route with a larger limit than its canonical spelling has: the STRICTEST of the two spellings applies."""
    for _ in range(3):
        decoded = unquote(path)
        if decoded == path:
            break
        path = decoded
    out: list[str] = []
    for seg in path.split("/"):
        if seg in ("", "."):
            continue
        if seg == "..":
            if out:
                out.pop()
            continue
        out.append(seg)
    return "/" + "/".join(out)


def _spellings(path: str) -> list[str]:
    canon = canonical_path(path)
    return [path] if canon == path else [path, canon]


def limit_for(scope: dict[str, Any], settings: Settings) -> tuple[int, str]:
    """(max body bytes, rule name) of one HTTP request."""
    method = (scope.get("method") or "GET").upper()
    remote = (scope.get("state") or {}).get(CHANNEL_KEY) == REMOTE
    path = routed_path(scope)
    if remote:
        prefix = settings.remote_path
        if not (scope.get("root_path") or "") and path.startswith(prefix + "/"):
            path = path[len(prefix):]  # a scope that carries the whole path (no root_path): strip the prefix ourselves
    spellings = _spellings(path)
    if remote and any(REMOTE_PUBLIC.fullmatch(p) for p in spellings):
        return REMOTE_PUBLIC_MAX, "remote_public"
    limit, name = min((route_limit(method, p, settings) for p in spellings), key=lambda r: r[0])
    if remote and limit > REMOTE_ANONYMOUS_MAX:
        from starlette.requests import HTTPConnection

        from .services.ha_user_auth import holds_live_credential

        if not holds_live_credential(settings, HTTPConnection(scope)):
            return REMOTE_ANONYMOUS_MAX, "remote_anonymous"
    return limit, name


def _declared_length(headers: list[tuple[bytes, bytes]]) -> int | None:
    for k, v in headers:
        if k.lower() == b"content-length":
            try:
                return int(v.decode("latin-1").strip())
            except ValueError:
                return None
    return None


def _size(n: int) -> str:
    return f"{n / MiB:.0f} MB" if n >= MiB else f"{max(1, n // KiB)} KB"


def _correlation(headers: list[tuple[bytes, bytes]]) -> str:
    for k, v in headers:
        if k.lower() == b"x-correlation-id":
            return v.decode("latin-1")[:64]
    return uuid.uuid4().hex[:12]


async def refuse(send, scope: dict[str, Any], limit: int, rule: str) -> None:
    cid = _correlation(list(scope.get("headers") or []))
    body = json.dumps({"code": "payload_too_large", "user_message": f"הבקשה גדולה מהמותר ({_size(limit)}).", "retryable": False,
                       "correlation_id": cid, "details": {"max_bytes": limit, "stage": STAGE, "rule": rule}},
                      ensure_ascii=False).encode("utf-8")
    await send({"type": "http.response.start", "status": 413,
                "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode()),
                            (b"connection", b"close"), (b"x-correlation-id", cid.encode("latin-1"))]})
    await send({"type": "http.response.body", "body": body})


class BodyLimit:
    def __init__(self, app, settings: Settings) -> None:
        self.app = app
        self.settings = settings

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        limit, rule = limit_for(scope, self.settings)
        declared = _declared_length(list(scope.get("headers") or []))
        if declared is not None and declared > limit:
            await refuse(send, scope, limit, rule)  # not one body byte read
            return
        received = 0
        tripped = False
        started = False

        async def limited_receive():
            nonlocal received, tripped
            if tripped:
                return {"type": "http.disconnect"}
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body") or b"")
                if received > limit:
                    tripped = True
                    raise BodyTooLarge(rule)
            return message

        async def guarded_send(message) -> None:
            nonlocal started
            if tripped:
                return  # the application's answer to a cut body (a 400, a 500) is replaced by the 413 below
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, limited_receive, guarded_send)
        except Exception:
            if not tripped:
                raise
        if tripped and not started:
            await refuse(send, scope, limit, rule)


def install(app, settings: Settings) -> None:
    """Call BEFORE remote_channel.install: add_middleware puts the last one outermost, so RemoteChannel wraps this."""
    app.add_middleware(BodyLimit, settings=settings)
