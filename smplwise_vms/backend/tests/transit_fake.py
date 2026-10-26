"""BUSTIMES-295: a recorded fake of the Open Bus Stride API (no live call in a test).

The row shapes are the measured samples of docs/design/BUS_TIMES_NOTE.md section 3.3 (public data, 2026-10-26): `gtfs_stops/list` rows
(`id, date, code, lat, lon, name, city`) and `gtfs_ride_stops/list` rows (`gtfs_ride_id, arrival_time` as UTC ISO with +00:00, `stop_sequence,
pickup_type, gtfs_route__line_ref, gtfs_route__route_short_name, gtfs_route__agency_name, gtfs_route__route_long_name,
gtfs_route__route_direction`). The fake also reproduces the pitfalls: a duplicated stop code, a terminus row (`pickup_type` 1), a
`gtfs_ride_stops` call without a time range or ride ids is a 400, a CSV `gtfs_ride_ids` is a 400."""
from __future__ import annotations

import datetime as dt
from typing import Any

from smplwise.services.transit import stride

LONG_25 = "ת. רכבת נתניה-נתניה<->בית גיל הזהב/השקד-נתניה-2#"
LONG_28 = "ת. רכבת נתניה-נתניה<->קניון השרון-נתניה-1#"
LONG_650 = "תל אביב-תל אביב יפו<->ת. רכבת נתניה-נתניה-1#"

STOPS = [
    {"id": 49655060, "date": "2026-10-26", "code": 33323, "lat": 32.328407, "lon": 34.858524, "name": "שדרות חיים וייצמן/הרצל", "city": "נתניה"},
    {"id": 49655059, "date": "2026-10-26", "code": 33324, "lat": 32.328, "lon": 34.8585, "name": "הרצל/חיים וייצמן", "city": "נתניה"},
    {"id": 49655061, "date": "2026-10-26", "code": 57453, "lat": 32.1, "lon": 34.8, "name": "תחנה כפולה", "city": "תל אביב יפו"},
    {"id": 49655062, "date": "2026-10-26", "code": 57453, "lat": 32.1, "lon": 34.8, "name": "תחנה כפולה", "city": "תל אביב יפו"},
    {"id": 49655070, "date": "2026-10-26", "code": 51439, "lat": 32.07, "lon": 34.78, "name": "דיזנגוף/ארלוזורוב", "city": "תל אביב יפו"},
    {"id": 49655080, "date": "2026-10-26", "code": 11111, "lat": 31.77, "lon": 35.21, "name": "יפו/קינג ג'ורג'", "city": "ירושלים"},
]


def ride_row(ride: int, at: dt.datetime, line: str, long_name: str, *, pickup: int = 0, direction: str = "2", seq: int = 4) -> dict[str, Any]:
    return {"gtfs_ride_id": ride, "arrival_time": at.astimezone(dt.timezone.utc).isoformat(), "stop_sequence": seq, "pickup_type": pickup,
            "gtfs_route__line_ref": 10000 + ride % 1000, "gtfs_route__route_short_name": line, "gtfs_route__agency_name": "אקסטרה",
            "gtfs_route__route_long_name": long_name, "gtfs_route__route_direction": direction}


class FakeStride:
    """`fake(path, params)` is a `stride.Fetch`. `rides` maps a stop id to its rows; `fail` makes every call raise."""

    def __init__(self, base: dt.datetime, *, stops: list[dict[str, Any]] | None = None) -> None:
        self.base = base
        self.stops = list(STOPS if stops is None else stops)
        self.calls: list[tuple[str, dict[str, Any]]] = []
        self.fail: stride.StrideError | None = None
        by_id: dict[int, list[dict[str, Any]]] = {
            # stop 33323: lines 25 / 28 in the next two hours, a terminus row of line 650 that must never show
            49655060: [ride_row(1, base + dt.timedelta(minutes=4, seconds=30), "25", LONG_25), ride_row(2, base + dt.timedelta(minutes=12), "28", LONG_28),
                       ride_row(3, base + dt.timedelta(minutes=20), "650", LONG_650, pickup=1), ride_row(4, base + dt.timedelta(minutes=34), "25", LONG_25),
                       ride_row(5, base + dt.timedelta(minutes=65), "25", LONG_25), ride_row(6, base + dt.timedelta(minutes=96), "28", LONG_28)],
            49655059: [ride_row(7, base + dt.timedelta(minutes=9), "11", "ת. רכבת נתניה-נתניה<->אזור תעשייה-נתניה-1#")],
            49655070: [],
        }
        self.rides = by_id

    def __call__(self, path: str, params: dict[str, Any]) -> Any:
        self.calls.append((path, dict(params)))
        if self.fail is not None:
            raise self.fail
        if path == "/gtfs_stops/list":
            if "code" in params:
                return [dict(s) for s in self.stops if s["code"] == int(params["code"])]
            limit, offset = int(params.get("limit", 100)), int(params.get("offset", 0))
            return [dict(s) for s in self.stops[offset:offset + limit]]
        if path == "/gtfs_ride_stops/list":
            if "gtfs_ride_ids" in params:
                if "," in str(params["gtfs_ride_ids"]) and not ("arrival_time_from" in params and "arrival_time_to" in params):
                    raise stride.StrideError("http_400")  # the CSV is not parsed as a list
                return [{"gtfs_ride_id": int(params["gtfs_ride_ids"]), "stop_sequence": 30, "gtfs_stop__name": "בית גיל הזהב/השקד"}]
            if "arrival_time_from" not in params or "arrival_time_to" not in params:
                raise stride.StrideError("http_400")  # "arrival_time_from and arrival_time_to are required"
            frm, to = stride.parse_time(params["arrival_time_from"]), stride.parse_time(params["arrival_time_to"])
            out: list[dict[str, Any]] = []
            for sid in str(params["gtfs_stop_ids"]).split(","):
                for r in self.rides.get(int(sid), []):
                    at = stride.parse_time(r["arrival_time"])
                    if frm <= at <= to:
                        out.append(dict(r))
            out.sort(key=lambda r: r["arrival_time"])
            return out
        raise stride.StrideError("http_404")

    def count(self, path: str) -> int:
        return sum(1 for p, _ in self.calls if p == path)
