"""Which adapter serves a recorder, and which vendors an installer may choose (CR-022 section 6.1).

Phase 1 (CR-020): one recorder, `nvr-1`. CR-022: the recorder's vendor and connection live in `recorder_connections`
(services/connection_store.py) and reach the adapters through the effective `Settings` (`nvr_vendor`, `nvr_host`, ...),
overlaid once at start-up. `VENDORS` maps a vendor tag to its adapter constructor; `VENDOR_SPECS` is the catalogue the
connection form is rendered from (`GET /nvr/vendors`), so a new vendor needs its adapter plus a spec, no UI rework."""
from __future__ import annotations

import sqlite3
from collections.abc import Callable
from dataclasses import asdict, dataclass, field
from typing import Any, Literal

from ...config import Settings
from ...errors import ApiError
from .base import RecorderAdapter
from .hikvision import HikvisionAdapter

DEFAULT_RECORDER = "nvr-1"
DEFAULT_VENDOR = "hikvision"
NO_NVR = "none"  # the installer's explicit "no NVR" choice (a pseudo-vendor, never an adapter)

# vendor tag -> constructor(recorder_id, settings). Other vendors register here when their adapter exists.
VENDORS: dict[str, Callable[[str, Settings], RecorderAdapter]] = {DEFAULT_VENDOR: HikvisionAdapter}


@dataclass(frozen=True)
class VendorField:
    key: str
    label: str
    kind: Literal["host", "port", "text", "password", "bool"]
    required: bool
    secret: bool = False


@dataclass(frozen=True)
class VendorSpec:
    """One entry of the vendor catalogue. `available`: selectable; `planned`: listed as "coming soon", not selectable."""
    id: str
    label: str
    status: Literal["available", "planned"]
    default_ports: dict[str, int] = field(default_factory=dict)
    fields: tuple[VendorField, ...] = ()

    def as_dict(self) -> dict[str, Any]:
        return {"id": self.id, "label": self.label, "status": self.status, "default_ports": dict(self.default_ports),
                "fields": [asdict(f) for f in self.fields]}


_NETWORK_FIELDS = (
    VendorField("host", "כתובת", "host", True),
    VendorField("http_port", "פורט HTTP", "port", True),
    VendorField("rtsp_port", "פורט RTSP", "port", True),
    VendorField("username", "שם משתמש", "text", True),
    VendorField("password", "סיסמה", "password", True, secret=True),
)

# Owner decision D1 (2026-10-04): Hikvision and "no NVR" selectable; Provision-ISR and Frigate shown as "coming soon".
VENDOR_SPECS: tuple[VendorSpec, ...] = (
    VendorSpec(DEFAULT_VENDOR, "Hikvision", "available", {"http_port": 80, "rtsp_port": 554}, _NETWORK_FIELDS),
    VendorSpec("provision_isr", "Provision-ISR", "planned", {"http_port": 80, "rtsp_port": 554}, _NETWORK_FIELDS),
    VendorSpec("frigate", "Frigate", "planned", {"http_port": 5000, "rtsp_port": 8554}, ()),
    VendorSpec(NO_NVR, "ללא NVR", "available", {}, ()),
)
SPEC_BY_ID: dict[str, VendorSpec] = {s.id: s for s in VENDOR_SPECS}


def selectable(vendor: str) -> bool:
    """A vendor an installer may save now: `available` in the catalogue AND (unless it is "no NVR") backed by an adapter."""
    spec = SPEC_BY_ID.get(vendor)
    return bool(spec and spec.status == "available" and (vendor == NO_NVR or vendor in VENDORS))


def catalogue() -> list[dict[str, Any]]:
    """`GET /nvr/vendors`: every spec; an `available` spec whose adapter is missing is reported as `planned`."""
    return [{**s.as_dict(), "status": "available" if selectable(s.id) else "planned"} for s in VENDOR_SPECS]


def recorder_ids(conn: sqlite3.Connection) -> list[str]:
    """The recorders to read: the rows of `recorders`, or the add-on's NVR when discovery has not created its row yet."""
    ids = [r["id"] for r in conn.execute("SELECT id FROM recorders ORDER BY id").fetchall()]
    return ids or [DEFAULT_RECORDER]


def constructor_for(settings: Settings) -> Callable[[str, Settings], RecorderAdapter]:
    """The adapter constructor of the installation's vendor. "No NVR" keeps the default (the NVR-less checks answer first);
    a vendor without an adapter is refused, never served by another vendor's adapter."""
    vendor = settings.nvr_vendor or DEFAULT_VENDOR
    ctor = VENDORS.get(vendor) or (VENDORS[DEFAULT_VENDOR] if vendor == NO_NVR else None)
    if ctor is None:
        raise ApiError(409, "vendor_not_supported", "סוג ה־NVR שנבחר עדיין אינו נתמך.", details={"vendor": vendor})
    return ctor


def adapter_for(conn: sqlite3.Connection, settings: Settings, recorder_id: str) -> RecorderAdapter:
    if recorder_id not in recorder_ids(conn):
        raise ApiError(404, "not_found", "ה־NVR לא נמצא.")
    return constructor_for(settings)(recorder_id, settings)
