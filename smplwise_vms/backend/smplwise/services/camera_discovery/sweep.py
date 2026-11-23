"""The unicast WS-Discovery sweep (ONVIF-DISCOVER-2500; owner decision 2026-11-22, Q55: "Arx probes each address of the range
directly"; design 4.1, D5, D6).

One UDP socket, a Probe datagram to port 3702 of every address of the checked range, PACED (`rate_pps`, default 50 datagrams a
second: a /22 takes about 20 s a round), two rounds (round 1 asks for video transmitters, round 2 asks the addresses that did not
answer for any ONVIF device), then a listen window. Nothing else is sent: no port scan, no TCP - except the optional HTTP fallback
(`cameras.discovery_http_fallback`, off by default), which sends ONE unauthenticated `GetSystemDateAndTime` to port 80 of each
address that stayed silent, with bounded concurrency (HTTP_WORKERS) and the same pacing.

An answer is accepted only from an address that was probed, and - when it names the probe it answers (`RelatesTo`) - only for a
probe sent to that same address (a stray or spoofed answer for another address is dropped). Every answer is read by
services/camera_discovery/wsd.py (size cap, safe XML, bounded values).

Cancellation (`cancelled` event) is checked between datagrams and at least every POLL_S while listening; the whole sweep also
stops at `deadline_s`. Seams: `transport_factory` (tests pass an in-memory fake network or a loopback socket), `clock`."""
from __future__ import annotations

import socket
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Callable, Iterable, Protocol

from . import onvif_http, wsd

WSD_PORT = 3702
POLL_S = 0.05
HTTP_WORKERS = 8
HTTP_TIMEOUT_S = 2.0


class Transport(Protocol):
    def send(self, address: str, payload: bytes) -> None: ...

    def recv(self, timeout: float) -> tuple[bytes, str] | None: ...

    def close(self) -> None: ...


class UdpTransport:
    """The real one: an unbound-port IPv4 UDP socket (the container's NAT carries each answer back to it)."""

    def __init__(self, port: int = WSD_PORT) -> None:
        self.port = port
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.bind(("0.0.0.0", 0))

    def send(self, address: str, payload: bytes) -> None:
        self.sock.sendto(payload, (address, self.port))

    def recv(self, timeout: float) -> tuple[bytes, str] | None:
        self.sock.settimeout(max(0.001, timeout))
        try:
            data, src = self.sock.recvfrom(wsd.MAX_DATAGRAM + 1)
        except (socket.timeout, BlockingIOError, InterruptedError):
            return None
        except OSError:  # an ICMP "port unreachable" surfaced as ECONNREFUSED on some systems: just no answer
            return None
        return data, str(src[0])

    def close(self) -> None:
        try:
            self.sock.close()
        except OSError:
            pass


@dataclass
class Found:
    """One accepted answer: the address it came from, the engine and what the device said."""

    address: str
    engine: str  # unicast | http
    match: wsd.ProbeMatch | None = None
    target: onvif_http.Target | None = None
    clock_offset_s: float | None = None
    xaddrs_dropped: int = 0


@dataclass
class Stats:
    sent: int = 0
    send_errors: int = 0
    answers: int = 0
    rejected: int = 0  # not a ProbeMatches / unsafe / from an address not probed / for another address's probe
    http_checked: int = 0
    cancelled: bool = False
    timed_out: bool = False
    answered: set[str] = field(default_factory=set)


@dataclass
class Config:
    rate_pps: int = 50
    rounds: int = 2
    listen_s: float = 4.0
    deadline_s: float = 600.0
    http_fallback: bool = False
    http_port: int = 80


class _Pacer:
    """At most `rate` sends a second across every thread that shares it."""

    def __init__(self, rate: int, clock: Callable[[], float]) -> None:
        self.interval = 1.0 / max(1, rate)
        self.clock = clock
        self.next_at = clock()
        self.lock = threading.Lock()

    def wait_s(self) -> float:
        return max(0.0, self.next_at - self.clock())

    def take(self) -> None:
        with self.lock:
            self.next_at = max(self.next_at, self.clock()) + self.interval


def _targets_of(found: wsd.ProbeMatch, address: str) -> tuple[onvif_http.Target | None, int]:
    kept, dropped = wsd.same_host_xaddrs(found.xaddrs, address)
    if not kept:
        return None, dropped
    scheme, port, path = next((k for k in kept if k[0] == "http"), kept[0])  # plain http first: what most cameras serve ONVIF on
    return onvif_http.Target(address, port, path, scheme), dropped


def sweep(targets: Iterable[str], *, config: Config, on_found: Callable[[Found], None], cancelled: threading.Event,
          on_progress: Callable[[int], None] | None = None, transport_factory: Callable[[], Transport] = UdpTransport,
          clock: Callable[[], float] = time.monotonic) -> Stats:
    """Run the sweep; every accepted device is passed to `on_found` (from this thread), the number of addresses checked so far
    to `on_progress`. Returns the counters. Never raises for a network problem."""
    order = list(dict.fromkeys(targets))
    wanted = set(order)
    stats = Stats()
    start = clock()
    sent_ids: dict[str, str] = {}  # MessageID -> the address it was sent to
    pacer = _Pacer(config.rate_pps, clock)

    def stop() -> bool:
        if cancelled.is_set():
            stats.cancelled = True
            return True
        if clock() - start > config.deadline_s:
            stats.timed_out = True
            return True
        return False

    def handle(data: bytes, src: str) -> None:
        if src not in wanted:
            stats.rejected += 1
            return
        try:
            matches = wsd.parse_probe_matches(data)
        except wsd.NotAProbeMatch:
            stats.rejected += 1
            return
        for m in matches:
            if m.relates_to is not None and sent_ids.get(m.relates_to) != src:
                stats.rejected += 1
                continue
            target, dropped = _targets_of(m, src)
            stats.answers += 1
            stats.answered.add(src)
            on_found(Found(address=src, engine="unicast", match=m, target=target, xaddrs_dropped=dropped))

    def drain(until: float, transport: Transport) -> None:
        while not stop():
            left = until - clock()
            if left <= 0:
                return
            got = transport.recv(min(POLL_S, left))
            if got is not None:
                handle(*got)

    try:
        transport = transport_factory()
    except OSError:
        stats.send_errors = len(order)
        return stats
    try:
        checked = 0
        for rnd in range(max(1, config.rounds)):
            types = wsd.PROBE_TYPES[min(rnd, len(wsd.PROBE_TYPES) - 1)]
            for address in order:
                if stop():
                    return stats
                if rnd > 0 and address in stats.answered:
                    continue
                drain(clock() + pacer.wait_s(), transport)
                if stop():
                    return stats
                mid = wsd.new_message_id()
                sent_ids[mid] = address
                try:
                    transport.send(address, wsd.probe(mid, types))
                    stats.sent += 1
                except OSError:
                    stats.send_errors += 1
                pacer.take()
                if rnd == 0:
                    checked += 1
                    if on_progress is not None:
                        on_progress(checked)
            drain(clock() + config.listen_s, transport)
    finally:
        transport.close()
    if config.http_fallback and not stop():
        _http_fallback([a for a in order if a not in stats.answered], config, on_found, stats, stop, pacer)
    return stats


def _http_fallback(addresses: list[str], config: Config, on_found: Callable[[Found], None], stats: Stats, stop: Callable[[], bool],
                   pacer: _Pacer) -> None:
    """ONE unauthenticated GetSystemDateAndTime per silent address, HTTP_WORKERS at a time, paced like the datagrams."""
    lock = threading.Lock()

    def one(address: str) -> None:
        if stop():
            return
        with pacer.lock:
            wait = pacer.wait_s()
            pacer.next_at = max(pacer.next_at, pacer.clock()) + pacer.interval
        if wait > 0:
            time.sleep(min(wait, 1.0))
        if stop():
            return
        target = onvif_http.Target(address, config.http_port)
        clock_answer = onvif_http.device_clock(target, timeout=HTTP_TIMEOUT_S)
        with lock:
            stats.http_checked += 1
        if clock_answer is not None and clock_answer.onvif:
            on_found(Found(address=address, engine="http", target=target, clock_offset_s=clock_answer.offset_s))

    with ThreadPoolExecutor(max_workers=HTTP_WORKERS, thread_name_prefix="onvif-http") as pool:
        list(pool.map(one, addresses))
