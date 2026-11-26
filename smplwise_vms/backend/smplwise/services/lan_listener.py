"""The shared hardening of the add-on's small LAN listeners (the threaded `http.server` ones a TV or a recorder reaches without a
session): a ceiling on simultaneous connections, in total and per client address, and a per-request deadline.

- `CappedServer` - CR-NOTICE106 / NOTICECAPS-295 (moved here from services/notices/listener.py by CAST-RELAY-HARDEN-2540, which
  reuses it for the cast relay; the notice listener imports it back under its old name `_CappedServer`).
- `DeadlineReader` / `RequestDeadline` - CAST-RELAY-HARDEN-2540 (deep review V-02): `BaseHTTPRequestHandler.timeout` bounds ONE
  socket read, so a client that drips a byte just inside it keeps its thread for as long as it likes. The deadline bounds the
  whole wait for one request (the idle keep-alive gap plus the request line and the headers) instead.

No address, path or token is ever logged here."""
from __future__ import annotations

import io
import socket
import threading
import time
from http.server import ThreadingHTTPServer
from typing import Any, Callable

MAX_CONNECTIONS = 32
MAX_PER_ADDRESS = 8


class CappedServer(ThreadingHTTPServer):
    """ThreadingHTTPServer with a ceiling on simultaneous connections, in total and per client address: over a cap the socket is
    closed without a thread. `caps` (optional) returns (total, per_address) and is asked at every connection, so an administrator's
    change applies at once without a restart; a failing `caps` keeps the last good values (the defaults at first)."""

    daemon_threads = True

    def __init__(self, *args: Any, max_connections: int = MAX_CONNECTIONS, max_per_address: int = MAX_PER_ADDRESS,
                 caps: Callable[[], tuple[int, int]] | None = None, **kw: Any) -> None:
        super().__init__(*args, **kw)
        self._lock = threading.Lock()
        self._total = 0
        self._by_addr: dict[str, int] = {}
        self._caps = caps
        self._last = (max_connections, max_per_address)
        self.refused = 0  # connections closed over a cap since the start (a count only, never who)

    def _current_caps(self) -> tuple[int, int]:
        if self._caps is not None:
            try:
                total, per = self._caps()
                self._last = (int(total), int(per))
            except Exception:  # noqa: BLE001 - a settings read that fails must never open the gate or stop the listener
                pass
        return self._last

    @staticmethod
    def _addr(client_address: Any) -> str:
        return str(client_address[0]) if client_address else "-"

    def open_connections(self) -> int:
        with self._lock:
            return self._total

    def _release(self, addr: str) -> None:
        with self._lock:
            self._total -= 1
            left = self._by_addr.get(addr, 1) - 1
            if left > 0:
                self._by_addr[addr] = left
            else:
                self._by_addr.pop(addr, None)

    def process_request(self, request: Any, client_address: Any) -> None:
        total_cap, per_cap = self._current_caps()
        addr = self._addr(client_address)
        with self._lock:
            if self._total >= total_cap or self._by_addr.get(addr, 0) >= per_cap:
                admitted = False
                self.refused += 1
            else:
                admitted = True
                self._total += 1
                self._by_addr[addr] = self._by_addr.get(addr, 0) + 1
        if not admitted:
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, client_address)
        except Exception:
            self._release(addr)
            raise

    def process_request_thread(self, request: Any, client_address: Any) -> None:
        try:
            super().process_request_thread(request, client_address)
        finally:
            self._release(self._addr(client_address))


class DeadlineReader(io.RawIOBase):
    """The raw reader under a handler's `rfile`: every receive waits at most until the handler's current deadline (and never longer
    than `per_read_s`); past the deadline it raises TimeoutError, which `BaseHTTPRequestHandler.handle_one_request` answers by
    closing the connection. Without a deadline (None) it is a plain socket read with `per_read_s` as its timeout."""

    def __init__(self, sock: socket.socket, deadline: Callable[[], float | None], per_read_s: float) -> None:
        super().__init__()
        self._sock = sock
        self._deadline = deadline
        self._per_read_s = per_read_s

    def readable(self) -> bool:
        return True

    def readinto(self, b: Any) -> int:
        dl = self._deadline()
        wait = self._per_read_s
        if dl is not None:
            left = dl - time.monotonic()
            if left <= 0:
                raise TimeoutError("request deadline")
            wait = min(wait, left)
        self._sock.settimeout(wait)
        return self._sock.recv_into(b)


class RequestDeadline:
    """A mixin for a `BaseHTTPRequestHandler` (put it FIRST in the bases): one request - from the end of the previous answer (or the
    connection's start) to the end of its headers - must arrive within `request_deadline_s`; every socket read and write is bounded by
    `timeout` as well. A handler that reads a body calls `clear_deadline()` first (the relay serves bodiless GETs only)."""

    timeout: float | None = 15.0
    request_deadline_s: float = 15.0
    _deadline_at: float | None = None

    def setup(self) -> None:  # type: ignore[override]
        super().setup()  # type: ignore[misc]  # StreamRequestHandler: the socket timeout, rfile, wfile
        self.rfile = io.BufferedReader(DeadlineReader(self.connection, lambda: self._deadline_at, float(self.timeout or self.request_deadline_s)))  # type: ignore[attr-defined]

    def handle_one_request(self) -> None:
        self._deadline_at = time.monotonic() + self.request_deadline_s
        try:
            super().handle_one_request()  # type: ignore[misc]
        finally:
            self.clear_deadline()

    def clear_deadline(self) -> None:
        """The request is in: reads and writes from here on are bounded by `timeout` alone."""
        self._deadline_at = None
        try:
            self.connection.settimeout(self.timeout)  # type: ignore[attr-defined]
        except OSError:
            pass
