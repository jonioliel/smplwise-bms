"""Plan Studio detection tuning (T087, the 0.1.91 list measured on the owner's real scans; synthetic pictures only
here - the real scans stay private): the sheet's reference strokes well outside the building (section-cut marks, a north
arrow, the title underline) and dashed lines (an overhead edge drawn in dashes) are not suggested as walls, while the
building's walls, a wall broken by doors and a free-standing wall inside the building stay; the rows of a tribune (edges
included) are no walls."""
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
    assert r["stats"]["dropped_reference"] >= 4 and r["flags"]["outside_main"] == [], "dropped, but never silently"


def test_a_small_outbuilding_far_from_a_large_building_stays_flagged():
    """A 5 x 5 m gatehouse 3 m from a 50 x 37.5 m hall with interior walls (well under REF_STRUCTURE_SHARE of its wall
    length) is a closed outline: its four walls stay, listed in flags.outside_main for the person reviewing."""
    im, d = _hall()
    s = 0.05
    d.rectangle([1160, 400, 1260, 500], outline=0, width=8)  # the gatehouse, 3 m right of the hall
    r = pd.detect(_png(im), targets=("walls",), scale_m_per_px=s)
    gate = [w for w in r["walls"] if all(x > 1140 for x, _ in _px(w))]
    assert len(gate) == 4, [_px(w) for w in gate]
    assert sorted(r["flags"]["outside_main"]) == sorted(w["id"] for w in gate)
    hall = [w for w in r["walls"] if w["id"] not in r["flags"]["outside_main"]]
    assert sum(abs(_px(w)[1][0] - _px(w)[0][0]) + abs(_px(w)[1][1] - _px(w)[0][1]) for w in hall) > 20 * 5 * 20, "the hall is the main structure"


def test_a_detached_structure_as_big_as_a_building_stays():
    """Only a small group of strokes outside the structure goes: a second building of its own size is structure too."""
    im, d = _building()
    d.rectangle([1400, 300, 1580, 700], outline=0, width=16)  # 1 m beside it
    r = pd.detect(_png(im), targets=("walls",), scale_m_per_px=S)
    shed = [w for w in r["walls"] if all(x > 1380 for x, _ in _px(w))]
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


def _hall() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    """A 50 x 37.5 m hall with interior walls at 0.05 m / px (20 px = 1 m, walls 8 px = 0.4 m)."""
    im = Image.new("L", (1600, 1200), 255)
    d = ImageDraw.Draw(im)
    d.rectangle([100, 100, 1100, 850], outline=0, width=8)
    for x in (350, 600, 850):
        d.rectangle([x, 108, x + 7, 842], fill=0)
    d.rectangle([108, 470, 1092, 477], fill=0)
    return im, d


def _sg(a: tuple[float, float], b: tuple[float, float], thick: float = 6.0) -> pd.Seg:
    return pd.Seg(np.array(a, float), np.array(b, float), [thick] * 5, axis=True)


def test_parallel_title_rules_joined_by_a_tick_are_dropped_not_flagged():
    """The rule on segments (0.02 m / px): a 60 x 40 m hall with interior walls is the structure. Outside it, three 5 m
    title rules 0.4 m apart joined at one end by a 0.45 m tick have three sides of 1 m or more, but all in one
    orientation - a sheet stroke, dropped and counted, never kept. A 5 x 5 m outline in the same place has sides in two
    orientations - kept and returned as outside the main structure."""
    s, t_med = 0.02, 6.0
    hall = [_sg((0, 0), (3000, 0)), _sg((3000, 0), (3000, 2000)), _sg((3000, 2000), (0, 2000)), _sg((0, 2000), (0, 0))]
    hall += [_sg((x, 0), (x, 2000)) for x in (500, 1000, 1500, 2000, 2500)]
    rules = [_sg((500, y), (750, y), 3.0) for y in (2200, 2220, 2240)] + [_sg((500, 2200), (500, 2242), 3.0)]
    kept, outside, dropped = pd.drop_reference_strokes(hall + rules, t_med, s)
    assert (len(kept), outside, dropped) == (len(hall), [], 4)
    gate = [_sg((500, 2200), (750, 2200)), _sg((750, 2200), (750, 2450)), _sg((750, 2450), (500, 2450)), _sg((500, 2450), (500, 2200))]
    kept, outside, dropped = pd.drop_reference_strokes(hall + gate, t_med, s)
    assert (len(kept), len(outside), dropped) == (len(hall) + 4, 4, 0)


def test_a_facade_of_piers_and_narrow_windows_in_one_line_weight_is_a_wall():
    """Piers 1 m long between 0.4 m windows (the glass and both faces drawn across each window), every wall of the plan
    one line weight: the pieces look like dashes by length, thickness and spacing, but the windows leave ink across the
    gaps, so the facade stays."""
    im = Image.new("L", (1600, 1200), 255)
    d = ImageDraw.Draw(im)
    d.rectangle([300, 150, 1300, 900], outline=0, width=12)
    d.rectangle([300, 150, 1300, 161], fill=255)  # the top wall becomes the facade
    x = 300
    while x < 1300:
        d.rectangle([x, 150, min(1299, x + 99), 161], fill=0)  # a 1 m pier
        w0, w1 = x + 100, min(1299, x + 139)
        if w0 < 1300:
            for y in (150, 155, 160):  # a 0.4 m window: both faces and the glass, 2 px lines
                d.rectangle([w0, y, w1, y + 1], fill=0)
        x += 140
    r = pd.detect(_png(im), scale_m_per_px=S)
    facade = [w for w in r["walls"] if all(abs(y - 155) < 8 for _, y in _px(w))]
    assert sum(abs(_px(w)[1][0] - _px(w)[0][0]) for w in facade) >= 600, [_px(w) for w in r["walls"]]
    assert r["stats"]["dropped_dashed"] == 0


def test_a_partition_that_faded_in_places_is_a_wall():
    """A partition of 1.2 m dark stretches with 0.4 m stretches faded to grey 134 - lighter than the wall threshold of
    the picture (90), so the wall mask breaks it into dash-like pieces, but darker than the soft ink's (140), so a line
    runs through every gap: not a dashed line, the partition stays."""
    im = Image.new("L", (1600, 1200), 255)
    d = ImageDraw.Draw(im)
    d.rectangle([300, 150, 1300, 900], outline=0, width=12)
    x = 312
    while x < 1288:
        d.rectangle([x, 520, min(1287, x + 119), 531], fill=0)
        if x + 120 < 1287:
            d.rectangle([x + 120, 520, min(1287, x + 159), 531], fill=134)
        x += 160
    r = pd.detect(_png(im), scale_m_per_px=S)
    assert r["detector"]["params"]["threshold"] < 134
    part = [w for w in r["walls"] if all(abs(y - 525) < 8 for _, y in _px(w))]
    assert sum(abs(_px(w)[1][0] - _px(w)[0][0]) for w in part) >= 600, [_px(w) for w in r["walls"]]
    assert r["stats"]["dropped_dashed"] == 0


def _seg(x0: float, x1: float, y: float = 0.0, thick: float = 4.0) -> pd.Seg:
    return pd.Seg(np.array([x0, y]), np.array([x1, y]), [thick] * 5, axis=True)


def test_drop_dashed_lines_needs_a_run_of_short_thin_pieces_close_together():
    s, t_med = 0.02, 5.0  # 20 px = 0.4 m
    dashes = [_seg(0, 40), _seg(60, 100), _seg(120, 160)]
    assert pd.drop_dashed_lines(dashes, s, t_med) == ([], 3)
    assert len(pd.drop_dashed_lines(dashes[:2], s, t_med)[0]) == 2, "two pieces are no dashed line"
    doors = [_seg(0, 40), _seg(90, 130), _seg(180, 220)]  # 50 px = 1 m apart: openings, not dashes
    assert len(pd.drop_dashed_lines(doors, s, t_med)[0]) == 3
    thick = [_seg(0, 40, thick=9), _seg(60, 100, thick=9), _seg(120, 160, thick=9)]  # piers of a solid wall
    assert len(pd.drop_dashed_lines(thick, s, t_med)[0]) == 3
    long_ = [_seg(0, 400), _seg(420, 820), _seg(840, 1240)]  # 8 m pieces: walls, whatever the gaps
    assert len(pd.drop_dashed_lines(long_, s, t_med)[0]) == 3
    # the same short pieces with ink across the gaps (a window's lines, a faint dropout): no dashed line
    ink = np.zeros((20, 200), dtype=bool)
    ink[0, :] = True  # the centre line y = 0 is inked all along, gaps included
    assert len(pd.drop_dashed_lines(dashes, s, t_med, ink)[0]) == 3
    blank = np.zeros((20, 200), dtype=bool)
    assert pd.drop_dashed_lines(dashes, s, t_med, blank)[0] == []


def test_the_rows_and_edges_of_a_tribune_are_not_walls_while_stair_treads_leave_a_wall_alone():
    im, d = _building()
    for k in range(6):  # six rows 0.9 m apart, the two edges drawn heavier
        y = 250 + 90 * k
        w = 8 if k in (0, 5) else 4
        d.rectangle([760, y, 1240, y + w - 1], fill=0)
    for k in range(5):  # stair treads 0.3 m apart beside the left part of the building's top wall
        d.rectangle([350 + 60 * k, 190, 351 + 60 * k, 400], fill=0)
    d.rectangle([330, 400, 650, 415], fill=0)  # a wall with the treads' hairlines ending on it
    r = pd.detect(_png(im), targets=("walls",), scale_m_per_px=S)
    rows = [_px(w) for w in r["walls"] if all(760 <= x <= 1240 and 245 <= y <= 710 for x, y in _px(w))]
    assert rows == [], rows
    kept = [_px(w) for w in r["walls"] if all(abs(y - 407) < 8 for _, y in _px(w))]
    assert kept, [_px(w) for w in r["walls"]]
    top = [_px(w) for w in r["walls"] if all(abs(y - 157) < 8 for _, y in _px(w))]
    assert sum(abs(p[1][0] - p[0][0]) for p in top) > 900, top


def _lines(*ys: int) -> np.ndarray:
    ink = np.zeros((900, 600), dtype=bool)
    for y in (100, *ys):  # the edge at y = 100, then the lines beside it, 4 px each, 5 m long
        ink[y : y + 4, 50:550] = True
    return ink


def test_drop_steps_edges_needs_regular_rows_on_one_side():
    s = 0.01
    g = pd.Seg(np.array([50.0, 101.5]), np.array([549.0, 101.5]), [4.0] * 5, axis=True)
    assert pd.drop_steps_edges([g], _lines(), s) == [g], "a line alone is kept"
    assert pd.drop_steps_edges([g], _lines(160), s) == [g], "one parallel line (a corridor, a wall's other face): kept"
    assert pd.drop_steps_edges([g], _lines(190, 280), s) == [g], "two rows are not enough"
    assert pd.drop_steps_edges([g], _lines(130, 160, 190, 220), s) == [g], "0.3 m apart: stair treads, not rows"
    assert pd.drop_steps_edges([g], _lines(160, 250, 370), s) == [g], "0.6 / 0.9 / 1.2 m: not evenly spaced"
    assert pd.drop_steps_edges([g], _lines(190, 280, 370), s) == [], "three even rows 0.9 m apart: a tribune edge"
    assert pd.drop_steps_edges([g], _lines(10, 40, 70), s) == [g], "treads above, closer than a row"
