"""Which adapter serves a recorder, and which vendors an installer may choose (CR-022 section 6.1).

Phase 1 (CR-020): one recorder, `nvr-1`. CR-022: the recorder's vendor and connection live in `recorder_connections`
(services/connection_store.py) and reach the adapters through the effective `Settings` (`nvr_vendor`, `nvr_host`, ...),
overlaid once at start-up. `VENDORS` maps a vendor tag to its adapter constructor; `VENDOR_SPECS` is the catalogue the
connection form is rendered from (`GET /nvr/vendors`), so a new vendor needs its adapter plus a spec, no UI rework."""
from __future__ import annotations

import dataclasses
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
    kind: Literal["host", "port", "text", "password", "bool", "select"]
    required: bool
    secret: bool = False
    options: tuple[tuple[str, str], ...] = ()  # CR-025: (value, label) of a `select` field; the first is the default
    advanced: bool = False  # CR-025: shown under "הגדרות מתקדמות" in the form


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
    order = ("hikvision", "provision_isr", "frigate", "none")  # CR-025: fixed form order, whatever registered or was undone last
    specs = sorted(VENDOR_SPECS, key=lambda s: order.index(s.id) if s.id in order else len(order) - 1)
    return [{**s.as_dict(), "status": "available" if selectable(s.id) else "planned"} for s in specs]


def register_vendor(spec: VendorSpec, constructor: Callable[[str, Settings], RecorderAdapter]) -> Callable[[], None]:
    """CR-024 section 2.2 (7): the registration seam for a further vendor's adapter (Provision-ISR when its API is available,
    Frigate later): its catalogue entry and its constructor in one call. Returns a function that undoes the registration (tests
    register a fake vendor and remove it again). A spec with status `planned` stays "coming soon" whatever is registered."""
    global VENDOR_SPECS, SPEC_BY_ID
    old_specs = VENDOR_SPECS
    old_ctor = VENDORS.get(spec.id)
    VENDORS[spec.id] = constructor
    # the catalogue keeps its order: a spec replaces its namesake in place, a new one goes before "no NVR"
    if spec.id in SPEC_BY_ID:
        VENDOR_SPECS = tuple(spec if s.id == spec.id else s for s in VENDOR_SPECS)
    else:
        none = tuple(s for s in VENDOR_SPECS if s.id == NO_NVR)
        VENDOR_SPECS = tuple(s for s in VENDOR_SPECS if s.id != NO_NVR) + (spec,) + none
    SPEC_BY_ID = {s.id: s for s in VENDOR_SPECS}

    def undo() -> None:
        global VENDOR_SPECS, SPEC_BY_ID
        if old_ctor is None:
            VENDORS.pop(spec.id, None)
        else:
            VENDORS[spec.id] = old_ctor
        VENDOR_SPECS = old_specs  # exactly as before (order included)
        SPEC_BY_ID = {s.id: s for s in VENDOR_SPECS}

    return undo


def recorder_ids(conn: sqlite3.Connection) -> list[str]:
    """The recorders to read: the rows of `recorders` that were not removed (CR-024), or the add-on's NVR when discovery has
    not created its row yet."""
    try:
        rows = conn.execute("SELECT id, removed_at FROM recorders ORDER BY sort_order, id").fetchall()
        ids = [r["id"] for r in rows if not r["removed_at"]]
    except sqlite3.OperationalError:  # a database before migration 0055
        rows = conn.execute("SELECT id FROM recorders ORDER BY id").fetchall()
        ids = [r["id"] for r in rows]
    if DEFAULT_RECORDER not in {r["id"] for r in rows}:
        ids.insert(0, DEFAULT_RECORDER)  # the first recorder exists before its first discovery creates its row (CR-024)
    return ids


def constructor_for(settings: Settings) -> Callable[[str, Settings], RecorderAdapter]:
    """The adapter constructor of the recorder's vendor (`settings` = that recorder's effective settings, CR-024). "No NVR"
    keeps the default (the NVR-less checks answer first); a vendor without an adapter is refused, never served by another
    vendor's adapter."""
    vendor = settings.nvr_vendor or DEFAULT_VENDOR
    ctor = VENDORS.get(vendor) or (VENDORS[DEFAULT_VENDOR] if vendor == NO_NVR else None)
    if ctor is None:
        raise ApiError(409, "vendor_not_supported", "סוג ה־NVR שנבחר עדיין אינו נתמך.", details={"vendor": vendor})
    return ctor


def _row_vendor(conn: sqlite3.Connection, recorder_id: str) -> str | None:
    try:
        row = conn.execute("SELECT vendor FROM recorders WHERE id = ?", (recorder_id,)).fetchone()
    except sqlite3.OperationalError:
        return None
    return row["vendor"] if row else None


def adapter_for(conn: sqlite3.Connection, settings: Settings, recorder_id: str) -> RecorderAdapter:
    """The adapter of ONE recorder, built with that recorder's own connection (CR-024: `recorder_scope.settings_for`), so a
    write lock keyed by the adapter's device and every device call reach that recorder only. The vendor is the connection's
    (`recorder_connections.vendor`, overlaid at start-up); when the connection names none (not loaded, "no NVR") the
    `recorders.vendor` column decides. A vendor without an adapter is refused 409 `vendor_not_supported`."""
    from ...recorder_scope import settings_for

    if recorder_id not in recorder_ids(conn):
        raise ApiError(404, "not_found", "ה־NVR לא נמצא.")
    rs = settings_for(settings, recorder_id)
    if rs.nvr_vendor in (None, "", NO_NVR):
        vendor = _row_vendor(conn, recorder_id)
        if vendor and vendor != NO_NVR:
            rs = dataclasses.replace(rs, nvr_vendor=vendor)
    return constructor_for(rs)(recorder_id, rs)


# CR-025: Provision-ISR registered through the seam above (adapter + connection-form spec). Validated read-only on the
# owner's NVR 2026-10-04; selectable so a Provision recorder can be added in Settings. Writes stay off per recorder
# (`writes_enabled`) until the owner approves them.
from . import provision_isr as _provision_isr  # noqa: E402

_provision_isr.register(selectable=True)
_ORDER = (DEFAULT_VENDOR, "provision_isr", "frigate", NO_NVR)  # the catalogue order the form shows (late registrations keep it)
VENDOR_SPECS = tuple(sorted(VENDOR_SPECS, key=lambda s: _ORDER.index(s.id) if s.id in _ORDER else len(_ORDER) - 1))
SPEC_BY_ID = {s.id: s for s in VENDOR_SPECS}
