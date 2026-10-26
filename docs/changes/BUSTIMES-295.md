# BUSTIMES-295 - nearby bus times on the notice board (scheduled times + a labelled ESTIMATE with the bus's distance)

Target release 2.23.0 (its own release after 2.22.0; owner scope change 2026-10-26). Branch `pilot/BUSTIMES-295` (from `origin/main` 223fff4ad). Design: `docs/design/BUS_TIMES_NOTE.md` and the approved mock-up
`private/review/BUS_TIMES_MOCKUP_HE_2026-10-26.html` (both on `origin/pilot/BUSMOCK-295`); owner answers: `private/review/BUS_TIMES_ANSWERS_2026-10-26.md`.

## What the owner gets
A notice-board screen can show the buses that pass the stops near the building: line, destination, minutes (or the clock time). Nothing is on by
default. Installation level (הגדרות › תחבורה ציבורית, a new tab): the module switch, up to 4 stops, the general rules. Screen level (the board's
תצוגה tab): show it or not, which of the configured stops, one of three layouts, the window, the rows, group-by-line.

Owner answers 1-12 and where they land:

| # | answer | where |
|---|---|---|
| 1 | layout chosen per screen: side column / bottom strip / rotating slide | `display.transit.layout` = `side` / `strip` / `slide`; TV `transit-view.ts` |
| 2 | minutes up to an hour, then the clock; configurable | installation `clock_after_min` (default 60, 0 = always the clock) |
| 3 | real-time marker + legend | an ESTIMATE derived from Stride vehicle positions (pilot/BUSRT-295 engine) is marked with the small broadcast icon and the legend "הערכה" / "Estimate"; the distance line is below |
| 4 | max 4 stops, per installation; each screen picks which | `transit.config.stops` (cap 4), `display.transit.stops` (empty = all configured) |
| 5 | settings tab "Public transport" | `#/system/transit`, he + en (`i18n/transit.ts`) |
| 6 | window list 15/30/60/120/180 + free value | `display.transit.window_min` 5-240; the select offers the list and "free value" |
| 7 | last-known data 30 min, configurable | installation `stale_grace_min` (default 30, 0 = none) |
| 8 | no buses in the window: message + next bus | digest `next`; TV "no buses in ..." + "next on schedule" |
| 9 | too many lines: group by line automatically; per-screen choice | `display.transit.group` = `auto` / `always` / `never` (server side, `digest._arrange`) |
| 10 | public source + server cache + last known | Open Bus Stride, `transit_cache`, `fresh / cached / expired / off` |
| 11 | building offline = source down | the TV ages the digest on its own stopwatch (`transit-logic.effective`): past 3 min no countdown, past the grace "unavailable" |
| 12 | release 2.23.0 | scheduled rows + the labelled estimate (owner 26.10: the Ministry real-time key is deferred) |
| 13 | row wording (26.10) | `800 מ׳ מהתחנה · הערכה בעוד 3 דק׳` / `800 m away · est. in 3 min`; from `clock_after_min` on `הערכה ב-HH:MM` / `est. at HH:MM`; scheduled rows keep the plain minutes / clock and never a distance |
| 14 | distance rules | shown only on an estimate whose vehicle position is no older than the freshness limit (installation `position_fresh_min`, default 5, next to the 30 min grace); rounded to 50 m under 1 km and 0.1 km above (server side, `digest.round_distance`); `display.transit.show_distance` per screen (null = the installation default `show_distance`, default on) |
| 15 | refresh (26.10) | SCREEN refresh `refresh_s` (installation default 20 s, range 10-120, per-screen override `display.transit.refresh_s`); SOURCE poll `poll_s` (default 30 s, range 15-300; below 30 s only with `poll_floor_ack`) |

## Architecture (a customer screen never depends on the third party live)
1. `services/transit/stride.py` - the Open Bus Stride client with the measured pitfalls handled: times are UTC (parsed to aware UTC, local text made
   on the server), only `pickup_type == 0`, stops keyed on the stable `code` (the day's ids resolved once per code per day), CSV for `gtfs_stop_ids`,
   a single id for `gtfs_ride_ids`, a mandatory time range, pages of 10,000, one error type `StrideError`. The destination comes from
   `route_long_name` (`...<->dest-city-N#`) with a last-stop lookup as the fallback (at most 10 per pass, cached by ride id).
   User-Agent `SmplWise-Arx-BusTimes/<version> (+https://smplwise.com/arx)`.
2. `services/transit/catalogue.py` - nightly (04:00 local) download of `gtfs_stops` into `transit_stops` (deduplicated by code); the settings search
   (city list, city + name words, a code or a code prefix) reads only that table. A failed download keeps yesterday's table and records the error
   (retry no sooner than 30 minutes). A manual "refresh now" runs in the background.
3. `services/transit/poller.py` - one thread, every `poll_s` seconds (default 30), only while the module is on AND the notice boards are on AND an enabled board shows transit.
   One request per DISTINCT stop code shared by every screen, for `now .. now + widest display window + 90 min` (so "the next bus after the window"
   and the last-known fallback exist). A circuit breaker (1, 2, 4, 8 minutes, then stays at 8) stops the calls while the source fails. Calls are slow (3-12 s), which is why they run only here, in the background, never on a screen's request; the loop is single-flight by construction (one thread, one pass at a time).
4. `services/transit/digest.py` + the display route `GET /api/v1/notices/display/{slug}/transit` (board token, same limits and refusals as the feed,
   also on the LAN listener): a digest of OUR cache with `state` (`fresh` age <= max(3 min, 3 x `poll_s`), `cached` up to the grace, `expired`, `off`), `fetched_at`,
   `age_s`, local `hm` text, the rows inside the window (passed rows dropped, walking-time offset applied, grouped when asked), the next bus after an
   empty window, and per-stop `columns` for the slide layout. The route never calls the third party (a test pins it).
5. Source health: `services/transit/health.py` -> the system health report (`checks[id=transit]`, only while in use) and one summary item when the data is
   unusable; the settings tab shows last success, data age, error count, last error. NO service-ticket action (a test pins that the module never
   imports the tickets code).

## Real-time contract and the estimate (owner updates 2026-10-26)
- `services/transit/provider.py`: `ArrivalProvider.arrivals(stop_code, window_start, window_end) -> list[Arrival]`. An Arrival has `line, line_ref, dest, agency, ride`
  (gtfs_ride_id), `ride_start` (the join key to the vehicle positions), `at` (SCHEDULED, UTC `...Z`), `est` (ESTIMATED, nullable), `est_age_s` (the age of the vehicle
  POSITION the estimate came from) and `distance_m` (road metres from the bus to the stop at that position, nullable). A provider raises `StrideError` when its
  planned-arrivals source fails (breaker) or `UnknownStop`. The poller takes a provider (`POLLER.start(db, settings, provider)` / `poll_once(db, provider, now)`);
  a bare Stride fetch callable is wrapped in the default `RealtimeProvider`.
- `RealtimeProvider` = `ScheduledProvider` (planned arrivals) + the engine of pilot/BUSRT-295 (`services/transit_realtime`, cherry-picked): per ride the planned stop list
  (`shape_dist_traveled`, one request per ride, kept for the day, at most 12 new rides per pass) and per line the newest SIRI vehicle position in Stride; the delay of the
  vehicle against the plan is carried to the stop (`expected = planned_at_stop + delay`), the distance is `stop_dist - vehicle_dist`. Any failure of this layer leaves the
  rows scheduled and never trips the breaker. Cancelled rides are not listed; rides whose vehicle already passed the stop are dropped.
- Digest row: `scheduled_time`, `estimated_time` (nullable), `quality` = `realtime` (an estimate whose position is no older than `position_fresh_min`, source answering; shown as
  "estimate") | `scheduled` (no estimate) | `stale` (an estimate too old, or the source is down: the schedule is shown), `age_seconds`, and - only for `realtime` rows and only
  when distances are on - `distance_m` (rounded) and `position_age_s`. `at` = the instant the minutes count to. Top level: `realtime`, `refresh_s`, `fresh_s`,
  `position_fresh_s`, `show_distance`.
- TV: an estimate row gets the accent broadcast icon; with a distance it also gets a second line `distance - estimate` (distance FIRST; in RTL the DOM order is the
  reading order). The fit step hides these lines before it scales the rows below 0.8 or drops any row/card. The distance disappears on the screen by itself when the position
  ages past the limit between two fetches (the position keeps ageing on the screen's stopwatch). While the source is down nothing is drawn as live.
- Honest limit (measured 2026-10-26): Stride's newest positions are often minutes old, and for a stop close to the line's origin (e.g. line 25, stop 33323) no position
  exists in time - those rows stay scheduled, without a distance. Real real-time through the Ministry key is a later step.

## Refresh controls
Two separate controls (Settings > Public transport > "Data refresh", and the board's display tab):
1. SCREEN refresh `refresh_s` - how often the TV page fetches the digest. It reads OUR cache only (cheap). Installation default 20 s (10-120), per-screen override
   `display.transit.refresh_s` (empty = the default). The server puts the value in the digest; the page schedules the next fetch from it. Between two fetches the countdown
   keeps ticking on the page (minutes are computed from the instants every second).
2. SOURCE poll `poll_s` - how often the server asks the public source, per distinct stop (default 30 s, 15-300). Stride is a community service: below 30 s the owner must
   confirm (`poll_floor_ack`; the API answers 422 otherwise, a stored value under the floor without the confirmation is lifted to 30 s when used). Still one request per
   distinct stop, one background thread, back-off retained. The poller runs only while a board with transit is enabled, as before.
Thresholds follow the cadence: `fresh` = max(3 min, 3 x `poll_s`); the estimate/distance limit is its own setting (`position_fresh_min`). Every write is audited with the
changed keys (`transit.settings.update`); the per-screen values go through the board PATCH (validated, 422 on a bad value).

## Data
Migration `0179_transit_bus_times.sql` (additive: `transit_stops`, `transit_cache`). **Number 0179 is PROVISIONAL (next free after 0178): it is renumbered after 2.22.0
(TPLV2 may take 0179)** (origin/main has 0177 as its highest; 0178 is taken by another branch). The content does not depend on the
number; the test asserts the schema_migrations row by the number the file carries, so the integrator updates that one number.
Settings keys: `transit.config` (module switch, stops, general rules) and `transit.catalogue` (snapshot status) - both in `backup.SETTINGS_KEEP`
(a restore never switches the module on or carries stops). The tables are operational data, not project tables (the notice-slides precedent).
Per-screen settings live in the board's display JSON (`display.transit`, no migration; an old board reads the defaults).

## Permissions (the notice board's pattern)
Reading the settings: `system.configure` or `notices.boards` (installation scope). Writing the installation part and the manual catalogue refresh:
`system.configure`. A screen's own choices: `PATCH /notices/boards/{id}` (`notices.boards`); a screen can only pick among the installation's stops.
Audit: `transit.module.enable`, `transit.module.disable`, `transit.settings.update`, `transit.catalogue.refresh` (no row when nothing changed).

## TV page
`frontend/src/notice-tv/transit-logic.ts` (pure), `transit-view.ts` (markup), additions at the end of `tv.css` (TV tokens only, day + night, RTL,
logical properties, no inline style), `main.ts` (digest fetched on its own timer, `refresh_s` seconds, in-place redraw, `fitBus`). No scrolling: the rows
scale to 0.6, then trailing rows / cards are dropped and "and N more" counts them. The countdown counts to the server's instant (clock offset kept).
- `side` (A): a panel under the clock; the clock and the weather give it room. Template 3 has no side column: it takes the strip.
- `strip` (B): cards under the notice, one more row of the page grid.
- `slide` (C): the slide joins the rotation (rotation mode only, like the promo slides; in "all together" / "focus" it falls back to the strip), one column
  per stop; an expired board skips it.
States: fresh (minutes; "now" under 2 min), cached (clock times + "not updated since HH:MM"), expired (unavailable), no buses (message + next bus).

## Not in v1 / known limits
- The estimate is derived from Stride positions (often minutes old); the official Ministry real-time feed (needs a key) is a later step.
- The destination relies on the route-name convention; a ride whose name does not follow it costs one extra call (cached).
- A stop that does not exist in today's snapshot is stored with an empty cache (the screen shows "no buses" with no next bus).
- Israel only (the catalogue and the source are Israeli).
- Pixel baselines (`pixel-bustimes-295.spec.ts`) are generated on the runner only; until then that spec skips itself.

## Tests
- Backend: `tests/test_bustimes_295.py` and `tests/test_bustimes_rt_295.py` with a recorded fake (`tests/transit_fake.py`; no live call), the engine's own `tests/test_transit_realtime.py`.
- Frontend: `tests/unit-bustimes-295.spec.ts` (logic, markup, model, words), `tests/notice-tv-bustimes-295.spec.ts` (layouts x sizes x themes: no scroll,
  inside the canvas, RTL, states), `tests/pixel-bustimes-295.spec.ts` (written; baselines on the runner).

## Rollback
Switch the module off (Settings > Public transport); the screens show nothing. The previous version ignores the two tables and the extra keys in a
board's display JSON.

## Changelog fragment for the 2.23.0 assembly (bilingual)
Under "What was added - מה נוסף":
- **English:** Nearby bus times on the notice board (BUSTIMES-295): Settings > Public transport (module switch, up to 4 stops found in a nightly-refreshed local catalogue, when minutes give way to the clock, how long last-known data is shown, walking time, how often a screen refreshes - 20 s by default - and how often the server asks the public source - 30 s by default); each board screen chooses whether to show it, which stops, one of three layouts (side column, bottom strip, rotating slide), the window, the rows, grouping by line, its own refresh and whether to show the bus distance. Scheduled times, plus a labelled estimate derived from vehicle positions: "800 m away - est. in 3 min". Screens read only the server's cache and show last-known times, then "unavailable", when the source is down. Off by default: Settings > Public transport > switch, then the board's display tab > "Public transport".
- **עברית:** זמני אוטובוסים בתחנות ליד הבניין בלוח ההודעות (BUSTIMES-295): הגדרות › תחבורה ציבורית (מתג מודול, עד 4 תחנות מקטלוג מקומי שמתעדכן כל לילה, מתי דקות הופכות לשעה, כמה זמן מציגים נתונים אחרונים, זמן הליכה, כל כמה זמן מסך מתרענן - 20 שניות כברירת מחדל - וכל כמה זמן השרת שואל את המקור הציבורי - 30 שניות כברירת מחדל); כל מסך בלוח בוחר אם להציג, אילו תחנות, אחת משלוש פריסות (עמודה צדדית, פס תחתון, שקף מתחלף), חלון זמן, מספר שורות, קיבוץ לפי קו, רענון משלו והאם להציג את מרחק האוטובוס. זמנים לפי לוח זמנים, ולצידם הערכה מסומנת שנגזרת ממיקומי כלי הרכב: "800 מ׳ מהתחנה · הערכה בעוד 3 דק׳". המסכים קוראים רק את העותק בשרת, ובנפילת המקור מציגים את הזמנים האחרונים ואחר כך "אינו זמין". כבוי כברירת מחדל: הגדרות › תחבורה ציבורית › מתג, ואז לשונית התצוגה של הלוח › "תחבורה ציבורית".
