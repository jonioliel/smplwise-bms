"""CR-028 phase 1: the cast relay - the ONLY unauthenticated listener of the add-on, on the optional port 18092/tcp.

A Google Cast receiver (a TV, a dongle) fetches the camera's HLS itself, on the LAN, without a session. It is handed
`http://<origin>/cast/<token>/index.m3u8` and nothing else: no recorder address, no credential, no go2rtc URL, no HA token.
This module serves exactly that shape and proxies it to go2rtc's HLS:

- the listener starts only when the add-on option `cast_relay` is on (config.yaml maps 18092/tcp to `null` by default, so
  nothing reaches it from the host until the owner maps a host port too - the CR-025 push-port pattern);
- `GET /cast/<token>/index.m3u8` -> go2rtc `/api/stream.m3u8?src=<the session's stream>&mp4`; the stream name is the one the
  server chose when the session started (always `smplwise_*`) - there is no stream-name parameter anywhere;
- `GET /cast/<token>/hls/{playlist.m3u8|segment.ts|init.mp4|segment.m4s}?id=<go2rtc session>&n=<number>` -> go2rtc
  `/api/hls/...`, but only for the go2rtc HLS session ids that THIS token's master playlist named (a token holder cannot read
  another HLS session of the shared go2rtc, e.g. the intercom's);
- every playlist go2rtc answers is checked line by line: a URI that is absolute, climbs (`..`), names another path or carries
  another query key is a 502 (nothing is passed through unchecked); bodies are capped;
- the token is looked up by its SHA-256 in an in-memory index the session service keeps (start / extend / switch / stop /
  expiry); an unknown, revoked or expired token is 403; a token that asks too fast is 429 (a TV, not a crowd) and a token that
  keeps hammering ends its session (`error`);
- only GET (and a bodiless OPTIONS for CORS: the Cast receiver page fetches cross-origin) - everything else is 405;
- the first segment served is the honest "playing" signal (callback to services/cast_sessions.py);
- `GET /cast/probe/<token>` answers 204 once for the administrator's origin self-check (cast_sessions.check_origin).

Never logged: the token, the full path, the stream name, the client's address."""
from __future__ import annotations

import hashlib
import logging
import re
import threading
import time
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Callable
from urllib.parse import parse_qsl, urlsplit

log = logging.getLogger("smplwise.cast")

CONTAINER_PORT = 18092
STREAM_PREFIX = "smplwise_"
TOKEN_RE = re.compile(r"^[0-9a-f]{32}$")
_PATH_RE = re.compile(r"^/cast/([0-9a-f]{32})/(index\.m3u8|hls/(playlist\.m3u8|segment\.ts|init\.mp4|segment\.m4s))$")
_PROBE_RE = re.compile(r"^/cast/probe/([0-9a-f]{32})$")
QUERY_KEYS = frozenset({"id", "n"})
_VALUE_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
HLS_FMP4 = True  # `&mp4`: fMP4 segments (go2rtc's "HLS/fMP4"); a TS-only receiver would need this off - verified in the first lab round
PLAYLIST_MAX = 64 * 1024
SEGMENT_MAX = 16 * 1024 * 1024
UPSTREAM_TIMEOUT_S = 15.0
# per token: playlists 2/s with a burst of 6, media (init + segments) 4/s with a burst of 24; this many refusals end the session
PLAYLIST_RATE = (2.0, 6.0)
MEDIA_RATE = (4.0, 24.0)
ABUSE_LIMIT = 60
PROBE_TTL_S = 30.0

CONTENT_TYPES = {"index.m3u8": "application/vnd.apple.mpegurl", "playlist.m3u8": "application/vnd.apple.mpegurl", "segment.ts": "video/mp2t",
                 "init.mp4": "video/mp4", "segment.m4s": "video/mp4"}
_MASTER_URI_RE = re.compile(r"^hls/playlist\.m3u8\?([^\s#]+)$")
_MEDIA_URI_RE = re.compile(r"^(segment\.ts|segment\.m4s|init\.mp4)\?([^\s#]+)$")
_URI_ATTR_RE = re.compile(r'URI="([^"]*)"')


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("ascii")).hexdigest()


class _Bucket:
    __slots__ = ("rate", "burst", "level", "at")

    def __init__(self, rate: float, burst: float) -> None:
        self.rate, self.burst, self.level, self.at = rate, burst, burst, time.monotonic()

    def take(self, now: float) -> bool:
        self.level = min(self.burst, self.level + (now - self.at) * self.rate)
        self.at = now
        if self.level >= 1.0:
            self.level -= 1.0
            return True
        return False


@dataclass
class Entry:
    """One live token: the session it belongs to, the stream it may read, until when (epoch s; None = permanent)."""
    session_id: str
    stream: str
    expires_at: float | None
    hls_ids: set[str] = field(default_factory=set)
    first_served: bool = False
    refused: int = 0
    last_fetch: float = 0.0
    playlists: _Bucket = field(default_factory=lambda: _Bucket(*PLAYLIST_RATE))
    media: _Bucket = field(default_factory=lambda: _Bucket(*MEDIA_RATE))


class Index:
    """token hash -> Entry; one per live session. Thread safe (the relay's handler threads read it, the session service writes)."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._by_hash: dict[str, Entry] = {}

    def put(self, token: str, session_id: str, stream: str, expires_at: float | None) -> None:
        if not stream.startswith(STREAM_PREFIX):
            raise ValueError("the cast relay serves smplwise_ streams only")
        with self._lock:
            for h in [h for h, e in self._by_hash.items() if e.session_id == session_id]:
                self._by_hash.pop(h, None)  # a switch: the previous token of this session dies with the new one's birth
            self._by_hash[token_hash(token)] = Entry(session_id, stream, expires_at)

    def set_expiry(self, session_id: str, expires_at: float | None) -> None:
        with self._lock:
            for e in self._by_hash.values():
                if e.session_id == session_id:
                    e.expires_at = expires_at

    def drop(self, session_id: str) -> None:
        with self._lock:
            for h in [h for h, e in self._by_hash.items() if e.session_id == session_id]:
                self._by_hash.pop(h, None)

    def clear(self) -> None:
        with self._lock:
            self._by_hash.clear()

    def lookup(self, token: str, now: float | None = None) -> Entry | None:
        h = token_hash(token)
        with self._lock:
            # looked up by the SHA-256 of the token: a timing difference of the dict says nothing about the token's own characters
            e = self._by_hash.get(h)
            if e is None:
                return None
            if e.expires_at is not None and (now or time.time()) >= e.expires_at:
                return None
            return e

    def sessions(self) -> set[str]:
        with self._lock:
            return {e.session_id for e in self._by_hash.values()}

    def last_fetch(self, session_id: str) -> float:
        with self._lock:
            return max((e.last_fetch for e in self._by_hash.values() if e.session_id == session_id), default=0.0)


INDEX = Index()
# set by services/cast_sessions.py: called once per token generation when its first segment was served / when it hammers the relay
ON_FIRST_SEGMENT: list[Callable[[str], None]] = []
ON_ABUSE: list[Callable[[str], None]] = []

_PROBES: dict[str, float] = {}
_PROBE_LOCK = threading.Lock()


def new_probe() -> str:
    """A one-use token for the origin self-check: `GET <origin>/cast/probe/<token>` answers 204 once within PROBE_TTL_S."""
    import secrets

    token = secrets.token_hex(16)
    now = time.time()
    with _PROBE_LOCK:
        for k in [k for k, t in _PROBES.items() if t < now]:
            _PROBES.pop(k, None)
        _PROBES[token] = now + PROBE_TTL_S
    return token


def _take_probe(token: str) -> bool:
    with _PROBE_LOCK:
        exp = _PROBES.pop(token, None)
    return exp is not None and exp >= time.time()


# ------------------------------------------------------------------------------------------------ the request (pure: tests drive it directly)


@dataclass
class Reply:
    status: int
    body: bytes = b""
    content_type: str | None = None


Fetch = Callable[[str, dict[str, str]], "tuple[int, bytes]"]


def _query(raw: str) -> dict[str, str] | None:
    """The query of a relay request as {key: value}, or None when it carries anything but `id` / `n` with plain values (once each)."""
    if not raw:
        return {}
    pairs = parse_qsl(raw, keep_blank_values=True, strict_parsing=False)
    out: dict[str, str] = {}
    for k, v in pairs:
        if k not in QUERY_KEYS or k in out or not _VALUE_RE.match(v):
            return None
        out[k] = v
    return out


def _uris(text: str) -> list[str]:
    """Every URI a playlist names: the plain lines and the URI="..." attributes of the tags."""
    out: list[str] = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith("#"):
            out.extend(_URI_ATTR_RE.findall(line))
        else:
            out.append(line)
    return out


def check_master(text: str) -> set[str] | None:
    """The go2rtc HLS session ids a master playlist names, or None when any URI in it is not `hls/playlist.m3u8?id=<id>`."""
    ids: set[str] = set()
    uris = _uris(text)
    if not uris:
        return None
    for uri in uris:
        m = _MASTER_URI_RE.match(uri)
        q = _query(m.group(1)) if m else None
        if q is None or "id" not in q or "n" in q:
            return None
        ids.add(q["id"])
    return ids


def check_media(text: str, ids: set[str]) -> bool:
    """A media playlist may name only `segment.ts|segment.m4s|init.mp4?id=<one of ids>[&n=<n>]` - relative, inside hls/."""
    for uri in _uris(text):
        m = _MEDIA_URI_RE.match(uri)
        q = _query(m.group(2)) if m else None
        if q is None or q.get("id") not in ids:
            return False
    return True


def handle(method: str, target: str, fetch: Fetch, *, index: Index | None = None, now: float | None = None) -> Reply:
    """One relay request: (method, request target as sent) -> Reply. `fetch(path, params)` asks go2rtc (status, body)."""
    index = index or INDEX
    if method == "OPTIONS":
        return Reply(204)
    if method != "GET":
        return Reply(405)
    try:
        parts = urlsplit(target)
    except ValueError:
        return Reply(404)
    if parts.scheme or parts.netloc or parts.fragment:
        return Reply(404)
    probe = _PROBE_RE.match(parts.path)
    if probe:
        return Reply(204) if not parts.query and _take_probe(probe.group(1)) else Reply(404)
    m = _PATH_RE.match(parts.path)
    if not m:
        return Reply(404)
    token, rest, hls_name = m.group(1), m.group(2), m.group(3)
    q = _query(parts.query)
    if q is None:
        return Reply(400)
    t = now if now is not None else time.time()
    entry = index.lookup(token, t)
    if entry is None:
        return Reply(403)
    if not entry.stream.startswith(STREAM_PREFIX):  # by construction never; checked again before anything is fetched
        return Reply(403)
    mono = time.monotonic()
    bucket = entry.playlists if rest == "index.m3u8" or hls_name == "playlist.m3u8" else entry.media
    if not bucket.take(mono):
        entry.refused += 1
        if entry.refused == ABUSE_LIMIT:
            for cb in ON_ABUSE:
                _safe(cb, entry.session_id)
        return Reply(429)
    entry.last_fetch = t
    if rest == "index.m3u8":
        if q:
            return Reply(400)
        params = {"src": entry.stream}
        if HLS_FMP4:
            params["mp4"] = ""
        status, body = fetch("/api/stream.m3u8", params)
        if status != 200:
            return Reply(502)  # go2rtc does not know / cannot open the stream: the TV gives up, the session shows "not confirmed"
        if len(body) > PLAYLIST_MAX:
            return Reply(502)
        ids = check_master(body.decode("utf-8", "replace"))
        if ids is None:
            log.warning("cast relay: go2rtc master playlist refused (unexpected URI) for session %s", entry.session_id[:8])
            return Reply(502)
        entry.hls_ids |= ids
        return Reply(200, body, CONTENT_TYPES["index.m3u8"])
    if q.get("id") not in entry.hls_ids:
        return Reply(403)
    if hls_name == "playlist.m3u8" and "n" in q:
        return Reply(400)
    status, body = fetch(f"/api/hls/{hls_name}", q)
    if status != 200:
        return Reply(404 if status == 404 else 502)
    if hls_name == "playlist.m3u8":
        if len(body) > PLAYLIST_MAX or not check_media(body.decode("utf-8", "replace"), entry.hls_ids):
            log.warning("cast relay: go2rtc media playlist refused (unexpected URI) for session %s", entry.session_id[:8])
            return Reply(502)
        return Reply(200, body, CONTENT_TYPES["playlist.m3u8"])
    if len(body) > SEGMENT_MAX:
        return Reply(502)
    if not entry.first_served and hls_name in ("segment.ts", "segment.m4s"):
        entry.first_served = True
        for cb in ON_FIRST_SEGMENT:
            _safe(cb, entry.session_id)
    return Reply(200, body, CONTENT_TYPES[hls_name])


def _safe(cb: Callable[[str], None], session_id: str) -> None:
    try:
        cb(session_id)
    except Exception:  # noqa: BLE001 - a bookkeeping failure never breaks the stream
        log.warning("cast relay callback failed", exc_info=True)


# ------------------------------------------------------------------------------------------------ go2rtc and the listener


def go2rtc_fetch(settings: Any) -> Fetch:
    """`fetch(path, params)` against the configured go2rtc (its API credentials stay here; nothing of the answer's headers is passed on)."""
    import httpx

    base = (settings.go2rtc_url or "").rstrip("/")
    auth = (settings.go2rtc_user, settings.go2rtc_password) if settings.go2rtc_user else None

    def fetch(path: str, params: dict[str, str]) -> tuple[int, bytes]:
        if not base:
            return 503, b""
        cap = PLAYLIST_MAX if path.endswith(".m3u8") else SEGMENT_MAX
        body = bytearray()
        try:
            with httpx.Client(base_url=base, auth=auth, timeout=UPSTREAM_TIMEOUT_S, follow_redirects=False) as c:
                with c.stream("GET", path, params=params) as r:
                    status = r.status_code
                    if status == 200:
                        for chunk in r.iter_bytes():
                            body += chunk
                            if len(body) > cap:
                                return 200, bytes(body)  # over the cap: the caller refuses it
        except httpx.HTTPError as exc:
            log.warning("cast relay: go2rtc unreachable (%s)", type(exc).__name__)
            return 503, b""
        return status, bytes(body)

    return fetch


class _Handler(BaseHTTPRequestHandler):
    server_version = "arx-cast"
    sys_version = ""
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args: Any) -> None:  # never the path (the token) or the client address
        return

    def _reply(self, r: Reply) -> None:
        self.send_response(r.status)
        self.send_header("Access-Control-Allow-Origin", "*")
        if r.status == 204 and self.command == "OPTIONS":
            self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
            self.send_header("Access-Control-Max-Age", "600")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if r.content_type:
            self.send_header("Content-Type", r.content_type)
        self.send_header("Content-Length", str(len(r.body)))
        self.end_headers()
        if self.command != "HEAD" and r.body:
            self.wfile.write(r.body)

    def _do(self) -> None:
        try:
            r = handle(self.command, self.path, self.server.fetch)  # type: ignore[attr-defined]
        except Exception:  # noqa: BLE001
            log.warning("cast relay request failed", exc_info=True)
            r = Reply(500)
        try:
            self._reply(r)
        except OSError:
            pass

    do_GET = _do
    do_OPTIONS = _do

    def do_POST(self) -> None:  # noqa: N802 - every other method is a 405, never read
        self.close_connection = True  # the unread body must never be taken for the next request on a kept-alive connection
        self._reply(Reply(405))

    do_PUT = do_DELETE = do_PATCH = do_HEAD = do_POST


class RelayServer:
    """The listener thread; `start` is a no-op when it already runs. Bound to every interface of the container: the host port
    mapping (owner's choice) decides whether anything outside reaches it."""

    def __init__(self) -> None:
        self._server: ThreadingHTTPServer | None = None
        self._thread: threading.Thread | None = None
        self.port: int | None = None
        self.error: str | None = None

    @property
    def running(self) -> bool:
        return self._server is not None

    def start(self, fetch: Fetch, host: str = "0.0.0.0", port: int = CONTAINER_PORT) -> bool:
        if self._server is not None:
            return True
        try:
            server = ThreadingHTTPServer((host, port), _Handler)
        except OSError as exc:
            self.error = type(exc).__name__
            log.warning("cast relay could not listen on port %s: %s", port, self.error)
            return False
        server.daemon_threads = True
        server.fetch = fetch  # type: ignore[attr-defined]
        self._server, self.port, self.error = server, server.server_address[1], None
        self._thread = threading.Thread(target=server.serve_forever, name="cast-relay", daemon=True)
        self._thread.start()
        log.info("cast relay listening on container port %s", self.port)
        return True

    def stop(self) -> None:
        server, self._server = self._server, None
        if server is not None:
            server.shutdown()
            server.server_close()
        self.port = None


SERVER = RelayServer()
