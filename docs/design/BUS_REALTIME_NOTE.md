# Bus real-time arrival estimates - research and engine (BUSRT-295)

Date of the research: 2026-10-26 (Monday, about 10:15-10:45 Israel time). All third-party calls were read-only GETs from a workstation.
Code: `smplwise_vms/backend/smplwise/services/transit_realtime/`, tests `smplwise_vms/backend/tests/test_transit_realtime.py`,
recorded fixture `smplwise_vms/backend/tests/fixtures/transit_realtime/stride_line25_2026-10-26.json`.
This note extends `docs/design/BUS_TIMES_NOTE.md` (BUSMOCK-295) and the owner answers of 2026-10-26 (scheduled first, real time as a pilot).

## 1. Verdict

* **Open Bus Stride cannot give an honest real-time ETA today.** It stores vehicle positions with no ETA field, and its data was
  3-27 minutes behind the real world during a 27-minute poll. A bus that is 3-6 minutes from a stop is, to Stride, still at
  the depot or not reported at all. We built the derivation anyway (it works, section 4) and it is correct when the data is fresh, but at
  Stride's lag it degrades to "stale" or "scheduled" for most arrivals. Do not promise live minutes on Stride.
* **The real source is the Ministry of Transport SIRI-SM feed** (per-stop `ExpectedArrivalTime`, updated by the data centre about
  every 15 seconds for the snapshot filter). It needs an access key requested from the Ministry **and an allow-listed server IP**
  (section 3). It could not be tested: nobody here has a key, and we do not create accounts. The adapter is written against the public
  SIRI structure and is marked UNVERIFIED until a real response is recorded.
* The engine (cache, de-duplication, fallback ladder, delay, cancellation, stale handling) is source-independent, fully tested with
  recorded fakes, and falls back deterministically to scheduled times. The scheduled feature can call it today; with Stride it is honest
  (marks stale/scheduled), with the Ministry feed it becomes truly real time.

## 2. Measurements on Open Bus Stride

### 2.1 Freshness (poll every 60 s for 27 minutes, 08:15-08:42 UTC)

25 polls, 08:15:46-08:42:23 UTC (about 26.6 minutes). Age of the newest stored vehicle position **anywhere in Israel**: minimum 2.7 min, median 12.8 min, maximum 20.9 min.
Age of the newest loaded SIRI snapshot (snapshot ids are minutes): minimum 11.4, median 17.6, maximum 27.3 minutes. Newest position of line 25 (Netanya): 12.9 to 31.1 minutes old.
The snapshot endpoint itself answers in 0.12 s (median), so the API is up; the data behind it is late.

Other facts seen:
* `siri_snapshots` ids are per minute (`2026/10/26/08/14`); the ETL status `loading` was seen on a snapshot 24 minutes old at 08:14 UTC,
  and snapshots 07:53-08:08 were skipped entirely (the ETL jumped from 07:52 to 08:09), so there are also holes, not only lag.
* Line 25 (Netanya) newest position was up to 31 minutes old (few buses run; roughly one ride per 20 minutes).
* A row's `distance_from_siri_ride_stop_meters`, `siri_ride__gtfs_ride_id`, `first/last_vehicle_location_id` were null on fresh data.
  The documented ETL link from SIRI rides to GTFS rides is therefore unusable for fresh rides; our join is `line_ref` + planned start time
  (the first stop's planned time of the GTFS ride equals `siri_ride.scheduled_start_time`; 96 of 104 observed rides joined, the rest had no plan for the day, e.g. line 43429 returned zero GTFS rows).
* There is **no ETA / expected-arrival field** anywhere in the Stride SIRI tables (`SiriRideStop`, `SiriVehicleLocation`, `SiriRide`: positions only).
* Latency: snapshot/stop lookups 0.1 s; `siri_vehicle_locations` for one line 3-12 s (time range plus line filter is slow);
  the full engine call for a busy Tel Aviv stop took 20-30 s cold (5+ lines, one request each). Polling must be a background job, never inline in a screen request.

### 2.2 Derived ETA from positions: how it works and how accurate it is

Join the newest position of a SIRI ride (`distance_from_journey_start`, metres) to the GTFS plan of the same ride (`shape_dist_traveled`
per stop and planned time): delay = recorded time - planned time at that distance; ETA at a stop = planned time at the stop + delay.
Buses are assumed to keep their delay (persistence); there is no speed model. Evaluated offline on history (Stride keeps it) for
three lines on the same morning - line 25 Netanya (low frequency), and two long Tel Aviv area lines (2512, 2963) - 96 rides, 4,234 positions,
03:00-07:50 UTC. "Truth" = the interpolated time the vehicle crossed the stop's distance. Mean absolute error in minutes
(scheduled time vs delay-carried time), simulating a board that only sees positions that are `lag` minutes old, predicting `lead` minutes before arrival:

| line | feed lag | lead 5 min: sched / carried (covered) | lead 10 | lead 15 |
|---|---|---|---|---|
| 25 | 1 min | 3.5 / 2.0 (75% of targets covered) | 3.3 / 2.7 (37%) | 2.9 / 2.4 (16%) |
| 25 | 10 min | 2.9 / 2.6 (20%) | 3.6 / 3.6 (4%) | - |
| 2512 | 1 min | 13.6 / 3.4 (82%) | 15.7 / 5.6 | 17.4 / 7.4 |
| 2512 | 10 min | 17.0 / 7.0 (62%) | 19.0 / 9.4 | 21.4 / 12.6 |
| 2512 | 17 min | 20.0 / 10.8 (49%) | 22.2 / 13.8 | 23.6 / 16.3 |
| 2963 | 1 min | 10.9 / 2.3 (88%) | 11.8 / 3.6 | 12.6 / 4.6 |
| 2963 | 10 min | 12.5 / 4.4 (74%) | 13.2 / 5.6 | 14.3 / 7.2 |
| 2963 | 17 min | 13.6 / 6.2 (65%) | 14.7 / 7.8 | 15.7 / 9.3 |

Reading it honestly:
* On lines that run far from schedule (2512 and 2963 averaged +10 to +12 minutes late that morning; the scheduled time was wrong by 11-17 minutes), the carried delay cuts the error by 3-5x **when the data is fresh**. With a 17-minute-old feed it still halves the error, but the result is "a better guess", not a real-time time.
* On the Netanya line 25 the schedule itself is good (error 3 minutes) and the stop (33323) is only 1.7 km after the origin: a bus is observable for just ~4-6 minutes before it arrives. With any feed lag over a few minutes there is nothing to carry (2 of 161 targets covered at 17 minutes). **For line 25 at that stop, realtime via Stride is not achievable; scheduled is the honest answer.**
* Persistence ignores traffic changes ahead of the bus; accuracy falls with lead time (error grows roughly linearly with the distance still to go).
* Sample size is one morning, three lines. Treat the figures as order of magnitude, not as a guarantee. A pilot at the real building (continuous log, same method) should replace them.
* Live check at 08:30 UTC with the engine (read-only): a Tel Aviv stop returned 4 of 14 arrivals with an estimate, all `stale` with age 1000-1150 s (17-19 min); two buses at their first stop were `not_departed`; the other 8 had no position at all. Stop 33323: no ride had a position.

## 3. Official Ministry of Transport real-time feed (SIRI SM)

What the public documentation says (checked via the Open Bus project docs, which mirror the Ministry's interface description; the gov.il page itself returned HTTP 403 to automated fetch, so **the owner or an engineer must read it in a browser**: `https://www.gov.il/he/Departments/General/real_time_information_siri`, interface spec `ICD_SM_28_31.pdf` linked from it):

* Protocol SIRI-SM (stop monitoring). A request names the stop (`MonitoringRef` = stop code, the same code as GTFS `stop_code`/Stride `gtfs_stop.code`), and the answer lists vehicles on the way with `MonitoredCall.ExpectedArrivalTime`, `DistanceFromStop`, `VehicleLocation`, `RecordedAtTime`, `LineRef`, `FramedVehicleJourneyRef`, `OriginAimedDepartureTime`.
* JSON is supported (the Open Bus requester uses it). The snapshot filter `AllActiveTripsFilter` is generated by the data centre every 15 s and may be requested at most every 15 s; per-stop prediction requests exist as the standard SM request.
* **A key is required** (the Open Bus requester's configuration lists a Ministry key, `OPEN_BUS_MOT_KEY`), obtained by applying through the Ministry's website, and **the calls only work from an IP that the Ministry has allow-listed**: the Open Bus project reaches the feed through an HTTP proxy on its allow-listed server for exactly this reason (`HTTP_PROXY.md` in `open-bus-siri-requester`).
* No retrospective queries; real time only. Terms of use and rate limits for per-stop requests are in the spec and were not readable here.

**What the owner must do** (we cannot: no accounts, no credentials by agents):
1. Open the gov.il SIRI page above in a browser, read the access terms, and submit the Ministry's request for a real-time access key for SmplWise (company details and the intended use: displaying arrival times to building residents). Keep the key in the owner's secret store, not in the repo.
2. Give the Ministry the **fixed public IPv4 of the server that will make the calls**. Customers' buildings sit behind changing home/office NATs, so the product cannot call the Ministry from each installation. The practical design is **one central relay with a static IP** (a small VM, or the existing SmplWise cloud if it can offer a fixed egress IP; note that Cloudflare Workers do not have a fixed egress IP) that holds the key, calls the Ministry once per stop code, caches 15-60 s, and serves all installations. Installations then ask the relay for stop codes only; no personal data leaves the building.
3. Confirm the terms allow redistribution to customer screens and set a request budget (stop codes x one request per minute).
4. When the key works, record one real response for stop 33323 (line 25) and one busy stop, replace `SIRI_SAMPLE` in the tests with it, and only then enable `MotSiriSource`.

Alternatives not evaluated (no free public option found): commercial transit-data APIs (paid, key). Google/Moovit consumer apps are not an API.

## 4. Design and interface contract

### 4.1 Layers
`ScheduleProvider` (scheduled feature) -> `RealtimeEngine` (cache, ladder) -> `RealtimeSource` adapters (`StrideSource`, `MotSiriSource`). The engine never touches the network; adapters get an injected transport (`urllib_transport()` is the only network code and is used only in production wiring).

### 4.2 Types (`smplwise.services.transit_realtime`)
```
ScheduledArrival(stop_code:int, line_ref:int, line:str, destination:str, scheduled:datetime(aware),
                 ride_id:int|None, ride_start:datetime|None)    # ride_start = planned time of the ride's first stop = join key
Arrival(stop_code, line_ref, line, destination, scheduled, estimated:datetime|None,
        source:"realtime"|"stale"|"scheduled",
        status:"on_time"|"late"|"early"|"cancelled"|"not_departed"|"departed"|"unknown",
        delay_s:int|None, age_s:int|None)      # .best = estimated or scheduled
Result(stop_code, now, arrivals:tuple[Arrival], realtime_state:"live"|"degraded"|"down"|"off",
       fetched_age_s:int|None, last_error:str|None, matched:int)
Config(fresh_s=120, stale_s=600, ttl_s=60, backoff_max_s=480, early_late_s=60, horizon_s=5400,
       lookback_s=900, overdue_s=60, max_entries=64)
```
### 4.3 Calls
```
engine = RealtimeEngine(source|None, schedule=None, config=Config(), clock=None)    # one per process
engine.annotate(stop_code, scheduled_rows, now=None, window=None, include_departed=False) -> Result   # preferred: the scheduled feature passes ITS rows
engine.arrivals(stop_code, window_from, window_to, now=None, include_departed=False) -> Result        # uses the engine's own ScheduleProvider
```
* Never raises for source problems; a source error only shows in `realtime_state="down"` and `last_error`.
* `scheduled_rows` must carry `ride_start` (and for Stride also `ride_id`) to be joinable. A row without `ride_start` is returned as scheduled/`unknown`. The scheduled feature should keep `gtfs_ride_id` and the planned first-stop time per row (one extra field).
* The returned rows are sorted by `best` and filtered to the window by **estimated** time when there is one (a late bus appears where it will actually arrive); departed buses are omitted unless `include_departed`.
* The UI marker maps to `source`: realtime = live icon, stale = live icon greyed with "updated N min ago" (`age_s`), scheduled = clock icon. `status` drives late/early/cancelled text. Minutes are computed by the caller from `best`.

### 4.4 Fallback ladder (deterministic, per arrival)
| situation | source | estimated | status |
|---|---|---|---|
| observation age <= fresh_s | realtime | prediction (>= now) | on_time / late / early (|delay| <= early_late_s is on_time) |
| fresh_s < age <= stale_s | stale | prediction, shown with `age_s` | same |
| age > stale_s, no observation, bad join, prediction > 3 h from schedule | scheduled | None | unknown |
| stale prediction already > overdue_s in the past | scheduled | None | unknown |
| cancelled (Ministry feed) | realtime/stale | None | cancelled |
| vehicle still at its first stop | scheduled | None | not_departed |
| vehicle already past the stop | (omitted) | None | departed |
| no source configured | scheduled | None | unknown, state `off` |

`realtime_state`: `live` = source reachable and nothing stale (check `matched` - 0 means the feed answered but joined no bus); `degraded` = only stale predictions; `down` = last fetch failed (last known data keeps ageing by the ladder); `off`.

### 4.5 Cache, de-duplication, failure
One entry per stop code shared by all boards and callers; at most one source fetch per `ttl_s` (60 s) per stop, concurrent callers wait for the single in-flight fetch; a ride not seen by the last fetch may trigger one early refetch, at most every 15 s. Failures keep the last observations and retry with back-off 60/120/240/480 s. LRU bound `max_entries`. Observations older than 3 x `stale_s` are discarded. The Stride adapter caches each ride's plan (static for the day) in a 512-entry LRU, so a steady state costs one `siri_vehicle_locations` request per distinct line per minute per stop (slow: 3-12 s each, run it in the background poller).

## 5. Tests (all local, no network; `urlopen` is blocked in the module)
27 tests: delay arithmetic, plan cleaning, crossing time, destination parsing; the Stride adapter on a recorded real fixture (late bus gets an estimate within a minute of the recorded crossing while the schedule is 3.5 minutes off; departed, not-departed, stale, unjoined rides); engine semantics (late/early/on-time, cancelled, overdue, absurd delay, age ladder, window by estimate, no source); failure and back-off with last-known; sharing one fetch across boards, single-flight under 6 threads, early refetch limit, LRU bound; the Ministry SIRI parser (synthetic structure, tolerant of garbage).

## 6. Honest limits
* Stride: lag 3-25 minutes with holes; derived estimates only; persistence model; ride join by planned start time (a convention, not a contract); API has no SLA and slow line queries. Use it only as a degraded source.
* Ministry adapter: written from public descriptions, never run against the live feed; field names (`Cancellation`, `StopPointRef` handling) may need adjusting on the first recorded response.
* Evaluation covers one morning and three lines; no evening, weekend, rain, or other cities.
* The engine predicts the delay of the vehicle that is already on the road; it cannot predict a bus that has not left its origin (shown as scheduled / `not_departed`) or a cancellation before the feed says so.
* Recommendation: ship scheduled first (as decided), keep the engine wired with `StrideSource` off by default (or on with the stale marker, owner's call), and start the Ministry key process now because it is the long pole (approval time and a static-IP relay).
