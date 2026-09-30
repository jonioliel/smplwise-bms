# WisKey native in Arx - Gate A: discovery, identity and design proposal

Status 2026-09-30 · branch `pilot/wiskey-native-gateA` · input: WisKey `2.0.0-rc.37` package "native integration"
(`private-evidence/wiskey-native-rc37/`, reference only, not copied) · no code changed · no live system contacted.
**Updated 2026-10-01:** WisKey's reply `rc37-contract.1` and the owner's decisions are folded in (sections 7-8). The plan in
section 4 is superseded by section 8. Our reply to Codex: `ARX_DECISIONS_REPLY_HE.md`.

## Summary for the coordinator (English)

1. Deployment: Arx is an HA add-on with Ingress (`ingress: true`, `homeassistant_api: true`) plus the `smplwise_bridge`
   custom integration (signed services, directory push, a Lovelace card). No HA custom panel exists. A second entry, the
   CR-008 remote channel `/arx`, serves the same UI on the HA origin with a per-user HA sign-in.
2. Native WisKey data already flows today: Entry Center, Activity, People (+ editor, card capture), door release, call
   signal and TTS - all over ONE backend HA WebSocket authenticated with `SUPERVISOR_TOKEN` (`services/intercom_sync.py`).
3. Identity today: every Arx->WisKey command runs as HA's `Supervisor` system user (admin by HA's own setup; WisKey
   admins bypass all delegated grants). WisKey's operator scopes, field levels, dual approval and its audit actor do NOT
   apply to Arx operators; only Arx RBAC + Arx audit do. The embedded iframe is the only path that runs as the operator.
4. This contradicts `docs/security/HA_IDENTITY_RBAC_HE.md` §8 (the HA user's own permission must be part of the
   intersection) for the already-shipped native writes (0.1.106-0.1.118). Recorded, not resolved here.
5. WisKey handlers use only `connection.user`, `.subscriptions`, `.send_result/.send_error/.send_event` (+ the object as a
   dict key). An in-process delegated connection in our bridge is technically possible, but invoking HA's private
   handler table and making WisKey's audit look like a panel action is the "forged actor" grey zone.
6. Recommendation: design (a+) - our bridge runs WisKey commands for the mapped HA user through a small, ADDITIVE,
   WisKey-owned delegation entry point (WisKey records `via=smplwise_bridge`, WisKey admin can switch it off). No
   contract-v1 change. Per-operator HA tokens (b) are feasible on `/arx` today but need a second sign-in on Ingress.
7. Media: WisKey MSE/RTC are HTTP views authorized by the request's HA user (signed path), with a GLOBAL ceiling of 12
   each and one mode active at a time. A native wall should use our own go2rtc relay (station streams already exist
   for stills) with Arx RBAC intersected with the operator's WisKey station scope read through (a+).
8. Nothing here is proven live: actual actor, WisKey security settings, 10 streams, unlock, audio, Companion.
9. Six owner questions at the end; recommended: keep 0.1.149 media first, run only the identity spike in parallel.
10. 2026-10-01 update: WisKey confirms (b) works today and prefers (a+) long term, but (a+) is a new WisKey release (audit
    `via` changes storage/export; a delegated session is not an `ActiveConnection`), not a half-day patch. Owner decided:
    media first, (a+) as the target, no delegated writes until it is built and tested. Revised plan in section 8.

## 1. סיווג הפריסה ומה כבר קיים

**סיווג:** תוסף HA עם Ingress, לא Docker עצמאי ולא custom panel.

| רכיב | מה הוא עושה | מקור |
|---|---|---|
| תוסף `smplwise_vms` | UI ו־API דרך Ingress (8099), `homeassistant_api: true`, `hassio_api: true`, `panel_admin: false` | `smplwise_vms/config.yaml` |
| זהות ב־Ingress | כותרות `X-Remote-User-Id/-Name/-Display-Name`, מתקבלות רק מכתובת ה־proxy של ה־Supervisor | `backend/smplwise/auth.py` |
| ערוץ מרחוק `/arx` (CR-008) | אותו UI על ה־origin של HA; כניסת HA רשמית בדפדפן (login_flow + PKCE), החלפת access token של המשתמש ב־session cookie; השרת מחזיק את ה־access token בזיכרון בלבד (עד 30 דק') ומאמת אותו מול `ws://homeassistant:<port>/api/websocket` | `services/ha_user_auth.py` |
| אינטגרציית `smplwise_bridge` 0.3.1 | `execute` / `schedule` / `set_entity_area` / `stream_source` חתומים ב־HMAC (סוד צימוד), טוען את ה־`User` האמיתי מ־`hass.auth` ומריץ עם `Context(user_id)`; דחיפת ספריית משתמשי HA לתוסף כל 60 ש'; כרטיס Lovelace `custom:smplwise-card` שמטמיע את דף ה־Ingress בלוח HA | `integration/smplwise_bridge/__init__.py`, `signing.py`, `schedule_service.py` |
| חיבור השרת ל־HA | REST ו־WS דרך `http://supervisor/core` עם `SUPERVISOR_TOKEN` (בשרת בלבד); טוקני משתמש רק ישירות ל־`homeassistant:<port>` | `services/ha_client.py`, `config.py` |
| custom panel ב־HA | **אין.** הכניסה בסרגל של HA היא פאנל ה־Ingress של התוסף. לכן לדף Arx אין `hass` | grep על האינטגרציה |

**נתוני WisKey שכבר זורמים ל־Arx באופן מקורי (CR-005, 0.1.102-0.1.118):**

- ערוץ אחד ארוך־חיים (`services/intercom_sync.py`): `overview` + `subscribe` + מנויי מצב של HA; עותק מקוצץ בזיכרון,
  התראות שינוי לדפדפנים. קריאות: `events/list`, `users/query` (תמיד בלי טקסט חיפוש), `users/get`.
- כתיבות שכבר שוחררו: `stations/test_unlock` (`access.release`), `media/signal`, `tts/engines` + `tts/start`,
  `users/create|update|delete` + `users/pin_generate` (`access.people.manage`), `cards/*capture*`
  (`access.cards.capture`). כולן עם `api_contract: 1`, בלי retry, עם אישור מפורש ואודיט Arx תחת השחקן האמיתי.
- מסכים: `frontend/src/screens/wiskey-overview.ts`, `wiskey-events.ts`, `wiskey-people.ts`, `wiskey-person-editor.ts`,
  `wiskey-card-capture.ts`. מאז 0.1.121 ברירת המחדל היא ה־iframe (`wiskey-embed.ts`, embed-api-v1), והבחירה נעשית
  לכל מסך (`access.ui.overview|events|people` = `wiskey`/`smplwise`).
- מצלמות עמדה: תמונות סטילס דרך go2rtc שלנו, זרם `smplwise_wiskey_<station>` שנמשך ישירות מהעמדה עם פרטי גישה של Arx
  (`wiskey_username/password` או override לכל עמדה), הכתובת מגיעה מ־`overview.stations[].host`
  (`services/wiskey_camera.py`, `services/go2rtc.py`). אין עדיין וידאו חי של עמדה במסך Arx.
- CR-009: עמדת WisKey יכולה להיות חברה ב־shared space; הנראות היא `access.read` ברמת התקנה (`shared_spaces.station_visible`).

## 2. שאלת הזהות

### 2.1 איזה שחקן WisKey רואה היום, לכל מסלול

| מסלול Arx -> HA | אישור | מי ש־WisKey רואה ב־`connection.user` |
|---|---|---|
| ערוץ `intercom_sync` (כל המסכים המקוריים, כולל כתיבות) | `SUPERVISOR_TOKEN` דרך `ws://supervisor/core/websocket` | משתמש המערכת `Supervisor` (נוצר על ידי אינטגרציית hassio בקבוצת admin; `system_generated`). ל־WisKey: `is_admin` => כל האזורים `manage`, אין station scope, אין הגבלת שדות |
| שירותי `smplwise_bridge.*` | אותו טוקן; בתוך הגשר `Context(user_id=<משתמש ממופה>)` | WisKey לא מעורב. ב־HA הפעולה מיוחסת למשתמש הממופה והגשר בודק בעצמו הרשאות ישות (`schedule_service._check_permissions`) |
| iframe `/hikvision-intercom?embed=1` | ה־HA frontend בדפדפן (`hassTokens`, אותו origin) | **המפעיל האמיתי** - המסלול היחיד היום שבו חלים ההרשאות, הנעילות והאודיט של WisKey |
| `/arx` מרחוק | access token של המשתמש בשרת (<=30 דק') | משמש היום רק לאימות (`auth/current_user`); שום פקודת WisKey לא נשלחת בו |

הערה: "Supervisor = admin" נגזר מקוד HA ומהתיעוד של WisKey; **טרם אומת על המתקן** (שאלה 6). ההשלכות, מתוך קוד WisKey:
- `AdminLimiter` (burst 30, 2/s, 8 במקביל) נספר לפי `user.id` - כל מפעילי Arx וערוץ הרקע חולקים דלי אחד.
- `workflows` עם `dual_approval`: המאשר חייב להיות שונה מהמבקש (`access/workflows.py` `approver == actor`). בזהות אחת
  אישור כפול דרך Arx בלתי אפשרי.
- `panel_security`: נעילת idle ו־`reauth_sensitive` קשורות לאובייקט החיבור. אם מנהל WisKey מפעיל `idle_minutes`, חיבור
  חדש נפתח נעול (`locked = bool(idle_minutes)`) וכל פקודה מלבד `authorization/session` נדחית ב־`screen_locked` - גם ערוץ
  הרקע של Arx. ברירת המחדל כבויה; המצב במתקן לא ידוע.
- **סתירה מתועדת:** `HA_IDENTITY_RBAC_HE.md` §8 דורש שהרשאת משתמש ה־HA תהיה חלק מהחיתוך ואוסר לעשות בטוקן admin מה
  שהמשתמש לא רשאי. הכתיבות המקוריות ל־WisKey נשענות על RBAC של Arx בלבד (ברמת התקנה); ה־station scope והשדות של
  המפעיל ב־WisKey לא נבדקים. ההחלטה ב־CR-005 §3 (אודיט Arx כפיצוי) עדיין מסומנת "pending" ב־`DECISIONS.md` (ADR-018),
  אף שהשלבים שוחררו. המיתון בפועל: `access.release` ו־`access.people.manage` ניתנים כברירת מחדל רק ל־site_admin ו־system_admin.

### 2.2 מה ה־handlers של WisKey צריכים מ־`connection`

grep על כל קוד WisKey: רק `connection.user` (19), `.send_error` (22, כולל `translation_*` kwargs), `.subscriptions` (13),
`.send_event` (8), `.send_result` (6), ושימוש באובייקט כמפתח (`panel_security.sessions[connection]`, audio
`bridge.connection is connection`). `@websocket_api.async_response` מוסיף `async_handle_exception`. ה־handler עצמו
(`websocket.py:1728`) בודק `user.is_active` ו־`command_allowed`, מריץ `_dispatch(..., actor=user.id, user=user)`, ו־
`audit_denial` רושם `user.id`. אין שימוש ב־`refresh_token` או ב־`context`. **אזהרה בקוד:** `_overview` עם `user=None`
מחזיר את כל הצי ללא הקרנה ("internal fleet observers") - אסור שמתאם יעביר `None`.

### 2.3 המועמדים

**(a) הגשר מריץ פקודות WisKey בתהליך, בשם המשתמש הממופה.**
מהלך: התוסף שולח בקשה חתומה `{user_id, command, msg, request_id}`; הגשר מאמת HMAC/nonce, טוען `User` אמיתי מ־`hass.auth`
(פעיל, לא `system_generated`), בונה חיבור מתאם עם `user` + `subscriptions` + `send_*`, ומפעיל את ה־handler הרשום.
תחבורה: פקודת WS חדשה של הגשר (`smplwise_bridge/wiskey`, admin-only + חתימה) על אותו ערוץ Supervisor, כך שאירועי
`subscribe`/TTS/capture חוזרים כ־events של המנוי. מה WisKey יראה: המפעיל האמיתי - הרשאות, station scope, שדות, דלי
rate, `dual_approval` תקין, אודיט עם `user.id` שלו.
- *בלי שינוי ב־WisKey:* החיפוש ב־`hass.data["websocket_api"]` וקריאה ל־handler הם API פנימי של HA, שביר בין גרסאות.
  האודיט של WisKey ירשום פעולה של המשתמש כאילו נעשתה בפאנל, בלי לדעת שעברה דרך Arx. זה קרוב ל־"actor מזויף" שהחבילה
  אוסרת (הזהות אמיתית, אבל ההקשר מוסתר). `reauth_sensitive` לא ניתן לסיפוק: `security/reauth_step` מקבל סיסמת HA על
  החיבור, ו־Arx לא מעביר סיסמאות HA (ב־`/arx` הסיסמה עוברת מהדפדפן ישירות ל־HA).
- *(a+) עם נקודת כניסה של WisKey (ההמלצה):* WisKey מוסיף API פנימי בתהליך, תוספתי, למשל
  `hikvision_intercom.delegation.async_open(hass, user, delegate="smplwise_bridge")`, שמחזיר `DelegatedConnection` בבעלות
  WisKey ומריץ את אותו מסלול `handle` (אימות, limiter, `panel_security.guard`, dispatch). WisKey רושם `via` באודיט, מחליט
  על idle ו־reauth לסשן מואצל (הצעה: sensitive => `reauth_required` ו־Arx מציג "פתח ב־WisKey"), ומנהל WisKey יכול לכבות
  האצלה לגמרי. אין שינוי בחוזה v1, בשמות פקודות או באחסון.
- אבטחה: שורש האמון הוא סוד הצימוד + אמון ב־Ingress headers. חשיפת התוסף תאפשר לפעול בשם כל משתמש HA ממופה, כולל מנהלים.
  היום חשיפה כזו כבר נותנת Supervisor admin, כך שזה לא גרוע יותר, וכל פעולה מקבלת מגבלות של משתמש. דרוש: שהגשר יסרב
  ל־`system_generated`/לא פעיל, allowlist פקודות בגשר (ללא `security/*`, `authorization/settings_update`, ייבוא/גיבוי
  בשלב ראשון), rate limit, ואודיט Arx לפני השליחה (קיים).
- מאמץ: הגשר 2-3 ימים + בדיקות; מתאם בתוסף (ערוץ מרובב לכל מפעיל, ביטול, ניקוי) 3-4 ימים; מצד WisKey כחצי יום עד יום.

**(b) טוקני HA OAuth לכל מפעיל, מוחזקים בשרת.**
- ב־`/arx` זה כמעט קיים: `RemoteSession.token` הוא access token של המשתמש, מתחלף בכל רענון, ונפסל כשהמשתמש מוחק את
  ה־refresh token בפרופיל HA. אפשר לפתוח WS לכל מפעיל ל־`homeassistant:<port>` ולקבל זהות אמיתית **בלי שינוי ב־WisKey**.
  זו גם הדרך הזולה ביותר להוכיח זהות בשער B (קריאה בלבד).
- ב־Ingress אין טוקן. צריך כניסה שנייה לכל מפעיל (login_flow של HA בתוך דף ה־Ingress, כמו `/arx`, כולל MFA) והחזקת
  refresh token בשרת: סוג סוד חדש (הצפנה במנוחה, רוטציה, ביטול ב־logout ובשינוי תפקיד, `auth/delete_refresh_token` כמו
  ב־`revoke_sessions`). ב־Companion זה עמוד רגיל, אבל שוב כניסה כפולה. HA refresh tokens לא פגים כל עוד יש שימוש, כך
  שנשמרת בשרת אסמכתה ארוכת־חיים לכל מפעיל.
- יתרון: גם המדיה של WisKey (`auth/sign_path` + MSE/RTC) עובדת בזהות המפעיל. חיסרון: עלות UX, סוד חדש, ושני מנגנוני
  זהות (Ingress ו־`/arx`).
- מאמץ: `/arx` בלבד 3-5 ימים; Ingress + אחסון refresh tokens + מסכי ביטול 2-3 שבועות.

**(c) custom panel בתוך HA frontend.** לא מומלץ. Arx מוגש רק דרך Ingress ו־`/arx`; פאנל כזה יפצל את המוצר לשתי מעטפות,
לא יעבוד ב־`/arx` (שם אין HA frontend), ויסתור את הכלל שלא מציגים מיתוג HA. היכולת הטכנית קיימת (הגשר כבר מגיש קובץ
frontend - הכרטיס), ולכן רכיב WisKey שמקבל `hass` שווה בדיקה רק בתור פתרון Companion, לא בתור מסלול ראשי. גם "שאילת"
`window.parent...hass` מתוך מסגרת ה־Ingress היא פנימיות לא נתמכת של HA frontend - ברשימת "לא לעשות".

**(d) המצב הנוכחי.** ה־iframe + embed-api-v1 לכתיבות, מדיה וניהול; המסכים המקוריים קוראים בזהות השירות. אבטחה: נכון
ל־iframe, אבל המסכים המקוריים חושפים לכל בעל `access.read` את כל התחנות והאנשים שה־Supervisor רואה, בלי ה־scope של
WisKey. מאמץ: אפס. החיסרון המוצרי: iframe נשאר בליבת המוצר, והבעיה ב־Companion (HA מקונן לא מתחבר) נשארת.

| | זהות ב־WisKey | scopes/שדות | אודיט WisKey | אישור כפול | שינוי ב־WisKey | Ingress+`/arx`+Companion | מאמץ |
|---|---|---|---|---|---|---|---|
| a (פנימיות HA) | אמיתית | כן | כן, `via` מוסתר | כן | אין | כן | 1-1.5 שבועות |
| **a+** | אמיתית | כן | כן + `via` | כן | קטן, תוספתי | כן | 1-1.5 שבועות + WisKey ~1 יום |
| b | אמיתית | כן | כן | כן | אין | `/arx` מיד; Ingress עם כניסה כפולה | 3 ימים עד 3 שבועות |
| c | אמיתית | כן | כן | כן | אין | לא `/arx` | גבוה, מפצל מוצר |
| d | Supervisor | לא | לא | לא | אין | iframe שבור ב־Companion | 0 |

**המלצה:** (a+) כמסלול הראשי, ו־(b) ב־`/arx` כהוכחה מהירה לזהות בשער B, בלי לחכות ל־WisKey.

## 3. מדיה

- **MSE/RTC של WisKey** (`mse_api.py`, `rtc_api.py`): `HomeAssistantView` עם `requires_auth`; הזהות היא
  `request["hass_user"]`, והדפדפן מקבל אותה דרך `auth/sign_path` (נתיב חתום לזמן קצר, קשור ל־refresh token של החיבור
  שחתם). ההרשאה נבדקת בפתיחה ומחדש כל 0.5 ש' (`watch_owner`: אזור, station scope, revision של מדיניות המדיה). התקרה
  `len(self.active) >= 12` היא **גלובלית למופע HA** - כל המשתמשים, הלשוניות, ה־iframe והפאנל - ולא לכל משתמש. רק מצב
  אחד פעיל (`transport=webrtc` + `webrtc_mode` mse או rtc), כך שבפועל יש 12 בסך הכול. HLS עובר דרך ישות המצלמה של HA
  ובהרשאה של HA. WisKey מושך מ־go2rtc עם `src=<rtsp של העמדה>` (ה־go2rtc המובנה של HA או `go2rtc_url` בהגדרות;
  לא ידוע אם זה אותו go2rtc שלנו).
- **אודיו/TTS** (`audio_api.py`, `audio_tts.py`): סשן קשור לאובייקט החיבור (`bridge.connection is connection`), טוקן של
  32 תווים לחיבור, תפוס (`audio_busy`) לכל עמדה/חיבור, ביטול דרך `connection.subscriptions`. ב־(a+) אפשרי דרך
  החיבור המואצל (G.711 8 kHz, מנות קטנות) - בשער E, עם הוכחה פיזית.
- **מה זה אומר לקיר מקורי ב־Arx:** קיר 10-12 דרך הגשרים של WisKey יתחרה בתקרה הגלובלית עם כל צופה ב־WisKey, ובלי (b)
  אין לשרת Arx זהות לחתום איתה נתיב. ההצעה: **המסלול שלנו** - זרם go2rtc `smplwise_wiskey_<station>` שכבר קיים לסטילס,
  דרך ה־relay החי הקיים (אותו תקציב `media.max_live_sessions`=16 ו־`remote.max_live_streams`=16, lease, MSE/WebRTC,
  נגן אחד). ההרשאה: RBAC של Arx **בחיתוך** עם ה־`station_ids` של המפעיל מ־`authorization/session` דרך (a+). WisKey
  מתעד במפורש שנתיבי מצלמה של התשתית הם בהרשאה נפרדת, ולכן החיתוך הוא האחריות שלנו.
- **מקור הזרם:** היום פרטי גישה של Arx לעמדה. חלופה נקייה יותר היא `smplwise_bridge.stream_source` (0.3.1, מנהל בלבד,
  opt-in לכל מצלמה, קיים ל־HA camera live, `docs/design/CAMERA_CARD_HA_SOURCE.md`) על `overview.stations[].entities.camera`
  של WisKey. כך ה־RTSP של WisKey עובר רק בשרת, ואין צורך ב־`wiskey_username/password`. לבדוק שהמקור הוא rtsp שעובר
  את `source_policy`.
- **סיכון לא מוכח:** Arx ו־WisKey מושכים את אותה עמדה בשני שמות זרם, כלומר שני סשנים של RTSP לעמדה. מגבלת סשנים
  בעמדות Hikvision לא ידועה ודורשת מדידה באתר.

## 4. תוכנית בפרוסות (מול שערים B-E)

> **הוחלפה (01.10.2026)** בתוכנית המתוקנת בסעיף 8. הטבלה נשארת כאן לתיעוד בלבד.

| פרוסה | תוכן | מאמץ | תלוי ב |
|---|---|---|---|
| B0 אבחון זהות | מסך הגדרות לקריאה בלבד "WisKey רואה את Arx כ־": תוצאת `authorization/session` של ערוץ השירות (actor, admin, areas, security.locked) + ב־`/arx` אותה קריאה עם טוקן המפעיל | 1-2 ימים | שאלה 6 |
| B1 הצעה ל־WisKey | מסמך בקשה ל־(a+): חתימת API, `via` באודיט, מדיניות idle/reauth, מתג כיבוי, בדיקות קבלה | 0.5 יום | שאלה 4 |
| B2 גשר מואצל | `smplwise_bridge/wiskey` (allowlist קריאות: `authorization/session`, `overview`, `subscribe`, `events/list`, `users/query`, `users/get`), מתאם בתוסף לכל מפעיל, ביטול/ניקוי ב־logout, בשינוי תפקיד וב־`access_revoked` | 1-1.5 שבועות | B1 מאושר |
| B3 פרוסה מחוברת | עמדה אחת + מצלמה חיה אחת (relay שלנו) בזהות המפעיל; מפעיל רגיל מול מנהל; מצבי שגיאה/ריק; מחשב + טלפון | 3-5 ימים | B2 |
| C | המסכים המקוריים (מרכז, פעילות, אנשים) עוברים לזהות המפעיל; דלתות/עמדות לקריאה בלבד; קיר 10-12 ב־relay; ביצועים 1/4/8/12 | 1.5-2.5 שבועות | B3 |
| D | העברת הכתיבות הקיימות לזהות המפעיל (release, people, cards, TTS, call), ואחר כך תהליך אחד בכל פעם (groups, schedules, public codes, programs...) | 3-5 ימים להעברה; 2-5 ימים לכל תהליך חדש | C; `dual_approval` נבדק |
| E | אודיו דו־כיווני, Companion, הוכחות שטח | לפי תוצאות | בעל המערכת |

ה־iframe נשאר זמין לכל מסך לאורך כל הדרך (`access.ui.*`), ומוסר מזרימת ברירת המחדל רק אחרי שוויון.

**לא ניתן להוכיח בלי המערכות החיות של בעל המערכת:** איזה actor WisKey רואה בפועל ל־`SUPERVISOR_TOKEN`; הגדרות
`idle_minutes`/`reauth_sensitive`/`dual_approval` במתקן; איזה go2rtc WisKey משתמש בו; מגבלת סשני RTSP בעמדות; 10 זרמים חיים
בו־זמנית; פתיחת דלת פיזית (אישור הממסר); שמע בשני הכיוונים ו־TTS שנשמע ליד העמדה; Companion בטלפון אמיתי; גרסת HA core
והתנהגות `hass.auth` בגשר. כל אלה יסומנו NOT_RUN עד שירוצו.

## 5. סיכונים ו"לא לעשות"

- לא לחשוף `SUPERVISOR_TOKEN`, סוד צימוד, refresh tokens, RTSP או טוקני אודיו לדפדפן, ל־URL, ללוג או לצילום מסך.
- אין endpoint כללי `/wiskey/call` או proxy ל־HA WS. רק פעולות טיפוסיות ב־allowlist, גם בתוסף וגם בגשר.
- אין actor מזויף: לא `user_id` מהדפדפן, לא `actor` בגוף הבקשה, לא `user=None` (מחזיר את כל הצי), לא refresh token של
  משתמש לחיבור מתאם, לא קריאה ל־handler דרך `hass.data["websocket_api"]` בייצור בלי הסכמת WisKey.
- אין כתיבות חדשות (תהליך שעוד לא קיים) לפני שהזהות הוכחה על המתקן. הכתיבות הקיימות - לפי שאלה 3.
- אין retry אוטומטי לשחרור דלת, ל־capture או לכתיבת אנשים אחרי תוצאה לא ודאית (הכלל הקיים נשמר).
- לא להעביר סיסמאות HA דרך Arx כדי לספק `security/reauth_*` של WisKey.
- לא לשאול `hass` מה־HA frontend ההורה, ולא לקרוא `hassTokens` מתוך דף ה־Ingress.
- ה־iframe וחוזה embed-api-v1 נשארים נתיב חזרה; אין שינוי בחוזה v1 או באחסון של WisKey.
- מקוד WisKey לא מעתיקים דבר ל־repo (חבילת המקור ב־`private-evidence/`, לעיון בלבד).
- סיכונים: תלות ב־API פנימי חדש של WisKey (לגרסה עם `min_client`); עומס RTSP כפול על העמדות; החמצת invalidation
  פר־מפעיל (צריך מנוי לכל מפעיל פעיל, לא ערוץ אחד משותף); עלייה במספר חיבורי WS ל־HA (מפעיל פעיל = חיבור מואצל בתוך
  הגשר, לא חיבור רשת).

## 6. שאלות לבעל המערכת

1. **עדיפות מול עבודת המדיה של 0.1.149.**
   א. WisKey native אחרי המדיה.
   ב. במקביל רק B0+B1 (אבחון + בקשה ל־WisKey, 1.5-2.5 ימים), והשאר אחרי המדיה.
   ג. WisKey native לפני המדיה.
   **המלצה: ב.**
2. **איזה מנגנון זהות לרדוף.**
   א. (a+) הגשר מריץ בשם המשתמש דרך נקודת כניסה של WisKey.
   ב. (b) טוקן HA לכל מפעיל (כניסה נוספת ב־Ingress).
   ג. (d) להישאר עם iframe לכתיבות ובלי זהות אישית.
   **המלצה: א, עם (b) ב־`/arx` רק כהוכחה.**
3. **הכתיבות המקוריות שכבר שוחררו בזהות Supervisor** (שחרור דלת, אנשים, כרטיסים, TTS, שיחה).
   א. להשאיר כמו שהן עד ש־(a+) מוכן, ולא להוסיף כתיבות חדשות.
   ב. להקפיא אותן (המסכים המקוריים לקריאה בלבד, כתיבה דרך ה־iframe) עד הוכחת זהות.
   ג. להשאיר רק שחרור דלת.
   **המלצה: א** - אושרו אחת־אחת, מתועדות באודיט Arx ומוגבלות למנהלים. אם יש מפעילים שאינם מנהלים עם הרשאות אלו, עדיף ב.
4. **לשלוח ל־WisKey בקשה ל־API האצלה תוספתי** (`via` באודיט, מתג כיבוי, מדיניות idle/reauth).
   א. כן, עכשיו (אני מנסח).
   ב. קודם ספייק לקריאה בלבד דרך פנימיות HA, לא לייצור, כדי למדוד.
   ג. לא.
   **המלצה: א.**
5. **וידאו עמדות בקיר מקורי.**
   א. go2rtc שלנו (הזרם הקיים) עם RBAC של Arx בחיתוך ה־station scope של WisKey.
   ב. גשרי MSE/RTC של WisKey (דורש (b) ותקרה משותפת של 12).
   ג. הקיר נשאר ב־iframe.
   **המלצה: א, ומקור הזרם דרך `stream_source` של ישות המצלמה של WisKey במקום פרטי גישה נפרדים.**
6. **אימות ה־actor בפועל (לקריאה בלבד).**
   א. להוסיף בגרסה הבאה מסך אבחון קריאה־בלבד (B0) שמראה מה WisKey רואה.
   ב. שתריץ בעצמך סקריפט קריאה־בלבד מתוך התוסף.
   ג. לדחות לשער B.
   **המלצה: א.**

## 7. תשובת WisKey (rc37-contract.1)

חבילת תיעוד מ־30.09.2026 (`private-evidence/wiskey-arx-contract-rc37/`), לא גרסת runtime. ההחלטות D-001..D-003 בה
מסומנות "proposed, awaiting Arx agreement". התשובה שלנו: `ARX_DECISIONS_REPLY_HE.md`.

**החלטות בעל המוצר (01.10.2026):**
1. המדיה (CR-015) קודמת, ו־WisKey מקורי אחריה.
2. יעד הזהות: (a+) כפתרון קבוע, בתכנון משותף עם WisKey. **אין כתיבות דרך האצלה** עד שהיא ממומשת ונבדקה, כולל idle ו־reauth.
3. הכתיבות המקוריות הקיימות בזהות Supervisor נשארות כמו שהן. אין כתיבות מקוריות חדשות.
4. וידאו עמדות בקיר מקורי עובר ב־relay של go2rtc שלנו.
5. לפני כל viewer lease, Arx בודק גם את ה־RBAC שלו וגם את ה־station scope הנוכחי של המפעיל ב־WisKey.

**מה השתנה בהערכה שלנו:**
- **(a+) לא זמין, והוא לא "חצי יום".** אין היום API של act-as או האצלה. זו תהיה גרסת WisKey חדשה: pipeline פקודות משותף,
  תחבורת מנויים משלה, מדיניות idle/reauth, ביטול, ובדיקות. ההערכה בסעיף 2.3 ("WisKey כחצי יום עד יום") שגויה.
- **(b) זמין עכשיו.** חיבור HA WS לכל משתמש אוכף את ההרשאות שלו בלי שינוי ב־WisKey. אצלנו זה אפשרי ב־`/arx` בלבד,
  ולקריאה בלבד. הסתייגות: אם במתקן מוגדר `idle_minutes`, חיבור חדש נפתח נעול, ו־`security/touch` לא פותח אותו.
- **`via` דורש שינוי אחסון.** `audit_actor` שומר היום הקשר של 4 שדות, ויומן הדחיות נפרד ודגום. ההנחה "בלי שינוי אחסון"
  בטיוטה שלנו (סעיף 2.3, (a+)) שגויה.
- **סשן מואצל אינו `ActiveConnection`.** ‏`PanelSecurity`, מנויים, בעלות על אודיו/TTS ו־capture קשורים לחיבור. בגרסה
  הראשונה של ההאצלה ייחסמו media/audio/TTS/capture.
- **`stream_source()` אינו חוזה.** זו מתודת מצלמה של HA (ערוץ 101, עם פרטי גישה), לא API יציב של WisKey. נבקש descriptor
  תוספתי בשרת בלבד. ערוץ 102 לא חשוף, ואין לו מועד.
- **denylist לגרסה הראשונה:** `security/reauth_*`, ‏`authorization/settings_*`, ‏`backups/*`, ‏`platform/*`, ‏`jobs/*`,
  ייבוא, CSV ו־bulk, ייצוא אודיט, support, ו־media/audio/capture. allowlist התחלתי: `authorization/session`,
  ‏`overview/summary`, ‏`stations/list`, ‏`users/query`, ‏`events/list`.
- **הקטלוגים של 238 הפקודות ו־301 השגיאות סטטיים.** הם חילוץ של הרישום העליון ושל מחרוזות בקוד, ולא oracle הרשאות, לא
  סכמות מקוננות ולא מיפוי שגיאה לפקודה. אסור לאפשר כתיבה על סמכם. סכמות מלאות הן משימת P1 של WisKey.
- **תיקונים קטנים:** `audio/stop` לא קיים (מבטלים את המנוי). ‏`capture_status` נשאל. ל־`test_unlock` אין readback.
  ל־`refresh` אין `topics`. אין replay אחרי ניתוק. ה־placeholders נראים כמו ערכים ריקים.
- **חשבון שירות:** WisKey ממליץ על משתמש HA ייעודי שאינו admin לערוץ הרקע. יצירתו היא החלטה של בעל המוצר, אחרי B0.

## 8. תוכנית מתוקנת (מחליפה את סעיף 4)

כל הפרוסות מתחילות **אחרי** עבודת המדיה (CR-015), חוץ מ־D, שתלויה ב־WisKey.

| פרוסה | תוכן | מאמץ | תלוי ב |
|---|---|---|---|
| B0 אבחון | מסך הגדרות לקריאה בלבד "WisKey רואה את Arx כ־": ‏`authorization/session` של ערוץ השירות (actor, admin, areas, ‏`station_ids`, ‏`security`), ובזהות המפעיל ב־`/arx` | 1-2 ימים | מדיה הושלמה |
| B1 מסכים לקריאה על (b) | מתאם לכל מפעיל ב־`/arx` (WS ל־HA core עם ה־access token שכבר מוחזק; נפתח מחדש בכל החלפת טוקן; נסגר עם הסשן), allowlist לקריאה + `users/get` + `subscribe`, טיפול ב־placeholders, fallback ל־iframe בסשן נעול. מסכים: מרכז כניסה, פעילות, אנשים, לקריאה בלבד | 5-8 ימים | B0 |
| B2 הערכת זהות ב־Ingress | מסמך: כניסה שנייה בתוך Ingress (UX, MFA, אחסון refresh token, ביטול) מול (a+). השתתפות בתכנון המשותף של DELEGATION v0.2 (צד הגשר ו־1.11). ללא קוד ייצור | 2-4 ימים | B0; WisKey זמין לתכנון |
| C מדיה לעמדות | תכנון lease: RBAC של Arx בחיתוך scope של WisKey, fail closed, בדיקה חוזרת ב־`refresh` ולפחות כל 20 ש'. מדידות באתר: סשני RTSP לכל דגם, Arx ו־WisKey יחד, זמן צלצול. אחר כך מימוש ב־`/arx`; ב־Ingress רק אחרי (a+) | תכנון 2-3 ימים; מדידות חצי יום עם בעל המוצר; מימוש 1-1.5 שבועות | B1; מדידות |
| D כתיבות | רק אחרי ש־WisKey משחרר את ה־API המואצל ואת הסכמות המלאות: גשר ומתאם מואצלים (1-1.5 שבועות), העברת הכתיבות הקיימות (D-004) אחת־אחת (3-5 ימים), כל תהליך חדש 2-5 ימים. idle ו־reauth נבדקים לפני כל כתיבה | לפי מועד WisKey | גרסת WisKey עם האצלה |
| E הוכחות שטח | 10 זרמים, פתיחה פיזית, אודיו ו־TTS, Companion, בזהות המפעיל | 1-2 מפגשים באתר | בעל המוצר; D |

**לאורך כל הדרך:** כלי contract-diff מול הקטלוג המוצמד בכל מסירה של WisKey (חצי יום בהקמה, ואז חלק מכל מסירה).
ה־iframe (`access.ui.*`) ו־embed-api-v1 נשארים נתיב חזרה עד קבלה בשטח. הכתיבות הקיימות נשארות כמו שהן (D-004).
כל בדיקה מול המערכת החיה מתחילה בקריאה בלבד (רשימת האימות ב־`ARX_DECISIONS_REPLY_HE.md` סעיף 7.4), וכל פעולה פיזית
או כתיבה דורשת אישור מפורש של בעל המוצר.
