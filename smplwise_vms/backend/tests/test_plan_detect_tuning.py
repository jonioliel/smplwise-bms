"""Plan Studio detection tuning (T087, the 0.1.91 list measured on the owner's real scans; synthetic pictures only
here - the real scans stay private): the sheet's reference strokes well outside the building (section-cut marks, a north
arrow, the title underline) and dashed lines (an overhead edge drawn in dashes) are not suggested as walls, while the
building's walls, a wall broken by doors and a free-standing wall inside the building stay."""
from __future__ import annotations

import io

import numpy as np
from PIL import Image, ImageDraw

from smplwise.services import plan_detect as pd

S = 0.01  # metres per pixel of the synthetic pictures
BUILDING = (300, 150, 1300, 900)


def _png(im: Image.Image) -> bytes:
    buf = io.BytesIO()
    im.save(buf, "PNG")
    return buf.getvalue()


def _building() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    """A 10 x 7.5 m building of 16 px (0.16 m) walls with one interior wall, on a 16 x 12 m sheet."""
    im = Image.new("L", (1600, 1200), 255)
    d = ImageDraw.Draw(im)
    d.rectangle(BUILDING, outline=0, width=16)
    d.rectangle([700, 158, 711, 892], fill=0)
    return im, d


def _px(w: dict) -> list[tuple[float, float]]:
    return [(p[0] * 1600, p[1] * 1200) for p in w["polyline"]]


def _inside(w: dict, grow: float = 20) -> bool:
    x0, y0, x1, y1 = BUILDING
    return all(x0 - grow <= x <= x1 + grow and y0 - grow <= y <= y1 + grow for x, y in _px(w))


def _dashes(d: ImageDraw.ImageDraw, x0: int, x1: int, y: int, dash: int, gap: int, width: int, dot: bool = False) -> None:
    x = x0
    while x < x1:
        d.rectangle([x, y, min(x1, x + dash - 1), y + width - 1], fill=0)
        if dot:
            d.rectangle([x + dash + gap // 2 - 2, y, x + dash + gap // 2 + 2, y + width - 1], fill=0)
        x += dash + gap


def test_reference_strokes_outside_the_building_are_not_walls():
    im, d = _building()
    base = pd.detect(_png(im), targets=("walls",), scale_m_per_px=S)
    assert len(base["walls"]) >= 5 and all(_inside(w) for w in base["walls"])
    # a section-cut mark 1.7 m left of the building: a thick bar with a perpendicular tick, and its dash-dot line
    d.rectangle([60, 400, 73, 560], fill=0)
    d.rectangle([60, 474, 130, 485], fill=0)
    _dashes(d, 10, 130, 700, 90, 30, 10, dot=True)
    # the title underline under the sheet title, a thick line and a thin one below it
    d.rectangle([700, 1080, 1500, 1091], fill=0)
    d.rectangle([700, 1110, 1500, 1114], fill=0)
    # a north arrow bar 1.5 m right of the building
    d.rectangle([1450, 300, 1461, 480], fill=0)
    r = pd.detect(_png(im), targets=("walls",), scale_m_per_px=S)
    outside = [_px(w) for w in r["walls"] if not _inside(w)]
    assert outside == []
    assert len(r["walls"]) == len(base["walls"]), "every wall of the building stays"


def test_a_detached_structure_as_big_as_a_building_stays():
    """Only a small group of strokes outside the structure goes: a second building of its own size is structure too."""
    im, d = _building()
    d.rectangle([1350, 300, 1580, 700], outline=0, width=16)
    r = pd.detect(_png(im), targets=("walls",), scale_m_per_px=S)
    shed = [w for w in r["walls"] if all(x > 1330 for x, _ in _px(w))]
    assert len(shed) == 4, [_px(w) for w in shed]


def test_a_dashed_line_is_not_walls_but_a_wall_with_doors_is():
    im, d = _building()
    _dashes(d, 350, 680, 400, 60, 25, 6)  # an overhead edge: 0.6 m dashes, 0.25 m apart, 6 px thin
    # a wall broken by two 0.9 m doors (no symbol: two passages keep its three pieces apart, never a dashed line)
    d.rectangle([720, 600, 850, 611], fill=0)
    d.rectangle([940, 600, 1070, 611], fill=0)
    d.rectangle([1160, 600, 1292, 611], fill=0)
    r = pd.detect(_png(im), scale_m_per_px=S)
    dashed = [w for w in r["walls"] if all(abs(y - 403) < 8 for _, y in _px(w))]
    assert dashed == [], [_px(w) for w in dashed]
    doors_wall = [w for w in r["walls"] if all(abs(y - 605) < 8 for _, y in _px(w))]
    covered = sum(abs(_px(w)[1][0] - _px(w)[0][0]) for w in doors_wall)
    assert covered >= 350, [_px(w) for w in doors_wall]


def _seg(x0: float, x1: float, y: float = 0.0, thick: float = 4.0) -> pd.Seg:
    return pd.Seg(np.array([x0, y]), np.array([x1, y]), [thick] * 5, axis=True)


def test_drop_dashed_lines_needs_a_run_of_short_thin_pieces_close_together():
    s, t_med = 0.02, 5.0  # 20 px = 0.4 m
    dashes = [_seg(0, 40), _seg(60, 100), _seg(120, 160)]
    assert pd.drop_dashed_lines(dashes, s, t_med) == []
    assert len(pd.drop_dashed_lines(dashes[:2], s, t_med)) == 2, "two pieces are no dashed line"
    doors = [_seg(0, 40), _seg(90, 130), _seg(180, 220)]  # 50 px = 1 m apart: openings, not dashes
    assert len(pd.drop_dashed_lines(doors, s, t_med)) == 3
    thick = [_seg(0, 40, thick=9), _seg(60, 100, thick=9), _seg(120, 160, thick=9)]  # piers of a solid wall
    assert len(pd.drop_dashed_lines(thick, s, t_med)) == 3
    long_ = [_seg(0, 400), _seg(420, 820), _seg(840, 1240)]  # 8 m pieces: walls, whatever the gaps
    assert len(pd.drop_dashed_lines(long_, s, t_med)) == 3
