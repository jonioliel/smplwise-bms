# SmplWise Arx (Unreleased) - Release notes draft / טיוטת הערות שחרור

Source of truth for the text below: smplwise_vms/CHANGELOG.md, section "Unreleased". Draft for the next release round; no version number yet.

## The capsule dropdown style and a size dial for every dropdown
**No restart and no database migration.** The new settings `ui.dd_size`, `ui.dd_ring`, `ui.dd_panel` and their `_groups` twins (and the same keys in the personal preferences) are created on first save. Reload the installed web app once. Nothing changes until a style or a size is chosen.

### What was added
- **Capsule (קפסולה)**, a new dropdown style: closed, a capsule with a blue ring, a white-to-lavender fill, a soft bottom shadow, an icon at the start, a confident label and a small chevron at the end (turns up while open); open, a floating rounded translucent panel with the chosen row tinted in the accent colour, an icon at the start and a count at the other end of every row, a thin divider after "all", generous rows. Four looks, light and dark, ten palettes, the radius / touch / performance dials, RTL, phone bottom sheet, keyboard and screen reader as before.
- **Size: קטן / רגיל / גדול** for every dropdown (trigger, font, icon, row height, panel padding); "רגיל" is the reference size and today's size of every other style. For all groups or per group, installation default and a personal choice, with a live preview.
- The area chip of the devices screens and the rooms chips of the multimedia pages supply icons and counts (shown in the capsule style).
- **Capsule polish:** the existing style "pill" is now labelled **"כדור מלא"** (label only; id and behaviour unchanged). Two new settings for the capsule style only: **ring thickness** 1 / 1.5 / 2 / 3 px (default 2; very thin rings only show on retina screens) and **open-panel width** "as wide as the button" / 240 / 300 px (default 240 at the regular size, scaled by the size dial). All groups or per group, installation default and a personal choice, a reset for each, a live preview.

### Bugs fixed
- None in this change.

### How to turn it on
1. Reload the installed web app once.
2. הגדרות › לשוניות › "סגנון תפריט נפתח" › style: **קפסולה** (all groups or one group); size: "גודל התפריט הנפתח" › קטן / רגיל / גדול. A group shows a dropdown only when its "תצוגת לשוניות" mode is "תפריטים נפתחים" or "משולב".
3. "ההעדפה שלי" changes it for you only; "ברירת המחדל של ההתקנה" (system administrator) for everyone.
4. Ring and panel: the same card › "עובי הטבעת (סגנון קפסולה)" and "רוחב התפריט הפתוח (סגנון קפסולה)".

### Known limits
- The hand-built floor menus ("כל הקומות") of the multimedia players and screens pages are not this component and are not restyled.
- The existing style "pill" (now shown as "כדור מלא") is a different look; none of the existing styles matches the capsule.
- Ring thickness and panel width apply to the capsule style only; the other styles ignore them.

## עברית: סגנון "קפסולה" לתפריט נפתח וחוגת גודל לכל תפריט נפתח
**ללא הפעלה מחדש וללא מיגרציית מסד נתונים.** ההגדרות החדשות `ui.dd_size`, `ui.dd_ring`, `ui.dd_panel` ותאומותיהן `_groups` (ואותם מפתחות בהעדפות האישיות) נוצרות בשמירה הראשונה. יש לטעון מחדש את אפליקציית הרשת פעם אחת. שום דבר לא משתנה עד שבוחרים סגנון או גודל.

### מה נוסף
- **קפסולה**, סגנון חדש לתפריט נפתח: סגור - קפסולה עם טבעת כחולה, מילוי רך מלבן ללבנדר, צל עדין בתחתית, סמל בהתחלה, תווית בטוחה וחץ קטן בצד הנגדי (מצביע למעלה כשפתוח); פתוח - לוח צף, מעוגל ושקוף למחצה, השורה הנבחרת בגוון ההדגשה, סמל בהתחלה ומספר בצד השני בכל שורה, קו מפריד דק אחרי "הכל", שורות נוחות. ארבעה מראות, בהיר וכהה, עשר פלטות, חוגות הפינות / המגע / הביצועים, ימין לשמאל, גיליון תחתון בטלפון, מקלדת וקוראי מסך כמו קודם.
- **גודל: קטן / רגיל / גדול** לכל תפריט נפתח (כפתור, גופן, סמל, גובה שורה, מרווח הלוח); "רגיל" הוא גודל ההפניה והגודל הנוכחי של כל סגנון אחר. לכל הקבוצות או לכל קבוצה, ברירת מחדל להתקנה ובחירה אישית, עם תצוגה מקדימה חיה.
- כפתור האזורים במסכי ההתקנים וכפתורי החדרים בדפי המולטימדיה מספקים סמלים ומספרים (מוצגים בסגנון הקפסולה).
- **ליטוש הקפסולה:** הסגנון הקיים "pill" נקרא עכשיו **"כדור מלא"** (התווית בלבד; המזהה וההתנהגות ללא שינוי). שתי הגדרות חדשות לסגנון הקפסולה בלבד: **עובי הטבעת** 1 / 1.5 / 2 / 3 פיקסלים (ברירת מחדל 2; טבעת דקה מאוד נראית רק במסכי רטינה) ו**רוחב הלוח הפתוח** "ברוחב הכפתור" / 240 / 300 פיקסלים (ברירת מחדל 240 בגודל הרגיל, ומשתנה עם חוגת הגודל). לכל הקבוצות או לכל קבוצה, ברירת מחדל להתקנה ובחירה אישית, איפוס לכל אחת ותצוגה מקדימה חיה.

### באגים שתוקנו
- אין בשינוי הזה.

### איך מפעילים
1. טוענים מחדש את אפליקציית הרשת פעם אחת.
2. הגדרות › לשוניות › "סגנון תפריט נפתח" › סגנון: **קפסולה** (כל הקבוצות או קבוצה אחת); גודל: "גודל התפריט הנפתח" › קטן / רגיל / גדול. קבוצה מציגה תפריט נפתח רק כשמצב "תצוגת לשוניות" שלה הוא "תפריטים נפתחים" או "משולב".
3. "ההעדפה שלי" משנה רק עבורך; "ברירת המחדל של ההתקנה" (מנהל מערכת) לכולם.
4. טבעת ולוח: אותו כרטיס › "עובי הטבעת (סגנון קפסולה)" ו"רוחב התפריט הפתוח (סגנון קפסולה)".

### מגבלות ידועות
- תפריטי הקומות שנבנו ביד ("כל הקומות") בדפי נגני המולטימדיה והמסכים אינם הרכיב הזה ואינם משתנים.
- הסגנון הקיים "pill" (מוצג עכשיו כ"כדור מלא") הוא מראה אחר; אף סגנון קיים אינו זהה לקפסולה.
- עובי הטבעת ורוחב הלוח חלים על סגנון הקפסולה בלבד; הסגנונות האחרים מתעלמים מהם.
