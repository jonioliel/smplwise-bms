"""Metrics of the Plan Studio detector (T086, R172) against a ground truth in the plan's pixel space: wall recall by
length (a detected segment covers the part of a ground-truth wall it runs along within an angle and a lateral
tolerance), wall precision by length, door and window recall by centre distance. Shared by the baseline test on the
committed synthetic set and by scripts/plan_detect_private.py on private scans (never committed)."""
from __future__ import annotations

import json
import math
import time
from pathlib import Path
from typing import Any, Callable

import numpy as np

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "plan_detect"
ANGLE_TOL_DEG = 6.0
TOLERANCE_PX: dict[str, float] = {"noisy": 12.0}


def load_set(folder: Path = FIXTURES) -> list[tuple[str, dict[str, Any], bytes]]:
    out = []
    for png in sorted(folder.glob("*.png")):
        gt_path = png.with_suffix(".json")
        if gt_path.exists():
            out.append((png.stem, json.loads(gt_path.read_text(encoding="utf-8")), png.read_bytes()))
    return out


def _seg_px(wall: dict[str, Any], w: int, h: int) -> tuple[np.ndarray, np.ndarray]:
    pl = wall["polyline"]
    return np.array([pl[0][0] * w, pl[0][1] * h]), np.array([pl[-1][0] * w, pl[-1][1] * h])


def _overlap_on(gt_a: np.ndarray, gt_b: np.ndarray, a: np.ndarray, b: np.ndarray, tol_px: float) -> float:
    """Length of the detected segment a-b lying along the ground-truth segment: both ends within tol_px of its line,
    directions within ANGLE_TOL_DEG, measured as the overlap of the projections."""
    g = gt_b - gt_a
    gl = float(np.hypot(*g))
    v = b - a
    vl = float(np.hypot(*v))
    if gl < 1e-9 or vl < 1e-9:
        return 0.0
    d = g / gl
    cos = abs(float(np.dot(v / vl, d)))
    if math.degrees(math.acos(max(-1.0, min(1.0, cos)))) > ANGLE_TOL_DEG:
        return 0.0
    for p in (a, b):
        if abs(float(d[0] * (p - gt_a)[1] - d[1] * (p - gt_a)[0])) > tol_px:
            return 0.0
    a0, a1 = float(np.dot(a - gt_a, d)), float(np.dot(b - gt_a, d))
    return max(0.0, min(gl, max(a0, a1)) - max(0.0, min(a0, a1)))


def _subtract(intervals: list[tuple[float, float]], holes: list[tuple[float, float]]) -> list[tuple[float, float]]:
    out = intervals
    for h0, h1 in holes:
        nxt = []
        for lo, hi in out:
            if hi <= h0 or lo >= h1:
                nxt.append((lo, hi))
            else:
                if lo < h0:
                    nxt.append((lo, h0))
                if hi > h1:
                    nxt.append((h1, hi))
        out = nxt
    return out


def _holes(gt: dict[str, Any]) -> dict[int, list[tuple[float, float]]]:
    """The spans of the openings along each ground-truth wall: no wall exists there, so they count neither as length to
    cover nor as covered (a walls-only pass leaves a door gap open; a full pass spans it with the opening)."""
    holes: dict[int, list[tuple[float, float]]] = {}
    for o in gt["doors"] + gt["windows"]:
        gw = gt["walls"][o["wall"]]
        ga, gb = np.array(gw["a"], float), np.array(gw["b"], float)
        d = (gb - ga) / float(np.hypot(*(gb - ga)))
        c = float(np.dot(np.array(o["centre"], float) - ga, d))
        holes.setdefault(o["wall"], []).append((c - o["width_px"] / 2, c + o["width_px"] / 2))
    return holes


def wall_scores(gt: dict[str, Any], walls: list[dict[str, Any]], tol_px: float) -> dict[str, float]:
    w, h = gt["width"], gt["height"]
    holes = _holes(gt)
    total_gt = covered = 0.0
    for wi, gw in enumerate(gt["walls"]):
        ga, gb = np.array(gw["a"], float), np.array(gw["b"], float)
        gl = float(np.hypot(*(gb - ga)))
        total_gt += sum(hi - lo for lo, hi in _subtract([(0.0, gl)], holes.get(wi, [])))
        d = (gb - ga) / gl
        intervals = []
        for dw in walls:
            a, b = _seg_px(dw, w, h)
            if _overlap_on(ga, gb, a, b, tol_px) > 0:
                a0, a1 = float(np.dot(a - ga, d)), float(np.dot(b - ga, d))
                intervals.append((max(0.0, min(a0, a1)), min(gl, max(a0, a1))))
        intervals.sort()
        merged: list[tuple[float, float]] = []
        for lo, hi in intervals:  # the union of the covered intervals, so two overlapping pieces do not count twice
            if merged and lo <= merged[-1][1]:
                merged[-1] = (merged[-1][0], max(merged[-1][1], hi))
            else:
                merged.append((lo, hi))
        covered += sum(hi - lo for lo, hi in _subtract(merged, holes.get(wi, [])))
    total_det = matched = 0.0
    for dw in walls:
        a, b = _seg_px(dw, w, h)
        dl = float(np.hypot(*(b - a)))
        total_det += dl
        best = max((_overlap_on(np.array(gw["a"], float), np.array(gw["b"], float), a, b, tol_px) for gw in gt["walls"]), default=0.0)
        matched += min(dl, best)
    return {"recall": covered / total_gt if total_gt else 1.0, "precision": matched / total_det if total_det else 1.0, "gt_length_px": total_gt, "detected_length_px": total_det}


def _centre(o: dict[str, Any], walls_by_id: dict[str, dict[str, Any]], w: int, h: int) -> np.ndarray | None:
    wall = walls_by_id.get(o["wall_id"])
    if wall is None:
        return None
    a, b = _seg_px(wall, w, h)
    return a + (b - a) * o["t"]


def opening_scores(gt: dict[str, Any], walls: list[dict[str, Any]], openings: list[dict[str, Any]], kinds: tuple[str, ...], gt_key: str, tol_px: float) -> dict[str, Any]:
    """A ground-truth opening is found when a detected opening of one of `kinds` has its centre within tol_px plus half
    the opening's width; kind_recall counts those found as kinds[0] (a door found as a passage is found, not exact)."""
    w, h = gt["width"], gt["height"]
    by_id = {x["id"]: x for x in walls}
    det = [(o, c) for o, c in ((o, _centre(o, by_id, w, h)) for o in openings if o["kind"] in kinds) if c is not None]
    found = exact = 0
    used: set[int] = set()
    for g in gt[gt_key]:
        c = np.array(g["centre"], float)
        best = None
        for k, (_o, dc) in enumerate(det):
            if k in used:
                continue
            dist = float(np.hypot(*(dc - c)))
            if dist <= tol_px + g["width_px"] / 2 and (best is None or dist < best[0]):
                best = (dist, k)
        if best is not None:
            used.add(best[1])
            found += 1
            exact += det[best[1]][0]["kind"] == kinds[0]
    n = len(gt[gt_key])
    return {"recall": found / n if n else 1.0, "kind_recall": exact / n if n else 1.0, "found": found, "total": n, "false": len(det) - len(used)}


def evaluate(gt: dict[str, Any], result: dict[str, Any], tol_px: float = 10.0) -> dict[str, Any]:
    walls = result["walls"]
    return {
        "walls": wall_scores(gt, walls, tol_px),
        "doors": opening_scores(gt, walls, result["openings"], ("door", "passage"), "doors", tol_px),
        "windows": opening_scores(gt, walls, result["openings"], ("window",), "windows", tol_px),
    }


def run_set(detect_fn: Callable[..., dict[str, Any]], folder: Path = FIXTURES, calibrated: bool = True) -> list[dict[str, Any]]:
    """Every plan of a folder through `detect_fn(png_bytes, scale_m_per_px=...)`, scored; the scale is the ground
    truth's when calibrated, else None (the detector then estimates it and offers a door-width hint)."""
    rows = []
    for name, gt, png in load_set(folder):
        t0 = time.perf_counter()
        result = detect_fn(png, scale_m_per_px=gt["scale_m_per_px"] if calibrated else None)
        ms = int((time.perf_counter() - t0) * 1000)
        rows.append({"name": name, "ms": ms, **evaluate(gt, result, TOLERANCE_PX.get(name, 10.0)), "hint": result.get("calibration_hint"), "counts": {"walls": len(result["walls"]), "openings": len(result["openings"])}})
    return rows


def summary_line(rows: list[dict[str, Any]]) -> str:
    """One evidence line: min wall recall / precision, door and window recall over the set, the slowest plan."""
    if not rows:
        return "no plans"
    doors = sum(r["doors"]["found"] for r in rows), sum(r["doors"]["total"] for r in rows)
    wins = sum(r["windows"]["found"] for r in rows), sum(r["windows"]["total"] for r in rows)
    return (f"{len(rows)} plans: walls recall >= {min(r['walls']['recall'] for r in rows):.3f}, precision >= {min(r['walls']['precision'] for r in rows):.3f}; "
            f"doors {doors[0]}/{doors[1]}; windows {wins[0]}/{wins[1]}; slowest {max(r['ms'] for r in rows)} ms")
