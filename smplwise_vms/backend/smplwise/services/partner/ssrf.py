"""PARTNERAPI113-295: the webhook target check (CR section 6.6), run at create / update and AGAIN before every attempt.

1. Syntax: `https://` only; a host name or an IP literal in canonical form; the port is one of ALLOWED_PORTS (owner answer 165: the partner
   ports are 9443 and 9453 - never 443 / 8443, port 443 belongs to the home system); no user-info, no fragment, <= 2048 characters, no
   control or white-space characters; an IDN becomes A-labels; decimal / octal / hex / shortened IPv4 forms are refused as syntax.
2. Names: the platform's names (connection_probe.REFUSED_NAMES), `*.localhost` / `.local` / `.internal` / `.lan` / `.home.arpa`, this machine's
   own name and the extra names the caller passes (the home system's host, the remote-access host).
3. Addresses: one resolution; EVERY answer must be globally routable (no private, loopback, link-local / metadata, CGNAT, multicast, reserved,
   documentation, ULA, mapped / NAT64 / 6to4 / Teredo hiding a refused IPv4, the platform networks, this machine, the trusted proxies).
4. The caller connects to the CHECKED address (TLS SNI and Host = the name) - a DNS answer that changes in between cannot steer the request.
Seams for tests: RESOLVE, HOSTNAME, LOCAL_ADDRESSES (nothing here ever resolves a real name in a test)."""
from __future__ import annotations

import ipaddress
import re
import socket
from dataclasses import dataclass
from typing import Callable, Iterable
from urllib.parse import urlsplit

from ..connection_probe import REFUSED_NAMES, REFUSED_NETWORKS

ALLOWED_PORTS = frozenset({9443, 9453})
URL_MAX = 2048
REFUSED_SUFFIXES = (".localhost", ".local", ".internal", ".lan", ".home.arpa", ".localdomain", ".intranet", ".corp")
_LABEL = re.compile(r"(?!-)[a-z0-9-]{1,63}(?<!-)")
_EXTRA_NETWORKS = tuple(ipaddress.ip_network(n) for n in (
    "0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16", "172.16.0.0/12", "192.0.0.0/24", "192.0.2.0/24",
    "192.88.99.0/24", "192.168.0.0/16", "198.18.0.0/15", "198.51.100.0/24", "203.0.113.0/24", "224.0.0.0/4", "240.0.0.0/4",
    "255.255.255.255/32", "::/128", "::1/128", "::ffff:0:0/96", "64:ff9b::/96", "64:ff9b:1::/48", "100::/64", "2001::/23", "2001:db8::/32",
    "2002::/16", "fc00::/7", "fe80::/10", "fec0::/10", "ff00::/8",
))


class Refused(Exception):
    """The target is refused. `code` is the delivery-log error class; nothing else (never the URL)."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class Target:
    scheme: str
    host: str  # A-label, lower case, no trailing dot (IPv6 without brackets)
    port: int
    path: str  # path + query, never empty ("/")
    literal: bool

    @property
    def host_header(self) -> str:
        h = f"[{self.host}]" if ":" in self.host else self.host
        return f"{h}:{self.port}"


def _default_resolve(host: str) -> list[str]:
    try:
        infos = socket.getaddrinfo(host, None, proto=socket.IPPROTO_TCP)
    except (socket.gaierror, UnicodeError, OSError):
        return []
    return list(dict.fromkeys(str(i[4][0]) for i in infos))


RESOLVE: Callable[[str], list[str]] = _default_resolve
HOSTNAME: Callable[[], str] = socket.gethostname
LOCAL_ADDRESSES: Callable[[], set[str]] = lambda: set()  # noqa: E731 - tests replace it


def _literal(host: str) -> ipaddress.IPv4Address | ipaddress.IPv6Address | None:
    try:
        return ipaddress.ip_address(host)
    except ValueError:
        return None


def parse(url: object, *, ports: frozenset[int] = ALLOWED_PORTS, default_port: int | None = None) -> Target:
    """Step 1 (syntax) and step 2 (names). Raises Refused('syntax' | 'scheme' | 'port' | 'refused_name').
    `ports` / `default_port`: the webhook defaults (9443 / 9453, an explicit port required); another outgoing fetch that reuses this
    check (the notice-board news feeds, SEC217) passes its own allowed ports and the port a URL without one means."""
    if not isinstance(url, str) or not url or len(url) > URL_MAX:
        raise Refused("syntax")
    if any(ord(c) <= 32 or ord(c) == 127 for c in url) or "\\" in url:
        raise Refused("syntax")
    try:
        parts = urlsplit(url)
    except ValueError:
        raise Refused("syntax") from None
    if parts.scheme.lower() != "https":
        raise Refused("scheme")
    if parts.username is not None or parts.password is not None or "@" in parts.netloc or parts.fragment or url.endswith("#"):
        raise Refused("syntax")
    try:
        port = parts.port
    except ValueError:
        raise Refused("syntax") from None
    if port is None:
        port = default_port
    if port is None or port not in ports:
        raise Refused("port")
    raw = parts.hostname or ""
    if not raw:
        raise Refused("syntax")
    if parts.netloc.startswith("["):  # an IPv6 literal
        ip = _literal(raw)
        if not isinstance(ip, ipaddress.IPv6Address) or "%" in raw:
            raise Refused("syntax")
        host, literal = str(ip), True
    else:
        host = raw.rstrip(".").lower()
        if not host or raw.endswith(".."):
            raise Refused("syntax")
        if re.fullmatch(r"[0-9.]+|0x[0-9a-f.x]+|[0-9a-fx.]*\.0x[0-9a-f]+[0-9a-fx.]*", host):
            # only the canonical dotted-quad is an IPv4 literal; 2130706433, 0177.0.0.1, 0x7f.1, 127.1 are refused as syntax
            ip = _literal(host)
            if ip is None or str(ip) != host:
                raise Refused("syntax")
            literal = True
        else:
            try:
                host = host.encode("idna").decode("ascii")
            except UnicodeError:
                raise Refused("syntax") from None
            if len(host) > 253 or not all(_LABEL.fullmatch(lbl) for lbl in host.split(".")):
                raise Refused("syntax")
            own = (HOSTNAME() or "").strip().lower().rstrip(".")
            if host in REFUSED_NAMES or host.endswith(REFUSED_SUFFIXES) or (own and host in (own, own.split(".")[0])):
                raise Refused("refused_name")
            if "." not in host:  # a single-label name only ever resolves on a local network
                raise Refused("refused_name")
            literal = False
    path = parts.path or "/"
    if parts.query:
        path += "?" + parts.query
    return Target("https", host, port, path, literal)


def address_refused(ip: ipaddress.IPv4Address | ipaddress.IPv6Address, own: Iterable[str] = (), trusted: Iterable[str] = ()) -> bool:
    if isinstance(ip, ipaddress.IPv6Address):
        if ip.ipv4_mapped is not None:
            return address_refused(ip.ipv4_mapped, own, trusted) or True
        if ip.sixtofour is not None or ip.teredo is not None:
            return True
        if ip in ipaddress.ip_network("64:ff9b::/96"):
            return True
        if ip.packed[:12] == b"\x00" * 12:  # IPv4-compatible (deprecated) - judged refused whatever it embeds
            return True
    if not ip.is_global or ip.is_multicast or ip.is_reserved or ip.is_loopback or ip.is_link_local or ip.is_private or ip.is_unspecified:
        return True
    if any(ip.version == n.version and ip in n for n in _EXTRA_NETWORKS + tuple(REFUSED_NETWORKS)):
        return True
    text = str(ip)
    return text in set(own) or text in set(trusted)


def own_addresses() -> set[str]:
    out: set[str] = set()
    try:
        out |= set(LOCAL_ADDRESSES())
    except Exception:  # noqa: BLE001
        pass
    name = (HOSTNAME() or "").strip()
    if name:
        try:
            out |= set(RESOLVE(name))
        except Exception:  # noqa: BLE001
            pass
    return out


def check(target: Target, *, extra_names: Iterable[str] = (), trusted: Iterable[str] = ()) -> str:
    """Steps 2-3: the ONE address to connect to. Raises Refused('refused_name' | 'refused_address' | 'dns')."""
    names = {n.strip().lower().rstrip(".") for n in extra_names if n}
    if not target.literal and target.host in names:
        raise Refused("refused_name")
    own = own_addresses()
    if target.literal:
        ip = ipaddress.ip_address(target.host)
        if address_refused(ip, own, trusted):
            raise Refused("refused_address")
        return str(ip)
    try:
        answers = RESOLVE(target.host)
    except Exception:  # noqa: BLE001
        answers = []
    ips = []
    for a in answers or []:
        ip = _literal(str(a).split("%", 1)[0])
        if ip is None:
            raise Refused("refused_address")
        ips.append(ip)
    if not ips:
        raise Refused("dns")
    if any(address_refused(ip, own, trusted) for ip in ips):
        raise Refused("refused_address")
    return str(ips[0])


def validate(url: object, *, extra_names: Iterable[str] = (), trusted: Iterable[str] = (), resolve: bool = True) -> tuple[Target, str | None]:
    target = parse(url)
    return target, (check(target, extra_names=extra_names, trusted=trusted) if resolve else None)
