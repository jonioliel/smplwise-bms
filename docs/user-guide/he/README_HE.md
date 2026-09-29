# מדריך שימוש בעברית — תשתית צילומי המסך (T091)

Source: original

> מסמך זה מתעד את **התשתית** בלבד (איך מריצים את הסקריפט, סכימת `screens.json`, כללי שמות קבצים וכלל הפרטיות).
> תוכן המדריך עצמו (כיתובים, "איך עושים...", מילון מונחים, "מגבלות ידועות") הוא עבודה נפרדת שמסתמכת על
> התשתית הזו — ראו `docs/user-guide/he/screens.json` (שדה `caption_he` בכל מסך הוא `TODO` בינתיים).

## מה יש כאן

- `docs/user-guide/he/screens.json` — רשימת כל מסך/אזור שצריך צילום מסך בשבילו.
- `frontend/tests/guide-screenshots.spec.ts` — ה־Playwright spec שקורא את `screens.json` ומייצר את קבצי ה־PNG.
- `docs/user-guide/he/img/` — פלט הצילומים (נשמר בגיט; מוחלף מדי פעם כשהמוצר משתנה).

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

## הרצה כנגד המעבדה האמיתית (option ב׳ — Ingress; לשלב מאוחר יותר)

**אותו סקריפט בדיוק**, כדי שלא יהיו שני מסלולי קוד לתחזק. ההבדל: כתובת הבסיס היא ה־Ingress של ה־Add-on אצל
הבעלים, וזהות המשתמש מגיעה מסשן ה־Ingress עצמו (לא מ־`X-SW-Dev-User` — זהות המפתחים לא קיימת שם):

```powershell
$env:SW_GUIDE = "1"
$env:SW_GUIDE_BASE_URL = "<כתובת ה-Ingress>"       # לא לשמור כאן בקוד — להזין בזמן ההרצה בלבד
$env:SW_GUIDE_SESSION  = "<ערך עוגיית הסשן>"        # נשלח כ-Cookie header; לא לשמור בקוד, ב-commit, ב-log או בזיכרון
npx playwright test tests/guide-screenshots.spec.ts --project=desktop
```

הזרעת הנתונים (`ha/dev/registry` וכו') **לא** רלוונטית מול המעבדה — היא זמינה רק במצב "זהות מפתחים" של
ה־backend. מול המעבדה יש להסתמך על הנתונים והתפקידים שכבר קיימים שם בפועל; ייתכן שחלק מהמסכים ב־`screens.json`
ידלגו על שלב ה"role capture" (למשל אם אין משתמש `site_admin` אמיתי בהתקנה) — זה תקין, לא באג.

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
| `setup` | object[] | צעדים אחרי הניווט ולפני הצילום: `{"type":"click","selector":"..."}`, `{"type":"waitFor","selector":"..."}`, `{"type":"waitMs","ms":N}`. |
| `caption_he` | string | כיתוב עברי — כרגע `TODO: ...` בכל השורות; ממולא בעבודת התוכן הנפרדת. |

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
  בתוכן המסך עצמו (למשל שדה שמציג כתובת NVR). לפני שמירת צילום מעבדה בגיט — לבדוק ידנית שאין טקסט כזה גלוי
  על המסך (למשל במסך `הגדרות › גשר Home Assistant` או `הגדרות › וידאו ומדיה`, שיכולים להציג כתובות).
- **וידאו ותמונות מותרים**: תמונת מצלמה אמיתית או קטע וידאו אמיתי מהמעבדה **כן** מותרים בצילום, לפי אישור
  הבעלים (הם לא נחשבים מידע פרטי מהסוג שיש להסתיר) — הכלל חל על מזהי רשת/חומרה, לא על תוכן החזותי.
  בכל מקרה, שמות אנשים/דיירים אמיתיים בטבלאות (למשל ב־WisKey › אנשים) עדיין טעונים שיקול דעת לפני commit.
  אין להעלות שום צילום מעבדה לפני סקירה אנושית קצרה.
