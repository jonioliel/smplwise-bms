"""What a camera's stream source may be before go2rtc is pointed at it (services/ha_camera_streams.py).

A source Home Assistant reports for a camera is device-controlled data (an ONVIF `GetStreamUri` answer, a cloud API's reply): it is
not the owner's word. go2rtc pulls whatever it is given, and it can be pointed back at itself, so a source must not be able to
reach go2rtc's own API (`http://127.0.0.1:1984/api/frame.jpeg?src=...&name=<a stream we do not own>` repoints another stream) or its
RTSP restream (`rtsp://<go2rtc host>:8554/<another project's door station>`).

Refused (`source_not_allowed`): `localhost`; loopback / unspecified / link-local / multicast hosts in ANY spelling (`127.1`,
`0x7f.1`, `2130706433`, `017700000001`, `[::1]`, `[::ffff:127.0.0.1]`, `[::127.0.0.1]`, a zone id); a host that looks numeric but is
not a valid address; a query with a `src` or `name` key (any case, any percent-encoding, `&` or `;` separated); an http(s) source on
port 1984 whose path is go2rtc's API; and go2rtc's own host on go2rtc's ports (1984 / 8554 / 8555 and the port of its configured
URL). Private LAN addresses stay allowed: cameras live there. Anything that is not a plain streaming URL is `source_not_supported`.

This is the same policy as the bridge's (`custom_components/smplwise_bridge/stream_source_service.py`, which does not know where
go2rtc runs); a test runs one corpus through both and fails when they disagree."""
from __future__ import annotations

import ipaddress
import posixpath
import re
import socket
import time
from typing import Any, Iterable
from urllib.parse import parse_qsl, unquote, urlsplit

ALLOWED_SCHEMES = ("rtsp://", "rtsps://", "http://", "https://")
MAX_SOURCE_LEN = 2048
GO2RTC_PORTS = frozenset({1984, 8554, 8555})  # go2rtc's API / RTSP restream / WebRTC: never a camera's
FORBIDDEN_QUERY_KEYS = frozenset({"src", "name"})  # go2rtc's own API takes its source and stream name from these
_BAD_CHARS_RE = re.compile(r"[\s\x00-\x1f\x7f#]")
_NUMERIC_HOST_RE = re.compile(r"^[0-9xX.]+$")
_IPV4_PART_RE = re.compile(r"^(0[xX][0-9a-fA-F]+|[0-9]+)$")
_DEFAULT_PORTS = {"rtsp": 554, "rtsps": 322, "http": 80, "https": 443}


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


def source_refusal(value: Any, extra_hosts: Iterable[tuple[frozenset[str], frozenset[int]]] = ()) -> str | None:
    """None when `value` may be handed to go2rtc, else the refusal code (`no_stream_source`, `source_not_supported`,
    `source_not_allowed`). Never includes the value. `extra_hosts`: (hosts, ports) pairs that are go2rtc itself (`hosts`: normalized
    addresses and lower-case names, see `go2rtc_targets`) - that host on those ports is refused."""
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


_RESOLVED: dict[str, tuple[float, frozenset[str]]] = {}
RESOLVE_CACHE_S = 60.0


def go2rtc_targets(go2rtc_url: str | None) -> list[tuple[frozenset[str], frozenset[int]]]:
    """Where go2rtc itself is, for `source_refusal`: the host of its configured URL (as written, and every address it resolves to,
    best effort - a name that does not resolve here is compared as a name) on go2rtc's ports and the port of that URL."""
    if not go2rtc_url:
        return []
    try:
        parts = urlsplit(go2rtc_url)
        host, port = (parts.hostname or "").lower().rstrip("."), parts.port
    except ValueError:
        return []
    if not host:
        return []
    hosts = {host}
    ip = address_of(host)
    if ip is not None:
        hosts.add(str(ip))
    else:
        now = time.monotonic()
        cached = _RESOLVED.get(host)
        if cached is None or now - cached[0] > RESOLVE_CACHE_S:
            try:
                found = frozenset(str(address_of(info[4][0]) or info[4][0]) for info in socket.getaddrinfo(host, None))
            except (OSError, UnicodeError):
                found = frozenset()
            cached = _RESOLVED[host] = (now, found)
        hosts |= set(cached[1])
    ports = set(GO2RTC_PORTS) | ({port} if port else set())
    return [(frozenset(hosts), frozenset(ports))]
