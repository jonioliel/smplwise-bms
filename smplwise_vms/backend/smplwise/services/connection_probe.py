"""The NVR connection test of CR-022 section 6.3: input validation, the SSRF source policy for an installer-typed host, a
read-only probe of a candidate connection and the rate limits.

The test is an SSRF oracle by nature (it makes the add-on connect where the caller says), so:
- only a system administrator reaches it (the router checks `system.configure` first);
- the host is validated (a host name, an IPv4 or a bracket-less IPv6 literal; no scheme, path, port, user info or
  whitespace; at most 253 characters) and checked BEFORE any connection: loopback, unspecified, link-local (cloud metadata),
  multicast and 0.0.0.0/8 addresses in any spelling (services/source_policy), the IPv4 inside a NAT64 (64:ff9b::/96,
  64:ff9b:1::/48) or 6to4 (2002::/16) address judged as that IPv4, Teredo and site-local IPv6, the platform's internal
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
  not followed, 5 s to connect, 5 s per read, ONE 8 s wall-clock deadline for the whole probe and at most 256 KB read per
  answer (review F4);
- the answer is coarse: `ok` plus model, firmware and channel count, or one of `source_unavailable`, `source_forbidden`,
  `source_error`, `timeout`, `host_refused`. No response body, header, resolved address or exception text is echoed;
- 5 tests a minute per user and 20 a minute per installation (the save repeats the test and counts too).
Residual risk, stated plainly: a name whose DNS answer changes between this check and a later reconnect by the running
add-on is not fully caught; the start-up overlay (connection_store.overlay) re-checks the stored host once with this policy
(review F5), but the NVR client resolves the name again on every request after that. The NVR's own network segment is the
real boundary. Open item: the platform's internal IPv6 network is not listed, because its prefix could not be verified from
this repository's documents."""
from __future__ import annotations

import dataclasses
import ipaddress
import re
import socket
import threading
import time
from collections import deque
from collections.abc import Callable
from typing import Any

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
                    ipaddress.ip_network("fec0::/10"))   # deprecated site-local IPv6
# IPv6 prefixes that carry an IPv4 address (review F8): the embedded IPv4 is judged like a literal, so `64:ff9b::7f00:1`
# (NAT64 of 127.0.0.1) or `2002:7f00:1::` (6to4 of 127.0.0.1) cannot hide a refused address. IPv4-mapped and
# IPv4-compatible forms are unwrapped by source_policy.address_of already.
NAT64_NETWORKS = (ipaddress.ip_network("64:ff9b::/96"), ipaddress.ip_network("64:ff9b:1::/48"))
SIX_TO_FOUR = ipaddress.ip_network("2002::/16")
# the platform's own services, refused on ANY host (review F9): HA core 8123, go2rtc 1984 / 8554 / 8555, the observer 4357,
# Arx's own port 8099. None of them is an NVR's HTTP port.
REFUSED_PORTS = frozenset({8123, 1984, 8554, 8555, 4357, 8099})
OUTCOMES = ("ok", "source_unavailable", "source_forbidden", "source_error", "timeout", "host_refused")

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


# seams (tests replace them; nothing here ever reaches a real device in a test)
RESOLVE: Callable[[str], list[str]] = source_policy.resolve_host
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

def candidate(settings: Settings, *, vendor: str, target: str, http_port: int, rtsp_port: int, username: str, password: str | None) -> Settings:
    from .connection_store import connect_host

    return dataclasses.replace(settings, nvr_vendor=vendor, nvr_host=connect_host(target), nvr_http_port=http_port, nvr_rtsp_port=rtsp_port,
                               nvr_user=username, nvr_password=password, nvr_connection_state=None)


class _Fail(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def probe_client(cand: Settings) -> httpx.Client:
    """The probe's own client (not the NVR module's): Digest only, no redirects, 5 s to connect, 5 s per read. Tests replace
    this function or TRANSPORT."""
    return httpx.Client(base_url=f"http://{cand.nvr_host}:{cand.nvr_http_port}", auth=httpx.DigestAuth(cand.nvr_user or "", cand.nvr_password or ""),
                        timeout=httpx.Timeout(connect=CONNECT_S, read=READ_S, write=READ_S, pool=READ_S), follow_redirects=False, transport=TRANSPORT)


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
            declared = r.headers.get("content-length")
            if declared and declared.isdigit() and int(declared) > MAX_BYTES:
                raise _Fail("source_error")
            body = bytearray()
            for chunk in r.iter_bytes():  # as received (a chunk size would buffer a trickle)
                body.extend(chunk)
                if len(body) > MAX_BYTES:
                    raise _Fail("source_error")
                left = _remaining(deadline)  # a trickling answer cannot hold the request past the deadline
                try:  # best effort: the next read waits at most what is left (httpcore reads this value on every receive)
                    r.request.extensions["timeout"]["read"] = min(READ_S, left)
                except (AttributeError, KeyError, TypeError):
                    pass
            return bytes(body).decode("utf-8", "replace")
    except httpx.TimeoutException:
        raise _Fail("timeout") from None
    except httpx.HTTPError:
        raise _Fail("source_unavailable") from None


_CONTROL = re.compile(r"[\x00-\x1f\x7f-\x9f]")


def _clip(value: Any) -> str | None:
    """Device text, bounded and without control characters (review F14). The screen binds it as plain text only."""
    text = _CONTROL.sub("", str(value or "")).strip()[:64]
    return text or None


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def probe(cand: Settings) -> dict[str, Any]:
    """deviceInfo, then the channel count: two GET requests, one wall-clock deadline, size-capped answers. Coarse result."""
    deadline = CLOCK() + DEADLINE_S
    try:
        with probe_client(cand) as client:
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
    except _Fail as exc:
        return {"ok": False, "code": exc.code if exc.code in OUTCOMES else "source_error"}
    except Exception:  # noqa: BLE001 - an unparsable answer is a device error, never a 500 with text
        return {"ok": False, "code": "source_error"}
    return {"ok": True, "code": "ok", "model": _clip(info.get("model")), "firmware": _clip(info.get("firmwareVersion")), "channels": channels}


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
