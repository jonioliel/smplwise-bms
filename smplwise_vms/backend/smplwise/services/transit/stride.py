"""BUSTIMES-295 - the Open Bus Stride client (https://open-bus-stride-api.hasadna.org.il, community data of the Ministry of Transport GTFS).

Pitfalls measured on 2026-10-26 (docs/design/BUS_TIMES_NOTE.md section 3.2) and what this module does about each:
* times are UTC ISO strings -> parsed to aware UTC here; the local clock text is made on OUR side (digest.py), never by a screen;
* a terminus row has `pickup_type` 1 (no boarding) -> only `pickup_type == 0` is kept;
* a stop's `id` is a daily snapshot, its `code` is the stable key -> everything is keyed on the code; the id of the day is resolved once;
* list parameters are inconsistent (`gtfs_stop_ids` takes CSV, `gtfs_ride_ids` does not) -> the stop ids go as CSV (verified), a ride id as a single value;
* `gtfs_ride_stops/list` needs a time range -> always sent;
* the page cap is 15,000 rows -> the catalogue is read in pages of 10,000;
* occasional 5xx -> one error type; the poller's breaker decides what to do.

`Fetch` is any callable `(path, params) -> parsed JSON`; the product passes `http_fetch`, the tests a recorded fake (no live call in a test)."""
from __future__ import annotations

import datetime as dt
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Callable

BASE = "https://open-bus-stride-api.hasadna.org.il"
TIMEOUT_S = 10.0
PAGE = 10_000
MAX_PAGES = 8
MAX_BYTES = 8 * 1024 * 1024
MAX_ROWS_PER_STOP = 400

Fetch = Callable[[str, dict[str, Any]], Any]


class StrideError(Exception):
    """The source answered with an error or nonsense (a timeout, a 4xx / 5xx, bad JSON). `kind` is a short code for the health view."""

    def __init__(self, kind: str, message: str = "") -> None:
        super().__init__(message or kind)
        self.kind = kind


def user_agent() -> str:
    from ... import __version__

    return f"SmplWise-Arx-BusTimes/{__version__} (+https://smplwise.com/arx)"


def http_fetch(path: str, params: dict[str, Any]) -> Any:
    """GET `BASE + path` (a fixed https host: the path comes from this module, never from a user) and parse the JSON."""
    query = urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
    req = urllib.request.Request(f"{BASE}{path}?{query}", headers={"User-Agent": user_agent(), "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:  # noqa: S310 - fixed https host
            data = resp.read(MAX_BYTES + 1)
    except urllib.error.HTTPError as exc:
        raise StrideError(f"http_{exc.code}") from exc
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise StrideError("unreachable") from exc
    if len(data) > MAX_BYTES:
        raise StrideError("too_large")
    try:
        return json.loads(data)
    except ValueError as exc:
        raise StrideError("bad_json") from exc


def parse_time(v: Any) -> dt.datetime | None:
    if not isinstance(v, str):
        return None
    try:
        t = dt.datetime.fromisoformat(v.replace("Z", "+00:00"))
    except ValueError:
        return None
    return t.astimezone(dt.timezone.utc) if t.tzinfo else t.replace(tzinfo=dt.timezone.utc)


def _list(doc: Any) -> list[dict[str, Any]]:
    if not isinstance(doc, list):
        raise StrideError("bad_shape")
    return [r for r in doc if isinstance(r, dict)]


# ---------------------------------------------------------------- the stop catalogue

def stop_row(r: dict[str, Any]) -> dict[str, Any] | None:
    code, name, city = r.get("code"), r.get("name"), r.get("city")
    if not isinstance(code, int) or isinstance(code, bool) or code <= 0 or not isinstance(name, str) or not name.strip():
        return None
    lat, lon = r.get("lat"), r.get("lon")
    return {"code": code, "name": name.strip()[:120], "city": city.strip()[:80] if isinstance(city, str) else "",
            "lat": float(lat) if isinstance(lat, (int, float)) else None, "lon": float(lon) if isinstance(lon, (int, float)) else None}


def fetch_catalogue(fetch: Fetch, day: dt.date) -> list[dict[str, Any]]:
    """Every stop of `day`, deduplicated by code (the first row of a code wins). Pages of 10,000 until a short page."""
    out: dict[int, dict[str, Any]] = {}
    for page in range(MAX_PAGES):
        rows = _list(fetch("/gtfs_stops/list", {"date_from": day.isoformat(), "date_to": day.isoformat(), "limit": PAGE, "offset": page * PAGE,
                                                "order_by": "id asc"}))  # the API does not honour order_by (rows come back descending); paging is stable, so every row is still seen once
        for r in rows:
            s = stop_row(r)
            if s is not None and s["code"] not in out:
                out[s["code"]] = s
        if len(rows) < PAGE:
            break
    if not out:
        raise StrideError("empty_catalogue")
    return list(out.values())


def stop_ids(fetch: Fetch, code: int, day: dt.date) -> list[int]:
    """The ids of the day's snapshot rows of one stop code (usually one; a duplicate code has two)."""
    rows = _list(fetch("/gtfs_stops/list", {"code": code, "date_from": day.isoformat(), "date_to": day.isoformat(), "limit": 10}))
    return sorted({r["id"] for r in rows if isinstance(r.get("id"), int)})


# ---------------------------------------------------------------- planned arrivals

_TAIL = re.compile(r"-\d+#?$")


def destination(route_long_name: Any) -> str:
    """The destination out of `origin<->destination-city-direction#`: the text after `<->` without its `-city-N#` tail. A convention, not a
    contract - an empty result tells the caller to look the last stop of the ride up."""
    if not isinstance(route_long_name, str) or "<->" not in route_long_name:
        return ""
    tail = route_long_name.split("<->", 1)[1].strip()
    tail = _TAIL.sub("", tail)  # "-N#"
    if "-" in tail:
        tail = tail.rsplit("-", 1)[0]  # "-city"
    return tail.strip()[:60]


def fetch_arrivals(fetch: Fetch, ids: list[int], frm: dt.datetime, to: dt.datetime) -> list[dict[str, Any]]:
    return _list(fetch("/gtfs_ride_stops/list", {
        "gtfs_stop_ids": ",".join(str(i) for i in ids),
        "arrival_time_from": frm.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "arrival_time_to": to.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "order_by": "arrival_time asc", "limit": MAX_ROWS_PER_STOP}))


def normalize_arrivals(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Boardable rows only (`pickup_type == 0`), as `{line, line_ref, dest, at, agency, ride}` sorted by time. A row without a time or a line is dropped."""
    out: list[dict[str, Any]] = []
    for r in rows:
        if r.get("pickup_type", 0) != 0:
            continue
        at = parse_time(r.get("arrival_time"))
        line = r.get("gtfs_route__route_short_name")
        if at is None or not isinstance(line, (str, int)) or str(line).strip() == "":
            continue
        agency = r.get("gtfs_route__agency_name")
        ride = r.get("gtfs_ride_id")
        line_ref = r.get("gtfs_route__line_ref")
        out.append({"line": str(line).strip()[:8], "line_ref": line_ref if isinstance(line_ref, int) and not isinstance(line_ref, bool) else None, "dest": destination(r.get("gtfs_route__route_long_name")),
                    "at": at.strftime("%Y-%m-%dT%H:%M:%SZ"), "agency": agency.strip()[:40] if isinstance(agency, str) else "",
                    "ride": ride if isinstance(ride, int) else None})
    out.sort(key=lambda x: (x["at"], x["line"]))
    return out


def last_stop_name(fetch: Fetch, ride_id: int) -> str:
    """The fallback of `destination`: the name of the ride's last stop (`order_by=stop_sequence desc&limit=1`, one call per ride)."""
    rows = _list(fetch("/gtfs_ride_stops/list", {"gtfs_ride_ids": ride_id, "order_by": "stop_sequence desc", "limit": 1}))
    name = rows[0].get("gtfs_stop__name") if rows else ""
    return name.strip()[:60] if isinstance(name, str) else ""
