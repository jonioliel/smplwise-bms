"""Response models of the recorders API (routers/recorders.py, `/api/v1/recorders...`; CR-024 multi-NVR, NVR-H264-BULK-2341 write switch).
Never a password, a serial or a MAC; the connection detail (host, ports, user) only for `system.configure`. The connection routes reuse
routers/nvr_connection.py's view, save and test. Field order is the order the routers build their dicts in."""
from __future__ import annotations

from typing import Any, Literal

from . import WireModel

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()

RecorderState = Literal["removed", "disabled", "pending_restart", "unreadable", "refused", "not_configured", "error", "online", "unknown"]


class RecorderStatus(WireModel):
    state: RecorderState
    error: str | None
    """The discovery's last error code (state `error`)."""
    events_connected: bool
    discovery_last_ok: str | None


class RecorderConnectionBrief(WireModel):
    """The connection detail of a recorder in the list / one-recorder view (system.configure only): a subset of the connection view."""
    vendor: str | None
    host: str | None
    http_port: int | None
    rtsp_port: int | None
    username: str | None
    has_password: bool
    state: str
    revision: int | None
    updated_at: str | None
    vendor_locked: bool


class Recorder(WireModel):
    """One recorder (routers/recorders.recorder_view)."""
    id: str
    primary: bool
    name: str
    vendor: str
    vendor_label: str
    enabled: bool
    removed: bool
    removed_at: str | None
    sort_order: int
    time_zone: str | None
    model: str | None
    firmware: str | None
    last_seen_at: str | None
    cameras: int
    cameras_enabled: int
    status: RecorderStatus
    pending_restart: bool
    capabilities: dict[str, Any]
    """The recorder's declared capabilities as stored (capabilities_json)."""
    connection: RecorderConnectionBrief = None
    """Only for `system.configure`."""


class RecorderList(WireModel):
    recorders: list[Recorder]
    count: int
    """Recorders that are not removed."""
    can_manage: bool
    primary_has_history: bool
    restart: Literal["addon", "manual"]
    pending_restart: bool


class RecorderDevice(WireModel):
    """What the connection test read from the device (never its serial)."""
    model: str | None
    firmware: str | None
    channels: int | None


class RecorderAdded(WireModel):
    saved: bool
    restart_required: bool
    recorder_id: str
    untested: bool | None
    device: RecorderDevice | None
    recorder: Recorder


class RecorderUpdated(WireModel):
    saved: bool
    restart_required: bool
    recorder: Recorder


class RecorderRemoved(WireModel):
    removed: bool
    restart_required: bool
    recorder_id: str
    revision: int
    cameras_disabled: int


class RecorderConnection(WireModel):
    """A recorder's stored connection (routers/nvr_connection.connection_view; the shape of GET /nvr/connection). Never the password."""
    vendor: str | None
    host: str | None
    placeholder: bool
    http_port: int | None
    rtsp_port: int | None
    username: str | None
    user: str | None
    extra: dict[str, Any]
    """The vendor's extra connection options as stored (TLS mode, pin, ...)."""
    has_password: bool
    state: str
    source: Literal["ui", "addon_import", "legacy"] | None
    revision: int | None
    updated_at: str | None
    updated_by: str | None
    vendor_locked: bool
    pending_restart: bool
    legacy_options_differ: bool
    in_addon: bool
    restart: Literal["addon", "manual"]
    cameras: int
    recorder_id: str


class RecorderConnectionSaved(RecorderConnection):
    """The save of a recorder's connection (routers/nvr_connection.do_save): the save's outcome, then the connection view."""
    saved: bool
    restart_required: bool
    restarting: bool
    revision: int
    """The revision this save wrote."""
    device: RecorderDevice | None
    untested: bool
    new_recorder: bool = False
    """Absent when the save chose "no NVR"."""


class RecorderProbeTransport(WireModel):
    scheme: str
    auth: str | None = None
    insecure: bool


class RecorderCertificate(WireModel):
    """The device's HTTPS certificate as a bare handshake read it (to pin it); `matches_pin` null = nothing pinned yet."""
    sha256: str
    self_signed: bool | None
    not_after: str | None = None
    matches_pin: bool | None


class RecorderProbe(WireModel):
    """A read-only connection test (services/connection_probe; the internal `_` keys stripped). The keys after `code` depend on the vendor
    and the outcome."""
    ok: bool
    code: str
    model: str | None = None
    firmware: str | None = None
    channels: int | None = None
    certificate: RecorderCertificate | None = None
    pin_required: bool = False
    min_version: str = None
    transport: RecorderProbeTransport = None
    warnings: list[str] = []


class RecorderWritesChange(WireModel):
    at: str
    by: str | None
    enabled: bool


class RecorderWrites(WireModel):
    """The switch "אפשר שינויי הגדרות ב־NVR" of one recorder (services/nvr_write_switch.state)."""
    recorder_id: str
    vendor: str | None
    supported: bool
    enabled: bool
    explicit: bool
    default: bool
    last_change: RecorderWritesChange | None
    can_change: bool


class RecorderHealth(WireModel):
    """A live, read-only check of one recorder (model, firmware and the outcome code only)."""
    recorder_id: str
    online: bool
    model: str | None
    firmware: str | None
    error: str | None
    cached: bool = False
    """Present (true) when the answer came from the per-app cache or the health poller's recent check."""
