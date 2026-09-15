"""Stylized "SMPLWISE language" rendering of an architectural plan (design handoff M11, local variant).

Pure image processing with Pillow + numpy, nothing leaves the add-on and no model is involved: the plan
is binarised, thin strokes (text, dimension lines, hatching, furniture outlines) are removed by a
morphological opening while double-line walls are merged by a closing, doorways are sealed so enclosed
regions become rooms, and the result is repainted in the design tokens (canvas, white rooms, grey-blue
walls). It is a rendering aid only: rooms are not named, openings are not detected as such, and the
source image is never modified.
"""
from __future__ import annotations

import time
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

CANVAS = (245, 247, 251)   # --sw-bg (SW A)
ROOM = (255, 255, 255)     # --sw-map-room-fill
WALL = (190, 201, 218)     # --sw-map-wall, slightly darker for contrast
FURNITURE = (214, 221, 232)
ANALYSIS_PX = 1600
LABEL_PX = 640
STRENGTH = {"light": (1, 2), "medium": (1, 3), "strong": (2, 4)}  # (opening radius, closing radius) in units; strong merges dense drawings (stairs, fixtures) into blocks
SEAL_RATIO = 0.025  # doorway sealing radius as a fraction of the label-scale width (~1.5 m on a 30 m plan)


def otsu_threshold(gray: np.ndarray) -> int:
    hist = np.bincount(gray.ravel(), minlength=256).astype(np.float64)
    total = hist.sum()
    if total == 0:
        return 128
    sum_total = np.dot(np.arange(256), hist)
    weight_b = 0.0
    sum_b = 0.0
    best, thr = 0.0, 128
    for t in range(256):
        weight_b += hist[t]
        if weight_b == 0:
            continue
        weight_f = total - weight_b
        if weight_f == 0:
            break
        sum_b += t * hist[t]
        mean_b = sum_b / weight_b
        mean_f = (sum_total - sum_b) / weight_f
        between = weight_b * weight_f * (mean_b - mean_f) ** 2
        if between > best:
            best, thr = between, t
    return int(thr)


# ---- morphology on boolean masks (separable square structuring elements; numpy only, fast enough at 1600 px)

def dilate(mask: np.ndarray, r: int) -> np.ndarray:
    if r <= 0:
        return mask
    out = mask.copy()
    for _ in range(r):
        out[:, 1:] |= out[:, :-1]
        out[:, :-1] |= out[:, 1:]
    for _ in range(r):
        out[1:, :] |= out[:-1, :]
        out[:-1, :] |= out[1:, :]
    return out


def erode(mask: np.ndarray, r: int) -> np.ndarray:
    if r <= 0:
        return mask
    return ~dilate(~mask, r)


def closing(mask: np.ndarray, r: int) -> np.ndarray:
    return erode(dilate(mask, r), r)


def opening(mask: np.ndarray, r: int) -> np.ndarray:
    return dilate(erode(mask, r), r)


def label_regions(free: np.ndarray, max_rounds: int = 400) -> np.ndarray:
    """Connected components (4-neighbourhood) of a boolean mask with numpy only: minimum-label propagation
    plus pointer jumping, so large regions converge in a few dozen rounds instead of their diameter."""
    h, w = free.shape
    idx = np.arange(1, h * w + 1, dtype=np.int32).reshape(h, w)
    lab = np.where(free, idx, 0).astype(np.int32)
    inf = np.iinfo(np.int32).max
    for _ in range(max_rounds):
        p = np.pad(lab, 1)
        up, down, left, right = p[:-2, 1:-1], p[2:, 1:-1], p[1:-1, :-2], p[1:-1, 2:]
        nb = np.minimum.reduce([np.where(up > 0, up, inf), np.where(down > 0, down, inf), np.where(left > 0, left, inf), np.where(right > 0, right, inf)])
        new = np.where(free & (nb < lab), nb, lab)
        flat = new.ravel()
        for _j in range(2):
            j = flat[np.maximum(flat - 1, 0)]
            flat = np.where(flat > 0, np.minimum(flat, np.where(j > 0, j, flat)), 0)
        new = flat.reshape(h, w)
        if np.array_equal(new, lab):
            break
        lab = new
    return lab


def _resize_mask(mask: np.ndarray, size: tuple[int, int], method=Image.BOX) -> np.ndarray:
    im = Image.fromarray(mask.astype(np.uint8) * 255, mode="L").resize(size, method)
    return np.asarray(im, dtype=np.uint8) > 127


def stylize(src: Path, out: Path, strength: str = "medium", keep_lines: bool = False) -> dict[str, Any]:
    t0 = time.time()
    if strength not in STRENGTH:
        raise ValueError("strength must be light | medium | strong")
    with Image.open(src) as im:
        im.load()
        width, height = im.size
        gray = im.convert("L")
    scale = min(1.0, ANALYSIS_PX / max(width, height))
    aw, ah = max(8, int(round(width * scale))), max(8, int(round(height * scale)))
    g = np.asarray(gray.resize((aw, ah), Image.LANCZOS), dtype=np.uint8)
    if g.mean() < 100:  # white-on-dark drawing
        g = 255 - g
    thr = int(min(200, max(90, otsu_threshold(g))))
    ink = g < thr
    unit = max(1, int(round(aw / 800)))
    open_r, close_r = STRENGTH[strength]
    closed = closing(ink, close_r * unit)       # merge double-line walls and hatching into solid bands
    walls = opening(closed, open_r * unit)      # drop text, dimension lines, furniture outlines
    thin = ink & ~dilate(walls, 1)

    # rooms: seal doorways by thickening the walls on a coarse grid, label enclosed regions, drop the
    # exterior (touches the border) and specks, then grow the rooms back under the real walls
    lscale = min(1.0, LABEL_PX / max(aw, ah))
    lw, lh = max(8, int(round(aw * lscale))), max(8, int(round(ah * lscale)))
    walls_coarse = _resize_mask(walls, (lw, lh))
    seal = max(2, int(round(SEAL_RATIO * lw)))
    sealed = dilate(walls_coarse, seal)
    labels = label_regions(~sealed)
    areas = np.bincount(labels.ravel())
    border = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]])).tolist())
    min_area = max(30, int(0.0015 * lw * lh))
    room_labels = [int(l) for l in np.unique(labels) if l > 0 and l not in border and areas[l] >= min_area]
    rooms_coarse = dilate(np.isin(labels, room_labels), seal) & ~walls_coarse
    room_mask = _resize_mask(rooms_coarse, (aw, ah), Image.NEAREST)
    room_mask = dilate(room_mask, 2) & ~walls

    canvas = np.empty((ah, aw, 3), dtype=np.uint8)
    canvas[...] = CANVAS
    canvas[room_mask] = ROOM
    if keep_lines:
        canvas[thin & ~walls] = FURNITURE
    canvas[walls] = WALL
    result = Image.fromarray(canvas, mode="RGB")
    if (aw, ah) != (width, height):
        result = result.resize((width, height), Image.BICUBIC)
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_name(out.name + ".tmp")
    result.save(tmp, format="PNG", optimize=True)
    tmp.replace(out)
    return {
        "rooms": len(room_labels),
        "strength": strength,
        "keep_lines": keep_lines,
        "width_px": width,
        "height_px": height,
        "threshold": thr,
        "wall_ratio": round(float(walls.mean()), 4),
        "ms": int((time.time() - t0) * 1000),
    }
