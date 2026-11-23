"""`PATCH /settings`: the camera-discovery keys that need more than a pattern (ONVIF-API-2500).

`cameras.discovery_allowed_ranges` - comma / space separated IPv4 networks, each inside a private LAN range (RFC 1918) and outside
the Supervisor's own bridge network, at most MAX_RANGES. Stored normalised (`10.77.0.0/24, 10.77.1.0/24`); empty = the whole site
network. The setting can only NARROW a scan (services/camera_discovery/ranges.plan); a refusal names the field (ADR-019 D1) and never
echoes the typed value."""
from __future__ import annotations

import ipaddress

from ...errors import ApiError
from ...services.camera_discovery import ranges
from . import Patch

KEY = "cameras.discovery_allowed_ranges"
MAX_RANGES = 32
MESSAGE = "טווחי החיפוש חייבים להיות רשתות IPv4 פרטיות של האתר (למשל 192.168.1.0/24), מופרדות בפסיק, עד 32 טווחים."


def normalise_ranges(raw: object) -> str | None:
    """The normalised value, or None when a part is not an allowed range."""
    if not isinstance(raw, str):
        return None
    parts = raw.replace(",", " ").split()
    if len(parts) > MAX_RANGES:
        return None
    out: list[ipaddress.IPv4Network] = []
    for part in parts:
        try:
            net = ipaddress.ip_network(part, strict=False)
        except ValueError:
            return None
        if (not isinstance(net, ipaddress.IPv4Network) or not any(net.subnet_of(n) for n in ranges.SITE_PRIVATE)
                or any(net.overlaps(n) for n in ranges.SUPERVISOR_NETWORKS)):
            return None
        if net not in out:
            out.append(net)
    return ", ".join(str(n) for n in out)


def discovery_ranges(patch: Patch) -> None:
    if KEY not in patch.changes:
        return
    value = normalise_ranges(patch.changes[KEY])
    if value is None:
        raise ApiError(422, "validation", MESSAGE, details={"fields": [KEY], "problems": [{"field": KEY, "code": "range_invalid", "message": MESSAGE}]})
    patch.changes[KEY] = value
