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
