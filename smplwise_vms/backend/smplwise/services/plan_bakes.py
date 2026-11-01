"""Plan Studio 6 bakes (CR-029 S3; docs/changes/CR-029-ST7-S3-NOTES.md): the pre-rendered stills, their room masks and the
floor lightmap of a floor. The add-on has no 3D renderer (Alpine, no GPU - notes section 1): an editor's browser renders the
files with the product's own 3D view and uploads them here; this module stores, validates, versions, lists, evicts and queues
requests. Nothing here talks to a network or a device.

- **Slots** - one stored file per (floor, level, kind, preset, style, band, variant); `still` = a picture of one level from a
  fixed preset in one style, time band and lamp variant; `mask` = the projected room / door / camera outlines of a (level,
  preset) (shared by every still of that camera); `lightmap` = the floor atlas of one level (R = ambient occlusion, G = lamp
  light). A new upload replaces the slot's file.
- **Bake key** - what a bake is valid for: sha256 of the skins geometry key (published structure doc_hash + rooms) and the
  catalog revision. A row of another key is stale: listed for the editor, never current, evicted first.
- **Storage** - `<data>/plans/bakes/<floor id>/<kind>-<slot hash>-<sha16>.<ext>`, relative paths under the backup's plan root;
  every path read, written or deleted passes `confine` (the skins / floor-images rule).
- **Bounded work** - decoding an upload runs behind DECODE_SLOTS (2 at a time, a third waits DECODE_WAIT_S then is refused as
  busy); the routes call `validate_file` from the thread pool, never on the event loop.
- **Caps** - per file by kind, per floor and per installation by the `plan.bakes` setting; over a cap stale rows go, oldest
  first - the uploading floor's own first, other floors' only as the last resort for the installation cap (security review
  2.4.7 I2, `_evict`); current rows are never evicted silently (BakeError storage_full).
- **Readers** (security review 2.4.7 M1 / L1) - a reader from whom a camera can be withheld gets each mask without the camera
  entries their camera scope denies (`mask_view`, derived on every read, so masks stored before the fix are covered too),
  and the bake / geometry keys and doc_hash built over the structure as redacted for them (`served_bake_key`); the stored
  key stays the server's own (rows, jobs, stale checks). STILLCAM: a still / lightmap of a recipe older than the one that bakes
  without camera-bound bodies is withheld from a reader denied a camera a body is bound to (`pixels_withheld`).
- **Jobs** - a regenerate request is a job row an editor session claims (10-minute lease) and finishes; one open job per floor.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import math
import re
import shutil
import sqlite3
import struct
import threading
import zlib
from collections import OrderedDict
from pathlib import Path
from typing import Any, NamedTuple

from ..config import Settings
from ..db import ID_RE, new_id, now_iso

KINDS = ("still", "mask", "lightmap")
PRESETS = ("iso", "top", "persp")
STYLES = ("light", "dark")
BANDS = ("day", "sunset", "night")
VARIANTS = ("off", "on")
MAX_BYTES = {"still": 2 * 1024 * 1024, "mask": 256 * 1024, "lightmap": 4 * 1024 * 1024}
MAX_UPLOAD = max(MAX_BYTES.values())
STILL_W = (640, 2560)
STILL_H = (360, 2560)
LIGHTMAP_SIDES = (64, 128, 256, 512, 1024, 2048)
META_MAX = 4096
RECIPE_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{0,39}$")
KEY_RE = re.compile(r"^[0-9a-f]{64}$")
MIMES = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "application/json": ".json"}
KIND_MIMES = {"still": ("image/webp", "image/jpeg", "image/png"), "mask": ("application/json",), "lightmap": ("image/png",)}
LEASE_S = 600
DECODE_SLOTS = threading.BoundedSemaphore(2)
DECODE_WAIT_S = 5.0
# mask documents: generous but bounded (a 500-room venue still fits)
MASK_MAX_ROOMS = 500
MASK_MAX_POINTS = 400
MASK_MAX_DOORS = 1000
MASK_MAX_CAMERAS = 500

# ---------- the `plan.bakes` installation setting (system.configure via PATCH /settings, audited as settings.update) ----------

SETTING_KEY = "plan.bakes"
SIZES = ("1280x800", "1600x1000", "1920x1200")
SETTING_CHOICES: dict[str, tuple[Any, ...]] = {
    "size": SIZES,                                   # the still's pixel size (the masks share it)
    "floor_cap_mb": (16, 32, 64, 128, 256),          # storage per floor (stills + masks + lightmaps)
    "total_cap_mb": (128, 256, 512, 1024, 2048),     # storage of every floor together
    # owner 2026-10-11 Q1: the bake starts when an editor presses the button (manual, default) or by itself when an editor opens
    # a floor whose stills are missing or outdated (auto - that editor's browser does the work)
    "bake_trigger": ("manual", "auto"),
    # owner 2026-10-11 Q2: the views baked per level - the iso view only (default) or the iso and the top view
    "bake_views": ("iso", "iso_top"),
}
VIEW_PRESETS: dict[str, list[str]] = {"iso": ["iso"], "iso_top": ["iso", "top"]}
SETTING_LISTS: dict[str, tuple[str, ...]] = {"styles": STYLES, "bands": BANDS}
SETTING_FLAGS = ("lightmap",)
SETTING_DEFAULT: dict[str, Any] = {
    "styles": ["light", "dark"], "bands": ["day", "sunset", "night"], "lightmap": True,
    "size": "1600x1000", "floor_cap_mb": 64, "total_cap_mb": 512, "bake_trigger": "manual", "bake_views": "iso",
}


class BakeError(ValueError):
    def __init__(self, code: str, message: str, details: dict[str, Any] | None = None):
        super().__init__(message)
        self.code, self.message, self.details = code, message, details or {}


class BakeStoreError(ValueError):
    """A path built from a floor id or a stored `path` would leave the bakes root: refused, nothing touched."""


def _setting_value(key: str, value: Any) -> Any:
    if key in SETTING_FLAGS:
        if not isinstance(value, bool):
            raise ValueError(f"{key} must be true or false")
        return value
    if key in SETTING_LISTS:
        allowed = SETTING_LISTS[key]
        if not isinstance(value, list) or not value or any(not isinstance(v, str) or v not in allowed for v in value):
            raise ValueError(f"{key} must be a non-empty list of {', '.join(allowed)}")
        return [v for v in allowed if v in value]  # canonical order, no duplicates
    allowed = SETTING_CHOICES.get(key)
    if allowed is None:
        raise ValueError(f"unknown bake setting {key}")
    if isinstance(value, bool):
        raise ValueError(f"{key} must be one of {', '.join(map(str, allowed))}")
    for a in allowed:
        if value == a or (isinstance(a, int) and isinstance(value, str) and value.strip() == str(a)):
            return a
    raise ValueError(f"{key} must be one of {', '.join(map(str, allowed))}")


def normalize_setting(value: Any, base: dict[str, Any] | None = None) -> dict[str, Any]:
    """A partial update over `base` (the stored value; the defaults when absent). Unknown keys are refused."""
    if not isinstance(value, dict):
        raise ValueError("plan.bakes must be an object")
    out = {k: (base or SETTING_DEFAULT).get(k, SETTING_DEFAULT[k]) for k in SETTING_DEFAULT}
    for k, v in value.items():
        if k not in SETTING_DEFAULT:
            raise ValueError(f"plan.bakes: {k} is not a bake setting")
        out[k] = _setting_value(k, v)
    return _with_presets(out)


def _with_presets(out: dict[str, Any]) -> dict[str, Any]:
    """`presets` is read-only: derived from `bake_views` (what expected_slots and the client iterate)."""
    out["presets"] = list(VIEW_PRESETS[out["bake_views"]])
    return out


def stored_setting(raw: Any) -> dict[str, Any]:
    """The stored value as a full object; a corrupt value or key reads as its default."""
    try:
        value = json.loads(raw) if isinstance(raw, str) and raw else {}
    except ValueError:
        value = {}
    out = {k: (list(v) if isinstance(v, list) else v) for k, v in SETTING_DEFAULT.items()}
    if isinstance(value, dict):
        for k in SETTING_DEFAULT:
            if k in value:
                try:
                    out[k] = _setting_value(k, value[k])
                except ValueError:
                    pass
    return _with_presets(out)


def read_setting(conn: sqlite3.Connection) -> dict[str, Any]:
    from ..db import get_setting

    return stored_setting(get_setting(conn, SETTING_KEY, None))


def still_size(setting: dict[str, Any]) -> tuple[int, int]:
    w, h = str(setting["size"]).split("x")
    return int(w), int(h)


# ---------- paths ----------

def root(settings: Settings) -> Path:
    return settings.plans_dir / "bakes"


def check_floor_id(floor_id: str) -> str:
    if not isinstance(floor_id, str) or not ID_RE.fullmatch(floor_id):
        raise BakeStoreError("floor id is not a plain id")
    return floor_id


def confine(settings: Settings, candidate: Path) -> Path:
    base = root(settings).resolve()
    resolved = Path(candidate).resolve()
    if resolved == base or base not in resolved.parents:
        raise BakeStoreError("path outside the bakes folder")
    return resolved


def confine_stored(settings: Settings, rel: str) -> Path:
    if not isinstance(rel, str) or not rel or Path(rel).is_absolute() or "\\" in rel or ".." in rel.split("/"):
        raise BakeStoreError("stored path is not a plain relative path")
    return confine(settings, settings.data_dir / rel)


def floor_dir(settings: Settings, floor_id: str) -> Path:
    return confine(settings, root(settings) / check_floor_id(floor_id))


def _unlink(settings: Settings, rel: str) -> bool:
    try:
        confine_stored(settings, rel).unlink(missing_ok=True)
        return True
    except BakeStoreError:
        return False


# ---------- the bake key and the floor's levels ----------

def _key_of(geometry_key: str, catalog_revision: Any) -> str:
    blob = json.dumps({"v": 1, "geometry": geometry_key, "catalog": catalog_revision}, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def bake_key(conn: sqlite3.Connection, floor_id: str) -> tuple[str, str] | None:
    """(bake key, skins geometry key) of the floor's published structure, rooms and catalog; None without a published structure.
    The STORED key: what rows and jobs are stored under and the server's own stale checks compare. What a reader is handed
    is `served_bake_key` (security review 2.4.7 L1)."""
    from . import plan_catalog
    from .skins import store as skins_store

    gk = skins_store.geometry_key(conn, floor_id)
    if gk is None:
        return None
    return _key_of(gk[0], plan_catalog.revision(conn)), gk[0]


class ServedKey(NamedTuple):
    bake_key: str       # the bake key this reader is handed (and must send back with an upload)
    geometry_key: str   # the skins geometry key this reader is handed
    doc_hash: str       # the structure's doc_hash this reader is handed (the one the geometry read and the bundle give them)
    real: str           # the stored bake key (never handed to a reader from whom something is withheld)


def served_bake_key(conn: sqlite3.Connection, floor_id: str, visible: Any) -> ServedKey | None:
    """Security review 2.4.7 L1 (the 2.4.2 L1 rule, as skins_store.served_geometry_key): the keys of the floor's bakes as this
    reader (`visible` = plan_anchor_scope.visibility) is handed them. For a reader from whom a reference of the published
    structure is withheld, the geometry key and doc_hash are built over the document as redacted for them and the bake key over
    that geometry key, so none of them confirms a guessed camera id against the stored hash; for everyone else they are the
    stored ones. None without a published structure."""
    from . import plan_catalog
    from .skins import store as skins_store

    gk = skins_store.served_geometry_key(conn, floor_id, visible)
    if gk is None:
        return None
    served_gk, served_doc, real_gk = gk
    rev = plan_catalog.revision(conn)
    real = _key_of(real_gk, rev)
    return ServedKey(real if served_gk == real_gk else _key_of(served_gk, rev), served_gk, served_doc, real)


def shown_key(stored: str | None, sk: ServedKey | None, visible: Any) -> str | None:
    """A stored row's or job's bake key as this reader is handed it: as stored when nothing can be withheld from them, the
    served key for the current one, else (a stale key of an older structure, which the served keys do not cover) None."""
    if visible is None:
        return stored
    if sk is not None and stored == sk.real:
        return sk.bake_key
    return None


def floor_levels(conn: sqlite3.Connection, floor_id: str) -> list[str]:
    """The level ids of the floor's published structure, in document order (the default level alone when it lists none)."""
    from .plan_geometry import DEFAULT_LEVEL_ID
    from .skins import store as skins_store

    g = skins_store.published_geometry(conn, floor_id)
    if g is None:
        return []
    try:
        doc = json.loads(g["doc_json"])
    except (TypeError, ValueError):
        return [DEFAULT_LEVEL_ID]
    ids = [lv.get("id") for lv in (doc.get("levels") or []) if isinstance(lv, dict) and isinstance(lv.get("id"), str)]
    return ids or [DEFAULT_LEVEL_ID]


# ---------- slots ----------

def check_slot(kind: str, level_id: str, preset: str, style: str, band: str, variant: str) -> dict[str, str]:
    """The slot's fields, validated for the kind (fields a kind does not use must be empty)."""
    if kind not in KINDS:
        raise BakeError("bad_slot", "סוג הקובץ אינו מוכר.", {"choices": list(KINDS)})
    if not isinstance(level_id, str) or not level_id or len(level_id) > 64 or any(c in level_id for c in "/\\\x00"):
        raise BakeError("bad_slot", "המפלס אינו תקין.")
    want = {"still": {"preset": PRESETS, "style": STYLES, "band": BANDS, "variant": VARIANTS},
            "mask": {"preset": PRESETS}, "lightmap": {}}[kind]
    got = {"preset": preset or "", "style": style or "", "band": band or "", "variant": variant or ""}
    for field, value in got.items():
        allowed = want.get(field)
        if allowed is None and value:
            raise BakeError("bad_slot", f"השדה {field} אינו שייך לסוג {kind}.", {"field": field})
        if allowed is not None and value not in allowed:
            raise BakeError("bad_slot", f"ערך לא מוכר בשדה {field}.", {"field": field, "choices": list(allowed)})
    return {"kind": kind, "level_id": level_id, **got}


def slot_id(slot: dict[str, str]) -> str:
    """A readable slot name, the same string the client builds (map/still-bake.ts slotName)."""
    parts = [slot["kind"], slot["level_id"]] + [slot[k] for k in ("preset", "style", "band", "variant") if slot.get(k)]
    return "/".join(parts)


def expected_slots(levels: list[str], setting: dict[str, Any]) -> list[dict[str, str]]:
    """Every slot the setting asks for on these levels: stills (preset x style x band x off / on), one mask per preset, and
    one lightmap per level when the lightmap is on. A stable order (the client bakes in this order)."""
    out: list[dict[str, str]] = []
    for lv in levels:
        for preset in setting["presets"]:
            out.append({"kind": "mask", "level_id": lv, "preset": preset, "style": "", "band": "", "variant": ""})
            for style in setting["styles"]:
                for band in setting["bands"]:
                    for variant in VARIANTS:
                        out.append({"kind": "still", "level_id": lv, "preset": preset, "style": style, "band": band, "variant": variant})
        if setting["lightmap"]:
            out.append({"kind": "lightmap", "level_id": lv, "preset": "", "style": "", "band": "", "variant": ""})
    return out


# ---------- content validation (sniffing, metadata allow-lists, a full decode) ----------

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
PNG_CHUNKS_ALLOWED = {b"IHDR", b"PLTE", b"IDAT", b"IEND", b"tRNS", b"sRGB", b"gAMA", b"cHRM", b"pHYs", b"iCCP", b"sBIT", b"bKGD"}
# JPEG markers a canvas encoder writes: SOI, APP0 (JFIF), APP2 (ICC), DQT, SOF0-SOF2, DHT, DRI, SOS, EOI. APP1 (EXIF / XMP),
# COM and the other APPn are refused (a label or a location must not ride along).
JPEG_ALLOWED = {0xD8, 0xE0, 0xE2, 0xDB, 0xC0, 0xC1, 0xC2, 0xC4, 0xDD, 0xDA, 0xD9}
WEBP_CHUNKS_ALLOWED = {b"VP8 ", b"VP8L", b"VP8X", b"ALPH", b"ICCP"}


def sniff(head: bytes) -> str | None:
    if head.startswith(PNG_SIGNATURE):
        return "image/png"
    if head.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image/webp"
    stripped = head.lstrip()
    if stripped.startswith(b"{"):
        return "application/json"
    return None


def _png_chunks(data: bytes) -> None:
    pos, seen = len(PNG_SIGNATURE), []
    while pos + 12 <= len(data):
        (length,) = struct.unpack(">I", data[pos:pos + 4])
        ctype = data[pos + 4:pos + 8]
        end = pos + 8 + length
        if end + 4 > len(data):
            raise BakeError("corrupt_image", "קובץ ה־PNG קטוע.")
        (crc,) = struct.unpack(">I", data[end:end + 4])
        if zlib.crc32(ctype + data[pos + 8:end]) & 0xFFFFFFFF != crc:
            raise BakeError("corrupt_image", "קובץ ה־PNG פגום (CRC).")
        if ctype not in PNG_CHUNKS_ALLOWED:
            raise BakeError("image_metadata", "הקובץ מכיל מטא־נתונים או טקסט שאינם מותרים.", {"chunk": ctype.decode("latin-1")})
        seen.append(ctype)
        pos = end + 4
        if ctype == b"IEND":
            break
    if not seen or seen[0] != b"IHDR" or seen[-1] != b"IEND" or pos != len(data):
        raise BakeError("corrupt_image", "מבנה ה־PNG אינו תקין.")


def _jpeg_segments(data: bytes) -> None:
    pos = 2
    while pos + 4 <= len(data):
        if data[pos] != 0xFF:
            raise BakeError("corrupt_image", "מבנה ה־JPEG אינו תקין.")
        marker = data[pos + 1]
        if marker == 0xFF:  # fill byte
            pos += 1
            continue
        if marker not in JPEG_ALLOWED and not 0xD0 <= marker <= 0xD7:
            raise BakeError("image_metadata", "הקובץ מכיל מטא־נתונים או טקסט שאינם מותרים.", {"marker": f"FF{marker:02X}"})
        if marker == 0xD9:
            return
        (length,) = struct.unpack(">H", data[pos + 2:pos + 4])
        if marker == 0xDA:
            return  # entropy-coded data follows; the decoder checks the rest
        pos += 2 + length
    raise BakeError("corrupt_image", "קובץ ה־JPEG קטוע.")


def _webp_chunks(data: bytes) -> None:
    (riff_len,) = struct.unpack("<I", data[4:8])
    if riff_len + 8 != len(data):
        raise BakeError("corrupt_image", "קובץ ה־WebP קטוע.")
    pos = 12
    while pos + 8 <= len(data):
        ctype = data[pos:pos + 4]
        (length,) = struct.unpack("<I", data[pos + 4:pos + 8])
        if ctype not in WEBP_CHUNKS_ALLOWED:
            raise BakeError("image_metadata", "הקובץ מכיל מטא־נתונים או טקסט שאינם מותרים.", {"chunk": ctype.decode("latin-1")})
        if ctype == b"VP8X" and length >= 1 and data[pos + 8] & 0x0E:  # EXIF (0x08), XMP (0x04) or animation (0x02) flags
            raise BakeError("image_metadata", "הקובץ מכיל מטא־נתונים או אנימציה שאינם מותרים.")
        pos += 8 + length + (length & 1)
    if pos != len(data):
        raise BakeError("corrupt_image", "מבנה ה־WebP אינו תקין.")


def _decode(data: bytes, mime: str) -> tuple[int, int, str]:
    from . import image_guard

    try:
        with image_guard.open_untrusted(data, [{"image/png": "PNG", "image/jpeg": "JPEG", "image/webp": "WEBP"}[mime]]) as im:
            w, h = im.size
            if w * h > STILL_W[1] * STILL_H[1]:
                raise BakeError("too_many_pixels", "התמונה גדולה מדי.", {"width": w, "height": h})
            fmt = (im.format or "").upper()
            im.load()
            mode = im.mode
    except BakeError:
        raise
    except Exception as exc:  # noqa: BLE001 - any decode failure is one answer
        raise BakeError("corrupt_image", "קובץ התמונה פגום או אינו תמונה.", {"reason": type(exc).__name__}) from None
    if {"image/png": "PNG", "image/jpeg": "JPEG", "image/webp": "WEBP"}[mime] != fmt:
        raise BakeError("corrupt_image", "סוג הקובץ אינו תואם את תוכנו.")
    return w, h, mode


def _finite(v: Any, lo: float, hi: float) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) and lo <= v <= hi


def _points(value: Any, w: int, h: int, cap: int) -> bool:
    return (isinstance(value, list) and len(value) <= cap
            and all(isinstance(p, list) and len(p) == 2 and _finite(p[0], -w, 2 * w) and _finite(p[1], -h, 2 * h) for p in value))


def validate_mask(data: bytes, preset: str) -> tuple[int, int, dict[str, Any]]:
    """A mask document (map/still-bake.ts buildMask): {version 1, preset, width, height, rooms[{id, floor, top, centre}],
    doors[{id, points}], cameras[{id, p}]} - every point finite and near the picture, bounded counts, no other keys."""
    try:
        doc = json.loads(data.decode("utf-8"))
    except (UnicodeDecodeError, ValueError):
        raise BakeError("corrupt_mask", "קובץ המסכות אינו JSON תקין.") from None
    if not isinstance(doc, dict) or set(doc) - {"version", "preset", "width", "height", "rooms", "doors", "cameras"}:
        raise BakeError("corrupt_mask", "מבנה קובץ המסכות אינו מוכר.")
    if doc.get("version") != 1 or doc.get("preset") != preset:
        raise BakeError("corrupt_mask", "גרסת קובץ המסכות או המבט אינם תואמים.")
    w, h = doc.get("width"), doc.get("height")
    if not (isinstance(w, int) and isinstance(h, int) and STILL_W[0] <= w <= STILL_W[1] and STILL_H[0] <= h <= STILL_H[1]):
        raise BakeError("corrupt_mask", "גודל המסכות אינו תקין.")
    rooms, doors, cams = doc.get("rooms"), doc.get("doors"), doc.get("cameras")
    if not (isinstance(rooms, list) and len(rooms) <= MASK_MAX_ROOMS and isinstance(doors, list) and len(doors) <= MASK_MAX_DOORS
            and isinstance(cams, list) and len(cams) <= MASK_MAX_CAMERAS):
        raise BakeError("corrupt_mask", "רשימות המסכות אינן תקינות.")
    plain = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}")  # fullmatch: a `$` would let a trailing newline through (SEC247)
    for r in rooms:
        if not (isinstance(r, dict) and set(r) <= {"id", "floor", "top", "centre"} and isinstance(r.get("id"), str) and plain.fullmatch(r["id"])
                and _points(r.get("floor"), w, h, MASK_MAX_POINTS) and _points(r.get("top"), w, h, MASK_MAX_POINTS) and _points([r.get("centre")], w, h, 1)):
            raise BakeError("corrupt_mask", "מסכת חדר אינה תקינה.")
    for d in doors:
        if not (isinstance(d, dict) and set(d) <= {"id", "points"} and isinstance(d.get("id"), str) and plain.fullmatch(d["id"]) and _points(d.get("points"), w, h, 16)):
            raise BakeError("corrupt_mask", "סימון דלת אינו תקין.")
    for c in cams:
        if not (isinstance(c, dict) and set(c) <= {"id", "p"} and isinstance(c.get("id"), str) and plain.fullmatch(c["id"]) and _points([c.get("p")], w, h, 1)):
            raise BakeError("corrupt_mask", "סימון מצלמה אינו תקין.")
    return w, h, doc


def validate_meta(kind: str, raw: str | None) -> dict[str, Any]:
    """The row's small JSON: a still's renderer string and camera, a lightmap's atlas layout. Bounded, plain values only."""
    if raw is None or raw == "":
        return {}
    if len(raw) > META_MAX:
        raise BakeError("bad_meta", "נתוני הקובץ ארוכים מדי.")
    try:
        meta = json.loads(raw)
    except ValueError:
        raise BakeError("bad_meta", "נתוני הקובץ אינם JSON תקין.") from None
    if not isinstance(meta, dict):
        raise BakeError("bad_meta", "נתוני הקובץ חייבים להיות אובייקט.")
    allowed = {"still": {"renderer", "camera", "ms", "quality"}, "mask": {"renderer", "camera"}, "lightmap": {"version", "surfaces", "channels", "samples", "texel_m", "ms"}}[kind]
    extra = set(meta) - allowed
    if extra:
        raise BakeError("bad_meta", "נתוני הקובץ מכילים שדות לא מוכרים.", {"fields": sorted(extra)})
    if "renderer" in meta and not (isinstance(meta["renderer"], str) and len(meta["renderer"]) <= 160):
        raise BakeError("bad_meta", "מחרוזת המעבד אינה תקינה.")
    if kind == "lightmap":
        surfaces = meta.get("surfaces")
        if not (isinstance(surfaces, list) and 1 <= len(surfaces) <= 64):
            raise BakeError("bad_meta", "פריסת מפת התאורה אינה תקינה.")
        for s in surfaces:
            if not (isinstance(s, dict) and s.get("kind") == "floor" and isinstance(s.get("level_id"), str)
                    and isinstance(s.get("uv"), list) and len(s["uv"]) == 4 and all(_finite(v, 0, 1) for v in s["uv"])
                    and isinstance(s.get("world"), list) and len(s["world"]) == 4 and all(_finite(v, -1e5, 1e5) for v in s["world"])
                    and _finite(s.get("y"), -1e4, 1e4) and set(s) <= {"kind", "level_id", "uv", "world", "y"}):
                raise BakeError("bad_meta", "משטח במפת התאורה אינו תקין.")
    return meta


def validate_file(kind: str, preset: str, data: bytes, wait_s: float = DECODE_WAIT_S) -> tuple[str, int, int, dict[str, Any] | None]:
    """(mime, width, height, mask document or None) of an acceptable upload; BakeError otherwise. Runs behind DECODE_SLOTS:
    call it from the thread pool. A busy decoder answers BakeError('busy') after `wait_s`."""
    cap = MAX_BYTES[kind]
    if len(data) > cap:
        raise BakeError("payload_too_large", f"הקובץ גדול מדי (עד {cap // 1024} KB).", {"max_bytes": cap})
    if not data:
        raise BakeError("unsupported_format", "הקובץ ריק.")
    mime = sniff(data[:32])
    if mime not in KIND_MIMES[kind]:
        raise BakeError("unsupported_format", "סוג הקובץ אינו מתאים לסוג האפייה.", {"accepted": list(KIND_MIMES[kind])})
    if not DECODE_SLOTS.acquire(timeout=wait_s):
        raise BakeError("busy", "השרת מעבד קבצים אחרים; נסו שוב בעוד רגע.")
    try:
        if mime == "application/json":
            w, h, doc = validate_mask(data, preset)
            return mime, w, h, doc
        {"image/png": _png_chunks, "image/jpeg": _jpeg_segments, "image/webp": _webp_chunks}[mime](data)
        w, h, mode = _decode(data, mime)
    finally:
        DECODE_SLOTS.release()
    if kind == "still":
        if not (STILL_W[0] <= w <= STILL_W[1] and STILL_H[0] <= h <= STILL_H[1]):
            raise BakeError("bad_size", "גודל התמונה המוכנה אינו בטווח המותר.", {"width": w, "height": h})
    else:  # lightmap
        if w not in LIGHTMAP_SIDES or h not in LIGHTMAP_SIDES or mode not in ("RGBA", "RGB"):
            raise BakeError("bad_size", "מפת התאורה חייבת להיות PNG בצבע, בצלעות של חזקות 2 (64-2048).", {"width": w, "height": h, "mode": mode})
    return mime, w, h, None


# ---------- rows ----------

def row_api(r: sqlite3.Row | dict[str, Any], current_key: str | None) -> dict[str, Any]:
    try:
        meta = json.loads(r["meta_json"] or "{}")
    except ValueError:
        meta = {}
    slot = {k: r[k] for k in ("kind", "level_id", "preset", "style", "band", "variant")}
    return {"id": r["id"], **slot, "slot": slot_id(slot), "bake_key": r["bake_key"], "recipe": r["recipe"], "mime": r["mime"], "width": r["width"],
            "height": r["height"], "bytes": r["bytes"], "sha256": r["sha256"], "meta": meta, "created_at": r["created_at"],
            "stale": current_key is None or r["bake_key"] != current_key,
            "url": f"api/v1/floors/{r['floor_id']}/bakes/{r['id']}/file?v={r['sha256'][:16]}"}


def rows_of(conn: sqlite3.Connection, floor_id: str) -> list[sqlite3.Row]:
    return conn.execute("SELECT * FROM plan_bakes WHERE floor_id = ? ORDER BY level_id, kind, preset, style, band, variant", (floor_id,)).fetchall()


def usage(conn: sqlite3.Connection, floor_id: str | None = None) -> int:
    if floor_id is None:
        return int(conn.execute("SELECT COALESCE(SUM(bytes), 0) FROM plan_bakes").fetchone()[0])
    return int(conn.execute("SELECT COALESCE(SUM(bytes), 0) FROM plan_bakes WHERE floor_id = ?", (floor_id,)).fetchone()[0])


def _current_keys(conn: sqlite3.Connection) -> dict[str, str | None]:
    """The current bake key of every floor that has a bake row (None = no published structure)."""
    out: dict[str, str | None] = {}
    for (fid,) in conn.execute("SELECT DISTINCT floor_id FROM plan_bakes").fetchall():
        k = bake_key(conn, fid)
        out[fid] = k[0] if k else None
    return out


def _evict(settings: Settings, conn: sqlite3.Connection, need_floor: int, need_total: int, floor_id: str, setting: dict[str, Any]) -> list[str]:
    """Free room for an upload: stale rows only, never a current one (BakeError storage_full when only current rows would
    have to go). Returns the evicted "<floor id>:<slot>" names (the upload's audit row carries them).

    Order (security review 2.4.7 I2): the uploading floor's own stale rows go first, oldest first - for the floor cap, and then
    for the installation cap too. Only when the installation cap still cannot be met from this floor are stale rows of OTHER
    floors evicted, oldest first, as a last resort: a stale row is never served (the bundle lists current rows only) and is
    drawn again on that floor's next bake, so the cost is a re-bake there - but it is a write outside the uploader's floor,
    hence last and named in the audit row. Refusing instead would let stale leftovers of a floor nobody bakes any more block
    every other floor's bake until an administrator deletes them by hand."""
    mb = 1024 * 1024
    floor_cap, total_cap = setting["floor_cap_mb"] * mb, setting["total_cap_mb"] * mb
    keys = _current_keys(conn)
    stale = [r for r in conn.execute("SELECT id, floor_id, path, bytes, bake_key, kind, level_id, preset, style, band, variant FROM plan_bakes ORDER BY created_at, id").fetchall()
             if keys.get(r["floor_id"]) is None or r["bake_key"] != keys.get(r["floor_id"])]
    evicted: list[str] = []

    def drop(r: sqlite3.Row) -> None:
        conn.execute("DELETE FROM plan_bakes WHERE id = ?", (r["id"],))
        _unlink(settings, r["path"])
        evicted.append(f"{r['floor_id']}:{slot_id(dict(r))}")

    own = [r for r in stale if r["floor_id"] == floor_id]
    others = [r for r in stale if r["floor_id"] != floor_id]
    for r in list(own):
        if usage(conn, floor_id) + need_floor <= floor_cap:
            break
        drop(r)
        own.remove(r)
    for r in own:  # the installation cap: this floor's remaining stale rows first ...
        if usage(conn) + need_total <= total_cap:
            break
        drop(r)
    for r in others:  # ... other floors' stale rows only as the last resort (I2)
        if usage(conn) + need_total <= total_cap:
            break
        drop(r)
    if usage(conn, floor_id) + need_floor > floor_cap or usage(conn) + need_total > total_cap:
        raise BakeError("storage_full", "אין מקום לתמונות מוכנות נוספות במגבלת האחסון שבהגדרות; הגדילו את המגבלה או מחקו אפיות של קומות אחרות.",
                        {"floor_used": usage(conn, floor_id), "floor_cap": floor_cap, "total_used": usage(conn), "total_cap": total_cap})
    return evicted


def store(settings: Settings, conn: sqlite3.Connection, floor_id: str, slot: dict[str, str], key: str, recipe: str, meta: dict[str, Any],
          data: bytes, mime: str, width: int, height: int, actor_id: str | None) -> tuple[dict[str, Any], bool, list[str]]:
    """Write the slot's file and row (replacing the slot's previous one). Returns (row, identical-to-previous, evicted slots).
    The caller has validated the file (validate_file) and checked the key against the floor's current key."""
    folder = floor_dir(settings, floor_id)
    if not KEY_RE.match(key or ""):
        raise BakeError("validation", "מפתח האפייה אינו תקין.")
    if not RECIPE_RE.match(recipe or ""):
        raise BakeError("validation", "מזהה המתכון אינו תקין.")
    setting = read_setting(conn)
    sha = hashlib.sha256(data).hexdigest()
    old = conn.execute("SELECT * FROM plan_bakes WHERE floor_id = ? AND level_id = ? AND kind = ? AND preset = ? AND style = ? AND band = ? AND variant = ?",
                       (floor_id, slot["level_id"], slot["kind"], slot["preset"], slot["style"], slot["band"], slot["variant"])).fetchone()
    identical = bool(old and old["sha256"] == sha and old["bake_key"] == key)
    replacing = int(old["bytes"]) if old else 0
    evicted = _evict(settings, conn, max(0, len(data) - replacing), max(0, len(data) - replacing), floor_id, setting)
    folder.mkdir(parents=True, exist_ok=True)
    slot_hash = hashlib.sha256(slot_id(slot).encode("utf-8")).hexdigest()[:16]
    dest = confine(settings, folder / f"{slot['kind']}-{slot_hash}-{sha[:16]}{MIMES[mime]}")
    dest.write_bytes(data)
    rel = dest.relative_to(settings.data_dir.resolve()).as_posix()
    now = now_iso()
    meta_json = json.dumps(meta, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    if old:
        conn.execute("UPDATE plan_bakes SET bake_key = ?, recipe = ?, path = ?, mime = ?, width = ?, height = ?, bytes = ?, sha256 = ?, meta_json = ?, created_by = ?, created_at = ? WHERE id = ?",
                     (key, recipe, rel, mime, width, height, len(data), sha, meta_json, actor_id, now, old["id"]))
        if old["path"] != rel:
            _unlink(settings, old["path"])
        rid = old["id"]
    else:
        rid = new_id()
        conn.execute("INSERT INTO plan_bakes(id, floor_id, level_id, kind, preset, style, band, variant, bake_key, recipe, path, mime, width, height, bytes, sha256, meta_json, created_by, created_at) "
                     "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                     (rid, floor_id, slot["level_id"], slot["kind"], slot["preset"], slot["style"], slot["band"], slot["variant"], key, recipe, rel, mime, width, height,
                      len(data), sha, meta_json, actor_id, now))
    r = conn.execute("SELECT * FROM plan_bakes WHERE id = ?", (rid,)).fetchone()
    return row_api(r, key), identical, evicted


def file_of(settings: Settings, conn: sqlite3.Connection, floor_id: str, bake_id: str) -> tuple[Path, str, str] | None:
    r = conn.execute("SELECT path, mime, sha256 FROM plan_bakes WHERE id = ? AND floor_id = ?", (bake_id, floor_id)).fetchone()
    if not r:
        return None
    return confine_stored(settings, r["path"]), r["mime"], r["sha256"]


def row_of(conn: sqlite3.Connection, floor_id: str, bake_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM plan_bakes WHERE id = ? AND floor_id = ?", (bake_id, floor_id)).fetchone()


# ---------- security review 2.4.7 M1: a room mask as a reader is handed it (their camera scope) ----------
#
# A mask lists the camera bodies of the editor's live scene (map/still-bake.ts buildMask: `cameras[{id, p}]`, the id being the
# camera's anchor id), projected onto the still. The stored file stays as the editor's browser drew it (the editor's bake /
# upload flow and every mask stored before this fix are unchanged); what a reader gets is derived on every read: for a reader
# whose camera scope can withhold something (plan_anchor_scope.visibility is not None) every camera entry they may not see is
# left out - the 2.4.2 M2 / SEC244 rule of the geometry read, the exports and the floor bundle. An entry resolves through
# its anchor (map_anchors.id -> the camera) or, failing that, as a camera id; one that resolves to neither (an anchor removed
# since, anything unknown) is left out too (fail closed). The listing (`describe`), the floor bundle and the file route hand
# such a reader the sha256, size, ETag and `?v=` of the copy they get, never of the stored file.

_MASK_CACHE_MAX = 256
_MASK_IDS: "OrderedDict[str, tuple[str, ...]]" = OrderedDict()                       # stored sha256 -> camera entry ids
_MASK_SERVED: "OrderedDict[tuple[str, frozenset[str]], tuple[str, int]]" = OrderedDict()  # (stored sha, withheld ids) -> (sha, bytes)
_MASK_LOCK = threading.Lock()
WITHHELD_V = "0" * 16  # the `?v=` of a mask a scoped reader cannot be handed (its file is gone): the route answers 404


def _mcache_get(cache: OrderedDict, key: Any) -> Any:
    with _MASK_LOCK:
        hit = cache.get(key)
        if hit is not None:
            cache.move_to_end(key)
        return hit


def _mcache_put(cache: OrderedDict, key: Any, value: Any) -> None:
    with _MASK_LOCK:
        cache[key] = value
        cache.move_to_end(key)
        while len(cache) > _MASK_CACHE_MAX:
            cache.popitem(last=False)


def _read_mask(settings: Settings, rel: str) -> dict[str, Any] | None:
    try:
        doc = json.loads(confine_stored(settings, rel).read_bytes().decode("utf-8"))
    except (BakeStoreError, OSError, UnicodeDecodeError, ValueError):
        return None
    return doc if isinstance(doc, dict) and isinstance(doc.get("cameras"), list) else None


def hidden_mask_cameras(conn: sqlite3.Connection, ids: list[str] | tuple[str, ...], visible: Any) -> frozenset[str]:
    """The mask camera entry ids this reader may not see (empty when `visible` is None: nothing is withheld from them)."""
    if visible is None or not ids:
        return frozenset()
    uniq = sorted(set(ids))
    anchors: dict[str, tuple[str, Any]] = {}
    cams: set[str] = set()
    for i in range(0, len(uniq), 400):
        chunk = uniq[i:i + 400]
        marks = ",".join("?" * len(chunk))
        for r in conn.execute(f"SELECT id, resource_type, resource_id FROM map_anchors WHERE id IN ({marks})", chunk).fetchall():
            anchors[r["id"]] = (r["resource_type"], r["resource_id"])
        cams |= {r["id"] for r in conn.execute(f"SELECT id FROM cameras WHERE id IN ({marks})", chunk).fetchall()}
    hidden = set()
    for cid in uniq:
        if cid in anchors:
            rtype, rid = anchors[cid]
            ok = rtype == "camera" and bool(visible("camera", rid))
        else:
            ok = cid in cams and bool(visible("camera", cid))
        if not ok:
            hidden.add(cid)
    return frozenset(hidden)


def _filtered_mask(doc: dict[str, Any], hidden: frozenset[str]) -> bytes:
    out = dict(doc, cameras=[c for c in doc["cameras"] if isinstance(c, dict) and isinstance(c.get("id"), str) and c["id"] not in hidden])
    return json.dumps(out, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


class MaskView(NamedTuple):
    sha256: str
    size: int
    filtered: bool          # False = the reader gets the stored file as it is
    content: bytes | None   # the filtered document (only when filtered and asked for with body=True)


def mask_view(settings: Settings | None, conn: sqlite3.Connection, row: sqlite3.Row | dict[str, Any], visible: Any,
              *, body: bool = False) -> MaskView | None:
    """A stored mask as this reader is handed it: the stored file's sha256 / size when nothing of it is withheld from them,
    else the filtered document's own (and, with body=True, its content). None = a reader from whom something may be withheld
    but whose mask cannot be read (a missing file): nothing is served to them."""
    if visible is None:
        return MaskView(row["sha256"], int(row["bytes"]), False, None)
    if settings is None:
        return None
    stored = row["sha256"]
    doc = None
    ids = _mcache_get(_MASK_IDS, stored)
    if ids is None:
        doc = _read_mask(settings, row["path"])
        if doc is None:
            return None
        ids = tuple(sorted({c["id"] for c in doc["cameras"] if isinstance(c, dict) and isinstance(c.get("id"), str)}))
        _mcache_put(_MASK_IDS, stored, ids)
    hidden = hidden_mask_cameras(conn, ids, visible)
    if not hidden:
        return MaskView(stored, int(row["bytes"]), False, None)
    hit = _mcache_get(_MASK_SERVED, (stored, hidden))
    if hit is not None and not body:
        return MaskView(hit[0], hit[1], True, None)
    if doc is None:
        doc = _read_mask(settings, row["path"])
        if doc is None:
            return None
    data = _filtered_mask(doc, hidden)
    sha = hashlib.sha256(data).hexdigest()
    _mcache_put(_MASK_SERVED, (stored, hidden), (sha, len(data)))
    return MaskView(sha, len(data), True, data if body else None)


# ---------- STILLCAM: the pixels of a still / lightmap drawn with camera-bound bodies ----------
#
# A still or a lightmap is drawn once, in one editor's browser, and the same pixels go to every reader of the floor. An object
# bound to a camera anchor stands at that camera's position (plan_geometry.apply_anchor_positions copies the pose onto the body),
# so a picture that draws it shows the camera's place - which the geometry read withholds from a reader whose camera scope hides
# that camera (plan_anchor_scope.redact, security review 2.4.2 M2). From `still-q2.2` / `lightmap-2` on, the client bakes from a
# document without camera-bound bodies (map/still-bake.ts bakeSceneInput). A row of an OLDER recipe is withheld - from the bundle,
# the listing and the file route - from a reader for whom the published structure binds an object to a camera they may not see,
# and, fail closed, a stale one (drawn from a structure no longer read here) from every reader whose camera scope can withhold
# something. A reader who reaches the floor only through camera bindings (the only one an entity reference is withheld from) is
# handed no bakes at all (routers/anchors.py; the bakes routes need map.read on the floor). The stored files are unchanged.

PIXEL_KINDS = ("still", "lightmap")
SAFE_STILL_RANK = (2, 2)
SAFE_LIGHTMAP_RANK = 2
_STILL_RECIPE = re.compile(r"^still-q(\d{1,4})\.(\d{1,4})$")
_LIGHTMAP_RECIPE = re.compile(r"^lightmap-(\d{1,4})$")
_BODY_CAMS: "OrderedDict[str, tuple[str, ...]]" = OrderedDict()  # stored doc_hash -> camera ids objects are bound to


def recipe_omits_camera_bodies(kind: str, recipe: Any) -> bool:
    """Whether a still / lightmap of `recipe` was drawn without camera-bound bodies (an unknown recipe: no)."""
    if not isinstance(recipe, str):
        return False
    if kind == "still":
        m = _STILL_RECIPE.match(recipe)
        return bool(m) and (int(m[1]), int(m[2])) >= SAFE_STILL_RANK
    if kind == "lightmap":
        m = _LIGHTMAP_RECIPE.match(recipe)
        return bool(m) and int(m[1]) >= SAFE_LIGHTMAP_RANK
    return True


def _body_cameras(conn: sqlite3.Connection, floor_id: str) -> tuple[str, ...]:
    """The camera ids the floor's published structure binds an object to (cached per stored doc_hash)."""
    from . import geometry_store
    from .skins import store as skins_store

    g = skins_store.published_geometry(conn, floor_id)
    if g is None:
        return ()
    hit = _mcache_get(_BODY_CAMS, g["doc_hash"])
    if hit is not None:
        return hit
    try:
        doc = geometry_store.load_doc(g)
    except (TypeError, ValueError):
        doc = {}
    cams = tuple(sorted({str(ref.get("resource_id")) for o in (doc.get("objects") or []) if isinstance(o, dict)
                         for ref in (o.get("anchor_ref"),) if isinstance(ref, dict) and ref.get("resource_type") == "camera"}))
    _mcache_put(_BODY_CAMS, g["doc_hash"], cams)
    return cams


class PixelGate(NamedTuple):
    scoped: bool        # the reader's camera scope can withhold something (stale older rows are withheld)
    bodies_hidden: bool  # the published structure binds an object to a camera this reader may not see


def pixel_gate(conn: sqlite3.Connection, floor_id: str, visible: Any) -> PixelGate:
    if visible is None:
        return PixelGate(False, False)
    return PixelGate(True, any(not visible("camera", cid) for cid in _body_cameras(conn, floor_id)))


def pixels_withheld(gate: PixelGate, kind: str, recipe: Any, stale: bool) -> bool:
    """STILLCAM: whether this reader is not handed a still / lightmap row (see the section note)."""
    if not gate.scoped or kind not in PIXEL_KINDS or recipe_omits_camera_bodies(kind, recipe):
        return False
    return gate.bodies_hidden or stale


def row_withheld(conn: sqlite3.Connection, r: sqlite3.Row, visible: Any) -> bool:
    """The file route's check for one row (the listing and the bundle use pixel_gate once per floor)."""
    if visible is None or r["kind"] not in PIXEL_KINDS or recipe_omits_camera_bodies(r["kind"], r["recipe"]):
        return False
    key = bake_key(conn, r["floor_id"])
    return pixels_withheld(pixel_gate(conn, r["floor_id"], visible), r["kind"], r["recipe"], key is None or r["bake_key"] != key[0])


def shown_row(a: dict[str, Any], r: sqlite3.Row, settings: Settings | None, conn: sqlite3.Connection, sk: ServedKey | None, visible: Any) -> dict[str, Any]:
    """A row_api() answer as this reader is handed it: the bake key through shown_key (L1) and, for a mask, the sha256, size and
    `?v=` of the copy they get (M1). Unchanged for a reader from whom nothing can be withheld."""
    if visible is None:
        return a
    out = dict(a, bake_key=shown_key(a["bake_key"], sk, visible))
    if a["kind"] == "mask":
        mv = mask_view(settings, conn, r, visible)
        v = mv.sha256[:16] if mv is not None else WITHHELD_V
        out.update(sha256=mv.sha256 if mv is not None else None, bytes=mv.size if mv is not None else None,
                   url=f"api/v1/floors/{r['floor_id']}/bakes/{r['id']}/file?v={v}")
    return out


def remove_one(settings: Settings, conn: sqlite3.Connection, floor_id: str, bake_id: str) -> dict[str, Any] | None:
    r = conn.execute("SELECT * FROM plan_bakes WHERE id = ? AND floor_id = ?", (bake_id, floor_id)).fetchone()
    if not r:
        return None
    conn.execute("DELETE FROM plan_bakes WHERE id = ?", (bake_id,))
    _unlink(settings, r["path"])
    return {"slot": slot_id(dict(r)), "bytes": r["bytes"]}


def delete_floor(settings: Settings, conn: sqlite3.Connection, floor_id: str) -> int:
    """The floor's bakes go (files and rows) and its open jobs end; used by DELETE /floors/{id} and DELETE .../bakes."""
    rows = conn.execute("SELECT path FROM plan_bakes WHERE floor_id = ?", (floor_id,)).fetchall()
    for r in rows:
        _unlink(settings, r["path"])
    n = conn.execute("DELETE FROM plan_bakes WHERE floor_id = ?", (floor_id,)).rowcount
    conn.execute("UPDATE plan_bake_jobs SET status = 'cancelled', finished_at = ?, error = 'floor_deleted' WHERE floor_id = ? AND status IN ('requested', 'claimed')",
                 (now_iso(), floor_id))
    try:
        shutil.rmtree(floor_dir(settings, floor_id), ignore_errors=True)
    except BakeStoreError:
        pass
    return n


def sweep_orphans(settings: Settings, conn: sqlite3.Connection) -> int:
    """Rows of floors that are gone (a replace restore, a deleted floor) and rows whose path does not confine; folders under the
    bakes root without a live floor; files of a live floor that no row names (an interrupted replace). Returns rows removed."""
    tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()}
    if "plan_bakes" not in tables:
        return 0
    live = {r[0] for r in conn.execute("SELECT id FROM floors WHERE deleted_at IS NULL").fetchall()}
    n = 0
    named: set[Path] = set()
    for r in conn.execute("SELECT id, floor_id, path FROM plan_bakes").fetchall():
        try:
            target = confine_stored(settings, r["path"])
        except BakeStoreError:
            target = None
        if target is None or r["floor_id"] not in live:
            if target is not None:
                target.unlink(missing_ok=True)
            conn.execute("DELETE FROM plan_bakes WHERE id = ?", (r["id"],))
            n += 1
        else:
            named.add(target)
    base = root(settings)
    if base.is_dir() and not base.is_symlink():
        for d in base.iterdir():
            if d.is_symlink() or not d.is_dir():
                continue
            try:
                inside = confine(settings, d)
            except BakeStoreError:
                continue
            if d.name not in live:
                shutil.rmtree(inside, ignore_errors=True)
                continue
            for f in inside.iterdir():
                if f.is_file() and not f.is_symlink() and f.resolve() not in named:
                    f.unlink(missing_ok=True)
    return n


# ---------- what a floor has, and what the map bundle carries ----------

def describe(conn: sqlite3.Connection, floor_id: str, *, settings: Settings | None = None, visible: Any = None) -> dict[str, Any]:
    """What GET /floors/{id}/bakes answers, as this reader (`visible` = plan_anchor_scope.visibility; None = nothing is withheld
    from them) is handed it: the bake key, geometry key and doc_hash are the served ones (security review 2.4.7 L1) and a
    mask row describes the copy they get (M1; `settings` locates the files)."""
    sk = served_bake_key(conn, floor_id, visible)
    current = sk.real if sk else None
    setting = read_setting(conn)
    levels = floor_levels(conn, floor_id)
    gate = pixel_gate(conn, floor_id, visible)
    pairs = [(row_api(r, current), r) for r in rows_of(conn, floor_id)]
    pairs = [(a, r) for a, r in pairs if not pixels_withheld(gate, a["kind"], a["recipe"], a["stale"])]  # STILLCAM
    rows = [a for a, _r in pairs]
    raw = [r for _a, r in pairs]
    have = {r["slot"] for r in rows if not r["stale"]}
    expected = expected_slots(levels, setting)
    missing = [slot_id(s) for s in expected if slot_id(s) not in have]
    job = job_api(open_job(conn, floor_id))
    if job is not None:
        job["bake_key"] = shown_key(job["bake_key"], sk, visible)
    return {"floor_id": floor_id, "bake_key": sk.bake_key if sk else None, "geometry_key": sk.geometry_key if sk else None, "doc_hash": sk.doc_hash if sk else None,
            "levels": levels, "setting": setting, "size": list(still_size(setting)),
            "bakes": [shown_row(a, r, settings, conn, sk, visible) for a, r in zip(rows, raw)], "expected": [slot_id(s) for s in expected], "missing": missing,
            "complete": bool(current) and not missing, "stale_count": sum(1 for r in rows if r["stale"]),
            "usage": {"floor_bytes": usage(conn, floor_id), "total_bytes": usage(conn), "floor_cap_bytes": setting["floor_cap_mb"] * 1024 * 1024,
                      "total_cap_bytes": setting["total_cap_mb"] * 1024 * 1024},
            "job": job}


def bundle_part(conn: sqlite3.Connection, floor_id: str, *, settings: Settings | None = None, visible: Any = None) -> dict[str, Any] | None:
    """The map bundle's view: only CURRENT rows, grouped per level. None when the floor has no bake row at all. As this reader
    is handed it (see describe): the served bake key (L1), a mask's `?v=` of the copy they get (M1)."""
    if not conn.execute("SELECT 1 FROM plan_bakes WHERE floor_id = ? LIMIT 1", (floor_id,)).fetchone():
        return None
    sk = served_bake_key(conn, floor_id, visible)
    current = sk.real if sk else None
    levels: dict[str, Any] = {}
    stale = 0
    recipes: set[str] = set()
    gate = pixel_gate(conn, floor_id, visible)
    for r in rows_of(conn, floor_id):
        a = row_api(r, current)
        if pixels_withheld(gate, a["kind"], a["recipe"], a["stale"]):  # STILLCAM: as if the slot were empty
            continue
        if a["stale"]:
            stale += 1
            continue
        recipes.add(a["recipe"])
        lv = levels.setdefault(a["level_id"], {"stills": {}, "masks": {}, "lightmap": None})
        if a["kind"] == "still":
            lv["stills"][f"{a['preset']}/{a['style']}/{a['band']}/{a['variant']}"] = {"url": a["url"], "width": a["width"], "height": a["height"], "recipe": a["recipe"]}
        elif a["kind"] == "mask":
            lv["masks"][a["preset"]] = {"url": shown_row(a, r, settings, conn, sk, visible)["url"]}
        else:
            lv["lightmap"] = {"url": a["url"], "width": a["width"], "height": a["height"], "meta": a["meta"], "recipe": a["recipe"]}
    expected = expected_slots(floor_levels(conn, floor_id), read_setting(conn))
    have = {f"{lv}:{k}" for lv, v in levels.items() for k in v["stills"]}
    complete = bool(current) and all(
        (s["kind"] != "still" or f"{s['level_id']}:{s['preset']}/{s['style']}/{s['band']}/{s['variant']}" in have)
        and (s["kind"] != "mask" or s["preset"] in levels.get(s["level_id"], {}).get("masks", {}))
        and (s["kind"] != "lightmap" or levels.get(s["level_id"], {}).get("lightmap") is not None)
        for s in expected)
    return {"bake_key": sk.bake_key if sk else None, "complete": complete, "stale_count": stale, "recipes": sorted(recipes), "levels": levels}


# ---------- jobs ----------

def job_api(r: sqlite3.Row | None) -> dict[str, Any] | None:
    if r is None:
        return None
    try:
        scope = json.loads(r["scope_json"])
    except ValueError:
        scope = {}
    return {"id": r["id"], "status": r["status"], "bake_key": r["bake_key"], "scope": scope, "requested_by": r["requested_by"], "requested_at": r["requested_at"],
            "claimed_by": r["claimed_by"], "claimed_at": r["claimed_at"], "lease_until": r["lease_until"], "finished_at": r["finished_at"], "error": r["error"]}


def open_job(conn: sqlite3.Connection, floor_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM plan_bake_jobs WHERE floor_id = ? AND status IN ('requested', 'claimed') ORDER BY requested_at DESC, rowid DESC LIMIT 1",
                        (floor_id,)).fetchone()


def normalize_scope(scope: dict[str, Any], levels: list[str], setting: dict[str, Any]) -> dict[str, Any]:
    """What a regenerate request asks for: a subset of the floor's levels and of the setting's presets / styles / bands, and
    whether the lightmap is included (default: everything the setting lists)."""
    out = {"levels": list(levels), "presets": list(setting["presets"]), "styles": list(setting["styles"]), "bands": list(setting["bands"]),
           "lightmap": bool(setting["lightmap"])}
    for k, allowed in (("levels", levels), ("presets", PRESETS), ("styles", STYLES), ("bands", BANDS)):
        if scope.get(k) is not None:
            v = scope[k]
            if not isinstance(v, list) or not v or any(x not in allowed for x in v):
                raise BakeError("validation", f"בקשת האפייה: ערך לא תקין ב־{k}.", {"field": k, "choices": list(allowed)})
            out[k] = [x for x in allowed if x in v]
    if scope.get("lightmap") is not None:
        if not isinstance(scope["lightmap"], bool):
            raise BakeError("validation", "בקשת האפייה: lightmap הוא כן / לא.")
        out["lightmap"] = scope["lightmap"]
    return out


def request_job(conn: sqlite3.Connection, floor_id: str, key: str, scope: dict[str, Any], actor_id: str | None) -> tuple[dict[str, Any], bool]:
    """Open a request, or return the open one of the same key (a request for an outdated key is cancelled and replaced).
    Returns (job, created)."""
    cur = open_job(conn, floor_id)
    now = now_iso()
    if cur is not None:
        lease_over = cur["status"] == "claimed" and (cur["lease_until"] or "") < now
        if cur["bake_key"] == key and not lease_over:
            return job_api(cur), False  # type: ignore[return-value]
        conn.execute("UPDATE plan_bake_jobs SET status = 'cancelled', finished_at = ?, error = ? WHERE id = ?",
                     (now, "superseded" if cur["bake_key"] != key else "lease_expired", cur["id"]))
    jid = new_id()
    conn.execute("INSERT INTO plan_bake_jobs(id, floor_id, bake_key, scope_json, status, requested_by, requested_at) VALUES (?,?,?,?, 'requested', ?, ?)",
                 (jid, floor_id, key, json.dumps(scope, sort_keys=True, separators=(",", ":")), actor_id, now))
    return job_api(conn.execute("SELECT * FROM plan_bake_jobs WHERE id = ?", (jid,)).fetchone()), True  # type: ignore[return-value]


def claim_job(conn: sqlite3.Connection, floor_id: str, job_id: str, key: str, actor_id: str | None, now: dt.datetime | None = None) -> dict[str, Any]:
    r = conn.execute("SELECT * FROM plan_bake_jobs WHERE id = ? AND floor_id = ?", (job_id, floor_id)).fetchone()
    if r is None:
        raise BakeError("not_found", "בקשת האפייה לא נמצאה.")
    t = now or dt.datetime.now(dt.timezone.utc)
    stamp = t.replace(microsecond=0).isoformat().replace("+00:00", "Z")
    if r["status"] not in ("requested", "claimed"):
        raise BakeError("job_closed", "בקשת האפייה כבר הסתיימה.", {"status": r["status"]})
    if r["bake_key"] != key:
        raise BakeError("geometry_changed", "המבנה של הקומה השתנה מאז הבקשה; בקשו אפייה מחדש.")
    if r["status"] == "claimed" and r["claimed_by"] != actor_id and (r["lease_until"] or "") > stamp:
        raise BakeError("job_claimed", "דפדפן אחר מכין כעת את התמונות של הקומה.", {"lease_until": r["lease_until"]})
    lease = (t + dt.timedelta(seconds=LEASE_S)).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    conn.execute("UPDATE plan_bake_jobs SET status = 'claimed', claimed_by = ?, claimed_at = ?, lease_until = ? WHERE id = ?", (actor_id, stamp, lease, job_id))
    return job_api(conn.execute("SELECT * FROM plan_bake_jobs WHERE id = ?", (job_id,)).fetchone())  # type: ignore[return-value]


def finish_job(conn: sqlite3.Connection, floor_id: str, job_id: str, status: str, error: str | None, actor_id: str | None) -> dict[str, Any]:
    if status not in ("done", "failed", "cancelled"):
        raise BakeError("validation", "מצב סיום לא מוכר.")
    r = conn.execute("SELECT * FROM plan_bake_jobs WHERE id = ? AND floor_id = ?", (job_id, floor_id)).fetchone()
    if r is None:
        raise BakeError("not_found", "בקשת האפייה לא נמצאה.")
    if r["status"] not in ("requested", "claimed"):
        raise BakeError("job_closed", "בקשת האפייה כבר הסתיימה.", {"status": r["status"]})
    if status == "done":
        # every slot the REQUEST asked for must be stored for the floor's current key (the request may name slots the setting
        # does not list, e.g. a preset turned off since)
        key = bake_key(conn, floor_id)
        have = {r2["slot"] for r2 in (row_api(x, key[0] if key else None) for x in rows_of(conn, floor_id)) if not r2["stale"]}
        want = expected_slots_for_scope(job_api(r)["scope"])  # type: ignore[index]
        missing = [s for s in want if s not in have]
        if missing:
            raise BakeError("incomplete", "לא כל הקבצים של הבקשה נשמרו.", {"missing": missing[:20], "missing_count": len(missing)})
    clean = None if error is None else re.sub(r"[^\w .,:;()/-]", "", str(error))[:200]
    conn.execute("UPDATE plan_bake_jobs SET status = ?, finished_at = ?, error = ?, claimed_by = COALESCE(claimed_by, ?) WHERE id = ?",
                 (status, now_iso(), clean, actor_id, job_id))
    return job_api(conn.execute("SELECT * FROM plan_bake_jobs WHERE id = ?", (job_id,)).fetchone())  # type: ignore[return-value]


def expected_slots_for_scope(scope: dict[str, Any]) -> list[str]:
    setting = {"presets": scope.get("presets") or [], "styles": scope.get("styles") or [], "bands": scope.get("bands") or [], "lightmap": bool(scope.get("lightmap"))}
    return [slot_id(s) for s in expected_slots(list(scope.get("levels") or []), setting)]
