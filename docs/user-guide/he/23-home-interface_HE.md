# הממשק הביתי

Source: original

> נכתב מהערות השחרור, מתיעוד השינויים ומהקוד של 2.42.0 עד 2.49.0, **לא מבדיקה על מערכת חיה**. צילומי מסך: עוד לא צולמו
> (יצולמו בהמשך על שרת הבדיקות).

## מה זה

הממשק הביתי הוא ממשק שני, פשוט וידידותי, ליד הממשק המלא. הוא מתחיל מהחדר: סצנות בנגיעה, אורות ומפסקים, מיזוג, תריסים,
דלתות ואינטרקום, מצלמות, חשמל, התראות, אזעקה ו"פעיל עכשיו". אין בו גלילה: בטאבלט, בטלפון ובמחשב רשימה ארוכה מתחלקת לעמודים.
טאבלט לאורך מוצג כמו טלפון, עם הסרגל התחתון וארבעה אריחים בשורה.

**שום דבר לא משתנה מעצמו:** כל מי שהיה במערכת בעדכון ל-2.42.0 נשאר בממשק המלא, עד שמנהל קובע אחרת.

## מה יש בממשק הביתי

| מסך | מה רואים ועושים |
|---|---|
| החדר | המועדפים של החדר (סצנה, אור, מפסק, מיזוג, מצלמה, דלת, תריס, כל האורות, חשמל), שורת קטגוריות, "כיבוי החדר" ו"כיבוי הבית" |
| תאורה | אורות עם עמעום, מפסקי תאורה (הדלקה וכיבוי בלבד) ולשונית "מפסקים" נפרדת למפסקים שאינם תאורה |
| אקלים, תריסים, דלתות | חוגה, מצבים והגדרות מוכנות למזגן; פתיחה, עצירה וסגירה לתריס (פתיחה וסגירה בלחיצה שנייה לאישור); פתיחת דלת עם אישור |
| מצלמות | רשת של תמונות מתעדכנות, ומסך מלא עם וידאו חי. מצלמה בלי וידאו חי מציגה "תמונה" עם נקודה אפורה וזמן הרענון האמיתי |
| עוד | כל היכולות הנוספות במקום אחד, כל אחת עם שורת מצב חיה (2.43.0) |
| הקלטות | מצלמה אחת, יום אחד, ציר זמן פשוט, "מה קרה כאן" ו"חזרה לחי" |
| יומן הבית | מה קרה בבית ב-7 הימים האחרונים במילים פשוטות (תנועה ואנשים במצלמות, דלתות, צלצול), עם "צפה בהקלטה". מ-2.43.4 גם דריכות ונטרולי האזעקה, עם מסנן "אזעקה", למי שמותר לו לראות את האזעקה |
| אינטרקום | יומן שיחות, "דבר עם הכניסה", מי רשאי להיכנס (צפייה בלבד) והזמנת אורח. שיחה נכנסת ממלאת את המסך עם תמונה חיה, דיבור כשהעמדה מאפשרת ופתיחת דלת עם אישור |
| אזעקה | מצב גדול וברור, חיישנים פתוחים, דריכה בלחיצה ואישור, ניטרול עם קוד ושינוי הקוד האישי |
| מוזיקה ומסכים | מה מתנגן בכל חדר, שליטה, עוצמה, שלט למסך וקיבוץ רמקולים, וכריזה בבית לחדרים נבחרים (לא כריזת חירום) |
| חשמל, מים ומערכות | חשבון החשמל ותחזית לסוף התקופה, צריכת מים וחשד לנזילה, גנרטור, מעליות וטמפרטורות: קריאה בלבד. ממסכי המים והמערכות אפשר לפתוח פנייה (2.43.4) |
| משפחה ובניין (2.43.1) | מי בבית (ואפשר להסתתר מהאחרים), יומן משפחתי והוספת אירוע, הזמנת חדרים משותפים, לוח הודעות עם "קראתי", אוטובוסים קרובים, מזג אוויר |
| פניות שירות | רק הפניות שפתחתי. אפשר לצרף עד 3 תמונות (JPEG או PNG, עד 8MB) בדקות הראשונות; התמונות נשמרות בלי נתוני מיקום |
| ההתראות שלי | התראות ו"לא להפריע". התראות אזעקה, דלתות ובטיחות תמיד עוברות |
| סצנות | סצנות הבית והחדר בנגיעה, תזמוני סצנות וסצנה חדשה מהמצב עכשיו |

כל מסך מופיע רק כשהמודול שלו פעיל ויש לאדם הרשאה אליו.

## כיבוי בטוח של מפסקים

- "כיבוי הכל", "כיבוי החדר" ו"כיבוי הבית" מכבים אורות ומפסקים שסווגו כתאורה (כיבוי החדר והבית מכבים גם את המיזוג).
- הם **לעולם לא** מכבים מפסק שאינו תאורה, כמו דוד, מקרר או משאבה. מפסק "מוגן" מבקש אישור גם לפני כיבוי ידני.
- ההודעה אחרי כל כיבוי אומרת מה נשאר דולק, ו"פעיל עכשיו" מסתיים בשורת המפסקים שאינם תאורה ודולקים.

## איך אני… (כל משתמש)

1. **עובר לממשק הביתי:** בתפריט האישי של הממשק המלא, "לממשק הביתי" (מופיע רק כשמותר לי להחליף ממשק). חזרה: מהתפריט של הממשק הביתי.
2. **בוחר מראה:** בהגדרות של הממשק הביתי, אחת משבע ערכות נושא (קלאסי, אוקיינוס, חול, שזיף, חצות, נורדי, פסטל), כהה או בהיר, וכתב גדול.
3. **קובע מה נפתח ראשון:** הבית שלי, החדר האחרון או חדר קבוע.
4. **בוחר מעבר בין מסכים:** "מהיר" (הופעה מהירה, בלי תזוזה) או "עם תנועה" (כל מסך עולה מלמטה).
5. **מסדר מועדפים:** חדרים מועדפים, ומועדפים בכל חדר (הזזה, שינוי גודל, הסרה). לחיצה ארוכה מוסיפה למועדפים.
6. **בוחר רקע לחדר:** רק כשההתקנה מאפשרת רקעים (ראו למטה), בלשונית "רקע".
7. **מחליף משתמש:** "החלף משתמש" בתפריט. בכניסה מרחוק זה מחזיר לדף הכניסה; בתוך מערכת הבית זה פותח את דף החשבון של מערכת הבית,
   ושם האדם יוצא והבא נכנס.

## איך אני… (מנהל)

הכול בהגדרות › משתמשים והרשאות › לשונית **"ממשק ביתי"**, בשלוש לשוניות משנה.

**משתמשים** (הרשאה להקצות תפקידים):
1. לכל אדם: הממשק שנפתח בכניסה (מלא או ביתי), האם רשאי להחליף ממשק, **ממשק ביתי בלבד** (השרת מסרב גם לבקשות שלו לאזורים של
   הממשק המלא; מנהל מערכת תמיד רשאי לממשק המלא), החדרים והקטגוריות שהוא רואה, "רשאי להזמין אורחים", ומסך קיר עם החדר שלו.
2. "העתק את המועדפים שלי": המועדפים שלי נעשים מועדפי ההתחלה של מי שעוד לא סידר לעצמו.
3. הקלטות, יומן הבית ואינטרקום הם קטגוריות נפרדות (2.43.1). מי שקיבל רשימת קטגוריות לפני 2.43.0 לא יראה את החדשות עד שיסומנו לו.

**הגדרות התקנה:**
1. **ממשק למשתמשים חדשים:** ממשק מלא לכולם (ברירת המחדל), ביתי למשתמשים רגילים ומלא למנהלים, או בחירה בכניסה הראשונה.
   חל רק על מי שעוד לא הוגדר.
2. **מצב מסך קיר:** "נעול, יציאה בקוד מנהל" (ברירת המחדל: לחיצה ארוכה על השעון מבקשת את הקוד) או "נעול לממשק הביתי ולחדר שלו,
   בלי יציאה". **קוד יציאה ממסך קיר:** 4 עד 8 ספרות.
3. **רקע לחדרים:** בלי רקע (ברירת המחדל), גלריה מוכנה, או גלריה ותמונה אישית (JPEG או PNG עד 2 MB, נראית רק למי שהעלה אותה).
4. **רקע לחדר לכולם:** למשל למסכי קיר. רקע שאדם בחר לעצמו גובר, חוץ ממסך קיר, שם הרקע של המנהל תמיד מוצג.
5. **הזמנת אורחים מהממשק הביתי** (רק מנהל מערכת): כבוי בהתקנה. פועל רק כשגם הגישה החיצונית מופעלת, ורק למי שסומן "רשאי להזמין
   אורחים" ויש לו הרשאה להזמין מבקרים. האורח מקבל קוד זמני לדלת, והקוד לא מוצג למזמין.

**סיווג מפסקים:**
1. הרשימה מציגה כל מפסק, את הסיווג שלו (תאורה, לא תאורה, מוגן) ואת ההצעה של המערכת לפי השם.
2. מסננים (הכל, הצעות, תאורה, לא תאורה, מוגן, חדר), מסמנים כמה מפסקים ובוחרים "אישור ההצעות" או סיווג אחר לכולם.

## שים לב

- הממשק הביתי משתמש באותן הרשאות כמו הממשק המלא. "ביתי בלבד" רק מצמצם, לעולם לא נותן הרשאה.
- דלתות, שערים והאזעקה תמיד מבקשים אישור. דלת שלא משויכת לעמדה מציגה את הסיבה ולא כפתור פתיחה.
- מסך קיר יכול להוסיף אירוע ליומן המשפחתי, ורק את זה (בלי הזמנת חדרים, ביטול או משיכה).
- השליטה נבדקה מול נתונים מדומים בלבד, ועוד לא בטאבלט או בטלפון אמיתיים.

---

# The home interface

> Written from the release notes, the change records and the code of 2.42.0 to 2.49.0, **not from a live installation**.
> Screenshots: not taken yet (they will be taken on the test server later).

## What it is

The home interface is a second, simple interface next to the full one. It starts from the room: one-tap scenes, lights and
switches, climate, shutters, doors and the intercom, cameras, energy, alerts, the alarm and "active now". It never scrolls: on a
tablet, a phone and a desktop a long list splits into pages. A portrait tablet shows the phone layout, with the bottom bar and
four tiles per row.

**Nothing changes by itself:** everyone who existed at the 2.42.0 update stays on the full interface until an administrator
says otherwise.

## What is in it

| Screen | What you see and do |
|---|---|
| The room | The room's favourites (scene, light, switch, climate, camera, door, shutter, all lights, energy), a category row, "room off" and "house off" |
| Lighting | Dimmable lights, light switches (on and off only) and a separate "switches" tab for switches that are not lights |
| Climate, shutters, doors | A dial, modes and presets for the A/C; open, stop and close for a shutter (open and close need a second tap to confirm); opening a door with a confirmation |
| Cameras | A grid of refreshed stills, and full screen with live video. A camera without live video shows "still" with a grey dot and its real refresh interval |
| More | Every additional capability in one place, each with a live status line (2.43.0) |
| Recordings | One camera, one day, a simple timeline, "what happened here" and "back to live" |
| House log | What happened at home in the last 7 days in plain words (movement and people at the cameras, doors, the doorbell), with "watch the recording". From 2.43.4 also the alarm's arming and disarming, with an "alarm" filter, for a person allowed to view the alarm |
| Intercom | Call log, "talk to the entrance", who may come in (view only) and inviting a guest. An incoming call fills the screen with live video, talk where the station allows it, and door opening with a confirmation |
| Alarm | A large clear state, open sensors, arming with one tap and a confirmation, disarming with the code, and changing your personal code |
| Music and screens | What is playing in each room, controls, volume, a screen remote and speaker groups, and a home announcement to chosen rooms (not the emergency announcement) |
| Electricity, water and systems | The electricity bill with a forecast to the end of the period, water use and a suspected leak, the generator, elevators and temperatures: read only. A ticket can be opened from the water and systems screens (2.43.4) |
| Family and building (2.43.1) | Who is home (and hiding yourself from the others), the family calendar and adding an event, booking shared rooms, the notice board with "read", nearby buses, weather |
| Service tickets | Only the tickets I opened. Up to 3 photos (JPEG or PNG, up to 8 MB) can be attached in the first minutes; photos are stored without location data |
| My notifications | Notifications and "do not disturb". Alarm, door and safety notices always come through |
| Scenes | Home and room scenes with one tap, scene schedules and a new scene from the current state |

Each screen appears only when its module is on and the person holds its permission.

## Safe switch-off

- "All off", "room off" and "house off" turn off lights and switches classified as lights (room off and house off also turn off
  the climate).
- They **never** turn off a switch that is not a light, such as a boiler, a fridge or a pump. A "protected" switch asks for a
  confirmation even before a manual switch-off.
- The message after every switch-off says what stayed on, and "active now" ends with the row of non-light switches that are on.

## How do I… (every user)

1. **Move to the home interface:** "To the home interface" in the full interface's personal menu (shown only when I may switch).
   Back: from the home interface's own menu.
2. **Choose a look:** in the home interface's settings, one of seven themes (classic, ocean, sand, plum, midnight, nordic,
   pastel), dark or light, and big text.
3. **Choose what opens first:** my home, the last room or a fixed room.
4. **Choose the screen transition:** "quick" (a quick appearance, no movement) or "with motion" (each screen rises from below).
5. **Arrange favourites:** favourite rooms, and favourites in each room (move, resize, remove). A long press adds a favourite.
6. **Choose a room wallpaper:** only when the installation offers wallpapers (see below), on the "wallpaper" tab.
7. **Switch user:** "switch user" in the menu. On the remote sign-in it returns to the sign-in page; inside the home system it
   opens the home system's account page, where the person signs out and the next one signs in.

## How do I… (administrator)

Everything is in Settings › Users and permissions › the **"Home interface"** tab, in three sub-tabs.

**Users** (the permission to assign roles):
1. Per person: the interface that opens at sign-in (full or home), whether they may switch, **home only** (the server also
   refuses their requests to full-interface areas; a system administrator always keeps the full interface), the rooms and
   categories they see, "may invite guests", and a wall panel with its room.
2. "Copy my favourites": my favourites become the starting favourites of everyone who has not arranged their own.
3. Recordings, the house log and the intercom are separate categories (2.43.1). A person who got a category list before 2.43.0
   does not see the new ones until they are marked.

**Installation settings:**
1. **Interface for new users:** the full interface for everyone (the default), home for regular users and full for
   administrators, or a choice at the first sign-in. It applies only to people not configured yet.
2. **Wall panel mode:** "locked, exit with the administrator's code" (the default: a long press on the clock asks for the code) or
   "locked to the home interface and its room, no exit". **Wall panel exit code:** 4 to 8 digits.
3. **Room wallpaper:** none (the default), a ready-made gallery, or the gallery and a personal picture (JPEG or PNG up to 2 MB,
   seen only by the person who uploaded it).
4. **A room wallpaper for everyone:** for example for wall panels. A wallpaper a person chose wins, except on a wall panel, where
   the administrator's wallpaper always shows.
5. **Guest invitations from the home interface** (system administrator only): off at install. It works only while external
   access is on too, and only for people marked "may invite guests" who hold the permission to invite visitors. The guest gets
   a temporary door code, which the host never sees.

**Switch classification:**
1. The list shows every switch, its class (light, not a light, protected) and the system's suggestion from the name.
2. Filter (all, suggestions, light, not a light, protected, room), select several switches and choose "approve the suggestions"
   or one class for all of them.

## Note

- The home interface uses the same permissions as the full interface. "Home only" only narrows; it never grants a permission.
- Doors, gates and the alarm always ask for a confirmation. A door not linked to a station shows the reason, not an open button.
- A wall panel can add an event to the family calendar, and only that (no room booking, cancelling or withdrawing).
- The controls were tried against mocked data only, not yet on a real tablet or phone.
