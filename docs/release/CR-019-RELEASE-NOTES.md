# CR-019 release notes (draft for the release manager)

Not part of `CHANGELOG.md` - copy into it when the release is cut. Branch `pilot/cr019-complete`; no version bump was made here.

## English

### Added
- **Protected switches.** Group actions ("turn everything off" for a floor, an area, the building and the main button on the overview) now include every switch unless an administrator protected it. A protected switch is left out of group actions only; it can still be controlled one by one, by schedules and by automations.
- **Suggestions, not automatic protection.** Switches that look sensitive (pumps and boilers, heating and cooking, gates and doors, fridges, servers and routers, alarm and cameras, pool, irrigation, elevator, charging and energy, system infrastructure) are listed as "suggested for protection". A suggestion is NOT enforced: the switch stays in group actions until an administrator approves it. This is the owner's decision (2026-10-02): the default for every switch, including new ones, is included; only an explicit protection excludes it.
- **Settings > Electricity and devices > "מתגים מוגנים"** (replaces "פעולה קבוצתית"): a strip for the suggestions ("protect all"), filters, multi-select with Shift ranges, and protect / remove protection / dismiss a suggestion, each with one confirmation (removing protection names the consequence).
- Project backups now include the protection tables; restoring an older backup that lacks them keeps the current protections.

### Changed
- Switches are schedulable whatever their protection; the "switch not marked" refusal is gone from schedules.
- The overview master button for switches is enabled by default; when every shown switch is protected it is disabled and the tooltip says so.
- API: `/devices/bulk-safe` routes are replaced by `/devices/bulk-protected` (old paths answer 404); area and item rows carry `bulk_protected` / `bulk_reason` and `can_mark_bulk_protected`; group-action exclusions read `switch_protected` (a switch the classifier has not judged is included; there is no `unclassified` reason, and `bulk_reason` is `allowed | protected | doors_layer | alarm_managed`).

### Upgrade
- Migration `0049_switch_protection.sql`. Every switch is included in group actions after the upgrade (those approved before stay unprotected; the classifier only adds suggestions). `device_bulk_safe` is kept untouched, so reinstalling the previous version restores the old opt-in marks.
- **Important:** right after the upgrade "turn everything off" reaches every switch, including pumps, boilers and routers. Open Settings > Electricity and devices > "מתגים מוגנים" once and protect what must stay out (start from the suggestions).

### How to enable
Nothing to enable: the model is on from the upgrade. Review the suggestions once as an administrator (`system.configure`).

## עברית

### נוסף
- **מתגים מוגנים.** פעולות קבוצתיות ("כבה הכל" לקומה, לאזור, למבנה ולכפתור הראשי) כוללות עכשיו כל מתג, אלא אם מנהל המערכת הגן עליו. מתג מוגן לא נכלל רק בפעולות קבוצתיות; אפשר עדיין להפעיל אותו לבד, בתזמון ובאוטומציה.
- **הצעות, לא הגנה אוטומטית.** מתגים שנראים רגישים (משאבות ודודים, חימום ובישול, שערים ודלתות, מקררים, שרתים וראוטרים, אזעקה ומצלמות, בריכה, השקיה, מעלית, טעינה ואנרגיה, תשתית המערכת) מופיעים כ"מוצע להגנה". הצעה אינה נאכפת: המתג נשאר בפעולות הקבוצתיות עד שמנהל המערכת מאשר. זו החלטת הבעלים (2.10.2026): ברירת המחדל של כל מתג, גם חדש, היא נכלל; רק הגנה מפורשת מוציאה אותו.
- **הגדרות › חשמל והתקנים › "מתגים מוגנים"** (במקום "פעולה קבוצתית"): סרגל הצעות ("הגן על כולם"), סינון, בחירה מרובה עם טווח ב-Shift, והגנה / הסרת הגנה / דחיית הצעה - כל אחד עם אישור אחד ("הסר הגנה" מציין את ההשלכה).
- גיבוי הפרויקט כולל עכשיו את טבלאות ההגנה; שחזור מגיבוי ישן שאין בו אותן משאיר את ההגנות הקיימות.

### השתנה
- מתג ניתן לתזמון בלי קשר להגנה; הסירוב "המתג לא סומן" בתזמונים הוסר.
- הכפתור הראשי של המתגים במסך הסקירה פעיל כברירת מחדל; כשכל המתגים שמוצגים מוגנים הוא לא פעיל והריחוף מסביר זאת.
- API: נתיבי `/devices/bulk-safe` הוחלפו ב-`/devices/bulk-protected` (הנתיבים הישנים מחזירים 404).

### שדרוג
- מיגרציה `0049_switch_protection.sql`. אחרי השדרוג כל המתגים נכללים בפעולות קבוצתיות (גם אלה שאושרו בעבר נשארים לא מוגנים; הסיווג רק מוסיף הצעות). הרשימה הישנה (`device_bulk_safe`) נשמרת, כך שחזרה לגרסה הקודמת מחזירה את הסימונים הישנים.
- **חשוב:** מיד אחרי השדרוג "כבה הכל" מגיע לכל מתג, כולל משאבות, דודים וראוטרים. יש להיכנס פעם אחת להגדרות › חשמל והתקנים › "מתגים מוגנים" ולהגן על מה שצריך להישאר בחוץ (אפשר להתחיל מההצעות).

### איך מפעילים
אין מה להפעיל: המודל פעיל מרגע השדרוג. מנהל מערכת (`system.configure`) עובר על ההצעות פעם אחת.
