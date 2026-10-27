# BUSSTATUS-297 - a public-transport provider outage is a calm state, not a system warning

Branch `pilot/BUSSTATUS-297`, cut from tag `v2.23.2`. Not merged, not tagged, not released. No migration. Fakes only (a local fake HTTP
server answering 503 and the recorded `FakeStride`); no call to the real provider.

## Why

On 2026-10-27 the external Open Bus Stride API answered HTTP 503 for hours. After the 30-minute grace Arx moved the whole-system health to
"warning: public transport data not updating" - a provider outage presented as a site fault - and the bus card on the TV board went to the
"unavailable" panel without any rows.

## Behaviour

| Area | Before | After |
|---|---|---|
| Health state of the source (`transit/health.view`) | `ok` / `stale` / `down`; `down` (age over the grace, 30 min) raised the system summary item "warn" | New state `source_down` while the provider is failing (5xx, 429, timeout/unreachable, empty/unreadable answer) and the last good data is younger than `outage_warn_h` (default 6 h). It becomes `down` (system warning) only after that. A fault on our side (a crash, no error recorded, 4xx) is still `down` at the grace |
| System health report (`/health/report`, `/health/summary`) | check `warn`, summary item "data not updating" | `source_down`: check status `ok` with the message "external data source unavailable (provider fault, not the site)" and the last good time; no summary item, so the overall status does not leave `ok`. After `outage_warn_h`: summary item "the public-transport source has been unavailable for a long time (provider fault)" |
| Digest for the TV (`transit/digest.build`) | past the grace: `expired`, no rows | While the provider is failing: state stays `cached` up to 24 h of cache age with the last scheduled rows (clock times, no countdown); new fields `source_down` and `partial` (the cached window ended before the display window: an empty list means "unknown", not "no buses"). Grace 0 still means "no last-known data" |
| TV card (side, strip, slide) | "not updated since HH:MM" / the unavailable panel | Rows stay; the header shows "updated N min ago" (N follows the screen's own stopwatch); one calm line "the external data source is unavailable - showing the last scheduled times"; a partial empty window says "no up-to-date schedule for this range"; past 24 h the expired panel names the source. Never blank |
| Backoff | 1, 2, 4, 8 minutes, then 8 minutes for ever | 1, 2, 4, 8, 15, 30 minutes (steady state: one try per 30 minutes - a community service is not hammered for hours); a numeric `Retry-After` header is honoured (never beyond one hour) |
| Settings | - | New installation setting `outage_warn_h` (1-72, default 6) in `transit.config`; the API validates it. No settings-screen field yet |

## Notes for the operator

* An installer sees the calm state in the health report (`transit` check, `meta.state = source_down`, `meta.last_good_at`) and in Settings;
  nothing opens a ticket (tickets-module rule).
* The in-memory source health is lost at a restart; the first failed pass after it (about 20 s) restores the `source_down` classification.
  Until then a stale cache past the grace reads as before.
* The nightly stop-catalogue download is separate: its failure only affects the stop search and does not feed this state.

## Tests

`smplwise_vms/backend/tests/test_busstatus_297.py` (fake 503 server incl. Retry-After and timeout, error classification, backoff cap,
health states and threshold, system report/summary, digest during an outage), `test_bustimes_295.py` (breaker sequence updated), and
`frontend/tests/unit-busstatus-297.spec.ts` (card wording, ago text, partial window, stopwatch).

The bundled UI (`npm run build:addon`) is NOT rebuilt on this branch; the release assembly rebuilds it.
