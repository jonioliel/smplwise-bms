# הוראות לפיתוח SMPLWISE VMS — חיבור WisKey / smplwise access control

עודכן: 29.09.2026. בסיס שפורסם ואומת: **2.0.0-rc.25**.

- [הגרסה להתקנה](https://github.com/jonioliel/home-assistant-hikvision-intercom/releases/tag/v2.0.0-rc.25)
- Commit שפורסם: `bf15cbb2304aa671b5188fd7d7c11d0e67148270`.
- [שערי השחרור שעברו](https://github.com/jonioliel/home-assistant-hikvision-intercom/actions/runs/36522612188).
- חוזה הטמעת המסכים: **1**. הוא הושק ב־rc.19 ונשמר ב־rc.25.
- Domain טכני: `hikvision_intercom`; נתיב הפאנל: `/hikvision-intercom`.
- שם המוצר למשתמש: WisKey / smplwise access control. בממשק למשתמש יש להשתמש ב״תשתית המערכת״ במקום שמות התשתית או ראשי התיבות שלה.

המסירה מאשרת את המימוש בצד WisKey ואת חבילת ההתקנה שפורסמה. היא אינה אישור שהקוד הנפרד של VMS כבר אומץ, או שמדיה בתוך ההטמעה שלו נבדקה פיזית.

## 1. החלטת המימוש

כדי להציג **אותם מסכים ואותן יכולות**, הטמע את הפאנל המקורי של WisKey בתוך VMS בעזרת `iframe` וחוזה ההטמעה הקיים. כך העיצוב, הרשאות המפעיל, אנשים וקבוצות, אירועים, תחנות, סנכרון, מדיה, TTS, WhatsApp, לוחות זמנים והפעולות החדשות נשארים במימוש המקורי.

WisKey נשאר אינטגרציה מותקנת. אין צורך להפוך אותו לתוסף, להסיר אותו, להעתיק נתונים או לשנות את ה־domain. VMS יכול להמשיך לרוץ כתוסף נפרד על אותו שרת.

אין צורך ליצור מחדש את מסכי WisKey לצורך ההטמעה. אין לקרוא את המצב הפנימי של רכיבי הפאנל, לקרוא למתודות `navigate()` פנימיות או לטעון את `panel.js` כאילו הוא רכיב עצמאי של VMS. ניווט נעשה באמצעות החוזה המתועד.

## 2. תנאי הפריסה והזהות

מסמך VMS והפאנל המוטמע צריכים להיות באותו **מקור דפדפן**: אותו protocol, host ו־port. עצם העובדה ששתי המערכות רצות על אותו שרת אינה מספיקה. בנה את כתובת הפאנל משורש המקור, ולא מתוך נתיב ה־Ingress:

```js
const panelUrl = new URL('/hikvision-intercom', window.location.origin);
panelUrl.searchParams.set('embed', '1');
panelUrl.searchParams.set('tab', 'overview');
```

הפאנל פועל בזהות המשתמש המחובר לתשתית המערכת ובהרשאותיו ב־WisKey. הרשאת מנהל ב־VMS אינה מעניקה למשתמש הרשאת מנהל ב־WisKey.

מסגרת עם מקור אטום או מקור אחר אינה נתמכת בחוזה זה. אם VMS נפתח בכתובת חיצונית אחרת, יש להסדיר תחילה את הפריסה וההזדהות; אין להסיר בדיקות origin/source או להשתמש ב־`'*'` כדי לעקוף את התנאי.

## 3. חיבור מוכן לשילוב

החבילה כוללת מתאם דפדפן שכבר נבדק:

`reference/docs/integrations/examples/wiskey-embed-client.mjs`

העתק אותו לתיקיית הקוד של VMS ושנה רק את נתיב הייבוא ואת חיבור ה־callbacks לרכיבי VMS. המתאם מתקין את המאזין לפני טעינת המסגרת, מנהל handshake, ניווט, רענון וניקוי מאזינים.

```html
<section class="wiskey-module">
  <header>
    <h2 id="wiskey-title">בקרת כניסה</h2>
    <nav id="wiskey-nav" aria-label="ניווט בקרת כניסה"></nav>
    <p id="wiskey-status" role="status"></p>
  </header>
  <iframe id="wiskey-frame" title="WisKey — בקרת כניסה"
    allow="autoplay; microphone; fullscreen"></iframe>
</section>
```

```css
.wiskey-module { display:flex; flex-direction:column; height:100%; min-height:0; }
#wiskey-frame { flex:1 1 auto; width:100%; min-height:0; border:0; }
/* גם שרשרת המכולות של VMS חייבת לספק גובה ממשי למסגרת. */
```

```js
import { attachWiskey } from './wiskey-embed-client.mjs';

const frame = document.querySelector('#wiskey-frame');
const title = document.querySelector('#wiskey-title');
const status = document.querySelector('#wiskey-status');
const nav = document.querySelector('#wiskey-nav');
const hostParams = new URLSearchParams(window.location.search);
let connector;

function navButton(label, target) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.onclick = () => connector.navigate(target);
  return button;
}

connector = attachWiskey(frame, {
  initial: {
    tab: hostParams.get('wiskey_tab') || 'overview',
    tool: hostParams.get('wiskey_tool') || null,
  },
  onReady: ({ tabs, tools }) => {
    status.textContent = '';
    nav.replaceChildren();
    for (const tab of tabs) {
      nav.append(navButton(tab.label, { tab: tab.id, tool: null }));
    }
    // חבר את tools לתפריט כלי הניהול של VMS.
    // יעד כלי: { tab: 'tools', tool: tool.id }.
  },
  onLocation: ({ tab, tool }) => {
    const url = new URL(window.location.href);
    url.searchParams.set('wiskey_tab', tab);
    if (tool) url.searchParams.set('wiskey_tool', tool);
    else url.searchParams.delete('wiskey_tool');
    history.replaceState(history.state, '', url);
    // עדכן כאן את סימון הניווט של VMS לפי המיקום המאושר.
  },
  onTitle: (text) => { title.textContent = text; },
  onWaiting: () => { status.textContent = 'ממתין לטעינה או להזדהות'; },
  onUnsupported: () => { status.textContent = 'נדרשת גרסת חיבור נתמכת'; },
  onLegacy: () => { status.textContent = 'יש לעדכן את WisKey לגרסה תומכת'; },
});

// רק לאחר אישור עזיבת טיוטות לפי המדיניות של VMS:
// connector.refresh();

// ביציאה ממודול WisKey:
// connector.dispose();
// frame.remove();
```

זו דוגמת שילוב ב־VMS, לא קוד שנפרס או נבדק בסביבת VMS שלך. המתאם המצורף הוא קובץ המקור של השחרור המאומת.

## 4. פרוטוקול ההטמעה

| כיוון | הודעה | תפקיד |
| --- | --- | --- |
| WisKey → הורה מיידי | `wiskey:ready` | `version: 1`, רשימות `tabs` ו־`tools` זמינות למשתמש. |
| WisKey → הורה מיידי | `wiskey:location` | המיקום שאושר בפועל: `tab`, ו־`tool` כמחרוזת או `null`. |
| WisKey → הורה מיידי | `wiskey:title` | כותרת המסך כטקסט. |
| VMS → WisKey | `wiskey:navigate` | בקשת ניווט בלבד, עם `tab` ו־`tool`. |

הודעות הן אובייקטים, לא מחרוזות JSON. יש לבדוק הן `event.origin` והן `event.source`. יש לשלוח ל־`window.location.origin` במפורש. אין בחוזה postMessage פקודה לפתיחת דלת, שינוי אדם, שידור קול, TTS או שליחת WhatsApp.

אין לסמן מסך חדש כנבחר לפני קבלת `wiskey:location`: המשתמש יכול לבטל עזיבת לוח שלא נשמר. אין להחזיר כל הודעת location כבקשת navigate, כדי למנוע לולאת הד. לפני טעינה מחדש יש לתאם עזיבת טיוטות; ניווט רגיל צריך להשתמש בהודעות ולא ברענון מלא של iframe.

`ready` הוא קטלוג פתיחה מסונן הרשאות. הוא אינו הוכחה שהרשאה נשארה תקפה בהמשך; השרת ממשיך לבדוק אותה בכל פעולה. בטעינה מחדש נדרש handshake חדש. המתאם מבחין בין התקנה ישנה לבין טעינה/הזדהות מתעכבת, ואינו מפעיל fallback פנימי בהיעדר אישור לגרסה ישנה.

## 5. ניווט, עיצוב וסרגלים

קישורים לדוגמה:

```text
/hikvision-intercom?embed=1&tab=overview
/hikvision-intercom?embed=1&tab=users
/hikvision-intercom?embed=1&tab=devices
/hikvision-intercom?embed=1&tab=events
/hikvision-intercom?embed=1&tab=sync
/hikvision-intercom?embed=1&tab=camera_wall
/hikvision-intercom?embed=1&tab=tools&tool=media_options
/hikvision-intercom?embed=1&tab=tools&tool=profile_options
/hikvision-intercom?embed=1&tab=tools&tool=platform_center
```

בנה ניווט מהרשימות שחזרו ב־`ready`, ולא מהעתק קבוע של שמות מסכים. מזהה מסך ושם מתורגם הם שני שדות שונים. TTS והמשפטים המהירים נמצאים בהגדרות המדיה; אין להמציא מזהה מסך TTS נפרד.

`embed=1` מסיר את הסרגל העליון של WisKey ומציג תוכן מותאם למארח. כלי הניהול, חלונות, טפסים ופקדי מצלמה נשארים. העיצובים, צבע המבטא, RTL והתאמה לנייד נשמרים. ההטמעה אינה כותבת העדפת תצוגה קבועה.

WisKey משתמש באירוע `hass-kiosk-mode` עם `detail: { enable: true }` בתוך המסגרת, ומשחזר את המצב הנצפה הקודם ביציאה. אין להפעיל במקביל מנגנון kiosk מתחרה, לשנות העדפות sidebar קבועות או להסתיר סרגלים בחלון האב.

## 6. וידאו, שמע, מיקרופון ו־TTS

המסכים המקוריים ממשיכים לנהל את מסלולי המדיה הקיימים. ספק למסגרת `allow="autoplay; microphone; fullscreen"`, ובדוק את מדיניות ההרשאות גם במסגרות האב. ההגדרה אינה עוקפת מגבלה של הדפדפן או של מסגרת אב.

נדרשים HTTPS, מחוות משתמש והרשאת מיקרופון לפי הדפדפן. סגירת מודול VMS צריכה להסיר את המסגרת ולסיים את המדיה. אין לפתוח מיקרופון או לשלוח TTS אוטומטית בכניסה למסך.

קבלת ניווט, תשובת פקודת שיחה או אישור חבילות אינה אישור שנשמע קול בתחנה. יש לבדוק בנפרד האזנה, דיבור ו־TTS בתוך פריסת ה־Ingress האמיתית, במחשב ובטלפון.

## 7. מה נוסף עד rc.25

המסכים המקוריים כוללים את התוספות הבאות. אין שינוי בחוזה ההטמעה בעקבותיהן:

| גרסה | תוספת שנמסרה | פירוט בחבילה |
| --- | --- | --- |
| rc.20 | סקירה מצומצמת ורשימות אנשים מדופדפות, עם שמירת תאימות לקוחות קיימים. | מקור השחרור וקטלוג הפקודות. |
| rc.21 | אשף הוספת תחנות ברצף וסקירת השפעת החלפה/פרישה. | `reference/docs/STATION_ONBOARDING_SEQUENCE_HE.md`. |
| rc.22 | עסקת החלפה/הוצאה משימוש, בעלות ומיפויים, אישורים, ביטולים ממתינים ואימות. | `reference/docs/STATION_LIFECYCLE_TRANSACTIONS_HE.md`. |
| rc.23 | תבניות הגדרות דלת, תור תחזוקה עמיד ומגמות קיבולת נצפית. | `reference/docs/FLEET_MAINTENANCE_HE.md`. |
| rc.24 | ארכיון אנשים ושחזור לא פעיל, תוך שמירת זהות והיסטוריה. | `reference/docs/PEOPLE_ARCHIVE_HE.md`. |
| rc.25 | סקירת שינוי סוג/כללי שדה וייחודיות נבחרת, כולל ערכי ארכיון. | `reference/docs/PROFILE_IMPACT_HE.md`. |

אין להעתיק לוח מקומי לתחנה חלופית בלי פריסה וקריאה חוזרת. הסרת חיבור אינה הוכחת מחיקת הרשאות בציוד. כשל של תחנה או אדם יחיד אינו סיבה להציג את יתר התוצאות כהצלחה או לחסום את כל הרשימה.

שדות תלויים אינם יכולת שפורסמה ב־rc.25. נקודת המשך מקומית אינה חלק מחבילת השחרור, ואין להסתמך עליה. גם שכבת ספק Akuvox אינה ממומשת במסירה זו. המערכת מיועדת ל־1–X תחנות; תשע תחנות אינן יעד או תנאי קבלה.

## 8. אם VMS צריך מסכים או נתונים עצמאיים

מסלול זה נפרד מהטמעת המסכים, ואינו נדרש כדי להציג אותם בדיוק. הוא מתועד במדריכים הטכניים תחת `reference/docs/integrations/`.

החבילה כוללת קטלוג **221 פקודות ניהול** מתוך registry של rc.25:

`reference/docs/integrations/WISKEY_VMS_PANEL_COMMANDS.json`

זהו קטלוג שדות ברמה העליונה של API הפאנל, לא מפרט OpenAPI מלא ולא חוזה עצמאי `vms/v1`. subscription, שמע ו־TTS משתמשים גם במטפלים נפרדים. סכימות מקוננות, תגובות, אישורים ו־workflow tokens דורשים את המקור המצורף.

לחיבור backend: הזדהה ב־WebSocket של התשתית, קרא `authorization/session`, ואז `overview` או מסלול הסקירה המצומצם אם הוא נתמך. גלה capabilities ופקודות מותרות מההתקנה בפועל. API prefix נשאר `hikvision_intercom/`. יש להשתמש ב־`revision` העדכני ובמסלול preview/apply של כל פעולה, ולא לנחש מטען בקשה מתוך שם הפקודה.

אסימוני תשתית או Supervisor נשמרים בצד שרת בלבד. Ingress אינו הופך פקודת backend של חשבון שירות לפעולה בזהות מפעיל הדפדפן. חשבון שירות יחיד אינו תחליף להרשאות וליומן של מפעילים שונים. ההטמעה המומלצת משתמשת בהזדהות הדפדפן המקורית ואינה צריכה לחשוף אסימון שירות.

דגשים לתוספות האחרונות במסכים עצמאיים:

- `users/archive` / `users/unarchive`: פעולות מנהל עם revision ואישור; שחזור אינו מפעיל גישה. ביטול בציוד דורש סנכרון נפרד.
- `profiles/settings_preview`: מחזיר גם `field_changes` ו־`can_apply`; הצג סקירה, חסום אישור כשיש כפילויות, ודרוש `profiles/settings_apply` עם מזהה הפעולה. אין המרת ערכים אוטומטית.
- ייחודיות נאכפת בשרת גם בעריכה מקבילה ובייבוא. אדם בארכיון שומר ערך; מחיקת אדם מוחקת פרופיל מקומי ומשחררת ערך, בעוד ביטולי ציוד ממתינים נשמרים.
- `platform/lifecycle_*` ו־`platform/maintenance_*`: workflow עם fingerprint, בעלות, זהות ואישורים עדכניים. אין להפוך את הקטלוג לכפתור ביצוע ללא הסקירה והאימות המתועדים.
- אחרי תוצאה לא ודאית: קרא מצב/קבלה מחדש. אין לשחזר אוטומטית פתיחת מנעול, הודעה או כתיבת הרשאה.
- הנתונים המקוריים נשמרים ב־Store הפרטי של התשתית. אין לקרוא או לערוך `.storage` או להשתמש ב־Recorder כ־API של WisKey.

מדריכי הרקע המצורפים מכילים גם סעיפים היסטוריים מגרסאות קודמות. למסירה זו עדיפים הוראות קובץ זה, קטלוג rc.25 וקוד ה־commit המפורסם. אין להסיק מסעיף ישן שמגבלה או סכימה נשארו קבועות.

## 9. תוכנית שילוב וקבלה בצד VMS

1. עדכן ל־rc.25 או לגרסה מאוחרת תואמת חוזה 1, והשלם את אתחול התשתית ורענון הממשק הרגילים.
2. טען את הפאנל באותו מקור עם `embed=1`, ואמץ את המתאם ואת קטלוג הניווט הדינמי.
3. חבר כותרות, מיקום מאושר ונתב VMS. בדוק פתיחה מקישור ישיר, רענון וחזרה/קדימה.
4. בדוק מפעיל מנהל ומפעיל מוגבל שנבחר מראש: מסכים מותרים בלבד, שדות ותחנות מסוננים, דחיית פעולה אסורה והיעדר הרחבת הרשאות.
5. בדוק ביטול עזיבת טיוטה: המסך המאושר צריך להישאר מסומן ב־VMS.
6. בדוק פתיחה/סגירה/פתיחה מחדש, handshake חדש והפסקת מדיה ביציאה.
7. בדוק RTL, בהיר/כהה, צבע המבטא, נייד ומחשב, וכן גלילה בתוך מכולת VMS בעלת גובה אמיתי.
8. בדוק האזנה, מיקרופון ו־TTS בתוך Ingress ועל תחנת בדיקה בתיאום הבעלים. בדיקות המוקים אינן מחליפות תוצאה פיזית.

אין לבצע בדיקות כתיבה, פתיחת דלת או שידור קול אוטומטיים על צי פעיל כחלק מבניית VMS. תחילה ניתן לאמת טעינה, ניווט והרשאות בקריאה בלבד.

## 10. ראיות והנחיה להעברה ל־Claude

שער השחרור עבור אותו commit עבר: 1,679 בדיקות שרת בכל אחת משתי גרסאות Python,
612 בדיקות אינטגרציה עם התשתית, 685 Chromium ו־298 Firefox/WebKit, וכן בדיקות
תאימות, אבטחת תלויות, טיפוסים ובנייה. חבילת המקור שפורסמה אומתה מול manifest,
ה־domain, הגרסה, הממשק והמסמכים של חוזה ההטמעה.

`release-verification.json` ו־`SHA256SUMS.json` בחבילה מכילים מקור וחתימות תוכן.
קוד המקור המצורף נלקח רק מה־commit שפורסם; הוא אינו כולל שינויים מקומיים שלא שוחררו,
נתוני התקנה, גיבויים או אסימונים. חתימות SHA256 מאפשרות לבדוק שלמות, ואינן חתימה קריפטוגרפית של ספק.

העתק לצוות הפיתוח / Claude:

> Implement the SMPLWISE VMS WisKey module using the released same-origin embed
> contract v1 and the included reference adapter. Begin with this instruction file.
> Reuse the original screens; discover permitted navigation through `wiskey:ready`,
> send navigation through `wiskey:navigate`, and update VMS selection only from
> `wiskey:location`. Preserve operator identity, drafts, themes and media lifecycle.
> Do not expose service tokens, call private panel methods, reimplement ISAPI or
> alter WisKey storage. Use the rc.25 catalog and released source only if separate
> backend views are required. Report actual VMS deployment acceptance separately;
> do not claim conditional fields, an independent VMS action API or physical media
> acceptance based on this package.
