# CR-019 release notes (draft for the release manager)

Not part of `CHANGELOG.md` - copy into it when the release is cut. Branch `pilot/cr019-complete`; no version bump was made here.

## English

### Added
- **Protected switches.** Group actions ("turn everything off" for a floor, an area, the building and the main button on the overview) now include every switch unless an administrator protected it. A protected switch is left out of group actions only; it can still be controlled one by one, by schedules and by automations.
- **Automatic protection.** Switches that look sensitive (pumps and boilers, heating and cooking, gates and doors, fridges, servers and routers, alarm and cameras, pool, irrigation, elevator, charging and energy, system infrastructure) are protected the moment they appear and wait for the administrator's review.
- **Settings > Electricity and devices > "מתגים מוגנים"** (replaces "פעולה קבוצתית"): a review strip for automatic protections ("approve all"), filters, multi-select with Shift ranges, and approve / protect / remove protection, each with one confirmation (removing protection names the consequence).
- Project backups now include the protection tables; restoring an older backup that lacks them keeps the current protections.

### Changed
- Switches are schedulable whatever their protection; the "switch not marked" refusal is gone from schedules.
- The overview master button for switches is enabled by default; when every shown switch is protected it is disabled and the tooltip says so.
- API: `/devices/bulk-safe` routes are replaced by `/devices/bulk-protected` (old paths answer 404); area and item rows carry `bulk_protected` / `bulk_reason` and `can_mark_bulk_protected`; group-action exclusions read `switch_protected` / `switch_unclassified`.

### Upgrade
- Migration `0049_switch_protection.sql`. Switches that were approved before stay unprotected; switches never approved are unprotected unless the classifier flags them. `device_bulk_safe` is kept untouched, so reinstalling the previous version restores the old opt-in marks.
- After the upgrade open Settings > Electricity and devices > "מתגים מוגנים" once and approve or adjust the automatic protections.

### How to enable
Nothing to enable: the model is on from the upgrade. Review the list once as an administrator (`system.configure`).

## עברית

### נוסף
- **מתגים מוגנים.** פעולות קבוצתיות ("כבה הכל" לקומה, לאזור, למבנה ולכפתור הראשי) כוללות עכשיו כל מתג, אלא אם מנהל המערכת הגן עליו. מתג מוגן לא נכלל רק בפעולות קבוצתיות; אפשר עדיין להפעיל אותו לבד, בתזמון ובאוטומציה.
- **הגנה אוטומטית.** מתגים שנראים רגישים (משאבות ודודים, חימום ובישול, שערים ודלתות, מקררים, שרתים וראוטרים, אזעקה ומצלמות, בריכה, השקיה, מעלית, טעינה ואנרגיה, תשתית המערכת) מוגנים מיד כשהם מופיעים וממתינים לבדיקת מנהל המערכת.
- **הגדרות › חשמל והתקנים › "מתגים מוגנים"** (במקום "פעולה קבוצתית"): סרגל בדיקה לסימונים אוטומטיים ("אשר את כולם"), סינון, בחירה מרובה עם טווח ב-Shift, ואישור / הגנה / הסרת הגנה - כל אחד עם אישור אחד ("הסר הגנה" מציין את ההשלכה).
- גיבוי הפרויקט כולל עכשיו את טבלאות ההגנה; שחזור מגיבוי ישן שאין בו אותן משאיר את ההגנות הקיימות.

### השתנה
- מתג ניתן לתזמון בלי קשר להגנה; הסירוב "המתג לא סומן" בתזמונים הוסר.
- הכפתור הראשי של המתגים במסך הסקירה פעיל כברירת מחדל; כשכל המתגים שמוצגים מוגנים הוא לא פעיל והריחוף מסביר זאת.
- API: נתיבי `/devices/bulk-safe` הוחלפו ב-`/devices/bulk-protected` (הנתיבים הישנים מחזירים 404).

### שדרוג
- מיגרציה `0049_switch_protection.sql`. מתגים שאושרו בעבר נשארים לא מוגנים; מתגים שלא אושרו אף פעם לא מוגנים, אלא אם הסיווג מסמן אותם. הרשימה הישנה (`device_bulk_safe`) נשמרת, כך שחזרה לגרסה הקודמת מחזירה את הסימונים הישנים.
- אחרי השדרוג יש להיכנס פעם אחת להגדרות › חשמל והתקנים › "מתגים מוגנים" ולאשר או לתקן את הסימונים האוטומטיים.

### איך מפעילים
אין מה להפעיל: המודל פעיל מרגע השדרוג. מנהל מערכת (`system.configure`) עובר על הרשימה פעם אחת.
