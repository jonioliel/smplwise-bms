"""Per-recorder clock for EXPERIMENTAL synchronized playback across recorders (CR-024, owner decision 2026-10-04).

Not proven on real devices: off by default (`playback.cross_recorder_sync` = "false"), a group with cameras of two recorders is
refused 409 `sync_cross_recorder_unproven` until an administrator turns it on. When on, every member's recording is asked for in
its OWN recorder's terms, defensively:

- zone: `recorders.time_zone`, else the installation's zone; an unknown zone name falls back to the installation's;
- clock offset: the recorder's clock minus this server's, read once per group (`GET /ISAPI/System/time`, 4 s budget) in that same
  zone - so for a device that reports a naive wall clock the offset also absorbs a wrong zone, and the composition "true instant
  + offset, shown in the zone" is the device's own label for that instant;
- a device that reports its time WITH an explicit UTC offset that disagrees with the zone is refused (`recorder_zone_mismatch`):
  the playback URL is a naive wall clock, and guessing which of the two is right could play the wrong hour;
- |offset| above MAX_OFFSET_S is refused (`clock_offset_too_large`): a clock that far off is a misconfigured recorder, not drift;
- |offset| up to NOISE_S counts as 0 (the reading itself has about a second of resolution);
- an unreadable clock keeps the member with offset 0 and `clock: "unknown"` in the group answer (the browser's own sync
  measurement then shows how far it is), never a guess.
Single-recorder groups never come here: their proven path is unchanged."""
from __future__ import annotations

import datetime as dt
import re
from typing import Any

from ..errors import ApiError
from ..recorder_scope import settings_for
from .timeutil import zone

MAX_OFFSET_S = 900
NOISE_S = 1
_OFFSET_RE = re.compile(r"(Z|[+-]\d{2}:?\d{2})$")


def safe_zone(name: str | None, fallback: str) -> str:
    if name:
        try:
            zone(name)
            return name
        except Exception:  # noqa: BLE001 - an unknown or malformed zone name
            pass
    return fallback


def recorder_zones(conn: Any, recorder_ids: list[str], fallback: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for rid in recorder_ids:
        try:
            row = conn.execute("SELECT time_zone FROM recorders WHERE id = ?", (rid,)).fetchone()
        except Exception:  # noqa: BLE001 - a database before 0055
            row = None
        out[rid] = safe_zone(row["time_zone"] if row else None, fallback)
    return out


def _explicit_offset_mismatch(local: str | None, tz_name: str) -> bool:
    if not local or not _OFFSET_RE.search(local.strip()):
        return False
    try:
        t = dt.datetime.fromisoformat(local.strip().replace("Z", "+00:00"))
    except ValueError:
        return False
    if t.tzinfo is None:
        return False
    # Hikvision tags the wall clock with the zone's STANDARD offset even in summer (KNOWN_QUIRKS; nvr_system.device_instant):
    # the zone's standard and current offsets both agree with it, anything else names another zone
    wall = t.replace(tzinfo=zone(tz_name))
    cur = wall.utcoffset()
    std = cur - (wall.dst() or dt.timedelta(0)) if cur is not None else None
    return t.utcoffset() not in (cur, std)


def measure(settings: Any, recorder_id: str, tz_name: str, now: dt.datetime | None = None) -> dict[str, Any]:
    """{recorder_id, time_zone, offset_s, clock: measured | unknown, refused: None | reason}. Device I/O: call outside a write lock."""
    from . import nvr, nvr_system

    out: dict[str, Any] = {"recorder_id": recorder_id, "time_zone": tz_name, "offset_s": 0, "clock": "unknown", "refused": None}
    try:
        with nvr.deadline(4.0):
            st = nvr_system.time_status(settings_for(settings, recorder_id), tz=zone(tz_name), now=now)
    except ApiError as exc:
        if exc.code in ("recorder_unavailable", "nvr_not_configured"):
            out["refused"] = exc.code
        return out
    except Exception:  # noqa: BLE001 - an unparsable answer: unknown, never a guess
        return out
    if _explicit_offset_mismatch(st.get("local_time"), tz_name):
        out["refused"] = "recorder_zone_mismatch"
        return out
    drift = st.get("drift_s")
    if drift is None:
        return out
    if abs(drift) > MAX_OFFSET_S:
        out.update(offset_s=int(drift), clock="measured", refused="clock_offset_too_large")
        return out
    out.update(offset_s=0 if abs(drift) <= NOISE_S else int(drift), clock="measured")
    return out
