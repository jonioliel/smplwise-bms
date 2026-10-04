# Release notes draft — schedules: more actions (not released)

Draft lines for the next release round (bridge 0.6.1: one restart of the platform). Branch `pilot/schedules-more-actions`.

## English — Schedules: scripts (alarm scripts included) and every action the integration really offers
**After installing, restart the platform once:** the bridge integration moves to 0.6.1 (its schedule allow-list grows; Home Assistant loads it on restart). Until then the new actions are refused with "נדרש עדכון של רכיב החיבור" and everything else works as before. No database migration; the new settings `schedules.allow_disarm` and `schedules.acks` are created on first use. Reload the installed web app once.
### Scripts and more actions in schedules
- **Scripts are first-class actions:** pick a script by its name and area, fill its variables (the fields the script declares: number, yes / no, a list, text), run it now, copy, split and restore it like any schedule. An alarm script is an ordinary script, with the same rights as running it by hand (an alarm script that disarms needs the disarm permission at that panel, the sensitive-schedules permission and the explicit confirmation).
- A schedule made in the platform that calls a script as its own service is now shown as a script action (name, area, variables), editable; the "content the system does not display fully" mode remains only for content Arx truly cannot model.
- **New actions:** scenes, helpers (on / off, a number, a list option), humidifiers (humidity, mode), vacuums (start, return to base), cover tilt (open / close) and climate swing and humidity.
- **Only what the device really supports:** the action list and the value ranges come from each device's own capabilities (feature bits, modes, options, min / max); an action the device does not report is never offered, and the server refuses it.
- **An action that is no longer valid** (its device was removed or lost the capability) is shown on the card ("פעולה לא תקפה") and in the schedule, "run now" is refused with the reason, a run the platform fires anyway is recorded at once as not confirmed and the administrators are told, and the schedule stays editable so it can be fixed.
### Alarm safety
- **Disarming is no longer schedulable by default.** A system administrator may allow it in הגדרות › תזמונים › "נטרול אזעקה בתזמונים" by typing "אפשר נטרול"; every change of this setting is audited. A disarm that needs a code is never schedulable, whatever the setting. An existing disarm schedule is kept as it is (with a warning); copying it is a new disarm.
### Review: "אשר כתקין"
- In the schedules review list a system administrator can mark "תזמון רגיש שנוצר מחוץ למערכת" and "תוכן שהמערכת אינה מציגה במלואו" as fine from our side: the chip becomes a muted "אושר" (with "בטל אישור"), the "needs review" count drops, and the warning returns by itself when the schedule's content changes. The acknowledgement never changes the schedule; both directions are audited (who, when).
### How to turn it on and use it (English)
1. Install the update, restart the platform once (bridge 0.6.1), reload the installed web app.
2. הגדרות › תזמונים › "סוגי התקנים מותרים בתזמון": scripts, scenes, helpers, humidifiers and vacuums are on (an installation that had every class on keeps every class on); switch off what you do not want scheduled.
3. In a schedule's editor: "בחירת התקנים" lists the new devices; in the slot panel choose the action and, for a script, fill "משתני הסקריפט".
4. Only if you want scheduled disarming: הגדרות › תזמונים › "נטרול אזעקה בתזמונים" → type "אפשר נטרול" (system administrator).
5. Review: תזמונים › "לבדיקה" → "אשר כתקין" beside a warning; "בטל אישור" restores it.
### Known limits
- Tested against the fake scheduler and the fake bridge only; not run against a real installation or a real alarm.
- A script's variables of kinds the schedules do not model (device / area pickers, templates) are not offered; a required one makes the script unschedulable with the reason. A script whose content Arx cannot read is treated as sensitive and runs without variables.
- Not added on purpose: sirens, media players, `number` / `select` entities, notifications.

## עברית — תזמונים: סקריפטים (כולל סקריפטי אזעקה) וכל פעולה שהאינטגרציה באמת מציעה
**אחרי ההתקנה יש להפעיל מחדש את התשתית פעם אחת:** הגשר עולה ל-0.6.1 (רשימת הפעולות המותרות בתזמונים גדלה; התשתית טוענת אותה בהפעלה מחדש). עד אז הפעולות החדשות נדחות עם "נדרש עדכון של רכיב החיבור" וכל השאר עובד כרגיל. אין מיגרציית מסד נתונים; ההגדרות החדשות `schedules.allow_disarm` ו-`schedules.acks` נוצרות בשימוש הראשון. יש לטעון מחדש את אפליקציית הרשת המותקנת פעם אחת.
### סקריפטים ופעולות נוספות בתזמונים
- **סקריפט הוא פעולה מלאה:** בוחרים סקריפט לפי שמו ואזורו, ממלאים את המשתנים שלו (השדות שהסקריפט מגדיר: מספר, כן / לא, רשימה, טקסט), מריצים עכשיו, מעתיקים, מפצלים ומשחזרים כמו כל תזמון. סקריפט אזעקה הוא סקריפט רגיל, עם אותן הרשאות כמו הפעלה ידנית (סקריפט שמנטרל אזעקה דורש הרשאת נטרול בלוח הזה, הרשאה לתזמון פעולות רגישות ואישור מפורש).
- תזמון שנוצר בתשתית וקורא לסקריפט כשירות משלו מוצג עכשיו כפעולת סקריפט (שם, אזור, משתנים) וניתן לעריכה; מצב "התזמון כולל תוכן שהמערכת אינה מציגה במלואו" נשאר רק לתוכן שהמערכת באמת אינה יודעת לייצג.
- **פעולות חדשות:** סצנות, מתגי עזר (הפעלה / כיבוי, ערך מספרי, בחירה מרשימה), מכשירי לחות (לחות, מצב), שואבים רובוטיים (התחלת ניקוי, חזרה לעמדה), הטיית תריסים (פתיחה / סגירה), ומצב נדנוד ולחות במזגנים.
- **רק מה שההתקן באמת תומך בו:** רשימת הפעולות וטווחי הערכים נקבעים לפי היכולות שכל התקן מדווח (סיביות יכולת, מצבים, אפשרויות, מינימום / מקסימום); פעולה שההתקן אינו מדווח לא מוצעת, והשרת דוחה אותה.
- **פעולה שאינה תקפה עוד** (ההתקן הוסר או איבד את היכולת) מסומנת בכרטיס ("פעולה לא תקפה") ובתזמון, "הרץ עכשיו" נדחה עם הסיבה, ריצה שהתשתית מפעילה בכל זאת נרשמת מיד כ"לא אושרה" והמנהלים מקבלים התראה, והתזמון נשאר ניתן לעריכה כדי לתקן.
### בטיחות אזעקה
- **נטרול אזעקה כבר אינו ניתן לתזמון כברירת מחדל.** מנהל מערכת יכול לאפשר זאת בהגדרות › תזמונים › "נטרול אזעקה בתזמונים" בהקלדת "אפשר נטרול"; כל שינוי של ההגדרה נרשם ביומן. נטרול שדורש קוד לעולם אינו ניתן לתזמון, בלי קשר להגדרה. תזמון נטרול קיים נשמר כפי שהוא (עם אזהרה); העתקה שלו היא נטרול חדש.
### בדיקה: "אשר כתקין"
- ברשימת התזמונים לבדיקה מנהל מערכת יכול לסמן "תזמון רגיש שנוצר מחוץ למערכת" ו"תוכן שהמערכת אינה מציגה במלואו" כתקינים מבחינתנו: השבב הופך ל"אושר" שקט (עם "בטל אישור"), מונה "דורשים בדיקה" יורד, והאזהרה חוזרת מעצמה כשתוכן התזמון משתנה. האישור אינו משנה את התזמון; שני הכיוונים נרשמים ביומן (מי ומתי).
### איך מפעילים ומשתמשים (עברית)
1. מתקינים את העדכון, מפעילים מחדש את התשתית פעם אחת (גשר 0.6.1) וטוענים מחדש את אפליקציית הרשת.
2. הגדרות › תזמונים › "סוגי התקנים מותרים בתזמון": סקריפטים, סצנות, מתגי עזר, מכשירי לחות ושואבים פעילים (התקנה שבה כל הסוגים היו פעילים נשארת כך); מכבים את מה שלא רוצים לתזמן.
3. בעורך התזמון: "בחירת התקנים" מציג את ההתקנים החדשים; בחלונית המשבצת בוחרים פעולה, ולסקריפט ממלאים "משתני הסקריפט".
4. רק אם רוצים נטרול מתוזמן: הגדרות › תזמונים › "נטרול אזעקה בתזמונים" ← מקלידים "אפשר נטרול" (מנהל מערכת).
5. בדיקה: תזמונים › "לבדיקה" ← "אשר כתקין" ליד האזהרה; "בטל אישור" מחזיר אותה.
### מגבלות ידועות
- נבדק מול רכיב תזמונים מדומה וגשר מדומה בלבד; לא הורץ מול התקנה אמיתית או אזעקה אמיתית.
- משתני סקריפט מסוגים שהתזמונים אינם מייצגים (בחירת התקן / אזור, תבניות) אינם מוצעים; משתנה חובה מסוג כזה הופך את הסקריפט לבלתי ניתן לתזמון, עם הסיבה. סקריפט שהמערכת אינה יכולה לקרוא את תוכנו נחשב רגיש ורץ בלי משתנים.
- לא נוספו בכוונה: צופרים, נגני מדיה, ישויות `number` / `select`, התראות.

