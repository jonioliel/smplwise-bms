# SmplWise Arx (next release) - Release notes draft / טיוטת הערות שחרור: שינוי קידוד לכמה מצלמות

Draft for the release round; the text of record is the "Unreleased" entry of smplwise_vms/CHANGELOG.md (branch
`pilot/nvr-bulk-encoding`, CR-020 section 10, API §3.8). Not released; the version is not bumped.

## English
### What was added: change the encoding of many cameras at once (מערכת › אבטחה › מצלמות)
- A new button **"שינוי קידוד לכמה מצלמות"** on the cameras screen (and a link in the multi-camera SVC checklist).
- **Choose streams:** every main and sub stream of the NVR in one searchable list, with filters by stream (main / sub / all),
  codec, SVC and WebRTC, and "select all" for what matches. Cameras that are offline or that the NVR does not let Arx change are
  listed but cannot be ticked, with the reason.
- **Choose the new values:** codec (H.264 / H.265), resolution, frame rate, bitrate mode, bitrate, quality, GOP, SVC and smart
  codec - every field starts as "ללא שינוי" (leave as is). A short line reminds that the live view plays only H.264 over WebRTC.
- **Preview before anything is written:** per stream "before ← after"; values that had to be adjusted to what that camera
  allows are marked (the closest resolution or frame rate, a bitrate or GOP inside the camera's range, the profile the new codec
  needs); fields a stream does not have (for example SVC on a sub stream) stay as they are; streams that cannot be changed are
  listed with the reason; the number of changes.
- **One confirmation**, then the change runs on the server one camera at a time with live progress, "עצור", a result list and
  "בטל את מה שנשמר" (undo-all, also from the toast's "בטל").

### Safety
- Same permission as the single change (`nvr.configure`, system administrators only), refused on the remote channel, audited
  (who started it, the settings, every camera's outcome); no address, user name or password in any answer, log or audit row.
- The server plans again from a fresh reading when you confirm and refuses if a camera changed since the preview; every value
  passes the single-stream validation, so an invalid write is never sent.
- All the multi-camera protections stay: stop at the first failure, an unknown outcome checked by a read after 45 s (the batch
  continues only when the read proves the whole change), a hard time limit per camera, single changes refused while it runs, the
  permission checked again before each camera, a restart never resumes a batch, batch state never in a backup.

### How to turn it on and use it
1. Nothing to enable: there is no migration and no setting. Sign in as a system administrator.
2. Open מערכת › אבטחה › מצלמות and press **"שינוי קידוד לכמה מצלמות"**.
3. Tick the streams (for example: filter "ראשי" + "H.265", then "בחר הכל"), press "המשך".
4. Set only what should change (for example: קידוד = H.264), press "תצוגה מקדימה", read the list ("ישתנו", "לא ניתן").
5. Press "החל על N זרמים" and confirm once. "עצור" stops after the current camera; "בטל את מה שנשמר" undoes the batch.

### Known limits
- Tested against a fake NVR and a mocked screen backend only. No real camera was written; the first real bulk change on the
  lab NVR needs the owner's approval.
- The behaviour of a real Hikvision NVR when a codec changes (for example a resolution list that differs per codec) is read from
  the device's capability documents; their exact shape on the lab firmware is still unverified.

## עברית
### מה נוסף: שינוי קידוד לכמה מצלמות בבת אחת (מערכת › אבטחה › מצלמות)
- כפתור חדש **"שינוי קידוד לכמה מצלמות"** במסך המצלמות (וגם קישור ברשימת הבחירה של כיבוי SVC בכמה מצלמות).
- **בחירת זרמים:** כל הזרמים הראשיים והמשניים של ה־NVR ברשימה אחת עם חיפוש, סינון לפי זרם (ראשי / משני / הכול), קידוד, SVC
  ו־WebRTC, ו"בחר הכל" למה שמתאים לסינון. מצלמות לא מקוונות או זרמים שה־NVR אינו מאפשר לשנות מוצגים, אבל אי אפשר לסמן אותם,
  והסיבה כתובה בשורה.
- **בחירת הערכים החדשים:** קידוד (H.264 / H.265), רזולוציה, קצב פריימים, סוג קצב, קצב סיביות, איכות, GOP, SVC ו־Smart codec -
  כל שדה מתחיל ב"ללא שינוי". שורה קצרה מזכירה שהצפייה החיה מנגנת ב־WebRTC רק H.264.
- **תצוגה מקדימה לפני כל כתיבה:** לכל זרם "לפני ← אחרי"; ערכים שהותאמו למה שהמצלמה מאפשרת מסומנים (הרזולוציה או קצב הפריימים
  הקרובים ביותר, קצב סיביות או GOP בתוך הטווח של המצלמה, הפרופיל שהקידוד החדש צריך); שדות שאין בזרם (למשל SVC בזרם משני)
  נשארים כמו שהם; זרמים שאי אפשר לשנות מופיעים עם הסיבה; מספר השינויים.
- **אישור אחד**, ואז השינוי רץ בשרת מצלמה אחר מצלמה, עם התקדמות חיה, "עצור", רשימת תוצאות ו"בטל את מה שנשמר" (ביטול הכול,
  גם מה"בטל" שבהודעה הקופצת).

### בטיחות
- אותה הרשאה של שינוי בודד (`nvr.configure`, מנהלי מערכת בלבד), חסום בערוץ הגישה מרחוק, נרשם ביומן הביקורת (מי התחיל, ההגדרות,
  התוצאה בכל מצלמה); אין כתובת, שם משתמש או סיסמה באף תשובה, לוג או רשומת ביקורת.
- ברגע האישור השרת מתכנן מחדש מקריאה עדכנית ונעצר אם מצלמה השתנתה מאז התצוגה המקדימה; כל ערך עובר את הבדיקה של שינוי בודד,
  כך שכתיבה לא תקינה לעולם אינה נשלחת.
- כל ההגנות של השינוי המרובה נשארות: עצירה בשגיאה הראשונה, תוצאה לא ידועה נבדקת בקריאה אחרי 45 שניות (הסבב ממשיך רק אם הקריאה
  מוכיחה את כל השינוי), מגבלת זמן קשיחה לכל מצלמה, שינויים בודדים נדחים בזמן הריצה, ההרשאה נבדקת שוב לפני כל מצלמה, הפעלה מחדש
  לעולם אינה ממשיכה סבב, ומצב הסבב לעולם אינו נכנס לגיבוי.

### איך מפעילים ומשתמשים
1. אין מה להפעיל: אין מיגרציה ואין הגדרה. נכנסים כמנהל מערכת.
2. פותחים מערכת › אבטחה › מצלמות ולוחצים **"שינוי קידוד לכמה מצלמות"**.
3. מסמנים זרמים (למשל: סינון "ראשי" + "H.265", ואז "בחר הכל"), לוחצים "המשך".
4. בוחרים רק את מה שצריך להשתנות (למשל: קידוד = H.264), לוחצים "תצוגה מקדימה" וקוראים את הרשימה ("ישתנו", "לא ניתן").
5. לוחצים "החל על N זרמים" ומאשרים פעם אחת. "עצור" עוצר אחרי המצלמה הנוכחית; "בטל את מה שנשמר" מבטל את הסבב.

### מגבלות ידועות
- נבדק מול NVR מדומה ושרת מסך מדומה בלבד. לא נכתב שום שינוי למצלמה אמיתית; השינוי המרובה האמיתי הראשון ב־NVR של המעבדה טעון
  אישור של הבעלים.
- ההתנהגות של NVR אמיתי של Hikvision בהחלפת קידוד (למשל רשימת רזולוציות שונה לכל קידוד) נקראת ממסמכי היכולות של ההתקן; המבנה
  המדויק שלהם בקושחת המעבדה עדיין לא אומת.
