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


AUTH_MODES = ("token", "address", "token_and_address")


def _poll_interval(value: Any) -> float:
    """Security review Low: a stored value that is not a number (saved before validation) falls back to 2 s with a warning
    instead of ending the event loop; bounded to 1..3600 s."""
    try:
        return min(3600.0, max(1.0, float(value or 2.0)))
    except (TypeError, ValueError):
        log.warning("provision: poll_interval_s is not a number; using 2 s")
        return 2.0


PUSH_KEY_NAME = "push.key"
PUSH_GENERATIONS_NAME = "push_generations.json"
_GEN_LOCK = threading.Lock()


def _push_key_dir(settings: Any):  # noqa: ANN202
    from ..connection_store import key_path

    return key_path(settings).parent


def push_generation(settings: Any, recorder_id: str) -> int:
    import json

    p = _push_key_dir(settings) / PUSH_GENERATIONS_NAME
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
        return int(data.get(recorder_id, 0)) if isinstance(data, dict) else 0
    except (OSError, ValueError, TypeError):
        return 0


def bump_push_generation(settings: Any, recorder_id: str) -> int:
    """A removed recorder's push token is retired for good: the next recorder with the same id gets a new token, so a device
    still configured with the old path (a replaced or stolen unit) is refused. Atomic write (temp file + replace)."""
    import json
    import os
    import secrets

    d = _push_key_dir(settings)
    p = d / PUSH_GENERATIONS_NAME
    with _GEN_LOCK:
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
            data = data if isinstance(data, dict) else {}
        except (OSError, ValueError):
            data = {}
        gen = int(data.get(recorder_id, 0) or 0) + 1
        data[recorder_id] = gen
        d.mkdir(parents=True, exist_ok=True)
        tmp = d / f".{PUSH_GENERATIONS_NAME}.{secrets.token_hex(4)}.tmp"
        tmp.write_text(json.dumps(data, sort_keys=True), encoding="utf-8")
        try:
            os.chmod(tmp, 0o600)
        except OSError:
            pass
        os.replace(tmp, p)
    return gen


def push_token(settings: Any, recorder_id: str) -> str | None:
    """The recorder's push path token: HMAC-SHA256(push secret, "provision-push|<recorder>|<generation>")[:32].
    Security review finding 5: the push secret is its own random per-installation key (keys/push.key, 0600), not the key that
    encrypts the stored passwords, and the recorder generation (bumped when the recorder is removed) retires the token of a
    removed recorder even when its id is reused. Never stored; None when the key cannot be created."""
    import hashlib
    import hmac

    from ..connection_store import _load_or_create_key

    key = _load_or_create_key(settings, create=True, path=_push_key_dir(settings) / PUSH_KEY_NAME)
    if not key:
        return None
    gen = push_generation(settings, recorder_id)
    return hmac.new(key, f"provision-push|{recorder_id}|{gen}".encode("utf-8"), hashlib.sha256).hexdigest()[:32]


def _local_address_towards(host: str) -> str | None:
    """The local address this machine uses to reach `host` (a UDP connect sends no packet)."""
    try:
        target = socket.gethostbyname(host)
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect((target, 9))
            return s.getsockname()[0]
    except OSError:
        return None


def push_target(settings: Any, recorder_id: str) -> dict[str, Any]:
    """What the device must be told (configure_push): the address and port the ADD-ON is reachable at from the recorder, the
    path carrying the token, and the auth mode. `push_advertise_host` / `push_advertise_port` (recorder extras) win: inside the
    add-on the container's own address is not the host's, so the installer sets the HA host's LAN address and the host port
    mapped to 18091/tcp. Without them the local address towards the recorder is offered (right outside a container) and
    `advertise_source` says so. Never logged; returned only to system administrators."""
    extra = _extra(settings)
    host = str(extra.get("push_advertise_host") or "").strip() or None
    source = "configured" if host else "detected"
    if host is None:
        host = _local_address_towards(settings.nvr_host or "")
        source = "detected" if host else "unknown"
    port = int(extra.get("push_advertise_port") or DEFAULT_PUSH_PORT)
    mode = str(extra.get("push_auth") or "token")
    mode = mode if mode in AUTH_MODES else "token"
    token = push_token(settings, recorder_id) if mode != "address" else None
    return {"host": host, "port": port, "path": f"/{token}/SendAlarmStatus" if token else "/SendAlarmStatus", "auth": mode,
            "advertise_source": source, "listen_port": int(extra.get("push_port") or DEFAULT_PUSH_PORT)}


def _register_push(listener: "AlertStreamListener", adapter: ProvisionIsrAdapter) -> PushReceiver | None:
    """Attach this recorder to the process-wide push listener (started on first use, on the container port `push_port`,
    default 18091 = the port config.yaml maps). Per recorder: its own receiver, its token and / or its source address.
    None when it cannot listen (then the loop keeps sampling)."""
    global _PUSH
    s = listener.settings
    mode = str(_extra(s).get("push_auth") or "token")
    mode = mode if mode in AUTH_MODES else "token"
    address: str | None = None
    if mode != "token":
        try:
            address = socket.gethostbyname(s.nvr_host or "")
        except OSError:
            return None
    token = push_token(s, listener.recorder_id) if mode != "address" else None
    if mode != "address" and not token:
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
        if mode == "address" and address:
            holder = _PUSH.sources.get(address)
            if holder is not None and holder.recorder_id != listener.recorder_id:
                # security review M2: two recorders behind one address (NAT, different ports) cannot share address
                # authentication - events would land on the wrong recorder's cameras. Refused; this recorder keeps sampling.
                log.warning("provision push: recorder %s shares its source address with %s; address mode refused (use token mode)",
                            listener.recorder_id, holder.recorder_id)
                _RECEIVERS.pop(listener.recorder_id, None)
                _SINKS.pop(listener.recorder_id, None)
                return None
            _PUSH.sources[address] = receiver
        if token:
            _PUSH.tokens[token] = (receiver, address if mode == "token_and_address" else None)
    return receiver


def unregister_push(recorder_id: str) -> None:
    """Security review L4: a stopped or removed recorder's token / address no longer routes pushes."""
    with _PUSH_LOCK:
        receiver = _RECEIVERS.pop(recorder_id, None)
        _SINKS.pop(recorder_id, None)
        if receiver is not None and _PUSH is not None:
            _PUSH.unregister(receiver)


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
    interval = _poll_interval(_extra(s).get("poll_interval_s"))
    tracker = AlarmTracker()
    receiver = _register_push(listener, ad) if ad.event_mode() == "push" else None
    wait = sleep or listener.stop.wait
    backoff = 5.0
    zone_at = 0.0
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
        if time.monotonic() - zone_at > 600 and adapter is None:  # the device clock rule for the health note (1 read / 10 min)
            zone_at = time.monotonic()
            try:
                from .provision_playback import ProvisionPlayback

                ProvisionPlayback(ad, listener.tz_getter()).zone()
            except Exception:  # noqa: BLE001 - optional
                pass
        wait(interval)
    st.connected = False
    if receiver is not None:
        unregister_push(listener.recorder_id)  # L4: the loop ended (recorder stopped, disabled or removed)
