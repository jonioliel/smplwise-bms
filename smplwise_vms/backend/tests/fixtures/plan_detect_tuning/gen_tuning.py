"""The detection-tuning set of the Plan Studio detector (T086, the 0.1.90 list items 3-6 modelled on the owner's real
scans, which stay private): four deterministic 1600 x 1200 plans at 0.02 m / px (a 1:100 sheet scanned at about the
owner's resolution) drawn with Pillow, each with its ground truth in pixel coordinates - walls, doors and, new here,
`objects` (a steps region, columns) that the detector proposes as object candidates.

    reference   section-cut lines crossing the envelope (both ends free, an arrow bar outside) - not walls
    steps       a tribune: 7 lines 0.9 m apart, the edges heavier - one steps region, no walls; stair treads stay out
    fragments   partitions broken by 0.1-0.24 m white gaps (a label's halo, a dimension tick across) - one wall each
    piers       a facade of 0.9 m pier boxes every 6 m with faint glazing between - columns and the envelope line
    facade      (review B1) masonry walls with a window rhythm: their piers are no columns, their windows stay
    lnotch      (review M1) an L-shaped building with a detached fence in the notch: a wall, not a section line

`python gen_tuning.py` rewrites the PNG and JSON files next to it; test_plan_detect_tuning2.py refuses a committed
picture that differs from what this script draws."""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Callable

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "plan_detect"))
from gen_synthetic import Plan  # noqa: E402

S = 0.02
OUTER, INNER = 12, 7  # 0.24 m envelope, 0.14 m partitions


def _plan(name: str) -> Plan:
    p = Plan(name, S)
    p.gt["objects"] = []
    return p


def _box(p: Plan, x0: int, y0: int, x1: int, y1: int) -> list[int]:
    pts = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    return [p.wall(a, b, OUTER, "exterior") for a, b in zip(pts, pts[1:] + pts[:1])]


def _stroke(p: Plan, a: tuple[int, int], b: tuple[int, int], width: int, grey: int = 0) -> None:
    """A drawn line that is not a wall (no ground truth)."""
    p.d.line([a, b], fill=grey, width=width)


def reference() -> Plan:
    """A 20 x 14 m building with a partition and a door. Three section-cut lines (0.12 m, the heavy pen of the sheet)
    cross the envelope: each starts 2.5-4 m outside at an arrow bar and ends free 2.6 m inside the room, touching no
    wall - the owner's floor -1 has two such marks ("ב" above and below). A free-standing wall inside the building (both
    ends free, not outside) and a garden wall that leaves the envelope (one end on it) are walls and must stay."""
    p = _plan("reference")
    ids = _box(p, 300, 250, 1300, 950)
    part = p.wall((800, 256), (800, 944), INNER)
    p.door(part, (800, 420), 45, "start", "left")
    p.wall((306, 600), (800, 600), INNER)
    p.wall((900, 800), (1150, 800), INNER)  # free-standing, inside
    p.wall((1300, 700), (1500, 700), OUTER, "exterior")  # a garden wall from the envelope outwards
    for (a, b, bar) in (((1000, 100), (1000, 380), ((960, 97), (1040, 97))),
                        ((1000, 820), (1000, 1110), ((960, 1113), (1040, 1113))),
                        ((100, 450), (430, 450), ((97, 410), (97, 490)))):
        _stroke(p, a, b, 6)
        _stroke(p, bar[0], bar[1], 7)
    p.door(ids[2], (560, 950), 45, "start", "right")
    return p


def steps() -> Plan:
    """A 24 x 18 m hall with a tribune of six 0.9 m rows (7 lines, 12 m long, the two edges 6 px, the rows 3 px) against
    a partition, and a stair of ten 0.3 m treads in a stair box (treads are not rows)."""
    p = _plan("steps")
    _box(p, 200, 150, 1400, 1050)
    p.wall((206, 700), (1394, 700), INNER)
    x0, x1, y0, gap, n = 500, 1100, 300, 45, 7
    for k in range(n):
        y = y0 + gap * k
        w = 6 if k in (0, n - 1) else 3
        p.d.rectangle([x0, y - w // 2, x1, y - w // 2 + w - 1], fill=0)
    p.gt["objects"].append({"kind": "steps", "centre": [(x0 + x1) / 2, y0 + gap * (n - 1) / 2], "size_px": [x1 - x0, gap * (n - 1)], "rows": n - 1})
    # the stair box: two stringers and ten treads 0.3 m apart
    p.wall((1000, 706), (1000, 1044), INNER)
    for k in range(10):
        y = 760 + 15 * k
        p.d.rectangle([1006, y, 1200, y + 1], fill=0)
    p.d.rectangle([1200, 760, 1202, 900], fill=0)
    return p


def fragments() -> Plan:
    """A 24 x 16 m apartment whose partitions are broken by small white gaps with no symbol: 0.1, 0.16 and 0.24 m, one
    with a dimension tick (a thin slash) across it - each partition is one wall. A real 1.0 m passage and a real door
    stay openings."""
    p = _plan("fragments")
    ids = _box(p, 200, 200, 1400, 1000)
    a = p.wall((700, 206), (700, 994), INNER)
    b = p.wall((206, 600), (700, 600), INNER)
    c = p.wall((700, 500), (1394, 500), INNER)
    d = p.wall((1050, 506), (1050, 994), INNER)
    for wall, centre, width in ((a, (700, 330), 5), (a, (700, 820), 8), (b, (330, 600), 12), (c, (880, 500), 8), (c, (1250, 500), 5), (d, (1050, 650), 12)):
        p._gap(wall, centre, width)
    _stroke(p, (1040, 662), (1060, 638), 1)  # a dimension tick across the 0.24 m gap in d
    _stroke(p, (872, 510), (888, 490), 1)  # ... and one across c's first gap
    p.door(c, (1150, 500), 45, "start", "left")
    p._gap(b, (560, 600), 50)  # a 1.0 m passage (no symbol)
    p.gt["doors"].append({"centre": [560, 600], "width_px": 50, "wall": b, "hinge": "start", "swing": "none", "double": False, "passage": True})
    p.door(ids[2], (450, 1000), 45, "start", "right")
    return p


def _pier(p: Plan, cx: int, cy: int, side: int = 45) -> None:
    """A pier as the owner's sheet draws it: a dark 0.1 m outline around a light grey fill with a hatch (the outline's
    sides are what the wall pass suggested as stubs)."""
    h = side // 2
    p.d.rectangle([cx - h, cy - h, cx + h, cy + h], fill=212, outline=0, width=5)
    for k in range(-h + 8, h - 5, 8):
        p.d.line([(cx - h + 5, cy + k), (cx + h - 5, cy + k)], fill=170, width=1)
    p.gt["objects"].append({"kind": "column", "centre": [cx, cy], "size_px": [side, side]})


def piers() -> Plan:
    """A 24 x 15 m office whose envelope on three sides is a row of 0.9 m piers every 6 m (floor -2 of the owner's
    sheets) with faint glazing between (two grey hairlines 0.2 m apart); the fourth side is a solid wall. The envelope
    between the piers is ground truth (the owner: connect the envelope line between them); the piers are columns. A lone
    0.4 m solid column inside is not in a row."""
    p = _plan("piers")
    top = 250
    p.wall((250, top), (1450, top), OUTER, "exterior")
    p.wall((250, top), (250, 400), OUTER, "exterior")
    p.wall((1450, top), (1450, 400), OUTER, "exterior")
    p.wall((850, top + 6), (850, 700), INNER)
    p.wall((256, 550), (850, 550), INNER)
    xs, ys = (250, 550, 850, 1150, 1450), (400, 700, 1000)
    # the envelope lines through the pier row (ground truth) and the glazing drawn between the piers
    p.gt["walls"].append({"a": [250, 400], "b": [250, 1000], "thickness_px": 10, "kind": "exterior"})
    p.gt["walls"].append({"a": [1450, 400], "b": [1450, 1000], "thickness_px": 10, "kind": "exterior"})
    p.gt["walls"].append({"a": [250, 1000], "b": [1450, 1000], "thickness_px": 10, "kind": "exterior"})
    for off in (-5, 5):
        for x in (250, 1450):
            p.d.line([(x + off, 400), (x + off, 1000)], fill=185, width=1)
        p.d.line([(250, 1000 + off), (1450, 1000 + off)], fill=185, width=1)
    for x in xs:
        _pier(p, x, 1000)
    for y in ys[:-1]:
        _pier(p, 250, y)
        _pier(p, 1450, y)
    p.d.rectangle([1140, 540, 1159, 559], fill=0)  # a lone solid column
    return p


def _window3(p: Plan, wall_i: int, centre: tuple[int, int], width: int) -> None:
    """A window as a scan of a thick wall shows it: both faces and the glass in 3 px lines, which the closing joins into
    the wall's band (the gap pass then sees one wall, the profile pass finds the window)."""
    g0, g1, d = p._gap(wall_i, centre, width)
    t = p.gt["walls"][wall_i]["thickness_px"]
    n = np.array([d[1], -d[0]])
    for o in (-(t - 3) / 2, 0.0, (t - 3) / 2):
        p.d.line([tuple(g0 + n * o), tuple(g1 + n * o)], fill=0, width=3)
    p.gt["windows"].append({"centre": list(centre), "width_px": width, "wall": wall_i})


def facade() -> Plan:
    """Review B1: a masonry building whose top wall is 0.64 m thick with a window rhythm - 1.3 m piers between 0.9 m
    windows, 2.2 m apart: blobs of a column's size at a pier grid's spacing - and whose bottom wall is 0.4 m thick with
    1.0 m piers between 0.8 m windows (blobs only to the uncalibrated reading, whose median wall is a thin partition).
    Without the windowed-wall rule the first version proposed 10 (calibrated) / 8 (uncalibrated) columns here.
    The piers are pieces of their walls: no column, the windows found, the walls as without the column rule."""
    p = _plan("facade")
    top = p.wall((200, 250), (1400, 250), 32, "exterior")
    p.wall((1400, 250), (1400, 1050), 14, "exterior")
    bottom = p.wall((1400, 1050), (200, 1050), 20, "exterior")
    p.wall((200, 1050), (200, 250), 14, "exterior")
    for x in (500, 800, 1100):  # thin partitions: the median wall of the uncalibrated reading
        p.wall((x, 264), (x, 1040), 5)
    for y in (500, 800):
        p.wall((207, y), (1393, y), 5)
    for k in range(10):
        _window3(p, top, (330 + 110 * k, 250), 44)
    for k in range(9):
        _window3(p, bottom, (1300 - 90 * k, 1050), 40)
    return p


def lnotch() -> Plan:
    """Review M1: an L-shaped building with detached strokes that start in the notch (inside the building's box, outside
    the building), touch no wall and leave the box: a fence 2.4 m from the notch wall, a fence 0.4 m from it, and a
    railing parallel to the notch wall 0.5 m from it - walls, kept. A section-cut line that cuts the envelope below is
    dropped."""
    p = _plan("lnotch")
    pts = [(200, 200), (1000, 200), (1000, 600), (1400, 600), (1400, 1000), (200, 1000)]
    for a, b in zip(pts, pts[1:] + pts[:1]):
        p.wall(a, b, OUTER, "exterior")
    p.wall((600, 206), (600, 994), INNER)
    p.wall((1200, 480), (1200, 60), 8, "exterior")  # the fence: 0.16 m, 8.4 m long, from the notch out of the box
    p.wall((1100, 570), (1100, 60), 8, "exterior")  # a fence 0.4 m clear of the notch wall's face (closer, the closing joins them)
    p.wall((1130, 575), (1560, 575), 8, "exterior")  # a railing parallel to the notch wall, 0.5 m from it, out of the box
    _stroke(p, (800, 850), (800, 1150), 6)  # a section-cut line through the bottom wall, arrow bar outside
    _stroke(p, (760, 1153), (840, 1153), 7)
    return p


PLANS: dict[str, Callable[[], Plan]] = {"reference": reference, "steps": steps, "fragments": fragments, "piers": piers, "facade": facade, "lnotch": lnotch}


def generate(out_dir: Path) -> list[str]:
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, make in PLANS.items():
        p = make()
        p.im.save(out_dir / f"{name}.png", format="PNG", optimize=True)
        (out_dir / f"{name}.json").write_text(json.dumps(p.gt, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    return list(PLANS)


if __name__ == "__main__":
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent
    print("generated", generate(target))
