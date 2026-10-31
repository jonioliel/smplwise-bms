"""CR-LOGOS295: the installation's logo and look settings - the company (developer / property-management) logo, the logo size scale,
the dark-background behaviour and the browser-tab title (הגדרות › כללי › מראה המערכת).

Two kinds of data live here:
- `brand.*` settings (rows of `settings`, carried by the project backup): company name / kind, the stamps of the stored logos,
  `brand.logo_size` (s | m | l | xl), `brand.company_logo_size` (same | s | m | l | xl: the company / installer logo's own scale), `brand.logo_side` (start | end: which side of the top header
  the company / installer logos take), `brand.dark_mode` (plate | file | invert), `brand.title.prefix`, `brand.title.mode`
  (both | dev | project) and `brand.project.name`;
- the `brand_assets` table (migration 0166): the normalised image of each (kind, variant) as base64 text, so the
  backup carries it too.

The upload is validated by CONTENT, never by the browser's Content-Type: PNG / JPEG / WebP are decoded behind a header-declared
pixel budget and re-encoded as a fresh PNG (no EXIF / ICC / appended bytes, first frame only, longest side <= 1200 px, alpha kept);
SVG goes through services/svg_sanitize.py (allowlist, rebuilt, never stored as submitted). The stamp is the first 16 hex of the
SHA-256 of the stored bytes: a replaced logo is a new stamp, so a cache can never serve a stale one.
"""
from __future__ import annotations

import base64
import hashlib
import json
import sqlite3
from dataclasses import dataclass, field
from io import BytesIO
from typing import Any

from ..db import get_setting, now_iso, set_setting
from ..errors import ApiError
from . import svg_sanitize

KIND = "company"
VARIANTS = ("light", "dark")
MAX_BYTES = 2 * 1024 * 1024
MAX_PIXELS = 4_000_000
MIN_SHORT_SIDE = 64
OUT_MAX_PX = 1200
ASPECT_WARN = 6.0
SIZES = ("s", "m", "l", "xl")
SCALE = {"s": 0.75, "m": 1.0, "l": 1.25, "xl": 1.5}
COMPANY_SIZES = ("same",) + SIZES  # LOGOSIDE-295: the company (and installer) logo's own scale; "same" = follow logo_size
SIDES = ("start", "end")  # LOGOSIDE-295: start = the inline-start of the header (right in RTL), end = beside the SmplWise logo in the corner
DARK_MODES = ("plate", "file", "invert")
TITLE_MODES = ("both", "dev", "project")
COMPANY_KINDS = ("developer", "management", "other")
NAME_MAX = 60
PREFIX_MAX = 40

K_NAME = "brand.company.name"
K_KIND = "brand.company.kind"
K_LOGO = "brand.company.logo"
K_SIZE = "brand.logo_size"
K_SIDE = "brand.logo_side"
K_CSIZE = "brand.company_logo_size"
K_DARK = "brand.dark_mode"
K_PREFIX = "brand.title.prefix"
K_MODE = "brand.title.mode"
K_PROJECT = "brand.project.name"

DEFAULTS: dict[str, str] = {
    K_NAME: "",
    K_KIND: "developer",
    K_LOGO: '{"light":null,"dark":null}',
    K_SIZE: "m",
    K_SIDE: "start",
    K_CSIZE: "same",
    K_DARK: "invert",  # HOME-295 (owner answers round 2, item 12): invert the colours by default; plate / dark file stay selectable
    K_PREFIX: "Smplwise Arx",
    K_MODE: "both",
    K_PROJECT: "",
}
KEYS = tuple(DEFAULTS)


@dataclass
class Normalised:
    mime: str
    width: int
    height: int
    data: bytes
    warnings: list[str] = field(default_factory=list)

    @property
    def ext(self) -> str:
        return "svg" if self.mime == "image/svg+xml" else "png"


def stamp_of(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()[:16]


def _err(status: int, code: str, message: str, **details: Any) -> ApiError:
    return ApiError(status, code, message, details=details or None)


def _is_svg(data: bytes) -> bool:
    head = data[:2048].lstrip(b"\xef\xbb\xbf \t\r\n")
    return head.startswith(b"<svg") or (head.startswith(b"<?xml") and b"<svg" in data[:4096])


def normalise(data: bytes) -> Normalised:
    """The content guarantee of a logo upload (CR-LOGOS295 5.4): ApiError 413 / 415 / 422 otherwise."""
    if len(data) > MAX_BYTES:
        raise _err(413, "payload_too_large", "הקובץ גדול מדי (עד 2MB)", max_bytes=MAX_BYTES)
    if _is_svg(data):
        try:
            clean = svg_sanitize.sanitize(data)
        except svg_sanitize.SvgRefused as exc:
            if exc.reason == "too_large":
                raise _err(413, "payload_too_large", "הקובץ גדול מדי (עד 2MB)", max_bytes=svg_sanitize.MAX_BYTES) from exc
            raise _err(422, "svg_unsupported", "קובץ ה-SVG מכיל תוכן שאינו נתמך", reason=exc.reason) from exc
        out = Normalised("image/svg+xml", clean.width, clean.height, clean.data)
        _aspect(out)
        return out
    png = data.startswith(b"\x89PNG\r\n\x1a\n")
    jpeg = data.startswith(b"\xff\xd8\xff")
    webp = data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    if not (png or jpeg or webp):
        raise _err(415, "unsupported_format", "אפשר להעלות PNG, SVG, WebP או JPEG")
    from PIL import Image

    from . import image_guard

    try:
        im = image_guard.open_untrusted(data, ["PNG", "JPEG", "WEBP"], mpo_first_frame=True)  # the header only
        w0, h0 = im.size
        if min(w0, h0) < MIN_SHORT_SIDE:
            raise _err(422, "image_too_small", "התמונה קטנה מדי - לפחות 64 פיקסלים", width=w0, height=h0)
        if image_guard.check_pixels(im, MAX_PIXELS) is None:
            raise _err(422, "too_many_pixels", "התמונה גדולה מדי", width=w0, height=h0, max_pixels=MAX_PIXELS)
        im.seek(0)  # an animated PNG / WebP: the first frame only
        im.load()
        has_alpha = im.mode in ("RGBA", "LA", "PA") or "transparency" in im.info
        im = im.convert("RGBA" if has_alpha else "RGB")
        if max(im.size) > OUT_MAX_PX:
            im.thumbnail((OUT_MAX_PX, OUT_MAX_PX), Image.Resampling.LANCZOS)
        buf = BytesIO()
        im.save(buf, format="PNG", optimize=True)
        out = Normalised("image/png", im.size[0], im.size[1], buf.getvalue())
        if has_alpha:
            _very_light(im, out)
        else:
            out.warnings.append("no_alpha")  # a raster logo without transparency gets the plate on dark surfaces
    except ApiError:
        raise
    except Image.DecompressionBombError as exc:
        raise _err(422, "too_many_pixels", "התמונה גדולה מדי", error=type(exc).__name__) from exc
    except Exception as exc:  # noqa: BLE001 - a broken image is the upload's problem
        raise _err(422, "corrupt_image", "התמונה לא ניתנת לקריאה", error=type(exc).__name__) from exc
    if len(out.data) > MAX_BYTES:
        raise _err(413, "payload_too_large", "הקובץ גדול מדי (עד 2MB)", max_bytes=MAX_BYTES)
    _aspect(out)
    return out


def _aspect(out: Normalised) -> None:
    long_, short = max(out.width, out.height), max(1, min(out.width, out.height))
    wide = out.width >= out.height
    if long_ / short > ASPECT_WARN or (not wide and long_ / short > 2):
        out.warnings.append("odd_aspect")


def _very_light(im: Any, out: Normalised) -> None:
    """Mean luminance of the visible pixels above 0.92 -> a warning (CR section 9): saved anyway."""
    small = im.copy()
    small.thumbnail((64, 64))
    px = list(small.getdata())
    vis = [(r, g, b) for r, g, b, a in px if a > 32]
    if vis:
        lum = sum(0.2126 * r + 0.7152 * g + 0.0722 * b for r, g, b in vis) / len(vis) / 255
        if lum > 0.92:
            out.warnings.append("very_light")


# ---------------------------------------------------------------- settings

def _text(v: Any, limit: int) -> str:
    if not isinstance(v, str):
        raise ValueError("text")
    if any(ord(c) < 32 for c in v):
        raise ValueError("control")
    s = " ".join(v.replace("⁦", "").replace("⁧", "").replace("⁨", "").replace("⁩", "").split())
    if len(s) > limit:
        raise ValueError("long")
    if any(ord(c) < 32 for c in s):
        raise ValueError("control")
    return s


def normalise_setting(key: str, value: Any) -> str:
    """The canonical stored text of a brand setting; ValueError when it is not acceptable."""
    if key == K_SIZE:
        if value not in SIZES:
            raise ValueError("size")
        return str(value)
    if key == K_CSIZE:
        if value not in COMPANY_SIZES:
            raise ValueError("company_size")
        return str(value)
    if key == K_SIDE:
        if value not in SIDES:
            raise ValueError("side")
        return str(value)
    if key == K_DARK:
        if value not in DARK_MODES:
            raise ValueError("dark_mode")
        return str(value)
    if key == K_MODE:
        if value not in TITLE_MODES:
            raise ValueError("title_mode")
        return str(value)
    if key == K_KIND:
        if value not in COMPANY_KINDS:
            raise ValueError("kind")
        return str(value)
    if key == K_NAME:
        return _text(value, NAME_MAX)
    if key == K_PROJECT:
        return _text(value, NAME_MAX)
    if key == K_PREFIX:
        s = _text(value, PREFIX_MAX)
        if not s:
            raise ValueError("prefix")
        return s
    raise ValueError("key")


# WHITELABEL097-295: the installer company's logo is a second kind in the same table; each kind keeps its stamps in its own setting.
INSTALLER_KIND = "installer"
K_WL_LOGO = "brand.wl.logo"
_STAMP_KEY = {KIND: K_LOGO, INSTALLER_KIND: K_WL_LOGO}


def stamps(conn: sqlite3.Connection, kind: str = KIND) -> dict[str, str | None]:
    out: dict[str, str | None] = {v: None for v in VARIANTS}
    try:
        raw = json.loads(get_setting(conn, _STAMP_KEY[kind], DEFAULTS[K_LOGO]) or "{}")
    except ValueError:
        return out
    if isinstance(raw, dict):
        for v in VARIANTS:
            s = raw.get(v)
            if isinstance(s, str) and len(s) == 16 and all(c in "0123456789abcdef" for c in s):
                out[v] = s
    return out


def _write_stamps(conn: sqlite3.Connection, st: dict[str, str | None], kind: str = KIND) -> None:
    set_setting(conn, _STAMP_KEY[kind], json.dumps({v: st.get(v) for v in VARIANTS}, separators=(",", ":")))


def _stored(conn: sqlite3.Connection, key: str, allowed: tuple[str, ...] | None = None) -> str:
    raw = get_setting(conn, key, DEFAULTS[key])
    if allowed is not None and raw not in allowed:
        return DEFAULTS[key]  # a corrupt stored value reads as the default
    return raw if isinstance(raw, str) else DEFAULTS[key]


def meta(conn: sqlite3.Connection, kind: str = KIND) -> dict[str, Any]:
    """The facts of the stored logos that the Settings card shows (mime, size, who and when) - never the bytes."""
    rows = conn.execute("SELECT variant, stamp, mime, width, height, length(data_b64) AS n, uploaded_by, uploaded_at FROM brand_assets WHERE kind = ?", (kind,)).fetchall()
    out: dict[str, Any] = {v: None for v in VARIANTS}
    for r in rows:
        out[r["variant"]] = {"stamp": r["stamp"], "mime": r["mime"], "width": r["width"], "height": r["height"], "bytes": (r["n"] or 0) * 3 // 4,
                             "uploaded_by": r["uploaded_by"], "uploaded_at": r["uploaded_at"]}
    return out


def logo_files(conn: sqlite3.Connection, kind: str = KIND) -> dict[str, str | None]:
    """The stamped file name of each stored logo (`<stamp>.png` / `<stamp>.svg`): what a consumer appends to
    `brand/company-logo/<variant>/` - the extension says the type without a second request."""
    st = stamps(conn, kind)
    out: dict[str, str | None] = {v: None for v in VARIANTS}
    try:
        rows = conn.execute("SELECT variant, stamp, mime FROM brand_assets WHERE kind = ?", (kind,)).fetchall()
    except sqlite3.Error:
        return out
    for r in rows:
        if st.get(r["variant"]) == r["stamp"]:
            out[r["variant"]] = f"{r['stamp']}.{'svg' if r['mime'] == 'image/svg+xml' else 'png'}"
    return out


def public_view(conn: sqlite3.Connection) -> dict[str, Any]:
    """What the sign-in page may know without a session: the company's name, the two logo stamps (and their file names) and the
    two look choices that decide how the logos are drawn."""
    st = stamps(conn)
    from . import white_label  # WHITELABEL097-295: the installer profile, only while its master switch is on

    return {"company": {"name": _stored(conn, K_NAME), "logo": st, "logo_file": logo_files(conn)}, "size": _stored(conn, K_SIZE, SIZES),
            "dark_mode": _stored(conn, K_DARK, DARK_MODES), "installer": white_label.public_view(conn)}


def full_view(conn: sqlite3.Connection) -> dict[str, Any]:
    from . import white_label  # WHITELABEL097-295

    st = stamps(conn)
    return {
        "installer": white_label.public_view(conn),
        "company": {"name": _stored(conn, K_NAME), "kind": _stored(conn, K_KIND, COMPANY_KINDS), "logo": st, "logo_file": logo_files(conn)},
        "size": _stored(conn, K_SIZE, SIZES),
        "logo_side": _stored(conn, K_SIDE, SIDES),
        "company_logo_size": _stored(conn, K_CSIZE, COMPANY_SIZES),
        "dark_mode": _stored(conn, K_DARK, DARK_MODES),
        "title": {"prefix": _stored(conn, K_PREFIX) or DEFAULTS[K_PREFIX], "mode": _stored(conn, K_MODE, TITLE_MODES)},
        "project": {"name": _stored(conn, K_PROJECT)},
    }


# ---------------------------------------------------------------- storage

def put(conn: sqlite3.Connection, variant: str, norm: Normalised, actor: str | None, kind: str = KIND) -> str:
    stamp = stamp_of(norm.data)
    conn.execute(
        "INSERT INTO brand_assets(kind, variant, stamp, mime, width, height, data_b64, uploaded_by, uploaded_at) VALUES(?,?,?,?,?,?,?,?,?) "
        "ON CONFLICT(kind, variant) DO UPDATE SET stamp = excluded.stamp, mime = excluded.mime, width = excluded.width, height = excluded.height, "
        "data_b64 = excluded.data_b64, uploaded_by = excluded.uploaded_by, uploaded_at = excluded.uploaded_at",
        (kind, variant, stamp, norm.mime, norm.width, norm.height, base64.b64encode(norm.data).decode("ascii"), actor, now_iso()),
    )
    st = stamps(conn, kind)
    st[variant] = stamp
    _write_stamps(conn, st, kind)
    return stamp


def remove(conn: sqlite3.Connection, variant: str, kind: str = KIND) -> bool:
    gone = conn.execute("DELETE FROM brand_assets WHERE kind = ? AND variant = ?", (kind, variant)).rowcount > 0
    st = stamps(conn, kind)
    st[variant] = None
    _write_stamps(conn, st, kind)
    return gone


def read(conn: sqlite3.Connection, variant: str, stamp: str | None = None, kind: str = KIND) -> tuple[str, bytes, str] | None:
    """(mime, bytes, stamp) of a stored logo, or None. With `stamp` the stored one must be that exact stamp; the stored bytes must
    hash to their stamp (a damaged or hand-edited row is never served). This is the one reader every surface uses (the API, the
    public listener route, the notice-board display)."""
    if variant not in VARIANTS:
        return None
    row = conn.execute("SELECT stamp, mime, data_b64 FROM brand_assets WHERE kind = ? AND variant = ?", (kind, variant)).fetchone()
    if row is None or (stamp is not None and row["stamp"] != stamp):
        return None
    try:
        data = base64.b64decode(row["data_b64"], validate=True)
    except ValueError:
        return None
    if stamp_of(data) != row["stamp"] or row["mime"] not in ("image/png", "image/svg+xml"):
        return None
    return row["mime"], data, row["stamp"]


def company_name(conn: sqlite3.Connection) -> str:
    """The company's name as text, for the surfaces that carry no image (the e-mail header line, CR-LOGOS295 P6): '' when none is set."""
    return _stored(conn, K_NAME)


def project_name(conn: sqlite3.Connection) -> str:
    """The project's name (הגדרות › כללי › מראה המערכת › שם הפרויקט) as text: '' when none is set (NOTICEADD-295: the TV boards' title)."""
    return _stored(conn, K_PROJECT).strip()
