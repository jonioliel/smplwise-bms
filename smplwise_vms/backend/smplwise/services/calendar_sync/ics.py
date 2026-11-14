"""CALCONNECT-2330 (contract 12.1 phase 4b): iCal IN - Arx reads an https iCal address into a calendar; read-only, no account.

* The address is a secret (it usually carries the calendar's private token): sealed (credentials `feed_url`), never returned, logged or
  audited; `webcal://` is read as `https://`.
* The fetch is the guarded outbound fetch of the notice board's news feeds (services/notices/sources.check_feed_url, contract 15.5):
  https on port 443 only, no credentials in the URL, no local names, EVERY resolved address globally routable, each redirect (at most 3)
  checked again, the connection made to the CHECKED address (DNS rebinding cannot steer it), 15 s in total, 5 MB at most, no cookies.
* Parsing is a small in-repo RFC 5545 reader (no new dependency): VEVENT with UID, DTSTART / DTEND / DURATION (UTC, TZID or floating,
  VALUE=DATE), SUMMARY, DESCRIPTION, STATUS, SEQUENCE, LAST-MODIFIED, RRULE inside the recurrence module's subset (expanded into the window,
  30 days back and 400 ahead; a rule outside it imports the first instance), EXDATE, RECURRENCE-ID overrides. Text is text only.
* Sync token = the SHA-256 of the body: the same body means no change; a different body is a full listing (full_resync_required), so
  the engine also notices events the feed no longer has."""
from __future__ import annotations

import datetime as dt
import hashlib
import re
import time
from typing import Any, Callable
from urllib.parse import urljoin
from zoneinfo import ZoneInfo

from ..calendar import recurrence as rec
from . import credentials
from .adapter import Binding, ConnectionInfo, ExtCalendar, ExtEvent, Health, OutEvent, PullResult, PushResult, SyncError

UTC = dt.timezone.utc
MAX_BYTES = 5 * 1024 * 1024
TOTAL_S = 15.0
MAX_REDIRECTS = 3
MAX_EVENTS = 5000
PAST_DAYS, AHEAD_DAYS = 30, 400
CLOCK: Callable[[], dt.datetime] = lambda: dt.datetime.now(UTC)  # noqa: E731 - test seam


def normalise_url(url: str) -> str:
    u = (url or "").strip()
    if u.lower().startswith("webcal://"):
        u = "https://" + u[9:]
    return u


def check_url(url: str, *, resolve: bool = True) -> None:
    """The syntax / name (and, with `resolve`, address) check alone, when the owner saves an address. Raises SyncError('feed_refused').
    Without `resolve` no name is looked up (the save stays off the network); every fetch checks every address again."""
    from ..notices.sources import FetchRefused, check_feed_url  # noqa: PLC0415

    try:
        check_feed_url(normalise_url(url), None if resolve else (lambda _h: ["8.8.8.8"]))
    except FetchRefused as exc:
        raise SyncError(f"refused ({exc})", code="feed_refused") from None


def host_hint(url: str) -> str | None:
    """The feed's host name for display (`account_hint`), never the path or the token in it."""
    from urllib.parse import urlsplit  # noqa: PLC0415

    try:
        h = (urlsplit(normalise_url(url)).hostname or "").lower()
    except ValueError:
        return None
    return h[:120] or None


def guarded_fetch(url: str) -> bytes:
    from ..notices import sources  # noqa: PLC0415

    deadline = time.monotonic() + TOTAL_S
    current = normalise_url(url)
    for _hop in range(MAX_REDIRECTS + 1):
        try:
            host, ip, port, path = sources.check_feed_url(current)
        except sources.FetchRefused:
            raise SyncError(code="feed_refused") from None
        left = deadline - time.monotonic()
        if left <= 0:
            raise SyncError(code="feed_unreachable")
        try:
            conn = sources.CONNECT(host, ip, port, min(TOTAL_S, left))
        except OSError:
            raise SyncError(code="feed_unreachable") from None
        try:
            try:
                conn.request("GET", path, headers={"Host": host, "User-Agent": "SmplWise-Arx-Calendar/1", "Accept": "text/calendar, */*;q=0.1",
                                                   "Accept-Encoding": "identity", "Connection": "close"})
                resp = conn.getresponse()
            except OSError:
                raise SyncError(code="feed_unreachable") from None
            if resp.status in (301, 302, 303, 307, 308):
                loc = resp.getheader("Location")
                if not loc:
                    raise SyncError(code="feed_unreachable")
                current = urljoin(current, loc)
                continue
            if resp.status == 429:
                raise SyncError(code="rate_limited")
            if resp.status != 200:
                raise SyncError(code="feed_unreachable")
            declared = resp.getheader("Content-Length")
            if declared and declared.isdigit() and int(declared) > MAX_BYTES:
                raise SyncError(code="feed_too_large")
            data = bytearray()
            while len(data) <= MAX_BYTES:
                if time.monotonic() > deadline:
                    raise SyncError(code="feed_unreachable")
                chunk = resp.read(min(65536, MAX_BYTES + 1 - len(data)))
                if not chunk:
                    break
                data += chunk
            if len(data) > MAX_BYTES:
                raise SyncError(code="feed_too_large")
            return bytes(data)
        finally:
            try:
                conn.close()
            except Exception:  # noqa: BLE001
                pass
    raise SyncError(code="feed_unreachable")


FETCH: Callable[[str], bytes] = guarded_fetch  # test seam (tests serve a fake feed; nothing reaches a network)
_LAST: dict[str, tuple[bytes, float]] = {}


# ---------------------------------------------------------------- RFC 5545 reading

_PROP = re.compile(r"^([A-Za-z0-9-]+)((?:;[^:]*)?):(.*)$")


def _unfold(text: str) -> list[str]:
    out: list[str] = []
    for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        if line[:1] in (" ", "\t") and out:
            out[-1] += line[1:]
        elif line:
            out.append(line)
    return out


def _params(raw: str) -> dict[str, str]:
    out = {}
    for p in raw.split(";"):
        if "=" in p:
            k, v = p.split("=", 1)
            out[k.upper()] = v.strip('"')
    return out


def _text(v: str) -> str:
    v = v.replace("\\n", "\n").replace("\\N", "\n").replace("\\,", ",").replace("\\;", ";").replace("\\\\", "\\")
    return "".join(c for c in v if ord(c) >= 32 or c in "\n\t")


def _zone(name: str | None, default: str) -> ZoneInfo:
    for n in (name, default, "UTC"):
        if n:
            try:
                return ZoneInfo(n)
            except (KeyError, ValueError):
                continue
    return ZoneInfo("UTC")


def _when(value: str, params: dict[str, str], default_tz: str) -> tuple[dt.datetime, bool, str] | None:
    """(UTC instant, all_day, the zone name it was written in)."""
    v = value.strip()
    try:
        if params.get("VALUE") == "DATE" or re.fullmatch(r"\d{8}", v):
            d = dt.datetime.strptime(v[:8], "%Y%m%d").date()
            z = _zone(params.get("TZID"), default_tz)
            return dt.datetime.combine(d, dt.time(0, 0), z).astimezone(UTC), True, z.key
        if v.endswith("Z"):
            return dt.datetime.strptime(v[:15], "%Y%m%dT%H%M%S").replace(tzinfo=UTC), False, "UTC"
        z = _zone(params.get("TZID"), default_tz)
        return dt.datetime.strptime(v[:15], "%Y%m%dT%H%M%S").replace(tzinfo=z).astimezone(UTC), False, z.key
    except ValueError:
        return None


_DUR = re.compile(r"^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$")


def _duration(v: str) -> dt.timedelta | None:
    m = _DUR.fullmatch(v.strip())
    if not m:
        return None
    w, d, h, mi, s = (int(x or 0) for x in m.groups()[1:])
    td = dt.timedelta(weeks=w, days=d, hours=h, minutes=mi, seconds=s)
    return -td if m.group(1) == "-" else td


def parse(body: bytes, default_tz: str = "UTC") -> list[dict[str, Any]]:
    """The VEVENTs as plain dicts (raw properties with their parameters). Refuses anything that is not a VCALENDAR."""
    try:
        text = body.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = body.decode("latin-1")
    lines = _unfold(text)
    if not lines or lines[0].strip().upper() != "BEGIN:VCALENDAR":
        raise SyncError(code="feed_invalid")
    cal_tz = default_tz
    events: list[dict[str, Any]] = []
    cur: dict[str, Any] | None = None
    depth = 0
    for line in lines:
        m = _PROP.match(line)
        if not m:
            continue
        name, praw, value = m.group(1).upper(), m.group(2), m.group(3)
        if name == "BEGIN":
            if value.upper() == "VEVENT" and cur is None:
                cur, depth = {"_props": {}, "EXDATE": []}, 0
            elif cur is not None:
                depth += 1  # VALARM and friends inside an event
            continue
        if name == "END":
            if cur is not None and depth:
                depth -= 1
            elif cur is not None and value.upper() == "VEVENT":
                events.append(cur)
                cur = None
                if len(events) > MAX_EVENTS:
                    raise SyncError(code="feed_too_large")
            continue
        if cur is None:
            if name == "X-WR-TIMEZONE":
                cal_tz = value.strip() or cal_tz
            continue
        if depth:
            continue
        if name == "EXDATE":
            cur["EXDATE"].append((value, _params(praw)))
        else:
            cur["_props"].setdefault(name, (value, _params(praw)))
    for e in events:
        e["_tz"] = cal_tz
    return events


def _ext_events(raw: list[dict[str, Any]], now: dt.datetime) -> list[ExtEvent]:
    win_s, win_e = now - dt.timedelta(days=PAST_DAYS), now + dt.timedelta(days=AHEAD_DAYS)
    overrides: dict[tuple[str, str], dict[str, Any]] = {}
    masters: list[dict[str, Any]] = []
    for e in raw:
        p = e["_props"]
        if "UID" not in p or "DTSTART" not in p:
            continue
        if "RECURRENCE-ID" in p:
            rid = _when(p["RECURRENCE-ID"][0], p["RECURRENCE-ID"][1], e["_tz"])
            if rid:
                overrides[(p["UID"][0].strip(), rid[0].strftime("%Y%m%dT%H%M%SZ"))] = e
            continue
        masters.append(e)
    out: list[ExtEvent] = []

    def one(e: dict[str, Any], uid: str, s: dt.datetime, en: dt.datetime, all_day: bool, tz: str) -> None:
        p = e["_props"]
        if p.get("STATUS", ("",))[0].strip().upper() == "CANCELLED":
            return
        if en <= s or en <= win_s or s >= win_e:
            return
        title, notes = _text(p.get("SUMMARY", ("",))[0]), _text(p.get("DESCRIPTION", ("",))[0])
        stamp = "|".join([p.get("SEQUENCE", ("0",))[0], p.get("LAST-MODIFIED", ("",))[0], title, notes, s.isoformat(), en.isoformat()])
        out.append(ExtEvent(uid, hashlib.sha256(stamp.encode("utf-8")).hexdigest()[:32], title, s, en, notes, all_day, tz))

    for e in masters:
        p = e["_props"]
        uid = p["UID"][0].strip()[:200]
        st = _when(p["DTSTART"][0], p["DTSTART"][1], e["_tz"])
        if st is None:
            continue
        start, all_day, tz = st
        if "DTEND" in p:
            en = _when(p["DTEND"][0], p["DTEND"][1], e["_tz"])
            end = en[0] if en else None
        elif "DURATION" in p:
            d = _duration(p["DURATION"][0])
            end = start + d if d else None
        else:
            end = start + (dt.timedelta(days=1) if all_day else dt.timedelta(0))
        if end is None:
            continue
        rule = None
        if "RRULE" in p:
            text = re.sub(r"UNTIL=(\d{8})T?\d{0,6}Z?", r"UNTIL=\1", p["RRULE"][0])
            try:
                rule = rec.parse_rule(text)
            except rec.RuleError:
                rule = None  # outside the supported subset: the first instance only (contract 12.4)
        if rule is None:
            one(e, uid, start, end, all_day, tz)
            continue
        zone = ZoneInfo(tz)
        ex = set()
        for v, prm in e["EXDATE"]:
            for part in v.split(","):
                w = _when(part, prm, e["_tz"])
                if w:
                    ex.add(w[0].astimezone(zone).strftime(rec.LOCAL_FMT))
        try:
            occs = rec.expand(rule, start.astimezone(zone).replace(tzinfo=None), end.astimezone(zone).replace(tzinfo=None), zone, window_start=win_s,
                              window_end=win_e, exdates=ex)
        except rec.RuleError:
            occs = []
        for o in occs:
            key = o.start_utc.strftime("%Y%m%dT%H%M%SZ")
            ov = overrides.get((uid, key))
            iid = f"{uid}#{key}"[:300]
            if ov is not None:
                op = ov["_props"]
                s2 = _when(op["DTSTART"][0], op["DTSTART"][1], ov["_tz"])
                e2 = _when(op["DTEND"][0], op["DTEND"][1], ov["_tz"]) if "DTEND" in op else None
                if s2:
                    one(ov, iid, s2[0], e2[0] if e2 else s2[0] + (o.end_utc - o.start_utc), s2[1], tz)
                continue
            one(e, iid, o.start_utc, o.end_utc, all_day, tz)
    return out


def events_of(body: bytes, now: dt.datetime | None = None) -> list[ExtEvent]:
    return _ext_events(parse(body), now or CLOCK())


class IcsInAdapter:
    provider = "ics_in"

    def _url(self, cid: str) -> str:
        url = credentials.RUNTIME.read(cid).get("feed_url")
        if not url:
            raise SyncError(code="feed_missing")
        return url

    def health(self, connection: ConnectionInfo) -> Health:
        return Health("ok")

    def list_calendars(self, connection: ConnectionInfo) -> list[ExtCalendar]:
        self._url(connection.id)
        return [ExtCalendar("feed", connection.label, False, True)]

    def pull(self, connection: ConnectionInfo, binding: Binding, since_token: str | None) -> PullResult:
        held = _LAST.pop(connection.id, None)
        if since_token is None and held is not None and time.monotonic() - held[1] < 60:
            body = held[0]  # the body the token check just fetched: no second download
        else:
            body = FETCH(self._url(connection.id))
        digest = hashlib.sha256(body).hexdigest()
        if since_token == digest:
            return PullResult([], digest)
        if since_token is not None:
            _LAST[connection.id] = (body, time.monotonic())
            return PullResult(full_resync_required=True)  # changed: read it whole, so vanished events are noticed
        return PullResult(list(events_of(body)), digest)

    def push(self, connection: ConnectionInfo, binding: Binding, event: OutEvent, ext_uid: str | None, etag: str | None) -> PushResult:
        raise SyncError(code="read_only")

    def delete(self, connection: ConnectionInfo, binding: Binding, ext_uid: str, etag: str | None) -> None:
        raise SyncError(code="read_only")

    def revoke(self, connection: ConnectionInfo) -> None:
        return None


__all__ = ["IcsInAdapter", "FETCH", "parse", "events_of", "check_url", "normalise_url"]
