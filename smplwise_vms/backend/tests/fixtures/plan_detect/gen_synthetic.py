"""The synthetic test-plan set of the Plan Studio detector (T086, design section 13): six deterministic plans at
1600 x 1200 px drawn with Pillow, each with its ground truth (walls as segments with a thickness, doors with hinge and
swing, windows) in pixel coordinates. `python gen_synthetic.py` rewrites the PNG and JSON files next to it; the test
test_plan_detect_fixtures.py refuses a committed picture that differs from what this script draws. Real scans never
join this folder: they stay in private-evidence/ (scripts/plan_detect_private.py runs the same metrics on them)."""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from typing import Any, Callable

import numpy as np
from PIL import Image, ImageDraw

W, H = 1600, 1200
INK = 0


class Plan:
    def __init__(self, name: str, scale_m_per_px: float, width: int = W, height: int = H) -> None:
        self.name = name
        self.im = Image.new("L", (width, height), 255)
        self.d = ImageDraw.Draw(self.im)
        self.gt: dict[str, Any] = {"name": name, "width": width, "height": height, "scale_m_per_px": scale_m_per_px, "walls": [], "doors": [], "windows": []}

    def wall(self, a, b, t: int, kind: str = "interior") -> int:
        self.d.line([tuple(a), tuple(b)], fill=INK, width=t)
        for p in (a, b):  # square caps: a Pillow line leaves half caps open at its ends; corners must be solid
            self.d.rectangle([p[0] - t // 2, p[1] - t // 2, p[0] + t // 2, p[1] + t // 2], fill=INK)
        self.gt["walls"].append({"a": list(a), "b": list(b), "thickness_px": t, "kind": kind})
        return len(self.gt["walls"]) - 1

    def _gap(self, wall_i: int, centre, width: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        w = self.gt["walls"][wall_i]
        a, b = np.array(w["a"], float), np.array(w["b"], float)
        d = (b - a) / np.linalg.norm(b - a)
        n = np.array([d[1], -d[0]])
        t = w["thickness_px"]
        c = np.array(centre, float)
        g0, g1 = c - d * width / 2, c + d * width / 2
        poly = [tuple(g0 + n * (t / 2 + 1)), tuple(g1 + n * (t / 2 + 1)), tuple(g1 - n * (t / 2 + 1)), tuple(g0 - n * (t / 2 + 1))]
        self.d.polygon(poly, fill=255)  # the wall is erased inside the gap
        return g0, g1, d

    def door(self, wall_i: int, centre, width: int, hinge: str = "start", swing: str = "left", double: bool = False) -> None:
        """A door symbol as architects draw it: the leaf from the hinge and the quarter arc it sweeps. hinge / swing are
        relative to the wall's direction a -> b: nl = (d.y, -d.x) is "left", nr = (-d.y, d.x) is "right" (the same
        convention as geometry.ts door())."""
        g0, g1, d = self._gap(wall_i, centre, width)
        nl, nr = np.array([d[1], -d[0]]), np.array([-d[1], d[0]])
        n = nl if swing == "left" else nr
        if double:
            leaves = [(g0, g0 + d * width / 2, width / 2), (g1, g1 - d * width / 2, width / 2)]
        else:
            leaves = [(g0, g1, width)] if hinge == "start" else [(g1, g0, width)]
        for h, other, r in leaves:
            tip = h + n * r
            self.d.line([tuple(h), tuple(tip)], fill=INK, width=2)
            a0 = math.atan2(tip[1] - h[1], tip[0] - h[0])
            a1 = math.atan2(other[1] - h[1], other[0] - h[0])
            da = (a1 - a0 + math.pi) % (2 * math.pi) - math.pi
            pts = [(h[0] + r * math.cos(a0 + da * k / 30), h[1] + r * math.sin(a0 + da * k / 30)) for k in range(31)]
            self.d.line(pts, fill=INK, width=2)
        self.gt["doors"].append({"centre": list(centre), "width_px": width, "wall": wall_i, "hinge": hinge, "swing": "double" if double else swing, "double": double})

    def window(self, wall_i: int, centre, width: int, lines: int = 3) -> None:
        """Two or three thin lines along the wall inside the opening (both faces and the glass line)."""
        g0, g1, d = self._gap(wall_i, centre, width)
        t = self.gt["walls"][wall_i]["thickness_px"]
        n = np.array([d[1], -d[0]])
        for o in ([-t / 2, 0, t / 2] if lines == 3 else [-t / 2, t / 2]):
            self.d.line([tuple(g0 + n * o), tuple(g1 + n * o)], fill=INK, width=2)
        self.gt["windows"].append({"centre": list(centre), "width_px": width, "wall": wall_i})

    def text_specks(self, x0: int, y0: int, n: int = 24) -> None:
        for i in range(n):
            x = x0 + i * 22
            self.d.rectangle([x, y0, x + 7, y0 + 12], outline=INK, width=1)

    def dimension_line(self, a, b) -> None:
        self.d.line([tuple(a), tuple(b)], fill=INK, width=1)
        for p in (a, b):
            self.d.line([(p[0], p[1] - 8), (p[0], p[1] + 8)], fill=INK, width=1)

    def furniture(self, box) -> None:
        self.d.rectangle(list(box), outline=INK, width=2)


def apartment(name: str = "apartment", outer: int = 16, inner: int = 10, door_w: int = 90, win_w: int = 120, scale: float = 0.01) -> Plan:
    """16 x 12 m at 0.01 m / px: outer walls 0.16 m, partitions 0.10 m, doors 0.9 m, windows 1.2 m."""
    p = Plan(name, scale)
    w0 = p.wall((120, 120), (1480, 120), outer, "exterior")
    w1 = p.wall((1480, 120), (1480, 1080), outer, "exterior")
    w2 = p.wall((1480, 1080), (120, 1080), outer, "exterior")
    p.wall((120, 1080), (120, 120), outer, "exterior")
    w4 = p.wall((800, 120), (800, 1080), inner)
    w5 = p.wall((120, 600), (800, 600), inner)
    w6 = p.wall((800, 700), (1480, 700), inner)
    p.door(w4, (800, 400), door_w, "start", "left")
    p.door(w5, (460, 600), door_w, "end", "right")
    p.door(w6, (1140, 700), door_w, "start", "right")
    p.door(w2, (400, 1080), door_w, "start", "left")
    p.window(w0, (460, 120), win_w)
    p.window(w0, (1140, 120), win_w)
    p.window(w1, (1480, 900), win_w, lines=2)
    p.text_specks(200, 160)
    p.dimension_line((120, 1140), (1480, 1140))
    p.furniture((900, 800, 1100, 950))
    return p


def lshape() -> Plan:
    p = Plan("lshape", 0.01)
    pts = [(120, 120), (1000, 120), (1000, 640), (1480, 640), (1480, 1080), (120, 1080)]
    ids = [p.wall(a, b, 16, "exterior") for a, b in zip(pts, pts[1:] + pts[:1])]
    c1 = p.wall((560, 120), (560, 1080), 10)
    c2 = p.wall((120, 500), (560, 500), 10)
    c3 = p.wall((560, 860), (1480, 860), 10)  # the corridor wall
    p.wall((1000, 640), (1000, 860), 10)
    p.door(c1, (560, 320), 90, "start", "right")
    p.door(c2, (340, 500), 90, "end", "left")
    p.door(c3, (780, 860), 90, "start", "left")
    p.door(c3, (1240, 860), 90, "end", "right")
    p.window(ids[0], (340, 120), 120)
    p.window(ids[3], (1480, 860), 120)
    p.text_specks(640, 180, 12)
    return p


def hall() -> Plan:
    """A hall at 0.012 m / px: a 1.9 m double door in the inner wall, 0.96 m doors, five 1.2 m windows in a row."""
    p = Plan("hall", 0.012)
    w0 = p.wall((100, 100), (1500, 100), 20, "exterior")
    p.wall((1500, 100), (1500, 1100), 20, "exterior")
    w2 = p.wall((1500, 1100), (100, 1100), 20, "exterior")
    p.wall((100, 1100), (100, 100), 20, "exterior")
    w4 = p.wall((100, 900), (1500, 900), 12)
    p.door(w4, (800, 900), 160, double=True)
    p.door(w2, (300, 1100), 80, "start", "right")
    p.door(w2, (1300, 1100), 80, "end", "left")
    for x in (300, 550, 800, 1050, 1300):
        p.window(w0, (x, 100), 100)
    p.furniture((400, 300, 500, 360))
    p.furniture((700, 300, 800, 360))
    return p


def diagonal() -> Plan:
    """A 45 degree wall with a door, a wall at about 20 degrees, a steep outer edge."""
    p = Plan("diagonal", 0.01)
    pts = [(200, 120), (1480, 120), (1480, 1080), (120, 1080), (120, 500)]
    ids = [p.wall(a, b, 16, "exterior") for a, b in zip(pts, pts[1:] + pts[:1])]
    d1 = p.wall((700, 120), (1200, 620), 10)
    d2 = p.wall((1200, 620), (1480, 620), 10)
    p.wall((120, 800), (900, 1080), 10)
    p.door(d1, (950, 370), 90, "start", "left")
    p.door(d2, (1340, 620), 90, "end", "right")
    p.window(ids[0], (450, 120), 120)
    return p


def noisy(seed: int = 7, angle: float = 0.8) -> Plan:
    """The apartment as a poor scan: speckle (0.4 % of the pixels), grey noise and a 0.8 degree rotation. The ground
    truth is rotated with the picture (Pillow rotates counter-clockwise on screen about the centre)."""
    p = apartment("noisy", scale=0.0105)
    rng = np.random.RandomState(seed)
    arr = np.asarray(p.im, dtype=np.uint8).copy()
    arr[rng.rand(*arr.shape) < 0.004] = 60
    arr = np.clip(arr.astype(np.float64) + rng.normal(0, 6, arr.shape), 0, 255).astype(np.uint8)
    p.im = Image.fromarray(arr, "L").rotate(angle, resample=Image.BILINEAR, fillcolor=255)
    cx, cy, th = W / 2, H / 2, math.radians(angle)

    def rot(q):
        x, y = q[0] - cx, q[1] - cy
        return [round(cx + x * math.cos(th) + y * math.sin(th), 1), round(cy - x * math.sin(th) + y * math.cos(th), 1)]

    for w in p.gt["walls"]:
        w["a"], w["b"] = rot(w["a"]), rot(w["b"])
    for o in p.gt["doors"] + p.gt["windows"]:
        o["centre"] = rot(o["centre"])
    p.gt["rotation_deg"] = angle
    return p


def thick() -> Plan:
    """Heavier walls at 0.009 m / px: 0.25 m outer, 0.16 m inner, 0.9 m doors, 1.17 m windows."""
    return apartment("thick", outer=28, inner=18, door_w=100, win_w=130, scale=0.009)


PLANS: dict[str, Callable[[], Plan]] = {"apartment": apartment, "lshape": lshape, "hall": hall, "diagonal": diagonal, "noisy": noisy, "thick": thick}


def build(name: str) -> Plan:
    return PLANS[name]()


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
