# כלי soak לקריאה בלבד (T068)

שני כלים, Python 3.12 בלבד (ספריית תקן), רצים בתחנת העבודה או בשרת הריצה.

- `soak_sampler.py` דוגם כל 60 שניות ומוסיף שורה ל-CSV.
- `analyze_soak.py` מפיק סיכום Markdown בעברית, צ'קליסט קבלה T068, טבלת מגמות ושיפוע, ו-PNG אם `matplotlib` מותקן.

## הגדרות (בזמן ריצה, לא נשמרות ולא מודפסות)

משתני סביבה, או הקובץ `secrets/lab.env` (מחוץ ל-git):

| משתנה | משמעות |
|---|---|
| `HA_URL`, `HA_TOKEN` | כתובת Home Assistant וטוקן ארוך-טווח (פרוקסי ה-supervisor) |
| `SOAK_ADDON_SLUG` | מזהה ה-add-on אצל ה-supervisor |
| `SOAK_ADDON_URL` | כתובת ה-API של ה-add-on (לא חובה; בלעדיה מדלגים על מדידות ה-add-on) |
| `SOAK_ADDON_TOKEN` | טוקן Bearer ל-add-on, אם נדרש (לא חובה) |
| `SOAK_VERIFY_TLS=0` | ביטול אימות TLS בתעודה עצמית (לא חובה) |

אין כתובות או מארחים בקוד או בתיעוד.

## הרצה

```
py -3.12 scripts/soak/soak_sampler.py --check                       # בדיקת הגדרות, בלי רשת ובלי דגימה
py -3.12 scripts/soak/soak_sampler.py --duration 24 --out soak.csv   # 24 שעות (0 = עד Ctrl-C)
py -3.12 scripts/soak/analyze_soak.py soak.csv --out summary.md
```

אפשר להריץ שוב על אותו קובץ: הדגימה ממשיכה לתוכו (נוספות שורות `start`/`stop`), והכותרת נכתבת פעם אחת.
אפשר להעביר כמה קבצי CSV למנתח.

## מה נדגם (בקשה אחת לכל endpoint בכל דגימה)

- add-on: `/healthz`, `/health`, `/health/summary`: latency, קוד HTTP, מוני נעילת כתיבה, תור ingest, backpressure, דיסק פנוי, מספר מצלמות, דגלי נגישות.
- supervisor (דרך HA): סטטיסטיקות add-on (זיכרון, CPU), מידע add-on (מצב, גרסה), סטטיסטיקות הליבה.
- לוג ה-add-on: ספירת ERROR / WARNING / Traceback / startup כל 5 דגימות (חלון 2000 שורות אחרונות, לא מצטבר).
- דגלי NVR / go2rtc / HA הם התצוגה המאוחסנת של ה-add-on עצמו (`/health`). הכלי לא פונה ל-NVR או ל-go2rtc ולא נוגע בהתקנים.

## חוסן

- ניתוק רשת: שגיאת הבקשה נרשמת בעמודה `error` והדגימה ממשיכה.
- שינה של המחשב או עצירה ארוכה: ללא "ריצת השלמה"; השורה הבאה מסומנת קודם בשורת `gap` עם משך הפער בשניות.
- כתיבה אטומית (שורה אחת, `fsync`), שורה קטועה מתהליך שנהרג נסגרת לפני ההמשך, קובץ עם כותרת שונה נדחה.
- זיהוי הפעלה מחדש: איפוס uptime (כשיתווסף), שינוי גרסה, חזרת המצב ל-`started`, או ירידה במונה מצטבר (נעילות כתיבה, ingest).

## מה אינו נחשף היום ב-add-on (ממצא, לא יושם)

בדיקת הנתיבים `/health`, `/health/report`, `/storage/local` ב-`smplwise_vms/backend` מראה שאין שם: RSS של התהליך, threads, file descriptors,
uptime, וגודל קובץ DB או WAL. הזיכרון וה-CPU נלקחים מה-supervisor. עמודות `threads`, `open_fds`, `uptime_s`, `db_bytes`, `wal_bytes` נשארות ריקות והצ'קליסט מסמן "לא נמדד".

ממומש (`pilot/health-process-stats`): `GET /api/v1/health` מחזיר בלוק קריאה-בלבד, ללא מזהים או נתיבים:
`process: {uptime_s, threads, open_fds, rss_mb}` ובתוך `db`: `{size_bytes, wal_bytes}` (גודל קובץ ה-DB הראשי וה-`-wal`, בבתים).
הערכים נקראים מ-stdlib בלבד (`/proc/self` בלינוקס; ב-Windows הערכים שאינם זמינים הם `null`), נשמרים במטמון 5 שניות כך שדגימה תכופה אינה מעמיסה, ואינם יכולים להכשיל את התשובה (כל שגיאה = `null`).
חשיפה: הבלוקים מוחזרים רק למי שמחזיק את ההרשאה `system.configure` (כמו `push` ו-`remote` באותו route); משתמש אחר מקבל את `/health` ללא `process` וללא הגדלים. לכן טוקן ה-sampler חייב להיות של מחזיק הרשאה זו.
הכלי כבר קורא את `threads`, `open_fds`, `uptime_s`, `db_bytes`, `wal_bytes` בלי שינוי קוד. `rss_mb` עדיין אינו עמודה (הזיכרון נדגם מה-Supervisor כ-`addon_mem_mib`); הוספת עמודה היא שינוי נפרד.

## מגבלות

- latency: דגימה אחת לכל endpoint, ולכן p50/p95/p99 מחושבים בניתוח על פני כל הדגימות.
- תרחישים מכוונים (הפעלה מחדש של HA / go2rtc / NVR, דיסק מלא, עומס על תור הייצוא, רצף ההקלטה) אינם חלק מדגימה פסיבית; הצ'קליסט מציג אותם "לא נמדד" או "חלקי" עד שיורצו באישור ויתועדו.
- catalogue scale מול streams/transcodes חיים: נדגם רק מספר המצלמות בקטלוג.

## בדיקות

`smplwise_vms/backend/tests/test_soak_sampler.py` (תגובות HTTP מדומות, בלי רשת). הרצה בשרת: `private/runner/run_smart.py backend <branch> tests/test_soak_sampler.py`.
