"""How many camera channels the recorder is built for, and the non-blocking warning for `playback.max_sessions`.

The channel capacity is NOT discovered over ISAPI today (only the configured IP channels are). It is derived from the
recorder model that the sync stores (`recorders.model`), using the Hikvision naming scheme: `DS-7616NXI-K2` is a
16-channel recorder, `DS-7732NI` 32, `DS-96128NI` 128. An unknown or unparsable model gives None, and then no warning is
issued. A warning never blocks a save.
"""
from __future__ import annotations

import re
import sqlite3

# series digits are the first two of four ("76" in 7616) or of five ("96" in 96128); the rest is the channel count
_FOUR = re.compile(r"DS-(\d{2})(\d{2})(?!\d)", re.IGNORECASE)
_FIVE = re.compile(r"DS-(\d{2})(\d{3})(?!\d)", re.IGNORECASE)
_VALID = {4, 8, 16, 24, 32, 36, 64, 128}


def channels_from_model(model: str | None) -> int | None:
    """Channel capacity named by a Hikvision recorder model, or None when it cannot be told."""
    if not model:
        return None
    text = model.strip()
    for pattern in (_FIVE, _FOUR):
        m = pattern.search(text)
        if m and m.group(1)[0] in "789":
            n = int(m.group(2))
            if n in _VALID:
                return n
    return None


def recorder_channels(conn: sqlite3.Connection) -> int | None:
    """The largest capacity among the known recorders (None when no recorder model is known)."""
    caps = [c for (m,) in conn.execute("SELECT model FROM recorders").fetchall() if (c := channels_from_model(m))]
    return max(caps) if caps else None


def playback_sessions_warning(value: int | None, channels: int | None) -> str | None:
    """Hebrew warning text when `value` exceeds half of the recorder's channels; None otherwise (also when unknown)."""
    if value is None or not channels or value * 2 <= channels:
        return None
    return f"{value} סשני ניגון במקביל זה יותר ממחצית הערוצים שה־NVR בנוי להם ({channels}). זה עלול להעמיס על ה־NVR ולפגוע בהקלטה ובצפייה החיה. השמירה אפשרית."
