# Nearby bus times on the notice board - design note (BUSMOCK-295)

Status: mock-up only. No product code, no migrations. Owner-facing mock-up (Hebrew, with decision questions):
`private/review/BUS_TIMES_MOCKUP_HE_2026-10-26.html` (gitignored folder; force-added on this branch).
Date of the API research: 2026-10-26. Every number below was measured that day from a workstation, read-only GETs.

## 1. What the owner asked for

The notice board (the public message screen) can show the buses that pass the stops near the building:
a switch in the screen settings, stop search by city / address / name, selection by stop code, a visible list of
"line, destination, minutes", and an editable time window (15 min, 30 min, 1 h, 2 h, ...).

## 2. Mock-up summary

Built on the approved notice board look (docs/design/mockups/notice-106/tv.html v4: tokens, Heebo, ivory/bronze day and
charcoal/champagne night, RTL, 1920x1080 canvas scaled to the screen, no scrolling, portrait 1080x1920 too).

* Layout A, side column: bus card under the clock, notice keeps the larger part; weather moves to the header.
* Layout B, bottom strip: cards (line badge, destination, minutes) under the notice; fits as many as the width allows, rest is "and N more".
* Layout C, full-screen rotation: a slide of its own in the rotation, one column per stop (up to 3).
* Row = line badge, destination (stop name only when several stops are mixed), minutes. "now" / "arriving" under 2 minutes, clock time (HH:MM) from 60 minutes.
* Real-time vs scheduled: a small broadcast icon (accent colour) vs a grey clock, legend in the card footer.
* Settings (a new "public transport" tab): switch, city + street/name filter, stop-code field, selected stops (reorder, remove), window (15/30/60/120/180 + free value 5-240), rows (3-10), layout, rotation seconds, refresh, group by line, clock instead of minutes, "hide buses closer than N minutes" (walking time), stale grace.
* Edge states: nothing in the window (plus the next bus beyond it), source down with last known data (clock times, no countdown, "not updated since 07:53"), source down too long (panel says unavailable; in layout C the slide is skipped), many lines (one row per line with up to three arrivals).

## 3. Data source: Open Bus Stride

Base URL `https://open-bus-stride-api.hasadna.org.il` (community project Hasadna "Open Bus", data derived from the Ministry of
Transport GTFS timetable and SIRI real-time feeds). Public, no key, no registration. OpenAPI at `/openapi.json`
(version string is a git hash `6bda55d25d1b155383da485f09a607d086866a3f`, i.e. it changes with every deploy).

### 3.1 Endpoints that matter (parameter names verified in openapi.json)

| endpoint | use | notes |
|---|---|---|
| `GET /gtfs_stops/list` | stop catalogue | filters: `city` (exact string), `code`, `date_from`, `date_to`, `limit`, `offset`, `get_count`. Fields: `id, date, code, lat, lon, name, city`. **No name search.** |
| `GET /gtfs_ride_stops/list` | planned arrivals at a stop | **requires** `gtfs_ride_ids` or `arrival_time_from` + `arrival_time_to` (400 otherwise). Filters: `gtfs_stop_ids`, `gtfs_stop__code`, `gtfs_stop__city`, ride start-time range, route filters (`gtfs_route__route_short_name`, `line_refs`, ...), `order_by`. Rows are flat and verbose (~1 KB each: stop, route and agency fields inline). |
| `GET /stop_arrivals/list` | actual arrivals (history) | only `actual_arrival_time`; returned `[]` for an upcoming ride. Not useful for a departures board. |
| `GET /siri_stops/list` | maps stop code to the SIRI stop id | `codes=33323` -> `[{"id":13031,"code":33323}]` |
| `GET /siri_ride_stops/list` | SIRI ride x stop | filters `siri_stop_ids`, `siri_ride__scheduled_start_time_from/to`. For rides in progress `nearest_siri_vehicle_location` was null (linked later by an ETL job). |
| `GET /siri_vehicle_locations/list` | real-time vehicle positions | filters: recorded-at range, lat/lon bounding box, `siri_routes__line_ref`, `siri_rides__ids`. Fields: `lat, lon, bearing, velocity, distance_from_journey_start, recorded_at_time`. |
| `GET /siri_rides/list`, `/siri_routes/list`, `/gtfs_routes/list`, `/gtfs_rides/list` | joins | |
| `GET /route_timetable/list` | planned timetable by line | `line_refs` + start-time range |

### 3.2 Findings that change the design

1. **No stop-name search.** Search = city (exact Hebrew string, 1178 distinct values; e.g. `תל אביב יפו` without a hyphen) then filter by name on our side, or by `code`. We should download the catalogue ourselves (see 4) and search it locally.
2. **Stops are a daily snapshot.** `gtfs_stops.id` is per date; the stable key is `code`. Today: 30,675 rows but only 30,086 distinct codes (duplicates exist, e.g. 57453, 51439), so deduplicate by code. Store `code`, resolve to `id` for the date when querying `gtfs_ride_stops`.
3. **Page size cap 15,000** ("due to abuse, maximum limit per request is 15000"). The full catalogue is 3 pages of ~2.2 MB each (10,000 rows = 1.4 MB, 0.85 s).
4. **Terminus rows must be dropped.** `pickup_type` 1 means no boarding (the line only ends there; e.g. line 650 at stop 33323). Show only `pickup_type == 0`.
5. **Times are UTC ISO strings** (`2026-10-26T06:15:18+00:00`). Israel left DST on 2026-10-25 (UTC+2 now). Convert on the server; never let the screen compute from UTC.
6. **Destination.** `gtfs_route__route_long_name` is `origin<->destination-city-direction#`. The part after `<->` without the trailing `-city-N#` equals the last stop of the ride (checked on line 25, both directions, via an extra call of the ride's last stop). So no extra call per ride is needed, but the string is a convention, not a contract: keep a fallback to the last-stop lookup (`gtfs_ride_ids=<id>&order_by=stop_sequence desc&limit=1`).
7. **List parameters are inconsistent.** `gtfs_stop_ids=49655060,49655059` (CSV) works. `gtfs_ride_ids=a,b` (CSV) returns 400 "arrival_time_from and arrival_time_to are required" (the CSV is not parsed as a list), a single id works, and repeating the parameter is accepted. `gtfs_stop__code` takes one value (CSV gave 422). Test every parameter shape in an integration test.
8. **Errors are real.** `/siri_snapshots/list?order_by=snapshot_id desc` returned HTTP 500 (a validation error in their model). The API is a thin layer over a research database; expect occasional 5xx.

### 3.3 Real samples (trimmed; public data)

```
GET /gtfs_stops/list?code=33323&date_from=2026-10-26&date_to=2026-10-26
[{"id":49655060,"date":"2026-10-26","code":33323,"lat":32.328407,"lon":34.858524,"name":"שדרות חיים וייצמן/הרצל","city":"נתניה"}]   (0.09 s)

GET /gtfs_ride_stops/list?gtfs_stop_ids=49655060,49655059&arrival_time_from=<now>&arrival_time_to=<now+2h>&limit=100&order_by=arrival_time asc
[{"gtfs_ride_id":160831256,"arrival_time":"2026-10-26T06:15:18+00:00","stop_sequence":4,"pickup_type":0,
  "gtfs_route__line_ref":10278,"gtfs_route__route_short_name":"25","gtfs_route__agency_name":"אקסטרה",
  "gtfs_route__route_long_name":"ת. רכבת נתניה-נתניה<->בית גיל הזהב/השקד-נתניה-2#","gtfs_route__route_direction":"2", ...}, ...]
   18 rows, 17.9 KB, 0.12-0.7 s for a 1 h / 2 h window.

GET /siri_stops/list?codes=33323          -> [{"id":13031,"code":33323}]
GET /siri_vehicle_locations/list?recorded_at_time_from=<now-10m>&...&limit=1&order_by=recorded_at_time desc
  newest row recorded_at_time 06:00:25Z when the call was made at about 06:06Z (the feed lagged by minutes);
  the same query inside a +-0.02 deg box around the Netanya stop for the previous 15 minutes returned [].
```

### 3.4 Latency, limits, reliability (measured)

* Latency: 0.05-0.15 s for stop lookups, 0.1-0.7 s for the ride-stops window query (first call slowest), 0.85 s for a 10,000 row catalogue page. 30 sequential calls in 2.9 s with no throttling and no rate-limit headers.
* Rate limits: none documented, none hit with ~60 requests. The 15,000 row error text ("due to abuse ... contact us") shows they react to heavy users. A product must stay polite: fetch only the stop codes in use, de-duplicated across all buildings, at most once a minute, with a descriptive User-Agent and a contact. We must not run N screens x N requests.
* Availability: community hosted, **no SLA documented**, schema can change at any deploy (hash version). Treat it as best effort.

### 3.5 Can a real-time ETA be derived?

Partially, and not cheaply. The documented path: SIRI vehicle positions (`siri_vehicle_locations`, with `distance_from_journey_start` and `velocity`) joined to the planned ride (`siri_ride` -> `gtfs_ride` via journey_ref / line_ref / scheduled start; the link columns `journey_gtfs_ride_id` were null on fresh rides) and to the stop's `shape_dist_traveled` from `gtfs_ride_stops`. ETA = (stop distance - vehicle distance) / speed, or schedule + current delay. Observed problems: the feed was minutes behind, a bounding box around a stop returned nothing for 15 minutes, and the ride-stop to vehicle link is filled by a later ETL job. Our recommendation: phase 1 ships **scheduled arrivals** (reliable, from `gtfs_ride_stops`) with the real-time marker designed in but off; phase 2 adds delay-corrected ETA only if a measured pilot at the owner's building shows the feed is fresh enough (target: positions younger than 90 s for the lines of interest). The Ministry of Transport SIRI feed itself and commercial providers need registration or payment and were not tested here.

## 4. Architecture recommendation (a customer screen never depends on a third party live)

1. **Stop catalogue**: a nightly job (04:00) downloads `gtfs_stops` for today (3 pages), dedupes by code, stores `code, name, city, lat, lon` locally (about 30k rows, a few MB). Settings search (city list, city + name filter, code lookup) runs on this table. Zero third-party calls when an installer configures the screen. If the nightly job fails, yesterday's table is still valid.
2. **Poller**: one background task that, every 60 s, collects the distinct stop codes of all boards that enabled bus times, and fetches `gtfs_ride_stops` for `now .. now + max(window) + 90 min` (a window wider than any display window, so the "next bus after the window" and the stale fallback exist). One request per stop code, shared by all boards. Per-source circuit breaker (back-off 1, 2, 4, 8 minutes) and a timeout of 10 s.
3. **Cache**: per stop code, the normalized rows (`line, destination, scheduled_time_utc, boardable, agency, realtime_eta?`) plus `fetched_at`. Because the timetable is planned data, a cached copy stays correct for hours even when the source is down. This is what makes "last known" safe.
4. **Display route**: the board asks our server (board token, same pattern as the notice feed; LAN listener included) and receives only the digest: the rows inside the board's window, `fetched_at`, `age_s`, `state` (`fresh | cached | expired | off`). The screen never knows the third party. No personal data leaves the server; only stop codes go out.
5. **Freshness rules** (defaults, editable): `fresh` age <= 3 min -> countdown in minutes; `cached` age 3 min .. grace (default 30) -> scheduled clock times, "not updated since HH:MM", no countdown; `expired` -> panel says unavailable (layout C skips the slide); `off` -> nothing rendered. Dropping departures whose time has passed is done on the server at each response.
6. **Observability**: surface source health in the existing system-health area (last success, age, error count), so an installer sees "bus data 40 min old" without opening the screen. No service-ticket action (tickets module rule).
7. **Settings model (names are suggestions)**: `bus.enabled`, `bus.stops[]` (code, optional display name), `bus.window_min` (5-240), `bus.max_rows` (3-10), `bus.layout` (A/B/C), `bus.rotation_s`, `bus.group_by_line`, `bus.min_eta_min`, `bus.show_clock`, `bus.stale_grace_min`. Module gate like the other notice-board options (off by default). All new strings in the existing i18n files, he first.

Load estimate: 20 buildings x 3 distinct stops (overlap ignored) = at most 60 requests per minute, about 1 KB per row x ~30 rows = 30 KB each, around 2 MB per minute in total, 0.1-0.7 s each. Acceptable but a reason to deduplicate and to cap stops per board (mock-up proposes 4).

## 5. Open questions for the owner

1. Which layout is the default (A side column, B bottom strip, C rotation slide), or is it chosen per screen?
2. Is scheduled-only acceptable for the first release, with a real-time ETA as a later phase? Real-time quality is unproven (feed lag observed); a pilot at the real building would settle it.
3. Maximum number of stops per screen (mock-up: 4), and the time-window list (15 / 30 / 60 / 120 / 180 minutes + free value up to 240).
4. How long may "last known" data be shown when the source is down (mock-up default 30 minutes), and what should the screen say after that?
5. Is a free community source (no SLA, may disappear or change) acceptable as the only source, or should a paid or Ministry-registered feed be evaluated first? Who owns the relationship if Hasadna asks us to slow down (contact in the User-Agent)?
6. The mock-up shows the next bus after an empty window ("next: line 28 at 08:59"). Keep it?
7. Group by line automatically when there are more arrivals than rows (mock-up recommendation), or a manual setting?
8. In the settings, a separate "public transport" tab (mock-up) or inside the existing display tab?
9. Do customers outside Israel matter? Open Bus Stride is Israel only; the mock-up and the catalogue are Hebrew/Israel specific.
10. Walking-time offset ("hide buses closer than N minutes"): wanted at all, and is one global value enough (mock-up) or per stop?
11. Should the same data also be offered on the phone app (home screen widget), or stay a notice-board feature?
