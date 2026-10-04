"""The NVR connection test of CR-022 section 6.3: input validation, the SSRF source policy for an installer-typed host, a
read-only probe of a candidate connection and the rate limits.

The test is an SSRF oracle by nature (it makes the add-on connect where the caller says), so:
- only a system administrator reaches it (the router checks `system.configure` first);
- the host is validated (a host name, an IPv4 or a bracket-less IPv6 literal; no scheme, path, port, user info or
  whitespace; at most 253 characters) and checked BEFORE any connection: loopback, unspecified, link-local (cloud metadata),
  multicast and 0.0.0.0/8 addresses in any spelling (services/source_policy), the IPv4 inside a NAT64 (64:ff9b::/96) or
  6to4 (2002::/16) address judged as that IPv4, the local-use NAT64 range 64:ff9b:1::/48, Teredo and site-local IPv6, the platform's internal
  network and its Supervisor / core names, the trusted proxies, and this host itself (its name, what the name resolves to and
  the addresses of its own network interfaces) are refused (`host_refused`). A name is resolved here and EVERY address it
  resolves to is checked; the probe then connects to the checked address, not to the name (no second resolution). A name
  that does not resolve (or not within the resolver's 2 s) is NOT handed to the HTTP client - that would resolve it a second
  time, unchecked (DNS rebinding, security review F3): the test answers `source_unavailable` without any connection. Private
  LAN addresses are allowed: an NVR lives there;
- the ports of the platform's own services (HA core, go2rtc, the observer, Arx itself) are refused on any host
  (`port_refused`, review F9): the test must not become a port scanner of the machine it runs on, whose LAN address is not
  always knowable from inside the add-on's container;
- the probe is GET only (`/ISAPI/System/deviceInfo`, then the channel listing) with its own client: Digest only, redirects
  not followed, no proxy from the environment, 5 s to connect, 5 s per read, ONE 8 s wall-clock deadline for the whole probe
  and at most 256 KB read per answer (review F4). The deadline is hard (second review N2): every socket read and write is
  bounded by the time left, also while waiting for the response headers (an endless stream of `100 Continue` answers), and
  the probe runs in its own thread whose sockets are shut down if it is still running at the deadline. Only identity encoding
  is accepted and the raw bytes are counted (second review N3: a compressed answer is never inflated before the cap). Both
  rules hold at the transport for EVERY answer, also the 401 challenge that the Digest handshake reads by itself (third
  review). Name resolution (this host's name and the typed name, each at most 2 s) runs inside the same 8 s budget
  (`check_and_probe`, third review); the probe's resolver is its own bounded pool, not the camera source policy's;
- the answer is coarse: `ok` plus model, firmware and channel count, or one of `source_unavailable`, `source_forbidden`,
  `source_error`, `timeout`, `host_refused`. No response body, header, resolved address or exception text is echoed;
- 5 tests a minute per user and 20 a minute per installation (the save repeats the test and counts too).
Residual risk, stated plainly: a name whose DNS answer changes between this check and a later reconnect by the running
add-on is not fully caught; the start-up overlay (connection_store.overlay) re-checks the stored host once with this policy
(review F5), but the NVR client resolves the name again on every request after that. The NVR's own network segment is the
real boundary. Open item: the platform's internal IPv6 network is not listed, because its prefix could not be verified from
this repository's documents (third review: still not verifiable here; not guessed). The shared address space 100.64.0.0/10
and the IPv6 metadata address fd20:ce::254 are refused (third review; the former has an environment override, see
SHARED_ADDRESS_SPACE)."""
from __future__ import annotations

import contextvars
import dataclasses
import ipaddress
import os
import re
import socket
import threading
import time
from collections import deque
from collections.abc import Callable
from typing import Any

import httpcore
import httpx

from ..config import Settings
from ..errors import ApiError
from . import source_policy, xmlsafe

HOST_MAX = 253
_LABEL = r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?"
_HOST_RE = re.compile(rf"^{_LABEL}(?:\.{_LABEL})*\.?$")
REFUSED_NAMES = frozenset({"localhost", "supervisor", "hassio", "homeassistant", "home-assistant", "metadata", "metadata.google.internal"})
# the platform's internal container network (Supervisor 172.30.32.2, the add-ons 172.30.33.x) and well-known metadata addresses
REFUSED_NETWORKS = (ipaddress.ip_network("172.30.32.0/23"), ipaddress.ip_network("100.100.100.200/32"), ipaddress.ip_network("fd00:ec2::/64"),
                    ipaddress.ip_network("2001::/32"),   # Teredo: a tunnel endpoint, never an NVR (review F8)
                    ipaddress.ip_network("fec0::/10"),   # deprecated site-local IPv6
                    ipaddress.ip_network("64:ff9b:1::/48"),  # local-use NAT64 (RFC 8215): the IPv4's place depends on the
                                                             # prefix length, so the whole range is refused (second review N6)
                    ipaddress.ip_network("fd20:ce::254/128"))  # a cloud metadata service over IPv6 (third review)
# the shared address space of carrier-grade NAT (RFC 6598, 100.64.0.0/10; third review). An NVR on a real LAN has an RFC 1918
# address (or a ULA / global IPv6), never one of these: they sit between a subscriber's router and the carrier, and inside
# cloud and overlay networks (several metadata and DNS helpers live there). Refused by default; an installation that really
# reaches its NVR through such an overlay sets SW_NVR_ALLOW_SHARED_ADDRESS_SPACE=1 in the add-on's environment. The metadata
# addresses inside the range (100.100.100.200) stay refused either way.
SHARED_ADDRESS_SPACE = ipaddress.ip_network("100.64.0.0/10")
SHARED_ADDRESS_SPACE_OVERRIDE = "SW_NVR_ALLOW_SHARED_ADDRESS_SPACE"


def _shared_address_space_allowed() -> bool:
    return (os.environ.get(SHARED_ADDRESS_SPACE_OVERRIDE) or "").strip().lower() in ("1", "true", "yes")
# IPv6 prefixes that carry an IPv4 address (review F8): the embedded IPv4 is judged like a literal, so `64:ff9b::7f00:1`
# (NAT64 of 127.0.0.1) or `2002:7f00:1::` (6to4 of 127.0.0.1) cannot hide a refused address. IPv4-mapped and
# IPv4-compatible forms are unwrapped by source_policy.address_of already.
NAT64_NETWORKS = (ipaddress.ip_network("64:ff9b::/96"),)  # the well-known prefix; 64:ff9b:1::/48 is refused whole above
SIX_TO_FOUR = ipaddress.ip_network("2002::/16")
# the platform's own services, refused on ANY host (review F9): HA core 8123, go2rtc 1984 / 8554 / 8555, the observer 4357,
# Arx's own port 8099. None of them is an NVR's HTTP port.
REFUSED_PORTS = frozenset({8123, 1984, 8554, 8555, 4357, 8099})
OUTCOMES = ("ok", "source_unavailable", "source_forbidden", "source_error", "timeout", "host_refused", "tls_pin_mismatch", "auth_scheme_unsupported")

# the probe's limits (CR-022 section 6.3, review F4)
CONNECT_S = 5.0
READ_S = 5.0
DEADLINE_S = 8.0
MAX_BYTES = 256 * 1024
DEVICE_INFO_PATH = "/ISAPI/System/deviceInfo"
CHANNELS_PATH = "/ISAPI/ContentMgmt/InputProxy/channels"


def _interface_addresses() -> set[str]:
    """The addresses of this machine's own network interfaces, where the system lists them without any network call (Linux:
    the LOCAL entries of /proc/net/fib_trie and /proc/net/if_inet6). Empty elsewhere. Never raises."""
    out: set[str] = set()
    try:
        with open("/proc/net/fib_trie", encoding="ascii", errors="replace") as fh:
            last = None
            for line in fh:
                if "/32 host LOCAL" in line:
                    if last:
                        out.add(last)
                    continue
                m = re.search(r"\b(\d{1,3}(?:\.\d{1,3}){3})\b", line)
                last = m.group(1) if m else None
    except OSError:
        pass
    try:
        with open("/proc/net/if_inet6", encoding="ascii", errors="replace") as fh:
            for line in fh:
                parts = line.split()
                if parts and len(parts[0]) == 32:
                    out.add(str(ipaddress.IPv6Address(int(parts[0], 16))))
    except (OSError, ValueError):
        pass
    return out


# the probe's own bounded resolver (third review: it shared the camera source policy's four workers, so slow names typed here
# starved that policy and the other way round)
_RESOLVER = source_policy.Resolver(workers=4, name="probe-dns")
# the absolute time.monotonic() end of the current connection test (check_and_probe): name resolution and the probe share it
_BUDGET_END: contextvars.ContextVar[float | None] = contextvars.ContextVar("sw_probe_budget_end", default=None)


def _budget_left(cap: float) -> float:
    end = _BUDGET_END.get()
    return cap if end is None else max(0.0, min(cap, end - time.monotonic()))


def _resolve(host: str) -> list[str]:
    """The default RESOLVE: the probe's own resolver, at most 2 s and never past the test's budget."""
    left = _budget_left(source_policy.RESOLVE_TIMEOUT_S)
    if left <= 0:
        return source_policy.NotAnswered(busy=False)
    return _RESOLVER.resolve(host, left)


# seams (tests replace them; nothing here ever reaches a real device in a test)
RESOLVE: Callable[[str], list[str]] = _resolve
HOSTNAME: Callable[[], str] = socket.gethostname
LOCAL_ADDRESSES: Callable[[], set[str]] = _interface_addresses
CLOCK: Callable[[], float] = time.monotonic
TRANSPORT: httpx.BaseTransport | None = None


def valid_host(host: Any) -> bool:
    if not isinstance(host, str) or not host or len(host) > HOST_MAX:
        return False
    if _HOST_RE.match(host):
        return True
    try:
        return isinstance(ipaddress.ip_address(host), ipaddress.IPv6Address) and "%" not in host
    except ValueError:
        return False


def valid_port(port: Any) -> bool:
    return isinstance(port, int) and not isinstance(port, bool) and 1 <= port <= 65535


def port_refused(port: Any) -> bool:
    return port in REFUSED_PORTS


def embedded_ipv4(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> ipaddress.IPv4Address | None:
    """The IPv4 address a NAT64 or 6to4 IPv6 address carries (review F8), else None."""
    if not isinstance(ip, ipaddress.IPv6Address):
        return None
    if any(ip in net for net in NAT64_NETWORKS):
        return ipaddress.IPv4Address(ip.packed[12:])
    if ip in SIX_TO_FOUR:
        return ip.sixtofour
    return None


def _address_refused(ip: ipaddress.IPv4Address | ipaddress.IPv6Address, settings: Settings, own: set[str]) -> bool:
    inner = embedded_ipv4(ip)
    if inner is not None and _address_refused(inner, settings, own):
        return True
    if source_policy.address_refused(ip):
        return True
    if any(ip.version == net.version and ip in net for net in REFUSED_NETWORKS):
        return True
    if ip.version == 4 and ip in SHARED_ADDRESS_SPACE and not _shared_address_space_allowed():
        return True
    if str(ip) in own:
        return True
    for proxy in settings.trusted_proxies:
        a = source_policy.address_of(proxy)
        if a is not None and a == ip:
            return True
    return False


def _own_addresses() -> set[str]:
    """This host: what its name resolves to and the addresses of its own network interfaces (review F9)."""
    name = (HOSTNAME() or "").strip()
    try:
        local = set(LOCAL_ADDRESSES())
    except Exception:  # noqa: BLE001 - best effort; the refused ports still apply
        local = set()
    out: set[str] = set()
    for text in [*(RESOLVE(name) if name else []), *local]:
        a = source_policy.address_of(text)
        if a is not None:
            out.add(str(a))
    return out


def connect_target(host: str, settings: Settings) -> str | None:
    """The address to connect to for `host`, after the source policy. Raises 422 `host_refused` (no connection attempted).
    None when a name does not resolve: the caller must NOT connect (handing the name to the HTTP client would resolve it a
    second time, unchecked - review F3)."""
    h = host.strip().lower().rstrip(".")
    refused = ApiError(422, "host_refused", "הכתובת אינה מותרת לחיבור NVR.", details={"field": "host"})
    own_name = (HOSTNAME() or "").strip().lower()
    if h in REFUSED_NAMES or h.endswith(".localhost") or (own_name and h in (own_name, own_name.split(".")[0])):
        raise refused
    if source_policy.host_refused(h):
        raise refused
    own = _own_addresses()
    literal = source_policy.address_of(h)
    if literal is not None:
        if _address_refused(literal, settings, own):
            raise refused
        return str(literal)
    resolved = [a for a in (source_policy.address_of(t) for t in RESOLVE(h)) if a is not None]
    if any(_address_refused(a, settings, own) for a in resolved):
        raise refused
    return str(resolved[0]) if resolved else None


def refused_host(host: str, settings: Settings) -> bool:
    """The source policy alone, for a host that is already stored (connection_store.overlay at start-up, review F5): True
    when the host is refused or resolves to a refused address. A name that does not resolve is not refused here (its answer
    is unknown, not bad)."""
    try:
        connect_target(host, settings)
    except ApiError:
        return True
    return False


# ---------------------------------------------------------------- the probe (read-only)

def candidate(settings: Settings, *, vendor: str, target: str, http_port: int, rtsp_port: int, username: str, password: str | None,
              extra: dict[str, Any] | None = None) -> Settings:
    from .connection_store import connect_host

    return dataclasses.replace(settings, nvr_vendor=vendor, nvr_host=connect_host(target), nvr_http_port=http_port, nvr_rtsp_port=rtsp_port,
                               nvr_user=username, nvr_password=password, nvr_connection_state=None, nvr_extra=dict(extra or {}))


class _Fail(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


class _DeadlineStream(httpcore.NetworkStream):
    """A socket stream whose every read and write waits at most the time left before the probe's hard deadline (second review
    N2): httpcore resets its read timeout for each event and skips interim (1xx) answers in a loop, so a per-read timeout alone
    never ends a server that keeps sending them."""

    def __init__(self, inner: httpcore.NetworkStream, owner: "_DeadlineBackend") -> None:
        self._inner, self._owner = inner, owner

    def _left(self, timeout: float | None, exc: type[Exception]) -> float:
        left = self._owner.hard_deadline - time.monotonic()
        if left <= 0:
            raise exc("the probe's deadline passed")
        return left if timeout is None else min(timeout, left)

    def read(self, max_bytes: int, timeout: float | None = None) -> bytes:
        return self._inner.read(max_bytes, self._left(timeout, httpcore.ReadTimeout))

    def write(self, buffer: bytes, timeout: float | None = None) -> None:
        self._inner.write(buffer, self._left(timeout, httpcore.WriteTimeout))

    def close(self) -> None:
        self._inner.close()

    def start_tls(self, ssl_context: Any, server_hostname: str | None = None, timeout: float | None = None) -> httpcore.NetworkStream:
        return _DeadlineStream(self._inner.start_tls(ssl_context, server_hostname, self._left(timeout, httpcore.ConnectTimeout)), self._owner)

    def get_extra_info(self, info: str) -> Any:
        return self._inner.get_extra_info(info)


class _DeadlineBackend(httpcore.NetworkBackend):
    """The synchronous socket backend with the probe's hard deadline; remembers its sockets so that `abort()` can shut them down
    from another thread (a blocked receive returns at once)."""

    def __init__(self, seconds: float) -> None:
        self._inner = httpcore.SyncBackend()
        self.hard_deadline = time.monotonic() + seconds
        self._lock = threading.Lock()
        self._streams: list[_DeadlineStream] = []

    def connect_tcp(self, host: str, port: int, timeout: float | None = None, local_address: str | None = None,
                    socket_options: Any = None) -> httpcore.NetworkStream:
        left = self.hard_deadline - time.monotonic()
        if left <= 0:
            raise httpcore.ConnectTimeout("the probe's deadline passed")
        stream = _DeadlineStream(self._inner.connect_tcp(host, port, left if timeout is None else min(timeout, left), local_address, socket_options), self)
        with self._lock:
            self._streams.append(stream)
        return stream

    def connect_unix_socket(self, path: str, timeout: float | None = None, socket_options: Any = None) -> httpcore.NetworkStream:
        raise httpcore.ConnectError("no unix sockets in the probe")

    def sleep(self, seconds: float) -> None:
        time.sleep(min(seconds, max(0.0, self.hard_deadline - time.monotonic())))

    def abort(self) -> None:
        with self._lock:
            streams = list(self._streams)
        for stream in streams:
            sock = stream.get_extra_info("socket")
            try:
                if sock is not None:
                    sock.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
            try:
                stream.close()
            except Exception:  # noqa: BLE001 - best effort; the socket is shut down already
                pass


class _ProbeTransport(httpx.HTTPTransport):
    """httpx's own transport (exception mapping, response streams) over one connection pool that uses `_DeadlineBackend`."""

    def __init__(self, backend: _DeadlineBackend, ssl_context: Any = None) -> None:
        super().__init__(trust_env=False, retries=0)
        self._pool = httpcore.ConnectionPool(max_connections=1, max_keepalive_connections=1, http1=True, http2=False, retries=0,
                                             network_backend=backend, ssl_context=ssl_context)


class _CappedStream(httpx.SyncByteStream):
    """A response body that yields at most MAX_BYTES raw bytes, then stops and closes the connection (`over` tells that more
    was there). It sits under every reader of the probe's answers, including the Digest handshake's own read of the 401
    challenge (third review: that read bypassed the cap of `_get_capped`)."""

    def __init__(self, inner: httpx.SyncByteStream) -> None:
        self._inner = inner
        self.over = False

    def __iter__(self):
        count = 0
        for chunk in self._inner:
            room = MAX_BYTES - count
            if len(chunk) > room:
                if room > 0:
                    yield chunk[:room]
                self.over = True
                break
            count += len(chunk)
            yield chunk
        if self.over:
            self.close()

    def close(self) -> None:
        self._inner.close()


class _CappedTransport(httpx.BaseTransport):
    """The probe's rules for EVERY answer, before anything reads or decodes it (third review): only identity encoding (anything
    else is closed unread and raises httpx.DecodingError, so no reader can inflate it) and at most MAX_BYTES raw bytes."""

    def __init__(self, inner: httpx.BaseTransport) -> None:
        self._inner = inner

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        response = self._inner.handle_request(request)
        encoding = response.headers.get("content-encoding", "identity").strip().lower()
        if encoding not in ("", "identity"):
            response.close()
            raise httpx.DecodingError("only identity encoding is accepted", request=request)
        if not response.is_stream_consumed and isinstance(response.stream, httpx.SyncByteStream):
            capped = _CappedStream(response.stream)
            response.stream = capped
            response.extensions = {**response.extensions, "sw_cap": capped}
        return response

    def close(self) -> None:
        self._inner.close()


def probe_client(cand: Settings) -> httpx.Client:
    """The probe's own client (not the NVR module's): Digest only, no redirects, no proxy or settings from the environment,
    identity encoding, 5 s to connect, 5 s per read, every socket operation within the hard deadline (the test's budget, at
    most DEADLINE_S), every answer capped at the transport. Tests replace this function or TRANSPORT (a test transport bypasses
    the socket backend; the caps still apply)."""
    backend = _DeadlineBackend(_budget_left(DEADLINE_S))
    transport: httpx.BaseTransport = _CappedTransport(TRANSPORT if TRANSPORT is not None else _ProbeTransport(backend))
    client = httpx.Client(base_url=f"http://{cand.nvr_host}:{cand.nvr_http_port}", auth=httpx.DigestAuth(cand.nvr_user or "", cand.nvr_password or ""),
                        timeout=httpx.Timeout(connect=CONNECT_S, read=READ_S, write=READ_S, pool=READ_S), follow_redirects=False,
                        headers={"Accept-Encoding": "identity"}, trust_env=False, transport=transport)
    client._sw_probe_backend = backend  # type: ignore[attr-defined]  # probe() shuts its sockets down at the hard deadline
    return client


def _remaining(deadline: float) -> float:
    left = deadline - CLOCK()
    if left <= 0:
        raise _Fail("timeout")
    return left


def _get_capped(client: httpx.Client, path: str, deadline: float) -> str:
    """One GET whose answer is read within the probe's deadline and at most MAX_BYTES (review F4). Coarse failures only."""
    left = _remaining(deadline)
    step = min(READ_S, left)
    try:
        with client.stream("GET", path, timeout=httpx.Timeout(connect=min(CONNECT_S, left), read=step, write=step, pool=step)) as r:
            if r.status_code in (401, 403):
                raise _Fail("source_forbidden")
            if r.status_code != 200:
                raise _Fail("source_error")
            if r.headers.get("content-encoding", "identity").strip().lower() not in ("", "identity"):
                raise _Fail("source_error")  # second review N3: only identity was asked for; never inflate an answer
            declared = r.headers.get("content-length")
            if declared and declared.isdigit() and int(declared) > MAX_BYTES:
                raise _Fail("source_error")
            body = bytearray()
            # raw bytes as received (a chunk size would buffer a trickle), no decoding; an answer that is already in memory
            # (built by a test transport, never one read from a socket) is taken as it is
            for chunk in (r.iter_raw() if not r.is_stream_consumed else iter([r.content])):
                body.extend(chunk)
                if len(body) > MAX_BYTES:
                    raise _Fail("source_error")
                _remaining(deadline)  # a trickling answer cannot hold the request past the deadline; each socket read is
                # also bounded by the hard deadline of _DeadlineBackend (the per-request read timeout is read only once
                # by httpcore, so changing it here had no effect - second review N4)
            cap = r.extensions.get("sw_cap")
            if cap is not None and cap.over:
                raise _Fail("source_error")  # the transport stopped at MAX_BYTES and more was there
            return bytes(body).decode("utf-8", "replace")
    except httpx.TimeoutException:
        raise _Fail("timeout") from None
    except httpx.DecodingError:
        raise _Fail("source_error") from None  # a compressed answer (refused at the transport, third review)
    except httpx.HTTPError:
        raise _Fail("source_unavailable") from None


_CONTROL = re.compile(r"[\x00-\x1f\x7f-\x9f]")


def _clip(value: Any) -> str | None:
    """Device text, bounded and without control characters (review F14). The screen binds it as plain text only."""
    text = _CONTROL.sub("", str(value or "")).strip()[:64]
    return text or None


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _probe_with(client: httpx.Client, deadline: float) -> dict[str, Any]:
    root = xmlsafe.parse(_get_capped(client, DEVICE_INFO_PATH, deadline))
    info: dict[str, str] = {}
    for el in root.iter():
        name = _local(el.tag)
        if name in ("model", "firmwareVersion") and name not in info and el.text:
            info[name] = el.text.strip()
    channels: int | None
    try:
        listing = xmlsafe.parse(_get_capped(client, CHANNELS_PATH, deadline))
        channels = sum(1 for el in listing.iter() if _local(el.tag) == "InputProxyChannel")
    except Exception:  # noqa: BLE001 - the device answered deviceInfo; the channel count is optional
        channels = None
    return {"ok": True, "code": "ok", "model": _clip(info.get("model")), "firmware": _clip(info.get("firmwareVersion")), "channels": channels}


def probe(cand: Settings) -> dict[str, Any]:
    """deviceInfo, then the channel count: two GET requests, one wall-clock deadline, size-capped answers. Coarse result.

    The work runs in its own thread and this call waits at most the deadline plus a short grace (second review N2): if the
    thread is still running then, its sockets are shut down (the thread ends at once) and the answer is `timeout`. Inside
    `check_and_probe` the deadline is what is left of the test's one budget after name resolution (third review)."""
    budget = _budget_left(DEADLINE_S)
    if budget <= 0:
        return {"ok": False, "code": "timeout"}
    budget_end = time.monotonic() + budget
    deadline = CLOCK() + budget
    out: list[dict[str, Any]] = []
    backends: list[_DeadlineBackend] = []

    def work() -> None:
        _BUDGET_END.set(budget_end)  # a new thread starts with an empty context; probe_client reads the budget from it
        try:
            from .recorders import vendor_io

            if vendor_io.handles(cand):  # CR-025: Provision-ISR is tested through its adapter (its auth / TLS rules)
                out.append(_probe_vendor(cand, budget, backends))
                return
            with probe_client(cand) as client:
                backend = getattr(client, "_sw_probe_backend", None)
                if backend is not None:
                    backends.append(backend)
                out.append(_probe_with(client, deadline))
        except _Fail as exc:
            out.append({"ok": False, "code": exc.code if exc.code in OUTCOMES else "source_error"})
        except Exception:  # noqa: BLE001 - an unparsable answer is a device error, never a 500 with text
            out.append({"ok": False, "code": "source_error"})

    worker = threading.Thread(target=work, name="nvr-probe", daemon=True)
    worker.start()
    worker.join(budget + 0.5)
    if worker.is_alive():
        for backend in backends:
            backend.abort()
        worker.join(1.0)
        return {"ok": False, "code": "timeout"}
    return out[0] if out else {"ok": False, "code": "source_error"}


def check_and_probe(host: str, settings: Settings, build: Callable[[str], Settings]) -> dict[str, Any]:
    """The whole connection test inside ONE budget of DEADLINE_S (third review): the source policy with its name resolution
    (this host's own name and the typed name, each at most 2 s and never past the budget), then the probe with what is left.
    Raises 422 `host_refused` like `connect_target`. `build(target)` makes the candidate for the checked address. Worst case
    for the caller: DEADLINE_S plus the probe's 0.5 s grace and 1 s to close its sockets."""
    token = _BUDGET_END.set(time.monotonic() + DEADLINE_S)
    try:
        target = connect_target(host, settings)
        if target is None:
            return {"ok": False, "code": "timeout" if _budget_left(DEADLINE_S) <= 0 else "source_unavailable"}
        return probe(build(target))
    finally:
        _BUDGET_END.reset(token)


# ---------------------------------------------------------------- rate limits

class Limiter:
    """Sliding windows: `per_user` per key and `total` for the installation within `window_s`."""

    def __init__(self, per_user: int, total: int, window_s: float) -> None:
        self.per_user, self.total, self.window_s = per_user, total, window_s
        self._lock = threading.Lock()
        self._by: dict[str, deque[float]] = {}
        self._all: deque[float] = deque()

    def take(self, key: str, now: float | None = None) -> int:
        """0 when allowed (and counted), else the seconds to wait."""
        t = time.monotonic() if now is None else now
        with self._lock:
            mine = self._by.setdefault(key, deque())
            for q in (mine, self._all):
                while q and t - q[0] >= self.window_s:
                    q.popleft()
            if len(mine) >= self.per_user:
                return max(1, int(self.window_s - (t - mine[0])) + 1)
            if len(self._all) >= self.total:
                return max(1, int(self.window_s - (t - self._all[0])) + 1)
            mine.append(t)
            self._all.append(t)
            return 0


def probe_limiter() -> Limiter:
    return Limiter(per_user=5, total=20, window_s=60.0)



def _probe_vendor(cand: Settings, budget: float, backends: list) -> dict[str, Any]:
    """CR-025: the connection test of a Provision-ISR candidate - its adapter over the probe's capped, deadline-bound transport:
    GetDeviceInfo (after one unauthenticated read that names the auth scheme), then the channel list. For HTTPS the device
    certificate's SHA-256 is read first by a bare TLS handshake (no credentials) and returned so the form can pin it.
    Coarse result plus the non-secret transport facts (scheme, auth, warnings); never the address."""
    import ssl

    from . import nvr as nvr_mod
    from .recorders import provision_isr as pisr

    extra = cand.nvr_extra if isinstance(cand.nvr_extra, dict) else {}
    https = str(extra.get("scheme") or "http").lower() == "https"
    result: dict[str, Any] = {"ok": False, "code": "source_error"}
    certificate: dict[str, Any] | None = None
    if https:
        try:
            certificate = pisr.PEER_CERTIFICATE(cand.nvr_host or "", int(extra.get("https_port") or 443), min(CONNECT_S, _budget_left(DEADLINE_S)))
        except OSError:
            return {"ok": False, "code": "source_unavailable"}
        pin = str(extra.get("tls_pin") or "").lower().replace(":", "")
        certificate["matches_pin"] = (certificate["sha256"] == pin) if pin else None
    ctx = None
    if https:
        ctx = ssl.create_default_context()
        if str(extra.get("tls_mode") or "verify").lower() in ("pin", "trust"):
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
    backend = _DeadlineBackend(_budget_left(DEADLINE_S))
    backends.append(backend)
    transport: httpx.BaseTransport = _CappedTransport(TRANSPORT if TRANSPORT is not None else _ProbeTransport(backend, ctx))
    pisr.clear_auth_cache()  # a test never reuses another candidate's detected scheme or refusal
    pin_required = https and str(extra.get("tls_mode") or "").lower() == "pin" and not str(extra.get("tls_pin") or "").strip()
    if pin_required:  # nothing pinned yet: test without the pin and hand the certificate back so the form can pin it
        cand = dataclasses.replace(cand, nvr_extra={**extra, "tls_mode": "trust", "suppress_tls_warning": True})
    a = pisr.ProvisionIsrAdapter("probe", cand, transport=transport)
    try:
        with nvr_mod.deadline(budget):
            info = a.device_info(refresh=True)
            try:
                channels: int | None = len(a.list_channels()) if info.get("kind") == "nvr" else 1
            except Exception:  # noqa: BLE001 - the device answered GetDeviceInfo; the count is optional
                channels = None
        result = {"ok": True, "code": "ok", "model": _clip(info.get("model")), "firmware": _clip(info.get("firmware")), "channels": channels}
    except ApiError as exc:
        code = {"source_timeout": "timeout"}.get(exc.code, exc.code)
        result = {"ok": False, "code": code if code in OUTCOMES else "source_error"}
    except Exception:  # noqa: BLE001
        result = {"ok": False, "code": "source_error"}
    info_t = a.transport_info()
    result["transport"] = {"scheme": info_t["scheme"], "auth": info_t["auth"], "insecure": info_t["insecure"]}
    try:
        result["warnings"] = [w["code"] for w in a.warnings()]
    except Exception:  # noqa: BLE001
        result["warnings"] = []
    if certificate is not None:
        result["certificate"] = certificate
        if pin_required:
            result["pin_required"] = True
    return result
