"""Which found devices Arx already knows (ONVIF-DISCOVER-2500; owner decisions 2026-11-22 Q58 and Q59; design 4.4).

A found device is MARKED, never hidden:
- `standalone` ("already in the system"): its address is the host of a camera without a recorder (the masked display address of
  its manual source - the sealed address is never opened for this);
- `behind_recorder` ("already through the recorder", Q58: it cannot be added): its address is the address the recorder reported for
  one of its channels (`InputProxyChannel/sourceInputPortDescriptor`, read by the recorder discovery and kept HERE in memory only:
  `note_channel_hosts`), or the host of a manual source of a recorder camera, or - after a successful identification - its keyed
  fingerprint (model + serial, the same HMAC autosync stores in `cameras.device_fingerprint`) equals a recorder camera's;
- `recorder`: the device IS a recorder this installation already uses (the recorder connection's host, or the keyed recorder
  identity of `recorders.device_fingerprint`). Its kind becomes `nvr`.

No serial number, MAC address or device address is stored by this module; the fingerprints are compared in memory."""
from __future__ import annotations

import hashlib
import hmac
import sqlite3
import threading
from dataclasses import dataclass, field
from typing import Any, Iterable
from urllib.parse import urlsplit

from ...config import Settings
from ...db import get_setting
from ...recorder_scope import configured_ids, settings_for
from ...test_reset import register_reset
from .. import source_policy

STANDALONE = "standalone"  # camera_sources.STANDALONE (not imported: that module pulls go2rtc and the connection store)
FINGERPRINT_SALT_KEY = "cameras.fingerprint_salt"  # autosync.FINGERPRINT_SALT_KEY

# recorder id -> the camera addresses its last discovery reported (memory only; filled by services/autosync.py)
CHANNEL_HOSTS: dict[str, frozenset[str]] = {}
_LOCK = threading.Lock()


def _norm(host: Any) -> str | None:
    """A literal address in its one canonical spelling (any IPv4 / IPv6 form source_policy accepts), else None (a name)."""
    if not isinstance(host, str) or not host.strip():
        return None
    ip = source_policy.address_of(host.strip())
    return str(ip) if ip is not None else None


def note_channel_hosts(recorder_id: str, hosts: Iterable[Any]) -> None:
    """The recorder discovery's camera addresses of `recorder_id` (replaces the previous set; names are dropped: a name is never
    resolved for this)."""
    found = frozenset(h for h in (_norm(x) for x in hosts) if h)
    with _LOCK:
        if found:
            CHANNEL_HOSTS[recorder_id] = found
        else:
            CHANNEL_HOSTS.pop(recorder_id, None)


def _host_of(display: Any) -> str | None:
    try:
        return _norm(urlsplit(str(display or "")).hostname)
    except ValueError:
        return None


@dataclass
class Snapshot:
    """What is known, read once when a scan starts (and again before an identification is judged)."""

    standalone_hosts: dict[str, str] = field(default_factory=dict)  # address -> camera id
    behind_hosts: dict[str, str] = field(default_factory=dict)  # address -> recorder id (or camera id for a manual source)
    recorder_hosts: dict[str, str] = field(default_factory=dict)  # address -> recorder id
    recorder_names: dict[str, str] = field(default_factory=dict)  # host NAME -> recorder id (resolved by the scan, off the DB)
    camera_fps: dict[tuple[str, str], str] = field(default_factory=dict, repr=False)  # (recorder id, fingerprint) -> camera id
    recorder_fps: dict[str, str] = field(default_factory=dict, repr=False)  # recorder identity fingerprint -> recorder id
    salt: bytes | None = field(default=None, repr=False)


def snapshot(conn: sqlite3.Connection, settings: Settings) -> Snapshot:
    snap = Snapshot()
    try:
        rows = conn.execute("SELECT s.camera_id, s.main_display, s.sub_display, c.recorder_id FROM camera_stream_sources s "
                            "JOIN cameras c ON c.id = s.camera_id").fetchall()
    except sqlite3.OperationalError:  # a database before 0209
        rows = []
    for r in rows:
        for display in (r["main_display"], r["sub_display"]):
            host = _host_of(display)
            if not host:
                continue
            if r["recorder_id"] == STANDALONE:
                snap.standalone_hosts.setdefault(host, str(r["camera_id"]))
            else:
                snap.behind_hosts.setdefault(host, str(r["recorder_id"]))
    with _LOCK:
        for rid, hosts in CHANNEL_HOSTS.items():
            for h in hosts:
                snap.behind_hosts.setdefault(h, rid)
    for rid in configured_ids(settings):
        host = (settings_for(settings, rid).nvr_host or "").strip()
        literal = _norm(host)
        if literal:
            snap.recorder_hosts.setdefault(literal, rid)
        elif host:
            snap.recorder_names.setdefault(host.lower().rstrip("."), rid)
    salt = get_setting(conn, FINGERPRINT_SALT_KEY)
    snap.salt = str(salt).encode("utf-8") if salt else None
    if snap.salt is not None:
        try:
            for r in conn.execute("SELECT id, recorder_id, device_fingerprint FROM cameras WHERE device_fingerprint IS NOT NULL").fetchall():
                snap.camera_fps[(str(r["recorder_id"]), str(r["device_fingerprint"]))] = str(r["id"])
            for r in conn.execute("SELECT id, device_fingerprint FROM recorders WHERE device_fingerprint IS NOT NULL AND removed_at IS NULL").fetchall():
                snap.recorder_fps[str(r["device_fingerprint"])] = str(r["id"])
        except sqlite3.OperationalError:  # a database before 0055
            pass
    return snap


def resolve_recorder_names(snap: Snapshot, resolve: Any = source_policy.resolve_host) -> None:
    """Recorder hosts configured by NAME: resolved (bounded resolver, short timeout) and added as addresses. Called by the scan
    thread, never with a database connection held."""
    for name, rid in list(snap.recorder_names.items()):
        for answer in resolve(name) or []:
            literal = _norm(answer)
            if literal:
                snap.recorder_hosts.setdefault(literal, rid)


def _hmac(salt: bytes, text: str) -> str:
    return hmac.new(salt, text.encode("utf-8"), hashlib.sha256).hexdigest()[:16]


def camera_fingerprint(salt: bytes, recorder_id: str, model: str | None, serial: str) -> str:
    """autosync.fingerprint without the database (the same message and key; tests/test_camera_discovery_2500.py pins them equal)."""
    return _hmac(salt, f"{recorder_id}|{(model or '').strip()}|{serial.strip()}")


def recorder_identity(salt: bytes, model: str | None, serial: str) -> str:
    """autosync.device_identity without the database."""
    return _hmac(salt, f"recorder|{(model or '').strip()}|{serial.strip()}")


def by_address(snap: Snapshot, address: str) -> tuple[str, str | None]:
    """(known, ref) for a device found at `address`: recorder | standalone | behind_recorder | none."""
    a = _norm(address) or address
    if a in snap.recorder_hosts:
        return "recorder", snap.recorder_hosts[a]
    if a in snap.standalone_hosts:
        return "standalone", snap.standalone_hosts[a]
    if a in snap.behind_hosts:
        return "behind_recorder", snap.behind_hosts[a]
    return "none", None


def by_identity(snap: Snapshot, model: str | None, serial: str | None) -> tuple[str, str | None]:
    """(known, ref) from a device's own model + serial (after a successful identification); none without a serial or a salt."""
    if not serial or not serial.strip() or snap.salt is None:
        return "none", None
    rid = snap.recorder_fps.get(recorder_identity(snap.salt, model, serial))
    if rid is not None:
        return "recorder", rid
    for recorder_id in {k[0] for k in snap.camera_fps}:
        cam = snap.camera_fps.get((recorder_id, camera_fingerprint(snap.salt, recorder_id, model, serial)))
        if cam is not None:
            return ("standalone" if recorder_id == STANDALONE else "behind_recorder"), recorder_id
    return "none", None


def _reset_for_tests() -> None:
    with _LOCK:
        CHANNEL_HOSTS.clear()


register_reset(__name__, ("CHANNEL_HOSTS",), _reset_for_tests)
