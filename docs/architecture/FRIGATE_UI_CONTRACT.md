# Frigate provider F1: the UI's API contract (NN5-F1B)

Status: **assumed shapes** until `pilot/NN5-F1A-backend` publishes its routes. The single place to adapt on the UI side is
`frontend/src/api/frigate.ts` (types, URLs, query building); fixtures live in `frontend/src/fixtures/frigate.ts` and the Playwright
mock in `frontend/tests/frigate-mocks.ts`. Source: `docs/research/FRIGATE_STUDY.md` (branch `pilot/NN5-frigate-study`), sections 5, 7, 8.
Frigate is read-only in F1; the only state Arx writes is the per-user "reviewed" flag, kept in Arx.

| Screen | Route the UI calls | Shape (see the types in `api/frigate.ts`) |
|---|---|---|
| Settings, connection test | `POST nvr/connection/test` and `POST recorders/{id}/connection/test` | `TestResult.capabilities?: FrigateCapabilities` (version, cameras total / enabled / disabled, detectors, `features` map, `retention.mode` motion / all / events + days, `restream`). The vendor catalogue entry `frigate` becomes `available` with fields host, http_port, username, password (+ advanced). |
| Health | `GET recorder-health` | each card may carry `frigate: FrigateHealth` (detectors with `skipped_fps`, cameras with `fps` / `state` ok / off / down / reconnects / stalls, `storage.hours_left`, `partial_coverage`). |
| Review list | `GET analytics/reviews?layer&camera_id&since&reviewed&object&limit&cursor` | `ReviewList`: `available` (false = no Frigate recorder: the UI shows the event windows), `items[]`, `counts` and `unreviewed` per layer (alert / detection / motion, for the camera / period / object filters, ignoring the reviewed filter), `facets.objects`, `next_cursor`, `stale`, `partial_coverage`. 403 = no permission, 404 = treated as "no Frigate". |
| Review detail | `GET analytics/reviews/{id}` | `ReviewDetail` = item + `tracked[]` (objects with `timeline[]` rows enter / zone / stationary / active / exit / attribute). |
| Reviewed state | `POST analytics/reviews/reviewed` `{ids, reviewed}` | `{changed: ids}`. Per user. Needs `analytics.review`. |
| Review still | `GET analytics/reviews/{id}/thumbnail.jpg` | image, fetched by the backend with the adapter token; the browser never talks to Frigate. |
| Live | `GET cameras` rows with `live_kind: "still"` and `still_refresh_s`; `GET cameras/{id}/snapshot.jpg` | a Frigate camera without a restream is a refreshing still; the tile re-reads `snapshot.jpg` no faster than every 5 s, never while the tab is hidden or the tile is out of view. |
| Open the recording | item `playback: {available, reason?: "no_coverage" \| "not_ready"}` | `available: true` navigates to the existing `#/investigate/playback?camera=&t=`; absent or false = the button is disabled with the reason. |

Permissions: `analytics.read` (read the screen and the routes; the shell's route gate also accepts `events.read`), `analytics.review`
(mark). A user with `events.read` only keeps the old event windows on the same route.

Hebrew strings: `frontend/src/i18n/he.ts` under `frigate.*`. Tokens only, so the restyle is CSS.
