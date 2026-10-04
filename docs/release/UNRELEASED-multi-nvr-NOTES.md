# Unreleased - Multi-NVR (CR-024, task K58, target 0.1.163)

Branch `pilot/multi-nvr` (base `main` 0.1.161). Not released; the version is not bumped. Contract: `docs/changes/CR-024-MULTI-NVR.md`.

## English

### What was added
- **Several recorders in one system.** Every recorder has a fixed id (`nvr-1`, `nvr-2`, ... never reused), its own connection (the CR-022
  table, encrypted password), its own state, cameras and declared capabilities.
- **Settings › connections.** One recorder: the familiar NVR connection form plus "הוסף NVR". Two or more: a recorders list (name, type
  and model, state, cameras) with "חיבור" (that recorder's connection form: edit, test, remove), "שם" (rename) and "השבת" / "הפעל".
- **Removal keeps history:** the recorder's secrets are cleared, its cameras are disabled and hidden from every camera list, and
  events, cases, map placements, permissions and the change log stay.
- **The right recorder every time:** every camera operation uses the camera's own recorder; system pages take `recorder_id` (default
  the first recorder). Discovery, the go2rtc stream sync and the alert stream run per recorder; a recorder that is down does not
  affect the others.
- **Screens:** recorder names and a recorder filter in the camera settings table; a recorder filter on the all-cameras wall and in the
  event log; recorder names in camera pickers - only when there are two or more recorders.
- **Safety rules kept:** a multi-camera stream change never mixes recorders; synchronized playback only within one recorder;
  every new route is local-only and its management needs `system.configure`; refusals are audited.

### Bugs fixed on the way
- The camera-offline notification source and the WebRTC hint read only the first recorder; both read each camera's own recorder now.

### How to turn it on and use it
1. Install and restart once (database migration `0055_multi_recorder` runs; additive).
2. הגדרות › חיבורים → "הוסף NVR" → name, type, address, ports, user, password → "בדוק חיבור" → "הוסף".
3. Restart the system when the banner asks. The new recorder's cameras appear after the restart (discovery runs by itself).
4. To filter: the recorder selector appears in מערכת › אבטחה › מצלמות, on the wall and in the event log.
5. To remove a recorder: its row → "חיבור" → "הסר NVR" → type "הסר" → restart.

### Not included (and why)
- Synchronized playback across recorders - not proven on two real recorders (clocks, zones, drift); refused with
  `sync_cross_recorder_unproven`. Needs a lab session with two recorders.
- The Provision-ISR adapter - its API is not available yet; the registration seam (`registry.register_vendor`) is ready and tested
  with a fake vendor.
- A per-recorder permission scope, applying changes without a restart, a per-recorder live budget, the recorder time zone in recording
  search and playback URLs (stored; used by the alert stream).

### Known limits
- Nothing ran against a real recorder; all tests used two fake recorders and mocked screens.

## עברית

### מה נוסף
- **כמה מקליטים במערכת אחת.** לכל מקליט מזהה קבוע (`nvr-1`, `nvr-2`... לא חוזר על עצמו), חיבור משלו (סיסמה מוצפנת), מצב, מצלמות
  ויכולות משלו.
- **הגדרות › חיבורים.** מקליט אחד: טופס החיבור המוכר ועוד "הוסף NVR". שניים ומעלה: רשימת מקליטים (שם, סוג ודגם, מצב, מצלמות) עם
  "חיבור" (עריכה, בדיקה, הסרה), "שם" ו"השבת" / "הפעל".
- **הסרה שומרת היסטוריה:** פרטי הגישה נמחקים, המצלמות מושבתות ולא מוצגות; אירועים, תיקים, מיקומים במפה, הרשאות ויומן השינויים נשארים.
- **תמיד המקליט הנכון:** כל פעולה על מצלמה הולכת למקליט שלה; גילוי מצלמות, זרמי go2rtc וזרם האירועים לכל מקליט בנפרד; מקליט שלא
  עונה לא משפיע על האחרים.
- **מסכים:** שם המקליט וסינון בטבלת הגדרות המצלמות; סינון לפי מקליט בקיר המצלמות וביומן האירועים; שם המקליט בבוררי מצלמות - רק כשיש
  שניים ומעלה.
- **כללי בטיחות:** שינוי מרובה לא מערבב מקליטים; ניגון מסונכרן רק בתוך מקליט אחד; הניהול דורש הרשאת מנהל מערכת והוא מקומי בלבד.

### באגים שתוקנו בדרך
- מקור ההתראות "מצלמה מנותקת" ורמז ה־WebRTC קראו רק את המקליט הראשון; עכשיו כל מצלמה לפי המקליט שלה.

### איך מפעילים
1. מתקינים ומפעילים מחדש פעם אחת (מיגרציה `0055_multi_recorder`).
2. הגדרות › חיבורים ← "הוסף NVR" ← שם, סוג, כתובת, פורטים, משתמש, סיסמה ← "בדוק חיבור" ← "הוסף".
3. מפעילים מחדש כשהבאנר מבקש. המצלמות של המקליט החדש מופיעות אחרי ההפעלה מחדש.
4. סינון: בורר המקליט מופיע במערכת › אבטחה › מצלמות, בקיר וביומן האירועים.
5. הסרה: השורה של המקליט ← "חיבור" ← "הסר NVR" ← מקלידים "הסר" ← הפעלה מחדש.

### מה לא נכלל ולמה
- ניגון מסונכרן בין מקליטים - לא הוכח על שני מקליטים אמיתיים; צריך מפגש מעבדה עם שני מקליטים.
- מתאם Provision-ISR - ה־API שלו עוד לא זמין; נקודת החיבור מוכנה ונבדקה עם ספק מדומה.
- הרשאה בהיקף מקליט, החלה בלי הפעלה מחדש, תקציב צפייה חיה לכל מקליט, אזור זמן נפרד למקליט בחיפוש הקלטות ובניגון.

### מגבלות
- שום דבר לא הורץ מול מקליט אמיתי; כל הבדיקות עם שני מקליטים מדומים ומסכים עם שרת מדומה.
