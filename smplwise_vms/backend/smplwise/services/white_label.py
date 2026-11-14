"""WHITELABEL097-295 (board row r097): the installer company's brand profile and the exportable customer pack.

An installer (the company that installs and supports the system for a customer) may show its own identity next to the product's:
a name, a light / dark logo, an accent chosen from the EXISTING presets (services/brand_colors.py - never a free colour) and a
one-line contact text. It is an ADDITION to the SmplWise branding, never a replacement (CR-LOGOS295 section 8): the SmplWise mark and
wordmark, the PWA name and icons, the "הופק ב-SmplWise Arx" PDF line and the sign-in card's SmplWise logo have no switch. The master
switch `brand.wl.enabled` is OFF by default; while it is off nothing of the profile leaves the Settings screen (the public view and
`/me.brand` carry `{"enabled": false}` only, the stamped public logo route answers 404).

Storage: `brand.wl.*` settings rows (carried by the project backup like every setting) and the installer logos as kind `installer`
in `brand_assets` (migration 0167), written through the same content-validating normaliser as the company logo
(PNG / JPEG / WebP re-encoded, SVG rebuilt by services/svg_sanitize.py).

The customer pack is one zip: `brand-profile.json`, `logos/light.(png|svg)`, `logos/dark.(png|svg)` and `README_HE.txt`. An import is
judged before anything is written: at most MAX_PACK_BYTES, an exact allowlist of entry names (no paths, no extra files), bounded
reads (a zip bomb is cut at the declared limit), a schema marker and version, every field through the same validators as the
Settings form, every logo through the upload normaliser and checked against the SHA-256 in the profile. The import replaces the
profile and the logos; it never changes the master switch."""
from __future__ import annotations

import hashlib
import io
import json
import sqlite3
import zipfile
from typing import Any

from ..db import get_setting, set_setting
from ..errors import ApiError
from . import brand_assets as ba
from . import brand_colors

KIND = ba.INSTALLER_KIND
K_ENABLED = "brand.wl.enabled"
K_NAME = "brand.wl.name"
K_CONTACT = "brand.wl.contact"
K_ACCENT = "brand.wl.accent"
NAME_MAX = 60
CONTACT_MAX = 120
DEFAULTS = {K_ENABLED: "0", K_NAME: "", K_CONTACT: "", K_ACCENT: brand_colors.DEFAULT}
KEYS = tuple(DEFAULTS)

SCHEMA = "smplwise.brand-pack"
SCHEMA_VERSION = 1
PROFILE_NAME = "brand-profile.json"
README_NAME = "README_HE.txt"
MAX_PACK_BYTES = 5 * 1024 * 1024
MAX_TEXT_BYTES = 32 * 1024
PACK_FILENAME = "smplwise-brand-pack.zip"

README_HE = """חבילת מותג ללקוח - SmplWise Arx
=================================

מה בתוך הקובץ
- brand-profile.json: שם המתקין, שורת יצירת קשר וצבע ההדגשה (שם של צבע מוכן במערכת, לא קוד חופשי).
- logos/: הלוגו של המתקין לרקע בהיר (light) ולרקע כהה (dark), אם הוגדרו.

איך מייבאים בהתקנה אחרת
1. נכנסים להגדרות > כללי > מראה המערכת > מיתוג מתקין.
2. בוחרים "ייבוא חבילה" ומעלים את הקובץ.
3. בודקים את התצוגה המקדימה ומדליקים את המתג "הצג את מיתוג המתקין".

חשוב לדעת
- ייבוא החבילה לא מדליק את המיתוג. המתג נשאר כבוי עד שמנהל המערכת מדליק אותו.
- המיתוג מתווסף לצד המיתוג של SmplWise Arx ואינו מחליף אותו.
- אין בקובץ סיסמאות, מפתחות או כתובות של המערכת.
"""


def _err(status: int, code: str, message: str, **details: Any) -> ApiError:
    return ApiError(status, code, message, details=details or None)


# ---------------------------------------------------------------- settings

def normalise_field(key: str, value: Any) -> str:
    """The canonical stored text of a profile field; ValueError when it is not acceptable."""
    if key == K_ENABLED:
        if value in (True, "1", 1):
            return "1"
        if value in (False, "0", 0):
            return "0"
        raise ValueError("enabled")
    if key == K_NAME:
        return ba._text(value, NAME_MAX)  # noqa: SLF001 - the one text rule of the brand module
    if key == K_CONTACT:
        return ba._text(value, CONTACT_MAX)  # noqa: SLF001
    if key == K_ACCENT:
        if value == brand_colors.DEFAULT or (isinstance(value, str) and value in brand_colors.PRESETS):
            return str(value)
        raise ValueError("accent")  # a preset id only: no free colour in a white-label profile
    raise ValueError("key")


def _stored(conn: sqlite3.Connection, key: str) -> str:
    raw = get_setting(conn, key, DEFAULTS[key])
    return raw if isinstance(raw, str) else DEFAULTS[key]


def enabled(conn: sqlite3.Connection) -> bool:
    return _stored(conn, K_ENABLED) == "1"


def profile(conn: sqlite3.Connection) -> dict[str, Any]:
    accent = _stored(conn, K_ACCENT)
    if accent != brand_colors.DEFAULT and accent not in brand_colors.PRESETS:
        accent = brand_colors.DEFAULT  # a corrupt stored value reads as the default
    return {"enabled": enabled(conn), "name": _stored(conn, K_NAME), "contact": _stored(conn, K_CONTACT), "accent": accent,
            "logo": ba.stamps(conn, KIND), "logo_file": ba.logo_files(conn, KIND)}


def public_view(conn: sqlite3.Connection) -> dict[str, Any]:
    """What the sign-in page and `/me.brand` carry: nothing but the switch while it is off."""
    p = profile(conn)
    return p if p["enabled"] else {"enabled": False}


def full_view(conn: sqlite3.Connection) -> dict[str, Any]:
    return {**profile(conn), "files": ba.meta(conn, KIND)}


def email_line(conn: sqlite3.Connection) -> tuple[str, str] | None:
    """(name, contact) for a mail or PDF header / footer, or None while the profile is off or has no name. Never raises."""
    try:
        if not enabled(conn):
            return None
        name = _stored(conn, K_NAME)
        return (name, _stored(conn, K_CONTACT)) if name else None
    except Exception:  # noqa: BLE001 - a header decoration never blocks a notification or a report
        return None


# ---------------------------------------------------------------- the customer pack

def build_pack(conn: sqlite3.Connection) -> bytes:
    """The zip of the current profile (name, contact, accent) and its logos. The master switch is not part of it."""
    logos: dict[str, Any] = {}
    files: dict[str, bytes] = {}
    for variant in ba.VARIANTS:
        got = ba.read(conn, variant, kind=KIND)
        if got is None:
            continue
        mime, data, _stamp = got
        path = f"logos/{variant}.{'svg' if mime == 'image/svg+xml' else 'png'}"
        files[path] = data
        logos[variant] = {"file": path, "mime": mime, "sha256": hashlib.sha256(data).hexdigest()}
    p = profile(conn)
    doc = {"schema": SCHEMA, "version": SCHEMA_VERSION, "name": p["name"], "contact": p["contact"], "accent": p["accent"], "logos": logos}
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as z:
        for name, data in (
            (PROFILE_NAME, json.dumps(doc, ensure_ascii=False, indent=2, sort_keys=True).encode("utf-8")),
            (README_NAME, README_HE.encode("utf-8")),
            *sorted(files.items()),
        ):
            zi = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))  # fixed time: the same profile is the same bytes
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.external_attr = 0o644 << 16
            z.writestr(zi, data)
    return buf.getvalue()


class Pack:
    def __init__(self, name: str, contact: str, accent: str, logos: dict[str, ba.Normalised]) -> None:
        self.name, self.contact, self.accent, self.logos = name, contact, accent, logos


def _bad(reason: str, **details: Any) -> ApiError:
    return _err(422, "brand_pack_invalid", "חבילת המותג אינה תקינה", reason=reason, **details)


def _read_entry(z: zipfile.ZipFile, info: zipfile.ZipInfo, limit: int) -> bytes:
    if info.file_size > limit:
        raise _bad("entry_too_large", entry=info.filename)
    with z.open(info) as fh:
        data = fh.read(limit + 1)  # bounded: a lying header cannot expand past the limit
    if len(data) > limit:
        raise _bad("entry_too_large", entry=info.filename)
    return data


def parse_pack(data: bytes) -> Pack:
    """Validate a customer pack completely and return what it would apply; ApiError (413 / 422) otherwise. Writes nothing."""
    if len(data) > MAX_PACK_BYTES:
        raise _err(413, "payload_too_large", "הקובץ גדול מדי", max_bytes=MAX_PACK_BYTES)
    try:
        z = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile as exc:
        raise _bad("not_a_zip") from exc
    with z:
        infos = z.infolist()
        names = [i.filename for i in infos]
        allowed = {PROFILE_NAME, README_NAME} | {f"logos/{v}.{e}" for v in ba.VARIANTS for e in ("png", "svg")}
        if len(names) != len(set(names)) or len(names) > len(allowed):
            raise _bad("entries")
        for i in infos:
            if i.filename not in allowed or i.is_dir() or (i.flag_bits & 0x1):
                raise _bad("unexpected_entry", entry=i.filename[:60])
        by = {i.filename: i for i in infos}
        if PROFILE_NAME not in by:
            raise _bad("no_profile")
        if README_NAME in by:
            _read_entry(z, by[README_NAME], MAX_TEXT_BYTES)  # never used, but a bounded read proves it is not a bomb
        try:
            doc = json.loads(_read_entry(z, by[PROFILE_NAME], MAX_TEXT_BYTES).decode("utf-8"))
        except ApiError:
            raise
        except (ValueError, UnicodeDecodeError) as exc:
            raise _bad("profile_json") from exc
        if not isinstance(doc, dict) or doc.get("schema") != SCHEMA:
            raise _bad("schema")
        if doc.get("version") != SCHEMA_VERSION:
            raise _bad("version", version=doc.get("version") if isinstance(doc.get("version"), int) else None)
        try:
            name = normalise_field(K_NAME, doc.get("name", ""))
            contact = normalise_field(K_CONTACT, doc.get("contact", ""))
            accent = normalise_field(K_ACCENT, doc.get("accent", brand_colors.DEFAULT))
        except ValueError as exc:
            raise _bad("field", field=str(exc)) from exc
        declared = doc.get("logos", {})
        if not isinstance(declared, dict) or set(declared) - set(ba.VARIANTS):
            raise _bad("logos")
        logos: dict[str, ba.Normalised] = {}
        for variant, spec in declared.items():
            if not isinstance(spec, dict):
                raise _bad("logos")
            path = spec.get("file")
            sha = spec.get("sha256")
            if path not in allowed or not str(path).startswith(f"logos/{variant}.") or path not in by:
                raise _bad("logo_file", variant=variant)
            raw = _read_entry(z, by[path], ba.MAX_BYTES)
            if not isinstance(sha, str) or hashlib.sha256(raw).hexdigest() != sha:
                raise _bad("logo_hash", variant=variant)
            logos[variant] = ba.normalise(raw)  # the same content guarantee as an upload (raises 413 / 415 / 422)
        stray = [n for n in names if n.startswith("logos/") and n not in {s.get("file") for s in declared.values() if isinstance(s, dict)}]
        if stray:
            raise _bad("undeclared_logo", entry=stray[0])
    return Pack(name, contact, accent, logos)


def apply_pack(conn: sqlite3.Connection, pack: Pack, actor: str | None) -> None:
    """Replace the profile and the logos with the pack's (a variant the pack does not carry is removed). The master switch is untouched."""
    set_setting(conn, K_NAME, pack.name)
    set_setting(conn, K_CONTACT, pack.contact)
    set_setting(conn, K_ACCENT, pack.accent)
    for variant in ba.VARIANTS:
        if variant in pack.logos:
            ba.put(conn, variant, pack.logos[variant], actor, kind=KIND)
        else:
            ba.remove(conn, variant, kind=KIND)
