Source: docs/operations/NVR_LESS_MODE.md @ a096fdd

> תרגום של `docs/operations/NVR_LESS_MODE.md`; המקור באנגלית קובע במקרה של סתירה.

# מצב ללא NVR (Home Assistant בלבד)

בקשת הבעלים, 29.09.2026: "אני רוצה שהמערכת תעלה בלי NVR, למקרה שארצה אותה רק לבקרת חשמל" - התקנה עם Home
Assistant בלבד (בקרת התקנים, תוכניות קומה, WisKey) ובלי NVR של Hikvision. ענף `pilot/nvr-less-mode` (מ-
`g0/intake` ב-`ed76db1`).

## 1. מה קרה בלי `nvr_host` לפני השינוי הזה (חקירה)

שיטה: ה-backend ב-`ed76db1` עלה עם אפשרויות NVR / go2rtc / HA ריקות מול תיקיית נתונים זמנית וטרייה
(`SW_OPTIONS_FILE` מצביע על כלום, בלי משתני `NVR_*` / `GO2RTC_URL` / `HA_*`, זהות מפתח), ונסרק כ-20 דקות:
כל route מסוג GET ללא פרמטרים במצאי ה-API (53), ה-routes מסוג POST של ה-NVR, וכל route של המעטפת (shell)
ב-Chromium אמיתי (Playwright, עיצוב A, 1440 פיקסל) עם שגיאות ה-API שכל מסך עורר. קריאה-בלבד; לא היה שום
התקן.

### 1.1 מה כבר החזיק מעמד

- `/healthz` עונה `{"status": "ok"}` מיד: ה-watchdog של ה-Supervisor נשאר ירוק.
- `/health` עונה `status: ok` (זה שדה סטטי) עם `nvr_configured: false`.
- אין קריסה, אין 500, אין timeout בשום מקום. לקוח ה-NVR (`services/nvr._client`) מסרב מיד עם 503
  `source_not_configured` כשחסרים host, user או password, כך שאף route לא ממתין להתקן. כל 53 ה-routes
  מסוג GET ענו 200 (רשימות ריקות) חוץ מ-`GET /nvr/notify` ו-`GET /nvr/system` (503 `source_not_configured`)
  ו-422 הצפויים של routes שדורשים query.
- אין סופת retry ואין נעילה מוחזקת: המאזין alertStream (`events_ingest.LISTENER.start`) חוזר לפני שהוא
  יוצר את ה-threads שלו; גילוי עלייה (`autosync.run_once`) ואירועים הנגזרים מהקלטה (`events_derive.run_once`)
  חוזרים מיד עם `nvr_not_configured`; סנכרון ה-HA לא מתחיל בלי HA.
- גיבוי / שחזור, בדיקת השחרור (`scripts/release_check.py`, עקביות המאגר בלבד), מצב הדמו (בלי backend)
  וסקריפט ה-smoke (`scripts/smoke_after_upgrade.py` מסמן את שלבי ה-NVR כ-`skip` כש-`nvr_configured` הוא
  false) - לאף אחד מהם אין תלות ב-NVR.

### 1.2 מה נשבר או הטעה

| תחום | התנהגות בלי NVR |
|---|---|
| `/health/report` | `status` כללי `error` **לתמיד**: `discovery` הוא `error` (`cameras_last_error = nvr_not_configured`) ו-`events_derive` הוא `error` (`last_error = nvr_not_configured`); `nvr`, `go2rtc` ו-`events_ingest` הם `warn`. |
| `/health/summary` (ה-pill בשורה העליונה) | `warn` לתמיד עם הפריט "ה־NVR לא הוגדר" - "יש מה לבדוק" בכל מסך לכל משתמש. |
| אשף ההתקנה | שלב ה-NVR `failed` ("פרטי ה־NVR לא הוגדרו"), go2rtc `failed`, מצלמה `skipped` "ממתין ל-NVR": "מוכן לעבודה" לא היה בר-השגה; הרמז של המעטפת "השלם את ההתקנה · 1 מתוך 6" נשאר לצמיתות. פתיחת האשף הריצה בדיקת NVR / go2rtc חיה בכל ביקור. |
| תהליכי רקע (threads) | הופעלו למרות שהם חסרי תועלת: ה-thread של worker היצוא (מתעורר כל 15 שניות), ה-thread של worker תמונות-ממוזערות לאירועים, החימום המקדים של דו"ח האחסון של ה-janitor (thread בתוספת שורת INFO `storage report warmed in 0.0 s` כל 8 דקות - רעש היומן הבלתי-חוזר היחיד), מעבר הגילוי+גזירה התקופתי של ה-janitor כל 10 דקות (שקט, חוזר מיד) ו-`nvr_write.stop_expired_manual` כל 30 שניות (שאילתה מקומית). |
| ניווט המעטפת (shell) | כל תחום NVR נשאר בניווט: לייב (סקירה, כל המצלמות, תצוגות שמורות, בריאות מצלמה), חקירה (אירועים, הקלטות, סנכרון, מפה היסטורית, סקירות, חיפוש AI, תיקים, כללים, יצוא). כל אחד נפתח למצב ריק שאומר למשתמש להגדיר את ה-NVR ("המצלמות מתגלות אוטומטית מה־NVR…", "סנכרן מצלמות מה־NVR…"); המפה ההיסטורית ענתה 404 לקומת ברירת המחדל. בלי באנר מערכת (ה-summary אף פעם לא הגיע ל-`error`). |
| הגדרות › חיבורים | שתי קריאות כושלות בכל פתיחה (`/nvr/notify`, `/nvr/system` ← 503) וכרטיס ה-NVR מסומן באדום ("לא מוגדר", alertStream "מנותק · nvr_not_configured"). |
| הגדרות › כללי / וידאו ומדיה | טפסי וידאו, קיר, kiosk, playback, snapshot ויצוא מוצגים וניתנים לשמירה למרות שכלום לא משתמש בהם; בחירת מסך ההתחלה הציעה live / wall / events / playback. |
| מסך האחסון | מצב ריק "ה־NVR לא מוגדר" כתוכן הראשי; כפתור רענון "רענון מול ה־NVR". |
| מפה | עובדת (אתרים, קומות, תוכניות, עוגני HA, תלת-ממד). מתג שכבת המצלמות ו-"בחירת מצלמות" נשארים; מצלמות שנותרו מ-NVR קודם (גיבוי משוחזר) עדיין ייצוירו ויובילו למסכי live / היסטוריה. |
| כרטיס Lovelace | תצוגת ברירת המחדל שלו היא `events` (`/investigate/events`): מרכז אירועים ריק בתוך לוח-המחוונים; גם תצוגות `camera` ו-`wall` ריקות. |
| Kiosk (`#/kiosk/...`) | קיר ריק. |
| WisKey, בקרת התקנים, תיבת החיפוש, גיבויים | לא מושפעים. |

כל מקום שמניח קיום NVR (הפניות קוד): עליית `main.py` (worker היצוא, משימת הגילוי, alertStream,
תמונות-ממוזערות) ו-`janitor_tick` (חימום מקדים של אחסון, עצירת הקלטה ידנית, גילוי תקופתי);
`services/health_report.py` (`build`, `summary`); `services/setup_wizard.py` (שלבי NVR, go2rtc ומצלמה);
`services/autosync.py`, `events_ingest.py`, `events_derive.py`, `thumbnails.py`, `exports.py`, `storage.py`,
`nvr.py`, `nvr_system.py`, `nvr_write.py`, `recordings.py`, `playback*.py`, `go2rtc.py` (סנכרון stream);
ה-routers `cameras` (sync, snapshot, capabilities, zones, ערוץ ידני), `media` (live, סנכרון stream),
`recordings`, `frames`, `playback`, `playback_groups`, `exports`, `nvr_write`, `cases` (preserve = יצוא NVR);
frontend `shell/nav.ts` + `shell/sw-app.ts` (ניווט, מסך התחלה), מסכי live / investigate / kiosk,
`system-setup.ts`, `system-diagnostics.ts` (טאבים media + general), `system-storage.ts`, `system-wizard.ts`,
`explore-floor-map.ts` (שכבת מצלמות), תצוגות `events` / `camera` / `wall` של כרטיס ה-Lovelace.

## 2. עיצוב

**מצב נגזר אחד, לעולם לא נשמר.** `smplwise/mode.py`: `installation_mode(settings)` הוא `ha_only` כשאפשרויות
התוסף לא נוקבות `nvr_host`, אחרת `full` (host בלי credentials נשאר `full` - הניסוח הקיים "לא מוגדר" חל
שם). הוא מחושב בכל עלייה מהאפשרויות, כך שמעבר לא דורש מיגרציה בשום כיוון וכלום במסד הנתונים לא מפנה אליו.
מדווח כ-`mode` ב-`GET /me`, `GET /health` (עם בלוק `nvr`
`{configured, state: not_configured, label: "לא מוגדר - מצב ללא NVR"}`), `GET /health/summary`,
`GET /health/report` ו-`GET /setup/state`.

**עבודת רקע.** ב-`ha_only` העלייה לא מפעילה את worker היצוא, משימת הגילוי, המאזין alertStream או worker
התמונות-הממוזערות; ה-janitor מדלג על החימום המקדים של האחסון, עצירת ההקלטה הידנית והגילוי התקופתי. הוא
עדיין מריץ את משק הבית המקומי שלו (retention, גיזום audit / היסטוריית HA, WAL checkpoint), סנכרון ה-HA,
פיד WisKey, התקנת ה-bridge והגיבוי היומי. שורת INFO אחת בעלייה:
`installation mode: ha_only (no nvr_host in the add-on options) - …`.

**בריאות (Health).** סטטוס בדיקה ניטרלי חדש `off` ("לא מוגדר") שלעולם לא מוריד את הסטטוס הכללי. ב-`ha_only`
בדיקת ה-NVR היא `off`, go2rtc היא `off` כל עוד היא לא מוגדרת (נבדקת כרגיל כשהיא כן), ובדיקות עבודת ה-NVR
(`events_ingest`, `events_derive`, `discovery`, `thumbnails`, `exports`) לא מדווחות. ה-summary מוריד את
הפריט "ה־NVR לא הוגדר", כך שעם HA מחובר וגיבוי קיים ה-pill ירוק. Home Assistant הוא המוצר במצב הזה: HA לא
מוגדר, או מנותק ליותר מ-`HA_GRACE_S` (60 שניות, נמדד על ידי `ha_sync.STATE.down_for()`), הוא `error`
ב-summary (באנר המערכת) ובבדיקת `ha_sync` של הדו"ח; המצב המלא שומר על האזהרות שלו.

**אשף.** סטטוס שלב חדש `not_applicable` עם `status_label`: NVR ומצלמה הם "דילוג - מצב ללא NVR" (קוד בעיה
`nvr_less_mode`, פעולה הבאה = איך להוסיף את ה-NVR מאוחר יותר, קישור להגדרות › חיבורים); go2rtc הוא
"דילוג - לא מוגדר (רשות)" כל עוד לא מוגדרים `go2rtc_url` ולא `wiskey_username` (תמונות התחנה של WisKey
והווידאו עוברים דרך go2rtc, כך שעם credentials של WisKey זה שלב נדרש). go2rtc מוגדר נבדק רק להישגיות
(reachability) (לא צפויים streams של מצלמות) והבדיקה המוצלחת האחרונה נשמרת מעבר למטמון החי, כי אין סנכרון
stream שרץ בלי NVR כדי לרענן את מצב הרקע. `total` סופר רק את השלבים הנדרשים, כך ש-"מוכן לעבודה" מושג עם
התקנה, Home Assistant, קומה (ו-go2rtc כשהוא מוגדר - ארבעת השלבים הנותרים של הבריף). בדיקת ה-NVR לא בודקת
כלום. *החלטה מתועדת:* go2rtc הוא רשות ב-`ha_only`; "ארבעת השלבים הנותרים" של הבריף חל כש-go2rtc מוגדר,
והתקנה של חשמל-בלבד בלי go2rtc מוכנה עם שלושה.

**Routes.** 409 `nvr_not_configured` עם הודעת "איך להוסיף אותו", תמיד אחרי בדיקות הזהות וההרשאה של ה-route
עצמו - קורא בלי ההרשאה מקבל את אותו 403 מבוקר כמו במצב המלא, ורק קורא מורשה לומד שה-NVR נעדר.
`mode.ensure_nvr` יושב בגבול ה-NVR - לקוח ה-ISAPI (`nvr._client`, בשימוש בכל קריאה וכתיבה של NVR), בוני
כתובות RTSP של live ו-playback - ובמטפלים שלא מגיעים לשום התקן או בודקים go2rtc קודם: סנכרון מצלמה, ערוץ
ידני, snapshot / capabilities / zones, מידע live media, סנכרון stream, יצירת session ו-group של playback
(לפני בדיקת go2rtc), snapshot / preserve של תיק. קריאות מקומיות ממשיכות לענות (רשימת מצלמות, אירועים
שמורים, רשימת היצוא, תיקים, דו"ח אחסון, מפות קומה, חיפוש). אירוע שמור של מצלמה שנותרה לא מקבל בקשת
תמונה-ממוזערת (הרשימה מסמנת אותו `unavailable`, ה-route של התמונה-הממוזערת עונה 404
`thumbnail_unavailable`), לעולם לא 202 שממתין ל-worker שלא רץ. `PUT /nvr/connection` (מחוץ לתוסף) עונה
`mode` ו-`restart_required` - ה-routes של ה-NVR עונים מיד, עבודת הרקע מתחילה בעלייה הבאה.

**מעטפת (Shell).** `nav.ts`: `NVR_LESS` (נקבע מה-session) מסנן כל href של NVR משני עיצובי הלשוניות, הרייל
וניווט התחתון בטלפון, ומשמיט את אזור ה-live / קבוצת הסקירה שאחרת תמיד נשמרים - הניווט הוא מפה, חשמל
והתקנים, WisKey, הגדרות (בתוספת אינדקס "מסכים"). `sw-app.ts` עונה ל-route של NVR (live, investigate, camera
health, kiosk) עם פאנל "מצב ללא NVR" שמצביע על האפשרויות ועל הגדרות › חיבורים; בתוך כרטיס ה-Lovelace
(`embed=1`) הוא מציג במקום זאת את מפת הקומה, כך שכל תצוגת כרטיס יורדת למפה בלי עדכון כרטיס. מסך התחלה
שזקוק ל-NVR פותח את המפה (או בקרת התקנים עם המפה מוסתרת); `devices` הוא בחירת מסך-התחלה חדשה בשני
המצבים. מסכים: האשף (שלבים מדולגים, בלי "בדוק שוב" עליהם, summary עם כפתורי מפה / התקנים), הגדרות ›
חיבורים (כרטיס NVR ניטרלי בתוספת כרטיס החיבור, בלי קריאות NVR), כללי / וידאו ומדיה (הודעה ניטרלית במקום
טפסי הווידאו, playback, יצוא, חיפוש-AI והיסטוריה; הגדרות תצוגה, מפה ו-retention נשארות), אחסון (דיסק מקומי
בלבד), מפת הקומה (בלי עוגני מצלמה, בלי שכבת מצלמות, בלי בחירת מצלמות מרובה).

**הרצות מפתח ובדיקה שומרות על המצב המלא (מרכזי).** רק התוסף (אפשרויות ב-`/data/options.json`) נגזר ל-
`ha_only` מ-`nvr_host` חסר. כל הרצה אחרת - ה-dev backend של הבעלים, כל `python -m smplwise` חד-פעמי, כל
Playwright fixture backend - עוברת דרך `config.load_settings`, שממלאת host NVR חסר עם
`DEV_NVR_PLACEHOLDER` = `nvr-placeholder.test` (שם שמור שלעולם לא נפתר; אף פעם לא ממולא user של NVR, כך
שכלום לא מתחבר וה-NVR נשאר "לא מוגדר" בדיוק כמו קודם) אלא אם הקורא מגדיר `SW_MODE=ha_only`. יומן העלייה
אומר איזה. ה-fixture ללא-NVR, `frontend/tests/fixtures/nvr_less_backend.py`, מגדיר `SW_MODE=ha_only`;
הגדרות בדיקת ה-backend (`tests/conftest.py`, נבנות ישירות, לא דרך `load_settings`) נוקבות באותו
placeholder. routes של תיקים שנהגו לבדוק רק את ה-host (בדיקת כיסוי, snapshot / preserve) דורשים כעת host
ו-credentials, כך שה-placeholder מתנהג בדיוק כמו העדר NVR שם.

## 3. ראיות

- Backend: `smplwise_vms/backend/tests/test_nvr_less.py` (threads בעלייה לפי מצב, שורת INFO, janitor,
  health / summary / report, דילוג אשף + מוכנות + בלי בדיקה, 19 routes של NVR ← 409 תוך 2 שניות, 401 לפני
  409, קריאות מקומיות, הרשאות ללא שינוי, full ↔ ha_only על אותם נתונים בלי מיגרציה).
- UI: `frontend/tests/evidence-nvr-less.spec.ts` מול `nvr_less_backend.py`, שולחני + טלפון; צילומי מסך
  ב-`docs/evidence/nvr-less/`.

## 4. מגבלות ידועות / נקודות פתוחות

- אירועי אבטחה של Home Assistant (מעברי דלת / תנועה, `source = ha`) עדיין נרשמים ב-`ha_only`, אבל מרכז
  האירועים מוסתר יחד עם שאר אזור החקירה כפי שהבריף מבקש. הצגת רשימת אירועים HA-בלבד היא המשך אפשרי (החלטת
  בעלים).
- התקנה טרייה בלי שום גיבוי עדיין מציגה "אין עדיין גיבוי" (warn) עד הגיבוי היומי הראשון - זהה בשני
  המצבים.
- מעבר המצב נכנס לתוקף באתחול מחדש (בתוך Home Assistant ה-Supervisor מאתחל מחדש את התוסף כשהאפשרויות
  משתנות). בעמדת עבודה, שמירת חיבור NVR בהגדרות › חיבורים מחליפה את ה-routes מיד ומבקשת אתחול מחדש לעבודת
  הרקע (`restart_required`).
