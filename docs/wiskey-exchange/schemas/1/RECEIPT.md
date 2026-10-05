# receipt: פורמט וקודי תוצאה — סכמה 1

טיוטת Arx, 04.10.2026. הסכמה: `receipt.schema.json`. דוגמאות: `examples/valid/receipt.*.json`.

## 1. מה זה

- Arx כותב receipt אחד לכל בדיקה של מסירה, ב־`receipts/<גרסה>-<receipt_id>.json`. בדיקה חוזרת כותבת receipt חדש; קודם לא נמחק.
- ה־receipt מתעד קבלה ותוצאת שער של העותק ש־Arx בדק ב־staging שלו.
- `is_installation` תמיד `false`. receipt אינו התקנה ואינו אישור להרצה חיה.

## 2. תוצאה (`result`)

| ערך | משמעות |
|---|---|
| `accepted` | כל הבדיקות עברו, וחתימה אומתה מול מפתח מוצמד ומאושר ב־Arx |
| `accepted_unsigned` | כל הבדיקות עברו, אבל אין חתימת ייצור. התקנה רק בחריגה מפורשת של הבעלים לחבילה הזו |
| `rejected` | לפחות קוד `R_` אחד |
| `error` | Arx לא הצליח לסיים את הבדיקה (קוד `E_`). לא אומר כלום על החבילה |

תנאי קבלה (נאכפים בסכמה): אין קודי `R_`, ה־hash מערוץ הבעלים תואם (`owner_channel_hash: match`), והשער עבר עם קוד 0.

## 3. קודי דחייה (`R_`)

| קוד | מתי |
|---|---|
| `R_READY_MISSING` | אין `READY.json` |
| `R_READY_MISMATCH` | הגרסה או ה־hash ב־`READY.json` לא תואמים למניפסט |
| `R_DUPLICATE_KEYS` | מפתח כפול בקובץ JSON, בכל עומק |
| `R_SCHEMA_INVALID` | מניפסט או tests-manifest לא עוברים סכמה |
| `R_OWNER_HASH_MISSING` | הבעלים לא מסר ל־Arx hash של המניפסט |
| `R_OWNER_HASH_MISMATCH` | ה־hash מהבעלים שונה מה־hash של המניפסט שהתקבל |
| `R_ARTIFACT_MISSING` | קובץ שמופיע במניפסט חסר |
| `R_ARTIFACT_EXTRA` | קובץ בתיקייה שלא מופיע במניפסט |
| `R_ARTIFACT_HASH_MISMATCH` | hash של ZIP או של קובץ לא תואם |
| `R_ZIP_UNSAFE` | נתיב מוחלט, `..`, symlink, hardlink, קובץ מיוחד, כפילות, או חריגה מתקרת גודל או מספר קבצים |
| `R_ZIP_CONTENT_OUTSIDE_INSTALL_DIR` | ב־ZIP ההתקנה יש משהו מחוץ ל־`custom_components/<install_dir>/` |
| `R_DOMAIN_NOT_ALLOWED` | `domain` לא ברשימה המותרת של Arx |
| `R_INSTALL_DIR_NOT_ALLOWED` | `install_dir` לא ברשימה המותרת של Arx |
| `R_ZIP_INNER_MANIFEST_MISMATCH` | ה־domain ב־`manifest.json` שבתוך ה־ZIP שונה מהמניפסט |
| `R_HA_VERSION_UNSUPPORTED` | `min_ha_version` גבוה מגרסת HA בפועל |
| `R_CONTRACT_INCOMPATIBLE` | גרסת חוזה שהמג'ור שלה לא נתמך (`COMPAT.md` סעיף 3) |
| `R_VERSION_NOT_HIGHER` | הגרסה לא גבוהה מהמותקנת לפי semver |
| `R_VERSION_REUSED` | גרסה שכבר נמסרה עם תוכן אחר |
| `R_VERSION_BLOCKED` | הגרסה ב־`blocked_versions` של Arx |
| `R_SIGNATURE_INVALID` | החתימה לא מאומתת |
| `R_KEY_NOT_PINNED` | `key_id` לא מוצמד ב־Arx |
| `R_KEY_REVOKED` | `key_id` בוטל ב־Arx |
| `R_BOOTSTRAP_PROFILE_EXTERNAL` | `profile: bootstrap` הגיע ממסירה חיצונית |
| `R_TESTS_MANIFEST_MISMATCH` | ZIP הבדיקות לא תואם ל־tests-manifest, או גרסה/commit/ספירת החרגות לא תואמים |
| `R_CRITERIA_INCONSISTENT` | הפרה של טבלת העקביות ב־`CRITERIA.md` סעיף 6 |
| `R_CAPABILITIES_INVALID` | `capabilities/capabilities.json` לא עובר סכמה, או `doc_file` חסר |
| `R_BASELINE_UNKNOWN` | ה־baseline שה־tests-manifest מצביע עליו לא מוכר ל־Arx |
| `R_EXCLUSIONS_GROWTH_UNEXPLAINED` | החרגה חדשה בלי הסבר |
| `R_MANDATORY_TEST_EXCLUDED` | בדיקת חובה הוחרגה |
| `R_GATE_FAILED` | בדיקות נכשלו (קוד שער 1) |
| `R_GATE_TIMEOUT` | חריגת זמן (קוד שער 3) |
| `R_GATE_MISSING_TESTS` | בדיקות חסרות (קוד שער 4) |
| `R_GATE_ENVIRONMENT` | הסביבה לא מוכנה או נדרשה הורדה (קוד שער 6) |
| `R_GATE_NETWORK_ATTEMPT` | ניסיון גישה לרשת (קוד שער 7) |

## 4. אזהרות (`W_`)

אזהרה לא דוחה חבילה. היא מוצגת לבעלים לפני כל החלטה.

| קוד | מתי |
|---|---|
| `W_UNSIGNED` | אין חתימת ייצור |
| `W_CAPABILITY_UNSUPPORTED` | יכולת שלא נסקרה. מדווחת כ"לא נתמכת" |
| `W_CAPABILITY_NO_DOCUMENT` | יכולת מדווחת בלי מסמך. מדווחת כ"לא נתמכת" |
| `W_REQUIRES_RESTART` | נדרשת הפעלה מחדש של HA |
| `W_BREAKING_MANUAL_ONLY` | שובר: התקנה ידנית בלבד |
| `W_MIGRATIONS_MANUAL_ONLY` | יש מיגרציה: התקנה ידנית בלבד |
| `W_RISK_TO_DOORS_LOW` / `W_RISK_TO_DOORS_HIGH` | הסיכון לדלתות אינו `none` |
| `W_HA_VERSION_UNTESTED` | גרסת HA בפועל לא ברשימת `tested_ha_versions` |
| `W_EXCLUSIONS_CHANGED_EXPLAINED` | שינוי בהחרגות עם הסבר |
| `W_UNEXPECTED_TESTS` | נאספו בדיקות שלא היו צפויות |

## 5. שגיאות (`E_`)

`E_INTERNAL`, `E_STORAGE`, `E_GATE_TOOL_UNAVAILABLE`, `E_COPY_FAILED`. עם `result: error` בלבד.

## 6. רשימת בדיקות (`checks`)

לכל בדיקה: `id`, `status` (`pass` / `fail` / `warn` / `not_run`), ואופציונלי `code` ו־`detail` קצר.
`detail` לא מכיל נתיבים מקומיים של Arx, כתובות, סודות או פרטי ציוד.

## 7. קוד חדש

רשימות הקודים סגורות בסכמה 1. קוד חדש = עדכון של המסמך והסכמה, ומסירה לצד השני לפני שימוש.
