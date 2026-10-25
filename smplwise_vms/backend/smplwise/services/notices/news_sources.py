"""NOTICERSS-295 - the installation's editable list of news (RSS) sources of the notice boards.

The list lives in the settings table (no migration): `notices.news_sources` holds a JSON array of
`{id, name, url, enabled, logo?: {mime, stamp}}` in display order, and each logo's bytes sit in `notices.news_logo.<id>` as base64 text
(the brand_assets / slides precedent: the sanitised bytes are data, no file path is ever trusted, a backup carries them).
The row is absent until the first save: a read then returns the built-in curated list (`model.CURATED_NEWS`), so an installation that
never edits anything behaves exactly as before.

A board stores its feeds as `{id?, name, url}`. At feed time a board feed is resolved against this list by id, then by URL: the list's
current name, URL and logo win and a disabled source is skipped. A board feed that matches nothing (a raw URL typed before this
list existed) is a "custom" entry: `listing()` shows it with the name the board stored so the manager can rename it, and saving the
list adopts it; its URL is never lost.

Logos pass the bill-logo pipeline (`sanitize_image`): PNG / JPEG by magic bytes, pixel ceiling, EXIF and every ancillary chunk
dropped by rebuilding the pixels, scaled to 256 px; SVG and anything else is refused."""
from __future__ import annotations

import base64
import hashlib
import json
import re
import secrets
import sqlite3
from typing import Any

from ...db import get_setting, set_setting
from ..bill_pdf_logo import LogoError, sanitize_image
from . import model
from .model import Invalid
from .sources import FetchRefused, check_feed_url

KEY = "notices.news_sources"
LOGO_KEY = "notices.news_logo."
SOURCES_MAX = 12
NAME_MAX = 40
URL_MAX = 400
LOGO_UPLOAD_BYTES = 300_000
LOGO_SIDE = 256
ID_RE = re.compile(r"^[a-z][a-z0-9-]{0,23}$")


def _static_check(url: str, field: str) -> str:
    """The feed fetcher's own URL rules (https only, port 443, no credentials, no local names, no private literal addresses) without
    the DNS step: a name is resolved - and every address checked - at fetch time, where it matters."""
    if not isinstance(url, str) or len(url) > URL_MAX:
        raise Invalid(field, "כתובת RSS: https בלבד.")
    try:
        check_feed_url(url.strip(), resolve=lambda _host: ["93.184.216.34"])
    except FetchRefused:
        raise Invalid(field, "כתובת RSS: https בלבד, ללא כתובת פנימית.") from None
    return url.strip()


def custom_id(url: str) -> str:
    """The stable id of a board's raw-URL feed: the same URL always gets the same id."""
    return "c" + hashlib.sha1(url.encode()).hexdigest()[:8]


def _seed() -> list[dict[str, Any]]:
    return [{"id": f["id"], "name": f["name"], "url": f["url"], "enabled": True} for f in model.CURATED_NEWS]


def _clean_stored(raw: Any) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for x in raw if isinstance(raw, list) else []:
        if not isinstance(x, dict) or not isinstance(x.get("id"), str) or not ID_RE.match(x["id"]) or x["id"] in seen:
            continue
        name, url = str(x.get("name") or "").strip()[:NAME_MAX], str(x.get("url") or "")
        if not name or not url.startswith("https://"):
            continue
        item: dict[str, Any] = {"id": x["id"], "name": name, "url": url, "enabled": x.get("enabled") is not False}
        logo = x.get("logo")
        if isinstance(logo, dict) and logo.get("mime") in ("image/png", "image/jpeg") and isinstance(logo.get("stamp"), str) and re.fullmatch(r"[0-9a-f]{6,16}", logo["stamp"]):
            item["logo"] = {"mime": logo["mime"], "stamp": logo["stamp"]}
        seen.add(x["id"])
        out.append(item)
    return out[:SOURCES_MAX]


def load(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    """The stored list, or the curated seed while nothing was ever saved. A stored (even empty) list always wins over the seed."""
    raw = get_setting(conn, KEY, None)
    if raw is None:
        return _seed()
    try:
        return _clean_stored(json.loads(raw))
    except ValueError:
        return _seed()


def _save(conn: sqlite3.Connection, items: list[dict[str, Any]]) -> None:
    set_setting(conn, KEY, json.dumps(items, ensure_ascii=False, separators=(",", ":")))


def _board_feeds(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for r in conn.execute("SELECT display_json FROM notice_boards WHERE deleted_at IS NULL").fetchall():
        out.extend(model.load_display(r["display_json"])["news"]["feeds"])
    return out


def orphans(conn: sqlite3.Connection, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """The raw-URL feeds the boards store that the list does not know, one entry per URL (the first stored name)."""
    known_urls = {s["url"] for s in items}
    known_ids = {s["id"] for s in items}
    out: list[dict[str, Any]] = []
    for f in _board_feeds(conn):
        if f["url"] in known_urls:
            continue
        cid = custom_id(f["url"])
        if cid in known_ids:
            continue
        known_urls.add(f["url"])
        known_ids.add(cid)
        out.append({"id": cid, "name": f["name"][:NAME_MAX], "url": f["url"], "enabled": True})
    return out


def logo_url(source: dict[str, Any]) -> str:
    return f"api/v1/notices/news-sources/{source['id']}/logo?v={source['logo']['stamp']}" if source.get("logo") else ""


def listing(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    """What the settings screen shows: the list in order, then the boards' unadopted raw URLs flagged `custom`."""
    items = load(conn)
    rows = [{"id": s["id"], "name": s["name"], "url": s["url"], "enabled": s["enabled"], "has_logo": bool(s.get("logo")), "logo_url": logo_url(s),
             "custom": False} for s in items]
    rows += [{**o, "has_logo": False, "logo_url": "", "custom": True} for o in orphans(conn, items)]
    return rows


# ---------------------------------------------------------------- writing

def replace(conn: sqlite3.Connection, raw: Any) -> list[dict[str, Any]]:
    """Validate and store the whole list (the order is the order sent). A source keeps its logo by id; a source that is gone loses it.
    A new source (no id) gets a fresh one. Raises Invalid."""
    if not isinstance(raw, list):
        raise Invalid("sources", "רשימה לא תקינה.")
    if len(raw) > SOURCES_MAX:
        raise Invalid("sources", f"עד {SOURCES_MAX} מקורות.")
    current = {s["id"]: s for s in load(conn)}
    out: list[dict[str, Any]] = []
    ids: set[str] = set()
    urls: set[str] = set()
    for i, x in enumerate(raw):
        f = f"sources[{i}]"
        if not isinstance(x, dict):
            raise Invalid(f, "ערך לא תקין.")
        name = model.clean_text(x.get("name"), f"{f}.name", NAME_MAX, required=True)
        url = _static_check(x.get("url"), f"{f}.url")
        enabled = x.get("enabled", True)
        if not isinstance(enabled, bool):
            raise Invalid(f"{f}.enabled", "ערך לא תקין.")
        sid = x.get("id")
        if sid in (None, ""):
            sid = "s" + secrets.token_hex(4)
            while sid in ids or sid in current:
                sid = "s" + secrets.token_hex(4)
        elif not isinstance(sid, str) or not ID_RE.match(sid):
            raise Invalid(f"{f}.id", "ערך לא תקין.")
        if sid in ids:
            raise Invalid(f"{f}.id", "מקור כפול.")
        if url in urls:
            raise Invalid(f"{f}.url", "כתובת כפולה.")
        ids.add(sid)
        urls.add(url)
        item: dict[str, Any] = {"id": sid, "name": name, "url": url, "enabled": enabled}
        if current.get(sid, {}).get("logo"):
            item["logo"] = current[sid]["logo"]
        out.append(item)
    for gone in set(current) - ids:
        if current[gone].get("logo"):
            conn.execute("DELETE FROM settings WHERE key = ?", (LOGO_KEY + gone,))
    _save(conn, out)
    return out


def _persist_seed(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    """Store the list as shown (the seed and the adopted raw URLs) so a logo can attach to a source that has no row yet."""
    items = load(conn)
    if get_setting(conn, KEY, None) is None:
        _save(conn, items)
    return items


def put_logo(conn: sqlite3.Connection, source_id: str, raw: bytes) -> dict[str, Any]:
    """Sanitise and store a source's logo. Raises KeyError for an unknown id, LogoError (a stable machine code) when refused."""
    items = _persist_seed(conn)
    adopted = {o["id"]: o for o in orphans(conn, items)}
    target = next((s for s in items if s["id"] == source_id), None)
    if target is None and source_id in adopted and len(items) < SOURCES_MAX:  # a raw-URL feed gets its logo = it is adopted into the list
        target = adopted[source_id]
        items.append(target)
    if target is None:
        raise KeyError(source_id)
    mime, data = sanitize_image(raw, max_bytes=LOGO_UPLOAD_BYTES, max_side=LOGO_SIDE)
    stamp = hashlib.sha256(data).hexdigest()[:12]
    set_setting(conn, LOGO_KEY + source_id, base64.b64encode(data).decode("ascii"))
    target["logo"] = {"mime": mime, "stamp": stamp}
    _save(conn, items)
    return target


def remove_logo(conn: sqlite3.Connection, source_id: str) -> bool:
    items = _persist_seed(conn)
    target = next((s for s in items if s["id"] == source_id), None)
    if target is None:
        raise KeyError(source_id)
    had = bool(target.pop("logo", None))
    conn.execute("DELETE FROM settings WHERE key = ?", (LOGO_KEY + source_id,))
    _save(conn, items)
    return had


def read_logo(conn: sqlite3.Connection, source_id: str) -> tuple[str, bytes, str] | None:
    """(mime, bytes, stamp) of a source's logo, or None."""
    if not ID_RE.match(source_id or ""):
        return None
    s = next((x for x in load(conn) if x["id"] == source_id), None)
    if s is None or not s.get("logo"):
        return None
    b64 = get_setting(conn, LOGO_KEY + source_id, None)
    if not b64:
        return None
    try:
        return s["logo"]["mime"], base64.b64decode(b64), s["logo"]["stamp"]
    except ValueError:
        return None


# ---------------------------------------------------------------- the feed and the board editor

def allowed_urls(conn: sqlite3.Connection) -> set[str]:
    """Every URL of the list (an editor-managed source is always allowed on a board, whatever `news_custom` says)."""
    return {s["url"] for s in load(conn)}


def resolve_board_feeds(conn: sqlite3.Connection, feeds: list[dict[str, str]], *, allow_custom: bool, slug: str = "", logo_base: str = "",
                        public: bool = True) -> list[dict[str, str]]:
    """The board's stored feeds as the fetcher needs them: `{name, url, logo?}` (`logo` = the URL the TV reads the picture from).
    The list's current name / URL / logo win; a disabled source is skipped; a raw-URL feed is kept only while custom feeds are on."""
    items = load(conn)
    by_id = {s["id"]: s for s in items}
    by_url = {s["url"]: s for s in items}
    out: list[dict[str, str]] = []
    seen: set[str] = set()
    for f in feeds:
        s = by_id.get(f.get("id") or "") or by_url.get(f["url"])
        if s is None:
            if not allow_custom:
                continue
            row = {"name": f["name"], "url": f["url"]}
        else:
            if not s["enabled"]:
                continue
            row = {"name": s["name"], "url": s["url"]}
            if s.get("logo"):
                row["logo"] = (f"{logo_base}api/v1/notices/display/{slug}/news-logo/{s['id']}?v={s['logo']['stamp']}" if public
                               else f"api/v1/notices/news-sources/{s['id']}/logo?v={s['logo']['stamp']}")
        if row["url"] in seen:
            continue
        seen.add(row["url"])
        out.append(row)
    return out
