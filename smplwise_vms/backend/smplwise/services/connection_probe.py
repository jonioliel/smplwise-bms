"""The NVR connection test of CR-022 section 6.3: input validation, the SSRF source policy for an installer-typed host, a
read-only probe of a candidate connection and the rate limits.

The test is an SSRF oracle by nature (it makes the add-on connect where the caller says), so:
- only a system administrator reaches it (the router checks `system.configure` first);
- the host is validated (a host name, an IPv4 or a bracket-less IPv6 literal; no scheme, path, port, user info or
  whitespace; at most 253 characters) and checked BEFORE any connection: loopback, unspecified, link-local (cloud metadata),
  multicast and 0.0.0.0/8 addresses in any spelling (services/source_policy), the platform's internal network and its
  Supervisor / core names, the trusted proxies, and this host itself are refused (`host_refused`). A name is resolved here and
  EVERY address it resolves to is checked; the probe then connects to the checked address, not to the name (no second
  resolution). An unresolvable name is passed on as is (the connection will fail; its answer is unknown, not bad). Private
  LAN addresses are allowed: an NVR lives there;
- the probe is GET only (`/ISAPI/System/deviceInfo`, then the channel listing), redirects are not followed (httpx default),
  the client has the NVR module's timeouts;
- the answer is coarse: `ok` plus model, firmware and channel count, or one of `source_unavailable`, `source_forbidden`,
  `source_error`, `timeout`, `host_refused`. No response body, header, resolved address or exception text is echoed;
- 5 tests a minute per user and 20 a minute per installation (the save repeats the test and counts too).
Residual risk, stated plainly: a name whose DNS answer changes between this check and a later reconnect by the running
add-on (after a restart) is not caught here; the NVR's own network segment is the real boundary."""
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

from ..config import Settings
from ..errors import ApiError
from . import source_policy

HOST_MAX = 253
_LABEL = r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?"
_HOST_RE = re.compile(rf"^{_LABEL}(?:\.{_LABEL})*\.?$")
REFUSED_NAMES = frozenset({"localhost", "supervisor", "hassio", "homeassistant", "home-assistant", "metadata", "metadata.google.internal"})
# the platform's internal container network (Supervisor 172.30.32.2, the add-ons 172.30.33.x) and well-known metadata addresses
REFUSED_NETWORKS = (ipaddress.ip_network("172.30.32.0/23"), ipaddress.ip_network("100.100.100.200/32"), ipaddress.ip_network("fd00:ec2::/64"))
OUTCOMES = ("ok", "source_unavailable", "source_forbidden", "source_error", "timeout", "host_refused")

# seams (tests replace them; nothing here ever reaches a real device in a test)
RESOLVE: Callable[[str], list[str]] = source_policy.resolve_host
HOSTNAME: Callable[[], str] = socket.gethostname


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


def _address_refused(ip: ipaddress.IPv4Address | ipaddress.IPv6Address, settings: Settings, own: set[str]) -> bool:
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
    name = (HOSTNAME() or "").strip()
    out: set[str] = set()
    for text in (RESOLVE(name) if name else []):
        a = source_policy.address_of(text)
        if a is not None:
            out.add(str(a))
    return out


def connect_target(host: str, settings: Settings) -> str:
    """The address to connect to for `host`, after the source policy. Raises 422 `host_refused` (no connection attempted)."""
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
    return str(resolved[0]) if resolved else h


# ---------------------------------------------------------------- the probe (read-only)

def candidate(settings: Settings, *, vendor: str, target: str, http_port: int, rtsp_port: int, username: str, password: str | None) -> Settings:
    from .connection_store import connect_host

    return dataclasses.replace(settings, nvr_vendor=vendor, nvr_host=connect_host(target), nvr_http_port=http_port, nvr_rtsp_port=rtsp_port,
                               nvr_user=username, nvr_password=password, nvr_connection_state=None)


def probe(cand: Settings) -> dict[str, Any]:
    """deviceInfo, then the channel count - GET requests only, through the NVR module's client. Coarse result only."""
    from . import nvr

    try:
        info = nvr.device_info(cand)
    except ApiError as exc:
        code = exc.code
        if code == "source_unavailable" and "timeout" in str((exc.details or {}).get("error", "")).lower():
            code = "timeout"
        return {"ok": False, "code": code if code in OUTCOMES else "source_error"}
    except Exception:  # noqa: BLE001 - an unparsable answer is a device error, never a 500 with text
        return {"ok": False, "code": "source_error"}
    channels: int | None
    try:
        channels = len(nvr.discover_channels(cand))
    except Exception:  # noqa: BLE001 - the device answered deviceInfo; the channel count is optional
        channels = None
    clip = lambda v: (str(v)[:64] or None) if v else None  # noqa: E731 - device text, bounded
    return {"ok": True, "code": "ok", "model": clip(info.get("model")), "firmware": clip(info.get("firmware")), "channels": channels}


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


def restart_limiter() -> Limiter:
    return Limiter(per_user=1, total=1, window_s=120.0)
