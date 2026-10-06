# Frigate provider F1: what the UI reads (NN5-F1B)

Status: written against `routers/frigate.py` of `pilot/NN5-F1A-backend` as it stood at local commit `0edf1bad` (not yet on origin when
the UI was written). The one place to adapt on the UI side is `frontend/src/api/frigate.ts` (wire types, adapters, queries); fixtures are
`frontend/src/fixtures/frigate.ts`, the Playwright mock is `frontend/tests/frigate-mocks.ts` (same routes). Frigate is read-only in F1;
the only state Arx writes is the per-user "reviewed" flag, kept in Arx.

| Screen | Route(s) the UI calls | Notes |
|---|---|---|
| Settings, connection test | `POST nvr/connection/test`, `POST recorders/{id}/connection/test` | coarse answer: `firmware` (the version text) and `channels` (cameras); `nvr_not_supported` carries `firmware` and `min_version`. The card shows what is known and says the rest appears after the save. |
| Settings, saved recorder | `GET frigate/{rid}/status`, `GET frigate/{rid}/cameras` | version, cameras enabled / all, detectors, retention mode + days, discovered `features` (core ones always listed), `live.mode`. |
| Health | `GET recorder-health` (`vendor_details` of a Frigate card) + `GET frigate/{rid}/cameras` for names | detectors with inference ms and `skipped_fps_total`, per-camera fps / reconnects / stalls (a camera in the camera list but not in the stats is off when `frigate_enabled` is false), `storage.hours_left`, partial coverage from `recording_policy`. |
| Review list | `GET frigate/recorders`, then per recorder `GET frigate/{rid}/reviews?severity&camera_id&reviewed&from&before&limit` and `GET frigate/{rid}/reviews/summary?days` | alert / detection tabs; counts from the summary (every camera, the period rounded up to days); the object filter is applied on the loaded page (the server has none); paging by `next_before`. 403 = no permission, 404 / empty recorder list = no Frigate (the screen is the event windows). |
| Motion layer | `GET frigate/{rid}/activity?from&to` | buckets of one camera at most 90 s apart become one span; capped at 24 h; spans have no still and no reviewed state. |
| Review detail | `GET frigate/{rid}/reviews/{id}` | detections count and sub labels; the drawer's timeline is the item's own start / end until a per-object lifecycle route exists (the drawer already renders `tracked[]` when it arrives). |
| Reviewed state | `POST frigate/{rid}/reviews/reviewed {ids, reviewed}` | grouped per recorder; optimistic, put back on failure. |
| Still of a review | the item's `thumbnail` (an absolute Arx path) | never a Frigate address. |
| Live | `GET cameras` (the camera list marks cameras of a Frigate recorder without a restream as stills, from `frigate/recorders` + `status.live.mode`), `GET cameras/{id}/snapshot.jpg` | the tile re-reads the still no faster than every 5 s, never while the tab is hidden or the tile is out of view. A server may also send `live_kind: "still"` and `still_refresh_s` per camera. |
| Open the recording | none yet | the plan route marks its anchors UNPROVEN, so the button is shown disabled with the reason (`PLAYBACK_PROVEN` in `api/frigate.ts` flips it). It uses the existing `#/investigate/playback?camera=&t=` entry. |

Permissions: the review screen needs `events.read` (the server's own check and the shell's route gate); marking is the caller's own state.

What the backend does not give the review screen yet (asked for): the room / floor of a camera on the plan (the card's "where" line shows
only when `area_name` / `floor_name` arrive), per-object lifecycle rows for the drawer, summary counts that honour a camera filter,
an object filter, and a motion count without reading the activity.

Hebrew strings: `frontend/src/i18n/he.ts` under `frigate.*`. Tokens only, so the restyle is CSS.
