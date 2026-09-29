Source: docs/changes/CR-005-PHASE2-BRIEF.md @ 659c712df77dff7495a15d3a0ce84e32c5ad8bf2

> תרגום של `docs/changes/CR-005-PHASE2-BRIEF.md`; המקור באנגלית קובע במקרה של סתירה.

# מסכי WisKey הבאים — תדריך בנייה: עורך אנשים (+ לכידת כרטיס) והגדרות טכניות של דלת/עמדה

הוכן ב-28.09.2026 עבור המיישם שמתחיל מחר. מחקר בלבד; שום דבר במאגר לא שונה.

מקורות (מספרי שורה משוערים; `X:` = `docs/integrations/wiskey/WISKEY_SOURCE_EXTRACTION.md`,
`R:` = השכפול (clone) של WisKey ל-read-only ב-`scratchpad/wiskey-ref/repo` ב-HEAD `2f902aa`, `B:` =
`R/custom_components/hikvision_intercom/`):
- עורך אנשים X:893-1024; לכידת כרטיס X:1028-1063 ו-X:3221-3275 (אומת מול B:access/enrollment.py,
  B:client/capture.py); תזמון X:2534-2596, X:3532-3612; תמונה X:2600-2645, X:3523-3528; USB wedge
  X:2649-2678; כללי `build_user` X:2969-2991; התנגשויות repository X:3057-3080; dispatch של WS X:3084-3137;
  הרשאות קבוצה X:3433-3451; טיפוסים X:1256-1376.
- התקנים/עמדות X:1130-1175; טכני-עמדה X:4618-4668; תוכניות דלת X:4671-4720; `technical_api.py` X:4965-4995
  (אומת מול B:technical_api.py); `client/technical.py` X:4999-5009 (אומת); מבצע hold-open X:5032-5058 (אומת
  מול B:access/hold_programs.py, B:access_runtime.py:156-183); שורות יכולת חלק E X:5283-5330, שאלות פתוחות
  X:5334-5347.
- קריאת צד SMPLWISE: `routers/access_control.py` (הערת סעיף הפעולות-הפיזיות, `ReleaseBody`, `_Action`,
  `_parse`, `_envelope`, `_perform`, `_RelayGuard`), `services/intercom_client.py` (`PRE_DISPATCH`,
  `PRE_DEVICE`, `_action_result`, `UnclearAnswer`), `services/intercom_sync.py` (`command`, `action`,
  `_execute`, נתיבים/buckets, `project_person`, `_station`), `frontend/src/screens/wiskey-overview.ts`
  (שחרור `sw-dialog` + זיון-בשתי-הקשות), `frontend/src/api/intercom.ts` (`envelope()`, `serverNow()`), CR-005
  (כל הסטיות/ההחלטות הרשומות), הערת `routers/access.py` PERMISSION_LABELS.

---------------------------------------------------------------------------------------------------------------------

## 0. כללים שחלים על שני המסכים

### 0.1 כלל המסורב-לעומת-לא-ידוע, מנוסח מחדש עבור כתיבות שאינן הפעלות מיידיות
הסקירות של 0.1.106 קבעו: קוד `success:false` הוא "מסורב" **רק** אם ניתן להוכיח שהקוד מועלה לפני שהאפקט של
הפקודה יכול היה לקרות; כל דבר אחר (כולל כל קוד שרשימת ההיתר לא מכירה, `action_failed`, `device_unavailable`,
תשובה בצורה בלתי-צפויה, timeout, session שנפל) הוא "תוצאה לא-ידועה". רשימת ההיתר נכשלת לכיוון לא-ידוע. עבור
הפקודות החדשות ה"אפקט" הוא אחד מ:
- **אפקט התקן** (capture_start מכניסה קורא למצב לכידה; technical_update מבצעת PUT ל-DoorParam; פעולת
  program שולחת `close`),
- **אפקט אחסון** (users/create|update|delete, capture_confirm, program_save): ברגע שהמחסן של WisKey נכתב,
  ה-reconciliation/הטיימר של 15 שניות של WisKey עצמה יעבירו אותו להתקן בלי שום פקודה נוספת מאיתנו.
כך שכל פקודה חדשה מקבלת רשימת-היתר `PRE_EFFECT` ב-`intercom_client.py` (הכללה של `PRE_DEVICE`), בנויה מתוך
הטבלאות למטה.

עובדות מקור שמניעות את הטבלאות (כולן אומתו ב-R):
- `AccessError(code)` → קוד `code`; כל `HikvisionError` → `device_unavailable`; כל חריגה אחרת, כולל פקיעת
  `asyncio.timeout` → `action_failed` (X:4607; B:websocket.py:1053-1070). `device_unavailable`/`action_failed`
  יכולים לקרות בכל מקום, כך שהם לעולם לא "מסורב" עבור כתיבה.
- WisKey שומרת דרך `_commit` (B:access/repository.py:264-296): המצב המועמד מאומת (`_validate_collisions`)
  **לפני** `_save`; הזיכרון מתפרסם רק אחרי השמירה. `AccessStore.async_save` מעלה `storage_stopping` לפני
  הכתיבה, ו-`storage_write_failed` מתוך `write_utf8_file_atomic` (B:storage.py:69-96) — האם הקובץ הוחלף לפני
  החריגה הזו לא ניתן להוכחה → `storage_write_failed` = לא-ידוע.
- `dispatch_technical` מעלה `station_unloaded` בכניסה **וגם** שוב **אחרי** העבודה של הפקודה
  (B:technical_api.py:21-23 והבדיקה הסופית לפני `return result`) → `station_unloaded` הוא **לא-ידוע** לכל
  כתיבת `stations/technical_*` (אותה מסקנה ש-T054 הגיעה אליה עבור `media/signal`). `device_busy` מועלה רק
  בכניסה (סט `technical_busy` לפי-עמדה, ≥3 עמדות עסוקות) → קדם-אפקט.

### 0.2 עובדות המעטפה (envelope) של WisKey שהלקוח חייב לכבד
- `api_contract: 1` נדרש בכל פקודה שאינה ב-`READ_COMMANDS` (B:api_contract.py:34-84). קריאות שאינן בסט הזה
  ולכן זקוקות לו: `users/pin_check`, `users/pin_generate`, `cards/reader_capabilities`,
  `stations/technical_get`, `stations/technical_program_list`. `cards/capture_status` ו-`cards/capture_cancel`
  **כן** בסט (שליחת `api_contract` בכל זאת מתקבלת: זה int אופציונלי בסכימה). מפתחות עליונים לא-ידועים →
  `invalid_fields`; שדות `int`/`bool` נבדקים עם `type(x) is` (bool אינו int).
- WisKey מאשרת לפי משתמש HA; SMPLWISE משתמשת במשתמש HA אחד של ה-add-on. הוא חייב להחזיק `users:manage` ו-
  `stations:manage` (או להיות מנהל HA) אחרת כל כתיבה כאן היא `unauthorized` (קדם-dispatch, מסורב). לא-מאומת
  עבור המעבדה: לקרוא `overview.access` / `overview.api.commands` פעם אחת ולוודא שהפקודות החדשות רשומות לפני
  הפעלת ה-UI.
- sessions של לכידה בבעלות ה**שחקן** של WisKey = משתמש ה-HA של ה-add-on (B:enrollment.py `_get`:
  `session.actor != actor` → `capture_not_found`). כל משתמש SMPLWISE נראה אפוא כאותו שחקן ל-WisKey: SMPLWISE
  חייבת לקשור כל `session_id` למשתמש SMPLWISE עצמו (מפה בצד-שרת), אחרת עורך SMPLWISE אחד יכול היה
  poll/לאשר/לבטל לכידה של אחר.

### 0.3 זמני-קצה (timeouts) ונתיבים (lanes) (בצד SMPLWISE) — חייבים להשתנות לפני שהמסכים האלה עובדים באמינות
- `intercom_sync.COMMAND_TIMEOUT_S = 25` (קריאות), `ACTION_TIMEOUT_S = 35` (פעולות), מגבלת קריאת
  `ha_client.ws_session` של 60 שניות (`ha_client.py:118`). תקציבי WisKey: `stations/technical_*` פקודה שלמה
  `asyncio.timeout(75)`; `update_door` 40 שניות; קריאת DoorParam עד 2×(יכולות+ערכים) + זהות; זמני-קצה של
  לקוח ב-UI של WisKey עצמה: technical_get 80 שניות, technical_update 50 שניות, השהיה/הסרה של program 70
  שניות (R:frontend/src/station-technical.ts:140,175; door-programs.ts:184,282); `cards/reader_capabilities`
  35 שניות.
  → `_execute` זקוקה לארגומנט timeout לכל-פקודה (קריאה: 80 שניות ל-`technical_get`, 40 שניות ל-
  `reader_capabilities`; כתיבה: 60 שניות ל-`technical_update` / פעולת program). כל דבר ש-WisKey לוקחת יותר
  מ-60 שניות נחתך על ידי ha_client והופך ל"לא-ידוע" — מקובל, אבל לציין זאת בניסוח ה-UI לכתיבות טכניות.
- לנתיב הפעולה יש רק `ACTION_INFLIGHT = 2` סלוטים משותפים על ידי שחרור/שיחה/TTS. היפוך-ממסר או פעולת program
  יכולים להחזיק סלוט עד 60 שניות. המלצה: נתיב **config** שלישי (סלוט 1, buckets משלו) לשמירות אנשים, כתיבות
  טכניות ושמירות program, כדי שכתיבה טכנית תקועה לעולם לא תוכל לחסום שחרור דלת. הסכומים אז 4 קריאה + 2 פעולה
  + 1 config (+ feed) נשארים מתחת ל-AdminLimiter של WisKey של 8 handlers מקבילים לכל משתמש HA (X:71-76).
- polling של סטטוס לכידה (הפאנל של WisKey: כל 1000 מ"ש בזמן `preparing`/`waiting`) היה מוציא טוקן קריאה
  אחד/שנייה לכל דיאלוג פתוח מול `USER_RATE = 1.0`. המלצה: לעשות poll ל-WisKey מה-backend של SMPLWISE (poller
  אחד לכל session, 1.5 שניות) ולדחוף הודעות `intercom_capture` על `/intercom/ws`, בדיוק התבנית שכבר משמשת
  להתקדמות TTS (`_on_tts` / `intercom_tts`); לשמור fallback של GET.

### 0.4 הרשאות (החלטת מדיניות עבור הבעלים — ראו §4 שאלות 1-4)
CR-005 §3 כבר נוקבת `access.people.manage`, `access.doors.manage`, `access.release`; היא שמה לכידת כרטיס
תחת `access.release`. מומלץ (כולן installation scope, ברירת מחדל **רק** site_admin + system_admin כמו
`access.release`; אלו הפיזיות נוספות ל-`sensitive_permissions_not_implied` ב-`roles.json`; תוויות + הנמקה
ב-`routers/access.py` PERMISSION_LABELS):

| הרשאה | מכסה | סיווג |
|---|---|---|
| `access.people.manage` (שם §3 של CR-005; מועדף על פני `access.people.write` חדשה) | קריאת הקרנת העורך, יצירה/עדכון/מחיקה של אדם, קביעת/הסרת/בדיקת/יצירת PIN, כרטיסים מוקלדים + USB, קבוצות/פרופיל, תוקף/תזמון, בדיקת כפילות | CONFIG-WRITE (מעניקה/מבטלת גישה פיזית אחרי סנכרון WisKey) |
| `access.cards.capture` (חדשה; מפצלת לכידה מחוץ ל-`access.release`) | יכולות קורא, הפעלת/סטטוס/ביטול לכידה; אישור דורש בנוסף `access.people.manage` | PHYSICAL (מצב קורא) + CONFIG-WRITE באישור |
| `access.doors.manage` (שם §3 של CR-005) | קריאת הגדרות טכניות, `doorName` / `openDuration`, שמירת program **בלי** הפעלה, מחיקת טיוטות שמורות ישנות | CONFIG-WRITE (DoorParam של ההתקן / אחסון WisKey) |
| `access.doors.physical` (חדשה) | הפעלת program של דלת, השהיה/הסרה של program (עשויה לשלוח `close`), `relayReverseEnabled` | PHYSICAL (מתוזמן/מיידי) |

הנמקה לפיצול לכידה מחוץ ל-`access.release`: `access.release` היא הרשאת עמדת-השמירה שהבעלים אולי ייתן בהמשך
ל-`operator` (החלטה רשומה של CR-005); רישום כרטיסים לא צריך לרכוב על שחרור דלת.

### 0.5 תבנית ביקורת/מעטפה לניצול-חוזר (מהסעיף של הפעולות-הפיזיות ב-`routers/access_control.py`)
כל endpoint כתיבה למטה מנצל-מחדש `_Action` / `_parse` / `_envelope` / `_perform` עם שם פעולה משלו
(`intercom.person.save`, `.person.delete`, `.card_capture.start`, `.card_capture.confirm`, `.door.settings`,
`.door.relay_reverse`, `.door.program.save`, `.door.program.pause`, `.door.program.remove`):
- הרשאה נבדקת כתלות **לפני** שהגוף נקרא; JSON-בלבד (`_is_json`, אחרת 415); סירוב-לפני-שליחה = שורת `denied`
  אחת; פקודה שנשלחה = שורת ניסיון שנקבעה (commit) **לפני** השליחה + שורת תוצאה best-effort
  (`ok|not_sent|refused|unknown`).
- `client_request_id` + `expires_at` על כל כתיבה (dedupe דרך שורות הניסיון; `EXPIRY_MAX_S = 60`,
  `SEND_WITHIN_S = 15`, בדיקה-מחדש של `not_after` על לולאת ה-feed). פקיעה לפי שעון-שרת: הדפדפן מחשב את
  `expires_at` עם `serverNow()` (`frontend/src/api/intercom.ts`), כמו עבור שחרור.
- **פרטי ביקורת לעולם לא יכולים להכיל PIN, מספר כרטיס (אפילו לא 4 הספרות האחרונות), טלפון, ערכי פרופיל או
  תמונה.** לרשום רק **שמות** שדה שהשתנו וספירות, בבואה לתקצירי הביקורת של WisKey עצמה
  (`{pin_configured, card_count, enabled_cards, assignments {sid:{enabled, allowed_locks}}}`, X:3036-3040).
  זה שונה מ-TTS, שהביקורת שלו שומרת את הטקסט שנאמר.
- ערכי PIN נוסעים רק בגופי JSON של בקשות POST (לעולם לא query string, לעולם לא נרשם ביומן). `pin_check` לכן
  חייבת להיות POST.

---------------------------------------------------------------------------------------------------------------------

## 1. מסך א' — עורך אנשים (הבית של לכידת כרטיס)

### א.1 מטרה, נקודות כניסה, פריסה
יצירה/עריכה של אדם אחד ב-WisKey: זהות, טלפון, active, שדות/קבוצות/תבנית פרופיל מותאמים (+ תמונה),
תוקף/תזמון, PIN, כרטיסים (מוקלד, USB wedge, לכידה מעמדה), הרשאות דלת לפי-עמדה (X:893-897).
נקודות כניסה להעברה: "הוסף אדם" במדריך האנשים; שורת "ערוך"; "ערוך" בפרטי אדם (מסך האנשים ה-read-only
שנבנה כעת, `pilot/T054-wiskey-people-screen`); בהמשך מדריך ההרשאות. הצעת route `#/wiskey/people/:id/edit`
ו-`#/wiskey/people/new` (מסך מלא, לא modal: לדיאלוג WisKey יש 7 fieldsets).
פריסה (X:913-955), מועברת לרכיבי `sw-*`:
1. אדם: שם (`required`, maxlength 32), מספר עובד (`^[A-Za-z0-9_-]{1,32}$`, מנוטרל כש-`identity_locked` +
   הערה `employee_locked`), טלפון (`type=tel`, maxlength 32, תצוגת `05X-xxx-xxxx` דרך `mobileDisplay`),
   active.
2. פרופיל (רק כש-`profile_settings` יש לה שדות/קבוצות/תמונה): תבנית onboarding (אדם חדש בלבד; מחילה
   `profile` + `group_ids`, מנקה overrides), פקד אחד לכל שדה מופעל (select כולל ערך legacy; טקסט maxlength
   100; `type=date` לתאריך; עשרוני למספר; `required` רק לאדם חדש), checkboxes קבוצה, תמונה.
3. עוד פעולות (אדם קיים, טיוטה לא-מעודכנת בלבד, אחרת `profile_save_first`): היסטוריית שינויים (→
   הביקורת/פעילות שלנו), מחיקה.
4. תוקף: מצב `always | period | weekly | dates` (weekly/dates זקוקים ליכולת `user_timing_draft`); אכיפה
   `ha | native` (זקוקה ל-`user_timing_enforcement`); `timing_readbacks` לפי-עמדה; `period` → בורר בסיס-
   אזור (UTC / אזור HA / אזור עמדה), עוזר יום-בודד (2000-01-01..2037-12-30), `valid_from`/`valid_until`
   `datetime-local`.
5. PIN: "מוגדר / לא מוגדר"; `pin_mode_blocked` כשלעמדה של כל שיוך מופעל יש `capabilities.pin_writable ===
   false`; חדש + אישור (`type=password inputmode=numeric`, `[0-9]*`, maxlength 128); סטטוס חי
   `pin_checking | pin_available | pin_conflict | pin_check_failed` (debounce 350 מ"ש, תוצאות ישנות
   מתעלמות); "צור PIN ייחודי"; "הסר PIN" / "השאר PIN".
6. כרטיסים: כרטיסים שמורים מציגים `masked_number` read-only + תווית (64) + active + הסרה; שורות חדשות
   דורשות `card_no` `^[A-Za-z0-9_-]+$` maxlength 32; "+ הוסף כרטיס"; "קרא כרטיס מהעמדה" (אדם קיים ולא-
   מעודכן בלבד; רמז `capture_save_user_first` אחרת); `<details>` של USB wedge (קלט מסוג password, Enter =
   בדיקה, מציג `•••• 4-ספרות-אחרונות · אורך`, "השתמש" מוסיף לטיוטה, מתנקה אוטומטית אחרי 60 שניות /
   לשונית מוסתרת / נעילה).
7. שיוכים: בחר הכול / נקה / איפוס overrides, מונה; לכל עמדה: checkbox (מנוטרל אם `!lock_enabled`), badge
   online, תווית מקור `permission_denied | permission_personal | permission_inherited · <groups> |
   permission_none`, "איפוס לירושה", checkboxes לפי-מנעול כשלעמדה יש >1 מנעול (ביטול הסימון של המנעול
   האחרון = deny), badge סנכרון.
כותרת תחתונה: ביטול, **שמור**, **שמור וסנכרן** (ראשי; `sync_now=true`); שניהם מנוטרלים בזמן עסוק או סטטוס
PIN `in_use`.

### א.2 התנהגות להעביר בדיוק
- בניית טיוטה `edit(user?)` (X:901-911): אדם חדש מקבל `employee_no` אקראי בן 9 ספרות (100000000 + uint32 %
  900000000, `crypto.getRandomValues`), `active true`, `cards []`; קיים = שכפול + `confirm_pin ""`,
  `timed = !!valid_from`; `permission_overrides ??=` משיוכים (`enabled → allow`, אחרת `deny`);
  `_editorPolicyRevision = profile_settings.revision`; JSON-בסיס לזיהוי שינוי-לא-שמור.
- מודל הרשאה (X:957-958; B:access/group_permissions.py, X:3433-3451): עמדה מופעלת אם ורק אם override
  `allow`, או (בלי `deny` וקבוצה מופעלת ב-`group_ids` מעניקה אותה); שיוכים מופעלים כברירת מחדל
  `allowed_locks: [1]`. deny אישי גובר על הכול.
- סדר האימות ב-`save()` (X:960-971): (1) `readValidity()` → `clock_invalid_local | clock_ambiguous |
  clock_nonexistent`; (2) `pin_mismatch`; (3) `pin_conflict` אם סטטוס in_use; (4) `invalid_validity` (חסר או
  from ≥ until); (5) `profileError` → `profile_required | profile_value_invalid` (רק ערכים שהשתנו לאנשים
  קיימים); (6) בדיקת כפילות (יכולת `identity_lifecycle`): `blocking` → `lifecycle_employee_conflict`, אחרת
  אישור `lifecycle_duplicate_confirm {count}`; (7) אילוצי `required`/`pattern` ילידיים.
- payload השמירה (X:973-999, מפתחות מילוליים): `employee_no, phone ("" מותר), display_name, active,
  valid_from|null, valid_until|null`, `access_timing_draft` (רק עם `user_timing_draft`),
  `access_timing_policy` (רק עם `user_timing_enforcement`; `{mode, schedule, bindings}` עם bindings
  מועברות רק אם המצב ללא שינוי, אחרת `{}`; מצב `ha` דורש `{}`), ואז **או** (`profile_settings` קיים)
  `permission_overrides`, `door_permissions {sid: allowed_locks}` (מופעלים בלבד), `access_policy_revision`
  **או** (בלי profile_settings) `assignments` הישן; `cards: [{id,label,card_type,enabled}]` לכרטיסים שמורים
  (בלי `card_no` → WisKey שומרת את הסוד השמור) ו-`[{card_no,label,card_type:"normalCard",enabled}]` לחדשים;
  `pin` רק כשהשתנה (`null` = הסרה); `profile`, `group_ids`, `photo` רק עם profile_settings. מפתחות לא-ידועים
  → `invalid_fields` (`USER_FIELDS` B:websocket.py:45-64; `CARD_FIELDS = {id, card_no, label, card_type,
  enabled}`). המלצה: ה-backend של SMPLWISE ממלא את `bindings` בעצמו מ-`users/get` טרי באותה revision במקום
  להעביר אותה הלוך-חזור דרך הדפדפן.
- הודעות הצלחה `saved_sync` / `saved`; "שמור" בלי sync עדיין משאיר את ה-reconciliation התקופתי (~300
  שניות) של WisKey פעיל (X:1540-1541); `sync_now` בעדכון נכנס לתור רק כששדות רלוונטיים-להתקן השתנו
  (B:access/manager.py:738-757).
- `refreshValidityZone()` מבטא מחדש טווח מוקלד כשכללי אזור משתנים (X:1021) — להעביר או להשמיט (בסיס-אזור
  הוא תמהון; ראו שאלה 7).

### א.3 פקודות WisKey שהעורך משתמש בהן

| פקודה | Payload (טיפוסים) | תשובה | סיווג | הרשאת WisKey | קודי שגיאה (מהמקור) |
|---|---|---|---|---|---|
| `users/get` | `user_id:str` | `ManagedUser.public()` (בלי `timing_readbacks`) | READ | users:view | `user_not_found` |
| `overview` (כבר נסקר על ידי ה-feed) | — | `profile_settings`, `capabilities` של עמדות, `integrated_locks`, `users[].timing_readbacks`, `api.capabilities` | READ | כל view | — |
| `users/photo_get` | `user_id:str` | `{photo: "data:image/jpeg;base64,…"\|null}` | READ | users:view | `user_not_found` |
| `users/pin_check` | `user_id:str` ("" חדש), `pin:str` `^\d{1,128}$`, `api_contract:1` | `{available:bool}` | READ (אורקל PIN) | users:manage | `invalid_pin`, `user_not_found` |
| `users/pin_generate` | `user_id:str`, `api_contract:1` | `{pin:"NNNNNN"}` (לא שמור) | READ | users:manage | `pin_generation_failed`, `user_not_found` |
| `users/duplicate_check` | `user_id:str`, `data:{employee_no≤32, display_name≤64, phone, card_suffixes:[4 ספרות]≤255}` | `{matches:[שורה+סיבות+התאמות-כרטיס], total, truncated, blocking, privacy}` | READ | users:view | `invalid_fields`, `invalid_phone` |
| `users/create` | `data:dict`, `sync_now?:bool=true`, `api_contract:1` | אדם public | CONFIG-WRITE (אחסון; התקן דרך reconciliation) | users:manage | ראו א.4 |
| `users/update` | `user_id:str`, `revision:int`, `data:dict` (patch), `sync_now?:bool`, `api_contract:1` | אדם public | CONFIG-WRITE | users:manage | ראו א.4 |
| `users/delete` | `user_id:str`, `revision:int`, `api_contract:1` | `{accepted:true}` | CONFIG-WRITE (מצבת + מחיקות התקן בתור) | users:manage | `revision_conflict`, `user_not_found`, קודי אחסון, `manager_closed` |
| פקודות לכידה | ראו א.7 | | | | |

לא בשימוש על ידי העורך של WisKey (בלי מסך; X:3723): `cards/add`, `cards/remove`, `users/set_active`. אין
להשתמש בהן גם כן.

### א.4 מסורב לעומת לא-ידוע עבור `users/create` / `users/update` / `users/delete` (אפקט = אחסון WisKey נכתב)
סדר במקור: בדיקות פרופיל של ה-handler (B:websocket.py:844-868) →
`manager._validate(build_user(permission_data(...)))` (B:manager.py:725-757, יכולות ממוטמנות בלבד, בלי I/O
להתקן) → `repository._commit` (התנגשויות מאומתות, ואז שמירה) → `request_user()` (עשוי להעלות
`manager_closed`) → `_changed()`.
- **מסורב (הוכח קדם-אחסון)**: סט `PRE_DISPATCH`; `profile_settings_unavailable`, `photo_disabled`,
  `invalid_fields`; כל קודי `build_user` (`invalid_identifier, invalid_text, invalid_boolean,
  unsupported_user_type, invalid_validity, invalid_pin, invalid_cards, invalid_id, unsupported_card_type,
  duplicate_card, invalid_assignments, unmanaged_lock, schedule_unverified, invalid_photo, invalid_phone,
  invalid_timing_policy, schedule_binding_invalid, invalid_user_timing, schedule_period_limit,
  schedule_invalid_time, schedule_overlap, schedule_invalid_date`); `group_policy_changed`; `_validate`:
  `station_not_found, station_has_no_managed_lock, person_exceeds_capabilities, pin_device_managed,
  pin_exceeds_capabilities, card_capacity, card_exceeds_capabilities`; `_commit`/התנגשויות:
  `revision_conflict, user_not_found, employee_conflict, pin_conflict, card_conflict,
  pin_removal_pending, card_removal_pending, photo_storage_full, identity_migration_required`;
  `storage_stopping`.
- **לא-ידוע**: `storage_write_failed` (כתיבה אטומית, לא-ניתן-להוכחה), `manager_closed` (מועלה על ידי
  `request()` **אחרי** ה-commit → נשמר אך לא נכנס לתור), `action_failed`, `device_unavailable` (בלי I/O
  להתקן צפוי בנתיב הזה — לא הוכח), timeout, session שאבד, צורת תשובה בלתי-צפויה. אחרי לא-ידוע, ה-UI חייב
  לקרוא מחדש את האדם (`users/get`) ולהשוות `revision` לפני כל דבר אחר; לעולם לא לנסות שוב אוטומטית. בטיחות
  replay: עדכון הוא CAS על `revision`; יצירה מוגנת על ידי ה-`employee_no` שנוצר בלקוח
  (`employee_conflict` ב-replay) בתוספת ה-dedupe של `client_request_id` שלנו.
- מחיקה: `revision_conflict`, `user_not_found`, `storage_stopping` מסורב; `storage_write_failed`,
  `manager_closed` (מ-`request()` אחרי ה-commit של המצבה), `action_failed` לא-ידוע.

### א.5 פרטיות: העורך זקוק להקרנה משלו (לא הרחבה של `access.read`)
החלטת 0.1.105: הקרנת הקריאה (`project_person`, `PERSON_KEYS`) מסירה טלפונים, כרטיסים, דגלי PIN, ערכי
פרופיל, תמונה, overrides, תזמון, readbacks, identity_locked, שגיאות שיוך. העורך זקוק באופן לגיטימי, ו-
endpoint חדש המשוער (gated) על `access.people.manage` מחזיר (לעולם לא ממוטמן, לעולם לא משודר, לעולם לא
מוגש תחת `access.read`):
- `phone` (שדה עריכה) · `pin_configured` (דגל בלבד — WisKey לעולם לא מחזירה ערך PIN; פלט `pin_generate`
  מוצג פעם אחת בטופס) · `cards[{id, masked_number, label, card_type, enabled}]` — **מספרי כרטיס מלאים
  לעולם לא זמינים מ-WisKey אחרי שמירה** (`ManagedCard.public()` ממסכת ל-`"•••• " + 4-אחרונות`,
  X:2941-2943); המספרים המלאים היחידים שעורך אי-פעם רואה הם אלו שהוא מקליד או סורק לטופס בעצמו · ערכי
  `profile` · `group_ids` · `photo_configured` (+ `users/photo_get` לפי דרישה, אם שאלה 6 מתירה) ·
  `permission_overrides` · `access_timing_draft`, `access_timing_policy` (בלי `bindings`, ראו א.2) ·
  `timing_readbacks` (מהעותק overview של ה-feed; ל-`users/get` אין אותם) · `identity_locked` · `revision` ·
  שיוכים עם `enabled, allowed_locks, sync_state, last_error, desired_revision, applied_revision`.
- הקשר עורך (אותו endpoint או אח): `profile_settings {revision, fields, groups, photo_enabled,
  templates}`; עמדות `{id, name, online, lock_enabled, integrated_locks[{physical_index, name}],
  capabilities.pin_writable}`; `api.capabilities` (`user_timing_draft`, `user_timing_enforcement`,
  `identity_lifecycle`). `intercom_sync._station` / `project_overview` כרגע משמיטים את כל אלה; להרחיב
  הקרנת-עורך **נפרדת** במקום את הציבורית.
- תשובות `duplicate_check` מכילות טלפונים וסיומות-כרטיס של אנשים אחרים: להקרין ל-`{total, truncated,
  blocking, matches:[{id, display_name, employee_no, reasons}]}`.
- `pin_check` הוא אורקל PIN (ל-WisKey יש אותה חשיפה; X:1552): ראו שאלה 8.

### א.6 endpoints מוצעים של SMPLWISE (מסך א')

| שיטה + נתיב | מודל גוף (JSON בלבד) | הרשאה | אישור/שמירה |
|---|---|---|---|
| GET `/intercom/people/{id}/editor` | — | `access.people.manage` | קריאה; מחזיר הקרנת א.5 |
| GET `/intercom/people/editor-context` | — | `access.people.manage` | קריאה |
| GET `/intercom/people/{id}/photo` | — | `access.people.manage` (שאלה 6) | קריאה |
| POST `/intercom/people/pin-check` | `{user_id:str≤128\|"" , pin:^\d{1,128}$}` | `access.people.manage` | bucket צר משלו (שאלה 8); לעולם לא מבוקר עם הערך |
| POST `/intercom/people/pin-generate` | `{user_id}` | `access.people.manage` | קריאה |
| POST `/intercom/people/duplicate-check` | `{user_id, employee_no, display_name, phone, card_suffixes[]}` | `access.people.manage` | קריאה |
| POST `/intercom/people` | `PersonSaveBody{data, sync_now:StrictBool, client_request_id, expires_at}` | `access.people.manage` | שליחת טופס; ביקורת ניסיון/תוצאה; נתיב config |
| PUT `/intercom/people/{id}` | `PersonSaveBody + revision:StrictInt` | `access.people.manage` | אותו דבר |
| DELETE→POST `/intercom/people/{id}/delete` | `{revision, confirmed, client_request_id, expires_at}` | `access.people.manage` | `sw-dialog` המציג "מסיר מ-N עמדות" (שיוכים + ביטולים ממתינים); השרת מסרב בלי `confirmed:true`; הטיוטה חייבת להיות לא-מעודכנת |

`PersonSaveBody.data` מאומת על ידי SMPLWISE במודל pydantic שמשקף את `USER_FIELDS` / `CARD_FIELDS` בדיוק
(מפתחות נוספים אסורים, `StrictInt`/`StrictBool`), כך שטיוטות פגומות מסורבות מקומית (`not_sent`) במקום
להגיע ל-WisKey.

### א.7 לכידת כרטיס — הזרימה האמיתית המלאה (אינטראקציה פיזית ארוכת-ריצה ראשונה)
אומת ב-B:access/enrollment.py וב-B:client/capture.py.

**תנאים מקדימים (בצד WisKey)**: האדם כבר שמור והטיוטה של העורך לא-מעודכנת (panel.ts:4109-4120); העמדה
הנבחרת חייבת להיות במנהל של WisKey, בעלת driver (online) ומנעול מנוהל עם `enabled_doors`
(`_driver`: `station_offline`, `station_has_no_managed_lock`); ה-UI של WisKey מציע רק עמדות `lock_enabled
&& online`, הראשונה נבחרת מראש. העמדה חייבת להכריז בדיוק `isSupportCaptureCardInfo == true` אחד ו-
`CaptureCardInfo/capabilities` (`CardInfoCap`), אחרת `capture_unsupported`. אין צורך במנוי חי בצד WisKey:
ה-sessions חיים בזיכרון WisKey, נסקרים לפי מזהה.

**שלבים**
1. `cards/reader_capabilities {station_id, api_contract:1}` (READ, GET-ים של ההתקן: זהות, `GET
   /ISAPI/AccessControl/capabilities`, `GET /ISAPI/AccessControl/CaptureCardInfo/capabilities?format=json`;
   35 שניות) → `{readers:[int], card_min, card_max}`. גבולות `readerID` 1-8 → `range(min,max+1)`; נעדר →
   `[0]` (0 = השמטת readerID, "קורא ברירת מחדל של העמדה"). אורך כרטיס ברירת מחדל 1-32. שגיאות:
   `manager_closed, station_not_found, station_offline, station_has_no_managed_lock, capture_unsupported,
   device_unavailable, action_failed`.
2. `cards/capture_start {station_id, user_id, revision:int, reader_id:int 0..8, api_contract:1}` —
   PHYSICAL. בדיקות סינכרוניות ואז משימת אספן ברקע; תשובה = session `{session_id, station_id, user_id,
   revision, state:"preparing", error:null, card:null}`. מגבלות: TTL של session **120 שניות**
   (`SESSION_SECONDS`, טיימר פקיעה משמיט אותו אלא אם `applying`), **session אחד לכל עמדה**
   (`capture_station_busy`), **3 sessions בסך הכול על פני כל משתמשי WisKey** (`capture_limit`) — משותף עם
   אנשים המשתמשים בפאנל של WisKey עצמה.
3. אספן (`_collect`, בסך הכול **70 שניות**): קורא מחדש יכולות (`capture_reader_invalid` אם הקורא נעלם),
   קובע `waiting`, ואז מנפיק `GET /ISAPI/AccessControl/CaptureCardInfo?format=json[&readerID=N]` על נתיב
   HTTP נפרד עם מועד **30 שניות** — הקורא של העמדה ממתין להצגה של כרטיס אחד. מאמת `CardInfo.cardNo`
   (card_min..card_max, `[A-Za-z0-9_-]`), `cardType ∈ {TypeA_M1, TypeA_CPU, TypeB, ID_125K, FelicaCard,
   DesfireCard}`, `readerID` 1-8 ושווה לזה שהתבקש. הצלחה → `captured` (המספר נשמר בזיכרון WisKey בלבד).
   כישלון → `error` עם `capture_timeout | capture_unsupported | <קוד AccessError> | capture_failed` (טקסט
   ההתקן הגולמי לעולם לא נשמר).
4. `cards/capture_status {session_id}` (READ; ב-READ_COMMANDS) → session עם `card: null | {masked_number
   "•••• NNNN", technology, reader_id}`. מצבים: `preparing → waiting → captured | error`; `applying`
   בזמן אישור. מזהה לא-ידוע/זר/שפג → `capture_not_found`.
5. `cards/capture_confirm {session_id, label:str≤64 (יכול להיות ריק), api_contract:1}` — CONFIG-WRITE:
   דורש `captured` (`capture_not_ready`), תווית דרך `text_field` (`invalid_text`), האדם עדיין ב-revision של
   ה-session (`revision_conflict`, ה-session מושמט), המספר עדיין לא על המשתמש (`card_conflict`, מושמט);
   ואז `manager.async_update(user, {"cards": [...כרטיסים קיימים {id,label,enabled}...,
   {card_no, label, card_type:"normalCard", enabled:true}]}, revision=session.revision)` עם `sync_now`
   ברירת מחדל **true** → תור reconciliation מיידי → הכרטיס נכתב לעמדות המשויכות של האדם **ומעניק גישה
   פיזית** שם. ה-session תמיד מושמט אחר כך. מחזיר אדם public. פעולת ביקורת WisKey `cards/capture_confirm`.
6. `cards/capture_cancel {session_id}` → `{cancelled:true}`; מזהה לא-ידוע = no-op; בזמן אישור →
   `capture_applying`. משמיט את ה-session ומבטל את האספן (מבטל את ה-GET בצד HA). מופעל גם ב-UI של WisKey
   בסגירה / שינוי-עמדה / "אסוף שוב". sessions מושמטים גם כשעמדה מתנתקת.

**מה ההתקן והדלת עושים בינתיים** — עובדות ופערים:
- WisKey לא שולחת שום פקודת ממסר בלכידה; שום דבר בנתיב הלכידה לא פותח דלת. הדלת נשארת תחת הכללים
  הרגילים של העמדה. הניסוח של WisKey עצמה (`capture_hint`, i18n.ts:1403): "כרטיס שכבר מורשה עדיין עשוי
  להפעיל את המנעול תחת הכללים הקיימים של העמדה." האם הצגת כרטיס שכבר-רשום במהלך הלכידה גם נלכדת וגם פותחת
  את הדלת: **לא-מאומת**.
- "סגירה עוצרת את הלכידה ב-HA; ה-timeout של הקורא בהתקן נשלט על ידי firmware." (`capture_limits`,
  i18n.ts:1411) — אחרי ביטול/timeout הקורא עשוי להישאר במצב לכידה עד ל-timeout של ה-firmware שלו עצמו:
  **משך לא-מאומת**.
- אותה מחרוזת מסתיימת ב-"הלכידה הפיזית עדיין זקוקה להרצה (commissioning)." — כלומר, מחבר WisKey לא אימת
  לכידה על חומרה אמיתית. **לא-מאומת מקצה-לקצה; בדיקת מעבדה עם הבעלים חובה לפני שחרור** (כלל CLAUDE.md
  להתקנים: אישור מפורש-למשימה עבור הבדיקה החיה).

**מסורב לעומת לא-ידוע**
- `cards/reader_capabilities`: READ — השגיאות הן כשלי קריאה פשוטים.
- `cards/capture_start`: כל מה שב-`start()` רץ **לפני** שמשימת האספן נוצרת (B:enrollment.py:71-92, לכן
  **מסורב (קדם-התקן)**: `PRE_DISPATCH`, `unauthorized` (שחקן ריק), `manager_closed`, `station_not_found`,
  `station_offline`, `station_has_no_managed_lock`, `user_not_found`, `revision_conflict`,
  `invalid_fields`, `capture_station_busy`, `capture_limit`. **לא-ידוע**: `action_failed`,
  `device_unavailable` (לא מועלה על ידי `start()` — לא הוכח), timeout, session שאבד, תשובה בלי `session_id`
  מסוג string. תוצאה של לא-ידוע: session שאיננו יכולים לראות עשוי להתקיים ולחסום את העמדה הזו עד 120
  שניות (ההפעלה הבאה שם עונה `capture_station_busy`); UI: "תוצאה לא-ידועה — הקורא אולי ממתין עד 2 דקות;
  שום כרטיס לא ייווסף בלי אישורך".
- `cards/capture_confirm` (אפקט = אחסון): **מסורב**: `PRE_DISPATCH`, `capture_not_found`,
  `capture_not_ready`, `invalid_text`, `user_not_found`, `revision_conflict`, `card_conflict`, בתוספת כל
  קוד קדם-אחסון של `users/update` (א.4: `card_removal_pending`, `card_capacity`,
  `card_exceeds_capabilities`, `invalid_cards`, `duplicate_card`, `station_*`, `storage_stopping`...).
  **לא-ידוע**: `storage_write_failed`, `manager_closed`, `action_failed`, timeout → לקרוא מחדש את האדם
  ולחפש revision+1 וכרטיס חדש שהסיומת הממוסכת שלו שווה לזו שנלכדה. המצב של ה-UI של WisKey עצמה לזה הוא
  `unconfirmed` ("תוצאת השמירה אינה מאושרת... לבדוק את המשתמש ולסנכרן לפני שמתחילים שוב").
- `cards/capture_cancel`: ניקוי; לעולם לא מסורב על ידי ההרשאה של SMPLWISE עצמה ברגע שה-session שייך
  לקורא; לרשום שורת ביקורת אחת. `capture_applying` = "אישור בתהליך".

**endpoints של SMPLWISE ללכידה**

| שיטה + נתיב | גוף | הרשאה | שמירה |
|---|---|---|---|
| GET `/intercom/stations/{sid}/card-readers` | — | `access.cards.capture` | קריאה (40 שניות) |
| POST `/intercom/people/{id}/card-capture` | `{station_id, reader_id:StrictInt 0..8, revision:StrictInt, confirmed, client_request_id, expires_at}` | `access.cards.capture` + `access.people.manage` | כפתור ה-Start בדיאלוג הלכידה הוא האישור (`confirmed:true` נאכף בשרת, כמו `ReleaseBody`); העמדה חייבת להיות בעותק המוגש, online, `lock_enabled`; ביקורת ניסיון/תוצאה; נתיב פעולה; SMPLWISE רושמת `session_id → (משתמש_smplwise, עמדה, אדם, started_at)` |
| GET `/intercom/card-capture/{session_id}` | — | אותו דבר, וה-session בבעלות הקורא (אחרת 404) | קריאה; ברובו מוחלף על ידי הודעות ws של `intercom_capture` מ-poller בצד ה-backend (0.3) |
| POST `/intercom/card-capture/{session_id}/confirm` | `{label≤64, confirmed, client_request_id, expires_at}` | `access.cards.capture` + `access.people.manage` | `sw-dialog`: "להוסיף את הכרטיס שנלכד (•••• NNNN) ל-{שם} ולסנכרן את השיוכים הקיימים שלו/ה?"; נתיב config; שורת הביקורת רושמת רק `cards_added: 1`, לעולם לא ספרות |
| POST `/intercom/card-capture/{session_id}/cancel` | `{}` | בעל ה-session | נשלח גם על ידי ה-backend כשהדפדפן הבעלים ws נסגר או הדיאלוג נעזב; לרשום שורת ביקורת אחת |

מצבי UI להעביר (X:1037-1043; i18n `capture_state_*`): `choose` (לקוח) → `preparing` → `waiting` ("הצג כרטיס
אחד לעמדה הנבחרת כעת.") → `captured` (מספר ממוסך + טכנולוגיה, קלט תווית, רשימת "שיוכי עמדה קיימים") →
`applying` → הושלם; `error` (+ "אסוף כרטיס נוסף" קורא מחדש יכולות); `unconfirmed` (לקוח, אחרי אישור עם
תוצאה לא-ידועה). להציג ספירה-לאחור (70 שניות לכידה / 120 שניות session). בורר העמדה מנוטרל ברגע שהתחיל.
התראת `capture_revision_changed` כשה-revision של האדם זז (השוואה עם הרענון של ה-feed). תרגומי WisKey
חסרים להוסיף בעצמנו: `capture_state_applying`, `capture_state_expired`, `capture_state_cancelled`,
`manager_closed` (X:1530-1536).

### א.8 חלוקה לפרוסות מוצעת
- **A1 ליבת עורך**: הקרנה + הקשר, זהות/טלפון/active, תוקף `always|period`, PIN (קביעה/הסרה/יצירה/בדיקה),
  כרטיסים מוקלדים + USB, שיוכים/overrides/מנעולים, שדות/קבוצות/תבניות פרופיל (בלי תמונה), יצירה/עדכון/
  מחיקה, בדיקת כפילות, ביקורת + מעטפה + נתיב config.
- **A2 לכידת כרטיס** (PHYSICAL, מחזור סקירה משלה + session מעבדה).
- **A3 אופציונלי**: תזמון weekly/dates עם אכיפת `ha`/`native` + readbacks (פורט של `hikvision-user-timing`,
  X:2534-2596); תמונה (שאלות 6/7).

---------------------------------------------------------------------------------------------------------------------

## 2. מסך ב' — הגדרות טכניות של דלת/עמדה (הבית של תוכניות דלת והיפוך ממסר)

### ב.1 מטרה, נקודות כניסה, פריסה
עמוד ניהול לפי-עמדה (X:1130-1175) עם לשוניות עמדה `overview | programs | public_codes | settings` (עברית:
סקירה / תוכניות פתיחה / קודים ציבוריים / הגדרות). כניסה: כרטיס העמדה של מרכז הכניסה ("פרטי עמדה") ותת-ניווט
WisKey "דלתות" (`#/wiskey/doors/:stationId/:tab`). עמדה אחת בכל פעם (התנהגות WisKey 04).
- **סקירה**: זהות (דגם/firmware/מארח הם נתוני-תחום-עמדות — לשמור אותם מחוץ ל-`access.read` אלא אם הבעלים
  רוצה אותם), ממסרים 1-2 מוגדרים/לא + שם · מזהה API, שחרור לפי-ממסר (כבר בנוי: לנצל-מחדש את דיאלוג
  השחרור), ספירות, פרטי שעון ויכולת (קריאה), rescan / סנכרון עמדה (config; אופציונלי, לא התבקש).
- **programs**: להעביר את `wiskey-door-programs` (X:4671-4720).
- **settings**: להעביר את `hikvision-station-technical` מצב `settings` (X:4618-4668): כפתור "קרא הגדרות"
  (בלי קריאה אוטומטית), עורך ממסר (ראו שאלה 9), עורך דלת אחד לכל דלת DoorParam.
- **public_codes**: מחוץ להיקף התדריך הזה (שאלה 9).

### ב.2 הגדרות טכניות של עמדה — התנהגות להעביר
- קריאה (`technical_get`) היא ידנית; כל הדוח וכל הטיוטות נזרקים אחרי **כל** כישלון כתיבה
  (`technical_write_unknown` "השינוי לא אושר. לקרוא את העמדה לפני ניסיון חוזר."). המצב מתאפס בשינוי עמדה.
- שדות עורך הדלת נוצרים מתוך `door.constraints`: טקסט `doorName` (min..max ≤64, בלי תווי בקרה), מספר שלם
  `openDuration` (min..max ≤255 שניות), boolean `relayReverseEnabled` (רק אם `@opt` הוא `true,false`). ניתן
  לעריכה רק אם מזהה ה-API של הדלת נמצא ב-`integrated_locks[].api_id`; אחרת `technical_unmanaged`. דלת
  מנוהלת: checkbox אישור `technical_confirm` ("החל את ההגדרות האלה. היפוך הממסר עשוי לשנות את מצב המנעול
  הפיזי.") + שמור; כל עריכה מאפסת את האישור של אותה דלת.
- שגיאות קריאת דלת לפי-דלת (`{door, error}`) ו-`password_error` מוצגות, לא חמורות. דלתות לא-מנוהלות עדיין
  נקראות.

### ב.3 פקודות WisKey שמסך ב' משתמש בהן

| פקודה | Payload | תשובה | סיווג | הרשאת WisKey | שגיאות |
|---|---|---|---|---|---|
| `stations/technical_get` | `station_id`, `api_contract:1` | `{checked_at, doors:[{door:1\|2, values:{doorName?, openDuration?, relayReverseEnabled?}, constraints:{…}} \| {door, error}], passwords: null\|{states, public_pin_state}, password_error, features:[{family,name,supported}], relay_selection:<entry.data.locks: [{physical_index, api_id, confirmed, name?}]>}` | READ (התקן; מחזיק סלוט technical busy; ≤75 שניות) | stations:view | `station_unloaded, device_busy, device_unavailable, action_failed` |
| `stations/technical_update` | `station_id, door:int` (**מזהה API**, חייב להיות `api_id` מנוהל), `expected:dict` (כל הערכים כפי שנקראו, deep-equal), `changes:dict` (לא-ריק ⊆ doorName/openDuration/relayReverseEnabled), `confirmed:bool` (חייב true), `api_contract:1` | `{door, values, constraints}` (readback טרי) | CONFIG-WRITE התקן (`PUT /ISAPI/AccessControl/Door/param/{door}` XML עם רק הצמתים שהשתנו); `relayReverseEnabled` = PHYSICAL | stations:manage | למטה |
| `stations/technical_program_list` | `station_id`, `api_contract:1` | `{programs:[{station_id, door, api_id, revision, policy, enabled, removing, execution:{owned, attempted, status}, error, checked_at}], saved:[טיוטות legacy], timezone:<אזור HA>, native_supported:false}` | READ (אחסון בלבד, אך תופס את סלוט technical busy) | stations:view | `station_unloaded, device_busy` |
| `stations/technical_program_save` | `station_id, door:int` (**physical_index**), `revision:int` (0 חדש / נוכחי), `policy:{timezone:IANA≤64, schedule:{name≤32, weekly:{Monday..Sunday:[{start,end}]} (בדיוק 7 מפתחות), holidays:[{name≤32 לא-ריק, start, end, periods}] ≤64}}`, `enabled:bool`, `api_contract:1` | `{programs:[…]}` | `enabled:true` PHYSICAL (מתוזמן); `false` CONFIG-WRITE אחסון | stations:manage | למטה |
| `stations/technical_program_action` | `station_id, door:int` (פיזי), `revision:int`, `action:"pause"\|"remove"`, `api_contract:1` | `{programs:[…]}` | PHYSICAL (מיידי `close` אם ה-program מחזיק hold) + אחסון | stations:manage | למטה |
| `stations/technical_hold_delete` | `station_id, door, revision` | `{deleted:true}` | CONFIG-WRITE אחסון (טיוטת legacy) | stations:manage | `revision_conflict, operation_unsupported, invalid_storage` |
| `stations/technical_relays` | `station_id, expected:list (== entry.data.locks), locks:[{physical_index, api_id, confirmed:true, name?}]` | `{reload_required:true}` | CONFIG-WRITE config entry של HA + **טעינה מחדש של האינטגרציה** | stations:manage | `revision_conflict, operation_unsupported, hold_pause_before_edit, access_removal_pending` — נדחה (שאלה 9) |

אימות מדיניות (B:access/hold_open.py `policy`, B:access/schedules.py `normalize`/`periods`): מפתחות בדיוק
`{timezone, schedule}` / `{name, weekly, holidays}`; פרקי-זמן ≤8 ליום, `HH:MM`, סוף יכול להיות `24:00`,
start<end, ממוינים, בלי חפיפה (נגיעה מותרת); תאריכים `YYYY-MM-DD` 2000-2037, טווחי חג לא-חופפים. שגיאות
`invalid_fields, invalid_timezone, invalid_text, schedule_invalid_week, schedule_period_limit,
schedule_invalid_time, schedule_overlap, schedule_invalid_date, schedule_holiday_limit,
schedule_holiday_overlap`. תמהוני UI לשמור/לתקן: סדר UI שמתחיל ביום ראשון; סוף `00:00` שהוקלד = `24:00`;
"כל היום" = 00:00-24:00; חריגי תאריך נקראים "Date" על ידי WisKey (ה-backend דורש לא-ריק ≤32 — אולי ניתן
למשתמש לתת להם שם).

**מלכודת מזהה**: `technical_update` משתמשת ב-**מזהה API של הדלת**; `technical_program_*` ו-`test_unlock`
משתמשים ב-**אינדקס הפיזי**. הקרנת העמדה של SMPLWISE כרגע שומרת רק `physical_index` + שם; המסך הזה זקוק גם
ל-`api_id` (מ-`integrated_locks` או `relay_selection`).

### ב.4 מסורב לעומת לא-ידוע עבור כתיבות מסך ב' (אומת ב-B:technical_api.py, B:client/technical.py,
B:access/hold_programs.py)
- `stations/technical_update` (אפקט = PUT ל-DoorParam): **מסורב**: `PRE_DISPATCH`, `device_busy` (כניסה
  בלבד), `operation_unsupported` (הדלת אינה api_id מנוהל — נבדק לפני `update_door`), `invalid_fields`
  (`confirmed` לא true; סכימה). **לא-ידוע**: `station_unloaded` (מועלה גם אחרי ה-PUT), `device_unavailable`
  (מכסה **גם** אימות קדם-PUT — אי-התאמת `expected` "פרמטרי הדלת השתנו; טען מחדש לפני שמירה", שדה לא
  מוכרז, מחוץ לגבולות, שינויים ריקים — **וגם** כישלון PUT **וגם** "השינוי הטכני לא אושר על ידי readback"),
  `action_failed` (timeouts של 40/75 שניות), session שאבד. כדי לשמור על "לא-ידוע" נדיר, SMPLWISE מאמתת
  מראש את `changes` מול האילוצים שהיא הגישה ומסרבת מקומית (`not_sent`). אחרי **כל** לא-ידוע: לזרוק טיוטות
  ולדרוש `technical_get` טרי (WisKey עושה אותו דבר).
- `stations/technical_program_save` (אפקט = program נשמר; עם `enabled:true` הטיימר של 15 שניות אז מפעיל):
  **מסורב**: `PRE_DISPATCH`, `device_busy`, `operation_unsupported` (בלי runtime lock עם אותו אינדקס פיזי,
  או `verify_hold_support` נכשל — שניהם לפני `programs.update`), כל קודי אימות-המדיניות לעיל,
  `revision_conflict` ו-`hold_pause_before_edit` ו-`schedule_limit` (נבדקים תחת מנעול ה-program לפני
  `persist`), `device_unavailable` (רק קריאות זהות/יכולת-RemoteControl קדם-persist נוגעות בהתקן כש-
  `enabled:true`; שום דבר בצד-ההתקן לא בא אחרי `persist`), `storage_stopping`.
  הערה: `revision_conflict` אחרי-persist יכול לבוא רק ממחיקת טיוטת hold legacy, וכל פקודת `technical_*`
  לעמדה מסודרת (serialised) על ידי סט `technical_busy`, כך שהיא לא יכולה להתחרות — הסוקר צריך לאשר מחדש את
  הקריאה הזו.
  **לא-ידוע**: `station_unloaded` (בדיקת יציאה), `storage_write_failed`, `action_failed`, timeout. אחרי
  לא-ידוע → לקרוא מחדש `technical_program_list`.
- `stations/technical_program_action` (אפקט = `enabled:false` נשמר, ואז tick מיידי ששולח `close` אם
  מוחזק): **מסורב**: `PRE_DISPATCH`, `device_busy`, `invalid_fields` (action אינה pause/remove),
  `revision_conflict` (לפני persist). **לא-ידוע**: `station_unloaded`, `storage_write_failed`,
  `action_failed`, timeout.
  **קריטי**: כשלי ה-tick **נבלעים** (B:hold_programs.py `tick_key`: `except Exception` → שומר
  `error:"technical_write_unknown"` ומחזיר), כך שהפקודה עונה `success:true` אפילו כש-`close` נכשל. הקרנת
  SMPLWISE חייבת לבדוק את ה-program שהוחזר לאותה דלת: רשומה נעלמה (הוסרה + לא מוחזקת) → נסגר/אושר;
  `enabled:false, execution.owned:false, status:"idle"` → שחזור אושר (מצב פיזי לא-מאומת);
  `error:"technical_write_unknown"` או `status ∈ {"unknown","restoring"}` או `removing:true` עדיין נוכח →
  **תוצאת השחזור לא-ידועה** (WisKey מנסה שוב `close` כל 15 שניות בזמן `removing`; program בהשהיה עם close
  לא-ידוע **לא** מנוסה שוב — קריאה-מחדש מראה זאת). לעולם לא לדווח על השהיה כ"דלת נעולה".

### ב.5 מה תוכניות דלת מתוזמנות עושות פיזית
- נשמר ב-WisKey (`.storage/hikvision_intercom.hold_programs`, אחד לכל עמדה/דלת פיזית) ומופעל על ידי טיימר
  HA כל **15 שניות** (`async_track_time_interval`, B:access_runtime.py:156-183; ticks חופפים מדולגים;
  Semaphore 3). שום לוח-זמנים בצד-ההתקן לא נכתב (`native_supported:false`).
- בכל tick, לתוכנית מופעלת: חישוב אסימון החלון `YYYY-MM-DD/start/end` באזור-הזמן של ה-program (רשומת חג
  גוברת על יום-בשבוע). כניסה לחלון → שמירת כוונה (`owned:true, status:"opening"`) **לפני** I/O → `PUT
  /ISAPI/AccessControl/RemoteControl/door/{api_id}` `<RemoteControlDoor><cmd>alwaysOpen</cmd></RemoteControlDoor>`
  (זהות מאומתת, `verify_hold_support` דורש `cmd@opt ⊇ {alwaysOpen, close}`; כל `statusCode` חייב להיות "1"
  אחרת `ambiguous_write`) → `held_acknowledged`. הדלת **מוחזקת פתוחה** לכל אורך החלון. יציאה מהחלון, השהיה,
  הסרה, שינוי מיפוי-מנעול/זהות, או הפעלה-מחדש של HA בזמן שמוחזק → `close` (`restoring` → `idle`). "close"
  לעומת "resume": WisKey משתמשת רק ב-`alwaysOpen`/`close`; האם `close` מחזיר את הדלת ללוח-הזמנים הרגיל של
  העמדה או כופה אותה נעולה: **לא-מאומת** (תיעוד WisKey: סמנטיקת `resume` לא מונחת, X:5009).
- תזמון: `program_save` עם `enabled:true` **לא** עושה tick מיידית — `alwaysOpen` ראשון עד 15 שניות מאוחר
  יותר אם כעת בתוך חלון (X:5338). `program_action` עושה tick מיידית.
- סמנטיקת כישלון (מהמקור, X:5039-5043): פתיחה כושלת/לא-ידועה ואז `close` בה-tick הבא ו**לא** נפתחת מחדש
  באותו חלון; אחרי הפעלה-מחדש של HA בזמן שמוחזק, ה-tick הראשון שולח `close` והדלת לא מוחזקת מחדש עד
  לחלון הבא; חלונות רצופים מייצרים `close` ואז `alwaysOpen` ~15 שניות אחר כך. **אם HA או הרשת נופלים בסוף
  החלון, הדלת נשארת מוחזקת פתוחה** (`hold_dependency`: "במהלך תקלה הדלת עשויה להישאר לא-נעולה עד שהתקשורת
  חוזרת").
- האישור של WisKey = statusCode "1" של ISAPI בלבד; טקסט UI "פקודת ההחזקה-פתוחה אושרה; המצב הפיזי לא אומת."
- readback בטוח: `technical_program_list` (אחסון בלבד, בלי I/O להתקן) → `execution.status ∈ idle | opening
  | held_acknowledged | restoring | unknown`, `owned`, `error`, `checked_at` ("המעבר האחרון נרשם"). בתוספת
  תמונת המצלמה שלנו. שום פקודת WisKey לא קוראת את מצב-ההחזקה בפועל של הדלת מההתקן (**לא-מאומת** האם ישות
  ה-`lock` של HA משקפת אותו).
- כללי עריכה: תוכנית מופעלת/מוחזקת/מוסרת לא ניתנת לשמירה (`hold_pause_before_edit`); זרימת העריכה של
  WisKey = אישור `program_edit_pause` → `action:"pause"` → פתיחת עורך עם ה-program שהוחזר (מושהה) → "שמור
  והפעל" או "שמור בלי הפעלה". אין פעולת resume: הפעלה-מחדש = שמירה עם `enabled:true`. תוכנית אחת לכל דלת.

### ב.6 מה היפוך ממסר עושה פיזית
- `relayReverseEnabled` הוא boolean DoorParam של Hikvision שהופך את מצב-המנוחה של הממסר (לוגיקת
  normally-open ↔ normally-closed). הוא מוחל על ידי `PUT /ISAPI/AccessControl/Door/param/{door}` ו-WisKey
  אז קוראת את DoorParam בחזרה ודורשת שהערכים ישוו לסט הרצוי (אחרת `device_unavailable`, כלומר לא-ידוע).
  השינוי צפוי לפעול **מיידית** על פלט הממסר: בהתאם לאופן שהמנעול מחווט (fail-safe לעומת fail-secure, מגע
  NO לעומת NC) הדלת יכולה להפוך ל**לא-נעולה ברציפות** או נעולה ברציפות עד שהופכת בחזרה, וכל שחרור מאוחר
  יותר גם הופך. אפקט מדויק על עמדת המעבדה: **לא-מאומת** — WisKey רק מזהירה "היפוך הממסר עשוי לשנות את מצב
  המנעול הפיזי."
- איך WisKey מאשרת את זה: ה-readback של הפרמטר השמור בלבד (לא הממסר הפיזי).
- readback בטוח: `stations/technical_get` → `doors[].values.relayReverseEnabled` (READ). בתוספת תמונת
  מצלמה של הדלת.
- `openDuration` משנה את אורך כל שחרור עתידי (config, לא הפעלה); `doorName` הוא קוסמטי.
- המלצה: לעולם לא לשלוח `relayReverseEnabled` באותו `changes` כמו `doorName`/`openDuration`; endpoint,
  הרשאה ודיאלוג נפרדים.

### ב.7 endpoints מוצעים של SMPLWISE (מסך ב')

| שיטה + נתיב | גוף | הרשאה | אישור/שמירה |
|---|---|---|---|
| GET `/intercom/stations/{sid}/technical` | — | `access.doors.manage` | קריאה, 80 שניות; ההקרנה שומרת `features`, `passwords.public_pin_state` + דגלי סלוט, doors, `relay_selection` |
| POST `/intercom/stations/{sid}/doors/{api_id}/settings` | `{expected:{…}, changes:{doorName?, openDuration?}, confirmed, client_request_id, expires_at}` | `access.doors.manage` | checkbox אישור לפי-דלת → `confirmed:true` (WisKey דורשת אותו גם כן); בדיקת אילוץ מקומית; לסרב ל-`relayReverseEnabled` כאן; נתיב config; ביקורת ערכים ישנים/חדשים (לא-סוד) |
| POST `/intercom/stations/{sid}/doors/{api_id}/relay-reverse` | `{expected:{…}, value:StrictBool, confirmed, client_request_id, expires_at}` | `access.doors.physical` | `sw-dialog` (סכנה): "מצב-המנוחה של הממסר יתהפך מיידית. הדלת עשויה להישאר לא-נעולה (או נעולה) עד שתהפוך אותה בחזרה. בדוק את המצלמה."; `confirmed:true` נאכף בשרת; העמדה online בעותק המוגש; שמירה לפי-עמדה כמו `_RelayGuard` (כתיבה טכנית אחת לעמדה, מוחזקת 10 שניות אחרי לא-ידוע); ביקורת ניסיון/תוצאה; התשובה כוללת את ה-readback של `values` |
| GET `/intercom/stations/{sid}/programs` | — | `access.read` (שאלה 3) | קריאה; תופסת את הסלוט העסוק של WisKey → לטפל ב-`device_busy` כ"עמדה עסוקה, נסה שוב" |
| PUT `/intercom/stations/{sid}/programs/{door}` | `{revision:StrictInt, policy, enabled:StrictBool, confirmed, client_request_id, expires_at}` | `enabled:false` → `access.doors.manage`; `enabled:true` → `access.doors.physical` | דיאלוג ההפעלה נוקב את החלונות + אזור-הזמן + `hold_dependency` + "מתחיל תוך 15 שניות אם כעת בתוך חלון"; `confirmed:true` נדרש רק כש-`enabled:true`; אימות מדיניות מקומי (אותם כללים כמו WisKey); ביקורת המדיניות (לא-סוד) |
| POST `/intercom/stations/{sid}/programs/{door}/pause` | `{revision, confirmed, client_request_id, expires_at}` | `access.doors.physical` (שאלה 4) | דיאלוג `program_pause_confirm`; התשובה מוקרנת לפי ב.4 "קריטי" |
| POST `/intercom/stations/{sid}/programs/{door}/remove` | אותו דבר | אותו דבר | דיאלוג `program_remove_confirm` |
| POST `/intercom/stations/{sid}/programs/{door}/legacy-draft/delete` | `{revision, confirmed}` | `access.doors.manage` | דיאלוג `program_delete_saved_confirm` ("שום פקודה לעמדה לא תישלח.") |

ניסוח UI להעביר (i18n עברי קיים ב-R:frontend/src/i18n.ts ~1910-2076): `program_active`, `program_inactive`,
`program_removing`, `program_idle`, `program_opening`, `program_held_acknowledged`, `program_restoring`,
`program_unknown`, `program_end_hint`, `hold_dependency`, `technical_intro`, `technical_confirm`,
`technical_unmanaged`, `technical_write_unknown`. שינויי סטטוס הפעלה קורים רק ברענון (ל-WisKey אין push
עבורם; `changed()` לא נקראת על ידי הטיימר) — לעשות poll ל-`programs` כל 15 שניות כל עוד הלשונית פתוחה
ותוכנית מופעלת/מוחזקת, בתוך תקציב הקריאה.

### ב.8 חלוקה לפרוסות מוצעת
- **B1** מעטפת עמוד עמדה + קריאת settings + כתיבת `doorName`/`openDuration` (config).
- **B2** היפוך ממסר (PHYSICAL, בדיקת מעבדה).
- **B3** רשימת/עורך/הפעלת/השהיית/הסרת תוכניות דלת (PHYSICAL מתוזמן; בדיקת מעבדה על פני גבול-חלון אמיתי).

---------------------------------------------------------------------------------------------------------------------

## 3. הערות מימוש חוצות-היקף
- `intercom_client.py`: פונקציה מוקלדת אחת לכל פקודה לעיל; כתיבות משתמשות ב-`_write_result(frame,
  command)` חדשה = אותה צורה כמו `_action_result` עם רשימת-היתר `PRE_EFFECT` לפי-פקודה (טבלאות א.4, א.7,
  ב.4). לשמור את `PRE_DEVICE` לשלוש הפקודות הקיימות ללא שינוי.
- `intercom_sync.py`: timeout לפי-פקודה על `_execute`; נתיב config; poller לכידה + הודעות
  `intercom_capture`; הקרנות עורך נשארות מחוץ ל-`project_person` / `project_overview`; להוסיף `api_id`
  לנתוני העמדה רק במקום שמסך ב' זקוק לו.
- בדיקות: להרחיב את `frontend/tests/fixtures/wiskey_fake_ha.py` (כיום מזייף רק `overview`/`subscribe` +
  פעולות) עם הפקודות החדשות וקודי השגיאה שלהן, כולל המקרה "success:true אבל program.error =
  technical_write_unknown" והתקדמות מצב לכידה; בדיקות backend ב-
  `smplwise_vms/backend/tests/test_intercom.py`.
- CR-005 זקוקה לסטיות רשומות עבור: שמות ההרשאה החדשים (אם הבעלים בוחר אותם), לכידה שעוברת מחוץ ל-
  `access.release`, הקרנת העורך (פרטיות), וכל חיתוך-תכונה (תזמון/תמונה/קודים ציבוריים/מיפוי ממסר).
- מחוץ להיקף כאן: שמע דו-כיווני (משימה משלו), WhatsApp (חי בפרטי אדם; פרוסה נפרדת), קודים ציבוריים, מיפוי
  ממסר, CSV/bulk/ייבוא, ספריית/פריסת לוח-זמנים.

## 4. שאלות פתוחות עבור הבעלים
1. מי רשאי לערוך אנשים (יצירה/עריכה/מחיקה, PIN-ים, כרטיסים)? (א) `access.people.manage` חדשה/CR-005,
   site_admin + system_admin בלבד (מומלץ); (ב) גם `editor`; (ג) גם `operator`.
2. הרשאת לכידת כרטיס: (א) `access.cards.capture` משלה + people.manage (מומלץ); (ב) תחת `access.release`
   כפי ש-§3 של CR-005 כתבה; (ג) people.manage בלבד.
3. הרשאה פיזית של דלת: (א) `access.doors.physical` אחת להפעלה/השהיה/הסרה של program + היפוך ממסר (מומלץ);
   (ב) שתי הרשאות נפרדות (תוכניות/ממסר); והאם כל מחזיק `access.read` יכול לראות את רשימת התוכניות? (ג) כן
   (ד) לא, doors.manage בלבד.
4. השהיה/הסרה של תוכנית שולחת `close` (משחזרת את הדלת): (א) אותה הרשאה כמו הפעלה; (ב) מותר גם למחזיקי
   `access.release`, כדי ששומר יוכל לעצור החזקה-פתוחה.
5. מספרי כרטיס: WisKey לעולם לא מחזירה מספרים מלאים אחרי שמירה. עבור העורך: (א) הצג ממוסך `•••• 1234`
   (מומלץ); (ב) הצג רק תווית/ספירה, בלי ספרות כלל.
6. תמונות: (א) מחוץ להיקף, הצג רק "יש תמונה" (מומלץ לעכשיו); (ב) הצג את התמונה השמורה read-only; (ג)
   לכידת מצלמה מלאה (זקוקה ל-HTTPS/הקשר-מאובטח בעמוד SMPLWISE).
7. תזמון גישה: (א) פרוסה ראשונה = קבוע/טווח-תאריכים בלבד (מומלץ); (ב) + weekly/dates נאכף על ידי HA; (ג)
   מלא כולל לוחות-זמנים ילידי-עמדה.
8. בדיקת זמינות-PIN חיה (`pin_check` חושפת האם PIN בשימוש על ידי מישהו): (א) לשמור עם מגבלה צרה לפי-משתמש
   וביקורת; (ב) להשמיט, להסתמך על `pin_conflict` בזמן שמירה + "צור PIN ייחודי" (מומלץ).
9. מיפוי ממסר (`technical_relays`, טוען מחדש את WisKey) וקודים ציבוריים באותו עמוד עמדה: (א) read-only
   לעכשיו (מומלץ); (ב) לבנות את הכתיבות שלהם כעת.
10. בדיקות חיות ראשונות של לכידה, היפוך ממסר והפעלת תוכנית על העמדה האמיתית: (א) הבעלים פיזית ליד הדלת
    לכל אחת (מומלץ); (ב) אימות תמונת-מצלמה מ-SMPLWISE בלבד.

## 5. הערכת גודל (בסבבי סקירה; הלילה: 1-2 סקירות ≈ 1.5-3 שעות למסך; שחרור פיזי ראשון = 5 סבבים)

| פרוסה | סיווג | סבבי סקירה | זמן |
|---|---|---|---|
| A1 ליבת עורך | config-write, הקרנת PII, פורט טופס גדול (~480 שורות render של panel.ts + 100 של save/validation) | 3-4 | 6-8 שעות |
| A2 לכידת כרטיס | אינטראקציה פיזית ארוכת-ריצה ראשונה (sessions, poller, מפת בעלות, מצבים לא-ידועים) | 4-5 | 6-9 שעות + מעבדה |
| A3 תזמון weekly/dates + תמונה (אופציונלי) | config-write | 2-3 | 3-5 שעות |
| B1 עמוד עמדה + שם/משך DoorParam | config-write התקן | 2 | 2.5-3.5 שעות |
| B2 היפוך ממסר | פיזי | 2-3 (מנצל-מחדש תבניות A2/B1) | 2.5-4 שעות + מעבדה |
| B3 תוכניות דלת | פיזי מתוזמן, תשובה עם שגיאה-נבלעת | 3-4 | 5-7 שעות + מעבדה |
| **סך הכול** | | **16-21** | **~25-36 שעות** (≈ 3-4 sessions עבודה) |

סדר עדיפות הבעלים אומר A1 → A2 קודם (≈ 12-17 שעות), אחר כך B1 → B3 → B2 (תוכניות לפני ממסר אם הבעלים
מעדיף; הסדר בתוך B חופשי).

## 6. פריטים לא-מאומתים (אסור להחליק עליהם)
1. משתמש ה-HA של ה-add-on מחזיק `users:manage` + `stations:manage` של WisKey (אחרת כל כתיבה = `unauthorized`).
2. לכידה על חומרה אמיתית — המחרוזת של WisKey עצמה אומרת "הלכידה הפיזית עדיין זקוקה להרצה (commissioning)".
3. האם כרטיס שכבר-רשום שמוצג במהלך הלכידה גם פותח את הדלת; מצב הקורא אחרי ביטול (timeout של firmware).
4. האפקט החשמלי של `relayReverseEnabled` על דלת המעבדה (נעילה לעומת פתיחה במנוחה) והאם הוא פועל מיידית.
5. `close` לעומת "בקרה רגילה" של העמדה אחרי החזקה-פתוחה; האם ישות ה-lock של HA מציגה את המצב המוחזק.
6. אטומיות `storage_write_failed` (מטופל כלא-ידוע).
7. אי-אפשרות `revision_conflict` לאחר-persist ב-`technical_program_save` (נטען מתוך הסידור (serialisation)
   של `technical_busy`).
8. זמני הלוך-חזור של `technical_get` / `technical_update` בעמדות המעבדה מול המגבלה של 60 שניות של
   ha_client.
