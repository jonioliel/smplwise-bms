"""Plan Studio door model arc_v2 (T087, behind the detect request's door_model flag): a door drawn in a gap is found by
both models and not twice; a door drawn over a wall that continues through it (no gap) and a thin grey arc are found
by arc_v2 only; every hinge / swing / orientation reproduces the drawing; a round table, a column and a stair arc beside
a wall are not doors; the default model's answer is unchanged, an unknown model is refused, and the search keeps the
run's deadline."""
from __future__ import annotations

import io
import math
import pathlib
import sys
import time

import numpy as np
import pytest

from smplwise.services import plan_detect as pd
from smplwise.services import plan_detect_doors as pdd

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent / "fixtures" / "plan_detect"))
import gen_synthetic as gen  # noqa: E402

SCALE = 0.01  # 1 cm per pixel: a 0.9 m door is 90 px


def _room(vertical: bool = True, inner: int = 10) -> tuple[gen.Plan, int]:
    """A 7 x 4 m room with 14 px outer walls and one partition (vertical at x 400, or horizontal at y 250)."""
    p = gen.Plan("t", SCALE, 800, 500)
    for a, b in (((60, 60), (740, 60)), ((740, 60), (740, 440)), ((740, 440), (60, 440)), ((60, 440), (60, 60))):
        p.wall(a, b, 14, "exterior")
    wall = p.wall((400, 60), (400, 440), inner) if vertical else p.wall((60, 250), (740, 250), inner)
    return p, wall


def _symbol(p: gen.Plan, hinge, latch, swing_n, fill: int = 0, width: int = 2, leaf: bool = True, arc: bool = True) -> None:
    """A door symbol drawn over whatever is there (no gap is cut): the open leaf from the hinge along swing_n and the
    quarter arc from its tip back to the latch."""
    h, l = np.array(hinge, float), np.array(latch, float)
    r = float(np.hypot(*(l - h)))
    tip = h + np.array(swing_n, float) * r
    if leaf:
        p.d.line([tuple(h), tuple(tip)], fill=fill, width=width)
    if arc:
        a0 = math.atan2(tip[1] - h[1], tip[0] - h[0])
        a1 = math.atan2(l[1] - h[1], l[0] - h[0])
        da = (a1 - a0 + math.pi) % (2 * math.pi) - math.pi
        pts = [(h[0] + r * math.cos(a0 + da * k / 40), h[1] + r * math.sin(a0 + da * k / 40)) for k in range(41)]
        p.d.line(pts, fill=fill, width=width)


def _png(p: gen.Plan) -> bytes:
    buf = io.BytesIO()
    p.im.save(buf, "PNG")
    return buf.getvalue()


def _doors(r: dict) -> list[dict]:
    return [o for o in r["openings"] if o["kind"] == "door"]


def _v2(r: dict) -> list[dict]:
    return [o for o in _doors(r) if r["pixels"][o["id"]].get("model") == "arc_v2"]


def _centre(r: dict, o: dict, size=(800, 500)) -> np.ndarray:
    w = next(x for x in r["walls"] if x["id"] == o["wall_id"])
    a, b = np.array(w["polyline"][0]) * size, np.array(w["polyline"][1]) * size
    return a + (b - a) * o["t"]


def _tip_on_ink(p: gen.Plan, r: dict, o: dict) -> bool:
    """The leaf tip computed from the candidate (hinge end + normal x width, geometry.ts door()) lies on drawn ink."""
    w = next(x for x in r["walls"] if x["id"] == o["wall_id"])
    a, b = np.array(w["polyline"][0]) * [800, 500], np.array(w["polyline"][1]) * [800, 500]
    d = (b - a) / np.linalg.norm(b - a)
    c = a + (b - a) * o["t"]
    width = r["pixels"][o["id"]]["width_px"]
    hinge = c - d * width / 2 if o["hinge"] == "start" else c + d * width / 2
    n = np.array([d[1], -d[0]]) if o["swing"] == "left" else np.array([-d[1], d[0]])
    tip = hinge + n * width
    arr = np.asarray(p.im.convert("L")) < 200
    x, y = int(round(tip[0])), int(round(tip[1]))
    return bool(arr[max(0, y - 4):y + 5, max(0, x - 4):x + 5].any())


def test_a_door_in_a_gap_is_found_by_both_models_once():
    p, wall = _room()
    p.door(wall, (400, 250), 90, "start", "left")
    png = _png(p)
    old = pd.detect(png, scale_m_per_px=SCALE, run_id="x")
    new = pd.detect(png, scale_m_per_px=SCALE, run_id="x", door_model="arc_v2")
    assert len(_doors(old)) == 1 and len(_doors(new)) == 1, (old["openings"], new["openings"])
    assert new["openings"] == old["openings"], "a door the gap model proved stays exactly as it was"
    assert new["detector"]["params"]["door_model"] == "arc_v2" and new["stats"]["arc_v2"]["dropped"] >= 1


def test_an_arc_over_a_wall_without_a_gap_is_found_by_arc_v2_only():
    p, _wall = _room()
    _symbol(p, (400, 205), (400, 295), (1, 0))  # hinge at y 205, latch at 295, the leaf opens to the right
    png = _png(p)
    assert _doors(pd.detect(png, scale_m_per_px=SCALE)) == []
    r = pd.detect(png, scale_m_per_px=SCALE, run_id="x", door_model="arc_v2")
    doors = _v2(r)
    assert len(doors) == 1, r["openings"]
    o = doors[0]
    assert abs(o["width_m"] - 0.9) <= 0.1 and o["source"] == "auto" and 0.3 <= o["confidence"] <= pdd.V2_CONF_CAP
    assert np.hypot(*(_centre(r, o) - (400, 250))) <= 12
    assert _tip_on_ink(p, r, o)
    assert r["pixels"][o["id"]]["swing_kind"] == "arc" and r["calibration_hint"] is None


def test_a_thin_grey_arc_is_found():
    p, _wall = _room()
    _symbol(p, (400, 205), (400, 295), (-1, 0), fill=150, width=1)
    r = pd.detect(_png(p), scale_m_per_px=SCALE, run_id="x", door_model="arc_v2")
    doors = _v2(r)
    assert len(doors) == 1 and np.hypot(*(_centre(r, doors[0]) - (400, 250))) <= 12, r["openings"]
    assert _tip_on_ink(p, r, doors[0])


@pytest.mark.parametrize("vertical", [True, False])
@pytest.mark.parametrize("latch_sign", [1, -1])
@pytest.mark.parametrize("swing_sign", [1, -1])
def test_mirrored_and_rotated_doors_keep_the_drawings_hinge_and_swing(vertical, latch_sign, swing_sign):
    p, _wall = _room(vertical)
    if vertical:
        c, d, n = np.array([400.0, 250.0]), np.array([0.0, 1.0]), np.array([1.0, 0.0])
    else:
        c, d, n = np.array([300.0, 250.0]), np.array([1.0, 0.0]), np.array([0.0, 1.0])
    hinge, latch = c - d * latch_sign * 45, c + d * latch_sign * 45
    _symbol(p, tuple(hinge), tuple(latch), tuple(n * swing_sign))
    r = pd.detect(_png(p), scale_m_per_px=SCALE, run_id="x", door_model="arc_v2")
    doors = _v2(r)
    assert len(doors) == 1, (vertical, latch_sign, swing_sign, r["openings"])
    assert np.hypot(*(_centre(r, doors[0]) - c)) <= 12
    assert _tip_on_ink(p, r, doors[0]), (vertical, latch_sign, swing_sign, doors[0])


def test_round_table_column_and_stair_arc_are_not_doors():
    p, _wall = _room()
    # a round table (0.9 m) whose rim touches the partition, a filled column on the partition, a chair ring
    p.d.ellipse([402, 100, 492, 190], outline=0, width=2)
    p.d.ellipse([390, 300, 410, 320], fill=0)
    p.d.ellipse([300, 330, 380, 410], outline=0, width=2)
    # a stair with a quarter-turn arc on the partition: the arc crossed by treads (radial lines) every 25 cm
    h = np.array([400.0, 430.0])
    for k in range(0, 91, 15):
        a = math.radians(180 + k)
        p.d.line([tuple(h + 30 * np.array([math.cos(a), math.sin(a)])), tuple(h + 100 * np.array([math.cos(a), math.sin(a)]))], fill=0, width=2)
    pts = [tuple(h + 90 * np.array([math.cos(math.radians(180 + k)), math.sin(math.radians(180 + k))])) for k in range(0, 91, 3)]
    p.d.line(pts, fill=0, width=2)
    r = pd.detect(_png(p), scale_m_per_px=SCALE, run_id="x", door_model="arc_v2")
    assert _v2(r) == [], [(o, r["pixels"][o["id"]]) for o in _v2(r)]


def test_the_default_model_is_unchanged_and_an_unknown_model_is_refused():
    p, wall = _room()
    p.door(wall, (400, 250), 90, "end", "right")
    png = _png(p)
    a = pd.detect(png, scale_m_per_px=SCALE, run_id="x")
    b = pd.detect(png, scale_m_per_px=SCALE, run_id="x", door_model="gap")
    for r in (a, b):
        r["stats"].pop("ms")
    assert a == b and "door_model" not in a["detector"]["params"] and "arc_v2" not in a["stats"]
    assert all("model" not in v for v in a["pixels"].values())
    with pytest.raises(ValueError):
        pd.detect(png, scale_m_per_px=SCALE, door_model="learned")


def test_the_light_mask_is_only_built_for_arc_v2(monkeypatch):
    p, wall = _room()
    p.door(wall, (400, 250), 90, "end", "right")
    png = _png(p)
    real = pd._analysis
    seen: list[tuple[tuple, dict, dict]] = []

    def spy(*args, **kwargs):
        out = real(*args, **kwargs)
        seen.append((args, kwargs, out))
        return out

    monkeypatch.setattr(pd, "_analysis", spy)
    pd.detect(png, scale_m_per_px=SCALE)
    assert len(seen) == 2 and all(kw == {} and "light" not in out for _a, kw, out in seen), "the default path computes no light mask"
    seen.clear()
    pd.detect(png, scale_m_per_px=SCALE, door_model="arc_v2")
    assert ["light" in out for _a, _kw, out in seen] == [False, True], "the tilt probe never, the main pass only behind the flag"


def test_arc_v2_keeps_the_deadline_and_its_cost_is_bounded():
    p, _wall = _room()
    _symbol(p, (400, 205), (400, 295), (1, 0))
    png = _png(p)
    with pytest.raises(pd.DetectTimeout):
        pd.detect(png, scale_m_per_px=SCALE, door_model="arc_v2", deadline=time.monotonic() - 1)
    t0 = time.perf_counter()
    pd.detect(png, scale_m_per_px=SCALE, door_model="gap")
    base = time.perf_counter() - t0
    t0 = time.perf_counter()
    pd.detect(png, scale_m_per_px=SCALE, door_model="arc_v2")
    extra = time.perf_counter() - t0 - base
    assert extra < max(2.0, 2 * base), (base, extra)


def test_the_detect_route_takes_the_flag_and_refuses_an_unknown_model(settings):
    from test_plan_detect_api import _setup

    _app, c, _ids, vid = _setup(settings)
    r = c.post(f"/api/v1/plan-versions/{vid}/detect", json={"door_model": "arc_v2"})
    assert r.status_code == 200, r.text
    assert r.json()["detector"]["params"]["door_model"] == "arc_v2" and "arc_v2" in r.json()["stats"]
    plain = c.post(f"/api/v1/plan-versions/{vid}/detect", json={})
    assert plain.status_code == 200 and "door_model" not in plain.json()["detector"]["params"]
    assert c.post(f"/api/v1/plan-versions/{vid}/detect", json={"door_model": "learned"}).status_code == 422