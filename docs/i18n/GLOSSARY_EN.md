# English interface glossary

Owner round 32: Q-SYS-7 (b) - a Hebrew / English switch in the main app, the lead translates the English; Q-DES-9 (b) - every
operator term is translated except "NVR"; Q-DES-10 (c) - "Home Assistant" may stay in settings screens. This file is the one
word list for every English catalogue (`src/i18n/*`, `src/tickets/*-text.ts`, `src/water/i18n.ts` and the source-text tables of
`src/i18n/msg/*`). A new term is added here in the same commit that first uses it.

## Style

- Natural product English, not a word-for-word rendering of the Hebrew. Short labels, plain sentences, no jargon an operator
  would not use.
- British spelling, as the existing catalogues: colour, catalogue, licence (noun), cancelled, centre, metre, programme (not for
  software), organisation, analyse.
- Sentence case for every label, title and button ("Event centre", not "Event Centre"); product names keep their own case
  (WisKey, SmplWise Arx, WhatsApp, Frigate).
- Buttons are verbs in the imperative: Save, Cancel, Delete, Try again, Add a camera. A confirmation question ends with "?"
  and its buttons repeat the verb ("Delete the case?" - Delete / Keep).
- Placeholders `{name}` stay exactly as in the Hebrew (same names, same count). Plurals follow the number when the Hebrew
  splits them; otherwise prefer a wording that works for 1 and many ("Cameras: {n}").
- Dates and numbers follow the language (en-GB in English). Hebrew unit abbreviations become English ones: דק׳ -> min,
  שנ׳ -> s, ש׳ -> h, ימים -> days, ק״ג -> kg, סה״כ -> Total.
- Hebrew keyboard / form hints (ת״ז, ח.פ., מע״מ) become their English concepts: ID number, company number, VAT.
- Operator screens never name the home platform; where the Hebrew says "התשתית" / "תשתית המערכת" for it, English says "the
  platform". Settings screens may say "Home Assistant" where the Hebrew does (Q-DES-10).
- "NVR" stays "NVR" (Q-DES-9). Other device words are translated (מקליט = recorder when the Hebrew does not say NVR).

## Navigation and modes

| Hebrew | English |
| --- | --- |
| ראשי | Home |
| שידור חי / לייב / מצב חי | Live |
| תמונת מצב | Overview |
| כל המצלמות | All cameras |
| תצוגות שמורות | Saved views |
| מפות / מפה | Maps / Map |
| מפת קומה | Floor map |
| אתרים ומבנים | Sites and buildings |
| חקירה | Investigate (mode), investigation (noun) |
| מרכז אירועים | Event centre |
| הקלטות | Recordings |
| ניגון מסונכרן | Synced playback |
| מפה היסטורית | History map |
| סקירה | Review |
| תיקים / תיק | Cases / case |
| חוקים והתראות | Rules and alerts |
| ייצוא / ייצואים | Export / exports |
| בריאות מצלמות | Camera health |
| מערכת | System |
| הגדרות | Settings |
| כללי | General |
| אבטחה | Security |
| אזעקה | Alarm |
| תשתיות | Infrastructure |
| מוני חשמל / מונים | Electricity meters / meters |
| מים | Water |
| גנרטור | Generator |
| מעליות | Elevators (lifts in prose is acceptable, the label is Elevators) |
| טמפרטורות | Temperatures |
| מולטימדיה | Multimedia |
| מסכים | Screens |
| נגנים ורמקולים | Players and speakers |
| יומנים / יומן | Calendars / calendar |
| לוח הודעות | Notice board |
| קברניט | Skipper (the automation assistant's name) |
| מבט על | Overview (building) / bird's-eye view (map, Frigate birdseye) |
| החשבון שלי | My account |
| המסך שלי | My screen |
| סדר הלשוניות | Tab order |
| הכניסות שלי | My sign-ins |
| יציאה | Sign out |
| אודיט / יומן שינויים | Audit log / change log |
| אחסון | Storage |
| עדכונים / עדכון זמין | Updates / update available |
| אשף התקנה | Setup wizard |
| מוכנות | Readiness |
| חיבורים | Connections |
| קטלוג התקנים | Device catalogue |
| תזמונים / תזמון | Schedules / schedule |
| אוטומציות | Automations |
| מסכי קיר | Wall screens |
| בקרת כניסה | Access control |
| מרכז הכניסה | Access centre |

## Places and things

| Hebrew | English |
| --- | --- |
| אתר | Site |
| מבנה / בניין | Building |
| קומה | Floor |
| אזור (בבניין) | Area |
| אזור (Frigate, זיהוי) | Zone |
| חדר | Room |
| כניסה (מקום) | Entrance |
| התקן | Device |
| ישות | Entity (settings only; operator screens say device) |
| מצלמה | Camera |
| זרם ראשי / משני | Main stream / sub stream |
| איכות רגילה / גבוהה | Standard quality / high quality |
| צילום / תמונה | Snapshot / picture |
| קטע (וידאו) | Clip |
| דלת, שער, מנעול | Door, gate, lock |
| עמדה / עמדות (אינטרקום) | Station / stations (door station when it needs context) |
| אינטרקום | Intercom |
| חלון האינטרקום | The intercom window |
| מסך ציבורי | Public screen |
| רמקול | Speaker |
| חיישן | Sensor |
| תאורה | Lights |
| מזגן | Air conditioner |
| דוד | Water heater |
| ברז / מגוף | Valve |
| שואב | Robot vacuum |
| מונה | Meter |
| מעלית | Elevator |

## People and permissions

| Hebrew | English |
| --- | --- |
| משתמש | User |
| מנהל מערכת | System administrator |
| מנהל אתר | Site administrator |
| מפעיל / מפעילים | Operator / operators |
| עורך | Editor |
| צופה | Viewer |
| תפקיד | Role |
| הרשאה / הרשאות | Permission / permissions |
| שיוך | Assignment |
| דייר / דיירים | Resident / residents |
| אורח | Guest |
| ספק / ספקים | Vendor / vendors |
| איש קשר | Contact |
| מתקין | Installer |
| טכנאי | Technician |
| נמען / נמענים | Recipient / recipients |
| אנשים | People |
| פרופיל (גישה) | Profile (access profile) |
| כרטיס / תג | Card / tag |
| קוד | Code |

## Events, alerts and work

| Hebrew | English |
| --- | --- |
| אירוע | Event |
| התראה (מהמערכת, על מצב) | Alert |
| התראה (הודעה למשתמש), מרכז ההתראות | Notification, notification centre |
| הגדרות התראות | Notification settings |
| חומרה | Severity (critical, alert, info -> Critical, Alert, Info) |
| אישור (של התראה) | Acknowledge / acknowledged |
| הסלמה | Escalation |
| שעות שקט | Quiet hours |
| השתקה | Mute |
| אירוע חי (מצב אירוע) | Live incident |
| אירוע (incident) | Incident |
| קריאה / קריאות (מודול הקריאות) | Ticket / tickets (when the installation renames the module, its own name is used) |
| טיפול / תחזוקה | Maintenance |
| ביקור | Visit |
| הצעת מחיר / בקשה להצעת מחיר | Quote / request for quote |
| חיוב / חשבון | Bill / account |
| צריכה | Usage |
| לקוח | Customer |
| תעריף | Tariff |
| נוכחות | Presence |
| הכרזה | Announcement |
| שידור (למסך) | Cast (verb) / casting |
| הקלטה | Recording |
| ניגון | Playback |
| גיבוי / שחזור | Backup / restore |
| סנכרון | Sync |
| בריאות | Health |
| אבחון | Diagnostics |
| יומן (log) | Log |

## Common words and buttons

| Hebrew | English |
| --- | --- |
| שמירה / נשמר | Save / Saved |
| ביטול | Cancel |
| סגירה / סגור | Close |
| מחיקה | Delete |
| הסרה | Remove |
| עריכה | Edit |
| הוספה | Add |
| חזרה | Back |
| אישור (כפתור) | OK, or the action verb (Confirm) |
| המשך | Continue |
| נסה שוב / ניסיון חוזר | Try again |
| טוען… | Loading… |
| אין נתונים להצגה | Nothing to show |
| אין הרשאה | No permission |
| לא ידוע | Unknown |
| פעיל / לא פעיל | Active / inactive |
| מופעל / כבוי (מתג) | On / off |
| דולק / כבוי (תאורה) | On / off |
| פתוח / סגור / נעול | Open / closed / locked |
| מחובר / מנותק | Connected / disconnected |
| לא זמין | Unavailable |
| ברירת מחדל | Default |
| כמו ההגדרה של המערכת | Same as the system setting |
| חיפוש | Search |
| מסננים / ניקוי מסננים | Filters / clear filters |
| הכול | All |
| עוד | More |
| היום / אתמול | Today / yesterday |
| לפני {n} דק׳ | {n} min ago |
| עכשיו | Now |
| שעה / ימים | Hour / days |

## Terms added while translating (I18N-EN-SWITCH-2438)

Collected from the module passes; the first column is the Hebrew as the screens write it.

| Hebrew | English |
| --- | --- |
| מערכת הבית | home system (settings) |
| תחנה / עמדה (WisKey) | station |
| ממסר / מיפוי ממסרים | relay / relay mapping |
| אמצעי זיהוי | credentials |
| מס׳ עובד / מזהה עובד | employee no. / employee ID |
| עובד / מבקר / קבלן (קטגוריה) | staff / visitor / contractor |
| השבתה / מושבת / הפעלה | deactivate / deactivated / activate |
| פתוח קבוע / החזקה פתוחה | held open / hold-open |
| אבחון הרשאות | access diagnostics |
| אימות דו־שלבי / אפליקציית אימות / מפתח גישה | two-step verification / authenticator app / passkey |
| זהות שירות | service identity |
| כניסות (sessions) | sign-ins |
| השתקה (התראת עמדה לזמן קצוב) | snooze |
| סטייה (שעון) / סטיית שעון | drift / clock drift |
| סיסמת חטיפה | duress password |
| רשת (החשמל), אובדן רשת, מתג העברה | mains, mains lost, transfer switch |
| הספק / הספק נקוב / מקדם הספק | power / rated power / power factor |
| מתח / זרם / תדר / פאזה | voltage / current / frequency / phase |
| סל״ד / שעות עבודה / התנעה | RPM / running hours / start |
| ניתוב התראות / ספי התראה | alert routing / alert thresholds |
| קוט״ש | kWh |
| כיול / מקדם / הפרש | calibration / factor / offset |
| תעו״ז, פס, עונה | time of use, band, season |
| סוג יום / שם באנגלית (תעריף) | day type / English name |
| יומן מצונזר / מזהה בקשה / יומן הביקורת | redacted log / request id / audit log |
| הפקת חיוב / הנפקה / אסמכתה | create bill / issue / reference |
| טריגר / תנאי / פעולה | trigger / condition / action |
| סצנה / סקריפט / תרחיש | scene / script / scenario |
| משבצת | slot |
| דריכה / נטרול | arm / disarm |
| שבת וחג / מוצאי שבת | Shabbat and holidays / after Shabbat |
| סל המחזור | recycle bin |
| הרצה יבשה | dry run |
| חבילת ראיות / סימנייה | evidence bundle / bookmark |
| שעון־אב | master clock |
| לוח הקלטה / לוחות זימון | recording schedule / arming schedules |
| חציית קו / פריצה לאזור | line crossing / intrusion |
| מסכת פרטיות | privacy mask |
| קידוד / קצב | codec, encoding / bitrate |
| הזמנה (חדר) / מוזמנים / מארגן | booking / attendees / organiser |
| חלון תחזוקה | maintenance window |
| תריס / תריס גלילה / סוכך | blind / roller blind / awning |
| מתגים מוגנים | protected switches |
| פריסה (מסך) | layout |
| שלט / מגבר / שומר מסך | remote / amplifier / screensaver |
| לוח תצוגה | TV board |
| בדיקה מקדימה | preflight check |
| סבב / נקודת בדיקה | round / checkpoint |
| ספק (מודול התחזוקה) | supplier (the maintenance module's existing English; tickets and quotes say vendor) |

## Map, 3D view and plan wizard (CR-I18N-MAP / CR-I18N-PLANWIZARD)

| Hebrew | English |
| --- | --- |
| מפלס | Level (inside a floor); קומה stays Floor |
| תוכנית / תוכנית קומה | Plan / floor plan |
| סטודיו התוכניות / סטודיו | Plan Studio / the studio |
| אשף (תוכנית חדשה) | Wizard (the new-plan wizard) |
| זיהוי | Detection (of walls, openings and rooms in a plan) |
| לבדיקה / בספק / בביטחון | To review / In doubt / Confident |
| מועמד | Candidate |
| פתח | Opening (door, window or passage) |
| מעבר פתוח | Open passage |
| מחבר | Connector (stairs, ramp, elevator, ladder) |
| פודסט | Landing |
| טריבונה | Tribune |
| חלל משותף | Shared space |
| קנה מידה | Scale |
| ערכה / ערכת סגנון | Kit / style kit |
| סיור (במפה התלת-ממדית) | Walk (eye-level walk); the security "סיור" stays Patrol |
| תמונה מוכנה | Prepared picture |
| סכמטי / מלא / ריאליסטי / ריאליסטי קל | Schematic / Full / Realistic / Realistic lite |
| מפסק (במפה) | Breaker |
| ישות (במפה, מסך מפעיל) | Device |
| כיסוי / שדה ראייה | Coverage / field of view |
| מ׳ | m |

### The "3D map" settings card (CR-UI-POLISH-2443, `src/i18n/msg/api-plan-view.ts`, `src/i18n/msg/plan-view-card.ts`)

| Hebrew | English |
| --- | --- |
| מפה תלת־ממדית (the settings card) | 3D map |
| לפי ההתקנה / ההעדפה שלי / ברירת המחדל של ההתקנה | As the installation / My preference / Installation default (as the look card) |
| פעיל / כבוי (a dial of the card) | On / Off (a switch; "Active" stays the word for a status) |
| אוטומטי (a choice) | Automatic (as the 3D view's own menu) |
| חיתוך קירות | Wall cut-away |
| מבט מלמעלה | Top view |
| תצוגת כל הקומות | The all-floors view |
| תווית (על המפה) | Label (the room's label on the map) |
| חלון פירוט | Details window |
| פאנל בצד / כרטיס צף / גיליון | Side panel / floating card / sheet |
| סימון מצב החדר | Room state marking |
| פס על ראש הקיר / פס ברצפה / צביעת הרצפה | Wall-top bar / floor line / floor tint |
| רקע (מאחורי הבית, בתצוגת כל הקומות) | Backdrop |
| ריצוף | Flooring |
| סף (האשף) | Threshold |
| נכנס / לא נכנס (פריט שזוהה) | Included / not included (as the wizard's settings dialog) |
| מוקד | Control room |
| נגיעה | Tap |

## Known single-key compromises

A source-text table has one English per Hebrew text in a module. Where one Hebrew word carries two meanings in the same module,
the English follows the commoner one until the Hebrew is split (a follow-up per module):
calendars "חזרה" (Back / Repeat), components "סגור" (Close / Closed), "יציאה" (Sign out / the remote's Exit key),
system-b "שמירה" (Save / Retention: the Retention tab is left in Hebrew), media "אחר" (Other / move later), devices "אחר"
(Other / move later), electricity "ביטול" (Cancel / Undo),
map "קומה אחרת" (a label and the end of a sentence: lower case "another floor"), map "מחוץ למבנה הראשי" (lower case, it
follows a number), plan-wizard "קיר" / "דלת" / "חלון" (a choice label and the object of "זוהה כ": English says "Detected: Wall").

## Home interface (CR-I18N-HOME-2441, `src/i18n/msg/home.ts`)

Family words: no platform, product or protocol names, and no operator jargon.

| Hebrew | English |
| --- | --- |
| ממשק ביתי / ממשק מלא | Home interface / full interface |
| מנהל הבית | The home manager |
| בני הבית | The household |
| הבית שלי | My home |
| מסך קיר | Wall screen |
| מועדפים / חדר מועדף | Favourites / favourite room |
| מפסקים / מפסק שאינו אור | Switches / non-light switch |
| מיזוג | Air conditioning |
| כיבוי החדר / כיבוי כל הבית | Room off / Whole house off |
| כריזה בבית | Home announcement |
| פנייה / פניות שירות | Request / service requests |
| יומן הבית | Home diary |
| מי בבית | Who is home |
| לא להפריע | Do not disturb |
| ערכת נושא | Theme |
| קוט״ש / מ״ק | kWh / m³ |

Sentence parts: where the Hebrew screen joins a word to a name or a number (`'חזרה אל '`, `' דולקים'`, `'ב{name}'`), the key keeps
its space and the English carries the matching space. One Hebrew, two meanings in this module: "סגור" (Close / a closed gate)
follows the commoner one, the button.

Stay Hebrew in every interface language (data saved on the server, read by other people): the title of a room booking
("הזמנה: ...") and the default title of a service request ("תקלה: ...").

## API layer texts (CR-I18N-API-2442, `src/i18n/msg/api-*.ts`)

| Hebrew | English |
| --- | --- |
| תשתית המערכת (in an error or a state line) | the platform |
| רכיב החיבור | the connection component |
| הגשר / מצומד / צימוד | the bridge / paired / pairing |
| דריכה מלאה / דריכה בבית / נטרול | Arm away / Arm home / Disarm |
| ערכים חסויים / קוד חסוי | Hidden values / hidden code |
| נשמרה בהאצלה | Saved by delegation |
| הסלמה / ציר ההסלמה | Escalation / escalation timeline |
| שעות שקט | Quiet hours |
| דחיפה | Push |
| מרכז (the notification channel) | Centre |
| מטפל (service requests) | Handler |
| דרישת תשלום | Payment request |
| תעריף לפי שעות | Time-of-use tariff |
| מונה מצטבר | Accumulating meter |
| זרם ראשי / זרם משני | Main stream / sub stream |
| תרגום (H.265 to H.264) | Transcode |
| סימנייה ל־NVR | Bookmark to the NVR |
| מוכן למסירה / חסם | Ready for handover / blocker |

Sentence builders (`api/automations.ts`, `api/schedules.ts`, `api/notifications.ts`): the summary lines are joined from parts, so
the English keys are lower-case parts ("detects motion", "for {for}", " and ", "before", "sunset") and each part carries the space
the Hebrew part carries. The Hebrew joiner " ו" (no space after it) is " and " in English. The action verbs that end with a
maqaf in Hebrew ("נגן ב־") have no maqaf in English, so the builder puts a space before the name.

One Hebrew, two meanings in one table: in `api-automation`, "סגור" (Close a blind / a closed state) and "הפעל" (Turn on /
Activate) follow the action verb; "נפתח" / "נסגר" (opens / is opening) follow the state label "Opening" / "Closing"; "שעה"
is "hour" there (a unit) and "Time" in `api-home` (the clock widget).

Stay Hebrew in every interface language: the building marker and the name given to a new building ("בניין"), the demo
stores, and the Hebrew calendar date (the day and year in letters, "פרשת" - an owner question of CR-I18N-UNITS-2442).

Durations, weekday letters and weather units (`msg/time`, CR-I18N-UNITS-2442): a duration in words is spelled with its number
("שעה" = "1 hour", "שעתיים" = "2 hours", "{n} שעות" = "{n} hours"; parts joined by " and "); the short forms are "ms", "s", "min", "h",
"d" ("2 min 5 s", "1 h 30 min", "3 d 2 h"); "עוד ..." is "In ..."; the day toggles are "S M T W T F S" and the day names in a
sentence "Sun" ... "Sat"; weather units are the SI symbols ("km/h", "m/s", "hPa", "mbar").

## Typed confirmation words (CR-I18N-CONFIRM-WORDS-2442, `src/i18n/confirm-words.ts`)

The fixed words an operator types before a dangerous action have one English counterpart each (owner decision 17.11). The server
accepts the Hebrew word or the English one (trimmed, case ignored); the English interface shows the English word, every other
language the Hebrew one. The table is shared with the backend (`smplwise_vms/backend/smplwise/services/confirm_words.py`); a word
is changed in both files, never in a screen. The English is lower case, a plain imperative or the name of the thing, no article.

| Hebrew | English |
|---|---|
| שמור | save |
| הסר | remove |
| אפשר נטרול | allow disarm |
| מחיקה לצמיתות | delete permanently |
| הרחב בירור | widen lookup |
| פתיחת דלת לבדיקה | open door for test |
| שעון השרת | server clock |
| הצגת המפתח | show key |
| ייבוא תצורה | import configuration |
| מחיקת אירועים | delete events |
| החלה על העמדות | apply to stations |
| תזמון תחזוקה | schedule maintenance |
| אתחול | reinitialise |
| אשר | confirm |
| נמחק | deleted |
| בטל הכל | revoke all |
| מחק | delete |
| בטל מבקרים | revoke visitors |
| מאשר ניהול התקנה | approve managed install |
| מאשר סיכון סביבה | approve environment risk |
| מאשר העברה לניהול | approve move to managed |
| קוד {slot} | code {slot} |
| מחיקה (calendar guest details; compared in the browser only) | delete |

What the operator types that is DATA stays as the screen shows it in every language: a station's name, a user name, a count.
