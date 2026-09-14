"""External go2rtc adapter (MASTER_SPEC ch. 21, ADR-011/ADR-013).

The product owns only streams whose name starts with `smplwise_`; everything else on the shared
go2rtc (intercom, other projects) is never listed as ours, modified or deleted. Source URLs carry the
NVR credentials and therefore never leave the server: they are written to go2rtc's API and nothing
else. Browser media goes through the add-on's WebSocket relay (see routers/media.py).
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from urllib.parse import quote, urlsplit, urlunsplit

import httpx

from ..config import Settings
from ..errors import ApiError

log = logging.getLogger("smplwise.go2rtc")
STREAM_PREFIX = "smplwise_"
NAME_RE = re.compile(r"^[A-Za-z0-9_.-]+$")


def stream_name(recorder_id: str, channel: int, profile: str) -> str:
    """Deterministic, readable and namespaced: smplwise_nvr-1_ch4_sub."""
    if profile not in ("main", "sub"):
        raise ValueError(profile)
    name = f"{STREAM_PREFIX}{recorder_id}_ch{channel}_{profile}"
    if not NAME_RE.match(name):
        raise ValueError(name)
    return name


def hikvision_rtsp_url(settings: Settings, channel: int, profile: str) -> str:
    """rtsp://user:pass@host:554/Streaming/Channels/<ch>01 (main) or <ch>02 (sub). Server-side only."""
    if not settings.nvr_host or not settings.nvr_user or not settings.nvr_password:
        raise ApiError(503, "source_not_configured", "פרטי ה־NVR לא הוגדרו בהגדרות ה־Add-on.")
    track = f"{channel}0{1 if profile == 'main' else 2}"
    return f"rtsp://{quote(settings.nvr_user, safe='')}:{quote(settings.nvr_password, safe='')}@{settings.nvr_host}:{settings.nvr_rtsp_port}/Streaming/Channels/{track}"


def redact_url(url: str) -> str:
    """rtsp://user:pass@host → rtsp://***@host (for logs and audit details)."""
    return re.sub(r"://[^/@\s]+:[^/@\s]+@", "://***@", url)


@dataclass
class StreamInfo:
    name: str
    sources: list[str]
    online: bool


class Go2rtc:
    def __init__(self, settings: Settings):
        if not settings.go2rtc_url:
            raise ApiError(503, "media_not_configured", "כתובת go2rtc לא הוגדרה בהגדרות ה־Add-on.")
        self.base = settings.go2rtc_url.rstrip("/")
        self.auth = (settings.go2rtc_user, settings.go2rtc_password) if settings.go2rtc_user else None

    def _client(self) -> httpx.Client:
        return httpx.Client(base_url=self.base, auth=self.auth, timeout=6.0)

    def _wrap(self, exc: httpx.HTTPError, what: str) -> ApiError:
        return ApiError(503, "media_unavailable", "go2rtc אינו זמין כרגע.", retryable=True, details={"op": what, "error": type(exc).__name__})

    def info(self) -> dict:
        with self._client() as c:
            try:
                r = c.get("/api")
            except httpx.HTTPError as exc:
                raise self._wrap(exc, "info") from exc
        if r.status_code != 200:
            raise ApiError(503, "media_error", "go2rtc החזיר שגיאה.", details={"status": r.status_code})
        try:
            return r.json()
        except ValueError:
            return {"raw": r.text[:200]}

    def list_streams(self) -> dict[str, StreamInfo]:
        with self._client() as c:
            try:
                r = c.get("/api/streams")
            except httpx.HTTPError as exc:
                raise self._wrap(exc, "list") from exc
        if r.status_code != 200:
            raise ApiError(503, "media_error", "go2rtc החזיר שגיאה.", details={"status": r.status_code})
        out: dict[str, StreamInfo] = {}
        data = r.json() or {}
        for name, value in data.items():
            producers = (value or {}).get("producers") or []
            sources = [p.get("url", "") for p in producers if isinstance(p, dict)]
            online = any(p.get("medias") or p.get("receivers") for p in producers if isinstance(p, dict))
            out[name] = StreamInfo(name=name, sources=sources, online=online)
        return out

    def ensure_stream(self, name: str, src: str) -> str:
        """Create or update one of our streams. Returns 'unchanged' | 'created' | 'updated'."""
        if not name.startswith(STREAM_PREFIX):
            raise ValueError("refusing to write a stream outside the smplwise_ namespace")
        streams = self.list_streams()
        existing = streams.get(name)
        if existing and existing.sources == [src]:
            return "unchanged"
        with self._client() as c:
            try:
                if existing:
                    c.delete("/api/streams", params={"src": name})
                r = c.put("/api/streams", params={"name": name, "src": src})
            except httpx.HTTPError as exc:
                raise self._wrap(exc, "put") from exc
        if r.status_code not in (200, 201, 204):
            raise ApiError(503, "media_error", "go2rtc סירב ליצור את הזרם.", details={"status": r.status_code, "stream": name})
        log.info("go2rtc stream %s %s (%s)", name, "updated" if existing else "created", redact_url(src))
        return "updated" if existing else "created"

    def delete_stream(self, name: str) -> None:
        if not name.startswith(STREAM_PREFIX):
            raise ValueError("refusing to delete a stream outside the smplwise_ namespace")
        with self._client() as c:
            try:
                c.delete("/api/streams", params={"src": name})
            except httpx.HTTPError as exc:
                raise self._wrap(exc, "delete") from exc

    def ws_url(self, name: str) -> str:
        parts = urlsplit(self.base)
        scheme = "wss" if parts.scheme == "https" else "ws"
        return urlunsplit((scheme, parts.netloc, "/api/ws", f"src={quote(name, safe='')}", ""))

    def ws_headers(self) -> dict[str, str]:
        if not self.auth:
            return {}
        import base64

        token = base64.b64encode(f"{self.auth[0]}:{self.auth[1]}".encode()).decode()
        return {"Authorization": f"Basic {token}"}
