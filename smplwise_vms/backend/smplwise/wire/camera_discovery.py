"""Response models of routers/camera_discovery.py (ONVIF-API-2500; design docs/design/onvif-discovery-2412 section 7, owner decisions
2026-11-22 Q55-Q61): `/api/v1/cameras/discovery/...` - finding cameras on the site's network (services/camera_discovery).

Exact models (`ExactModel`, RESPONSE-MODELS-E-2480): a value is never converted. Literal lists are written in sorted order, the order
scripts/gen_wire_types.py writes them in. No model has a field for a user name, a password, a serial number, a MAC address or a URL
with credentials: the service never puts one in an answer, and an undeclared key fails the strict tests (SW_WIRE_STRICT=1)."""
from __future__ import annotations

from typing import Literal

from pydantic import ConfigDict

from . import WireModel

try:
    from . import ExactModel  # type: ignore[attr-defined]  # RESPONSE-MODELS-E-2480
except ImportError:  # until that row is merged under this one: the same class (pydantic strict mode, undeclared keys pass through)
    class ExactModel(WireModel):  # type: ignore[no-redef]
        model_config = ConfigDict(extra="allow", protected_namespaces=(), strict=True)


# every route answers JSON
NO_JSON: frozenset[str] = frozenset()

ScanState = Literal["cancelled", "done", "failed", "running"]


class DiscoveryEngine(ExactModel):
    """A discovery engine (phase 1: only `unicast`, Q55); `reason` when it is not available (`site_network_unknown`)."""
    id: Literal["unicast"]
    available: bool
    reason: str = None


class DiscoveryCapabilities(ExactModel):
    """`GET /cameras/discovery/capabilities`: what the scan screen needs before a scan."""
    enabled: bool
    engines: list[DiscoveryEngine]
    suggested_range: str | None
    """The /24 around the host's first site address; null when the site network is not known (every scan is then refused)."""
    max_addresses: int
    running: bool


class ScanProgress(ExactModel):
    checked: int
    total: int


class ScanCounts(ExactModel):
    found: int
    cameras: int
    recorders: int
    unknown: int
    known: int
    addable: int


class RecorderPrefill(ExactModel):
    """Q59: what the recorder wizard opens with for a device that looks like a recorder. Never a credential."""
    host: str
    http_port: int
    vendor: Literal["hikvision"] = None
    name: str = None


class FoundDevice(ExactModel):
    """One device the scan found (job-local id). `auth` is the outcome of the last identification press:
    not_tried | ok | wrong_password | digest_required | locked_guard | busy | skipped | no_answer | not_onvif."""
    id: str
    address: str
    port: int | None
    engines: list[Literal["http", "unicast"]]
    kind: Literal["camera", "nvr", "unknown"]
    known: Literal["behind_recorder", "none", "recorder", "standalone"]
    known_ref: str = None
    """The camera or recorder id the device is already known as (absent when `known` is none)."""
    addable: bool
    manufacturer: str | None
    model: str | None
    name: str | None
    firmware: str | None
    clock_offset_s: float | None
    """Device clock minus this server's clock, seconds (evidence only - never corrected)."""
    auth: Literal["busy", "digest_required", "locked_guard", "no_answer", "not_onvif", "not_tried", "ok", "skipped", "wrong_password"]
    has_service: bool
    recorder_prefill: RecorderPrefill = None


class ScanSummary(ExactModel):
    id: str
    state: ScanState
    range: str
    engines: list[Literal["http", "unicast"]]
    started_at: str
    finished_at: str | None
    progress: ScanProgress
    counts: ScanCounts


class ScanJob(ScanSummary):
    """`POST /cameras/discovery/scans` (202) and `GET /cameras/discovery/scans/{scan_id}`: the scan with every device found so far."""
    devices: list[FoundDevice]


class ScanList(ExactModel):
    """`GET /cameras/discovery/scans`: the scans this person may see, newest first, without their devices."""
    scans: list[ScanSummary]


class ScanCancelled(ExactModel):
    """`DELETE /cameras/discovery/scans/{scan_id}`: the scan is stopped and every typed credential of it forgotten."""
    cancelled: bool


class IdentifyResult(ExactModel):
    """`POST /cameras/discovery/scans/{scan_id}/identify`: the pressed devices after their one attempt each."""
    devices: list[FoundDevice]
