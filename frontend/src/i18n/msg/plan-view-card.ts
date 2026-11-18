// CR-UI-POLISH-2443: the English of the "3D map" settings card (owner round 32) - src/screens/system-plan-view.ts and the
// explanations and rows of src/screens/plan-view-dials.ts: the Hebrew text as written -> its English.
// Read through `tr()` (i18n/msg.ts); a text missing here stays Hebrew in the English interface. Terms: docs/i18n/GLOSSARY_EN.md.
// The words the card shares with the look card (system-look.ts) and the plan wizard's settings dialog carry the same English as
// msg/system-b.ts and msg/plan-wizard.ts. The dial and choice names are in msg/api-plan-view.ts (api/plan-view.ts).
import { msgCatalogue } from '../msg';

export const tr = msgCatalogue('msg/plan-view-card', {
  // the card and its two owners
  'מפה תלת־ממדית': '3D map',
  'תוויות וכרטיס החדר, כל הקומות, מראה, סימוני מצב, שעה ואור, תוכנית מתמונה, סיור ואיכות - לכל ההתקנה ולעצמי':
    'Labels and room card, all floors, look, state markings, time and light, plan from a picture, walk and quality - for the whole installation and for yourself',
  'למי': 'For whom',
  'ההעדפה שלי: כל שינוי נשמר מיד ותקף בכל מכשיר שלי. התוויות, כרטיס החדר והריצוף נקבעים בברירת המחדל של ההתקנה':
    'My preference: every change is saved at once and applies on all my devices. The labels, the room card and the flooring are set in the installation default',
  'ברירת המחדל של ההתקנה: נשמרת בכפתור': 'The installation default: saved with the button',
  'ההעדפה שלי': 'My preference',
  'ברירת המחדל של ההתקנה': 'Installation default',
  'לפי ההתקנה': 'As the installation',
  'לפי ההתקנה: {value}': 'As the installation: {value}',
  'פעיל': 'On',
  'כבוי': 'Off',
  '{n} מ׳': '{n} m',
  // the sections
  'תוויות וכרטיס החדר': 'Labels and room card',
  'כל הקומות': 'All floors',
  'מראה': 'Look',
  'סימוני מצב החדר': 'Room state markings',
  'שעה ואור': 'Time and light',
  'תוכנית חדשה מתמונה': 'New plan from a picture',
  'סיור בגובה עין': 'Eye-level walk',
  'איכות ומסכים': 'Quality and screens',
  // the foot
  'לפי ההתקנה בכל האפשרויות': 'As the installation for every option',
  'שמור': 'Save',
  'בטל שינויים': 'Discard changes',
  'יש שינויים שלא נשמרו': 'There are unsaved changes',
  'שינוי ברירת המחדל דורש הרשאת מנהל מערכת.': 'Changing the default needs system administrator permission.',
  'נתוני הדגמה: ההגדרות נשמרות רק מול השרת.': 'Demo data: settings are saved only against the server.',
  'ההעדפה נשמרה': 'Preference saved',
  'ברירת המחדל נשמרה': 'Default saved',
  'ההעדפה נמחקה': 'Preference cleared',
  // the site location
  'מיקום האתר — ידני': 'Site location — manual',
  'קו רוחב וקו אורך במעלות, לחישוב מסלול השמש. חל רק כשמקור המיקום הוא "ידני" (הגדרות ‹ כללי ‹ וידאו ומדיה ‹ מיקום האתר לשמש בתלת־ממד); אחרת השמש לפי מיקום הבית':
    'Latitude and longitude in degrees, for working out the sun\'s path. Applies only when the location source is "Manual" (Settings › General › Video and media › Site location for the sun in 3D); otherwise the sun follows the home\'s location',
  'קו רוחב': 'Latitude',
  'קו אורך': 'Longitude',
  'מיקום האתר: קו רוחב בין -90 ל-90, קו אורך בין -180 ל-180.': 'Site location: latitude between -90 and 90, longitude between -180 and 180.',
  'מיקום האתר: צריך גם קו רוחב וגם קו אורך (או שניהם ריקים).': 'Site location: both a latitude and a longitude are needed (or both left empty).',
  // the plan wizard's thresholds (the wizard's settings dialog says the same: msg/plan-wizard.ts)
  'נכנס בלי בדיקה מעל (%)': 'Included without review above (%)',
  'פריט שזוהה בביטחון גבוה מזה נכנס לתוכנית לבד': 'An item detected with more confidence than this goes into the plan by itself',
  'לא נכנס בלי אישור מתחת ל־(%)': 'Not included without approval below (%)',
  'בין שני הספים הפריט מסומן לבדיקה': 'Between the two thresholds the item is marked to review',
  'הסף התחתון צריך להיות נמוך מהסף העליון.': 'The lower threshold must be below the upper one.',
  'פריט לבדיקה שדילגת עליו': 'A "To review" item you skipped',
  'נכנס כמו שזוהה, או לא נכנס': 'Included as detected, or not included',
  'נכנס כמו שזוהה': 'Included as detected',
  'לא נכנס': 'Not included',
  'ערכת סגנון ראשונה': 'First style kit',
  'הערכה שמסומנת כשמגיעים לשלב הסגנון; בכל תוכנית אפשר לבחור אחרת': 'The kit selected when you reach the style step; any plan can choose another',
  // plan-view-dials.ts: one line under each dial
  'אוטומטי: בהיר עם ערכת נושא בהירה, כהה עם כהה': 'Automatic: light with a light theme, dark with a dark one',
  'במה נפתחת התצוגה התלת־ממדית: סכמטי לכולם, ריאליסטי - בחירה אישית בדפדפן הזה': 'What the 3D view opens with: schematic for everyone, realistic - a personal choice in this browser',
  'דגמים: ריהוט מפורט מהספרייה; גאומטרי: צורות פשוטות (קל יותר למחשב)': 'Models: detailed furniture from the library; geometric: simple shapes (lighter on the computer)',
  'קבצי חומרים: טקסטורות אמיתיות; גאומטרי: גוון אחיד לכל חומר': 'Material files: real textures; geometric: one flat tone per material',
  'מסך קיר מציג תלת־ממד חי או תמונות מוכנות (חוסך חום וסוללה)': 'A wall screen shows live 3D or prepared pictures (saves heat and battery)',
  'לפי שעון האתר השמש זזה עם היום; ידני: בוחרים שעה בסרגל': 'By the site clock the sun moves with the day; manual: you choose an hour on the bar',
  'איך מסובבים את המבט בסיור: גרירה, נעילת סמן, או אוטומטי לפי המסך': 'How you look around in the walk: drag, pointer lock, or automatic by the screen',
  'אוטומטי יורד בדרגה כשהמחשב מתקשה; דרגה קבועה נשארת': 'Automatic drops a level when the computer struggles; a fixed level stays',
  'אחרי כמה זמן בלי שינוי מסך הקיר עובר לתמונה מוכנה': 'How long without a change before the wall screen switches to a prepared picture',
  'גובה העין בסיור בגובה עין': 'The eye height in the eye-level walk',
  'כמה פיקסלים לכל נקודת מסך לכל היותר; נמוך יותר = מהיר יותר': 'The most pixels per screen point; lower = faster',
  'במבט מלמעלה הקירות נחתכים כדי לראות פנימה': 'In the top view the walls are cut away to show the inside',
  'טמפרטורת החדר על הרצפה כשיש חיישן': 'The room temperature on the floor where there is a sensor',
  'דלתות נפתחות, אור משתנה ותנועת מצלמה': 'Doors opening, changing light and camera movement',
  'כשהסיור רץ לאט, האיכות יורדת דרגה עד סוף הסיור': 'When the walk runs slowly, the quality drops a level until the walk ends',
  'בתצוגה הריאליסטית: שמיים לפי השעה, או רקע כהה בהדרגה בלי קו אופק (מראה של הדמיה אדריכלית)':
    'In the realistic view: a sky by the hour, or a dark gradient background with no horizon (the look of an architectural rendering)',
  'בתצוגה הריאליסטית: ממה עשויה רצפת חדרי המגורים - שיש קלקטה מלוטש, קרמיקה יוקרתית, טרוורטין או פרקט עץ (חדרים רטובים, חניה וגינה נשארים כפי שהם)':
    'In the realistic view: what the floor of the living rooms is made of - polished Calacatta marble, premium ceramic, travertine or wood parquet (wet rooms, parking and garden stay as they are)',
  'בתצוגה הריאליסטית: הרהיטים והחלונות משתקפים בשיש ובקרמיקה המבריקים; כיבוי חוסך מעט עבודה למחשב':
    'In the realistic view: the furniture and the windows are reflected in the glossy marble and ceramic; turning it off saves the computer a little work',
  'במבט מלמעלה: קירות נמוכים מראים את כל החדרים מכל זווית, וראשי הקירות נושאים את סימון מצב החדר':
    'In the top view: low walls show every room from every angle, and the wall tops carry the room state marking',
  'במכשיר חלש, וכשהתמונה מתחילה להאט, ההשתקפות ברצפה נכבית ראשונה; סימוני מצב החדר לא יורדים אף פעם':
    'On a weak device, and when the picture starts to slow down, the floor reflection goes off first; the room state markings are never dropped',
  'נוכחות ואזעקה: פס צבע על ראש הקיר ופס דק לאורך הקירות ברצפה, או צביעת הרצפה כמו קודם':
    'Presence and alarm: a colour bar on the wall top and a thin line along the walls on the floor, or the floor tint as before',
  'ביום כמעט לא רואים שהמנורה דולקת: פס ענבר דק על ראש הקיר מסמן חדר עם אור דולק':
    'By day you can hardly see that a lamp is on: a thin amber bar on the wall top marks a room with a light on',
  'חדר באזעקה מסומן באדום. למי שביקש במכשיר שלו פחות תנועה האדום קבוע בכל מקרה':
    'A room in alarm is marked in red. For anyone who asked for less motion on their device the red is steady anyway',
  'אוטומטי: יום, ערב חם ולילה לפי השעה באתר; נעילה שומרת מראה קבוע (מסך קיר, מוקד)':
    'Automatic: day, warm evening and night by the hour at the site; a lock keeps one fixed look (wall screen, control room)',
  // plan-view-dials.ts: the wall screen's idle time
  'לעולם לא': 'Never',
  '10 שניות': '10 seconds',
  '30 שניות': '30 seconds',
  '2 דקות': '2 minutes',
  '10 דקות': '10 minutes',
  // plan-view-dials.ts: the room labels, the room card and the all-floors view (product settings map.*)
  'תוויות על המפה': 'Labels on the map',
  'תווית אחת לכל חדר מסכמת מה פתוח, נוכחות, אורות וטמפרטורה; בהתקרבות לחדר כל התקן מופיע לחוד':
    'One label per room sums up what is open, presence, lights and temperature; when you zoom in on a room each device appears on its own',
  'תווית לכל חדר, התקנים בהתקרבות': 'A label per room, devices on zoom-in',
  'תווית לכל חדר תמיד': 'A label per room, always',
  'תווית לכל התקן': 'A label per device',
  'נגיעה בתווית של חדר': 'Tapping a room label',
  'חלון פירוט קטן, וממנו ממשיכים לכרטיס החדר': 'A small details window, and from it on to the room card',
  'חלון פירוט קטן, ממנו לכרטיס': 'Small details window, then the card',
  'ישר לכרטיס החדר': 'Straight to the room card',
  'חדר שאין בו מה לדווח': 'A room with nothing to report',
  'הכול סגור וכבוי ואין טמפרטורה': 'Everything is closed and off and there is no temperature',
  'רק שם החדר': 'Room name only',
  'לא להציג כלום': 'Show nothing',
  'תווית "הכול סגור"': 'An "All closed" label',
  'מיקום כרטיס החדר': 'Room card position',
  'במחשב ובטאבלט: פאנל בצד והחדר זז למרכז השטח שנשאר; בטלפון הכרטיס הוא תמיד גיליון שעולה מלמטה':
    'On a computer and a tablet: a side panel, and the room moves to the centre of the space that is left; on a phone the card is always a sheet that slides up from the bottom',
  'פאנל בצד': 'Side panel',
  'כרטיס צף בפינה': 'Floating card in the corner',
  'מחשב: פאנל, טאבלט: גיליון': 'Computer: panel, tablet: sheet',
  'אישור לפני פעולה בכרטיס החדר': 'Confirmation before an action in the room card',
  'דלתות, שערים ואזעקה דורשים אישור תמיד, כמו בשאר המערכת': 'Doors, gates and the alarm always need confirmation, as in the rest of the system',
  'דלתות, שערים ואזעקה': 'Doors, gates and alarm',
  'גם "כבה הכול" וסגירת תריסים': 'Also "Turn everything off" and closing blinds',
  'המצלמה בכרטיס החדר': 'The camera in the room card',
  'וידאו חי מתחיל מיד כשהכרטיס נפתח (בזרם המשני) ונעצר כשהוא נסגר': 'Live video starts as soon as the card opens (on the sub stream) and stops when it closes',
  'וידאו חי מיד': 'Live video at once',
  'תמונה מתעדכנת, וידאו בלחיצה': 'Refreshing picture, video on a click',
  'בלי מצלמה': 'No camera',
  'רקע בתצוגת כל הקומות': 'Backdrop of the all-floors view',
  'לפי מצב בהיר / כהה והשעה, כמו קומה אחת; או נעול למראה בהיר או כהה קבוע': 'By the light / dark mode and the hour, like a single floor; or locked to a fixed light or dark look',
  'לפי המצב והשעה': 'By the mode and the hour',
  'תמיד בהיר': 'Always light',
  'תמיד כהה': 'Always dark',
  'בחירת קומה בתצוגת כל הקומות': 'Choosing a floor in the all-floors view',
  'נגיעה ראשונה מגדילה את הקומה ומראה את החדרים שלה, נגיעה שנייה נכנסת': 'The first tap enlarges the floor and shows its rooms, the second tap enters',
  'נגיעה מגדילה, שנייה נכנסת': 'A tap enlarges, a second enters',
  'נגיעה אחת נכנסת': 'One tap enters',
});
