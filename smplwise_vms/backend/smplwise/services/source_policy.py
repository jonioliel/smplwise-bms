"""What a camera's stream source may be before go2rtc is pointed at it (services/ha_camera_streams.py).

A source Home Assistant reports for a camera is device-controlled data (an ONVIF `GetStreamUri` answer, a cloud API's reply): it
is not the owner's word. go2rtc pulls whatever it is given, and it can be pointed back at itself, so a source must not be able to
reach go2rtc's own API (`http://127.0.0.1:1984/api/frame.jpeg?src=...&name=<a stream we do not own>` repoints another stream) or
its RTSP restream (`rtsp://<go2rtc host>:8554/<another project's door station>`).

Only `rtsp://` and `rtsps://` sources are accepted. An http(s) source is `source_not_supported`: go2rtc would fetch it with a GET,
and an http(s) URL can reach go2rtc's own API or any internal service (indirect SSRF, also through a redirect or a name that
points at go2rtc), while a camera that has only an HTTP/MJPEG stream stays a still picture. That removes the whole class rather
than trying to recognise go2rtc's API path in every spelling.

Refused (`source_not_allowed`): `localhost`; loopback / unspecified / link-local / multicast hosts in ANY spelling (`127.1`,
`0x7f.1`, `2130706433`, `017700000001`, `[::1]`, `[::ffff:127.0.0.1]`, `[::127.0.0.1]`, a zone id); a host that looks numeric but
is not a valid address; a query with a `src` or `name` key (any case, any percent-encoding, `&` or `;` separated); go2rtc's own
host on go2rtc's ports (1984 / 8554 / 8555 and the port of its configured URL) - this is the answer to `rtsp://<go2rtc>:8554/
<any stream>`: the restream is refused by host and port whatever the path, so no stream name needs to be known; and a host NAME
that resolves (`resolve_host`, short timeout, off the caller's thread) to any such address - `127.0.0.1.nip.io`-style names - or
to go2rtc's own host on go2rtc's ports. services/ha_camera_streams.py adds the last layer where go2rtc's stream list is at hand: an
rtsp source whose first path segment is the name of a go2rtc stream outside `smplwise_ha_` is refused too (an alias of go2rtc that
neither the address nor the name check knows). Private LAN addresses stay allowed: cameras live there. Anything that is not a
plain streaming URL is `source_not_supported`.

Residual risk, stated plainly: the name is resolved HERE, go2rtc resolves it again later. A DNS answer that changes between the two
(DNS rebinding) is not caught, and a name that does not resolve here (mDNS `cam.local`, the add-on's resolver differs from go2rtc's)
is allowed, because its answer is unknown rather than bad. That allowance needs a resolver that could try: when every worker
of the bounded resolver is still busy with earlier (slow) names, the source is refused (`source_not_allowed`, third security
review) instead of being let through unresolved. The real boundary against an internal target is the camera's own
network segmentation; this policy makes the obvious routes fail.

This is the same policy as the bridge's (`custom_components/smplwise_bridge/stream_source_service.py`, which does not know where
go2rtc runs and resolves names with the event loop's own resolver); a test runs one corpus through both and fails when they
disagree."""
from __future__ import annotations

import ipaddress
import re
import socket
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout
from typing import Any, Iterable
from urllib.parse import parse_qsl, urlsplit

ALLOWED_SCHEMES = ("rtsp://", "rtsps://")
MAX_SOURCE_LEN = 2048
RESOLVE_TIMEOUT_S = 2.0  # a name that is not answered in this time counts as unresolved
GO2RTC_PORTS = frozenset({1984, 8554, 8555})  # go2rtc's API / RTSP restream / WebRTC: never a camera's
FORBIDDEN_QUERY_KEYS = frozenset({"src", "name"})  # go2rtc's own API takes its source and stream name from these
_BAD_CHARS_RE = re.compile(r"[\s\x00-\x1f\x7f#]")
_NUMERIC_HOST_RE = re.compile(r"^[0-9xX.]+$")
_IPV4_PART_RE = re.compile(r"^(0[xX][0-9a-fA-F]+|[0-9]+)$")
_DEFAULT_PORTS = {"rtsp": 554, "rtsps": 322}


class NotAnswered(list):
    """An empty answer that is NOT "the name does not exist": the resolver did not answer in time (`busy` False) or had no free
    worker at all (`busy` True; third security review). Compares equal to [] so callers that only want addresses are unchanged."""

    def __init__(self, busy: bool) -> None:
        super().__init__()
        self.busy = busy


class Resolver:
    """A bounded name resolver: at most `workers` lookups run at once, and a lookup that is abandoned on its timeout keeps its
    slot until the system resolver really returns. When every slot is taken the answer is `NotAnswered(busy=True)` at once,
    without queueing (third security review: slow names must not starve the pool so that a later name is "not resolved" and
    therefore allowed). Each user of name resolution has its own instance (the camera source policy, the NVR connection test)."""

    def __init__(self, workers: int, name: str) -> None:
        self.workers = workers
        self._pool = ThreadPoolExecutor(max_workers=workers, thread_name_prefix=name)
        self._lock = threading.Lock()
        self._running = 0

    def busy(self) -> int:
        with self._lock:
            return self._running

    def resolve(self, host: str, timeout: float) -> list[str]:
        """The addresses `host` resolves to; [] when the resolver says it does not resolve (or fails); `NotAnswered` when it
        did not answer within `timeout` or no worker was free. Never raises."""
        with self._lock:
            if self._running >= self.workers:
                return NotAnswered(busy=True)
            self._running += 1

        def lookup() -> list[Any]:
            try:
                return socket.getaddrinfo(host, None, 0, socket.SOCK_STREAM)
            finally:
                with self._lock:
                    self._running -= 1

        try:
            future = self._pool.submit(lookup)
        except RuntimeError:  # the interpreter is shutting down
            with self._lock:
                self._running -= 1
            return NotAnswered(busy=True)
        try:
            return [str(info[4][0]) for info in future.result(timeout=max(0.0, timeout))]
        except FutureTimeout:
            return NotAnswered(busy=False)
        except (OSError, UnicodeError, RuntimeError):
            return []


_RESOLVER = Resolver(workers=4, name="source-dns")


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


def address_refused(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    """An address go2rtc must never be pointed at (loopback, unspecified, link-local, multicast, 0.0.0.0/8). Private LAN addresses
    are fine: cameras live there."""
    return ip.is_loopback or ip.is_unspecified or ip.is_link_local or ip.is_multicast or (ip.version == 4 and int(ip) >> 24 == 0)


def host_refused(host: str) -> bool:
    """A source host go2rtc must never be pointed at: `localhost`, a refused address (any spelling), or something that looks like
    a numeric address but is not a valid one. A name is judged by what it resolves to in `source_refusal`, not here."""
    h = host.lower().rstrip(".")
    if h == "localhost" or h.endswith(".localhost"):
        return True
    ip = address_of(h)
    if ip is None:
        return bool(_NUMERIC_HOST_RE.match(h))  # `1.2.3.4.5`, `0x`, `08.1`: not a name, not an address - refused, not guessed at
    return address_refused(ip)


def resolve_host(host: str, timeout: float = RESOLVE_TIMEOUT_S) -> list[str]:
    """The addresses a host NAME resolves to (text, as the resolver answers), or an empty list when it does not resolve, the
    resolver fails or does not answer within `timeout` (the lookup runs on a worker thread and is abandoned, not waited for).
    The empty list is a `NotAnswered` when there was no answer at all (timeout, or every worker busy). Never raises."""
    return _RESOLVER.resolve(host, timeout)


def source_refusal(value: Any, extra_hosts: Iterable[tuple[frozenset[str], frozenset[int]]] = ()) -> str | None:
    """None when `value` may be handed to go2rtc, else the refusal code (`no_stream_source`, `source_not_supported`,
    `source_not_allowed`). Never includes the value. A host name is resolved (`resolve_host`; blocking for at most RESOLVE_TIMEOUT_S: call from a thread, never from an event loop). `extra_hosts`: (hosts, ports) pairs that are go2rtc itself (`hosts`: normalized
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
    ip = address_of(host)
    normalized = str(ip) if ip is not None else host.lower().rstrip(".")
    targets = list(extra_hosts)
    for hosts, ports in targets:
        if normalized in hosts and port in ports:
            return "source_not_allowed"
    if ip is None:  # a name: every address it resolves to is judged like a literal (a nip.io-style name cannot hide 127.0.0.1)
        answers = resolve_host(normalized)
        if isinstance(answers, NotAnswered) and answers.busy:
            return "source_not_allowed"  # third security review: a saturated resolver fails closed, never "unknown = allowed"
        for answer in answers:
            found = address_of(answer)
            if found is None:
                continue
            if address_refused(found) or any(str(found) in hosts and port in ports for hosts, ports in targets):
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
