# קריטריונים: breaking, סיכון לדלתות, אחסון, מיגרציה ו־rollback — סכמה 1

טיוטת Arx, 04.10.2026. השדות ב־`release-manifest.schema.json`. כלל כללי: בספק, בוחרים את הערך המחמיר.
מה שהסכמה אוכפת מסומן [סכמה]. מה שהשער של Arx בודק מול הקבצים מסומן [שער]. השאר באחריות WisKey ונבדק בסקירה.

## 1. `breaking`

### 1.1 תמיד `breaking: true`
- הוסרה פקודת WS (`ws_commands_removed` לא ריק) [סכמה].
- הוסרה ישות (`entities_removed` לא ריק), או השתנה `entity_id` או `unique_id` [סכמה לגבי הסרה].
- הוסר או שונה שם של שירות, או נוסף לו פרמטר חובה.
- בפקודה קיימת: שדה חובה חדש בבקשה, שדה שהוסר מהתשובה, שינוי טיפוס או משמעות, שינוי קוד שגיאה קיים.
- `CONTRACT_VERSION` עלה במג'ור [שער: השוואה לגרסה המותקנת].
- שינוי `domain` או `install_dir` [שער: השוואה למותקן].
- מאגר אחסון עם `irreversible: true` או `removed: true` [שער].
- שינוי הרשאות שחוסם נתיב שעבד קודם (לדוגמה בדיקת משתמש על ישות ה־lock).
- כל שינוי ב־DTO החתום, ב־serialization או בפרוטוקול `wiskey-trusted-door-v1`. שינוי כזה מחייב גם ערך `protocol` חדש והסכמה מפורשת.

### 1.2 לא breaking (תואם)
- פקודה, ישות, שירות או קוד שגיאה חדשים.
- שדה אופציונלי חדש בתשובה.
- שינוי פנימי שלא משנה את הממשק ש־Arx צורך.
- יכולת חדשה. היא מדווחת ל־Arx ולא מוצגת עד סקירה (`CAPABILITIES.md`).

### 1.3 לא breaking, אבל דורש הסכמה מפורשת לפני שחרור
- פעולה פיזית חדשה, גם אם היא תוספת בלבד.
- הרשאה חדשה (`permissions_added`) שמסכי Arx אמורים לאכוף.

### 1.4 מה Arx עושה
- `breaking: true`, `migrations` לא ריק, או שינוי `domain`/`install_dir`: לעולם לא מותקן אוטומטית. Arx מציג הערות, סיכון, runbook וצורך ב־restart. הבעלים מחליט.

## 2. `risk_to_doors`

"אזור דלת" = קוד או נתונים שקובעים אם, מתי או מי פותח, מחזיק או נועל דלת: נתיב הפתיחה וה־trusted caller, מיפוי ממסרים,
זמני החזקה, לוחות זמנים של דלתות, הערכת הרשאות גישה, סנכרון כרטיסים/PIN לעמדות, ישות ה־lock, פקודות ISAPI או ספק שמפעילות ממסר.

| ערך | מתי |
|---|---|
| `none` | שום שינוי בקוד או במאגרים של אזור דלת. שינוי תצוגה בלבד במסכים שאינם מפעילים דלת. |
| `low` | שינוי באזור דלת בלי שינוי התנהגות מכוון (refactor, לוגים, הודעות), כשכל בדיקות החובה `door_safety` ו־`trusted_caller` עברו. או שינוי שיכול רק להפחית פתיחות (fail-closed). |
| `high` | כל שינוי התנהגות מכוון באזור דלת; מיגרציה של מאגר באזור דלת; פעולה פיזית חדשה; שינוי בנתיב החתום; כל מקרה שבו אי אפשר להראות שהתוצאה רק מחמירה. |

- התקנה אוטומטית (אם הבעלים הפעיל אותה) רק כש־`risk_to_doors: none`.
- `high`: הערות השחרור כוללות בדיקת דלת אחת שהבעלים מבצע אחרי ההתקנה, ואת דרך החזרה.
- [שער] חוסר עקביות שאפשר לזהות (למשל `migrations` על מאגר של אזור דלת עם `none`) נדחה כ־`R_CRITERIA_INCONSISTENT`. רשימת המאגרים של אזור דלת: `TO_BE_CONFIRMED`, WisKey יספק.

## 3. `storage_schemas`

- רשומה לכל מאגר שהאינטגרציה מחזיקה, גם אם לא השתנה. המפתח הוא שם המאגר כפי שהוא תחת `.storage/`.
- לכל מאגר: `version` (אחרי השחרור), `previous_version` (בשחרור הקודם שפורסם, או null למאגר חדש), `irreversible`, ואופציונלי `removed`.
- גרסה רק עולה. `version` קטן מ־`previous_version`: נדחה [שער].
- `version` שונה מ־`previous_version`: חייבת להיות מיגרציה ב־`migrations` עם `target` של אותו מאגר [שער].
- `irreversible: true` כשהגרסה הקודמת לא יכולה לקרוא את הנתונים החדשים. אז: `breaking: true`, מיגרציה עם `reversible: false`, ו־rollback בשחזור גיבוי [שער].
- מאגר שנעלם מהרשימה בלי `removed: true`: נדחה [שער].

## 4. מיגרציה (`migrations`)

כל רשומה חייבת [סכמה]:
- `idempotent: true`: הרצה שנייה לא משנה כלום.
- `dry_run: true`: יש מצב שמדווח מה ישתנה בלי לכתוב.
- `backup_before: true`: גיבוי של כל קובץ שנגעים בו, לפני הכתיבה.
- `reversible` תואם ל־`irreversible` של המאגר [שער].

ובנוסף (סקירה):
- נבדקה על עותק מסונן של `.storage`, עם ספירות לפני ואחרי (תחנות, משתמשים, כרטיסים, קבוצות, grants, לוחות זמנים, אירועים).
- runbook של עמוד אחד לבעלים: גיבוי, הפעלה מחדש, בדיקת ספירות.
- הרצה על ההתקנה החיה רק באישור מפורש של הבעלים לאותה הרצה.
- `migrations` לא ריק: לעולם לא אוטומטי.

## 5. rollback

| `method` | מתי מותר |
|---|---|
| `reinstall_previous` | רק כשאין שינוי גרסה באף מאגר, `migrations` ריק ו־`breaking: false` [סכמה לגבי migrations, שער לגבי השאר] |
| `restore_ha_backup` | בכל מקרה אחר. חובה כשיש מיגרציה [סכמה] |

- `text_he` ו־`text_en`: משפט אחד שהבעלים מבין. מוצג לפני ההתקנה.
- Arx לא מבצע downgrade אוטומטי. חזרה היא ידנית: שחזור גיבוי HA (קוד ונתונים תואמים), והוספת הגרסה הבעייתית ל־`blocked_versions` המקומי של Arx.
- `blocked_versions` הוא מצב של Arx בלבד. מניפסט שמכיל אותו נדחה [סכמה].

## 6. טבלת עקביות לשער

| תנאי במניפסט | נדרש | קוד דחייה |
|---|---|---|
| `ws_commands_removed` או `entities_removed` לא ריק | `breaking: true` | סכמה |
| `migrations` לא ריק | `rollback.method = restore_ha_backup` | סכמה |
| מאגר עם `version != previous_version` | מיגרציה למאגר | `R_CRITERIA_INCONSISTENT` |
| מאגר עם `irreversible: true` | `breaking: true`, מיגרציה `reversible: false` | `R_CRITERIA_INCONSISTENT` |
| `contract_version` במג'ור גבוה מהמותקן | `breaking: true` | `R_CRITERIA_INCONSISTENT` |
| `domain`/`install_dir` שונים מהמותקן | `breaking: true` | `R_CRITERIA_INCONSISTENT` |
| `breaking: true` או `migrations` לא ריק | `risk_to_doors` אינו `none` אם נוגע באזור דלת | `R_CRITERIA_INCONSISTENT` (כשאפשר לזהות) |
| `tests_excluded` | שווה לאורך `excluded` ב־tests-manifest | `R_TESTS_MANIFEST_MISMATCH` |
