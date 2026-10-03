# חבילת סכמות arx-exchange, גרסה 1 — טיוטה

טיוטת Arx, 04.10.2026. תיעוד וסכמות JSON בלבד: בלי מימוש, בלי מפתחות או סודות, בלי נתוני ציוד, בלי הרצות חיות.
מקור האמת בריפו של Arx (`docs/wiskey-exchange/schemas/1/`). עותק מועתק ל־`handoff\arx-exchange\schemas\1\`.
כל ערך שמסומן `TO_BE_CONFIRMED` הוא הצעה או חוסר מידע, לא החלטה.

## מה בחבילה

| קובץ | מה |
|---|---|
| `release-manifest.schema.json` | סכמת המניפסט: שדות חובה, `signed_at`, hashes, `tests_excluded`, חתימה, פרופיל bootstrap |
| `tests-manifest.schema.json` | סכמת מניפסט הבדיקות: קבצים ו־hashes, ספירה צפויה, החרגות, הפניה ל־baseline |
| `baseline-exclusions.schema.json` + `BASELINE_EXCLUSIONS.md` | בסיס ההחרגות: נימוק לכל החרגה, בדיקות חובה, נוהל שינוי |
| `gate-report.schema.json` + `GATE.md` | השער בלי חומרה ובלי רשת: פקודה, סביבה, זמן, קודי יציאה, דוח |
| `CRITERIA.md` | מתי breaking, סיכון לדלתות, אחסון, מיגרציה ו־rollback |
| `COMPAT.md` + `clock-health.schema.json` | מטריצת תאימות, הרחבה תואמת מול שוברת, יכולת לא מוכרת, חוזה אות השעון |
| `receipt.schema.json` + `RECEIPT.md` | receipt וקודי תוצאה |
| `capabilities.schema.json` + `CAPABILITIES.md` | מסמכי יכולות בכל מסירה |
| `ROTATION_HMAC_OUTLINE.md` | ראשי פרקים: החלפת חומר האימות Arx ↔ bridge |
| `ROTATION_SIGNING_KEY_OUTLINE.md` | ראשי פרקים: החלפת מפתח חתימת החבילות |
| `examples/valid/`, `examples/invalid/`, `examples/EXPECTED_INVALID.json` | דוגמאות תקינות ופסולות, וסיבת הפסילה לכל אחת |
| `check_examples.py` | בדיקה עצמית של הסכמות והדוגמאות (צריך `jsonschema`). אינו כלי השער |

## כללים משותפים

- כל קובץ JSON נושא שדה `schema` בצורה `arx-exchange/<סוג>/1`. ערך אחר נדחה.
- הסכמות סגורות: שדה לא מוכר נדחה. שדה חדש = סכמה 2.
- JSON עם מפתח כפול נדחה בכל עומק, לפני בדיקת הסכמה.
- hashes הם SHA-256 ב־hex קטן. זמנים הם UTC עם `Z`, בשניות שלמות.
- הדוגמאות סינתטיות. ה־hashes, החתימה וה־`key_id` בהן מזויפים בכוונה ולא יאומתו.

## שינויים מול מה שסוכם עד היום (מבקשים אישור WisKey)

1. שדה `schema` בכל קובץ, ושדה `profile` (`release` / `bootstrap`) במניפסט, במקום להסיק bootstrap משדות ריקים.
2. `rollback` הוא אובייקט (`method`, `text_he`, `text_en`) במקום משפט אחד.
3. `storage_schemas`: לכל מאגר `version`, `previous_version`, `irreversible`, ואופציונלי `removed`.
4. `migrations`: רשומות מובנות, עם `idempotent`, `dry_run` ו־`backup_before` שחייבים להיות true.
5. `tests-manifest.json`: `expected_collected` (כדי לזהות בדיקות חסרות) והפניה ל־baseline לפי גרסה ו־hash.
6. תיקיית `capabilities/` בכל מסירה, ו־`capabilities/capabilities.json` חובה ב־`artifacts_sha256`.
7. `signed_at` בשניות שלמות בלבד.

## מה לא נבדק

- שום דבר לא הורץ מול ציוד, HA חי או Supervisor.
- לא בדקנו את שמות הבדיקות של WisKey, את רשימת המאגרים, או אם הסוויטה רצה בלי רשת.
- הסכמות והדוגמאות נבדקו רק ב־`check_examples.py`.
