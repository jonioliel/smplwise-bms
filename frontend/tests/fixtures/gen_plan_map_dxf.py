"""The DXF drawings of the Plan Studio phase-3 live spec (T086 Task 11, tests/evidence-plan-studio-3.spec.ts): a
synthetic, deterministic flat in metres (plan-map.dxf) and the same drawing in millimetres (plan-map-mm.dxf).

    python frontend/tests/fixtures/gen_plan_map_dxf.py            # rewrite both files beside this script
    python frontend/tests/fixtures/gen_plan_map_dxf.py --check    # exit 1 when a committed file differs

What the drawing holds (metres, y up; the 14 x 10 outline):
- A-WALL: the outline as double lines 0.2 m apart, the south wall broken at a door (x 3 - 3.9) and at a window
  (x 8 - 9.2) with jambs; a double partition x = 6.9 / 7.1 from the north wall down to y = 5 that meets the north
  wall's inner face in a T (the inner face breaks there); a single-line partition y = 5 from the west wall to it.
- A-DOOR: a loose arc at the south door (hinge on the jamb x = 3, the leaf into the flat) and a DOOR90 block (leaf and
  arc, hinge at the base point) on the single-line partition at x = 3.
- A-GLAZ: three glazing lines in the south window.
- A-FURN: CHAIR, DESK as drawn, DESK mirrored (xscale -1), DESK turned 90 degrees, an unknown WIDGET, and a DOOR90
  insert that is not an object.
- A-AREA: one closed room polyline (the north-west room). TEXT: one label.
The backend test test_plan_dxf_map.py::test_the_live_spec_drawing_matches_its_generator_and_maps_as_the_spec_expects
checks the files against this script and pins the counts the live spec asserts."""
from __future__ import annotations

import io
import sys
from pathlib import Path

import ezdxf

HERE = Path(__file__).resolve().parent
FILES = {"plan-map.dxf": (6, 1.0), "plan-map-mm.dxf": (4, 1000.0)}  # $INSUNITS 6 = metres, 4 = millimetres


def _drawing(units_code: int, k: float) -> str:
    doc = ezdxf.new("R2010", setup=False)
    doc.header["$INSUNITS"] = units_code
    for name in ("A-WALL", "A-DOOR", "A-GLAZ", "A-FURN", "A-AREA", "TEXT"):
        doc.layers.add(name)
    msp = doc.modelspace()

    def p(x: float, y: float) -> tuple[float, float]:
        return (round(x * k, 6), round(y * k, 6))

    def line(a: tuple[float, float], b: tuple[float, float], layer: str = "A-WALL") -> None:
        msp.add_line(p(*a), p(*b), dxfattribs={"layer": layer})

    # the outline: outer face on the 14 x 10 rectangle, inner face 0.2 m inside; the south wall broken at the door and
    # the window, with jambs; the north inner face broken where the double partition meets it
    line((0, 0), (3, 0))
    line((3.9, 0), (8, 0))
    line((9.2, 0), (14, 0))
    line((0.2, 0.2), (3, 0.2))
    line((3.9, 0.2), (8, 0.2))
    line((9.2, 0.2), (13.8, 0.2))
    for x in (3, 3.9, 8, 9.2):
        line((x, 0), (x, 0.2))
    line((14, 0), (14, 10))
    line((13.8, 0.2), (13.8, 9.8))
    line((14, 10), (0, 10))
    line((13.8, 9.8), (7.1, 9.8))
    line((6.9, 9.8), (0.2, 9.8))
    line((0, 10), (0, 0))
    line((0.2, 9.8), (0.2, 0.2))
    # the T: a double partition from the north wall down to y = 5, closed at its free end
    line((6.9, 9.8), (6.9, 5))
    line((7.1, 9.8), (7.1, 5))
    line((6.9, 5), (7.1, 5))
    # a single-line partition from the west wall to the double partition
    line((0.2, 5), (6.9, 5))
    # the south door: a loose arc, hinge on the jamb (3, 0.2), from the far jamb (3.9, 0.2) to the leaf (3, 1.1)
    msp.add_arc(p(3, 0.2), 0.9 * k, 0, 90, dxfattribs={"layer": "A-DOOR"})
    # the door block: the leaf up the local y axis and the arc to (0.9, 0), hinge at the base point
    door = doc.blocks.new("DOOR90")
    door.add_line((0, 0), (0, 0.9 * k))
    door.add_arc((0, 0), 0.9 * k, 0, 90)
    msp.add_blockref("DOOR90", p(3, 5), dxfattribs={"layer": "A-DOOR"})
    # the south window: three glazing lines across the wall's thickness
    for y in (0, 0.1, 0.2):
        line((8, y), (9.2, y), "A-GLAZ")
    # furniture blocks (a closed box each)
    for name, w, d in (("CHAIR", 0.45, 0.45), ("DESK", 1.6, 0.8), ("WIDGET", 0.5, 0.5)):
        blk = doc.blocks.new(name=name)
        blk.add_lwpolyline([(0, 0), (w * k, 0), (w * k, d * k), (0, d * k)], close=True)
    msp.add_blockref("CHAIR", p(2, 7), dxfattribs={"layer": "A-FURN"})
    msp.add_blockref("DESK", p(9, 2), dxfattribs={"layer": "A-FURN"})
    msp.add_blockref("DESK", p(12.5, 2), dxfattribs={"layer": "A-FURN", "xscale": -1})
    msp.add_blockref("DESK", p(11, 6), dxfattribs={"layer": "A-FURN", "rotation": 90})
    msp.add_blockref("WIDGET", p(4, 8), dxfattribs={"layer": "A-FURN"})
    msp.add_blockref("DOOR90", p(12, 8.5), dxfattribs={"layer": "A-FURN"})
    msp.add_lwpolyline([p(0.2, 5), p(6.9, 5), p(6.9, 9.8), p(0.2, 9.8)], close=True, dxfattribs={"layer": "A-AREA"})
    msp.add_text("Lobby", dxfattribs={"layer": "TEXT", "height": 0.25 * k}).set_placement(p(1, 1))
    out = io.StringIO()
    doc.write(out)
    return _sorted_classes(out.getvalue().replace("\r\n", "\n"))


def _sorted_classes(text: str) -> str:
    """The CLASSES section with its CLASS records sorted: ezdxf writes them in set order, which follows the process's
    string hash seed; their order means nothing to a reader."""
    lines = text.split("\n")
    start = next(i for i in range(len(lines) - 1) if lines[i].strip() == "2" and lines[i + 1] == "CLASSES") + 2
    end = next(i for i in range(start, len(lines) - 1) if lines[i].strip() == "0" and lines[i + 1] == "ENDSEC")
    records: list[list[str]] = []
    for i in range(start, end, 2):
        if lines[i + 1] == "CLASS":
            records.append([])
        records[-1] += lines[i : i + 2]
    body = [line for record in sorted(records) for line in record]
    return "\n".join(lines[:start] + body + lines[end:])


def drawing(units_code: int = 6, k: float = 1.0) -> str:
    """The drawing as DXF text (LF line ends), every coordinate multiplied by k (1000 for millimetres); ezdxf's fixed
    dates and GUIDs make the same bytes on every run (the option is restored afterwards)."""
    fixed = ezdxf.options.write_fixed_meta_data_for_testing
    ezdxf.options.write_fixed_meta_data_for_testing = True
    try:
        return _drawing(units_code, k)
    finally:
        ezdxf.options.write_fixed_meta_data_for_testing = fixed


def main(argv: list[str]) -> int:
    check = "--check" in argv[1:]
    bad = []
    for name, (code, k) in FILES.items():
        text = drawing(code, k)
        path = HERE / name
        if check:
            if not path.exists() or path.read_bytes() != text.encode("utf-8"):
                bad.append(name)
        else:
            path.write_bytes(text.encode("utf-8"))
    for name in bad:
        print(f"differs: {name}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
