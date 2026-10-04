"""Provision-ISR events for the per-recorder event loop (CR-025 on CR-024).

`events_ingest.AlertStreamListener` is the per-recorder pipeline (reader thread -> bounded queue -> writer thread ->
`store_alert` with the recorder's camera lookup, dedup, rules, WebSocket publish, coverage gaps). For a Provision recorder
its reader is `run_loop` below instead of the ISAPI alert stream:

- `event_mode = poll` (default): GetAlarmStatus (+ channel status when the device does not report chlOfflineAlarm) every
  `poll_interval_s` (default 2 s, never below 1 s), edges by `AlarmTracker`;
- `event_mode = push`: the device posts to the add-on's `PushListener` (one per process, `push_port`, default 18091,
  answering only the configured recorders' addresses). While the push path is healthy no polling happens; when it is stale
  (no message for three heartbeat intervals) the loop polls, so choosing push never loses events. Pointing the device at
  the listener is a device write (`configure_push`, behind the approval gate) and is NOT done here.

A disconnection longer than GAP_AFTER_S records a coverage gap exactly like the alert stream. Read-only against the device."""
from __future__ import annotations

import datetime as dt
import logging
import socket
import threading
import time
from typing import TYPE_CHECKING, Any

from ...errors import ApiError
from .provision_isr import AlarmTracker, ProvisionIsrAdapter
from .provision_push import PushListener, PushReceiver

if TYPE_CHECKING:
    from ..events_ingest import AlertStreamListener

log = logging.getLogger("smplwise.provision_events")
DEFAULT_PUSH_PORT = 18091

_PUSH_LOCK = threading.Lock()
_PUSH: PushListener | None = None
_RECEIVERS: dict[str, PushReceiver] = {}  # recorder id -> receiver
_SINKS: dict[str, "AlertStreamListener"] = {}


def _extra(settings: Any) -> dict[str, Any]:
    return settings.nvr_extra if isinstance(settings.nvr_extra, dict) else {}


def _sink(recorder_id: str, alerts: list) -> None:
    listener = _SINKS.get(recorder_id)
    if listener is not None:
        for a in alerts:
            listener.submit(a)


def _register_push(listener: "AlertStreamListener", adapter: ProvisionIsrAdapter) -> PushReceiver | None:
    """Attach this recorder to the process-wide push listener (started on first use). None when it cannot listen."""
    global _PUSH
    s = listener.settings
    try:
        address = socket.gethostbyname(s.nvr_host or "")
    except OSError:
        return None
    port = int(_extra(s).get("push_port") or DEFAULT_PUSH_PORT)
    receiver = PushReceiver(listener.recorder_id, ipc=False, heartbeat_s=int(_extra(s).get("push_heartbeat_s") or 30))
    with _PUSH_LOCK:
        _RECEIVERS[listener.recorder_id] = receiver
        _SINKS[listener.recorder_id] = listener
        if _PUSH is None:
            try:
                _PUSH = PushListener({}, _sink, host="0.0.0.0", port=port)
                _PUSH.start()
            except OSError as exc:
                log.warning("provision push listener could not start on port %s: %s", port, type(exc).__name__)
                _PUSH = None
                return None
        _PUSH.sources[address] = receiver
    return receiver


def stop_push() -> None:
    global _PUSH
    with _PUSH_LOCK:
        if _PUSH is not None:
            _PUSH.stop()
        _PUSH = None
        _RECEIVERS.clear()
        _SINKS.clear()


def push_states() -> dict[str, dict[str, Any]]:
    with _PUSH_LOCK:
        return {rid: {**r.state(), "stale": r.stale()} for rid, r in _RECEIVERS.items()}


def run_loop(listener: "AlertStreamListener", *, adapter: ProvisionIsrAdapter | None = None, sleep=None) -> None:
    """The reader of a Provision recorder's AlertStreamListener (see module doc). Never raises."""
    from ..events_ingest import GAP_AFTER_S, publish, record_gap
    from ...db import now_iso, retry_locked

    s = listener.settings
    st = listener.state
    ad = adapter or ProvisionIsrAdapter(listener.recorder_id, s)
    interval = max(1.0, float(_extra(s).get("poll_interval_s") or 2.0))
    tracker = AlarmTracker()
    receiver = _register_push(listener, ad) if ad.event_mode() == "push" else None
    wait = sleep or listener.stop.wait
    backoff = 5.0
    while not listener.stop.is_set():
        if receiver is not None and not receiver.stale():
            st.connected = True
            st.last_heartbeat_at = now_iso()
            wait(1.0)
            continue
        try:
            alerts = ad.poll_events(tracker)
        except ApiError as exc:
            st.last_error = exc.code
            if st.connected:
                st.reconnects += 1
            st.connected = False
            if st.disconnected_since is None:
                st.disconnected_since = time.time()
            log.warning("provision events (%s): %s (retry in %.0fs)", listener.recorder_id, exc.code, backoff)
            wait(backoff)
            backoff = min(60.0, backoff * 2)
            continue
        except Exception:  # noqa: BLE001 - never die
            log.exception("provision events (%s) crashed; retrying", listener.recorder_id)
            wait(backoff)
            backoff = min(60.0, backoff * 2)
            continue
        if st.disconnected_since is not None:
            gap = time.time() - st.disconnected_since
            if gap >= GAP_AFTER_S and listener.db is not None:
                since, until, why = dt.datetime.fromtimestamp(st.disconnected_since, dt.timezone.utc), dt.datetime.now(dt.timezone.utc), st.last_error or "disconnected"

                def _gap() -> dict[str, Any]:
                    with listener.db.connection() as conn:
                        return record_gap(conn, since, until, why, recorder_id=listener.recorder_id)

                publish(retry_locked(_gap, what="provision events gap"))
            st.disconnected_since = None
        st.connected = True
        st.last_error = None
        st.last_heartbeat_at = now_iso()
        backoff = 5.0
        for a in alerts:
            listener.submit(a)
        wait(interval)
    st.connected = False
