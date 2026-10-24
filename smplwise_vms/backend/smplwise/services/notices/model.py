"""CR-NOTICE106 - the notice model: limits, the derived state (section 3.2), a board's display settings (section 8.4, 8.6, 8.7) and
the module settings (section 11). Pure functions: no database, no network."""
from __future__ import annotations

import datetime as dt
import json
import re
from typing import Any

SEVERITIES = ("info", "alert", "critical")
STATUSES = ("draft", "published", "archived")
STATES = ("draft", "scheduled", "active", "expired", "archived")
TITLE_MAX, BODY_MAX, WHEN_MAX = 120, 2000, 60
BOARD_NAME_MAX, SLUG_MAX, PLACE_MAX = 60, 40, 60
SLUG_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$")
HM_RE = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")
DWELL_MIN, DWELL_MAX = 3, 600
ROTATE_MIN, ROTATE_MAX = 6, 60
INFO_KINDS = ("elevators", "generator", "parking", "gym")
NEWS_SPEEDS = ("slow", "normal", "fast")
NEWS_FEEDS_MAX = 6
# NOTICESAVER-295: the TV's screen saver (OLED care) and where the two logos sit. Stored inside the board's display JSON (no migration);
# an old board without the keys reads the defaults (saver wash since NOTICEPERM-295, logos "a" = the v4 layout).
SAVERS = ("off", "wash", "cycle", "wave", "ambient")
LOGO_LAYOUTS = ("a", "b", "c")

PERM_VIEW, PERM_MANAGE, PERM_PUSH, PERM_BOARDS = "notices.view", "notices.manage", "notices.push", "notices.boards"

# Q12 (owner question, provisional until the owner names the list): the curated Israeli general-news RSS feeds the board settings offer.
CURATED_NEWS: list[dict[str, str]] = [
    {"id": "ynet", "name": "ynet", "url": "https://www.ynet.co.il/Integration/StoryRss2.xml"},
    {"id": "globes", "name": "גלובס", "url": "https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=2"},
    {"id": "calcalist", "name": "כלכליסט", "url": "https://www.calcalist.co.il/GeneralRSS/0,16335,L-8,00.xml"},
    {"id": "walla", "name": "וואלה", "url": "https://rss.walla.co.il/feed/1"},
]

# section 11: the module settings (settings table, `notices.*`). Strings like every other setting row.
SETTINGS_DEFAULTS: dict[str, str] = {
    "notices.enabled": "false",
    "notices.default_days": "7",
    "notices.default_severity": "info",
    "notices.push_default": "by_severity",
    "notices.reads_names": "true",
    "notices.retention_days": "365",
    "notices.home_empty": "hide",  # NOTICEPAGE-295: the home widget with no active notice: "hide" (absent) or "line" (one "no active notices" line)
    "notices.boards.remote": "false",
    "notices.boards.max": "10",
    "notices.weather_entity": "",
    "notices.weather_fallback": "false",
    "notices.news_custom": "false",  # NOTICEGB-295: custom feeds stay off until the owner turns them on; a stored value always wins
    "notices.building_name": "",
    # the origin the TV links point to: the LAN listener as the owner mapped it (e.g. http://<host>:18094) or the remote address;
    # empty = the address the manager uses (the Settings screen says so)
    "notices.boards.origin": "",
    # NOTICECAPS-295: the TV listener's hardening caps, read by the listener at every connection (no restart). 32 is the cap the
    # listener always had; 8 per address is the new per-client ceiling (a TV, or a few TVs behind one NAT).
    "notices.boards.conn_total": "32",
    "notices.boards.conn_per_address": "8",
}
CONN_TOTAL_RANGE = (4, 256)
CONN_PER_ADDRESS_RANGE = (1, 64)


class Invalid(ValueError):
    """A value the API refuses (422); `field` names the offending key."""

    def __init__(self, field: str, message: str) -> None:
        super().__init__(message)
        self.field = field


def parse_iso(value: str | None) -> dt.datetime | None:
    if not value:
        return None
    try:
        t = dt.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return t if t.tzinfo else t.replace(tzinfo=dt.timezone.utc)


def iso(t: dt.datetime) -> str:
    return t.astimezone(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def effective_state(row: dict[str, Any], now: dt.datetime) -> str:
    """Section 3.2: draft / scheduled / active / expired / archived, derived at read time (no worker)."""
    status = row.get("status")
    if status == "draft":
        return "draft"
    if status == "archived":
        return "archived"
    start = parse_iso(row.get("starts_at"))
    end = parse_iso(row.get("ends_at"))
    if start is not None and now < start:
        return "scheduled"
    if end is not None and end <= now:
        return "expired"
    return "active"


def clean_text(value: Any, field: str, limit: int, *, required: bool = False, multiline: bool = False) -> str:
    s = "" if value is None else str(value)
    s = s.replace("\r\n", "\n").replace("\r", "\n")
    bad = [c for c in s if (ord(c) < 32 and not (multiline and c in "\n\t")) or ord(c) == 127]
    if bad:
        raise Invalid(field, "טקסט רגיל בלבד.")
    s = s.strip() if not multiline else "\n".join(line.rstrip() for line in s.strip().split("\n"))
    if multiline:
        s = re.sub(r"\n{3,}", "\n\n", s)
    if required and not s:
        raise Invalid(field, "שדה חובה.")
    if len(s) > limit:
        raise Invalid(field, f"עד {limit} תווים.")
    return s


def clean_audience(raw: Any) -> dict[str, Any]:
    """Section 5: {"everyone": true} or any subset of floors / areas / groups / roles (OR-ed); {} = no users (TV only)."""
    if raw is None:
        return {}
    if not isinstance(raw, dict):
        raise Invalid("audience", "קהל היעד: ערך לא תקין.")
    if raw.get("everyone") is True:
        return {"everyone": True}
    out: dict[str, Any] = {}
    for key in ("floors", "areas", "groups", "roles"):
        vals = raw.get(key) or []
        if not isinstance(vals, list) or not all(isinstance(v, str) and 0 < len(v) <= 128 for v in vals) or len(vals) > 200:
            raise Invalid("audience", "קהל היעד: ערך לא תקין.")
        if vals:
            out[key] = sorted(set(vals))
    return out


# ---------------------------------------------------------------- a board's display settings (section 8.4, 8.6, 8.7)

DISPLAY_DEFAULTS: dict[str, Any] = {
    "template": 1, "lang": "he", "theme": "auto", "day_hours": "", "layout": "auto",
    "urgent": "stage", "mode": "rotation", "rotate_s": 12, "hold": "",
    "font_size": "s", "font_scale": 1.0, "place": "",
    "blocks": {"clock": True, "hebdate": True, "welcome": True, "weather": True, "info": list(INFO_KINDS), "info_show": True, "promo": False, "news": False, "company_logo": True},
    "weather": {"hours": 5},
    "news": {"feeds": [], "speed": "normal"},
    "night": {"enabled": True, "from": "23:00", "to": "06:00", "dim": 0.5},
    "burn_in": {"shift": True},
    "saver": "wash", "logos": "a",
}


def default_display() -> dict[str, Any]:
    return json.loads(json.dumps(DISPLAY_DEFAULTS))


def _choice(v: Any, allowed: tuple[Any, ...], default: Any) -> Any:
    return v if v in allowed else default


def _bool(v: Any, default: bool) -> bool:
    return v if isinstance(v, bool) else default


def _hm(v: Any, default: str) -> str:
    return v if isinstance(v, str) and HM_RE.match(v) else default


def _feed(raw: Any) -> dict[str, str] | None:
    if not isinstance(raw, dict):
        return None
    url = str(raw.get("url") or "").strip()
    name = str(raw.get("name") or "").strip()[:40]
    if not url.startswith("https://") or len(url) > 400 or any(c.isspace() or ord(c) < 33 for c in url) or "@" in url.split("/", 3)[2]:
        return None  # https only, and no credentials in the URL
    return {"name": name or url[8:40], "url": url}


def normalize_display(raw: Any, *, strict: bool = False) -> dict[str, Any]:
    """The stored / sent display settings with every key present and every value inside its range. `strict` (a PATCH from the API)
    refuses out-of-range values instead of replacing them by the default, so a manager learns why a save was refused."""
    src = raw if isinstance(raw, dict) else {}
    d = default_display()

    def take(key: str, ok: bool, value: Any) -> None:
        if key not in src:
            return
        if ok:
            d[key] = value
        elif strict:
            raise Invalid(f"display.{key}", "ערך לא תקין.")

    v = src.get("template")
    take("template", v in (1, 2, 3), v)
    v = src.get("lang")
    take("lang", v in ("he", "en"), v)
    v = src.get("theme")
    v = {"light": "day", "dark": "night"}.get(v, v)
    take("theme", v in ("day", "night", "auto"), v)
    v = src.get("day_hours")
    take("day_hours", v == "" or (isinstance(v, str) and re.match(r"^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$", v) is not None), v)
    v = src.get("layout")
    take("layout", v in ("auto", "landscape", "portrait"), v)
    v = src.get("urgent")
    take("urgent", v in ("stage", "stay", "full", "band"), v)
    v = src.get("mode")
    take("mode", v in ("rotation", "all", "focus"), v)
    v = src.get("rotate_s")
    take("rotate_s", isinstance(v, int) and not isinstance(v, bool) and ROTATE_MIN <= v <= ROTATE_MAX, v)
    v = src.get("hold")
    take("hold", isinstance(v, str) and len(v) <= 64 and re.match(r"^[A-Za-z0-9_-]*$", v) is not None, v)
    v = src.get("font_size")
    take("font_size", v in ("s", "m", "l"), v)
    v = src.get("font_scale")
    take("font_scale", isinstance(v, (int, float)) and not isinstance(v, bool) and 0.85 <= float(v) <= 1.2, float(v) if isinstance(v, (int, float)) else 1.0)
    v = src.get("saver")
    take("saver", v in SAVERS, v)
    v = src.get("logos")
    take("logos", v in LOGO_LAYOUTS, v)
    v = src.get("place")
    take("place", isinstance(v, str) and len(v.strip()) <= PLACE_MAX and not any(ord(c) < 32 for c in v), v.strip() if isinstance(v, str) else "")

    blocks = src.get("blocks") if isinstance(src.get("blocks"), dict) else {}
    for k in ("clock", "hebdate", "welcome", "weather", "promo", "news", "company_logo", "info_show"):
        if k in blocks:
            if isinstance(blocks[k], bool):
                d["blocks"][k] = blocks[k]
            elif strict:
                raise Invalid(f"display.blocks.{k}", "ערך לא תקין.")
    if "info" in blocks:
        info = blocks["info"]
        if isinstance(info, list) and all(x in INFO_KINDS for x in info):
            d["blocks"]["info"] = [k for k in INFO_KINDS if k in info]
        elif strict:
            raise Invalid("display.blocks.info", "ערך לא תקין.")
    w = src.get("weather") if isinstance(src.get("weather"), dict) else {}
    if "hours" in w:
        if w["hours"] in (3, 5, 8):
            d["weather"]["hours"] = w["hours"]
        elif strict:
            raise Invalid("display.weather.hours", "ערך לא תקין.")
    n = src.get("news") if isinstance(src.get("news"), dict) else {}
    if "speed" in n:
        d["news"]["speed"] = _choice(n["speed"], NEWS_SPEEDS, "normal")
    if "feeds" in n:
        feeds = n["feeds"] if isinstance(n["feeds"], list) else []
        cleaned = [f for f in (_feed(x) for x in feeds[:NEWS_FEEDS_MAX]) if f]
        if strict and (len(cleaned) != len(feeds) or len(feeds) > NEWS_FEEDS_MAX):
            raise Invalid("display.news.feeds", "כתובת RSS: https בלבד, עד 6 מקורות.")
        d["news"]["feeds"] = cleaned
    ni = src.get("night") if isinstance(src.get("night"), dict) else {}
    d["night"]["enabled"] = _bool(ni.get("enabled"), d["night"]["enabled"])
    d["night"]["from"] = _hm(ni.get("from"), d["night"]["from"])
    d["night"]["to"] = _hm(ni.get("to"), d["night"]["to"])
    if "dim" in ni:
        dim = ni["dim"]
        if isinstance(dim, (int, float)) and not isinstance(dim, bool) and 0.3 <= float(dim) <= 1:
            d["night"]["dim"] = round(float(dim), 2)
        elif strict:
            raise Invalid("display.night.dim", "ערך לא תקין.")
    bi = src.get("burn_in") if isinstance(src.get("burn_in"), dict) else {}
    d["burn_in"]["shift"] = _bool(bi.get("shift"), d["burn_in"]["shift"])
    return d


def merge_display(current: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    """A partial display patch over the stored settings (nested blocks merge one level deep), validated strictly."""
    merged = json.loads(json.dumps(current))
    for k, v in (patch or {}).items():
        if isinstance(v, dict) and isinstance(merged.get(k), dict):
            merged[k] = {**merged[k], **v}
        else:
            merged[k] = v
    return normalize_display(merged, strict=True)


def load_display(raw_json: str | None) -> dict[str, Any]:
    try:
        raw = json.loads(raw_json or "{}")
    except ValueError:
        raw = {}
    return normalize_display(raw)


def clean_slug(value: Any) -> str:
    s = str(value or "").strip().lower()
    if not SLUG_RE.match(s):
        raise Invalid("slug", "כתובת הלוח: אותיות לטיניות קטנות, ספרות ומקף, עד 40 תווים.")
    return s


# ---------------------------------------------------------------- the module settings (section 11)

def settings_doc(get: Any) -> dict[str, Any]:
    """The module settings as a typed document; `get(key, default)` reads one stored value."""
    raw = {k: (get(k, v) or v) for k, v in SETTINGS_DEFAULTS.items()}

    def num(key: str, lo: int, hi: int) -> int:
        try:
            n = int(raw[key])
        except (TypeError, ValueError):
            n = int(SETTINGS_DEFAULTS[key])
        return max(lo, min(hi, n))

    return {
        "enabled": raw["notices.enabled"] == "true",
        "default_days": num("notices.default_days", 1, 90),
        "default_severity": raw["notices.default_severity"] if raw["notices.default_severity"] in ("info", "alert") else "info",
        "push_default": raw["notices.push_default"] if raw["notices.push_default"] in ("by_severity", "always", "never") else "by_severity",
        "reads_names": raw["notices.reads_names"] == "true",
        "retention_days": num("notices.retention_days", 30, 3650),
        "home_empty": raw["notices.home_empty"] if raw["notices.home_empty"] in ("hide", "line") else "hide",
        "boards_remote": raw["notices.boards.remote"] == "true",
        "boards_max": num("notices.boards.max", 1, 50),
        "weather_entity": raw["notices.weather_entity"] if raw["notices.weather_entity"].startswith("weather.") else "",
        "weather_fallback": raw["notices.weather_fallback"] == "true",
        "news_custom": raw["notices.news_custom"] == "true",
        "building_name": raw["notices.building_name"][:60],
        "boards_origin": raw["notices.boards.origin"],
        "conn_total": num("notices.boards.conn_total", *CONN_TOTAL_RANGE),
        "conn_per_address": num("notices.boards.conn_per_address", *CONN_PER_ADDRESS_RANGE),
        "news_sources": CURATED_NEWS,
    }


SETTINGS_FIELDS: dict[str, str] = {  # API field -> settings key
    "enabled": "notices.enabled", "default_days": "notices.default_days", "default_severity": "notices.default_severity",
    "push_default": "notices.push_default", "reads_names": "notices.reads_names", "retention_days": "notices.retention_days",
    "home_empty": "notices.home_empty",
    "boards_remote": "notices.boards.remote", "boards_max": "notices.boards.max", "weather_entity": "notices.weather_entity",
    "weather_fallback": "notices.weather_fallback", "news_custom": "notices.news_custom", "building_name": "notices.building_name",
    "boards_origin": "notices.boards.origin",
    "conn_total": "notices.boards.conn_total", "conn_per_address": "notices.boards.conn_per_address",
}


def settings_values(patch: dict[str, Any]) -> dict[str, str]:
    """A settings patch -> the stored strings, validated (Invalid on a bad value)."""
    out: dict[str, str] = {}
    for field, value in patch.items():
        key = SETTINGS_FIELDS.get(field)
        if key is None:
            raise Invalid(field, "הגדרה לא מוכרת.")
        if field in ("enabled", "reads_names", "boards_remote", "weather_fallback", "news_custom"):
            if not isinstance(value, bool):
                raise Invalid(field, "ערך לא תקין.")
            out[key] = "true" if value else "false"
        elif field in ("default_days", "retention_days", "boards_max"):
            lo, hi = {"default_days": (1, 90), "retention_days": (30, 3650), "boards_max": (1, 50)}[field]
            if not isinstance(value, int) or isinstance(value, bool) or not lo <= value <= hi:
                raise Invalid(field, f"מספר בין {lo} ל-{hi}.")
            out[key] = str(value)
        elif field in ("conn_total", "conn_per_address"):
            lo, hi = CONN_TOTAL_RANGE if field == "conn_total" else CONN_PER_ADDRESS_RANGE
            if not isinstance(value, int) or isinstance(value, bool) or not lo <= value <= hi:
                raise Invalid(field, f"מספר בין {lo} ל-{hi}.")
            out[key] = str(value)
        elif field == "default_severity":
            if value not in ("info", "alert"):
                raise Invalid(field, "ערך לא תקין.")
            out[key] = value
        elif field == "home_empty":
            if value not in ("hide", "line"):
                raise Invalid(field, "ערך לא תקין.")
            out[key] = value
        elif field == "push_default":
            if value not in ("by_severity", "always", "never"):
                raise Invalid(field, "ערך לא תקין.")
            out[key] = value
        elif field == "weather_entity":
            if value != "" and not (isinstance(value, str) and re.match(r"^weather\.[a-z0-9_]{1,190}$", value)):
                raise Invalid(field, "ישות מזג אוויר: weather.* או ריק.")
            out[key] = value
        elif field == "building_name":
            out[key] = clean_text(value, field, 60)
        elif field == "boards_origin":
            v = str(value or "").strip().rstrip("/")
            if v and not re.match(r"^https?://[A-Za-z0-9.\-\[\]:]{1,200}$", v):
                raise Invalid(field, "כתובת הלוחות: http(s)://שם-או-כתובת[:פורט], בלי נתיב.")
            out[key] = v
    return out
