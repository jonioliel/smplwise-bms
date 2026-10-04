# Release notes draft — schedules: more actions (not released)

> Integration note (integ/0163): 0.1.162 already shipped the first part of this draft (scripts, scenes, helpers, humidifiers, vacuums, tilt, swing / humidity, review acknowledgement). For 0.1.163 only the owner-decision delta is new: sirens, media players, number / select values, the script mark, and scheduled disarming allowed by default (restrictable). Trim before release. See the `## Unreleased` entry at the head of `smplwise_vms/CHANGELOG.md`.

Draft lines for the next release round (bridge 0.6.1: one restart of the platform). Branches `pilot/schedules-more-actions` and, on top of it, `pilot/schedules-followup` (the owner's decisions of 2026-10-04).

## English — Schedules: scripts (alarm scripts included), sirens, players, values and every action the integration really offers
**After installing, restart the platform once:** the bridge integration moves to 0.6.1 (its schedule allow-list grows; Home Assistant loads it on restart). Until then the new actions are refused with "נדרש עדכון של רכיב החיבור" and everything else works as before. (0.6.1 was not released before; a lab that installed the earlier 0.6.1 build of this branch needs one more restart to get sirens, players, numbers and selects.) No database migration; the settings `schedules.allow_disarm`, `schedules.acks` and `schedules.script_marks` are created on first use. Reload the installed web app once.
### Scripts and more actions in schedules
- **Scripts are first-class actions:** pick a script by its name and area, fill its variables (the fields the script declares: number, yes / no, a list, text), run it now, copy, split and restore it like any schedule, with the same rights as running it by hand.
- **A script that disarms or unlocks needs an administrator's mark:** a script whose steps disarm an alarm, unlock a lock or open a door (an alarm script that disarms included), or whose content Arx cannot read, can be scheduled only after a system administrator marks that script "מותר בתזמונים" in הגדרות › תזמונים › "סקריפטים שמנטרלים או פותחים". The mark records who and when (audited both ways) and is bound to the script's content: when the script changes, the mark lapses by itself, the schedule shows "סקריפט לא מאושר", "run now" is refused and copy / split / restore are refused until the script is marked again. An existing schedule is kept as it is. In the device picker an unmarked script is listed, disabled, with the reason. Ordinary scripts need no mark.
- A schedule made in the platform that calls a script as its own service is now shown as a script action (name, area, variables), editable; the "content the system does not display fully" mode remains only for content Arx truly cannot model.
- **New actions:** scenes, helpers (on / off, a number, a list option), humidifiers (humidity, mode), vacuums (start, return to base), cover tilt (open / close), climate swing and humidity, and now also:
  - **sirens** (a sensitive class, like the alarm: the sensitive-schedules permission and control of the siren itself; on / off, and a tone / duration only when the siren reports it, the tones from its own list);
  - **media players and screens** under the multimedia rules: only a player that is approved and visible in the multimedia settings (not a group), only what it reports (on / off, play / pause / stop, volume, source), the volume never above the device's ceiling (the lower of the ceiling and the night window's), a source the administrator hid is never offered, and the multimedia permissions at the device (power and source need "הדלקה וכיבוי", the rest "שליטה"; a source on a public screen needs "מסכים ציבוריים");
  - **number and select values** from the entity itself (its min / max / step, its options); a device's configuration values are never offered.
- **Only what the device really supports:** the action list and the value ranges come from each device's own capabilities; an action the device does not report is never offered, and the server refuses it.
- **An action that is no longer valid** (its device was removed, lost the capability, or a player is no longer approved in the multimedia settings) is shown on the card ("פעולה לא תקפה") and in the schedule, "run now" is refused with the reason, a run the platform fires anyway is recorded at once as not confirmed and the administrators are told, and the schedule stays editable so it can be fixed.
### Alarm safety
- **Disarming in schedules is allowed, with explicit confirmation** ("נטרול אזעקה בתזמונים: מותר (ניתן להגביל)"): it needs the disarm permission on that panel, the sensitive-schedules permission and the explicit confirmation in the editor; the remote channel refuses it where it refuses manual disarming; a disarm that needs a code is never schedulable; codes are never stored or logged.
- A system administrator may **restrict** it in הגדרות › תזמונים › "נטרול אזעקה בתזמונים" (and lift the restriction again by typing "אפשר נטרול"); every change is audited. While restricted, an existing disarm schedule is kept as it is (with a warning) and a copy of it is refused.
### Review: "אשר כתקין"
- In the schedules review list a system administrator can mark "תזמון רגיש שנוצר מחוץ למערכת" and "תוכן שהמערכת אינה מציגה במלואו" as fine from our side: the chip becomes a muted "אושר" (with "בטל אישור"), the "needs review" count drops, and the warning returns by itself when the schedule's content changes (also after an edit made in Arx). The acknowledgement never changes the schedule; both directions are audited (who, when).
### How to turn it on and use it (English)
1. Install the update, restart the platform once (bridge 0.6.1), reload the installed web app.
2. הגדרות › תזמונים › "סוגי התקנים מותרים בתזמון": scripts, scenes, helpers, humidifiers, vacuums, sirens, players and screens, numbers and selects are on (an installation that had every class on keeps every class on); switch off what you do not want scheduled.
3. הגדרות › תזמונים › "סקריפטים שמנטרלים או פותחים": switch on "מותר בתזמונים" for each such script you want to schedule (system administrator).
4. In a schedule's editor: "בחירת התקנים" lists the new devices; in the slot panel choose the action and its value (a script's variables, a siren's tone, a player's volume or source, a number, an option).
5. To restrict scheduled disarming: הגדרות › תזמונים › "נטרול אזעקה בתזמונים" → off (system administrator); on again needs the typed "אפשר נטרול".
6. Review: תזמונים › "לבדיקה" → "אשר כתקין" beside a warning; "בטל אישור" restores it.
### Known limits
- Tested against the fake scheduler and the fake bridge only; not run against a real installation, a real alarm, a real siren or a real player.
- A script's variables of kinds the schedules do not model (device / area pickers, templates) are not offered; a required one makes the script unschedulable with the reason. A script whose content Arx cannot read is treated as sensitive, needs the administrator's mark and runs without variables; its mark cannot lapse on a change Arx cannot see.
- A media player's volume is checked against the ceiling when the schedule is saved; a ceiling lowered later does not change a saved schedule (the platform runs it as saved).
- Not added on purpose: notifications, `automation.*`, media groups, remote keys, anything with free-form data.

## עברית — תזמונים: סקריפטים (כולל סקריפטי אזעקה), צופרים, נגנים, ערכים וכל פעולה שהאינטגרציה באמת מציעה
**אחרי ההתקנה יש להפעיל מחדש את התשתית פעם אחת:** הגשר עולה ל-0.6.1 (רשימת הפעולות המותרות בתזמונים גדלה; התשתית טוענת אותה בהפעלה מחדש). עד אז הפעולות החדשות נדחות עם "נדרש עדכון של רכיב החיבור" וכל השאר עובד כרגיל. (0.6.1 לא שוחרר קודם; מעבדה שהתקינה את גרסת 0.6.1 המוקדמת של הענף צריכה הפעלה מחדש נוספת כדי לקבל צופרים, נגנים, ערכים ובחירות.) אין מיגרציית מסד נתונים; ההגדרות `schedules.allow_disarm`, `schedules.acks` ו-`schedules.script_marks` נוצרות בשימוש הראשון. יש לטעון מחדש את אפליקציית הרשת המותקנת פעם אחת.
### סקריפטים ופעולות נוספות בתזמונים
- **סקריפט הוא פעולה מלאה:** בוחרים סקריפט לפי שמו ואזורו, ממלאים את המשתנים שלו (השדות שהסקריפט מגדיר: מספר, כן / לא, רשימה, טקסט), מריצים עכשיו, מעתיקים, מפצלים ומשחזרים כמו כל תזמון, עם אותן הרשאות כמו הפעלה ידנית.
- **סקריפט שמנטרל או פותח דורש סימון של מנהל מערכת:** סקריפט שאחד מצעדיו מנטרל אזעקה, פותח מנעול או פותח דלת (כולל סקריפט אזעקה שמנטרל), או שהמערכת אינה יכולה לקרוא את תוכנו, ניתן לתזמון רק אחרי שמנהל מערכת סימן אותו "מותר בתזמונים" בהגדרות › תזמונים › "סקריפטים שמנטרלים או פותחים". הסימון שומר מי ומתי (נרשם ביומן בשני הכיוונים) וקשור לתוכן הסקריפט: כשהסקריפט משתנה הסימון בטל מעצמו, התזמון מציג "סקריפט לא מאושר", "הרץ עכשיו" נדחה, והעתקה / פיצול / שחזור נדחים עד שמסמנים שוב. תזמון קיים נשמר כפי שהוא. בבחירת ההתקנים סקריפט לא מסומן מוצג, מושבת, עם הסיבה. סקריפט רגיל אינו צריך סימון.
- תזמון שנוצר בתשתית וקורא לסקריפט כשירות משלו מוצג עכשיו כפעולת סקריפט (שם, אזור, משתנים) וניתן לעריכה; מצב "התזמון כולל תוכן שהמערכת אינה מציגה במלואו" נשאר רק לתוכן שהמערכת באמת אינה יודעת לייצג.
- **פעולות חדשות:** סצנות, מתגי עזר (הפעלה / כיבוי, ערך מספרי, בחירה מרשימה), מכשירי לחות (לחות, מצב), שואבים רובוטיים (התחלת ניקוי, חזרה לעמדה), הטיית תריסים (פתיחה / סגירה), מצב נדנוד ולחות במזגנים, ועכשיו גם:
  - **צופרים** (סוג רגיש, כמו האזעקה: הרשאה לתזמון פעולות רגישות ושליטה בצופר עצמו; הפעלה / כיבוי, וצליל / משך רק כשהצופר מדווח עליהם, הצלילים מהרשימה שלו);
  - **נגנים ומסכים** לפי כללי המולטימדיה: רק נגן מאושר וגלוי בהגדרות המולטימדיה (לא קבוצה), רק מה שהוא מדווח (הדלקה / כיבוי, ניגון / השהיה / עצירה, עוצמה, מקור), העוצמה לעולם לא מעל התקרה של ההתקן (הנמוכה מבין התקרה ותקרת הלילה), מקור שהמנהל הסתיר לא מוצע, והרשאות המולטימדיה בהתקן (הדלקה, כיבוי ומקור דורשים "הדלקה וכיבוי", השאר "שליטה"; מקור במסך ציבורי דורש "מסכים ציבוריים");
  - **ערכים מספריים ובחירות** לפי ההתקן עצמו (מינימום / מקסימום / קפיצה, האפשרויות שלו); ערכי הגדרה של התקנים לא מוצעים.
- **רק מה שההתקן באמת תומך בו:** רשימת הפעולות וטווחי הערכים נקבעים לפי היכולות שכל התקן מדווח; פעולה שההתקן אינו מדווח לא מוצעת, והשרת דוחה אותה.
- **פעולה שאינה תקפה עוד** (ההתקן הוסר, איבד את היכולת, או נגן שאינו מאושר עוד בהגדרות המולטימדיה) מסומנת בכרטיס ("פעולה לא תקפה") ובתזמון, "הרץ עכשיו" נדחה עם הסיבה, ריצה שהתשתית מפעילה בכל זאת נרשמת מיד כ"לא אושרה" והמנהלים מקבלים התראה, והתזמון נשאר ניתן לעריכה כדי לתקן.
### בטיחות אזעקה
- **נטרול אזעקה בתזמונים מותר, עם אישור מפורש** ("נטרול אזעקה בתזמונים: מותר (ניתן להגביל)"): נדרשות הרשאת נטרול בלוח הזה, הרשאה לתזמון פעולות רגישות ואישור מפורש בעורך; הערוץ המרוחק דוחה אותו כשהוא דוחה נטרול ידני; נטרול שדורש קוד לעולם אינו ניתן לתזמון; קודים לעולם אינם נשמרים ואינם נרשמים.
- מנהל מערכת יכול **להגביל** זאת בהגדרות › תזמונים › "נטרול אזעקה בתזמונים" (ולהסיר את ההגבלה בהקלדת "אפשר נטרול"); כל שינוי נרשם ביומן. כל עוד יש הגבלה, תזמון נטרול קיים נשמר כפי שהוא (עם אזהרה) והעתקה שלו נדחית.
### בדיקה: "אשר כתקין"
- ברשימת התזמונים לבדיקה מנהל מערכת יכול לסמן "תזמון רגיש שנוצר מחוץ למערכת" ו"תוכן שהמערכת אינה מציגה במלואו" כתקינים מבחינתנו: השבב הופך ל"אושר" שקט (עם "בטל אישור"), מונה "דורשים בדיקה" יורד, והאזהרה חוזרת מעצמה כשתוכן התזמון משתנה (גם אחרי עריכה במערכת). האישור אינו משנה את התזמון; שני הכיוונים נרשמים ביומן (מי ומתי).
### איך מפעילים ומשתמשים (עברית)
1. מתקינים את העדכון, מפעילים מחדש את התשתית פעם אחת (גשר 0.6.1) וטוענים מחדש את אפליקציית הרשת.
2. הגדרות › תזמונים › "סוגי התקנים מותרים בתזמון": סקריפטים, סצנות, מתגי עזר, מכשירי לחות, שואבים, צופרים, נגנים ומסכים, ערכים מספריים ובחירות פעילים (התקנה שבה כל הסוגים היו פעילים נשארת כך); מכבים את מה שלא רוצים לתזמן.
3. הגדרות › תזמונים › "סקריפטים שמנטרלים או פותחים": מפעילים "מותר בתזמונים" לכל סקריפט כזה שרוצים לתזמן (מנהל מערכת).
4. בעורך התזמון: "בחירת התקנים" מציג את ההתקנים החדשים; בחלונית המשבצת בוחרים פעולה וערך (משתני סקריפט, צליל של צופר, עוצמה או מקור של נגן, מספר, אפשרות).
5. להגבלת נטרול מתוזמן: הגדרות › תזמונים › "נטרול אזעקה בתזמונים" ← כיבוי (מנהל מערכת); הדלקה מחדש דורשת להקליד "אפשר נטרול".
6. בדיקה: תזמונים › "לבדיקה" ← "אשר כתקין" ליד האזהרה; "בטל אישור" מחזיר אותה.
### מגבלות ידועות
- נבדק מול רכיב תזמונים מדומה וגשר מדומה בלבד; לא הורץ מול התקנה אמיתית, אזעקה, צופר או נגן אמיתיים.
- משתני סקריפט מסוגים שהתזמונים אינם מייצגים (בחירת התקן / אזור, תבניות) אינם מוצעים; משתנה חובה מסוג כזה הופך את הסקריפט לבלתי ניתן לתזמון, עם הסיבה. סקריפט שהמערכת אינה יכולה לקרוא את תוכנו נחשב רגיש, דורש סימון של מנהל ורץ בלי משתנים; הסימון שלו אינו בטל בשינוי שהמערכת אינה רואה.
- עוצמת נגן נבדקת מול התקרה בשמירת התזמון; תקרה שהונמכה אחר כך אינה משנה תזמון שמור (התשתית מריצה אותו כפי שנשמר).
- לא נוספו בכוונה: התראות, `automation.*`, קבוצות מדיה, מקשי שלט, כל דבר עם נתונים חופשיים.
