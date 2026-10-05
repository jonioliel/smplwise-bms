# CR-028 — Cast live video to screens ("שדר למסך")

**Status:** PROPOSED (research and design, 2026-10-05) with a safe, read-only preparation built on `pilot/cast-prep`
(section 9). Nothing casts yet. The owner asked on 2026-10-05 for (1) a clear marking in Settings, per media screen and player,
of whether it can receive a cast of our video and through which technology, and (2) a "שדר למסך" button on the live screen
(a single camera and the wall) in a future version. **Builds on:** CR-015 (screens and the remote), CR-016 (players; the three
read-only probes of the owner's systems), CR-008 (the remote channel), CR-024 (several recorders). **Number:** 027 is taken twice
(`CR-027-MOBILE-PRESENCE-PUSH` on the pilot branch, `CR-027-PLAN-STUDIO-ADVANCED` on `origin/integ/201`); 028 is free on every
branch (checked with `git ls-tree`, 2026-10-05). No device, recorder, go2rtc instance or Home Assistant system was contacted for
this document; the facts about the owner's systems come from the probes of 2026-10-01 and from the code of this repository.

## תקציר בעברית

**מה ביקשת.** סימון ברור בהגדרות › מולטימדיה, לכל מסך ונגן, האם הוא יכול לקבל שידור וידאו מ־Arx ובאיזו טכנולוגיה (Google Cast,
AirPlay, DLNA, ועוד), וכפתור "שדר למסך" במסך החי - למצלמה בודדת ולקיר - בגרסה עתידית. עכשיו הכנות, הפיצ'ר אחר כך.

**מה נבנה עכשיו (בטוח, קריאה בלבד).** השרת מחשב לכל התקן מדיה מהנתונים שכבר משוקפים (האינטגרציה, דגלי היכולות, סוג ההתקן, הדגם)
את "דרך השידור" ואת רמת הביטחון: **מאומת / כנראה / לא ידוע**. בהגדרות › מולטימדיה נוספה עמודה "שידור" (צ'יפ בכל שורה, במסכים
ובנגנים) ושורה "שידור למסך: …" בטופס הפתוח עם הסיבה. אין כפתור, אין פקודה, אין כתיבה לשום מכשיר.

**הממצאים העיקריים.**
1. הדרך האמינה היחידה שמתועדת ונתמכת בכל שלוש המערכות שלך היא **Google Cast** (Chromecast / Google TV / Android TV / Nest Hub):
   מקלט Cast מנגן HLS (H.264 + AAC) מכתובת ברשת המקומית. במערכות שלך יש 9 / 10 / 1 ישויות Cast; בשתי מערכות גם מסכי LG מגיעים רק דרך Cast.
2. **הטלוויזיה לא יכולה למשוך וידאו מ־Arx היום**: התוסף חשוף רק דרך Ingress (שדורש התחברות של משתמש), ו־go2rtc אינו מנפיק אסימון
   לזרם. לכן נדרש **ממסר HLS בתוסף על פורט מקומי אופציונלי** (כמו פורט ההתראות של Provision) עם אסימון קצר-מועד לכל שידור - הטלוויזיה
   לא רואה פרטי NVR, ולא את go2rtc. חלופה מהירה יותר למעבדה: ישויות מצלמה של Arx ב־Home Assistant ו־`camera.play_stream`,
   אבל אז כל משתמש של תשתית המערכת רואה את המצלמות האלה - לא מומלץ כמוצר.
3. **הגשר חוסם היום כל `play_media` עם כתובת** (מדיניות CR-015). נדרש גשר 0.7.0 עם שירות ייעודי אחד וצר (`cast_stream`) שמקבל
   רק כתובת שמקורה בממסר של Arx.
4. **קיר מצלמות**: ההמלצה היא זרם פסיפס (ffmpeg בתוך go2rtc, עד 4 אריחים מזרמי המשנה, H.264) שנשלח כזרם אחד; דף קיר מרונדר
   דורש אפליקציית מקלט Cast רשומה ומארח HTTPS ונחסם על וידאו HTTP מקומי - לא מומלץ; "קרוסלה" (מצלמה אחרי מצלמה) היא הגיבוי
   למארחים חלשים.
5. **הפעלה מרחוק**: המשתמש ב־/arx רק לוחץ; השידור עצמו קורה ברשת המקומית (התוסף ← הגשר ← הטלוויזיה מושכת מהממסר).

**שאלות להכרעה (סעיף 11).** 1) נתיב הווידאו: (א) ממסר בתוסף על פורט מקומי - מומלץ, (ב) ישויות מצלמה בתשתית המערכת - מהיר למעבדה
בלבד. 2) ברירת המחדל: (א) כל מסך "מאומת" מותר לשידור מיד, (ב) מנהל מאשר כל מסך בנפרד - מומלץ. 3) איזה מכשיר Cast ישמש לבדיקה
הפיזית הראשונה (סעיף 8.3 מתאר בדיוק מה יקרה ואיך עוצרים).

**זמנים (שעות סוכן).** שלב 0 (ההכנה הזו): נעשה. שלב 1 - מצלמה בודדת ל־Google Cast, כולל גשר 0.7.0, ממסר, הרשאה, ביקורת, עצירה
ותפוגה, כפתור ובורר: כ־28 שעות, בגרסה M הבאה אחרי האישור. שלב 2 - קיר (פסיפס): כ־14 שעות + מדידת CPU במעבדה. שלב 3 -
DLNA / AirPlay / דפדפן Samsung: כ־10 שעות, רק כשיש מכשיר כזה אצל לקוח.

## 1. Goal and the one-line answer

A screen that already has a Cast receiver can show one of our camera streams within a few seconds, started from the live screen
(locally or through the remote channel) and stopped from the same place or by a timer; nothing in the chain hands the TV a
recorder credential, a go2rtc credential or an Ingress session. The reliable, documented path on every one of the owner's
systems is **Google Cast playing HLS** served by **a token-gated relay inside the add-on**; every other technology is either
unverified (DLNA, AirPlay, the Samsung browser) or ruled out (HA Cast dashboards, LG webOS without Cast). The wall is a
**mosaic stream**, not a rendered page.

## 2. Scope

| Phase 0 (this branch, built) | Phase 1 (next M release after the owner's approval) | Phase 2 | Phase 3 | Not planned |
|---|---|---|---|---|
| The capability detection (section 4), the "שידור" column and form line in הגדרות › מולטימדיה, tests | "שדר למסך" for ONE camera to Google Cast devices: bridge 0.7.0 `cast_stream`, the add-on's HLS relay on an optional host port, sessions, permission `media.cast`, per-screen allow, audit, stop / extend / timeout, the button and the picker | The wall: a mosaic stream (go2rtc + ffmpeg) of up to 4 sub streams, cast as one stream; the carousel fallback | DLNA renderers, Apple TV (AirPlay), the Samsung browser page - each only when such a device exists on a customer system and was verified live | HA Cast dashboards (`cast.show_lovelace_view`), a Cast receiver app of our own, casting playback / recordings, audio talk-back through the TV, casting to phones |

## 3. Findings: how each technology can show our video

### 3.1 What Home Assistant offers

| Path | How it works | What it needs | Verdict |
|---|---|---|---|
| `media_player.play_media` with `media_content_type: "application/vnd.apple.mpegurl"` (or `video/mp4`) and `media_content_id: <URL>` | The integration hands the URL to the device; the **device** fetches it. Cast: the default media receiver plays HLS / fMP4 (H.264, AAC). DLNA: the renderer fetches progressive MP4 / MPEG-TS over HTTP. Apple TV: `apple_tv` streams a URL (HLS ok). `webostv`: `play_media` is **not** a URL player. Samsung (`samsungtv_smart`): type `url` opens the TV's **browser** on that address. | A URL the TV can fetch on the LAN without a session; the bridge allow-listing the call (today `media_policy.py` **refuses** every `play_media` type but `send_key` / `send_text`, CR-015 section 5.2) | **The path.** Needs bridge 0.7.0 with one narrow service (3.4) and a URL source (3.3) |
| `camera.play_stream {media_player, format: hls}` | HA's `stream` component opens the camera entity's `stream_source`, remuxes to HLS and calls `play_media` with `http://<internal_url>/api/hls/<token>/master_playlist.m3u8`; the token is HA's own per-stream secret, no HA login is needed for it | A **camera entity in HA** for each of our cameras (the bridge has no camera platform today), HA's `internal_url` set to the LAN address, the `stream` component (default) | **Works, LAN-safe, HA-native**, but every camera entity is visible to **every** HA user - a scope leak against CR-001 / AGENTS.md ("HA service token privilege is not user identity"). Kept as the **lab shortcut** (11.1 option ב), not the product path |
| `cast.show_lovelace_view` | Shows an HA dashboard view on a Chromecast through the Home Assistant Cast receiver | HA reachable over **HTTPS** with a sign-in on the TV (Nabu Casa or an owner HTTPS URL), a Lovelace view with our card | **Rejected**: an HA login on the TV, HA branding on the screen, no RBAC of ours |
| DLNA (`dlna_dmr.play_media`) | The renderer pulls the URL itself; most TVs accept progressive MP4 (H.264 + AAC), few accept HLS | A direct HTTP MP4 URL (go2rtc `/api/stream.mp4` or our relay) | **Likely, unverified**: every `dlna_dmr` entity in the three probes was `unavailable` with an empty feature mask at the snapshot. Phase 3 |
| Samsung (`samsungtv_smart`, type `url`) | Opens the TV browser on a page: could show a rendered wall | A tokenised kiosk URL reachable without a session; the browser's video support varies by model year | **Unknown**, phase 3 at most |
| LG webOS (`webostv`) | No URL player in the integration; LG TVs since 2024 ship Chromecast built-in, older ones do not | A Cast endpoint on the same device | Follows the Cast rule (4); without a Cast twin: "לא ידוע" |
| Android TV (`androidtv_remote`) | Every certified Android TV / Google TV carries the Cast receiver | The `cast` integration discovering it (both owner TVs of system-H have their Cast twin) | **Cast, likely** without the twin, **confirmed** with it |
| Music Assistant | Audio only (MA casts audio to Cast / DLNA / AirPlay players) | — | Not a video path; the MA endpoint is never `via` |

### 3.2 What go2rtc can serve

Per stream (ours are `smplwise_<recorder>_<channel>_<sub|main>`, `smplwise_ha_<slug>`, `smplwise_wiskey_<station>`): WebRTC and MSE
(what the browser uses today through the add-on's relay), **HLS** (`/api/stream.m3u8?src=…`: fMP4 segments, H.264 or H.265
passthrough, AAC passthrough; `?video=h264&audio=aac` selects tracks), **progressive MP4** (`/api/stream.mp4?src=…`), MJPEG,
RTSP restream (:8554), JPEG frames (used by our snapshots). go2rtc never transcodes video unless the stream has an `ffmpeg:`
source; it can transcode **audio** (`#audio=aac`) for a PCMU / PCMA camera. The go2rtc add-on image bundles ffmpeg.

| Constraint | Cast (Chromecast 1-3, Nest Hub, Android TV) | Chromecast Ultra / Google TV | DLNA TVs | Apple TV |
|---|---|---|---|---|
| Video | H.264 High up to 1080p30 (Nest Hub: 720p) | + H.265 / HEVC up to 4K | H.264 (most), H.265 rare | H.264, H.265 |
| Audio | AAC, MP3; **no** PCMU/PCMA | same | AAC / MP3 | AAC |
| Container | HLS (fMP4), MP4 | same | progressive MP4 / TS | HLS |
| Latency (observed classes, to verify in the lab) | HLS 3-8 s | same | MP4 1-3 s | HLS 3-8 s |
| B-frames | fine (HLS), unlike WebRTC | fine | fine | fine |

Rules that follow: **cast the sub stream by default** (H.264 on every lab camera); offer the main stream only when the
encoding registry (`services/stream_codecs.py`, CR-008 D7) says `codec: H.264`; **video only** in phase 1, audio added when
the stream carries AAC (go2rtc `audio=aac` transcode is a phase-2 option, CPU cost on the host); H.265 main streams only to a
target whose model is confirmed HEVC-capable (Google TV / Ultra), otherwise refused with "הזרם הראשי אינו נתמך במסך הזה".

### 3.3 LAN reachability: who serves the URL to the TV

The TV fetches the stream itself, so the URL must be reachable **from the TV** without a login:

| Source | Reachable from a TV? | Credentials in the URL? | Per-stream token? | Verdict |
|---|---|---|---|---|
| Ingress (`/api/hassio_ingress/<token>/…`) | **No** - needs an HA session cookie | — | — | Impossible |
| The remote channel (`/arx`, Cloudflare) | Only through the internet, with an Arx session | — | — | Wrong direction |
| go2rtc directly (`http://<host>:1984/api/stream.m3u8?src=…`) | Yes when the go2rtc add-on maps port 1984 (default for the community add-on; **to verify on the lab**) | **Yes** when the API has a username / password (our settings carry one) - never acceptable | **None**: anyone on the LAN who knows a stream name can watch; the intercom project's streams share the same port | Only on a trusted LAN **without** API auth, and even then no RBAC - not the product path |
| HA `stream` HLS (`http://<internal_url>/api/hls/<token>/…`) | Yes | No | HA's own 32-hex token per stream | Needs HA camera entities (3.1) |
| **The add-on's cast relay** on an optional host port (`http://<ha-host>:<port>/cast/<token>/index.m3u8`) | Yes, once the owner maps the port in the add-on's Network settings (the CR-025 push-port pattern: unmapped by default, nothing listens until mapped) | No | **Ours**: HMAC token bound to one session, one stream, one target; 30 min by default, extended by the user, revoked on stop | **Recommended** |

The relay is a thin HTTP proxy from the add-on to go2rtc (`/api/stream.m3u8` and its `hls/…` playlist + segment paths, the
query preserved), restricted to the `smplwise_` namespace by construction (the token maps to a stream name the server chose;
no name ever comes from the client). It answers only `GET`, only paths under `/cast/<token>/`, only while the session is
alive, and it is the **only** unauthenticated listener the add-on has; `/healthz` stays on Ingress. The add-on learns its own
LAN origin for the URL from the Supervisor (`/addons/self/info` → `ip_address` is the container, so the **host** IP comes from
`/network/info` or an explicit setting `multimedia.cast.origin`, shown in Settings with a "בדוק" button that fetches the URL
from the add-on itself). IoT VLAN isolation (TV and HA host on different VLANs) is the expected failure mode: the picker shows
"המסך לא הגיע לזרם" after the session's first 15 s without a segment request.

### 3.4 Security of the stream URL and of the command

- The TV sees `http://<host>:<port>/cast/<token>/…` only: no recorder host, no credentials, no go2rtc URL, no HA token. The
  token is `HMAC-SHA256(secret, session_id)` truncated to 32 hex, stored with the session, compared in constant time.
- The bridge gets **one** new service, `smplwise_bridge.cast_stream {target: media_player entity, url, kind: hls}`, signed like
  every other bridge call and executed in the caller's HA user context; its `cast_policy.py` re-checks independently: the
  target is a `media_player` whose platform is in the allow-list (`cast` in phase 1), the URL's scheme is `http`, its host:port
  **equals the cast origin** the add-on announced at pairing, its path matches `^/cast/[0-9a-f]{32}/index\.m3u8$`. The bridge
  calls `media_player.play_media` itself with `media_content_type: application/vnd.apple.mpegurl` and `extra: {}`. The
  existing CR-015 refusal of `play_media` URLs on the generic path is unchanged. An add-on paired with a bridge older than
  0.7.0 refuses `media.cast` commands with 503 `bridge_outdated`.
- Only the `smplwise_` namespace is ever relayed; the relay has no "stream name" parameter at all.
- The session row carries the camera ids, the stream name, the target device key and the user; the audit row never carries the
  token or the URL.

### 3.5 Remote-channel behaviour

A user on `/arx` presses "שדר למסך"; the add-on checks `media.cast` at the target's anchor and `video.live` on each camera,
opens the session, asks the bridge; the bridge asks HA; HA asks the TV; **the TV pulls from the relay on the LAN**. The remote
user's own stream caps (`remote.max_live_streams`, CR-008) are not consumed; cast sessions have their own cap
(`multimedia.cast.max_sessions`, default 2). The remote user sees the state through the existing `media_state` frames plus the
session's own frame `cast_session` (`starting | playing | not_confirmed | stopped`): "playing" is set when the relay has served
the first segment to the TV's address (an honest signal, not an optimistic one), "not confirmed" after 15 s without it.

### 3.6 Casting a wall

| Option | How | Pros | Cons | Effort |
|---|---|---|---|---|
| A. Rendered wall page on the TV | A Cast **custom receiver** (registered app id, HTTPS-hosted receiver page) or the Samsung browser loading a tokenised kiosk page | The real wall with names, layouts, alarms | Cast receiver registration and an HTTPS host of ours; an HTTPS receiver **cannot** load LAN `http://` video (mixed content), so every segment would also need HTTPS on the LAN (certificates per site); the kiosk page would need a session-less auth token; DLNA TVs cannot do it at all | 30+ h, plus a certificate story per site |
| **B. Mosaic stream** | A go2rtc stream `smplwise_wall_<id>` with an `ffmpeg:` source: `xstack` of up to 4 sub streams into one 1080p H.264 (`ultrafast`, 15 fps), served through the same relay | Works on every target of phase 1 unchanged; one HLS; names burned in with `drawtext`; the same session / permission / audit model | CPU on the HA host (2x2 of 640x480 sub streams ≈ 1-1.5 cores x86; a Pi cannot), one mosaic at a time; stream creation / deletion in go2rtc (namespace guard applies); 4 tiles max | ~14 h incl. a lab CPU measurement |
| C. Carousel | One camera at a time, switched every N seconds by sending the next `play_media` | Zero transcoding, works everywhere | 3-8 s of black at each switch on HLS; one camera visible at a time | ~4 h (on top of phase 1) |
| D. HA Cast dashboard | `cast.show_lovelace_view` with our Lovelace card | Nothing to build on the TV | HTTPS + HA sign-in on the TV, HA branding, no RBAC of ours | Rejected |

**Recommendation:** B as "the wall", C as the fallback when the host has no spare CPU (a capability check runs the ffmpeg
mosaic for 10 s on the host and measures; below 1.5x realtime the wall offers the carousel only). Mosaic layout = the wall's
first page in its current column count, capped at 2x2 (3x3 of sub streams is 9 decodes and a 1080p encode - a lab measurement
decides whether it is offered on x86 hosts).

## 4. Capability detection (built in phase 0)

Pure function `media_model.cast_capability(dev, ents, meta, profile)` → `{method, confidence, via, reason}`, computed on every
`GET /multimedia/admin/devices` row from the data `ha_sync` already mirrors (entity platform, `supported_features` through
`eff_features` - the last good mask of an unavailable endpoint, CR-016 section 5.4 -, `device_class`, the HA device's
manufacturer and model from `ha_devices`; MACs and identifiers are never read).

| Order | Rule | `method` | `confidence` | `reason` |
|---|---|---|---|---|
| 1 | kind is receiver / group / non-physical | none | confirmed | `kind` |
| 2 | a `cast` endpoint (not a `mirror`) whose device class is `tv`, or whose device model names a Google video receiver (Chromecast, Google TV, Nest Hub, SHIELD, Android TV, BRAVIA …) | cast_hls | **confirmed** | `cast_video` |
| 2b | a `cast` endpoint whose model names an audio receiver (Home / Nest Mini, Nest Audio, Chromecast Audio, a cast group, WiiM, Sonos, "speaker") or whose device class is `speaker` without a video model | (skipped; if no other Cast endpoint: none) | confirmed | `cast_audio_only` |
| 2c | a `cast` endpoint without a class on a **screen** (system-V: LG-class TVs seen only through Cast) or on an `android_tv` profile | cast_hls | confirmed | `cast_screen` |
| 2d | a `cast` endpoint without a class on a player / speaker of unknown model | cast_hls | likely | `cast_unknown_model` |
| 3 | an Android TV (`androidtv_remote` / `androidtv`) without its Cast twin | cast_hls | likely | `android_tv_builtin` (hint: connect the Cast integration) |
| 4 | an `apple_tv` endpoint | airplay | likely | `apple_tv` |
| 5 | a `dlna_dmr` endpoint advertising PLAY_MEDIA (last good mask) / with an empty mask | dlna | likely / unknown | `dlna_renderer` / `dlna_unavailable` |
| 6 | a Samsung vendor endpoint with PLAY_MEDIA and nothing above | browser_url | unknown | `samsung_browser` |
| 7 | any other screen | none | unknown | `no_path` |
| 8 | a speaker | none | confirmed | `no_screen` |

Confidence semantics: **confirmed** = the registry proves a video receiver answered on the LAN (phase 1 may offer the screen in
the picker by default); **likely** = the platform implies it but nothing answered (offered after an administrator enables it);
**unknown** = a theoretical path, never offered until verified live. Against the probes: system-H → 5 TVs confirmed (2 Samsung
+ Cast, Android TV + Cast, 2 Cast-only), WiiM / MA speakers "לא נתמך"; system-V → about 6 Cast TVs confirmed, 3 WiiM "לא נתמך",
the SmartThings TV "לא ידוע"; system-K → the TV with the built-in Cast entity confirmed, the second Samsung "דפדפן המסך · לא
ידוע", 6 Sonos "לא נתמך", 2 dlna "DLNA · לא ידוע".

**Owner override (phase 1, needs a column):** `media_devices.cast_json` `{method: CastMethod|null, allow: bool}` - a manual
method pins the chip to "ידני"; `allow` is the per-screen permission switch of section 5.3. Not built in phase 0 because it
needs a migration and a write route; the owner asked for the marking now and the feature later.

## 5. Data model, API, permissions, audit (phase 1 design)

### 5.1 Storage (migration `00NN_cast_sessions.sql`; the next free number is checked at merge, CR-016 precedent)

- `media_devices` += `cast_json` (section 4).
- `cast_sessions`: `session_id` (hex32) PK, `device_key` (the target), `kind` (`camera | wall`), `source_json`
  (`{camera_id, profile}` or `{camera_ids[], cols}`), `stream_name` (the go2rtc stream relayed), `token_hash`, `started_by`,
  `started_at`, `expires_at`, `extended_n`, `first_segment_at` (the honest "playing"), `stopped_at`, `stop_reason`
  (`user | timeout | replaced | target_gone | error | admin`), `ha_action_id` (the bridge call), `restore_json` (5.5).
- Settings: `multimedia.cast.enabled` (false until the port is mapped and the origin verified), `multimedia.cast.origin`
  (`http://host:port`, verified by the self-fetch), `multimedia.cast.max_sessions` (2), `multimedia.cast.minutes` (30, 5-240),
  `multimedia.cast.allow_main` (false), `multimedia.cast.wall_mode` (`mosaic | carousel | off`, phase 2).

### 5.2 API (router `multimedia`, prefix `/multimedia/cast`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/multimedia/cast/targets?camera=<id>` or `?view=<id>` or `?cameras=a,b,c` | `media.cast` + `video.live` on the source | The screens the caller may cast **this source** to: approved, `cast.allow`, method ≠ none, confidence confirmed (or likely when enabled), available now, within the caller's scope; each with `busy` (`playing_music | casting_other | off`) |
| POST | `/multimedia/cast/sessions` `{target_key, source, profile?, client_request_id, expires_at, confirmed?}` → 202 | as above (+ `media.public` on a public screen) | Idempotent on `client_request_id`; 409 `cast_busy` when the target plays music unless `confirmed: true`; 409 `cast_limit` over the cap; 503 `bridge_outdated`; the reply is the session with `ha_action_id` for the existing confirmation poll |
| POST | `/multimedia/cast/sessions/{id}/extend` | the session's user, or `media.cast` at the anchor | +`multimedia.cast.minutes`, at most 8 extensions |
| DELETE | `/multimedia/cast/sessions/{id}` | the session's user, `media.cast` at the anchor, or `media.bulk` | Sends `media_player.media_stop` through the bridge, revokes the token, applies the restore (5.5) |
| GET | `/multimedia/cast/sessions` | `media.read` (own + scope) | For the live screen's "משדר אל …" pill and the Settings list |
| GET | `/cast/{token}/index.m3u8`, `/cast/{token}/…` | **none** (the token) | The relay; on the host port only, never on Ingress or `/arx` |

Events on `/ha/ws`: `cast_session {session_id, device_key, state}` to the owner of the session and to `media.read` holders of
the target's scope.

### 5.3 Permissions

| Permission | Hebrew label | Allows | Default roles | Sensitive |
|---|---|---|---|---|
| `media.cast` (new) | שידור וידאו למסכים | start / extend / stop a cast to a screen within scope; the picker | operator, site_admin, system_admin | no |
| per-screen `cast.allow` (admin flag, `system.configure`) | "מותר לשדר למסך הזה" | the screen appears in pickers at all | default **off** (11.2 recommends ב) | — |
| `media.public` (exists) | — | also casting to a public screen | as CR-015 | yes |
| `media.bulk` (exists) | — | also stopping anyone's cast on a floor ("עצור שידורים") | as CR-015 | yes |
| `video.live` on the camera (exists) | — | the source; checked per camera of a wall | — | — |

Scope = the target's anchor placement, exactly as CR-015 section 6.2; the camera's own scope rule is the live screen's
(`require_camera`). Kiosk never casts.

### 5.4 Audit

`media.cast.start` (target key, camera ids, stream name, profile, session id, `ha_action_id`), `media.cast.extend`,
`media.cast.stop` (reason), `media.cast.denied` (code), `media.cast.config` (settings and per-screen allow). Never the token, the
URL, the origin's host or a frame.

### 5.5 Stop, stay-alive, timeouts, concurrency, conflicts, restore

- **Timeout**: every session ends at `expires_at` (default 30 min); the janitor sends `media_stop` and revokes the token. This is
  a planned action the user consented to when starting - shown on the button ("יעצור ב־14:32"). It is never retried: one
  `media_stop`; if the bridge is unreachable the token is revoked anyway and the TV's player ends on the next segment request
  (an HLS player stops on 403 within seconds) - the honest outcome is `stop_reason: error` with "המסך לא אישר את העצירה".
- **Stay-alive**: "עוד 30 דקות" on the pill; at most 8 extensions (4 h) - after that the user starts again.
- **Concurrency**: `max_sessions` (2) installation-wide; one session per target (a second start on the same target replaces the
  first with `stop_reason: replaced`, audited with both users); one mosaic at a time (phase 2).
- **Conflicts with music**: a Cast target in state `playing` whose `media_content_type` is music / its MA twin has an
  `active_queue` is `busy: playing_music`; the picker shows "מנגן מוזיקה" and the start needs `confirmed: true` with the
  CR-015 confirmation pattern (question + the room, details folded). Starting a cast on a Cast device **ends the running app**;
  music is **not** resumed afterwards (AGENTS.md: no queued physical actions) - the pill says "המוזיקה בסלון נעצרה".
- **Restore**: `restore_json` records only what can be restored without guessing: `was_off` (the Cast device was `off` /
  `unavailable`-asleep → `media_player.turn_off` after stop, so a TV we woke by CEC does not stay on an idle screen) and
  `volume_level` of the Cast endpoint (set back after stop when we changed it; phase 1 never changes it). Apps, inputs and queues
  are never restored.
- **Target gone**: the target's `media_state` turns `unavailable` → the session ends (`target_gone`), no command sent.
- **Rate**: one start per target per 5 s; the relay serves at most 1 playlist / 2 s and 20 segments / 10 s per token (a TV, not a
  crowd) - over that 429 and the session ends with `error`.

## 6. UI

### 6.1 Settings (phase 0, built)

הגדרות › מולטימדיה › מסכים and › נגנים ורמקולים: a column "שידור" (the toolbar's columns control can hide it; folded by default
on the tablet width like "חדר"; a labelled line in the phone cards) with one chip per row - `Google Cast` (green, confirmed),
`Google Cast · כנראה` / `DLNA · כנראה` / `AirPlay · כנראה` (neutral), `דפדפן המסך · לא ידוע` / `לא ידוע` (grey), `לא נתמך` (neutral,
confirmed none); the tooltip carries the confidence and the reason in words; the open form carries "שידור למסך: Google Cast ·
מאומת · דרך media_player.<id> · <reason>". Phase 1 adds in the same form: the per-screen "מותר לשדר" toggle, the method override
(auto / Google Cast / DLNA / AirPlay / none), the "כללי" card gets the cast section (enabled, origin + "בדוק", minutes, cap,
main stream allowed, wall mode) and a "שידורים פעילים" list with "עצור".

### 6.2 Live screen (phase 1)

- **Single camera** (`live-camera.ts`, the `.round` control group next to "מסך מלא"): a 44 px icon button "שדר למסך" (icon
  `cast`), shown only when the caller holds `media.cast` and at least one target exists for this camera (the targets call is
  made once per screen open and cached 60 s; no button = no hint, clean operator screen).
- **Wall** (`live-wall.ts`, the `actions` slot next to "קיוסק"; the phone's one-row toolbar gets the icon): the same button
  for the wall's current page (phase 2; in phase 1 the wall button opens the picker with "מצלמה אחת מהקיר" - the user picks the
  tile).
- **Picker**: `sw-dropdown` with the six styles of 0.1.157 / 0.1.162 (`auto`, `pill`, `field`, `underline`, `capsule`, … - the
  installation's `ui.dropdown.style` applies, nothing new), 44 px options on touch, grouped by floor with the room, each option
  `<name> · <state>` where state ∈ {`פנוי`, `מנגן מוזיקה`, `משדר: מצלמה X`, `כבוי`}; a phone gets the bottom sheet per the
  tabs setting. One tap starts; a busy target asks the confirmation first.
- **Pill** while casting (over the player, bottom start, like the recording pill): `משדר אל סלון · יעצור ב־14:32` with
  "עוד 30 דקות" and "עצור"; `מתחבר…` for the first 15 s; `המסך לא הגיע לזרם` (not confirmed) with "נסה שוב" / "עצור".
- **States and errors (Hebrew, short, no platform names):** `שדר למסך` · `לאיזה מסך?` · `אין מסכים זמינים לשידור` ·
  `מתחבר…` · `משדר אל {room}` · `המסך לא הגיע לזרם` · `המסך לא אישר את העצירה` · `השידור הופסק: תם הזמן` · `המסך עסוק: מנגן מוזיקה` ·
  `המסך לא זמין` · `אין הרשאה לשדר למסך הזה` · `הזרם הראשי אינו נתמך במסך הזה` · `השידור הוחלף על ידי {user}` ·
  `נגמרה מכסת השידורים ({n})` · `השידור לא זמין: נדרש עדכון של רכיב החיבור` (settings only names the bridge version).

## 7. Tests (phase 1 plan; phase 0 in section 9)

Backend: `test_cast_sessions.py` (start / extend / stop / timeout / replaced / target_gone, caps, busy confirmation, scope,
public screen, bridge < 0.7.0, idempotency, token never in audit or logs), `test_cast_relay.py` (token constant-time compare,
403 after revoke, path allow-list, no stream name parameter, rate limits, only `GET`, playlist rewrite), `test_bridge_cast_policy.py`
(origin equality, path regex, platform allow-list, no other `play_media` type), `test_media_fake_ha.py` += a Cast target that
confirms / one that never fetches. Frontend: unit specs (picker options, pill states, timer text), evidence specs at
1440 / 820 / 390 (button hidden without permission / targets, picker, busy confirmation, playing, not confirmed, stop), the
layout guard over the picker and pill, the fake HA live spec (`SW_LIVE=1`) with a fake Cast device whose "TV" is a Python HLS
client hitting the relay.

## 8. Phased plan, ETAs and the first physical test

### 8.1 Phases (agent hours; the owner's calendar decides the versions)

| Phase | Contents | Hours | Version |
|---|---|---|---|
| 0 | This CR; detection; the Settings column and form line; tests (section 9) | done (~6) | next integration round (read-only; safe in any release) |
| 1 | Bridge 0.7.0 (`cast_stream` + `cast_policy`, platform restart); the add-on relay on an optional host port + origin self-check; `cast_sessions`, routes, janitor, events, `media.cast`, per-screen allow + override, audit; the live-screen button, picker, pill, states; backend + frontend + fake-HA tests | 28 (backend 14, bridge 4, UI 8, lab round 2) | the next M release after the owner's approval of 11.1-11.3 |
| 2 | The wall: mosaic stream (go2rtc ffmpeg source, 2x2, names burned in), the host CPU self-measurement, the carousel fallback, the wall button | 14 (+ 1 lab measurement) | the M release after phase 1 proves itself on the lab |
| 3 | DLNA (progressive MP4 through the relay), Apple TV (HLS), the Samsung browser page (tokenised kiosk) - each only when a customer system has the device and it was verified live | 10 | by evidence, not scheduled |

### 8.2 Prerequisites the owner provides before phase 1's lab round

1. Maps the cast port in the add-on's Network settings (any free port, e.g. 18092) and confirms the HA host's LAN address.
2. Confirms the lab go2rtc add-on version (the HLS playlist paths of the relay are verified against it).
3. Names the Cast device for the first test (8.3) and confirms it sits on the same LAN as the HA host (not an isolated IoT VLAN).
4. Installs bridge 0.7.0 when the add-on offers it (one platform restart).

### 8.3 The exact physical test the owner must approve (the first real cast)

- **Device:** one Google Cast video receiver of the owner's choice on the lab network (a Chromecast / Google TV dongle, an
  Android TV or a Nest Hub). The owner names it; nothing else is touched.
- **Source:** one lab camera's **sub stream** (H.264), video only, through the add-on relay; the stream already exists in go2rtc
  (`smplwise_` namespace); nothing is written to the recorder.
- **What happens on the device:** if it is asleep it wakes (Cast turns the TV on through HDMI-CEC - a side effect the owner
  accepts for the test); the running app (if any) is replaced by the Cast media receiver, which shows the camera picture
  within about 3-8 s with the camera's name as the title; no sound.
- **Duration:** a 5-minute session, then the automatic stop; the lead stops it earlier from the pill if asked.
- **How it stops:** "עצור" on the live screen (one `media_stop`, the token revoked, the TV returns to its idle / ambient screen - it
  does **not** return to the previous app); or the 5-minute timer; or any press on the TV's own remote; or, as the last resort,
  unplugging the dongle. If the device was off before, the test also sends one `turn_off` after the stop (the restore rule) -
  the owner may decline that part.
- **Writes involved:** none on the recorder, none on go2rtc's configuration (the relay only reads an existing stream), one
  settings write on the add-on (origin + enabled), one `media_player.play_media` and one `media_stop` through the bridge in the
  owner's HA user context, both audited.
- **Evidence collected:** the session row and audit rows, the relay's request log (addresses redacted), a photo of the TV by
  the owner, the measured start latency and the CPU of the add-on during the session.

## 9. Phase 0: what is built on `pilot/cast-prep`, what is cut and why

**Built (read-only, no migration, no feature flag - it only informs):**
- `smplwise_vms/backend/smplwise/services/media_model.py`: `cast_capability` (section 4), `CAST_METHODS`, `CAST_CONFIDENCE`.
- `smplwise_vms/backend/smplwise/services/media_store.py`: `admin_rows` adds `cast` to every row (manufacturer / model read from
  the `ha_devices` mirror; connections and identifiers never read).
- `frontend/src/api/media-admin.ts`: `CastCapability` types, `AdminDevice.cast?`, demo values; `media-players-mock.ts` derives
  the players' values the same way.
- `frontend/src/screens/media-cast-label.ts` (pure labels: chip + sentence), `media-admin-list-logic.ts` (column `cast`, widths,
  default visibility), `media-admin-list.ts` (the column and the phone card line), `system-multimedia.ts` and
  `system-multimedia-players.ts` (the form line "שידור למסך: …").
- Tests: `tests/test_media_cast_caps.py` (14 pure cases + the route over `media_seed`, the privacy guard, no writable route),
  `frontend/tests/unit-media-cast-label.spec.ts`, `unit-media-admin-list.spec.ts` (grid expectations), the evidence spec
  `evidence-media-cast-chips.spec.ts` (desktop / tablet / mobile, screenshots in `docs/design/evidence/CR-028/prep/`), and the
  existing layout guard `layout-media-admin-list.spec.ts` covers the new column.

**Cut from phase 0 (and why):**
- The owner override and the per-screen "מותר לשדר" switch: they need a column and a write route (phase 1's migration); the
  owner asked for the marking now and the feature later.
- A `cast` field on the operator list (`GET /multimedia/devices`): nothing on an operator screen shows it yet; it arrives with
  the picker.
- Any cast command, relay, bridge change or port: the feature itself (phase 1).
- A filter / sort by the cast column in the Settings list: the chips answer the owner's question; a filter is a phase-1 nicety.

## 10. Open risks

1. **The relay's HLS path shape** depends on the go2rtc version (playlist and segment paths under `/api/hls/…`); verified on the
   lab before phase 1's UI is wired - a small adapter if it differs.
2. **Cast receiver HLS behaviour**: the default media receiver's live-HLS latency and its handling of a 403 at stop are
   documented classes, not measured here; the lab round measures them.
3. **Host port and VLANs**: an unmapped port or an isolated TV VLAN makes every cast "לא הגיע לזרם"; the origin self-check and
   the honest first-segment signal keep it visible instead of silent.
4. **CPU of the mosaic** (phase 2): measured on the lab host before it is offered; the carousel is the fallback.
5. **Audio**: PCMU / PCMA cameras need an audio transcode for HLS; phase 1 is video only by design.
6. **Model strings** of Cast devices vary by firmware ("Chromecast", "Chromecast Ultra", "Google TV", "SHIELD Android TV",
   TV brands); unknown strings fall to `cast_screen` / `cast_unknown_model`, never to "unsupported".
7. **HA camera entities** (the lab shortcut, 11.1 ב) would expose cameras to every HA user; if chosen for the lab it must stay
   opt-in per camera and be removed when the relay lands.

## 11. Decisions requested from the owner

1. **The video path for phase 1:** (א) the add-on relay on an optional host port - recommended; (ב) Arx camera entities in the
   system infrastructure + `camera.play_stream` - faster for a lab proof only, every HA user would see those cameras.
2. **Per-screen default:** (א) every confirmed screen may be cast to at once; (ב) an administrator enables each screen
   ("מותר לשדר") - recommended, consistent with the approval-per-device rule of CR-015 / CR-016.
3. **The first physical test (8.3):** which Cast device, and whether the `turn_off` restore after the stop is included.
4. **Wall mode (phase 2):** (א) mosaic with the carousel fallback - recommended; (ב) carousel only (no transcoding anywhere).
