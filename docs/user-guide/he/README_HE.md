# מדריך שימוש בעברית — תשתית צילומי המסך (T091)

Source: original

> מסמך זה מתעד את **התשתית** בלבד (איך מריצים את הסקריפט, סכימת `screens.json`, כללי שמות קבצים וכלל הפרטיות).
> תוכן המדריך עצמו (כיתובים, "איך עושים...", מילון מונחים, "מגבלות ידועות") הוא עבודה נפרדת שמסתמכת על
> התשתית הזו — ראו `docs/user-guide/he/screens.json` (שדה `caption_he` לכל מסך).

## מה יש כאן

- `docs/user-guide/he/screens.json` — רשימת כל מסך/אזור שצריך צילום מסך בשבילו.
- `frontend/tests/guide-screenshots.spec.ts` — ה־Playwright spec שקורא את `screens.json` ומייצר את קבצי ה־PNG
  מול backend הדגמה.
- `frontend/tests/guide-screenshots-live.spec.ts` + `scripts/guide_live_capture.py` — אותו דבר מול המערכת החיה,
  קריאה בלבד ועם צנזור (ראו למטה).
- `docs/user-guide/he/img/` — פלט הצילומים (נשמר בגיט; מוחלף מדי פעם כשהמוצר משתנה).
- `docs/user-guide/he/GUIDE_ALL_HE.html` — כל המדריך בקובץ אחד לקריאה ולהדפסה, נבנה מהעמודים ב־
  `scripts/build_guide.py` (לא עורכים אותו ידנית).

הסקריפט **לא** רץ בערכות הבדיקות הרגילות (`npm run shots`, live/fixture): הוא Opt-in לגמרי, מותנה במשתנה
הסביבה `SW_GUIDE=1`, בדיוק כמו ש־`evidence-*.spec.ts` מותנים ב־`SW_LIVE=1`.

## הרצה כנגד ה־Demo Backend (לפיתוח וריצה חוזרת כאן)

זהה בעיקרון להרצת `evidence-*.spec.ts` עם `SW_LIVE=1` (ראו את הערות הכותרת של אותם קבצים): צריך שרת FastAPI
זמני שרץ, ו־Playwright preview שמגיש את ה־build ומעביר (proxy) את `/api` אליו.

1. בניית ה־Frontend: `cd frontend && npm run build` (מייצר `frontend/dist`; ה־preview server מגיש אותו).
2. הרצת Backend זמני (בלי `secrets/lab.env` — אין צורך ב־NVR/HA אמיתיים לצילומי הדמו):
   ```powershell
   $env:SW_DATA_DIR = "<תיקייה זמנית ריקה>"
   $env:SW_WWW_DIR  = "<לא חובה כאן — ה־UI מוגש דרך ה־preview, לא דרך ה־backend>"
   $env:SW_DEV_USER = "joni"
   $env:SW_BOOTSTRAP_ADMIN = "joni"
   $env:SW_HOST = "127.0.0.1"
   $env:SW_PORT = "8099"
   C:/cloude/smplwisebms/.venv/Scripts/python.exe -m smplwise
   ```
3. הרצת ה־preview (בתיקייה `frontend`, בטרמינל נפרד): `npm run preview` (מגיש על `4173`, מעביר `/api` ל־`8099`).
3. הרצת הצילום עצמו (בתיקייה `frontend`):
   ```powershell
   $env:SW_GUIDE = "1"
   npx playwright test tests/guide-screenshots.spec.ts --project=desktop
   ```
   `--project=desktop` חובה: ה־spec קובע viewport במפורש לכל מסך (desktop/phone), אז אין טעם להריץ גם את
   הפרויקטים `tablet`/`mobile` של `playwright.config.ts` — זה רק יכפיל ריצות מיותרות.
4. הסקריפט **זרע נתונים אידמפוטנטי**: בפעם הראשונה הוא יוצר אתר/מבנה/קומה עם תוכנית וגיאומטריה, מצלמה אחת,
   ואזור HA אחד עם כמה ישויות (הכול עם הקידומת `sw_guide_` / השם "מדריך שימוש"), ומשייך תפקידים
   (`viewer`/`operator`/`editor`/`site_admin`) למשתמשי־פיתוח קבועים. הרצה חוזרת כנגד אותו backend מזהה את
   הנתונים הקיימים ולא יוצרת כפילויות.
5. לסגור את שני התהליכים (backend + preview) כשסיימתם.

`SW_GUIDE_BASE_URL` (אופציונלי): אם ה־preview רץ על כתובת/פורט אחר מברירת המחדל (`http://127.0.0.1:4173/`).

## הרצה כנגד המערכת החיה (T091 — בוצע 29.09.2026)

מסלול נפרד, **קריאה בלבד**, שמצלם את המסכים מההתקנה האמיתית של הבעלים דרך ה־Ingress:

- `frontend/tests/guide-screenshots-live.spec.ts` — אותו `screens.json` ואותו כלל שמות קבצים, בלי הזרעה ובלי
  זהויות פיתוח. מותנה ב־`SW_GUIDE_LIVE=1`; רץ ב־Google Chrome (`frontend/playwright.guide-live.config.ts`, בלי
  preview server).
- `scripts/guide_live_capture.py` — המריץ. קורא בזמן ריצה את ההגדרות הפרטיות של תחנת העבודה (`secrets/lab.env`
  של ה־checkout הראשי — שום ערך לא מודפס, לא נכתב ולא נשמר בקובץ במאגר), פותח WebSocket עם הטוקן הקיים, מבקש
  מה־Supervisor את כתובת ה־Ingress וסשן Ingress (ושומר אותו חי בזמן הריצה), ומעביר ל־spec את הכתובת, את עוגיית
  הסשן ואת רשימת הערכים הפרטיים דרך משתני סביבה בלבד.

```powershell
C:/cloude/smplwisebms/.venv/Scripts/python.exe scripts/guide_live_capture.py capture --text-dir <תיקייה זמנית מחוץ למאגר>
C:/cloude/smplwisebms/.venv/Scripts/python.exe scripts/guide_live_capture.py scan --text-dir <אותה תיקייה>
C:/cloude/smplwisebms/.venv/Scripts/python.exe scripts/guide_live_capture.py apply
C:/cloude/smplwisebms/.venv/Scripts/python.exe scripts/build_guide.py
```

- `capture --only id,id` מצלם רק חלק מהמסכים; `--base-url` מחליף את כתובת המעבדה בכתובת אחרת שמגישה את אותה
  תשתית (מנהרה), כשה־LAN לא נגיש מתחנת העבודה.
- **קריאה בלבד:** ה־spec חוסם כל בקשה שאינה GET/HEAD/OPTIONS (חוץ מ־offer של WebRTC לצפייה בווידאו) ורושם אותה
  ב־`blocked-requests.json` בתיקיית הטקסט. בפועל נחסמו רק בדיקות האשף האוטומטיות (`setup/check/*` — הן נרשמות ביומן
  הביקורת), ולכן בצילום הדסקטופ של האשף הופיעה בשלב ה־NVR השורה "אין חיבור לשרת" — תוצר של החסימה, לא מצב
  אמיתי. `setup-wizard.png` נשאר לכן צילום הדגמה (שממילא מדגים שלב שנכשל); צילום הטלפון חי.
- **תפקיד:** מצלמים בתפקיד של משתמש הטוקן (`system_admin`). וריאנטים של תפקידים אחרים (`--viewer`, `--operator`,
  `--editor`, `--site_admin`) נשארים צילומי הדגמה; `screens.json` מסמן אותם ב־`demo_files`.
- **פלט:** תמונות לא מצונזרות ב־`private-evidence/guide-live/raw/` ומצונזרות ב־`private-evidence/guide-live/redacted/`
  (שתיהן מחוץ לגיט); הטקסט הגלוי של כל עמוד שצולם — בתיקיית הטקסט שנבחרה (לא במאגר). `apply` מעתיק את המצונזרות
  ל־`img/` באותם שמות, דוחס PNG מעל 600 KB (Pillow quantize) ומעדכן את `source` ב־`screens.json`.

## סכימת `screens.json`

מערך של אובייקטים, אחד לכל מסך/אזור:

| שדה | טיפוס | הסבר |
|---|---|---|
| `id` | string | מזהה ייחודי; משמש כבסיס לשם הקובץ. |
| `name_he` | string | שם המסך בעברית, לתצוגה במדריך. |
| `section` | string | קיבוץ למדריך (map / cameras / events / plan-studio / wiskey / devices / settings / roles / mobile). |
| `route` | string | Hash route (`#/...`). יכול להכיל placeholders: `{site}` `{building}` `{floor}` `{camera}` `{area}` — מוחלפים בזמן ריצה בערכי הזרעת הדמו. |
| `viewports` | string[] | `"desktop"` ו/או `"phone"`. |
| `roles` | string[] | אילו תפקידים לצלם עבורם: `viewer` `operator` `editor` `site_admin` `system_admin`. |
| `setup` | object[] | צעדים אחרי הניווט ולפני הצילום: `{"type":"click","selector":"..."}`, `{"type":"waitFor","selector":"..."}`, `{"type":"waitMs","ms":N}`, `{"type":"scrollTo","selector":"..."}`, ו-`{"type":"domClick","selector":"..."}` (לחיצה שנשלחת ישירות לאלמנט, לפקד ששכבה אחרת מכסה — למשל תפריט המשתמש כששלט פתוח). הסלקטורים חודרים ל-shadow DOM; כל צעד פועל על ההתאמה הראשונה. |
| `caption_he` | string | כיתוב עברי של המסך (עמוד המדריך שמפרט אותו מצוין בסופו). |
| `source` | string | `"live"` — הצילום ב־`img/` נלקח מהמערכת החיה; `"demo"` — עדיין צילום הדגמה. |
| `data` | string | (אופציונלי, ברירת מחדל `backend`) מקור הנתונים של הצילום: `backend` — ה־Backend הזמני שלמעלה; `static` — בלי שרת בכלל (ה־spec חוסם את כל קריאות `api/v1`, והאפליקציה עוברת למצב ההדגמה המובנה שלה, כולל הדמיית המולטימדיה בזיכרון); `mock-wall` ו-`mock-area` — מושב API עם תשובות מדומות מתוך `frontend/tests/guide-mocks.ts` (קיר המצלמות עם סידור הקיר; מסך אזור עם כרטיס מסכים, מיזוג וחימום). `mock-area` מייבא את מודול הדמה של המולטימדיה לפי נתיב, ולכן דורש את שרת הפיתוח של Vite (`npm run dev`, עם `SW_BASE_URL` ו-`SW_GUIDE_BASE_URL` שמצביעים אליו) ולא את ה־preview של ה־build. מסכים שאינם `backend` לא צריכים הזרעה ולא תהליך Backend. |
| `demo_files` | string[] | (אופציונלי) קבצים של אותו מסך שנשארו מהדגמה כשהשאר חיים — וריאנטים של תפקידים שלא צולמו. |

הוספת מסך חדש = שורה חדשה ב־JSON; אין צורך לגעת ב־spec עצמו אלא אם המסך דורש `setup` שאין לו עוד תמיכה
(אז מרחיבים את `SetupStep`/`runSetup` ב־`guide-screenshots.spec.ts`).

## כללי שמות קבצים

`docs/user-guide/he/img/<id>[-phone][--<role>].png`

- `-phone` נוסף רק כשה־viewport הוא `phone`.
- `--<role>` נוסף **רק** כשלמסך יש יותר מתפקיד אחד ברשימת `roles` (כדי לא לבלגן שמות של מסכים שממילא נראים
  אותו דבר לכל תפקיד). למסך עם תפקיד יחיד השם נשאר נקי, בלי סיומת תפקיד.
- וריאנט `-dark`: מוכן מבחינת מנגנון (`variants` עתידי + `page.emulateMedia({colorScheme:'dark'})`) אבל **לא
  בשימוש כרגע** — למוצר אין היום מצב כהה אמיתי; הסיומת תופעל כשתהיה למוצר החלפת ערכת נושא, או למסכים שבאמת
  כהים במהותם (כמו קיוסק/מסך מצלמה בודדת) אם יוחלט שצריך גרסה שנייה שלהם.

## כלל פרטיות — צילומי מעבדה

- **בלי** כתובות IP, שמות host, מספרים סיריאליים או כתובות MAC של המעבדה — לא בשם קובץ, לא בכיתוב, ולא
  בתוכן המסך עצמו. ה־spec החי מחליף לפני הצילום כל טקסט גלוי (כולל בתוך shadow DOM, ערכי שדות ו־frames מאותו
  מקור): כתובות IPv4, MAC, דוא"ל, רצפים סיריאליים, רצפי 7+ ספרות (ת"ז / מספר עובד / טלפון) וכל שם host →
  `•••`, ושם הכתובת הציבורית → `your-site.example`. אחר כך הטקסט הגלוי נסרק שוב; פגיעה שנשארה אחרי שלושה ניסיונות
  מכשילה את המסך ולא נכתבת תמונה מצונזרת. `guide_live_capture.py scan` סורק את כל הטקסטים שוב, בנפרד.
- **שמות אנשים:** שמות דיירים (WisKey › אנשים) ומשתמשי התשתית (חוץ מחשבון הצילום) נקראים מההתקנה בזמן הריצה
  ומוחלפים בשמות בדויים (`דייר 1`, `משתמש 2`); מספרי עובד → `•••`. השמות האמיתיים לא נכתבים לשום קובץ.
- **מקומות:** שמות האתר והבניין (בכל מקום, גם בתוך שם מצלמה) ושמות הקומות, האזורים והחדרים (כמקטע שלם של
  טקסט, בין מפרידים) נקראים מההתקנה בזמן הריצה ומוחלפים ב"האתר", "בניין א", "קומה 0", "אזור 1". שם שזהה לשם
  מצלמה נשאר (שמות מצלמות מאושרים). ראשי התיבות באווטאר של מי שקיבל שם בדוי מוחלפים בראשי התיבות של השם הבדוי.
- **תוכניות קומה לא מתפרסמות** (החלטת הבעלים 29.09.2026): המסכים שמציירים את התוכנית — `map-2d`, `map-3d`,
  `events-history-map`, `plan-studio-editor` — נשארים צילומי הדגמה (`apply --demo <files>`).
- **וידאו, תמונות ושמות מצלמות מותרים** לפי אישור הבעלים — הכלל חל על מזהי רשת/חומרה ועל אנשים, לא על
  התוכן החזותי של המצלמות.
- **סקירה אנושית:** אין להעלות (push/merge) צילום מעבדה לפני שהבעלים עבר עליו.
