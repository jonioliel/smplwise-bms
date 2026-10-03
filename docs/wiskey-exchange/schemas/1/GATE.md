# שער הבדיקות ללא חומרה וללא רשת — סכמה 1

טיוטת Arx, 04.10.2026. תיעוד בלבד. כלי השער עצמו (תוצר נפרד) עוד לא קיים; עד שיימסר, השלבים כאן הם הנוהל הידני.
כל מקום שמסומן `TO_BE_CONFIRMED` הוא הצעה שלא אומתה.

## 1. מה השער בודק

1. קלט: תיקיית `ready/<גרסה>/` שלמה, עם `READY.json`.
2. מבנה: סכמה של `release-manifest.json`, `tests-manifest.json`, `capabilities/capabilities.json`, ו־JSON בלי מפתחות כפולים.
3. hashes: שני ה־ZIP, כל קובץ ב־`artifacts_sha256`, וכל קובץ ב־ZIP הבדיקות מול `tests-manifest.json`.
4. עקביות: אותם `version` ו־`source_commit` בשני המניפסטים; `tests_excluded` שווה לאורך `excluded`; הכללים ב־`CRITERIA.md`.
5. החרגות: השוואה ל־baseline המאושר (`BASELINE_EXCLUSIONS.md`) ובדיקות החובה.
6. הרצת הבדיקות בארגז חול, בלי רשת, בתוך תקציב זמן.

## 2. סביבה מוכנה, בלי הורדות

- גרסת Python לפי `python_version` במניפסט. גרסת HA לבדיקות לפי `ha_test_version`.
- תיקיית wheels מוכנה מראש (`wheelhouse/`), שמכילה כל חבילה מ־`requirements-ha-test.txt`, כל אחת מוצמדת ב־`==`.
- ההתקנה: `python -m venv .gate-venv` ואז
  `.gate-venv/bin/python -m pip install --no-index --find-links wheelhouse -r requirements-ha-test.txt`.
- `--no-index` חובה. אם חסר wheel, ההתקנה נכשלת והשער מחזיר קוד 6. אין ניסיון הורדה.
- השער מחשב `wheelhouse_sha256` (SHA-256 של רשימה ממוינת של `<sha256>  <שם קובץ>`) ורושם אותו בדוח.
- מי מכין את ה־wheelhouse ואיפה הוא נשמר: `TO_BE_CONFIRMED` (הצעה: WisKey מכין אחד לכל `ha_test_version`, ו־Arx שומר עותק).
- מערכת ההפעלה של השער: `TO_BE_CONFIRMED`. ההצעה: Linux x86_64 בקונטיינר. לא בדקנו אם הסוויטה רצה גם ב־Windows.

## 3. הפקודה

- פריסה: ה־ZIP של ההתקנה אל `custom_components/<install_dir>/` וה־ZIP של הבדיקות לשורש אותו ארגז חול. חבילת הבדיקות לא דורסת קבצי אינטגרציה ולא כותבת מחוץ לשורש.
- הרצה: בדיוק `test_command` מהמניפסט, מתוך שורש ארגז החול. דוגמה:
  `python -m pytest -q -o addopts="" -p no:cacheprovider --junitxml=gate-junit.xml`
- רשת חסומה בשתי שכבות:
  1. ברמת מערכת ההפעלה (מועדף): קונטיינר עם `--network none`, או namespace רשת ריק. נרשם כ־`disabled_os`.
  2. בתוך pytest: חסימת sockets (למשל pytest-socket, שכנראה מגיע עם pytest-homeassistant-custom-component; `TO_BE_CONFIRMED` לגרסה שלכם). נרשם כ־`disabled_socket_block` רק אם שכבה 1 לא זמינה.
- probes ובדיקות חומרה לא רצים. הן מוחרגות ב־marker ומופיעות ב־baseline.
- פקודת הכלי העתידי של Arx: `TO_BE_CONFIRMED`. הצעה:
  `python -m arx_exchange_gate --ready <תיקייה> --baseline <קובץ> --wheelhouse <תיקייה> --report gate-report.json`

## 4. תקציב זמן

- `test_runtime_budget_seconds` מהמניפסט, נמדד אצל WisKey. תקרה מוצעת: 1800 שניות (`TO_BE_CONFIRMED`).
- מגבלה קשיחה לבדיקות: התקציב ועוד 60 שניות. בחריגה התהליך נעצר, והתוצאה `timeout` עם קוד 3.
- התקנת הסביבה מה־wheelhouse מוגבלת בנפרד ל־600 שניות (`TO_BE_CONFIRMED`). חריגה: קוד 6.
- חריגת זמן היא כישלון. אין "עבר חלקית".

## 5. קודי יציאה

| קוד | תוצאה (`result`) | מתי |
|---|---|---|
| 0 | `pass` | הכול עבר, כל הבדיקות הצפויות נאספו ורצו, אין חריגות |
| 1 | `fail` | בדיקה נכשלה או שגיאת בדיקה |
| 2 | `input_invalid` | סכמה, hash, מפתח כפול, חוסר עקביות בין המניפסטים או לפי `CRITERIA.md` |
| 3 | `timeout` | חריגה מהמגבלה הקשיחה |
| 4 | `missing_tests` | נאספו פחות מ־`expected_collected`, בדיקת חובה חסרה, או pytest לא אסף כלום |
| 5 | `exclusions_violation` | גידול או שינוי בהחרגות בלי הסבר, החרגה של בדיקת חובה, baseline לא מוכר |
| 6 | `environment_error` | הסביבה לא מוכנה: wheel חסר, Python לא תואם, נדרשה הורדה |
| 7 | `network_attempt` | ניסיון גישה לרשת בזמן הבדיקות |
| 70 | `internal_error` | תקלה בכלי השער עצמו |

- רק 0 הוא הצלחה. כל קוד אחר הוא כישלון, גם אם רוב הבדיקות עברו.
- כשיש כמה כשלים, הקוד הוא של הכשל הראשון לפי הסדר: 6, 2, 5, 7, 3, 4, 1.
- בדיקה שדולגה (skip) בזמן ריצה בלי שהיא ב־baseline נחשבת חסרה (קוד 4).

## 6. דוח

- `gate-report.json` לפי `gate-report.schema.json`.
- קובץ JUnit XML, וה־hash שלו בדוח.
- שורה אחת בעברית (`summary_he`), למשל: "השער עבר: 120 מתוך 120 בדיקות, ללא רשת, בתוך תקציב הזמן."
- הסכמה עצמה אוסרת `pass` כשיש חריגת זמן, בדיקות חסרות, הורדה או הפרת חובה. ראו `examples/invalid/gate-report.*`.

## 7. מה לא נבדק כאן

- השער לא מריץ שום דבר מול ציוד, HA חי או רשת.
- עבר בשער אינו התקנה, ואינו אישור להרצה חיה.
