# CR-GO2RTC-ADAPTER-2436 - go2rtc access through one adapter

Branch `pilot/CR-GO2RTC-ADAPTER-2436`, cut from `origin/main` @ `665ec8f24` (2.43.4). Code-review master plan
(`private/code-review-2026-11-13/MASTER_PLAN.md`) section 3.2, wave 1 backend. No version bump, no CHANGELOG entry, no migration,
no new setting, no frontend change, no pixels. No device, NVR, go2rtc or Home Assistant was contacted: every test uses fakes
(`httpx.MockTransport` or in-memory doubles). Nothing in `private/`, `secrets/` or `management/*.json` was touched.

## Findings covered (review 03)

| Finding | Change |
|---|---|
| F03 (P1) one `GET /api/streams` per stream | (a) `Go2rtc.ensure_stream(..., streams=)` takes a listing the caller already holds and keeps that copy current after each write. `autosync.ensure_streams` fetches the listing once per run (lazily, at the point the first stream needed it, so the error order of a double fault is unchanged) and reuses it for every recorder/Frigate stream, the removed-stream deletes and the foreign count. (b) `Go2rtc.create_stream(name, src)` PUTs a name that cannot exist yet without listing; `playback._create_stream` (create and seek generations) uses it. |
| F04 (P1) clients without the shared TLS context | `cast_relay.go2rtc_fetch` now goes through the adapter (`Go2rtc.fetch_capped`, built on `Go2rtc._client_for`): shared TLS context and the reachability hooks, so a go2rtc outage the cast relay meets reaches `/health/video`. `media_query.call_bridge_media_query` and `cast_sessions._probe_get` pass `verify=nvr._ssl_context()`. Same requests, timeouts and redirect policy. |
| F10 (adapter half) | `Go2rtc.grab_probe(name, src, timeout_s=15.0)`: the same request and return shape as `camera_sources._grab_probe` (status, body up to `FRAME_MAX`, first 300 bytes of an error answer, `(0, b"", "timeout")` on a timeout), through the adapter client (TLS context + reach hooks). Not yet called; the caller switch is `CR-GO2RTC-OWNED-2436`. |
| F12 adapter robustness | (a) `list_streams`: a 200 whose body is not a JSON object is `ApiError(503, "media_error", details.reason="bad_body")` instead of an unhandled `ValueError`/`AttributeError`. (b) `frame_jpeg` checks `NAME_RE` too (like `frame_existing`). (c) `ws_url` refuses a name outside the namespace. Every current caller passes an owned, plain name. |
| F20 four hand-built RTSP addresses | `go2rtc.rtsp_url(host, port, path, user, password, query="")`; used by `hikvision_rtsp_url`, `wiskey_rtsp_url` and `playback._hikvision_playback_rtsp_url`. A golden test of the four addresses (Frigate included) with a user and password containing `@ : / #` was run against the unchanged code first (1 passed) and still passes. |

Internal: `Go2rtc._client_for(timeout_s)` is now the single client factory (`_client()` = `_client_for(6.0)`; `probe_video_codec`,
`_grab`, `grab_probe`, `fetch_capped` use it). Same construction as before (base, auth, timeout, shared TLS context, reach hooks).

## Namespace rule (review 03 section 3.0 acceptance list)

Every row still holds: `ensure_stream`, `create_stream`, `delete_stream` refuse a name without `smplwise_` (`create_stream` also
`NAME_RE`); the sync deletes only names it built that are listed and prefixed (now from the same run's listing); playback writes
only its own prefixed generation names; the cast relay reads only prefixed streams. `frame_jpeg` and `ws_url` gained the guard.
Tests assert only `smplwise_` names are ever written or deleted and that the foreign streams of the fixture are unchanged.

## Files

- `smplwise_vms/backend/smplwise/services/go2rtc.py`
- `smplwise_vms/backend/smplwise/services/autosync.py`
- `smplwise_vms/backend/smplwise/services/playback.py`
- `smplwise_vms/backend/smplwise/services/cast_relay.py`
- `smplwise_vms/backend/smplwise/services/media_query.py`
- `smplwise_vms/backend/smplwise/services/cast_sessions.py`
- `smplwise_vms/backend/tests/test_go2rtc_stream_sync_2436.py` (extended, nothing removed or weakened)
- `smplwise_vms/backend/tests/test_cast_relay.py` (extended)
- `docs/changes/CR-GO2RTC-ADAPTER-2436.md`

`tests/test_autosync.py` (in the row) needed no change.

## Compatibility with test doubles outside this branch

Several suites outside the file list replace `Go2rtc` with doubles whose `ensure_stream(self, name, src[, check])` has no `streams`
parameter and no `create_stream` (`test_media.py`, `test_recordings.py` - used by `test_autosync.py` and `test_playback_timing_t074.py` -,
`test_live_h265.py`, `test_frigate_restream.py`). Those files may not be edited here, so the callers stay compatible:
`go2rtc.takes_listing(client)` (signature check) decides whether the sync passes `streams=`; a double without it is called exactly as
before. Playback uses `create_stream` when the client has it, else `ensure_stream`. The real adapter always takes the new paths.
A follow-up could update those doubles and drop the fallback.

## Tests (local, Windows, `C:\cloude\smplwisebms\.venv` Python 3.12)

New tests (in the two extended files): one sync = 1 `GET /api/streams` (1.9.14 and 1.9.15 shapes; a second sync writes nothing);
the shared listing follows writes and feeds `check`; one playback create + one seek = 0 listings; `create_stream` guards and refusal;
golden RTSP addresses (4 builders) and the `rtsp_url` builder; three bad listing bodies; `frame_jpeg` and `ws_url` name guards;
`grab_probe` frame / error head / timeout / reach hook; cast fetch through the adapter client factory (timeout, cap, error body not
passed on, reach ok), cast fetch on an outage (503 + failure recorded), no go2rtc address; TLS context for the cast origin check and
the bridge media question.

| Command | Result |
|---|---|
| `pytest tests/test_go2rtc_stream_sync_2436.py -k golden` on the UNCHANGED `go2rtc.py` / `playback.py` (pinning) | 1 passed |
| `pytest tests/test_go2rtc_stream_sync_2436.py tests/test_cast_relay.py` | 92 passed |
| `pytest tests/test_autosync.py tests/test_playback_timing_t074.py tests/test_live_h265.py tests/test_health_go2rtc_2430.py tests/test_media.py tests/test_recordings.py tests/test_frigate_restream.py tests/test_cast_sessions.py tests/test_media_query.py tests/test_camera_sources_2410.py tests/test_frigate_live_0180.py tests/test_playback_release.py tests/test_camhealth091_295.py tests/test_outage_run_t035.py` | 221 passed |
| `pytest tests/test_asgi_wiskey_295.py` (alone) | 28 passed |

A wider sweep over every test module that references the adapter (about 48 modules plus `test_intercom*.py` and
`test_playback_*.py`) was started and stopped at 3% after 30 minutes: the workstation was heavily loaded by other runs. In that
partial run one test of `test_asgi_wiskey_295.py` failed once; the file run alone afterwards gave 28 passed, so it is recorded as a
load-timing failure, not a regression. The rest of that sweep is NOT_RUN.

NOT_RUN: the wider sweep beyond the files listed above, the full backend suite, the runner entry check (the lead combines the wave-1
branches), pixels (no UI change), any lab or real go2rtc measurement (the gain is a call count from fakes, not a timing).

## Skipped / left for later

- F03 (c) "one `httpx.Client` per `Go2rtc` instance for the calls of one operation": not done. `ensure_stream` must keep calling
  `self.list_streams()` with no arguments, because suites outside this branch patch `Go2rtc.list_streams` with a one-argument
  function and use the real `ensure_stream`. With (a) and (b) the listings this would have shared are mostly gone.
- F03 for manual camera sources: `camera_sources.ensure_stream_outcome` lists go2rtc on its own per stream; `camera_sources.py` belongs
  to `CR-GO2RTC-OWNED-2436`. The "1 listing" test covers recorder cameras. The live-open paths in `routers/media.py` are outside the row.
- F20 for Frigate: `recorders/frigate_restream.source_url` still builds its URL by hand (the file belongs to `CR-GO2RTC-OWNED-2436`);
  its output is pinned by the golden test, so the switch to `rtsp_url` there is a checked one-liner.
- F10 caller half (`camera_sources._grab_probe` -> `Go2rtc.grab_probe`): `CR-GO2RTC-OWNED-2436`.

## Behaviour

Identical for well-formed answers and owned names, with two intended differences from the findings: the cast relay's go2rtc fetches
now count toward the go2rtc reachability shown in `/health/video` (F04), and a non-object 200 listing is `media_error` instead of a
500 (F12). A run's final delete/foreign-count decision now reads the run's own listing (kept current by its writes) instead of a
second fetch at the end; a stream another process created in between is seen at the next run.

## Rollback

Revert the branch commit; no data, schema or configuration is involved.
