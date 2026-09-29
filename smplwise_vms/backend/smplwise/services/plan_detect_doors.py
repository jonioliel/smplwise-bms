"""Door model "arc_v2" of the Plan Studio detector (T087, behind the detect request's `door_model` flag, off by default).

The default model (plan_detect.classify_gap) only looks for a door where two collinear wall pieces leave a gap, and
wants a solid quarter arc with clear rings there. On real scans many doors leave no gap (a single-line partition, a
thin hollow exterior wall the closing bridges), and the arcs are thin and grey. This model searches the door symbol
itself, anchored on the wall lines, without needing a gap:

- hinge: every point along every detected wall, on its centre line and both faces, every V2_STEP_PX, and up to one
  door width past each end (a door in a gap whose far piece was not found hinges there);
- width: a small radius set from the plan's scale (V2_WIDTH_M, doors of 0.6-1.2 m; a leaf of a double door is in it);
- a closed leaf lies along the wall from the hinge to the latch (+-wall direction), the open leaf goes out along the
  wall normal (either side): four templates per hinge and radius;
- score: the open leaf drawn as a straight line from the hinge (>= V2_LEAF_MIN, on the light ink including walls:
  the closing often joins a drawn leaf to its wall) and the swing drawn from the leaf tip back to the latch on the
  thin-line mask (light ink that is not wall, grown by a pixel), either as the quarter arc (>= V2_ARC_MIN) or, as
  some offices draw it, as the straight chord (>= V2_CHORD_MIN);
- rejects: the quarter circles at 0.7 r and 1.3 r (their middle only - leaf and jambs cross their ends) hold at most
  V2_RING_MAX (hatching, text, stair treads fill them); the same circle beyond the leaf and on the far side of the
  wall holds at most V2_BEYOND_MAX (a round table, a column or a stair well continues there, a door does not);
- non-maximum suppression over hinges closer than half a radius; two mirrored leaves whose latches meet on one wall
  are one double door; a candidate that falls on an opening of the gap model upgrades a passage (and leaves a door or
  window alone).

Candidates carry a confidence capped at V2_CONF_CAP: they are proposals for the acceptance screen, never accepted by
themselves. Cost: a few vectorised samplings per template; checked against the run's deadline between walls.

Status (docs/evidence/T087/DOOR_MODEL_STUDY_2026-09-29.md): stopped by the T087 stop rule. On the owner's three scans
two thirds of the doors have no arc (45 degree leaves, "V" doubles, chord triangles) and their jambs are rarely
detected walls at the 1600 px working raster; this model finds 0 / 2 / 4 of 8 sampled doors per floor with 1 / 13 /
13 other candidates. It stays behind the flag for plans drawn with arcs on detected walls."""
from __future__ import annotations

import math
from typing import Any

import numpy as np

from . import plan_stylize as ps

V2_WIDTH_M = (0.6, 1.2)  # door leaves searched (a single door 0.7-1.1 m, a leaf of a double from 0.6 m)
V2_RADII = 7  # radii in that range, evenly
V2_STEP_PX = 1.5  # hinge step along a wall line
# thresholds from the T087 sweep on the owner's scans (DOOR_MODEL_STUDY_2026-09-29.md): 0.6 / 0.6 / 0.8 / 0.35 / 0.35
# found 12 of 24 sampled doors with ~250 other candidates; these find 6 with 27
V2_ARC_MIN = 0.8
V2_LEAF_MIN = 0.8
V2_CHORD_MIN = 0.9
V2_RING_MAX = 0.12  # sampled densely (20 points): stair treads crossing the swing read 0.2-0.3, a door's swing is empty
V2_BEYOND_MAX = 0.2
V2_CONF_CAP = 0.7
V2_MIN_RADIUS_PX = 8.0  # a door smaller than this at the working resolution cannot be told from text
V2_LEAF_ON_INK = True  # the open leaf is read on the whole light ink: at the working resolution the closing often joins a drawn leaf to its wall


def line_mask(an: dict[str, Any]) -> np.ndarray:
    """The thin drawn lines: the light ink (plan_detect._analysis, at least up to grey 200) that is not wall (the wall
    mask grown by a pixel), grown back by a pixel so a 1-px grey arc sampled a pixel off still counts."""
    return ps.dilate(an["light"] & ~ps.dilate(an["walls"], 1), 1)


def sample(mask: np.ndarray, pts: np.ndarray) -> np.ndarray:
    """mask at the points (..., 2) -> bool (...)."""
    h, w = mask.shape
    xs = np.clip(np.rint(pts[..., 0]).astype(np.int64), 0, w - 1)
    ys = np.clip(np.rint(pts[..., 1]).astype(np.int64), 0, h - 1)
    return mask[ys, xs]


def arc_pts(c: np.ndarray, r: np.ndarray, u: np.ndarray, n: np.ndarray, lo: float, hi: float, count: int) -> np.ndarray:
    """Points on the circles about the centres c (k x 2) with radii r (k) from direction u (k x 2, angle 0) toward
    n (k x 2, angle 90 degrees), fractions lo..hi of the quarter (may pass 1 or go below 0): k x count x 2."""
    th = np.linspace(lo, hi, count) * (math.pi / 2)
    cs, sn = np.cos(th)[None, :, None], np.sin(th)[None, :, None]
    return c[:, None, :] + (cs * u[:, None, :] + sn * n[:, None, :]) * r[:, None, None]


def line_pts(a: np.ndarray, b: np.ndarray, lo: float, hi: float, count: int) -> np.ndarray:
    t = np.linspace(lo, hi, count)[None, :, None]
    return a[:, None, :] + (b - a)[:, None, :] * t


def _ratio(mask: np.ndarray, pts: np.ndarray) -> np.ndarray:
    return sample(mask, pts).mean(axis=1)


def _anchors(walls: list[Any], reach: float = 0.0):
    """Per wall: (index, wall, hinge points n x 2, direction) - the centre line and both faces every V2_STEP_PX, from
    `reach` before its start to `reach` past its end (a door in a gap whose far piece was not found hinges there)."""
    for wi, g in enumerate(walls):
        d = g.dir
        nl = np.array([d[1], -d[0]])
        n_steps = max(1, int((g.length + 2 * reach) / V2_STEP_PX) + 1)
        along = np.linspace(-reach, g.length + reach, n_steps)
        offs = (-g.thick / 2, 0.0, g.thick / 2)
        hinge = (g.a[None, None, :] + along[:, None, None] * d[None, None, :] + np.array(offs)[None, :, None] * nl[None, None, :]).reshape(-1, 2)
        yield wi, g, hinge, d


def find_doors(walls: list[Any], an: dict[str, Any], s: float, calibrated: bool, deadline_check: Any = None) -> tuple[list[dict[str, Any]], dict[str, int]]:
    """Door candidates on the wall lines (see the module docstring). `walls` are plan_detect.Seg objects in analysis
    pixels, `s` metres per analysis pixel. Returns (doors, stats); a door is a dict of plan_detect's opening shape
    (kind, swing, hinge, confidence, width_px, wall_seg, t) plus `model` "arc_v2" and its scores."""
    m = line_mask(an)
    lo_m, hi_m = V2_WIDTH_M if calibrated else (V2_WIDTH_M[0] * 0.85, V2_WIDTH_M[1] * 1.15)  # an estimated scale is rougher
    radii = np.linspace(lo_m / s, hi_m / s, V2_RADII)
    radii = radii[radii >= V2_MIN_RADIUS_PX]
    stats = {"templates": 0, "shape_pass": 0, "kept": 0}
    if radii.size == 0 or not walls:
        return [], stats
    found: list[dict[str, Any]] = []
    leaf_mask = ps.dilate(an["light"], 1) if V2_LEAF_ON_INK else m
    for wi, g, hinge, d in _anchors(walls, float(radii.max())):
        if deadline_check is not None:
            deadline_check()
        nl = np.array([d[1], -d[0]])
        # templates: hinge x radius x latch direction (+d / -d) x swing side (nl / -nl)
        H = np.repeat(hinge, radii.size * 4, axis=0)
        R = np.tile(np.repeat(radii, 4), len(hinge))
        sgn_u = np.tile(np.array([1.0, 1.0, -1.0, -1.0]), len(hinge) * radii.size)
        sgn_n = np.tile(np.array([1.0, -1.0, 1.0, -1.0]), len(hinge) * radii.size)
        U = sgn_u[:, None] * d[None, :]
        N = sgn_n[:, None] * nl[None, :]
        stats["templates"] += len(H)
        tip = H + N * R[:, None]
        latch = H + U * R[:, None]
        leaf = _ratio(leaf_mask, line_pts(H, tip, 0.25, 0.85, 10))
        ok = leaf >= V2_LEAF_MIN
        if not ok.any():
            continue
        H, R, U, N, tip, latch, leaf = H[ok], R[ok], U[ok], N[ok], tip[ok], latch[ok], leaf[ok]
        arc = _ratio(m, arc_pts(H, R, U, N, 0.15, 0.85, 20))
        chord = _ratio(m, line_pts(tip, latch, 0.2, 0.8, 12))
        ok = (arc >= V2_ARC_MIN) | (chord >= V2_CHORD_MIN)
        if not ok.any():
            continue
        H, R, U, N, leaf, arc, chord = H[ok], R[ok], U[ok], N[ok], leaf[ok], arc[ok], chord[ok]
        stats["shape_pass"] += int(ok.sum())
        ring_in = _ratio(m, arc_pts(H, R * 0.7, U, N, 0.25, 0.75, 20))
        ring_out = _ratio(m, arc_pts(H, R * 1.3, U, N, 0.25, 0.75, 20))
        past_leaf = _ratio(m, arc_pts(H, R, U, N, 1.15, 1.6, 10))  # beyond the open leaf, away from the latch
        far_side = _ratio(m, arc_pts(H, R, U, -N, 0.3, 0.8, 10))  # the same quarter on the other side of the wall
        ok = (ring_in <= V2_RING_MAX) & (ring_out <= V2_RING_MAX) & (past_leaf <= V2_BEYOND_MAX) & (far_side <= V2_BEYOND_MAX)
        # a chord symbol is a straight line: without the arc it must also be clear of the arc itself (a filled or
        # hatched triangle is not a door)
        for k in np.nonzero(ok)[0]:
            use_arc = arc[k] >= V2_ARC_MIN
            swing_ink = arc[k] if use_arc else chord[k]
            clutter = max(ring_in[k], ring_out[k], past_leaf[k], far_side[k])
            score = 0.5 * leaf[k] + 0.5 * swing_ink - 0.5 * clutter
            conf = round(min(V2_CONF_CAP, max(0.3, 0.3 + 0.4 * score - (0.05 if not use_arc else 0.0))), 3)
            h = H[k]
            along_h, _ = g.project(h)
            latch_dir = 1.0 if float(np.dot(U[k], d)) > 0 else -1.0
            centre_along = along_h + latch_dir * R[k] / 2
            found.append({
                "kind": "door", "swing": "left" if float(np.dot(N[k], nl)) > 0 else "right", "hinge": "start" if latch_dir > 0 else "end",
                "confidence": conf, "width_px": float(R[k]), "wall_seg": wi, "t": centre_along / max(g.length, 1e-9), "model": "arc_v2",
                "score": float(score), "hinge_px": [float(h[0]), float(h[1])], "latch_dir": latch_dir, "swing_kind": "arc" if use_arc else "chord",
                "scores": {"leaf": round(float(leaf[k]), 2), "arc": round(float(arc[k]), 2), "chord": round(float(chord[k]), 2), "clutter": round(float(clutter), 2)},
            })
    # non-maximum suppression: the best template per hinge neighbourhood (half its radius)
    found.sort(key=lambda o: -o["score"])
    kept: list[dict[str, Any]] = []
    for o in found:
        p = np.array(o["hinge_px"])
        if any(float(np.hypot(*(p - np.array(k["hinge_px"])))) < 0.5 * max(o["width_px"], k["width_px"]) for k in kept):
            continue
        kept.append(o)
    doors = _pair_doubles(kept, walls)
    stats["kept"] = len(doors)
    return doors, stats


def _pair_doubles(doors: list[dict[str, Any]], walls: list[Any]) -> list[dict[str, Any]]:
    """Two leaves on one wall, swinging to the same side, with facing latch directions whose latch points meet (within
    a third of a leaf), are one double door as wide as both."""
    used: set[int] = set()
    out: list[dict[str, Any]] = []
    for i, a in enumerate(doors):
        if i in used:
            continue
        partner = None
        for j in range(i + 1, len(doors)):
            b = doors[j]
            if j in used or b["wall_seg"] != a["wall_seg"] or b["swing"] != a["swing"] or b["latch_dir"] == a["latch_dir"]:
                continue
            g = walls[a["wall_seg"]]
            la = g.project(np.array(a["hinge_px"]))[0] + a["latch_dir"] * a["width_px"]
            lb = g.project(np.array(b["hinge_px"]))[0] + b["latch_dir"] * b["width_px"]
            if abs(la - lb) <= max(a["width_px"], b["width_px"]) / 3 and abs(a["width_px"] - b["width_px"]) <= 0.25 * max(a["width_px"], b["width_px"]):
                partner = j
                break
        if partner is None:
            out.append(a)
            continue
        b = doors[partner]
        used.add(partner)
        g = walls[a["wall_seg"]]
        ha, hb = g.project(np.array(a["hinge_px"]))[0], g.project(np.array(b["hinge_px"]))[0]
        out.append(dict(a, swing="double", hinge="start", width_px=abs(hb - ha), t=(ha + hb) / 2 / max(g.length, 1e-9),
                        confidence=round(min(V2_CONF_CAP, max(a["confidence"], b["confidence"]) + 0.05), 3), score=a["score"] + b["score"]))
    return out


def merge_into(openings: list[dict[str, Any]], doors: list[dict[str, Any]], walls: list[Any]) -> tuple[list[dict[str, Any]], dict[str, int]]:
    """The arc_v2 doors added to the gap model's openings: a door on a passage (same wall, centres closer than half the
    wider of the two) turns the passage into this door; a door on an existing door or window is dropped (the gap
    model keeps what it proved); the rest are added. The helper keys (model scores) are kept for the response's
    pixels map and stripped by the caller."""
    out = [dict(o) for o in openings]
    counts = {"added": 0, "upgraded": 0, "dropped": 0}
    for dr in doors:
        g = walls[dr["wall_seg"]]
        hit = None
        for k, o in enumerate(out):
            if o["wall_seg"] != dr["wall_seg"]:
                continue
            if abs(o["t"] - dr["t"]) * g.length < max(o["width_px"], dr["width_px"]) / 2:
                hit = k
                break
        if hit is None:
            out.append(dr)
            counts["added"] += 1
        elif out[hit]["kind"] == "passage":
            out[hit] = dict(dr, width_px=out[hit]["width_px"], t=out[hit]["t"])  # the gap measures the width better
            counts["upgraded"] += 1
        else:
            counts["dropped"] += 1
    return out, counts
