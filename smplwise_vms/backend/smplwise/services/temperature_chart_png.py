"""CR-INFRA-TEMPERATURE phase 3 (idea 11): the chart picture attached to a service ticket opened from a temperature unit.

A plain raster chart (Pillow, no network, no fonts beyond Pillow's built-in one): the target band, door openings (violet), defrost windows
(blue), the reading (blue line, red outside the band), the setpoint step line of a climate unit, the value axis and local hour / date labels.
Numbers and times only - the words (unit name, values, the event) are in the ticket's description, which the ticket screens show in the
person's language and direction. The PNG goes through the ticket module's ONE picture pipeline (attachments.store: re-encoded to JPEG), like a
photo a person uploads. Time runs left to right in every language (charts are never mirrored)."""
from __future__ import annotations

import datetime as dt
import io
from typing import Any
from zoneinfo import ZoneInfo

W, H = 1200, 520
ML, MR, MT, MB = 64, 20, 24, 44


def _text(d: Any, font: Any, x: float, y: float, s: str, anchor: str) -> None:
    """Text placed by its right-middle ("rm") or middle ("mm") point - measured, so it works with Pillow's bitmap and TrueType default font."""
    left, top, right, bottom = d.textbbox((0, 0), s, font=font)
    w, h = right - left, bottom - top
    x0 = x - w if anchor == "rm" else x - w / 2
    d.text((x0, y - h / 2 - top), s, fill=(91, 106, 133), font=font)


def render(points: list[list[Any]], low: float, high: float, lo: int, hi: int, tz: ZoneInfo, *, doors: list[list[int]] | None = None,
           defrost: list[list[int]] | None = None, mark: tuple[float, float | None] | None = None) -> bytes:
    """PNG bytes. `points` = [ts, value, setpoint | None]; `mark` = (start, end | None) of the alert row to shade."""
    from PIL import Image, ImageDraw, ImageFont

    img = Image.new("RGB", (W, H), (255, 255, 255))
    d = ImageDraw.Draw(img, "RGBA")
    font = ImageFont.load_default()
    vals = [p[1] for p in points if p[1] is not None] + [p[2] for p in points if len(p) > 2 and p[2] is not None]
    pad = max(1.0, (high - low) * 0.25)
    vmin = int(min([low - pad, *vals]) // 1)
    vmax = int(-(-max([high + pad, *vals]) // 1))
    span = max(1, hi - lo)

    def X(ts: float) -> float:
        return ML + (ts - lo) / span * (W - ML - MR)

    def Y(v: float) -> float:
        return MT + (vmax - v) / max(1e-9, vmax - vmin) * (H - MT - MB)

    step = max(1, round((vmax - vmin) / 6))
    v = vmin - vmin % step
    while v <= vmax:
        if v >= vmin:
            d.line([(ML, Y(v)), (W - MR, Y(v))], fill=(227, 232, 240), width=1)
            _text(d, font, ML - 8, Y(v), f"{v}°", "rm")
        v += step
    d.rectangle([ML, Y(high), W - MR, Y(low)], fill=(22, 163, 74, 30))
    for a, b in doors or []:
        d.rectangle([X(a), MT, max(X(a) + 2, X(b)), H - MB], fill=(124, 58, 237, 46))
    for a, b in defrost or []:
        d.rectangle([X(a), MT, max(X(a) + 1, X(b)), H - MB], fill=(37, 99, 235, 26))
    if mark is not None:
        a, b = mark
        d.rectangle([X(max(a, lo)), MT, X(min(b if b is not None else hi, hi)), H - MB], outline=(220, 38, 38, 160), width=2)
    for edge in (high, low):
        y = Y(edge)
        for x0 in range(ML, W - MR, 10):
            d.line([(x0, y), (min(x0 + 5, W - MR), y)], fill=(22, 163, 74), width=1)
    gap = max(900, span / 400 * 3)
    prev: tuple[float, float, float] | None = None
    prev_sp: tuple[float, float] | None = None
    for p in points:
        ts, val = p[0], p[1]
        sp = p[2] if len(p) > 2 else None
        if sp is not None:
            if prev_sp is not None and ts - prev_sp[0] <= gap:
                d.line([(X(prev_sp[0]), Y(prev_sp[1])), (X(ts), Y(prev_sp[1])), (X(ts), Y(sp))], fill=(91, 106, 133), width=1)
            prev_sp = (ts, sp)
        else:
            prev_sp = None
        if val is None:
            prev = None
            continue
        if prev is not None and ts - prev[0] <= gap:
            out = val > high or val < low or prev[1] > high or prev[1] < low
            d.line([(X(prev[0]), Y(prev[1])), (X(ts), Y(val))], fill=(220, 38, 38) if out else (37, 99, 235), width=3 if out else 2)
        prev = (ts, val, 0.0)
    days = span > 1.5 * 86400
    for i in range(7):
        ts = lo + span * i / 6
        lab = dt.datetime.fromtimestamp(ts, dt.timezone.utc).astimezone(tz).strftime("%d.%m" if days else "%H:%M")
        _text(d, font, X(ts), H - MB + 16, lab, "mm")
    d.rectangle([ML, MT, W - MR, H - MB], outline=(213, 219, 230), width=1)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()
