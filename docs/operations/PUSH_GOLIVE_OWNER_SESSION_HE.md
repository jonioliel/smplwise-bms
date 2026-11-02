# מושב הפעלת ההתראות לטלפון (Firebase + Apple + חתימה) - רשימת סימון לבעלים

Source: original

**מצב: הוכן ב-2026-11-02, לא בוצע.** שום חשבון לא נפתח, שום מפתח לא נוצר, שום דבר לא נשלח. המסמך מניח שלא ידוע לך כלום על
Firebase או על Apple: כל צעד אומר איפה ללחוץ, מה לרשום ולאן זה הולך. את פירוט ההקמה של הממסר עצמו (פקודות, סודות, החלפת
מפתחות) מסביר `ARX_PUSH_RELAY_DEPLOY_HE.md`; את הבדיקה בשטח אחרי המושב מסביר `MOBILE_FIELD_TEST_HE.md`.

> **כלל ברזל:** קבצי מפתחות (JSON של Firebase, `.p8` של Apple, קובץ ה-keystore של אנדרואיד, סיסמאות) **לא נכנסים ל-git, לא
> מודבקים בצ'אט ולא נשלחים במייל**. הם נשמרים בתיקייה `secrets\` (לא עולה לשום מאגר) ובמנהל הסיסמאות, ועוברים הלאה רק בדרך
> שכתובה בסעיף 5.

## 1. סיכום: מה עושים, כמה זמן

| # | צעד | דקות | מה יוצא ממנו |
|---|---|---|---|
| 0 | הכנה בתחילת המושב (הרצת הבדיקה המקדימה) | 5 | אישור שהממסר והמחשב תקינים |
| 1 | Firebase: פרויקט, אפליקציית אנדרואיד, מפתח שירות לממסר | 20 | `google-services.json` לצוות אנדרואיד; מפתח שירות ב-`secrets\` |
| 2 | Cloudflare: העלאת הממסר ובדיקת בריאות | 15 | כתובת הממסר + מפתח שרת + `fcm: true` |
| 3 | Google Play Console: אפליקציה, מסלול בדיקה פנימי, מפתח העלאה | 15 | מסלול Internal testing ריק + מפתח העלאה לצוות |
| 4 | Apple: מזהים, App Group, מפתח APNs, רשומה ב-App Store Connect | 25 | מפתח `.p8` בממסר, `apns: true`, TestFlight מוכן |
| 5 | חיבור שרת המעבדה לממסר | 5 | `push_relay_url` + מפתח בשרת אחד |
| 6 | העברה לצוותים ותיעוד | 5 | טבלת העברה מלאה |
| | **סה"כ** | **90** | |

אם אין עדיין חשבון Apple מאושר (השלב נמשך לפעמים ימים, ראה סעיף 2): עושים רק 0, 1, 2, 3, 5, 6 (כ-65 דקות), ומשאירים את צעד 4
(כ-30 דקות) למושב נפרד. האנדרואיד לא תלוי ב-Apple והממסר עובד גם בלעדיו (`apns: false`).

## 2. לפני המושב (לא על השעון; חלק לוקח ימים)

סמן כל שורה לפני שקובעים תאריך. **השורות 1 ו-2 הן ה"צוואר בקבוק": האימות אצל Apple ואצל Google יכול להימשך מיום עד שבוע.**

- [ ] **1. חשבון Apple Developer Program** (developer.apple.com/programs/enroll). בתשלום שנתי (כ-99 דולר). בחירה: *יחיד* (מהיר, הפעילות
  תחת שמך) או *ארגון* (דורש מספר D-U-N-S של החברה ואימות; מתאים אם האפליקציה תופץ בשם החברה). Apple ID עם אימות דו-שלבי פעיל.
  ההמלצה: ארגון, אם יש מספר D-U-N-S; אחרת יחיד, ואפשר להעביר לארגון בהמשך רק בהליך מסודר מול Apple.
- [ ] **2. חשבון Google Play Console** (play.google.com/console). תשלום חד-פעמי (כ-25 דולר) ואימות זהות. גם כאן *יחיד* או *ארגון*
  (ארגון דורש D-U-N-S). **בדוק בדף העזרה של Play Console את הדרישות העדכניות לחשבונות חדשים** (Google מחמירה מעת לעת את הכללים
  לפני פרסום ציבורי; מסלול הבדיקה הפנימי שבו נשתמש הוא הראשון שנפתח).
- [ ] **3. חשבון Google אחד שמחזיק את Firebase ואת Play.** ההמלצה: חשבון ייעודי של החברה (לא Gmail אישי), עם אימות דו-שלבי, והבעלים
  כבעלים (Owner). כך אפשר להוסיף אנשים בלי להעביר סיסמה.
- [ ] **4. Cloudflare**: ההתחברות עובדת (`npx wrangler login`), Node 20+ מותקן, המאגר משוכפל, `npm ci` רץ פעם אחת בתיקיית `services\push-relay`.
- [ ] **5. מנהל סיסמאות פתוח** (עם אפשרות לצרף קבצים) ומכשירי האימות הדו-שלבי של כל החשבונות אצלך.
- [ ] **6. הטלפון(ים)**: אנדרואיד אחד לפחות. אייפון פיזי נדרש רק לבדיקת Push (הסימולטור לא מקבל Push אמיתי).
- [ ] **7. הבדיקה המקדימה ירוקה** (לא נוגעת בשום דבר באוויר):

```powershell
cd C:\cloude\smplwisebms
.\.venv\Scripts\python.exe scripts\push_golive_check.py dry-run --worker
```

מצופה בסוף: `0 failed, 0 not run`. (בלי `--worker` היא רצה בלי npm ומדווחת על שלב ה-Worker כ-NOT_RUN.) השורה "KV namespace id is still the
placeholder" היא נכונה לפני המושב.

## 3. החלטות שמקבלים בראש המושב (ההמלצה מסומנת)

| # | שאלה | המלצה | למה |
|---|---|---|---|
| Q12 | איך מפיצים לעובדים | **א.** מסלול Internal testing ב-Play + TestFlight | בלי חנות ציבורית ובלי סקירה; עד 100 בודקים באנדרואיד וב-TestFlight פנימי; עדכון בלחיצה |
| Q13 | מי מחזיק את מפתח החתימה באנדרואיד | **א.** הבעלים מחזיק, הצוות מקבל מפתח העלאה | ראה 3.1 |
| Q14 | איזו אפליקציית אנדרואיד היא הקנונית | **א.** גרסת הצוות 2.1.x; המעטפת שבמאגר (2.0.2) נשארת כהפניה בלבד | מזהה החבילה `com.smplwise.arx.app` זהה בשתיהן, ואי אפשר להעלות שתיים תחת אותו מזהה |

### 3.1 מפתח החתימה באנדרואיד - ההמלצה

גוגל מחייבת **Play App Signing** לאפליקציות חדשות: את מפתח החתימה האמיתי (שמוכיח שהעדכון הוא שלנו) מחזיקה גוגל בחשבון ה-Play של הבעלים.
הצוות לא מקבל אותו ולא צריך אותו. מה שהצוות מקבל הוא **מפתח העלאה (upload key)**, מפתח נפרד שמוכיח רק "הקובץ הזה הועלה על ידי מי שמורשה":

- הבעלים יוצר את מפתח ההעלאה (פקודה בצעד 3), שומר עותק מוצפן במנהל הסיסמאות, ומעביר לצוות את הקובץ והסיסמאות בדרך שבסעיף 5.
- אם המפתח דלף או אבד: מבקשים ב-Play Console "Request upload key reset" והבעלים מאשר. אפשר להחליף בלי לפגוע באפליקציות המותקנות.
- **החלטה בלתי הפיכה:** מזהה החבילה (`com.smplwise.arx.app`) ננעל אחרי ההעלאה הראשונה. מוודאים אותו עם הצוות לפני צעד 3.
- קובץ ה-APK שמותקן ידנית (sideload, אפשרות ב של Q12) חתום במפתח אחר ולכן **אינו** עדכון של התקנה מ-Play (ולהפך). בוחרים מסלול אחד לכל מכשיר.

## 4. המושב עצמו

כל הפקודות ב-PowerShell. הקבצים נשמרים ב-`C:\cloude\smplwisebms\secrets\` (התיקייה קיימת ואינה עולה ל-git; הבדיקה בצעד 1 מוודאת זאת).

### צעד 0 - הכנה (5 דקות)

- [ ] מריצים שוב `scripts\push_golive_check.py dry-run` (ראה סעיף 2.7).
- [ ] פותחים את מנהל הסיסמאות. כל סוד שנוצר היום נשמר שם מיד, ולא נשאר רק בקובץ.
- [ ] רושמים בצד (לא בצ'אט): שעת התחלה.

### צעד 1 - Firebase (20 דקות)

1. console.firebase.google.com, מחוברים לחשבון מסעיף 2.3 ← **Create a project** ← שם: `SmplWise Arx`. שאלת Google Analytics: **לבטל** (לא צריך, פחות איסוף נתונים).
2. בפרויקט: גלגל השיניים ← **Project settings** ← **General** ← **Add app** ← Android. **Package name: `com.smplwise.arx.app`** (בדיוק; אותו מזהה
   שנקבע ב-Play). כינוי: `SmplWise Arx Android`. SHA-1: אפשר להשאיר ריק (Push דרך FCM לא צריך אותו).
3. מורידים את **`google-services.json`** ושומרים ב-`secrets\google-services.json`. (הוא לא "סיסמה" אבל מכיל מפתח פרויקט ולא נכנס ל-git; הצוות מקבל אותו לפי סעיף 5.)
   מדלגים על שלבי ה-SDK שהקונסולה מציגה (הצוות כבר כתב את הקוד).
4. **אין צורך באפליקציית iOS ב-Firebase**: ה-Push לאייפון עובר ישירות ל-Apple (צעד 4), לא דרך Firebase.
5. מפתח השירות של הממסר. שתי דרכים:
   - **קצרה (מומלצת למושב הראשון):** Project settings ← **Service accounts** ← **Generate new private key** ← Generate. נשמר קובץ JSON.
   - **מצומצמת (אם יש זמן, 5 דקות נוספות):** console.cloud.google.com ← IAM & Admin ← Service Accounts ← Create ← שם `push-relay` ← תפקיד
     **Firebase Cloud Messaging Admin** (ודא את שם התפקיד בקונסולה; אם אינו מופיע, השתמש בדרך הקצרה) ← Keys ← Add key ← JSON. יתרון: המפתח יכול רק לשלוח הודעות.
6. שומרים את הקובץ כ-**`secrets\firebase-relay-service-account.json`** ובמנהל הסיסמאות.
7. ב-Cloud Console ← APIs & Services ← ודא ש-**Firebase Cloud Messaging API** מופעל (בפרויקט חדש הוא מופעל כברירת מחדל; ה-API הישן "Cloud Messaging (Legacy)" כבוי ואינו נחוץ).
8. בדיקה: 

```powershell
.\.venv\Scripts\python.exe scripts\push_golive_check.py secrets-preflight
```

מצופה: `PASS` בשורות של מפתח השירות, ו-`NOT_RUN` על מפתח APNs (עד צעד 4). **הפקודה לא מדפיסה שום ערך מהקבצים.**

**אם המפתח לא נוצר** ("Service account key creation is disabled by organization policy"): החשבון שייך לארגון Google Workspace עם מדיניות שחוסמת מפתחות. פותרים
בחשבון Workspace אחר או בהחרגה של מנהל הארגון; לא עוקפים על ידי שימוש בחשבון אישי של מישהו אחר.

### צעד 2 - הממסר ב-Cloudflare (15 דקות)

הפירוט בסעיפים 3.2-3.5 של `ARX_PUSH_RELAY_DEPLOY_HE.md`. בקצרה, בתיקיית `services\push-relay`:

1. `npx wrangler login` (אם לא נעשה), `npx wrangler kv namespace create RELAY_KV`, הדבקת ה-id ב-`wrangler.toml`, `npx wrangler deploy`.
2. בדיקה ראשונה (עוד בלי סודות): 

```powershell
cd C:\cloude\smplwisebms
.\.venv\Scripts\python.exe scripts\push_golive_check.py health --url https://smplwise-push-relay.<שם-החשבון>.workers.dev
```

3. מפתח שרת (סעיף 3.4א במדריך), `RELAY_TOKEN_SECRET` (3.4ב), ואז מפתח Firebase (3.4ג).
4. בדיקה סופית של הצעד: 

```powershell
.\.venv\Scripts\python.exe scripts\push_golive_check.py health --url https://smplwise-push-relay.<שם-החשבון>.workers.dev --expect-fcm --expect-stable --min-server-keys 1
```

מצופה: `PASS` בשלוש הבדיקות. **`fcm: true` אומר שהסוד קיים ונקרא, לא ש-Google מקבלת אותו** - זה יוכח רק בבדיקת Push אמיתית אחרי המושב.

### צעד 3 - Google Play Console (15 דקות)

1. play.google.com/console ← **Create app**: שם `SmplWise Arx`, שפה Hebrew, סוג *App*, *Free*. מסמנים את ההצהרות הנדרשות (Developer Program Policies, US export laws).
2. **Setup** ← **App signing**: מוודאים ש-**Play App Signing** פעיל (ברירת המחדל).
3. **Testing** ← **Internal testing** ← **Testers** ← Create email list `arx-team` ← כתובות Gmail של הבודקים (הבעלים + מי שיבדק). שומרים.
   (הקישור להצטרפות לבדיקה נוצר כאן ושולחים אותו רק לבודקים.)
4. מפתח העלאה (נוצר על המחשב של הבעלים; דורש JDK, הכלי `keytool` מותקן עם Temurin JDK 17 / Android Studio). הסיסמאות מוקלדות בחלון (לא מופיעות על המסך):

```powershell
keytool -genkeypair -v -keystore secrets\arx-upload.jks -alias arx-upload -keyalg RSA -keysize 2048 -validity 10000
keytool -export -rfc -keystore secrets\arx-upload.jks -alias arx-upload -file secrets\arx-upload-cert.pem
```

   שומרים את הקובץ `arx-upload.jks` ואת שתי הסיסמאות (keystore ו-key) במנהל הסיסמאות. ה-`.pem` הוא התעודה הציבורית (לא סוד; Play מבקש אותה
   באיפוס מפתח העלאה).
5. **ההעלאה הראשונה של קובץ AAB נעשית ידנית ב-Play Console** (גוגל לא מאפשרת אותה בממשק האוטומטי) - אותה עושה הצוות בבניה החתומה הראשונה ב-Internal testing, לא היום.
6. בצעד הזה **לא** מעלים כלום ו**לא** מפרסמים כלום.

### צעד 4 - Apple (25 דקות; רק כשחשבון Developer מאושר)

developer.apple.com/account ← **Certificates, Identifiers & Profiles**.

1. **Identifiers** ← + ← App IDs ← App: Bundle ID (Explicit) `com.smplwise.arx.app`, תיאור `SmplWise Arx`. יכולות (Capabilities): **Push Notifications**,
   **App Groups**, **Access WiFi Information** (לפי נספח האייפון של הצוות; אם Apple מבקשת אישור נפרד, רושמים ולא עוצרים).
2. App ID נוסף להרחבת ההתראות: `com.smplwise.arx.app.nse`, עם **App Groups**.
3. **Identifiers** ← + ← App Groups ← `group.com.smplwise.arx`; משייכים לשני ה-App ID.
4. **Keys** ← + ← שם `SmplWise Arx APNs`, מסמנים **Apple Push Notifications service (APNs)** ← Continue ← Register ← **Download** (הקובץ `AuthKey_XXXXXXXXXX.p8` יורד
   **פעם אחת בלבד**). שומרים אותו מיד ב-`secrets\` ובמנהל הסיסמאות. רושמים את ה-**Key ID** (10 תווים, גם בשם הקובץ) ואת ה-**Team ID** (Account ← Membership details).
   (לחשבון מותרים שני מפתחות APNs במקביל; זה מה שמאפשר החלפה בלי הפסקה.)
5. בדיקת צורה לפני ההכנסה לממסר:

```powershell
.\.venv\Scripts\python.exe scripts\push_golive_check.py secrets-preflight --apns-key-id <KEYID> --apns-team-id <TEAMID>
```

6. הכנסת סודות לממסר (סעיף 3.4ד במדריך): `APNS_KEY_P8`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID` = `com.smplwise.arx.app`. אחר כך:

```powershell
.\.venv\Scripts\python.exe scripts\push_golive_check.py health --url https://smplwise-push-relay.<שם-החשבון>.workers.dev --expect-fcm --expect-apns --expect-stable --min-server-keys 1
```

7. **App Store Connect** (appstoreconnect.apple.com) ← Apps ← + ← New App: iOS, שם `SmplWise Arx`, שפה עברית, Bundle ID שנרשם, SKU לבחירה (`smplwise-arx-ios`).
   ← **TestFlight** ← Internal Testing ← קבוצה `arx-team`. בודקים פנימיים הם משתמשי App Store Connect (Users and Access ← Add; התפקיד: *Developer* או *App Manager*; ודא בקונסולה מה מאפשר גישה ל-TestFlight)
   עם Apple ID שלהם. בניה שעוברת ל-TestFlight פנימי לא עוברת סקירת Apple מלאה; בניות תקפות 90 יום.
8. `APNS_ENV` נשאר `production` (בניית TestFlight / App Store). בניות פיתוח מ-Xcode מייצרות אסימון sandbox ולא יעבדו מול הממסר הזה (סעיף 3.4ד במדריך).

### צעד 5 - חיבור שרת המעבדה לממסר (5 דקות)

**שרת המעבדה בלבד, כשהנוכחות כבויה** (Q16 א). שרת הבית של הבעלים רק לפי החלטה נפרדת.

- [ ] בהגדרות התוסף: `push_relay_url` = כתובת הממסר (בלי `/v1`, מתחילה ב-`https://`); שמירה והפעלה מחדש של התוסף.
- [ ] במערכת ← הגדרות ← חיבורים ← סודות ← "מפתח ממסר ה-Push": הסוד של השרת הזה (החלק שאחרי הנקודתיים ב-`SERVER_KEYS`).
- [ ] הפעלת ערוץ "אפליקציה" בהגדרות ההתראות של Arx (לפי המדריך, סעיף 5).
- בדיקת הצלחה: כל עוד אין אפליקציה רשומה אין מה לשלוח. הבדיקה האמיתית היא ב-`MOBILE_FIELD_TEST_HE.md` סעיף 6.

### צעד 6 - העברה לצוותים ותיעוד (5 דקות)

מילוי טבלת ההעברה (סעיף 5) ושמירת תוצאות המושב (סעיף 7).

## 5. מה מועבר, למי, ואיך

| פריט | סוד? | למי | איך | לא עושים |
|---|---|---|---|---|
| `google-services.json` | מזהה פרויקט + מפתח; לא נכנס ל-git | צוות אנדרואיד | קובץ מצורף בתיקייה משותפת במנהל הסיסמאות או העברה ישירה; הצוות שם אותו מחוץ למאגר | צ'אט, מייל, git |
| `arx-upload.jks` + שתי סיסמאות | **כן** | צוות אנדרואיד (מפתח העלאה בלבד) | קובץ מצורף ופריט סיסמה נפרד בכספת משותפת עם הרשאת צפייה בלבד | צ'אט, מייל, git; שולחים סיסמה והקובץ בערוצים נפרדים |
| מזהה חבילה `com.smplwise.arx.app`, שם הפרויקט, כתובת הממסר | לא | שני הצוותים | טקסט רגיל | |
| Apple: Team ID, מזהי App ID, App Group | לא | צוות iOS | טקסט רגיל | |
| Apple: גישת הצוות לחתימה | - | מי שחותם ב-Mac | **מזמינים את Apple ID שלו כחבר צוות (Users and Access) בתפקיד Developer** ובוחרים Team ב-Xcode; לא מוסרים את Apple ID של הבעלים ולא סיסמה | שיתוף חשבון |
| מפתח `.p8` של APNs | **כן** | אף צוות | נשאר רק אצל הבעלים ובממסר (`wrangler secret put`) | כל העברה |
| מפתח השירות של Firebase | **כן** | אף צוות | נשאר רק אצל הבעלים ובממסר | כל העברה |
| `SERVER_KEYS` / מפתח השרת | **כן** | מתקין השרת (כל התקנה מפתח משלה) | מנהל סיסמאות | צ'אט, מייל |

הצוותים לא צריכים אף אחד משלושת המפתחות של הממסר: האפליקציה נרשמת לממסר דרך שרת Arx (חוזה `docs/api/mobile-presence-contract.md`).

## 6. כשמשהו נתקע

| תסמין | הסבר | פעולה |
|---|---|---|
| אימות החשבון אצל Apple / Google ממתין | תהליך ידני של החברה | ממשיכים בלי אותו צד; האנדרואיד והאייפון בלתי תלויים |
| `Service account key creation is disabled` | מדיניות ארגון | סעיף 4, צעד 1, "אם המפתח לא נוצר" |
| `health` מחזיר 404 | הכתובת כוללת נתיב נוסף או `/v1` | הכתובת היא רק `https://<worker>.workers.dev` |
| `fcm: false` אחרי הכנסת המפתח | הקובץ שהוכנס אינו מפתח שירות | `secrets-preflight`; ליצור מחדש |
| `apns: false` | חסר אחד מארבעת סודות APNs | מריצים את ארבעת ה-`secret put` מחדש; `health` מראה רק אם כולם קיימים |
| הקובץ `.p8` אבד | יורד פעם אחת | יוצרים מפתח APNs חדש (מותרים שניים), מעדכנים את הממסר, מבטלים את הישן |
| הקונסולה של Play מבקשת הצהרות נוספות | חלק מהיצירה הראשונה | ממלאים את מה שנדרש לבדיקה פנימית בלבד; לא מפרסמים |

## 7. מה נרשם בסוף המושב (בצ'אט, בלי סודות)

העתק, מלא וחזור אליי. אין לצרף קבצים.

```
תאריך ושעות: ___ עד ___
צעדים שהושלמו (0-6): ___     צעדים שלא: ___ (סיבה)
בדיקות בריאות של הממסר (הפלט המלא של push_golive_check.py health, הוא לא מכיל סודות): ___
Q12 / Q13 / Q14 (א/ב/ג): ___ / ___ / ___
Apple: חשבון (יחיד/ארגון) ___ ; מפתח APNs נוצר (כן/לא) ___ ; רשומת App Store Connect (כן/לא) ___
Play: Internal testing קיים (כן/לא) ___ ; רשימת בודקים (כן/לא) ___ ; מפתח העלאה נוצר ונשמר (כן/לא) ___
מי קיבל מה (לפי טבלת סעיף 5): ___
שרת שחובר לממסר: מעבדה (כן/לא) ___
```

## 8. מה לא נבדק (NOT_RUN) בשלב הזה

- כל הצעדים לעיל (שום חשבון לא נפתח והממסר לא הועלה).
- שליחה אמיתית ל-FCM ול-APNs; הגעה לטלפון; האפליקציה עצמה (פירוט ב-`MOBILE_FIELD_TEST_HE.md`).
- הדרישות העדכניות של Apple ושל Google לחשבונות חדשים, מחירים ושמות מסכים בקונסולות - נכתבו מהידע הכללי, לא נבדקו מול הקונסולות היום; במקרה של סתירה הקונסולה קובעת.
