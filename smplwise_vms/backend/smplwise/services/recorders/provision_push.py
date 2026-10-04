"""Device push for Provision-ISR events (CR-025; owner decision 2026-10-04: push AND sampling, selectable per recorder,
sampling by default).

The device (after `ProvisionIsrAdapter.configure_push`, a write behind the approval gate) POSTs to `http://<add-on>:<port>`:
`/SendAlarmStatus` (the alarm levels), `/SendAlarmData` (feature data, ignored: Arx subscribes to status), a heartbeat
(`deviceInfo` only, or v2 `messageType keepalive` / `/SendKeepalive`) and `/SubscribeTimeOut`. v1 sends no credentials
and its path is fixed, so the listener authenticates by SOURCE ADDRESS: only the configured recorders' addresses are
answered, everything else gets 403 and is counted (never logged with its body).

`PushReceiver` is per recorder (pure: bytes in, `ParsedAlert` edges out, heartbeat watchdog); `PushListener` is the small
threaded HTTP server. Routing / authentication (add-on side, 2026-10-04):
- **path token** (default): the device posts to `/<token>/SendAlarmStatus` (or `/<token>` / `/<token>/<anything>`), the token
  is the recorder's own secret (`push_token`, derived from the installation key - never stored, never logged). A wrong or
  missing token is 403. A device whose alarm-server form has a URL / path field (v2 firmware, `url` on NVRs) uses this;
- **source address** (`push_auth: address`): for firmware that can only set address + port (the owner's NVR, firmware 1.4.7,
  answers GetAlarmServerConfig with serverAddr / serverPort only) - the recorder's resolved address is the credential;
- both can be required together (`push_auth: token_and_address`). The listener is not started by the add-on yet - the per-recorder
event loop of CR-024 starts it for recorders whose `event_mode` is `push` (hook, CR-025 section 5)."""
from __future__ import annotations

import logging
import threading
import time
import xml.etree.ElementTree as ET
from collections.abc import Callable
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from ..events_ingest import ParsedAlert
from . import provision_isr_xml as px
from .provision_isr import AlarmTracker

log = logging.getLogger("smplwise.provision_push")

MAX_BODY = 512 * 1024  # an alarm-status document is a few KB; feature data with images is ignored above this
# security review M1 (2026-10-04): bounded resources for a port open on the LAN
HANDLER_TIMEOUT_S = 10  # a client that sends its request line / headers / body slower than this is cut off
MAX_CONNECTIONS = 16  # concurrent connections in total (each is one thread)
MAX_PER_SOURCE = 4  # concurrent connections from one source address
RATE_PER_SOURCE = 20  # requests per second per source address (token bucket, burst = the same number)
PATHS = {"/SendAlarmStatus", "/SendAlarmData", "/SendKeepalive", "/SubscribeTimeOut", "/"}


class PushReceiver:
    def __init__(self, recorder_id: str, *, ipc: bool = False, heartbeat_s: int = 30, clock: Callable[[], float] = time.monotonic) -> None:
        self.recorder_id = recorder_id
        self.ipc = ipc
        self.heartbeat_s = heartbeat_s
        self._clock = clock
        self.tracker = AlarmTracker()
        self.last_message: float | None = None
        self.messages = 0
        self.invalid = 0
        self.timeouts = 0
        self._lock = threading.Lock()

    def handle(self, path: str, body: bytes) -> list[ParsedAlert]:
        with self._lock:
            self.last_message = self._clock()
            self.messages += 1
            if path == "/SubscribeTimeOut":
                self.timeouts += 1
                return []
            if path == "/SendAlarmData":
                return []  # feature data (boxes, images): not used
            try:
                msg = px.parse_push(body)
            except ET.ParseError:
                self.invalid += 1
                return []
            if msg["kind"] != "status":
                return []
            status = msg["status"]
            if msg["channel"] is not None:  # v2: deviceInfo/channelId names the channel of id-less items
                status = {(k, msg["channel"] if i is None and k != "sensorAlarmIn" else i): v for (k, i), v in status.items()}
            # a push carries the kinds that changed (or only the active ones on v2): unlisted kinds keep their last level
            merged = {**{k: True for k in self.tracker.active()}, **status}
            return self.tracker.update(merged, ipc=self.ipc, device_time=msg["data_time"] or "")

    def stale(self) -> bool:
        """No message (alarm or heartbeat) for three heartbeat intervals: the push path is down; the caller falls back to
        sampling and records a coverage gap."""
        with self._lock:
            return self.last_message is None or self._clock() - self.last_message > 3 * self.heartbeat_s

    def state(self) -> dict[str, Any]:
        with self._lock:
            age = None if self.last_message is None else round(self._clock() - self.last_message, 1)
            return {"messages": self.messages, "invalid": self.invalid, "timeouts": self.timeouts, "last_message_age_s": age}


class PushListener:
    def __init__(self, sources: dict[str, PushReceiver], sink: Callable[[str, list[ParsedAlert]], None], *, host: str = "0.0.0.0", port: int = 0,
                 tokens: dict[str, tuple[PushReceiver, str | None]] | None = None) -> None:
        self.sources = dict(sources)  # source address -> receiver (address-authenticated recorders)
        self.tokens = dict(tokens or {})  # path token -> (receiver, required source address or None)
        self.sink = sink
        self.refused = 0
        listener = self

        class Handler(BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.0"  # one request per connection: no keep-alive to hold a thread (M1)
            timeout = HANDLER_TIMEOUT_S  # socket timeout for every read (slow headers / body are cut off)

            def log_message(self, fmt: str, *args: Any) -> None:  # never log request lines (addresses) or bodies
                return

            def _answer(self, code: int) -> None:
                self.send_response(code)
                self.send_header("Content-Length", "0")
                self.end_headers()

            def do_GET(self) -> None:  # noqa: N802
                self._answer(405)

            def do_POST(self) -> None:  # noqa: N802
                self.close_connection = True
                if not listener.allow_rate(self.client_address[0]):
                    listener.limited += 1
                    self._answer(429)
                    return
                receiver, path = listener.route(self.client_address[0], self.path.split("?", 1)[0])
                if receiver is None:
                    listener.refused += 1
                    self.close_connection = True
                    self._answer(403)
                    return
                length = self.headers.get("Content-Length", "")
                if path not in PATHS or not length.isdigit():
                    self._answer(404 if path not in PATHS else 411)
                    return
                n = int(length)
                if n > MAX_BODY:
                    self.close_connection = True
                    self._answer(413)
                    return
                body = self.rfile.read(n)
                self._answer(200)
                try:
                    alerts = receiver.handle(path, body)
                    if alerts:
                        listener.sink(receiver.recorder_id, alerts)
                except Exception:  # noqa: BLE001 - one bad message never stops the listener
                    log.exception("provision push: message handling failed (recorder %s)", receiver.recorder_id)

        class BoundedServer(ThreadingHTTPServer):
            daemon_threads = True

            def process_request(self, request, client_address):  # noqa: ANN001
                if not listener.acquire(client_address[0]):
                    listener.limited += 1
                    try:
                        request.close()
                    finally:
                        return
                super().process_request(request, client_address)

            def process_request_thread(self, request, client_address):  # noqa: ANN001
                try:
                    super().process_request_thread(request, client_address)
                finally:
                    listener.release(client_address[0])

        self.limited = 0
        self._slots = threading.BoundedSemaphore(MAX_CONNECTIONS)
        self._per_source: dict[str, int] = {}
        self._buckets: dict[str, tuple[float, float]] = {}  # source -> (tokens, last refill)
        self._lock = threading.Lock()
        self._server = BoundedServer((host, port), Handler)
        self._thread: threading.Thread | None = None

    def acquire(self, source: str) -> bool:
        if not self._slots.acquire(blocking=False):
            return False
        with self._lock:
            if self._per_source.get(source, 0) >= MAX_PER_SOURCE:
                self._slots.release()
                return False
            self._per_source[source] = self._per_source.get(source, 0) + 1
        return True

    def release(self, source: str) -> None:
        with self._lock:
            n = self._per_source.get(source, 1) - 1
            if n <= 0:
                self._per_source.pop(source, None)
            else:
                self._per_source[source] = n
        self._slots.release()

    def allow_rate(self, source: str) -> bool:
        now = time.monotonic()
        with self._lock:
            tokens, last = self._buckets.get(source, (float(RATE_PER_SOURCE), now))
            tokens = min(float(RATE_PER_SOURCE), tokens + (now - last) * RATE_PER_SOURCE)
            ok = tokens >= 1.0
            self._buckets[source] = (tokens - 1.0 if ok else tokens, now)
            if len(self._buckets) > 1024:  # bounded memory under address churn
                self._buckets.clear()
        return ok

    def unregister(self, receiver: PushReceiver) -> None:
        """Security review L4: drop every token / address route of a stopped or removed recorder."""
        for tok in [t for t, (r, _a) in self.tokens.items() if r is receiver]:
            self.tokens.pop(tok, None)
        for addr in [a for a, r in self.sources.items() if r is receiver]:
            self.sources.pop(addr, None)

    def route(self, source: str, raw_path: str) -> tuple[PushReceiver | None, str]:
        """(receiver, the device path without the token) or (None, path) when the push is not authenticated."""
        parts = [p for p in raw_path.split("/") if p]
        if parts:
            hit = self.tokens.get(parts[0])
            if hit is not None:
                receiver, need_source = hit
                if need_source is not None and need_source != source:
                    return None, raw_path
                rest = "/" + "/".join(parts[1:])
                return receiver, rest if rest != "/" else "/SendAlarmStatus"
        receiver = self.sources.get(source)
        return receiver, raw_path

    @property
    def port(self) -> int:
        return int(self._server.server_address[1])

    def start(self) -> None:
        self._thread = threading.Thread(target=self._server.serve_forever, name="provision-push", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._server.shutdown()
        self._server.server_close()
        if self._thread is not None:
            self._thread.join(timeout=5)
