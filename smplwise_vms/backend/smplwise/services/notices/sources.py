"""CR-NOTICE106 section 8.1 / 8.3 - the optional data blocks of the TV feed, assembled server-side so the TV page never talks to
Home Assistant or the internet (CSP `self` only):

* weather - the installation's weather entity (`notices.weather_entity`, a `weather.*` of the state mirror): the condition, the
  temperature and, when the entity reports one, the hourly forecast. No entity = no block. The internet fallback (Q11) is not built.
* news - RSS feeds chosen per board (the curated list or an https URL), fetched by the add-on at most every 15 minutes per feed,
  titles only, markup stripped, 2 KB per item, never images or links. A fetch never blocks a feed read: a stale cache answers and a
  background refresh starts (one at a time per URL).
* sun - sunrise / sunset at the installation's coordinates (NOAA approximation, local, no network) for the automatic day / night
  switch, and the Shabbat candle-lighting time (Friday's sunset - 18 minutes). The coordinates themselves never reach the TV.
"""
from __future__ import annotations

import datetime as dt
import html
import json
import logging
import math
import re
import threading
import time
import urllib.request
from typing import Any, Callable
from zoneinfo import ZoneInfo

from ...db import get_setting

log = logging.getLogger(__name__)

NEWS_TTL_S = 15 * 60
NEWS_MAX_BYTES = 512 * 1024
NEWS_ITEMS_PER_FEED = 8
NEWS_ITEM_MAX = 2048
NEWS_TIMEOUT_S = 8.0

CONDITIONS = {"clear-night": "moon", "sunny": "sun", "partlycloudy": "cloudsun", "cloudy": "cloud", "fog": "cloud", "rainy": "cloud", "pouring": "cloud",
              "snowy": "cloud", "snowy-rainy": "cloud", "lightning": "cloud", "lightning-rainy": "cloud", "hail": "cloud", "windy": "cloudsun",
              "windy-variant": "cloudsun", "exceptional": "cloud"}
CONDITION_HE = {"clear-night": "לילה בהיר", "sunny": "בהיר", "partlycloudy": "מעונן חלקית", "cloudy": "מעונן", "fog": "ערפל", "rainy": "גשום",
                "pouring": "גשם חזק", "snowy": "שלג", "snowy-rainy": "שלג וגשם", "lightning": "סופות ברקים", "lightning-rainy": "סופות רעמים",
                "hail": "ברד", "windy": "רוחות", "windy-variant": "רוחות ועננים", "exceptional": "מזג אוויר חריג"}
CONDITION_EN = {k: k.replace("-", " ").replace("partlycloudy", "partly cloudy") for k in CONDITIONS}


def installation_tz(conn) -> ZoneInfo:
    try:
        return ZoneInfo(get_setting(conn, "time.zone", "Asia/Jerusalem") or "Asia/Jerusalem")
    except Exception:  # noqa: BLE001 - an unknown zone falls back to the product default
        return ZoneInfo("Asia/Jerusalem")


def _coords(conn) -> tuple[float, float] | None:
    try:
        lat = float(get_setting(conn, "site.latitude", "") or "nan")
        lon = float(get_setting(conn, "site.longitude", "") or "nan")
    except ValueError:
        return None
    if math.isnan(lat) or math.isnan(lon) or not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return None
    return lat, lon


def sun_times(day: dt.date, lat: float, lon: float) -> tuple[dt.datetime, dt.datetime] | None:
    """Sunrise and sunset (aware UTC) of a calendar day; None in a polar day / night (the NOAA approximation of the mock-up)."""
    rad = math.pi / 180
    jd = dt.datetime(day.year, day.month, day.day, 12, tzinfo=dt.timezone.utc).timestamp() / 86400 + 2440587.5
    n = round(jd - 2451545.0 + 0.0008)
    js = n - lon / 360
    m = (357.5291 + 0.98560028 * js) % 360
    c = 1.9148 * math.sin(m * rad) + 0.02 * math.sin(2 * m * rad) + 0.0003 * math.sin(3 * m * rad)
    lam = (m + c + 180 + 102.9372) % 360
    jt = 2451545.0 + js + 0.0053 * math.sin(m * rad) - 0.0069 * math.sin(2 * lam * rad)
    dec = math.asin(math.sin(lam * rad) * math.sin(23.44 * rad))
    cosw = (math.sin(-0.83 * rad) - math.sin(lat * rad) * math.sin(dec)) / (math.cos(lat * rad) * math.cos(dec))
    if cosw < -1 or cosw > 1:
        return None
    w = math.acos(cosw) / rad / 360

    def at(j: float) -> dt.datetime:
        return dt.datetime.fromtimestamp((j - 2440587.5) * 86400, tz=dt.timezone.utc)

    return at(jt - w), at(jt + w)


def sun_block(conn, now: dt.datetime) -> dict[str, Any] | None:
    """`{rise, set, candles}` as local HH:MM of the installation (candles = this week's Friday sunset - 18 min); None without coordinates."""
    xy = _coords(conn)
    if xy is None:
        return None
    tz = installation_tz(conn)
    local = now.astimezone(tz)
    st = sun_times(local.date(), *xy)
    if st is None:
        return None
    friday = local.date() + dt.timedelta(days=(4 - local.weekday()) % 7)
    fs = sun_times(friday, *xy)
    out = {"rise": st[0].astimezone(tz).strftime("%H:%M"), "set": st[1].astimezone(tz).strftime("%H:%M")}
    if fs is not None:
        out["candles"] = (fs[1] - dt.timedelta(minutes=18)).astimezone(tz).strftime("%H:%M")
    return out


def weather_block(conn, entity_id: str, hours: int, lang: str, now: dt.datetime) -> dict[str, Any] | None:
    if not entity_id:
        return None
    row = conn.execute("SELECT state, attributes_json, available FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (entity_id,)).fetchone()
    if row is None or not row["available"] or not row["state"] or row["state"] in ("unavailable", "unknown"):
        return None
    try:
        attrs = json.loads(row["attributes_json"] or "{}")
    except ValueError:
        attrs = {}
    cond = str(row["state"])
    temp = attrs.get("temperature")
    if not isinstance(temp, (int, float)):
        return None
    words = (CONDITION_EN if lang == "en" else CONDITION_HE).get(cond, cond)
    out: dict[str, Any] = {"now": {"t": round(float(temp)), "condition": CONDITIONS.get(cond, "cloud"), "text": words}, "hours": []}
    tz = installation_tz(conn)
    fc = attrs.get("forecast")
    if isinstance(fc, list):
        for f in fc:
            if not isinstance(f, dict):
                continue
            at = f.get("datetime")
            t = f.get("temperature")
            try:
                when = dt.datetime.fromisoformat(str(at).replace("Z", "+00:00"))
            except ValueError:
                continue
            if when.tzinfo is None:
                when = when.replace(tzinfo=dt.timezone.utc)
            if when <= now or not isinstance(t, (int, float)):
                continue
            out["hours"].append({"at": when.astimezone(tz).strftime("%H:%M"), "t": round(float(t)), "condition": CONDITIONS.get(str(f.get("condition")), "cloud")})
            if len(out["hours"]) >= hours:
                break
    return out


# ---------------------------------------------------------------- news (server-side RSS)

_TAG = re.compile(r"<[^>]*>")
_WS = re.compile(r"\s+")


def clean_title(raw: str) -> str:
    """Markup stripped, entities decoded, whitespace folded, control characters out, 2 KB cap; plain text only."""
    s = html.unescape(_TAG.sub(" ", html.unescape(raw or "")))
    s = "".join(c for c in s if ord(c) >= 32 or c in "\t\n")
    s = _WS.sub(" ", s).strip()
    return s.encode("utf-8")[:NEWS_ITEM_MAX].decode("utf-8", "ignore")


def parse_feed(data: bytes, limit: int = NEWS_ITEMS_PER_FEED) -> list[str]:
    """RSS 2.0 `item/title` or Atom `entry/title` - through the product's safe XML parser (no entities, no DTD)."""
    from ..xmlsafe import parse

    root = parse(data)
    out: list[str] = []
    for el in root.iter():
        tag = el.tag.rsplit("}", 1)[-1] if isinstance(el.tag, str) else ""
        if tag not in ("item", "entry"):
            continue
        for ch in el:
            ctag = ch.tag.rsplit("}", 1)[-1] if isinstance(ch.tag, str) else ""
            if ctag == "title":
                t = clean_title("".join(ch.itertext()))
                if t:
                    out.append(t)
                break
        if len(out) >= limit:
            break
    return out


def _default_fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "SmplWise-Arx-NoticeBoard/1", "Accept": "application/rss+xml, application/xml, text/xml"})
    with urllib.request.urlopen(req, timeout=NEWS_TIMEOUT_S) as resp:  # noqa: S310 - https only (model._feed), the owner's chosen feeds
        final = resp.geturl()
        if not final.startswith("https://"):
            raise ValueError("redirect away from https")
        data = resp.read(NEWS_MAX_BYTES + 1)
    if len(data) > NEWS_MAX_BYTES:
        raise ValueError("feed too large")
    return data


class NewsCache:
    def __init__(self, fetch: Callable[[str], bytes] = _default_fetch, clock: Callable[[], float] = time.time, background: bool = True) -> None:
        self._fetch = fetch
        self._clock = clock
        self._background = background
        self._lock = threading.Lock()
        self._items: dict[str, tuple[float, list[str]]] = {}
        self._busy: set[str] = set()

    def _refresh(self, url: str) -> None:
        try:
            titles = parse_feed(self._fetch(url))
        except Exception as exc:  # noqa: BLE001 - a broken feed keeps its last good titles; never the URL in the log (owner's choice)
            log.info("notice board news feed failed: %s", type(exc).__name__)
            titles = None
        with self._lock:
            self._busy.discard(url)
            if titles is not None:
                self._items[url] = (self._clock(), titles)
            elif url in self._items:
                self._items[url] = (self._clock(), self._items[url][1])  # back off for one TTL

    def titles(self, url: str) -> list[str]:
        with self._lock:
            got = self._items.get(url)
            stale = got is None or self._clock() - got[0] > NEWS_TTL_S
            start = stale and url not in self._busy
            if start:
                self._busy.add(url)
        if start:
            if self._background:
                threading.Thread(target=self._refresh, args=(url,), name="notice-news", daemon=True).start()
            else:
                self._refresh(url)
                with self._lock:
                    got = self._items.get(url)
        return list(got[1]) if got else []

    def clear(self) -> None:
        with self._lock:
            self._items.clear()
            self._busy.clear()


NEWS = NewsCache()


def news_block(feeds: list[dict[str, str]], cache: NewsCache | None = None) -> list[dict[str, str]]:
    cache = cache or NEWS
    per = [(f["name"], cache.titles(f["url"])) for f in feeds]
    out: list[dict[str, str]] = []
    # interleave the feeds so one busy source does not fill the line
    for i in range(NEWS_ITEMS_PER_FEED):
        for name, titles in per:
            if i < len(titles):
                out.append({"source": name, "title": titles[i]})
    return out[:24]
