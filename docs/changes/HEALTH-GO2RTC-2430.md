# HEALTH-GO2RTC-2430 - truthful video-service health, one clear message, admin notice

Branch `pilot/HEALTH-GO2RTC-2430`, cut from `main` @ `a5618fad6` (2.42.1). No version bump, no CHANGELOG entry, no migration, no new
setting. No device, NVR, go2rtc or Home Assistant was contacted; nothing in `frontend/src/home/`, `frontend/src/map/`, `private/`,
`secrets/` or `management/*.json` was touched.

## The lab finding (read-only, 11.11)

The add-on option `go2rtc_url` pointed at a go2rtc add-on that had been stopped. Every Arx call to it failed with a DNS / connect error
(`GET /media/streams` 503 `media_unavailable`, playback session create 503, the stream sync never succeeded since start, a screen
retried live every ~35 s). The relay refused the live socket with 4503, but HA ingress delivered it as a plain close 1000, so the
player never knew why. `GET /health` still said `status: ok`, `go2rtc_configured: true`; only `/health/summary` had a warning. Live
video was silently down for about two days.

## What changed

### Backend

- `services/media_reach.py` (new): process-memory tracker of "is the video service reachable". Fed for free by every go2rtc HTTP call
  the add-on already makes (`services/go2rtc.py`: an httpx response hook = any HTTP answer is `reachable`; `_wrap` records a
  connection failure - `ConnectError` (DNS, refused), `ConnectTimeout`, `UnsupportedProtocol`; a read timeout of a slow answer counts
  neither way). State `reachable | unreachable | not_configured | unknown` with `since`, `down_for_s`, `last_ok_at`, `last_error_at`,
  `last_error` (exception class name only, never an address), `failures`, `retry_in_s`.
- A light probe (`GET /api` of go2rtc) runs only when due: every 60 s while reachable AND nothing else touched go2rtc; while unreachable
  on a backoff of 10, 20, 40, 60, 60 ... s. One probe at a time (non-blocking lock). Driven by the existing 30 s janitor loop
  (`main.py`) and by `GET /health/video`.
- `GET /api/v1/health`: new `media` block (the view above) and `degraded_reasons`. **Top-level `status` is now `degraded` while the
  video service is unreachable** (`degraded_reasons: ["media_unreachable"]`), `ok` otherwise. Checked before changing it: the Supervisor
  watchdog reads `/healthz` (`config.yaml` `watchdog: http://[HOST]:[PORT:8099]/healthz`), which is unchanged and always `{"status":"ok"}`
  - so a down video service can never restart the add-on in a loop. No repo client tests `/health`'s `status` for `ok` (the smoke
  script reads `db.ok` / `data_dir_writable`; the soak sampler reads counters; the HA card does not call it). `go2rtc_configured` stays.
- `GET /api/v1/health/video` (new, every signed-in user): the same view, with at most one due probe; what screens ask before retrying.
- `/health/summary`: a new item `video_service` (`error`, "שירות הווידאו לא זמין — אין וידאו חי ואין ניגון הקלטות", with `since`) in both
  modes whenever go2rtc is configured and unreachable; the older "סנכרון הזרמים ל־go2rtc נכשל" warning is suppressed while it shows
  (same cause, one item). The live overview's attention card and the top-bar pill read this list.
- Administrators' notice: `notify_sources.HEALTH_ITEMS["video_service"] = "שירות הווידאו לא זמין"` - the existing `system.health`
  source (recipients `managers`, held for its `after_s` = 300 s, resolved when the condition ends). So the notice appears after 5
  minutes unreachable and is resolved on recovery; a short go2rtc restart makes no row.
- Live / playback sockets (`routers/media.refuse_media`): when the stream cannot be made because the video service is down or not set
  (`media_unavailable` / `media_not_configured`, or the tracker says unreachable) the socket is accepted and one
  `{"type":"error","value":<code>,"message":"שירות הווידאו לא זמין","media":<state>}` frame is sent before close 4503 - the reason
  survives ingress. Other stream-level refusals keep the bare 4503 as before. The relay's `upstream_unavailable` frame (live and
  playback) now carries `media: <state>`. The playback socket without go2rtc uses the same frame.

### Frontend

- `api/video-service.ts` (new): one watch per tab. A player that learns the service is down calls `markDown()`; the watch re-asks
  `GET /health/video` on a backoff of 5, 10, 20, 40, 60, 60 ... s (one request in flight); a failed check is `unknown`, never "up";
  on recovery every waiting tile is told.
- `components/sw-live-player.ts`:
  - the relay's error frame saying the service is down -> "שירות הווידאו לא זמין", the snapshot stays, a "נסה שוב" button, and a hint:
    administrators (`system.configure`) "בדקו שהשירות פועל ואת הגדרת שירות הווידאו (go2rtc_url) בתצורת התוסף", everyone else
    "ננסה שוב אוטומטית; אם זה נמשך, פנו למנהל המערכת". No own retry timer; it reconnects by itself when the watch reports recovery
    (a recording tile, `retry` off, keeps the message with "נסה שוב");
  - a socket that closes before any frame (the ingress case: 1000 while connecting) or with a bare 4503 asks `GET /health/video` first;
    down -> the same message, otherwise the old handling unchanged;
  - a tile mounted while the tab already knows the service is down opens no socket;
  - the older "שרת הווידאו אינו זמין" (close 4503 / `upstream_unavailable`) now uses the same wording "שירות הווידאו לא זמין".
- `api/closed-errors.ts`: `media_unavailable` / `media_not_configured` get plain Hebrew sentences (playback session create and every
  screen using `describeError`), no component name.

Retries for other failures keep the player's existing backoff (3 s doubling to 30 s); the 60 s cap applies to the video-service-down
case, which is the one the lab hit.

## Tests (run on this workstation, Windows, heavily loaded by other agents)

| Command | Result | Exit |
|---|---|---|
| `pytest tests/test_health_go2rtc_2430.py` (new, 9: tracker + backoff, probe only when due, slow answer not counted, /health degraded + /healthz ok + /health/video, not configured, summary item, admin notice after 5 min + resolve, live socket frame before 4503 x2) | 9 passed | 0 |
| `pytest` related suites (test_media, test_rbac_camera_scope, test_intercom_media, test_ha_camera_live, test_live_h265, test_recordings, test_health_summary, test_health_report, test_health_process_stats, test_notify_sources, test_nvr_less, test_installation_capabilities, test_autosync, test_kiosk_role, test_xsecfix_297, test_xsecfollow_297, test_video_sub_fallback_2402, test_camera_sources_2410, test_wkf01f02_295, test_provision_disabled, test_go2rtc_big_media, test_playback_timing_t074, test_rbac_matrix, test_custom_roles, test_wall, test_wkaudin_295, test_outage_run_t035, test_stream_codecs, test_permcam63_shared_spaces, test_soak_dbgrowth_2412) | 3 failed (named below), every other test passed | 1 |
| rerun: `pytest tests/test_rbac_camera_scope.py tests/test_playback_timing_t074.py tests/test_health_go2rtc_2430.py tests/test_intercom_media.py tests/test_media.py tests/test_health_summary.py tests/test_notify_sources.py` | 194 passed | 0 |
| `npx tsc --noEmit` (frontend) | clean | 0 |
| `npx playwright test -c playwright.unit.config.ts tests/unit-health-go2rtc-2430.spec.ts tests/unit-warmup-polish-2421.spec.ts` | 13 passed | 0 |
| `SW_BASE_URL=http://127.0.0.1:5238/ npx playwright test tests/evidence-health-go2rtc-2430.spec.ts --project=desktop --workers=1` (new, 3; Vite dev server on 5238) | 3 passed | 0 |
| same server: `evidence-warmup-polish-2421`, `evidence-video-transport-2400`, `evidence-video-sub-fallback-2402`, `evidence-webrtc-first`, `evidence-wall-live-cap`, desktop, 2 workers | 41 passed, 1 skipped, 3 failed (timeouts / counts under load) | 1 |
| rerun of those 3 alone (`evidence-wall-live-cap.spec.ts:229`, `evidence-warmup-polish-2421.spec.ts:71`, `evidence-webrtc-first.spec.ts:198`), 1 worker | 3 passed | 0 |
| `python scripts/gate/lint_spec_waits.py` on the two new specs | 0 findings | 0 |

The 3 backend failures of the first related run: the two `live socket` cases of `test_rbac_camera_scope` expected a bare close after one
`receive_text` - the helper now reads until the close (the 4503 follows the new error frame); `test_playback_timing_t074`'s
`inspect.getsource(media._live_relay)` read a shifted source because `routers/media.py` was edited while that run was going
(an artifact of the run, not of the code) - both covered by the rerun row.

NOT_RUN: the full backend suite and the full Playwright gate (the lead runs them on the runner); pixel baselines; the built preview;
`tests/evidence-remote-video.spec.ts` (live fixture backend only - its expected text was updated to the unified "שירות הווידאו לא זמין");
the lab / real add-on with HA ingress and a stopped go2rtc (not allowed in this task). `contracts/API_INVENTORY.md` is generated at
release and does not list `GET /health/video` yet.

## Revert

Revert the branch commits. Nothing is stored; the tracker is process memory.

## Owner questions (Hebrew)

1. מצב כללי ב־`/health`: כשהווידאו לא זמין, השדה `status` מחזיר עכשיו `degraded` (ה־watchdog של התוסף בודק `/healthz` ולכן לא תהיה הפעלה
   מחדש בלולאה).
   א. להשאיר `degraded` (מומלץ)
   ב. להחזיר `ok` ולהסתפק בבלוק `media`
2. ההתראה למנהלים מופיעה אחרי 5 דקות ללא שירות וידאו (ניתן לשינוי במדיניות "תקלת מערכת").
   א. 5 דקות מספיק
   ב. דקה אחת
   ג. 15 דקות
3. הרמז למנהל מזכיר את שם ההגדרה `go2rtc_url`.
   א. כך טוב
   ב. בלי שם טכני גם למנהלים
4. ניסיונות חוזרים בתקלות אחרות (לא שירות הווידאו) נשארים עד 30 שניות.
   א. להשאיר
   ב. להאריך גם אותם עד 60 שניות
