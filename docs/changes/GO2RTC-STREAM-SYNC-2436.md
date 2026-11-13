# GO2RTC-STREAM-SYNC-2436 - stream sync that does not rewrite, honest stream state, a "replaced" playback socket

Branch `pilot/GO2RTC-STREAM-SYNC-2436`, cut from `origin/main` @ `ab7894837` (2.43.1). No version bump, no CHANGELOG entry, no
migration, no new setting. No device, NVR, go2rtc or Home Assistant was contacted (the lab evidence of 12.11 was only read, on this
workstation); nothing in `private/`, `secrets/` or `management/*.json` was touched.

Source: the read-only lab measurement of 12.11 (`docs/lab/LAB-VIDEO-MEASURE-2026-11-12.md` on `pilot/LAB-MEASURE-2436`, bugs 1, 4
and 5; raw evidence in `private-evidence/lab-2026-11-12/`, not committed).

## 1. The stream sync rewrote every stream (bug 1)

**Finding.** `Go2rtc.ensure_stream` compared `existing.sources == [src]`. go2rtc 1.9.15 reports each producer's source without its
user and password (lab: 32/32 of our NVR streams differed from the URL Arx builds in the credentials only), so the comparison never
matched and every live open and every 10-minute sync did `DELETE` + `PUT` of each stream - about 200 writes an hour to a go2rtc
shared with the intercom project (2,482 `updated` lines in 6,000 log lines).

**Change** (`services/go2rtc.py`):

- `compare_source(reported, wanted)` compares by parts: scheme and host (case-free), port (the scheme's default filled in: rtsp 554,
  rtsps 322, http 80, https 443, rtmp 1935 ...), path (percent-decoded), the query and go2rtc's `#` options as multisets (any order).
  Verdicts: `same`; `same_if_hidden` (equal in everything go2rtc shows; the userinfo is absent, empty or a mask such as `***` / `xxxxx`,
  or a query value is masked); `different` (any visible part differs, including a user or password go2rtc does show). A source
  without a host (`ffmpeg:<url>#...`) is compared with any `user:pass@` taken out.
- A hidden part cannot be compared, so `same_if_hidden` is "unchanged" only when this process itself last wrote exactly that source to
  that stream: `_WRITTEN` holds `sha256(name + source)` per stream (never the source; cleared on `delete_stream` and on a refused
  `PUT`). A `same` verdict (a go2rtc that shows the whole source, 1.9.14 and older) is remembered too, so an in-place upgrade to
  1.9.15 writes nothing.
- Cost: after an add-on restart the first sync writes each stream once (it cannot know what go2rtc holds). That is deliberate: a
  changed NVR password is an add-on option, i.e. always a restart, and must still reach go2rtc. From then on nothing is written while
  nothing changes: 32 writes per restart instead of ~200 per hour.
- Unchanged: which streams are touched (`ensure_stream` / `delete_stream` still refuse any name outside `smplwise_`), the
  `DELETE` + `PUT` of a stream that really changed, the WisKey frame registry (`_REGISTERED`).

## 2. `GET /media/streams` said `online: false` for every stream (bug 4)

**Finding.** `online` came from `list_streams`: true when a producer had `medias` or `receivers`. In go2rtc 1.9 an idle on-demand
stream's producer is `{"url": ...}` only and `consumers` is `null` (lab 12.11: 41/41 ours idle before and after the run, every one
played in under a second). So `online` meant "go2rtc pulls it right now", and between viewers that is false for every stream - the
diagnostics card showed a list of `idle` words and the health probe "(0 פעילים)", which reads as "all down".

**Change.**

- `list_streams` reads the real 1.9 shapes: a producer counts as connected when it carries any `core.Connection` key (`medias`,
  `receivers`, `bytes_recv`, `remote_addr`, `format_name`, `id`); `consumers` (`null` or a list) is counted. `online` = a connected
  producer **or** a consumer attached (a viewer go2rtc is still dialling for). Non-dict entries are tolerated.
- `StreamInfo.state`: `active` | `idle` (a source is set; go2rtc connects it when someone watches) | `no_source`; `StreamInfo.consumers`.
- `GET /media/streams` adds `state` and `consumers` to each of our streams (`online` kept, same meaning, now documented).
- `health_report._probe_go2rtc`: "N זרמים שלנו (A פעילים כעת, I מוכנים)" and a new `idle` count.
- UI, the only screen that reads the field (`system-diagnostics`, card "go2rtc"): each row says `פעיל כעת · N צופים` / `מוכן (מתחבר
  בצפייה)` / `ללא מקור` (`api/media.streamStateLabel`; an older server without `state` falls back to `online`), with
  `data-stream-state`. The card shows only with a backend and an administrator, so no pixel baseline renders it.

## 3. A replaced playback socket closed 1000 through ingress (bug 5)

**Finding.** A playback socket of an old generation (another seek owns the session) is closed 4410; through HA ingress it arrived as
1000, so the player showed "ended" (while playing) or a lost connection, and `investigate-playback`'s `FINAL_CODES` (4410 = do not
resume) never matched.

**Change.**

- Backend (`routers/playback.close_replaced`): both paths - an old generation connecting, and a generation replaced while it streams -
  accept the socket if needed, send one text frame `{"type":"replaced","value":"superseded"}`, then close 4410 (a direct connection
  still sees the code). Same pattern as HEALTH-GO2RTC-2430's error frame before 4503.
- Frontend (`sw-live-player`, `api/socket-replaced.ts`): the frame marks the socket; its close with any non-application code (< 4000)
  is handled as 4410 - "הסשן הוחלף", no retry, `player-status` code 4410 (so `investigate-playback` does not resume it). Without the frame
  nothing changes (a close 1000 while playing is still the end of the recording).

## Tests

Run on this workstation (Windows, loaded by other agents). Backend with the main checkout's `.venv`.

| Command | Result | Exit |
|---|---|---|
| `pytest tests/test_go2rtc_stream_sync_2436.py` (new, 37: write-once per process on 1.9.14 / 1.9.15 shapes, upgrade writes nothing, changed password / host / port / path rewritten, delete then create, namespace guard, 19 `compare_source` cases, digest-only memory, idle / active / no_source from the fixtures, consumer-only active, `/media/streams` fields, health detail, replaced frame + 4410 on both paths) | 37 passed | 0 |
| `pytest` related suites: the new file + test_autosync, test_camera_sources_2410, test_camhealth091_295, test_ha_camera_live, test_health_go2rtc_2430, test_health_report, test_live_h265, test_media, test_multi_nvr_live, test_outage_run_t035, test_playback_cap / _race / _release / _scrub_2341 / _stall_settings / _stress_2332 / _sync / _timing_t074, test_recordings (stale-generation case updated to read the frame and the 4410), test_video_sub_fallback_2402, test_rbac_camera_scope, test_frigate_restream, test_provision_playback | 490 passed, 1 skipped, 1 failed | 1 |
| the failure, `test_health_go2rtc_2430.py::test_the_probe_runs_only_when_due_and_backs_off`, alone | failed 3 runs in a row, then passed 4 of 4; also passed once with this branch's backend changes stashed | - |
| `npm run build` (tsc + vite) | clean | 0 |
| `npx playwright test -c playwright.unit.config.ts tests/unit-go2rtc-stream-sync-2436.spec.ts tests/unit-health-go2rtc-2430.spec.ts` | 6 passed | 0 |
| `SW_BASE_URL=http://127.0.0.1:4291/ npx playwright test tests/evidence-go2rtc-stream-sync-2436.spec.ts tests/evidence-health-go2rtc-2430.spec.ts tests/evidence-playback-stall.spec.ts tests/unit-playback-scrub.spec.ts --project=desktop --workers=2` (built preview, demo mode) | 22 passed | 0 |
| `python scripts/gate/lint_spec_waits.py` on the two new specs | 0 findings | 0 |

The flaky test is not caused by this branch (it does not touch `services/media_reach.py`): `Reach.tick` decides "no outcome was
recorded" by `last_contact == before`, and on Windows `time.time()` can return the same value for the failed probe and the next
successful one (about 15 ms clock resolution), so the success is taken for "no answer" and the next probe is scheduled 10 s later.
Linux (the runner) has a fine clock. Proposed follow-up: compare an outcome counter instead of the timestamp.

NOT_RUN: the full backend suite and the full Playwright gate (the runner entry check runs them); pixel baselines (no baseline renders
the changed rows - the go2rtc card needs a backend and an administrator; not refreshed); the lab / real add-on behind HA ingress
(read-only task, no lab writes).

## Revert

Revert the branch commits. Nothing is stored; `_WRITTEN` is process memory.

## Known limits

- The fixtures (`tests/fixtures/go2rtc/streams_1_9_14_idle.json`, `streams_1_9_15_idle.json`, `streams_1_9_15_active.json`) are
  synthetic values in the recorded shapes: the 1.9.14 idle shape is the lab audit of 04.11, the 1.9.15 idle shape the lab of 11.11 /
  12.11 (credentials missing - measured by category only, the raw URLs were never stored), the active shape is go2rtc 1.9's
  `core.Connection` JSON (no active capture exists in the evidence). The lab check after install: the add-on log has no
  `go2rtc stream ... updated` lines between restarts, and `GET /media/streams` shows `active` while a tile plays.
- Whether go2rtc 1.9.15 masks the userinfo (e.g. `***@`) or drops it, both are handled; a password that literally is `xxxx` or `***`
  is treated as hidden, which only costs the one write after a restart.
