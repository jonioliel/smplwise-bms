"""The local side of floor skins (CR-006 phase 2, slice 2a): the floor's geometry key, the control images the browser
uploads, the render records and the budgets. Nothing in this module talks to a network.

- **Geometry key** - what a skin is valid for: the SHA-256 of the floor's published structure document hash and its
  rooms (id, level, outline). A skin rendered from one key is outdated once the key changes (2c shows "skin outdated").
- **Control images** - PNG only, one fixed size (the provider's landscape size, so an answer shares the pixel grid),
  no ancillary text/metadata chunks (a label must not ride along in a tEXt chunk), stored under
  `<data>/skins/<floor id>/control-<state>-<key>.png`, never served to a browser, deleted with the floor.
- **Render records** - `plan_skin_renders`, one row per request that was sent (the shape 2b/2c reuse); in 2a only the
  owner's connection test writes one (`test = 1`).
- **Budgets** - `skins.budget_monthly` successful renders per calendar month of the installation's zone (tests count:
  they are paid requests too) and `skins.budget_renders_per_floor` successful non-test renders per floor and geometry
  key (a changed structure is a new floor for the budget; the monthly cap bounds the total).
"""
from __future__ import annotations

import datetime as dt
import hashlib
import io
import json
import re
import shutil
import sqlite3
import struct
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from ...config import Settings
from ...db import ID_RE, new_id, now_iso

STATES = ("all_off", "all_on")
CONTROL_SIZE = (1536, 1024)  # = provider.OPENAI_SIZES[1]: the answer comes back on the same grid
CONTROL_MAX_BYTES = 8 * 1024 * 1024
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
# Critical chunks plus colour / physical-size ancillaries. Text (tEXt, zTXt, iTXt), EXIF and anything else is refused.
PNG_CHUNKS_ALLOWED = {b"IHDR", b"PLTE", b"IDAT", b"IEND", b"tRNS", b"sRGB", b"gAMA", b"cHRM", b"pHYs", b"iCCP", b"sBIT", b"bKGD"}
TEST_PROMPT_VERSION = "test-1"
TEST_PROMPT = ("Connection test from a building management system. The input is a synthetic 64x64 test pattern, not a "
               "building. Return a simple image of the same pattern.")
TEST_STATE = "test_pattern"
TEST_SIZE = "1024x1024"
TEST_QUALITY = "low"


class ControlImageError(ValueError):
    def __init__(self, code: str, message: str, details: dict[str, Any] | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details or {}


class SkinStoreError(ValueError):
    """A path built from a floor id or a stored `path` would leave `<data>/skins/` (re-review 2a): refused, nothing touched."""


# ---------- path confinement ----------

def skins_root(settings: Settings) -> Path:
    return settings.data_dir / "skins"


def check_floor_id(floor_id: str) -> str:
    """A floor id that may name a folder: the product's id charset (db.ID_RE) - no dots, no separators."""
    if not isinstance(floor_id, str) or not ID_RE.fullmatch(floor_id):
        raise SkinStoreError("floor id is not a plain id")
    return floor_id


def _confine(settings: Settings, candidate: Path) -> Path:
    """The candidate resolved (symlinks and junctions followed, '..' collapsed); SkinStoreError unless it lies strictly
    under the resolved skins root. Every path this module deletes, writes or reads passes through here."""
    root = skins_root(settings).resolve()
    resolved = Path(candidate).resolve()
    if resolved == root or root not in resolved.parents:
        raise SkinStoreError("path outside the skins folder")
    return resolved


def confine_stored(settings: Settings, rel: str) -> Path:
    """A `path` column (relative to the data dir) confined to the skins root."""
    if not isinstance(rel, str) or not rel or Path(rel).is_absolute() or "\\" in rel:
        raise SkinStoreError("stored path is not a plain relative path")
    return _confine(settings, settings.data_dir / rel)


# ---------- geometry key ----------

def published_geometry(conn: sqlite3.Connection, floor_id: str) -> sqlite3.Row | None:
    return conn.execute(
        "SELECT g.* FROM plan_geometry g JOIN plan_versions v ON v.id = g.plan_version_id WHERE v.floor_id = ? AND v.status = 'published' AND g.status = 'published'",
        (floor_id,),
    ).fetchone()


def geometry_key(conn: sqlite3.Connection, floor_id: str) -> tuple[str, str] | None:
    """(key, structure doc hash) of the floor's published structure and rooms; None without a published structure."""
    g = published_geometry(conn, floor_id)
    if g is None:
        return None
    rooms = [{"id": r["id"], "level_id": r["level_id"], "polygon": json.loads(r["polygon_json"])}
             for r in conn.execute("SELECT id, level_id, polygon_json FROM spatial_zones WHERE floor_id = ? AND deleted_at IS NULL ORDER BY id", (floor_id,)).fetchall()]
    blob = json.dumps({"v": 1, "doc": g["doc_hash"], "rooms": rooms}, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(blob.encode("utf-8")).hexdigest(), g["doc_hash"]


# ---------- control images ----------

def validate_png(data: bytes, expected: tuple[int, int] = CONTROL_SIZE) -> tuple[int, int]:
    """A PNG by its bytes (signature, chunk walk with CRCs, decodable), of the fixed size, without text or metadata."""
    import zlib

    if len(data) > CONTROL_MAX_BYTES:
        raise ControlImageError("payload_too_large", f"תמונת הבקרה גדולה מ־{CONTROL_MAX_BYTES // (1024 * 1024)} MB.")
    if not data.startswith(PNG_SIGNATURE):
        raise ControlImageError("unsupported_format", "תמונת הבקרה חייבת להיות PNG (הזיהוי לפי התוכן).")
    pos, seen = len(PNG_SIGNATURE), []
    while pos + 12 <= len(data):
        (length,) = struct.unpack(">I", data[pos:pos + 4])
        ctype = data[pos + 4:pos + 8]
        body_end = pos + 8 + length
        if body_end + 4 > len(data):
            raise ControlImageError("corrupt_png", "קובץ ה־PNG קטוע.")
        (crc,) = struct.unpack(">I", data[body_end:body_end + 4])
        if zlib.crc32(ctype + data[pos + 8:body_end]) & 0xFFFFFFFF != crc:
            raise ControlImageError("corrupt_png", "קובץ ה־PNG פגום (CRC).")
        if ctype not in PNG_CHUNKS_ALLOWED:
            raise ControlImageError("png_metadata", "תמונת הבקרה מכילה מטא־נתונים או טקסט שאינם מותרים.", {"chunk": ctype.decode("latin-1")})
        seen.append(ctype)
        pos = body_end + 4
        if ctype == b"IEND":
            break
    if not seen or seen[0] != b"IHDR" or seen[-1] != b"IEND" or pos != len(data):
        raise ControlImageError("corrupt_png", "מבנה ה־PNG אינו תקין.")
    from PIL import Image

    try:
        with Image.open(io.BytesIO(data)) as im:
            im.load()
            size = im.size
    except Exception as exc:  # noqa: BLE001 - the decoder refuses the file: the upload is the problem
        raise ControlImageError("corrupt_png", "לא ניתן לפענח את ה־PNG.", {"error": type(exc).__name__}) from None
    if size != expected:
        raise ControlImageError("control_size", f"תמונת הבקרה חייבת להיות {expected[0]}x{expected[1]} פיקסלים.", {"size": list(size)})
    return size


def skins_dir(settings: Settings, floor_id: str) -> Path:
    """`<data>/skins/<floor id>`, the id checked and the result confined (SkinStoreError otherwise)."""
    return _confine(settings, skins_root(settings) / check_floor_id(floor_id))


def _unlink_stored(settings: Settings, rel: str) -> bool:
    """Delete a stored control file when its `path` confines to the skins root; a poisoned path is never followed."""
    try:
        confine_stored(settings, rel).unlink(missing_ok=True)
        return True
    except SkinStoreError:
        return False


def control_row(r: sqlite3.Row) -> dict[str, Any]:
    return {"id": r["id"], "floor_id": r["floor_id"], "state": r["state_key"], "geometry_key": r["geometry_key"], "sha256": r["sha256"],
            "bytes": r["bytes"], "width": r["width"], "height": r["height"], "created_at": r["created_at"]}


def store_control(settings: Settings, conn: sqlite3.Connection, floor_id: str, state: str, key: str, data: bytes, actor_id: str | None) -> tuple[dict[str, Any], bool]:
    """Write the control image for (floor, state, key); an older key's image of the same state is removed. Returns the
    row and whether the bytes equal the ones already stored for the same key (the determinism check of the capture)."""
    if state not in STATES:
        raise ControlImageError("bad_state", "מצב לא מוכר.", {"choices": list(STATES)})
    if not re.fullmatch(r"[0-9a-f]{64}", key or ""):
        raise ControlImageError("validation", "מפתח הגאומטריה אינו תקין.")
    folder = skins_dir(settings, floor_id)  # SkinStoreError for an id that is not a plain id
    w, h = validate_png(data)
    sha = hashlib.sha256(data).hexdigest()
    folder.mkdir(parents=True, exist_ok=True)
    prev = conn.execute("SELECT * FROM plan_skin_controls WHERE floor_id = ? AND state_key = ?", (floor_id, state)).fetchall()
    identical = any(p["geometry_key"] == key and p["sha256"] == sha for p in prev)
    for p in prev:
        _unlink_stored(settings, p["path"])
    conn.execute("DELETE FROM plan_skin_controls WHERE floor_id = ? AND state_key = ?", (floor_id, state))
    dest = _confine(settings, folder / f"control-{state}-{key[:16]}.png")
    dest.write_bytes(data)
    cid = new_id()
    conn.execute(
        "INSERT INTO plan_skin_controls(id, floor_id, state_key, geometry_key, sha256, bytes, width, height, path, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (cid, floor_id, state, key, sha, len(data), w, h, (skins_root(settings) / floor_id / dest.name).relative_to(settings.data_dir).as_posix(), actor_id, now_iso()),
    )
    return control_row(conn.execute("SELECT * FROM plan_skin_controls WHERE id = ?", (cid,)).fetchone()), identical


def controls_of(conn: sqlite3.Connection, floor_id: str) -> list[dict[str, Any]]:
    return [control_row(r) for r in conn.execute("SELECT * FROM plan_skin_controls WHERE floor_id = ? ORDER BY state_key", (floor_id,)).fetchall()]


def delete_floor(settings: Settings, conn: sqlite3.Connection, floor_id: str) -> int:
    """The floor is deleted: its control images go (files and rows). Render records stay - they count spend."""
    rows = conn.execute("SELECT path FROM plan_skin_controls WHERE floor_id = ?", (floor_id,)).fetchall()
    for r in rows:
        _unlink_stored(settings, r["path"])
    n = conn.execute("DELETE FROM plan_skin_controls WHERE floor_id = ?", (floor_id,)).rowcount
    try:
        shutil.rmtree(skins_dir(settings, floor_id), ignore_errors=True)
    except SkinStoreError:
        pass  # an id that could not have a folder of ours: nothing on disk is touched
    return n


def sweep_orphans(settings: Settings, conn: sqlite3.Connection) -> int:
    """Control images of floors that no longer exist (a backup restored in "replace" mode, a floor removed outside the
    API), and every row whose `path` does not confine to the skins root (its file is never followed): rows go, files
    go only through _confine, and any `skins/<name>` folder without a live floor goes when it resolves inside the root
    (a link pointing elsewhere is left alone). Returns the rows removed."""
    live = {r[0] for r in conn.execute("SELECT id FROM floors WHERE deleted_at IS NULL").fetchall()}
    n = 0
    for r in conn.execute("SELECT id, floor_id, path FROM plan_skin_controls").fetchall():
        try:
            target = confine_stored(settings, r["path"])
        except SkinStoreError:
            target = None
        if target is None or r["floor_id"] not in live:
            if target is not None:
                target.unlink(missing_ok=True)
            conn.execute("DELETE FROM plan_skin_controls WHERE id = ?", (r["id"],))
            n += 1
    root = skins_root(settings)
    if root.is_dir() and not root.is_symlink():
        for d in root.iterdir():
            if d.name in live or not d.is_dir():
                continue
            try:
                inside = _confine(settings, d)
            except SkinStoreError:
                continue
            if d.is_symlink():
                continue
            shutil.rmtree(inside, ignore_errors=True)
    return n

# ---------- budgets ----------

@dataclass(frozen=True)
class Budget:
    monthly_cap: int
    used_month: int
    per_floor_cap: int
    used_floor: int | None  # None when no floor is asked about

    @property
    def remaining_month(self) -> int:
        return max(0, self.monthly_cap - self.used_month)

    @property
    def remaining_floor(self) -> int | None:
        return None if self.used_floor is None else max(0, self.per_floor_cap - self.used_floor)

    def allows(self, n: int = 1, floor: bool = False) -> bool:
        """n more renders fit: the monthly cap always, the per-floor cap when the request is for a floor."""
        if n < 1:
            return True
        if self.remaining_month < n:
            return False
        return not floor or (self.remaining_floor is not None and self.remaining_floor >= n)

    def describe(self) -> dict[str, Any]:
        return {"monthly_cap": self.monthly_cap, "used_month": self.used_month, "remaining_month": self.remaining_month,
                "per_floor_cap": self.per_floor_cap, "used_floor": self.used_floor, "remaining_floor": self.remaining_floor}


def month_start_utc(now: dt.datetime, zone: str) -> str:
    """The first instant of the calendar month that contains `now` in the installation's zone, as a UTC ISO string
    comparable with created_at."""
    try:
        tz = ZoneInfo(zone)
    except Exception:  # noqa: BLE001 - a bad zone setting falls back to UTC
        tz = dt.timezone.utc
    local = now.astimezone(tz)
    start = local.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return start.astimezone(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def budget(conn: sqlite3.Connection, floor_id: str | None = None, key: str | None = None, now: dt.datetime | None = None) -> Budget:
    from ...routers.settings import read_settings

    s = read_settings(conn)
    since = month_start_utc(now or dt.datetime.now(dt.timezone.utc), s["time.zone"])
    used_month = conn.execute("SELECT COUNT(*) FROM plan_skin_renders WHERE status = 'ok' AND created_at >= ?", (since,)).fetchone()[0]
    used_floor = None
    if floor_id is not None:
        used_floor = conn.execute("SELECT COUNT(*) FROM plan_skin_renders WHERE status = 'ok' AND test = 0 AND floor_id = ? AND geometry_key IS ?", (floor_id, key)).fetchone()[0]
    return Budget(int(s["skins.budget_monthly"]), used_month, int(s["skins.budget_renders_per_floor"]), used_floor)


# ---------- render records ----------

def record_render(conn: sqlite3.Connection, *, floor_id: str | None, level_id: str | None, state_key: str, provider: str, model: str, prompt_version: str,
                  control_hash: str, geometry_key: str | None, sent_plan_raster: bool, cost_estimate_usd: float | None, status: str, http_status: int | None,
                  error_code: str | None, usage: dict[str, Any] | None, image_path: str | None, test: bool, actor_id: str | None) -> str:
    rid = new_id()
    conn.execute(
        "INSERT INTO plan_skin_renders(id, floor_id, level_id, state_key, provider, model, prompt_version, control_hash, geometry_key, sent_plan_raster, "
        "cost_estimate_usd, status, http_status, error_code, usage_json, image_path, test, accepted, created_by, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)",
        (rid, floor_id, level_id, state_key, provider, model, prompt_version, control_hash, geometry_key, int(sent_plan_raster), cost_estimate_usd, status,
         http_status, error_code, json.dumps(usage or {}, sort_keys=True), image_path, int(test), actor_id, now_iso()),
    )
    return rid


def test_pattern_png() -> bytes:
    """The fixed synthetic image of the connection test: 64x64, colour bars over a checkerboard - no plan, no people,
    no text. Deterministic bytes (asserted by the tests)."""
    from PIL import Image

    im = Image.new("RGB", (64, 64))
    bars = [(230, 60, 60), (60, 180, 80), (60, 90, 220), (240, 200, 40)]
    for y in range(64):
        for x in range(64):
            if y < 16:
                im.putpixel((x, y), bars[x // 16])
            else:
                on = ((x // 8) + (y // 8)) % 2 == 0
                im.putpixel((x, y), (40, 40, 48) if on else (235, 235, 240))
    buf = io.BytesIO()
    im.save(buf, format="PNG", optimize=False, compress_level=6)
    return buf.getvalue()
