"""The `smplwise_bridge.stream_source` service (bridge 0.3.1): a signed, READ-ONLY question "what is the stream source of this
camera entity?", asked by the add-on for ONE camera the owner explicitly chose to show as live video
(docs/design/CAMERA_CARD_HA_SOURCE.md, option (b)).

The answer is the URL Home Assistant's own camera API reports (`camera.async_get_stream_source`, in-process; nothing is
fetched over the network from here). Such a URL routinely carries the camera's credentials (`rtsp://user:pass@host/...`), so:

- the URL is returned ONLY in the service response to the add-on, which puts it into go2rtc's source and nowhere else;
- it is never logged, never put in an exception text, never echoed in an error, never stored here;
- every refusal is a fixed code or an exception CLASS NAME; a url-bearing exception text is never forwarded;
- only a plain streaming scheme is accepted (rtsp / rtsps / http / https), no whitespace, control character or `#` (go2rtc
  reads `exec:`, `ffmpeg:` and `#option` sources as instructions - a value like that is refused, not passed on), at most
  MAX_SOURCE_LEN characters; anything else is `source_not_supported`;
- a source is device-controlled data (an ONVIF answer, say), not the owner's word: it must not point go2rtc back at itself or at
  the host it runs on - loopback / unspecified / link-local / multicast hosts in any spelling (`127.1`, `0x7f.1`, `2130706433`,
  `[::ffff:127.0.0.1]`), `localhost`, a query with a `src` or `name` key, an http(s) path under `/api` on port 1984 - is
  `source_not_allowed`. Private LAN addresses stay allowed: cameras live there. The add-on adds go2rtc's own host on top.

The order of the checks: signature / replay window -> the shape of the request -> rate limit -> active HA administrator
(a raw camera source is a credential; Home Assistant itself shows it to nobody but the administrator) -> the entity is a
camera that exists -> the read (bounded by a timeout) -> the shape of the answer. Fails closed at every step.

Kept apart from `__init__.py` so it can be tested without Home Assistant installed: Home Assistant is imported lazily
(`_ha()`), everything else is duck-typed."""
from __future__ import annotations

import asyncio
import ipaddress
import logging
import posixpath
import re
import time
from collections import deque
from types import SimpleNamespace
from typing import Any, Mapping
from urllib.parse import parse_qsl, unquote, urlsplit

_LOGGER = logging.getLogger(__name__)

ENTITY_RE = re.compile(r"^camera\.[a-z0-9_]{1,100}$")
ALLOWED_SCHEMES = ("rtsp://", "rtsps://", "http://", "https://")
MAX_SOURCE_LEN = 2048
READ_TIMEOUT_S = 10.0
RATE_WINDOW_S = 60.0
RATE_MAX = 60  # all cameras together, per window
RATE_MAX_PER_ENTITY = 4  # one camera: a failing one cannot use up the budget of the others
_BAD_CHARS_RE = re.compile(r"[\s\x00-\x1f\x7f#]")
REQUEST_KEYS = frozenset({"user_id", "entity_id", "request_id", "ts", "nonce", "sig"})

_calls: deque[float] = deque()
_calls_by_entity: dict[str, deque[float]] = {}


def _refuse(msg: Mapping[str, Any], error: str) -> dict[str, Any]:
    request_id = msg.get("request_id")
    return {"ok": False, "request_id": request_id if isinstance(request_id, str) else None, "error": error}


def _ha() -> SimpleNamespace:
    """Home Assistant's camera API, imported on first use so this module imports without Home Assistant (unit tests
    monkeypatch this function). `get_stream_source(hass, entity_id)` is an awaitable returning the source URL or None."""
    from homeassistant.components import camera as camera_component

    getter = getattr(camera_component, "async_get_stream_source", None)
    if getter is None:  # a core that keeps it on the entity only

        async def getter(hass: Any, entity_id: str) -> str | None:  # type: ignore[misc]
            return await camera_component.get_camera_from_entity_id(hass, entity_id).stream_source()

    return SimpleNamespace(get_stream_source=getter)


_NUMERIC_HOST_RE = re.compile(r"^[0-9xX.]+$")
_IPV4_PART_RE = re.compile(r"^(0[xX][0-9a-fA-F]+|[0-9]+)$")
_DEFAULT_PORTS = {"rtsp": 554, "rtsps": 322, "http": 80, "https": 443}
GO2RTC_PORTS = frozenset({1984, 8554, 8555})  # go2rtc's API / RTSP restream / WebRTC: never a camera's
FORBIDDEN_QUERY_KEYS = frozenset({"src", "name"})  # go2rtc's own API takes its source and stream name from these


def _ipv4_literal(host: str) -> ipaddress.IPv4Address | None:
    """An IPv4 address in any spelling the C library (and so go2rtc's resolver) accepts - `127.1`, `2130706433`, `0x7f.1`,
    `017700000001` - or None when `host` is not such a literal (inet_aton rules: 1-4 parts, decimal / 0x hex / leading-0 octal,
    the last part fills the remaining bytes)."""
    parts = host.split(".")
    if not 1 <= len(parts) <= 4 or not all(_IPV4_PART_RE.match(p) for p in parts):
        return None
    nums: list[int] = []
    for p in parts:
        try:
            nums.append(int(p, 16) if p[:2].lower() == "0x" else int(p, 8) if len(p) > 1 and p[0] == "0" else int(p))
        except ValueError:  # `08`: not octal
            return None
    head, last = nums[:-1], nums[-1]
    if any(h > 255 for h in head) or last >= 256 ** (4 - len(head)):
        return None
    value = 0
    for h in head:
        value = value * 256 + h
    return ipaddress.IPv4Address(value * 256 ** (4 - len(head)) + last)


def address_of(host: str) -> ipaddress.IPv4Address | ipaddress.IPv6Address | None:
    """`host` as an address when it is a literal in ANY spelling (IPv4 in inet_aton forms, IPv6 with brackets / a zone / an
    embedded or mapped IPv4), else None (a name). The IPv4 an IPv6 form carries is returned as that IPv4."""
    h = host.strip("[]").split("%", 1)[0]
    try:
        ip: ipaddress.IPv4Address | ipaddress.IPv6Address | None = ipaddress.ip_address(h)
    except ValueError:
        ip = _ipv4_literal(h)
    if isinstance(ip, ipaddress.IPv6Address):
        if ip.ipv4_mapped is not None:
            return ip.ipv4_mapped
        if ip.packed[:12] == bytes(12) and ip.packed[12:] != bytes(4):  # ::a.b.c.d (IPv4-compatible)
            return ipaddress.IPv4Address(ip.packed[12:])
    return ip


def host_refused(host: str) -> bool:
    """A source host go2rtc must never be pointed at: `localhost`, a loopback / unspecified / link-local / multicast address (any
    spelling), 0.0.0.0/8, or something that looks like a numeric address but is not a valid one. Private LAN addresses are fine:
    cameras live there."""
    h = host.lower().rstrip(".")
    if h == "localhost" or h.endswith(".localhost"):
        return True
    ip = address_of(h)
    if ip is None:
        return bool(_NUMERIC_HOST_RE.match(h))  # `1.2.3.4.5`, `0x`, `08.1`: not a name, not an address - refused, not guessed at
    return ip.is_loopback or ip.is_unspecified or ip.is_link_local or ip.is_multicast or (ip.version == 4 and int(ip) >> 24 == 0)


def _api_path(path: str) -> bool:
    p = unquote(unquote(path)).lower()
    p = posixpath.normpath("/" + p.lstrip("/"))
    return p == "/api" or p.startswith("/api/")


def source_shape_error(value: Any, extra_hosts: Any = ()) -> str | None:
    """None when `value` may be handed to go2rtc, else the refusal code. Never includes the value.

    Beyond the scheme and the character checks, refused (`source_not_allowed`): a host go2rtc must not be pointed at (host_refused);
    a query with a `src` or `name` key, whatever the case or encoding (go2rtc's own API would take them as a source and a
    stream name); an http(s) source on port 1984 whose path is go2rtc's API (`/api...`); and - `extra_hosts`, a collection of
    (hosts, ports) pairs the caller knows are go2rtc itself (`hosts`: normalized addresses and lower-case names) - that host on those ports (its RTSP restream would show another
    project's streams)."""
    if not isinstance(value, str) or not value:
        return "no_stream_source"
    if len(value) > MAX_SOURCE_LEN or not value.isascii() or "\\" in value:
        return "source_not_supported"
    if _BAD_CHARS_RE.search(value) or not value.lower().startswith(ALLOWED_SCHEMES):
        return "source_not_supported"
    try:
        parts = urlsplit(value)
        host, port = parts.hostname, parts.port
    except ValueError:
        return "source_not_supported"
    if not host or "%" in parts.netloc.rpartition("@")[2]:  # a percent-encoded host is read differently by go2rtc than by us
        return "source_not_supported"
    scheme = parts.scheme.lower()
    port = port or _DEFAULT_PORTS[scheme]
    if host_refused(host):
        return "source_not_allowed"
    query_keys = {k.lower() for k, _ in parse_qsl(parts.query.replace(";", "&"), keep_blank_values=True)}
    if query_keys & FORBIDDEN_QUERY_KEYS:
        return "source_not_allowed"
    if scheme in ("http", "https") and port == 1984 and _api_path(parts.path):
        return "source_not_allowed"
    ip = address_of(host)
    normalized = str(ip) if ip is not None else host.lower().rstrip(".")
    for hosts, ports in extra_hosts:
        if normalized in hosts and port in ports:
            return "source_not_allowed"
    return None


def _rate_limited(now: float, entity_id: str) -> bool:
    """Two windows: every camera has its own small budget (a failing camera cannot use up the others'), and all together a
    larger one. A refused call is not counted."""
    for queue, limit in ((_calls, RATE_MAX), (_calls_by_entity.setdefault(entity_id, deque()), RATE_MAX_PER_ENTITY)):
        while queue and now - queue[0] > RATE_WINDOW_S:
            queue.popleft()
        if len(queue) >= limit:
            return True
    _calls.append(now)
    _calls_by_entity[entity_id].append(now)
    if len(_calls_by_entity) > 512:  # ids that have gone quiet
        for key in [k for k, q in _calls_by_entity.items() if not q or now - q[-1] > RATE_WINDOW_S]:
            _calls_by_entity.pop(key, None)
    return False


async def async_handle_stream_source(hass: Any, verifier: Any, msg: dict[str, Any]) -> dict[str, Any]:
    """Run one signed `stream_source` request. Always answers a dict, never raises for a refusal."""
    reason = verifier.verify(msg)
    if reason:
        _LOGGER.warning("smplwise_bridge.stream_source refused: %s", reason)
        return _refuse(msg, reason)
    entity_id = msg.get("entity_id")
    if set(msg) != REQUEST_KEYS or not isinstance(entity_id, str) or not ENTITY_RE.fullmatch(entity_id) or not isinstance(msg.get("user_id"), str):
        return _refuse(msg, "invalid_request")
    if _rate_limited(time.monotonic(), entity_id):
        _LOGGER.warning("smplwise_bridge.stream_source refused: rate_limited")
        return _refuse(msg, "rate_limited")
    user = await hass.auth.async_get_user(msg["user_id"])
    if user is None or not user.is_active:
        return _refuse(msg, "unknown_user")
    if not getattr(user, "is_admin", False):
        _LOGGER.warning("smplwise_bridge.stream_source refused: admin_required")
        return _refuse(msg, "admin_required")
    if hass.states.get(entity_id) is None:
        return _refuse(msg, "entity_not_found")
    try:
        ha = _ha()
        source = await asyncio.wait_for(ha.get_stream_source(hass, entity_id), READ_TIMEOUT_S)
    except Exception as exc:  # noqa: BLE001 - class name only: the text of a camera exception may carry the URL
        _LOGGER.warning("smplwise_bridge.stream_source failed: %s", type(exc).__name__)
        return _refuse(msg, type(exc).__name__)
    error = source_shape_error(source)
    if error:
        _LOGGER.warning("smplwise_bridge.stream_source refused: %s", error)
        return _refuse(msg, error)
    return {"ok": True, "request_id": msg["request_id"], "stream_source": source}
