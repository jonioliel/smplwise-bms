# HEALTH-GO2RTC-FOLLOWUP-2431 - the video service: notice delay setting, and choosing among the go2rtc services found

Branch `pilot/HEALTH-GO2RTC-FOLLOWUP-2431`, cut from `pilot/HEALTH-GO2RTC-2430` (e8b727ab8). That branch boards 2.43.0 unchanged; this
one follows it.

## Owner answers (11.11) applied

1. **Administrators' notice delay**: 15 minutes by default (was 5), and an administrator setting.
   Settings › וידאו ומדיה › "התראה על שירות וידאו לא זמין": 1 / 5 / 15 / 30 / 60 minutes. Key `media.video_notice_after_min`
   (integer, `PATCH /settings`, `system.configure`; any other value is refused with 422; a corrupt stored value reads as 15).
   `notify_sources.health_tick` holds the `video_service` item of `system.health` for that delay. The other `system.health`
   items keep the policy's `after_s`. `media_reach.ATTENTION_AFTER_S` (documentation of the default) is now 900.
2. Unchanged as asked: `/health` stays `degraded` while the video service does not answer; the administrator's hint still names the
   technical option (`go2rtc_url`); retries for other failures still stop at 30 s.
3. **New: the go2rtc services found, and the choice of one.** Details below.

## Discovering the video services (`services/video_services.py`)

All infrastructure calls still go through the add-on's single door, `services/self_update.py`. Its allow-list gains two READ calls:

| Call | Why | Guard |
|---|---|---|
| `GET /addons` | list the installed add-ons | no body |
| `GET /addons/{addon}/info` | state, version, image and hostname of one go2rtc add-on | `{addon}` must match `SLUG_RE`, must be a go2rtc slug from the last listing (`remember_video_addons`), and must not be Arx itself. No other method uses an `{addon}` path |

The add-on already has the `manager` role, which covers both calls. No new permission is needed.

- A **candidate** is an add-on whose slug or name contains `go2rtc`, with at most 8 candidates. The info call adds the image as a
  second sign (`image_go2rtc`).
- **Address**: `http://<hostname>:1984`. The hostname is the Supervisor's `hostname` field, or else its own rule (the slug with `_`
  replaced by `-`). It must be a single internal label (`HOSTNAME_RE`), never an IP address and never a dotted name.
- **Probe**: each started candidate gets one `GET /api` (1.5 s timeout, parallel, no credential).
  - Any 2xx answer is `ok`, and the go2rtc version is read from it.
  - 401 or 403 is `auth_required`.
  - A connection failure or timeout is `unreachable`.
  - A stopped candidate is `not_probed`.
- **Cache**: results are kept for 20 s. `?fresh=true` bypasses the cache, at most once every 5 s.
- **Writes**: none. No stream is listed, created, changed or deleted here. Arx still writes only `smplwise_` streams, on whichever
  service is in use (`services/go2rtc.py`).
- **Outside the add-on** (no Supervisor), the list answers `supported: false, reason: no_supervisor`.

## The choice, and how `go2rtc_url` is read now

Before this change, `go2rtc_url` was only an add-on option (`config.load_settings`, falling back to `GO2RTC_URL`), frozen into
`Settings` at start-up. The new **stored override takes precedence** over it:

- **Where it is stored**: the installation setting `media.video_service_selection` = `{slug, name, url, at, by}`. Only a candidate of a
  fresh discovery can be stored, chosen by slug. A typed address is never accepted (the body is `{slug}` only, `extra=forbid`).
- **Kept out of backups**: the setting is in `backup.SETTINGS_KEEP`. It is never exported and never restored, because it is an
  address on this installation's internal network.
- **At start-up**: `video_services.apply_at_startup` overlays the choice right after the secrets store and before the NVR overlay, so
  every recorder's settings inherit it. A corrupt or ill-shaped row is ignored and the add-on option applies.
  `app.state.go2rtc_option_url` keeps the option's own value for "back to the add-on option".
- **When it is chosen**: `apply_live` replaces `app.state.settings` (with the children of every recorder) and resets `media_reach`. One
  probe runs at once. From then on every request uses the new service: live, playback, snapshots and the stream-sync button.
- **The janitor**: the 30 s loop in `main.py` now reads `app.state.settings` instead of its start-up copy. Playback lease expiry, the
  orphan sweep and the reachability probe therefore act on the service in use. Without this, a playback stream created on the new
  service would only be deleted on the old one.
- **Still on the old address until a restart**: the periodic camera discovery and stream sync keep their start-up copy. The answer
  therefore says `restart_recommended: true`, and the UI offers "הפעלה מחדש עכשיו" (the existing `POST /system/restart`).

## API (`routers/video_services.py`; `system.configure` at installation scope; local sessions only)

All three routes are in `remote_channel.BLOCKED_ON_REMOTE`.

| Method | Path | Result |
|---|---|---|
| GET | `/api/v1/system/video-services[?fresh=true]` | The service in use, the stored choice and the candidates (see below) |
| PUT | `/api/v1/system/video-services/selection` | Body `{slug}`. 404 `video_service_unknown`, 409 `video_services_unsupported`, 422 for an extra key. Audited as `media.video_service.select` (slug, name, state, probe; no address) |
| DELETE | `/api/v1/system/video-services/selection` | Back to the add-on option. Audited as `media.video_service.clear` |

What `GET` returns:

- `current`: the service in use.
  - `source`: `selection`, `option` or `none`.
  - `address`: host:port only. User info and path are stripped, so a password in the option URL is never shown.
  - `state`: the reachability state.
  - `slug`: the matching candidate.
- `option_address` and `selection`.
- `candidates[]`: `slug`, `name`, `state`, `version`, `image_go2rtc`, `address`, `probe`, `go2rtc_version` and `current`. The internal
  URL is not returned.
- `checked_at` and `restart_recommended`.

## UI (Hebrew, RTL; never names the platform; addresses and versions stay LTR)

- `components/sw-video-service-picker.ts` (logic in `api/video-services.ts`):
  - Each candidate shows a state badge, a line with the state, whether it answers and its version, and its address.
  - "השתמש בזה" appears on every candidate except the one in use, followed by an inline confirmation (stopped candidates get an extra
    sentence) and then the PUT.
  - Other actions: "חיפוש מחדש" (fresh), "חזרה לכתובת מתצורת התוסף", and the restart offer.
  - One GET per tab serves every picker mounted within 15 s.
- Settings › וידאו ומדיה gains a new card, "שירות וידאו", before the go2rtc streams card, plus the notice-delay row in the media
  settings card.
- The administrator's "שירות הווידאו לא זמין" notice on a tile now shows the compact picker under the existing hint. Conditions: a
  non-compact tile, `system.configure`, and not the remote channel. The compact picker shows at most two candidates (in use first,
  then running and answering), and nothing at all if the list fails.
- The administrators' `system.health` notice text lists the services last found (from the discovery cache only, with no network call
  in the monitor), for example "· שירותי וידאו שנמצאו: go2rtc (פועל), … — אפשר לבחור בהגדרות › וידאו ומדיה › שירות וידאו".

## Tests

The commands and results are in the segment report. Every command listed there was actually run.

- **Backend**: `tests/test_video_services_2431.py` is new.
  - Discovery: only go2rtc add-ons are listed, other add-ons are never read, stopped candidates are not probed, and only GET calls
    are made.
  - The cache and the fresh rate limit.
  - The `{addon}` door.
  - No Supervisor, and a refused listing.
  - The hostname rule and the address display.
  - Only administrators can use the routes.
  - The choice applies at once, is audited without the address, wins over the option after a restart, and is dropped by the
    back-to-option action.
  - Refusals: an unknown slug, a typed URL, and no Supervisor.
  - A corrupt row leaves the option in force.
  - Local-only and kept out of backups.
  - The notice delay: default 15, only the offered values, 5 minutes honoured, a corrupt value reads as 15, and the notice text lists
    the candidates.
- **Backend, updated**:
  - `test_health_go2rtc_2430.py`: the notice now waits 15 minutes.
  - `test_self_update_s3.py`: the exact allow-list.
- **Frontend unit**: `tests/unit-video-services-2431.spec.ts` covers the delay choices, when "use this" is offered, the order, the
  badge and line, and the words used.
- **Mocked e2e**: `tests/evidence-video-services-2431.spec.ts` covers the list, the order, confirm before send, only the slug sent, the
  new current service with the restart offer, the compact form's two rows, and nothing shown on a refusal.

## Known limits

- The real Supervisor listing and a real switch between two go2rtc add-ons have not been run in the lab. That needs the owner's go,
  because it changes which service the lab uses.
- Frigate's built-in go2rtc does not count as a candidate. Its API listens inside the Frigate container, and its slug and name do not
  say go2rtc.
- A service chosen while the stored go2rtc password belongs to another service answers 401. The probe shows `auth_required`, and the
  password is changed in Settings › Secrets.

## Revert

Revert the branch commits, then clear the setting (`DELETE /system/video-services/selection`, or delete the row
`media.video_service_selection`). Without the row, the add-on option applies as before. Migrations: none.
