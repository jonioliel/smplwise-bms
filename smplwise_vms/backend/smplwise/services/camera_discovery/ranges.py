"""Which addresses a camera scan may probe (ONVIF-DISCOVER-2500; owner decision 2026-11-22, Q56: "only the site's own network, up to
1,024 addresses"; design section 4.1 and D5).

The site's own network is what the HOME ASSISTANT HOST's interfaces are on - not the add-on container's (it sits on the
Supervisor's internal bridge network, 172.30.32.0/23, which is never a site network). It is read from the Supervisor
(`GET /network/info`, through the single allow-listed door services/self_update.py, read only) and kept for CACHE_S. Only
RFC 1918 IPv4 interface networks count (no loopback, link-local, CGNAT / overlay VPN, public, documentation or
Supervisor-internal network).

A requested range is accepted only when it is (1) an IPv4 network, (2) at most MAX_ADDRESSES addresses (and at most the
`cameras.discovery_range_max` setting), (3) inside one of the site networks, and (4) inside one of the administrator's
`cameras.discovery_allowed_ranges` when that setting is not empty (it may only NARROW the site network, never widen it). An
arbitrary private range is refused (Q56). Without a known site network every range is refused (`site_network_unknown`): the
scan fails closed. The probe list leaves out the network and broadcast addresses, the host's own addresses and every address
source_policy.address_refused refuses."""
from __future__ import annotations

import ipaddress
import threading
import time
from dataclasses import dataclass
from typing import Any, Callable, Iterable

from ...config import Settings
from ...test_reset import register_reset
from .. import self_update, source_policy

MAX_ADDRESSES = 1024  # Q56: a /22 at most
MIN_PREFIX = 22
SUGGESTED_PREFIX = 24
CACHE_S = 60.0
SUPERVISOR_TIMEOUT_S = 5.0
SUPERVISOR_NETWORKS = (ipaddress.ip_network("172.30.32.0/23"),)  # the Supervisor's own bridge network: the add-on's, never the site's
SITE_PRIVATE = tuple(ipaddress.ip_network(n) for n in ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"))  # RFC 1918: a LAN

IPv4Iface = ipaddress.IPv4Interface


class RangeRefused(ValueError):
    """`code`: range_invalid | range_too_large | range_refused | site_network_unknown."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class Plan:
    network: ipaddress.IPv4Network
    targets: tuple[str, ...]


def _site_interface(text: Any) -> IPv4Iface | None:
    try:
        iface = ipaddress.ip_interface(str(text).strip())
    except ValueError:
        return None
    if not isinstance(iface, ipaddress.IPv4Interface):
        return None
    net = iface.network
    if not any(net.subnet_of(n) for n in SITE_PRIVATE):  # RFC 1918 only (ipaddress.is_private also says yes to documentation ranges)
        return None
    if any(net.overlaps(n) for n in SUPERVISOR_NETWORKS):
        return None
    return iface


def parse_network_info(data: Any) -> list[IPv4Iface]:
    """The site interfaces from the Supervisor's `/network/info` data: every enabled, connected interface's IPv4 addresses
    (`ipv4.address`: ["192.0.2.10/24", ...]) that pass `_site_interface`. Anything malformed is skipped."""
    out: list[IPv4Iface] = []
    ifaces = data.get("interfaces") if isinstance(data, dict) else None
    for it in ifaces if isinstance(ifaces, list) else []:
        if not isinstance(it, dict) or it.get("enabled") is False or it.get("connected") is False:
            continue
        ipv4 = it.get("ipv4") if isinstance(it.get("ipv4"), dict) else {}
        addrs = ipv4.get("address") if isinstance(ipv4.get("address"), list) else []
        for a in addrs[:8]:
            iface = _site_interface(a)
            if iface is not None and iface not in out:
                out.append(iface)
    return out


def _from_supervisor(settings: Settings) -> list[IPv4Iface]:
    if not self_update.configured(settings):
        return []
    reply = self_update.call(settings, "GET", self_update.P_NETWORK_INFO, timeout=SUPERVISOR_TIMEOUT_S)
    return parse_network_info(reply.data) if reply.kind == "ok" else []


# seam: tests replace it with a fixed list (nothing in a test reaches a Supervisor)
SITE_INTERFACES: Callable[[Settings], list[IPv4Iface]] = _from_supervisor
_CACHE: dict[str, tuple[float, list[IPv4Iface]]] = {}
_CACHE_LOCK = threading.Lock()


def site_interfaces(settings: Settings, *, clock: Callable[[], float] = time.monotonic) -> list[IPv4Iface]:
    """The host's site interfaces (address + its network), cached CACHE_S. An empty answer is cached too (a missing Supervisor
    is not asked again on every press)."""
    now = clock()
    with _CACHE_LOCK:
        hit = _CACHE.get("site")
        if hit is not None and now - hit[0] < CACHE_S:
            return list(hit[1])
    found = [i for i in (SITE_INTERFACES(settings) or []) if _site_interface(str(i)) is not None]
    with _CACHE_LOCK:
        _CACHE["site"] = (now, found)
    return list(found)


def suggested_range(ifaces: Iterable[IPv4Iface]) -> str | None:
    """The default range of the scan screen: the /24 around the host's first site address (or its own network when smaller)."""
    for iface in ifaces:
        prefix = max(iface.network.prefixlen, SUGGESTED_PREFIX)
        return str(ipaddress.ip_network(f"{iface.ip}/{prefix}", strict=False))
    return None


def parse_allowed(raw: Any) -> list[ipaddress.IPv4Network]:
    """The `cameras.discovery_allowed_ranges` setting: comma / space separated IPv4 CIDRs; anything else in it is ignored."""
    out: list[ipaddress.IPv4Network] = []
    for part in str(raw or "").replace(",", " ").split()[:32]:
        try:
            net = ipaddress.ip_network(part, strict=False)
        except ValueError:
            continue
        if isinstance(net, ipaddress.IPv4Network) and net not in out:
            out.append(net)
    return out


def plan(text: Any, ifaces: list[IPv4Iface], *, allowed: list[ipaddress.IPv4Network] | None = None, max_addresses: int = MAX_ADDRESSES) -> Plan:
    """The checked range and the addresses to probe, or RangeRefused. `max_addresses` is clamped to MAX_ADDRESSES whatever the
    setting says."""
    cap = max(1, min(int(max_addresses), MAX_ADDRESSES))
    if not isinstance(text, str) or not text.strip() or len(text) > 64:
        raise RangeRefused("range_invalid")
    try:
        net = ipaddress.ip_network(text.strip(), strict=False)
    except ValueError:
        raise RangeRefused("range_invalid") from None
    if not isinstance(net, ipaddress.IPv4Network):
        raise RangeRefused("range_invalid")
    if net.num_addresses > cap:
        raise RangeRefused("range_too_large")
    if not ifaces:
        raise RangeRefused("site_network_unknown")
    if not any(net.subnet_of(i.network) for i in ifaces):
        raise RangeRefused("range_refused")
    if allowed and not any(net.subnet_of(a) for a in allowed):
        raise RangeRefused("range_refused")
    own = {i.ip for i in ifaces}
    hosts = net.hosts() if net.prefixlen < 31 else iter(net)  # hosts(): without the network and broadcast addresses
    targets = tuple(str(ip) for ip in hosts if ip not in own and not source_policy.address_refused(ip))
    if not targets:
        raise RangeRefused("range_refused")
    return Plan(net, targets)


def _reset_for_tests() -> None:
    with _CACHE_LOCK:
        _CACHE.clear()


register_reset(__name__, ("_CACHE",), _reset_for_tests)
