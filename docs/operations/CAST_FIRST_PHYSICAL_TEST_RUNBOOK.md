# CR-028 phase 1 - runbook for the first physical cast test

**Status:** prepared 2026-10-05 on `pilot/CAST1-backend`; NOT executed. The lab has no Google Cast device yet; every test so far ran
against fakes (`tests/test_cast_relay.py`, `tests/test_cast_sessions.py`, `tests/test_bridge_cast_policy.py`). This runbook is the
only path to the first real cast, and every step that touches a device needs the owner's written consent (section 2) first.
**Builds on:** CR-028 section 8.3 (the exact physical test) and section 12 (what phase 1 built).

## 1. What the test proves, and what it never does

Proves: a Google Cast TV on the lab LAN plays one camera's sub stream through the add-on's relay within seconds, the session turns
"playing" only when the TV fetched a segment, the stop / timer works, the token dies at the stop, and the power-off rule behaves.

Never, in any step: a write to a recorder (NVR or Provision), a change to go2rtc's configuration or to any stream outside the
`smplwise_` namespace (the intercom project's streams on the same go2rtc are not read, listed or touched by the relay), a change to
Home Assistant users / groups / admin flags, a second device, audio, a retry of a command, a cast of a recording.

## 2. The owner's consent (to be pasted in chat and answered "מאשר" before step 4)

> **אישור לבדיקה פיזית ראשונה של "שדר למסך" (CR-028)**
>
> 1. המכשיר: **[שם מכשיר ה-Cast שבחרת, למשל "Chromecast סלון"]** בלבד. שום מסך או רמקול אחר לא מקבל פקודה.
> 2. מה יקרה במכשיר: אם הוא כבוי הוא יידלק (Cast מדליק את הטלוויזיה דרך HDMI-CEC). האפליקציה שרצה עליו (אם יש) תיסגר
>    ובמקומה ייפתח נגן המדיה של Google ויציג את התמונה של **[שם המצלמה]** (הזרם המשני, בלי קול) תוך כ-3 עד 8 שניות,
>    עם שם המצלמה ככותרת. בסיום המסך חוזר למסך הבית / שומר המסך שלו, **לא** לאפליקציה הקודמת.
> 3. כמה זמן: עד 5 דקות; העצירה האוטומטית בסוף הזמן, או "עצור" במסך החי, או כל לחיצה בשלט של הטלוויזיה, או - כמוצא אחרון - ניתוק
>    המכשיר מהחשמל.
> 4. כיבוי אחרי העצירה: אם המכשיר היה כבוי לפני הבדיקה, תישלח פקודת כיבוי אחת אחרי העצירה. **(א) כן, לכבות** / **(ב) לא, להשאיר דלוק**.
> 5. כתיבות: שום כתיבה למקליט, שום שינוי בהגדרות go2rtc, שום שינוי במשתמשי תשתית המערכת. נכתבות רק הגדרות השידור של Arx
>    (כתובת הממסר, הפעלה, אישור המסך הזה), ונשלחות דרך רכיב החיבור בשם המשתמש שלך: פקודת ניגון אחת, פקודת עצירה אחת, ואם בחרת (א) -
>    פקודת כיבוי אחת. כולן נרשמות ביומן הביקורת.
> 6. ראיות: שורות הסשן והביקורת, יומן הממסר (בלי כתובות), תמונה של הטלוויזיה שאתה מצלם, זמן ההתחלה שנמדד, ועומס המעבד של
>    התוסף בזמן השידור.
>
> כדי לאשר כתוב: "מאשר בדיקה פיזית - [שם המכשיר] - כיבוי: א/ב".

Without this exact answer the test stops at step 3 (everything before it is read-only or local configuration).

## 3. Prerequisites (owner, in Home Assistant; nothing here is done by an agent)

1. Install the add-on version that carries this branch (after its merge and release) and **bridge 0.7.0** (one platform restart;
   until then every start answers 503 `bridge_outdated`).
2. Add-on **Configuration**: `cast_relay: true`. Add-on **Network**: map a free host port to `18092/tcp` (for example 18092). Restart
   the add-on. The log must show `cast relay listening on container port 18092`.
3. Confirm the HA host's LAN address and that the Cast device sits on the same LAN (not an isolated IoT VLAN / guest Wi-Fi).
4. Confirm the go2rtc add-on version (the relay's HLS paths were written for go2rtc's `/api/stream.m3u8` + `/api/hls/*`; the first
   read-only check in step 5 proves them).
5. In הגדרות › מולטימדיה the device must be approved and its "שידור" chip must read `Google Cast · מאומת` (or `כנראה`).

## 4. Read-only and local steps (no device command)

| # | Who | Action | Expected |
|---|---|---|---|
| 1 | admin | `PUT /api/v1/multimedia/cast/config {"origin": "http://<HA LAN IP>:<host port>"}` | `changed: ["origin"]`, `reason: origin_unverified` |
| 2 | admin | `POST /api/v1/multimedia/cast/origin/check` | `{"ok": true}` - the add-on fetched its own probe through the host mapping. `unreachable` = the port is not mapped / wrong address; `not_this_relay` = another service answers there |
| 3 | admin | `PUT .../cast/config {"enabled": true}`; `GET .../cast/config` | `ready: true`, `bridge.ready: true` (after the directory push, within 60 s, the bridge knows the origin) |
| 4 | lead | relay smoke from a LAN laptop, without a token: `curl -i http://<HA LAN IP>:<port>/cast/00000000000000000000000000000000/index.m3u8` | `403`, CORS header present, nothing else reachable (`/api/streams` -> 404) |

## 5. The device steps (only after the consent of section 2)

| # | Action | Expected | Stop rule |
|---|---|---|---|
| 5.1 | `PUT /api/v1/multimedia/cast/screens/<key of the named device> {"allow": true}` | `changed: ["allow"]`; audited `media.cast.screen` | - |
| 5.2 | `POST /api/v1/multimedia/cast/sessions {"target_key": "<key>", "camera_id": "<lab camera>", "client_request_id": "<new>", "power_off_after": <false if the owner chose ב>}` (or the 60 s admin test: `POST .../cast/test`) | `202`, `session.state: starting`; ONE `cast_stream play` in the HA log of the bridge | if `200 refused`: read `error` (`cast_origin_mismatch`, `cast_origin_not_local`, `cast_entity` ...), fix, do not repeat more than once |
| 5.3 | watch `GET .../cast/sessions/<id>` | `playing` within 15 s (the relay served the first segment); the TV shows the camera | `not_confirmed` after 15 s = the TV did not reach the relay (VLAN / port): stop (5.5) and record |
| 5.4 | measure: start latency (press to picture), the add-on CPU during the session | recorded in the evidence | - |
| 5.5 | `DELETE .../cast/sessions/<id>` (or wait for the timer: set `minutes` to 5 first) | ONE `stop`; the TV leaves the stream within seconds; the token answers 403; if the device was off before and (א) was chosen: ONE `off` | any unexpected behaviour: the owner presses the TV remote or unplugs the dongle |

## 6. Evidence to keep (redacted before it leaves `private-evidence/`)

- the `cast_sessions` row (no token is stored; the hash only) and the `media.cast.*` audit rows;
- the add-on log lines `cast relay ...` (they never carry a token, a path or an address);
- the owner's photo of the TV; the measured latency; the CPU figure;
- the go2rtc version and whether `&mp4` (fMP4 HLS) played - if the device refuses fMP4, `cast_relay.HLS_FMP4 = False` (TS) is the
  one-line fallback to try in a follow-up build, not live on the lab.

## 7. Rollback

`cast_relay: false` (or unmap the port) and restart the add-on: nothing listens any more and every start answers `cast_unavailable`.
Switching casting off in Settings (`enabled: false`) keeps the listener but refuses every start and makes the bridge forget the
origin at its next directory push. No device configuration exists to roll back.
