# הגדרות Cloudflare לדף הציבורי של SmplWise Arx - מדריך צעד אחר צעד

> למי: הבעלים / המתקין, בלי צורך בידע מוקדם ב-Cloudflare. כל צעד מסתיים בבדיקה.
> מה המדריך מכסה: ניתוב `/support` (בכל גודל אותיות), הנתיב `/.well-known/assetlinks.json`, איסור מטמון על ה-API הציבורי,
> וכללי הגבלת קצב לאזור הספקים ולקבצי בקשות הצעת מחיר, ובסוף רשימת בדיקה עם פקודות `curl`.
> מה המדריך **לא** עושה: אינו משנה את הקוד, ואינו מחליף את `docs/operations/ARX_CLOUDFLARE_GUIDE_HE.md` (הקמת המנהרה עצמה) ואת
> `docs/user-guide/he/46-tickets_HE.md` חלק א, סעיף 7 (המקור לחלק מהערכים כאן).
>
> **אומת / לא אומת.** הערכים של השרת (מספרי הגבלה, נתיבים, כותרות) נקראו מהקוד ומהמסמכים של הענף `integ/264` ומצוינים עם מקור.
> **לא נבדק מול Cloudflare אמיתי**: שמות התפריטים בלוח הבקרה משתנים מעת לעת, ואם השדה "Path" של מסלול במנהרה מקבל ביטוי עם `(?i)`
> (ראו צעד 1). המדריך הקיים של המנהרה מקבל ביטויים כמו `^/arx(/|$)`, ולכן הציפייה סבירה, אך זה נבדק רק בצעד האימות.

## מונחים ומה להכין מראש

- **HOST** - שם המארח הציבורי, לדוגמה `ecc.smplwise.com`. בכל פקודת `curl` למטה מחליפים את `HOST` בשם שלכם.
- **התוסף** - תוסף SmplWise ב-Home Assistant. בדוגמאות של המדריך הקיים שם המארח הפנימי שלו הוא `0b8c26d5-smplwise-vms`
  (מקור: `ARX_CLOUDFLARE_GUIDE_HE.md` סעיף 5). **בדקו את השם אצלכם** לפני שמעתיקים.
- **פורט 8099** - האפליקציה הראשית (Arx, וגם `/.well-known/assetlinks.json`). **פורט 18093** - השרת הציבורי הנפרד של הדף
  (`/support`). שני הפורטים נשארים **בלי מיפוי (Map) למארח**; רק המנהרה מגיעה אליהם.
- **נתיב הדף** - ברירת מחדל `support` (ההגדרה `public.path_prefix`). אם שיניתם אותו, החליפו בכל מקום במדריך.
- ודאו שבאפשרויות התוסף `tickets_public` פעיל, ושבהגדרות › ניהול השירות › כללי › "דף המטפלים" הוזנה הכתובת הציבורית.
- סדר הכללים בסוף (צעד 6) חשוב: מסלולים ספציפיים **לפני** מסלול ה-Home Assistant הכללי.

הגדירו משתנה אחד בטרמינל כדי שפקודות הבדיקה יעבדו בהעתקה:

```bash
HOST=ecc.smplwise.com        # החליפו בשם המארח שלכם
```

---

## צעד 1. ניתוב `/support` ו-`/Support` (ללא תלות באותיות) אל השרת הציבורי

**למה:** מסלול שמוגדר `^/support(/.*)?$` רגיש לאותיות. ספק שמקליד `/Support` יגיע ל-Home Assistant ולא לדף.
השרת עצמו מגיש את שורש הדף בכל גודל אותיות (`/support`, `/support/`, `/Support`, `/SUPPORT/`) **רק כשאזור הספקים פעיל**
(מקור: `docs/changes/CR-VENDOR-PORTAL.md` סעיף 1, והמדריך למשתמש חלק 7 סעיף 6). נתיבים עמוקים יותר נשארים רגישים לאותיות
ומקבלים 404 אחיד, וזה תקין.

> **הערה על החלטה קודמת:** ב-`CR-VENDOR-PORTAL.md` סעיף 9 פריט 5 הבעלים קבע (2026-10-17) שמסלול לא-רגיש-לאותיות **אינו נדרש** והספקים
> מקבלים כתובת באותיות קטנות. הצעד הזה אופציונלי ומתאים אם רוצים שגם הקלדה ב-`/Support` תעבוד. אם מדלגים עליו, עוברים לצעד 1א בלבד.

### צעד 1א (חובה) - המסלול הרגיל

1. היכנסו ל-Cloudflare: **Zero Trust ‏› Networks ‏› Tunnels** (לפעמים "Connectors"), לחצו על שם המנהרה ‏› **Edit** ‏› לשונית
   **Published application routes** (או "Public Hostnames").
2. אם כבר קיים מסלול ל-`/support`, פתחו אותו וודאו שהערכים כמו בטבלה, ועברו לבדיקה. אם לא - **Add a published application route**.
3. מלאו:

| שדה | ערך להקלדה |
|---|---|
| Hostname | `HOST` (למשל `ecc.smplwise.com`) |
| Path | `^/support(/.*)?$` |
| Service type | `HTTP` |
| URL | `<שם-התוסף>:18093` (למשל `0b8c26d5-smplwise-vms:18093`) |

   מקור הערכים: המדריך למשתמש חלק 7 "נתיב הדף" סעיף 1, ו-`DOCS.md` ("המסלול `^/support(/.*)?$` אל `http://<add-on host>:18093`").
4. תחת **Additional application settings ‏› Connection** (או `originRequest`): `keepAliveTimeout` = `4s` (חייב להיות **קצר מ-5 שניות**),
   `keepAliveConnections` = `8` (לא יותר). מקור: המדריך למשתמש חלק א, סעיף 5 פריט 2.
5. שמרו (**Save**).

**בדיקה 1א:**

```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://$HOST/support/"
```

מצופה: `200` כשהדף פועל (`tickets_public` פעיל). לאימות שהתשובה באמת מהשרת הציבורי ולא מ-Home Assistant:

```bash
curl -sI "https://$HOST/support/" | grep -i -E "x-robots-tag|x-content-type-options"
```

מצופה: שורה `x-robots-tag: noindex, nofollow` (מקור: `public_http.py`, כותרות האבטחה). אם אין - התשובה לא מהשרת הציבורי; בדקו את
פורט 18093 ואת סדר המסלולים (צעד 6). בנוסף: בכרטיס "דף המטפלים" ב-Arx לחצו **בדיקת כתובת**; היא צריכה להצליח.

### צעד 1ב (אופציונלי) - `/Support` בכל גודל אותיות

1. באותו מסלול, החליפו את ה-Path ל:

```
(?i)^/support(/.*)?$
```

   הביטוי הזה (`(?i)` = "בלי הבחנה בין אותיות גדולות לקטנות") הוא דוגמה שניתנה בבקשה; **לא אומת** שהשדה במנהרה שלכם מקבל אותו.
2. אם הלוח דוחה את הביטוי - **חלופה בטוחה בלי `(?i)`**: השאירו את המסלול של צעד 1א והוסיפו עוד שני מסלולים, בכל אחד אותו URL
   (`<שם-התוסף>:18093`): ‏`^/Support(/.*)?$` ו-`^/SUPPORT(/.*)?$`. (שילובים אחרים כמו `/SuPPort` לא ייתפסו; זה מספיק לשימוש רגיל.)
3. שמרו.

**בדיקה 1ב** (אזור הספקים חייב להיות **פעיל**, אחרת התשובה היא 404 אחיד גם כשהניתוב נכון):

```bash
for p in /support /support/ /Support /SUPPORT/; do printf "%s -> " "$p"; curl -s -o /dev/null -w "%{http_code}\n" "https://$HOST$p"; done
```

מצופה כשאזור הספקים פעיל: `200` לארבעתן. כשהוא כבוי: `404` לכולן מלבד `/support/` (שמחזיר את דף "לא זמין" הרגיל) - זה תקין ולא
תקלה בניתוב. לבדיקה שהניתוב נכון כשהאזור כבוי, השוו: `curl -sI https://$HOST/Support | grep -i x-robots-tag` צריך להחזיר את הכותרת
(התשובה הגיעה לשרת הציבורי), בעוד ש-Home Assistant לא מחזיר אותה.

---

## צעד 2. הנתיב `/.well-known/assetlinks.json` בלבד - בלי כוכבית

**למה:** אפליקציית Android של Arx משתמשת ב-passkeys בתוך ה-WebView, ואנדרואיד מושך את הקובץ הזה מהשורש של שם המארח. השורש הולך
ל-Home Assistant, ולכן צריך מסלול נוסף **לנתיב הזה בלבד** אל תוסף Arx (פורט **8099**, לא 18093).
מקור: `docs/changes/CR-USR2-ARX-ONLY-IDENTITY.md` סעיף 10.1: "the exact path `/.well-known/assetlinks.json`, never a wildcard
(a non-prefixed path lands on the local channel; §10.6 F9)" ו-`CR-011-SECOND-FACTOR_HE.md` סעיף 4.C.

> **סתירה במסמכים - נרשמה, לא הוכרעה:** `docs/operations/ARX_ANDROID_SHELL_HE.md` (שורה 13) קובע שבאפליקציה גרסה 2 "אין מסלול
> `assetlinks.json` ב-Cloudflare". `CR-USR2` (10.1 ו-10.3 פריט 5) קובע שהוא נדרש ל-passkeys ב-WebView. ההגדרה בקוד
> (`security.local_passkey_android`) מגישה את הקובץ רק כשהיכולת פעילה ויש אפליקציה מוגדרת, אחרת 404. **צעד זה נדרש רק אם
> מפעילים passkeys לאפליקציית Android** (`security.local_identity` ו-`security.local_passkey_android`). אחרת דלגו עליו.
> לא נבדק על מכשיר אמיתי (`CR-USR2` סעיף 10.3, בדיקה 5: NOT_RUN).

**שלבים:**

1. באותו מסך המסלולים, **Add a published application route**:

| שדה | ערך להקלדה |
|---|---|
| Hostname | `HOST` |
| Path | `^/\.well-known/assetlinks\.json$` |
| Service type | `HTTP` |
| URL | `<שם-התוסף>:8099` (למשל `0b8c26d5-smplwise-vms:8099`) |

   שימו לב: **עוגן `^` בהתחלה ו-`$` בסוף, ובלי `(/.*)?`** - כך רק הנתיב המדויק הזה עובר. לא `^/\.well-known/.*`.
2. שמרו.

**בדיקה 2:**

```bash
curl -s -i "https://$HOST/.well-known/assetlinks.json"          # הנתיב המדויק
curl -s -o /dev/null -w "%{http_code}\n" "https://$HOST/.well-known/assetlinks.json/"   # עם לוכסן סופי
curl -s -o /dev/null -w "%{http_code}\n" "https://$HOST/.well-known/security.txt"       # נתיב אחר באותה תיקייה
```

מצופה:
- הראשונה: `200` עם `content-type: application/json` וגוף שמכיל את שם החבילה וטביעות האצבע, ו-`cache-control: public, max-age=300`
  (מקור: `routers/local_passkeys.py`, `assetlinks`). אם הגוף הוא JSON עם `"code":"not_found"` - המסלול נכון אבל היכולת כבויה או שלא הוגדרה
  אפליקציה; זו תשובת ה-404 של Arx ולא של Home Assistant.
- השנייה והשלישית: **לא** תשובה של Arx. הן צריכות להגיע ל-Home Assistant (בדרך כלל `404` של HA, בגוף HTML או ריק, לא JSON עם
  `correlation_id`). אם קיבלתם JSON של Arx גם בנתיב השלישי - המסלול רחב מדי; תקנו את ה-Path.

---

## צעד 3. בלי "Cache Everything" ובלי Edge TTL על `/support/api/*`

**למה:** האסימון של הספק נשלח בכותרת (`x-ticket-token`) ולא בכתובת. כלל "Cache Everything" מתעלם מכותרת `Cache-Control: private, no-store`
של השרת, ועלול לשמור קובץ או תשובה ולהגיש אותם **לכל מי שמבקש את אותה כתובת**. מקור: המדריך למשתמש חלק 7 "נתיב הדף" סעיף 5,
ו-`CR-RFQ-ATTACHMENTS.md` החלטה 13. הכלל חל על כל `/support/api/*`, ובכלל זה נתיבי הכרטיס (`/support/api/ticket*`), בקשת ההצעה
(`/support/api/rfq*`), הקבצים (`/support/api/rfq/file/*`, `/support/api/ticket/rfq-file/*`), ואזור הספקים (`/support/api/portal/*`).

**שלבים:**

1. **בדיקת כללים קיימים (חשוב):** ב-Cloudflare בחרו את הדומיין (Zone) ‏› **Caching ‏› Cache Rules**. חפשו כל כלל שמתאים ל-`HOST`
   או ל-`/support/*` ושמגדיר "Eligible for cache" / "Cache Everything" / "Edge TTL". בנוסף **Rules ‏› Page Rules** (אם קיים אצלכם):
   חפשו כלל כמו `*HOST/*` עם Cache Level: Everything. כל כלל כזה שחל על הנתיב - ערכו אותו כך שיוציא את `/support/api/` או מחקו אותו.
2. צרו כלל מפורש: **Caching ‏› Cache Rules ‏› Create rule** (שם: `support-api-bypass`).
   - **If incoming requests match** ‏› **Edit expression**, והדביקו:

```
(http.host eq "HOST" and starts_with(http.request.uri.path, "/support/api/"))
```

   (החליפו `HOST`.) אם שיניתם את נתיב הדף, החליפו `/support/`.
   - **Then** ‏› **Cache eligibility: Bypass cache**.
   - שמרו (**Deploy**). שימו את הכלל **מעל** כל כלל מטמון אחר.
3. **לא** לכבות מטמון על `/support/assets/*` ו-`/support/brand/*`: אלה קבצי עיצוב עם שם מגובב (hash) שהשרת מגיש עם
   `Cache-Control: public, max-age=31536000, immutable` (מקור: `public_app.py`, `public_http.py`), ו-Cloudflare חוסך עליהם תעבורה.
   (מגבלת השרת על קבצים אלה, 300 בדקה לרשת, מניחה שהמטמון של Cloudflare סופג חזרות - מקור: `ratelimit.py`, `asset_per_network`.)

**בדיקה 3:** שלחו בקשה לנתיב API עם אסימון מומצא (תקבלו 404 אחיד, וזה מה שרוצים):

```bash
for i in 1 2; do curl -s -D - -o /dev/null -H "x-ticket-token: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" \
  "https://$HOST/support/api/ticket" | grep -i -E "^HTTP|cf-cache-status|cache-control"; echo ---; done
```

מצופה בכל אחת משתי הבקשות: `cf-cache-status` הוא `DYNAMIC` או `BYPASS` (או שהכותרת חסרה), **לא** `HIT` ולא `MISS` אחרי `HIT`;
ו-`cache-control: no-store`. אם יש `HIT` בבקשה השנייה - עדיין יש כלל מטמון שחל; חזרו לשלב 1.
(הערה: כמה בקשות כושלות באותה דקה נספרות נגד מגבלת "חיפושים כושלים" של השרת, 20 בדקה לרשת - מקור `ratelimit.py`. אל תריצו את הבדיקה בלולאה ארוכה.)

---

## צעד 4. כללי הגבלת קצב (Rate limiting)

הגבלות הקצב ב-Cloudflare הן **הקו הראשון**; לשרת עצמו יש הגבלות משלו שחלות בכל מקרה (מקור: `ratelimit.py`, `PublicLimits`). כלל ה-Cloudflare
נבנה כך שלא יחסום לפני השרת משתמש לגיטימי: הערכים שלו **שווים או גבוהים** מתקציב השרת למשתמש רגיל.

**איך יוצרים כלל (חל על כל כללי הצעד):** בחרו את הדומיין (Zone) ‏› **Security ‏› WAF ‏› Rate limiting rules ‏› Create rule**
(המסלול כמו ב-`ARX_CLOUDFLARE_GUIDE_HE.md` סעיף 6.1). מלאו: שם, **If incoming requests match ‏› Edit expression** (הדביקו את הביטוי),
**With the same characteristics: IP**, **Requests** ו-**Period** לפי הטבלה, **Action: Block** עם **Duration** לפי הטבלה (ב-Free אפשר שהמשך
קבוע; ראו הערה). בסיבוב הראשון אפשר **Managed Challenge** במקום Block כדי לוודא שלא נחסם תעבורה לגיטימית, ואז לעבור ל-Block.

> **לא אומת:** אילו תקופות (Period) וכמה כללים מותרים בתוכנית החשבון שלכם. בתוכנית חינמית ייתכן מספר כללים קטן וקבוצת תקופות מצומצמת.
> אם אי אפשר ליצור את כל הכללים, עדיפות: (4א) כלל כללי, (4ב) אזור ספקים, (4ג) קבצים. ואם מותר כלל אחד בלבד, אחדו את הביטויים בעזרת `or`
> והשתמשו בערך המחמיר ביותר מביניהם - נרשם כשאלה פתוחה.

### טבלת הערכים והמקורות

| כלל | ביטוי | מספר בקשות / תקופה לכתובת IP | מקור המספר |
|---|---|---|---|
| 4א. כללי | `/support/api/*` | **120 / 60 שניות** - *ברירת מחדל מוצעת (לא מוגדר במסמכים)* | המסמכים אומרים במפורש "ערכי הסף - לפי מדיניות שלכם" (המדריך למשתמש חלק 7 סעיף 1). 120 נבחר כי הוא תקציב הקריאה של השרת לרשת באזור הספקים (`portal_read_per_network` = 120 / 60 שניות) ותקציב קריאות התמונות לאסימון (`token_photo_reads` = 120 / 60 שניות) - `ratelimit.py` |
| 4ב. אזור ספקים | `POST /support/api/portal/start` ו-`/verify` | **10 / 10 דקות** | `CR-VENDOR-PORTAL.md` סעיף 2 ("e.g. 10 requests / 10 min per IP") והמדריך למשתמש חלק 7 סעיף 3. תואם לשרת: `portal_start_per_network` = 10 / 600 שניות, 30 / שעה |
| 4ג. קבצי בקשות הצעת מחיר | הקבצים המלאים (לא `/thumb`) | **20 / 60 שניות** - *ברירת מחדל מוצעת* | המסמכים קובעים כלל "מחמיר יותר" בלי מספר (המדריך למשתמש חלק 7 סעיף 4). 20 / דקה הוא תקציב השרת לקישור: `token_file_reads` = 20 / 60 שניות, 60 / שעה - `ratelimit.py`, `CR-RFQ-ATTACHMENTS.md` החלטה 13 |

**משך חסימה (Duration):** המסמכים לא קובעים. ברירת מחדל מוצעת: 10 דקות לכללים 4א ו-4ג, ושעה אחת ל-4ב (תואם חלון השעה של השרת ל-`portal_start`). זו הצעה, לא ערך מהקוד.

### צעד 4א - כלל כללי על `/support/api/*`

- **Edit expression:**

```
(http.host eq "HOST" and starts_with(http.request.uri.path, "/support/api/"))
```

- Characteristics: **IP**. Requests: **120**. Period: **1 minute** (אם 60 שניות לא זמין - הקרובה ביותר שזמינה). Action: **Block**, Duration: **10 minutes**.
- שמות מוצעים: `support-api-general`.

### צעד 4ב - אזור הספקים (כשהוא פעיל)

- **Edit expression:**

```
(http.host eq "HOST" and http.request.method eq "POST" and http.request.uri.path in {"/support/api/portal/start" "/support/api/portal/verify"})
```

- Characteristics: **IP**. Requests: **10**. Period: **10 minutes**. Action: **Block**, Duration: **1 hour**.
- שם מוצע: `support-portal-codes`.

> **למה לא `/support/api/portal/*` כולו כפי שכתוב ב-`CR-VENDOR-PORTAL.md`:** המסמך נותן את הדוגמה "10 / 10 דקות" לכל `/support/api/portal/*`.
> אבל ביקור אחד של ספק כולל כמה קריאות קריאה בלבד (`config`, `items`, `open`, `logout`), והן נספרות באותו כלל; ביקורים חוזרים היו נחסמים
> בלי סיבה. שלוש הקריאות שהמסמך מכוון אליהן ("הצפת בקשות קוד וניחושי קוד") הן `start` ו-`verify`, ולכן הכלל מצומצם אליהן עם אותו מספר.
> אם מעדיפים את הנוסח המדויק של המסמך, החליפו את הביטוי ב-`starts_with(http.request.uri.path, "/support/api/portal/")` (נרשם כשאלה פתוחה).

### צעד 4ג - קבצים מלאים של בקשות הצעת מחיר

- **Edit expression:**

```
(http.host eq "HOST" and (starts_with(http.request.uri.path, "/support/api/rfq/file/") or starts_with(http.request.uri.path, "/support/api/ticket/rfq-file/")) and not ends_with(http.request.uri.path, "/thumb"))
```

- Characteristics: **IP**. Requests: **20**. Period: **1 minute**. Action: **Block**, Duration: **10 minutes**.
- שם מוצע: `support-rfq-files`.
- התמונות הממוזערות (`.../thumb`) לא נכללות כאן: הן נספרות בתקציב הכללי (4א) ובתקציב `photo_read` של השרת (120 / דקה לאסימון), כי עמוד עם 10 קבצים טוען 10 ממוזערות בבת אחת.

**בדיקה 4:** (הכללים נבדקים בנפרד; מי שמריץ בדיקה נחסם לזמן ה-Duration מאותה כתובת, ולכן אל תריצו מהרשת שממנה אתם עובדים בפועל, או הגדירו קודם Duration קצר.)

```bash
# 4ב: בקשות עם מספר פגום - אין הודעה, אין תופעת לוואי; השרת עונה 422 לכל אחת
for i in $(seq 1 14); do
  curl -s -o /dev/null -w "$i %{http_code}\n" -X POST -H "content-type: application/json" \
    -d '{"phone":"x"}' "https://$HOST/support/api/portal/start"
done
```

מצופה: ‏422 בבקשות הראשונות, ואחרי הסף (10) תשובת חסימה. **איך מבדילים בין Cloudflare לשרת:** חסימת Cloudflare מחזירה `429` בגוף HTML או טקסט
של Cloudflare (שגיאה 1015 / עמוד אתגר) **בלי** JSON; חסימת השרת מחזירה `429` עם גוף JSON שמכיל `"code":"rate_limited"` וכותרת `retry-after`
(מקור: `public_http.py`). שניהם תקינים; אם ב-Cloudflare כוונתם לראות את חסימת Cloudflare תחילה, הסף שלו חייב להיות **נמוך** מסף השרת. כאן
הם זהים (10), ולכן ייתכן שתראו את חסימת השרת. לבדיקה נקייה של הכלל ב-Cloudflare בלבד, הורידו זמנית את הסף שלו ל-5 ובדקו, ואז החזירו ל-10.

```bash
# 4ג: אסימון מומצא - ייספר ככשל בחיפוש בשרת (404), לכן רק 5 בקשות
for i in $(seq 1 5); do
  curl -s -o /dev/null -w "$i %{http_code}\n" -H "x-ticket-token: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" \
    "https://$HOST/support/api/rfq/file/0000000000000000"
done
```

מצופה: ‏404 אחיד בכל אחת (אין קובץ כזה). בדיקה מלאה של 20 בדקה דורשת קישור אמיתי; **לא נבדק** כאן. אפשר לאמת את הכלל בלוח הבקרה:
**Security ‏› Events** מציג את הבקשות שנחסמו לפי שם הכלל.

---

## צעד 5. עדכון הגדרות נלוות שכבר נדרשות (בדיקה בלבד)

אלה לא חדשות, אך נכשלות בשקט: ודאו שהן קיימות (מקור: המדריך למשתמש חלק 7 סעיף 2):

1. **Rocket Loader** - כבוי (**Speed ‏› Optimization ‏› Content Optimization**).
2. **Email Address Obfuscation** - כבוי (**Scrape Shield**).
3. **Bot Fight Mode** - כבוי לשם המארח של הדף (הוא עלול להזריק סקריפט; הדף רץ תחת CSP שמתירה סקריפט מאותו מקור בלבד).
   לפי `ARX_CLOUDFLARE_GUIDE_HE.md` 6.1 הוא מומלץ ל-Arx; שני המסמכים מדברים על שם מארח אחד, ולכן **זו סתירה פתוחה** (שאלה 3 למטה).

**בדיקה 5:**

```bash
curl -s "https://$HOST/support/" | grep -i -c -E "rocket|cloudflare-static|email-protection"
```

מצופה: `0`. מספר גדול מאפס = Cloudflare מזריקה משהו לדף; בטלו את היכולת.

---

## צעד 6. סדר המסלולים במנהרה

המנהרה מתאימה את המסלולים **מלמעלה למטה** ועוצרת בראשון שמתאים. הסדר הנדרש:

| # | Path | אל | מקור |
|---|---|---|---|
| 1 | `^/support(/.*)?$` (או `(?i)^/support(/.*)?$`) | `<שם-התוסף>:18093` | צעד 1 |
| 2 | `^/\.well-known/assetlinks\.json$` | `<שם-התוסף>:8099` | צעד 2 (רק אם נדרש) |
| 3 | `^/arx(/\|$)` | `<שם-התוסף>:8099` | `ARX_CLOUDFLARE_GUIDE_HE.md` |
| 4 | `^/t(/.*)?$` | `<שם-התוסף>:18093` | רק כל עוד יש קישורים ישנים בצורת `/t/...` (המדריך למשתמש חלק 7 "קישורים ישנים") |
| אחרון | (ריק / `*`) | `homeassistant:8123` | מסלול Home Assistant |

**בדיקה 6:** ‏`curl -s -o /dev/null -w "%{http_code}\n" https://$HOST/` צריך להמשיך להחזיר את Home Assistant (כמו לפני השינויים, בדרך כלל `200` או הפניה `302`/`301`).

---

## רשימת בדיקה סופית

סמנו כל שורה אחרי שהפקודה החזירה את המצופה. כולן מניחות `HOST` מוגדר (ראו תחילת המדריך).

| # | מה נבדק | פקודה | מצופה |
|---|---|---|---|
| 1 | הדף מגיע לשרת הציבורי | `curl -sI https://$HOST/support/ \| grep -i x-robots-tag` | `x-robots-tag: noindex, nofollow` |
| 2 | כתיב `/Support` (אם בוצע צעד 1ב, ואזור הספקים פעיל) | `curl -s -o /dev/null -w "%{http_code}\n" https://$HOST/Support` | `200` |
| 3 | הנתיב המדויק של assetlinks (אם נדרש) | `curl -s -i https://$HOST/.well-known/assetlinks.json` | `200` + JSON (או `404` JSON של Arx עם `"code":"not_found"` כשהיכולת כבויה) |
| 4 | assetlinks בלי כוכבית | `curl -s -o /dev/null -w "%{http_code}\n" https://$HOST/.well-known/security.txt` | תשובת Home Assistant, **לא** JSON של Arx |
| 5 | אין מטמון ב-API | `curl -s -D - -o /dev/null -H "x-ticket-token: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" https://$HOST/support/api/ticket \| grep -i -E "cf-cache-status\|cache-control"` | `cf-cache-status` הוא `DYNAMIC`/`BYPASS` או חסר, ו-`cache-control: no-store` |
| 6 | הכלל הכללי קיים | Security ‏› WAF ‏› Rate limiting rules | ‏`support-api-general` פעיל (120 / דקה) |
| 7 | כלל אזור הספקים עובד (בדיקה 4ב) | לולאת 14 בקשות `POST /support/api/portal/start` עם `{"phone":"x"}` | ‏422 ואחרי 10 - חסימה |
| 8 | כלל הקבצים קיים | Security ‏› WAF ‏› Rate limiting rules | ‏`support-rfq-files` פעיל (20 / דקה) |
| 9 | נכסים עם שם מגובב עדיין במטמון | `curl -sI https://$HOST/support/assets/<שם-קובץ-מגובב-מהדף> \| grep -i -E "cache-control\|cf-cache-status"` | `public, max-age=31536000, immutable`; ‏`cf-cache-status` יכול להיות `HIT` בבקשה השנייה |
| 10 | אין הזרקת סקריפטים (צעד 5) | `curl -s https://$HOST/support/ \| grep -i -c -E "rocket\|cloudflare-static\|email-protection"` | `0` |
| 11 | Home Assistant לא נפגע (צעד 6) | `curl -s -o /dev/null -w "%{http_code}\n" https://$HOST/` | כמו לפני השינוי |
| 12 | בדיקת הכתובת ב-Arx | הגדרות › ניהול השירות › כללי › "דף המטפלים" › **בדיקת כתובת** | הצלחה (רק אז נחשב הניתוב כמאומת מול Cloudflare אמיתי) |

(שימו לב: בטבלה סימן `\|` בתוך פקודה הוא רק כדי שהטבלה תוצג נכון; בטרמינל מקלידים `|` רגיל.)

## אם משהו נכשל

| סימפטום | סיבה סבירה | מה עושים |
|---|---|---|
| `/support/` מחזיר דף של Home Assistant | המסלול של הדף מופיע **אחרי** מסלול ה-HA, או כתובת היעד שגויה | העבירו את המסלול למעלה (צעד 6), בדקו `:18093` |
| `/Support` מחזיר 404 גם עם צעד 1ב | אזור הספקים כבוי, או הלוח לא קיבל את `(?i)` | הפעילו את אזור הספקים, או השתמשו בחלופה של שלושה מסלולים (צעד 1ב שלב 2) |
| `cf-cache-status: HIT` ב-API | כלל "Cache Everything" או Page Rule ישן | צעד 3 שלב 1; מחקו או ערכו |
| משתמשים לגיטימיים מקבלים 429 | הסף ב-Cloudflare נמוך מדי | העלו את הסף, או עברו מ-Block ל-Managed Challenge; זכרו שכל המשתמשים מאחורי NAT משותף נספרים כ-IP אחד |
| כל המבקרים נחסמים יחד | Arx רואה את כתובת cloudflared ולא את הלקוח | בכרטיס "דף המטפלים" בדקו רשתות proxy מהימנות והכותרת `cf-connecting-ip` ("בדיקת כתובת") |

## שאלות פתוחות / ערכים שלא הוגדרו במסמכים

1. **ערכי כלל 4א (120 / דקה) וכלל 4ג (20 / דקה) ומשך החסימה** הם ברירות מחדל מוצעות שסומנו כך; המסמכים לא קובעים אותם. הערך של 4ב (10 / 10 דקות) מצוטט מהמסמכים, אך הצמצום ל-`start` ו-`verify` הוא הצעה שלנו.
2. **האם נדרש `assetlinks.json`**: סתירה בין `ARX_ANDROID_SHELL_HE.md` ל-`CR-USR2` (ראו צעד 2). דורש הכרעת הבעלים.
3. **Bot Fight Mode**: ‏`46-tickets_HE.md` חלק 7 אומר לכבות לשם המארח של הדף; `ARX_CLOUDFLARE_GUIDE_HE.md` 6.1 ממליץ להפעיל ל-Arx. כשהדף ו-Arx חולקים שם מארח (למשל `ecc.smplwise.com`) אי אפשר לקיים את שניהם. לא הוכרע כאן.
4. **`(?i)` בשדה Path של המנהרה**, וכן תקופות וכמות כללי ה-Rate Limiting בתוכנית שלכם - לא אומתו מול Cloudflare אמיתי.
5. **ההחלטה מ-2026-10-17** (`CR-VENDOR-PORTAL.md` סעיף 9 פריט 5) שמסלול לא-רגיש-לאותיות אינו נדרש: צעד 1ב אופציונלי בשל כך.
