# Frigate - סבב אימות מפוקח (runbook)

מסמך עבודה לסבב אחד, בנוכחות הבעלים מול המחשב. מבוסס על הקוד של F2 כפי שמוזג ל־2.2.0 (`f0b42dd0`) ועל CR-029 סעיפים 7 ו־10.
קבצי קוד: `smplwise_vms/backend/smplwise/routers/frigate_control.py`, `routers/frigate.py`, `services/frigate_control_svc.py`,
`services/recorders/frigate_control.py`, `services/recorders/frigate_http.py` (`GET_ALLOWED`, `WRITE_ALLOWED`).

**כללי הברזל של הסבב**
- הבעלים יושב ליד המחשב ולוחץ בעצמו. Claude לא נוגע ב־Frigate, לא בסביבה ולא בסודות.
- כתיבה אחת לכל מחלקה, בשינוי הקטן ביותר, ומיד החזרה למצב המקורי. בלי ניסיון חוזר (גם הקוד לא חוזר על כתיבה).
- PTZ נשאר כבוי (`PTZ_RELEASED = False`); לא מפעילים ולא בודקים.
- שום IP, שם מארח, סיסמה, טוקן, מספר סידורי או כתובת פנימית לא נכנסים לצ'אט, ל־git או לצילומי מסך (סעיף 6).

---

## 0. שני חסמים שדורשים החלטה לפני שמתחילים

| # | ממצא | מה הקוד אומר | מה צריך |
|---|---|---|---|
| H1 | אין אפשרות תוסף לסוג Frigate | `registry.py`: סוג Frigate ניתן לבחירה רק כש־`SW_FRIGATE=1` בסביבת השרת. ב־`config.yaml` אין אופציה כזו ו־`run.sh` לא מעביר אותה (2.2.0 notes: "no add-on option yet") | החלטה: (א) משימה קטנה שמוסיפה אופציית תוסף ומעבירה אותה ל־`SW_FRIGATE`; (ב) הרצה על Backend מקומי או על הרנר עם `SW_FRIGATE=1`. בלי אחד מהם: **BLOCKED** |
| H2 | קריאת `clip.mp4` לא על ה־allow-list | `GET_ALLOWED` לא כולל `clip.mp4` ("the clip / export family: design only", CR-029 סעיף 7); בקשה כזו נדחית מקומית ב־`frigate_path_not_allowed` | החלטה: (א) תוספת שורה אחת ל־`GET_ALLOWED` במשימה נפרדת לפני הסבב, וקריאה אחת דרך ה־adapter; (ב) הבעלים מוריד קליפ אחד ידנית מהממשק של Frigate ורק רושמים תוצאה (Arx לא מעורב). עד החלטה: צעד 2 = NOT_RUN |

---

## 1. תנאים מקדימים

1. **גרסת Frigate >= 0.18** (`frigate.MIN_VERSION = (0, 18)`).
   בדיקה: `GET /api/v1/frigate/{rid}/status` מחזיר `version` ו־`version_ok: true`. בבדיקה החיה של 2026-10-05 נמדדה 0.18.0. אם `version_ok: false` - עוצרים (`nvr_not_supported`).
2. **סוג Frigate זמין**: ראו H1. מוכן כשבהגדרות, בהוספת מקליט, "Frigate" מופיע כבחירה פעילה (לא "בקרוב"). אם כבר קיים מקליט Frigate מחובר - לא יוצרים חדש.
3. **החשבון** (החלטת הבעלים, טופס round10 q2 ב): **חשבון אחד עם הרשאות אדמין מותר**. מסלולי הקריאה נשארים קריאה בלבד בקוד (`GET_ALLOWED` לא השתנה; לכתיבות יש `WRITE_ALLOWED` נפרד). q15 א: בדיקת חשבון viewer נעשית בנוכחות הבעלים (צעד 3, אופציונלי).
   - פרטי החיבור נשמרים בהגדרות המקליט: מארח, `http_port` (ברירת מחדל **8971**, הפורט המאומת; 5000 לא נתמך), משתמש, סיסמה, `scheme=https`, `tls_mode=pin`.
   - **הבעלים מקליד את הסיסמה בעצמו בשדה הסיסמה של Arx**, אף פעם לא בצ'אט, בקובץ, ב־git או בצילום מסך. היא נשמרת מוצפנת (AES-GCM, `recorder_connections`); ה־JWT (`frigate_token`) נשמר בזיכרון בלבד.
4. **הרשאות המשתמש ב־Arx**: חשבון system_admin (מחזיק `analytics.control`, `analytics.record_control`, `analytics.profile`, `analytics.events`, `analytics.review`, `system.configure`). אימות: `GET /api/v1/frigate/{rid}/control/policy` מחזיר שש מחלקות.
5. **סביבה**: Frigate לא באמצע שדרוג, אין התראה אמיתית פתוחה, שעה שקטה בבית. הבעלים מסכים לדקה של כיבוי `snapshots` על מצלמה אחת.
6. **מצלמת מבחן אחת** שאינה קריטית, ואירוע עדכני אחד (review item) עם tracked object שה־`retain` שלו כבוי וה־`sub_label` שלו ריק.
7. **השוואת צורות הכתיבה למפרט של ה־Frigate שלו** (קריאה בלבד): בדפדפן, `/api/openapi.json` (או דף ה־docs של Frigate). הבעלים מחפש את הנתיבים שבסעיף 3. אם נתיב או גוף שונים - לא כותבים; מתקנים שורה אחת ב־`services/recorders/frigate_control.py` (כל צורה יושבת שם במקום אחד) ומתחילים מחדש.

---

## 2. טבלת בטיחות לפי מחלקת כתיבה

כל הנתיבים תחת `/api/v1/frigate/{rid}/...` (`rid` = `nvr-<n>`). כל מחלקה **כבויה כברירת מחדל**. מדליקים אחת בכל פעם עם `PUT .../control/policy` גוף `{"classes": {"<class>": true}}` (UI: הגדרות, מקליט Frigate, "שינויים ב־Frigate") ומכבים בסוף הצעד.

### analytics (`analytics.control`, בלי אישור לכל פעולה)
- **UI**: מצלמה חיה, מגירת "בקרת ניתוח", מתג. לבדיקה: `improve_contrast` (לא `detect`/`motion`/התראות, כדי לא לפגוע בניטור).
- **Arx**: `PUT .../cameras/{camera_id}/control/improve_contrast` גוף `{"value": true|false}`.
- **Frigate**: `PUT /api/camera/{cam}/set/improve_contrast` גוף `{"value":"ON"|"OFF"}`. מתג אחד, מצלמה אחת, לעולם לא `*`.
- **לפני**: `GET .../cameras/{camera_id}/control` ערך `features[improve_contrast]`. **אחרי**: הערך ההפוך.
- **קריאה חוזרת**: Arx קורא `GET /api/config` (`motion.improve_contrast`). תשובה: `changed`, `verified`, `observed`, `change_id`. `verified:false` = `unverified` (לא כשל).
- **ביטול**: `POST .../changes/{change_id}/revert` גוף `{"confirm": false}`; נבדק ש־Frigate עדיין במצב שהשינוי השאיר, אחרת 409 `frigate_change_stale`.
- **מה יכול להשתבש**: 403 `frigate_write_forbidden` (חשבון בלי אדמין); 404/405/422 (צורה שגויה); `/api/config` לא משקף שינוי runtime (יופיע `unverified`); המתג מתאפס בהפעלה מחדש של Frigate.

### record (`analytics.record_control`, **אישור לכל פעולה**)
- **UI**: אותה מגירה, "צילומי תמונה". לבדיקה: `snapshots` בלבד. לא `recordings` ולא `enabled` (עוצרים שמירת קטעים) אלא בהחלטה מפורשת של הבעלים.
- **Arx**: `PUT .../cameras/{camera_id}/control/snapshots` גוף `{"value": false, "confirm": true}`, ואחר כך `{"value": true, "confirm": true}`.
- **Frigate**: `PUT /api/camera/{cam}/set/snapshots` גוף `{"value":"OFF"|"ON"}`.
- **לפני**: `true`. **אחרי**: `false`; בסוף חוזר ל־`true`.
- **קריאה חוזרת**: `GET /api/config` (`snapshots.enabled`).
- **ביטול**: revert עם `confirm: true`, או `PUT` חוזר ל־`true`.
- **מה יכול להשתבש**: בלי `confirm` - 409 `confirmation_required` (תקין). אם נשאר כבוי - לא נשמרות תמונות. כיבוי `recordings`/`enabled` מפסיק לשמור קטעים.

### profile (`analytics.profile`, **אישור לכל פעולה**)
- **UI**: הגדרות, מקליט Frigate (או המגירה), "פרופיל".
- **Arx**: `PUT .../profile` גוף `{"profile": "<name>" | null, "confirm": true}`. קריאה: `GET .../profiles`.
- **Frigate**: `PUT /api/camera/*/set/profile` גוף `{"value":"<name>"|"none"}` (הקריאה היחידה שמשתמשת ב־`*`).
- **לפני**: `active` מ־`GET .../profiles`. **אחרי**: הפרופיל החדש; Frigate **מאפס את מתגי ה־runtime של כל המצלמות**.
- **קריאה חוזרת**: `GET /api/profile/active` (על ה־allow-list).
- **ביטול**: revert, או `PUT .../profile` עם הערך הקודם (`null` = ללא פרופיל).
- **מה יכול להשתבש**: משפיע על כל המצלמות. אין פרופילים מוגדרים = NOT_RUN. שם מוגבל ל־`[A-Za-z0-9_-]{1,40}`; 422 `frigate_profile_unknown` אם השם לא קיים.

### review (`analytics.review`, בלי אישור)
- **UI**: מסך הסקירה, סימון כנסקר.
- **Arx**: `POST .../reviews/reviewed` גוף `{"ids":["<review_id>"], "reviewed": true}`. קודם נכתב מצב Arx של המשתמש (האמת), אחר כך המראה. התשובה כוללת `mirror: {state, count}`.
- **Frigate**: סימון `POST /api/reviews/viewed` גוף `{"ids":[...]}`; ביטול `DELETE /api/review/{id}/viewed`.
- **לפני**: ב־Frigate הפריט לא נסקר. **אחרי**: נסקר.
- **קריאה חוזרת**: `mirror.state = done`; ב־UI של Frigate הפריט יוצא מרשימת "לא נסקרו". (אין קריאה חוזרת מובנית ב־Arx למראה.)
- **ביטול**: `POST .../reviews/reviewed` עם `reviewed:false`. ה־`DELETE` נשלח רק אם אף משתמש Arx אחר לא מחזיק את הסימון. **אין שורה ביומן השינויים ואין revert ממנו**, רק audit.
- **מה יכול להשתבש**: `mirror.state` = `failed` + `code`, `off` (המחלקה כבויה), `not_permitted` (בלי `analytics.review`). כשל במראה לא מבטל את מצב Arx.

### events (`analytics.events`, בלי אישור לכל פעולה)
- **UI**: פרטי אירוע, "שמור הקלטה" (retain). תיקון תווית אין עדיין כפתור, לכן קריאה ישירה.
- **Arx**: retain `POST .../events/{event_id}/retain` גוף `{"retain": true}`; תווית `POST .../events/{event_id}/sub-label` גוף `{"sub_label": "arx-test"}`.
- **Frigate**: retain `POST /api/events/{id}/retain` (הפעלה) או `DELETE` על אותו נתיב (כיבוי); תווית `POST /api/events/{id}/sub_label` גוף `{"subLabel":"arx-test"}` (ביטול: `{"subLabel": null}`).
- **לפני/אחרי**: `GET /api/events/{id}` ערכים `retain_indefinitely` ו־`sub_label`.
- **קריאה חוזרת**: אותו `GET` (השדה `verified` בתשובה).
- **ביטול**: revert מהיומן (`kind` = `event_retain` או `event_sub_label`).
- **מה יכול להשתבש**: האירוע חייב להיות שייך לפריט סקירה ששמור ב־Arx, אחרת 404. retain שומר את הקטע מעבר לשמירה הרגילה (מקום בדיסק) ולכן חייבים לבטל. **לא מאומת** שביטול תווית עם `null` מנקה את השדה (ייתכן מחרוזת ריקה); זה ממצא לרישום.

### ptz
**לא נבדק.** `PTZ_RELEASED = False`; ההדלקה נדחית ב־409 `frigate_ptz_not_released`.

**כללים משותפים**: כל כתיבה (מוצלחת או לא) רושמת שורה ב־`frigate_changes` (לפני, אחרי, hash, `status` = `applied`/`unverified`/`failed`) ושורת audit; יומן: `GET .../changes`. תשובה אבודה היא 503 `frigate_write_unknown` ואסור לשלוח שוב לפני בדיקת המצב.

---

## 3. צורות הכתיבה שנבדקות (כולן `unverified` בקוד)

1. `PUT /api/camera/{cam}/set/{feature}` גוף `{"value":"ON"|"OFF"}`
2. `PUT /api/camera/*/set/profile` גוף `{"value":"<name>"|"none"}`
3. `POST /api/reviews/viewed` גוף `{"ids":[...]}`
4. `DELETE /api/review/{id}/viewed`
5. `POST|DELETE /api/events/{id}/retain`
6. `POST /api/events/{id}/sub_label` גוף `{"subLabel":"..."}`
7. האם `GET /api/config` משקף מתג runtime (אם לא, הכל יסומן `unverified`, ולכן הבעלים בודק גם ב־UI של Frigate)
8. קריאת `clip.mp4` (H2), והאם חשבון viewer קורא `/api/config`, `/api/openapi.json` ו־`/ws`

---

## 4. סדר הפעולות (מהקל לכבד)

לפני כל צעד כתיבה מדליקים רק את המחלקה שלו, ובסופו מכבים. אחרי כל צעד ממלאים שורה בטבלת התוצאות (סעיף 5). עוצרים בכל תנאי עצירה.

0. **הכנה (קריאה בלבד).** `GET .../status?refresh=true` (דורש `system.configure`), `GET .../control/policy` (הכל כבוי), `GET .../changes` (ריק), `GET .../cameras`. רושמים גרסה, `version_ok`, מספר מצלמות, `routes_known`. בוחרים מצלמת מבחן ואירוע מבחן.
1. **השוואת צורות ל־`openapi.json`** (תנאי 7). כל סטייה = עצירה ותיקון קוד.
2. **קריאת `clip.mp4`** לפי החלטת H2. קריאה אחת, קליפ קצר של מצלמת המבחן. רושמים סטטוס, `Content-Type`, גודל בקירוב והאם התנגן. הקובץ לא נשמר ב־git.
3. **(אופציונלי) חשבון viewer.** הבעלים יוצר ב־Frigate משתמש viewer בעצמו ומחבר אותו בנפרד בהגדרות Arx (הסיסמה בשדה בלבד). בודקים `status?refresh=true`, `cameras`, `reviews`: האם `/api/config`, `/api/openapi.json` ו־`/ws` נגישים (403 = `source_forbidden` או `routes_known: false`). חוזרים לחשבון האדמין לפני צעד 4. סירוב = NOT_RUN.
4. **`review`.** מסמנים פריט אחד כנסקר, בודקים `mirror.state = done` ושב־Frigate הוא סומן; מבטלים סימון ובודקים שחזר ל"לא נסקר".
5. **`events`, retain.** מדליקים retain לאירוע המבחן, בודקים `verified`, מיד revert מהיומן ומוודאים `retain=false`.
6. **`events`, תווית.** `sub_label = "arx-test"`, בדיקה, revert מהיומן. רושמים מה קרה בביטול (ריק או null).
7. **`analytics`.** `improve_contrast` על מצלמת המבחן: הופכים את הערך, בודקים (Arx, `/api/config`, ה־UI של Frigate), revert. אם `unverified` - הבעלים בודק ידנית אם המתג באמת השתנה ב־Frigate (הממצא על סעיף 3.7).
8. **`record`.** `snapshots` כבוי (עם `confirm:true`) על מצלמת המבחן, בדיקה, ומיד חזרה ל־`true`. פחות מדקה.
9. **`profile` (אחרון: משפיע על כל המצלמות ומאפס מתגי runtime).** רק אם `GET .../profiles` מחזיר שמות. רושמים `active`, מחליפים לפרופיל אחר עם `confirm:true`, בודקים, מחזירים למצב הקודם. אחר כך בודקים ש־`GET .../cameras/{camera_id}/control` תואם למצב מצעד 0.
10. **סגירה.** מכבים את כל המחלקות (`PUT .../control/policy` עם `false`; `ptz` נשאר כבוי), `GET .../changes` לוודא שכל שינוי הוחזר, והשוואה סופית למצב מצעד 0.

**תנאי עצירה** (עוצרים מיד ולא ממשיכים לצעד הבא):
- `version_ok: false`, או גרסה שונה מהצפוי.
- 401 חוזר, או backoff של 5 דקות על ה־login (Frigate מגביל התחברויות; לא מנסים שוב).
- 403 `frigate_write_forbidden`: החשבון אינו אדמין. מתקנים חשבון ומתחילים מחדש.
- 404/405/422 מ־Frigate על כתיבה: צורה שונה. רושמים את הקוד ולא מנסים צורה אחרת "על הדרך".
- 503 `frigate_write_unknown`: אין תשובה. לא שולחים שוב; בודקים קודם את המצב ב־UI של Frigate.
- 409 `frigate_change_stale` בביטול: מישהו שינה את המצב. קוראים ומחליטים ידנית.
- `verified:false` פעמיים ברצף על מחלקות שונות.
- שינוי במצלמה שאינה מצלמת המבחן, התראה אמיתית, או שהבעלים אומר "עצור".
- אחרי כל עצירה: מחזירים ידנית כל שינוי פתוח (`GET .../changes`), מכבים את המחלקות, ורק אז מסכמים.

---

## 5. תבנית טבלת התוצאות

סטטוסים: **PASS** (בוצע ואומת בקריאה חוזרת), **PASS_UNVERIFIED** (בוצע; הקריאה החוזרת ב־Arx לא אישרה והבעלים אישר ידנית ב־UI), **FAIL** (שגיאה רשומה), **NOT_RUN**, **BLOCKED** (עם סיבה). BUILT נשאר לקוד שלא נבדק בסבב.

| צעד | מחלקה / בדיקה | נתיב Frigate | הוחזר למצב המקורי | סטטוס | קוד תשובה / שגיאה | הערות (ללא סודות) |
|---|---|---|---|---|---|---|
| 0 | קריאות הכנה | `GET /api/version`, `/api/config` | - | | | גרסה: |
| 1 | השוואת צורות ל־openapi | `GET /api/openapi.json` | - | | | |
| 2 | `clip.mp4` | לפי H2 | - | | | |
| 3 | viewer: config / openapi / ws | `GET` | - | | | |
| 4 | review סימון וביטול | `POST /api/reviews/viewed`, `DELETE /api/review/{id}/viewed` | | | | |
| 5 | events retain | `POST` ואז `DELETE /api/events/{id}/retain` | | | | |
| 6 | events sub_label | `POST /api/events/{id}/sub_label` | | | | ביטול: ריק או null? |
| 7 | analytics improve_contrast | `PUT /api/camera/{cam}/set/improve_contrast` | | | | `/api/config` משקף? |
| 8 | record snapshots | `PUT /api/camera/{cam}/set/snapshots` | | | | |
| 9 | profile | `PUT /api/camera/*/set/profile` | | | | מתגים אופסו? |
| 10 | סגירה: כל המחלקות כבויות, יומן נקי | - | - | | | |
| - | ptz | - | - | NOT_RUN | `frigate_ptz_not_released` | מחוץ לסבב |

---

## 6. ראיות (ללא סודות)

לכל צעד רושמים: מזהה צעד, מחלקה, שם תצוגה של המצלמה, קוד תשובה, `status` מהיומן (`applied`/`unverified`/`failed`), `verified` ו־`observed`, האם ה־UI של Frigate הראה את השינוי, והזמן עד החזרה.
- **מותר**: קודי שגיאה, שמות נתיבים כמו בטבלאות כאן, גרסת Frigate וגרסת Arx, מספר מצלמות, שורות היומן בלי `actor`.
- **אסור**: כתובות IP, שמות מארח, מספרים סידוריים, MAC, סיסמאות, טוקנים, `frigate_token`, כתובות RTSP עם פרטי כניסה, `tls_pin`, וצילומי מסך ששורת הכתובת או הגדרות הרשת נראות בהם. מטשטשים לפני כל שמירה; חומר גולמי נשאר ב־`private-evidence/` (gitignored). אם `camera_key` הוא כתובת - מוחקים אותו.

---

## 7. מה רושמים אחרי הסבב

1. **`management/upstream_watch.json`**, הרשומה `frigate-nvr`: `current.version` = הגרסה שנבדקה (במקום null), `current.source` = "verified read and supervised writes <date>", `last_checked`, ושורת evidence (גרסה, תאריך, מחלקות שקיבלו PASS) בלי כתובות. אחר כך `python scripts/project_status.py --write` ו־commit של התצוגות.
2. **CR-029 סעיפים 7 ו־10**: מעבירים מ־NOT VERIFIED ל־VERIFIED עם תאריך רק צורות שקיבלו PASS. PASS_UNVERIFIED נשארת "wire verified, read-back unverified". FAIL: תיקון שורה אחת ב־`services/recorders/frigate_control.py` ובדיקה חוזרת.
3. **`management/test_catalog.json`**: פריטי בדיקה ידנית ל"כתיבה ראשונה בפיקוח לכל מחלקה" עם הסטטוס מהטבלה (לא רושמים PASS שלא בוצע).
4. **מה הופך ל־verified ב־PASS**:
   - `PUT /api/camera/{cam}/set/{feature}` עם `{"value":"ON"|"OFF"}` (`improve_contrast` ו־`snapshots` נבדקו ישירות; שאר המתגים "by analogy" בלבד).
   - `PUT /api/camera/*/set/profile`.
   - `POST /api/reviews/viewed` ו־`DELETE /api/review/{id}/viewed`.
   - `POST|DELETE /api/events/{id}/retain` ו־`POST /api/events/{id}/sub_label` (`subLabel`).
   - האם הקריאה החוזרת דרך `GET /api/config` משקפת מתג runtime (או שלא, ואז `unverified` הוא מצב צפוי ולא כשל).
   - `clip.mp4` (אם בוצע), והרשאות viewer על `/api/config`, `/api/openapi.json`, `/ws`.
   - **נשארים NOT VERIFIED**: PTZ, `recordings`/`enabled`, שאר מתגי האנליטיקה, `EXT-X-PROGRAM-DATE-TIME` ב־HLS, מטענים של פריימי `reviews`/`events` ב־WebSocket.
5. **החלטות המשך לבעלים**: אופציית תוסף ל־`SW_FRIGATE` (H1), `clip.mp4` ב־allow-list (H2), אילו מחלקות להשאיר דלוקות, ומתי PTZ.
