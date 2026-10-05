"""Own floor images (K88 / CR-006 2c without AI, owner decision 2026-10-04 Q3 = א): an administrator uploads per floor one
picture made anywhere (an architect's render, a floor-planner export, a photo of a model) and optionally a second one
with the lights on. Both share one alignment - where the image's four corners sit on the plan (plan-normalised
coordinates) - so the map draws the "off" image under the room state layer and the "on" image clipped to the lit rooms.

Storage: `<data>/plans/floor-images/<floor id>/<variant>-<sha16>.<png|jpg>`; the path column is relative to the data
dir so the backup's plan root (services/backup.RESTORABLE_ROOTS) covers it. Every path read, written or deleted here
passes `confine` (the same rule as the skins store): a floor id is a plain id, a stored path lies strictly under the
floor-images root."""
from __future__ import annotations

import hashlib
import io
import json
import sqlite3
from pathlib import Path
from typing import Any

from ..config import Settings
from ..db import ID_RE, new_id, now_iso

VARIANTS = ("off", "on")
MAX_BYTES = 12 * 1024 * 1024
MAX_PIXELS = 36_000_000  # 6000 x 6000
MIN_SIDE = 64
MIMES = {"image/png": ".png", "image/jpeg": ".jpg"}
DEFAULT_CORNERS = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]]
CORNER_RANGE = (-1.0, 2.0)  # an image may hang over the plan's edge, not fly away


class FloorImageError(ValueError):
    def __init__(self, code: str, message: str, details: dict[str, Any] | None = None):
        super().__init__(message)
        self.code, self.message, self.details = code, message, details or {}


class FloorImageStoreError(ValueError):
    """A path built from a floor id or a stored `path` would leave the floor-images root: refused, nothing touched."""


def root(settings: Settings) -> Path:
    return settings.plans_dir / "floor-images"


def check_floor_id(floor_id: str) -> str:
    if not isinstance(floor_id, str) or not ID_RE.fullmatch(floor_id):
        raise FloorImageStoreError("floor id is not a plain id")
    return floor_id


def confine(settings: Settings, candidate: Path) -> Path:
    base = root(settings).resolve()
    resolved = Path(candidate).resolve()
    if resolved == base or base not in resolved.parents:
        raise FloorImageStoreError("path outside the floor-images folder")
    return resolved


def confine_stored(settings: Settings, rel: str) -> Path:
    if not isinstance(rel, str) or not rel or Path(rel).is_absolute() or "\\" in rel or ".." in rel.split("/"):
        raise FloorImageStoreError("stored path is not a plain relative path")
    return confine(settings, settings.data_dir / rel)


def sniff(head: bytes) -> str | None:
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if head.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    return None


def validate(data: bytes) -> tuple[str, int, int]:
    """(mime, width, height) of an acceptable upload; FloorImageError otherwise. The whole image is decoded (a truncated or
    hostile file fails here, not in a browser), with the pixel ceiling checked before decoding."""
    if len(data) > MAX_BYTES:
        raise FloorImageError("payload_too_large", "התמונה גדולה מדי (עד 12 MB).", {"max_bytes": MAX_BYTES})
    mime = sniff(data[:16])
    if mime is None:
        raise FloorImageError("unsupported_format", "רק PNG או JPEG מתקבלים.")
    try:
        from PIL import Image

        Image.MAX_IMAGE_PIXELS = max(Image.MAX_IMAGE_PIXELS or 0, MAX_PIXELS * 2)
        with Image.open(io.BytesIO(data)) as im:
            w, h = im.size
            if w * h > MAX_PIXELS:
                raise FloorImageError("too_many_pixels", "התמונה גדולה מדי (עד 36 מגה־פיקסל).", {"width": w, "height": h})
            if w < MIN_SIDE or h < MIN_SIDE:
                raise FloorImageError("too_small", "התמונה קטנה מדי.", {"width": w, "height": h})
            im.load()
    except FloorImageError:
        raise
    except Exception as exc:  # noqa: BLE001 - any decode failure is one answer
        raise FloorImageError("corrupt_image", "קובץ התמונה פגום או אינו תמונה.", {"reason": type(exc).__name__}) from exc
    return mime, w, h


def row_api(r: sqlite3.Row | dict[str, Any] | None) -> dict[str, Any] | None:
    if r is None:
        return None
    return {"id": r["id"], "floor_id": r["floor_id"], "variant": r["variant"], "mime": r["mime"], "width": r["width"], "height": r["height"],
            "bytes": r["bytes"], "sha256": r["sha256"], "created_at": r["created_at"],
            "url": f"api/v1/floors/{r['floor_id']}/images/{r['variant']}?v={r['sha256'][:16]}"}


def layout_of(conn: sqlite3.Connection, floor_id: str) -> dict[str, Any]:
    r = conn.execute("SELECT corners_json, opacity, updated_at FROM floor_image_layout WHERE floor_id = ?", (floor_id,)).fetchone()
    if not r:
        return {"corners": [list(c) for c in DEFAULT_CORNERS], "opacity": 1.0, "updated_at": None, "aligned": False}
    try:
        corners = json.loads(r["corners_json"])
    except (TypeError, ValueError):
        corners = [list(c) for c in DEFAULT_CORNERS]
    return {"corners": corners, "opacity": r["opacity"], "updated_at": r["updated_at"], "aligned": True}


def describe(conn: sqlite3.Connection, floor_id: str) -> dict[str, Any]:
    rows = {v: None for v in VARIANTS}
    for r in conn.execute("SELECT * FROM floor_images WHERE floor_id = ?", (floor_id,)).fetchall():
        rows[r["variant"]] = row_api(r)
    return {"floor_id": floor_id, "images": rows, "layout": layout_of(conn, floor_id)}


def bundle_part(conn: sqlite3.Connection, floor_id: str) -> dict[str, Any] | None:
    """What the map bundle carries: None when the floor has no image at all."""
    d = describe(conn, floor_id)
    if not d["images"]["off"] and not d["images"]["on"]:
        return None
    return {"off": d["images"]["off"]["url"] if d["images"]["off"] else None, "on": d["images"]["on"]["url"] if d["images"]["on"] else None,
            "corners": d["layout"]["corners"], "opacity": d["layout"]["opacity"]}


def _unlink(settings: Settings, rel: str) -> None:
    try:
        p = confine_stored(settings, rel)
    except FloorImageStoreError:
        return
    try:
        p.unlink()
    except FileNotFoundError:
        pass


def store(settings: Settings, conn: sqlite3.Connection, floor_id: str, variant: str, data: bytes, actor_id: str | None) -> tuple[dict[str, Any], bool]:
    """Validate, write, replace the variant's row. Returns (row, replaced-an-existing-image)."""
    check_floor_id(floor_id)
    if variant not in VARIANTS:
        raise FloorImageError("bad_variant", "סוג התמונה אינו מוכר.", {"choices": list(VARIANTS)})
    mime, w, h = validate(data)
    sha = hashlib.sha256(data).hexdigest()
    folder = confine(settings, root(settings) / floor_id)
    folder.mkdir(parents=True, exist_ok=True)
    path = confine(settings, folder / f"{variant}-{sha[:16]}{MIMES[mime]}")
    rel = path.relative_to(settings.data_dir.resolve()).as_posix()
    old = conn.execute("SELECT * FROM floor_images WHERE floor_id = ? AND variant = ?", (floor_id, variant)).fetchone()
    path.write_bytes(data)
    now = now_iso()
    if old:
        conn.execute("UPDATE floor_images SET path = ?, mime = ?, width = ?, height = ?, bytes = ?, sha256 = ?, created_by = ?, created_at = ? WHERE id = ?",
                     (rel, mime, w, h, len(data), sha, actor_id, now, old["id"]))
        if old["path"] != rel:
            _unlink(settings, old["path"])
        rid = old["id"]
    else:
        rid = new_id()
        conn.execute("INSERT INTO floor_images(id, floor_id, variant, path, mime, width, height, bytes, sha256, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                     (rid, floor_id, variant, rel, mime, w, h, len(data), sha, actor_id, now))
    r = conn.execute("SELECT * FROM floor_images WHERE id = ?", (rid,)).fetchone()
    return row_api(r), old is not None  # type: ignore[return-value]


def remove(settings: Settings, conn: sqlite3.Connection, floor_id: str, variant: str) -> bool:
    r = conn.execute("SELECT * FROM floor_images WHERE floor_id = ? AND variant = ?", (floor_id, variant)).fetchone()
    if not r:
        return False
    conn.execute("DELETE FROM floor_images WHERE id = ?", (r["id"],))
    _unlink(settings, r["path"])
    if not conn.execute("SELECT 1 FROM floor_images WHERE floor_id = ?", (floor_id,)).fetchone():
        conn.execute("DELETE FROM floor_image_layout WHERE floor_id = ?", (floor_id,))
    return True


def check_corners(corners: Any) -> list[list[float]]:
    if not isinstance(corners, list) or len(corners) != 4:
        raise FloorImageError("validation", "נדרשות ארבע פינות.")
    out: list[list[float]] = []
    for c in corners:
        if not isinstance(c, (list, tuple)) or len(c) != 2:
            raise FloorImageError("validation", "כל פינה היא זוג מספרים.")
        x, y = float(c[0]), float(c[1])
        if not (CORNER_RANGE[0] <= x <= CORNER_RANGE[1] and CORNER_RANGE[0] <= y <= CORNER_RANGE[1]):
            raise FloorImageError("validation", "פינה מחוץ לטווח המותר.", {"corner": [x, y]})
        out.append([round(x, 5), round(y, 5)])
    # a degenerate quad (three corners on a line, or two equal corners) cannot be aligned
    def cross(o: list[float], a: list[float], b: list[float]) -> float:
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    area2 = abs(cross(out[0], out[1], out[2])) + abs(cross(out[0], out[2], out[3]))
    if area2 < 1e-4:
        raise FloorImageError("validation", "הפינות אינן מגדירות שטח.")
    return out


def save_layout(conn: sqlite3.Connection, floor_id: str, corners: Any, opacity: float | None, actor_id: str | None) -> dict[str, Any]:
    pts = check_corners(corners)
    op = 1.0 if opacity is None else float(opacity)
    if not (0.2 <= op <= 1.0):
        raise FloorImageError("validation", "השקיפות היא בין 0.2 ל־1.")
    conn.execute(
        "INSERT INTO floor_image_layout(floor_id, corners_json, opacity, updated_by, updated_at) VALUES (?,?,?,?,?) "
        "ON CONFLICT(floor_id) DO UPDATE SET corners_json = excluded.corners_json, opacity = excluded.opacity, updated_by = excluded.updated_by, updated_at = excluded.updated_at",
        (floor_id, json.dumps(pts), op, actor_id, now_iso()),
    )
    return layout_of(conn, floor_id)


def file_of(settings: Settings, conn: sqlite3.Connection, floor_id: str, variant: str) -> tuple[Path, str] | None:
    r = conn.execute("SELECT path, mime FROM floor_images WHERE floor_id = ? AND variant = ?", (floor_id, variant)).fetchone()
    if not r:
        return None
    return confine_stored(settings, r["path"]), r["mime"]


def delete_floor(settings: Settings, conn: sqlite3.Connection, floor_id: str) -> int:
    n = 0
    for r in conn.execute("SELECT path FROM floor_images WHERE floor_id = ?", (floor_id,)).fetchall():
        _unlink(settings, r["path"])
        n += 1
    conn.execute("DELETE FROM floor_images WHERE floor_id = ?", (floor_id,))
    conn.execute("DELETE FROM floor_image_layout WHERE floor_id = ?", (floor_id,))
    return n
