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
import socket
import ssl
import time
import http.client
import ipaddress
from urllib.parse import urljoin, urlsplit
from typing import Any, Callable
from zoneinfo import ZoneInfo

from ...db import get_setting

log = logging.getLogger(__name__)

NEWS_TTL_S = 15 * 60
NEWS_MAX_BYTES = 512 * 1024
NEWS_ITEMS_PER_FEED = 8
NEWS_ITEM_MAX = 2048
NEWS_TIMEOUT_S = 8.0  # per socket operation
NEWS_TOTAL_S = 15.0  # the whole fetch, redirects included
NEWS_MAX_REDIRECTS = 3

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


def forecast_days(fc: Any, tz: ZoneInfo, now: dt.datetime, days: int) -> list[dict[str, Any]]:
    """TVOPT-295 (weather_days): today and the next days, one cell per LOCAL day of the installation, from the entity's own forecast
    entries - daily or hourly alike: the day's high (the largest temperature), its low (`templow`, else the smallest temperature of an
    hourly day; absent for a daily entry without one) and the condition nearest to noon. Days before today are skipped; a source with
    fewer days gives fewer cells (never invented ones)."""
    if not isinstance(fc, list) or days < 1:
        return []
    today = now.astimezone(tz).date()
    by_day: dict[dt.date, list[tuple[dt.datetime, dict[str, Any]]]] = {}
    for f in fc:
        if not isinstance(f, dict) or not isinstance(f.get("temperature"), (int, float)) or isinstance(f.get("temperature"), bool):
            continue
        try:
            when = dt.datetime.fromisoformat(str(f.get("datetime")).replace("Z", "+00:00"))
        except ValueError:
            continue
        if when.tzinfo is None:
            when = when.replace(tzinfo=dt.timezone.utc)
        local = when.astimezone(tz)
        if local.date() < today:
            continue
        by_day.setdefault(local.date(), []).append((local, f))
    out: list[dict[str, Any]] = []
    for day in sorted(by_day)[:days]:
        entries = by_day[day]
        temps = [float(f["temperature"]) for _w, f in entries]
        lows = [float(f["templow"]) for _w, f in entries if isinstance(f.get("templow"), (int, float)) and not isinstance(f.get("templow"), bool)]
        noon = min(entries, key=lambda e: abs((e[0].hour + e[0].minute / 60) - 12))[1]
        cell: dict[str, Any] = {"date": day.isoformat(), "t": round(max(temps)), "condition": CONDITIONS.get(str(noon.get("condition")), "cloud")}
        low = min(lows) if lows else (min(temps) if len(entries) > 1 else None)
        if low is not None:
            cell["lo"] = round(low)
        out.append(cell)
    return out


def weather_block(conn, entity_id: str, hours: int, lang: str, now: dt.datetime, days: int = 0) -> dict[str, Any] | None:
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
    if days >= 2:  # TVOPT-295: the days row (weather_days 2..5); 0 / 1 keep the feed as it was
        out["days"] = forecast_days(fc, tz, now, days)
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


class FetchRefused(ValueError):
    """The feed URL or one of its redirects is refused. `code` only - never the URL (NOTICEGB-295)."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def _dns(host: str) -> list[str]:
    try:
        infos = socket.getaddrinfo(host, None, proto=socket.IPPROTO_TCP)
    except (socket.gaierror, UnicodeError, OSError):
        return []
    return list(dict.fromkeys(str(i[4][0]) for i in infos))


RESOLVE: Callable[[str], list[str]] = _dns  # test seam: nothing here resolves a real name in a test


class _PinnedHTTPS(http.client.HTTPSConnection):
    """Connects to the CHECKED address while TLS (SNI + certificate) and Host stay the feed's name, so a DNS answer that changes
    between the check and the connect cannot steer the request (DNS rebinding)."""

    def __init__(self, host: str, ip: str, port: int, timeout: float) -> None:
        super().__init__(host, port, timeout=timeout, context=ssl.create_default_context())
        self._pinned_ip = ip

    def connect(self) -> None:
        sock = socket.create_connection((self._pinned_ip, self.port), self.timeout)
        self.sock = self._context.wrap_socket(sock, server_hostname=self.host)


def _connect(host: str, ip: str, port: int, timeout: float) -> Any:
    return _PinnedHTTPS(host, ip, port, timeout)


CONNECT: Callable[[str, str, int, float], Any] = _connect  # test seam: returns an object with request() / getresponse() / close()


def check_feed_url(url: str, resolve: Callable[[str], list[str]] | None = None) -> tuple[str, str, int, str]:
    """(host, checked ip, port, path) of a feed URL that may be fetched, else FetchRefused. https only, port 443, no credentials, no
    local names, and EVERY resolved address must be globally routable (IPv4 and IPv6; mapped / NAT64 / 6to4 forms are refused)."""
    from ..partner import ssrf

    if not isinstance(url, str) or not url or len(url) > 2048 or any(ord(c) <= 32 or ord(c) == 127 for c in url) or "\\" in url:
        raise FetchRefused("syntax")
    try:
        parts = urlsplit(url)
        port = parts.port or 443
    except ValueError:
        raise FetchRefused("syntax") from None
    if parts.scheme.lower() != "https":
        raise FetchRefused("scheme")
    if parts.username is not None or parts.password is not None or "@" in parts.netloc:
        raise FetchRefused("credentials")
    if port != 443:
        raise FetchRefused("port")
    host = (parts.hostname or "").rstrip(".").lower()
    if not host:
        raise FetchRefused("syntax")
    path = (parts.path or "/") + (f"?{parts.query}" if parts.query else "")
    try:
        literal: ipaddress.IPv4Address | ipaddress.IPv6Address | None = ipaddress.ip_address(host)
    except ValueError:
        literal = None
    if literal is None:
        if re.fullmatch(r"[0-9.]+|0x[0-9a-f.x]+|[0-9a-fx.]*\.0x[0-9a-f]+[0-9a-fx.]*", host):
            raise FetchRefused("syntax")  # 2130706433, 0177.0.0.1, 127.1 and the like
        try:
            host = host.encode("idna").decode("ascii")
        except UnicodeError:
            raise FetchRefused("syntax") from None
        if "." not in host or host in ssrf.REFUSED_NAMES or host.endswith(ssrf.REFUSED_SUFFIXES):
            raise FetchRefused("name")
        ips = []
        for a in (resolve or RESOLVE)(host) or []:
            try:
                ips.append(ipaddress.ip_address(str(a).split("%", 1)[0]))
            except ValueError:
                raise FetchRefused("address") from None
        if not ips:
            raise FetchRefused("dns")
    else:
        ips = [literal]
    if any(ssrf.address_refused(ip) for ip in ips):
        raise FetchRefused("address")
    return host, str(ips[0]), port, path


def fetch_feed(url: str, *, resolve: Callable[[str], list[str]] | None = None, connect: Callable[[str, str, int, float], Any] | None = None,
               clock: Callable[[], float] = time.monotonic) -> bytes:
    """The guarded RSS fetch: every hop (the URL and each redirect, at most NEWS_MAX_REDIRECTS) is re-validated and connected by its
    checked address; the whole fetch is bounded by NEWS_TOTAL_S and the body by NEWS_MAX_BYTES; no cookies, no credentials."""
    deadline = clock() + NEWS_TOTAL_S
    current = url
    for _hop in range(NEWS_MAX_REDIRECTS + 1):
        host, ip, port, path = check_feed_url(current, resolve)
        left = deadline - clock()
        if left <= 0:
            raise FetchRefused("timeout")
        conn = (connect or CONNECT)(host, ip, port, min(NEWS_TIMEOUT_S, left))
        try:
            conn.request("GET", path, headers={"Host": host, "User-Agent": "SmplWise-Arx-NoticeBoard/1", "Accept": "application/rss+xml, application/xml, text/xml",
                                               "Accept-Encoding": "identity", "Connection": "close"})
            resp = conn.getresponse()
            if resp.status in (301, 302, 303, 307, 308):
                loc = resp.getheader("Location")
                if not loc:
                    raise FetchRefused("redirect")
                current = urljoin(current, loc)
                continue
            if resp.status != 200:
                raise FetchRefused("status")
            declared = resp.getheader("Content-Length")
            if declared and declared.isdigit() and int(declared) > NEWS_MAX_BYTES:
                raise FetchRefused("size")
            data = bytearray()
            while len(data) <= NEWS_MAX_BYTES:
                if clock() > deadline:
                    raise FetchRefused("timeout")
                chunk = resp.read(min(16384, NEWS_MAX_BYTES + 1 - len(data)))
                if not chunk:
                    break
                data += chunk
            if len(data) > NEWS_MAX_BYTES:
                raise FetchRefused("size")
            return bytes(data)
        finally:
            try:
                conn.close()
            except Exception:  # noqa: BLE001
                pass
    raise FetchRefused("redirects")


def _default_fetch(url: str) -> bytes:
    return fetch_feed(url)


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
    """The ticker items: `{source, title}` and, when the source has a logo, `logo` (a URL the TV reads with the board token)."""
    cache = cache or NEWS
    per = [(f["name"], f.get("logo", ""), cache.titles(f["url"])) for f in feeds]
    out: list[dict[str, str]] = []
    # interleave the feeds so one busy source does not fill the line
    for i in range(NEWS_ITEMS_PER_FEED):
        for name, logo, titles in per:
            if i < len(titles):
                out.append({"source": name, "title": titles[i], **({"logo": logo} if logo else {})})
    return out[:24]
