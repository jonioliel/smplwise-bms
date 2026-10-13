"""CR-038 slice 4, spec 14.2 "בדיקת כתובת" (review T11): does the configured public address reach this installation's handler
page? `POST /tickets/address/probe` fetches `<base>/t/healthz` - the only administrator-typed URL the module ever fetches.

SSRF rules: the base URL passes links.validate_public_base_url (https, a DNS name - never an IP literal -, no path, port 443);
the name is resolved ONCE and EVERY address must be public (not loopback, private / RFC 1918, link-local, CGNAT 100.64/10, the
hassio network 172.30.32.0/23, multicast, reserved, unspecified; IPv4-mapped IPv6 judged as its IPv4 address); the connection
goes to the validated address itself (no second resolution - DNS rebinding cannot swap it), TLS with the name as SNI and a
verified certificate; one GET with `Connection: close`, no redirect is ever followed, at most 4 KiB read, 5 s in all. The answer
is only reachable / not reachable / wrong answer with the status class - the body is never shown. The route is local-only
(remote_channel.BLOCKED_ON_REMOTE) and rate-limited (6 / minute)."""
from __future__ import annotations

import collections
import ipaddress
import secrets
import socket
import ssl
import threading
import time
from typing import Any, Callable
from urllib.parse import urlsplit

from .links import PublicUrlError, validate_public_base_url

TIMEOUT_S = 5.0
READ_MAX = 4096
PER_MINUTE = 6
_CGNAT = ipaddress.ip_network("100.64.0.0/10")
_HASSIO = ipaddress.ip_network("172.30.32.0/23")
_calls: collections.deque[float] = collections.deque()
_lock = threading.Lock()


def blocked(addr: str) -> bool:
    try:
        ip = ipaddress.ip_address(addr.split("%", 1)[0])
    except ValueError:
        return True
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        ip = ip.ipv4_mapped
    if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved or ip.is_unspecified:
        return True
    if isinstance(ip, ipaddress.IPv4Address) and (ip in _CGNAT or ip in _HASSIO):
        return True
    return False


def admit(clock: Callable[[], float] = time.monotonic) -> bool:
    """6 probes a minute, installation-wide."""
    now = clock()
    with _lock:
        while _calls and now - _calls[0] >= 60.0:
            _calls.popleft()
        if len(_calls) >= PER_MINUTE:
            return False
        _calls.append(now)
        return True


def _resolve(host: str) -> list[str]:
    infos = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
    out: list[str] = []
    for info in infos:
        addr = info[4][0]
        if addr not in out:
            out.append(addr)
    return out


def _fetch(addr: str, host: str, timeout_s: float, nonce: str) -> tuple[int, bytes]:
    """(status, the first bytes of the body) of `GET /t/healthz` from `addr` with TLS for `host`; `X-Ticket-Probe: <nonce>` lets
    the listener note which peer it came from and whether the client address came from the trusted header (W13)."""
    deadline = time.monotonic() + timeout_s
    raw = socket.create_connection((addr, 443), timeout=timeout_s)
    try:
        ctx = ssl.create_default_context()
        with ctx.wrap_socket(raw, server_hostname=host) as tls:
            tls.settimeout(max(0.1, deadline - time.monotonic()))
            tls.sendall((f"GET /t/healthz HTTP/1.1\r\nHost: {host}\r\nUser-Agent: SmplWise-Arx-address-probe\r\n"
                         f"Accept: application/json\r\nX-Ticket-Probe: {nonce}\r\nConnection: close\r\n\r\n").encode("ascii"))
            data = b""
            while len(data) < READ_MAX:
                left = deadline - time.monotonic()
                if left <= 0:
                    break
                tls.settimeout(left)
                chunk = tls.recv(READ_MAX - len(data))
                if not chunk:
                    break
                data += chunk
    finally:
        try:
            raw.close()
        except OSError:
            pass
    head, _, body = data.partition(b"\r\n\r\n")
    line = head.split(b"\r\n", 1)[0].split(b" ")
    status = int(line[1]) if len(line) >= 2 and line[1].isdigit() else 0
    return status, body


def probe(base_url: str, *, resolve: Callable[[str], list[str]] | None = None,
          fetch: Callable[[str, str, float, str], tuple[int, bytes]] | None = None,
          last_probe: Callable[[], dict[str, Any] | None] | None = None) -> dict[str, Any]:
    """{result: reachable | not_configured | invalid | unresolved | blocked_address | tls_error | unreachable | wrong_answer,
    code?, status_class?, listener?}. Never the body, never the resolved addresses.

    `last_probe` reads the running listener's note of the last `/t/healthz` that carried a probe nonce
    (public_server.SERVER.snapshot()["stats"]["last_probe"]): `listener.seen` says whether THIS installation's listener answered,
    `listener.source` whether the client address came from the trusted header (`header`) - anything else means the rate limits
    would key every vendor by the proxy (V3) and is a warning on the settings page; `listener.peer` is the proxy's address (for
    `trusted_proxy_cidrs`)."""
    resolve = resolve or _resolve
    fetch = fetch or _fetch
    if not base_url:
        return {"result": "not_configured"}
    try:
        base = validate_public_base_url(base_url)
    except PublicUrlError as exc:
        return {"result": "invalid", "code": exc.code}
    host = urlsplit(base).hostname or ""
    try:
        addrs = resolve(host)
    except (OSError, UnicodeError):
        return {"result": "unresolved"}
    if not addrs:
        return {"result": "unresolved"}
    if any(blocked(a) for a in addrs):
        return {"result": "blocked_address"}
    nonce = secrets.token_urlsafe(24)
    try:
        status, body = fetch(addrs[0], host, TIMEOUT_S, nonce)
    except ssl.SSLError:
        return {"result": "tls_error"}
    except (OSError, ValueError):
        return {"result": "unreachable"}
    if not (status == 200 and (b'"ok":true' in body or b'"ok": true' in body)):
        return {"result": "wrong_answer", "status_class": f"{status // 100}xx" if status else "none"}
    out: dict[str, Any] = {"result": "reachable"}
    if last_probe is not None:
        note = last_probe() or {}
        if note.get("nonce") == nonce:
            out["listener"] = {"seen": True, "source": note.get("source"), "peer": str(note.get("peer") or "")[:64],
                               "header_ok": note.get("source") == "header"}
        else:
            out["listener"] = {"seen": False}
    return out
