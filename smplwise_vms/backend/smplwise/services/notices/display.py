"""CR-NOTICE106 section 4.1 / 8.3 - the TV display: the feed of one board and the rules of its tokenised, login-free routes.

One board = one long random revocable token (`secrets.token_urlsafe(32)`); only its SHA-256 is stored and the comparison is
constant-time. The token travels in the URL FRAGMENT of the TV link (`/b/<slug>#t=<token>`, never sent to a server, a log or a
referrer); the page sends it back in the `X-Board-Token` header. The feed carries only what a public lobby screen may show:
the active notices tagged to that board (the notice's audience does not apply to a TV), the board's display settings, the
building's name, and the optional weather / news / sun blocks - no author, no audience, no place ids, no counters, no user data.

Every miss (unknown slug, wrong / revoked token, disabled board, module off) is the same 404 after a constant-time compare and
counts against the caller's network (20 misses in 10 minutes -> 429). The routes are read-only, `no-store`, `noindex`, with a
strict self-only CSP. Shared by the main application's routes (Ingress preview, the remote channel when allowed) and the
optional LAN listener (listener.py), so both answer exactly alike."""
from __future__ import annotations

import datetime as dt
import hashlib
import hmac
import json
import re
import sqlite3
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

from .. import brand_assets
from ..ha_user_auth import RateLimiter
from ..transit import digest as transit_digest
from . import audience as aud
from . import info, model, news_sources, slides, sources, store

SLUG_PATH = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$")
TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]{20,128}$")
ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")
DUMMY_HASH = hashlib.sha256(b"notice-board-dummy").hexdigest()
PER_TOKEN = [(5.0, 10), (60.0, 120)]  # 2/s with a burst of 10
PER_NETWORK = [(5.0, 50)]  # 10/s
MISSES = [(600.0, 20)]  # 20 wrong / unknown per 10 minutes, then 429
LIMITER = RateLimiter()

# the page's own CSP: scripts, styles and fonts of the add-on only; the Heebo files and the ambient grain are data: URIs in the CSS;
# a company logo is an image of the same origin. No frames, no form, no connections out of the origin.
CSP = ("default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self'; "
       "base-uri 'self'; form-action 'none'; frame-ancestors 'self'")
BASE_HEADERS: list[tuple[str, str]] = [
    ("Cache-Control", "no-store"), ("X-Robots-Tag", "noindex, nofollow"), ("Referrer-Policy", "no-referrer"),
    ("X-Content-Type-Options", "nosniff"), ("Content-Security-Policy", CSP), ("Cross-Origin-Resource-Policy", "same-origin"),
    ("Permissions-Policy", "camera=(), microphone=(), geolocation=()"),
]


@dataclass
class Reply:
    status: int
    body: bytes = b""
    content_type: str = "application/json; charset=utf-8"
    headers: list[tuple[str, str]] = field(default_factory=list)

    def all_headers(self) -> list[tuple[str, str]]:
        own = {k.lower() for k, _ in self.headers}
        return [("Content-Type", self.content_type), *(h for h in BASE_HEADERS if h[0].lower() not in own), *self.headers]


def _json(status: int, doc: dict[str, Any], extra: list[tuple[str, str]] | None = None) -> Reply:
    return Reply(status, json.dumps(doc, ensure_ascii=False, separators=(",", ":")).encode("utf-8"), headers=extra or [])


GONE = {"code": "not_found", "user_message": "הלוח אינו פעיל."}


def not_found() -> Reply:
    return _json(404, GONE)


def too_many() -> Reply:
    return _json(429, {"code": "rate_limited", "user_message": "יותר מדי בקשות."}, [("Retry-After", "60")])


def building_name(conn: sqlite3.Connection) -> str:
    """The name the TV boards greet with (the welcome title, the template-3 header, the empty stage's line, the footer): the explicit
    `notices.building_name` (הגדרות › לוח הודעות › ברירות מחדל) first, then the project name of הגדרות › כללי › מראה המערכת
    (`brand.project.name`, NOTICEADD-295: 2.16.0 skipped it and fell through to the first site building's name), then the first
    building, then the home title."""
    s = store.settings(conn)
    if s["building_name"]:
        return s["building_name"]
    return fallback_name(conn)


def fallback_name(conn: sqlite3.Connection) -> str:
    """The name the boards use while `notices.building_name` is empty (the Settings field shows it as its placeholder)."""
    project = brand_assets.project_name(conn)
    if project:
        return project[:60]
    row = conn.execute("SELECT name FROM buildings WHERE deleted_at IS NULL ORDER BY sort_order, created_at LIMIT 1").fetchone()
    if row and row["name"]:
        return str(row["name"])[:60]
    from ...db import get_setting

    return (get_setting(conn, "home.title", "") or "")[:60]


def _stamp(value: str | None) -> int:
    t = model.parse_iso(value)
    return int(t.timestamp()) if t else 0


def active_items(conn: sqlite3.Connection, board_id: str, now: dt.datetime) -> list[dict[str, Any]]:
    rows = [n for n in store.board_notices(conn, board_id) if model.effective_state(n, now) == "active"]
    rows.sort(key=store.sort_key)
    return rows


def feed_notice(n: dict[str, Any]) -> dict[str, Any]:
    """The public fields of one notice - nothing about who wrote it or who it is for."""
    out = {"id": n["id"], "title": n["title"], "body": n["body"], "severity": n["severity"], "starts_at": n["starts_at"],
           "ends_at": n["ends_at"], "pinned": bool(n["pinned"]), "published_at": n.get("published_at")}
    if n.get("dwell_s"):
        out["dwell_s"] = int(n["dwell_s"])
    if n.get("when_text"):
        out["when"] = n["when_text"]
    return out


def has_company_logo(data_dir: Path | None) -> bool:
    return bool(data_dir) and (Path(data_dir) / "notices" / "company-logo.png").is_file()  # type: ignore[arg-type]


def company_logos(conn: sqlite3.Connection, data_dir: Path | None, slug: str, *, logo_base: str, public: bool) -> tuple[dict[str, str], dict[str, Any]]:
    """The company logo of a board (CR-LOGOS295 section 5.6 / 3 P7): the installation's `brand_assets` logo - the light file in
    `logos.company`, the dark file (when one exists) in `logos.company_dark` - plus the choices that decide how the TV draws it
    (`brand`: size scale, dark-background mode, the company name for the alt text). Without a brand logo the board keeps the older
    notices-only logo (`<data>/notices/company-logo.png`, light only). `public` = the URLs go through the board token route
    (the TV); otherwise (the Settings preview) through the signed-in stamped route."""
    files = brand_assets.logo_files(conn)
    logos: dict[str, str] = {}
    if files["light"] or files["dark"]:
        view = brand_assets.public_view(conn)
        for variant, key in (("light", "company"), ("dark", "company_dark")):
            name = files[variant]
            if not name:
                continue
            stamp = name.split(".")[0]
            logos[key] = (f"{logo_base}api/v1/notices/display/{slug}/logo/company?variant={variant}&v={stamp}" if public
                          else f"api/v1/brand/company-logo/{variant}/{name}")
        brand: dict[str, Any] = {"size": view["size"], "dark_mode": view["dark_mode"], "name": view["company"]["name"]}
        csize = brand_assets.full_view(conn)["company_logo_size"]
        if csize != "same":
            brand["company_size"] = csize  # LOGOSIDE-295: the company logo's own scale (absent = it follows `size`)
        return logos, brand
    if has_company_logo(data_dir):
        logos["company"] = f"{logo_base}api/v1/notices/display/{slug}/logo/company" if public else "api/v1/notices/settings/logo"
        return logos, {"size": "m", "dark_mode": "plate", "name": ""}
    return logos, {}


def build_feed(conn: sqlite3.Connection, board: dict[str, Any], now: dt.datetime, *, data_dir: Path | None = None,
               display: dict[str, Any] | None = None, news: sources.NewsCache | None = None, logo_base: str = "", public: bool = True) -> dict[str, Any]:
    disp = display if display is not None else model.load_display(board["display_json"])
    # TVOPT-295: the four TV options the board did not choose itself follow the installation defaults
    disp = model.effective_display(disp, store.settings(conn)["tv_defaults"])
    items = active_items(conn, board["id"], now)
    ids = {n["id"] for n in items}
    if disp.get("hold") and disp["hold"] not in ids:
        disp = {**disp, "hold": ""}  # a hold never outlives the notice (section 8.6)
    tz = sources.installation_tz(conn)
    stamps = [_stamp(board.get("updated_at"))] + [_stamp(n.get("updated_at")) for n in items]
    # the next instant the feed changes by itself (a scheduled notice starts, an active one ends) is part of the version
    for n in store.board_notices(conn, board["id"]):
        for key in ("starts_at", "ends_at"):
            t = model.parse_iso(n.get(key))
            if t and t <= now:
                stamps.append(int(t.timestamp()))
    s = store.settings(conn)
    doc: dict[str, Any] = {
        "board": {"name": board["name"], "slug": board["slug"], "display": disp, "building": building_name(conn), "tz": str(tz.key),
                  "logos": {}},
        "now": model.iso(now),
        "notices": [feed_notice(n) for n in items],
    }
    if disp["blocks"].get("company_logo", True):
        logos, brand = company_logos(conn, data_dir, board["slug"], logo_base=logo_base, public=True)
        if logos:
            doc["board"]["logos"] = logos
            doc["board"]["brand"] = brand
    sun = sources.sun_block(conn, now)
    if sun:
        doc["sun"] = sun
    if disp["blocks"].get("weather") and s["weather_entity"]:
        w = sources.weather_block(conn, s["weather_entity"], disp["weather"]["hours"], disp["lang"], now, days=disp["weather_days"])
        if w:
            doc["weather"] = w
    # NOTICERSS-295: the board's feeds resolved against the editable source list (current name + logo, disabled skipped); a raw URL
    # that is not in the list stays out while custom feeds are switched off (the default), as before
    feeds = news_sources.resolve_board_feeds(conn, disp["news"]["feeds"], allow_custom=s["news_custom"], slug=board["slug"], logo_base=logo_base, public=public)
    if disp["blocks"].get("news") and feeds:
        doc["news"] = sources.news_block(feeds, news)
    chips = info.build(conn, (disp["blocks"].get("info") or []) if disp["blocks"].get("info_show", True) else [], disp["lang"])
    if chips:
        doc["info"] = chips
    # NOTICESLIDES-295: the promo slides (only while the board's `promo` block is on) and the building photo of template 2
    cards, photo = slides.feed_block(conn, board, public=public, logo_base=logo_base)
    if disp["blocks"].get("promo") and cards:
        doc["slides"] = cards
    if photo and disp.get("template") == 2:
        doc["board"]["display"] = {**disp, "photo": photo}
    stamps.append(_stamp(slides.newest_stamp(conn, board["id"])))
    try:
        ctl = json.loads(board.get("control_json") or "{}")
    except ValueError:
        ctl = {}
    if ctl.get("cmd") and (model.parse_iso(ctl.get("until")) or now) > now:
        doc["control"] = {"seq": int(ctl.get("seq") or 0), "cmd": ctl["cmd"]}
    # ANNOUNCEB-295: a voice announcement addressed to this board (stage B) is drawn over the page; the board asks faster while it is an announcement screen
    from .. import announce_screens

    ann = announce_screens.active_for(conn, f"board:{board['id']}", now)
    if announce_screens.feature_on(conn) and any(t["key"] == f"board:{board['id']}" for t in announce_screens.config(conn)["targets"]):
        doc["board"]["announce_poll_s"] = announce_screens.config(conn)["poll_s"]
    if ann:
        doc["announcement"] = {"id": ann["id"], "critical": ann["critical"], "until": ann["until"], "texts": ann["texts"]}
        stamps.append(_stamp(ann["at"]))
    payload = json.dumps({k: v for k, v in doc.items() if k != "now"}, ensure_ascii=False, sort_keys=True)
    doc["board"]["version"] = int(hashlib.sha256(f"{max(stamps)}|{payload}".encode()).hexdigest()[:12], 16)
    return doc


@dataclass
class Request:
    slug: str
    token: str | None
    if_none_match: str | None = None
    client: str = ""
    remote: bool = False
    variant: str = "light"  # the company logo file asked for (light | dark)


class DisplayService:
    """The token check, the limits and the feed for one request. `open_conn` yields a read connection; `data_dir` holds the
    company logo; `clock` returns an aware UTC instant (tests)."""

    def __init__(self, open_conn: Callable[[], Any], data_dir: Path | None, *, clock: Callable[[], dt.datetime] = store.utcnow,
                 limiter: RateLimiter | None = None, news: sources.NewsCache | None = None, touch: Callable[[str], None] | None = None) -> None:
        self.open_conn = open_conn
        self.data_dir = Path(data_dir) if data_dir else None
        self.clock = clock
        self.limiter = limiter or LIMITER
        self.news = news
        self.touch = touch

    def _miss(self, client: str) -> Reply:
        if not self.limiter.hit(f"nb-miss:{client}", MISSES):
            return too_many()
        return not_found()

    def resolve(self, conn: sqlite3.Connection, req: Request) -> tuple[dict[str, Any] | None, Reply | None]:
        """The board this request may read, or the uniform refusal."""
        client = req.client or "-"
        if not self.limiter.hit(f"nb-net:{client}", PER_NETWORK):
            return None, too_many()
        board = store.board_by_slug(conn, req.slug) if SLUG_PATH.match(req.slug or "") else None
        token = req.token if req.token and TOKEN_RE.match(req.token) else ""
        given = hashlib.sha256(token.encode()).hexdigest() if token else ""
        expected = (board or {}).get("token_hash") or DUMMY_HASH
        ok = bool(token) and hmac.compare_digest(given or DUMMY_HASH + "x", expected) and board is not None and bool(board.get("token_hash"))
        if not ok or not store.module_on(conn) or not board.get("enabled"):
            return None, self._miss(client)
        if req.remote and not store.settings(conn)["boards_remote"]:
            return None, self._miss(client)
        if not self.limiter.hit(f"nb-tok:{board['token_hash'][:16]}", PER_TOKEN):
            return None, too_many()
        return board, None

    def feed(self, req: Request) -> Reply:
        with self.open_conn() as conn:
            board, refusal = self.resolve(conn, req)
            if refusal is not None:
                return refusal
            assert board is not None
            doc = build_feed(conn, board, self.clock(), data_dir=self.data_dir, news=self.news)
        if self.touch:
            try:
                self.touch(board["id"])
            except Exception:  # noqa: BLE001 - last_seen_at is best effort; never fails a feed read
                pass
        etag = f'"{doc["board"]["version"]}"'
        if req.if_none_match and req.if_none_match.strip() == etag:
            return Reply(304, b"", headers=[("ETag", etag)])
        return _json(200, doc, [("ETag", etag)])

    def image(self, req: Request, kind: str, slide_id: str | None = None) -> Reply:
        """A slide picture / the building photo of the board the token belongs to (NOTICESLIDES-295); the stamp in `?v=` is the cache key."""
        with self.open_conn() as conn:
            board, refusal = self.resolve(conn, req)
            if refusal is not None:
                return refusal
            assert board is not None
            if slide_id is not None and not ID_RE.match(slide_id):
                return not_found()
            got = slides.image_of(conn, board["id"], slide_id, kind)
        if got is None:
            return not_found()
        mime, data, stamp = got
        return Reply(200, data, mime, headers=[("Cache-Control", "private, max-age=3600"), ("ETag", f'"{stamp}"')])

    def news_logo(self, req: Request, source_id: str) -> Reply:
        """NOTICERSS-295: a news source's logo, through the board token like the company logo (never an external address)."""
        with self.open_conn() as conn:
            board, refusal = self.resolve(conn, req)
            if refusal is not None:
                return refusal
            got = news_sources.read_logo(conn, source_id)
        if got is None:
            return not_found()
        mime, data, stamp = got
        return Reply(200, data, mime, headers=[("Cache-Control", "private, max-age=3600"), ("ETag", f'"{stamp}"')])

    def transit(self, req: Request) -> Reply:
        """BUSTIMES-295: the bus-times digest of the board the token belongs to - a digest of OUR cache (state, age, rows), read-only, no third-party
        call on this path. A board that does not show transit gets `{"state": "off"}`."""
        with self.open_conn() as conn:
            board, refusal = self.resolve(conn, req)
            if refusal is not None:
                return refusal
            assert board is not None
            doc = preview_transit(conn, board, None, self.clock())
        return _json(200, doc)

    def logo(self, req: Request) -> Reply:
        with self.open_conn() as conn:
            board, refusal = self.resolve(conn, req)
            if refusal is not None:
                return refusal
            variant = req.variant if req.variant in brand_assets.VARIANTS else "light"
            got = brand_assets.read(conn, variant)
        if got is not None:  # CR-LOGOS295: the installation's company logo, through the board token; the stamp in `?v=` is the cache key
            mime, data, stamp = got
            return Reply(200, data, mime, headers=[("Cache-Control", "private, max-age=3600"), ("ETag", f'"{stamp}"')])
        path = self.data_dir / "notices" / "company-logo.png" if self.data_dir else None
        if variant != "light" or not path or not path.is_file():
            return not_found()
        r = Reply(200, path.read_bytes(), "image/png")
        return r


def touch_seen(db: Any) -> Callable[[str], None]:
    """`last_seen_at` of a board: a timestamp only (no address, no agent), written at most once a minute per board."""
    last: dict[str, float] = {}

    def run(board_id: str) -> None:
        import time

        now = time.time()
        if now - last.get(board_id, 0) < 60:
            return
        last[board_id] = now
        with db.connection(label="notices.board.seen") as conn:
            conn.execute("UPDATE notice_boards SET last_seen_at = ? WHERE id = ?", (model.iso(store.utcnow()), board_id))

    return run


def preview_feed(conn: sqlite3.Connection, board: dict[str, Any], display: dict[str, Any] | None, data_dir: Path | None, now: dt.datetime | None = None) -> dict[str, Any]:
    """The Settings preview: the same payload the TV gets, through the session, optionally with the draft display settings."""
    doc = build_feed(conn, board, now or store.utcnow(), data_dir=data_dir, display=display, logo_base="", public=False)
    doc["board"]["logos"] = {}
    doc["board"].pop("brand", None)
    if doc["board"]["display"]["blocks"].get("company_logo", True):
        logos, brand = company_logos(conn, data_dir, board["slug"], logo_base="", public=False)
        if logos:
            doc["board"]["logos"] = logos
            doc["board"]["brand"] = brand
    return doc


def preview_transit(conn: sqlite3.Connection, board: dict[str, Any], display: dict[str, Any] | None, now: dt.datetime) -> dict[str, Any]:
    """The digest for a board's own settings, or (the Settings preview) for a draft `display`."""
    disp = display if display is not None else model.load_display(board["display_json"])
    return transit_digest.build(conn, disp.get("transit") or {}, now, sources.installation_tz(conn))


def audience_of(n: dict[str, Any]) -> dict[str, Any]:
    return aud.parse(n.get("audience_json"))
